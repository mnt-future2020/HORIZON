"""
Coach Session Booking System
1-on-1 coaching sessions with availability management, booking, and payment.
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import Optional
from datetime import datetime, timezone, timedelta
from database import db
from auth import get_current_user, get_razorpay_client, get_platform_settings
from tz import now_ist, IST, parse_ist
import uuid
import hmac
import hashlib
import os
import asyncio
from invoice_utils import generate_coaching_invoice

router = APIRouter(prefix="/coaching", tags=["coaching"])


# ─── Coach Profile & Availability ─────────────────────────────────────────────

@router.get("/coaches")
async def list_coaches(
    sport: Optional[str] = None,
    city: Optional[str] = None,
    user=Depends(get_current_user),
):
    """List available coaches with their profiles."""
    query = {"role": "coach", "account_status": "active"}
    if sport:
        query["coaching_sports"] = {"$in": [sport]}
    if city:
        query["city"] = city

    coaches = await db.users.find(
        query,
        {"_id": 0, "password_hash": 0}
    ).sort("coaching_rating", -1).to_list(100)

    # Enrich with session count and rating
    for coach in coaches:
        coach["total_sessions"] = await db.coaching_sessions.count_documents(
            {"coach_id": coach["id"], "status": "completed"}
        )
        # Get average rating from session reviews
        pipeline = [
            {"$match": {"coach_id": coach["id"], "rating": {"$exists": True, "$gt": 0}}},
            {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
        ]
        agg = await db.coaching_sessions.aggregate(pipeline).to_list(1)
        if agg:
            coach["coaching_rating"] = round(agg[0]["avg"], 1)
            coach["total_reviews"] = agg[0]["count"]
        else:
            coach["coaching_rating"] = coach.get("coaching_rating", 0)
            coach["total_reviews"] = 0

    return coaches


@router.get("/coaches/{coach_id}")
async def get_coach_profile(coach_id: str, user=Depends(get_current_user)):
    """Get detailed coach profile with availability."""
    coach = await db.users.find_one(
        {"id": coach_id, "role": "coach"},
        {"_id": 0, "password_hash": 0}
    )
    if not coach:
        raise HTTPException(404, "Coach not found")

    # Get availability slots
    availability = await db.coaching_availability.find(
        {"coach_id": coach_id}, {"_id": 0}
    ).sort("day_of_week", 1).to_list(50)

    # Get total sessions and rating
    total_sessions = await db.coaching_sessions.count_documents(
        {"coach_id": coach_id, "status": "completed"}
    )
    pipeline = [
        {"$match": {"coach_id": coach_id, "rating": {"$exists": True, "$gt": 0}}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
    ]
    agg = await db.coaching_sessions.aggregate(pipeline).to_list(1)

    coach["total_sessions"] = total_sessions
    if agg:
        coach["coaching_rating"] = round(agg[0]["avg"], 1)
        coach["total_reviews"] = agg[0]["count"]
    coach["availability"] = availability

    return coach


@router.put("/profile")
async def update_coach_profile(request: Request, user=Depends(get_current_user)):
    """Update coaching profile (coach only)."""
    if user["role"] != "coach":
        raise HTTPException(403, "Only coaches can update coaching profile")

    data = await request.json()
    allowed = ["coaching_bio", "coaching_sports", "session_price",
               "session_duration_minutes", "city", "coaching_venue",
               "years_of_experience", "specializations", "achievements",
               "awards", "certifications_list", "playing_history"]
    updates = {k: v for k, v in data.items() if k in allowed}

    if "session_price" in updates:
        updates["session_price"] = int(updates["session_price"])
    if "session_duration_minutes" in updates:
        updates["session_duration_minutes"] = int(updates["session_duration_minutes"])
    if "years_of_experience" in updates:
        updates["years_of_experience"] = int(updates["years_of_experience"])

    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})

    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return updated


# ─── Availability Management ──────────────────────────────────────────────────

@router.get("/availability")
async def get_my_availability(user=Depends(get_current_user)):
    """Get coach's availability slots."""
    if user["role"] != "coach":
        raise HTTPException(403, "Only coaches can manage availability")
    slots = await db.coaching_availability.find(
        {"coach_id": user["id"]}, {"_id": 0}
    ).sort("day_of_week", 1).to_list(50)
    return slots


@router.post("/availability")
async def set_availability(request: Request, user=Depends(get_current_user)):
    """Add an availability slot (coach only)."""
    if user["role"] != "coach":
        raise HTTPException(403, "Only coaches can manage availability")

    data = await request.json()
    slot = {
        "id": str(uuid.uuid4()),
        "coach_id": user["id"],
        "day_of_week": int(data.get("day_of_week", 0)),  # 0=Sun..6=Sat
        "start_time": data.get("start_time", "09:00"),
        "end_time": data.get("end_time", "10:00"),
        "sports": data.get("sports", []),  # Which sports this slot covers
        "is_active": True,
        "created_at": now_ist().isoformat(),
    }
    await db.coaching_availability.insert_one(slot)
    slot.pop("_id", None)
    return slot


