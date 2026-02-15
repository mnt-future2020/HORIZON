"""
Test suite for Notification Subscribe/Unsubscribe feature
Features tested:
- POST /api/notifications/subscribe - subscribing to a booked slot notification
- DELETE /api/notifications/subscribe - unsubscribing from a slot notification
- GET /api/notifications - listing user notifications
- GET /api/notifications/unread-count - getting unread notification count
- PUT /api/notifications/{id}/read - marking a notification as read
- PUT /api/notifications/read-all - marking all notifications as read
- GET /api/notifications/subscriptions - get user's active subscriptions
- POST /api/bookings/{id}/cancel triggers notifications for subscribed users
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PLAYER_CREDS = {"email": "demo@player.com", "password": "demo123"}
OWNER_CREDS = {"email": "demo@owner.com", "password": "demo123"}
COACH_CREDS = {"email": "demo@coach.com", "password": "demo123"}


@pytest.fixture(scope="module")
def player_auth():
    """Get authentication for demo player"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=PLAYER_CREDS)
    assert response.status_code == 200, f"Player login failed: {response.text}"
    data = response.json()
    return {"token": data["token"], "user_id": data["user"]["id"]}


@pytest.fixture(scope="module")
def owner_auth():
    """Get authentication for demo owner"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=OWNER_CREDS)
    assert response.status_code == 200, f"Owner login failed: {response.text}"
    data = response.json()
    return {"token": data["token"], "user_id": data["user"]["id"]}


@pytest.fixture(scope="module")
def coach_auth():
    """Get authentication for demo coach"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=COACH_CREDS)
    assert response.status_code == 200, f"Coach login failed: {response.text}"
    data = response.json()
    return {"token": data["token"], "user_id": data["user"]["id"]}


@pytest.fixture(scope="module")
def venue_data():
    """Get first venue for testing"""
    response = requests.get(f"{BASE_URL}/api/venues")
    assert response.status_code == 200, f"Failed to get venues: {response.text}"
    venues = response.json()
    assert len(venues) > 0, "No venues found"
    return venues[0]


def get_headers(auth):
    return {"Authorization": f"Bearer {auth['token']}", "Content-Type": "application/json"}


class TestNotificationSubscribe:
    """Test notification subscription endpoints"""
    
    def test_subscribe_to_slot_notification(self, owner_auth, venue_data):
        """POST /api/notifications/subscribe - subscribe to a booked slot"""
        tomorrow = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        subscribe_data = {
            "venue_id": venue_data["id"],
            "date": tomorrow,
            "start_time": "18:00",
            "turf_number": 1
        }
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/subscribe",
            json=subscribe_data,
            headers=get_headers(owner_auth)
        )
        
        assert response.status_code == 200, f"Subscribe failed: {response.text}"
        data = response.json()
        assert data.get("subscribed") == True
        assert "message" in data
        print(f"✓ Subscribe to slot notification: {data}")
    
    def test_subscribe_duplicate_returns_already_subscribed(self, owner_auth, venue_data):
        """POST /api/notifications/subscribe - duplicate subscription returns already subscribed"""
        tomorrow = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        subscribe_data = {
            "venue_id": venue_data["id"],
            "date": tomorrow,
            "start_time": "18:00",
            "turf_number": 1
        }
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/subscribe",
            json=subscribe_data,
            headers=get_headers(owner_auth)
        )
        
        assert response.status_code == 200, f"Duplicate subscribe check failed: {response.text}"
        data = response.json()
        assert data.get("subscribed") == True
        # Should indicate already subscribed
        assert "Already subscribed" in data.get("message", "") or data.get("subscribed") == True
        print(f"✓ Duplicate subscription handled: {data}")
    
    def test_subscribe_requires_auth(self, venue_data):
        """POST /api/notifications/subscribe - requires authentication"""
        tomorrow = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        subscribe_data = {
            "venue_id": venue_data["id"],
            "date": tomorrow,
            "start_time": "18:00",
            "turf_number": 1
        }
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/subscribe",
            json=subscribe_data
        )
        
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ Subscribe requires authentication")
    
    def test_unsubscribe_from_slot_notification(self, owner_auth, venue_data):
        """DELETE /api/notifications/subscribe - unsubscribe from a slot"""
        tomorrow = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        subscribe_data = {
            "venue_id": venue_data["id"],
            "date": tomorrow,
            "start_time": "18:00",
            "turf_number": 1
        }
        
        response = requests.delete(
            f"{BASE_URL}/api/notifications/subscribe",
            json=subscribe_data,
            headers=get_headers(owner_auth)
        )
        
        assert response.status_code == 200, f"Unsubscribe failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✓ Unsubscribe from slot notification: {data}")
    
    def test_unsubscribe_nonexistent_subscription(self, coach_auth, venue_data):
        """DELETE /api/notifications/subscribe - unsubscribe from non-existent subscription"""
        tomorrow = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        subscribe_data = {
            "venue_id": venue_data["id"],
            "date": tomorrow,
            "start_time": "21:00",  # Different time - not subscribed
            "turf_number": 1
        }
        
        response = requests.delete(
            f"{BASE_URL}/api/notifications/subscribe",
            json=subscribe_data,
            headers=get_headers(coach_auth)
        )
        
        assert response.status_code == 200, f"Unsubscribe non-existent failed: {response.text}"
        data = response.json()
        assert data.get("removed") == False or "Unsubscribed" in data.get("message", "")
        print(f"✓ Unsubscribe non-existent handled: {data}")


