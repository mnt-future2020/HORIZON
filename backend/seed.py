from datetime import datetime, timezone, timedelta
from database import db
from auth import hash_pw
import uuid
import logging
import re

logger = logging.getLogger("horizon")


def _make_slug(name: str) -> str:
    slug = name.lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    return re.sub(r'-+', '-', slug).strip('-')

VENUE_IMAGES = [
    "https://images.unsplash.com/photo-1763494392824-bbb80840ead4?w=800&q=80",
    "https://images.unsplash.com/photo-1750716413341-fd5d93296a76?w=800&q=80",
    "https://images.unsplash.com/photo-1770085057829-97e7a45e1916?w=800&q=80",
    "https://images.unsplash.com/photo-1750716413756-b66624b64ce4?w=800&q=80"
]


async def seed_demo_data():
    logger.info("Seeding demo data...")
    await db.users.delete_many({})
    await db.venues.delete_many({})
    await db.bookings.delete_many({})
    await db.split_payments.delete_many({})
    await db.pricing_rules.delete_many({})
    await db.match_requests.delete_many({})
    await db.mercenary_posts.delete_many({})
    await db.academies.delete_many({})
    await db.notifications.delete_many({})
    await db.notification_subscriptions.delete_many({})
    await db.platform_settings.delete_many({})

    admin_id = str(uuid.uuid4())
    owner_id = str(uuid.uuid4())
    player_id = str(uuid.uuid4())
    coach_id = str(uuid.uuid4())
    owner2_id = str(uuid.uuid4())
    owner3_id = str(uuid.uuid4())

    users = [
        {"id": admin_id, "name": "Horizon Admin", "email": "admin@horizon.com",
         "password_hash": hash_pw("admin123"), "role": "super_admin", "account_status": "active",
         "phone": "9000000000", "avatar": "", "sports": [], "preferred_position": "",
         "skill_rating": 0, "skill_deviation": 0, "reliability_score": 100,
         "total_games": 0, "wins": 0, "losses": 0, "draws": 0, "no_shows": 0,
         "business_name": "", "gst_number": "",
         "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": player_id, "name": "Arjun Kumar", "email": "demo@player.com",
         "password_hash": hash_pw("demo123"), "role": "player", "account_status": "active",
         "phone": "9876543210",
         "avatar": "", "sports": ["football", "cricket"], "preferred_position": "midfielder",
         "skill_rating": 1650, "skill_deviation": 200, "reliability_score": 92,
         "total_games": 47, "wins": 22, "losses": 18, "draws": 7, "no_shows": 1,
         "business_name": "", "gst_number": "",
         "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": owner_id, "name": "Mr. Reddy", "email": "demo@owner.com",
         "password_hash": hash_pw("demo123"), "role": "venue_owner", "account_status": "active",
         "phone": "9876543211",
         "avatar": "", "sports": [], "preferred_position": "",
         "skill_rating": 1500, "skill_deviation": 350, "reliability_score": 100,
         "total_games": 0, "wins": 0, "losses": 0, "draws": 0, "no_shows": 0,
         "business_name": "Reddy Sports Pvt Ltd", "gst_number": "29AABCR1234F1Z5",
         "subscription_plan": "pro",
         "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": coach_id, "name": "Coach Sarah", "email": "demo@coach.com",
         "password_hash": hash_pw("demo123"), "role": "coach", "account_status": "active",
         "phone": "9876543212",
         "avatar": "", "sports": ["badminton"], "preferred_position": "",
         "skill_rating": 2100, "skill_deviation": 150, "reliability_score": 98,
         "total_games": 120, "wins": 85, "losses": 30, "draws": 5, "no_shows": 0,
         "business_name": "", "gst_number": "",
         "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": owner2_id, "name": "Suresh Patel", "email": "suresh@owner.com",
         "password_hash": hash_pw("demo123"), "role": "venue_owner", "account_status": "active",
         "phone": "9876543213", "avatar": "", "sports": [], "preferred_position": "",
         "skill_rating": 1500, "skill_deviation": 350, "reliability_score": 100,
         "total_games": 0, "wins": 0, "losses": 0, "draws": 0, "no_shows": 0,
         "business_name": "Patel Sports Group", "gst_number": "33AABCP5678G1Z2",
         "subscription_plan": "pro",
         "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": owner3_id, "name": "Amit Shah", "email": "amit@owner.com",
         "password_hash": hash_pw("demo123"), "role": "venue_owner", "account_status": "active",
         "phone": "9876543214", "avatar": "", "sports": [], "preferred_position": "",
         "skill_rating": 1500, "skill_deviation": 350, "reliability_score": 100,
         "total_games": 0, "wins": 0, "losses": 0, "draws": 0, "no_shows": 0,
         "business_name": "Shah Arena Corp", "gst_number": "27AABCS9012H1Z3",
         "subscription_plan": "basic",
         "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db.users.insert_many(users)

    now = datetime.now(timezone.utc).isoformat()

    venues = [
        # --- Bengaluru ---
        {"id": str(uuid.uuid4()), "slug": _make_slug("PowerPlay Arena"), "owner_id": owner_id, "name": "PowerPlay Arena",
         "description": "Premium football turf with floodlights and changing rooms. Bengaluru's finest 5-a-side arena.",
         "sports": ["football"], "address": "123 Koramangala 5th Block", "area": "Koramangala", "city": "Bengaluru",
         "lat": 12.9352, "lng": 77.6245, "amenities": ["Parking", "Changing Rooms", "Floodlights", "Water Cooler"],
         "images": [VENUE_IMAGES[0]], "base_price": 2000, "slot_duration_minutes": 60,
         "opening_hour": 6, "closing_hour": 23, "turfs": 2, "rating": 4.6,
         "total_reviews": 128, "total_bookings": 45, "status": "active", "created_at": now},
        {"id": str(uuid.uuid4()), "slug": _make_slug("SmashPoint Courts"), "owner_id": owner_id, "name": "SmashPoint Courts",
         "description": "Professional badminton and table tennis facility. Air-conditioned indoor courts.",
         "sports": ["badminton", "table_tennis"], "address": "45 Indiranagar 12th Main", "area": "Indiranagar", "city": "Bengaluru",
         "lat": 12.9784, "lng": 77.6408, "amenities": ["AC", "Pro Shop", "Coaching", "Cafe"],
         "images": [VENUE_IMAGES[2]], "base_price": 800, "slot_duration_minutes": 60,
         "opening_hour": 7, "closing_hour": 22, "turfs": 4, "rating": 4.8,
         "total_reviews": 89, "total_bookings": 67, "status": "active", "created_at": now},
        {"id": str(uuid.uuid4()), "slug": _make_slug("The Cricket Hub"), "owner_id": owner_id, "name": "The Cricket Hub",
         "description": "Full-size cricket nets and practice pitches. Bowling machines available.",
         "sports": ["cricket"], "address": "78 HSR Layout Sector 2", "area": "HSR Layout", "city": "Bengaluru",
         "lat": 12.9081, "lng": 77.6476, "amenities": ["Bowling Machine", "Nets", "Video Analysis", "Parking"],
         "images": [VENUE_IMAGES[1]], "base_price": 2500, "slot_duration_minutes": 60,
         "opening_hour": 6, "closing_hour": 21, "turfs": 3, "rating": 4.4,
         "total_reviews": 56, "total_bookings": 32, "status": "active", "created_at": now},
        {"id": str(uuid.uuid4()), "slug": _make_slug("Goal Zone"), "owner_id": owner_id, "name": "Goal Zone",
         "description": "Budget-friendly football turf. Artificial grass, great for casual games.",
         "sports": ["football"], "address": "12 Whitefield Main Road", "area": "Whitefield", "city": "Bengaluru",
         "lat": 12.9698, "lng": 77.7500, "amenities": ["Parking", "Floodlights"],
         "images": [VENUE_IMAGES[3]], "base_price": 1500, "slot_duration_minutes": 60,
         "opening_hour": 6, "closing_hour": 23, "turfs": 1, "rating": 4.2,
         "total_reviews": 34, "total_bookings": 21, "status": "active", "created_at": now},
        {"id": str(uuid.uuid4()), "slug": _make_slug("Kick Off Bengaluru"), "owner_id": owner_id, "name": "Kick Off Bengaluru",
         "description": "State-of-the-art football complex with FIFA standard turf and night play.",
         "sports": ["football", "basketball"], "address": "56 JP Nagar 6th Phase", "area": "JP Nagar", "city": "Bengaluru",
         "lat": 12.8912, "lng": 77.5850, "amenities": ["Floodlights", "Parking", "Cafe", "First Aid", "Shower"],
         "images": [VENUE_IMAGES[0]], "base_price": 2200, "slot_duration_minutes": 60,
         "opening_hour": 5, "closing_hour": 23, "turfs": 3, "rating": 4.7,
         "total_reviews": 210, "total_bookings": 89, "status": "active", "created_at": now},

        # --- Chennai ---
        {"id": str(uuid.uuid4()), "slug": _make_slug("Marina Turf Club"), "owner_id": owner2_id, "name": "Marina Turf Club",
         "description": "Premier football and cricket facility near Marina Beach. Sea breeze included!",
         "sports": ["football", "cricket"], "address": "22 Kamaraj Salai", "area": "Adyar", "city": "Chennai",
         "lat": 13.0067, "lng": 80.2554, "amenities": ["Parking", "Floodlights", "Changing Rooms", "Cafe", "Shower"],
         "images": [VENUE_IMAGES[1]], "base_price": 1800, "slot_duration_minutes": 60,
         "opening_hour": 5, "closing_hour": 22, "turfs": 2, "rating": 4.5,
         "total_reviews": 156, "total_bookings": 78, "status": "active", "created_at": now},
        {"id": str(uuid.uuid4()), "slug": _make_slug("Velachery Sports Arena"), "owner_id": owner2_id, "name": "Velachery Sports Arena",
         "description": "Multi-sport complex with indoor badminton, basketball and outdoor football turfs.",
         "sports": ["football", "badminton", "basketball"], "address": "100ft Road, Velachery", "area": "Velachery", "city": "Chennai",
         "lat": 12.9815, "lng": 80.2180, "amenities": ["AC", "Parking", "Pro Shop", "Water Cooler", "Floodlights"],
         "images": [VENUE_IMAGES[2]], "base_price": 1200, "slot_duration_minutes": 60,
         "opening_hour": 6, "closing_hour": 23, "turfs": 4, "rating": 4.3,
         "total_reviews": 92, "total_bookings": 54, "status": "active", "created_at": now},
        {"id": str(uuid.uuid4()), "owner_id": owner2_id, "name": "T Nagar Tennis Centre",
         "description": "Professional tennis courts with clay and hard surfaces. Coaching available.",
         "sports": ["tennis"], "address": "15 GN Chetty Road", "area": "T Nagar", "city": "Chennai",
         "lat": 13.0418, "lng": 80.2341, "amenities": ["Coaching", "Pro Shop", "Parking", "Shower"],
         "images": [VENUE_IMAGES[3]], "base_price": 1500, "slot_duration_minutes": 60,
         "opening_hour": 6, "closing_hour": 21, "turfs": 3, "rating": 4.6,
         "total_reviews": 67, "total_bookings": 38, "status": "active", "created_at": now},
        {"id": str(uuid.uuid4()), "owner_id": owner2_id, "name": "OMR Football Factory",
         "description": "Budget turf on the IT corridor. Perfect for post-work games.",
         "sports": ["football"], "address": "Thoraipakkam Signal", "area": "OMR", "city": "Chennai",
         "lat": 12.9406, "lng": 80.2335, "amenities": ["Parking", "Floodlights", "Water Cooler"],
         "images": [VENUE_IMAGES[0]], "base_price": 1000, "slot_duration_minutes": 60,
         "opening_hour": 6, "closing_hour": 23, "turfs": 2, "rating": 4.1,
         "total_reviews": 45, "total_bookings": 28, "status": "active", "created_at": now},

        # --- Mumbai ---
        {"id": str(uuid.uuid4()), "owner_id": owner3_id, "name": "Andheri Sports Complex",
         "description": "Multi-sport facility in the heart of Mumbai. Football, cricket, and more.",
         "sports": ["football", "cricket", "basketball"], "address": "Andheri West, Off Link Road", "area": "Andheri", "city": "Mumbai",
         "lat": 19.1365, "lng": 72.8296, "amenities": ["Parking", "Floodlights", "Changing Rooms", "Cafe", "First Aid"],
         "images": [VENUE_IMAGES[1]], "base_price": 3000, "slot_duration_minutes": 60,
         "opening_hour": 6, "closing_hour": 23, "turfs": 3, "rating": 4.5,
         "total_reviews": 234, "total_bookings": 120, "status": "active", "created_at": now},
        {"id": str(uuid.uuid4()), "owner_id": owner3_id, "name": "Powai Pitch",
         "description": "Premium football turf near IIT Bombay. Great for college and corporate games.",
         "sports": ["football"], "address": "Hiranandani Gardens, Powai", "area": "Powai", "city": "Mumbai",
         "lat": 19.1176, "lng": 72.9060, "amenities": ["Parking", "Floodlights", "Shower", "Cafe"],
         "images": [VENUE_IMAGES[0]], "base_price": 2800, "slot_duration_minutes": 60,
         "opening_hour": 6, "closing_hour": 22, "turfs": 2, "rating": 4.7,
         "total_reviews": 178, "total_bookings": 95, "status": "active", "created_at": now},
        {"id": str(uuid.uuid4()), "owner_id": owner3_id, "name": "BKC Badminton Hub",
         "description": "Indoor air-conditioned badminton courts in Bandra-Kurla Complex.",
         "sports": ["badminton", "table_tennis"], "address": "BKC, Bandra East", "area": "BKC", "city": "Mumbai",
         "lat": 19.0596, "lng": 72.8656, "amenities": ["AC", "Pro Shop", "Coaching", "Parking", "Cafe"],
         "images": [VENUE_IMAGES[2]], "base_price": 1200, "slot_duration_minutes": 60,
         "opening_hour": 7, "closing_hour": 22, "turfs": 6, "rating": 4.8,
         "total_reviews": 145, "total_bookings": 88, "status": "active", "created_at": now},

        # --- Hyderabad ---
        {"id": str(uuid.uuid4()), "owner_id": owner2_id, "name": "HITEC City Sports Hub",
         "description": "Modern sports complex for IT professionals. Football, cricket, and badminton.",
         "sports": ["football", "cricket", "badminton"], "address": "Cyber Towers Road", "area": "HITEC City", "city": "Hyderabad",
         "lat": 17.4435, "lng": 78.3772, "amenities": ["AC", "Parking", "Floodlights", "Cafe", "Shower", "Changing Rooms"],
         "images": [VENUE_IMAGES[3]], "base_price": 1600, "slot_duration_minutes": 60,
         "opening_hour": 5, "closing_hour": 23, "turfs": 4, "rating": 4.6,
         "total_reviews": 187, "total_bookings": 96, "status": "active", "created_at": now},
        {"id": str(uuid.uuid4()), "owner_id": owner2_id, "name": "Gachibowli Stadium Turf",
         "description": "Adjacent to the Gachibowli stadium. International-quality surfaces.",
         "sports": ["football", "tennis"], "address": "Near Gachibowli Stadium", "area": "Gachibowli", "city": "Hyderabad",
         "lat": 17.4156, "lng": 78.3486, "amenities": ["Parking", "Floodlights", "Video Analysis", "Nets", "Water Cooler"],
         "images": [VENUE_IMAGES[1]], "base_price": 1400, "slot_duration_minutes": 60,
         "opening_hour": 6, "closing_hour": 22, "turfs": 2, "rating": 4.4,
         "total_reviews": 98, "total_bookings": 52, "status": "active", "created_at": now},

        # --- Delhi ---
        {"id": str(uuid.uuid4()), "owner_id": owner3_id, "name": "Connaught Place Indoor",
         "description": "Central Delhi's premium indoor sports venue. Badminton, TT and basketball.",
         "sports": ["badminton", "table_tennis", "basketball"], "address": "Inner Circle, CP", "area": "Connaught Place", "city": "Delhi",
         "lat": 28.6315, "lng": 77.2167, "amenities": ["AC", "Parking", "Pro Shop", "Cafe", "First Aid"],
         "images": [VENUE_IMAGES[2]], "base_price": 1800, "slot_duration_minutes": 60,
         "opening_hour": 8, "closing_hour": 22, "turfs": 5, "rating": 4.3,
         "total_reviews": 112, "total_bookings": 65, "status": "active", "created_at": now},
        {"id": str(uuid.uuid4()), "owner_id": owner3_id, "name": "Dwarka Football Grounds",
         "description": "Large outdoor football facility in Dwarka. Multiple turfs for tournaments.",
         "sports": ["football", "cricket"], "address": "Sector 21, Dwarka", "area": "Dwarka", "city": "Delhi",
         "lat": 28.5733, "lng": 77.0421, "amenities": ["Parking", "Floodlights", "Changing Rooms", "Water Cooler"],
         "images": [VENUE_IMAGES[3]], "base_price": 2200, "slot_duration_minutes": 60,
         "opening_hour": 5, "closing_hour": 22, "turfs": 4, "rating": 4.1,
         "total_reviews": 78, "total_bookings": 41, "status": "active", "created_at": now},
    ]
    await db.venues.insert_many(venues)

    # Use first 4 venue IDs for existing references
    v_ids = [v["id"] for v in venues[:4]]

    pricing_rules = [
        {"id": str(uuid.uuid4()), "venue_id": v_ids[0], "name": "Weekend Surge",
         "priority": 10, "conditions": {"days": [5, 6], "time_range": {"start": "18:00", "end": "22:00"}},
         "action": {"type": "multiplier", "value": 1.2}, "is_active": True,
         "created_at": now},
        {"id": str(uuid.uuid4()), "venue_id": v_ids[0], "name": "Early Bird Discount",
         "priority": 5, "conditions": {"time_range": {"start": "06:00", "end": "09:00"}},
         "action": {"type": "multiplier", "value": 0.85}, "is_active": True,
         "created_at": now},
        {"id": str(uuid.uuid4()), "venue_id": v_ids[0], "name": "Peak Hours",
         "priority": 8, "conditions": {"days": [0, 1, 2, 3, 4], "time_range": {"start": "18:00", "end": "21:00"}},
         "action": {"type": "multiplier", "value": 1.1}, "is_active": True,
         "created_at": now},
    ]
    await db.pricing_rules.insert_many(pricing_rules)

    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
    next_week = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d")

    match_requests = [
        {"id": str(uuid.uuid4()), "creator_id": player_id, "creator_name": "Arjun Kumar",
         "sport": "football", "date": tomorrow, "time": "18:00",
         "venue_name": "PowerPlay Arena", "players_needed": 10, "min_skill": 1200,
         "max_skill": 2000, "description": "Friendly 5v5 after work. All levels welcome!",
         "players_joined": [player_id], "player_names": ["Arjun Kumar"],
         "status": "open", "created_at": now},
        {"id": str(uuid.uuid4()), "creator_id": str(uuid.uuid4()), "creator_name": "Vikram Shah",
         "sport": "cricket", "date": next_week, "time": "09:00",
         "venue_name": "The Cricket Hub", "players_needed": 22, "min_skill": 1000,
         "max_skill": 3000, "description": "Weekend cricket match. Need full teams!",
         "players_joined": [], "player_names": [],
         "status": "open", "created_at": now},
    ]
    await db.match_requests.insert_many(match_requests)

    merc_booking_1 = {
        "id": str(uuid.uuid4()), "venue_id": venues[0]["id"],
        "venue_name": "PowerPlay Arena", "host_id": player_id,
        "host_name": "Arjun Kumar", "date": tomorrow,
        "start_time": "19:00", "end_time": "20:00",
        "turf_number": 1, "sport": "football",
        "total_amount": 2400, "commission_amount": 240,
        "payment_mode": "full", "payment_gateway": "mock",
        "players": [player_id], "status": "confirmed",
        "created_at": now
    }
    merc_booking_2 = {
        "id": str(uuid.uuid4()), "venue_id": venues[1]["id"],
        "venue_name": "SmashPoint Courts", "host_id": coach_id,
        "host_name": "Coach Sarah", "date": tomorrow,
        "start_time": "20:00", "end_time": "21:00",
        "turf_number": 1, "sport": "badminton",
        "total_amount": 800, "commission_amount": 80,
        "payment_mode": "full", "payment_gateway": "mock",
        "players": [coach_id], "status": "confirmed",
        "created_at": now
    }
    await db.bookings.insert_many([merc_booking_1, merc_booking_2])

    mercenary_posts = [
        {"id": str(uuid.uuid4()), "host_id": player_id, "host_name": "Arjun Kumar",
         "booking_id": merc_booking_1["id"], "venue_id": venues[0]["id"],
         "sport": "football", "venue_name": "PowerPlay Arena",
         "date": tomorrow, "time": "19:00", "position_needed": "Goalkeeper",
         "description": "Need a GK for 5v5 friendly. Intermediate level preferred.",
         "amount_per_player": 200, "spots_available": 2, "spots_filled": 0,
         "applicants": [], "accepted": [], "paid_players": [], "status": "open",
         "created_at": now},
        {"id": str(uuid.uuid4()), "host_id": coach_id, "host_name": "Coach Sarah",
         "booking_id": merc_booking_2["id"], "venue_id": venues[1]["id"],
         "sport": "badminton", "venue_name": "SmashPoint Courts",
         "date": tomorrow, "time": "20:00", "position_needed": "Doubles Partner",
         "description": "Looking for a strong doubles partner for practice session.",
         "amount_per_player": 400, "spots_available": 1, "spots_filled": 0,
         "applicants": [], "accepted": [], "paid_players": [], "status": "open",
         "created_at": now},
    ]
    await db.mercenary_posts.insert_many(mercenary_posts)

    academy = {
        "id": str(uuid.uuid4()), "coach_id": coach_id, "coach_name": "Coach Sarah",
        "name": "Sarah's Badminton Academy", "sport": "badminton",
        "description": "Professional badminton coaching for all ages. From beginners to advanced.",
        "monthly_fee": 2000, "location": "SmashPoint Courts, Indiranagar",
        "max_students": 50, "schedule": "Mon/Wed/Fri 5-7 PM, Sat 9-12 PM",
        "current_students": 3,
        "students": [
            {"id": str(uuid.uuid4()), "name": "Rahul Mehta", "email": "rahul@test.com",
             "phone": "9999888877", "joined_at": "2026-01-15T10:00:00Z", "subscription_status": "active"},
            {"id": str(uuid.uuid4()), "name": "Ananya Iyer", "email": "ananya@test.com",
             "phone": "9999888866", "joined_at": "2026-01-20T10:00:00Z", "subscription_status": "active"},
            {"id": str(uuid.uuid4()), "name": "Dev Patel", "email": "dev@test.com",
             "phone": "9999888855", "joined_at": "2026-02-01T10:00:00Z", "subscription_status": "pending"},
        ],
        "status": "active",
        "created_at": now
    }
    await db.academies.insert_one(academy)

    await db.platform_settings.insert_one({
        "key": "platform",
        "payment_gateway": {"provider": "razorpay", "key_id": "", "key_secret": "", "is_live": False},
        "booking_commission_pct": 10,
        "subscription_plans": [
            {"id": "free", "name": "Free", "price": 0, "features": ["1 venue", "Basic analytics"], "max_venues": 1},
            {"id": "basic", "name": "Basic", "price": 2999, "features": ["3 venues", "Advanced analytics", "Priority support"], "max_venues": 3},
            {"id": "pro", "name": "Pro", "price": 7999, "features": ["Unlimited venues", "Full analytics", "Dedicated support", "Custom branding"], "max_venues": 100},
        ]
    })

    # --- IoT Seed Data ---
    await db.iot_devices.delete_many({})
    await db.iot_zones.delete_many({})
    await db.iot_energy_logs.delete_many({})

    zone_ids = [str(uuid.uuid4()) for _ in range(3)]
    iot_zones = [
        {"id": zone_ids[0], "venue_id": v_ids[0], "name": "Turf 1 Main", "turf_number": 1,
         "description": "Primary floodlight zone for Turf 1", "created_at": now},
        {"id": zone_ids[1], "venue_id": v_ids[0], "name": "Turf 2 Main", "turf_number": 2,
         "description": "Primary floodlight zone for Turf 2", "created_at": now},
        {"id": zone_ids[2], "venue_id": v_ids[0], "name": "Common Area", "turf_number": None,
         "description": "Parking, entrance, and walkway lights", "created_at": now},
    ]
    await db.iot_zones.insert_many(iot_zones)

    iot_devices = [
        {"id": str(uuid.uuid4()), "venue_id": v_ids[0], "name": "Turf 1 - North Flood",
         "zone_id": zone_ids[0], "device_type": "floodlight", "protocol": "mqtt",
         "mqtt_topic": "horizon/powerplay/turf1/north", "ip_address": "192.168.1.101",
         "power_watts": 1000, "turf_number": 1, "status": "on", "brightness": 100,
         "is_online": True, "auto_schedule": True,
         "last_seen": now, "created_at": now, "total_runtime_minutes": 4320},
        {"id": str(uuid.uuid4()), "venue_id": v_ids[0], "name": "Turf 1 - South Flood",
         "zone_id": zone_ids[0], "device_type": "floodlight", "protocol": "mqtt",
         "mqtt_topic": "horizon/powerplay/turf1/south", "ip_address": "192.168.1.102",
         "power_watts": 1000, "turf_number": 1, "status": "on", "brightness": 100,
         "is_online": True, "auto_schedule": True,
         "last_seen": now, "created_at": now, "total_runtime_minutes": 4280},
        {"id": str(uuid.uuid4()), "venue_id": v_ids[0], "name": "Turf 1 - East LED",
         "zone_id": zone_ids[0], "device_type": "led_panel", "protocol": "mqtt",
         "mqtt_topic": "horizon/powerplay/turf1/east", "ip_address": "192.168.1.103",
         "power_watts": 300, "turf_number": 1, "status": "off", "brightness": 0,
         "is_online": True, "auto_schedule": True,
         "last_seen": now, "created_at": now, "total_runtime_minutes": 2150},
        {"id": str(uuid.uuid4()), "venue_id": v_ids[0], "name": "Turf 2 - Main Flood",
         "zone_id": zone_ids[1], "device_type": "floodlight", "protocol": "mqtt",
         "mqtt_topic": "horizon/powerplay/turf2/main", "ip_address": "192.168.1.201",
         "power_watts": 1500, "turf_number": 2, "status": "off", "brightness": 0,
         "is_online": True, "auto_schedule": True,
         "last_seen": now, "created_at": now, "total_runtime_minutes": 3800},
        {"id": str(uuid.uuid4()), "venue_id": v_ids[0], "name": "Turf 2 - Auxiliary LED",
         "zone_id": zone_ids[1], "device_type": "led_panel", "protocol": "http",
         "mqtt_topic": None, "ip_address": "192.168.1.202",
         "power_watts": 400, "turf_number": 2, "status": "off", "brightness": 0,
         "is_online": False, "auto_schedule": True,
         "last_seen": (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat(),
         "created_at": now, "total_runtime_minutes": 1200},
        {"id": str(uuid.uuid4()), "venue_id": v_ids[0], "name": "Parking Lights",
         "zone_id": zone_ids[2], "device_type": "ambient", "protocol": "mqtt",
         "mqtt_topic": "horizon/powerplay/common/parking", "ip_address": "192.168.1.50",
         "power_watts": 200, "turf_number": None, "status": "on", "brightness": 60,
         "is_online": True, "auto_schedule": False,
         "last_seen": now, "created_at": now, "total_runtime_minutes": 8500},
        {"id": str(uuid.uuid4()), "venue_id": v_ids[0], "name": "Emergency Exit",
         "zone_id": zone_ids[2], "device_type": "emergency", "protocol": "http",
         "mqtt_topic": None, "ip_address": "192.168.1.51",
         "power_watts": 50, "turf_number": None, "status": "on", "brightness": 100,
         "is_online": True, "auto_schedule": False,
         "last_seen": now, "created_at": now, "total_runtime_minutes": 12000},
    ]
    await db.iot_devices.insert_many(iot_devices)

    logger.info("Demo data seeded successfully!")
