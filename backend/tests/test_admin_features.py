"""
Backend tests for Super Admin features (iteration 4):
- User registration with account_status
- Admin login and authentication
- Admin dashboard
- User management (approve/reject/suspend/activate)
- Venue management (suspend/activate)
- Platform settings (payment gateway, commission, plans)
- Admin password change
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
ADMIN_EMAIL = "admin@horizon.com"
ADMIN_PASSWORD = "admin123"
PLAYER_EMAIL = "demo@player.com"
PLAYER_PASSWORD = "demo123"
OWNER_EMAIL = "demo@owner.com"
OWNER_PASSWORD = "demo123"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("token")
    pytest.skip("Admin authentication failed - skipping admin tests")


@pytest.fixture(scope="module")
def player_token(api_client):
    """Get player authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": PLAYER_EMAIL,
        "password": PLAYER_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("token")
    pytest.skip("Player authentication failed - skipping player tests")


@pytest.fixture(scope="module")
def admin_client(api_client, admin_token):
    """Session with admin auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_token}"
    })
    return session


@pytest.fixture(scope="module")
def player_client(api_client, player_token):
    """Session with player auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {player_token}"
    })
    return session


class TestRegistrationAccountStatus:
    """Test registration flow with account_status field"""
    
    def test_register_player_gets_active_status(self, api_client):
        """Player registration should have account_status=active"""
        unique_email = f"TEST_player_{uuid.uuid4().hex[:8]}@test.com"
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Test Player",
            "email": unique_email,
            "password": "test123456",
            "role": "player"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "user" in data
        assert data["user"]["account_status"] == "active", f"Expected active, got {data['user']['account_status']}"
        print(f"✓ Player registration sets account_status=active")
    
    def test_register_venue_owner_gets_pending_status(self, api_client):
        """Venue owner registration should have account_status=pending"""
        unique_email = f"TEST_owner_{uuid.uuid4().hex[:8]}@test.com"
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Test Venue Owner",
            "email": unique_email,
            "password": "test123456",
            "role": "venue_owner",
            "business_name": "Test Sports Arena",
            "gst_number": "29TESTGST1234"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "user" in data
        assert data["user"]["account_status"] == "pending", f"Expected pending, got {data['user']['account_status']}"
        assert data["user"]["business_name"] == "Test Sports Arena"
        print(f"✓ Venue owner registration sets account_status=pending")
    
    def test_register_super_admin_blocked(self, api_client):
        """Registration as super_admin should be blocked with 403"""
        unique_email = f"TEST_admin_{uuid.uuid4().hex[:8]}@test.com"
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Fake Admin",
            "email": unique_email,
            "password": "test123456",
            "role": "super_admin"
        })
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ Super admin registration blocked (403)")


class TestAdminLogin:
    """Test admin login functionality"""
    
    def test_admin_login_success(self, api_client):
        """Admin should be able to login with correct credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "super_admin"
        assert data["user"]["account_status"] == "active"
        print(f"✓ Admin login successful, role=super_admin")
    
    def test_admin_login_wrong_password(self, api_client):
        """Admin login with wrong password should fail"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code in [401, 400], f"Expected 401/400, got {response.status_code}"
        print(f"✓ Admin login with wrong password rejected ({response.status_code})")