@router.delete("/availability/{slot_id}")
async def remove_availability(slot_id: str, user=Depends(get_current_user)):
    """Remove an availability slot."""
    if user["role"] != "coach":
        raise HTTPException(403, "Only coaches can manage availability")
    result = await db.coaching_availability.delete_one(
        {"id": slot_id, "coach_id": user["id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(404, "Slot not found")
    return {"message": "Availability slot removed"}


# ─── Available Slots for a Date ───────────────────────────────────────────────

@router.get("/coaches/{coach_id}/slots")
async def get_coach_slots(
    coach_id: str,
    date: str,
    user=Depends(get_current_user),
):
    """Get available coaching slots for a specific date."""
    # Parse date to get day of week
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD")

    day_of_week = target_date.weekday()  # 0=Mon..6=Sun
    # Convert to our format (0=Sun..6=Sat)
    day_of_week = (day_of_week + 1) % 7

    # Get availability for this day
    availability = await db.coaching_availability.find(
        {"coach_id": coach_id, "day_of_week": day_of_week, "is_active": True},
        {"_id": 0}
    ).to_list(20)

    # Get existing bookings for this date
    booked = await db.coaching_sessions.find(
        {"coach_id": coach_id, "date": date, "status": {"$in": ["confirmed", "pending"]}},
        {"_id": 0, "start_time": 1, "end_time": 1}
    ).to_list(50)

    booked_times = set()
    for b in booked:
        booked_times.add(b["start_time"])

    # Mark slots as available or booked
    slots = []
    for av in availability:
        slots.append({
            "start_time": av["start_time"],
            "end_time": av["end_time"],
            "sports": av.get("sports", []),
            "available": av["start_time"] not in booked_times,
        })

    return {"date": date, "day_of_week": day_of_week, "slots": slots}


# ─── Booking Confirmation WhatsApp helper ─────────────────────────────────────

async def _fire_booking_confirmation(session: dict):
    """Fire-and-forget: send booking confirmation WhatsApp to the player."""
    try:
        from routes.coach_whatsapp import get_coach_wa_settings, send_wa_with_log
        from whatsapp_service import build_booking_confirmation_message

        settings = await get_coach_wa_settings(session["coach_id"])
        if not settings.get("booking_confirmation", {}).get("enabled", True):
            return

        # Skip if already sent
        existing = await db.whatsapp_logs.find_one({
            "reference_id": session["id"],
            "automation_type": "booking_confirmation",
            "status": "sent",
        })
        if existing:
            return

        player = await db.users.find_one({"id": session["player_id"]}, {"phone": 1, "name": 1})
        if not player or not player.get("phone"):
            return

        platform_s = await db.platform_settings.find_one({"key": "platform"}, {"_id": 0})
        wa = (platform_s or {}).get("whatsapp", {})

        msg = build_booking_confirmation_message(
            client_name=player.get("name", ""),
            coach_name=session.get("coach_name", "Your Coach"),
            sport=session.get("sport", ""),
            date=session.get("date", ""),
            start_time=session.get("start_time", ""),
            location=session.get("location", ""),
        )
        await send_wa_with_log(
            wa, player["phone"], msg,
            coach_id=session["coach_id"],
            client_id=session["player_id"],
            client_name=player.get("name", ""),
            automation_type="booking_confirmation",
            reference_id=session["id"],
        )
    except Exception as e:
        import logging as _log
        _log.getLogger("horizon.coaching").warning(f"Booking confirmation WA failed: {e}")


# ─── Session Booking ──────────────────────────────────────────────────────────

@router.post("/sessions/book")
async def book_session(request: Request, user=Depends(get_current_user)):
    """Book a coaching session (player books with coach)."""
    data = await request.json()
    coach_id = data.get("coach_id")
    date = data.get("date")
    start_time = data.get("start_time")

    if not all([coach_id, date, start_time]):
        raise HTTPException(400, "coach_id, date, and start_time are required")

    # Verify coach exists
    coach = await db.users.find_one({"id": coach_id, "role": "coach"}, {"_id": 0, "password_hash": 0})
    if not coach:
        raise HTTPException(404, "Coach not found")

    # Check for existing booking at this time
    existing = await db.coaching_sessions.find_one({
        "coach_id": coach_id, "date": date, "start_time": start_time,
        "status": {"$in": ["confirmed", "pending"]}
    })
    if existing:
        raise HTTPException(409, "This slot is already booked")

    session_price = coach.get("session_price", 500)
    duration = coach.get("session_duration_minutes", 60)

    # Calculate end time
    start_h, start_m = map(int, start_time.split(":"))
    end_total = start_h * 60 + start_m + duration
    end_time = f"{end_total // 60:02d}:{end_total % 60:02d}"

    # Commission calculation
    platform = await get_platform_settings()
    commission_pct = platform.get("coaching_commission_pct", 10)
    commission_amount = int(session_price * commission_pct / 100)

    session = {
        "id": str(uuid.uuid4()),
        "coach_id": coach_id,
        "coach_name": coach.get("name", ""),
        "player_id": user["id"],
        "player_name": user.get("name", ""),
        "date": date,
        "start_time": start_time,
        "end_time": end_time,
        "duration_minutes": duration,
        "price": session_price,
        "commission_amount": commission_amount,
        "sport": data.get("sport", coach.get("coaching_sports", ["general"])[0] if coach.get("coaching_sports") else "general"),
        "location": data.get("location", coach.get("coaching_venue", "")),
        "notes": data.get("notes", ""),
        "rating": None,
        "review": None,
        "created_at": now_ist().isoformat(),
    }

    # Check for active monthly package subscription with this coach + matching sport
    booked_sport = session["sport"]
    active_sub = await db.coaching_subscriptions.find_one({
        "coach_id": coach_id,
        "player_id": user["id"],
        "status": "active",
        "current_period_end": {"$gte": now_ist().isoformat()},
        "$or": [
            {"sports": booked_sport},       # subscription covers this sport
            {"sports": {"$size": 0}},        # or subscription has no sport restriction (all-sports package)
        ],
    })

    if active_sub and active_sub.get("sessions_used", 0) < active_sub["sessions_per_month"]:
        # Book from package — no payment needed
        session["status"] = "confirmed"
        session["payment_gateway"] = "package"
        session["subscription_id"] = active_sub["id"]
        session["package_name"] = active_sub.get("package_name", "")

        await db.coaching_sessions.insert_one(session)
        session.pop("_id", None)

        # Increment sessions_used on the subscription
        await db.coaching_subscriptions.update_one(
            {"id": active_sub["id"]},
            {"$inc": {"sessions_used": 1}}
        )

        session["booked_from_package"] = True
        session["sessions_remaining"] = active_sub["sessions_per_month"] - active_sub.get("sessions_used", 0) - 1
        await _fire_booking_confirmation(session)
    else:
        # Per-session payment flow — same pattern as venue bookings
        rzp_client = await get_razorpay_client()
        if rzp_client:
            session["status"] = "payment_pending"
            try:
                rzp_order = rzp_client.order.create({
                    "amount": session_price * 100,
                    "currency": "INR",
                    "payment_capture": 1,
                    "notes": {"session_id": session["id"], "type": "coaching_session"}
                })
                session["razorpay_order_id"] = rzp_order["id"]
                session["payment_gateway"] = "razorpay"
            except Exception:
                raise HTTPException(502, "Payment gateway error. Please try again.")
        else:
            if os.environ.get("ENVIRONMENT") == "production":
                raise HTTPException(502, "Payment gateway not available. Please try again later.")
            session["status"] = "payment_pending"
            session["payment_gateway"] = "test"

        await db.coaching_sessions.insert_one(session)
        session.pop("_id", None)
        session["booked_from_package"] = False

    # Notify coach
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": coach_id,
        "type": "coaching_session_booked",
        "title": "New Session Booked!",
        "message": f'{user.get("name", "A player")} booked a {session["sport"]} session on {date} at {start_time}.',
        "is_read": False,
        "created_at": now_ist().isoformat(),
    })

    # Return razorpay_key_id for frontend checkout
    gw = platform.get("payment_gateway", {})
    session["razorpay_key_id"] = gw.get("key_id", "")
    return session


@router.get("/sessions")
async def list_sessions(
    status: Optional[str] = None,
    upcoming: bool = False,
    user=Depends(get_current_user),
):
    """List coaching sessions (coach sees their sessions, players see their booked sessions)."""
    if user["role"] == "coach":
        query = {"coach_id": user["id"]}
    else:
        query = {"player_id": user["id"]}

    if status:
        query["status"] = status

    if upcoming:
        today = now_ist().strftime("%Y-%m-%d")
        query["date"] = {"$gte": today}

    sessions = await db.coaching_sessions.find(
        query, {"_id": 0}
    ).sort("date", -1).to_list(100)

    return sessions


@router.post("/sessions/{session_id}/cancel")
async def cancel_session(session_id: str, user=Depends(get_current_user)):
    """Cancel a coaching session."""
    session = await db.coaching_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(404, "Session not found")

    # Only coach or booked player can cancel
    if session["coach_id"] != user["id"] and session["player_id"] != user["id"]:
        raise HTTPException(403, "Not authorized")

    if session["status"] in ("cancelled", "completed"):
        raise HTTPException(400, f"Cannot cancel a {session['status']} session")

    await db.coaching_sessions.update_one(
        {"id": session_id},
        {"$set": {"status": "cancelled", "cancelled_at": now_ist().isoformat()}}
    )

    # Notify the other party
    notify_id = session["coach_id"] if user["id"] == session["player_id"] else session["player_id"]
    canceller = "Player" if user["id"] == session["player_id"] else "Coach"
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": notify_id,
        "type": "coaching_session_cancelled",
        "title": "Session Cancelled",
        "message": f'{canceller} cancelled the session on {session["date"]} at {session["start_time"]}.',
        "is_read": False,
        "created_at": now_ist().isoformat(),
    })

    return {"message": "Session cancelled"}


