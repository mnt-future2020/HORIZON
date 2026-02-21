from fastapi import Request, HTTPException
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timezone, timedelta
from database import db
import os
import razorpay

JWT_SECRET = os.environ.get('JWT_SECRET')
JWT_ALGORITHM = "HS256"
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_pw(pw: str) -> str:
    return pwd_ctx.hash(pw)


def verify_pw(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)


def create_token(uid: str, role: str) -> str:
    return jwt.encode(
        {"sub": uid, "role": role, "exp": datetime.now(timezone.utc) + timedelta(hours=72)},
        JWT_SECRET, algorithm=JWT_ALGORITHM
    )


async def get_current_user(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(401, "User not found")
        if user.get("account_status") in ("suspended", "deleted"):
            raise HTTPException(403, "Account is suspended or deactivated")
        return user
    except JWTError:
        raise HTTPException(401, "Invalid token")


async def get_optional_user(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    except Exception:
        return None


async def get_razorpay_client():
    settings = await db.platform_settings.find_one({"key": "platform"}, {"_id": 0})
    if not settings:
        return None
    gw = settings.get("payment_gateway", {})
    key_id = gw.get("key_id", "")
    key_secret = gw.get("key_secret", "")
    if not key_id or not key_secret:
        return None
    return razorpay.Client(auth=(key_id, key_secret))


async def get_platform_settings():
    settings = await db.platform_settings.find_one({"key": "platform"}, {"_id": 0})
    return settings or {}


async def require_admin(user):
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Super admin access required")
