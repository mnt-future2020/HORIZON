from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
import os
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import secrets

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from database import db, init_redis, close_connections
from auth import get_current_user
from seed import seed_demo_data
from routes.auth import router as auth_router
from routes.venues import router as venues_router
from routes.bookings import router as bookings_router
from routes.matchmaking import router as matchmaking_router
from routes.notifications import router as notifications_router
from routes.admin import router as admin_router
from routes.academies import router as academies_router
from routes.analytics import router as analytics_router
from routes.ratings import router as ratings_router
from routes.highlights import router as highlights_router
from routes.iot import router as iot_router
from routes.reviews import router as reviews_router
from routes.pos import router as pos_router
from routes.waitlist import router as waitlist_router
from routes.compliance import router as compliance_router
from routes.subscriptions import router as subscriptions_router
from routes.social import router as social_router
from routes.tournaments import router as tournaments_router
from routes.coaching import router as coaching_router
from routes.coach_clients import router as coach_clients_router
from routes.coach_offline import router as coach_offline_router
from routes.coach_finance import router as coach_finance_router
from routes.communities import router as communities_router
from routes.recommendations import router as recommendations_router
from routes.organizations import router as organizations_router
from routes.performance import router as performance_router
from routes.training import router as training_router
from routes.live_scoring import router as live_scoring_router
from routes.coach_reminders import (
    router as coach_reminders_router,
    run_daily_reminders,
    run_session_reminders,
    run_package_expiry_reminders,
    run_no_show_followup,
    run_monthly_progress,
)
from routes.coach_whatsapp import router as coach_whatsapp_router
from routes.coach_invoices import router as coach_invoices_router
from routes.payouts import router as payouts_router
from routes.venue_finance import router as venue_finance_router
from routes.venue_invoices import router as venue_invoices_router
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from indexes import ensure_indexes

scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")

from fastapi.staticfiles import StaticFiles


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


app = FastAPI(title="Lobbi API")

app.add_middleware(SecurityHeadersMiddleware)

# HIGH FIX: Serve uploaded files with path traversal protection
# Replaced open StaticFiles mount with a controlled endpoint
uploads_dir = ROOT_DIR / "uploads"
uploads_dir.mkdir(exist_ok=True)

from fastapi.responses import FileResponse
import mimetypes

@app.get("/api/uploads/{file_path:path}")
async def serve_upload(file_path: str):
    """Serve uploaded files with path traversal protection."""
    full_path = (uploads_dir / file_path).resolve()
    # Prevent directory traversal attacks (e.g., ../../etc/passwd)
    if not str(full_path).startswith(str(uploads_dir.resolve())):
        raise HTTPException(403, "Access denied")
    if not full_path.exists() or not full_path.is_file():
        raise HTTPException(404, "File not found")
    content_type = mimetypes.guess_type(str(full_path))[0] or "application/octet-stream"
    return FileResponse(full_path, media_type=content_type)

# Include all routers — prefix is configurable for platforms that strip path prefixes (e.g. DigitalOcean App Platform)
API_PREFIX = os.environ.get("API_PREFIX", "/api")
for r in [auth_router, venues_router, bookings_router, matchmaking_router,
          notifications_router, admin_router, academies_router, analytics_router,
          ratings_router, highlights_router, iot_router, reviews_router, pos_router,
          waitlist_router, compliance_router, subscriptions_router,
          social_router, tournaments_router, coaching_router, coach_clients_router,
          coach_offline_router, coach_finance_router, communities_router,
          recommendations_router, organizations_router, performance_router,
          training_router, live_scoring_router, coach_reminders_router,
          coach_whatsapp_router, coach_invoices_router, payouts_router,
          venue_finance_router, venue_invoices_router]:
    app.include_router(r, prefix=API_PREFIX)


# Seed endpoint (admin only)
@app.post(f"{API_PREFIX}/seed")
async def seed(user=Depends(get_current_user)):
    if user["role"] != "super_admin":
        raise HTTPException(403, "Admin only")
    # HIGH FIX: Case-insensitive check — "Production", "PRODUCTION", " production " all match
    if os.environ.get("ENVIRONMENT", "development").strip().lower() == "production":
        raise HTTPException(403, "Seed endpoint is disabled in production")
    await seed_demo_data()
    return {"message": "Demo data seeded"}


# Health check endpoint (for Docker + monitoring)
@app.get(f"{API_PREFIX}/health")
async def health_check():
    try:
        await db.command("ping")
        db_status = "ok"
    except Exception:
        db_status = "error"
    return {"status": "ok", "database": db_status, "environment": os.environ.get("ENVIRONMENT", "development")}