# ─── Session Payment Verification ────────────────────────────────────────────

@router.post("/sessions/{session_id}/verify-payment")
async def verify_session_payment(session_id: str, request: Request, user=Depends(get_current_user)):
    """Verify Razorpay payment for a coaching session."""
    data = await request.json()
    razorpay_payment_id = data.get("razorpay_payment_id", "")
    razorpay_order_id = data.get("razorpay_order_id", "")
    razorpay_signature = data.get("razorpay_signature", "")

    session = await db.coaching_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(404, "Session not found")
    if session["player_id"] != user["id"]:
        raise HTTPException(403, "Not authorized")
    if session.get("status") != "payment_pending":
        raise HTTPException(400, f"Session is already {session.get('status')}")

    settings = await get_platform_settings()
    gw = settings.get("payment_gateway", {})
    key_secret = gw.get("key_secret", "")

    if not key_secret:
        raise HTTPException(500, "Payment gateway not configured. Contact support.")
    msg = f"{razorpay_order_id}|{razorpay_payment_id}"
    expected = hmac.new(key_secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, razorpay_signature):
        raise HTTPException(400, "Payment verification failed")

    await db.coaching_sessions.update_one({"id": session_id}, {"$set": {
        "status": "confirmed",
        "payment_details": {
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_order_id": razorpay_order_id,
            "paid_at": now_ist().isoformat()
        }
    }})
    confirmed_session = await db.coaching_sessions.find_one({"id": session_id}, {"_id": 0})
    if confirmed_session:
        await _fire_booking_confirmation(confirmed_session)
        asyncio.create_task(generate_coaching_invoice(confirmed_session, "coaching_session", {
            "razorpay_payment_id": razorpay_payment_id, "razorpay_order_id": razorpay_order_id, "paid_at": now_ist().isoformat()
        }))
    return {"message": "Payment verified, session confirmed", "status": "confirmed"}


@router.post("/sessions/{session_id}/test-confirm")
async def test_confirm_session(session_id: str, user=Depends(get_current_user)):
    """Confirm payment for test-mode coaching sessions (no payment gateway configured)."""
    if os.environ.get("ENVIRONMENT") == "production":
        raise HTTPException(403, "Test payment endpoints are disabled in production")
    session = await db.coaching_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(404, "Session not found")
    if session.get("payment_gateway") not in ("test", "mock"):
        raise HTTPException(400, "This endpoint is only for test-mode sessions")
    if session.get("status") != "payment_pending":
        raise HTTPException(400, f"Session is already {session.get('status')}")
    if session["player_id"] != user["id"] and user["role"] != "super_admin":
        raise HTTPException(403, "Not authorized")

    await db.coaching_sessions.update_one({"id": session_id}, {"$set": {
        "status": "confirmed",
        "payment_details": {
            "method": "test",
            "test_payment_id": f"test_{uuid.uuid4().hex[:12]}",
            "paid_at": now_ist().isoformat()
        }
    }})
    confirmed_session = await db.coaching_sessions.find_one({"id": session_id}, {"_id": 0})
    if confirmed_session:
        await _fire_booking_confirmation(confirmed_session)
        asyncio.create_task(generate_coaching_invoice(confirmed_session, "coaching_session", confirmed_session.get("payment_details", {})))
    return {"message": "Test payment confirmed", "status": "confirmed"}


