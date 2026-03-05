"""
Delete ALL venue owners and ALL their related data across all collections.
Usage: python scripts/delete_all_venue_owners.py
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / 'backend' / '.env')

mongo_url = os.environ.get('MONGO_URL') or os.environ.get('DATABASE_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'lobbi_db')]


async def main():
    # 1. Find ALL venue owners
    owners = await db.users.find({"role": "venue_owner"}, {"_id": 0, "id": 1, "name": 1, "email": 1}).to_list(500)
    if not owners:
        print("No venue owners found in DB.")
        return

    print(f"Found {len(owners)} venue owner(s):")
    for o in owners:
        print(f"  {o['name']} | {o['email']} | {o['id']}")

    owner_ids = [o["id"] for o in owners]

    # 2. Find all their venues
    venues = await db.venues.find({"owner_id": {"$in": owner_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(1000)
    venue_ids = [v["id"] for v in venues]
    print(f"Found {len(venues)} venue(s): {[v['name'] for v in venues]}")

    # 3. Find all booking IDs
    booking_ids = []
    if venue_ids:
        bookings = await db.bookings.find({"venue_id": {"$in": venue_ids}}, {"id": 1}).to_list(50000)
        booking_ids = [b["id"] for b in bookings]
        print(f"Found {len(booking_ids)} booking(s)")

    # 4. Define all deletions
    deletions = [
        ("venues", {"owner_id": {"$in": owner_ids}}, "Venues"),
        ("venue_expenses", {"owner_id": {"$in": owner_ids}}, "Venue expenses"),
        ("venue_invoices", {"owner_id": {"$in": owner_ids}}, "Venue invoices"),
        ("venue_gst_settings", {"owner_id": {"$in": owner_ids}}, "GST settings"),
        ("venue_invoice_counters", {"coach_id": {"$in": owner_ids}}, "Invoice counters"),
        ("finance_events", {"owner_id": {"$in": owner_ids}}, "Finance events"),
        ("payout_deductions", {"venue_owner_id": {"$in": owner_ids}}, "Payout deductions"),
        ("linked_accounts", {"user_id": {"$in": owner_ids}}, "Linked bank accounts"),
        ("settlements", {"user_id": {"$in": owner_ids}}, "Settlements"),
        ("consents", {"user_id": {"$in": owner_ids}}, "Consents"),
        ("erasure_requests", {"user_id": {"$in": owner_ids}}, "Erasure requests"),
        ("notifications", {"user_id": {"$in": owner_ids}}, "Notifications"),
        ("webhook_logs", {"payload.account_id": {"$in": owner_ids}}, "Webhook logs"),
    ]
    if venue_ids:
        deletions += [
            ("bookings", {"venue_id": {"$in": venue_ids}}, "Bookings"),
            ("pricing_rules", {"venue_id": {"$in": venue_ids}}, "Pricing rules"),
            ("iot_devices", {"venue_id": {"$in": venue_ids}}, "IoT devices"),
            ("iot_energy_logs", {"venue_id": {"$in": venue_ids}}, "IoT energy logs"),
            ("iot_zones", {"venue_id": {"$in": venue_ids}}, "IoT zones"),
            ("iot_telemetry", {"venue_id": {"$in": venue_ids}}, "IoT telemetry"),
            ("pos_products", {"venue_id": {"$in": venue_ids}}, "POS products"),
            ("pos_sales", {"venue_id": {"$in": venue_ids}}, "POS sales"),
            ("reviews", {"venue_id": {"$in": venue_ids}}, "Reviews"),
            ("rating_history", {"venue_id": {"$in": venue_ids}}, "Rating history"),
        ]
    if booking_ids:
        deletions.append(("split_payments", {"booking_id": {"$in": booking_ids}}, "Split payments"))

    # User records last
    deletions.append(("users", {"id": {"$in": owner_ids}}, "User accounts"))

    # 5. Preview
    print("\n--- DELETION PREVIEW ---")
    total = 0
    for coll_name, filt, desc in deletions:
        count = await db[coll_name].count_documents(filt)
        if count > 0:
            print(f"  {desc} ({coll_name}): {count}")
        total += count
    print(f"\nTotal: {total} documents")

    if total == 0:
        print("Nothing to delete.")
        return

    # 6. Delete
    print("\nDeleting...")
    for coll_name, filt, desc in deletions:
        result = await db[coll_name].delete_many(filt)
        if result.deleted_count > 0:
            print(f"  Deleted {result.deleted_count} from {coll_name}")

    # 7. Verify
    remaining = await db.users.count_documents({"role": "venue_owner"})
    print(f"\nDone! Remaining venue owners: {remaining}")


if __name__ == "__main__":
    asyncio.run(main())
