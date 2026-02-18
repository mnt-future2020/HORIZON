#!/usr/bin/env python3
"""
Horizon Sports Redis Slot Locking Tests
Tests the Redis-based slot locking system for high-concurrency booking protection.
"""

import requests
import sys
import time
import json
from datetime import datetime, timedelta

# Use the public endpoint from the environment file
BASE_URL = "https://player-app-preview-1.preview.emergentagent.com/api"

class RedisSlotLockingTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.player_token = None
        self.owner_token = None
        self.session1 = requests.Session()
        self.session2 = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.results = []
        self.venue_id = None
        self.test_date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

    def log_result(self, test_name, passed, details=""):
        """Log test result"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            print(f"✅ {test_name}")
        else:
            print(f"❌ {test_name} - {details}")
        
        self.results.append({
            "test": test_name,
            "passed": passed,
            "details": details
        })

    def login_users(self):
        """Login demo users to get tokens"""
        print("🔑 Logging in demo users...")
        
        # Login player
        try:
            response = self.session1.post(f"{self.base_url}/auth/login", json={
                "email": "demo@player.com",
                "password": "demo123"
            })
            if response.status_code == 200:
                self.player_token = response.json()["token"]
                self.session1.headers.update({"Authorization": f"Bearer {self.player_token}"})
                print("✅ Player login successful")
            else:
                print(f"❌ Player login failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Player login error: {e}")
            return False

        # Login owner (different user for concurrent testing)
        try:
            response = self.session2.post(f"{self.base_url}/auth/login", json={
                "email": "demo@owner.com",
                "password": "demo123"
            })
            if response.status_code == 200:
                self.owner_token = response.json()["token"]
                self.session2.headers.update({"Authorization": f"Bearer {self.owner_token}"})
                print("✅ Owner login successful")
            else:
                print(f"❌ Owner login failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Owner login error: {e}")
            return False

        return True

    def get_venue_id(self):
        """Get a venue ID for testing"""
        try:
            response = self.session1.get(f"{self.base_url}/venues")
            if response.status_code == 200:
                venues = response.json()
                if venues:
                    self.venue_id = venues[0]["id"]
                    print(f"✅ Using venue: {venues[0]['name']} (ID: {self.venue_id})")
                    return True
            print("❌ No venues found")
            return False
        except Exception as e:
            print(f"❌ Error getting venues: {e}")
            return False

    def test_slot_lock_acquire_soft(self):
        """Test POST /api/slots/lock - Acquire soft lock (10 min TTL, SETNX atomicity)"""
        lock_data = {
            "venue_id": self.venue_id,
            "date": self.test_date,
            "start_time": "10:00",
            "turf_number": 1
        }

        try:
            response = self.session1.post(f"{self.base_url}/slots/lock", json=lock_data)
            if response.status_code == 200:
                data = response.json()
                if (data.get("locked") and 
                    data.get("lock_type") == "soft" and 
                    data.get("ttl", 0) > 0):
                    self.log_result("Acquire soft lock", True, f"TTL: {data.get('ttl')}s")
                    return lock_data
                else:
                    self.log_result("Acquire soft lock", False, f"Invalid response: {data}")
            else:
                self.log_result("Acquire soft lock", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Acquire soft lock", False, str(e))
        return None

    def test_slot_lock_refresh_same_user(self, lock_data):
        """Test POST /api/slots/lock with same user - Should refresh existing lock"""
        try:
            response = self.session1.post(f"{self.base_url}/slots/lock", json=lock_data)
            if response.status_code == 200:
                data = response.json()
                if (data.get("locked") and 
                    "refreshed" in data.get("message", "").lower()):
                    self.log_result("Refresh lock (same user)", True)
                    return True
                else:
                    self.log_result("Refresh lock (same user)", False, f"Response: {data}")
            else:
                self.log_result("Refresh lock (same user)", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Refresh lock (same user)", False, str(e))
        return False

    def test_slot_lock_conflict_different_user(self, lock_data):
        """Test POST /api/slots/lock with different user - Should return 409 'on hold'"""
        try:
            response = self.session2.post(f"{self.base_url}/slots/lock", json=lock_data)
            if response.status_code == 409:
                data = response.json()
                message = data.get("detail", "").lower()
                if "hold" in message or "another user" in message:
                    self.log_result("Lock conflict (different user)", True, "409 - On hold")
                    return True
                else:
                    self.log_result("Lock conflict (different user)", False, f"Wrong message: {data}")
            else:
                self.log_result("Lock conflict (different user)", False, f"Expected 409, got {response.status_code}")
        except Exception as e:
            self.log_result("Lock conflict (different user)", False, str(e))
        return False

    def test_slot_unlock_owner_only(self, lock_data):
        """Test POST /api/slots/unlock - Release lock (only owner can release)"""
        # Test unauthorized unlock first
        try:
            response = self.session2.post(f"{self.base_url}/slots/unlock", json=lock_data)
            if response.status_code == 403:
                self.log_result("Unlock (unauthorized)", True, "403 - Permission denied")
            else:
                self.log_result("Unlock (unauthorized)", False, f"Expected 403, got {response.status_code}")
        except Exception as e:
            self.log_result("Unlock (unauthorized)", False, str(e))

        # Test authorized unlock
        try:
            response = self.session1.post(f"{self.base_url}/slots/unlock", json=lock_data)
            if response.status_code == 200:
                data = response.json()
                if data.get("released"):
                    self.log_result("Unlock (authorized)", True)
                    return True
                else:
                    self.log_result("Unlock (authorized)", False, f"Response: {data}")
            else:
                self.log_result("Unlock (authorized)", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Unlock (authorized)", False, str(e))
        return False

    def test_slot_extend_lock(self):
        """Test POST /api/slots/extend-lock - Extend to 30 min hard lock"""
        # First acquire a soft lock
        lock_data = {
            "venue_id": self.venue_id,
            "date": self.test_date,
            "start_time": "11:00",
            "turf_number": 1
        }

        # Acquire lock
        response = self.session1.post(f"{self.base_url}/slots/lock", json=lock_data)
        if response.status_code != 200:
            self.log_result("Extend lock setup", False, "Could not acquire initial lock")
            return

        # Now extend it
        try:
            response = self.session1.post(f"{self.base_url}/slots/extend-lock", json=lock_data)
            if response.status_code == 200:
                data = response.json()
                if (data.get("locked") and 
                    data.get("lock_type") == "hard" and 
                    data.get("ttl", 0) > 600):  # Should be around 1800s
                    self.log_result("Extend lock to hard", True, f"TTL: {data.get('ttl')}s")
                else:
                    self.log_result("Extend lock to hard", False, f"Response: {data}")
            else:
                self.log_result("Extend lock to hard", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Extend lock to hard", False, str(e))

        # Cleanup
        self.session1.post(f"{self.base_url}/slots/unlock", json=lock_data)

    def test_my_locks(self):
        """Test GET /api/slots/my-locks - List user's active locks"""
        # First acquire a lock
        lock_data = {
            "venue_id": self.venue_id,
            "date": self.test_date,
            "start_time": "12:00",
            "turf_number": 1
        }

        self.session1.post(f"{self.base_url}/slots/lock", json=lock_data)

        try:
            response = self.session1.get(f"{self.base_url}/slots/my-locks")
            if response.status_code == 200:
                data = response.json()
                locks = data.get("locks", [])
                found_lock = False
                for lock in locks:
                    if (lock.get("venue_id") == self.venue_id and 
                        lock.get("start_time") == "12:00"):
                        found_lock = True
                        break
                
                if found_lock:
                    self.log_result("My locks endpoint", True, f"Found {len(locks)} locks")
                else:
                    self.log_result("My locks endpoint", False, f"Lock not found in response: {locks}")
            else:
                self.log_result("My locks endpoint", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("My locks endpoint", False, str(e))

        # Cleanup
        self.session1.post(f"{self.base_url}/slots/unlock", json=lock_data)

    def test_lock_status(self):
        """Test GET /api/slots/lock-status - Check specific slot lock status"""
        lock_data = {
            "venue_id": self.venue_id,
            "date": self.test_date,
            "start_time": "13:00",
            "turf_number": 1
        }

        # Test unlocked status
        try:
            response = self.session1.get(f"{self.base_url}/slots/lock-status", params=lock_data)
            if response.status_code == 200:
                data = response.json()
                if not data.get("locked"):
                    self.log_result("Lock status (unlocked)", True)
                else:
                    self.log_result("Lock status (unlocked)", False, f"Expected unlocked: {data}")
            else:
                self.log_result("Lock status (unlocked)", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Lock status (unlocked)", False, str(e))

        # Acquire lock and test locked status
        self.session1.post(f"{self.base_url}/slots/lock", json=lock_data)

        try:
            response = self.session1.get(f"{self.base_url}/slots/lock-status", params=lock_data)
            if response.status_code == 200:
                data = response.json()
                if data.get("locked") and data.get("locked_by"):
                    self.log_result("Lock status (locked)", True, f"Locked by: {data.get('locked_by')}")
                else:
                    self.log_result("Lock status (locked)", False, f"Expected locked: {data}")
            else:
                self.log_result("Lock status (locked)", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Lock status (locked)", False, str(e))

        # Cleanup
        self.session1.post(f"{self.base_url}/slots/unlock", json=lock_data)

    def test_slots_endpoint_with_locks(self):
        """Test GET /api/venues/{id}/slots - Returns lock status for slots"""
        # First acquire a lock
        lock_data = {
            "venue_id": self.venue_id,
            "date": self.test_date,
            "start_time": "14:00",
            "turf_number": 1
        }

        self.session1.post(f"{self.base_url}/slots/lock", json=lock_data)

        # Test as lock owner (should see 'locked_by_you')
        try:
            response = self.session1.get(f"{self.base_url}/venues/{self.venue_id}/slots", 
                                       params={"date": self.test_date})
            if response.status_code == 200:
                data = response.json()
                slots = data.get("slots", [])
                found_locked_slot = False
                for slot in slots:
                    if (slot.get("start_time") == "14:00" and 
                        slot.get("turf_number") == 1):
                        if slot.get("status") == "locked_by_you":
                            found_locked_slot = True
                            break
                
                if found_locked_slot:
                    self.log_result("Slots endpoint (own lock)", True)
                else:
                    self.log_result("Slots endpoint (own lock)", False, "Own lock not detected")
            else:
                self.log_result("Slots endpoint (own lock)", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Slots endpoint (own lock)", False, str(e))

        # Test as different user (should see 'on_hold')
        try:
            response = self.session2.get(f"{self.base_url}/venues/{self.venue_id}/slots", 
                                       params={"date": self.test_date})
            if response.status_code == 200:
                data = response.json()
                slots = data.get("slots", [])
                found_hold_slot = False
                for slot in slots:
                    if (slot.get("start_time") == "14:00" and 
                        slot.get("turf_number") == 1):
                        if slot.get("status") == "on_hold":
                            found_hold_slot = True
                            break
                
                if found_hold_slot:
                    self.log_result("Slots endpoint (other's lock)", True)
                else:
                    self.log_result("Slots endpoint (other's lock)", False, "Other's lock not detected as 'on_hold'")
            else:
                self.log_result("Slots endpoint (other's lock)", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Slots endpoint (other's lock)", False, str(e))

        # Cleanup
        self.session1.post(f"{self.base_url}/slots/unlock", json=lock_data)

    def test_booking_with_locks(self):
        """Test booking behavior with Redis locks"""
        lock_data = {
            "venue_id": self.venue_id,
            "date": self.test_date,
            "start_time": "15:00",
            "turf_number": 1
        }
        
        booking_data = {
            "venue_id": self.venue_id,
            "date": self.test_date,
            "start_time": "15:00",
            "end_time": "16:00",
            "turf_number": 1,
            "sport": "football",
            "payment_mode": "full"
        }

        # Test 1: Try booking slot locked by another user (should fail with 409)
        self.session1.post(f"{self.base_url}/slots/lock", json=lock_data)
        
        try:
            response = self.session2.post(f"{self.base_url}/bookings", json=booking_data)
            if response.status_code == 409:
                self.log_result("Booking (locked by another)", True, "409 - Slot locked by another")
            else:
                self.log_result("Booking (locked by another)", False, f"Expected 409, got {response.status_code}")
        except Exception as e:
            self.log_result("Booking (locked by another)", False, str(e))

        # Test 2: Book slot locked by same user (should succeed and release lock)
        try:
            response = self.session1.post(f"{self.base_url}/bookings", json=booking_data)
            if response.status_code == 200:
                booking = response.json()
                if booking.get("status") in ["confirmed", "pending"]:
                    self.log_result("Booking (own lock)", True, f"Status: {booking.get('status')}")
                    
                    # Verify lock is released after booking
                    lock_status = self.session1.get(f"{self.base_url}/slots/lock-status", params=lock_data)
                    if lock_status.status_code == 200 and not lock_status.json().get("locked"):
                        self.log_result("Lock released after booking", True)
                    else:
                        self.log_result("Lock released after booking", False, "Lock still present")
                        
                    return booking.get("id")
                else:
                    self.log_result("Booking (own lock)", False, f"Invalid status: {booking}")
            else:
                self.log_result("Booking (own lock)", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Booking (own lock)", False, str(e))

        return None

    def test_booking_cancellation_lock_release(self, booking_id):
        """Test POST /api/bookings/{id}/cancel - Releases Redis lock on cancellation"""
        if not booking_id:
            self.log_result("Booking cancellation setup", False, "No booking ID provided")
            return

        try:
            response = self.session1.post(f"{self.base_url}/bookings/{booking_id}/cancel")
            if response.status_code == 200:
                self.log_result("Booking cancellation", True)
            else:
                self.log_result("Booking cancellation", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Booking cancellation", False, str(e))

    def run_backend_tests(self):
        """Run all backend Redis slot locking tests"""
        print("🚀 Starting Redis Slot Locking Backend Tests")
        print("=" * 60)

        if not self.login_users():
            return False

        if not self.get_venue_id():
            return False

        print(f"\n📅 Testing with date: {self.test_date}")
        print(f"🏟️  Testing with venue: {self.venue_id}")
        print("-" * 40)

        # Core locking tests
        lock_data = self.test_slot_lock_acquire_soft()
        if lock_data:
            self.test_slot_lock_refresh_same_user(lock_data)
            self.test_slot_lock_conflict_different_user(lock_data)
            self.test_slot_unlock_owner_only(lock_data)

        # Extended locking tests
        self.test_slot_extend_lock()
        self.test_my_locks()
        self.test_lock_status()
        self.test_slots_endpoint_with_locks()

        # Integration with booking system
        booking_id = self.test_booking_with_locks()
        if booking_id:
            self.test_booking_cancellation_lock_release(booking_id)

        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print(f"📊 Backend Test Summary: {self.tests_passed}/{self.tests_run} passed")
        print(f"✅ Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.tests_passed < self.tests_run:
            print("\n❌ Failed Tests:")
            for result in self.results:
                if not result["passed"]:
                    print(f"   • {result['test']}: {result['details']}")

def main():
    tester = RedisSlotLockingTester()
    
    success = tester.run_backend_tests()
    tester.print_summary()
    
    # Save results for integration with test report
    with open("/tmp/redis_lock_test_results.json", "w") as f:
        json.dump({
            "tests_run": tester.tests_run,
            "tests_passed": tester.tests_passed,
            "success_rate": f"{(tester.tests_passed/tester.tests_run*100):.1f}%",
            "results": tester.results
        }, f, indent=2)
    
    return 0 if success and tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)