@router.post("/sessions/{session_id}/complete")
async def complete_session(session_id: str, user=Depends(get_current_user)):
    """Mark a session as completed (coach only)."""
    session = await db.coaching_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(404, "Session not found")
    if session["coach_id"] != user["id"]:
        raise HTTPException(403, "Only the coach can complete a session")
    if session["status"] != "confirmed":
        raise HTTPException(400, "Session is not in confirmed status")

    now = now_ist().isoformat()
    await db.coaching_sessions.update_one(
        {"id": session_id},
        {"$set": {"status": "completed", "completed_at": now}}
    )

    # Auto-create performance record for the player
    perf_record = {
        "id": str(uuid.uuid4()),
        "player_id": session["player_id"],
        "player_name": session.get("player_name", ""),
        "record_type": "training",
        "sport": session.get("sport", "general"),
        "title": f"Coaching Session with {session.get('coach_name', '')}",
        "stats": {"duration_minutes": session.get("duration_minutes", 60)},
        "notes": session.get("notes", ""),
        "source_type": "coach",
        "source_id": session["coach_id"],
        "source_name": session.get("coach_name", ""),
        "organization_id": None,
        "tournament_id": None,
        "session_id": session_id,
        "date": session.get("date", now[:10]),
        "verified": True,
        "created_at": now
    }
    await db.performance_records.insert_one(perf_record)

    return {"message": "Session marked as completed"}


@router.post("/sessions/{session_id}/review")
async def review_session(session_id: str, request: Request, user=Depends(get_current_user)):
    """Rate and review a completed coaching session (player only)."""
    session = await db.coaching_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(404, "Session not found")
    if session["player_id"] != user["id"]:
        raise HTTPException(403, "Only the player can review a session")
    if session["status"] != "completed":
        raise HTTPException(400, "Can only review completed sessions")
    if session.get("rating"):
        raise HTTPException(409, "Session already reviewed")

    data = await request.json()
    rating = int(data.get("rating", 5))
    if rating < 1 or rating > 5:
        raise HTTPException(400, "Rating must be 1-5")

    await db.coaching_sessions.update_one(
        {"id": session_id},
        {"$set": {
            "rating": rating,
            "review": data.get("review", ""),
            "reviewed_at": now_ist().isoformat(),
        }}
    )

    return {"message": "Review submitted"}


# ─── Coach Stats ──────────────────────────────────────────────────────────────

