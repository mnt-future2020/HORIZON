"""
Enhanced Subscription Routes with Dunning Management
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone
from database import db
from auth import get_current_user, get_platform_settings
from services.dunning_service import (
    handle_payment_failure, process_due_retries,
    get_dunning_status, resolve_dunning
)
import logging

router = APIRouter(prefix="/subscription", tags=["subscription"])
logger = logging.getLogger("horizon")


@router.get("/my-plan")
async def get_my_plan(user=Depends(get_current_user)):
    """Get current user's subscription plan details."""
    platform = await get_platform_settings()
    plans = platform.get("subscription_plans", [])
    user_plan = user.get("subscription_plan", "free")

    plan_config = next((p for p in plans if p["id"] == user_plan), None)
    dunning = await get_dunning_status(user["id"])

    return {
        "plan_id": user_plan,
        "plan": plan_config,
        "subscription_status": user.get("subscription_status", "active"),
        "has_payment_issue": dunning is not None,
        "dunning_info": {
            "status": dunning["status"],
            "retry_count": dunning.get("retry_count", 0),
            "max_retries": dunning.get("max_retries", 3),
            "grace_period_ends": dunning.get("grace_period_ends"),
            "next_retry_at": dunning.get("next_retry_at"),
        } if dunning else None
    }


@router.put("/upgrade")
async def upgrade_plan(request: Request, user=Depends(get_current_user)):
    """Upgrade subscription plan."""
    data = await request.json()
    new_plan_id = data.get("plan_id")

    if not new_plan_id:
        raise HTTPException(400, "plan_id is required")

    platform = await get_platform_settings()
    plans = platform.get("subscription_plans", [])
    plan = next((p for p in plans if p["id"] == new_plan_id), None)

    if not plan:
        raise HTTPException(404, "Plan not found")

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "subscription_plan": new_plan_id,
            "subscription_status": "active",
            "plan_updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    # Resolve any active dunning
    await resolve_dunning(user["id"])

    return {"message": f"Upgraded to {plan.get('name', new_plan_id)}", "plan": plan}


@router.post("/payment-failed")
async def report_payment_failure(request: Request, user=Depends(get_current_user)):
    """Report a failed subscription payment (webhook or client-side)."""
    data = await request.json()
    reason = data.get("reason", "Payment declined")
    subscription_id = data.get("subscription_id", f"sub_{user['id'][:8]}")

    dunning = await handle_payment_failure(user["id"], subscription_id, reason)
    return {
        "message": "Payment failure recorded. We'll retry automatically.",
        "dunning_id": dunning["id"] if dunning else None,
        "next_retry_at": dunning.get("next_retry_at") if dunning else None
    }


@router.post("/resolve-payment")
async def resolve_payment(user=Depends(get_current_user)):
    """Manually resolve payment issues after successful payment."""
    count = await resolve_dunning(user["id"])

    if count > 0:
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"subscription_status": "active"}}
        )

    return {"message": "Payment issues resolved" if count > 0 else "No active payment issues", "resolved": count}


@router.get("/dunning-status")
async def get_dunning(user=Depends(get_current_user)):
    """Get dunning status for current user."""
    dunning = await get_dunning_status(user["id"])
    if not dunning:
        return {"has_issues": False}
    dunning.pop("_id", None)
    return {"has_issues": True, "dunning": dunning}


# ─── Admin/Cron Endpoints ────────────────────────────────────────────────────

@router.post("/process-dunning")
async def process_dunning_retries(user=Depends(get_current_user)):
    """Process due dunning retries. Should be called by cron/scheduler."""
    if user["role"] != "super_admin":
        raise HTTPException(403, "Admin only")
    results = await process_due_retries()
    return results
