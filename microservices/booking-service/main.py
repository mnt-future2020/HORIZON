"""Booking Service - Bookings, payments, split, waitlist, matchmaking, ratings."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "shared"))

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from datetime import datetime, timezone, timedelta
from database import db, get_redis, lock_key, init_redis, close_connections
from auth import get_current_user, get_razorpay_client, get_platform_settings
from models import BookingCreate, MatchRequestCreate, MercenaryCreate, MatchResultSubmit
import uuid, hmac, hashlib, math, logging, asyncio

app = FastAPI(title="Lobbi Booking Service")
logger = logging.getLogger("lobbi")
logging.basicConfig(level=logging.INFO)

cors_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"])

@app.on_event("startup")
async def startup():
    await init_redis()

@app.on_event("shutdown")
async def shutdown():
    await close_connections()

PENDING_BOOKING_EXPIRY_HOURS = 24

# ─── Glicko-2 Engine ─────────────────────────────────────────────────────────
TAU = 0.5; EPSILON = 0.000001; GLICKO2_SCALE = 173.7178

def _r2g(r): return (r - 1500) / GLICKO2_SCALE
def _rd2g(rd): return rd / GLICKO2_SCALE
def _g2r(mu): return mu * GLICKO2_SCALE + 1500
def _g2rd(phi): return phi * GLICKO2_SCALE
def _g(phi): return 1 / math.sqrt(1 + 3 * phi**2 / math.pi**2)
def _E(mu, mj, pj): return 1 / (1 + math.exp(-_g(pj) * (mu - mj)))

def update_rating(rating, rd, volatility, opponents):
    if not opponents:
        phi = _rd2g(rd)
        return rating, min(_g2rd(math.sqrt(phi**2 + volatility**2)), 350), volatility
    mu, phi = _r2g(rating), _rd2g(rd)
    g2_opp = [(_r2g(r), _rd2g(d), s) for r, d, s in opponents]
    v = 1.0 / sum(_g(op)**2 * _E(mu, om, op) * (1 - _E(mu, om, op)) for om, op, _ in g2_opp) if g2_opp else float('inf')
    delta = v * sum(_g(op) * (s - _E(mu, om, op)) for om, op, s in g2_opp)
    a = math.log(volatility**2)
    def f(x):
        ex = math.exp(x)
        return ex * (delta**2 - phi**2 - v - ex) / (2 * (phi**2 + v + ex)**2) - (x - a) / TAU**2
    A = a
    B = math.log(delta**2 - phi**2 - v) if delta**2 > phi**2 + v else a - TAU
    while f(B) < 0: B -= TAU
    fA, fB = f(A), f(B)
    for _ in range(100):
        if abs(B - A) <= EPSILON: break
        C = A + (A - B) * fA / (fB - fA)
        fC = f(C)
        if fC * fB <= 0: A, fA = B, fB
        else: fA /= 2
        B, fB = C, fC
    new_sigma = math.exp(A / 2)
    phi_star = math.sqrt(phi**2 + new_sigma**2)
    new_phi = 1 / math.sqrt(1 / phi_star**2 + 1 / v)
    new_mu = mu + new_phi**2 * sum(_g(op) * (s - _E(mu, om, op)) for om, op, s in g2_opp)
    return max(100, min(3500, round(_g2r(new_mu)))), max(30, min(350, round(_g2rd(new_phi)))), round(new_sigma, 6)

def calculate_compatibility(pr, prd, mn, mx):
    mid = (mn + mx) / 2; rng = max(mx - mn, 1); dist = abs(pr - mid)
    score = (100 - dist / (rng/2) * 20) if mn <= pr <= mx else max(0, 80 - (mn - pr if pr < mn else pr - mx) / 10)
    return round(max(0, min(100, score - max(0, (prd - 100) / 350) * 10)))

def suggest_balanced_teams(players):
    if len(players) < 2: return players, [], 0
    sp = sorted(players, key=lambda p: p.get('skill_rating', 1500), reverse=True)
    ta, tb, sa, sb = [], [], 0, 0
    for i, p in enumerate(sp):
        r = p.get('skill_rating', 1500)
        if sa <= sb: ta.append(p); sa += r
        else: tb.append(p); sb += r
    return ta, tb, round(abs(sa/max(len(ta),1) - sb/max(len(tb),1)))

# ─── Rating History (Chain Hash) ─────────────────────────────────────────────
GENESIS_HASH = "GENESIS_0000000000000000000000000000000000000000000000000000000000000000"

def compute_record_hash(rec, prev_hash):
    payload = f"{rec['user_id']}|{rec['match_id']}|{rec['previous_rating']}|{rec['new_rating']}|{rec['delta']}|{rec['previous_rd']}|{rec['new_rd']}|{rec['result']}|{rec['team']}|{rec['timestamp']}|{prev_hash}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

async def create_rating_record(user_id, match_id, prev_rating, new_rating, prev_rd, new_rd, prev_vol, new_vol, result, team, opponent_snapshot, confirmations, match_sport, match_date, timestamp):
    last = await db.rating_history.find_one({"user_id": user_id}, {"_id": 0, "record_hash": 1}, sort=[("seq", -1)])
    prev_hash = last["record_hash"] if last else GENESIS_HASH
    count = await db.rating_history.count_documents({"user_id": user_id})
    record = {"user_id": user_id, "match_id": match_id, "seq": count + 1, "previous_rating": prev_rating, "new_rating": new_rating,
              "delta": new_rating - prev_rating, "previous_rd": prev_rd, "new_rd": new_rd,
              "previous_volatility": round(prev_vol, 6), "new_volatility": round(new_vol, 6),
              "result": result, "team": team, "sport": match_sport, "match_date": match_date,
              "opponent_snapshot": opponent_snapshot, "confirmations": confirmations, "timestamp": timestamp, "prev_hash": prev_hash}
    record["record_hash"] = compute_record_hash(record, prev_hash)
    await db.rating_history.insert_one(record)
    record.pop("_id", None)
    return record

# ─── Waitlist ────────────────────────────────────────────────────────────────
@app.post("/waitlist")
async def join_waitlist(request_data: dict, user=Depends(get_current_user)):
    venue_id, date, start_time = request_data.get("venue_id"), request_data.get("date"), request_data.get("start_time")
    turf_number = request_data.get("turf_number", 1)
    if not all([venue_id, date, start_time]): raise HTTPException(400, "venue_id, date, start_time required")
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "id": 1, "name": 1})
    if not venue: raise HTTPException(404, "Venue not found")
    booking = await db.bookings.find_one({"venue_id": venue_id, "date": date, "start_time": start_time, "turf_number": turf_number, "status": {"$in": ["confirmed","pending","payment_pending"]}})
    if not booking: raise HTTPException(400, "Slot is available — book directly")
    existing = await db.waitlist.find_one({"user_id": user["id"], "venue_id": venue_id, "date": date, "start_time": start_time, "turf_number": turf_number, "status": "waiting"})
    if existing: return {"message": "Already on waitlist", "position": existing.get("position", 1)}
    count = await db.waitlist.count_documents({"venue_id": venue_id, "date": date, "start_time": start_time, "turf_number": turf_number, "status": "waiting"})
    entry = {"id": str(uuid.uuid4()), "user_id": user["id"], "user_name": user["name"], "user_email": user.get("email",""), "user_phone": user.get("phone",""),
             "venue_id": venue_id, "venue_name": venue["name"], "date": date, "start_time": start_time, "turf_number": turf_number,
             "position": count + 1, "status": "waiting", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.waitlist.insert_one(entry); entry.pop("_id", None)
    return {"message": f"You're #{count+1} on the waitlist!", "position": count+1, "entry": entry}

@app.delete("/waitlist/{entry_id}")
async def leave_waitlist(entry_id: str, user=Depends(get_current_user)):
    entry = await db.waitlist.find_one({"id": entry_id, "user_id": user["id"]})
    if not entry: raise HTTPException(404, "Waitlist entry not found")
    await db.waitlist.update_one({"id": entry_id}, {"$set": {"status": "cancelled"}})
    await _reorder_positions(entry["venue_id"], entry["date"], entry["start_time"], entry["turf_number"])
    return {"message": "Removed from waitlist"}

@app.get("/waitlist")
async def my_waitlist(user=Depends(get_current_user)):
    return await db.waitlist.find({"user_id": user["id"], "status": "waiting"}, {"_id": 0}).sort("created_at", -1).to_list(50)

@app.get("/waitlist/slot")
async def get_slot_waitlist(venue_id: str, date: str, start_time: str, turf_number: int=1, user=Depends(get_current_user)):
    entries = await db.waitlist.find({"venue_id": venue_id, "date": date, "start_time": start_time, "turf_number": turf_number, "status": "waiting"}, {"_id": 0}).sort("position", 1).to_list(50)
    my = next((e for e in entries if e["user_id"] == user["id"]), None)
    return {"total_waiting": len(entries), "my_position": my["position"] if my else None, "my_entry": my, "is_waiting": my is not None}

async def promote_next_in_waitlist(venue_id, date, start_time, turf_number):
    nxt = await db.waitlist.find_one({"venue_id": venue_id, "date": date, "start_time": start_time, "turf_number": turf_number, "status": "waiting"}, sort=[("position", 1)])
    if not nxt: return None
    await db.waitlist.update_one({"id": nxt["id"]}, {"$set": {"status": "promoted", "promoted_at": datetime.now(timezone.utc).isoformat()}})
    await db.notifications.insert_one({"id": str(uuid.uuid4()), "user_id": nxt["user_id"], "type": "waitlist_promoted", "title": "You've Been Promoted!",
        "message": f"A slot opened at {nxt['venue_name']} — {start_time} on {date} (Turf {turf_number}). Book now!",
        "venue_id": venue_id, "is_read": False, "created_at": datetime.now(timezone.utc).isoformat()})
    await _reorder_positions(venue_id, date, start_time, turf_number)
    return nxt

async def _reorder_positions(venue_id, date, start_time, turf_number):
    entries = await db.waitlist.find({"venue_id": venue_id, "date": date, "start_time": start_time, "turf_number": turf_number, "status": "waiting"}).sort("position", 1).to_list(100)
    for idx, e in enumerate(entries):
        if e.get("position") != idx + 1:
            await db.waitlist.update_one({"id": e["id"]}, {"$set": {"position": idx + 1}})

# ─── Booking Routes ──────────────────────────────────────────────────────────
@app.post("/bookings")
async def create_booking(input: BookingCreate, user=Depends(get_current_user)):
    venue = await db.venues.find_one({"id": input.venue_id}, {"_id": 0})
    if not venue: raise HTTPException(404, "Venue not found")
    redis_client = get_redis()
    if redis_client:
        key = lock_key(input.venue_id, input.date, input.start_time, input.turf_number)
        lock_owner = await redis_client.get(key)
        if lock_owner:
            ov = lock_owner.decode() if isinstance(lock_owner, bytes) else lock_owner
            if ov != user["id"]: raise HTTPException(409, "Slot locked by another user")
    existing = await db.bookings.find_one({"venue_id": input.venue_id, "date": input.date, "start_time": input.start_time, "turf_number": input.turf_number, "status": {"$in": ["confirmed","pending","payment_pending"]}})
    if existing: raise HTTPException(409, "Slot already booked")
    price = venue.get("base_price", 2000)
    rules = await db.pricing_rules.find({"venue_id": input.venue_id, "is_active": True}, {"_id": 0}).sort("priority", -1).to_list(100)
    try: dow = datetime.strptime(input.date, "%Y-%m-%d").weekday()
    except: dow = 0
    for rule in rules:
        cond, act = rule.get("conditions", {}), rule.get("action", {})
        match = True
        if "days" in cond and dow not in cond["days"]: match = False
        if "time_range" in cond:
            tr = cond["time_range"]
            if input.start_time < tr.get("start","00:00") or input.start_time >= tr.get("end","23:59"): match = False
        if match:
            if act.get("type") == "multiplier": price = int(price * act.get("value", 1))
            elif act.get("type") == "discount": price = int(price * (1 - act.get("value", 0)))
    platform = await get_platform_settings()
    commission_pct = platform.get("booking_commission_pct", 0)
    commission_amount = int(price * commission_pct / 100)
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=PENDING_BOOKING_EXPIRY_HOURS)).isoformat()
    booking = {"id": str(uuid.uuid4()), "venue_id": input.venue_id, "venue_name": venue["name"], "host_id": user["id"], "host_name": user["name"],
               "date": input.date, "start_time": input.start_time, "end_time": input.end_time, "turf_number": input.turf_number, "sport": input.sport,
               "total_amount": price, "commission_amount": commission_amount, "payment_mode": input.payment_mode,
               "players": [user["id"]], "created_at": datetime.now(timezone.utc).isoformat(), "expires_at": expires_at}
    rzp_client = await get_razorpay_client()
    if input.payment_mode == "split" and input.split_count:
        split_token = str(uuid.uuid4())[:8]
        per_share = price // input.split_count
        booking["split_config"] = {"total_shares": input.split_count, "per_share": per_share, "shares_paid": 0, "split_token": split_token}
        booking["status"] = "pending"
        booking["payment_gateway"] = "mock"
        if rzp_client:
            try:
                order = rzp_client.order.create({"amount": per_share*100, "currency": "INR", "payment_capture": 1})
                booking["razorpay_order_id"] = order["id"]; booking["payment_gateway"] = "razorpay"
            except: pass
    elif rzp_client:
        booking["status"] = "payment_pending"; booking["payment_gateway"] = "mock"
        try:
            order = rzp_client.order.create({"amount": price*100, "currency": "INR", "payment_capture": 1})
            booking["razorpay_order_id"] = order["id"]; booking["payment_gateway"] = "razorpay"
        except: pass
    else:
        booking["status"] = "payment_pending"; booking["payment_gateway"] = "mock"
    await db.bookings.insert_one(booking); booking.pop("_id", None)
    await db.venues.update_one({"id": input.venue_id}, {"$inc": {"total_bookings": 1}})
    await db.users.update_one({"id": user["id"]}, {"$inc": {"total_games": 1}})
    if redis_client:
        key = lock_key(input.venue_id, input.date, input.start_time, input.turf_number)
        await redis_client.delete(key)
    gw = (await get_platform_settings()).get("payment_gateway", {})
    booking["razorpay_key_id"] = gw.get("key_id", "")
    return booking

@app.post("/bookings/{booking_id}/verify-payment")
async def verify_payment(booking_id: str, request: Request, user=Depends(get_current_user)):
    data = await request.json()
    razorpay_payment_id = data.get("razorpay_payment_id", "")
    razorpay_order_id = data.get("razorpay_order_id", "")
    razorpay_signature = data.get("razorpay_signature", "")

    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking: raise HTTPException(404, "Booking not found")
    if booking.get("host_id") != user["id"] and user["id"] not in booking.get("players", []):
        raise HTTPException(403, "Not authorized to verify payment for this booking")

    # HMAC signature verification for Razorpay
    settings = await get_platform_settings()
    gw = settings.get("payment_gateway", {})
    key_secret = gw.get("key_secret", "")
    if key_secret:
        msg = f"{razorpay_order_id}|{razorpay_payment_id}"
        expected = hmac.new(key_secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, razorpay_signature):
            raise HTTPException(400, "Payment verification failed")
    elif booking.get("payment_gateway") == "razorpay":
        raise HTTPException(500, "Payment gateway not configured properly")

    if booking.get("split_config"):
        sp = {"id": str(uuid.uuid4()), "booking_id": booking_id, "split_token": booking["split_config"]["split_token"],
              "payer_id": user["id"], "payer_name": user["name"], "amount": booking["split_config"]["per_share"],
              "razorpay_payment_id": razorpay_payment_id, "status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()}
        await db.split_payments.insert_one(sp)
        # Atomic increment to avoid race condition
        result = await db.bookings.find_one_and_update(
            {"id": booking_id},
            {"$inc": {"split_config.shares_paid": 1},
             "$set": {"payment_details.last_payment_id": razorpay_payment_id},
             "$addToSet": {"players": user["id"]}},
            return_document=True, projection={"_id": 0, "split_config": 1}
        )
        new_paid = result["split_config"]["shares_paid"]
        new_status = "confirmed" if new_paid >= result["split_config"]["total_shares"] else "pending"
        if new_status == "confirmed":
            await db.bookings.update_one({"id": booking_id}, {"$set": {"status": "confirmed"}})
        return {"message": "Share paid", "shares_paid": new_paid, "status": new_status}
    else:
        await db.bookings.update_one({"id": booking_id}, {"$set": {
            "status": "confirmed",
            "payment_details": {
                "razorpay_payment_id": razorpay_payment_id,
                "razorpay_order_id": razorpay_order_id,
                "razorpay_signature": razorpay_signature,
                "paid_at": datetime.now(timezone.utc).isoformat()
            }
        }})
        return {"message": "Payment verified, booking confirmed", "status": "confirmed"}

@app.post("/bookings/{booking_id}/mock-confirm")
async def mock_confirm(booking_id: str, user=Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking: raise HTTPException(404, "Booking not found")
    if booking.get("payment_gateway") != "mock": raise HTTPException(400, "Only for mock payments")
    if booking["status"] not in ("payment_pending", "pending"): raise HTTPException(400, f"Already {booking['status']}")
    if booking["host_id"] != user["id"]: raise HTTPException(403, "Only host can confirm")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": "confirmed", "payment_details": {"method": "mock", "mock_payment_id": f"mock_{uuid.uuid4().hex[:12]}", "paid_at": datetime.now(timezone.utc).isoformat()}}})
    return {"message": "Mock payment confirmed", "status": "confirmed"}

@app.post("/bookings/cleanup-expired")
async def cleanup_expired():
    now = datetime.now(timezone.utc).isoformat()
    result = await db.bookings.update_many({"status": {"$in": ["pending","payment_pending"]}, "expires_at": {"$lt": now}}, {"$set": {"status": "expired"}})
    return {"expired_count": result.modified_count}

@app.get("/payment/gateway-info")
async def get_gateway_info():
    settings = await get_platform_settings()
    gw = settings.get("payment_gateway", {})
    return {"has_gateway": bool(gw.get("key_id") and gw.get("key_secret")), "key_id": gw.get("key_id",""), "provider": gw.get("provider","razorpay")}

@app.get("/bookings")
async def list_bookings(user=Depends(get_current_user)):
    if user["role"] == "venue_owner":
        venues = await db.venues.find({"owner_id": user["id"]}, {"id": 1, "_id": 0}).to_list(100)
        return await db.bookings.find({"venue_id": {"$in": [v["id"] for v in venues]}}, {"_id": 0}).sort("date", -1).to_list(200)
    return await db.bookings.find({"$or": [{"host_id": user["id"]}, {"players": user["id"]}]}, {"_id": 0}).sort("date", -1).to_list(200)

@app.get("/bookings/{booking_id}")
async def get_booking(booking_id: str):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking: raise HTTPException(404, "Booking not found")
    return booking

@app.post("/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: str, user=Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": booking_id})
    if not booking: raise HTTPException(404, "Booking not found")
    if booking["host_id"] != user["id"]: raise HTTPException(403, "Only host can cancel")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": "cancelled"}})
    if booking.get("split_config"):
        await db.split_payments.update_many({"booking_id": booking_id}, {"$set": {"status": "refunded"}})
    redis_client = get_redis()
    if redis_client:
        key = lock_key(booking["venue_id"], booking["date"], booking["start_time"], booking.get("turf_number", 1))
        await redis_client.delete(key)
    try:
        promoted = await promote_next_in_waitlist(booking["venue_id"], booking["date"], booking["start_time"], booking.get("turf_number", 1))
        if promoted: logger.info(f"Waitlist: Auto-promoted {promoted['user_name']} after cancellation")
    except Exception as e: logger.warning(f"Waitlist promotion failed: {e}")
    return {"message": "Booking cancelled"}

# ─── Split Payment Routes ───────────────────────────────────────────────────
@app.get("/split/{token}")
async def get_split_info(token: str):
    booking = await db.bookings.find_one({"split_config.split_token": token}, {"_id": 0})
    if not booking: raise HTTPException(404, "Split payment not found")
    payments = await db.split_payments.find({"split_token": token}, {"_id": 0}).to_list(100)
    sc = booking.get("split_config", {})
    return {"booking": booking, "payments": payments, "remaining": sc.get("total_shares",0) - sc.get("shares_paid",0), "per_share": sc.get("per_share",0)}

@app.post("/split/{token}/pay")
async def pay_split(token: str, request: Request):
    body = await request.json()
    payer_name = body.get("payer_name", "Anonymous")
    booking = await db.bookings.find_one({"split_config.split_token": token})
    if not booking: raise HTTPException(404, "Split payment not found")
    sc = booking.get("split_config", {})
    if sc.get("shares_paid",0) >= sc.get("total_shares",0): raise HTTPException(400, "All shares paid")
    payment = {"id": str(uuid.uuid4()), "booking_id": booking["id"], "split_token": token, "payer_id": "", "payer_name": payer_name,
               "amount": sc["per_share"], "status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()}
    await db.split_payments.insert_one(payment); payment.pop("_id", None)
    new_paid = sc["shares_paid"] + 1
    updates = {"split_config.shares_paid": new_paid}
    if new_paid >= sc["total_shares"]: updates["status"] = "confirmed"
    await db.bookings.update_one({"id": booking["id"]}, {"$set": updates})
    return {"payment_gateway": "mock", "message": "Payment successful", "payment": payment}

@app.post("/split/{token}/verify-payment")
async def verify_split_payment(token: str, request: Request):
    data = await request.json()
    razorpay_payment_id = data.get("razorpay_payment_id", "")
    razorpay_order_id = data.get("razorpay_order_id", "")
    razorpay_signature = data.get("razorpay_signature", "")

    booking = await db.bookings.find_one({"split_config.split_token": token})
    if not booking: raise HTTPException(404, "Booking not found")

    # HMAC signature verification for Razorpay
    settings = await get_platform_settings()
    gw = settings.get("payment_gateway", {})
    key_secret = gw.get("key_secret", "")
    if key_secret:
        msg = f"{razorpay_order_id}|{razorpay_payment_id}"
        expected = hmac.new(key_secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, razorpay_signature):
            raise HTTPException(400, "Payment verification failed")

    payment = {"id": str(uuid.uuid4()), "booking_id": booking["id"], "split_token": token, "payer_id": data.get("payer_id",""),
               "payer_name": data.get("payer_name","Anonymous"), "amount": booking["split_config"]["per_share"],
               "razorpay_payment_id": razorpay_payment_id, "status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()}
    await db.split_payments.insert_one(payment); payment.pop("_id", None)
    # Atomic increment to avoid race condition
    result = await db.bookings.find_one_and_update(
        {"id": booking["id"]},
        {"$inc": {"split_config.shares_paid": 1},
         "$set": {"payment_details.last_payment_id": razorpay_payment_id}},
        return_document=True, projection={"_id": 0, "split_config": 1}
    )
    new_paid = result["split_config"]["shares_paid"]
    new_status = "confirmed" if new_paid >= result["split_config"]["total_shares"] else "pending"
    if new_status == "confirmed":
        await db.bookings.update_one({"id": booking["id"]}, {"$set": {"status": "confirmed"}})
    return {"message": "Share paid", "shares_paid": new_paid, "status": new_status}

# ─── Matchmaking Routes ─────────────────────────────────────────────────────
@app.get("/matchmaking")
async def list_matches(sport: Optional[str]=None, status: Optional[str]=None):
    query = {"status": status} if status else {"status": {"$in": ["open","filled"]}}
    if sport: query["sport"] = sport
    return await db.match_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)

@app.post("/matchmaking")
async def create_match(input: MatchRequestCreate, user=Depends(get_current_user)):
    match = {"id": str(uuid.uuid4()), "creator_id": user["id"], "creator_name": user["name"], **input.model_dump(),
             "players_joined": [user["id"]], "player_names": [user["name"]], "player_ratings": {user["id"]: user.get("skill_rating", 1500)},
             "status": "open", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.match_requests.insert_one(match); match.pop("_id", None)
    return match

@app.post("/matchmaking/{match_id}/join")
async def join_match(match_id: str, user=Depends(get_current_user)):
    match = await db.match_requests.find_one({"id": match_id})
    if not match: raise HTTPException(404, "Match not found")
    if user["id"] in match.get("players_joined",[]): raise HTTPException(400, "Already joined")
    joined = match.get("players_joined",[]); joined.append(user["id"])
    names = match.get("player_names",[]); names.append(user["name"])
    ratings = match.get("player_ratings",{}); ratings[user["id"]] = user.get("skill_rating", 1500)
    updates = {"players_joined": joined, "player_names": names, "player_ratings": ratings}
    if len(joined) >= match.get("players_needed", 10): updates["status"] = "filled"
    await db.match_requests.update_one({"id": match_id}, {"$set": updates})
    return {"message": "Joined match"}

@app.get("/matchmaking/recommended")
async def recommended_matches(user=Depends(get_current_user)):
    matches = await db.match_requests.find({"status": "open", "creator_id": {"$ne": user["id"]}}, {"_id": 0}).to_list(100)
    scored = []
    for m in matches:
        if user["id"] in m.get("players_joined",[]): continue
        compat = calculate_compatibility(user.get("skill_rating",1500), user.get("skill_deviation",350), m.get("min_skill",0), m.get("max_skill",3000))
        m["compatibility_score"] = min(100, compat + (10 if m.get("sport") in user.get("sports",[]) else 0))
        m["spots_left"] = m.get("players_needed",10) - len(m.get("players_joined",[]))
        scored.append(m)
    scored.sort(key=lambda x: x["compatibility_score"], reverse=True)
    return scored

@app.post("/matchmaking/auto-match")
async def auto_match(request: Request, user=Depends(get_current_user)):
    body = await request.json()
    query = {"status": "open", "creator_id": {"$ne": user["id"]}}
    if body.get("sport"): query["sport"] = body["sport"]
    matches = await db.match_requests.find(query, {"_id": 0}).to_list(100)
    best, best_score = None, -1
    for m in matches:
        if user["id"] in m.get("players_joined",[]): continue
        spots = m.get("players_needed",10) - len(m.get("players_joined",[]))
        if spots <= 0: continue
        compat = calculate_compatibility(user.get("skill_rating",1500), user.get("skill_deviation",350), m.get("min_skill",0), m.get("max_skill",3000))
        if compat > best_score: best_score = compat; best = m
    if best: best["compatibility_score"] = best_score; return {"found": True, "match": best}
    return {"found": False, "message": "No compatible matches found."}

@app.get("/matchmaking/{match_id}/suggest-teams")
async def suggest_teams(match_id: str, user=Depends(get_current_user)):
    match = await db.match_requests.find_one({"id": match_id}, {"_id": 0})
    if not match: raise HTTPException(404, "Match not found")
    pids = match.get("players_joined",[])
    if len(pids) < 2: raise HTTPException(400, "Need at least 2 players")
    players = []
    for pid in pids:
        u = await db.users.find_one({"id": pid}, {"_id": 0, "password_hash": 0})
        if u: players.append({"id": u["id"], "name": u["name"], "skill_rating": u.get("skill_rating",1500)})
    ta, tb, diff = suggest_balanced_teams(players)
    return {"team_a": ta, "team_b": tb, "rating_diff": diff, "balance_quality": max(0, 100 - diff)}

@app.post("/matchmaking/{match_id}/submit-result")
async def submit_result(match_id: str, input: MatchResultSubmit, user=Depends(get_current_user)):
    match = await db.match_requests.find_one({"id": match_id})
    if not match: raise HTTPException(404, "Match not found")
    if user["id"] not in match.get("players_joined",[]): raise HTTPException(403, "Not in match")
    if match.get("result",{}).get("confirmed"): raise HTTPException(400, "Result already confirmed")
    if input.winner not in ("team_a","team_b","draw"): raise HTTPException(400, "Invalid winner")
    result = {"submitted_by": user["id"], "team_a": input.team_a, "team_b": input.team_b, "winner": input.winner,
              "score_a": input.score_a, "score_b": input.score_b, "confirmations": [{"user_id": user["id"], "confirmed": True}],
              "confirmed": False, "submitted_at": datetime.now(timezone.utc).isoformat()}
    all_players = set(input.team_a + input.team_b); needed = max(2, len(all_players)//2+1) if len(all_players) > 2 else len(all_players)
    if len(result["confirmations"]) >= needed:
        result["confirmed"] = True; result["confirmed_at"] = datetime.now(timezone.utc).isoformat()
    await db.match_requests.update_one({"id": match_id}, {"$set": {"result": result, "status": "completed" if result["confirmed"] else "pending_result"}})
    if result["confirmed"]: await _apply_rating_updates(match_id, result)
    return {"message": "Result submitted" + (" and confirmed!" if result["confirmed"] else ""), "confirmed": result["confirmed"]}

@app.post("/matchmaking/{match_id}/confirm-result")
async def confirm_result(match_id: str, request: Request, user=Depends(get_current_user)):
    body = await request.json()
    confirmed = body.get("confirmed", True)
    match = await db.match_requests.find_one({"id": match_id})
    if not match: raise HTTPException(404, "Match not found")
    if user["id"] not in match.get("players_joined",[]): raise HTTPException(403, "Not in match")
    result = match.get("result")
    if not result: raise HTTPException(400, "No result submitted")
    if result.get("confirmed"): raise HTTPException(400, "Already confirmed")
    if any(c["user_id"] == user["id"] for c in result.get("confirmations",[])): raise HTTPException(400, "Already responded")
    result["confirmations"].append({"user_id": user["id"], "confirmed": confirmed})
    all_p = set(result.get("team_a",[]) + result.get("team_b",[])); needed = max(2, len(all_p)//2+1) if len(all_p) > 2 else len(all_p)
    cc = sum(1 for c in result["confirmations"] if c["confirmed"]); dc = sum(1 for c in result["confirmations"] if not c["confirmed"])
    if cc >= needed:
        result["confirmed"] = True; result["confirmed_at"] = datetime.now(timezone.utc).isoformat()
        await db.match_requests.update_one({"id": match_id}, {"$set": {"result": result, "status": "completed"}})
        await _apply_rating_updates(match_id, result)
        return {"message": "Result confirmed! Ratings updated.", "confirmed": True}
    elif dc >= needed:
        await db.match_requests.update_one({"id": match_id}, {"$unset": {"result": ""}, "$set": {"status": "filled"}})
        return {"message": "Result disputed. Re-submit.", "confirmed": False, "disputed": True}
    await db.match_requests.update_one({"id": match_id}, {"$set": {"result": result}})
    return {"message": f"{cc}/{needed} confirmations", "confirmed": False}

async def _apply_rating_updates(match_id, result):
    ta_ids, tb_ids = result.get("team_a",[]), result.get("team_b",[])
    winner = result.get("winner","draw"); confirmations = result.get("confirmations",[])
    players = {}
    for pid in ta_ids + tb_ids:
        u = await db.users.find_one({"id": pid}, {"_id": 0})
        if u: players[pid] = u
    if not players: return
    match = await db.match_requests.find_one({"id": match_id}, {"_id": 0})
    ms, md = (match.get("sport","unknown"), match.get("date","")) if match else ("unknown","")
    ta_r = [(players[p]["skill_rating"], players[p].get("skill_deviation",350)) for p in ta_ids if p in players]
    tb_r = [(players[p]["skill_rating"], players[p].get("skill_deviation",350)) for p in tb_ids if p in players]
    if not ta_r or not tb_r: return
    avg_a, avg_rd_a = sum(r for r,_ in ta_r)/len(ta_r), sum(d for _,d in ta_r)/len(ta_r)
    avg_b, avg_rd_b = sum(r for r,_ in tb_r)/len(tb_r), sum(d for _,d in tb_r)/len(tb_r)
    sa = 1.0 if winner=="team_a" else 0.0 if winner=="team_b" else 0.5
    sb = 1.0 - sa; now = datetime.now(timezone.utc).isoformat()
    for pid in ta_ids:
        if pid not in players: continue
        p = players[pid]; pr, prd, pv = p.get("skill_rating",1500), p.get("skill_deviation",350), p.get("volatility",0.06)
        nr, nrd, nv = update_rating(pr, prd, pv, [(avg_b, avg_rd_b, sa)])
        rl = "win" if winner=="team_a" else "loss" if winner=="team_b" else "draw"
        uf = {"skill_rating": nr, "skill_deviation": nrd, "volatility": nv}
        uf["wins" if rl=="win" else "losses" if rl=="loss" else "draws"] = p.get("wins" if rl=="win" else "losses" if rl=="loss" else "draws", 0) + 1
        await db.users.update_one({"id": pid}, {"$set": uf})
        opp = [{"id": o, "name": players[o]["name"], "rating_at_time": players[o].get("skill_rating",1500)} for o in tb_ids if o in players]
        await create_rating_record(pid, match_id, pr, nr, prd, nrd, pv, nv, rl, "a", opp, confirmations, ms, md, now)
    for pid in tb_ids:
        if pid not in players: continue
        p = players[pid]; pr, prd, pv = p.get("skill_rating",1500), p.get("skill_deviation",350), p.get("volatility",0.06)
        nr, nrd, nv = update_rating(pr, prd, pv, [(avg_a, avg_rd_a, sb)])
        rl = "win" if winner=="team_b" else "loss" if winner=="team_a" else "draw"
        uf = {"skill_rating": nr, "skill_deviation": nrd, "volatility": nv}
        uf["wins" if rl=="win" else "losses" if rl=="loss" else "draws"] = p.get("wins" if rl=="win" else "losses" if rl=="loss" else "draws", 0) + 1
        await db.users.update_one({"id": pid}, {"$set": uf})
        opp = [{"id": o, "name": players[o]["name"], "rating_at_time": players[o].get("skill_rating",1500)} for o in ta_ids if o in players]
        await create_rating_record(pid, match_id, pr, nr, prd, nrd, pv, nv, rl, "b", opp, confirmations, ms, md, now)

# ─── Leaderboard ─────────────────────────────────────────────────────────────
@app.get("/leaderboard")
async def get_leaderboard(sport: Optional[str]=None, limit: int=50):
    query = {"role": {"$in": ["player","coach"]}, "account_status": "active"}
    if sport: query["sports"] = sport
    players = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("skill_rating", -1).to_list(limit)
    return [{"rank": i+1, "id": p["id"], "name": p["name"], "skill_rating": p.get("skill_rating",1500),
             "total_games": p.get("total_games",0), "wins": p.get("wins",0), "losses": p.get("losses",0),
             "draws": p.get("draws",0), "sports": p.get("sports",[])} for i, p in enumerate(players)]

# ─── Mercenary Routes ────────────────────────────────────────────────────────
@app.get("/mercenary")
async def list_mercenary(sport: Optional[str]=None):
    query = {"status": "open"}
    if sport: query["sport"] = sport
    return await db.mercenary_posts.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)

@app.get("/mercenary/my-posts")
async def my_mercenary(user=Depends(get_current_user)):
    return await db.mercenary_posts.find({"host_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)

@app.post("/mercenary")
async def create_mercenary(input: MercenaryCreate, user=Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": input.booking_id, "host_id": user["id"]}, {"_id": 0})
    if not booking: raise HTTPException(404, "Booking not found or not owned")
    venue = await db.venues.find_one({"id": booking["venue_id"]}, {"_id": 0, "name": 1})
    post = {"id": str(uuid.uuid4()), "host_id": user["id"], "host_name": user["name"], "booking_id": input.booking_id,
            "venue_id": booking["venue_id"], "venue_name": venue["name"] if venue else "", "sport": booking.get("sport","football"),
            "date": booking["date"], "time": booking["start_time"], "position_needed": input.position_needed,
            "description": input.description, "amount_per_player": input.amount_per_player, "spots_available": input.spots_available,
            "spots_filled": 0, "applicants": [], "accepted": [], "paid_players": [], "status": "open",
            "created_at": datetime.now(timezone.utc).isoformat()}
    await db.mercenary_posts.insert_one(post); post.pop("_id", None)
    return post

@app.post("/mercenary/{post_id}/apply")
async def apply_mercenary(post_id: str, user=Depends(get_current_user)):
    post = await db.mercenary_posts.find_one({"id": post_id})
    if not post: raise HTTPException(404, "Post not found")
    if post["host_id"] == user["id"]: raise HTTPException(400, "Cannot apply to own post")
    if user["id"] in [a.get("id") for a in post.get("applicants",[])]: raise HTTPException(400, "Already applied")
    await db.mercenary_posts.update_one({"id": post_id}, {"$push": {"applicants": {"id": user["id"], "name": user["name"], "skill_rating": user.get("skill_rating",1500), "applied_at": datetime.now(timezone.utc).isoformat()}}})
    return {"message": "Applied"}

@app.post("/mercenary/{post_id}/accept/{applicant_id}")
async def accept_mercenary(post_id: str, applicant_id: str, user=Depends(get_current_user)):
    post = await db.mercenary_posts.find_one({"id": post_id})
    if not post: raise HTTPException(404, "Post not found")
    if post["host_id"] != user["id"]: raise HTTPException(403, "Only host can accept")
    applicant = next((a for a in post.get("applicants",[]) if a["id"] == applicant_id), None)
    if not applicant: raise HTTPException(404, "Applicant not found")
    await db.mercenary_posts.update_one({"id": post_id}, {"$pull": {"applicants": {"id": applicant_id}}, "$push": {"accepted": applicant}})
    return {"message": "Accepted"}

@app.post("/mercenary/{post_id}/reject/{applicant_id}")
async def reject_mercenary(post_id: str, applicant_id: str, user=Depends(get_current_user)):
    post = await db.mercenary_posts.find_one({"id": post_id})
    if not post or post["host_id"] != user["id"]: raise HTTPException(403, "Not authorized")
    await db.mercenary_posts.update_one({"id": post_id}, {"$pull": {"applicants": {"id": applicant_id}}})
    return {"message": "Rejected"}

@app.post("/mercenary/{post_id}/pay")
async def pay_mercenary(post_id: str, user=Depends(get_current_user)):
    post = await db.mercenary_posts.find_one({"id": post_id})
    if not post: raise HTTPException(404)
    if user["id"] not in [a["id"] for a in post.get("accepted",[])]: raise HTTPException(403, "Must be accepted first")
    if user["id"] in [p["id"] for p in post.get("paid_players",[])]: raise HTTPException(400, "Already paid")
    paid = {"id": user["id"], "name": user["name"], "paid_at": datetime.now(timezone.utc).isoformat()}
    nf = post.get("spots_filled",0) + 1
    updates = {"$push": {"paid_players": paid}, "$set": {"spots_filled": nf}}
    if nf >= post.get("spots_available",1): updates["$set"]["status"] = "filled"
    await db.mercenary_posts.update_one({"id": post_id}, updates)
    if post.get("booking_id"): await db.bookings.update_one({"id": post["booking_id"]}, {"$addToSet": {"players": user["id"]}})
    return {"payment_gateway": "mock", "message": "Payment successful", "amount": post["amount_per_player"]}

# ─── Rating Routes ───────────────────────────────────────────────────────────
@app.get("/rating/history/{user_id}")
async def get_rating_history(user_id: str, limit: int=50, user=Depends(get_current_user)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not target: raise HTTPException(404, "User not found")
    records = await db.rating_history.find({"user_id": user_id}, {"_id": 0}).sort("seq", -1).to_list(limit)
    return {"user": {"id": target["id"], "name": target["name"], "skill_rating": target.get("skill_rating",1500)}, "total_records": await db.rating_history.count_documents({"user_id": user_id}), "records": records}

@app.get("/rating/verify/{user_id}")
async def verify_chain(user_id: str, user=Depends(get_current_user)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not target: raise HTTPException(404, "User not found")
    records = await db.rating_history.find({"user_id": user_id}, {"_id": 0}).sort("seq", 1).to_list(10000)
    if not records: return {"verified": True, "total_records": 0, "chain_intact": True, "current_rating": target.get("skill_rating",1500)}
    chain_valid, prev_hash = True, GENESIS_HASH
    for i, rec in enumerate(records):
        if compute_record_hash(rec, prev_hash) != rec.get("record_hash") or rec.get("prev_hash") != prev_hash or rec.get("seq") != i+1:
            chain_valid = False; break
        prev_hash = rec["record_hash"]
    rating_matches = records[-1]["new_rating"] == target.get("skill_rating",1500)
    return {"verified": chain_valid and rating_matches, "chain_intact": chain_valid, "rating_consistent": rating_matches, "total_records": len(records), "current_rating": target.get("skill_rating",1500)}

@app.get("/rating/certificate/{user_id}")
async def get_certificate(user_id: str, user=Depends(get_current_user)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not target: raise HTTPException(404, "User not found")
    records = await db.rating_history.find({"user_id": user_id}, {"_id": 0}).sort("seq", 1).to_list(10000)
    chain_valid, prev_hash = True, GENESIS_HASH
    for rec in records:
        if compute_record_hash(rec, prev_hash) != rec.get("record_hash"): chain_valid = False; break
        prev_hash = rec["record_hash"]
    fp = hashlib.sha256(f"{user_id}|{len(records)}|{prev_hash}".encode()).hexdigest()[:32]
    tier = "Diamond" if target.get("skill_rating",1500)>=2500 else "Gold" if target.get("skill_rating",1500)>=2000 else "Silver" if target.get("skill_rating",1500)>=1500 else "Bronze"
    timeline = [{"seq": r["seq"], "rating": r["new_rating"], "date": r["match_date"], "delta": r["delta"], "result": r["result"]} for r in records]
    return {"player": {"id": target["id"], "name": target["name"], "skill_rating": target.get("skill_rating",1500), "tier": tier},
            "verification": {"chain_intact": chain_valid, "verified": chain_valid, "total_matches": len(records), "chain_fingerprint": fp},
            "journey": {"peak_rating": max((r["new_rating"] for r in records), default=1500), "total_wins": sum(1 for r in records if r["result"]=="win")},
            "timeline": timeline}

@app.get("/health")
async def health():
    return {"status": "ok", "service": "booking-service"}