@router.get("/stats")
async def coach_stats(user=Depends(get_current_user)):
    """Get coaching stats for the current coach."""
    if user["role"] != "coach":
        raise HTTPException(403, "Only coaches can view coaching stats")

    total = await db.coaching_sessions.count_documents({"coach_id": user["id"]})
    completed = await db.coaching_sessions.count_documents({"coach_id": user["id"], "status": "completed"})
    upcoming_count = await db.coaching_sessions.count_documents({
        "coach_id": user["id"],
        "status": "confirmed",
        "date": {"$gte": now_ist().strftime("%Y-%m-%d")}
    })
    cancelled = await db.coaching_sessions.count_documents({"coach_id": user["id"], "status": "cancelled"})

    # Revenue from completed sessions
    completed_sessions = await db.coaching_sessions.find(
        {"coach_id": user["id"], "status": "completed"},
        {"_id": 0, "price": 1, "commission_amount": 1}
    ).to_list(1000)
    total_revenue = sum(s.get("price", 0) for s in completed_sessions)
    total_commission = sum(s.get("commission_amount", 0) for s in completed_sessions)
    net_revenue = total_revenue - total_commission

    # Average rating
    pipeline = [
        {"$match": {"coach_id": user["id"], "rating": {"$exists": True, "$gt": 0}}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
    ]
    agg = await db.coaching_sessions.aggregate(pipeline).to_list(1)
    avg_rating = round(agg[0]["avg"], 1) if agg else 0
    review_count = agg[0]["count"] if agg else 0

    # Recent sessions
    recent = await db.coaching_sessions.find(
        {"coach_id": user["id"]}, {"_id": 0}
    ).sort("date", -1).to_list(5)

    # Package subscription stats
    active_subscribers = await db.coaching_subscriptions.count_documents(
        {"coach_id": user["id"], "status": "active"}
    )
    package_subs = await db.coaching_subscriptions.find(
        {"coach_id": user["id"], "status": {"$in": ["active", "expired", "cancelled"]}},
        {"_id": 0, "price": 1, "commission_amount": 1}
    ).to_list(1000)
    package_revenue = sum(s.get("price", 0) for s in package_subs)
    package_commission = sum(s.get("commission_amount", 0) for s in package_subs)

    # Offline data
    offline_sessions_count = await db.coach_offline_sessions.count_documents({"coach_id": user["id"]})
    offline_clients_count = await db.coach_clients.count_documents({"coach_id": user["id"], "status": "active"})
    offline_revenue = 0
    async for p in db.coach_offline_payments.find({"coach_id": user["id"]}, {"amount": 1, "_id": 0}):
        offline_revenue += p.get("amount", 0)
    # Also count paid offline sessions
    async for s in db.coach_offline_sessions.find(
        {"coach_id": user["id"], "payment_status": "paid"}, {"amount": 1, "_id": 0}
    ):
        offline_revenue = max(offline_revenue, offline_revenue)  # avoid double-count; payments collection is source of truth

    # Online unique clients
    online_ids = set()
    async for s in db.coaching_sessions.find(
        {"coach_id": user["id"], "status": {"$in": ["confirmed", "completed"]}}, {"player_id": 1, "_id": 0}
    ):
        if s.get("player_id"):
            online_ids.add(s["player_id"])

    return {
        "total_sessions": total,
        "completed": completed,
        "upcoming": upcoming_count,
        "cancelled": cancelled,
        "total_revenue": total_revenue,
        "total_commission": total_commission,
        "net_revenue": net_revenue,
        "package_revenue": package_revenue,
        "package_commission": package_commission,
        "active_subscribers": active_subscribers,
        "avg_rating": avg_rating,
        "review_count": review_count,
        "recent_sessions": recent,
        "offline_sessions": offline_sessions_count,
        "offline_revenue": offline_revenue,
        "offline_clients": offline_clients_count,
        "online_clients": len(online_ids),
        "total_clients": len(online_ids) + offline_clients_count,
    }


# ─── QR Check-in System ──────────────────────────────────────────────────────

@router.get("/checkin/qr/{booking_id}")
async def get_checkin_qr(booking_id: str, user=Depends(get_current_user)):
    """Generate QR check-in data for a venue booking OR coaching session."""
    # Try venue booking first
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    source = "booking"
    if booking:
        if booking["host_id"] != user["id"]:
            raise HTTPException(403, "Not your booking")
        if booking["status"] not in ("confirmed", "payment_pending"):
            raise HTTPException(400, "Booking is not active")
    else:
        # Try coaching session
        booking = await db.coaching_sessions.find_one({"id": booking_id}, {"_id": 0})
        source = "coaching"
        if not booking:
            raise HTTPException(404, "Booking not found")
        if booking["player_id"] != user["id"]:
            raise HTTPException(403, "Not your session")
        if booking["status"] != "confirmed":
            raise HTTPException(400, "Session is not active")

    # Generate a check-in token
    token = str(uuid.uuid4())[:8].upper()
    collection = db.bookings if source == "booking" else db.coaching_sessions
    await collection.update_one(
        {"id": booking_id},
        {"$set": {"checkin_token": token}}
    )

    # Expire QR at booking end_time (not arbitrary 2h)
    try:
        expires_at = parse_ist(booking['date'], booking['end_time'])
    except Exception:
        expires_at = now_ist() + timedelta(hours=24)

    return {
        "booking_id": booking_id,
        "source": source,
        "checkin_token": token,
        "qr_data": f"HORIZON_CHECKIN:{booking_id}:{token}",
        "venue_name": booking.get("venue_name", booking.get("location", "")),
        "date": booking["date"],
        "start_time": booking["start_time"],
        "expires_at": expires_at.isoformat(),
    }


@router.post("/checkin/verify")
async def verify_checkin(request: Request, user=Depends(get_current_user)):
    """Verify a check-in QR code (coach or venue owner scans player's QR)."""
    if user["role"] not in ("venue_owner", "super_admin", "coach"):
        raise HTTPException(403, "Only coaches or venue staff can verify check-ins")

    data = await request.json()
    qr_data = data.get("qr_data", "")

    # Parse QR data: HORIZON_CHECKIN:{booking_id}:{token}
    parts = qr_data.split(":")
    if len(parts) != 3 or parts[0] != "HORIZON_CHECKIN":
        raise HTTPException(400, "Invalid QR code format")

    booking_id = parts[1]
    token = parts[2]

    # Try venue booking first, then coaching session
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    source = "booking"
    collection = db.bookings

    if not booking:
        booking = await db.coaching_sessions.find_one({"id": booking_id}, {"_id": 0})
        source = "coaching"
        collection = db.coaching_sessions

    if not booking:
        raise HTTPException(404, "Booking not found")

    if booking.get("checkin_token") != token:
        raise HTTPException(400, "Invalid or expired check-in token")

    # Time window check: only allow check-in 30 min before start to end_time
    try:
        booking_date = booking["date"]  # "2026-02-27"
        start_time = booking["start_time"]  # "17:00"
        end_time = booking["end_time"]  # "18:00"
        now = now_ist()
        start_dt = parse_ist(booking_date, start_time)
        end_dt = parse_ist(booking_date, end_time)
        window_open = start_dt - timedelta(minutes=15)
        if now < window_open:
            mins_left = int((window_open - now).total_seconds() // 60)
            raise HTTPException(400, f"Check-in opens 15 minutes before booking time. Try again in {mins_left} min.")
        if now > end_dt:
            raise HTTPException(400, "Booking time has ended — check-in is no longer available.")
    except HTTPException:
        raise
    except Exception:
        pass  # If date parsing fails, allow check-in (don't block)

    if booking.get("checked_in"):
        return {
            "message": "Already checked in",
            "booking": booking,
            "source": source,
            "already_checked_in": True,
            "player_name": booking.get("player_name", booking.get("host_name", "Unknown")),
        }

    # Verify ownership: venue owner checks venue, coach checks their session
    if source == "booking" and user["role"] == "venue_owner":
        venue = await db.venues.find_one({"id": booking["venue_id"]}, {"owner_id": 1})
        if not venue or venue.get("owner_id") != user["id"]:
            raise HTTPException(403, "Not your venue")
    elif source == "coaching" and user["role"] == "coach":
        if booking.get("coach_id") != user["id"]:
            raise HTTPException(403, "Not your coaching session")

    now = now_ist().isoformat()
    await collection.update_one(
        {"id": booking_id},
        {"$set": {
            "checked_in": True,
            "checkin_time": now,
            "checked_in_by": user["id"],
        }}
    )

    booking["checked_in"] = True
    booking["checkin_time"] = now

    return {
        "message": "Check-in successful!",
        "booking": booking,
        "source": source,
        "already_checked_in": False,
        "player_name": booking.get("player_name", booking.get("host_name", "Unknown")),
    }


# ─── Monthly Coaching Packages ───────────────────────────────────────────────

@router.post("/packages")
async def create_package(request: Request, user=Depends(get_current_user)):
    """Create a monthly coaching package (coach only)."""
    if user["role"] != "coach":
        raise HTTPException(403, "Only coaches can create packages")

    data = await request.json()
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(400, "Package name is required")

    sessions_per_month = int(data.get("sessions_per_month", 4))
    price = int(data.get("price", 2000))
    if sessions_per_month < 1:
        raise HTTPException(400, "Must include at least 1 session per month")
    if sessions_per_month > 100:
        raise HTTPException(400, "Maximum 100 sessions per month")
    if price < 1:
        raise HTTPException(400, "Price must be at least 1")

    pkg_type = data.get("type", "monthly")
    if pkg_type not in ("monthly", "quarterly", "one_time", "batch"):
        pkg_type = "monthly"

    max_subs = data.get("max_subscribers")
    if max_subs is not None:
        try:
            max_subs = max(1, int(max_subs))
        except (ValueError, TypeError):
            max_subs = None

    package = {
        "id": str(uuid.uuid4()),
        "coach_id": user["id"],
        "coach_name": user.get("name", ""),
        "name": name,
        "type": pkg_type,
        "sessions_per_month": sessions_per_month,
        "price": price,
        "duration_minutes": int(data.get("duration_minutes", user.get("session_duration_minutes", 60))),
        "sports": data.get("sports", user.get("coaching_sports", [])),
        "description": data.get("description", ""),
        "features": data.get("features", []),
        "max_subscribers": max_subs,
        "is_public": bool(data.get("is_public", True)),
        "is_active": True,
        "created_at": now_ist().isoformat(),
    }

    await db.coaching_packages.insert_one(package)
    package.pop("_id", None)

    # Count subscribers
    package["subscriber_count"] = 0
    return package


@router.get("/packages")
async def list_my_packages(user=Depends(get_current_user)):
    """List coach's own packages (coach) or all active packages."""
    if user["role"] == "coach":
        packages = await db.coaching_packages.find(
            {"coach_id": user["id"]}, {"_id": 0}
        ).sort("created_at", -1).to_list(50)
    else:
        packages = await db.coaching_packages.find(
            {"is_active": True}, {"_id": 0}
        ).sort("created_at", -1).to_list(100)

    # Enrich with subscriber count
    for p in packages:
        p["subscriber_count"] = await db.coaching_subscriptions.count_documents(
            {"package_id": p["id"], "status": "active"}
        )
    return packages


@router.get("/coaches/{coach_id}/packages")
async def get_coach_packages(coach_id: str, user=Depends(get_current_user)):
    """List active packages for a specific coach (player-facing)."""
    packages = await db.coaching_packages.find(
        {"coach_id": coach_id, "is_active": True}, {"_id": 0}
    ).sort("price", 1).to_list(20)

    # Check if current user has active subscription for each package
    for p in packages:
        sub = await db.coaching_subscriptions.find_one({
            "package_id": p["id"], "player_id": user["id"], "status": "active"
        })
        p["subscribed"] = bool(sub)
        if sub:
            p["subscription_id"] = sub["id"]
            p["sessions_used"] = sub.get("sessions_used", 0)
            p["sessions_remaining"] = sub["sessions_per_month"] - sub.get("sessions_used", 0)
            p["period_end"] = sub.get("current_period_end", "")

    return packages


@router.put("/packages/{package_id}")
async def update_package(package_id: str, request: Request, user=Depends(get_current_user)):
    """Update a coaching package (coach only)."""
    if user["role"] != "coach":
        raise HTTPException(403, "Only coaches can update packages")

    package = await db.coaching_packages.find_one({"id": package_id, "coach_id": user["id"]})
    if not package:
        raise HTTPException(404, "Package not found")

    data = await request.json()
    allowed = ["name", "type", "sessions_per_month", "price", "duration_minutes", "sports",
               "description", "features", "max_subscribers", "is_public", "is_active"]
    updates = {k: v for k, v in data.items() if k in allowed}
    if "sessions_per_month" in updates:
        updates["sessions_per_month"] = int(updates["sessions_per_month"])
    if "price" in updates:
        updates["price"] = int(updates["price"])
    if "max_subscribers" in updates and updates["max_subscribers"] is not None:
        try:
            updates["max_subscribers"] = max(1, int(updates["max_subscribers"]))
        except (ValueError, TypeError):
            updates["max_subscribers"] = None
    if "type" in updates and updates["type"] not in ("monthly", "quarterly", "one_time", "batch"):
        updates["type"] = "monthly"

    if updates:
        await db.coaching_packages.update_one({"id": package_id}, {"$set": updates})

    updated = await db.coaching_packages.find_one({"id": package_id}, {"_id": 0})
    return updated


@router.delete("/packages/{package_id}")
async def deactivate_package(package_id: str, user=Depends(get_current_user)):
    """Deactivate a coaching package (soft delete)."""
    if user["role"] != "coach":
        raise HTTPException(403, "Only coaches can manage packages")

    result = await db.coaching_packages.update_one(
        {"id": package_id, "coach_id": user["id"]},
        {"$set": {"is_active": False}}
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Package not found")
    return {"message": "Package deactivated"}


# ─── Package Subscriptions ───────────────────────────────────────────────────

@router.post("/packages/{package_id}/subscribe")
async def subscribe_to_package(package_id: str, user=Depends(get_current_user)):
    """Subscribe to a monthly coaching package (player)."""
    package = await db.coaching_packages.find_one({"id": package_id, "is_active": True})
    if not package:
        raise HTTPException(404, "Package not found or inactive")

    # Check for existing active subscription with this coach for overlapping sports
    pkg_sports = package.get("sports", [])
    if pkg_sports:
        existing = await db.coaching_subscriptions.find_one({
            "coach_id": package["coach_id"], "player_id": user["id"], "status": "active",
            "sports": {"$in": pkg_sports},
        })
    else:
        existing = await db.coaching_subscriptions.find_one({
            "coach_id": package["coach_id"], "player_id": user["id"], "status": "active",
        })
    if existing:
        overlap = set(existing.get("sports", [])) & set(pkg_sports) if pkg_sports else set()
        sport_names = ", ".join(s.replace("_", " ").title() for s in overlap) if overlap else ""
        msg = f"You already have an active subscription for {sport_names} with this coach" if sport_names else "You already have an active subscription with this coach"
        raise HTTPException(409, msg)

    platform = await get_platform_settings()
    commission_pct = platform.get("coaching_commission_pct", 10)
    commission_amount = int(package["price"] * commission_pct / 100)

    now = now_ist()
    period_end = (now + timedelta(days=30)).isoformat()

    sub = {
        "id": str(uuid.uuid4()),
        "package_id": package_id,
        "package_name": package["name"],
        "coach_id": package["coach_id"],
        "coach_name": package.get("coach_name", ""),
        "player_id": user["id"],
        "player_name": user.get("name", ""),
        "sessions_per_month": package["sessions_per_month"],
        "sessions_used": 0,
        "sports": package.get("sports", []),
        "price": package["price"],
        "commission_amount": commission_amount,
        "current_period_start": now.isoformat(),
        "current_period_end": period_end,
        "created_at": now.isoformat(),
    }

    rzp_client = await get_razorpay_client()
    if rzp_client:
        sub["status"] = "payment_pending"
        try:
            rzp_order = rzp_client.order.create({
                "amount": package["price"] * 100,
                "currency": "INR",
                "payment_capture": 1,
                "notes": {"subscription_id": sub["id"], "type": "coaching_package"}
            })
            sub["razorpay_order_id"] = rzp_order["id"]
            sub["payment_gateway"] = "razorpay"
        except Exception:
            raise HTTPException(502, "Payment gateway error. Please try again.")
    else:
        if os.environ.get("ENVIRONMENT") == "production":
            raise HTTPException(502, "Payment gateway not available. Please try again later.")
        sub["status"] = "payment_pending"
        sub["payment_gateway"] = "test"

    await db.coaching_subscriptions.insert_one(sub)
    sub.pop("_id", None)

    gw = platform.get("payment_gateway", {})
    sub["razorpay_key_id"] = gw.get("key_id", "")
    return sub


@router.post("/subscriptions/{sub_id}/verify-payment")
async def verify_subscription_payment(sub_id: str, request: Request, user=Depends(get_current_user)):
    """Verify Razorpay payment for a coaching subscription."""
    data = await request.json()
    razorpay_payment_id = data.get("razorpay_payment_id", "")
    razorpay_order_id = data.get("razorpay_order_id", "")
    razorpay_signature = data.get("razorpay_signature", "")

    sub = await db.coaching_subscriptions.find_one({"id": sub_id})
    if not sub:
        raise HTTPException(404, "Subscription not found")
    if sub["player_id"] != user["id"]:
        raise HTTPException(403, "Not authorized")
    if sub.get("status") != "payment_pending":
        raise HTTPException(400, f"Subscription is already {sub.get('status')}")

    settings = await get_platform_settings()
    gw = settings.get("payment_gateway", {})
    key_secret = gw.get("key_secret", "")

    if not key_secret:
        raise HTTPException(500, "Payment gateway not configured. Contact support.")
    msg = f"{razorpay_order_id}|{razorpay_payment_id}"
    expected = hmac.new(key_secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, razorpay_signature):
        raise HTTPException(400, "Payment verification failed")

    await db.coaching_subscriptions.update_one({"id": sub_id}, {"$set": {
        "status": "active",
        "payment_details": {
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_order_id": razorpay_order_id,
            "paid_at": now_ist().isoformat()
        }
    }})

    # Notify coach
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": sub["coach_id"],
        "type": "new_package_subscriber",
        "title": "New Package Subscriber!",
        "message": f'{user.get("name", "A player")} subscribed to your "{sub["package_name"]}" package.',
        "is_read": False,
        "created_at": now_ist().isoformat(),
    })

    # Auto-generate invoice
    updated_sub = await db.coaching_subscriptions.find_one({"id": sub_id}, {"_id": 0})
    if updated_sub:
        asyncio.create_task(generate_coaching_invoice(updated_sub, "coaching_subscription", {
            "razorpay_payment_id": razorpay_payment_id, "razorpay_order_id": razorpay_order_id, "paid_at": now_ist().isoformat()
        }))
    return {"message": "Payment verified, subscription active", "status": "active"}


@router.post("/subscriptions/{sub_id}/test-confirm")
async def test_confirm_subscription(sub_id: str, user=Depends(get_current_user)):
    """Confirm payment for test-mode subscriptions."""
    if os.environ.get("ENVIRONMENT") == "production":
        raise HTTPException(403, "Test payment endpoints are disabled in production")
    sub = await db.coaching_subscriptions.find_one({"id": sub_id})
    if not sub:
        raise HTTPException(404, "Subscription not found")
    if sub.get("payment_gateway") not in ("test", "mock"):
        raise HTTPException(400, "This endpoint is only for test-mode subscriptions")
    if sub.get("status") != "payment_pending":
        raise HTTPException(400, f"Subscription is already {sub.get('status')}")
    if sub["player_id"] != user["id"] and user["role"] != "super_admin":
        raise HTTPException(403, "Not authorized")

    await db.coaching_subscriptions.update_one({"id": sub_id}, {"$set": {
        "status": "active",
        "payment_details": {
            "method": "test",
            "test_payment_id": f"test_{uuid.uuid4().hex[:12]}",
            "paid_at": now_ist().isoformat()
        }
    }})
    # Auto-generate invoice
    updated_sub = await db.coaching_subscriptions.find_one({"id": sub_id}, {"_id": 0})
    if updated_sub:
        asyncio.create_task(generate_coaching_invoice(updated_sub, "coaching_subscription", updated_sub.get("payment_details", {})))
    return {"message": "Test payment confirmed, subscription active", "status": "active"}


@router.get("/my-subscriptions")
async def my_subscriptions(user=Depends(get_current_user)):
    """Get player's active coaching subscriptions."""
    subs = await db.coaching_subscriptions.find(
        {"player_id": user["id"], "status": {"$in": ["active", "payment_pending"]}}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)

    for s in subs:
        s["sessions_remaining"] = s["sessions_per_month"] - s.get("sessions_used", 0)
    return subs


@router.post("/subscriptions/{sub_id}/cancel")
async def cancel_subscription(sub_id: str, user=Depends(get_current_user)):
    """Cancel a coaching subscription. Remaining sessions usable until period ends."""
    sub = await db.coaching_subscriptions.find_one({"id": sub_id})
    if not sub:
        raise HTTPException(404, "Subscription not found")
    if sub["player_id"] != user["id"] and user["role"] != "super_admin":
        raise HTTPException(403, "Not authorized")
    if sub["status"] not in ("active", "payment_pending"):
        raise HTTPException(400, f"Subscription is already {sub['status']}")

    await db.coaching_subscriptions.update_one({"id": sub_id}, {"$set": {
        "status": "cancelled",
        "cancelled_at": now_ist().isoformat()
    }})

    # Notify coach
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": sub["coach_id"],
        "type": "package_subscription_cancelled",
        "title": "Subscription Cancelled",
        "message": f'{sub.get("player_name", "A player")} cancelled their "{sub["package_name"]}" subscription.',
        "is_read": False,
        "created_at": now_ist().isoformat(),
    })

    return {"message": "Subscription cancelled. Remaining sessions are usable until the period ends."}


