"""
Comprehensive Backend API Test Suite - Post-Refactoring Validation
Tests all API endpoints after backend monolithic server.py refactoring
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDS = {"email": "admin@horizon.com", "password": "admin123"}
PLAYER_CREDS = {"email": "demo@player.com", "password": "demo123"}
OWNER_CREDS = {"email": "demo@owner.com", "password": "demo123"}
COACH_CREDS = {"email": "demo@coach.com", "password": "demo123"}


class TestAuthEndpoints:
    """Authentication API tests"""
    
    def test_admin_login(self):
        """POST /api/auth/login - Admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["role"] == "super_admin"
        assert data["user"]["email"] == ADMIN_CREDS["email"]
    
    def test_player_login(self):
        """POST /api/auth/login - Player login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=PLAYER_CREDS)
        assert response.status_code == 200, f"Player login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "player"
    
    def test_owner_login(self):
        """POST /api/auth/login - Owner login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=OWNER_CREDS)
        assert response.status_code == 200, f"Owner login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "venue_owner"
    
    def test_invalid_login(self):
        """POST /api/auth/login - Invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "wrong@test.com", "password": "wrong"})
        assert response.status_code == 401
    
    def test_register_player(self):
        """POST /api/auth/register - Register new player"""
        import uuid
        unique_email = f"test_player_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Test Player",
            "email": unique_email,
            "password": "testpass123",
            "role": "player",
            "phone": "9999999999",
            "sports": ["football", "cricket"]
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["email"] == unique_email
        assert data["user"]["role"] == "player"
        assert data["user"]["account_status"] == "active"
    
    def test_register_super_admin_forbidden(self):
        """POST /api/auth/register - Cannot register as super_admin"""
        import uuid
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Hacker",
            "email": f"hacker_{uuid.uuid4().hex[:8]}@test.com",
            "password": "hack123",
            "role": "super_admin"
        })
        assert response.status_code == 403
    
    def test_get_me_authenticated(self):
        """GET /api/auth/me - Get current user profile"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=PLAYER_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == PLAYER_CREDS["email"]
        assert "password_hash" not in data
    
    def test_get_me_unauthenticated(self):
        """GET /api/auth/me - Unauthenticated returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
    
    def test_update_profile(self):
        """PUT /api/auth/profile - Update user profile"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=PLAYER_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        response = requests.put(f"{BASE_URL}/api/auth/profile", headers=headers, json={
            "phone": "9999888877",
            "sports": ["football", "badminton"]
        })
        assert response.status_code == 200
        data = response.json()
        assert data["phone"] == "9999888877"
        assert "football" in data["sports"]


