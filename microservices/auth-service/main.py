"""Auth Service - Handles authentication, admin, subscriptions, file uploads, organizations."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "shared"))

from fastapi import FastAPI, HTTPException, Depends, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from datetime import datetime, timezone, timedelta
from database import db, init_redis, close_connections
from auth import (hash_pw, verify_pw, create_token, get_current_user,
                  get_platform_settings, require_admin, get_razorpay_client,
                  validate_password_strength, create_refresh_token, verify_refresh_token)
from models import RegisterInput, LoginInput, OrganizationCreate
import uuid
import logging
import boto3
from botocore.exceptions import ClientError
from botocore.config import Config

app = FastAPI(title="Lobbi Auth Service")
logger = logging.getLogger("lobbi")
logging.basicConfig(level=logging.INFO)

app.add_middleware(CORSMiddleware, allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
async def startup():
    await init_redis()

@app.on_event("shutdown")
async def shutdown():
    await close_connections()

# ─── S3 Helper ───────────────────────────────────────────────────────────────
async def get_s3_config():
    settings = await db.platform_settings.find_one({"key": "platform"}, {"_id": 0})
    if not settings:
        return None
    s3 = settings.get("s3_storage", {})
    if not all([s3.get("access_key_id"), s3.get("secret_access_key"), s3.get("bucket_name")]):
        return None
    return s3

async def upload_bytes(content, folder, filename, content_type):
    cfg = await get_s3_config()
    if not cfg:
        return None
    key = f"{folder}/{uuid.uuid4().hex}_{filename}"
    try:
        client = boto3.client("s3", region_name=cfg.get("region", "ap-south-1"),
            aws_access_key_id=cfg["access_key_id"], aws_secret_access_key=cfg["secret_access_key"],
            config=Config(signature_version="s3v4"))
        client.put_object(Bucket=cfg["bucket_name"], Key=key, Body=content, ContentType=content_type)
        return f"https://{cfg['bucket_name']}.s3.{cfg.get('region','ap-south-1')}.amazonaws.com/{key}"
    except ClientError as e:
        logger.error(f"S3 upload failed: {e}")
        return None

# ─── Dunning Service ─────────────────────────────────────────────────────────
RETRY_SCHEDULE = [24, 72, 168]
MAX_RETRIES = len(RETRY_SCHEDULE)
GRACE_PERIOD_DAYS = 14

async def handle_payment_failure(user_id, subscription_id, reason=""):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return None
    existing = await db.dunning.find_one({"user_id": user_id, "subscription_id": subscription_id, "status": {"$in": ["active", "retrying"]}})
    if existing:
        return existing
    dunning = {
        "id": str(uuid.uuid4()), "user_id": user_id, "user_name": user.get("name", ""),
        "user_email": user.get("email", ""), "subscription_id": subscription_id,
        "plan": user.get("subscription_plan", "free"), "failure_reason": reason,
        "retry_count": 0, "max_retries": MAX_RETRIES, "status": "active",
        "next_retry_at": (datetime.now(timezone.utc) + timedelta(hours=RETRY_SCHEDULE[0])).isoformat(),
        "grace_period_ends": (datetime.now(timezone.utc) + timedelta(days=GRACE_PERIOD_DAYS)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "history": [{"event": "payment_failed", "reason": reason, "timestamp": datetime.now(timezone.utc).isoformat()}]
    }
    await db.dunning.insert_one(dunning)
    dunning.pop("_id", None)
    return dunning

async def get_dunning_status(user_id):
    return await db.dunning.find_one({"user_id": user_id, "status": {"$in": ["active", "retrying"]}}, {"_id": 0})

async def resolve_dunning(user_id):
    result = await db.dunning.update_many(
        {"user_id": user_id, "status": {"$in": ["active", "retrying"]}},
        {"$set": {"status": "recovered"}, "$push": {"history": {"event": "manually_resolved", "timestamp": datetime.now(timezone.utc).isoformat()}}}
    )
    return result.modified_count

async def process_due_retries():
    now = datetime.now(timezone.utc).isoformat()
    due = await db.dunning.find({"status": {"$in": ["active", "retrying"]}, "next_retry_at": {"$lte": now}}).to_list(100)
    results = {"retried": 0, "recovered": 0, "suspended": 0}
    for entry in due:
        if entry.get("retry_count", 0) >= MAX_RETRIES:
            await db.dunning.update_one({"id": entry["id"]}, {"$set": {"status": "suspended"}})
            await db.users.update_one({"id": entry["user_id"]}, {"$set": {"subscription_plan": "free", "subscription_status": "suspended"}})
            results["suspended"] += 1
        else:
            idx = min(entry.get("retry_count", 0), len(RETRY_SCHEDULE) - 1)
            nxt = (datetime.now(timezone.utc) + timedelta(hours=RETRY_SCHEDULE[idx])).isoformat()
            await db.dunning.update_one({"id": entry["id"]}, {"$set": {"next_retry_at": nxt, "status": "retrying"}, "$inc": {"retry_count": 1}})
        results["retried"] += 1
    return results

# ─── Auth Routes ─────────────────────────────────────────────────────────────
@app.post("/auth/register")
async def register(input: RegisterInput):
    if input.role == "super_admin":
        raise HTTPException(403, "Cannot register as super admin")
    existing = await db.users.find_one({"email": input.email})
    if existing:
        raise HTTPException(400, "Email already registered")
    validate_password_strength(input.password)
    account_status = "pending" if input.role == "venue_owner" else "active"
    user = {
        "id": str(uuid.uuid4()), "name": input.name, "email": input.email,
        "password_hash": hash_pw(input.password), "role": input.role,
        "account_status": account_status, "phone": input.phone or "",
        "avatar": "", "sports": input.sports or [], "preferred_position": "",
        "skill_rating": 1500, "skill_deviation": 350, "reliability_score": 100,
        "total_games": 0, "wins": 0, "losses": 0, "draws": 0, "no_shows": 0,
        "business_name": input.business_name or "", "gst_number": input.gst_number or "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    user.pop("_id", None)
    token = create_token(user["id"], user["role"])
    refresh_token = create_refresh_token(user["id"], user["role"])
    logger.info(f"New user registered: {user['email']} (role={user['role']})")
    return {"token": token, "refresh_token": refresh_token, "user": {k: v for k, v in user.items() if k != "password_hash"}}

@app.post("/auth/login")
async def login(input: LoginInput):
    user = await db.users.find_one({"email": input.email})
    if not user or not verify_pw(input.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_token(user["id"], user["role"])
    refresh_token = create_refresh_token(user["id"], user["role"])
    user.pop("_id", None)
    logger.info(f"User logged in: {user['email']}")
    return {"token": token, "refresh_token": refresh_token, "user": {k: v for k, v in user.items() if k != "password_hash"}}

@app.post("/auth/refresh")
async def refresh_token(request: Request):
    data = await request.json()
    refresh_tok = data.get("refresh_token", "")
    if not refresh_tok:
        raise HTTPException(400, "refresh_token required")
    payload = verify_refresh_token(refresh_tok)
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    if user.get("account_status") in ("suspended", "deleted"):
        raise HTTPException(403, "Account is suspended or deactivated")
    new_access = create_token(user["id"], user["role"])
    new_refresh = create_refresh_token(user["id"], user["role"])
    logger.info(f"Token refreshed for user: {user.get('email', user['id'])}")
    return {"token": new_access, "refresh_token": new_refresh}

@app.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return {k: v for k, v in user.items() if k != "password_hash"}

@app.put("/auth/profile")
async def update_profile(request: Request, user=Depends(get_current_user)):
    data = await request.json()
    allowed = ["name", "phone", "sports", "preferred_position", "avatar"]
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    return await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})

@app.post("/auth/push-token")
async def register_push_token(request: Request, user=Depends(get_current_user)):
    data = await request.json()
    push_token = data.get("push_token", "").strip()
    if not push_token:
        raise HTTPException(400, "push_token required")
    await db.users.update_one({"id": user["id"]}, {"$set": {"push_token": push_token, "push_platform": data.get("platform", "")}})
    return {"message": "Push token registered"}

# ─── Admin Routes ────────────────────────────────────────────────────────────
@app.get("/admin/dashboard")
async def admin_dashboard(user=Depends(get_current_user)):
    await require_admin(user)
    total_users = await db.users.count_documents({"role": {"$ne": "super_admin"}})
    total_venues = await db.venues.count_documents({})
    total_bookings = await db.bookings.count_documents({})
    pending_owners = await db.users.count_documents({"role": "venue_owner", "account_status": "pending"})
    active_venues = await db.venues.count_documents({"status": "active"})
    confirmed_bookings = await db.bookings.find({"status": {"$in": ["confirmed", "completed"]}}, {"_id": 0, "total_amount": 1}).to_list(10000)
    total_revenue = sum(b.get("total_amount", 0) for b in confirmed_bookings)
    settings = await db.platform_settings.find_one({"key": "platform"}, {"_id": 0})
    commission_pct = settings.get("booking_commission_pct", 0) if settings else 0
    platform_earnings = int(total_revenue * commission_pct / 100)
    recent_users = await db.users.find({"role": {"$ne": "super_admin"}}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(5)
    return {"total_users": total_users, "total_venues": total_venues, "total_bookings": total_bookings,
            "pending_owners": pending_owners, "active_venues": active_venues, "total_revenue": total_revenue,
            "commission_pct": commission_pct, "platform_earnings": platform_earnings, "recent_users": recent_users}

@app.get("/admin/users")
async def admin_list_users(user=Depends(get_current_user), role: Optional[str] = None, status: Optional[str] = None):
    await require_admin(user)
    query = {"role": {"$ne": "super_admin"}}
    if role: query["role"] = role
    if status: query["account_status"] = status
    return await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)

@app.put("/admin/users/{user_id}/approve")
async def admin_approve_user(user_id: str, user=Depends(get_current_user)):
    await require_admin(user)
    target = await db.users.find_one({"id": user_id})
    if not target: raise HTTPException(404, "User not found")
    await db.users.update_one({"id": user_id}, {"$set": {"account_status": "active"}})
    await db.notifications.insert_one({"id": str(uuid.uuid4()), "user_id": user_id, "type": "account_approved",
        "title": "Account Approved!", "message": "Your venue owner account has been approved.",
        "is_read": False, "created_at": datetime.now(timezone.utc).isoformat()})
    return {"message": "User approved"}

@app.put("/admin/users/{user_id}/reject")
async def admin_reject_user(user_id: str, user=Depends(get_current_user)):
    await require_admin(user)
    await db.users.update_one({"id": user_id}, {"$set": {"account_status": "rejected"}})
    return {"message": "User rejected"}

@app.put("/admin/users/{user_id}/suspend")
async def admin_suspend_user(user_id: str, user=Depends(get_current_user)):
    await require_admin(user)
    await db.users.update_one({"id": user_id}, {"$set": {"account_status": "suspended"}})
    return {"message": "User suspended"}

@app.put("/admin/users/{user_id}/activate")
async def admin_activate_user(user_id: str, user=Depends(get_current_user)):
    await require_admin(user)
    await db.users.update_one({"id": user_id}, {"$set": {"account_status": "active"}})
    return {"message": "User activated"}

@app.get("/admin/venues")
async def admin_list_venues(user=Depends(get_current_user)):
    await require_admin(user)
    return await db.venues.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)

@app.put("/admin/venues/{venue_id}/suspend")
async def admin_suspend_venue(venue_id: str, user=Depends(get_current_user)):
    await require_admin(user)
    await db.venues.update_one({"id": venue_id}, {"$set": {"status": "suspended"}})
    return {"message": "Venue suspended"}

@app.put("/admin/venues/{venue_id}/activate")
async def admin_activate_venue(venue_id: str, user=Depends(get_current_user)):
    await require_admin(user)
    await db.venues.update_one({"id": venue_id}, {"$set": {"status": "active"}})
    return {"message": "Venue activated"}

@app.get("/admin/bookings")
async def admin_list_bookings(user=Depends(get_current_user)):
    await require_admin(user)
    return await db.bookings.find({}, {"_id": 0}).sort("date", -1).to_list(500)

@app.get("/admin/settings")
async def admin_get_settings(user=Depends(get_current_user)):
    await require_admin(user)
    settings = await db.platform_settings.find_one({"key": "platform"}, {"_id": 0})
    if not settings:
        settings = {"key": "platform", "payment_gateway": {"provider": "razorpay", "key_id": "", "key_secret": "", "is_live": False},
            "booking_commission_pct": 10, "s3_storage": {"access_key_id": "", "secret_access_key": "", "bucket_name": "", "region": "ap-south-1", "enabled": False},
            "subscription_plans": [
                {"id": "free", "name": "Free", "price": 0, "features": ["1 venue", "Basic analytics"], "max_venues": 1},
                {"id": "basic", "name": "Basic", "price": 2999, "features": ["3 venues", "Advanced analytics", "Priority support"], "max_venues": 3},
                {"id": "pro", "name": "Pro", "price": 7999, "features": ["Unlimited venues", "Full analytics", "Dedicated support", "Custom branding"], "max_venues": 100},
            ]}
        await db.platform_settings.insert_one(settings)
        settings.pop("_id", None)
    if "s3_storage" not in settings:
        settings["s3_storage"] = {"access_key_id": "", "secret_access_key": "", "bucket_name": "", "region": "ap-south-1", "enabled": False}
    return settings

@app.put("/admin/settings")
async def admin_update_settings(request: Request, user=Depends(get_current_user)):
    await require_admin(user)
    data = await request.json()
    allowed = ["payment_gateway", "booking_commission_pct", "subscription_plans", "s3_storage"]
    updates = {k: v for k, v in data.items() if k in allowed}
    if not updates: raise HTTPException(400, "No valid fields to update")
    await db.platform_settings.update_one({"key": "platform"}, {"$set": updates}, upsert=True)
    return await db.platform_settings.find_one({"key": "platform"}, {"_id": 0})

@app.put("/admin/change-password")
async def admin_change_password(request: Request, user=Depends(get_current_user)):
    await require_admin(user)
    data = await request.json()
    new_pw = data.get("new_password", "")
    if len(new_pw) < 6: raise HTTPException(400, "Password must be at least 6 characters")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_pw(new_pw)}})
    return {"message": "Password updated"}

@app.put("/admin/users/{user_id}/set-plan")
async def admin_set_user_plan(user_id: str, request: Request, user=Depends(get_current_user)):
    await require_admin(user)
    data = await request.json()
    await db.users.update_one({"id": user_id}, {"$set": {"subscription_plan": data.get("plan_id", "free")}})
    return {"message": f"Plan set to {data.get('plan_id', 'free')}"}

@app.post("/upload/image")
async def upload_image_ep(file: UploadFile = File(...), user=Depends(get_current_user)):
    if file.content_type not in ["image/jpeg", "image/png", "image/webp", "image/gif"]:
        raise HTTPException(400, "Only JPEG/PNG/WebP/GIF images allowed")
    content = await file.read()
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    url = await upload_bytes(content, "images", f"{uuid.uuid4().hex}.{ext}", file.content_type)
    if not url: raise HTTPException(503, "S3 not configured.")
    return {"url": url}

@app.post("/upload/video")
async def upload_video_ep(file: UploadFile = File(...), user=Depends(get_current_user)):
    if file.content_type not in ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"]:
        raise HTTPException(400, "Only MP4/MOV/AVI/WebM videos allowed")
    content = await file.read()
    ext = file.filename.split(".")[-1] if "." in file.filename else "mp4"
    url = await upload_bytes(content, "videos", f"{uuid.uuid4().hex}.{ext}", file.content_type)
    if not url: raise HTTPException(503, "S3 not configured.")
    return {"url": url}

# ─── Subscription Routes ─────────────────────────────────────────────────────
@app.get("/subscription/my-plan")
async def sub_my_plan(user=Depends(get_current_user)):
    platform = await get_platform_settings()
    plans = platform.get("subscription_plans", [])
    user_plan = user.get("subscription_plan", "free")
    plan_config = next((p for p in plans if p["id"] == user_plan), None)
    dunning = await get_dunning_status(user["id"])
    return {"plan_id": user_plan, "plan": plan_config, "subscription_status": user.get("subscription_status", "active"),
            "has_payment_issue": dunning is not None,
            "dunning_info": {"status": dunning["status"], "retry_count": dunning.get("retry_count", 0),
                "grace_period_ends": dunning.get("grace_period_ends"), "next_retry_at": dunning.get("next_retry_at")} if dunning else None}

@app.put("/subscription/upgrade")
async def sub_upgrade(request: Request, user=Depends(get_current_user)):
    data = await request.json()
    new_plan_id = data.get("plan_id")
    if not new_plan_id: raise HTTPException(400, "plan_id is required")
    platform = await get_platform_settings()
    plan = next((p for p in platform.get("subscription_plans", []) if p["id"] == new_plan_id), None)
    if not plan: raise HTTPException(404, "Plan not found")
    await db.users.update_one({"id": user["id"]}, {"$set": {"subscription_plan": new_plan_id, "subscription_status": "active", "plan_updated_at": datetime.now(timezone.utc).isoformat()}})
    await resolve_dunning(user["id"])
    return {"message": f"Upgraded to {plan.get('name', new_plan_id)}", "plan": plan}

@app.post("/subscription/payment-failed")
async def sub_payment_failed(request: Request, user=Depends(get_current_user)):
    data = await request.json()
    dunning = await handle_payment_failure(user["id"], data.get("subscription_id", f"sub_{user['id'][:8]}"), data.get("reason", "Payment declined"))
    return {"message": "Payment failure recorded.", "dunning_id": dunning["id"] if dunning else None}

@app.post("/subscription/resolve-payment")
async def sub_resolve_payment(user=Depends(get_current_user)):
    count = await resolve_dunning(user["id"])
    if count > 0:
        await db.users.update_one({"id": user["id"]}, {"$set": {"subscription_status": "active"}})
    return {"message": "Payment issues resolved" if count > 0 else "No active payment issues", "resolved": count}

@app.get("/subscription/dunning-status")
async def sub_dunning_status(user=Depends(get_current_user)):
    dunning = await get_dunning_status(user["id"])
    if not dunning: return {"has_issues": False}
    return {"has_issues": True, "dunning": dunning}

@app.post("/subscription/process-dunning")
async def sub_process_dunning(user=Depends(get_current_user)):
    if user["role"] != "super_admin": raise HTTPException(403, "Admin only")
    return await process_due_retries()

# ─── Organization Helpers ────────────────────────────────────────────────────

async def _get_org_or_404(org_id: str):
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(404, "Organization not found")
    return org


def _is_org_member(org, user_id: str) -> bool:
    if org["owner_id"] == user_id:
        return True
    return any(s["user_id"] == user_id for s in org.get("staff", []))


def _require_org_access(org, user):
    if not _is_org_member(org, user["id"]):
        raise HTTPException(403, "You don't have access to this organization")


# ─── Organization CRUD ───────────────────────────────────────────────────────

@app.post("/organizations")
async def create_organization(input: OrganizationCreate, user=Depends(get_current_user)):
    if user["role"] not in ("coach", "super_admin"):
        raise HTTPException(403, "Only coaches and admins can create organizations")

    if input.org_type not in ("individual_coach", "academy", "school", "college"):
        raise HTTPException(400, "org_type must be individual_coach, academy, school, or college")

    org = {
        "id": str(uuid.uuid4()),
        "name": input.name,
        "org_type": input.org_type,
        "owner_id": user["id"],
        "owner_name": user.get("name", ""),
        "sports": input.sports,
        "description": input.description,
        "location": input.location,
        "city": input.city,
        "logo_url": input.logo_url,
        "contact_email": input.contact_email or user.get("email", ""),
        "contact_phone": input.contact_phone or user.get("phone", ""),
        "staff": [{
            "user_id": user["id"],
            "name": user.get("name", ""),
            "role": "head_coach",
            "joined_at": datetime.now(timezone.utc).isoformat()
        }],
        "players": [],
        "player_count": 0,
        "staff_count": 1,
        "stats": {"total_records": 0, "total_training_sessions": 0, "tournaments_organized": 0},
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.organizations.insert_one(org)
    org.pop("_id", None)
    logger.info(f"Organization created: {org['name']} by {user.get('email', user['id'])}")
    return org


@app.get("/organizations")
async def list_organizations(
    org_type: Optional[str] = None,
    sport: Optional[str] = None,
    city: Optional[str] = None,
    search: Optional[str] = None
):
    query = {"status": "active"}
    if org_type:
        query["org_type"] = org_type
    if sport:
        query["sports"] = sport
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    orgs = await db.organizations.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return orgs


@app.get("/organizations/my")
async def my_organizations(user=Depends(get_current_user)):
    orgs = await db.organizations.find(
        {"$or": [
            {"owner_id": user["id"]},
            {"staff.user_id": user["id"]}
        ], "status": "active"},
        {"_id": 0}
    ).to_list(50)
    return orgs


@app.get("/organizations/{org_id}")
async def get_organization(org_id: str):
    return await _get_org_or_404(org_id)


@app.put("/organizations/{org_id}")
async def update_organization(org_id: str, request: Request, user=Depends(get_current_user)):
    org = await _get_org_or_404(org_id)
    _require_org_access(org, user)

    data = await request.json()
    allowed = ["name", "description", "sports", "location", "city", "logo_url",
               "contact_email", "contact_phone"]
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        await db.organizations.update_one({"id": org_id}, {"$set": updates})
    updated = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    return updated


# ─── Organization Staff Management ──────────────────────────────────────────

@app.post("/organizations/{org_id}/staff")
async def add_staff(org_id: str, request: Request, user=Depends(get_current_user)):
    org = await _get_org_or_404(org_id)
    if org["owner_id"] != user["id"]:
        raise HTTPException(403, "Only the organization owner can manage staff")

    data = await request.json()
    email = data.get("email", "").strip().lower()
    if not email:
        raise HTTPException(400, "Staff email is required")

    staff_user = await db.users.find_one({"email": email}, {"_id": 0, "id": 1, "name": 1, "role": 1})
    if not staff_user:
        raise HTTPException(404, "No user found with that email")

    if any(s["user_id"] == staff_user["id"] for s in org.get("staff", [])):
        raise HTTPException(409, "User is already staff")

    staff_entry = {
        "user_id": staff_user["id"],
        "name": staff_user["name"],
        "role": data.get("role", "assistant"),
        "joined_at": datetime.now(timezone.utc).isoformat()
    }
    await db.organizations.update_one(
        {"id": org_id},
        {"$push": {"staff": staff_entry}, "$inc": {"staff_count": 1}}
    )
    logger.info(f"Staff added to org {org_id}: {staff_user['id']}")
    return staff_entry


@app.delete("/organizations/{org_id}/staff/{staff_user_id}")
async def remove_staff(org_id: str, staff_user_id: str, user=Depends(get_current_user)):
    org = await _get_org_or_404(org_id)
    if org["owner_id"] != user["id"]:
        raise HTTPException(403, "Only the organization owner can manage staff")
    if staff_user_id == org["owner_id"]:
        raise HTTPException(400, "Cannot remove the owner from staff")

    staff = [s for s in org.get("staff", []) if s["user_id"] != staff_user_id]
    await db.organizations.update_one(
        {"id": org_id},
        {"$set": {"staff": staff, "staff_count": len(staff)}}
    )
    logger.info(f"Staff removed from org {org_id}: {staff_user_id}")
    return {"message": "Staff member removed"}


# ─── Organization Player Management ─────────────────────────────────────────

@app.post("/organizations/{org_id}/players")
async def enroll_player(org_id: str, request: Request, user=Depends(get_current_user)):
    org = await _get_org_or_404(org_id)
    _require_org_access(org, user)

    data = await request.json()
    email = data.get("email", "").strip().lower()
    phone = data.get("phone", "").strip()
    if not email and not phone:
        raise HTTPException(400, "Player email or phone is required")

    query = {}
    if email:
        query["email"] = email
    elif phone:
        query["phone"] = phone
    player = await db.users.find_one(query, {"_id": 0, "id": 1, "name": 1})
    if not player:
        raise HTTPException(404, "No player found with that email/phone")

    if any(p["user_id"] == player["id"] for p in org.get("players", [])):
        raise HTTPException(409, "Player is already enrolled")

    entry = {
        "user_id": player["id"],
        "name": player["name"],
        "enrolled_at": datetime.now(timezone.utc).isoformat(),
        "status": "active"
    }
    await db.organizations.update_one(
        {"id": org_id},
        {"$push": {"players": entry}, "$inc": {"player_count": 1}}
    )
    logger.info(f"Player enrolled in org {org_id}: {player['id']}")
    return entry


@app.delete("/organizations/{org_id}/players/{player_user_id}")
async def remove_player(org_id: str, player_user_id: str, user=Depends(get_current_user)):
    org = await _get_org_or_404(org_id)
    _require_org_access(org, user)

    players = [p for p in org.get("players", []) if p["user_id"] != player_user_id]
    await db.organizations.update_one(
        {"id": org_id},
        {"$set": {"players": players, "player_count": len(players)}}
    )
    logger.info(f"Player removed from org {org_id}: {player_user_id}")
    return {"message": "Player removed"}


# ─── Organization Dashboard / Analytics ──────────────────────────────────────

@app.get("/organizations/{org_id}/dashboard")
async def org_dashboard(org_id: str, user=Depends(get_current_user)):
    org = await _get_org_or_404(org_id)
    _require_org_access(org, user)

    player_ids = [p["user_id"] for p in org.get("players", [])]

    total_records = await db.performance_records.count_documents({"organization_id": org_id})
    total_training = await db.training_logs.count_documents({"organization_id": org_id})
    total_tournaments = await db.tournaments.count_documents({"organizer_id": {"$in": [s["user_id"] for s in org.get("staff", [])]}})

    recent_records = await db.performance_records.find(
        {"organization_id": org_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(10)

    recent_training = await db.training_logs.find(
        {"organization_id": org_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(5)

    return {
        "organization": org,
        "total_players": len(player_ids),
        "total_staff": org.get("staff_count", 1),
        "total_records": total_records,
        "total_training_sessions": total_training,
        "total_tournaments": total_tournaments,
        "recent_records": recent_records,
        "recent_training": recent_training
    }

# ─── Health ──────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "service": "auth-service"}
