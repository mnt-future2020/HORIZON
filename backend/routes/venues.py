from fastapi import APIRouter, HTTPException, Depends, Request, WebSocket, WebSocketDisconnect
from typing import Optional, Dict, List
from datetime import datetime
from database import db, get_redis, lock_key, SOFT_LOCK_TTL, HARD_LOCK_TTL
from auth import get_current_user, get_optional_user, get_platform_settings
from tz import now_ist
from models import VenueCreate, VenueUpdate, SlotLockInput, PricingRuleCreate
import uuid
import random
import math
import logging
import re
import json
import whatsapp_service

router = APIRouter()
logger = logging.getLogger("horizon")


# ---------------------------------------------------------------------------
# Pricing Rule Helper
# ---------------------------------------------------------------------------
def min_turf_price(data: dict) -> int:
    """Compute minimum turf price from turf_config. Fallback to existing base_price or 2000."""
    for tc in (data.get("turf_config") or []):
        for t in (tc.get("turfs") or []):
            if isinstance(t.get("price"), (int, float)) and t["price"] > 0:
                return min(
                    (t2["price"] for tc2 in (data.get("turf_config") or [])
                     for t2 in (tc2.get("turfs") or [])
                     if isinstance(t2.get("price"), (int, float)) and t2["price"] > 0),
                    default=data.get("base_price", 2000)
                )
    return data.get("base_price", 2000)


def _time_to_min(t: str) -> int:
    """Convert 'HH:MM' to total minutes. Handles zero-padded and single-digit hours."""
    try:
        h, m = t.split(":")
        return int(h) * 60 + int(m)
    except Exception:
        return 0


def apply_rule(price: int, rule: dict, date_str: str, slot_start: str, dow: int) -> int:
    """Apply one pricing rule. Returns new price (unchanged if rule doesn't match)."""
    stype = rule.get("schedule_type", "recurring")
    slot_min = _time_to_min(slot_start)

    if stype == "one_time":
        date_from = rule.get("date_from") or ""
        date_to = rule.get("date_to") or ""
        time_from = rule.get("time_from") or "00:00"
        time_to = rule.get("time_to") or "23:59"
        if not date_from or not (date_from <= date_str <= date_to):
            return price
        if not (_time_to_min(time_from) <= slot_min < _time_to_min(time_to)):
            return price
    else:  # recurring (also handles legacy rules)
        cond = rule.get("conditions", {})
        days = cond.get("days", [])
        if days and dow not in days:
            return price
        tr = cond.get("time_range", {})
        if tr:
            start_min = _time_to_min(tr.get("start", "00:00"))
            end_min   = _time_to_min(tr.get("end", "23:59"))
            if slot_min < start_min or slot_min >= end_min:
                return price

    # New rule format
    if "rule_type" in rule:
        rtype = rule["rule_type"]
        vtype = rule.get("value_type", "percent")
        val = float(rule.get("value", 0))
        if rtype == "discount":
            # Clamp percent to [0, 100] to prevent free/negative slots
            if vtype == "percent":
                val = min(max(val, 0), 100)
                return max(round(price * (1 - val / 100)), 0)
            return max(round(price - val), 0)
        elif rtype == "surge":
            if vtype == "percent":
                val = max(val, 0)
                return round(price * (1 + val / 100))
            return round(price + val)
        return price

    # Legacy format (action.type = "multiplier" | "discount")
    act = rule.get("action", {})
    if act.get("type") == "multiplier":
        return int(price * act.get("value", 1))
    elif act.get("type") == "discount":
        return int(price * (1 - min(max(act.get("value", 0), 0), 1.0)))
    return price


# ---------------------------------------------------------------------------
# Venue Live Connection Manager
# ---------------------------------------------------------------------------
class VenueConnectionManager:
    def __init__(self):
        self._clients: Dict[str, List[WebSocket]] = {}

    async def connect(self, venue_id: str, ws: WebSocket):
        await ws.accept()
        self._clients.setdefault(venue_id, []).append(ws)
        logger.info(f"WS connected venue={venue_id} total={len(self._clients[venue_id])}")

    def disconnect(self, venue_id: str, ws: WebSocket):
        lst = self._clients.get(venue_id, [])
        if ws in lst:
            lst.remove(ws)
        if not lst:
            self._clients.pop(venue_id, None)

    async def broadcast(self, venue_id: str, message: dict):
        clients = list(self._clients.get(venue_id, []))
        dead = []
        for ws in clients:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(venue_id, ws)