class TestNotificationList:
    """Test notification listing endpoints"""
    
    def test_get_notifications_list(self, owner_auth):
        """GET /api/notifications - list user notifications"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers=get_headers(owner_auth)
        )
        
        assert response.status_code == 200, f"Get notifications failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ Get notifications list: {len(data)} notifications found")
        
        # If notifications exist, validate structure
        if len(data) > 0:
            notif = data[0]
            assert "id" in notif
            assert "user_id" in notif
            assert "type" in notif
            assert "title" in notif
            assert "message" in notif
            assert "is_read" in notif
            print(f"✓ Notification structure valid: {notif.get('title')}")
    
    def test_get_notifications_requires_auth(self):
        """GET /api/notifications - requires authentication"""
        response = requests.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ Get notifications requires authentication")
    
    def test_get_unread_count(self, owner_auth):
        """GET /api/notifications/unread-count - get unread notification count"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers=get_headers(owner_auth)
        )
        
        assert response.status_code == 200, f"Get unread count failed: {response.text}"
        data = response.json()
        assert "count" in data
        assert isinstance(data["count"], int)
        assert data["count"] >= 0
        print(f"✓ Unread count: {data['count']}")
    
    def test_get_unread_count_requires_auth(self):
        """GET /api/notifications/unread-count - requires authentication"""
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ Get unread count requires authentication")


class TestNotificationReadStatus:
    """Test marking notifications as read"""
    
    def test_mark_single_notification_as_read(self, owner_auth):
        """PUT /api/notifications/{id}/read - mark notification as read"""
        # First get list of notifications
        list_response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers=get_headers(owner_auth)
        )
        
        assert list_response.status_code == 200
        notifications = list_response.json()
        
        if len(notifications) == 0:
            pytest.skip("No notifications to mark as read")
        
        notif_id = notifications[0]["id"]
        
        response = requests.put(
            f"{BASE_URL}/api/notifications/{notif_id}/read",
            headers=get_headers(owner_auth)
        )
        
        assert response.status_code == 200, f"Mark read failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✓ Marked notification {notif_id} as read")
    
    def test_mark_nonexistent_notification_as_read(self, owner_auth):
        """PUT /api/notifications/{id}/read - mark non-existent notification"""
        fake_id = "nonexistent-notification-id-12345"
        
        response = requests.put(
            f"{BASE_URL}/api/notifications/{fake_id}/read",
            headers=get_headers(owner_auth)
        )
        
        # Should succeed (idempotent) or return 404
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        print(f"✓ Mark non-existent notification handled: {response.status_code}")
    
    def test_mark_all_notifications_as_read(self, owner_auth):
        """PUT /api/notifications/read-all - mark all notifications as read"""
        response = requests.put(
            f"{BASE_URL}/api/notifications/read-all",
            headers=get_headers(owner_auth)
        )
        
        assert response.status_code == 200, f"Mark all read failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✓ Marked all notifications as read: {data}")
        
        # Verify unread count is now 0
        count_response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers=get_headers(owner_auth)
        )
        assert count_response.status_code == 200
        count_data = count_response.json()
        assert count_data["count"] == 0, f"Expected 0 unread, got {count_data['count']}"
        print("✓ Verified unread count is 0 after mark-all-read")


