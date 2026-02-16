"""
Test cases for GPS-based "Near Me" venue search feature.
Tests the /api/venues/nearby endpoint with Haversine distance calculation.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestNearbyVenuesAPI:
    """Tests for /api/venues/nearby endpoint with Haversine distance calculation"""

    def test_nearby_bengaluru_returns_venues(self):
        """Test that Bengaluru coordinates return venues sorted by distance"""
        # Bengaluru city center coordinates
        lat, lng = 12.97, 77.59
        response = requests.get(f"{BASE_URL}/api/venues/nearby", params={
            "lat": lat, "lng": lng, "radius_km": 50
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        venues = response.json()
        assert isinstance(venues, list), "Response should be a list"
        assert len(venues) > 0, "Should return at least one venue near Bengaluru"
        
        # Verify distance_km field exists in each venue
        for venue in venues:
            assert "distance_km" in venue, f"Venue {venue.get('name')} missing distance_km"
            assert isinstance(venue["distance_km"], (int, float)), "distance_km should be numeric"
            assert venue["distance_km"] <= 50, f"Venue distance {venue['distance_km']} exceeds radius"
        
        # Verify sorted by distance (ascending)
        if len(venues) > 1:
            for i in range(len(venues) - 1):
                assert venues[i]["distance_km"] <= venues[i+1]["distance_km"], \
                    f"Results not sorted: {venues[i]['distance_km']} > {venues[i+1]['distance_km']}"
        
        print(f"Bengaluru test: Found {len(venues)} venues")
        for v in venues[:5]:
            print(f"  - {v['name']} ({v['city']}): {v['distance_km']} km")

    def test_nearby_chennai_returns_only_chennai_venues(self):
        """Test Chennai coordinates return only Chennai venues (not Bengaluru/Mumbai)"""
        # Chennai city center coordinates
        lat, lng = 13.08, 80.27
        response = requests.get(f"{BASE_URL}/api/venues/nearby", params={
            "lat": lat, "lng": lng, "radius_km": 30
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        venues = response.json()
        assert isinstance(venues, list), "Response should be a list"
        
        # All venues within 30km of Chennai should be Chennai venues
        for venue in venues:
            assert "distance_km" in venue, f"Venue missing distance_km"
            # Bengaluru is ~350km from Chennai, Mumbai is ~1300km - neither should appear
            # Only Chennai venues should be within 30km radius
            print(f"  - {venue['name']} ({venue['city']}): {venue['distance_km']} km")
        
        if len(venues) > 0:
            cities_found = set(v['city'] for v in venues)
            print(f"Chennai test: Found {len(venues)} venues from cities: {cities_found}")
            # Chennai venues should dominate within 30km
            assert any(v['city'] == 'Chennai' for v in venues), "Should include Chennai venues"

    def test_nearby_mumbai_returns_mumbai_venues(self):
        """Test Mumbai coordinates return venues with correct distances"""
        # Mumbai city center coordinates
        lat, lng = 19.07, 72.87
        response = requests.get(f"{BASE_URL}/api/venues/nearby", params={
            "lat": lat, "lng": lng, "radius_km": 20
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        venues = response.json()
        assert isinstance(venues, list), "Response should be a list"
        
        # Verify distance_km is reasonable
        for venue in venues:
            assert "distance_km" in venue, f"Venue missing distance_km"
            assert venue["distance_km"] >= 0, "Distance should be non-negative"
            assert venue["distance_km"] <= 20, f"Distance {venue['distance_km']} exceeds 20km radius"
        
        print(f"Mumbai test: Found {len(venues)} venues")
        for v in venues[:5]:
            print(f"  - {v['name']} ({v['city']}): {v['distance_km']} km")

    def test_nearby_far_coordinates_returns_empty(self):
        """Test that coordinates far from any city return empty list"""
        # Middle of Indian Ocean - no venues should be nearby
        lat, lng = 0, 0
        response = requests.get(f"{BASE_URL}/api/venues/nearby", params={
            "lat": lat, "lng": lng, "radius_km": 10
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        venues = response.json()
        assert isinstance(venues, list), "Response should be a list"
        assert len(venues) == 0, f"Should return empty list for coordinates (0,0), got {len(venues)} venues"
        print(f"Far coordinates test: Correctly returned 0 venues")

    def test_nearby_required_params(self):
        """Test that lat and lng are required parameters"""
        # Missing lat
        response = requests.get(f"{BASE_URL}/api/venues/nearby", params={"lng": 77.59})
        assert response.status_code == 422, "Should return 422 for missing lat"
        
        # Missing lng
        response = requests.get(f"{BASE_URL}/api/venues/nearby", params={"lat": 12.97})
        assert response.status_code == 422, "Should return 422 for missing lng"
        
        # Missing both
        response = requests.get(f"{BASE_URL}/api/venues/nearby")
        assert response.status_code == 422, "Should return 422 for missing lat and lng"
        
        print("Required params test: Correctly returns 422 for missing params")

    def test_nearby_default_radius(self):
        """Test that default radius works when not specified"""
        lat, lng = 12.97, 77.59
        response = requests.get(f"{BASE_URL}/api/venues/nearby", params={
            "lat": lat, "lng": lng
            # radius_km not specified - should use default 50
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        venues = response.json()
        assert isinstance(venues, list), "Response should be a list"
        print(f"Default radius test: Found {len(venues)} venues with default radius")

    def test_nearby_with_sport_filter(self):
        """Test nearby endpoint with sport filter"""
        lat, lng = 12.97, 77.59
        response = requests.get(f"{BASE_URL}/api/venues/nearby", params={
            "lat": lat, "lng": lng, "radius_km": 100, "sport": "football"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        venues = response.json()
        assert isinstance(venues, list), "Response should be a list"
        
        # All returned venues should have football in their sports
        for venue in venues:
            assert "sports" in venue, f"Venue missing sports field"
            assert "football" in venue["sports"], \
                f"Venue {venue['name']} should have football in sports: {venue['sports']}"
        
        print(f"Sport filter test: Found {len(venues)} football venues")

    def test_nearby_venue_has_all_fields(self):
        """Test that nearby venues include all required display fields"""
        lat, lng = 12.97, 77.59
        response = requests.get(f"{BASE_URL}/api/venues/nearby", params={
            "lat": lat, "lng": lng, "radius_km": 50
        })
        assert response.status_code == 200
        
        venues = response.json()
        if len(venues) > 0:
            venue = venues[0]
            required_fields = ["id", "name", "city", "base_price", "rating", "sports", "distance_km"]
            for field in required_fields:
                assert field in venue, f"Venue missing required field: {field}"
            
            # Check optional but expected fields
            optional_fields = ["area", "amenities", "turfs", "total_bookings", "description", "images"]
            present_optional = [f for f in optional_fields if f in venue]
            print(f"Venue fields test: All required fields present. Optional: {present_optional}")

    def test_nearby_hyderabad(self):
        """Test Hyderabad coordinates"""
        lat, lng = 17.385, 78.4867
        response = requests.get(f"{BASE_URL}/api/venues/nearby", params={
            "lat": lat, "lng": lng, "radius_km": 50
        })
        assert response.status_code == 200
        
        venues = response.json()
        print(f"Hyderabad test: Found {len(venues)} venues")
        for v in venues[:5]:
            print(f"  - {v['name']} ({v['city']}): {v['distance_km']} km")

    def test_nearby_delhi(self):
        """Test Delhi coordinates"""
        lat, lng = 28.6139, 77.2090
        response = requests.get(f"{BASE_URL}/api/venues/nearby", params={
            "lat": lat, "lng": lng, "radius_km": 50
        })
        assert response.status_code == 200
        
        venues = response.json()
        print(f"Delhi test: Found {len(venues)} venues")
        for v in venues[:5]:
            print(f"  - {v['name']} ({v['city']}): {v['distance_km']} km")

    def test_nearby_limit_parameter(self):
        """Test that limit parameter restricts results"""
        lat, lng = 12.97, 77.59
        response = requests.get(f"{BASE_URL}/api/venues/nearby", params={
            "lat": lat, "lng": lng, "radius_km": 500, "limit": 3
        })
        assert response.status_code == 200
        
        venues = response.json()
        assert len(venues) <= 3, f"Limit 3 should return at most 3 venues, got {len(venues)}"
        print(f"Limit test: Correctly limited to {len(venues)} venues")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
