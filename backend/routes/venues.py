from fastapi import APIRouter, HTTPException, Depends, Request, WebSocket, WebSocketDisconnect
from typing import Optional, Dict, List
from datetime import datetime, timezone
from database import db, get_redis, lock_key, SOFT_LOCK_TTL, HARD_LOCK_TTL
from auth import get_current_user, get_optional_user, get_platform_settings
from models import VenueCreate, SlotLockInput, PricingRuleCreate
import uuid
import random
import math
import logging
import re
import json

router = APIRouter()
logger = logging.getLogger("horizon")


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


@router.get("/venues/{venue_id}")
async def get_venue(venue_id: str):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(404, "Venue not found")
    if venue.get("status") == "suspended":
        raise HTTPException(404, "Venue not found")
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
    venue = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "slug": slug,
        **input.model_dump(),
        "rating": 0,
        "total_reviews": 0,
        "total_bookings": 0,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.venues.insert_one(venue)
    venue.pop("_id", None)
    return venue


@router.put("/venues/{venue_id}")
async def update_venue(venue_id: str, request: Request, user=Depends(get_current_user)):
    venue = await db.venues.find_one({"id": venue_id})
    if not venue or venue["owner_id"] != user["id"]:
        raise HTTPException(403, "Not authorized")
    data = await request.json()
    allowed = ["name", "description", "sports", "address", "city", "amenities", "images",
               "base_price", "slot_duration_minutes", "opening_hour", "closing_hour", "turfs"]
    updates = {k: v for k, v in data.items() if k in allowed}
    # If name is being updated, regenerate slug
    if "name" in updates:
        base_slug = generate_slug(updates["name"])
        updates["slug"] = await unique_slug(base_slug, exclude_id=venue_id)
    if updates:
        await db.venues.update_one({"id": venue_id}, {"$set": updates})
    updated = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    # Broadcast live update to all public page viewers
    await venue_manager.broadcast(venue_id, {"type": "venue_update", "venue": updated})
    return updated


@router.get("/owner/venues")
async def get_owner_venues(user=Depends(get_current_user)):
    if user["role"] != "venue_owner":
        raise HTTPException(403, "Only venue owners")
    venues = await db.venues.find({"owner_id": user["id"]}, {"_id": 0}).to_list(100)
    return venues


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
    booked_set = {f"{b['start_time']}-{b.get('turf_number', 1)}" for b in bookings}

    try:
        date_obj = datetime.strptime(date, "%Y-%m-%d")
        dow = date_obj.weekday()
    except Exception:
        dow = 0

    duration = venue.get("slot_duration_minutes", 60)
    slot_defs = []
    opening_min = venue.get("opening_hour", 6) * 60
    closing_min = venue.get("closing_hour", 23) * 60
    for turf in range(1, venue.get("turfs", 1) + 1):
        current_min = opening_min
        while current_min + duration <= closing_min:
            start_h, start_m = divmod(current_min, 60)
            end_h, end_m = divmod(current_min + duration, 60)
            start = f"{start_h:02d}:{start_m:02d}"
            end = f"{end_h:02d}:{end_m:02d}"
            slot_defs.append((start, end, turf))
            current_min += duration

    lock_map = {}
    if redis_client:
        try:
            pipe = redis_client.pipeline()
            for start, end, turf in slot_defs:
                pipe.get(lock_key(venue_id, date, start, turf))
            results = await pipe.execute()
            for i, (start, end, turf) in enumerate(slot_defs):
                if results[i]:
                    lock_map[f"{start}-{turf}"] = results[i].decode() if isinstance(results[i], bytes) else results[i]
        except Exception as e:
            logger.warning(f"Redis lock check failed: {e}")

    slots = []
    for start, end, turf in slot_defs:
        is_booked = f"{start}-{turf}" in booked_set
        slot_lock_key = f"{start}-{turf}"
        locked_by = lock_map.get(slot_lock_key)
        if is_booked:
            status = "booked"
        elif locked_by and locked_by == current_uid:
            status = "locked_by_you"
        elif locked_by:
            status = "on_hold"
        else:
            status = "available"

        price = venue.get("base_price", 2000)
        for rule in rules:
            cond = rule.get("conditions", {})
            act = rule.get("action", {})
            match = True
            if "days" in cond and dow not in cond["days"]:
                match = False
            if "time_range" in cond:
                tr = cond["time_range"]
                if start < tr.get("start", "00:00") or start >= tr.get("end", "23:59"):
                    match = False
            if match:
                if act.get("type") == "multiplier":
                    price = int(price * act.get("value", 1))
                elif act.get("type") == "discount":
                    price = int(price * (1 - act.get("value", 0)))

        slots.append({
            "start_time": start, "end_time": end, "turf_number": turf,
            "price": price, "status": status,
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
        all_keys = await redis_client.keys("lock:*")
        logger.info(f"my-locks: found {len(all_keys)} lock keys, user={user['id']}")
        locks = []
        for key in all_keys:
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
        "created_at": datetime.now(timezone.utc).isoformat()
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
        {"$set": {**input.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}}
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
