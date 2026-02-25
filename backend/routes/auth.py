from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone
from database import db
from auth import hash_pw, verify_pw, create_token, create_refresh_token, verify_refresh_token, validate_password_strength, get_current_user
from models import RegisterInput, LoginInput
from collections import defaultdict
import uuid
import time
import os
import logging

router = APIRouter()
logger = logging.getLogger("horizon")

# --- HIGH FIX: Simple in-memory rate limiter ---
_rate_limits: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(key: str, max_attempts: int = 10, window: int = 300):
    """Rate limit by key. Default: 10 attempts per 5 minutes."""
    now = time.time()
    # Prune expired entries
    _rate_limits[key] = [t for t in _rate_limits[key] if now - t < window]
    if len(_rate_limits[key]) >= max_attempts:
        logger.warning(f"Rate limit exceeded for: {key}")
        raise HTTPException(429, "Too many attempts. Please try again later.")
    _rate_limits[key].append(now)


@router.post("/auth/register")
async def register(input: RegisterInput, request: Request):
    # HIGH FIX: Rate limit registration by IP
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(f"register:{client_ip}", max_attempts=5, window=300)

    if input.role == "super_admin":
        raise HTTPException(403, "Cannot register as super admin")
    existing = await db.users.find_one({"email": input.email})
    if existing:
        raise HTTPException(400, "Email already registered")
    validate_password_strength(input.password)
    account_status = "pending" if input.role in ("venue_owner", "coach") else "active"
    user = {
        "id": str(uuid.uuid4()),
        "name": input.name,
        "email": input.email,
        "password_hash": hash_pw(input.password),
        "role": input.role,
        "account_status": account_status,
        "phone": input.phone or "",
        "avatar": "",
        "sports": input.sports or [],
        "preferred_position": "",
        "skill_rating": 1500,
        "skill_deviation": 350,
        "reliability_score": 100,
        "total_games": 0,
        "wins": 0,
        "losses": 0,
        "draws": 0,
        "no_shows": 0,
        "business_name": input.business_name or "",
        "gst_number": input.gst_number or "",
        "is_verified": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    # Venue owner: add document verification fields
    if input.role == "venue_owner":
        user["verification_documents"] = {
            "business_license": None,
            "gst_certificate": None,
            "id_proof": None,
            "address_proof": None,
            "turf_images": [],
            "turf_videos": [],
        }
        user["doc_verification_status"] = "not_uploaded"
        user["doc_rejection_reason"] = ""
    await db.users.insert_one(user)
    user.pop("_id", None)
    token = create_token(user["id"], user["role"])
    return {"token": token, "refresh_token": create_refresh_token(user["id"], user["role"]), "user": {k: v for k, v in user.items() if k != "password_hash"}}


@router.post("/auth/login")
async def login(input: LoginInput, request: Request):
    # HIGH FIX: Rate limit login by IP + email
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(f"login:{client_ip}", max_attempts=10, window=300)
    _check_rate_limit(f"login:{input.email}", max_attempts=5, window=300)

    user = await db.users.find_one({"email": input.email})
    if not user:
        # HIGH FIX: Always run bcrypt to prevent timing-based email enumeration
        # Without this, "user not found" returns instantly while "wrong password" takes ~100ms (bcrypt)
        verify_pw(input.password, "$2b$12$LJ3m4ys3Lz0QqV9wKMkMxOsQOxGVbGShCR.gBBqONhfOUielJhntC")
        raise HTTPException(401, "Invalid credentials")
    if not verify_pw(input.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_token(user["id"], user["role"])
    user.pop("_id", None)
    return {"token": token, "refresh_token": create_refresh_token(user["id"], user["role"]), "user": {k: v for k, v in user.items() if k != "password_hash"}}


@router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return {k: v for k, v in user.items() if k != "password_hash"}


@router.put("/auth/profile")
async def update_profile(request: Request, user=Depends(get_current_user)):
    data = await request.json()
    allowed = ["name", "phone", "sports", "preferred_position", "avatar", "business_name", "gst_number"]
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return updated


@router.put("/auth/verification-documents")
async def update_verification_documents(request: Request, user=Depends(get_current_user)):
    """Venue owner uploads/updates verification documents. Send submit=true to submit for review."""
    if user.get("role") != "venue_owner":
        raise HTTPException(403, "Only venue owners can submit verification documents")
    data = await request.json()
    allowed_keys = ["business_license", "gst_certificate", "id_proof", "address_proof", "turf_images", "turf_videos"]
    current_docs = user.get("verification_documents", {})
    for key in allowed_keys:
        if key in data:
            current_docs[key] = data[key]
    updates = {"verification_documents": current_docs}
    if data.get("submit"):
        updates["doc_verification_status"] = "pending_review"
        updates["doc_rejection_reason"] = ""
    await db.users.update_one({"id": user["id"]}, {"$set": updates})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return updated


@router.post("/auth/push-token")
async def register_push_token(request: Request, user=Depends(get_current_user)):
    """Register a device push token for push notifications."""
    data = await request.json()
    push_token = data.get("push_token", "").strip()
    platform = data.get("platform", "")
    if not push_token:
        raise HTTPException(400, "push_token required")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"push_token": push_token, "push_platform": platform}}
    )
    return {"message": "Push token registered"}


@router.post("/auth/refresh")
async def refresh_token(request: Request):
    # Rate limit refresh endpoint
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(f"refresh:{client_ip}", max_attempts=20, window=300)

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
    return {"token": new_access, "refresh_token": new_refresh}


@router.post("/auth/dev-login")
async def dev_login(request: Request):
    """Quick login by email — development/testing only, no password needed."""
    if os.environ.get("ENVIRONMENT", "development") != "development":
        raise HTTPException(403, "Dev login is disabled in production")
    data = await request.json()
    email = data.get("email", "").strip().lower()
    if not email:
        raise HTTPException(400, "email required")
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(404, "User not found")
    token = create_token(user["id"], user["role"])
    user.pop("_id", None)
    return {"token": token, "refresh_token": create_refresh_token(user["id"], user["role"]), "user": {k: v for k, v in user.items() if k != "password_hash"}}
