from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
import os
import logging

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from database import db, init_redis, close_connections
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

app = FastAPI(title="Horizon Sports API")

# Include all routers with /api prefix
for r in [auth_router, venues_router, bookings_router, matchmaking_router,
          notifications_router, admin_router, academies_router, analytics_router,
          ratings_router, highlights_router, iot_router, reviews_router, pos_router]:
    app.include_router(r, prefix="/api")


# Seed endpoint
@app.post("/api/seed")
async def seed():
    await seed_demo_data()
    return {"message": "Demo data seeded"}


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

import mqtt_service


@app.on_event("startup")
async def startup():
    await init_redis()
    count = await db.users.count_documents({})
    if count == 0:
        await seed_demo_data()
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
