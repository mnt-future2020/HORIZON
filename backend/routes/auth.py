from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone
from database import db
from auth import hash_pw, verify_pw, create_token, get_current_user
from models import RegisterInput, LoginInput
import uuid

router = APIRouter()


@router.post("/auth/register")
async def register(input: RegisterInput):
    if input.role == "super_admin":
        raise HTTPException(403, "Cannot register as super admin")
    existing = await db.users.find_one({"email": input.email})
    if existing:
        raise HTTPException(400, "Email already registered")
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
    await db.users.insert_one(user)
    user.pop("_id", None)
    token = create_token(user["id"], user["role"])
    return {"token": token, "user": {k: v for k, v in user.items() if k != "password_hash"}}


@router.post("/auth/login")
async def login(input: LoginInput):
    user = await db.users.find_one({"email": input.email})
    if not user or not verify_pw(input.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_token(user["id"], user["role"])
    user.pop("_id", None)
    return {"token": token, "user": {k: v for k, v in user.items() if k != "password_hash"}}


@router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return {k: v for k, v in user.items() if k != "password_hash"}


@router.put("/auth/profile")
async def update_profile(request: Request, user=Depends(get_current_user)):
    data = await request.json()
    allowed = ["name", "phone", "sports", "preferred_position", "avatar"]
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
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
