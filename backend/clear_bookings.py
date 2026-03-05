"""
Clear all booking-related data from the database.
Run before starting fresh on booking work.

Usage:
  cd backend && python ../scripts/clear_bookings.py

Env vars: MONGO_URL, DB_NAME (defaults to lobbi_db), REDIS_URL (optional)
"""
import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))
load_dotenv(backend_dir / ".env")

from motor.motor_asyncio import AsyncIOMotorClient


async def clear():
    mongo_url = os.environ.get("MONGO_URL") or os.environ.get("DATABASE_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "lobbi_db")
    redis_url = os.environ.get("REDIS_URL") or os.environ.get("REDIS_PRIVATE_URL")

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    print(f"Connected to {db_name}")
    print("=" * 50)

    # 1. Drop bookings
    r = await db.bookings.delete_many({})
    print(f"bookings:               deleted {r.deleted_count}")

    # 2. Drop split payments
    r = await db.split_payments.delete_many({})
    print(f"split_payments:         deleted {r.deleted_count}")

    # 3. Drop venue invoices
    r = await db.venue_invoices.delete_many({})
    print(f"venue_invoices:         deleted {r.deleted_count}")

    # 4. Reset invoice counter
    r = await db.venue_invoice_counters.delete_many({})
    print(f"venue_invoice_counters: reset ({r.deleted_count} removed)")

    # 5. Drop settlements (booking-related)
    r = await db.settlements.delete_many({})
    print(f"settlements:            deleted {r.deleted_count}")

    # 6. Reset venues.total_bookings → 0
    r = await db.venues.update_many({}, {"$set": {"total_bookings": 0}})
    print(f"venues.total_bookings:  reset {r.modified_count} venues to 0")

    # 7. Reset users.total_games → 0
    r = await db.users.update_many({}, {"$set": {"total_games": 0}})
    print(f"users.total_games:      reset {r.modified_count} users to 0")

    # 8. Flush Redis slot locks
    if redis_url:
        import redis.asyncio as aioredis
        try:
            kwargs = {"decode_responses": True}
            if redis_url.startswith("rediss://"):
                kwargs["ssl_cert_reqs"] = None
            rc = aioredis.from_url(redis_url, **kwargs)
            await rc.ping()
            count = 0
            async for key in rc.scan_iter("lock:*"):
                await rc.delete(key)
                count += 1
            await rc.close()
            print(f"redis lock:* keys:      deleted {count}")
        except Exception as e:
            print(f"redis:                  failed ({e})")
    else:
        print("redis:                  skipped (REDIS_URL not set)")

    print("=" * 50)
    print("Done. All booking data cleared.")
    client.close()


if __name__ == "__main__":
    asyncio.run(clear())
