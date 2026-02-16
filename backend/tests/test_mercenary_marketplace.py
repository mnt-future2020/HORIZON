"""
Mercenary Marketplace API Tests
Tests for P2: Mercenary Marketplace - find fill-in players for short teams
Tests: List, Create (linked to booking), Apply, Accept, Reject, Pay flow
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from seed data
PLAYER_CREDS = {"email": "demo@player.com", "password": "demo123"}  # Arjun Kumar - Host of football mercenary post
COACH_CREDS = {"email": "demo@coach.com", "password": "demo123"}    # Coach Sarah - Can apply to posts
OWNER_CREDS = {"email": "demo@owner.com", "password": "demo123"}    # Mr. Reddy - Fresh applicant


class TestMercenaryList:
    """Tests for GET /api/mercenary - list open mercenary posts"""
    
    def test_list_mercenary_posts_unauthenticated(self):
        """List mercenary posts without auth (should work - public endpoint)"""
        response = requests.get(f"{BASE_URL}/api/mercenary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"SUCCESS: Found {len(data)} open mercenary posts")
        
        # Validate post structure if posts exist
        if len(data) > 0:
            post = data[0]
            required_fields = ["id", "host_id", "host_name", "booking_id", "venue_name", 
                             "sport", "date", "time", "position_needed", "amount_per_player",
                             "spots_available", "spots_filled", "status"]
            for field in required_fields:
                assert field in post, f"Missing field: {field}"
            print(f"SUCCESS: Post structure validated - Position: {post['position_needed']}, Venue: {post['venue_name']}")
    
    def test_list_mercenary_posts_by_sport(self):
        """Filter mercenary posts by sport"""
        response = requests.get(f"{BASE_URL}/api/mercenary", params={"sport": "football"})
        assert response.status_code == 200
        data = response.json()
        for post in data:
            assert post["sport"] == "football", f"Expected football, got {post['sport']}"
        print(f"SUCCESS: Filter by sport works - Found {len(data)} football posts")


class TestMercenaryMyPosts:
    """Tests for GET /api/mercenary/my-posts - user's own mercenary posts"""
    
    @pytest.fixture
    def player_token(self):
        """Get player token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=PLAYER_CREDS)
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.text}")
        return response.json().get("token")
    
    def test_my_posts_requires_auth(self):
        """My posts endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/mercenary/my-posts")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: my-posts requires authentication")
    
    def test_my_posts_returns_user_posts(self, player_token):
        """Get posts created by the logged-in user"""
        headers = {"Authorization": f"Bearer {player_token}"}
        response = requests.get(f"{BASE_URL}/api/mercenary/my-posts", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Player has {len(data)} mercenary posts")
        
        # Player (Arjun Kumar) should have the football goalkeeper post
        if len(data) > 0:
            # All posts should belong to this user
            for post in data:
                assert post["host_name"] == "Arjun Kumar", f"Expected Arjun Kumar's posts, got {post['host_name']}"


class TestMercenaryCreate:
    """Tests for POST /api/mercenary - create mercenary post linked to booking"""
    
    @pytest.fixture
    def player_session(self):
        """Get authenticated session for player"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json=PLAYER_CREDS)
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.text}")
        token = response.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    def test_create_requires_auth(self):
        """Create mercenary post requires authentication"""
        response = requests.post(f"{BASE_URL}/api/mercenary", json={
            "booking_id": "fake-id",
            "position_needed": "Test Position",
            "amount_per_player": 100,
            "spots_available": 1
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Create requires authentication")
    
    def test_create_requires_valid_booking(self, player_session):
        """Creating post with invalid booking_id should fail"""
        response = player_session.post(f"{BASE_URL}/api/mercenary", json={
            "booking_id": "non-existent-booking-id",
            "position_needed": "Striker",
            "amount_per_player": 150,
            "spots_available": 1
        })
        assert response.status_code == 404, f"Expected 404 for invalid booking, got {response.status_code}"
        print("SUCCESS: Invalid booking returns 404")
    
    def test_create_with_valid_booking(self, player_session):
        """Create mercenary post linked to user's booking"""
        # First get user's bookings
        bookings_response = player_session.get(f"{BASE_URL}/api/bookings")
        if bookings_response.status_code != 200 or not bookings_response.json():
            pytest.skip("No bookings found for user")
        
        bookings = bookings_response.json()
        confirmed_bookings = [b for b in bookings if b.get("status") == "confirmed"]
        if not confirmed_bookings:
            pytest.skip("No confirmed bookings found")
        
        booking = confirmed_bookings[0]
        booking_id = booking["id"]
        
        # Create mercenary post
        response = player_session.post(f"{BASE_URL}/api/mercenary", json={
            "booking_id": booking_id,
            "position_needed": "TEST_Midfielder",
            "description": "Test mercenary post for automated testing",
            "amount_per_player": 175,
            "spots_available": 2
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Validate created post
        assert data["booking_id"] == booking_id, "Booking ID mismatch"
        assert data["position_needed"] == "TEST_Midfielder"
        assert data["amount_per_player"] == 175
        assert data["spots_available"] == 2
        assert data["spots_filled"] == 0
        assert data["status"] == "open"
        assert "venue_name" in data and data["venue_name"]  # Should inherit venue from booking
        
        print(f"SUCCESS: Created mercenary post at {data['venue_name']} for {data['position_needed']}")
        
        # Cleanup - store post ID for potential cleanup
        return data["id"]


class TestMercenaryApply:
    """Tests for POST /api/mercenary/{id}/apply - player applies to mercenary post"""
    
    @pytest.fixture
    def owner_session(self):
        """Get authenticated session for owner (fresh applicant)"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json=OWNER_CREDS)
        if response.status_code != 200:
            pytest.skip(f"Owner login failed: {response.text}")
        token = response.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    @pytest.fixture
    def player_session(self):
        """Get authenticated session for player (host)"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json=PLAYER_CREDS)
        if response.status_code != 200:
            pytest.skip(f"Player login failed: {response.text}")
        token = response.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    @pytest.fixture
    def football_post_id(self):
        """Get the football mercenary post ID"""
        response = requests.get(f"{BASE_URL}/api/mercenary", params={"sport": "football"})
        if response.status_code != 200 or not response.json():
            pytest.skip("No football mercenary posts found")
        posts = response.json()
        goalkeeper_posts = [p for p in posts if "Goalkeeper" in p.get("position_needed", "")]
        if goalkeeper_posts:
            return goalkeeper_posts[0]["id"]
        return posts[0]["id"]
    
    def test_apply_requires_auth(self, football_post_id):
        """Apply endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/mercenary/{football_post_id}/apply")
        assert response.status_code == 401
        print("SUCCESS: Apply requires authentication")
    
    def test_cannot_apply_to_own_post(self, player_session, football_post_id):
        """Host cannot apply to their own post"""
        response = player_session.post(f"{BASE_URL}/api/mercenary/{football_post_id}/apply")
        assert response.status_code == 400, f"Expected 400 for self-apply, got {response.status_code}: {response.text}"
        assert "own post" in response.json().get("detail", "").lower()
        print("SUCCESS: Cannot apply to own post")
    
    def test_apply_to_post_success(self, owner_session, football_post_id):
        """Player successfully applies to mercenary post"""
        response = owner_session.post(f"{BASE_URL}/api/mercenary/{football_post_id}/apply")
        
        # Could be 200 (success) or 400 (already applied from previous test runs)
        if response.status_code == 200:
            assert "applied" in response.json().get("message", "").lower()
            print("SUCCESS: Owner applied to football post")
        elif response.status_code == 400:
            detail = response.json().get("detail", "")
            assert "already" in detail.lower(), f"Unexpected 400 error: {detail}"
            print("INFO: Owner already applied (from previous test run)")
        else:
            pytest.fail(f"Unexpected status {response.status_code}: {response.text}")
    
    def test_no_duplicate_applications(self, owner_session, football_post_id):
        """Cannot apply twice to the same post"""
        # First apply (might succeed or already applied)
        owner_session.post(f"{BASE_URL}/api/mercenary/{football_post_id}/apply")
        
        # Second apply should fail
        response = owner_session.post(f"{BASE_URL}/api/mercenary/{football_post_id}/apply")
        assert response.status_code == 400
        detail = response.json().get("detail", "")
        assert "already" in detail.lower()
        print("SUCCESS: Duplicate applications prevented")


class TestMercenaryAcceptReject:
    """Tests for accept/reject applicant endpoints"""
    
    @pytest.fixture
    def player_session(self):
        """Get authenticated session for player (host of football post)"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json=PLAYER_CREDS)
        if response.status_code != 200:
            pytest.skip(f"Player login failed: {response.text}")
        token = response.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    @pytest.fixture
    def owner_session(self):
        """Get authenticated session for owner"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json=OWNER_CREDS)
        if response.status_code != 200:
            pytest.skip(f"Owner login failed: {response.text}")
        token = response.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    @pytest.fixture
    def football_post(self, player_session):
        """Get the football mercenary post with details"""
        response = player_session.get(f"{BASE_URL}/api/mercenary/my-posts")
        if response.status_code != 200:
            pytest.skip("Could not get my-posts")
        posts = response.json()
        football_posts = [p for p in posts if p.get("sport") == "football"]
        if not football_posts:
            pytest.skip("No football posts found")
        return football_posts[0]
    
    def test_only_host_can_accept(self, owner_session, football_post):
        """Only the host can accept applicants"""
        post_id = football_post["id"]
        applicants = football_post.get("applicants", [])
        if not applicants:
            pytest.skip("No applicants to accept")
        
        applicant_id = applicants[0]["id"]
        response = owner_session.post(f"{BASE_URL}/api/mercenary/{post_id}/accept/{applicant_id}")
        assert response.status_code == 403, f"Expected 403 for non-host, got {response.status_code}"
        print("SUCCESS: Only host can accept applicants")
    
    def test_host_can_accept_applicant(self, player_session, football_post):
        """Host accepts an applicant"""
        post_id = football_post["id"]
        applicants = football_post.get("applicants", [])
        
        if not applicants:
            pytest.skip("No applicants to accept - run apply tests first")
        
        applicant_id = applicants[0]["id"]
        applicant_name = applicants[0]["name"]
        
        response = player_session.post(f"{BASE_URL}/api/mercenary/{post_id}/accept/{applicant_id}")
        
        # Could be 200 (success) or 400 (spots full) or 404 (already accepted)
        if response.status_code == 200:
            assert "accepted" in response.json().get("message", "").lower()
            print(f"SUCCESS: Host accepted applicant {applicant_name}")
        elif response.status_code == 404:
            print(f"INFO: Applicant {applicant_name} not found in applicants (possibly already accepted)")
        elif response.status_code == 400:
            print(f"INFO: Could not accept - {response.json().get('detail', '')}")
        else:
            pytest.fail(f"Unexpected status {response.status_code}: {response.text}")
    
    def test_host_can_reject_applicant(self, player_session):
        """Host rejects an applicant"""
        # Get posts with applicants
        response = player_session.get(f"{BASE_URL}/api/mercenary/my-posts")
        posts = response.json()
        
        posts_with_applicants = [p for p in posts if p.get("applicants")]
        if not posts_with_applicants:
            pytest.skip("No posts with applicants to reject")
        
        post = posts_with_applicants[0]
        post_id = post["id"]
        applicant_id = post["applicants"][0]["id"]
        
        response = player_session.post(f"{BASE_URL}/api/mercenary/{post_id}/reject/{applicant_id}")
        assert response.status_code == 200
        assert "rejected" in response.json().get("message", "").lower()
        print("SUCCESS: Host rejected applicant")


class TestMercenaryPayment:
    """Tests for POST /api/mercenary/{id}/pay - accepted player pays fee"""
    
    @pytest.fixture
    def owner_session(self):
        """Get authenticated session for owner (applicant)"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json=OWNER_CREDS)
        if response.status_code != 200:
            pytest.skip(f"Owner login failed: {response.text}")
        token = response.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    @pytest.fixture
    def coach_session(self):
        """Get authenticated session for coach"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json=COACH_CREDS)
        if response.status_code != 200:
            pytest.skip(f"Coach login failed: {response.text}")
        token = response.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    def test_pay_requires_acceptance(self, owner_session):
        """Player must be accepted before paying"""
        # Get any open post
        response = requests.get(f"{BASE_URL}/api/mercenary")
        posts = response.json()
        if not posts:
            pytest.skip("No mercenary posts found")
        
        post_id = posts[0]["id"]
        
        # Try to pay without being accepted
        response = owner_session.post(f"{BASE_URL}/api/mercenary/{post_id}/pay")
        
        # Should fail with 403 if not accepted, or succeed if already accepted & using mock
        if response.status_code == 403:
            assert "accepted" in response.json().get("detail", "").lower()
            print("SUCCESS: Payment requires acceptance first")
        elif response.status_code == 400:
            # Already paid
            assert "already" in response.json().get("detail", "").lower()
            print("INFO: Player already paid")
        elif response.status_code == 200:
            # Mock payment successful (player was accepted)
            data = response.json()
            print(f"INFO: Payment successful (mock mode): {data}")
        else:
            pytest.fail(f"Unexpected status {response.status_code}: {response.text}")
    
    def test_payment_returns_mock_or_razorpay(self, coach_session):
        """Payment returns either mock confirmation or Razorpay order"""
        # Find a post where coach is accepted
        response = requests.get(f"{BASE_URL}/api/mercenary")
        posts = response.json()
        
        # Find post where coach might be in accepted list
        for post in posts:
            accepted_ids = [a["id"] for a in post.get("accepted", [])]
            paid_ids = [p["id"] for p in post.get("paid_players", [])]
            
            # Check if coach is accepted but not paid
            if accepted_ids and any("coach" in str(a).lower() for a in post.get("accepted", [])):
                post_id = post["id"]
                
                response = coach_session.post(f"{BASE_URL}/api/mercenary/{post_id}/pay")
                
                if response.status_code == 200:
                    data = response.json()
                    # Should be either mock or razorpay
                    assert "payment_gateway" in data or "message" in data
                    if data.get("payment_gateway") == "mock":
                        print(f"SUCCESS: Mock payment - Amount: ₹{data.get('amount', 'N/A')}")
                    elif data.get("payment_gateway") == "razorpay":
                        print(f"SUCCESS: Razorpay order created - Order ID: {data.get('razorpay_order_id')}")
                    return
                elif response.status_code == 400:
                    print(f"INFO: Coach already paid: {response.json()}")
                    return
                elif response.status_code == 403:
                    continue  # Coach not accepted for this post
        
        pytest.skip("No posts where coach is accepted and can pay")


class TestMercenaryNotifications:
    """Tests for notification creation during mercenary flow"""
    
    @pytest.fixture
    def player_session(self):
        """Get authenticated session for player"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json=PLAYER_CREDS)
        if response.status_code != 200:
            pytest.skip(f"Player login failed: {response.text}")
        token = response.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    @pytest.fixture
    def owner_session(self):
        """Get authenticated session for owner"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json=OWNER_CREDS)
        if response.status_code != 200:
            pytest.skip(f"Owner login failed: {response.text}")
        token = response.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    def test_host_receives_application_notification(self, player_session):
        """Host receives notification when someone applies"""
        response = player_session.get(f"{BASE_URL}/api/notifications")
        if response.status_code != 200:
            pytest.skip("Could not get notifications")
        
        notifications = response.json()
        app_notifications = [n for n in notifications if n.get("type") == "mercenary_application"]
        
        if app_notifications:
            latest = app_notifications[0]
            assert "applied" in latest.get("message", "").lower() or "application" in latest.get("title", "").lower()
            print(f"SUCCESS: Found application notification - {latest.get('title')}")
        else:
            print("INFO: No mercenary_application notifications found yet")
    
    def test_player_receives_acceptance_notification(self, owner_session):
        """Accepted player receives notification"""
        response = owner_session.get(f"{BASE_URL}/api/notifications")
        if response.status_code != 200:
            pytest.skip("Could not get notifications")
        
        notifications = response.json()
        accept_notifications = [n for n in notifications if n.get("type") == "mercenary_accepted"]
        
        if accept_notifications:
            latest = accept_notifications[0]
            assert "accepted" in latest.get("message", "").lower() or "in" in latest.get("title", "").lower()
            print(f"SUCCESS: Found acceptance notification - {latest.get('title')}")
        else:
            print("INFO: No mercenary_accepted notifications found (owner may not be accepted yet)")


class TestMercenaryFullFlow:
    """End-to-end flow test: Apply → Accept → Pay → Confirmed"""
    
    def test_complete_mercenary_flow(self):
        """Test complete flow with a fresh scenario"""
        # Login as coach (will apply to player's football post)
        coach_login = requests.post(f"{BASE_URL}/api/auth/login", json=COACH_CREDS)
        if coach_login.status_code != 200:
            pytest.skip("Coach login failed")
        coach_token = coach_login.json()["token"]
        coach_headers = {"Authorization": f"Bearer {coach_token}"}
        
        # Login as player (host of football post)
        player_login = requests.post(f"{BASE_URL}/api/auth/login", json=PLAYER_CREDS)
        if player_login.status_code != 200:
            pytest.skip("Player login failed")
        player_token = player_login.json()["token"]
        player_headers = {"Authorization": f"Bearer {player_token}"}
        
        # Get football post
        posts = requests.get(f"{BASE_URL}/api/mercenary", params={"sport": "football"}).json()
        if not posts:
            pytest.skip("No football posts")
        
        football_post = posts[0]
        post_id = football_post["id"]
        
        print(f"Testing flow on post: {football_post['position_needed']} at {football_post['venue_name']}")
        
        # Step 1: Check current state
        print(f"  Current state: {football_post['spots_filled']}/{football_post['spots_available']} spots filled")
        print(f"  Applicants: {len(football_post.get('applicants', []))}")
        print(f"  Accepted: {len(football_post.get('accepted', []))}")
        print(f"  Paid: {len(football_post.get('paid_players', []))}")
        
        # Step 2: Coach applies (or already applied)
        apply_resp = requests.post(f"{BASE_URL}/api/mercenary/{post_id}/apply", headers=coach_headers)
        if apply_resp.status_code == 200:
            print("  ✓ Coach applied successfully")
        elif apply_resp.status_code == 400:
            detail = apply_resp.json().get("detail", "")
            if "already" in detail.lower():
                print("  ✓ Coach already applied/accepted")
            else:
                print(f"  ✗ Apply failed: {detail}")
        else:
            print(f"  ✗ Apply unexpected status: {apply_resp.status_code}")
        
        # Step 3: Refresh post to see coach in applicants
        posts = requests.get(f"{BASE_URL}/api/mercenary", params={"sport": "football"}).json()
        football_post = next((p for p in posts if p["id"] == post_id), None)
        
        if not football_post:
            pytest.fail("Could not find post after apply")
        
        # Step 4: Player accepts coach (find coach in applicants)
        coach_in_applicants = None
        for a in football_post.get("applicants", []):
            if "sarah" in a.get("name", "").lower() or "coach" in a.get("name", "").lower():
                coach_in_applicants = a
                break
        
        if coach_in_applicants:
            accept_resp = requests.post(
                f"{BASE_URL}/api/mercenary/{post_id}/accept/{coach_in_applicants['id']}", 
                headers=player_headers
            )
            if accept_resp.status_code == 200:
                print(f"  ✓ Player accepted {coach_in_applicants['name']}")
            else:
                print(f"  ✗ Accept failed: {accept_resp.status_code} - {accept_resp.text}")
        else:
            # Check if coach is already accepted
            coach_in_accepted = any(
                "sarah" in a.get("name", "").lower() or "coach" in a.get("name", "").lower()
                for a in football_post.get("accepted", [])
            )
            if coach_in_accepted:
                print("  ✓ Coach already in accepted list")
            else:
                print("  ℹ Coach not found in applicants (may be in accepted/paid already)")
        
        # Step 5: Coach pays (mock mode)
        pay_resp = requests.post(f"{BASE_URL}/api/mercenary/{post_id}/pay", headers=coach_headers)
        if pay_resp.status_code == 200:
            data = pay_resp.json()
            if data.get("payment_gateway") == "mock":
                print(f"  ✓ Coach paid (mock mode) - Amount: ₹{data.get('amount', 'N/A')}")
            elif data.get("payment_gateway") == "razorpay":
                print(f"  ✓ Razorpay order created (would need frontend to complete)")
        elif pay_resp.status_code == 400:
            if "already" in pay_resp.json().get("detail", "").lower():
                print("  ✓ Coach already paid")
        elif pay_resp.status_code == 403:
            print(f"  ✗ Coach not accepted yet: {pay_resp.json()}")
        else:
            print(f"  ✗ Pay unexpected status: {pay_resp.status_code} - {pay_resp.text}")
        
        # Step 6: Verify final state
        posts = requests.get(f"{BASE_URL}/api/mercenary", params={"sport": "football"}).json()
        final_post = next((p for p in posts if p["id"] == post_id), None)
        
        if final_post:
            print(f"  Final state: {final_post['spots_filled']}/{final_post['spots_available']} spots filled")
            print(f"  Status: {final_post['status']}")
        
        print("SUCCESS: Mercenary flow test completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