class TestAdminDashboard:
    """Test admin dashboard endpoint"""
    
    def test_dashboard_requires_admin(self, player_client):
        """Non-admin users should get 403 on dashboard"""
        response = player_client.get(f"{BASE_URL}/api/admin/dashboard")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✓ Dashboard blocked for non-admin (403)")
    
    def test_dashboard_returns_stats(self, admin_client):
        """Admin dashboard should return platform stats"""
        response = admin_client.get(f"{BASE_URL}/api/admin/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        required_fields = ["total_users", "total_venues", "total_bookings", "pending_owners", 
                          "active_venues", "total_revenue", "commission_pct", "platform_earnings", 
                          "recent_users"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        assert isinstance(data["recent_users"], list)
        print(f"✓ Dashboard returns all stats: {list(data.keys())}")


class TestAdminUserManagement:
    """Test admin user management endpoints"""
    
    def test_list_users_requires_admin(self, player_client):
        """Non-admin should get 403 on user list"""
        response = player_client.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✓ User list blocked for non-admin (403)")
    
    def test_list_users_success(self, admin_client):
        """Admin should be able to list users"""
        response = admin_client.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list)
        # Verify super_admin is not included
        for user in data:
            assert user["role"] != "super_admin", "Super admin should not be in user list"
        print(f"✓ User list returned {len(data)} users (excludes super_admin)")
    
    def test_list_users_filter_by_role(self, admin_client):
        """Admin can filter users by role"""
        response = admin_client.get(f"{BASE_URL}/api/admin/users", params={"role": "player"})
        assert response.status_code == 200
        data = response.json()
        for user in data:
            assert user["role"] == "player", f"Got user with role {user['role']}"
        print(f"✓ User filter by role works ({len(data)} players)")
    
    def test_list_users_filter_by_status(self, admin_client):
        """Admin can filter users by account status"""
        response = admin_client.get(f"{BASE_URL}/api/admin/users", params={"status": "active"})
        assert response.status_code == 200
        data = response.json()
        for user in data:
            assert user["account_status"] == "active"
        print(f"✓ User filter by status works ({len(data)} active users)")
    
    def test_approve_user_flow(self, api_client, admin_client):
        """Test user approval flow: create pending user -> approve"""
        # Create a pending venue owner
        unique_email = f"TEST_approve_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Test Approve User",
            "email": unique_email,
            "password": "test123456",
            "role": "venue_owner"
        })
        assert reg_response.status_code == 200
        user_data = reg_response.json()
        user_id = user_data["user"]["id"]
        assert user_data["user"]["account_status"] == "pending"
        
        # Approve the user
        approve_response = admin_client.put(f"{BASE_URL}/api/admin/users/{user_id}/approve")
        assert approve_response.status_code == 200, f"Expected 200, got {approve_response.status_code}"
        
        # Verify approval via user list
        list_response = admin_client.get(f"{BASE_URL}/api/admin/users")
        users = list_response.json()
        approved_user = next((u for u in users if u["id"] == user_id), None)
        assert approved_user is not None
        assert approved_user["account_status"] == "active", f"Expected active, got {approved_user['account_status']}"
        print(f"✓ User approval flow works (pending -> active)")
    
    def test_reject_user_flow(self, api_client, admin_client):
        """Test user rejection flow"""
        unique_email = f"TEST_reject_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Test Reject User",
            "email": unique_email,
            "password": "test123456",
            "role": "venue_owner"
        })
        assert reg_response.status_code == 200
        user_id = reg_response.json()["user"]["id"]
        
        # Reject the user
        reject_response = admin_client.put(f"{BASE_URL}/api/admin/users/{user_id}/reject")
        assert reject_response.status_code == 200
        
        # Verify rejection
        list_response = admin_client.get(f"{BASE_URL}/api/admin/users")
        users = list_response.json()
        rejected_user = next((u for u in users if u["id"] == user_id), None)
        assert rejected_user["account_status"] == "rejected"
        print(f"✓ User rejection flow works (pending -> rejected)")
    
    def test_suspend_user_flow(self, admin_client):
        """Test suspending an active user"""
        # Get an active player user
        list_response = admin_client.get(f"{BASE_URL}/api/admin/users", params={"role": "player", "status": "active"})
        users = list_response.json()
        if not users:
            pytest.skip("No active player to suspend")
        
        user_id = users[0]["id"]
        
        # Suspend
        suspend_response = admin_client.put(f"{BASE_URL}/api/admin/users/{user_id}/suspend")
        assert suspend_response.status_code == 200
        
        # Verify and reactivate
        list_response = admin_client.get(f"{BASE_URL}/api/admin/users")
        suspended_user = next((u for u in list_response.json() if u["id"] == user_id), None)
        assert suspended_user["account_status"] == "suspended"
        
        # Reactivate for cleanup
        admin_client.put(f"{BASE_URL}/api/admin/users/{user_id}/activate")
        print(f"✓ User suspend flow works (active -> suspended)")
    
    def test_activate_suspended_user(self, api_client, admin_client):
        """Test activating a suspended/rejected user"""
        # Create and reject a user
        unique_email = f"TEST_activate_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Test Activate User",
            "email": unique_email,
            "password": "test123456",
            "role": "venue_owner"
        })
        user_id = reg_response.json()["user"]["id"]
        admin_client.put(f"{BASE_URL}/api/admin/users/{user_id}/reject")
        
        # Activate
        activate_response = admin_client.put(f"{BASE_URL}/api/admin/users/{user_id}/activate")
        assert activate_response.status_code == 200
        
        # Verify
        list_response = admin_client.get(f"{BASE_URL}/api/admin/users")
        activated_user = next((u for u in list_response.json() if u["id"] == user_id), None)
        assert activated_user["account_status"] == "active"
        print(f"✓ User activate flow works (rejected -> active)")


