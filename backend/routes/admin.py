from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional
from datetime import datetime, timezone
from database import db
from auth import get_current_user, get_platform_settings, require_admin, hash_pw
import uuid

router = APIRouter()


# --- Admin Routes ---
@router.get("/admin/dashboard")
async def admin_dashboard(user=Depends(get_current_user)):
    await require_admin(user)
    total_users = await db.users.count_documents({"role": {"$ne": "super_admin"}})
    total_venues = await db.venues.count_documents({})
    total_bookings = await db.bookings.count_documents({})
    pending_owners = await db.users.count_documents({"role": "venue_owner", "account_status": "pending"})
    active_venues = await db.venues.count_documents({"status": "active"})
    confirmed_bookings = await db.bookings.find(
        {"status": {"$in": ["confirmed", "completed"]}}, {"_id": 0, "total_amount": 1}
    ).to_list(10000)
    total_revenue = sum(b.get("total_amount", 0) for b in confirmed_bookings)

    settings = await db.platform_settings.find_one({"key": "platform"}, {"_id": 0})
    commission_pct = settings.get("booking_commission_pct", 0) if settings else 0
    platform_earnings = int(total_revenue * commission_pct / 100)

    recent_users = await db.users.find(
        {"role": {"$ne": "super_admin"}}, {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).to_list(5)

    return {
        "total_users": total_users, "total_venues": total_venues,
        "total_bookings": total_bookings, "pending_owners": pending_owners,
        "active_venues": active_venues, "total_revenue": total_revenue,
        "commission_pct": commission_pct, "platform_earnings": platform_earnings,
        "recent_users": recent_users
    }


@router.get("/admin/users")
async def admin_list_users(user=Depends(get_current_user), role: Optional[str] = None, status: Optional[str] = None):
    await require_admin(user)
    query = {"role": {"$ne": "super_admin"}}
    if role:
        query["role"] = role
    if status:
        query["account_status"] = status
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    return users


@router.put("/admin/users/{user_id}/approve")
async def admin_approve_user(user_id: str, user=Depends(get_current_user)):
    await require_admin(user)
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(404, "User not found")
    await db.users.update_one({"id": user_id}, {"$set": {"account_status": "active"}})
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id,
        "type": "account_approved", "title": "Account Approved!",
        "message": "Your venue owner account has been approved. You can now create and manage venues.",
        "is_read": False, "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "User approved"}


@router.put("/admin/users/{user_id}/reject")
async def admin_reject_user(user_id: str, user=Depends(get_current_user)):
    await require_admin(user)
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(404, "User not found")
    await db.users.update_one({"id": user_id}, {"$set": {"account_status": "rejected"}})
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id,
        "type": "account_rejected", "title": "Registration Update",
        "message": "Your venue owner registration was not approved. Please contact support for details.",
        "is_read": False, "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "User rejected"}


@router.put("/admin/users/{user_id}/suspend")
async def admin_suspend_user(user_id: str, user=Depends(get_current_user)):
    await require_admin(user)
    await db.users.update_one({"id": user_id}, {"$set": {"account_status": "suspended"}})
    return {"message": "User suspended"}


@router.put("/admin/users/{user_id}/activate")
async def admin_activate_user(user_id: str, user=Depends(get_current_user)):
    await require_admin(user)
    await db.users.update_one({"id": user_id}, {"$set": {"account_status": "active"}})
    return {"message": "User activated"}


@router.get("/admin/venues")
async def admin_list_venues(user=Depends(get_current_user)):
    await require_admin(user)
    venues = await db.venues.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return venues


@router.put("/admin/venues/{venue_id}/suspend")
async def admin_suspend_venue(venue_id: str, user=Depends(get_current_user)):
    await require_admin(user)
    await db.venues.update_one({"id": venue_id}, {"$set": {"status": "suspended"}})
    return {"message": "Venue suspended"}


@router.put("/admin/venues/{venue_id}/activate")
async def admin_activate_venue(venue_id: str, user=Depends(get_current_user)):
    await require_admin(user)
    await db.venues.update_one({"id": venue_id}, {"$set": {"status": "active"}})
    return {"message": "Venue activated"}


@router.get("/admin/bookings")
async def admin_list_bookings(user=Depends(get_current_user)):
    await require_admin(user)
    bookings = await db.bookings.find({}, {"_id": 0}).sort("date", -1).to_list(500)
    return bookings


@router.get("/admin/settings")
async def admin_get_settings(user=Depends(get_current_user)):
    await require_admin(user)
    settings = await db.platform_settings.find_one({"key": "platform"}, {"_id": 0})
    if not settings:
        settings = {
            "key": "platform",
            "payment_gateway": {"provider": "razorpay", "key_id": "", "key_secret": "", "is_live": False},
            "booking_commission_pct": 10,
            "subscription_plans": [
                {"id": "free", "name": "Free", "price": 0, "features": ["1 venue", "Basic analytics"], "max_venues": 1},
                {"id": "basic", "name": "Basic", "price": 2999, "features": ["3 venues", "Advanced analytics", "Priority support"], "max_venues": 3},
                {"id": "pro", "name": "Pro", "price": 7999, "features": ["Unlimited venues", "Full analytics", "Dedicated support", "Custom branding"], "max_venues": 100},
            ]
        }
        await db.platform_settings.insert_one(settings)
        settings.pop("_id", None)
    return settings


@router.put("/admin/settings")
async def admin_update_settings(request: Request, user=Depends(get_current_user)):
    await require_admin(user)
    data = await request.json()
    allowed = ["payment_gateway", "booking_commission_pct", "subscription_plans"]
    updates = {k: v for k, v in data.items() if k in allowed}
    if not updates:
        raise HTTPException(400, "No valid fields to update")
    await db.platform_settings.update_one(
        {"key": "platform"}, {"$set": updates}, upsert=True
    )
    settings = await db.platform_settings.find_one({"key": "platform"}, {"_id": 0})
    return settings


@router.put("/admin/change-password")
async def admin_change_password(request: Request, user=Depends(get_current_user)):
    await require_admin(user)
    data = await request.json()
    new_pw = data.get("new_password", "")
    if len(new_pw) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_pw(new_pw)}})
    return {"message": "Password updated"}