class TestVenueEndpoints:
    """Venue API tests"""
    
    def test_list_venues_public(self):
        """GET /api/venues - List active venues (public)"""
        response = requests.get(f"{BASE_URL}/api/venues")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert "name" in data[0]
            assert "status" in data[0]
            # All returned venues should be active
            for venue in data:
                assert venue["status"] == "active"
    
    def test_get_venue_by_id(self):
        """GET /api/venues/{id} - Get specific venue"""
        # First get list to find a venue ID
        list_resp = requests.get(f"{BASE_URL}/api/venues")
        venues = list_resp.json()
        if len(venues) == 0:
            pytest.skip("No venues available for testing")
        
        venue_id = venues[0]["id"]
        response = requests.get(f"{BASE_URL}/api/venues/{venue_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == venue_id
        assert "name" in data
        assert "sports" in data
    
    def test_get_venue_not_found(self):
        """GET /api/venues/{id} - Non-existent venue returns 404"""
        response = requests.get(f"{BASE_URL}/api/venues/nonexistent-id-123")
        assert response.status_code == 404
    
    def test_get_venue_slots(self):
        """GET /api/venues/{id}/slots?date=2026-02-17 - Get venue slots"""
        list_resp = requests.get(f"{BASE_URL}/api/venues")
        venues = list_resp.json()
        if len(venues) == 0:
            pytest.skip("No venues available for testing")
        
        venue_id = venues[0]["id"]
        response = requests.get(f"{BASE_URL}/api/venues/{venue_id}/slots?date=2026-02-17")
        assert response.status_code == 200
        data = response.json()
        assert "venue_id" in data
        assert "date" in data
        assert "slots" in data
        assert isinstance(data["slots"], list)
        if len(data["slots"]) > 0:
            slot = data["slots"][0]
            assert "start_time" in slot
            assert "end_time" in slot
            assert "price" in slot
            assert "status" in slot
    
    def test_owner_list_venues(self):
        """GET /api/owner/venues - List owner's venues"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=OWNER_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/owner/venues", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_venue_owner_only(self):
        """POST /api/venues - Only venue owners can create venues"""
        # Player cannot create venue
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=PLAYER_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        response = requests.post(f"{BASE_URL}/api/venues", headers=headers, json={
            "name": "Test Venue",
            "description": "Test description",
            "sports": ["football"],
            "address": "123 Test Street",
            "city": "Test City",
            "base_price": 2000
        })
        assert response.status_code == 403


class TestBookingEndpoints:
    """Booking API tests"""
    
    def test_list_bookings_authenticated(self):
        """GET /api/bookings - List user bookings"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=PLAYER_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/bookings", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_booking_not_found(self):
        """GET /api/bookings/{id} - Non-existent booking returns 404"""
        response = requests.get(f"{BASE_URL}/api/bookings/nonexistent-booking-id")
        assert response.status_code == 404
    
    def test_create_booking_mock_payment(self):
        """POST /api/bookings - Create booking (mock payment flow)"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=PLAYER_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # Get a venue first
        venues_resp = requests.get(f"{BASE_URL}/api/venues")
        venues = venues_resp.json()
        if len(venues) == 0:
            pytest.skip("No venues available")
        
        venue_id = venues[0]["id"]
        
        response = requests.post(f"{BASE_URL}/api/bookings", headers=headers, json={
            "venue_id": venue_id,
            "date": "2026-03-15",
            "start_time": "10:00",
            "end_time": "11:00",
            "turf_number": 1,
            "sport": "football",
            "payment_mode": "full"
        })
        assert response.status_code == 200, f"Booking failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["payment_gateway"] == "mock"  # No Razorpay keys configured
        assert data["status"] in ["confirmed", "payment_pending"]
        
        # Verify booking was created - GET to confirm persistence
        booking_id = data["id"]
        get_resp = requests.get(f"{BASE_URL}/api/bookings/{booking_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["id"] == booking_id
    
    def test_cancel_booking(self):
        """POST /api/bookings/{id}/cancel - Cancel booking"""
        # Login and create a booking first
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=PLAYER_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        venues_resp = requests.get(f"{BASE_URL}/api/venues")
        venues = venues_resp.json()
        if len(venues) == 0:
            pytest.skip("No venues available")
        
        venue_id = venues[0]["id"]
        
        # Create booking
        create_resp = requests.post(f"{BASE_URL}/api/bookings", headers=headers, json={
            "venue_id": venue_id,
            "date": "2026-03-20",
            "start_time": "14:00",
            "end_time": "15:00",
            "turf_number": 1,
            "sport": "football",
            "payment_mode": "full"
        })
        if create_resp.status_code != 200:
            pytest.skip(f"Could not create booking: {create_resp.text}")
        
        booking_id = create_resp.json()["id"]
        
        # Cancel booking
        cancel_resp = requests.post(f"{BASE_URL}/api/bookings/{booking_id}/cancel", headers=headers)
        assert cancel_resp.status_code == 200
        
        # Verify cancellation
        get_resp = requests.get(f"{BASE_URL}/api/bookings/{booking_id}")
        assert get_resp.json()["status"] == "cancelled"
    
    def test_payment_gateway_info(self):
        """GET /api/payment/gateway-info - Payment gateway status"""
        response = requests.get(f"{BASE_URL}/api/payment/gateway-info")
        assert response.status_code == 200
        data = response.json()
        assert "has_gateway" in data
        assert "provider" in data


class TestMatchmakingEndpoints:
    """Matchmaking API tests"""
    
    def test_list_open_matches_public(self):
        """GET /api/matchmaking - List open matches (public)"""
        response = requests.get(f"{BASE_URL}/api/matchmaking")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for match in data:
            assert match.get("status") == "open"
    
    def test_create_match(self):
        """POST /api/matchmaking - Create new match"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=PLAYER_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        response = requests.post(f"{BASE_URL}/api/matchmaking", headers=headers, json={
            "sport": "football",
            "date": "2026-02-25",
            "time": "18:00",
            "venue_name": "Test Ground",
            "players_needed": 10,
            "description": "Test match for refactor validation"
        })
        assert response.status_code == 200, f"Create match failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["sport"] == "football"
        assert data["status"] == "open"
    
    def test_join_match(self):
        """POST /api/matchmaking/{id}/join - Join a match"""
        # Login as player and create a match
        player_login = requests.post(f"{BASE_URL}/api/auth/login", json=PLAYER_CREDS)
        player_token = player_login.json()["token"]
        player_headers = {"Authorization": f"Bearer {player_token}", "Content-Type": "application/json"}
        
        create_resp = requests.post(f"{BASE_URL}/api/matchmaking", headers=player_headers, json={
            "sport": "cricket",
            "date": "2026-02-28",
            "time": "09:00",
            "players_needed": 22
        })
        match_id = create_resp.json()["id"]
        
        # Login as coach and join the match
        coach_login = requests.post(f"{BASE_URL}/api/auth/login", json=COACH_CREDS)
        coach_token = coach_login.json()["token"]
        coach_headers = {"Authorization": f"Bearer {coach_token}"}
        
        join_resp = requests.post(f"{BASE_URL}/api/matchmaking/{match_id}/join", headers=coach_headers)
        assert join_resp.status_code == 200


