from datetime import datetime, timezone, timedelta
from database import db
from auth import hash_pw
import uuid
import random
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
        "academy_commission_pct": 10,
        "s3_storage": {"access_key_id": "", "secret_access_key": "", "bucket_name": "", "region": "ap-south-1", "enabled": False},
        "whatsapp": {"phone_number_id": "", "access_token": "", "business_phone": ""},
        "subscription_plans": [
            {"id": "free", "name": "Free", "price": 0, "features": ["1 venue", "Basic analytics"], "max_venues": 1},
            {"id": "basic", "name": "Basic", "price": 2999, "features": ["3 venues", "Advanced analytics", "Priority support"], "max_venues": 3},
            {"id": "pro", "name": "Pro", "price": 7999, "features": ["Unlimited venues", "Full analytics", "Dedicated support", "Custom branding"], "max_venues": 100},
        ],
        "coach_subscription_plans": [
            {"id": "free", "name": "Free", "price": 0, "max_clients": 10, "max_packages": 2,
             "max_sessions_per_month": 30, "commission_pct": 15, "offline_management": False, "analytics": False},
            {"id": "pro", "name": "Pro", "price": 999, "max_clients": 50, "max_packages": 10,
             "max_sessions_per_month": 200, "commission_pct": 10, "offline_management": True, "analytics": True},
            {"id": "elite", "name": "Elite", "price": 2499, "max_clients": -1, "max_packages": -1,
             "max_sessions_per_month": -1, "commission_pct": 5, "offline_management": True, "analytics": True},
        ]
    })

    now = datetime.now(timezone.utc)

    # ─── Demo Coach ───
    coach_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": coach_id, "name": "Coach Ravi", "email": "coach@lobbi.com",
        "password_hash": hash_pw("Coach123"), "role": "coach", "coach_type": "academy", "account_status": "active",
        "phone": "9000000001", "avatar": "", "sports": ["badminton", "cricket"],
        "coaching_sports": ["badminton", "cricket"], "coaching_bio": "10+ years coaching experience",
        "session_price": 500, "city": "Chennai",
        "skill_rating": 0, "skill_deviation": 0, "reliability_score": 100,
        "total_games": 0, "wins": 0, "losses": 0, "draws": 0, "no_shows": 0,
        "business_name": "", "gst_number": "",
        "coach_verification_documents": {
            "government_id": {"url": "", "uploaded_at": now.isoformat()},
            "coaching_certification": {"url": "", "uploaded_at": now.isoformat()},
            "federation_membership": {"url": "", "uploaded_at": now.isoformat()},
            "playing_experience": None, "first_aid_certificate": None,
            "fitness_certificate": None, "background_check": None,
            "qualification_proof": None, "experience_letters": [],
            "profile_photo": {"url": "", "uploaded_at": now.isoformat()},
        },
        "doc_verification_status": "verified", "doc_rejection_reason": "",
        "years_of_experience": 10,
        "specializations": ["footwork", "smash technique", "match strategy"],
        "achievements": ["State level badminton player 2015", "National coaching camp attendee 2018"],
        "awards": ["Best Coach Award - Chennai District 2023"],
        "certifications_list": ["NIS Diploma in Badminton", "BAI Level 2 Coach"],
        "playing_history": "Played for Tamil Nadu state team 2012-2016. District champion 3 consecutive years.",
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    # ─── Demo Players ───
    player_ids = []
    player_names = ["Arjun Kumar", "Priya Singh", "Vikram Raj", "Sneha Patel", "Rahul Verma",
                     "Ananya Sharma", "Karthik Nair", "Divya Menon"]
    for i, name in enumerate(player_names):
        pid = str(uuid.uuid4())
        player_ids.append(pid)
        await db.users.insert_one({
            "id": pid, "name": name, "email": f"player{i+1}@lobbi.com",
            "password_hash": hash_pw("Player123"), "role": "player", "account_status": "active",
            "phone": f"900000{1000+i}", "avatar": "", "sports": ["badminton"],
            "skill_rating": random.randint(800, 2000), "skill_deviation": 200,
            "reliability_score": random.randint(70, 100),
            "total_games": random.randint(5, 50), "wins": 0, "losses": 0, "draws": 0, "no_shows": 0,
            "business_name": "", "gst_number": "",
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    # ─── Demo Academies ───

    academy1_id = str(uuid.uuid4())
    await db.academies.insert_one({
        "id": academy1_id, "coach_id": coach_id, "coach_name": "Coach Ravi",
        "name": "Elite Badminton Academy", "sport": "badminton",
        "description": "Professional badminton training for all levels — beginners to advanced players.",
        "monthly_fee": 3000, "location": "Nungambakkam Indoor Stadium, Chennai",
        "max_students": 50, "current_students": len(player_ids),
        "students": [], "schedule": "Mon/Wed/Fri 6-8AM, Tue/Thu 5-7PM",
        "status": "active", "created_at": now.isoformat()
    })

    academy2_id = str(uuid.uuid4())
    await db.academies.insert_one({
        "id": academy2_id, "coach_id": coach_id, "coach_name": "Coach Ravi",
        "name": "Cricket Stars Academy", "sport": "cricket",
        "description": "Comprehensive cricket coaching — batting, bowling, and fielding drills.",
        "monthly_fee": 4000, "location": "MA Chidambaram Stadium Nets, Chennai",
        "max_students": 30, "current_students": 4,
        "students": [], "schedule": "Sat/Sun 7-10AM",
        "status": "active", "created_at": now.isoformat()
    })

    # ─── Demo Batches ───
    batch_morning = str(uuid.uuid4())
    batch_evening = str(uuid.uuid4())
    await db.academy_batches.insert_one({
        "id": batch_morning, "academy_id": academy1_id,
        "name": "Morning Batch", "max_students": 25, "current_students": 5,
        "start_time": "06:00", "end_time": "08:00", "days": [1, 3, 5],
        "student_ids": player_ids[:5], "status": "active",
        "created_at": now.isoformat()
    })
    await db.academy_batches.insert_one({
        "id": batch_evening, "academy_id": academy1_id,
        "name": "Evening Batch", "max_students": 25, "current_students": 3,
        "start_time": "17:00", "end_time": "19:00", "days": [2, 4],
        "student_ids": player_ids[5:], "status": "active",
        "created_at": now.isoformat()
    })

    # ─── Demo Enrollments ───
    for i, pid in enumerate(player_ids):
        batch_id = batch_morning if i < 5 else batch_evening
        await db.academy_enrollments.insert_one({
            "id": str(uuid.uuid4()),
            "academy_id": academy1_id,
            "academy_name": "Elite Badminton Academy",
            "student_id": pid,
            "student_name": player_names[i],
            "student_email": f"player{i+1}@lobbi.com",
            "student_phone": f"900000{1000+i}",
            "batch_id": batch_id,
            "monthly_fee": 3000,
            "commission_amount": 300,
            "status": "active",
            "payment_gateway": "test",
            "payment_details": {"method": "test", "test_payment_id": f"test_seed_{i}", "paid_at": now.isoformat()},
            "current_period_start": now.isoformat(),
            "current_period_end": (now + timedelta(days=30)).isoformat(),
            "created_at": (now - timedelta(days=random.randint(1, 60))).isoformat(),
        })

    # Cricket academy — 4 students
    for i in range(4):
        pid = player_ids[i]
        await db.academy_enrollments.insert_one({
            "id": str(uuid.uuid4()),
            "academy_id": academy2_id,
            "academy_name": "Cricket Stars Academy",
            "student_id": pid,
            "student_name": player_names[i],
            "student_email": f"player{i+1}@lobbi.com",
            "student_phone": f"900000{1000+i}",
            "batch_id": "",
            "monthly_fee": 4000,
            "commission_amount": 400,
            "status": "active",
            "payment_gateway": "test",
            "payment_details": {"method": "test", "test_payment_id": f"test_cricket_{i}", "paid_at": now.isoformat()},
            "current_period_start": now.isoformat(),
            "current_period_end": (now + timedelta(days=30)).isoformat(),
            "created_at": (now - timedelta(days=random.randint(1, 30))).isoformat(),
        })

    # ─── Demo Attendance (last 30 days) ───
    for day_offset in range(30):
        date = (now - timedelta(days=day_offset))
        weekday = date.weekday()  # 0=Mon
        date_str = date.strftime("%Y-%m-%d")

        # Morning batch: Mon(0)/Wed(2)/Fri(4)
        if weekday in [0, 2, 4]:
            present = random.sample(player_ids[:5], k=random.randint(3, 5))
            absent = [p for p in player_ids[:5] if p not in present]
            await db.academy_attendance.insert_one({
                "id": str(uuid.uuid4()), "academy_id": academy1_id,
                "batch_id": batch_morning, "date": date_str,
                "present": present, "absent": absent,
                "total_students": 5, "present_count": len(present),
                "marked_by": coach_id, "created_at": date.isoformat(),
            })

        # Evening batch: Tue(1)/Thu(3)
        if weekday in [1, 3]:
            present = random.sample(player_ids[5:], k=random.randint(2, 3))
            absent = [p for p in player_ids[5:] if p not in present]
            await db.academy_attendance.insert_one({
                "id": str(uuid.uuid4()), "academy_id": academy1_id,
                "batch_id": batch_evening, "date": date_str,
                "present": present, "absent": absent,
                "total_students": 3, "present_count": len(present),
                "marked_by": coach_id, "created_at": date.isoformat(),
            })

    # ─── Demo Fee Records (current month) ───
    current_month = now.strftime("%Y-%m")
    for i, pid in enumerate(player_ids):
        # 6 out of 8 paid, 2 pending
        if i < 6:
            await db.academy_fee_records.insert_one({
                "id": str(uuid.uuid4()), "academy_id": academy1_id,
                "student_id": pid, "student_name": player_names[i],
                "amount": 3000, "payment_method": random.choice(["cash", "upi", "razorpay"]),
                "period_month": current_month, "status": "paid",
                "collected_by": coach_id, "notes": "",
                "created_at": (now - timedelta(days=random.randint(0, 10))).isoformat(),
            })

    # ─── Demo Progress Entries ───
    skills = ["technique", "fitness", "game_sense", "discipline", "improvement"]
    for i, pid in enumerate(player_ids[:5]):
        await db.academy_progress.insert_one({
            "id": str(uuid.uuid4()), "academy_id": academy1_id,
            "student_id": pid, "student_name": player_names[i],
            "coach_id": coach_id,
            "skill_ratings": {s: random.randint(4, 9) for s in skills},
            "assessment_type": "monthly", "notes": f"Showing good progress in {random.choice(skills)}.",
            "date": now.strftime("%Y-%m-%d"),
            "created_at": now.isoformat(),
        })

    # ─── Individual Coach (Coach Priya) ───
    ind_coach_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": ind_coach_id, "name": "Coach Priya", "email": "priya@lobbi.com",
        "password_hash": hash_pw("Coach123"), "role": "coach", "coach_type": "individual",
        "account_status": "active",
        "phone": "9000000099", "avatar": "", "sports": ["badminton"],
        "coaching_sports": ["badminton"], "coaching_bio": "Focused on individual skill development",
        "session_price": 600, "city": "Chennai",
        "skill_rating": 0, "skill_deviation": 0, "reliability_score": 100,
        "total_games": 0, "wins": 0, "losses": 0, "draws": 0, "no_shows": 0,
        "business_name": "", "gst_number": "",
        "coach_verification_documents": {
            "government_id": {"url": "", "uploaded_at": now.isoformat()},
            "coaching_certification": {"url": "", "uploaded_at": now.isoformat()},
            "federation_membership": None, "playing_experience": None,
            "first_aid_certificate": None, "fitness_certificate": None,
            "background_check": None, "qualification_proof": None,
            "experience_letters": [], "profile_photo": None,
        },
        "doc_verification_status": "verified", "doc_rejection_reason": "",
        "years_of_experience": 5,
        "specializations": ["footwork", "singles strategy"],
        "achievements": ["District champion 2022"],
        "awards": [],
        "certifications_list": ["BAI Level 1 Coach"],
        "playing_history": "State-level player 2018-2021.",
        "coach_plan": "free",
        "onboarding_status": "complete",
        "onboarding_steps": {
            "profile_completed": True,
            "availability_set": True,
            "first_package_created": True,
            "documents_uploaded": True,
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    # ─── Offline Clients for Coach Priya ───
    offline_client_ids = []
    offline_client_names = ["Ramesh Kumar", "Deepa Lakshmi", "Suresh Babu", "Meena Devi"]
    for i, cname in enumerate(offline_client_names):
        cid = str(uuid.uuid4())
        offline_client_ids.append(cid)
        await db.coach_clients.insert_one({
            "id": cid, "coach_id": ind_coach_id,
            "name": cname, "phone": f"900000200{i}",
            "email": f"client{i+1}@example.com",
            "sport": "badminton",
            "source": random.choice(["walk_in", "referral", "whatsapp"]),
            "notes": "", "payment_mode": random.choice(["cash", "upi"]),
            "linked_user_id": None, "status": "active",
            "created_at": (now - timedelta(days=random.randint(5, 60))).isoformat(),
            "updated_at": now.isoformat(),
        })

    # ─── Offline Sessions for Coach Priya ───
    for day_offset in range(14):
        d = now - timedelta(days=day_offset)
        if d.weekday() in [6]:  # skip Sunday
            continue
        cid = random.choice(offline_client_ids)
        cname = offline_client_names[offline_client_ids.index(cid)]
        await db.coach_offline_sessions.insert_one({
            "id": str(uuid.uuid4()), "coach_id": ind_coach_id,
            "client_id": cid, "client_name": cname,
            "date": d.strftime("%Y-%m-%d"),
            "start_time": "06:00", "end_time": "07:00",
            "sport": "badminton", "status": "completed",
            "payment_status": random.choice(["paid", "paid", "pending"]),
            "payment_mode": "cash", "amount": 600,
            "attendance": "present", "notes": "",
            "source": "offline", "created_at": d.isoformat(),
        })

    # ─── Offline Payments for Coach Priya ───
    for i in range(3):
        cid = offline_client_ids[i]
        await db.coach_offline_payments.insert_one({
            "id": str(uuid.uuid4()), "coach_id": ind_coach_id,
            "client_id": cid, "client_name": offline_client_names[i],
            "type": "session_payment", "amount": 600 * random.randint(2, 4),
            "mode": random.choice(["cash", "upi"]), "reference": "",
            "period": now.strftime("%Y-%m"), "notes": "",
            "collected_at": (now - timedelta(days=random.randint(0, 10))).isoformat(),
            "created_at": (now - timedelta(days=random.randint(0, 10))).isoformat(),
        })

    # ─── Coaching Package for Coach Priya ───
    await db.coaching_packages.insert_one({
        "id": str(uuid.uuid4()), "coach_id": ind_coach_id,
        "name": "Monthly Badminton Training", "sport": "badminton",
        "sessions_per_month": 20, "price": 8000,
        "description": "5 days/week individual training", "status": "active",
        "commission_pct": 15, "created_at": now.isoformat(),
    })

    # ─── Expenses for Coach Priya ───
    expense_data = [
        {"category": "venue_rent", "amount": 8000, "description": "Court booking - Feb", "payment_mode": "upi"},
        {"category": "equipment", "amount": 3000, "description": "Shuttlecocks & grips", "payment_mode": "cash"},
        {"category": "travel", "amount": 1500, "description": "Travel to coaching venue", "payment_mode": "cash"},
        {"category": "marketing", "amount": 2000, "description": "Instagram ads", "payment_mode": "upi"},
        {"category": "software", "amount": 500, "description": "Coaching app subscription", "payment_mode": "upi"},
        {"category": "utilities", "amount": 1000, "description": "Phone & internet", "payment_mode": "bank_transfer"},
    ]
    for exp in expense_data:
        await db.coach_expenses.insert_one({
            "id": str(uuid.uuid4()), "coach_id": ind_coach_id,
            "category": exp["category"], "amount": exp["amount"],
            "date": (now - timedelta(days=random.randint(0, 25))).strftime("%Y-%m-%d"),
            "description": exp["description"],
            "payment_mode": exp["payment_mode"], "reference": "",
            "recurring": exp["category"] in ("venue_rent", "utilities"),
            "recurring_frequency": "monthly" if exp["category"] in ("venue_rent", "utilities") else "",
            "created_at": now.isoformat(), "updated_at": now.isoformat(),
        })

    # ─── Availability for Coach Priya ───
    for day in [1, 2, 3, 4, 5]:  # Mon-Fri
        await db.coaching_availability.insert_one({
            "id": str(uuid.uuid4()), "coach_id": ind_coach_id,
            "day_of_week": day, "start_time": "06:00", "end_time": "09:00",
            "sport": "badminton", "created_at": now.isoformat(),
        })

    logger.info("Fresh database seeded — admin, coach, individual coach, players, 2 academies, batches, enrollments, attendance, fees, progress, offline data.")
