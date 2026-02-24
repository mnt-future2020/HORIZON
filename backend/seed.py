from datetime import datetime, timezone
from database import db
from auth import hash_pw
import uuid
import logging

logger = logging.getLogger("horizon")


async def seed_demo_data():
    """Seed only essential data: admin user + platform settings. DB stays fresh."""
    logger.info("Seeding fresh database...")

    # Clear ALL collections
    for col_name in await db.list_collection_names():
        await db[col_name].delete_many({})

    # --- Admin User ---
    admin_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": admin_id, "name": "Horizon Admin", "email": "admin@horizon.com",
        "password_hash": hash_pw("admin123"), "role": "super_admin", "account_status": "active",
        "phone": "9000000000", "avatar": "", "sports": [], "preferred_position": "",
        "skill_rating": 0, "skill_deviation": 0, "reliability_score": 100,
        "total_games": 0, "wins": 0, "losses": 0, "draws": 0, "no_shows": 0,
        "business_name": "", "gst_number": "",
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    # --- Platform Settings ---
    await db.platform_settings.insert_one({
        "key": "platform",
        "payment_gateway": {"provider": "razorpay", "key_id": "", "key_secret": "", "is_live": False},
        "booking_commission_pct": 10,
        "coaching_commission_pct": 10,
        "tournament_commission_pct": 10,
        "s3_storage": {"access_key_id": "", "secret_access_key": "", "bucket_name": "", "region": "ap-south-1", "enabled": False},
        "whatsapp": {"phone_number_id": "", "access_token": "", "business_phone": ""},
        "subscription_plans": [
            {"id": "free", "name": "Free", "price": 0, "features": ["1 venue", "Basic analytics"], "max_venues": 1},
            {"id": "basic", "name": "Basic", "price": 2999, "features": ["3 venues", "Advanced analytics", "Priority support"], "max_venues": 3},
            {"id": "pro", "name": "Pro", "price": 7999, "features": ["Unlimited venues", "Full analytics", "Dedicated support", "Custom branding"], "max_venues": 100},
        ]
    })

    logger.info("Fresh database seeded — admin user + platform settings only.")
