from fastapi import APIRouter, Depends, Request, HTTPException
from database import db, redis_client
from auth import get_current_user, get_razorpay_client, get_platform_settings
from models import BookingCreate
from datetime import datetime, timezone
import uuid
import hmac
import hashlib
import logging

logger = logging.getLogger("horizon")
router = APIRouter(tags=["bookings"])


def lock_key(venue_id, date, start_time, turf_number):
    return f"lock:{venue_id}:{date}:{start_time}:{turf_number}"


@router.post("/bookings")
async def create_booking(input: BookingCreate, user=Depends(get_current_user)):
    venue = await db.venues.find_one({"id": input.venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(404, "Venue not found")

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
        "status": {"$in": ["confirmed", "pending", "payment_pending"]}
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

    platform = await get_platform_settings()
    commission_pct = platform.get("booking_commission_pct", 0)
    commission_amount = int(price * commission_pct / 100)

    booking = {
        "id": str(uuid.uuid4()), "venue_id": input.venue_id,
        "venue_name": venue["name"], "host_id": user["id"],
        "host_name": user["name"], "date": input.date,
        "start_time": input.start_time, "end_time": input.end_time,
        "turf_number": input.turf_number, "sport": input.sport,
        "total_amount": price, "commission_amount": commission_amount,
        "payment_mode": input.payment_mode,
        "players": [user["id"]],
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    rzp_client = await get_razorpay_client()

    if input.payment_mode == "split" and input.split_count:
        split_token = str(uuid.uuid4())[:8]
        per_share = price // input.split_count
        booking["split_config"] = {
            "total_shares": input.split_count, "per_share": per_share,
            "shares_paid": 0, "split_token": split_token
        }
        booking["status"] = "pending"
        await db.bookings.insert_one(booking)
        booking.pop("_id", None)
        if rzp_client:
            try:
                rzp_order = rzp_client.order.create({
                    "amount": per_share * 100, "currency": "INR", "payment_capture": 1,
                    "notes": {"booking_id": booking["id"], "type": "split_share", "payer_id": user["id"]}
                })
                booking["razorpay_order_id"] = rzp_order["id"]
                booking["payment_gateway"] = "razorpay"
            except Exception as e:
                logger.warning(f"Razorpay order creation failed: {e}, falling back to mock")
                booking["payment_gateway"] = "mock"
        else:
            booking["payment_gateway"] = "mock"
    elif rzp_client:
        booking["status"] = "payment_pending"
        try:
            rzp_order = rzp_client.order.create({
                "amount": price * 100, "currency": "INR", "payment_capture": 1,
                "notes": {"booking_id": booking["id"], "type": "full_payment"}
            })
            booking["razorpay_order_id"] = rzp_order["id"]
            booking["payment_gateway"] = "razorpay"
        except Exception as e:
            logger.warning(f"Razorpay order creation failed: {e}, falling back to mock")
            booking["status"] = "confirmed"
            booking["payment_gateway"] = "mock"
        await db.bookings.insert_one(booking)
        booking.pop("_id", None)
    else:
        booking["status"] = "confirmed"
        booking["payment_gateway"] = "mock"
        await db.bookings.insert_one(booking)
        booking.pop("_id", None)

    await db.venues.update_one({"id": input.venue_id}, {"$inc": {"total_bookings": 1}})
    await db.users.update_one({"id": user["id"]}, {"$inc": {"total_games": 1}})

    if redis_client:
        key = lock_key(input.venue_id, input.date, input.start_time, input.turf_number)
        await redis_client.delete(key)

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

    settings = await get_platform_settings()
    gw = settings.get("payment_gateway", {})
    key_secret = gw.get("key_secret", "")
    if key_secret:
        msg = f"{razorpay_order_id}|{razorpay_payment_id}"
        expected = hmac.new(key_secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
        if expected != razorpay_signature:
            raise HTTPException(400, "Payment verification failed")

    if booking.get("split_config"):
        sp = {
            "id": str(uuid.uuid4()), "booking_id": booking_id,
            "split_token": booking["split_config"]["split_token"],
            "payer_id": user["id"], "payer_name": user["name"],
            "amount": booking["split_config"]["per_share"],
            "razorpay_payment_id": razorpay_payment_id,
            "status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()
        }
        await db.split_payments.insert_one(sp)
        new_shares_paid = booking["split_config"]["shares_paid"] + 1
        new_status = "confirmed" if new_shares_paid >= booking["split_config"]["total_shares"] else "pending"
        await db.bookings.update_one({"id": booking_id}, {
            "$set": {"split_config.shares_paid": new_shares_paid, "status": new_status,
                     "payment_details.last_payment_id": razorpay_payment_id},
            "$push": {"players": user["id"]}
        })
        return {"message": "Share paid", "shares_paid": new_shares_paid, "status": new_status}
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


@router.get("/payment/gateway-info")
async def get_gateway_info():
    settings = await get_platform_settings()
    gw = settings.get("payment_gateway", {})
    key_id = gw.get("key_id", "")
    has_gateway = bool(key_id and gw.get("key_secret", ""))
    return {"has_gateway": has_gateway, "key_id": key_id, "provider": gw.get("provider", "razorpay")}


@router.get("/bookings")
async def list_bookings(user=Depends(get_current_user)):
    bookings = await db.bookings.find(
        {"$or": [{"host_id": user["id"]}, {"players": user["id"]}]}, {"_id": 0}
    ).sort("date", -1).to_list(100)
    return bookings


@router.get("/bookings/{booking_id}")
async def get_booking(booking_id: str):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Booking not found")
    return booking


@router.post("/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: str, user=Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking["host_id"] != user["id"]:
        raise HTTPException(403, "Only the host can cancel")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": "cancelled"}})
    if booking.get("split_config"):
        await db.split_payments.update_many({"booking_id": booking_id}, {"$set": {"status": "refunded"}})
    if redis_client:
        key = lock_key(booking["venue_id"], booking["date"], booking["start_time"], booking.get("turf_number", 1))
        await redis_client.delete(key)
    from routes.notifications import _notify_slot_available
    await _notify_slot_available(
        booking["venue_id"], booking["date"],
        booking["start_time"], booking.get("turf_number", 1)
    )
    return {"message": "Booking cancelled"}


# ── Split Payment Routes ──
@router.get("/split/{token}")
async def get_split_info(token: str):
    booking = await db.bookings.find_one({"split_config.split_token": token}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Not found")
    payments = await db.split_payments.find({"split_token": token}, {"_id": 0}).to_list(50)
    sc = booking.get("split_config", {})
    return {
        "booking": booking, "payments": payments,
        "remaining": sc.get("total_shares", 0) - sc.get("shares_paid", 0),
        "per_share": sc.get("per_share", 0)
    }


@router.post("/split/{token}/pay")
async def pay_split(token: str, request: Request):
    body = await request.json()
    payer_name = body.get("payer_name", "Anonymous")
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
            logger.warning(f"Razorpay order failed for split: {e}")

    payment = {
        "id": str(uuid.uuid4()), "booking_id": booking["id"],
        "split_token": token, "payer_id": "", "payer_name": payer_name,
        "amount": sc["per_share"], "status": "paid",
        "paid_at": datetime.now(timezone.utc).isoformat()
    }
    await db.split_payments.insert_one(payment)
    payment.pop("_id", None)
    new_paid = sc["shares_paid"] + 1
    updates = {"split_config.shares_paid": new_paid}
    if new_paid >= sc["total_shares"]:
        updates["status"] = "confirmed"
    await db.bookings.update_one({"id": booking["id"]}, {"$set": updates})
    result["payment_gateway"] = "mock"
    result["message"] = "Payment successful"
    result["payment"] = payment
    return result


@router.post("/split/{token}/verify-payment")
async def verify_split_payment(token: str, request: Request):
    data = await request.json()
    booking = await db.bookings.find_one({"split_config.split_token": token})
    if not booking:
        raise HTTPException(404, "Booking not found")
    payment = {
        "id": str(uuid.uuid4()), "booking_id": booking["id"],
        "split_token": token, "payer_id": data.get("payer_id", ""),
        "payer_name": data.get("payer_name", "Anonymous"),
        "amount": booking["split_config"]["per_share"],
        "razorpay_payment_id": data.get("razorpay_payment_id", ""),
        "status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()
    }
    await db.split_payments.insert_one(payment)
    payment.pop("_id", None)
    sc = booking["split_config"]
    new_paid = sc["shares_paid"] + 1
    updates = {"split_config.shares_paid": new_paid}
    if new_paid >= sc["total_shares"]:
        updates["status"] = "confirmed"
    await db.bookings.update_one({"id": booking["id"]}, {"$set": updates})
    return {"message": "Share paid", "shares_paid": new_paid,
            "status": "confirmed" if new_paid >= sc["total_shares"] else "pending"}


# ── Pricing Rules Routes ──
@router.get("/venues/{venue_id}/pricing-rules")
async def get_pricing_rules(venue_id: str):
    rules = await db.pricing_rules.find({"venue_id": venue_id}, {"_id": 0}).sort("priority", -1).to_list(50)
    return rules


@router.post("/venues/{venue_id}/pricing-rules")
async def create_pricing_rule(venue_id: str, input: PricingRuleCreate, user=Depends(get_current_user)):
    from models import PricingRuleCreate as _unused  # noqa: just for import clarity
    rule = {
        "id": str(uuid.uuid4()), "venue_id": venue_id,
        **input.model_dump(), "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.pricing_rules.insert_one(rule)
    rule.pop("_id", None)
    return rule


@router.delete("/pricing-rules/{rule_id}")
async def delete_pricing_rule(rule_id: str, user=Depends(get_current_user)):
    await db.pricing_rules.delete_one({"id": rule_id})
    return {"message": "Rule deleted"}
