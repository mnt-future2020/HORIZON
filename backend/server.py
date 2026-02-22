from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
import os
import logging

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
from routes.pricing_ml import router as pricing_ml_router
from routes.social import router as social_router
from routes.tournaments import router as tournaments_router
from routes.coaching import router as coaching_router
from routes.communities import router as communities_router
from routes.recommendations import router as recommendations_router
from routes.organizations import router as organizations_router
from routes.performance import router as performance_router
from routes.training import router as training_router
from routes.live_scoring import router as live_scoring_router

from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Horizon Sports API")

# Serve uploaded files (chat media, etc.)
uploads_dir = ROOT_DIR / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

# Include all routers with /api prefix
for r in [auth_router, venues_router, bookings_router, matchmaking_router,
          notifications_router, admin_router, academies_router, analytics_router,
          ratings_router, highlights_router, iot_router, reviews_router, pos_router,
          waitlist_router, compliance_router, subscriptions_router, pricing_ml_router,
          social_router, tournaments_router, coaching_router, communities_router,
          recommendations_router, organizations_router, performance_router,
          training_router, live_scoring_router]:
    app.include_router(r, prefix="/api")


# Seed endpoint (admin only)
@app.post("/api/seed")
async def seed(user=Depends(get_current_user)):
    if user["role"] != "super_admin":
        raise HTTPException(403, "Admin only")
    await seed_demo_data()
    return {"message": "Demo data seeded"}


# Contact form endpoint
from fastapi import Request as FastAPIRequest
from datetime import datetime as dt, timezone as tz
import uuid as _uuid

@app.post("/api/contact")
async def submit_contact(request: FastAPIRequest):
    data = await request.json()
    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    subject = data.get("subject", "").strip()
    message = data.get("message", "").strip()
    if not name or not email or not message:
        from fastapi import HTTPException
        raise HTTPException(400, "Name, email, and message are required")
    entry = {
        "id": str(_uuid.uuid4()),
        "name": name,
        "email": email,
        "subject": subject,
        "message": message,
        "status": "new",
        "created_at": dt.now(tz.utc).isoformat(),
    }
    await db.contact_messages.insert_one(entry)
    entry.pop("_id", None)
    return {"message": "Message received. We'll get back to you within 24 hours.", "id": entry["id"]}


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

import mqtt_service


@app.on_event("startup")
async def startup():
    if os.environ.get('JWT_SECRET', 'supersecretkey') == 'supersecretkey':
        logger.warning("Using default JWT_SECRET - change this for production!")
    await init_redis()
    # Migrate existing venues without slugs
    import re
    venues_without_slug = await db.venues.find({"slug": {"$exists": False}}, {"_id": 0, "id": 1, "name": 1}).to_list(1000)
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


@app.on_event("shutdown")
async def shutdown():
    await mqtt_service.disconnect()
    await close_connections()
