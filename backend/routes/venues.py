from fastapi import APIRouter, Depends, Request, HTTPException
from typing import Optional
from database import db, redis_client
from auth import get_current_user, get_optional_user, get_platform_settings
from models import VenueCreate, SlotLockInput
from datetime import datetime, timezone
import uuid
import logging
import json

logger = logging.getLogger("horizon")
router = APIRouter(tags=["venues"])

VENUE_IMAGES = [
    "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800",
    "https://images.unsplash.com/photo-1587385789097-0197a7fbd179?w=800",
    "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800",
    "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800",
]


def lock_key(venue_id, date, start_time, turf_number):
    return f"lock:{venue_id}:{date}:{start_time}:{turf_number}"


@router.get("/venues")
async def list_venues(sport: Optional[str] = None, city: Optional[str] = None, search: Optional[str] = None):
    query = {}
    if sport:
        query["sports"] = sport
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"address": {"$regex": search, "$options": "i"}},
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

    import random
    venue = {
        "id": str(uuid.uuid4()), "owner_id": user["id"],
        **input.model_dump(),
        "images": input.images if input.images else [random.choice(VENUE_IMAGES)],
        "rating": round(random.uniform(3.5, 5.0), 1), "total_reviews": 0,
        "total_bookings": 0, "status": "active",
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
    allowed = ["name", "description", "sports", "address", "city", "base_price",
               "slot_duration_minutes", "opening_hour", "closing_hour", "turfs", "amenities", "images"]
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        await db.venues.update_one({"id": venue_id}, {"$set": updates})
    updated = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    return updated


@router.get("/owner/venues")
async def get_owner_venues(user=Depends(get_current_user)):
    venues = await db.venues.find({"owner_id": user["id"]}, {"_id": 0}).to_list(100)
    return venues


# ── Slot Routes (with Redis Locking) ──
@router.get("/venues/{venue_id}/slots")
async def get_slots(venue_id: str, date: str, request: Request):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(404, "Venue not found")

    user = await get_optional_user(request)
    user_id = user["id"] if user else None

    bookings = await db.bookings.find(
        {"venue_id": venue_id, "date": date, "status": {"$in": ["confirmed", "pending", "payment_pending"]}},
        {"_id": 0}
    ).to_list(100)
    booked = {}
    for b in bookings:
        key = f"{b['start_time']}-{b.get('turf_number', 1)}"
        booked[key] = b

    rules = await db.pricing_rules.find(
        {"venue_id": venue_id, "is_active": True}, {"_id": 0}
    ).sort("priority", -1).to_list(100)
    try:
        from datetime import datetime as dt
        dow = dt.strptime(date, "%Y-%m-%d").weekday()
    except Exception:
        dow = 0

    slots = []
    for turf in range(1, venue.get("turfs", 1) + 1):
        for hour in range(venue.get("opening_hour", 6), venue.get("closing_hour", 23)):
            start_time = f"{hour:02d}:00"
            end_time = f"{hour + 1:02d}:00"
            key = f"{start_time}-{turf}"
            price = venue.get("base_price", 2000)
            for rule in rules:
                cond = rule.get("conditions", {})
                act = rule.get("action", {})
                match = True
                if "days" in cond and dow not in cond["days"]:
                    match = False
                if "time_range" in cond:
                    tr = cond["time_range"]
                    if start_time < tr.get("start", "00:00") or start_time >= tr.get("end", "23:59"):
                        match = False
                if match:
                    if act.get("type") == "multiplier":
                        price = int(price * act.get("value", 1))
                    elif act.get("type") == "discount":
                        price = int(price * (1 - act.get("value", 0)))

            slot = {
                "start_time": start_time, "end_time": end_time,
                "turf_number": turf, "price": price, "status": "available"
            }
            if key in booked:
                slot["status"] = "booked"
            elif redis_client:
                lock_k = lock_key(venue_id, date, start_time, turf)
                try:
                    lock_owner = await redis_client.get(lock_k)
                    if lock_owner:
                        if user_id and lock_owner == user_id:
                            slot["status"] = "locked_by_you"
                        else:
                            slot["status"] = "on_hold"
                except Exception:
                    pass
            slots.append(slot)
    return slots


# ── Slot Lock Routes ──
@router.post("/slots/lock")
async def acquire_slot_lock(input: SlotLockInput, user=Depends(get_current_user)):
    if not redis_client:
        raise HTTPException(503, "Locking service unavailable")
    key = lock_key(input.venue_id, input.date, input.start_time, input.turf_number)
    existing = await redis_client.get(key)
    if existing and existing != user["id"]:
        raise HTTPException(409, "Slot is already locked by another user")
    await redis_client.set(key, user["id"], ex=600)
    return {"message": "Slot locked", "lock_key": key, "expires_in": 600}


@router.post("/slots/unlock")
async def release_slot_lock(input: SlotLockInput, user=Depends(get_current_user)):
    if not redis_client:
        return {"message": "OK"}
    key = lock_key(input.venue_id, input.date, input.start_time, input.turf_number)
    existing = await redis_client.get(key)
    if existing and existing == user["id"]:
        await redis_client.delete(key)
    return {"message": "Lock released"}


@router.post("/slots/extend-lock")
async def extend_slot_lock(input: SlotLockInput, user=Depends(get_current_user)):
    if not redis_client:
        return {"message": "OK"}
    key = lock_key(input.venue_id, input.date, input.start_time, input.turf_number)
    existing = await redis_client.get(key)
    if not existing:
        raise HTTPException(404, "No active lock found")
    if existing != user["id"]:
        raise HTTPException(403, "Lock belongs to another user")
    await redis_client.set(key, user["id"], ex=1800)
    return {"message": "Lock extended to 30 minutes (hard lock)", "expires_in": 1800}


@router.get("/slots/my-locks")
async def get_my_locks(user=Depends(get_current_user)):
    if not redis_client:
        return []
    locks = []
    async for key in redis_client.scan_iter("lock:*"):
        owner = await redis_client.get(key)
        if owner == user["id"]:
            parts = key.split(":")
            if len(parts) >= 5:
                venue_id = parts[1]
                date = parts[2]
                time_parts = parts[3:-1]
                start_time = ":".join(time_parts)
                turf_number = int(parts[-1])
                ttl = await redis_client.ttl(key)
                locks.append({
                    "venue_id": venue_id, "date": date,
                    "start_time": start_time, "turf_number": turf_number,
                    "ttl": ttl
                })
    return locks


@router.get("/slots/lock-status")
async def get_lock_status(venue_id: str, date: str, start_time: str, turf_number: int = 1):
    if not redis_client:
        return {"locked": False}
    key = lock_key(venue_id, date, start_time, turf_number)
    owner = await redis_client.get(key)
    ttl = await redis_client.ttl(key) if owner else 0
    return {"locked": bool(owner), "ttl": ttl}
