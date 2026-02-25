"""
Comprehensive test: Seed dummy data -> test all 6 recommendation features -> report results.
Run: cd backend && python test_recommendations.py
"""
import asyncio
import uuid
import random
import math
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
load_dotenv()

from database import db
from auth import hash_pw, create_token

API_BASE = "http://localhost:8000/api"

# ===============================================================
# STEP 1: Seed Dummy Data
# ===============================================================

SPORTS = ["football", "cricket", "badminton", "basketball", "tennis"]

async def seed_test_data():
    """Seed realistic dummy data for all recommendation features."""
    print("\n" + "=" * 70)
    print("STEP 1: SEEDING TEST DATA")
    print("=" * 70)

    # --- 15 Players ---
    players = []
    for i in range(15):
        uid = str(uuid.uuid4())
        player = {
            "id": uid,
            "name": f"TestPlayer_{i+1}",
            "email": f"testplayer{i+1}@test.com",
            "password_hash": hash_pw("Test1234"),
            "role": "player",
            "account_status": "active",
            "phone": f"90000{10000+i}",
            "avatar": "",
            "sports": random.sample(SPORTS, k=random.randint(1, 3)),
            "preferred_position": "",
            "skill_rating": 1200 + i * 50,  # 1200 to 1900
            "skill_deviation": 200 + random.randint(-50, 50),
            "reliability_score": 80 + random.randint(0, 20),
            "total_games": random.randint(5, 50),
            "wins": random.randint(2, 20),
            "losses": random.randint(1, 10),
            "draws": random.randint(0, 5),
            "no_shows": 0,
            "business_name": "",
            "gst_number": "",
            "is_verified": False,
            "created_at": (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        }
        players.append(player)

    # Insert players (skip existing)
    for p in players:
        existing = await db.users.find_one({"email": p["email"]})
        if not existing:
            await db.users.insert_one(p)
    print(f"  [+] {len(players)} test players ready")

    # Get the main test user (player 1) — we'll test recommendations for this user
    main_user = players[0]

    # --- 5 Test Venues ---
    venues = []
    venue_cities = ["Chennai", "Bengaluru", "Mumbai", "Delhi", "Hyderabad"]
    for i in range(5):
        vid = str(uuid.uuid4())
        venue = {
            "id": vid,
            "owner_id": None,
            "slug": f"test-venue-{i+1}",
            "name": f"TestVenue_{i+1}",
            "description": f"Test venue {i+1} for recommendations",
            "sports": random.sample(SPORTS, k=random.randint(1, 3)),
            "address": f"{i+1}, Test Street",
            "area": f"Area_{i+1}",
            "city": venue_cities[i],
            "lat": 12.9 + i * 0.1,
            "lng": 77.5 + i * 0.1,
            "amenities": random.sample(["Parking", "Washroom", "Floodlights", "Cafeteria", "WiFi"], k=3),
            "images": [],
            "base_price": 800 + i * 200,
            "slot_duration_minutes": 60,
            "opening_hour": 6,
            "closing_hour": 23,
            "turfs": 2,
            "contact_phone": f"98765{40000+i}",
            "badge": "bookable",
            "created_by": "admin",
            "rating": round(3.5 + random.random() * 1.5, 1),
            "total_reviews": random.randint(5, 30),
            "total_bookings": 0,
            "status": "active",
            "pricing_mode": "rule_based",
            "created_at": (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
        }
        venues.append(venue)

    for v in venues:
        existing = await db.venues.find_one({"slug": v["slug"]})
        if not existing:
            await db.venues.insert_one(v)
    print(f"  [+] {len(venues)} test venues ready")

    # --- Bookings (60+ for ML pricing, cross-user for collab filtering) ---
    bookings = []
    now = datetime.now(timezone.utc)
    hours = ["06:00", "07:00", "08:00", "09:00", "10:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"]

    # Main user books venues 0, 1, 2
    for vi in range(3):
        for d in range(5):
            bid = str(uuid.uuid4())
            bdate = (now - timedelta(days=d + 1)).strftime("%Y-%m-%d")
            bookings.append({
                "id": bid,
                "venue_id": venues[vi]["id"],
                "host_id": main_user["id"],
                "players": [main_user["id"], players[1]["id"], players[2]["id"]],
                "date": bdate,
                "start_time": random.choice(hours),
                "end_time": "19:00",
                "turf_number": random.randint(1, 2),
                "sport": venues[vi]["sports"][0],
                "total_amount": venues[vi]["base_price"],
                "status": "confirmed",
                "payment_status": "paid",
                "created_at": (now - timedelta(days=d + 1)).isoformat()
            })

    # Players 1-5 also book venues 2, 3, 4 (collab signal: they share venue 2 with main user)
    for pi in range(1, 6):
        for vi in [2, 3, 4]:
            for d in range(4):
                bid = str(uuid.uuid4())
                bdate = (now - timedelta(days=d + 1)).strftime("%Y-%m-%d")
                bookings.append({
                    "id": bid,
                    "venue_id": venues[vi]["id"],
                    "host_id": players[pi]["id"],
                    "players": [players[pi]["id"]],
                    "date": bdate,
                    "start_time": random.choice(hours),
                    "end_time": "20:00",
                    "turf_number": random.randint(1, 2),
                    "sport": venues[vi]["sports"][0],
                    "total_amount": venues[vi]["base_price"],
                    "status": "confirmed",
                    "payment_status": "paid",
                    "created_at": (now - timedelta(days=d + 1)).isoformat()
                })

    # Extra bookings for venue 0 (for ML pricing — needs 50+)
    for d in range(60):
        bid = str(uuid.uuid4())
        bdate = (now - timedelta(days=d + 1)).strftime("%Y-%m-%d")
        hr = random.choice(hours)
        # Weekend evening = higher price, weekday morning = lower
        day_obj = now - timedelta(days=d + 1)
        is_weekend = day_obj.weekday() >= 5
        hour_int = int(hr.split(":")[0])
        multiplier = 1.0
        if is_weekend and hour_int >= 17:
            multiplier = 1.4
        elif hour_int >= 17:
            multiplier = 1.2
        elif hour_int < 10:
            multiplier = 0.8

        bookings.append({
            "id": bid,
            "venue_id": venues[0]["id"],
            "host_id": random.choice(players)["id"],
            "players": [random.choice(players)["id"]],
            "date": bdate,
            "start_time": hr,
            "end_time": f"{int(hr.split(':')[0])+1:02d}:00",
            "turf_number": random.randint(1, 2),
            "sport": venues[0]["sports"][0],
            "total_amount": int(venues[0]["base_price"] * multiplier),
            "status": "confirmed",
            "payment_status": "paid",
            "created_at": (now - timedelta(days=d + 1)).isoformat()
        })

    # Clean old test bookings and insert fresh
    await db.bookings.delete_many({"id": {"$regex": "^" + bookings[0]["id"][:8]}})
    # Just insert all (they have unique UUIDs)
    if bookings:
        await db.bookings.insert_many(bookings)
    print(f"  [+] {len(bookings)} bookings seeded (incl. 60+ for ML pricing on venue 0)")

    # --- Follow Relationships ---
    follows = []
    # Main user follows players 3, 4, 5
    for pi in [3, 4, 5]:
        follows.append({
            "follower_id": main_user["id"],
            "following_id": players[pi]["id"],
            "created_at": now.isoformat()
        })
    # Players 6-10 follow main user
    for pi in range(6, 11):
        follows.append({
            "follower_id": players[pi]["id"],
            "following_id": main_user["id"],
            "created_at": now.isoformat()
        })

    await db.follows.delete_many({"follower_id": main_user["id"]})
    await db.follows.delete_many({"following_id": main_user["id"]})
    if follows:
        await db.follows.insert_many(follows)
    print(f"  [+] {len(follows)} follow relationships seeded")

    # --- Social Posts (for suggested follows — active posters) ---
    posts = []
    # Players 7-12 are active posters (posted in last 7 days)
    for pi in range(7, 13):
        for d in range(random.randint(3, 8)):
            posts.append({
                "id": str(uuid.uuid4()),
                "user_id": players[pi]["id"],
                "content": f"Test post by player {pi+1} - day {d}",
                "post_type": "text",
                "media": [],
                "likes": [],
                "likes_count": random.randint(0, 20),
                "comments_count": random.randint(0, 5),
                "created_at": (now - timedelta(days=d, hours=random.randint(0, 12))).isoformat()
            })

    # Clean and insert
    test_user_ids = [p["id"] for p in players[7:13]]
    await db.social_posts.delete_many({"user_id": {"$in": test_user_ids}})
    if posts:
        await db.social_posts.insert_many(posts)
    print(f"  [+] {len(posts)} social posts seeded (players 8-13 are active posters)")

    # --- Community Groups ---
    groups = []
    for i in range(6):
        gid = str(uuid.uuid4())
        # Groups 0-2: include main user's friends (players 3,4,5)
        if i < 3:
            members = [players[3]["id"], players[4]["id"]] + [players[j]["id"] for j in random.sample(range(6, 15), 3)]
        else:
            members = [players[j]["id"] for j in random.sample(range(6, 15), random.randint(3, 8))]

        groups.append({
            "id": gid,
            "name": f"TestGroup_{i+1}",
            "description": f"Test group {i+1} for sports",
            "sport": random.choice(main_user["sports"]) if i < 3 else random.choice(SPORTS),
            "privacy": "public",
            "members": members,
            "member_count": len(members),
            "admins": [members[0]],
            "messages": [],
            "last_message_at": (now - timedelta(hours=random.randint(1, 200))).isoformat(),
            "created_at": (now - timedelta(days=30)).isoformat()
        })

    # Don't add main_user to any group (so they can be recommended)
    await db.groups.delete_many({"name": {"$regex": "^TestGroup_"}})
    if groups:
        await db.groups.insert_many(groups)
    print(f"  [+] {len(groups)} community groups seeded")

    # --- Match Requests (for recommended matches) ---
    match_requests = []
    for i in range(8):
        mid = str(uuid.uuid4())
        creator = players[i + 3]  # Players 4-11 create matches
        sport = random.choice(creator["sports"])
        joined = random.sample([p["id"] for p in players if p["id"] != creator["id"] and p["id"] != main_user["id"]], k=random.randint(1, 4))
        mdate = (now + timedelta(days=random.randint(1, 7))).strftime("%Y-%m-%d")

        match_requests.append({
            "id": mid,
            "creator_id": creator["id"],
            "creator_name": creator["name"],
            "sport": sport,
            "date": mdate,
            "time": f"{random.randint(16, 20)}:00",
            "venue_name": f"TestVenue_{random.randint(1, 5)}",
            "players_needed": random.randint(6, 14),
            "min_skill": 1000,
            "max_skill": 2500,
            "description": f"Test match {i+1}",
            "players_joined": joined,
            "player_names": [f"Player_{j}" for j in range(len(joined))],
            "player_ratings": {pid: random.randint(1200, 1800) for pid in joined},
            "status": "open",
            "created_at": now.isoformat()
        })

    await db.match_requests.delete_many({"description": {"$regex": "^Test match"}})
    if match_requests:
        await db.match_requests.insert_many(match_requests)
    print(f"  [+] {len(match_requests)} match requests seeded")

    return main_user, players, venues, match_requests


# ===============================================================
# STEP 2: Test All 6 Features
# ===============================================================

import httpx

async def test_all_features(main_user, players, venues, match_requests):
    print("\n" + "=" * 70)
    print("STEP 2: TESTING ALL 6 RECOMMENDATION FEATURES")
    print("=" * 70)

    token = create_token(main_user["id"], main_user["role"])
    headers = {"Authorization": f"Bearer {token}"}
    results = {}

    async with httpx.AsyncClient(base_url=API_BASE, timeout=30.0) as client:

        # --─ TEST 1: Recommended Matches --─
        print("\n-- TEST 1: Recommended Matches (GET /matchmaking/recommended) --")
        try:
            r = await client.get("/matchmaking/recommended", headers=headers)
            data = r.json()
            if r.status_code == 200 and isinstance(data, list):
                print(f"  Status: {r.status_code}")
                print(f"  Matches returned: {len(data)}")
                if data:
                    top = data[0]
                    print(f"  Top match: {top.get('creator_name', 'N/A')} | Sport: {top.get('sport')} | "
                          f"Compatibility: {top.get('compatibility_score', 'N/A')} | "
                          f"Spots left: {top.get('spots_left', 'N/A')}")
                results["recommended_matches"] = f"PASS — {len(data)} matches, top score: {data[0].get('compatibility_score', 0) if data else 'N/A'}"
            else:
                results["recommended_matches"] = f"FAIL — Status {r.status_code}: {data}"
                print(f"  FAIL: {data}")
        except Exception as e:
            results["recommended_matches"] = f"ERROR — {e}"
            print(f"  ERROR: {e}")

        # --─ TEST 2: Suggest Teams --─
        print("\n-- TEST 2: Suggest Teams (POST /matchmaking/<id>/suggest-teams) --")
        try:
            # Use first match request that has enough players
            test_match = None
            for m in match_requests:
                if len(m["players_joined"]) >= 2:
                    test_match = m
                    break
            if test_match:
                r = await client.get(f"/matchmaking/{test_match['id']}/suggest-teams", headers=headers)
                data = r.json()
                if r.status_code == 200:
                    print(f"  Status: {r.status_code}")
                    print(f"  Team A: {len(data.get('team_a', []))} players (avg: {data.get('avg_rating_a', 'N/A')})")
                    print(f"  Team B: {len(data.get('team_b', []))} players (avg: {data.get('avg_rating_b', 'N/A')})")
                    print(f"  Balance Quality: {data.get('balance_quality', 'N/A')}%")
                    results["suggest_teams"] = f"PASS — Balance: {data.get('balance_quality', 0)}%, Diff: {data.get('rating_diff', 'N/A')}"
                else:
                    results["suggest_teams"] = f"FAIL — Status {r.status_code}: {data}"
                    print(f"  FAIL: {data}")
            else:
                results["suggest_teams"] = "SKIP — No match with 2+ players"
                print("  SKIP: No match with 2+ players")
        except Exception as e:
            results["suggest_teams"] = f"ERROR — {e}"
            print(f"  ERROR: {e}")

        # --─ TEST 3: Suggested Follows --─
        print("\n-- TEST 3: Suggested Follows (GET /engagement/suggested-follows) --")
        try:
            r = await client.get("/engagement/suggested-follows", headers=headers)
            data = r.json()
            if r.status_code == 200 and isinstance(data, list):
                print(f"  Status: {r.status_code}")
                print(f"  Suggestions returned: {len(data)}")
                co_play = [s for s in data if s.get("reason") == "played_together"]
                active = [s for s in data if s.get("reason") == "active_poster"]
                print(f"  Co-players: {len(co_play)} | Active posters: {len(active)}")
                for s in data[:3]:
                    print(f"    -> {s.get('name')} | Reason: {s.get('reason')} | Rating: {s.get('skill_rating', 'N/A')}")
                results["suggested_follows"] = f"PASS — {len(data)} suggestions ({len(co_play)} co-play, {len(active)} active)"
            else:
                results["suggested_follows"] = f"FAIL — Status {r.status_code}: {data}"
                print(f"  FAIL: {data}")
        except Exception as e:
            results["suggested_follows"] = f"ERROR — {e}"
            print(f"  ERROR: {e}")

        # --─ TEST 4: Recommended Groups --─
        print("\n-- TEST 4: Recommended Groups (GET /recommendations/groups) --")
        try:
            r = await client.get("/recommendations/groups?limit=10", headers=headers)
            data = r.json()
            if r.status_code == 200:
                groups_list = data.get("groups", [])
                algo = data.get("algorithm", "N/A")
                print(f"  Status: {r.status_code} | Algorithm: {algo}")
                print(f"  Groups returned: {len(groups_list)}")
                for g in groups_list[:3]:
                    print(f"    -> {g.get('name')} | Score: {g.get('rec_score', 'N/A')} | "
                          f"Reason: {g.get('rec_reason', 'N/A')} | Members: {g.get('member_count', 'N/A')}")
                results["recommended_groups"] = f"PASS — {len(groups_list)} groups, algo: {algo}"
            else:
                results["recommended_groups"] = f"FAIL — Status {r.status_code}: {data}"
                print(f"  FAIL: {data}")
        except Exception as e:
            results["recommended_groups"] = f"ERROR — {e}"
            print(f"  ERROR: {e}")

        # --─ TEST 5: Recommended Venues --─
        print("\n-- TEST 5: Recommended Venues (GET /recommendations/venues) --")
        try:
            r = await client.get("/recommendations/venues?limit=10", headers=headers)
            data = r.json()
            if r.status_code == 200:
                venues_list = data.get("venues", [])
                algo = data.get("algorithm", "N/A")
                print(f"  Status: {r.status_code} | Algorithm: {algo}")
                print(f"  Venues returned: {len(venues_list)}")
                for v in venues_list[:3]:
                    print(f"    -> {v.get('name')} | Score: {v.get('rec_score', 'N/A')} | "
                          f"Reason: {v.get('rec_reason', 'N/A')} | Sports: {v.get('sports', [])}")
                results["recommended_venues"] = f"PASS — {len(venues_list)} venues, algo: {algo}"
            else:
                results["recommended_venues"] = f"FAIL — Status {r.status_code}: {data}"
                print(f"  FAIL: {data}")
        except Exception as e:
            results["recommended_venues"] = f"ERROR — {e}"
            print(f"  ERROR: {e}")

        # --─ TEST 6: ML Pricing --─
        print("\n-- TEST 6: ML Pricing --")

        # 6a: Train model first
        print("  6a: Training model (POST /pricing/train-model)...")
        admin = await db.users.find_one({"role": "super_admin"})
        if admin:
            admin_token = create_token(admin["id"], admin["role"])
            admin_headers = {"Authorization": f"Bearer {admin_token}"}

            try:
                r = await client.post(f"/pricing/train-model?venue_id={venues[0]['id']}", headers=admin_headers)
                train_data = r.json()
                print(f"  Train status: {r.status_code} | {train_data.get('status', 'N/A')} | {train_data.get('message', '')}")

                # 6b: Get ML suggestion
                print("  6b: Getting ML price suggestion (GET /pricing/ml-suggest)...")
                tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
                r = await client.get(
                    f"/pricing/ml-suggest?venue_id={venues[0]['id']}&date={tomorrow}&start_time=18:00&turf_number=1",
                    headers=admin_headers
                )
                ml_data = r.json()
                if r.status_code == 200:
                    print(f"  Status: {r.status_code}")
                    print(f"  Suggested Price: Rs.{ml_data.get('suggested_price', 'N/A')}")
                    print(f"  Method: {ml_data.get('method', 'N/A')}")
                    print(f"  Confidence: {ml_data.get('confidence', 'N/A')}%")
                    print(f"  Demand Level: {ml_data.get('demand_level', 'N/A')}")
                    print(f"  Base Price: Rs.{ml_data.get('base_price', 'N/A')} | Multiplier: {ml_data.get('price_multiplier', 'N/A')}x")
                    results["ml_pricing"] = (
                        f"PASS — Method: {ml_data.get('method')}, "
                        f"Price: Rs.{ml_data.get('suggested_price')}, "
                        f"Confidence: {ml_data.get('confidence')}%, "
                        f"Demand: {ml_data.get('demand_level')}"
                    )
                else:
                    results["ml_pricing"] = f"FAIL — Status {r.status_code}: {ml_data}"
                    print(f"  FAIL: {ml_data}")
            except Exception as e:
                results["ml_pricing"] = f"ERROR — {e}"
                print(f"  ERROR: {e}")
        else:
            results["ml_pricing"] = "SKIP — No admin user found"
            print("  SKIP: No admin user in DB")

    return results


# ===============================================================
# STEP 3: Cleanup & Report
# ===============================================================

async def cleanup():
    """Remove test data."""
    del_users = await db.users.delete_many({"email": {"$regex": "^testplayer.*@test\\.com$"}})
    del_venues = await db.venues.delete_many({"slug": {"$regex": "^test-venue-"}})
    del_bookings = await db.bookings.delete_many({"sport": {"$in": SPORTS}, "host_id": {"$regex": ".*"}})
    del_follows = await db.follows.delete_many({})
    del_posts = await db.social_posts.delete_many({"content": {"$regex": "^Test post by"}})
    del_groups = await db.groups.delete_many({"name": {"$regex": "^TestGroup_"}})
    del_matches = await db.match_requests.delete_many({"description": {"$regex": "^Test match"}})
    print(f"\n  Cleaned: {del_users.deleted_count} users, {del_venues.deleted_count} venues, "
          f"{del_groups.deleted_count} groups, {del_matches.deleted_count} matches")


async def main():
    print("+------------------------------------------------------------------+")
    print("|   HORIZON -- Recommendation Engine Comprehensive Test           |")
    print("+------------------------------------------------------------------+")

    # Seed
    main_user, players, venues, match_requests = await seed_test_data()

    # Test
    results = await test_all_features(main_user, players, venues, match_requests)

    # Cleanup
    print("\n" + "=" * 70)
    print("STEP 3: CLEANUP")
    print("=" * 70)
    await cleanup()

    # Final Report
    print("\n" + "=" * 70)
    print("FINAL RESULTS")
    print("=" * 70)
    all_pass = True
    for feature, result in results.items():
        status = "PASS" if result.startswith("PASS") else "FAIL" if result.startswith("FAIL") or result.startswith("ERROR") else "SKIP"
        if status == "FAIL":
            all_pass = False
        print(f"  {status}  {feature:25s} -> {result}")

    print("\n" + ("ALL TESTS PASSED" if all_pass else "SOME TESTS FAILED"))
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
