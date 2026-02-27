"""
DPDP (Digital Personal Data Protection) Compliance Routes
Implements consent management, data export, and right-to-erasure.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone
from database import db
from tz import now_ist
from auth import get_current_user
import uuid
import logging
import json

router = APIRouter(prefix="/compliance", tags=["compliance"])
logger = logging.getLogger("horizon")


# ─── Consent Management ──────────────────────────────────────────────────────

@router.get("/consent")
async def get_consent_status(user=Depends(get_current_user)):
    """Get current user's consent records."""
    consents = await db.consents.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("updated_at", -1).to_list(20)

    # Default consent categories
    categories = {
        "essential": {"required": True, "description": "Essential service functionality"},
        "analytics": {"required": False, "description": "Usage analytics and performance monitoring"},
        "marketing": {"required": False, "description": "Marketing communications and promotions"},
        "location": {"required": False, "description": "Location data for nearby venue discovery"},
        "notifications": {"required": False, "description": "Push notifications and alerts"},
    }

    consent_map = {c["category"]: c for c in consents}

    result = []
    for cat, info in categories.items():
        existing = consent_map.get(cat)
        result.append({
            "category": cat,
            "description": info["description"],
            "required": info["required"],
            "granted": existing["granted"] if existing else info["required"],
            "updated_at": existing["updated_at"] if existing else None
        })

    return {"consents": result}


@router.put("/consent")
async def update_consent(request: Request, user=Depends(get_current_user)):
    """Update consent for a specific category."""
    data = await request.json()
    category = data.get("category")
    granted = data.get("granted", False)

    if not category:
        raise HTTPException(400, "category is required")

    # Cannot revoke essential consent
    if category == "essential" and not granted:
        raise HTTPException(400, "Essential consent cannot be revoked")

    consent = await db.consents.find_one(
        {"user_id": user["id"], "category": category}
    )

    now = now_ist().isoformat()

    if consent:
        await db.consents.update_one(
            {"user_id": user["id"], "category": category},
            {"$set": {"granted": granted, "updated_at": now},
             "$push": {"history": {
                 "action": "granted" if granted else "revoked",
                 "timestamp": now,
                 "ip": data.get("ip", "")
             }}}
        )
    else:
        await db.consents.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "category": category,
            "granted": granted,
            "created_at": now,
            "updated_at": now,
            "history": [{
                "action": "granted" if granted else "revoked",
                "timestamp": now,
                "ip": data.get("ip", "")
            }]
        })

    # Log to audit trail
    await _audit_log(user["id"], "consent_update", {
        "category": category, "granted": granted
    })

    status = "granted" if granted else "revoked"
    return {"message": f"Consent {status} for {category}", "granted": granted}


# ─── Data Export (Right to Access) ────────────────────────────────────────────

@router.get("/data-export")
async def export_user_data(user=Depends(get_current_user)):
    """Export all personal data for the current user (DPDP right to access)."""
    user_id = user["id"]

    # Collect all user data across collections
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    bookings = await db.bookings.find(
        {"$or": [{"host_id": user_id}, {"players": user_id}]}, {"_id": 0}
    ).to_list(500)
    reviews = await db.reviews.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    notifications = await db.notifications.find({"user_id": user_id}, {"_id": 0}).to_list(200)
    consents = await db.consents.find({"user_id": user_id}, {"_id": 0}).to_list(20)
    waitlist = await db.waitlist.find({"user_id": user_id}, {"_id": 0}).to_list(50)
    split_payments = await db.split_payments.find(
        {"payer_id": user_id}, {"_id": 0}
    ).to_list(100)

    export = {
        "export_date": now_ist().isoformat(),
        "user_id": user_id,
        "personal_info": user_data,
        "bookings": bookings,
        "reviews": reviews,
        "notifications": notifications,
        "consent_records": consents,
        "waitlist_entries": waitlist,
        "split_payments": split_payments,
        "data_categories": [
            "Personal information (name, email, phone)",
            "Booking history",
            "Reviews and ratings",
            "Notification history",
            "Consent records",
            "Waitlist entries",
            "Payment records"
        ]
    }

    await _audit_log(user_id, "data_export", {"collections_exported": 7})

    return export


# ─── Right to Erasure (Right to be Forgotten) ────────────────────────────────

