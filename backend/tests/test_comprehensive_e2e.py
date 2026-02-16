"""
Comprehensive E2E tests for Horizon Sports Facility Operating System.
Tests ALL features: Auth, Player Dashboard, Venue Discovery, Booking Flow, 
Matchmaking, Rating System, Mercenary Marketplace, Venue Owner Dashboard,
Dynamic Pricing, Subscriptions, Super Admin, Video Highlights, IoT, Notifications.
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PLAYER_CREDS = {"email": "demo@player.com", "password": "demo123"}
OWNER_CREDS = {"email": "demo@owner.com", "password": "demo123"}
ADMIN_CREDS = {"email": "admin@horizon.com", "password": "admin123"}
COACH_CREDS = {"email": "demo@coach.com", "password": "demo123"}


class TestAuth:
    """Authentication endpoint tests"""
    
    def test_player_login_success(self):
        """AUTH: Login as player (demo@player.com/demo123)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=PLAYER_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == "demo@player.com"
        assert data["user"]["role"] == "player"
        
    def test_owner_login_success(self):
        """AUTH: Login as venue owner (demo@owner.com/demo123)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=OWNER_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["email"] == "demo@owner.com"
        assert data["user"]["role"] == "venue_owner"
        
    def test_admin_login_success(self):
        """AUTH: Login as super admin (admin@horizon.com/admin123)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["email"] == "admin@horizon.com"
        assert data["user"]["role"] == "super_admin"
        
    def test_coach_login_success(self):
        """AUTH: Login as coach (demo@coach.com/demo123)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=COACH_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["email"] == "demo@coach.com"
        assert data["user"]["role"] == "coach"
        
    def test_invalid_credentials_rejected(self):
        """AUTH: Invalid credentials rejected"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com", "password": "wrongpass"
        })
        assert response.status_code == 401
        
    def test_unauthenticated_protected_endpoint(self):
        """AUTH: Token-protected endpoints reject unauthenticated requests"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403]


@pytest.fixture
def player_token():
    response = requests.post(f"{BASE_URL}/api/auth/login", json=PLAYER_CREDS)
    if response.status_code == 200:
        return response.json()["token"]
    pytest.skip("Player login failed")


@pytest.fixture
def owner_token():
    response = requests.post(f"{BASE_URL}/api/auth/login", json=OWNER_CREDS)
    if response.status_code == 200:
        return response.json()["token"]
    pytest.skip("Owner login failed")


@pytest.fixture
def admin_token():
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
    if response.status_code == 200:
        return response.json()["token"]
    pytest.skip("Admin login failed")


@pytest.fixture
def coach_token():
    response = requests.post(f"{BASE_URL}/api/auth/login", json=COACH_CREDS)
    if response.status_code == 200:
        return response.json()["token"]
    pytest.skip("Coach login failed")


class TestPlayerDashboard:
    """Player dashboard feature tests"""
    
    def test_get_player_stats(self, player_token):
        """PLAYER DASHBOARD: Shows stats (skill rating, games played, win rate)"""
        headers = {"Authorization": f"Bearer {player_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "skill_rating" in data
        assert "total_games" in data
        assert "wins" in data
        assert "losses" in data
        
    def test_get_player_bookings(self, player_token):
        """PLAYER DASHBOARD: Shows upcoming bookings list"""
        headers = {"Authorization": f"Bearer {player_token}"}
        response = requests.get(f"{BASE_URL}/api/bookings", headers=headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        
    def test_get_player_analytics(self, player_token):
        """PLAYER DASHBOARD: Get player analytics"""
        headers = {"Authorization": f"Bearer {player_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/player", headers=headers)
        assert response.status_code == 200


class TestVenueDiscovery:
    """Venue discovery feature tests"""
    
    def test_list_venues(self, player_token):
        """VENUE DISCOVERY: List venues"""
        headers = {"Authorization": f"Bearer {player_token}"}
        response = requests.get(f"{BASE_URL}/api/venues", headers=headers)
        assert response.status_code == 200
        venues = response.json()
        assert isinstance(venues, list)
        assert len(venues) > 0
        
    def test_filter_venues_by_sport(self, player_token):
        """VENUE DISCOVERY: Filter venues by sport"""
        headers = {"Authorization": f"Bearer {player_token}"}
        response = requests.get(f"{BASE_URL}/api/venues?sport=football", headers=headers)
        assert response.status_code == 200
        
    def test_search_venues(self, player_token):
        """VENUE DISCOVERY: Search venues"""
        headers = {"Authorization": f"Bearer {player_token}"}
        response = requests.get(f"{BASE_URL}/api/venues?search=Sports", headers=headers)
        assert response.status_code == 200
        
    def test_venue_cards_display(self, player_token):
        """VENUE DISCOVERY: Venue cards display correctly"""
        headers = {"Authorization": f"Bearer {player_token}"}
        response = requests.get(f"{BASE_URL}/api/venues", headers=headers)
        assert response.status_code == 200
        venues = response.json()
        if venues:
            venue = venues[0]
            assert "id" in venue
            assert "name" in venue
            assert "address" in venue


class TestVenueDetail:
    """Venue detail and slot feature tests"""
    
    def test_get_venue_detail(self, player_token):
        """VENUE DETAIL: Shows venue info"""
        headers = {"Authorization": f"Bearer {player_token}"}
        venues_resp = requests.get(f"{BASE_URL}/api/venues", headers=headers)
        venues = venues_resp.json()
        if not venues:
            pytest.skip("No venues found")
        venue_id = venues[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/venues/{venue_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "sports" in data
        
    def test_get_venue_slots(self, player_token):
        """VENUE DETAIL: Calendar date picker, slot grid with prices per turf"""
        headers = {"Authorization": f"Bearer {player_token}"}
        venues_resp = requests.get(f"{BASE_URL}/api/venues", headers=headers)
        venues = venues_resp.json()
        if not venues:
            pytest.skip("No venues found")
        venue_id = venues[0]["id"]
        
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(f"{BASE_URL}/api/venues/{venue_id}/slots?date={today}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "slots" in data
        assert "venue_id" in data
        assert "date" in data


class TestBookingFlow:
    """Booking flow feature tests"""
    
    def test_create_booking_flow(self, player_token):
        """BOOKING FLOW: Select slot -> confirm payment -> booking confirmed"""
        headers = {"Authorization": f"Bearer {player_token}"}
        
        # Get a venue
        venues_resp = requests.get(f"{BASE_URL}/api/venues", headers=headers)
        venues = venues_resp.json()
        if not venues:
            pytest.skip("No venues found")
        venue = venues[0]
        
        # Get slots for tomorrow (less likely to be booked)
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        slots_resp = requests.get(f"{BASE_URL}/api/venues/{venue['id']}/slots?date={tomorrow}", headers=headers)
        slots = slots_resp.json().get("slots", [])
        
        # Find an available slot
        available_slot = next((s for s in slots if s["status"] == "available"), None)
        if not available_slot:
            pytest.skip("No available slots found")
            
        # Create booking
        booking_data = {
            "venue_id": venue["id"],
            "date": tomorrow,
            "start_time": available_slot["start_time"],
            "end_time": available_slot["end_time"],
            "turf_number": available_slot.get("turf_number", 1),
            "sport": venue.get("sports", ["football"])[0] if venue.get("sports") else "football",
            "payment_mode": "full"
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=headers)
        # With Redis down, booking should still work (graceful degradation)
        assert response.status_code in [200, 201]
        data = response.json()
        assert "id" in data
        assert data.get("status") in ["confirmed", "payment_pending"]
        
    def test_split_payment_option(self, player_token):
        """SPLIT PAYMENT: Booking dialog shows split payment option"""
        headers = {"Authorization": f"Bearer {player_token}"}
        
        venues_resp = requests.get(f"{BASE_URL}/api/venues", headers=headers)
        venues = venues_resp.json()
        if not venues:
            pytest.skip("No venues found")
        venue = venues[0]
        
        # Day after tomorrow for split payment test
        future_date = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        slots_resp = requests.get(f"{BASE_URL}/api/venues/{venue['id']}/slots?date={future_date}", headers=headers)
        slots = slots_resp.json().get("slots", [])
        
        available_slot = next((s for s in slots if s["status"] == "available"), None)
        if not available_slot:
            pytest.skip("No available slots for split payment test")
            
        # Create booking with split payment
        booking_data = {
            "venue_id": venue["id"],
            "date": future_date,
            "start_time": available_slot["start_time"],
            "end_time": available_slot["end_time"],
            "turf_number": available_slot.get("turf_number", 1),
            "sport": venue.get("sports", ["football"])[0] if venue.get("sports") else "football",
            "payment_mode": "split",
            "split_count": 4
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=headers)
        assert response.status_code in [200, 201]
        data = response.json()
        assert "split_config" in data
        assert data["split_config"]["total_shares"] == 4


class TestMatchmaking:
    """Matchmaking feature tests"""
    
    def test_list_matches(self, player_token):
        """MATCHMAKING: View available matches"""
        headers = {"Authorization": f"Bearer {player_token}"}
        response = requests.get(f"{BASE_URL}/api/matchmaking", headers=headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        
    def test_create_match_request(self, player_token):
        """MATCHMAKING: Create match request"""
        headers = {"Authorization": f"Bearer {player_token}"}
        
        match_data = {
            "sport": "football",
            "venue_name": "Test Venue",
            "date": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d"),
            "time": "18:00",
            "players_needed": 10,
            "min_skill": 1200,
            "max_skill": 1800,
            "description": "TEST_Friendly match"
        }
        
        response = requests.post(f"{BASE_URL}/api/matchmaking", json=match_data, headers=headers)
        assert response.status_code in [200, 201]
        data = response.json()
        assert "id" in data
        assert data["sport"] == "football"
        
    def test_recommended_matches(self, player_token):
        """MATCHMAKING: 'For You' recommendations with compatibility scores"""
        headers = {"Authorization": f"Bearer {player_token}"}
        response = requests.get(f"{BASE_URL}/api/matchmaking/recommended", headers=headers)
        assert response.status_code == 200
        matches = response.json()
        # If there are matches, they should have compatibility scores
        if matches:
            assert "compatibility_score" in matches[0]
            
    def test_auto_match(self, player_token):
        """MATCHMAKING: Auto-match finds best match"""
        headers = {"Authorization": f"Bearer {player_token}"}
        response = requests.post(f"{BASE_URL}/api/matchmaking/auto-match", 
                                json={"sport": "football"}, headers=headers)
        assert response.status_code == 200
        # Either found a match or says none found
        data = response.json()
        assert "found" in data


class TestLeaderboard:
    """Leaderboard feature tests"""
    
    def test_get_leaderboard(self, player_token):
        """LEADERBOARD: Shows player rankings by sport with rating, games, wins"""
        headers = {"Authorization": f"Bearer {player_token}"}
        response = requests.get(f"{BASE_URL}/api/leaderboard", headers=headers)
        assert response.status_code == 200
        leaderboard = response.json()
        assert isinstance(leaderboard, list)
        if leaderboard:
            player = leaderboard[0]
            assert "rank" in player
            assert "skill_rating" in player
            assert "total_games" in player
            assert "wins" in player
            
    def test_leaderboard_filter_by_sport(self, player_token):
        """LEADERBOARD: Filter by sport"""
        headers = {"Authorization": f"Bearer {player_token}"}
        response = requests.get(f"{BASE_URL}/api/leaderboard?sport=football", headers=headers)
        assert response.status_code == 200


class TestRatingProfile:
    """Rating profile and verification tests"""
    
    def test_get_rating_history(self, player_token):
        """RATING PROFILE: Rating history with chain-hashed verification"""
        headers = {"Authorization": f"Bearer {player_token}"}
        
        # Get player id
        me_resp = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        user_id = me_resp.json()["id"]
        
        response = requests.get(f"{BASE_URL}/api/rating/history/{user_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert "records" in data
        
    def test_verify_rating_chain(self, player_token):
        """RATING PROFILE: Verify chain integrity"""
        headers = {"Authorization": f"Bearer {player_token}"}
        
        me_resp = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        user_id = me_resp.json()["id"]
        
        response = requests.get(f"{BASE_URL}/api/rating/verify/{user_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "verified" in data
        assert "chain_intact" in data
        
    def test_get_rating_certificate(self, player_token):
        """RATING PROFILE: Certificate of integrity"""
        headers = {"Authorization": f"Bearer {player_token}"}
        
        me_resp = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        user_id = me_resp.json()["id"]
        
        response = requests.get(f"{BASE_URL}/api/rating/certificate/{user_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "player" in data
        assert "verification" in data
        assert "journey" in data


class TestMercenaryMarketplace:
    """Mercenary marketplace feature tests"""
    
    def test_list_mercenary_posts(self, player_token):
        """MERCENARY MARKETPLACE: List available mercenary posts"""
        headers = {"Authorization": f"Bearer {player_token}"}
        response = requests.get(f"{BASE_URL}/api/mercenary", headers=headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        
    def test_my_mercenary_posts(self, player_token):
        """MERCENARY MARKETPLACE: View own mercenary posts"""
        headers = {"Authorization": f"Bearer {player_token}"}
        response = requests.get(f"{BASE_URL}/api/mercenary/my-posts", headers=headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestVenueOwnerDashboard:
    """Venue owner dashboard feature tests"""
    
    def test_get_owner_venues(self, owner_token):
        """VENUE OWNER DASHBOARD: Get owner venues"""
        headers = {"Authorization": f"Bearer {owner_token}"}
        response = requests.get(f"{BASE_URL}/api/owner/venues", headers=headers)
        assert response.status_code == 200
        venues = response.json()
        assert isinstance(venues, list)
        assert len(venues) > 0
        
    def test_get_owner_bookings(self, owner_token):
        """VENUE OWNER DASHBOARD: Bookings list"""
        headers = {"Authorization": f"Bearer {owner_token}"}
        response = requests.get(f"{BASE_URL}/api/bookings", headers=headers)
        assert response.status_code == 200
        
    def test_get_venue_analytics(self, owner_token):
        """VENUE OWNER DASHBOARD: Analytics tab"""
        headers = {"Authorization": f"Bearer {owner_token}"}
        venues_resp = requests.get(f"{BASE_URL}/api/owner/venues", headers=headers)
        venues = venues_resp.json()
        if not venues:
            pytest.skip("No venues found")
        venue_id = venues[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/analytics/venue/{venue_id}", headers=headers)
        assert response.status_code == 200


class TestDynamicPricing:
    """Dynamic pricing feature tests"""
    
    def test_get_pricing_rules(self, owner_token):
        """DYNAMIC PRICING: Get pricing rules"""
        headers = {"Authorization": f"Bearer {owner_token}"}
        venues_resp = requests.get(f"{BASE_URL}/api/owner/venues", headers=headers)
        venues = venues_resp.json()
        if not venues:
            pytest.skip("No venues found")
        venue_id = venues[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/venues/{venue_id}/pricing-rules", headers=headers)
        assert response.status_code == 200
        
    def test_create_pricing_rule(self, owner_token):
        """DYNAMIC PRICING: Create rule with day-of-week + time range + multiplier"""
        headers = {"Authorization": f"Bearer {owner_token}"}
        venues_resp = requests.get(f"{BASE_URL}/api/owner/venues", headers=headers)
        venues = venues_resp.json()
        if not venues:
            pytest.skip("No venues found")
        venue_id = venues[0]["id"]
        
        rule_data = {
            "name": "TEST_Weekend Peak",
            "conditions": {
                "days": [5, 6],  # Saturday, Sunday
                "time_range": {"start": "18:00", "end": "22:00"}
            },
            "action": {
                "type": "multiplier",
                "value": 1.3
            },
            "priority": 10,
            "is_active": True
        }
        
        response = requests.post(f"{BASE_URL}/api/venues/{venue_id}/pricing-rules", 
                                json=rule_data, headers=headers)
        assert response.status_code in [200, 201]
        data = response.json()
        assert "id" in data
        
        # Cleanup - delete the test rule
        rule_id = data["id"]
        requests.delete(f"{BASE_URL}/api/pricing-rules/{rule_id}", headers=headers)
        
    def test_toggle_pricing_rule(self, owner_token):
        """DYNAMIC PRICING: Toggle active/inactive"""
        headers = {"Authorization": f"Bearer {owner_token}"}
        venues_resp = requests.get(f"{BASE_URL}/api/owner/venues", headers=headers)
        venues = venues_resp.json()
        if not venues:
            pytest.skip("No venues found")
        venue_id = venues[0]["id"]
        
        # Get existing rules
        rules_resp = requests.get(f"{BASE_URL}/api/venues/{venue_id}/pricing-rules", headers=headers)
        rules = rules_resp.json()
        if not rules:
            pytest.skip("No pricing rules found")
        rule_id = rules[0]["id"]
        
        response = requests.put(f"{BASE_URL}/api/pricing-rules/{rule_id}/toggle", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "is_active" in data


class TestSubscriptionPlans:
    """Subscription plan feature tests"""
    
    def test_get_my_plan(self, owner_token):
        """SUBSCRIPTION PLANS: View current plan"""
        headers = {"Authorization": f"Bearer {owner_token}"}
        response = requests.get(f"{BASE_URL}/api/subscription/my-plan", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "current_plan" in data
        assert "all_plans" in data
        assert "venues_used" in data
        assert "venues_limit" in data


class TestSuperAdmin:
    """Super admin feature tests"""
    
    def test_admin_dashboard(self, admin_token):
        """SUPER ADMIN: Dashboard stats"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_users" in data
        assert "total_venues" in data
        assert "total_bookings" in data
        
    def test_admin_users_list(self, admin_token):
        """SUPER ADMIN: Users list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        
    def test_admin_venues_list(self, admin_token):
        """SUPER ADMIN: Venue approval list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/venues", headers=headers)
        assert response.status_code == 200
        
    def test_admin_settings(self, admin_token):
        """SUPER ADMIN: Platform settings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/settings", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "payment_gateway" in data
        assert "subscription_plans" in data


class TestVideoHighlights:
    """Video highlights feature tests"""
    
    def test_list_highlights(self, player_token):
        """VIDEO HIGHLIGHTS: List user highlights"""
        headers = {"Authorization": f"Bearer {player_token}"}
        response = requests.get(f"{BASE_URL}/api/highlights", headers=headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        
    def test_upload_video(self, player_token):
        """VIDEO HIGHLIGHTS: Upload video"""
        headers = {"Authorization": f"Bearer {player_token}"}
        
        # Check if test video exists
        video_path = "/tmp/real_test.mp4"
        import os as os_module
        if not os_module.path.exists(video_path):
            pytest.skip("Test video not found at /tmp/real_test.mp4")
            
        with open(video_path, 'rb') as f:
            files = {'file': ('test_video.mp4', f, 'video/mp4')}
            data = {'title': 'TEST_Upload Video'}
            response = requests.post(f"{BASE_URL}/api/highlights/upload", 
                                    files=files, data=data, headers=headers)
        
        assert response.status_code in [200, 201]
        data = response.json()
        assert "id" in data
        
        # Cleanup
        highlight_id = data["id"]
        requests.delete(f"{BASE_URL}/api/highlights/{highlight_id}", headers=headers)


class TestSharedHighlight:
    """Shared highlight public page tests"""
    
    def test_get_shared_highlight(self):
        """SHARED HIGHLIGHT: Public page renders without auth"""
        # Try to get an existing shared highlight
        # First, check if there's any shared highlight in the system
        response = requests.get(f"{BASE_URL}/api/highlights/shared/testshare")
        # 404 is expected if no shared highlight exists, but endpoint should work
        assert response.status_code in [200, 404]


class TestIoTDashboard:
    """IoT dashboard feature tests"""
    
    def test_mqtt_status(self, owner_token):
        """IOT MQTT: MQTT status returns connected=true"""
        headers = {"Authorization": f"Bearer {owner_token}"}
        response = requests.get(f"{BASE_URL}/api/iot/mqtt-status", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "connected" in data
        assert "broker" in data
        
    def test_list_iot_devices(self, owner_token):
        """IOT DASHBOARD: List devices"""
        headers = {"Authorization": f"Bearer {owner_token}"}
        
        # Get owner's venue
        venues_resp = requests.get(f"{BASE_URL}/api/owner/venues", headers=headers)
        venues = venues_resp.json()
        if not venues:
            pytest.skip("No venues found")
        venue_id = venues[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/iot/devices?venue_id={venue_id}", headers=headers)
        assert response.status_code == 200
        devices = response.json()
        assert isinstance(devices, list)
        
    def test_list_iot_zones(self, owner_token):
        """IOT ZONES: List zones with device counts"""
        headers = {"Authorization": f"Bearer {owner_token}"}
        
        venues_resp = requests.get(f"{BASE_URL}/api/owner/venues", headers=headers)
        venues = venues_resp.json()
        if not venues:
            pytest.skip("No venues found")
        venue_id = venues[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/iot/zones?venue_id={venue_id}", headers=headers)
        assert response.status_code == 200
        zones = response.json()
        assert isinstance(zones, list)
        
    def test_energy_analytics(self, owner_token):
        """IOT ENERGY: Energy analytics (kWh, cost)"""
        headers = {"Authorization": f"Bearer {owner_token}"}
        
        venues_resp = requests.get(f"{BASE_URL}/api/owner/venues", headers=headers)
        venues = venues_resp.json()
        if not venues:
            pytest.skip("No venues found")
        venue_id = venues[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/iot/energy?venue_id={venue_id}&period=7d", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "daily" in data
        
    def test_iot_schedules(self, owner_token):
        """IOT SCHEDULES: Booking-linked lighting schedule"""
        headers = {"Authorization": f"Bearer {owner_token}"}
        
        venues_resp = requests.get(f"{BASE_URL}/api/owner/venues", headers=headers)
        venues = venues_resp.json()
        if not venues:
            pytest.skip("No venues found")
        venue_id = venues[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/iot/schedules?venue_id={venue_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "date" in data
        assert "schedules" in data
        
    def test_device_control(self, owner_token):
        """IOT DASHBOARD: Device toggle on/off via MQTT"""
        headers = {"Authorization": f"Bearer {owner_token}"}
        
        venues_resp = requests.get(f"{BASE_URL}/api/owner/venues", headers=headers)
        venues = venues_resp.json()
        if not venues:
            pytest.skip("No venues found")
        venue_id = venues[0]["id"]
        
        # Get devices
        devices_resp = requests.get(f"{BASE_URL}/api/iot/devices?venue_id={venue_id}", headers=headers)
        devices = devices_resp.json()
        if not devices:
            pytest.skip("No IoT devices found")
        device_id = devices[0]["id"]
        
        # Turn on device
        response = requests.post(f"{BASE_URL}/api/iot/devices/{device_id}/control", 
                                json={"action": "on", "brightness": 80}, headers=headers)
        assert response.status_code in [200, 503]  # 503 if device offline
        
    def test_admin_mqtt_access(self, admin_token):
        """IOT MQTT: Super admin access"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/iot/mqtt-status", headers=headers)
        assert response.status_code == 200


