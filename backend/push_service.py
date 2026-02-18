"""
Push Notification Service — uses Expo Push API + optional FCM direct.
Device tokens are stored per user in MongoDB (push_token field).
Firebase credentials are stored in the settings collection (configurable by Super Admin).
"""
import logging
import httpx
from database import db

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def _get_firebase_config():
    """Read Firebase config from admin settings (dynamic)."""
    settings = await db.settings.find_one({"_id": "default_settings"}, {"_id": 0})
    return settings.get("firebase", {}) if settings else {}


async def send_push_to_user(user_id: str, title: str, body: str, data: dict = None):
    """Send a push notification to a user via their stored push_token."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "push_token": 1})
    if not user or not user.get("push_token"):
        return  # User has no push token registered
    push_token = user["push_token"]
    await _send_expo_push(push_token, title, body, data or {})


async def _send_expo_push(token: str, title: str, body: str, data: dict):
    """Send via Expo Push Notifications API."""
    payload = {
        "to": token,
        "title": title,
        "body": body,
        "data": data,
        "sound": "default",
        "priority": "high",
        "channelId": "default",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                EXPO_PUSH_URL,
                json=payload,
                headers={"Accept": "application/json", "Content-Type": "application/json"},
            )
            result = resp.json()
            if result.get("data", {}).get("status") == "error":
                logger.warning(f"Expo push error for {token}: {result}")
            else:
                logger.info(f"Push sent to {token[:20]}... title='{title}'")
    except Exception as e:
        logger.error(f"Push notification failed: {e}")


# --- Convenience helpers called from booking/POS routes ---

async def notify_booking_confirmed(user_id: str, venue_name: str, date: str, time: str):
    await send_push_to_user(
        user_id,
        title="✅ Booking Confirmed!",
        body=f"{venue_name} · {date} at {time}",
        data={"screen": "bookings"},
    )


async def notify_booking_cancelled(user_id: str, venue_name: str, date: str):
    await send_push_to_user(
        user_id,
        title="❌ Booking Cancelled",
        body=f"Your booking at {venue_name} on {date} was cancelled.",
        data={"screen": "bookings"},
    )


async def notify_match_found(user_id: str, sport: str, venue_name: str):
    await send_push_to_user(
        user_id,
        title="⚡ Match Found!",
        body=f"A {sport} game is available at {venue_name}. Join now!",
        data={"screen": "notifications"},
    )
