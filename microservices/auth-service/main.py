"""Auth Service - Handles authentication, admin, subscriptions, file uploads."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "shared"))

from fastapi import FastAPI, HTTPException, Depends, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from datetime import datetime, timezone, timedelta
from database import db, init_redis, close_connections
from auth import hash_pw, verify_pw, create_token, get_current_user, get_platform_settings, require_admin, get_razorpay_client
from models import RegisterInput, LoginInput
import uuid
import logging
import boto3
from botocore.exceptions import ClientError
from botocore.config import Config

app = FastAPI(title="Horizon Auth Service")
logger = logging.getLogger("auth-service")
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
    return {"token": token, "user": {k: v for k, v in user.items() if k != "password_hash"}}

@app.post("/auth/login")
async def login(input: LoginInput):
    user = await db.users.find_one({"email": input.email})
    if not user or not verify_pw(input.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_token(user["id"], user["role"])
    user.pop("_id", None)
    return {"token": token, "user": {k: v for k, v in user.items() if k != "password_hash"}}

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

@app.get("/health")
async def health():
    return {"status": "ok", "service": "auth-service"}