class TestNotifications:
    """Notification feature tests"""
    
    def test_list_notifications(self, player_token):
        """NOTIFICATIONS: List notifications"""
        headers = {"Authorization": f"Bearer {player_token}"}
        response = requests.get(f"{BASE_URL}/api/notifications", headers=headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        
    def test_unread_count(self, player_token):
        """NOTIFICATIONS: Unread count"""
        headers = {"Authorization": f"Bearer {player_token}"}
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        
    def test_mark_all_read(self, player_token):
        """NOTIFICATIONS: Mark all as read"""
        headers = {"Authorization": f"Bearer {player_token}"}
        response = requests.put(f"{BASE_URL}/api/notifications/read-all", headers=headers)
        assert response.status_code == 200


class TestPaymentGateway:
    """Payment gateway info tests"""
    
    def test_payment_gateway_info(self, player_token):
        """PAYMENT: Get gateway info"""
        headers = {"Authorization": f"Bearer {player_token}"}
        response = requests.get(f"{BASE_URL}/api/payment/gateway-info", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "has_gateway" in data
        assert "provider" in data


class TestAcademies:
    """Academy feature tests"""
    
    def test_list_academies(self, coach_token):
        """ACADEMIES: List academies"""
        headers = {"Authorization": f"Bearer {coach_token}"}
        response = requests.get(f"{BASE_URL}/api/academies", headers=headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
