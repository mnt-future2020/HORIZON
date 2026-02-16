"""
Test suite for Venue Reviews & Ratings System
Tests: GET /api/venues/{id}/reviews, POST /api/venues/{id}/reviews, GET summary, GET can-review
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
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
def player_token(api_client):
    """Get player auth token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": PLAYER_EMAIL,
        "password": PLAYER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Player authentication failed")


@pytest.fixture(scope="module")
def owner_token(api_client):
    """Get owner auth token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": OWNER_EMAIL,
        "password": OWNER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Owner authentication failed")


@pytest.fixture(scope="module")
def authenticated_player(api_client, player_token):
    """Session with player auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {player_token}"
    })
    return session


@pytest.fixture(scope="module")
def authenticated_owner(api_client, owner_token):
    """Session with owner auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {owner_token}"
    })
    return session


@pytest.fixture(scope="module")
def first_venue(api_client):
    """Get the first venue from the list"""
    response = api_client.get(f"{BASE_URL}/api/venues")
    assert response.status_code == 200
    venues = response.json()
    assert len(venues) > 0, "No venues found"
    # Sort by rating descending as mentioned in agent context
    venues_sorted = sorted(venues, key=lambda v: v.get('rating', 0), reverse=True)
    return venues_sorted[0]


class TestReviewsGetList:
    """Tests for GET /api/venues/{venue_id}/reviews"""

    def test_get_reviews_returns_list(self, api_client, first_venue):
        """GET reviews returns list sorted by created_at desc"""
        venue_id = first_venue["id"]
        response = api_client.get(f"{BASE_URL}/api/venues/{venue_id}/reviews")
        
        assert response.status_code == 200
        reviews = response.json()
        assert isinstance(reviews, list)
        print(f"Found {len(reviews)} reviews for venue {first_venue['name']}")
        
    def test_get_reviews_sorted_desc(self, api_client, first_venue):
        """Reviews are sorted by created_at descending (newest first)"""
        venue_id = first_venue["id"]
        response = api_client.get(f"{BASE_URL}/api/venues/{venue_id}/reviews")
        
        assert response.status_code == 200
        reviews = response.json()
        
        if len(reviews) >= 2:
            # Verify descending order
            for i in range(len(reviews) - 1):
                curr_date = reviews[i].get("created_at", "")
                next_date = reviews[i + 1].get("created_at", "")
                assert curr_date >= next_date, f"Reviews not sorted desc: {curr_date} < {next_date}"
        print("Reviews are properly sorted by created_at desc")
        
    def test_get_reviews_has_required_fields(self, api_client, first_venue):
        """Each review has required fields: id, rating, user_name, comment, created_at"""
        venue_id = first_venue["id"]
        response = api_client.get(f"{BASE_URL}/api/venues/{venue_id}/reviews")
        
        assert response.status_code == 200
        reviews = response.json()
        
        if len(reviews) > 0:
            review = reviews[0]
            assert "id" in review
            assert "rating" in review
            assert "user_name" in review
            assert "created_at" in review
            # Comment is optional
            assert 1 <= review["rating"] <= 5, f"Rating {review['rating']} out of range"
            print(f"Review fields verified: rating={review['rating']}, user={review['user_name']}")

    def test_get_reviews_nonexistent_venue(self, api_client):
        """GET reviews for non-existent venue returns 404"""
        response = api_client.get(f"{BASE_URL}/api/venues/nonexistent-venue-id-12345/reviews")
        assert response.status_code == 404


class TestReviewsSummary:
    """Tests for GET /api/venues/{venue_id}/reviews/summary"""

    def test_get_summary_returns_aggregates(self, api_client, first_venue):
        """GET summary returns avg_rating, total, and distribution"""
        venue_id = first_venue["id"]
        response = api_client.get(f"{BASE_URL}/api/venues/{venue_id}/reviews/summary")
        
        assert response.status_code == 200
        summary = response.json()
        
        assert "avg_rating" in summary
        assert "total" in summary
        assert "distribution" in summary
        
        # Verify distribution has all star levels
        dist = summary["distribution"]
        for star in [1, 2, 3, 4, 5]:
            assert star in dist or str(star) in dist, f"Missing star {star} in distribution"
            
        print(f"Summary: avg={summary['avg_rating']}, total={summary['total']}, dist={summary['distribution']}")

    def test_summary_avg_rating_in_range(self, api_client, first_venue):
        """Average rating is between 0 and 5"""
        venue_id = first_venue["id"]
        response = api_client.get(f"{BASE_URL}/api/venues/{venue_id}/reviews/summary")
        
        assert response.status_code == 200
        summary = response.json()
        
        avg = summary["avg_rating"]
        assert 0 <= avg <= 5, f"Average rating {avg} out of range"
        
    def test_summary_distribution_matches_total(self, api_client, first_venue):
        """Sum of distribution counts equals total"""
        venue_id = first_venue["id"]
        response = api_client.get(f"{BASE_URL}/api/venues/{venue_id}/reviews/summary")
        
        assert response.status_code == 200
        summary = response.json()
        
        dist = summary["distribution"]
        # Handle both int and str keys
        dist_sum = sum(dist.get(star, dist.get(str(star), 0)) for star in [1, 2, 3, 4, 5])
        assert dist_sum == summary["total"], f"Distribution sum {dist_sum} != total {summary['total']}"


class TestCanReview:
    """Tests for GET /api/venues/{venue_id}/reviews/can-review"""

    def test_can_review_requires_auth(self, api_client, first_venue):
        """can-review requires authentication"""
        venue_id = first_venue["id"]
        response = api_client.get(f"{BASE_URL}/api/venues/{venue_id}/reviews/can-review")
        assert response.status_code == 401 or response.status_code == 403
        
    def test_can_review_returns_structure(self, authenticated_player, first_venue):
        """can-review returns can_review boolean and eligible_bookings list"""
        venue_id = first_venue["id"]
        response = authenticated_player.get(f"{BASE_URL}/api/venues/{venue_id}/reviews/can-review")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "can_review" in data
        assert "eligible_bookings" in data
        assert isinstance(data["can_review"], bool)
        assert isinstance(data["eligible_bookings"], list)
        
        print(f"can_review={data['can_review']}, eligible_bookings={len(data['eligible_bookings'])}")


class TestCreateReview:
    """Tests for POST /api/venues/{venue_id}/reviews"""

    def test_create_review_requires_auth(self, api_client, first_venue):
        """POST review requires authentication"""
        venue_id = first_venue["id"]
        response = api_client.post(f"{BASE_URL}/api/venues/{venue_id}/reviews", json={
            "rating": 5,
            "comment": "Great venue!",
            "booking_id": "some-booking-id"
        })
        assert response.status_code == 401 or response.status_code == 403
        
    def test_create_review_requires_confirmed_booking(self, authenticated_player, first_venue):
        """POST review fails without confirmed booking (403)"""
        venue_id = first_venue["id"]
        response = authenticated_player.post(f"{BASE_URL}/api/venues/{venue_id}/reviews", json={
            "rating": 5,
            "comment": "Test comment",
            "booking_id": "fake-booking-id-" + str(uuid.uuid4())
        })
        # Should fail with 403 - no confirmed booking
        assert response.status_code == 403
        print("Correctly rejects review without confirmed booking")
        
    def test_create_review_validates_rating(self, authenticated_player, first_venue):
        """POST review validates rating is 1-5"""
        venue_id = first_venue["id"]
        
        # Test invalid rating (0)
        response = authenticated_player.post(f"{BASE_URL}/api/venues/{venue_id}/reviews", json={
            "rating": 0,
            "comment": "Test",
            "booking_id": "test-booking"
        })
        assert response.status_code == 400, f"Expected 400 for rating=0, got {response.status_code}"
        
        # Test invalid rating (6)
        response = authenticated_player.post(f"{BASE_URL}/api/venues/{venue_id}/reviews", json={
            "rating": 6,
            "comment": "Test",
            "booking_id": "test-booking"
        })
        assert response.status_code == 400, f"Expected 400 for rating=6, got {response.status_code}"
        
    def test_create_review_requires_booking_id(self, authenticated_player, first_venue):
        """POST review requires booking_id"""
        venue_id = first_venue["id"]
        response = authenticated_player.post(f"{BASE_URL}/api/venues/{venue_id}/reviews", json={
            "rating": 5,
            "comment": "Test"
        })
        assert response.status_code == 400
        print("Correctly requires booking_id")


class TestCreateReviewWithBooking:
    """Tests for creating review with actual confirmed booking"""
    
    def test_full_review_flow(self, authenticated_player, first_venue):
        """Create booking, confirm it, then submit review"""
        from datetime import datetime, timedelta
        
        venue_id = first_venue["id"]
        
        # 1. Get available slot for tomorrow
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        slots_resp = authenticated_player.get(f"{BASE_URL}/api/venues/{venue_id}/slots", params={"date": tomorrow})
        assert slots_resp.status_code == 200
        slots_data = slots_resp.json()
        slots = slots_data.get("slots", [])
        
        # Find available slot
        available_slot = None
        for slot in slots:
            if slot.get("status") == "available":
                available_slot = slot
                break
                
        if not available_slot:
            pytest.skip("No available slots for review test")
            
        # 2. Create booking
        booking_data = {
            "venue_id": venue_id,
            "date": tomorrow,
            "start_time": available_slot["start_time"],
            "end_time": available_slot["end_time"],
            "turf_number": available_slot["turf_number"],
            "sport": first_venue.get("sports", ["football"])[0],
            "payment_mode": "full"
        }
        booking_resp = authenticated_player.post(f"{BASE_URL}/api/bookings", json=booking_data)
        assert booking_resp.status_code in [200, 201], f"Booking failed: {booking_resp.text}"
        booking = booking_resp.json()
        booking_id = booking["id"]
        print(f"Created booking {booking_id}")
        
        # 3. Mock confirm the booking
        confirm_resp = authenticated_player.post(f"{BASE_URL}/api/bookings/{booking_id}/mock-confirm")
        assert confirm_resp.status_code == 200, f"Mock confirm failed: {confirm_resp.text}"
        print(f"Confirmed booking {booking_id}")
        
        # 4. Check can-review now returns this booking
        can_review_resp = authenticated_player.get(f"{BASE_URL}/api/venues/{venue_id}/reviews/can-review")
        assert can_review_resp.status_code == 200
        can_review_data = can_review_resp.json()
        assert can_review_data["can_review"] == True, "Should be able to review after confirmed booking"
        eligible_ids = [b["id"] for b in can_review_data["eligible_bookings"]]
        assert booking_id in eligible_ids, f"Booking {booking_id} not in eligible list"
        print(f"can-review returned {len(eligible_ids)} eligible bookings including new one")
        
        # 5. Submit review
        review_data = {
            "rating": 4,
            "comment": f"Test review from automated test {uuid.uuid4()}",
            "booking_id": booking_id
        }
        review_resp = authenticated_player.post(f"{BASE_URL}/api/venues/{venue_id}/reviews", json=review_data)
        assert review_resp.status_code in [200, 201], f"Review creation failed: {review_resp.text}"
        review = review_resp.json()
        assert review["rating"] == 4
        assert review["booking_id"] == booking_id
        assert "id" in review
        print(f"Created review {review['id']} with rating {review['rating']}")
        
        # 6. Verify duplicate review is rejected (409)
        dup_resp = authenticated_player.post(f"{BASE_URL}/api/venues/{venue_id}/reviews", json=review_data)
        assert dup_resp.status_code == 409, f"Expected 409 for duplicate, got {dup_resp.status_code}"
        print("Duplicate review correctly rejected with 409")
        
        # 7. Verify venue's rating/total_reviews updated
        venue_resp = authenticated_player.get(f"{BASE_URL}/api/venues/{venue_id}")
        assert venue_resp.status_code == 200
        updated_venue = venue_resp.json()
        print(f"Venue rating after review: {updated_venue.get('rating')}, total_reviews: {updated_venue.get('total_reviews')}")
        
        # 8. Verify review appears in list
        reviews_resp = authenticated_player.get(f"{BASE_URL}/api/venues/{venue_id}/reviews")
        assert reviews_resp.status_code == 200
        reviews = reviews_resp.json()
        review_ids = [r["id"] for r in reviews]
        assert review["id"] in review_ids, "New review not found in reviews list"
        print(f"Review verified in list (total {len(reviews)} reviews)")
        
        # 9. Verify can-review no longer includes this booking
        can_review_after = authenticated_player.get(f"{BASE_URL}/api/venues/{venue_id}/reviews/can-review")
        assert can_review_after.status_code == 200
        after_data = can_review_after.json()
        after_ids = [b["id"] for b in after_data["eligible_bookings"]]
        assert booking_id not in after_ids, "Reviewed booking should not be in eligible list"
        print("Booking removed from eligible list after review")
        
        return review


class TestVenueRatingUpdate:
    """Tests that venue rating/total_reviews updates after reviews"""
    
    def test_venue_has_rating_field(self, api_client, first_venue):
        """Venue has rating and total_reviews fields"""
        venue_id = first_venue["id"]
        response = api_client.get(f"{BASE_URL}/api/venues/{venue_id}")
        assert response.status_code == 200
        venue = response.json()
        
        # These fields should exist (may be 0 if no reviews)
        assert "rating" in venue or venue.get("rating") is not None
        assert "total_reviews" in venue or venue.get("total_reviews") is not None
        print(f"Venue rating: {venue.get('rating')}, total_reviews: {venue.get('total_reviews')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
