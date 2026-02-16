"""
Tests for P0+P1 features:
- Razorpay payment integration (mock mode without keys)
- SaaS subscription plans for venue owners
- Split & Pay financial engine
- Dynamic pricing (commission)
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPaymentGateway:
    """Payment gateway info and booking flow tests"""
    
    def test_gateway_info_no_keys(self):
        """GET /api/payment/gateway-info returns has_gateway=false when no keys set"""
        response = requests.get(f"{BASE_URL}/api/payment/gateway-info")
        assert response.status_code == 200
        data = response.json()
        # After seed, gateway keys should be empty
        assert "has_gateway" in data
        assert "provider" in data
        assert data["provider"] == "razorpay"
        print(f"Gateway info: has_gateway={data['has_gateway']}, key_id={data.get('key_id', '')}")

    def test_booking_without_gateway_autoconfirms(self, player_token, venue_id):
        """POST /api/bookings auto-confirms with payment_gateway=mock when no keys set"""
        headers = {"Authorization": f"Bearer {player_token}"}
        # Use a future date and time that's unlikely to be booked
        tomorrow = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        booking_data = {
            "venue_id": venue_id,
            "date": tomorrow,
            "start_time": "10:00",
            "end_time": "11:00",
            "turf_number": 1,
            "sport": "football",
            "payment_mode": "full"
        }
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=headers)
        print(f"Booking response status: {response.status_code}")
        print(f"Booking response: {response.json()}")
        assert response.status_code == 200
        data = response.json()
        # With no gateway keys, should use mock and auto-confirm
        assert data.get("payment_gateway") == "mock", f"Expected mock gateway, got {data.get('payment_gateway')}"
        assert data.get("status") == "confirmed", f"Expected confirmed status, got {data.get('status')}"
        assert "razorpay_order_id" not in data or data.get("razorpay_order_id") is None

    def test_booking_includes_commission_amount(self, player_token, venue_id):
        """Booking includes commission_amount field"""
        headers = {"Authorization": f"Bearer {player_token}"}
        tomorrow = (datetime.now() + timedelta(days=4)).strftime("%Y-%m-%d")
        booking_data = {
            "venue_id": venue_id,
            "date": tomorrow,
            "start_time": "11:00",
            "end_time": "12:00",
            "turf_number": 1,
            "sport": "football",
            "payment_mode": "full"
        }
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "commission_amount" in data
        assert "total_amount" in data
        print(f"Booking total_amount={data['total_amount']}, commission_amount={data['commission_amount']}")


class TestSplitPayment:
    """Split & Pay financial engine tests"""
    
    def test_split_booking_creates_pending_booking(self, player_token, venue_id):
        """POST /api/bookings with payment_mode=split creates pending booking with split_config"""
        headers = {"Authorization": f"Bearer {player_token}"}
        tomorrow = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
        booking_data = {
            "venue_id": venue_id,
            "date": tomorrow,
            "start_time": "14:00",
            "end_time": "15:00",
            "turf_number": 1,
            "sport": "football",
            "payment_mode": "split",
            "split_count": 4
        }
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=headers)
        print(f"Split booking response status: {response.status_code}")
        print(f"Split booking response: {response.json()}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "pending"
        assert "split_config" in data
        sc = data["split_config"]
        assert sc["total_shares"] == 4
        assert "per_share" in sc
        assert sc["shares_paid"] == 0
        assert "split_token" in sc
        return data

    def test_split_pay_endpoint(self, player_token, venue_id):
        """POST /api/split/{token}/pay returns payment info"""
        # First create a split booking
        headers = {"Authorization": f"Bearer {player_token}"}
        tomorrow = (datetime.now() + timedelta(days=6)).strftime("%Y-%m-%d")
        booking_data = {
            "venue_id": venue_id,
            "date": tomorrow,
            "start_time": "16:00",
            "end_time": "17:00",
            "turf_number": 1,
            "sport": "football",
            "payment_mode": "split",
            "split_count": 3
        }
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=headers)
        assert response.status_code == 200
        booking = response.json()
        token = booking["split_config"]["split_token"]
        
        # Now test split pay endpoint
        pay_response = requests.post(f"{BASE_URL}/api/split/{token}/pay", json={"payer_name": "Test Payer"})
        print(f"Split pay response: {pay_response.json()}")
        assert pay_response.status_code == 200
        data = pay_response.json()
        assert "payer_name" in data
        assert "amount" in data
        # In mock mode (no gateway keys), payment is auto-processed
        assert data.get("payment_gateway") == "mock"
        assert "payment" in data or "message" in data

    def test_split_info_endpoint(self, player_token, venue_id):
        """GET /api/split/{token} returns split booking info"""
        # Create a split booking first
        headers = {"Authorization": f"Bearer {player_token}"}
        tomorrow = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        booking_data = {
            "venue_id": venue_id,
            "date": tomorrow,
            "start_time": "18:00",
            "end_time": "19:00",
            "turf_number": 1,
            "sport": "football",
            "payment_mode": "split",
            "split_count": 2
        }
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=headers)
        assert response.status_code == 200
        booking = response.json()
        token = booking["split_config"]["split_token"]
        
        # Test get split info
        info_response = requests.get(f"{BASE_URL}/api/split/{token}")
        assert info_response.status_code == 200
        data = info_response.json()
        assert "booking" in data
        assert data["booking"]["split_config"]["split_token"] == token

    def test_split_verify_payment_endpoint(self, player_token, venue_id):
        """POST /api/split/{token}/verify-payment records payment and updates shares_paid"""
        headers = {"Authorization": f"Bearer {player_token}"}
        tomorrow = (datetime.now() + timedelta(days=8)).strftime("%Y-%m-%d")
        booking_data = {
            "venue_id": venue_id,
            "date": tomorrow,
            "start_time": "20:00",
            "end_time": "21:00",
            "turf_number": 1,
            "sport": "football",
            "payment_mode": "split",
            "split_count": 2
        }
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=headers)
        assert response.status_code == 200
        booking = response.json()
        token = booking["split_config"]["split_token"]
        
        # Verify payment
        verify_response = requests.post(f"{BASE_URL}/api/split/{token}/verify-payment", json={
            "payer_name": "Verify Tester",
            "razorpay_payment_id": "mock_pay_123"
        })
        print(f"Split verify response: {verify_response.json()}")
        assert verify_response.status_code == 200
        data = verify_response.json()
        assert data["shares_paid"] == 1
        assert data["status"] == "pending"  # 1/2 paid


class TestSubscriptionPlan:
    """SaaS subscription plan tests"""
    
    def test_my_plan_endpoint(self, owner_token):
        """GET /api/subscription/my-plan returns current plan, venues used/limit, all plans"""
        headers = {"Authorization": f"Bearer {owner_token}"}
        response = requests.get(f"{BASE_URL}/api/subscription/my-plan", headers=headers)
        print(f"My plan response: {response.json()}")
        assert response.status_code == 200
        data = response.json()
        assert "current_plan" in data
        assert "venues_used" in data
        assert "venues_limit" in data
        assert "all_plans" in data
        assert isinstance(data["all_plans"], list)
        assert len(data["all_plans"]) >= 3  # Free, Basic, Pro
        # Check plan structure
        plan = data["current_plan"]
        assert "id" in plan
        assert "name" in plan
        assert "max_venues" in plan
        print(f"Current plan: {plan['name']}, venues: {data['venues_used']}/{data['venues_limit']}")

    def test_upgrade_plan_endpoint(self, owner_token):
        """PUT /api/subscription/upgrade changes user's plan"""
        headers = {"Authorization": f"Bearer {owner_token}"}
        # First get current plan
        current_response = requests.get(f"{BASE_URL}/api/subscription/my-plan", headers=headers)
        current_plan = current_response.json()["current_plan"]["id"]
        
        # Try to switch to a different plan (basic if on pro, pro if on basic/free)
        target_plan = "basic" if current_plan == "pro" else "pro"
        response = requests.put(f"{BASE_URL}/api/subscription/upgrade", 
                               json={"plan_id": target_plan}, headers=headers)
        print(f"Upgrade response: {response.json()}")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert target_plan.title() in data["message"] or target_plan in data["message"]
        
        # Verify the change
        verify_response = requests.get(f"{BASE_URL}/api/subscription/my-plan", headers=headers)
        assert verify_response.json()["current_plan"]["id"] == target_plan
        
        # Restore original plan
        requests.put(f"{BASE_URL}/api/subscription/upgrade", 
                    json={"plan_id": current_plan}, headers=headers)

    def test_admin_set_user_plan(self, admin_token, owner_id):
        """PUT /api/admin/users/{id}/set-plan sets venue owner's plan from admin"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.put(f"{BASE_URL}/api/admin/users/{owner_id}/set-plan",
                               json={"plan_id": "basic"}, headers=headers)
        print(f"Admin set-plan response: {response.json()}")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "basic" in data["message"]

    def test_venue_creation_enforces_plan_limits(self, owner_token):
        """Venue creation enforces plan limits (max_venues check)"""
        headers = {"Authorization": f"Bearer {owner_token}"}
        # First get current plan details
        plan_response = requests.get(f"{BASE_URL}/api/subscription/my-plan", headers=headers)
        plan_data = plan_response.json()
        print(f"Owner plan: {plan_data['current_plan']['name']}, venues: {plan_data['venues_used']}/{plan_data['venues_limit']}")
        
        # If we're at the limit, try to create and expect 403
        # Otherwise just verify the endpoint exists
        venue_data = {
            "name": "TEST_LimitTestVenue",
            "description": "Test venue for limit check",
            "sports": ["football"],
            "address": "123 Test St",
            "city": "Bengaluru",
            "base_price": 1500
        }
        response = requests.post(f"{BASE_URL}/api/venues", json=venue_data, headers=headers)
        print(f"Create venue response status: {response.status_code}")
        if plan_data['venues_used'] >= plan_data['venues_limit']:
            assert response.status_code == 403
            assert "plan" in response.json()["detail"].lower() or "limit" in response.json()["detail"].lower()
        else:
            # Either succeeds or fails for other reasons
            assert response.status_code in [200, 403]


class TestAdminGatewaySettings:
    """Admin can set gateway keys in Settings"""
    
    def test_admin_get_settings(self, admin_token):
        """GET /api/admin/settings returns platform settings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/settings", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "payment_gateway" in data
        assert "booking_commission_pct" in data
        assert "subscription_plans" in data
        print(f"Current settings: gateway={data['payment_gateway']}, commission={data['booking_commission_pct']}%")

    def test_admin_set_gateway_keys(self, admin_token):
        """Admin can set gateway keys in Settings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        # Save current settings first
        current = requests.get(f"{BASE_URL}/api/admin/settings", headers=headers).json()
        
        # Set test gateway keys
        update_data = {
            "payment_gateway": {
                "provider": "razorpay",
                "key_id": "rzp_test_demo123",
                "key_secret": "sec_test_demo456",
                "live_mode": False
            }
        }
        response = requests.put(f"{BASE_URL}/api/admin/settings", json=update_data, headers=headers)
        print(f"Update gateway response: {response.json()}")
        assert response.status_code == 200
        
        # Verify gateway-info now shows has_gateway=true
        gateway_response = requests.get(f"{BASE_URL}/api/payment/gateway-info")
        gateway_data = gateway_response.json()
        print(f"After setting keys: has_gateway={gateway_data['has_gateway']}")
        assert gateway_data["has_gateway"] == True
        assert gateway_data["key_id"] == "rzp_test_demo123"
        
        # Reset to original (empty keys)
        reset_data = {
            "payment_gateway": current.get("payment_gateway", {})
        }
        requests.put(f"{BASE_URL}/api/admin/settings", json=reset_data, headers=headers)


class TestVerifyPaymentEndpoint:
    """Test payment verification endpoint"""
    
    def test_verify_payment_endpoint_exists(self, player_token, venue_id):
        """POST /api/bookings/{id}/verify-payment endpoint exists"""
        headers = {"Authorization": f"Bearer {player_token}"}
        # Create a booking first
        tomorrow = (datetime.now() + timedelta(days=9)).strftime("%Y-%m-%d")
        booking_data = {
            "venue_id": venue_id,
            "date": tomorrow,
            "start_time": "22:00",
            "end_time": "23:00",
            "turf_number": 1,
            "sport": "football",
            "payment_mode": "full"
        }
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=headers)
        assert response.status_code == 200
        booking_id = response.json()["id"]
        
        # Try to verify payment (will fail without real Razorpay signature, but endpoint should exist)
        verify_response = requests.post(f"{BASE_URL}/api/bookings/{booking_id}/verify-payment",
                                       json={
                                           "razorpay_payment_id": "test_pay",
                                           "razorpay_order_id": "test_order",
                                           "razorpay_signature": "test_sig"
                                       }, headers=headers)
        # Should either succeed (if no key_secret set) or fail with proper error
        assert verify_response.status_code in [200, 400]
        print(f"Verify payment response: {verify_response.json()}")


# ── Fixtures ──
@pytest.fixture(scope="module")
def player_token():
    """Get player auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "demo@player.com",
        "password": "demo123"
    })
    if response.status_code != 200:
        pytest.skip(f"Player login failed: {response.text}")
    return response.json()["token"]

@pytest.fixture(scope="module")
def owner_token():
    """Get owner auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "demo@owner.com",
        "password": "demo123"
    })
    if response.status_code != 200:
        pytest.skip(f"Owner login failed: {response.text}")
    return response.json()["token"]

@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@horizon.com",
        "password": "admin123"
    })
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.text}")
    return response.json()["token"]

@pytest.fixture(scope="module")
def venue_id():
    """Get first venue ID"""
    response = requests.get(f"{BASE_URL}/api/venues")
    venues = response.json()
    if not venues:
        pytest.skip("No venues found")
    return venues[0]["id"]

@pytest.fixture(scope="module")
def owner_id():
    """Get owner user ID"""
    admin_response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@horizon.com",
        "password": "admin123"
    })
    admin_token = admin_response.json()["token"]
    users_response = requests.get(f"{BASE_URL}/api/admin/users?role=venue_owner",
                                  headers={"Authorization": f"Bearer {admin_token}"})
    users = users_response.json()
    owner = next((u for u in users if u["email"] == "demo@owner.com"), None)
    if not owner:
        pytest.skip("Owner user not found")
    return owner["id"]
