"""
Dunning Management Service
Handles failed subscription payment retries with exponential backoff.
"""
import logging
from datetime import datetime, timezone, timedelta
from database import db
from auth import get_razorpay_client
from tz import now_ist
import uuid

logger = logging.getLogger("horizon")

# Retry schedule: delays in hours after initial failure
RETRY_SCHEDULE = [24, 72, 168]  # 1 day, 3 days, 7 days
MAX_RETRIES = len(RETRY_SCHEDULE)
GRACE_PERIOD_DAYS = 14  # Days before subscription suspension


async def handle_payment_failure(user_id: str, subscription_id: str, reason: str = ""):
    """Called when a subscription payment fails. Initiates dunning flow."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return

    # Create or update dunning record
    existing = await db.dunning.find_one({
        "user_id": user_id,
        "subscription_id": subscription_id,
        "status": {"$in": ["active", "retrying"]}
    })

    if existing:
        # Already in dunning, increment retry count
        return await _schedule_next_retry(existing)

    dunning = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "subscription_id": subscription_id,
        "plan": user.get("subscription_plan", "free"),
        "failure_reason": reason,
        "retry_count": 0,
        "max_retries": MAX_RETRIES,
        "status": "active",  # active, retrying, recovered, suspended, cancelled
        "next_retry_at": (now_ist() + timedelta(hours=RETRY_SCHEDULE[0])).isoformat(),
        "grace_period_ends": (now_ist() + timedelta(days=GRACE_PERIOD_DAYS)).isoformat(),
        "created_at": now_ist().isoformat(),
        "history": [{
            "event": "payment_failed",
            "reason": reason,
            "timestamp": now_ist().isoformat()
        }]
    }
    await db.dunning.insert_one(dunning)
    dunning.pop("_id", None)

    # Send notification about failed payment
    try:
        from services.notification_service import send_notification
        await send_notification(
            user_id=user_id,
            title="Payment Failed",
            message=(
                f"Your subscription payment failed. We'll retry automatically. "
                f"Please update your payment method to avoid service interruption. "
                f"Grace period ends in {GRACE_PERIOD_DAYS} days."
            ),
            channels=["in_app", "email", "sms"],
            notification_type="payment_failed",
            data={"dunning_id": dunning["id"]}
        )
    except Exception as e:
        logger.error(f"Failed to send dunning notification: {e}")

    logger.info(f"Dunning initiated for user {user_id}, subscription {subscription_id}")
    return dunning


async def _schedule_next_retry(dunning: dict):
    """Schedule the next retry based on retry count."""
    retry_count = dunning.get("retry_count", 0)

    if retry_count >= MAX_RETRIES:
        # Max retries exceeded — suspend
        await _suspend_subscription(dunning)
        return dunning

    next_delay = RETRY_SCHEDULE[min(retry_count, len(RETRY_SCHEDULE) - 1)]
    next_retry = (now_ist() + timedelta(hours=next_delay)).isoformat()

    await db.dunning.update_one(
        {"id": dunning["id"]},
        {
            "$set": {"next_retry_at": next_retry, "status": "retrying"},
            "$inc": {"retry_count": 1},
            "$push": {"history": {
                "event": "retry_scheduled",
                "retry_number": retry_count + 1,
                "next_retry_at": next_retry,
                "timestamp": now_ist().isoformat()
            }}
        }
    )
    return dunning


async def process_due_retries():
    """Process all dunning entries that are due for retry. Called by scheduler."""
    now = now_ist().isoformat()

    due_entries = await db.dunning.find({
        "status": {"$in": ["active", "retrying"]},
        "next_retry_at": {"$lte": now}
    }).to_list(100)

    results = {"retried": 0, "recovered": 0, "suspended": 0}

    for entry in due_entries:
        success = await _attempt_payment_retry(entry)
        if success:
            await _mark_recovered(entry)
            results["recovered"] += 1
        else:
            if entry.get("retry_count", 0) >= MAX_RETRIES:
                await _suspend_subscription(entry)
                results["suspended"] += 1
            else:
                await _schedule_next_retry(entry)
        results["retried"] += 1

    if results["retried"] > 0:
        logger.info(f"Dunning processed: {results}")
    return results


async def _attempt_payment_retry(dunning: dict) -> bool:
    """Attempt to retry the payment. Returns True if successful."""
    rzp_client = await get_razorpay_client()
    if not rzp_client:
        logger.warning("No payment gateway configured for retry")
        return False

    user = await db.users.find_one({"id": dunning["user_id"]})
    if not user:
        return False

    try:
        # Create a new payment order for the subscription amount
        from auth import get_platform_settings
        platform = await get_platform_settings()
        plans = platform.get("subscription_plans", [])
        plan = next((p for p in plans if p["id"] == dunning.get("plan", "free")), None)

        if not plan or plan.get("price", 0) == 0:
            # Free plan or plan not found — auto-recover
            return True

        # Razorpay one-time payments can't auto-charge stored cards.
        # Create a new order and notify user to complete payment manually.
        order = rzp_client.order.create({
            "amount": int(plan["price"]) * 100,
            "currency": "INR",
            "payment_capture": 1,
            "notes": {
                "type": "subscription_retry",
                "user_id": dunning["user_id"],
                "dunning_id": dunning["id"]
            }
        })

        # Notify user about retry attempt
        try:
            from services.notification_service import send_notification
            retry_num = dunning.get("retry_count", 0) + 1
            await send_notification(
                user_id=dunning["user_id"],
                title=f"Payment Retry #{retry_num}",
                message=(
                    f"We're retrying your {plan.get('name', 'subscription')} payment. "
                    f"If this fails, please update your payment method."
                ),
                channels=["in_app", "email"],
                notification_type="payment_retry"
            )
        except Exception:
            pass

        await db.dunning.update_one(
            {"id": dunning["id"]},
            {"$push": {"history": {
                "event": "retry_attempted",
                "order_id": order.get("id"),
                "timestamp": now_ist().isoformat()
            }}}
        )

        # Return False — user must complete payment via the new order link.
        # Order ID is logged in dunning history for tracking.
        return False

    except Exception as e:
        logger.error(f"Payment retry failed for dunning {dunning['id']}: {e}")
        return False


async def _mark_recovered(dunning: dict):
    """Mark dunning as recovered — payment succeeded."""
    await db.dunning.update_one(
        {"id": dunning["id"]},
        {"$set": {"status": "recovered"},
         "$push": {"history": {
             "event": "recovered",
             "timestamp": now_ist().isoformat()
         }}}
    )

    try:
        from services.notification_service import send_notification
        await send_notification(
            user_id=dunning["user_id"],
            title="Payment Recovered!",
            message="Your subscription payment has been successfully processed. Thank you!",
            channels=["in_app", "email"],
            notification_type="payment_recovered"
        )
    except Exception:
        pass

    logger.info(f"Dunning recovered for user {dunning['user_id']}")


async def _suspend_subscription(dunning: dict):
    """Suspend the user's subscription after max retries exceeded."""
    await db.dunning.update_one(
        {"id": dunning["id"]},
        {"$set": {"status": "suspended"},
         "$push": {"history": {
             "event": "subscription_suspended",
             "timestamp": now_ist().isoformat()
         }}}
    )

    # Downgrade user to free plan
    await db.users.update_one(
        {"id": dunning["user_id"]},
        {"$set": {"subscription_plan": "free", "subscription_status": "suspended"}}
    )

    try:
        from services.notification_service import send_notification
        await send_notification(
            user_id=dunning["user_id"],
            title="Subscription Suspended",
            message=(
                "Your subscription has been suspended due to repeated payment failures. "
                "Please update your payment method and resubscribe to restore access."
            ),
            channels=["in_app", "email", "sms"],
            notification_type="subscription_suspended"
        )
    except Exception:
        pass

    logger.info(f"Subscription suspended for user {dunning['user_id']}")


async def get_dunning_status(user_id: str):
    """Get current dunning status for a user."""
    entry = await db.dunning.find_one(
        {"user_id": user_id, "status": {"$in": ["active", "retrying"]}},
        {"_id": 0}
    )
    return entry


async def resolve_dunning(user_id: str):
    """Manually resolve dunning when user makes a successful payment."""
    result = await db.dunning.update_many(
        {"user_id": user_id, "status": {"$in": ["active", "retrying"]}},
        {"$set": {"status": "recovered"},
         "$push": {"history": {
             "event": "manually_resolved",
             "timestamp": now_ist().isoformat()
         }}}
    )
    return result.modified_count
