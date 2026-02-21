"""
Coach Session Booking System
1-on-1 coaching sessions with availability management, booking, and payment.
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import Optional
from datetime import datetime, timezone, timedelta
from database import db
from auth import get_current_user
import uuid

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
               "session_duration_minutes", "city", "coaching_venue"]
    updates = {k: v for k, v in data.items() if k in allowed}

    if "session_price" in updates:
        updates["session_price"] = int(updates["session_price"])
    if "session_duration_minutes" in updates:
        updates["session_duration_minutes"] = int(updates["session_duration_minutes"])

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
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
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
            "available": av["start_time"] not in booked_times,
        })

    return {"date": date, "day_of_week": day_of_week, "slots": slots}


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
        "sport": data.get("sport", coach.get("coaching_sports", ["general"])[0] if coach.get("coaching_sports") else "general"),
        "location": data.get("location", coach.get("coaching_venue", "")),
        "notes": data.get("notes", ""),
        "status": "confirmed",  # Auto-confirm for now
        "rating": None,
        "review": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.coaching_sessions.insert_one(session)
    session.pop("_id", None)

    # Notify coach
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": coach_id,
        "type": "coaching_session_booked",
        "title": "New Session Booked!",
        "message": f'{user.get("name", "A player")} booked a {session["sport"]} session on {date} at {start_time}.',
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

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
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
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
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()}}
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
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"message": "Session cancelled"}


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

    await db.coaching_sessions.update_one(
        {"id": session_id},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
    )
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
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
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
        "date": {"$gte": datetime.now(timezone.utc).strftime("%Y-%m-%d")}
    })
    cancelled = await db.coaching_sessions.count_documents({"coach_id": user["id"], "status": "cancelled"})

    # Revenue from completed sessions
    completed_sessions = await db.coaching_sessions.find(
        {"coach_id": user["id"], "status": "completed"},
        {"_id": 0, "price": 1}
    ).to_list(1000)
    total_revenue = sum(s.get("price", 0) for s in completed_sessions)

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

    return {
        "total_sessions": total,
        "completed": completed,
        "upcoming": upcoming_count,
        "cancelled": cancelled,
        "total_revenue": total_revenue,
        "avg_rating": avg_rating,
        "review_count": review_count,
        "recent_sessions": recent,
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

    expires_at = datetime.now(timezone.utc) + timedelta(hours=2)

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

    now = datetime.now(timezone.utc).isoformat()
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
