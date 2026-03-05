"""
One-time reconciliation script: Fix drifted likes_count / comments_count.
Run BEFORE deploying the transaction fix to clean up any existing drift.

Usage:
  cd backend && python ../scripts/reconcile_counts.py

Env vars: MONGO_URL, DB_NAME (defaults to lobbi_db)
"""
import asyncio
import os
import sys
from pathlib import Path

# Add backend to path so we can import database module
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from motor.motor_asyncio import AsyncIOMotorClient


async def reconcile():
    mongo_url = os.environ.get("MONGO_URL") or os.environ.get("DATABASE_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "lobbi_db")

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    print(f"Connected to {db_name}")

    # --- Reconcile likes_count ---
    fixed_likes = 0
    fixed_comments = 0
    total = 0

    async for post in db.social_posts.find({}, {"_id": 0, "id": 1, "likes_count": 1, "comments_count": 1}):
        total += 1
        post_id = post["id"]
        stored_likes = post.get("likes_count", 0)
        stored_comments = post.get("comments_count", 0)

        real_likes, real_comments = await asyncio.gather(
            db.social_likes.count_documents({"post_id": post_id}),
            db.social_comments.count_documents({"post_id": post_id}),
        )

        updates = {}
        if real_likes != stored_likes:
            updates["likes_count"] = real_likes
            fixed_likes += 1
            print(f"  Post {post_id}: likes {stored_likes} -> {real_likes}")

        if real_comments != stored_comments:
            updates["comments_count"] = real_comments
            fixed_comments += 1
            print(f"  Post {post_id}: comments {stored_comments} -> {real_comments}")

        if updates:
            await db.social_posts.update_one({"id": post_id}, {"$set": updates})

    print(f"\nDone. Scanned {total} posts.")
    print(f"  Fixed likes_count:    {fixed_likes}")
    print(f"  Fixed comments_count: {fixed_comments}")

    client.close()


if __name__ == "__main__":
    asyncio.run(reconcile())