@router.post("/erasure-request")
async def request_data_erasure(request: Request, user=Depends(get_current_user)):
    """Request deletion/anonymization of personal data (DPDP right to erasure)."""
    data = await request.json()
    reason = data.get("reason", "User requested deletion")
    confirm = data.get("confirm", False)

    if not confirm:
        return {
            "message": "Please confirm data erasure by setting confirm=true",
            "warning": "This action is irreversible. All your personal data will be anonymized.",
            "affected_data": [
                "Personal info (name, email, phone) → anonymized",
                "Booking history → retained with anonymized identity",
                "Reviews → anonymized author",
                "Notifications → deleted",
                "Consent records → retained for compliance audit",
                "Account → deactivated"
            ]
        }

    user_id = user["id"]
    now = now_ist().isoformat()

    # Create erasure request record (retained for compliance)
    erasure = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "original_email": user.get("email", ""),
        "reason": reason,
        "status": "completed",
        "requested_at": now,
        "completed_at": now
    }
    await db.erasure_requests.insert_one(erasure)

    # Anonymize user profile
    anon_name = f"Deleted User {user_id[:8]}"
    anon_email = f"deleted_{user_id[:8]}@anonymized.local"
    await db.users.update_one({"id": user_id}, {"$set": {
        "name": anon_name,
        "email": anon_email,
        "phone": "",
        "avatar": "",
        "push_token": "",
        "password_hash": "DELETED",
        "account_status": "deleted",
        "anonymized_at": now
    }})

    # Anonymize reviews
    await db.reviews.update_many(
        {"user_id": user_id},
        {"$set": {"user_name": anon_name}}
    )

    # Anonymize bookings
    await db.bookings.update_many(
        {"host_id": user_id},
        {"$set": {"host_name": anon_name}}
    )

    # Anonymize split payments
    await db.split_payments.update_many(
        {"payer_id": user_id},
        {"$set": {"payer_name": anon_name}}
    )

    # Anonymize coaching sessions
    await db.coaching_sessions.update_many(
        {"player_id": user_id},
        {"$set": {"player_name": anon_name}}
    )
    await db.coaching_sessions.update_many(
        {"coach_id": user_id},
        {"$set": {"coach_name": anon_name}}
    )

    # Anonymize social posts
    await db.social_posts.update_many(
        {"user_id": user_id},
        {"$set": {"user_name": anon_name, "content": "[deleted]"}}
    )

    # Anonymize rating history (keep hashes for chain integrity)
    await db.rating_history.update_many(
        {"user_id": user_id},
        {"$set": {"anonymized": True}}
    )

    # Delete notifications
    await db.notifications.delete_many({"user_id": user_id})

    # Cancel active waitlist entries
    await db.waitlist.update_many(
        {"user_id": user_id, "status": "waiting"},
        {"$set": {"status": "cancelled", "user_name": anon_name}}
    )

    # Cancel notification subscriptions
    await db.notification_subscriptions.delete_many({"user_id": user_id})

    # Anonymize tournament registrations
    await db.tournaments.update_many(
        {"participants.user_id": user_id},
        {"$set": {"participants.$[elem].name": anon_name}},
        array_filters=[{"elem.user_id": user_id}]
    )

    await _audit_log(user_id, "data_erasure", {"reason": reason, "status": "completed"})

    logger.info(f"Data erasure completed for user {user_id}")
    return {
        "message": "Your data has been anonymized. Account has been deactivated.",
        "erasure_id": erasure["id"]
    }


# ─── Audit Trail ─────────────────────────────────────────────────────────────

@router.get("/audit-log")
async def get_audit_log(user=Depends(get_current_user), limit: int = 50):
    """Get audit log for current user's data access events."""
    logs = await db.audit_log.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("timestamp", -1).to_list(limit)
    return logs


async def _audit_log(user_id: str, action: str, details: dict = None):
    """Record an audit trail entry."""
    entry = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "action": action,
        "details": details or {},
        "timestamp": now_ist().isoformat()
    }
    await db.audit_log.insert_one(entry)


# ─── Privacy Settings ────────────────────────────────────────────────────────

@router.get("/notification-preferences")
async def get_notification_preferences(user=Depends(get_current_user)):
    """Get notification channel preferences."""
    prefs = user.get("notification_preferences", {
        "email": True,
        "sms": True,
        "push": True,
        "in_app": True
    })
    return prefs


@router.put("/notification-preferences")
async def update_notification_preferences(request: Request, user=Depends(get_current_user)):
    """Update notification channel preferences."""
    data = await request.json()
    allowed = {"email", "sms", "push", "in_app"}
    prefs = {k: bool(v) for k, v in data.items() if k in allowed}

    # in_app is always true
    prefs["in_app"] = True

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"notification_preferences": prefs}}
    )

    await _audit_log(user["id"], "preferences_update", {"notification_preferences": prefs})
    return {"message": "Preferences updated", "preferences": prefs}
