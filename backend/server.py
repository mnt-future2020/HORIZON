from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import jwt, JWTError
import redis.asyncio as aioredis
import os
import uuid
import logging
import random
import json
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Redis
redis_url = os.environ.get('REDIS_URL')
redis_client: aioredis.Redis = None

JWT_SECRET = os.environ.get('JWT_SECRET')
JWT_ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI(title="Horizon Sports API")
api_router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

# Lock config
SOFT_LOCK_TTL = 600      # 10 minutes
HARD_LOCK_TTL = 1800     # 30 minutes

def lock_key(venue_id: str, date: str, start_time: str, turf: int) -> str:
    return f"lock:{venue_id}:{date}:{start_time}:{turf}"


# ── Auth Helpers ──
def hash_pw(pw):
    return pwd_context.hash(pw)

def verify_pw(plain, hashed):
    return pwd_context.verify(plain, hashed)

def create_token(uid, role):
    return jwt.encode(
        {"sub": uid, "role": role, "exp": datetime.now(timezone.utc) + timedelta(hours=72)},
        JWT_SECRET, algorithm=JWT_ALGORITHM
    )

async def get_current_user(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except JWTError:
        raise HTTPException(401, "Invalid token")

async def get_optional_user(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    except Exception:
        return None


# ── Pydantic Models ──
class RegisterInput(BaseModel):
    name: str
    email: str
    password: str
    role: str = "player"
    phone: Optional[str] = ""
    sports: Optional[List[str]] = []

class LoginInput(BaseModel):
    email: str
    password: str

class VenueCreate(BaseModel):
    name: str
    description: str
    sports: List[str]
    address: str
    city: str
    lat: Optional[float] = 12.9716
    lng: Optional[float] = 77.5946
    amenities: Optional[List[str]] = []
    images: Optional[List[str]] = []
    base_price: int = 2000
    slot_duration_minutes: int = 60
    opening_hour: int = 6
    closing_hour: int = 23
    turfs: int = 1

class BookingCreate(BaseModel):
    venue_id: str
    date: str
    start_time: str
    end_time: str
    turf_number: int = 1
    sport: str = "football"
    payment_mode: str = "full"
    split_count: Optional[int] = None

class PricingRuleCreate(BaseModel):
    name: str
    priority: int = 0
    conditions: dict = {}
    action: dict = {}
    is_active: bool = True

class MatchRequestCreate(BaseModel):
    sport: str
    date: str
    time: str
    venue_name: Optional[str] = ""
    players_needed: int
    min_skill: Optional[int] = 0
    max_skill: Optional[int] = 3000
    description: Optional[str] = ""

class MercenaryCreate(BaseModel):
    sport: str
    venue_name: str
    date: str
    time: str
    position_needed: str
    amount_per_player: int
    spots_available: int = 1

class AcademyCreate(BaseModel):
    name: str
    sport: str
    description: str
    monthly_fee: int
    location: str
    max_students: int = 50
    schedule: str


# ── Auth Routes ──
@api_router.post("/auth/register")
async def register(input: RegisterInput):
    existing = await db.users.find_one({"email": input.email})
    if existing:
        raise HTTPException(400, "Email already registered")
    user = {
        "id": str(uuid.uuid4()),
        "name": input.name,
        "email": input.email,
        "password_hash": hash_pw(input.password),
        "role": input.role,
        "phone": input.phone or "",
        "avatar": "",
        "sports": input.sports or [],
        "preferred_position": "",
        "skill_rating": 1500,
        "skill_deviation": 350,
        "reliability_score": 100,
        "total_games": 0,
        "wins": 0,
        "losses": 0,
        "draws": 0,
        "no_shows": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    user.pop("_id", None)
    token = create_token(user["id"], user["role"])
    return {"token": token, "user": {k: v for k, v in user.items() if k != "password_hash"}}

@api_router.post("/auth/login")
async def login(input: LoginInput):
    user = await db.users.find_one({"email": input.email})
    if not user or not verify_pw(input.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_token(user["id"], user["role"])
    user.pop("_id", None)
    return {"token": token, "user": {k: v for k, v in user.items() if k != "password_hash"}}

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return {k: v for k, v in user.items() if k != "password_hash"}

@api_router.put("/auth/profile")
async def update_profile(request: Request, user=Depends(get_current_user)):
    data = await request.json()
    allowed = ["name", "phone", "sports", "preferred_position", "avatar"]
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return updated


# ── Venue Routes ──
@api_router.get("/venues")
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

@api_router.get("/venues/{venue_id}")
async def get_venue(venue_id: str):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(404, "Venue not found")
    return venue

@api_router.post("/venues")
async def create_venue(input: VenueCreate, user=Depends(get_current_user)):
    if user["role"] != "venue_owner":
        raise HTTPException(403, "Only venue owners can create venues")
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

@api_router.put("/venues/{venue_id}")
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

@api_router.get("/owner/venues")
async def get_owner_venues(user=Depends(get_current_user)):
    if user["role"] != "venue_owner":
        raise HTTPException(403, "Only venue owners")
    venues = await db.venues.find({"owner_id": user["id"]}, {"_id": 0}).to_list(100)
    return venues


# ── Slot Routes (with Redis Locking) ──
@api_router.get("/venues/{venue_id}/slots")
async def get_slots(venue_id: str, date: str, request: Request):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(404, "Venue not found")

    # Get optional user for lock ownership check
    current_user = await get_optional_user(request)
    current_uid = current_user["id"] if current_user else None

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

    slots = []
    duration = venue.get("slot_duration_minutes", 60)

    # Build all slot keys for batch Redis check
    slot_defs = []
    for turf in range(1, venue.get("turfs", 1) + 1):
        for hour in range(venue.get("opening_hour", 6), venue.get("closing_hour", 23)):
            start = f"{hour:02d}:00"
            end_h = hour + (duration // 60)
            end = f"{end_h:02d}:00"
            slot_defs.append((start, end, turf))

    # Batch check Redis locks via pipeline
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

    for start, end, turf in slot_defs:
        is_booked = f"{start}-{turf}" in booked_set
        slot_lock_key = f"{start}-{turf}"
        locked_by = lock_map.get(slot_lock_key)

        # Determine slot status
        if is_booked:
            status = "booked"
        elif locked_by and locked_by == current_uid:
            status = "locked_by_you"
        elif locked_by:
            status = "on_hold"
        else:
            status = "available"

        # Calculate price
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


# ── Slot Lock Routes ──
class SlotLockInput(BaseModel):
    venue_id: str
    date: str
    start_time: str
    turf_number: int = 1

@api_router.post("/slots/lock")
async def acquire_slot_lock(input: SlotLockInput, user=Depends(get_current_user)):
    """Acquire a soft lock (10 min) on a slot. Uses Redis SETNX for atomicity."""
    if not redis_client:
        raise HTTPException(503, "Locking service unavailable")

    key = lock_key(input.venue_id, input.date, input.start_time, input.turf_number)

    # Check if slot is already booked in DB
    existing = await db.bookings.find_one({
        "venue_id": input.venue_id, "date": input.date,
        "start_time": input.start_time, "turf_number": input.turf_number,
        "status": {"$in": ["confirmed", "pending"]}
    })
    if existing:
        raise HTTPException(409, "Slot already booked")

    # Atomic lock: SET key value NX EX ttl
    acquired = await redis_client.set(key, user["id"], nx=True, ex=SOFT_LOCK_TTL)
    if not acquired:
        # Check if we already own the lock
        current = await redis_client.get(key)
        current_val = current.decode() if isinstance(current, bytes) else current
        if current_val == user["id"]:
            # Refresh our own lock
            await redis_client.expire(key, SOFT_LOCK_TTL)
            ttl = await redis_client.ttl(key)
            return {
                "locked": True, "lock_key": key, "ttl": ttl,
                "lock_type": "soft", "message": "Lock refreshed"
            }
        raise HTTPException(409, "Slot is currently on hold by another user")

    ttl = await redis_client.ttl(key)
    logger.info(f"Lock acquired: {key} by {user['id']} (TTL: {ttl}s)")
    return {
        "locked": True, "lock_key": key, "ttl": ttl,
        "lock_type": "soft", "message": "Slot locked for 10 minutes"
    }

@api_router.post("/slots/unlock")
async def release_slot_lock(input: SlotLockInput, user=Depends(get_current_user)):
    """Release a lock. Only the lock owner can release it."""
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

@api_router.post("/slots/extend-lock")
async def extend_slot_lock(input: SlotLockInput, user=Depends(get_current_user)):
    """Extend a soft lock to a hard lock (30 min) for payment processing."""
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
    return {
        "locked": True, "lock_key": key, "ttl": ttl,
        "lock_type": "hard", "message": "Lock extended for payment processing (30 min)"
    }

@api_router.get("/slots/my-locks")
async def get_my_locks(user=Depends(get_current_user)):
    """Get all active locks held by the current user."""
    if not redis_client:
        return {"locks": []}

    try:
        all_keys = await redis_client.keys("lock:*")
        locks = []
        for key in all_keys:
            key_str = key.decode() if isinstance(key, bytes) else key
            val = await redis_client.get(key)
            if not val:
                continue
            val_str = val.decode() if isinstance(val, bytes) else val
            if val_str == user["id"]:
                ttl = await redis_client.ttl(key)
                parts = key_str.split(":")
                if len(parts) == 5:
                    locks.append({
                        "lock_key": key_str,
                        "venue_id": parts[1], "date": parts[2],
                        "start_time": parts[3], "turf_number": int(parts[4]),
                        "ttl": ttl, "lock_type": "hard" if ttl > SOFT_LOCK_TTL else "soft"
                    })
        return {"locks": locks}
    except Exception as e:
        logger.warning(f"Failed to get locks: {e}")
        return {"locks": []}

@api_router.get("/slots/lock-status")
async def get_lock_status(venue_id: str, date: str, start_time: str, turf_number: int = 1):
    """Check lock status of a specific slot."""
    if not redis_client:
        return {"locked": False}

    key = lock_key(venue_id, date, start_time, turf_number)
    val = await redis_client.get(key)
    if not val:
        return {"locked": False, "lock_key": key}

    ttl = await redis_client.ttl(key)
    val_str = val.decode() if isinstance(val, bytes) else val
    return {
        "locked": True, "lock_key": key,
        "locked_by": val_str, "ttl": ttl,
        "lock_type": "hard" if ttl > SOFT_LOCK_TTL else "soft"
    }


# ── Booking Routes (with Lock Integration) ──
@api_router.post("/bookings")
async def create_booking(input: BookingCreate, user=Depends(get_current_user)):
    venue = await db.venues.find_one({"id": input.venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(404, "Venue not found")

    # Redis lock check: if someone else holds the lock, reject
    if redis_client:
        key = lock_key(input.venue_id, input.date, input.start_time, input.turf_number)
        lock_owner = await redis_client.get(key)
        if lock_owner:
            owner_str = lock_owner.decode() if isinstance(lock_owner, bytes) else lock_owner
            if owner_str != user["id"]:
                raise HTTPException(409, "Slot is locked by another user. Please wait or choose a different slot.")

    existing = await db.bookings.find_one({
        "venue_id": input.venue_id, "date": input.date,
        "start_time": input.start_time, "turf_number": input.turf_number,
        "status": {"$in": ["confirmed", "pending"]}
    })
    if existing:
        raise HTTPException(409, "Slot already booked")

    price = venue.get("base_price", 2000)
    rules = await db.pricing_rules.find(
        {"venue_id": input.venue_id, "is_active": True}, {"_id": 0}
    ).sort("priority", -1).to_list(100)
    try:
        dow = datetime.strptime(input.date, "%Y-%m-%d").weekday()
    except Exception:
        dow = 0
    for rule in rules:
        cond = rule.get("conditions", {})
        act = rule.get("action", {})
        match = True
        if "days" in cond and dow not in cond["days"]:
            match = False
        if "time_range" in cond:
            tr = cond["time_range"]
            if input.start_time < tr.get("start", "00:00") or input.start_time >= tr.get("end", "23:59"):
                match = False
        if match:
            if act.get("type") == "multiplier":
                price = int(price * act.get("value", 1))
            elif act.get("type") == "discount":
                price = int(price * (1 - act.get("value", 0)))

    booking = {
        "id": str(uuid.uuid4()), "venue_id": input.venue_id,
        "venue_name": venue["name"], "host_id": user["id"],
        "host_name": user["name"], "date": input.date,
        "start_time": input.start_time, "end_time": input.end_time,
        "turf_number": input.turf_number, "sport": input.sport,
        "total_amount": price, "payment_mode": input.payment_mode,
        "players": [user["id"]],
        "status": "confirmed" if input.payment_mode == "full" else "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    if input.payment_mode == "split" and input.split_count:
        split_token = str(uuid.uuid4())[:8]
        per_share = price // input.split_count
        booking["split_config"] = {
            "total_shares": input.split_count,
            "per_share": per_share,
            "shares_paid": 1,
            "split_token": split_token
        }
        sp = {
            "id": str(uuid.uuid4()), "booking_id": booking["id"],
            "split_token": split_token, "payer_id": user["id"],
            "payer_name": user["name"], "amount": per_share,
            "status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()
        }
        await db.split_payments.insert_one(sp)

    await db.bookings.insert_one(booking)
    booking.pop("_id", None)
    await db.venues.update_one({"id": input.venue_id}, {"$inc": {"total_bookings": 1}})
    await db.users.update_one({"id": user["id"]}, {"$inc": {"total_games": 1}})

    # Release Redis lock after successful booking
    if redis_client:
        key = lock_key(input.venue_id, input.date, input.start_time, input.turf_number)
        await redis_client.delete(key)
        logger.info(f"Lock released after booking: {key}")

    return booking

@api_router.get("/bookings")
async def list_bookings(user=Depends(get_current_user)):
    if user["role"] == "venue_owner":
        venues = await db.venues.find({"owner_id": user["id"]}, {"id": 1, "_id": 0}).to_list(100)
        vids = [v["id"] for v in venues]
        bookings = await db.bookings.find({"venue_id": {"$in": vids}}, {"_id": 0}).sort("date", -1).to_list(200)
    else:
        bookings = await db.bookings.find(
            {"$or": [{"host_id": user["id"]}, {"players": user["id"]}]}, {"_id": 0}
        ).sort("date", -1).to_list(200)
    return bookings

@api_router.get("/bookings/{booking_id}")
async def get_booking(booking_id: str):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Booking not found")
    return booking

@api_router.post("/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: str, user=Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking["host_id"] != user["id"]:
        raise HTTPException(403, "Only the host can cancel")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": "cancelled"}})
    if booking.get("split_config"):
        await db.split_payments.update_many(
            {"booking_id": booking_id}, {"$set": {"status": "refunded"}}
        )
    # Release any Redis lock for this slot
    if redis_client:
        key = lock_key(booking["venue_id"], booking["date"], booking["start_time"], booking.get("turf_number", 1))
        await redis_client.delete(key)
    return {"message": "Booking cancelled"}


# ── Split Payment Routes ──
@api_router.get("/split/{token}")
async def get_split_info(token: str):
    booking = await db.bookings.find_one({"split_config.split_token": token}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Split payment not found")
    payments = await db.split_payments.find({"split_token": token}, {"_id": 0}).to_list(100)
    sc = booking.get("split_config", {})
    return {
        "booking": booking, "payments": payments,
        "remaining": sc.get("total_shares", 0) - sc.get("shares_paid", 0),
        "per_share": sc.get("per_share", 0)
    }

@api_router.post("/split/{token}/pay")
async def pay_split(token: str, request: Request):
    body = await request.json()
    payer_name = body.get("payer_name", "Anonymous")
    booking = await db.bookings.find_one({"split_config.split_token": token})
    if not booking:
        raise HTTPException(404, "Split payment not found")
    sc = booking.get("split_config", {})
    if sc.get("shares_paid", 0) >= sc.get("total_shares", 0):
        raise HTTPException(400, "All shares already paid")

    payment = {
        "id": str(uuid.uuid4()), "booking_id": booking["id"],
        "split_token": token, "payer_id": "",
        "payer_name": payer_name, "amount": sc["per_share"],
        "status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()
    }
    await db.split_payments.insert_one(payment)
    payment.pop("_id", None)

    new_paid = sc["shares_paid"] + 1
    updates = {"split_config.shares_paid": new_paid}
    if new_paid >= sc["total_shares"]:
        updates["status"] = "confirmed"
    await db.bookings.update_one({"id": booking["id"]}, {"$set": updates})
    return {"message": "Payment successful (MOCKED)", "payment": payment}


# ── Pricing Rules Routes ──
@api_router.get("/venues/{venue_id}/pricing-rules")
async def get_pricing_rules(venue_id: str):
    rules = await db.pricing_rules.find({"venue_id": venue_id}, {"_id": 0}).sort("priority", -1).to_list(100)
    return rules

@api_router.post("/venues/{venue_id}/pricing-rules")
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

@api_router.delete("/pricing-rules/{rule_id}")
async def delete_pricing_rule(rule_id: str, user=Depends(get_current_user)):
    result = await db.pricing_rules.delete_one({"id": rule_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Rule not found")
    return {"message": "Rule deleted"}


# ── Matchmaking Routes ──
@api_router.get("/matchmaking")
async def list_matches(sport: Optional[str] = None):
    query = {"status": "open"}
    if sport:
        query["sport"] = sport
    matches = await db.match_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return matches

@api_router.post("/matchmaking")
async def create_match(input: MatchRequestCreate, user=Depends(get_current_user)):
    match = {
        "id": str(uuid.uuid4()), "creator_id": user["id"],
        "creator_name": user["name"], **input.model_dump(),
        "players_joined": [user["id"]], "player_names": [user["name"]],
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.match_requests.insert_one(match)
    match.pop("_id", None)
    return match

@api_router.post("/matchmaking/{match_id}/join")
async def join_match(match_id: str, user=Depends(get_current_user)):
    match = await db.match_requests.find_one({"id": match_id})
    if not match:
        raise HTTPException(404, "Match not found")
    if user["id"] in match.get("players_joined", []):
        raise HTTPException(400, "Already joined")
    joined = match.get("players_joined", [])
    names = match.get("player_names", [])
    joined.append(user["id"])
    names.append(user["name"])
    updates = {"players_joined": joined, "player_names": names}
    if len(joined) >= match.get("players_needed", 10):
        updates["status"] = "filled"
    await db.match_requests.update_one({"id": match_id}, {"$set": updates})
    return {"message": "Joined match"}


# ── Mercenary Routes ──
@api_router.get("/mercenary")
async def list_mercenary(sport: Optional[str] = None):
    query = {"status": "open"}
    if sport:
        query["sport"] = sport
    posts = await db.mercenary_posts.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return posts

@api_router.post("/mercenary")
async def create_mercenary(input: MercenaryCreate, user=Depends(get_current_user)):
    post = {
        "id": str(uuid.uuid4()), "host_id": user["id"],
        "host_name": user["name"], **input.model_dump(),
        "applicants": [], "accepted": [],
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.mercenary_posts.insert_one(post)
    post.pop("_id", None)
    return post

@api_router.post("/mercenary/{post_id}/apply")
async def apply_mercenary(post_id: str, user=Depends(get_current_user)):
    post = await db.mercenary_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(404, "Post not found")
    if user["id"] in [a.get("id") for a in post.get("applicants", [])]:
        raise HTTPException(400, "Already applied")
    applicant = {"id": user["id"], "name": user["name"], "skill_rating": user.get("skill_rating", 1500)}
    applicants = post.get("applicants", [])
    applicants.append(applicant)
    updates = {"applicants": applicants}
    if len(post.get("accepted", [])) + 1 >= post.get("spots_available", 1):
        updates["status"] = "filled"
    await db.mercenary_posts.update_one({"id": post_id}, {"$set": updates})
    return {"message": "Applied successfully"}


# ── Academy Routes ──
@api_router.get("/academies")
async def list_academies(sport: Optional[str] = None):
    query = {"status": "active"}
    if sport:
        query["sport"] = sport
    academies = await db.academies.find(query, {"_id": 0}).to_list(100)
    return academies

@api_router.post("/academies")
async def create_academy(input: AcademyCreate, user=Depends(get_current_user)):
    if user["role"] != "coach":
        raise HTTPException(403, "Only coaches can create academies")
    academy = {
        "id": str(uuid.uuid4()), "coach_id": user["id"],
        "coach_name": user["name"], **input.model_dump(),
        "current_students": 0, "students": [],
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.academies.insert_one(academy)
    academy.pop("_id", None)
    return academy

@api_router.get("/academies/{academy_id}")
async def get_academy(academy_id: str):
    academy = await db.academies.find_one({"id": academy_id}, {"_id": 0})
    if not academy:
        raise HTTPException(404, "Academy not found")
    return academy

@api_router.post("/academies/{academy_id}/students")
async def add_student(academy_id: str, request: Request, user=Depends(get_current_user)):
    body = await request.json()
    student = {
        "id": str(uuid.uuid4()),
        "name": body.get("name", ""),
        "email": body.get("email", ""),
        "phone": body.get("phone", ""),
        "joined_at": datetime.now(timezone.utc).isoformat(),
        "subscription_status": "active"
    }
    await db.academies.update_one(
        {"id": academy_id},
        {"$push": {"students": student}, "$inc": {"current_students": 1}}
    )
    return student

@api_router.delete("/academies/{academy_id}/students/{student_id}")
async def remove_student(academy_id: str, student_id: str, user=Depends(get_current_user)):
    academy = await db.academies.find_one({"id": academy_id})
    if not academy:
        raise HTTPException(404, "Academy not found")
    students = [s for s in academy.get("students", []) if s["id"] != student_id]
    await db.academies.update_one(
        {"id": academy_id},
        {"$set": {"students": students, "current_students": len(students)}}
    )
    return {"message": "Student removed"}


# ── Analytics Routes ──
@api_router.get("/analytics/venue/{venue_id}")
async def venue_analytics(venue_id: str, user=Depends(get_current_user)):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(404, "Venue not found")
    bookings = await db.bookings.find({"venue_id": venue_id}, {"_id": 0}).to_list(500)
    total_revenue = sum(b.get("total_amount", 0) for b in bookings if b.get("status") in ["confirmed", "completed"])
    confirmed = [b for b in bookings if b.get("status") in ["confirmed", "completed"]]
    cancelled = [b for b in bookings if b.get("status") == "cancelled"]
    sports_breakdown = {}
    for b in confirmed:
        s = b.get("sport", "other")
        sports_breakdown[s] = sports_breakdown.get(s, 0) + 1
    daily_revenue = {}
    for b in confirmed:
        d = b.get("date", "unknown")
        daily_revenue[d] = daily_revenue.get(d, 0) + b.get("total_amount", 0)
    return {
        "total_bookings": len(bookings), "confirmed_bookings": len(confirmed),
        "cancelled_bookings": len(cancelled), "total_revenue": total_revenue,
        "avg_booking_value": total_revenue // max(len(confirmed), 1),
        "sports_breakdown": sports_breakdown,
        "daily_revenue": [{"date": k, "revenue": v} for k, v in sorted(daily_revenue.items())]
    }

@api_router.get("/analytics/player")
async def player_analytics(user=Depends(get_current_user)):
    bookings = await db.bookings.find(
        {"$or": [{"host_id": user["id"]}, {"players": user["id"]}]}, {"_id": 0}
    ).to_list(200)
    total_spent = sum(b.get("total_amount", 0) for b in bookings if b.get("status") in ["confirmed", "completed"])
    sports_played = {}
    for b in bookings:
        s = b.get("sport", "other")
        sports_played[s] = sports_played.get(s, 0) + 1
    return {
        "total_games": len(bookings), "total_spent": total_spent,
        "skill_rating": user.get("skill_rating", 1500),
        "reliability_score": user.get("reliability_score", 100),
        "wins": user.get("wins", 0), "losses": user.get("losses", 0),
        "draws": user.get("draws", 0), "sports_played": sports_played
    }


# ── Seed Demo Data ──
VENUE_IMAGES = [
    "https://images.unsplash.com/photo-1763494392824-bbb80840ead4?w=800&q=80",
    "https://images.unsplash.com/photo-1750716413341-fd5d93296a76?w=800&q=80",
    "https://images.unsplash.com/photo-1770085057829-97e7a45e1916?w=800&q=80",
    "https://images.unsplash.com/photo-1750716413756-b66624b64ce4?w=800&q=80"
]

async def seed_demo_data():
    logger.info("Seeding demo data...")
    await db.users.delete_many({})
    await db.venues.delete_many({})
    await db.bookings.delete_many({})
    await db.split_payments.delete_many({})
    await db.pricing_rules.delete_many({})
    await db.match_requests.delete_many({})
    await db.mercenary_posts.delete_many({})
    await db.academies.delete_many({})

    owner_id = str(uuid.uuid4())
    player_id = str(uuid.uuid4())
    coach_id = str(uuid.uuid4())

    users = [
        {"id": player_id, "name": "Arjun Kumar", "email": "demo@player.com",
         "password_hash": hash_pw("demo123"), "role": "player", "phone": "9876543210",
         "avatar": "", "sports": ["football", "cricket"], "preferred_position": "midfielder",
         "skill_rating": 1650, "skill_deviation": 200, "reliability_score": 92,
         "total_games": 47, "wins": 22, "losses": 18, "draws": 7, "no_shows": 1,
         "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": owner_id, "name": "Mr. Reddy", "email": "demo@owner.com",
         "password_hash": hash_pw("demo123"), "role": "venue_owner", "phone": "9876543211",
         "avatar": "", "sports": [], "preferred_position": "",
         "skill_rating": 1500, "skill_deviation": 350, "reliability_score": 100,
         "total_games": 0, "wins": 0, "losses": 0, "draws": 0, "no_shows": 0,
         "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": coach_id, "name": "Coach Sarah", "email": "demo@coach.com",
         "password_hash": hash_pw("demo123"), "role": "coach", "phone": "9876543212",
         "avatar": "", "sports": ["badminton"], "preferred_position": "",
         "skill_rating": 2100, "skill_deviation": 150, "reliability_score": 98,
         "total_games": 120, "wins": 85, "losses": 30, "draws": 5, "no_shows": 0,
         "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db.users.insert_many(users)

    v_ids = [str(uuid.uuid4()) for _ in range(4)]
    venues = [
        {"id": v_ids[0], "owner_id": owner_id, "name": "PowerPlay Arena",
         "description": "Premium football turf with floodlights and changing rooms. Bengaluru's finest 5-a-side arena.",
         "sports": ["football"], "address": "123 Koramangala 5th Block", "city": "Bengaluru",
         "lat": 12.9352, "lng": 77.6245, "amenities": ["Parking", "Changing Rooms", "Floodlights", "Water Cooler"],
         "images": [VENUE_IMAGES[0]], "base_price": 2000, "slot_duration_minutes": 60,
         "opening_hour": 6, "closing_hour": 23, "turfs": 2, "rating": 4.6,
         "total_reviews": 128, "total_bookings": 45, "status": "active",
         "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": v_ids[1], "owner_id": owner_id, "name": "SmashPoint Courts",
         "description": "Professional badminton and table tennis facility. Air-conditioned indoor courts.",
         "sports": ["badminton", "table_tennis"], "address": "45 Indiranagar 12th Main", "city": "Bengaluru",
         "lat": 12.9784, "lng": 77.6408, "amenities": ["AC", "Pro Shop", "Coaching", "Cafe"],
         "images": [VENUE_IMAGES[2]], "base_price": 800, "slot_duration_minutes": 60,
         "opening_hour": 7, "closing_hour": 22, "turfs": 4, "rating": 4.8,
         "total_reviews": 89, "total_bookings": 67, "status": "active",
         "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": v_ids[2], "owner_id": owner_id, "name": "The Cricket Hub",
         "description": "Full-size cricket nets and practice pitches. Bowling machines available.",
         "sports": ["cricket"], "address": "78 HSR Layout Sector 2", "city": "Bengaluru",
         "lat": 12.9081, "lng": 77.6476, "amenities": ["Bowling Machine", "Nets", "Video Analysis", "Parking"],
         "images": [VENUE_IMAGES[1]], "base_price": 2500, "slot_duration_minutes": 60,
         "opening_hour": 6, "closing_hour": 21, "turfs": 3, "rating": 4.4,
         "total_reviews": 56, "total_bookings": 32, "status": "active",
         "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": v_ids[3], "owner_id": owner_id, "name": "Goal Zone",
         "description": "Budget-friendly football turf. Artificial grass, great for casual games.",
         "sports": ["football"], "address": "12 Whitefield Main Road", "city": "Bengaluru",
         "lat": 12.9698, "lng": 77.7500, "amenities": ["Parking", "Floodlights"],
         "images": [VENUE_IMAGES[3]], "base_price": 1500, "slot_duration_minutes": 60,
         "opening_hour": 6, "closing_hour": 23, "turfs": 1, "rating": 4.2,
         "total_reviews": 34, "total_bookings": 21, "status": "active",
         "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db.venues.insert_many(venues)

    pricing_rules = [
        {"id": str(uuid.uuid4()), "venue_id": v_ids[0], "name": "Weekend Surge",
         "priority": 10, "conditions": {"days": [5, 6], "time_range": {"start": "18:00", "end": "22:00"}},
         "action": {"type": "multiplier", "value": 1.2}, "is_active": True,
         "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "venue_id": v_ids[0], "name": "Early Bird Discount",
         "priority": 5, "conditions": {"time_range": {"start": "06:00", "end": "09:00"}},
         "action": {"type": "multiplier", "value": 0.85}, "is_active": True,
         "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "venue_id": v_ids[0], "name": "Peak Hours",
         "priority": 8, "conditions": {"days": [0, 1, 2, 3, 4], "time_range": {"start": "18:00", "end": "21:00"}},
         "action": {"type": "multiplier", "value": 1.1}, "is_active": True,
         "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db.pricing_rules.insert_many(pricing_rules)

    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
    next_week = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d")

    match_requests = [
        {"id": str(uuid.uuid4()), "creator_id": player_id, "creator_name": "Arjun Kumar",
         "sport": "football", "date": tomorrow, "time": "18:00",
         "venue_name": "PowerPlay Arena", "players_needed": 10, "min_skill": 1200,
         "max_skill": 2000, "description": "Friendly 5v5 after work. All levels welcome!",
         "players_joined": [player_id], "player_names": ["Arjun Kumar"],
         "status": "open", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "creator_id": str(uuid.uuid4()), "creator_name": "Vikram Shah",
         "sport": "cricket", "date": next_week, "time": "09:00",
         "venue_name": "The Cricket Hub", "players_needed": 22, "min_skill": 1000,
         "max_skill": 3000, "description": "Weekend cricket match. Need full teams!",
         "players_joined": [], "player_names": [],
         "status": "open", "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db.match_requests.insert_many(match_requests)

    mercenary_posts = [
        {"id": str(uuid.uuid4()), "host_id": player_id, "host_name": "Arjun Kumar",
         "sport": "football", "venue_name": "PowerPlay Arena",
         "date": tomorrow, "time": "19:00", "position_needed": "Goalkeeper",
         "amount_per_player": 200, "spots_available": 1,
         "applicants": [], "accepted": [], "status": "open",
         "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "host_id": str(uuid.uuid4()), "host_name": "Priya Nair",
         "sport": "badminton", "venue_name": "SmashPoint Courts",
         "date": tomorrow, "time": "20:00", "position_needed": "Doubles Partner",
         "amount_per_player": 400, "spots_available": 1,
         "applicants": [], "accepted": [], "status": "open",
         "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db.mercenary_posts.insert_many(mercenary_posts)

    academy = {
        "id": str(uuid.uuid4()), "coach_id": coach_id, "coach_name": "Coach Sarah",
        "name": "Sarah's Badminton Academy", "sport": "badminton",
        "description": "Professional badminton coaching for all ages. From beginners to advanced.",
        "monthly_fee": 2000, "location": "SmashPoint Courts, Indiranagar",
        "max_students": 50, "schedule": "Mon/Wed/Fri 5-7 PM, Sat 9-12 PM",
        "current_students": 3,
        "students": [
            {"id": str(uuid.uuid4()), "name": "Rahul Mehta", "email": "rahul@test.com",
             "phone": "9999888877", "joined_at": "2026-01-15T10:00:00Z", "subscription_status": "active"},
            {"id": str(uuid.uuid4()), "name": "Ananya Iyer", "email": "ananya@test.com",
             "phone": "9999888866", "joined_at": "2026-01-20T10:00:00Z", "subscription_status": "active"},
            {"id": str(uuid.uuid4()), "name": "Dev Patel", "email": "dev@test.com",
             "phone": "9999888855", "joined_at": "2026-02-01T10:00:00Z", "subscription_status": "pending"},
        ],
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.academies.insert_one(academy)
    logger.info("Demo data seeded successfully!")

@api_router.post("/seed")
async def seed():
    await seed_demo_data()
    return {"message": "Demo data seeded"}


# ── App Config ──
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

@app.on_event("startup")
async def startup():
    global redis_client
    try:
        redis_client = aioredis.from_url(redis_url, decode_responses=False)
        await redis_client.ping()
        logger.info("Redis connected for slot locking")
    except Exception as e:
        logger.warning(f"Redis unavailable, slot locking disabled: {e}")
        redis_client = None

    count = await db.users.count_documents({})
    if count == 0:
        await seed_demo_data()

@app.on_event("shutdown")
async def shutdown():
    if redis_client:
        await redis_client.close()
    client.close()
