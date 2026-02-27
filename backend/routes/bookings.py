from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone, timedelta
from database import db, get_redis, lock_key
from auth import get_current_user, get_razorpay_client, get_platform_settings
from tz import now_ist
from models import BookingCreate
import uuid
import hmac
import hashlib
import logging
import asyncio
import re
from invoice_utils import generate_venue_invoice
try:
    from push_service import notify_booking_confirmed, notify_booking_cancelled
except Exception:
    async def notify_booking_confirmed(*a, **k): pass
    async def notify_booking_cancelled(*a, **k): pass

router = APIRouter()
logger = logging.getLogger("horizon")

PENDING_BOOKING_EXPIRY_HOURS = 24  # Auto-cancel pending bookings after 24h


@router.post("/bookings")
async def create_booking(input: BookingCreate, user=Depends(get_current_user)):
    venue = await db.venues.find_one({"id": input.venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(404, "Venue not found")
    if venue.get("status") != "active":
        raise HTTPException(400, "This venue is not currently active")

    # --- Compute slot range for multi-slot bookings ---
    slot_duration = venue.get("slot_duration_minutes", 60)
    start_parts = input.start_time.split(":")
    end_parts = input.end_time.split(":")
    booking_start_min = int(start_parts[0]) * 60 + int(start_parts[1])
    booking_end_min = int(end_parts[0]) * 60 + int(end_parts[1])
    num_slots = max((booking_end_min - booking_start_min) // slot_duration, 1)

    # --- Multi-slot lock check ---
    redis_client = get_redis()
    if redis_client:
        for i in range(num_slots):
            slot_min = booking_start_min + (i * slot_duration)
            sh, sm = divmod(slot_min, 60)
            slot_start = f"{sh:02d}:{sm:02d}"
            key = lock_key(input.venue_id, input.date, slot_start, input.turf_number)
            lock_owner = await redis_client.get(key)
            if lock_owner:
                owner_str = lock_owner.decode() if isinstance(lock_owner, bytes) else lock_owner
                if owner_str != user["id"]:
                    raise HTTPException(409, f"Slot at {slot_start} is locked by another user.")

    # --- Time-range overlap check (supports multi-slot bookings) ---
    existing = await db.bookings.find_one({
        "venue_id": input.venue_id, "date": input.date,
        "turf_number": input.turf_number,
        "status": {"$in": ["confirmed", "pending", "payment_pending"]},
        "start_time": {"$lt": input.end_time},
        "end_time": {"$gt": input.start_time},
    })
    if existing:
        raise HTTPException(409, "Slot already booked")

    # --- Multi-slot pricing: sum price for each constituent slot ---
    base_price = venue.get("base_price", 2000)
    if not isinstance(base_price, (int, float)) or base_price <= 0:
        logger.warning(f"Invalid base_price {base_price} for venue {input.venue_id}, using default 2000")
        base_price = 2000

    # Build turf price map from turf_config
    turf_price = base_price
    turf_name = f"Turf #{input.turf_number}"
    turf_config = venue.get("turf_config")
    if turf_config:
        idx = 1
        for tc in turf_config:
            for t in tc.get("turfs", []):
                if idx == input.turf_number:
                    turf_price = t.get("price", base_price)
                    turf_name = t.get("name", turf_name)
                idx += 1

    rules = await db.pricing_rules.find(
        {"venue_id": input.venue_id, "is_active": True}, {"_id": 0}
    ).sort("priority", -1).to_list(100)
    try:
        dow = datetime.strptime(input.date, "%Y-%m-%d").weekday()
    except Exception:
        dow = 0

    total_price = 0
    for i in range(num_slots):
        slot_min = booking_start_min + (i * slot_duration)
        sh, sm = divmod(slot_min, 60)
        slot_start = f"{sh:02d}:{sm:02d}"
        slot_price = turf_price
        for rule in rules:
            cond = rule.get("conditions", {})
            act = rule.get("action", {})
            match = True
            if "days" in cond and dow not in cond["days"]:
                match = False
            if "time_range" in cond:
                tr = cond["time_range"]
                if slot_start < tr.get("start", "00:00") or slot_start >= tr.get("end", "23:59"):
                    match = False
            if match:
                if act.get("type") == "multiplier":
                    slot_price = int(slot_price * act.get("value", 1))
                elif act.get("type") == "discount":
                    discount_value = min(max(act.get("value", 0), 0), 1.0)
                    slot_price = int(slot_price * (1 - discount_value))
        total_price += max(slot_price, 0)
    price = max(total_price, 0)

    platform = await get_platform_settings()
    commission_pct = platform.get("booking_commission_pct", 0)
    commission_amount = int(price * commission_pct / 100)

    expires_at = (now_ist() + timedelta(hours=PENDING_BOOKING_EXPIRY_HOURS)).isoformat()

    booking = {
        "id": str(uuid.uuid4()), "venue_id": input.venue_id,
        "venue_name": venue["name"], "host_id": user["id"],
        "host_name": user["name"], "date": input.date,
        "start_time": input.start_time, "end_time": input.end_time,
        "turf_number": input.turf_number, "turf_name": turf_name, "sport": input.sport,
        "total_amount": price, "commission_amount": commission_amount,
        "payment_mode": input.payment_mode,
        "players": [user["id"]],
        "num_players": input.num_players,
        "created_at": now_ist().isoformat(),
        "expires_at": expires_at
    }

    rzp_client = await get_razorpay_client()
    gw = (await get_platform_settings()).get("payment_gateway", {})

    # ── Payment already completed (Razorpay) → verify and create as confirmed ──
    if input.razorpay_payment_id and input.razorpay_order_id and input.razorpay_signature:
        key_secret = gw.get("key_secret", "")
        if not key_secret:
            raise HTTPException(500, "Payment gateway not configured properly")
        msg = f"{input.razorpay_order_id}|{input.razorpay_payment_id}"
        expected = hmac.new(key_secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
        if expected != input.razorpay_signature:
            raise HTTPException(400, "Payment verification failed — signature mismatch")
        checkin_token = str(uuid.uuid4())[:8].upper()
        booking["status"] = "confirmed"
        booking["payment_gateway"] = "razorpay"
        booking["razorpay_order_id"] = input.razorpay_order_id
        booking["checkin_token"] = checkin_token
        booking["qr_data"] = f"HORIZON_CHECKIN:{booking['id']}:{checkin_token}"
        booking["payment_details"] = {
            "razorpay_payment_id": input.razorpay_payment_id,
            "razorpay_order_id": input.razorpay_order_id,
            "razorpay_signature": input.razorpay_signature,
            "paid_at": now_ist().isoformat()
        }
        await db.bookings.insert_one(booking)
        booking.pop("_id", None)
    elif input.payment_mode == "split" and input.split_count:
        split_token = str(uuid.uuid4())[:8]
        per_share = price // input.split_count
        booking["split_config"] = {
            "total_shares": input.split_count,
            "per_share": per_share,
            "shares_paid": 0,
            "split_token": split_token
        }
        booking["status"] = "pending"
        if rzp_client:
            try:
                rzp_order = rzp_client.order.create({
                    "amount": per_share * 100, "currency": "INR", "payment_capture": 1,
                    "notes": {"booking_id": booking["id"], "type": "split_share", "payer_id": user["id"]}
                })
                booking["razorpay_order_id"] = rzp_order["id"]
                booking["payment_gateway"] = "razorpay"
            except Exception as e:
                logger.error(f"Razorpay order creation failed: {e}")
                raise HTTPException(502, "Payment gateway error. Please try again or contact support.")
        else:
            booking["payment_gateway"] = "test"
        await db.bookings.insert_one(booking)
        booking.pop("_id", None)
    else:
        # Test mode — no payment gateway
        booking["status"] = "payment_pending"
        booking["payment_gateway"] = "test"
        await db.bookings.insert_one(booking)
        booking.pop("_id", None)

    await db.venues.update_one({"id": input.venue_id}, {"$inc": {"total_bookings": 1}})
    await db.users.update_one({"id": user["id"]}, {"$inc": {"total_games": 1}})

    if redis_client:
        for i in range(num_slots):
            slot_min = booking_start_min + (i * slot_duration)
            sh, sm = divmod(slot_min, 60)
            slot_start = f"{sh:02d}:{sm:02d}"
            key = lock_key(input.venue_id, input.date, slot_start, input.turf_number)
            await redis_client.delete(key)
        logger.info(f"Locks released after booking: {input.start_time}-{input.end_time} turf {input.turf_number}")

    gw = (await get_platform_settings()).get("payment_gateway", {})
    booking["razorpay_key_id"] = gw.get("key_id", "")
    return booking


@router.post("/bookings/{booking_id}/verify-payment")
async def verify_payment(booking_id: str, request: Request, user=Depends(get_current_user)):
    data = await request.json()
    razorpay_payment_id = data.get("razorpay_payment_id", "")
    razorpay_order_id = data.get("razorpay_order_id", "")
    razorpay_signature = data.get("razorpay_signature", "")

    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking.get("host_id") != user["id"] and user["id"] not in booking.get("players", []):
        raise HTTPException(403, "Not authorized to verify payment for this booking")

    settings = await get_platform_settings()
    gw = settings.get("payment_gateway", {})
    key_secret = gw.get("key_secret", "")

    # CRITICAL FIX: Always verify signature for razorpay bookings, never skip
    if booking.get("payment_gateway") == "razorpay":
        if not key_secret:
            raise HTTPException(500, "Payment gateway not configured properly — contact support")
        msg = f"{razorpay_order_id}|{razorpay_payment_id}"
        expected = hmac.new(key_secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
        if expected != razorpay_signature:
            raise HTTPException(400, "Payment verification failed — signature mismatch")

    if booking.get("split_config"):
        sp = {
            "id": str(uuid.uuid4()), "booking_id": booking_id,
            "split_token": booking["split_config"]["split_token"],
            "payer_id": user["id"], "payer_name": user["name"],
            "amount": booking["split_config"]["per_share"],
            "razorpay_payment_id": razorpay_payment_id,
            "status": "paid", "paid_at": now_ist().isoformat()
        }
        await db.split_payments.insert_one(sp)
        # Atomic increment to avoid race condition
        result = await db.bookings.find_one_and_update(
            {"id": booking_id},
            {
                "$inc": {"split_config.shares_paid": 1},
                "$set": {"payment_details.last_payment_id": razorpay_payment_id},
                "$addToSet": {"players": user["id"]}
            },
            return_document=True, projection={"_id": 0, "split_config": 1}
        )
        new_shares_paid = result["split_config"]["shares_paid"]
        new_status = "confirmed" if new_shares_paid >= result["split_config"]["total_shares"] else "pending"
        if new_status == "confirmed":
            await db.bookings.update_one({"id": booking_id}, {"$set": {"status": "confirmed"}})
            confirmed_booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
            if confirmed_booking:
                asyncio.create_task(generate_venue_invoice(confirmed_booking, {"razorpay_payment_id": razorpay_payment_id, "paid_at": now_ist().isoformat()}))
        return {"message": "Share paid", "shares_paid": new_shares_paid, "status": new_status}
    else:
        await db.bookings.update_one({"id": booking_id}, {"$set": {
            "status": "confirmed",
            "payment_details": {
                "razorpay_payment_id": razorpay_payment_id,
                "razorpay_order_id": razorpay_order_id,
                "razorpay_signature": razorpay_signature,
                "paid_at": now_ist().isoformat()
            }
        }})
        confirmed_booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
        if confirmed_booking:
            asyncio.create_task(generate_venue_invoice(confirmed_booking, {"razorpay_payment_id": razorpay_payment_id, "razorpay_order_id": razorpay_order_id, "paid_at": now_ist().isoformat()}))
        return {"message": "Payment verified, booking confirmed", "status": "confirmed"}


@router.post("/bookings/{booking_id}/test-confirm")
async def test_confirm_payment(booking_id: str, user=Depends(get_current_user)):
    """Confirm payment for test-mode bookings (no payment gateway configured)."""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking.get("payment_gateway") not in ("test", "mock"):
        raise HTTPException(400, "This endpoint is only for test-mode bookings")
    if booking["status"] not in ("payment_pending", "pending"):
        raise HTTPException(400, f"Booking is already {booking['status']}")
    if booking["host_id"] != user["id"] and user["role"] != "super_admin":
        raise HTTPException(403, "Only the booking host can confirm payment")

    checkin_token = str(uuid.uuid4())[:8].upper()
    await db.bookings.update_one({"id": booking_id}, {"$set": {
        "status": "confirmed",
        "checkin_token": checkin_token,
        "qr_data": f"HORIZON_CHECKIN:{booking_id}:{checkin_token}",
        "payment_details": {
            "method": "test",
            "test_payment_id": f"test_{uuid.uuid4().hex[:12]}",
            "paid_at": now_ist().isoformat()
        }
    }})
    asyncio.create_task(notify_booking_confirmed(
        booking["host_id"],
        booking.get("venue_name", "Venue"),
        booking.get("date", ""),
        booking.get("start_time", ""),
    ))
    confirmed_booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if confirmed_booking:
        asyncio.create_task(generate_venue_invoice(confirmed_booking, confirmed_booking.get("payment_details", {})))
    return {"message": "Test payment confirmed", "status": "confirmed"}


@router.post("/bookings/cleanup-expired")
async def cleanup_expired_bookings(user=Depends(get_current_user)):
    """Auto-cancel bookings that have been pending beyond the expiry window."""
    now = now_ist().isoformat()
    # Find expired bookings first to decrement counters
    expired_bookings = await db.bookings.find(
        {"status": {"$in": ["pending", "payment_pending"]}, "expires_at": {"$lt": now}},
        {"_id": 0, "id": 1, "venue_id": 1, "host_id": 1}
    ).to_list(500)
    result = await db.bookings.update_many(
        {
            "status": {"$in": ["pending", "payment_pending"]},
            "expires_at": {"$lt": now}
        },
        {"$set": {"status": "expired"}}
    )
    count = result.modified_count
    # Decrement counters for expired bookings
    for eb in expired_bookings:
        await db.venues.update_one({"id": eb["venue_id"]}, {"$inc": {"total_bookings": -1}})
        await db.users.update_one({"id": eb["host_id"]}, {"$inc": {"total_games": -1}})
    if count > 0:
        logger.info(f"Cleaned up {count} expired bookings")
    return {"expired_count": count}



@router.get("/payment/gateway-info")
async def get_gateway_info():
    settings = await get_platform_settings()
    gw = settings.get("payment_gateway", {})
    key_id = gw.get("key_id", "")
    has_gateway = bool(key_id and gw.get("key_secret", ""))
    return {"has_gateway": has_gateway, "key_id": key_id, "provider": gw.get("provider", "razorpay")}


@router.post("/payments/create-order")
async def create_razorpay_order(request: Request, user=Depends(get_current_user)):
    """Create a Razorpay order WITHOUT creating a booking. Booking is created after payment."""
    data = await request.json()
    amount = data.get("amount", 0)
    notes = data.get("notes", {})

    if amount <= 0:
        raise HTTPException(400, "Invalid amount")

    rzp_client = await get_razorpay_client()
    gw = (await get_platform_settings()).get("payment_gateway", {})

    if not rzp_client:
        return {"payment_gateway": "test", "key_id": gw.get("key_id", "")}

    try:
        rzp_order = rzp_client.order.create({
            "amount": int(amount * 100), "currency": "INR",
            "payment_capture": 1, "notes": notes
        })
    except Exception as e:
        logger.error(f"Razorpay order creation failed: {e}")
        raise HTTPException(502, "Payment gateway error. Please try again.")

    return {
        "payment_gateway": "razorpay",
        "order_id": rzp_order["id"],
        "key_id": gw.get("key_id", "")
    }


@router.post("/payments/webhook")
async def razorpay_webhook(request: Request):
    """Razorpay server-to-server webhook — PRIMARY payment confirmation."""
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    # Get webhook secret from platform settings
    settings = await get_platform_settings()
    gw = settings.get("payment_gateway", {})
    webhook_secret = gw.get("webhook_secret", "")
    if not webhook_secret:
        logger.error("Razorpay webhook received but webhook_secret not configured")
        return {"status": "ok"}

    # Verify HMAC-SHA256 signature
    expected = hmac.new(webhook_secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        logger.warning("Razorpay webhook signature mismatch — rejecting")
        return {"status": "ok"}

    import json as _json
    try:
        payload = _json.loads(body)
    except Exception:
        logger.error("Razorpay webhook: invalid JSON body")
        return {"status": "ok"}

    event = payload.get("event", "")
    payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
    order_id = payment_entity.get("order_id", "")

    if event == "payment.captured" and order_id:
        # Find booking by razorpay_order_id
        booking = await db.bookings.find_one({"razorpay_order_id": order_id}, {"_id": 0})
        if not booking:
            logger.warning(f"Webhook: no booking found for order {order_id}")
            return {"status": "ok"}

        # Idempotent — skip if already confirmed
        if booking.get("status") == "confirmed":
            logger.info(f"Webhook: booking {booking['id']} already confirmed, skipping")
            return {"status": "ok"}

        razorpay_payment_id = payment_entity.get("id", "")

        if booking.get("split_config"):
            # Split payment — increment shares_paid
            result = await db.bookings.find_one_and_update(
                {"id": booking["id"], "status": {"$ne": "confirmed"}},
                {
                    "$inc": {"split_config.shares_paid": 1},
                    "$set": {"payment_details.last_payment_id": razorpay_payment_id}
                },
                return_document=True, projection={"_id": 0, "split_config": 1, "id": 1}
            )
            if result:
                new_paid = result["split_config"]["shares_paid"]
                if new_paid >= result["split_config"]["total_shares"]:
                    await db.bookings.update_one({"id": booking["id"]}, {"$set": {"status": "confirmed"}})
                    logger.info(f"Webhook: split booking {booking['id']} fully paid and confirmed")
                    asyncio.create_task(notify_booking_confirmed(
                        booking.get("host_id", ""), booking.get("venue_name", ""),
                        booking.get("date", ""), booking.get("start_time", "")
                    ))
                    full_booking = await db.bookings.find_one({"id": booking["id"]}, {"_id": 0})
                    if full_booking:
                        asyncio.create_task(generate_venue_invoice(full_booking, {"razorpay_payment_id": razorpay_payment_id, "paid_at": now_ist().isoformat()}))
                else:
                    logger.info(f"Webhook: split booking {booking['id']} share {new_paid}/{result['split_config']['total_shares']}")
        else:
            # Full payment — confirm directly
            await db.bookings.update_one({"id": booking["id"]}, {"$set": {
                "status": "confirmed",
                "payment_details": {
                    "razorpay_payment_id": razorpay_payment_id,
                    "razorpay_order_id": order_id,
                    "method": payment_entity.get("method", ""),
                    "paid_at": now_ist().isoformat()
                }
            }})
            logger.info(f"Webhook: booking {booking['id']} confirmed via payment {razorpay_payment_id}")
            asyncio.create_task(notify_booking_confirmed(
                booking.get("host_id", ""), booking.get("venue_name", ""),
                booking.get("date", ""), booking.get("start_time", "")
            ))
            asyncio.create_task(generate_venue_invoice(
                {**booking, "status": "confirmed"},
                {"razorpay_payment_id": razorpay_payment_id, "razorpay_order_id": order_id, "paid_at": now_ist().isoformat()}
            ))

    elif event == "payment.failed":
        logger.warning(f"Webhook: payment failed for order {order_id} — {payment_entity.get('error_description', '')}")

    return {"status": "ok"}


@router.get("/bookings")
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


@router.get("/bookings/{booking_id}")
async def get_booking(booking_id: str, user=Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Booking not found")
    # Ownership check: host, player in booking, venue owner, or admin
    is_host = booking.get("host_id") == user["id"]
    is_player = user["id"] in booking.get("players", [])
    is_admin = user.get("role") == "super_admin"
    is_venue_owner = False
    if user.get("role") == "venue_owner":
        venue = await db.venues.find_one({"id": booking.get("venue_id"), "owner_id": user["id"]}, {"_id": 0, "id": 1})
        is_venue_owner = venue is not None
    if not (is_host or is_player or is_admin or is_venue_owner):
        raise HTTPException(403, "You don't have access to this booking")
    return booking


@router.post("/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: str, user=Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking["host_id"] != user["id"]:
        raise HTTPException(403, "Only the host can cancel")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": "cancelled"}})
    # Decrement counters that were incremented at booking creation
    await db.venues.update_one({"id": booking["venue_id"]}, {"$inc": {"total_bookings": -1}})
    await db.users.update_one({"id": booking["host_id"]}, {"$inc": {"total_games": -1}})
    if booking.get("split_config"):
        await db.split_payments.update_many(
            {"booking_id": booking_id}, {"$set": {"status": "refunded"}}
        )
    redis_client = get_redis()
    if redis_client:
        # Release ALL constituent slot locks (multi-slot bookings span multiple base slots)
        venue = await db.venues.find_one({"id": booking["venue_id"]}, {"_id": 0, "slot_duration_minutes": 1})
        slot_dur = (venue or {}).get("slot_duration_minutes", 60)
        b_start = booking["start_time"].split(":")
        b_end = booking["end_time"].split(":")
        b_start_min = int(b_start[0]) * 60 + int(b_start[1])
        b_end_min = int(b_end[0]) * 60 + int(b_end[1])
        turf = booking.get("turf_number", 1)
        for slot_min in range(b_start_min, b_end_min, slot_dur):
            sh, sm = divmod(slot_min, 60)
            key = lock_key(booking["venue_id"], booking["date"], f"{sh:02d}:{sm:02d}", turf)
            await redis_client.delete(key)

    from routes.notifications import notify_slot_available
    await notify_slot_available(
        booking["venue_id"], booking["date"],
        booking["start_time"], booking.get("turf_number", 1)
    )

    # Auto-promote first person on waitlist
    try:
        from routes.waitlist import promote_next_in_waitlist
        promoted = await promote_next_in_waitlist(
            booking["venue_id"], booking["date"],
            booking["start_time"], booking.get("turf_number", 1)
        )
        if promoted:
            logger.info(f"Waitlist: Auto-promoted {promoted['user_name']} after cancellation")
    except Exception as e:
        logger.warning(f"Waitlist promotion failed: {e}")

    return {"message": "Booking cancelled"}


# --- Split Payment Routes ---
@router.get("/split/{token}")
async def get_split_info(token: str):
    booking = await db.bookings.find_one({"split_config.split_token": token}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Split payment not found")
    payments = await db.split_payments.find({"split_token": token}, {"_id": 0}).to_list(100)
    sc = booking.get("split_config", {})
    # CRITICAL FIX: Only expose necessary booking fields, not full payment/user details
    safe_booking = {
        "id": booking.get("id"),
        "venue_name": booking.get("venue_name"),
        "date": booking.get("date"),
        "start_time": booking.get("start_time"),
        "end_time": booking.get("end_time"),
        "sport": booking.get("sport"),
        "total_amount": booking.get("total_amount"),
        "status": booking.get("status"),
        "split_config": sc,
        "payment_gateway": booking.get("payment_gateway"),
        "razorpay_order_id": booking.get("razorpay_order_id", ""),
    }
    # Sanitize payment records — strip internal fields
    safe_payments = [
        {"id": p.get("id"), "payer_name": p.get("payer_name"), "amount": p.get("amount"),
         "status": p.get("status"), "paid_at": p.get("paid_at")}
        for p in payments
    ]
    return {
        "booking": safe_booking, "payments": safe_payments,
        "remaining": sc.get("total_shares", 0) - sc.get("shares_paid", 0),
        "per_share": sc.get("per_share", 0)
    }


@router.post("/split/{token}/pay")
async def pay_split(token: str, request: Request):
    body = await request.json()
    # Sanitize payer_name: strip, limit length, remove HTML/script tags
    raw_name = body.get("payer_name", "Anonymous") or "Anonymous"
    payer_name = re.sub(r"<[^>]+>", "", str(raw_name)).strip()[:50] or "Anonymous"
    booking = await db.bookings.find_one({"split_config.split_token": token})
    if not booking:
        raise HTTPException(404, "Split payment not found")
    sc = booking.get("split_config", {})
    if sc.get("shares_paid", 0) >= sc.get("total_shares", 0):
        raise HTTPException(400, "All shares already paid")

    rzp_client = await get_razorpay_client()
    result = {"payer_name": payer_name, "amount": sc["per_share"]}

    if rzp_client:
        try:
            rzp_order = rzp_client.order.create({
                "amount": sc["per_share"] * 100, "currency": "INR", "payment_capture": 1,
                "notes": {"booking_id": booking["id"], "type": "split_share", "payer_name": payer_name}
            })
            gw = (await get_platform_settings()).get("payment_gateway", {})
            result["razorpay_order_id"] = rzp_order["id"]
            result["razorpay_key_id"] = gw.get("key_id", "")
            result["payment_gateway"] = "razorpay"
            return result
        except Exception as e:
            logger.error(f"Razorpay order failed for split: {e}")
            raise HTTPException(502, "Payment gateway error. Please try again.")

    # Test mode — no payment gateway configured
    payment = {
        "id": str(uuid.uuid4()), "booking_id": booking["id"],
        "split_token": token, "payer_id": "",
        "payer_name": payer_name, "amount": sc["per_share"],
        "status": "paid", "paid_at": now_ist().isoformat()
    }
    await db.split_payments.insert_one(payment)
    payment.pop("_id", None)

    new_paid = sc["shares_paid"] + 1
    updates = {"split_config.shares_paid": new_paid}
    if new_paid >= sc["total_shares"]:
        updates["status"] = "confirmed"
    await db.bookings.update_one({"id": booking["id"]}, {"$set": updates})
    result["payment_gateway"] = "test"
    result["message"] = "Payment successful (test mode)"
    result["payment"] = payment
    return result


@router.post("/split/{token}/verify-payment")
async def verify_split_payment(token: str, request: Request):
    data = await request.json()
    booking = await db.bookings.find_one({"split_config.split_token": token})
    if not booking:
        raise HTTPException(404, "Booking not found")

    # CRITICAL FIX: Verify Razorpay signature for split payments too
    if booking.get("payment_gateway") == "razorpay":
        settings = await get_platform_settings()
        gw = settings.get("payment_gateway", {})
        key_secret = gw.get("key_secret", "")
        if not key_secret:
            raise HTTPException(500, "Payment gateway not configured properly")
        razorpay_payment_id = data.get("razorpay_payment_id", "")
        razorpay_order_id = data.get("razorpay_order_id", "")
        razorpay_signature = data.get("razorpay_signature", "")
        msg = f"{razorpay_order_id}|{razorpay_payment_id}"
        expected = hmac.new(key_secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
        if expected != razorpay_signature:
            raise HTTPException(400, "Payment verification failed — signature mismatch")

    # Sanitize payer_name
    raw_name = data.get("payer_name", "Anonymous") or "Anonymous"
    payer_name = re.sub(r"<[^>]+>", "", str(raw_name)).strip()[:50] or "Anonymous"

    payment = {
        "id": str(uuid.uuid4()), "booking_id": booking["id"],
        "split_token": token, "payer_id": data.get("payer_id", ""),
        "payer_name": payer_name,
        "amount": booking["split_config"]["per_share"],
        "razorpay_payment_id": data.get("razorpay_payment_id", ""),
        "status": "paid", "paid_at": now_ist().isoformat()
    }
    await db.split_payments.insert_one(payment)
    payment.pop("_id", None)

    # Use atomic increment to prevent race condition
    result = await db.bookings.find_one_and_update(
        {"id": booking["id"]},
        {"$inc": {"split_config.shares_paid": 1}},
        return_document=True, projection={"_id": 0, "split_config": 1}
    )
    new_paid = result["split_config"]["shares_paid"]
    if new_paid >= result["split_config"]["total_shares"]:
        await db.bookings.update_one({"id": booking["id"]}, {"$set": {"status": "confirmed"}})
    return {"message": "Share paid", "shares_paid": new_paid, "status": "confirmed" if new_paid >= result["split_config"]["total_shares"] else "pending"}
