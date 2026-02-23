from fastapi import Request, HTTPException
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timezone, timedelta
from database import db
import os
import re
import secrets
import razorpay

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRY_HOURS = 2
REFRESH_TOKEN_EXPIRY_DAYS = 7

_ENVIRONMENT = os.environ.get("ENVIRONMENT", "development").strip().lower()
import logging as _logging
_auth_logger = _logging.getLogger("horizon")

# --- CRITICAL FIX: Validate JWT_SECRET ---
JWT_SECRET = os.environ.get("JWT_SECRET", "").strip()
if not JWT_SECRET:
    if _ENVIRONMENT == "production":
        raise RuntimeError("FATAL: JWT_SECRET environment variable is required in production. Set a strong random secret (e.g. `openssl rand -hex 64`).")
    JWT_SECRET = secrets.token_hex(32)
    _auth_logger.warning("JWT_SECRET not set — using auto-generated secret. This is NOT safe for production!")

# --- CRITICAL FIX: Validate REFRESH_SECRET ---
REFRESH_SECRET = os.environ.get("REFRESH_SECRET", "").strip()
if not REFRESH_SECRET:
    if _ENVIRONMENT == "production":
        raise RuntimeError("FATAL: REFRESH_SECRET environment variable is required in production. Set a strong random secret (e.g. `openssl rand -hex 64`).")
    REFRESH_SECRET = secrets.token_hex(32)
    _auth_logger.warning("REFRESH_SECRET not set — using auto-generated secret. This is NOT safe for production!")

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Password strength requirements
PASSWORD_MIN_LENGTH = 8
PASSWORD_PATTERN = re.compile(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$')


def validate_password_strength(password: str):
    """Validate password meets minimum security requirements."""
    if len(password) < PASSWORD_MIN_LENGTH:
        raise HTTPException(400, f"Password must be at least {PASSWORD_MIN_LENGTH} characters")
    if not PASSWORD_PATTERN.match(password):
        raise HTTPException(400, "Password must contain at least one uppercase letter, one lowercase letter, and one number")


def hash_pw(pw: str) -> str:
    return pwd_ctx.hash(pw)


def verify_pw(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)


def create_token(uid: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": uid, "role": role, "type": "access", "iat": now, "exp": now + timedelta(hours=ACCESS_TOKEN_EXPIRY_HOURS)},
        JWT_SECRET, algorithm=JWT_ALGORITHM
    )


def create_refresh_token(uid: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": uid, "role": role, "type": "refresh", "iat": now, "exp": now + timedelta(days=REFRESH_TOKEN_EXPIRY_DAYS)},
        REFRESH_SECRET, algorithm=JWT_ALGORITHM
    )


def verify_refresh_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, REFRESH_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(401, "Invalid token type")
        return payload
    except JWTError:
        raise HTTPException(401, "Invalid or expired refresh token")


async def get_current_user(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") == "refresh":
            raise HTTPException(401, "Cannot use refresh token for API access")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(401, "User not found")
        if user.get("account_status") in ("suspended", "deleted"):
            raise HTTPException(403, "Account is suspended or deactivated")
        # MEDIUM FIX: Token revocation — reject tokens issued before password change/forced logout
        invalidated_at = user.get("token_invalidated_at")
        token_iat = payload.get("iat")
        if invalidated_at and token_iat:
            inv_ts = datetime.fromisoformat(invalidated_at).timestamp() if isinstance(invalidated_at, str) else invalidated_at
            if token_iat < inv_ts:
                raise HTTPException(401, "Token has been revoked. Please log in again.")
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


async def invalidate_user_tokens(user_id: str):
    """Revoke all existing tokens for a user by setting token_invalidated_at.
    Call this after password change, forced logout, account suspension, etc."""
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"token_invalidated_at": datetime.now(timezone.utc).isoformat()}}
    )


async def require_admin(user):
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Super admin access required")
