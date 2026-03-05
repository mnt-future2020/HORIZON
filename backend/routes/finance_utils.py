"""Shared finance helpers — used by both payouts.py and bookings.py."""
from database import db
from tz import now_ist
import uuid
import logging

logger = logging.getLogger(__name__)


async def log_webhook(log_id, source, event_type, payload):
    """Log webhook to webhook_logs collection (fire-and-forget)."""
    try:
        await db.webhook_logs.insert_one({
            "id": log_id,
            "source": source,
            "event_type": event_type,
            "payload": payload,
            "received_at": now_ist().isoformat(),
            "processed_status": "pending",
            "error_message": "",
        })
    except Exception as e:
        logger.warning(f"Failed to log webhook: {e}")


async def update_webhook_log(log_id, status, error=""):
    try:
        await db.webhook_logs.update_one(
            {"id": log_id}, {"$set": {"processed_status": status, "error_message": error}}
        )
    except Exception:
        pass


async def log_finance_event(event_type, actor_id, owner_id, booking_id=None, settlement_id=None, amount=0, metadata=None):
    """Log to finance_events collection (fire-and-forget)."""
    try:
        await db.finance_events.insert_one({
            "id": str(uuid.uuid4()),
            "event_type": event_type,
            "actor_id": actor_id,
            "owner_id": owner_id,
            "booking_id": booking_id,
            "settlement_id": settlement_id,
            "amount": amount,
            "metadata": metadata or {},
            "created_at": now_ist().isoformat(),
        })
    except Exception as e:
        logger.warning(f"Failed to log finance event: {e}")
