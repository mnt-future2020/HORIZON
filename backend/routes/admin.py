from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File, Query
from typing import Optional
import math
from datetime import datetime, timezone
from database import db
from auth import get_current_user, get_platform_settings, require_admin, hash_pw, verify_pw
import s3_service
import uuid
import re

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
async def admin_list_users(
    user=Depends(get_current_user),
    role: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    await require_admin(user)
    query = {"role": {"$ne": "super_admin"}}
    if role and role != "super_admin":
        query["role"] = role
    if status:
        query["account_status"] = status
    total = await db.users.count_documents(query)
    skip = (page - 1) * limit
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return {"users": users, "total": total, "page": page, "pages": math.ceil(total / max(limit, 1))}


@router.put("/admin/users/{user_id}/approve")
async def admin_approve_user(user_id: str, user=Depends(get_current_user)):
    await require_admin(user)
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(404, "User not found")
    updates = {"account_status": "active"}
    if target.get("role") == "coach":
        updates["is_verified"] = True
        updates["doc_verification_status"] = "verified"
        msg = "Your coach account has been approved and verified. You can now manage sessions and academies."
    elif target.get("role") == "venue_owner":
        updates["doc_verification_status"] = "verified"
        msg = "Your venue owner account has been verified and approved. You can now create and manage venues."
    else:
        msg = "Your account has been approved."
    await db.users.update_one({"id": user_id}, {"$set": updates})
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id,
        "type": "account_approved", "title": "Account Approved!",
        "message": msg,
        "is_read": False, "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "User approved"}


@router.put("/admin/users/{user_id}/reject")
async def admin_reject_user(user_id: str, request: Request, user=Depends(get_current_user)):
    await require_admin(user)
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(404, "User not found")
    # Parse optional rejection reason from body
    reason = ""
    try:
        data = await request.json()
        reason = data.get("reason", "")
    except Exception:
        pass
    update_fields = {"account_status": "rejected"}
    if target.get("role") in ("venue_owner", "coach"):
        update_fields["doc_verification_status"] = "rejected"
        update_fields["doc_rejection_reason"] = reason
    await db.users.update_one({"id": user_id}, {"$set": update_fields})
    role_label = "coach" if target.get("role") == "coach" else "venue owner"
    notification_msg = f"Your {role_label} registration was not approved."
    if reason:
        notification_msg += f" Reason: {reason}"
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id,
        "type": "account_rejected", "title": "Registration Update",
        "message": notification_msg,
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


@router.post("/admin/venues")
async def admin_create_venue(request: Request, user=Depends(get_current_user)):
    """Admin creates a venue manually (owner_id=null, badge=enquiry)."""
    await require_admin(user)
    data = await request.json()
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(400, "Venue name is required")
    address = data.get("address", "").strip()
    city = data.get("city", "").strip()
    if not city:
        raise HTTPException(400, "City is required")
    contact_phone = data.get("contact_phone", "").strip()
    # Generate unique slug
    base_slug = re.sub(r'-+', '-', re.sub(r'[^a-z0-9\s-]', '', name.lower()).replace(' ', '-')).strip('-')
    slug = base_slug
    counter = 1
    while await db.venues.find_one({"slug": slug}):
        slug = f"{base_slug}-{counter}"
        counter += 1
    venue = {
        "id": str(uuid.uuid4()),
        "owner_id": None,
        "slug": slug,
        "name": name,
        "description": data.get("description", ""),
        "sports": data.get("sports", ["football"]),
        "address": address,
        "area": data.get("area", ""),
        "city": city,
        "lat": data.get("lat", 12.9716),
        "lng": data.get("lng", 77.5946),
        "amenities": data.get("amenities", []),
        "images": data.get("images", []),
        "base_price": data.get("base_price", 2000),
        "slot_duration_minutes": data.get("slot_duration_minutes", 60),
        "opening_hour": data.get("opening_hour", 6),
        "closing_hour": data.get("closing_hour", 23),
        "turfs": data.get("turfs", 1),
        "contact_phone": contact_phone,
        "badge": "enquiry",
        "created_by": "admin",
        "rating": 0,
        "total_reviews": 0,
        "total_bookings": 0,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.venues.insert_one(venue)
    venue.pop("_id", None)
    return venue


@router.put("/admin/venues/{venue_id}/assign-owner")
async def admin_assign_venue_owner(venue_id: str, request: Request, user=Depends(get_current_user)):
    """Admin assigns a registered venue owner to an unclaimed venue."""
    await require_admin(user)
    data = await request.json()
    owner_id = data.get("owner_id", "").strip()
    if not owner_id:
        raise HTTPException(400, "owner_id is required")
    use_owner_phone = data.get("use_owner_phone", False)
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(404, "Venue not found")
    owner = await db.users.find_one({"id": owner_id, "role": "venue_owner"})
    if not owner:
        raise HTTPException(404, "Venue owner not found")
    # If admin chose to use owner's phone, or venue has no phone, use owner's phone
    contact_phone = owner.get("phone", "") if use_owner_phone else (venue.get("contact_phone") or owner.get("phone", ""))
    await db.venues.update_one({"id": venue_id}, {"$set": {
        "owner_id": owner_id,
        "badge": "bookable",
        "contact_phone": contact_phone,
    }})
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "user_id": owner_id,
        "type": "venue_assigned", "title": "Venue Assigned!",
        "message": f'The venue "{venue["name"]}" has been assigned to your account. You can now manage it from your dashboard.',
        "is_read": False, "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": f"Venue assigned to {owner.get('name', owner_id)}", "contact_phone": contact_phone}


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
    if "whatsapp" not in settings:
        settings["whatsapp"] = {"phone_number_id": "", "access_token": "", "business_phone": ""}
    return settings


@router.put("/admin/settings")
async def admin_update_settings(request: Request, user=Depends(get_current_user)):
    await require_admin(user)
    data = await request.json()
    allowed = ["payment_gateway", "booking_commission_pct", "coaching_commission_pct", "tournament_commission_pct", "subscription_plans", "s3_storage", "whatsapp"]
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
    """Upload an image — S3 priority, local fallback."""
    if file.content_type not in ["image/jpeg", "image/png", "image/webp", "image/gif"]:
        raise HTTPException(400, "Only JPEG/PNG/WebP/GIF images allowed")
    if file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 10 MB)")
    content = await file.read()
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    url = await s3_service.upload_bytes(content, "images", f"{uuid.uuid4().hex}.{ext}", file.content_type)
    return {"url": url}


