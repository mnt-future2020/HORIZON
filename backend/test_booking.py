"""
Test script — Creates a booking at current time + 5 min and test-confirms it.
Usage: python test_booking.py
"""
import requests
from datetime import date, datetime, timedelta, timezone

BASE = "http://localhost:8000/api"

# ── Step 1: Dev-login (no password needed in development) ──
print("🔑 Logging in...")
email = input("Enter your test user email: ").strip()
r = requests.post(f"{BASE}/auth/dev-login", json={"email": email})
if r.status_code != 200:
    print(f"❌ Login failed: {r.text}")
    exit(1)
token = r.json()["token"]
user = r.json()["user"]
headers = {"Authorization": f"Bearer {token}"}
print(f"✅ Logged in as {user['name']} ({user['role']})")

# ── Step 2: Pick a venue ──
print("\n📍 Fetching venues...")
r = requests.get(f"{BASE}/venues", headers=headers, params={"limit": 10})
venues = r.json() if r.status_code == 200 else []
if not venues:
    print("❌ No venues found. Create a venue first.")
    exit(1)

for i, v in enumerate(venues):
    sports = ", ".join(v.get("sports", []))
    turfs = v.get("turfs", 1)
    print(f"  [{i+1}] {v['name']} — {v.get('city','')} ({sports}) — {turfs} turf(s)")

choice = int(input("\nPick venue number: ")) - 1
venue = venues[choice]
print(f"✅ Selected: {venue['name']} (id: {venue['id']})")

# Show turf info
turf_config = venue.get("turf_config", [])
turf_num = 1
if turf_config:
    idx = 1
    print("\n🏟️  Turfs:")
    for tc in turf_config:
        for t in tc.get("turfs", []):
            print(f"  [{idx}] {t.get('name','Turf')} ({tc.get('sport','')}) — ₹{t.get('price', venue.get('base_price', 2000))}")
            idx += 1
    turf_num = int(input("Pick turf number: "))

sport = turf_config[0].get("sport", "football") if turf_config else (venue.get("sports", ["football"])[0])

# ── Step 3: Create booking at NOW + 5 min (IST) ──
IST = timezone(timedelta(hours=5, minutes=30))
now_ist = datetime.now(IST)
start_dt = now_ist + timedelta(minutes=5)
today = start_dt.strftime("%Y-%m-%d")
slot_dur = venue.get("slot_duration_minutes", 60)
start_time = start_dt.strftime("%H:%M")
end_dt = start_dt + timedelta(minutes=slot_dur)
end_time = end_dt.strftime("%H:%M")
start_ampm = start_dt.strftime("%I:%M %p")
end_ampm = end_dt.strftime("%I:%M %p")

payload = {
    "venue_id": venue["id"],
    "date": today,
    "start_time": start_time,
    "end_time": end_time,
    "turf_number": turf_num,
    "sport": sport,
    "payment_mode": "full",
    "num_players": 5,
}

print(f"\n📝 Creating booking: {today} {start_ampm}-{end_ampm} on Turf #{turf_num} ({sport})")
r = requests.post(f"{BASE}/bookings", json=payload, headers=headers)
if r.status_code != 200:
    print(f"❌ Booking failed: {r.status_code} — {r.text}")
    exit(1)

booking = r.json()
booking_id = booking["id"]
status = booking["status"]
print(f"✅ Booking created: {booking_id}")
print(f"   Status: {status} | Amount: ₹{booking.get('total_amount', 0)}")

# ── Step 4: Test-confirm (simulates payment) ──
if status in ("payment_pending", "pending"):
    print("\n💳 Test-confirming payment...")
    r = requests.post(f"{BASE}/bookings/{booking_id}/test-confirm", headers=headers)
    if r.status_code == 200:
        print("✅ Payment confirmed!")
    else:
        print(f"❌ Confirm failed: {r.status_code} — {r.text}")
        exit(1)
else:
    print(f"   (Already {status}, no confirmation needed)")

# ── Step 5: Verify — fetch the booking ──
print("\n🔍 Fetching final booking...")
r = requests.get(f"{BASE}/bookings", headers=headers)
if r.status_code == 200:
    for b in r.json().get("bookings", []):
        if b["id"] == booking_id:
            print(f"   Status:  {b['status']}")
            print(f"   QR Data: {b.get('qr_data', '(none)')}")
            print(f"   Token:   {b.get('checkin_token', '(none)')}")
            print(f"   Payment: {b.get('payment_details', {}).get('test_payment_id', '(none)')}")
            break

print("\n🎉 Done! Open the Player Dashboard to see the receipt with QR code.")
