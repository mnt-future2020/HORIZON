#!/usr/bin/env python3
"""
Backend API Testing for Horizon Sports Facility OS
Tests all endpoints with demo credentials
"""

import requests
import sys
import json
from datetime import datetime, timedelta

class HorizonAPITester:
    def __init__(self, base_url="https://iot-venue-hub.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Demo credentials
        self.demo_credentials = {
            "player": {"email": "demo@player.com", "password": "demo123"},
            "owner": {"email": "demo@owner.com", "password": "demo123"},
            "coach": {"email": "demo@coach.com", "password": "demo123"}
        }

    def log_test(self, name, success, details="", response_data=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "name": name,
            "success": success,
            "details": details,
            "response": str(response_data)[:200] if response_data else ""
        })

    def make_request(self, method, endpoint, data=None, auth_required=True):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            
            return response
        except Exception as e:
            return None

    def test_auth(self):
        """Test authentication endpoints"""
        print("\n🔐 Testing Authentication...")
        
        # Test login for all three roles
        for role, creds in self.demo_credentials.items():
            response = self.make_request('POST', 'auth/login', creds, auth_required=False)
            if response and response.status_code == 200:
                data = response.json()
                if role == "player":  # Use player for subsequent tests
                    self.token = data.get('token')
                    self.user = data.get('user')
                self.log_test(f"Login as {role}", True, f"Token received, user: {data.get('user', {}).get('name', 'Unknown')}")
            else:
                error = response.json().get('detail') if response else "Network error"
                self.log_test(f"Login as {role}", False, f"Status: {response.status_code if response else 'ERROR'}, Error: {error}")

        # Test get me endpoint
        if self.token:
            response = self.make_request('GET', 'auth/me')
            if response and response.status_code == 200:
                self.log_test("Get current user", True, f"User: {response.json().get('name')}")
            else:
                self.log_test("Get current user", False, f"Status: {response.status_code if response else 'ERROR'}")

    def test_venues(self):
        """Test venue endpoints"""
        print("\n🏟️ Testing Venues...")
        
        # List venues
        response = self.make_request('GET', 'venues')
        if response and response.status_code == 200:
            venues = response.json()
            self.venues = venues
            self.log_test("List venues", True, f"Found {len(venues)} venues")
            
            if venues:
                # Test individual venue details
                venue_id = venues[0]['id']
                response = self.make_request('GET', f'venues/{venue_id}')
                if response and response.status_code == 200:
                    venue_data = response.json()
                    self.log_test("Get venue details", True, f"Venue: {venue_data.get('name')}")
                    
                    # Test venue slots
                    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
                    response = self.make_request('GET', f'venues/{venue_id}/slots?date={tomorrow}')
                    if response and response.status_code == 200:
                        slots_data = response.json()
                        slots = slots_data.get('slots', [])
                        self.log_test("Get venue slots", True, f"Found {len(slots)} slots for {tomorrow}")
                        self.test_venue_id = venue_id
                        self.test_slots = slots
                    else:
                        self.log_test("Get venue slots", False, f"Status: {response.status_code}")
                else:
                    self.log_test("Get venue details", False, f"Status: {response.status_code}")
        else:
            self.log_test("List venues", False, f"Status: {response.status_code if response else 'ERROR'}")

    def test_bookings(self):
        """Test booking endpoints"""
        print("\n📅 Testing Bookings...")
        
        if not hasattr(self, 'test_venue_id') or not hasattr(self, 'test_slots'):
            self.log_test("Create booking", False, "No venue/slots data available")
            return

        # Find an available slot
        available_slot = None
        for slot in self.test_slots:
            if slot.get('status') == 'available':
                available_slot = slot
                break

        if not available_slot:
            self.log_test("Create booking", False, "No available slots found")
            return

        # Test full payment booking
        booking_data = {
            "venue_id": self.test_venue_id,
            "date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
            "start_time": available_slot['start_time'],
            "end_time": available_slot['end_time'],
            "turf_number": available_slot['turf_number'],
            "sport": "football",
            "payment_mode": "full"
        }

        response = self.make_request('POST', 'bookings', booking_data)
        if response and response.status_code == 200:
            booking = response.json()
            self.test_booking_id = booking['id']
            self.log_test("Create booking (full payment)", True, f"Booking ID: {booking['id']}, Status: {booking['status']}")
            
            # Test split payment booking (different slot)
            if len(self.test_slots) > 1:
                available_slot2 = None
                for slot in self.test_slots:
                    if slot.get('status') == 'available' and slot != available_slot:
                        available_slot2 = slot
                        break
                
                if available_slot2:
                    split_booking_data = {
                        **booking_data,
                        "start_time": available_slot2['start_time'],
                        "end_time": available_slot2['end_time'],
                        "turf_number": available_slot2['turf_number'],
                        "payment_mode": "split",
                        "split_count": 10
                    }
                    
                    response = self.make_request('POST', 'bookings', split_booking_data)
                    if response and response.status_code == 200:
                        split_booking = response.json()
                        self.test_split_booking_id = split_booking['id']
                        self.split_token = split_booking.get('split_config', {}).get('split_token')
                        self.log_test("Create booking (split payment)", True, f"Split token: {self.split_token}")
                    else:
                        self.log_test("Create booking (split payment)", False, f"Status: {response.status_code}")

        else:
            error = response.json().get('detail') if response else "Network error"
            self.log_test("Create booking (full payment)", False, f"Status: {response.status_code if response else 'ERROR'}, Error: {error}")

        # Test list bookings
        response = self.make_request('GET', 'bookings')
        if response and response.status_code == 200:
            bookings = response.json()
            self.log_test("List bookings", True, f"Found {len(bookings)} bookings")
        else:
            self.log_test("List bookings", False, f"Status: {response.status_code}")

    def test_split_payment(self):
        """Test split payment endpoints"""
        print("\n💰 Testing Split Payments...")
        
        if not hasattr(self, 'split_token') or not self.split_token:
            self.log_test("Split payment", False, "No split token available")
            return

        # Test get split info
        response = self.make_request('GET', f'split/{self.split_token}', auth_required=False)
        if response and response.status_code == 200:
            split_info = response.json()
            self.log_test("Get split payment info", True, f"Remaining: {split_info.get('remaining')} payments")
            
            # Test making a split payment
            pay_data = {"payer_name": "Test User"}
            response = self.make_request('POST', f'split/{self.split_token}/pay', pay_data, auth_required=False)
            if response and response.status_code == 200:
                payment_result = response.json()
                self.log_test("Make split payment", True, "Payment successful (MOCKED)")
            else:
                self.log_test("Make split payment", False, f"Status: {response.status_code}")
        else:
            self.log_test("Get split payment info", False, f"Status: {response.status_code}")

    def test_matchmaking(self):
        """Test matchmaking endpoints"""
        print("\n⚔️ Testing Matchmaking...")
        
        # List matches
        response = self.make_request('GET', 'matchmaking')
        if response and response.status_code == 200:
            matches = response.json()
            self.log_test("List matches", True, f"Found {len(matches)} matches")
            
            # Try to join a match
            if matches:
                match_id = matches[0]['id']
                response = self.make_request('POST', f'matchmaking/{match_id}/join')
                if response and response.status_code == 200:
                    self.log_test("Join match", True, "Successfully joined match")
                else:
                    error = response.json().get('detail') if response else "Unknown error"
                    self.log_test("Join match", False, f"Error: {error}")
            
        else:
            self.log_test("List matches", False, f"Status: {response.status_code}")

        # Create a match
        tomorrow = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        match_data = {
            "sport": "football",
            "date": tomorrow,
            "time": "19:00",
            "venue_name": "Test Venue",
            "players_needed": 10,
            "min_skill": 1000,
            "max_skill": 2000,
            "description": "Test match from API test"
        }
        
        response = self.make_request('POST', 'matchmaking', match_data)
        if response and response.status_code == 200:
            match = response.json()
            self.log_test("Create match", True, f"Match ID: {match['id']}")
        else:
            error = response.json().get('detail') if response else "Unknown error"
            self.log_test("Create match", False, f"Error: {error}")

    def test_mercenary(self):
        """Test mercenary endpoints"""
        print("\n🎯 Testing Mercenary...")
        
        # List mercenary posts
        response = self.make_request('GET', 'mercenary')
        if response and response.status_code == 200:
            posts = response.json()
            self.log_test("List mercenary posts", True, f"Found {len(posts)} posts")
            
            # Try to apply to a post
            if posts:
                post_id = posts[0]['id']
                response = self.make_request('POST', f'mercenary/{post_id}/apply')
                if response and response.status_code == 200:
                    self.log_test("Apply to mercenary", True, "Successfully applied")
                else:
                    error = response.json().get('detail') if response else "Unknown error"
                    self.log_test("Apply to mercenary", False, f"Error: {error}")
        else:
            self.log_test("List mercenary posts", False, f"Status: {response.status_code}")

        # Create mercenary post
        tomorrow = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        merc_data = {
            "sport": "football",
            "venue_name": "Test Venue",
            "date": tomorrow,
            "time": "20:00",
            "position_needed": "Goalkeeper",
            "amount_per_player": 200,
            "spots_available": 1
        }
        
        response = self.make_request('POST', 'mercenary', merc_data)
        if response and response.status_code == 200:
            post = response.json()
            self.log_test("Create mercenary post", True, f"Post ID: {post['id']}")
        else:
            error = response.json().get('detail') if response else "Unknown error"
            self.log_test("Create mercenary post", False, f"Error: {error}")

    def test_analytics(self):
        """Test analytics endpoints"""
        print("\n📊 Testing Analytics...")
        
        # Player analytics
        response = self.make_request('GET', 'analytics/player')
        if response and response.status_code == 200:
            stats = response.json()
            self.log_test("Player analytics", True, f"Games: {stats.get('total_games', 0)}, Rating: {stats.get('skill_rating', 0)}")
        else:
            self.log_test("Player analytics", False, f"Status: {response.status_code}")

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting Horizon Sports API Tests...")
        print(f"Base URL: {self.base_url}")
        
        self.test_auth()
        if self.token:
            self.test_venues()
            self.test_bookings()
            self.test_split_payment()
            self.test_matchmaking()
            self.test_mercenary()
            self.test_analytics()
        else:
            print("❌ Authentication failed - skipping other tests")

        # Print summary
        print(f"\n📈 Test Summary:")
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Success rate: {(self.tests_passed / self.tests_run * 100):.1f}%")
        
        # Return success if >80% tests pass
        return self.tests_passed / self.tests_run > 0.8

def main():
    tester = HorizonAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/tmp/backend_test_results.json', 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'summary': {
                'tests_run': tester.tests_run,
                'tests_passed': tester.tests_passed,
                'success_rate': tester.tests_passed / tester.tests_run if tester.tests_run > 0 else 0
            },
            'results': tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())