@router.post("/subscriptions/{sub_id}/renew")
async def renew_subscription(sub_id: str, user=Depends(get_current_user)):
    """Renew a coaching subscription for the next month."""
    sub = await db.coaching_subscriptions.find_one({"id": sub_id})
    if not sub:
        raise HTTPException(404, "Subscription not found")
    if sub["player_id"] != user["id"]:
        raise HTTPException(403, "Not authorized")
    if sub["status"] not in ("active", "expired"):
        raise HTTPException(400, "Cannot renew a cancelled subscription")

    # Get current package price (may have changed)
    package = await db.coaching_packages.find_one({"id": sub["package_id"]})
    price = package["price"] if package else sub["price"]

    platform = await get_platform_settings()
    commission_amount = int(price * platform.get("coaching_commission_pct", 10) / 100)

    rzp_client = await get_razorpay_client()
    result = {"subscription_id": sub_id, "price": price}

    if rzp_client:
        try:
            rzp_order = rzp_client.order.create({
                "amount": price * 100,
                "currency": "INR",
                "payment_capture": 1,
                "notes": {"subscription_id": sub_id, "type": "coaching_package_renewal"}
            })
            result["razorpay_order_id"] = rzp_order["id"]
            gw = platform.get("payment_gateway", {})
            result["razorpay_key_id"] = gw.get("key_id", "")
            result["payment_gateway"] = "razorpay"
            await db.coaching_subscriptions.update_one({"id": sub_id}, {"$set": {
                "razorpay_order_id": rzp_order["id"],
                "price": price,
                "commission_amount": commission_amount,
            }})
        except Exception:
            raise HTTPException(502, "Payment gateway error. Please try again.")
    else:
        # Test mode — auto-renew
        now = now_ist()
        await db.coaching_subscriptions.update_one({"id": sub_id}, {"$set": {
            "status": "active",
            "sessions_used": 0,
            "price": price,
            "commission_amount": commission_amount,
            "current_period_start": now.isoformat(),
            "current_period_end": (now + timedelta(days=30)).isoformat(),
            "renewed_at": now.isoformat(),
            "payment_gateway": "test",
            "payment_details": {
                "method": "test",
                "test_payment_id": f"test_{uuid.uuid4().hex[:12]}",
                "paid_at": now.isoformat()
            }
        }})
        result["payment_gateway"] = "test"
        result["message"] = "Subscription renewed (test mode)"

    return result


