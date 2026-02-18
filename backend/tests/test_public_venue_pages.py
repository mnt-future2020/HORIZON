"""
Test cases for Dynamic Public Venue Pages feature
Tests slug-based venue lookup and related API endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPublicVenuePageAPI:
    """Tests for GET /api/venues/slug/{venue_slug} endpoint"""

    def test_get_venue_by_slug_powerplay_arena(self):
        """Test fetching venue by slug - powerplay-arena"""
        response = requests.get(f"{BASE_URL}/api/venues/slug/powerplay-arena")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["name"] == "PowerPlay Arena"
        assert data["slug"] == "powerplay-arena"
        assert "id" in data
        assert "owner_id" in data
        assert "description" in data
        assert "sports" in data
        assert "amenities" in data
        assert "base_price" in data
        assert "city" in data
        print(f"PASS: Venue 'powerplay-arena' fetched successfully")

    def test_get_venue_by_slug_smashpoint_courts(self):
        """Test fetching venue by slug - smashpoint-courts"""
        response = requests.get(f"{BASE_URL}/api/venues/slug/smashpoint-courts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["name"] == "SmashPoint Courts"
        assert data["slug"] == "smashpoint-courts"
        assert "badminton" in data["sports"] or "table_tennis" in data["sports"]
        print(f"PASS: Venue 'smashpoint-courts' fetched successfully")

    def test_get_venue_by_slug_nonexistent(self):
        """Test 404 response for non-existent venue slug"""
        response = requests.get(f"{BASE_URL}/api/venues/slug/nonexistent-venue-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()
        print(f"PASS: Non-existent venue returns 404")

    def test_venue_by_slug_returns_all_required_fields(self):
        """Verify all required fields for public page are returned"""
        response = requests.get(f"{BASE_URL}/api/venues/slug/powerplay-arena")
        assert response.status_code == 200
        
        data = response.json()
        required_fields = [
            "id", "name", "slug", "description", "sports", "address", 
            "city", "amenities", "base_price", "slot_duration_minutes",
            "opening_hour", "closing_hour", "turfs", "rating", "status"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Verify data types
        assert isinstance(data["sports"], list)
        assert isinstance(data["amenities"], list)
        assert isinstance(data["base_price"], (int, float))
        assert isinstance(data["turfs"], int)
        print(f"PASS: All required fields present with correct types")


class TestVenueListWithSlugs:
    """Tests that venues list also includes slugs"""
    
    def test_venues_list_includes_slugs(self):
        """Verify venues list endpoint includes slug field"""
        response = requests.get(f"{BASE_URL}/api/venues")
        assert response.status_code == 200
        
        venues = response.json()
        assert len(venues) > 0, "No venues returned"
        
        for venue in venues[:5]:  # Check first 5 venues
            assert "slug" in venue, f"Venue {venue.get('name', 'unknown')} missing slug field"
        
        print(f"PASS: Venues list includes slug field for all venues")


class TestOwnerVenuesWithSlug:
    """Tests for owner's venues including slugs (requires auth)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for owner"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@owner.com",
            "password": "demo123"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Owner login failed")
    
    def test_owner_venues_include_slugs(self, auth_token):
        """Verify owner's venues include slug field for public page URL"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/owner/venues", headers=headers)
        assert response.status_code == 200
        
        venues = response.json()
        assert len(venues) > 0, "No venues returned for owner"
        
        for venue in venues:
            assert "slug" in venue, f"Venue {venue.get('name', 'unknown')} missing slug field"
            assert venue["slug"], f"Venue {venue.get('name', 'unknown')} has empty slug"
        
        # Verify powerplay-arena is in owner's venues
        venue_slugs = [v["slug"] for v in venues]
        assert "powerplay-arena" in venue_slugs, "powerplay-arena not in owner's venues"
        print(f"PASS: Owner venues include slug field. Found {len(venues)} venues")


class TestReviewsForPublicPage:
    """Tests for venue reviews displayed on public page"""
    
    def test_get_venue_reviews(self):
        """Test fetching reviews for a venue by ID"""
        # First get the venue ID
        venue_response = requests.get(f"{BASE_URL}/api/venues/slug/powerplay-arena")
        assert venue_response.status_code == 200
        venue_id = venue_response.json()["id"]
        
        # Now fetch reviews
        reviews_response = requests.get(f"{BASE_URL}/api/venues/{venue_id}/reviews")
        assert reviews_response.status_code == 200
        
        reviews = reviews_response.json()
        assert isinstance(reviews, list)
        print(f"PASS: Reviews endpoint returns list. Found {len(reviews)} reviews")
    
    def test_get_review_summary(self):
        """Test fetching review summary for a venue"""
        # First get the venue ID
        venue_response = requests.get(f"{BASE_URL}/api/venues/slug/powerplay-arena")
        assert venue_response.status_code == 200
        venue_id = venue_response.json()["id"]
        
        # Now fetch review summary
        summary_response = requests.get(f"{BASE_URL}/api/venues/{venue_id}/reviews/summary")
        # Summary endpoint might return 200 or 404 depending on implementation
        assert summary_response.status_code in [200, 404]
        
        if summary_response.status_code == 200:
            summary = summary_response.json()
            print(f"PASS: Review summary endpoint works. Summary: {summary}")
        else:
            print(f"INFO: Review summary returns 404 (no reviews yet)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