class TestAdminVenueManagement:
    """Test admin venue management endpoints"""
    
    def test_list_venues_requires_admin(self, player_client):
        """Non-admin should get 403 on venue list"""
        response = player_client.get(f"{BASE_URL}/api/admin/venues")
        assert response.status_code == 403
        print(f"✓ Venue list blocked for non-admin (403)")
    
    def test_list_venues_success(self, admin_client):
        """Admin should be able to list all venues"""
        response = admin_client.get(f"{BASE_URL}/api/admin/venues")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if data:
            assert "id" in data[0]
            assert "name" in data[0]
            assert "status" in data[0]
        print(f"✓ Venue list returned {len(data)} venues")
    
    def test_suspend_venue_flow(self, admin_client):
        """Test suspending and activating a venue"""
        # Get venues
        list_response = admin_client.get(f"{BASE_URL}/api/admin/venues")
        venues = list_response.json()
        if not venues:
            pytest.skip("No venues to test")
        
        venue_id = venues[0]["id"]
        original_status = venues[0]["status"]
        
        # Suspend
        suspend_response = admin_client.put(f"{BASE_URL}/api/admin/venues/{venue_id}/suspend")
        assert suspend_response.status_code == 200
        
        # Verify suspended
        list_response = admin_client.get(f"{BASE_URL}/api/admin/venues")
        suspended_venue = next((v for v in list_response.json() if v["id"] == venue_id), None)
        assert suspended_venue["status"] == "suspended"
        
        # Activate
        activate_response = admin_client.put(f"{BASE_URL}/api/admin/venues/{venue_id}/activate")
        assert activate_response.status_code == 200
        
        # Verify activated
        list_response = admin_client.get(f"{BASE_URL}/api/admin/venues")
        activated_venue = next((v for v in list_response.json() if v["id"] == venue_id), None)
        assert activated_venue["status"] == "active"
        print(f"✓ Venue suspend/activate flow works")


class TestAdminSettings:
    """Test admin settings endpoints"""
    
    def test_get_settings_requires_admin(self, player_client):
        """Non-admin should get 403 on settings"""
        response = player_client.get(f"{BASE_URL}/api/admin/settings")
        assert response.status_code == 403
        print(f"✓ Settings blocked for non-admin (403)")
    
    def test_get_settings_success(self, admin_client):
        """Admin should get platform settings"""
        response = admin_client.get(f"{BASE_URL}/api/admin/settings")
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "payment_gateway" in data
        assert "booking_commission_pct" in data
        assert "subscription_plans" in data
        
        # Verify payment gateway fields
        gateway = data["payment_gateway"]
        assert "provider" in gateway
        assert "key_id" in gateway
        assert "key_secret" in gateway
        assert "is_live" in gateway
        
        # Verify subscription plans
        plans = data["subscription_plans"]
        assert isinstance(plans, list)
        assert len(plans) >= 1
        for plan in plans:
            assert "id" in plan
            assert "name" in plan
            assert "price" in plan
            assert "features" in plan
        
        print(f"✓ Settings returned: {data['payment_gateway']['provider']}, {data['booking_commission_pct']}% commission, {len(plans)} plans")
    
    def test_update_settings_payment_gateway(self, admin_client):
        """Admin can update payment gateway settings"""
        # Get current settings
        get_response = admin_client.get(f"{BASE_URL}/api/admin/settings")
        original = get_response.json()
        
        # Update payment gateway
        new_key_id = f"rzp_test_{uuid.uuid4().hex[:8]}"
        update_response = admin_client.put(f"{BASE_URL}/api/admin/settings", json={
            "payment_gateway": {
                "provider": "razorpay",
                "key_id": new_key_id,
                "key_secret": "test_secret_xyz",
                "is_live": False
            }
        })
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["payment_gateway"]["key_id"] == new_key_id
        
        # Restore original
        admin_client.put(f"{BASE_URL}/api/admin/settings", json={
            "payment_gateway": original["payment_gateway"]
        })
        print(f"✓ Payment gateway update works")
    
    def test_update_settings_commission(self, admin_client):
        """Admin can update booking commission"""
        # Get current
        get_response = admin_client.get(f"{BASE_URL}/api/admin/settings")
        original_commission = get_response.json()["booking_commission_pct"]
        
        # Update
        new_commission = 15
        update_response = admin_client.put(f"{BASE_URL}/api/admin/settings", json={
            "booking_commission_pct": new_commission
        })
        assert update_response.status_code == 200
        assert update_response.json()["booking_commission_pct"] == new_commission
        
        # Restore
        admin_client.put(f"{BASE_URL}/api/admin/settings", json={
            "booking_commission_pct": original_commission
        })
        print(f"✓ Commission update works ({original_commission}% -> {new_commission}% -> {original_commission}%)")
    
    def test_update_settings_subscription_plans(self, admin_client):
        """Admin can update subscription plans"""
        # Get current
        get_response = admin_client.get(f"{BASE_URL}/api/admin/settings")
        original_plans = get_response.json()["subscription_plans"]
        
        # Modify one plan's price
        modified_plans = [dict(p) for p in original_plans]
        if modified_plans:
            modified_plans[0]["price"] = 999
        
        update_response = admin_client.put(f"{BASE_URL}/api/admin/settings", json={
            "subscription_plans": modified_plans
        })
        assert update_response.status_code == 200
        
        # Restore
        admin_client.put(f"{BASE_URL}/api/admin/settings", json={
            "subscription_plans": original_plans
        })
        print(f"✓ Subscription plans update works")
    
    def test_update_settings_invalid_field_rejected(self, admin_client):
        """Updates with only invalid fields should fail"""
        update_response = admin_client.put(f"{BASE_URL}/api/admin/settings", json={
            "invalid_field": "should_fail"
        })
        assert update_response.status_code == 400
        print(f"✓ Invalid settings update rejected (400)")


