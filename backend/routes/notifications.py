from fastapi import APIRouter, Depends, Request, HTTPException
from typing import Optional
from database import db
from auth import get_current_user
from models import NotifySubscribeInput
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger("horizon")
router = APIRouter(tags=["notifications"])


async def _notify_slot_available(venue_id: str, date: str, start_time: str, turf_number: int):
    subs = await db.notification_subscriptions.find({
        "venue_id": venue_id, "date": date,
        "start_time": start_time, "turf_number": turf_number,
        "status": "active"
    }, {"_id": 0}).to_list(100)
    if not subs:
        return
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "name": 1})
    venue_name = venue["name"] if venue else "Unknown Venue"
    notifications = []
    for sub in subs:
        notifications.append({
            "id": str(uuid.uuid4()), "user_id": sub["user_id"],
            "type": "slot_available", "title": "Slot Now Available!",
            "message": f"{venue_name} - {start_time} on {date} (Turf {turf_number}) is now free. Book it before someone else does!",
            "venue_id": venue_id, "date": date, "start_time": start_time,
            "turf_number": turf_number, "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    if notifications:
        await db.notifications.insert_many(notifications)
        sub_ids = [s["id"] for s in subs]
        await db.notification_subscriptions.update_many(
            {"id": {"$in": sub_ids}}, {"$set": {"status": "notified"}}
        )
    logger.info(f"Sent {len(notifications)} slot-available notifications for {venue_id}/{date}/{start_time}")


@router.post("/notifications/subscribe")
async def subscribe_notification(input: NotifySubscribeInput, user=Depends(get_current_user)):
    existing = await db.notification_subscriptions.find_one({
        "user_id": user["id"], "venue_id": input.venue_id,
        "date": input.date, "start_time": input.start_time,
        "turf_number": input.turf_number, "status": "active"
    })
    if existing:
        return {"message": "Already subscribed", "subscribed": True}
    sub = {
        "id": str(uuid.uuid4()), "user_id": user["id"],
        "venue_id": input.venue_id, "date": input.date,
        "start_time": input.start_time, "turf_number": input.turf_number,
        "status": "active", "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notification_subscriptions.insert_one(sub)
    sub.pop("_id", None)
    return {"message": "You'll be notified when this slot opens up!", "subscribed": True, "subscription": sub}


@router.delete("/notifications/subscribe")
async def unsubscribe_notification(input: NotifySubscribeInput, user=Depends(get_current_user)):
    result = await db.notification_subscriptions.delete_one({
        "user_id": user["id"], "venue_id": input.venue_id,
        "date": input.date, "start_time": input.start_time,
        "turf_number": input.turf_number, "status": "active"
    })
    return {"message": "Unsubscribed", "removed": result.deleted_count > 0}


@router.get("/notifications")
async def get_notifications(user=Depends(get_current_user)):
    notifs = await db.notifications.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return notifs


@router.get("/notifications/unread-count")
async def get_unread_count(user=Depends(get_current_user)):
    count = await db.notifications.count_documents({"user_id": user["id"], "is_read": False})
    return {"count": count}


@router.put("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, user=Depends(get_current_user)):
    await db.notifications.update_one({"id": notif_id, "user_id": user["id"]}, {"$set": {"is_read": True}})
    return {"message": "Marked as read"}


@router.put("/notifications/read-all")
async def mark_all_read(user=Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"], "is_read": False}, {"$set": {"is_read": True}})
    return {"message": "All marked as read"}


@router.get("/notifications/subscriptions")
async def get_my_subscriptions(user=Depends(get_current_user), venue_id: Optional[str] = None, date: Optional[str] = None):
    query = {"user_id": user["id"], "status": "active"}
    if venue_id:
        query["venue_id"] = venue_id
    if date:
        query["date"] = date
    subs = await db.notification_subscriptions.find(query, {"_id": 0}).to_list(100)
    return subs
