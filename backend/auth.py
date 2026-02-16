from fastapi import Request, HTTPException
from passlib.context import CryptContext
from jose import jwt, JWTError
from database import db
import os
import razorpay

JWT_SECRET = os.environ.get('JWT_SECRET', 'horizon-default-secret')
JWT_ALGORITHM = "HS256"
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_pw(pw: str) -> str:
    return pwd_ctx.hash(pw)


def verify_pw(pw: str, hashed: str) -> bool:
    return pwd_ctx.verify(pw, hashed)


def create_token(user_id: str, role: str) -> str:
    return jwt.encode({"sub": user_id, "role": role}, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


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