venue_manager = VenueConnectionManager()


def generate_slug(name: str) -> str:
    """Convert a venue name to a URL-friendly slug."""
    slug = name.lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug).strip('-')
    return slug


async def unique_slug(base_slug: str, exclude_id: str = None) -> str:
    """Ensure the slug is unique in the database."""
    slug = base_slug
    counter = 1
    while True:
        query = {"slug": slug}
        if exclude_id:
            query["id"] = {"$ne": exclude_id}
        existing = await db.venues.find_one(query)
        if not existing:
            return slug
        slug = f"{base_slug}-{counter}"
        counter += 1


def haversine_km(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@router.get("/venues")
async def list_venues(
    sport: Optional[str] = None, city: Optional[str] = None,
    area: Optional[str] = None, search: Optional[str] = None,
    min_price: Optional[int] = None, max_price: Optional[int] = None,
    sort_by: Optional[str] = None, amenity: Optional[str] = None
):
    query = {"status": "active"}
    if sport:
        query["sports"] = {"$in": [sport]}
    if city:
        esc_city = re.escape(city)
        query["city"] = {"$regex": f"^{esc_city}$", "$options": "i"}
    if area:
        esc_area = re.escape(area)
        query["area"] = {"$regex": esc_area, "$options": "i"}
    if search:
        esc_search = re.escape(search)
        query["$or"] = [
            {"name": {"$regex": esc_search, "$options": "i"}},
            {"address": {"$regex": esc_search, "$options": "i"}},
            {"city": {"$regex": esc_search, "$options": "i"}},
            {"area": {"$regex": esc_search, "$options": "i"}}
        ]
    if min_price is not None:
        query["base_price"] = query.get("base_price", {})
        query["base_price"]["$gte"] = min_price
    if max_price is not None:
        query["base_price"] = query.get("base_price", {})
        query["base_price"]["$lte"] = max_price
    if amenity:
        query["amenities"] = {"$in": [amenity]}

    sort_field = [("rating", -1)]
    if sort_by == "price_low":
        sort_field = [("base_price", 1)]
    elif sort_by == "price_high":
        sort_field = [("base_price", -1)]
    elif sort_by == "rating":
        sort_field = [("rating", -1)]
    elif sort_by == "name":
        sort_field = [("name", 1)]
    elif sort_by == "bookings":
        sort_field = [("total_bookings", -1)]

    venues = await db.venues.find(query, {"_id": 0}).sort(sort_field).to_list(200)

    # Mark venues that have an active offer (discount rule) right now
    if venues:
        venue_ids = [v["id"] for v in venues]
        today = now_ist().strftime("%Y-%m-%d")
        offer_rules = await db.pricing_rules.find(
            {"venue_id": {"$in": venue_ids}, "is_active": True, "rule_type": "discount"},
            {"venue_id": 1, "schedule_type": 1, "date_from": 1, "date_to": 1}
        ).to_list(500)

        offer_venue_ids = set()
        for r in offer_rules:
            stype = r.get("schedule_type", "recurring")
            if stype == "one_time":
                df = r.get("date_from") or ""
                dt = r.get("date_to") or ""
                if df and dt and df <= today <= dt:
                    offer_venue_ids.add(r["venue_id"])
            else:
                offer_venue_ids.add(r["venue_id"])

        for v in venues:
            v["has_active_offer"] = v["id"] in offer_venue_ids

    return venues


@router.get("/venues/cities")
async def list_cities():
    pipeline = [
        {"$match": {"status": "active"}},
        {"$group": {"_id": "$city", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    result = await db.venues.aggregate(pipeline).to_list(100)
    return [{"city": r["_id"], "count": r["count"]} for r in result if r["_id"]]


@router.get("/venues/areas")
async def list_areas(city: Optional[str] = None):
    match = {"status": "active", "area": {"$ne": "", "$exists": True}}
    if city:
        match["city"] = {"$regex": f"^{city}$", "$options": "i"}
    pipeline = [
        {"$match": match},
        {"$group": {"_id": "$area", "count": {"$sum": 1}, "city": {"$first": "$city"}}},
        {"$sort": {"count": -1}}
    ]
    result = await db.venues.aggregate(pipeline).to_list(200)
    return [{"area": r["_id"], "city": r["city"], "count": r["count"]} for r in result if r["_id"]]


@router.get("/venues/amenities")
async def list_amenities():
    pipeline = [
        {"$match": {"status": "active"}},
        {"$unwind": "$amenities"},
        {"$group": {"_id": "$amenities", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    result = await db.venues.aggregate(pipeline).to_list(100)
    return [{"amenity": r["_id"], "count": r["count"]} for r in result if r["_id"]]


@router.get("/venues/nearby")
async def nearby_venues(
    lat: float, lng: float, radius_km: float = 50,
    sport: Optional[str] = None, limit: int = 20
):
    query = {"status": "active", "lat": {"$exists": True}, "lng": {"$exists": True}}
    if sport:
        query["sports"] = {"$in": [sport]}
    venues = await db.venues.find(query, {"_id": 0}).to_list(200)
    results = []
    for v in venues:
        dist = haversine_km(lat, lng, v.get("lat", 0), v.get("lng", 0))
        if dist <= radius_km:
            v["distance_km"] = round(dist, 1)
            results.append(v)
    results.sort(key=lambda x: x["distance_km"])
    return results[:limit]


@router.get("/venues/nearby/drive-time")
async def nearby_venues_by_drive_time(
    lat: float, lng: float, radius_km: float = 50,
    sport: Optional[str] = None, limit: int = 20
):
    """Get nearby venues sorted by estimated drive time (Google Routes API or Haversine)."""
    query = {"status": "active", "lat": {"$exists": True}, "lng": {"$exists": True}}
    if sport:
        query["sports"] = {"$in": [sport]}
    venues = await db.venues.find(query, {"_id": 0}).to_list(200)

    # Filter by radius first (Haversine)
    nearby = []
    for v in venues:
        dist = haversine_km(lat, lng, v.get("lat", 0), v.get("lng", 0))
        if dist <= radius_km:
            v["distance_km"] = round(dist, 1)
            nearby.append(v)

    # Sort by drive time
    try:
        from services.drive_time import sort_venues_by_drive_time
        results = await sort_venues_by_drive_time(nearby, lat, lng)
    except Exception as e:
        logger.warning(f"Drive-time sorting failed, falling back to distance: {e}")
        results = sorted(nearby, key=lambda x: x.get("distance_km", 999))

    return results[:limit]


@router.get("/venues/slug/{venue_slug}")
async def get_venue_by_slug(venue_slug: str):
    venue = await db.venues.find_one({"slug": venue_slug, "status": "active"}, {"_id": 0})
    if not venue:
        raise HTTPException(404, "Venue not found")
    return venue


@router.websocket("/venues/ws/{venue_id}")
async def venue_websocket(venue_id: str, ws: WebSocket):
    await venue_manager.connect(venue_id, ws)
    try:
        while True:
            # Keep alive — clients can send pings
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        venue_manager.disconnect(venue_id, ws)
        logger.info(f"WS disconnected venue={venue_id}")


VENUE_SENSITIVE_FIELDS = {"owner_id", "contact_phone", "contact_email", "gst_number", "bank_details"}


@router.get("/venues/{venue_id}")
async def get_venue(venue_id: str, user=Depends(get_optional_user)):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(404, "Venue not found")
    if venue.get("status") == "suspended":
        raise HTTPException(404, "Venue not found")
    # Strip sensitive fields for non-owner requests
    if not user or user.get("id") != venue.get("owner_id"):
        for field in VENUE_SENSITIVE_FIELDS:
            venue.pop(field, None)
    return venue


@router.post("/venues")
async def create_venue(input: VenueCreate, user=Depends(get_current_user)):
    if user["role"] != "venue_owner":
        raise HTTPException(403, "Only venue owners can create venues")
    if user.get("account_status") != "active":
        raise HTTPException(403, "Your account is pending approval. Please wait for admin to approve.")
    user_plan = user.get("subscription_plan", "free")
    platform = await get_platform_settings()
    plans = platform.get("subscription_plans", [])
    plan_config = next((p for p in plans if p["id"] == user_plan), None)
    max_venues = plan_config["max_venues"] if plan_config else 1
    current_venues = await db.venues.count_documents({"owner_id": user["id"]})
    if current_venues >= max_venues:
        raise HTTPException(403, f"Your {user_plan.title()} plan allows max {max_venues} venue(s). Upgrade your plan to add more.")
    base_slug = generate_slug(input.name)
    slug = await unique_slug(base_slug)
    data = input.model_dump()
    # Auto-calculate total turfs from turf_config
    if data.get("turf_config"):
        total = sum(len(tc.get("turfs", [])) for tc in data["turf_config"])
        data["turfs"] = max(total, 1)
    # Use sent base_price if valid, else compute from min turf price
    if not data.get("base_price") or data["base_price"] <= 0:
        data["base_price"] = min_turf_price(data)
    venue = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "slug": slug,
        **data,
        "contact_phone": user.get("phone", ""),
        "badge": "bookable",
        "created_by": "owner",
        "rating": 0,
        "total_reviews": 0,
        "total_bookings": 0,
        "status": "active",
        "created_at": now_ist().isoformat()
    }
    await db.venues.insert_one(venue)
    venue.pop("_id", None)
    return venue


@router.put("/venues/{venue_id}")
async def update_venue(venue_id: str, input: VenueUpdate, user=Depends(get_current_user)):
    venue = await db.venues.find_one({"id": venue_id})
    if not venue or venue["owner_id"] != user["id"]:
        raise HTTPException(403, "Not authorized")
    updates = input.dict(exclude_unset=True)
    # Auto-calculate turfs from turf_config
    if "turf_config" in updates and updates["turf_config"]:
        updates["turfs"] = max(sum(len(tc.get("turfs", [])) for tc in updates["turf_config"]), 1)
        # Use sent base_price if valid, else compute from min turf price
        if not updates.get("base_price") or updates["base_price"] <= 0:
            updates["base_price"] = min_turf_price(updates)
    # If name is being updated, regenerate slug
    if "name" in updates:
        base_slug = generate_slug(updates["name"])
        updates["slug"] = await unique_slug(base_slug, exclude_id=venue_id)
    if updates:
        await db.venues.update_one({"id": venue_id}, {"$set": updates})
    updated = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    # Only send public-safe venue fields via WebSocket
    public_fields = ["id", "name", "slug", "description", "sports", "address", "city", "area",
                     "amenities", "images", "base_price", "rating", "total_reviews",
                     "total_bookings", "turfs", "turf_config", "opening_hour", "closing_hour",
                     "slot_duration_minutes", "lat", "lng", "status"]
    safe_venue = {k: updated.get(k) for k in public_fields if k in updated}
    await venue_manager.broadcast(venue_id, {"type": "venue_update", "venue": safe_venue})
    return updated


@router.get("/owner/venues")
async def get_owner_venues(user=Depends(get_current_user)):
    if user["role"] != "venue_owner":
        raise HTTPException(403, "Only venue owners")
    venues = await db.venues.find({"owner_id": user["id"]}, {"_id": 0}).to_list(100)
    return venues


# --- Venue Enquiry ---
@router.post("/venues/{venue_id}/enquiry")
async def venue_enquiry(venue_id: str, request: Request):
    """Save an enquiry and send WhatsApp message to venue owner via Cloud API."""
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(404, "Venue not found")
    data = await request.json()
    name = data.get("name", "").strip()
    phone = data.get("phone", "").strip()
    sport = data.get("sport", "").strip()
    date = data.get("date", "").strip()
    time_slot = data.get("time", "").strip()
    message = data.get("message", "").strip()
    if not name or not phone:
        raise HTTPException(400, "Name and phone are required")
    # Save enquiry to DB
    enquiry = {
        "id": str(uuid.uuid4()),
        "venue_id": venue_id,
        "venue_name": venue.get("name", ""),
        "name": name,
        "phone": phone,
        "sport": sport,
        "date": date,
        "time": time_slot,
        "message": message,
        "status": "new",
        "whatsapp_sent": False,
        "created_at": now_ist().isoformat()
    }
    await db.venue_enquiries.insert_one(enquiry)
    enquiry.pop("_id", None)

    # Send WhatsApp message via Cloud API
    contact = venue.get("contact_phone", "")
    if contact:
        platform = await get_platform_settings()
        wa_settings = platform.get("whatsapp", {})
        msg_body = whatsapp_service.build_enquiry_message(
            venue.get("name", ""), enquiry
        )
        result = await whatsapp_service.send_message(wa_settings, contact, msg_body)
        enquiry["whatsapp_sent"] = result.get("ok", False)
        if result.get("ok"):
            await db.venue_enquiries.update_one(
                {"id": enquiry["id"]}, {"$set": {"whatsapp_sent": True}}
            )
    return enquiry


# --- Slot Routes (with Redis Locking) ---
@router.get("/venues/{venue_id}/slots")
async def get_slots(venue_id: str, date: str, request: Request):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(404, "Venue not found")
    current_user = await get_optional_user(request)
    current_uid = current_user["id"] if current_user else None
    redis_client = get_redis()

    rules = await db.pricing_rules.find(
        {"venue_id": venue_id, "is_active": True}, {"_id": 0}
    ).sort("priority", -1).to_list(100)

    bookings = await db.bookings.find(
        {"venue_id": venue_id, "date": date, "status": {"$in": ["confirmed", "pending", "payment_pending"]}},
        {"_id": 0}
    ).to_list(100)
    duration = venue.get("slot_duration_minutes", 60)

    # Build booked_set handling multi-slot bookings (a booking may span multiple base slots)
    booked_set = set()
    for b in bookings:
        turf = b.get("turf_number", 1)
        b_start_parts = b["start_time"].split(":")
        b_end_parts = b["end_time"].split(":")
        b_start_min = int(b_start_parts[0]) * 60 + int(b_start_parts[1])
        b_end_min = int(b_end_parts[0]) * 60 + int(b_end_parts[1])
        current = b_start_min
        while current < b_end_min:
            h, m = divmod(current, 60)
            booked_set.add(f"{h:02d}:{m:02d}-{turf}")
            current += duration

    try:
        date_obj = datetime.strptime(date, "%Y-%m-%d")
        dow = date_obj.weekday()
    except Exception:
        dow = 0
    slot_defs = []
    opening_min = venue.get("opening_hour", 6) * 60
    closing_min = venue.get("closing_hour", 23) * 60

    # Build turf list from turf_config or fallback to simple numbering
    base_price = venue.get("base_price", 2000)
    turf_config = venue.get("turf_config")
    turf_list = []  # [(turf_number, turf_name, sport, turf_price)]
    if turf_config:
        idx = 1
        for tc in turf_config:
            sport = tc.get("sport", "")
            for t in tc.get("turfs", []):
                turf_list.append((idx, t.get("name", f"Turf {idx}"), sport, t.get("price", base_price)))
                idx += 1
    else:
        for turf in range(1, venue.get("turfs", 1) + 1):
            turf_list.append((turf, f"Turf {turf}", "", base_price))

    for turf_num, turf_name, sport, turf_price in turf_list:
        current_min = opening_min
        while current_min + duration <= closing_min:
            start_h, start_m = divmod(current_min, 60)
            end_h, end_m = divmod(current_min + duration, 60)
            start = f"{start_h:02d}:{start_m:02d}"
            end = f"{end_h:02d}:{end_m:02d}"
            slot_defs.append((start, end, turf_num, turf_name, sport, turf_price))
            current_min += duration

    lock_map = {}
    if redis_client:
        try:
            pipe = redis_client.pipeline()
            for start, end, turf_num, turf_name, sport, turf_price in slot_defs:
                pipe.get(lock_key(venue_id, date, start, turf_num))
            results = await pipe.execute()
            for i, (start, end, turf_num, turf_name, sport, turf_price) in enumerate(slot_defs):
                if results[i]:
                    lock_map[f"{start}-{turf_num}"] = results[i].decode() if isinstance(results[i], bytes) else results[i]
        except Exception as e:
            logger.warning(f"Redis lock check failed: {e}")

    slots = []
    for start, end, turf_num, turf_name, sport, turf_price in slot_defs:
        is_booked = f"{start}-{turf_num}" in booked_set
        slot_lock_key = f"{start}-{turf_num}"
        locked_by = lock_map.get(slot_lock_key)
        if is_booked:
            status = "booked"
        elif locked_by and locked_by == current_uid:
            status = "locked_by_you"
        elif locked_by:
            status = "on_hold"
        else:
            status = "available"

        original_price = turf_price or base_price
        price = original_price
        for rule in rules:
            price = apply_rule(price, rule, date, start, dow)

        slots.append({
            "start_time": start, "end_time": end, "turf_number": turf_num,
            "turf_name": turf_name, "sport": sport,
            "price": price,
            "original_price": original_price if price < original_price else None,
            "has_offer": price < original_price,
            "status": status,
            "locked_by": locked_by if locked_by and locked_by != current_uid else None,
        })
    return {"venue_id": venue_id, "date": date, "slots": slots}


# --- Slot Lock Routes ---
@router.post("/slots/lock")
async def acquire_slot_lock(input: SlotLockInput, user=Depends(get_current_user)):
    redis_client = get_redis()
    if not redis_client:
        raise HTTPException(503, "Locking service unavailable")
    key = lock_key(input.venue_id, input.date, input.start_time, input.turf_number)
    existing = await db.bookings.find_one({
        "venue_id": input.venue_id, "date": input.date,
        "start_time": input.start_time, "turf_number": input.turf_number,
        "status": {"$in": ["confirmed", "pending", "payment_pending"]}
    })
    if existing:
        raise HTTPException(409, "Slot already booked")
    acquired = await redis_client.set(key, user["id"], nx=True, ex=SOFT_LOCK_TTL)
    if not acquired:
        current = await redis_client.get(key)
        current_val = current.decode() if isinstance(current, bytes) else current
        if current_val == user["id"]:
            await redis_client.expire(key, SOFT_LOCK_TTL)
            ttl = await redis_client.ttl(key)
            return {"locked": True, "lock_key": key, "ttl": ttl, "lock_type": "soft", "message": "Lock refreshed"}
        raise HTTPException(409, "Slot is currently on hold by another user")
    ttl = await redis_client.ttl(key)
    logger.info(f"Lock acquired: {key} by {user['id']} (TTL: {ttl}s)")
    return {"locked": True, "lock_key": key, "ttl": ttl, "lock_type": "soft", "message": "Slot locked for 10 minutes"}


@router.post("/slots/unlock")
async def release_slot_lock(input: SlotLockInput, user=Depends(get_current_user)):
    redis_client = get_redis()
    if not redis_client:
        raise HTTPException(503, "Locking service unavailable")
    key = lock_key(input.venue_id, input.date, input.start_time, input.turf_number)
    current = await redis_client.get(key)
    if not current:
        return {"released": True, "message": "No lock found"}
    current_val = current.decode() if isinstance(current, bytes) else current
    if current_val != user["id"]:
        raise HTTPException(403, "You don't own this lock")
    await redis_client.delete(key)
    logger.info(f"Lock released: {key} by {user['id']}")
    return {"released": True, "message": "Lock released"}


@router.post("/slots/extend-lock")
async def extend_slot_lock(input: SlotLockInput, user=Depends(get_current_user)):
    redis_client = get_redis()
    if not redis_client:
        raise HTTPException(503, "Locking service unavailable")
    key = lock_key(input.venue_id, input.date, input.start_time, input.turf_number)
    current = await redis_client.get(key)
    if not current:
        raise HTTPException(404, "No active lock found")
    current_val = current.decode() if isinstance(current, bytes) else current
    if current_val != user["id"]:
        raise HTTPException(403, "You don't own this lock")
    await redis_client.expire(key, HARD_LOCK_TTL)
    ttl = await redis_client.ttl(key)
    logger.info(f"Lock extended to hard: {key} by {user['id']} (TTL: {ttl}s)")
    return {"locked": True, "lock_key": key, "ttl": ttl, "lock_type": "hard", "message": "Lock extended for payment processing (30 min)"}


@router.get("/slots/my-locks")
async def get_my_locks(user=Depends(get_current_user)):
    redis_client = get_redis()
    if not redis_client:
        return {"locks": [], "debug": "no redis client"}
    try:
        locks = []
        async for key in redis_client.scan_iter(match="lock:*", count=100):
            key_str = key.decode("utf-8") if isinstance(key, bytes) else str(key)
            val = await redis_client.get(key)
            if not val:
                continue
            val_str = val.decode("utf-8") if isinstance(val, bytes) else str(val)
            if val_str == user["id"]:
                ttl = await redis_client.ttl(key)
                parts = key_str.split(":")
                if len(parts) >= 6:
                    locks.append({
                        "lock_key": key_str,
                        "venue_id": parts[1], "date": parts[2],
                        "start_time": f"{parts[3]}:{parts[4]}", "turf_number": int(parts[5]),
                        "ttl": ttl, "lock_type": "hard" if ttl > SOFT_LOCK_TTL else "soft"
                    })
        return {"locks": locks}
    except Exception as e:
        logger.warning(f"Failed to get locks: {e}")
        return {"locks": []}


@router.get("/slots/lock-status")
async def get_lock_status(venue_id: str, date: str, start_time: str, turf_number: int = 1):
    redis_client = get_redis()
    if not redis_client:
        return {"locked": False}
    key = lock_key(venue_id, date, start_time, turf_number)
    val = await redis_client.get(key)
    if not val:
        return {"locked": False, "lock_key": key}
    ttl = await redis_client.ttl(key)
    val_str = val.decode() if isinstance(val, bytes) else val
    return {"locked": True, "lock_key": key, "locked_by": val_str, "ttl": ttl, "lock_type": "hard" if ttl > SOFT_LOCK_TTL else "soft"}


# --- Pricing Rules ---
@router.get("/venues/{venue_id}/pricing-rules")
async def get_pricing_rules(venue_id: str):
    rules = await db.pricing_rules.find({"venue_id": venue_id}, {"_id": 0}).sort("priority", -1).to_list(100)
    return rules


@router.post("/venues/{venue_id}/pricing-rules")
async def create_pricing_rule(venue_id: str, input: PricingRuleCreate, user=Depends(get_current_user)):
    if user["role"] != "venue_owner":
        raise HTTPException(403, "Only venue owners can manage pricing")
    venue = await db.venues.find_one({"id": venue_id}, {"owner_id": 1})
    if not venue or venue.get("owner_id") != user["id"]:
        raise HTTPException(403, "Not authorized for this venue")
    rule = {
        "id": str(uuid.uuid4()), "venue_id": venue_id,
        **input.model_dump(),
        "created_at": now_ist().isoformat()
    }
    await db.pricing_rules.insert_one(rule)
    rule.pop("_id", None)
    return rule


@router.put("/pricing-rules/{rule_id}")
async def update_pricing_rule(rule_id: str, input: PricingRuleCreate, user=Depends(get_current_user)):
    if user["role"] != "venue_owner":
        raise HTTPException(403, "Only venue owners can manage pricing")
    rule = await db.pricing_rules.find_one({"id": rule_id})
    if rule:
        venue = await db.venues.find_one({"id": rule["venue_id"]}, {"owner_id": 1})
        if not venue or venue.get("owner_id") != user["id"]:
            raise HTTPException(403, "Not authorized for this venue's pricing rules")
    result = await db.pricing_rules.update_one(
        {"id": rule_id},
        {"$set": {**input.model_dump(), "updated_at": now_ist().isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Rule not found")
    rule = await db.pricing_rules.find_one({"id": rule_id}, {"_id": 0})
    return rule


@router.put("/pricing-rules/{rule_id}/toggle")
async def toggle_pricing_rule(rule_id: str, user=Depends(get_current_user)):
    if user["role"] != "venue_owner":
        raise HTTPException(403, "Only venue owners can manage pricing")
    rule = await db.pricing_rules.find_one({"id": rule_id})
    if not rule:
        raise HTTPException(404, "Rule not found")
    venue = await db.venues.find_one({"id": rule["venue_id"]}, {"owner_id": 1})
    if not venue or venue.get("owner_id") != user["id"]:
        raise HTTPException(403, "Not authorized for this venue's pricing rules")
    new_status = not rule.get("is_active", True)
    await db.pricing_rules.update_one({"id": rule_id}, {"$set": {"is_active": new_status}})
    return {"id": rule_id, "is_active": new_status}


@router.delete("/pricing-rules/{rule_id}")
async def delete_pricing_rule(rule_id: str, user=Depends(get_current_user)):
    if user["role"] not in ("venue_owner", "super_admin"):
        raise HTTPException(403, "Only venue owners can manage pricing")
    rule = await db.pricing_rules.find_one({"id": rule_id})
    if rule and user["role"] == "venue_owner":
        venue = await db.venues.find_one({"id": rule["venue_id"]}, {"owner_id": 1})
        if not venue or venue.get("owner_id") != user["id"]:
            raise HTTPException(403, "Not authorized for this venue's pricing rules")
    result = await db.pricing_rules.delete_one({"id": rule_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Rule not found")
    return {"message": "Rule deleted"}
