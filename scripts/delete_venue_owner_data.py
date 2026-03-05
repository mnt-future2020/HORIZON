"""
Delete ALL data for a specific venue owner across all collections.
Usage: python scripts/delete_venue_owner_data.py
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / 'backend' / '.env')

OWNER_EMAIL = "kansha2312@mntfuture.com"

mongo_url = os.environ.get('MONGO_URL') or os.environ.get('DATABASE_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'lobbi_db')]


async def main():
    # 1. Find the user
    user = await db.users.find_one({"email": OWNER_EMAIL})
    if not user:
        print(f"User with email {OWNER_EMAIL} not found!")
        return

    user_id = user["id"]
    print(f"Found user: {user.get('name', 'N/A')} | id: {user_id} | role: {user.get('role', 'N/A')}")

    # 2. Find their venues
    venues = await db.venues.find({"owner_id": user_id}).to_list(100)
    venue_ids = [v["id"] for v in venues]
    print(f"Found {len(venues)} venues: {[v.get('name', v['id']) for v in venues]}")

    # 3. Find booking IDs (for split_payments cleanup)
    booking_ids = []
    if venue_ids:
        bookings = await db.bookings.find({"venue_id": {"$in": venue_ids}}, {"id": 1}).to_list(10000)
        booking_ids = [b["id"] for b in bookings]

    # Define all deletions: (collection_name, filter, description)
    deletions = [
        # Direct owner_id links
        ("venues", {"owner_id": user_id}, "Venues"),
        ("venue_expenses", {"owner_id": user_id}, "Venue expenses"),
        ("venue_invoices", {"owner_id": user_id}, "Venue invoices"),
        ("venue_gst_settings", {"owner_id": user_id}, "GST settings"),
        ("venue_invoice_counters", {"coach_id": user_id}, "Invoice counters"),
        ("finance_events", {"owner_id": user_id}, "Finance events"),

        # venue_owner_id links
        ("payout_deductions", {"venue_owner_id": user_id}, "Payout deductions"),

        # venue_id links
        ("bookings", {"venue_id": {"$in": venue_ids}} if venue_ids else None, "Bookings"),
        ("pricing_rules", {"venue_id": {"$in": venue_ids}} if venue_ids else None, "Pricing rules"),
        ("iot_devices", {"venue_id": {"$in": venue_ids}} if venue_ids else None, "IoT devices"),
        ("iot_energy_logs", {"venue_id": {"$in": venue_ids}} if venue_ids else None, "IoT energy logs"),
        ("iot_zones", {"venue_id": {"$in": venue_ids}} if venue_ids else None, "IoT zones"),
        ("iot_telemetry", {"venue_id": {"$in": venue_ids}} if venue_ids else None, "IoT telemetry"),
        ("pos_products", {"venue_id": {"$in": venue_ids}} if venue_ids else None, "POS products"),
        ("pos_sales", {"venue_id": {"$in": venue_ids}} if venue_ids else None, "POS sales"),
        ("reviews", {"venue_id": {"$in": venue_ids}} if venue_ids else None, "Reviews"),
        ("rating_history", {"venue_id": {"$in": venue_ids}} if venue_ids else None, "Rating history"),

        # booking_id links
        ("split_payments", {"booking_id": {"$in": booking_ids}} if booking_ids else None, "Split payments"),

        # user_id links
        ("linked_accounts", {"user_id": user_id}, "Linked bank accounts"),
        ("settlements", {"user_id": user_id}, "Settlements"),
        ("consents", {"user_id": user_id}, "Consents"),
        ("erasure_requests", {"user_id": user_id}, "Erasure requests"),
        ("webhook_logs", {"payload.account_id": user_id}, "Webhook logs (if any)"),
        ("notifications", {"user_id": user_id}, "Notifications"),

        # The user record itself
        ("users", {"id": user_id}, "User account"),
    ]

    # 4. Show counts
    print("\n--- DELETION PREVIEW ---")
    total = 0
    for coll_name, filt, desc in deletions:
        if filt is None:
            continue
        count = await db[coll_name].count_documents(filt)
        if count > 0:
            print(f"  {desc} ({coll_name}): {count} documents")
        total += count

    print(f"\nTotal documents to delete: {total}")

    if total == 0:
        print("Nothing to delete.")
        return

    # 5. Delete
    print("\nDeleting...")
    for coll_name, filt, desc in deletions:
        if filt is None:
            continue
        result = await db[coll_name].delete_many(filt)
        if result.deleted_count > 0:
            print(f"  Deleted {result.deleted_count} from {coll_name}")

    print("\nDone! All data for this venue owner has been deleted.")


if __name__ == "__main__":
    asyncio.run(main())