@router.post("/subscriptions/{sub_id}/verify-renewal")
async def verify_renewal_payment(sub_id: str, request: Request, user=Depends(get_current_user)):
    """Verify Razorpay payment for subscription renewal."""
    data = await request.json()
    razorpay_payment_id = data.get("razorpay_payment_id", "")
    razorpay_order_id = data.get("razorpay_order_id", "")
    razorpay_signature = data.get("razorpay_signature", "")

    sub = await db.coaching_subscriptions.find_one({"id": sub_id})
    if not sub:
        raise HTTPException(404, "Subscription not found")
    if sub["player_id"] != user["id"]:
        raise HTTPException(403, "Not authorized")

    settings = await get_platform_settings()
    gw = settings.get("payment_gateway", {})
    key_secret = gw.get("key_secret", "")

    if not key_secret:
        raise HTTPException(500, "Payment gateway not configured. Contact support.")
    msg = f"{razorpay_order_id}|{razorpay_payment_id}"
    expected = hmac.new(key_secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, razorpay_signature):
        raise HTTPException(400, "Payment verification failed")

    now = now_ist()
    await db.coaching_subscriptions.update_one({"id": sub_id}, {"$set": {
        "status": "active",
        "sessions_used": 0,
        "current_period_start": now.isoformat(),
        "current_period_end": (now + timedelta(days=30)).isoformat(),
        "renewed_at": now.isoformat(),
        "payment_details": {
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_order_id": razorpay_order_id,
            "paid_at": now.isoformat()
        }
    }})

    # Auto-generate invoice
    renewed_sub = await db.coaching_subscriptions.find_one({"id": sub_id}, {"_id": 0})
    if renewed_sub:
        asyncio.create_task(generate_coaching_invoice(renewed_sub, "coaching_renewal", {
            "razorpay_payment_id": razorpay_payment_id, "razorpay_order_id": razorpay_order_id, "paid_at": now_ist().isoformat()
        }))
    return {"message": "Renewal payment verified, subscription renewed", "status": "active"}