class TestMercenaryEndpoints:
    """Mercenary Marketplace API tests"""
    
    def test_list_mercenary_posts_public(self):
        """GET /api/mercenary - List open mercenary posts (public)"""
        response = requests.get(f"{BASE_URL}/api/mercenary")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_my_mercenary_posts(self):
        """GET /api/mercenary/my-posts - My mercenary posts"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=PLAYER_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/mercenary/my-posts", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_apply_mercenary_requires_auth(self):
        """POST /api/mercenary/{post_id}/apply - Requires authentication"""
        response = requests.post(f"{BASE_URL}/api/mercenary/some-post-id/apply")
        assert response.status_code == 401


class TestNotificationEndpoints:
    """Notification API tests"""
    
    def test_get_notifications(self):
        """GET /api/notifications - Get user notifications"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=PLAYER_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/notifications", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_unread_count(self):
        """GET /api/notifications/unread-count - Get unread count"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=PLAYER_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert isinstance(data["count"], int)
    
    def test_mark_all_read(self):
        """PUT /api/notifications/read-all - Mark all read"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=PLAYER_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.put(f"{BASE_URL}/api/notifications/read-all", headers=headers)
        assert response.status_code == 200


class TestAdminEndpoints:
    """Admin API tests"""
    
    def test_admin_dashboard(self):
        """GET /api/admin/dashboard - Admin dashboard stats (admin only)"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_users" in data
        assert "total_venues" in data
        assert "total_bookings" in data
        assert "total_revenue" in data
    
    def test_admin_dashboard_unauthorized(self):
        """GET /api/admin/dashboard - Non-admin gets 403"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=PLAYER_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        assert response.status_code == 403
    
    def test_admin_list_users(self):
        """GET /api/admin/users - Admin list users"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should not include super_admin users
        for user in data:
            assert user["role"] != "super_admin"
            assert "password_hash" not in user
    
    def test_admin_get_settings(self):
        """GET /api/admin/settings - Admin get platform settings"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/admin/settings", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "payment_gateway" in data
        assert "subscription_plans" in data
    
    def test_admin_update_settings(self):
        """PUT /api/admin/settings - Admin update settings"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        response = requests.put(f"{BASE_URL}/api/admin/settings", headers=headers, json={
            "booking_commission_pct": 12
        })
        assert response.status_code == 200
        data = response.json()
        assert data["booking_commission_pct"] == 12
        
        # Revert to original
        requests.put(f"{BASE_URL}/api/admin/settings", headers=headers, json={
            "booking_commission_pct": 10
        })
    
    def test_admin_list_venues(self):
        """GET /api/admin/venues - Admin list venues"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/admin/venues", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestSubscriptionEndpoints:
    """Subscription API tests"""
    
    def test_get_my_plan(self):
        """GET /api/subscription/my-plan - Get user subscription plan"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=OWNER_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/subscription/my-plan", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "current_plan" in data
        assert "venues_used" in data
        assert "venues_limit" in data
        assert "all_plans" in data


class TestAcademyEndpoints:
    """Academy API tests"""
    
    def test_list_academies(self):
        """GET /api/academies - List academies"""
        response = requests.get(f"{BASE_URL}/api/academies")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestAnalyticsEndpoints:
    """Analytics API tests"""
    
    def test_player_analytics(self):
        """GET /api/analytics/player - Player analytics"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=PLAYER_CREDS)
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/analytics/player", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_games" in data
        assert "total_spent" in data
        assert "skill_rating" in data
        assert "reliability_score" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