# Contact form endpoint
from fastapi import Request as FastAPIRequest
from datetime import datetime as dt, timezone as tz
from tz import now_ist
import uuid as _uuid

@app.post(f"{API_PREFIX}/contact")
async def submit_contact(request: FastAPIRequest):
    data = await request.json()
    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    subject = data.get("subject", "").strip()
    message = data.get("message", "").strip()
    if not name or not email or not message:
        from fastapi import HTTPException
        raise HTTPException(400, "Name, email, and message are required")
    if len(name) > 100 or len(email) > 254 or len(subject) > 200 or len(message) > 5000:
        raise HTTPException(400, "Input exceeds maximum length")
    import re as _re
    if not _re.match(r'^[^@]+@[^@]+\.[^@]+$', email):
        raise HTTPException(400, "Invalid email format")
    entry = {
        "id": str(_uuid.uuid4()),
        "name": name,
        "email": email,
        "subject": subject,
        "message": message,
        "status": "new",
        "created_at": now_ist().isoformat(),
    }
    await db.contact_messages.insert_one(entry)
    entry.pop("_id", None)
    return {"message": "Message received. We'll get back to you within 24 hours.", "id": entry["id"]}


cors_origins = [o.strip() for o in os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(',') if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

import mqtt_service


@app.on_event("startup")
async def startup():
    jwt_secret = os.environ.get('JWT_SECRET', '')
    if not jwt_secret or jwt_secret == 'supersecretkey':
        if os.environ.get("ENVIRONMENT", "").strip().lower() == "production":
            raise RuntimeError("CRITICAL: JWT_SECRET must be set to a strong secret in production!")
        logger.warning("Using default JWT_SECRET - change this before deploying to production!")
    # HIGH FIX: MongoDB connection retry with exponential backoff
    import asyncio as _asyncio
    for attempt in range(3):
        try:
            await db.command("ping")
            logger.info("MongoDB connected successfully")
            break
        except Exception as e:
            if attempt < 2:
                wait = 2 ** attempt
                logger.warning(f"MongoDB connection failed (attempt {attempt+1}/3), retrying in {wait}s: {e}")
                await _asyncio.sleep(wait)
            else:
                logger.error(f"MongoDB connection failed after 3 attempts: {e}")
                raise RuntimeError(f"Cannot connect to MongoDB: {e}")

    await init_redis()
    await ensure_indexes(db)
    # Migrate existing venues without slugs (one-time, skips if none found)
    import re
    venues_without_slug = await db.venues.find({"slug": {"$exists": False}}, {"_id": 0, "id": 1, "name": 1}).limit(100).to_list(100)
    for v in venues_without_slug:
        base = re.sub(r'[^a-z0-9\s-]', '', v["name"].lower())
        base = re.sub(r'[\s_]+', '-', base).strip('-')
        slug = base
        counter = 1
        while await db.venues.find_one({"slug": slug, "id": {"$ne": v["id"]}}):
            slug = f"{base}-{counter}"
            counter += 1
        await db.venues.update_one({"id": v["id"]}, {"$set": {"slug": slug}})
    # Connect to MQTT broker (non-blocking, graceful failure)
    try:
        await mqtt_service.connect()
    except Exception as e:
        logging.warning(f"MQTT connection failed on startup: {e}")
    # Start WhatsApp automation scheduler (only on designated leader to avoid duplicates in multi-pod)
    if os.environ.get("SCHEDULER_ENABLED", "true").strip().lower() == "true":
        scheduler.add_job(run_daily_reminders,         "cron", hour=9,  minute=0,  id="daily_reminders",    replace_existing=True)
        scheduler.add_job(run_package_expiry_reminders,"cron", hour=9,  minute=30, id="package_expiry",     replace_existing=True)
        scheduler.add_job(run_session_reminders,       "cron", hour=20, minute=0,  id="session_reminders",  replace_existing=True)
        scheduler.add_job(run_no_show_followup,        "cron", hour=21, minute=0,  id="no_show_followup",   replace_existing=True)
        scheduler.add_job(run_monthly_progress,        "cron", day="last", hour=20, minute=0, id="monthly_progress", replace_existing=True)
        scheduler.start()
        logger.info("WhatsApp automation scheduler started (5 jobs)")
    else:
        logger.info("Scheduler disabled on this instance (SCHEDULER_ENABLED != true)")


@app.on_event("shutdown")
async def shutdown():
    if scheduler.running:
        scheduler.shutdown(wait=False)
    await mqtt_service.disconnect()
    await close_connections()