@router.put("/admin/users/{user_id}/set-plan")
async def admin_set_user_plan(user_id: str, request: Request, user=Depends(get_current_user)):
    await require_admin(user)
    data = await request.json()
    plan_id = data.get("plan_id", "free")
    await db.users.update_one({"id": user_id}, {"$set": {"subscription_plan": plan_id}})
    return {"message": f"Plan set to {plan_id}"}


# --- Subscription Routes ---
@router.get("/subscription/my-plan")
async def get_my_plan(user=Depends(get_current_user)):
    user_plan = user.get("subscription_plan", "free")
    platform = await get_platform_settings()
    plans = platform.get("subscription_plans", [])
    plan_config = next((p for p in plans if p["id"] == user_plan), None)
    if not plan_config:
        plan_config = {"id": "free", "name": "Free", "price": 0, "features": ["1 venue"], "max_venues": 1}
    current_venues = await db.venues.count_documents({"owner_id": user["id"]})
    return {
        "current_plan": plan_config,
        "venues_used": current_venues,
        "venues_limit": plan_config["max_venues"],
        "all_plans": plans
    }


@router.put("/subscription/upgrade")
async def upgrade_plan(request: Request, user=Depends(get_current_user)):
    data = await request.json()
    plan_id = data.get("plan_id")
    platform = await get_platform_settings()
    plans = platform.get("subscription_plans", [])
    plan = next((p for p in plans if p["id"] == plan_id), None)
    if not plan:
        raise HTTPException(400, "Invalid plan")
    await db.users.update_one({"id": user["id"]}, {"$set": {"subscription_plan": plan_id}})
    return {"message": f"Upgraded to {plan['name']}", "plan": plan}