class TestAdminChangePassword:
    """Test admin password change endpoint"""
    
    def test_change_password_requires_admin(self, player_client):
        """Non-admin should get 403 on change password"""
        response = player_client.put(f"{BASE_URL}/api/admin/change-password", json={
            "new_password": "newpass123"
        })
        assert response.status_code == 403
        print(f"✓ Password change blocked for non-admin (403)")
    
    def test_change_password_too_short(self, admin_client):
        """Password must be at least 6 characters"""
        response = admin_client.put(f"{BASE_URL}/api/admin/change-password", json={
            "new_password": "short"
        })
        assert response.status_code == 400
        print(f"✓ Short password rejected (400)")
    
    def test_change_password_success(self, api_client, admin_client):
        """Admin can change password and login with new password"""
        # Change to new password
        new_password = "newadmin123"
        change_response = admin_client.put(f"{BASE_URL}/api/admin/change-password", json={
            "new_password": new_password
        })
        assert change_response.status_code == 200
        
        # Login with new password
        login_response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": new_password
        })
        assert login_response.status_code == 200, "Login with new password failed"
        
        # Restore original password
        new_token = login_response.json()["token"]
        restore_session = requests.Session()
        restore_session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {new_token}"
        })
        restore_response = restore_session.put(f"{BASE_URL}/api/admin/change-password", json={
            "new_password": ADMIN_PASSWORD
        })
        assert restore_response.status_code == 200
        
        # Verify original password works
        verify_response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert verify_response.status_code == 200
        print(f"✓ Password change and restore flow works")


class TestAdminAccessControl:
    """Test that admin routes are properly protected"""
    
    def test_all_admin_routes_require_auth(self, api_client):
        """All admin routes should require authentication"""
        admin_routes = [
            ("GET", "/api/admin/dashboard"),
            ("GET", "/api/admin/users"),
            ("GET", "/api/admin/venues"),
            ("GET", "/api/admin/settings"),
        ]
        
        for method, route in admin_routes:
            if method == "GET":
                response = api_client.get(f"{BASE_URL}{route}")
            else:
                response = api_client.put(f"{BASE_URL}{route}", json={})
            
            assert response.status_code in [401, 403], f"{route} returned {response.status_code}"
        
        print(f"✓ All admin routes require auth")
    
    def test_player_cannot_access_admin_routes(self, player_client):
        """Players should get 403 on all admin routes"""
        admin_routes = [
            "/api/admin/dashboard",
            "/api/admin/users",
            "/api/admin/venues",
            "/api/admin/settings",
        ]
        
        for route in admin_routes:
            response = player_client.get(f"{BASE_URL}{route}")
            assert response.status_code == 403, f"{route} returned {response.status_code}"
        
        print(f"✓ Player blocked from all admin routes (403)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