@router.post("/upload/document")
async def upload_document(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Upload a document (image or PDF) — S3 priority, local fallback."""
    allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
    if file.content_type not in allowed:
        raise HTTPException(400, "Only JPEG/PNG/WebP images and PDF files allowed")
    if file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 10 MB)")
    content = await file.read()
    ext = file.filename.split(".")[-1] if "." in file.filename else "pdf"
    url = await s3_service.upload_bytes(content, "documents", f"{uuid.uuid4().hex}.{ext}", file.content_type)
    return {"url": url}


@router.post("/upload/video")
async def upload_video(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Upload a video — S3 priority, local fallback."""
    if file.content_type not in ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"]:
        raise HTTPException(400, "Only MP4/MOV/AVI/WebM videos allowed")
    if file.size and file.size > 100 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 100 MB)")
    content = await file.read()
    ext = file.filename.split(".")[-1] if "." in file.filename else "mp4"
    url = await s3_service.upload_bytes(content, "videos", f"{uuid.uuid4().hex}.{ext}", file.content_type)
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


@router.get("/admin/users/{user_id}/documents")
async def admin_get_user_documents(user_id: str, user=Depends(get_current_user)):
    """Admin: view a venue owner's verification documents."""
    await require_admin(user)
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(404, "User not found")
    return {
        "user_id": user_id,
        "name": target.get("name", ""),
        "role": target.get("role", ""),
        "business_name": target.get("business_name", ""),
        "verification_documents": target.get("verification_documents", {}),
        "coach_verification_documents": target.get("coach_verification_documents", {}),
        "doc_verification_status": target.get("doc_verification_status", "not_uploaded"),
        "doc_rejection_reason": target.get("doc_rejection_reason", ""),
    }
