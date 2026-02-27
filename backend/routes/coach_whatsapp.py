"""
Coach WhatsApp Automation Settings
- Coaches toggle on/off each automation type
- Configure timing (hours_before, days_before)
- View recent message logs
- send_wa_with_log() used by all scheduler jobs and hooks
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone
from database import db
from auth import get_current_user
from whatsapp_service import send_message
import uuid
import logging

logger = logging.getLogger("horizon.whatsapp")

router = APIRouter(prefix="/coaching/whatsapp", tags=["coaching-whatsapp"])

DEFAULT_SETTINGS = {
    "welcome":              {"enabled": True},
    "booking_confirmation": {"enabled": True},
    "session_reminder":     {"enabled": True,  "hours_before": 24},
    "package_expiry":       {"enabled": True,  "days_before": 3},
    "payment_reminder":     {"enabled": True},
    "no_show_followup":     {"enabled": True},
    "monthly_progress":     {"enabled": False},
}


async def get_coach_wa_settings(coach_id: str) -> dict:
    """Load WA settings for a coach, filling in defaults for any missing keys."""
    doc = await db.coach_wa_settings.find_one({"coach_id": coach_id}, {"_id": 0})
    result = {}
    for k, defaults in DEFAULT_SETTINGS.items():
        saved = (doc or {}).get(k, {})
        result[k] = {**defaults, **saved}
    return result


async def send_wa_with_log(
    wa_config: dict,
    phone: str,
    message: str,
    coach_id: str,
    client_id: str,
    client_name: str,
    automation_type: str,
    reference_id: str = "",
) -> dict:
    """Send a WhatsApp message and write a log entry to whatsapp_logs."""
    result = await send_message(wa_config, phone, message)
    log = {
        "id": str(uuid.uuid4()),
        "coach_id": coach_id,
        "client_id": client_id,
        "client_name": client_name,
        "phone": phone,
        "automation_type": automation_type,
        "reference_id": reference_id,
        "status": "sent" if result.get("ok") else "failed",
        "error": result.get("detail", "") if not result.get("ok") else "",
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.whatsapp_logs.insert_one(log)
    return result


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/settings")
async def get_wa_settings_endpoint(user=Depends(get_current_user)):
    """Get this coach's WhatsApp automation settings."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches")
    return await get_coach_wa_settings(user["id"])


@router.put("/settings")
async def update_wa_settings(request: Request, user=Depends(get_current_user)):
    """Update WhatsApp automation settings (partial update supported)."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches")
    data = await request.json()
    allowed = set(DEFAULT_SETTINGS.keys())
    updates = {k: v for k, v in data.items() if k in allowed}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.coach_wa_settings.update_one(
        {"coach_id": user["id"]},
        {"$set": {**updates, "coach_id": user["id"]}},
        upsert=True,
    )
    return await get_coach_wa_settings(user["id"])


@router.get("/logs")
async def get_wa_logs(user=Depends(get_current_user)):
    """Get last 50 WhatsApp messages sent by this coach's automations."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches")
    logs = []
    async for log in db.whatsapp_logs.find(
        {"coach_id": user["id"]}, {"_id": 0}
    ).sort("sent_at", -1).limit(50):
        logs.append(log)
    return logs
