from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional
from datetime import datetime, timezone
from database import db, get_redis, lock_key, SOFT_LOCK_TTL, HARD_LOCK_TTL
from auth import get_current_user, get_optional_user, get_platform_settings
from models import VenueCreate, SlotLockInput, PricingRuleCreate
import uuid
import random
import logging

router = APIRouter()
logger = logging.getLogger("horizon")


@router.get("/venues")
async def list_venues(sport: Optional[str] = None, city: Optional[str] = None, search: Optional[str] = None):
    query = {"status": "active"}
    if sport:
        query["sports"] = {"$in": [sport]}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"address": {"$regex": search, "$options": "i"}}
        ]
    venues = await db.venues.find(query, {"_id": 0}).to_list(100)
    return venues


@router.get("/venues/{venue_id}")
async def get_venue(venue_id: str):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
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
    venue = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        **input.model_dump(),
        "rating": 4.0 + round(random.random(), 1),
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
    if updates:
        await db.venues.update_one({"id": venue_id}, {"$set": updates})
    updated = await db.venues.find_one({"id": venue_id}, {"_id": 0})
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
        {"venue_id": venue_id, "date": date, "status": {"$in": ["confirmed", "pending"]}},
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
    for turf in range(1, venue.get("turfs", 1) + 1):
        for hour in range(venue.get("opening_hour", 6), venue.get("closing_hour", 23)):
            start = f"{hour:02d}:00"
            end_h = hour + (duration // 60)
            end = f"{end_h:02d}:00"
            slot_defs.append((start, end, turf))

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
        "status": {"$in": ["confirmed", "pending"]}
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
    new_status = not rule.get("is_active", True)
    await db.pricing_rules.update_one({"id": rule_id}, {"$set": {"is_active": new_status}})
    return {"id": rule_id, "is_active": new_status}


@router.delete("/pricing-rules/{rule_id}")
async def delete_pricing_rule(rule_id: str, user=Depends(get_current_user)):
    result = await db.pricing_rules.delete_one({"id": rule_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Rule not found")
    return {"message": "Rule deleted"}
