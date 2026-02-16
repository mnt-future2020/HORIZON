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

app = FastAPI(title="Horizon Sports API")

# Include all routers with /api prefix
for r in [auth_router, venues_router, bookings_router, matchmaking_router,
          notifications_router, admin_router, academies_router, analytics_router,
          ratings_router]:
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


@app.on_event("startup")
async def startup():
    await init_redis()
    count = await db.users.count_documents({})
    if count == 0:
        await seed_demo_data()


@app.on_event("shutdown")
async def shutdown():
    await close_connections()