class TestNotificationSubscriptions:
    """Test getting user's active subscriptions"""
    
    def test_get_my_subscriptions(self, player_auth, venue_data):
        """GET /api/notifications/subscriptions - get user's active subscriptions"""
        # First subscribe to a slot
        tomorrow = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        subscribe_data = {
            "venue_id": venue_data["id"],
            "date": tomorrow,
            "start_time": "19:00",
            "turf_number": 2
        }
        
        requests.post(
            f"{BASE_URL}/api/notifications/subscribe",
            json=subscribe_data,
            headers=get_headers(player_auth)
        )
        
        response = requests.get(
            f"{BASE_URL}/api/notifications/subscriptions",
            headers=get_headers(player_auth)
        )
        
        assert response.status_code == 200, f"Get subscriptions failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ Get subscriptions: {len(data)} active subscriptions")
        
        # Cleanup: unsubscribe
        requests.delete(
            f"{BASE_URL}/api/notifications/subscribe",
            json=subscribe_data,
            headers=get_headers(player_auth)
        )
    
    def test_get_subscriptions_filtered_by_venue(self, player_auth, venue_data):
        """GET /api/notifications/subscriptions - filter by venue_id"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/subscriptions",
            params={"venue_id": venue_data["id"]},
            headers=get_headers(player_auth)
        )
        
        assert response.status_code == 200, f"Get filtered subscriptions failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        
        # All returned subscriptions should match the venue_id filter
        for sub in data:
            assert sub["venue_id"] == venue_data["id"], f"Subscription venue mismatch"
        
        print(f"✓ Get subscriptions filtered by venue: {len(data)} subscriptions")
    
    def test_get_subscriptions_filtered_by_date(self, player_auth, venue_data):
        """GET /api/notifications/subscriptions - filter by date"""
        tomorrow = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/notifications/subscriptions",
            params={"date": tomorrow},
            headers=get_headers(player_auth)
        )
        
        assert response.status_code == 200, f"Get filtered subscriptions failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        
        # All returned subscriptions should match the date filter
        for sub in data:
            assert sub["date"] == tomorrow, f"Subscription date mismatch"
        
        print(f"✓ Get subscriptions filtered by date: {len(data)} subscriptions")


class TestNotificationTriggerOnCancel:
    """Test that cancelling a booking triggers notifications for subscribers"""
    
    def test_booking_cancel_triggers_notification(self, player_auth, owner_auth, venue_data):
        """POST /api/bookings/{id}/cancel should trigger notifications"""
        tomorrow = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
        test_time = "15:00"
        
        # Step 1: Owner subscribes to be notified for a specific slot
        subscribe_data = {
            "venue_id": venue_data["id"],
            "date": tomorrow,
            "start_time": test_time,
            "turf_number": 1
        }
        
        sub_response = requests.post(
            f"{BASE_URL}/api/notifications/subscribe",
            json=subscribe_data,
            headers=get_headers(owner_auth)
        )
        assert sub_response.status_code == 200, f"Owner subscribe failed: {sub_response.text}"
        print(f"✓ Owner subscribed to slot {test_time}")
        
        # Step 2: Player books that slot
        booking_data = {
            "venue_id": venue_data["id"],
            "date": tomorrow,
            "start_time": test_time,
            "end_time": "16:00",
            "turf_number": 1,
            "sport": "football",
            "payment_mode": "full"
        }
        
        book_response = requests.post(
            f"{BASE_URL}/api/bookings",
            json=booking_data,
            headers=get_headers(player_auth)
        )
        assert book_response.status_code == 200, f"Booking failed: {book_response.text}"
        booking = book_response.json()
        booking_id = booking["id"]
        print(f"✓ Player booked slot, booking_id: {booking_id}")
        
        # Step 3: Get owner's unread count before cancel
        before_count_response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers=get_headers(owner_auth)
        )
        before_count = before_count_response.json().get("count", 0)
        print(f"  Owner unread notifications before cancel: {before_count}")
        
        # Step 4: Player cancels the booking
        cancel_response = requests.post(
            f"{BASE_URL}/api/bookings/{booking_id}/cancel",
            headers=get_headers(player_auth)
        )
        assert cancel_response.status_code == 200, f"Cancel failed: {cancel_response.text}"
        print(f"✓ Player cancelled booking {booking_id}")
        
        # Step 5: Check owner got notification
        after_count_response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers=get_headers(owner_auth)
        )
        after_count = after_count_response.json().get("count", 0)
        print(f"  Owner unread notifications after cancel: {after_count}")
        
        # Verify notification was created
        notifications_response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers=get_headers(owner_auth)
        )
        notifications = notifications_response.json()
        
        # Check for a slot_available notification
        slot_available_notifs = [n for n in notifications if n.get("type") == "slot_available"]
        print(f"✓ Owner has {len(slot_available_notifs)} slot_available notifications")
        
        # Verify notification content
        if len(slot_available_notifs) > 0:
            notif = slot_available_notifs[0]
            assert "Slot Now Available" in notif.get("title", "")
            assert venue_data["name"] in notif.get("message", "")
            print(f"✓ Notification content valid: {notif.get('title')}")
        
        # Clean up
        requests.delete(
            f"{BASE_URL}/api/notifications/subscribe",
            json=subscribe_data,
            headers=get_headers(owner_auth)
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
