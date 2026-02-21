from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from database import db
from auth import get_current_user
import uuid
import logging

router = APIRouter()
logger = logging.getLogger("horizon")


@router.post("/waitlist")
async def join_waitlist(request_data: dict, user=Depends(get_current_user)):
    """Join the waitlist for a fully-booked slot."""
    venue_id = request_data.get("venue_id")
    date = request_data.get("date")
    start_time = request_data.get("start_time")
    turf_number = request_data.get("turf_number", 1)

    if not all([venue_id, date, start_time]):
        raise HTTPException(400, "venue_id, date, and start_time are required")

    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "id": 1, "name": 1})
    if not venue:
        raise HTTPException(404, "Venue not found")

    # Check if slot is actually booked
    booking = await db.bookings.find_one({
        "venue_id": venue_id, "date": date,
        "start_time": start_time, "turf_number": turf_number,
        "status": {"$in": ["confirmed", "pending", "payment_pending"]}
    })
    if not booking:
        raise HTTPException(400, "Slot is available — you can book it directly")

    # Check if already on waitlist
    existing = await db.waitlist.find_one({
        "user_id": user["id"], "venue_id": venue_id,
        "date": date, "start_time": start_time,
        "turf_number": turf_number, "status": "waiting"
    })
    if existing:
        return {"message": "Already on waitlist", "position": existing.get("position", 1)}

    # Determine position (append to end)
    count = await db.waitlist.count_documents({
        "venue_id": venue_id, "date": date,
        "start_time": start_time, "turf_number": turf_number,
        "status": "waiting"
    })

    entry = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "user_email": user.get("email", ""),
        "user_phone": user.get("phone", ""),
        "venue_id": venue_id,
        "venue_name": venue["name"],
        "date": date,
        "start_time": start_time,
        "turf_number": turf_number,
        "position": count + 1,
        "status": "waiting",  # waiting, promoted, expired, cancelled
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.waitlist.insert_one(entry)
    entry.pop("_id", None)
    logger.info(f"Waitlist: {user['name']} joined for {venue_id}/{date}/{start_time} at position {count + 1}")
    return {"message": f"You're #{count + 1} on the waitlist!", "position": count + 1, "entry": entry}


@router.delete("/waitlist/{entry_id}")
async def leave_waitlist(entry_id: str, user=Depends(get_current_user)):
    """Leave the waitlist."""
    entry = await db.waitlist.find_one({"id": entry_id, "user_id": user["id"]})
    if not entry:
        raise HTTPException(404, "Waitlist entry not found")
    await db.waitlist.update_one({"id": entry_id}, {"$set": {"status": "cancelled"}})
    # Reorder positions for remaining entries
    await _reorder_positions(
        entry["venue_id"], entry["date"], entry["start_time"], entry["turf_number"]
    )
    return {"message": "Removed from waitlist"}


@router.get("/waitlist")
async def my_waitlist(user=Depends(get_current_user)):
    """Get current user's active waitlist entries."""
    entries = await db.waitlist.find(
        {"user_id": user["id"], "status": "waiting"}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return entries


@router.get("/waitlist/slot")
async def get_slot_waitlist(
    venue_id: str, date: str, start_time: str, turf_number: int = 1,
    user=Depends(get_current_user)
):
    """Get waitlist info for a specific slot."""
    entries = await db.waitlist.find(
        {"venue_id": venue_id, "date": date, "start_time": start_time,
         "turf_number": turf_number, "status": "waiting"},
        {"_id": 0}
    ).sort("position", 1).to_list(50)

    my_entry = next((e for e in entries if e["user_id"] == user["id"]), None)
    return {
        "total_waiting": len(entries),
        "my_position": my_entry["position"] if my_entry else None,
        "my_entry": my_entry,
        "is_waiting": my_entry is not None
    }


async def promote_next_in_waitlist(venue_id: str, date: str, start_time: str, turf_number: int):
    """Called when a booking is cancelled — promotes the first person on the waitlist."""
    next_entry = await db.waitlist.find_one(
        {"venue_id": venue_id, "date": date, "start_time": start_time,
         "turf_number": turf_number, "status": "waiting"},
        sort=[("position", 1)]
    )
    if not next_entry:
        return None

    # Mark as promoted
    await db.waitlist.update_one(
        {"id": next_entry["id"]},
        {"$set": {
            "status": "promoted",
            "promoted_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    # Send notification to promoted user
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": next_entry["user_id"],
        "type": "waitlist_promoted",
        "title": "You've Been Promoted!",
        "message": (
            f"Great news! A slot opened up at {next_entry['venue_name']} — "
            f"{start_time} on {date} (Turf {turf_number}). "
            f"Book it now before someone else does!"
        ),
        "venue_id": venue_id,
        "date": date,
        "start_time": start_time,
        "turf_number": turf_number,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)

    # Also send via multi-channel if available
    try:
        from services.notification_service import send_notification
        await send_notification(
            user_id=next_entry["user_id"],
            title="You've Been Promoted from Waitlist!",
            message=notification["message"],
            channels=["email", "sms", "push"],
            data={"type": "waitlist_promoted", "venue_id": venue_id, "date": date}
        )
    except Exception as e:
        logger.warning(f"Multi-channel notification failed for waitlist promotion: {e}")

    # Reorder remaining positions
    await _reorder_positions(venue_id, date, start_time, turf_number)

    logger.info(f"Waitlist: Promoted {next_entry['user_name']} for {venue_id}/{date}/{start_time}")
    return next_entry


async def _reorder_positions(venue_id: str, date: str, start_time: str, turf_number: int):
    """Reorder waitlist positions after a removal or promotion."""
    entries = await db.waitlist.find(
        {"venue_id": venue_id, "date": date, "start_time": start_time,
         "turf_number": turf_number, "status": "waiting"},
    ).sort("position", 1).to_list(100)

    for idx, entry in enumerate(entries):
        new_pos = idx + 1
        if entry.get("position") != new_pos:
            await db.waitlist.update_one(
                {"id": entry["id"]}, {"$set": {"position": new_pos}}
            )
