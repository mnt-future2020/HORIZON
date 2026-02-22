from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File
from typing import Optional
from datetime import datetime, timezone
from database import db
from auth import get_current_user, get_platform_settings, require_admin, hash_pw, verify_pw
import s3_service
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
    pending_coaches = await db.users.count_documents({"role": "coach", "account_status": "pending"})
    active_venues = await db.venues.count_documents({"status": "active"})
    confirmed_bookings = await db.bookings.find(
        {"status": {"$in": ["confirmed", "completed"]}}, {"_id": 0, "total_amount": 1}
    ).to_list(10000)
    total_revenue = sum(b.get("total_amount", 0) for b in confirmed_bookings)

    settings = await db.platform_settings.find_one({"key": "platform"}, {"_id": 0})
    commission_pct = settings.get("booking_commission_pct", 0) if settings else 0
    platform_earnings = int(total_revenue * commission_pct / 100)

    # Coaching revenue (per-session + packages)
    coaching_commission_pct = settings.get("coaching_commission_pct", 10) if settings else 10
    completed_coaching = await db.coaching_sessions.find(
        {"status": "completed"}, {"_id": 0, "price": 1}
    ).to_list(10000)
    coaching_session_revenue = sum(s.get("price", 0) for s in completed_coaching)

    # Package subscription revenue
    paid_subs = await db.coaching_subscriptions.find(
        {"status": {"$in": ["active", "expired", "cancelled"]},
         "payment_details": {"$exists": True}},
        {"_id": 0, "price": 1}
    ).to_list(10000)
    coaching_package_revenue = sum(s.get("price", 0) for s in paid_subs)

    coaching_revenue = coaching_session_revenue + coaching_package_revenue
    coaching_earnings = int(coaching_revenue * coaching_commission_pct / 100)

    # Tournament revenue
    tournament_commission_pct = settings.get("tournament_commission_pct", 10) if settings else 10
    all_tournaments = await db.tournaments.find(
        {"entry_fee": {"$gt": 0}}, {"_id": 0, "entry_fee": 1, "participants": 1}
    ).to_list(10000)
    tournament_revenue = 0
    for t in all_tournaments:
        paid_count = sum(1 for p in t.get("participants", []) if p.get("payment_status") == "paid")
        tournament_revenue += t.get("entry_fee", 0) * paid_count
    tournament_earnings = int(tournament_revenue * tournament_commission_pct / 100)

    total_platform_earnings = platform_earnings + coaching_earnings + tournament_earnings

    recent_users = await db.users.find(
        {"role": {"$ne": "super_admin"}}, {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).to_list(5)

    return {
        "total_users": total_users, "total_venues": total_venues,
        "total_bookings": total_bookings, "pending_owners": pending_owners, "pending_coaches": pending_coaches,
        "active_venues": active_venues, "total_revenue": total_revenue,
        "commission_pct": commission_pct, "platform_earnings": platform_earnings,
        "coaching_revenue": coaching_revenue, "coaching_earnings": coaching_earnings,
        "coaching_commission_pct": coaching_commission_pct,
        "tournament_revenue": tournament_revenue, "tournament_earnings": tournament_earnings,
        "tournament_commission_pct": tournament_commission_pct,
        "total_platform_earnings": total_platform_earnings,
        "recent_users": recent_users
    }


@router.get("/admin/users")
async def admin_list_users(user=Depends(get_current_user), role: Optional[str] = None, status: Optional[str] = None):
    await require_admin(user)
    query = {"role": {"$ne": "super_admin"}}
    if role and role != "super_admin":
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
    updates = {"account_status": "active"}
    if target.get("role") == "coach":
        updates["is_verified"] = True
        msg = "Your coach account has been approved and verified. You can now manage sessions and academies."
    else:
        msg = "Your venue owner account has been approved. You can now create and manage venues."
    await db.users.update_one({"id": user_id}, {"$set": updates})
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id,
        "type": "account_approved", "title": "Account Approved!",
        "message": msg,
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
    role_label = "coach" if target.get("role") == "coach" else "venue owner"
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id,
        "type": "account_rejected", "title": "Registration Update",
        "message": f"Your {role_label} registration was not approved. Please contact support for details.",
        "is_read": False, "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "User rejected"}


@router.put("/admin/users/{user_id}/suspend")
async def admin_suspend_user(user_id: str, user=Depends(get_current_user)):
    await require_admin(user)
    result = await db.users.update_one({"id": user_id}, {"$set": {"account_status": "suspended"}})
    if result.matched_count == 0:
        raise HTTPException(404, "User not found")
    return {"message": "User suspended"}


@router.put("/admin/users/{user_id}/activate")
async def admin_activate_user(user_id: str, user=Depends(get_current_user)):
    await require_admin(user)
    result = await db.users.update_one({"id": user_id}, {"$set": {"account_status": "active"}})
    if result.matched_count == 0:
        raise HTTPException(404, "User not found")
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
            "coaching_commission_pct": 10,
            "tournament_commission_pct": 10,
            "s3_storage": {"access_key_id": "", "secret_access_key": "", "bucket_name": "", "region": "ap-south-1", "enabled": False},
            "subscription_plans": [
                {"id": "free", "name": "Free", "price": 0, "features": ["1 venue", "Basic analytics"], "max_venues": 1},
                {"id": "basic", "name": "Basic", "price": 2999, "features": ["3 venues", "Advanced analytics", "Priority support"], "max_venues": 3},
                {"id": "pro", "name": "Pro", "price": 7999, "features": ["Unlimited venues", "Full analytics", "Dedicated support", "Custom branding"], "max_venues": 100},
            ]
        }
        await db.platform_settings.insert_one(settings)
        settings.pop("_id", None)
    # Ensure s3_storage field exists in old records
    if "s3_storage" not in settings:
        settings["s3_storage"] = {"access_key_id": "", "secret_access_key": "", "bucket_name": "", "region": "ap-south-1", "enabled": False}
    return settings