# ─── SaaS Plans & Onboarding ──────────────────────────────────────────────────

@router.get("/my-plan")
async def get_my_plan(user=Depends(get_current_user)):
    """Current coach plan + usage stats + limits."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can view plan info")

    plan_id = user.get("coach_plan", "free")

    # Get plan details from platform settings
    settings = await get_platform_settings()
    plans = settings.get("coach_subscription_plans", [
        {"id": "free", "name": "Free", "price": 0, "max_clients": 10, "max_packages": 2,
         "max_sessions_per_month": 30, "commission_pct": 15, "offline_management": False, "analytics": False},
        {"id": "pro", "name": "Pro", "price": 999, "max_clients": 50, "max_packages": 10,
         "max_sessions_per_month": 200, "commission_pct": 10, "offline_management": True, "analytics": True},
        {"id": "elite", "name": "Elite", "price": 2499, "max_clients": -1, "max_packages": -1,
         "max_sessions_per_month": -1, "commission_pct": 5, "offline_management": True, "analytics": True},
    ])
    current_plan = next((p for p in plans if p["id"] == plan_id), plans[0])

    # Usage counts
    client_count = await db.coach_clients.count_documents({"coach_id": user["id"], "status": "active"})
    package_count = await db.coaching_packages.count_documents({"coach_id": user["id"], "status": "active"})

    # Sessions this month
    now = now_ist()
    month_prefix = now.strftime("%Y-%m")
    online_sessions = await db.coaching_sessions.count_documents(
        {"coach_id": user["id"], "date": {"$regex": f"^{month_prefix}"}}
    )
    offline_sessions = await db.coach_offline_sessions.count_documents(
        {"coach_id": user["id"], "date": {"$regex": f"^{month_prefix}"}}
    )

    return {
        "plan": current_plan,
        "all_plans": plans,
        "usage": {
            "clients": client_count,
            "packages": package_count,
            "sessions_this_month": online_sessions + offline_sessions,
        },
    }


@router.get("/onboarding-status")
async def get_onboarding_status(user=Depends(get_current_user)):
    """Get coach onboarding steps."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can view onboarding")
    steps = user.get("onboarding_steps", {
        "profile_completed": False,
        "availability_set": False,
        "first_package_created": False,
        "documents_uploaded": False,
    })
    return {
        "status": user.get("onboarding_status", "incomplete"),
        "steps": steps,
    }


@router.put("/onboarding-status")
async def update_onboarding_status(request: Request, user=Depends(get_current_user)):
    """Mark onboarding steps complete."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can update onboarding")
    data = await request.json()
    steps = user.get("onboarding_steps", {})
    allowed = ["profile_completed", "availability_set", "first_package_created", "documents_uploaded"]
    for key in allowed:
        if key in data:
            steps[key] = bool(data[key])
    # Auto-complete onboarding if all steps done
    onboarding_status = "complete" if all(steps.get(k, False) for k in allowed) else "incomplete"
    await db.users.update_one({"id": user["id"]}, {"$set": {
        "onboarding_steps": steps,
        "onboarding_status": onboarding_status,
    }})
    return {"status": onboarding_status, "steps": steps}
