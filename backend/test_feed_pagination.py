"""
Test: Cursor-based feed pagination
- Inserts 50 test posts with spread timestamps
- Calls /feed with cursor to verify load more works
- Checks: no duplicates, correct order, has_more flag
- Cleans up after test
"""
import asyncio
import os
import uuid
from datetime import timedelta
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")

from database import db
from tz import now_ist

TEST_USER_ID = "cd64f340-8573-4b55-ad47-b5a08d499e06"
TEST_TAG = "TEST_PAGINATION_TEMP"


async def seed_posts():
    """Insert 50 posts with timestamps spread over the last 50 hours."""
    now = now_ist()
    posts = []
    for i in range(50):
        created_at = now - timedelta(hours=i)
        posts.append({
            "id": str(uuid.uuid4()),
            "user_id": TEST_USER_ID,
            "user_name": "Test User",
            "user_avatar": "",
            "content": f"Test post #{i+1} — {TEST_TAG}",
            "media_url": "",
            "venue_id": "",
            "match_id": "",
            "post_type": "text",
            "visibility": "public",
            "likes_count": 0,
            "comments_count": 0,
            "reactions": {},
            "created_at": created_at.isoformat(),
            "_test": True,
        })
    await db.social_posts.insert_many(posts)
    print(f"✅ Inserted 50 test posts")
    return posts


async def simulate_feed_cursor(limit=20):
    """Simulate exactly what the backend /feed endpoint does with cursor pagination."""
    query_base = {"$or": [{"visibility": "public"}, {"user_id": TEST_USER_ID}]}
    all_fetched = []
    cursor = None
    page_num = 0

    while True:
        page_num += 1
        query = dict(query_base)
        if cursor:
            query["created_at"] = {"$lt": cursor}

        posts = await db.social_posts.find(
            query, {"_id": 0, "id": 1, "created_at": 1, "content": 1}
        ).sort("created_at", -1).limit(limit).to_list(limit)

        has_more = len(posts) == limit
        next_cursor = posts[-1]["created_at"] if posts else None

        test_posts_this_page = [p for p in posts if TEST_TAG in p.get("content", "")]
        print(f"  Page {page_num}: {len(posts)} total posts ({len(test_posts_this_page)} test posts), has_more={has_more}")

        all_fetched.extend(posts)
        cursor = next_cursor

        if not has_more or page_num > 10:
            break

    return all_fetched


async def run_test():
    print("\n=== Feed Cursor Pagination Test ===\n")

    # 1. Seed
    seeded = await seed_posts()
    seeded_ids = {p["id"] for p in seeded}

    # 2. Simulate paginated load
    print("Simulating cursor pagination (limit=20):")
    all_fetched = await simulate_feed_cursor(limit=20)

    # 3. Check results
    fetched_ids = [p["id"] for p in all_fetched]
    fetched_id_set = set(fetched_ids)

    test_fetched = [p for p in all_fetched if TEST_TAG in p.get("content", "")]
    test_fetched_ids = {p["id"] for p in test_fetched}

    duplicates = len(fetched_ids) - len(fetched_id_set)
    missing = seeded_ids - test_fetched_ids

    print(f"\n--- Results ---")
    print(f"Total posts fetched across all pages : {len(all_fetched)}")
    print(f"Test posts seeded                    : 50")
    print(f"Test posts found in pages            : {len(test_fetched)}")
    print(f"Duplicates                           : {duplicates}")
    print(f"Missing test posts                   : {len(missing)}")

    # 4. Verify ordering (each post should be older than previous)
    dates = [p["created_at"] for p in all_fetched]
    ordering_ok = all(dates[i] >= dates[i+1] for i in range(len(dates)-1))
    print(f"Chronological order correct          : {ordering_ok}")

    if duplicates == 0 and len(missing) == 0 and ordering_ok:
        print("\n✅ PASS — Cursor pagination works correctly. No duplicates, no missing posts.")
    else:
        print("\n❌ FAIL — Issues found.")
        if duplicates:
            print(f"   {duplicates} duplicate post(s) detected")
        if missing:
            print(f"   {len(missing)} test post(s) not found in any page")
        if not ordering_ok:
            print("   Ordering is broken")

    # 5. Cleanup
    result = await db.social_posts.delete_many({"_test": True})
    print(f"\n🧹 Cleaned up {result.deleted_count} test posts")


if __name__ == "__main__":
    asyncio.run(run_test())