@router.put("/admin/settings")
async def admin_update_settings(request: Request, user=Depends(get_current_user)):
    await require_admin(user)
    data = await request.json()
    allowed = ["payment_gateway", "booking_commission_pct", "coaching_commission_pct", "tournament_commission_pct", "subscription_plans", "s3_storage"]
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
    current_pw = data.get("current_password", "")
    new_pw = data.get("new_password", "")
    # Verify current password before allowing change
    full_user = await db.users.find_one({"id": user["id"]})
    if not full_user or not verify_pw(current_pw, full_user.get("password_hash", "")):
        raise HTTPException(400, "Current password is incorrect")
    if len(new_pw) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_pw(new_pw)}})
    return {"message": "Password updated"}


@router.post("/admin/s3/test")
async def admin_test_s3(request: Request, user=Depends(get_current_user)):
    await require_admin(user)
    data = await request.json()
    result = await s3_service.test_connection({
        "access_key_id": data.get("access_key_id", ""),
        "secret_access_key": data.get("secret_access_key", ""),
        "bucket_name": data.get("bucket_name", ""),
        "region": data.get("region", "us-east-1"),
    })
    return result


@router.post("/upload/image")
async def upload_image(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Upload an image to S3. Returns {url} or 503 if S3 not configured."""
    if file.content_type not in ["image/jpeg", "image/png", "image/webp", "image/gif"]:
        raise HTTPException(400, "Only JPEG/PNG/WebP/GIF images allowed")
    if file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 10 MB)")
    content = await file.read()
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    url = await s3_service.upload_bytes(content, "images", f"{uuid.uuid4().hex}.{ext}", file.content_type)
    if not url:
        raise HTTPException(503, "S3 not configured. Please set up S3 in Admin → Settings.")
    return {"url": url}


@router.post("/upload/video")
async def upload_video(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Upload a video to S3. Returns {url} or 503 if not configured."""
    if file.content_type not in ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"]:
        raise HTTPException(400, "Only MP4/MOV/AVI/WebM videos allowed")
    if file.size and file.size > 100 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 100 MB)")
    content = await file.read()
    ext = file.filename.split(".")[-1] if "." in file.filename else "mp4"
    url = await s3_service.upload_bytes(content, "videos", f"{uuid.uuid4().hex}.{ext}", file.content_type)
    if not url:
        raise HTTPException(503, "S3 not configured. Please set up S3 in Admin → Settings.")
    return {"url": url}


@router.put("/admin/users/{user_id}/set-plan")
async def admin_set_user_plan(user_id: str, request: Request, user=Depends(get_current_user)):
    await require_admin(user)
    data = await request.json()
    plan_id = data.get("plan_id", "free")
    await db.users.update_one({"id": user_id}, {"$set": {"subscription_plan": plan_id}})
    return {"message": f"Plan set to {plan_id}"}


@router.put("/admin/users/{user_id}/toggle-verified")
async def admin_toggle_verified(user_id: str, user=Depends(get_current_user)):
    await require_admin(user)
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(404, "User not found")
    new_state = not target.get("is_verified", False)
    await db.users.update_one({"id": user_id}, {"$set": {"is_verified": new_state}})
    label = "verified" if new_state else "unverified"
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id,
        "type": "verification_update", "title": f"Account {label.title()}",
        "message": f"Your account has been {label} by Horizon.",
        "is_read": False, "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": f"User {label}", "is_verified": new_state}
