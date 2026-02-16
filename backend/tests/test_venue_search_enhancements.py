"""
Test suite for Venue Search Enhancement features:
- /api/venues with filters (city, area, sport, search, price, amenity, sort)
- /api/venues/cities - List cities with venue counts
- /api/venues/areas - List areas (optionally filtered by city)
- /api/venues/amenities - List amenities with counts
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestVenueCitiesEndpoint:
    """Test /api/venues/cities endpoint"""
    
    def test_cities_returns_list_with_counts(self):
        """Should return cities with venue counts, sorted by count descending"""
        response = requests.get(f"{BASE_URL}/api/venues/cities")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Each city should have city name and count
        for city in data:
            assert "city" in city
            assert "count" in city
            assert isinstance(city["count"], int)
            assert city["count"] > 0
    
    def test_cities_includes_expected_cities(self):
        """Should include Bengaluru, Chennai, Mumbai, Hyderabad, Delhi"""
        response = requests.get(f"{BASE_URL}/api/venues/cities")
        data = response.json()
        
        city_names = [c["city"] for c in data]
        expected = ["Bengaluru", "Chennai", "Mumbai", "Hyderabad", "Delhi"]
        
        for expected_city in expected:
            assert expected_city in city_names, f"Expected {expected_city} in cities list"


class TestVenueAreasEndpoint:
    """Test /api/venues/areas endpoint"""
    
    def test_areas_returns_all_areas(self):
        """Should return all areas when no city filter"""
        response = requests.get(f"{BASE_URL}/api/venues/areas")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        for area in data:
            assert "area" in area
            assert "city" in area
            assert "count" in area
    
    def test_areas_filtered_by_city(self):
        """Should return areas only for specified city"""
        response = requests.get(f"{BASE_URL}/api/venues/areas", params={"city": "Chennai"})
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # All areas should be in Chennai
        for area in data:
            assert area["city"] == "Chennai"
        
        # Should include Chennai areas
        area_names = [a["area"] for a in data]
        chennai_areas = ["Adyar", "Velachery", "T Nagar", "OMR"]
        for expected_area in chennai_areas:
            assert expected_area in area_names, f"Expected {expected_area} in Chennai areas"


class TestVenueAmenitiesEndpoint:
    """Test /api/venues/amenities endpoint"""
    
    def test_amenities_returns_list_with_counts(self):
        """Should return amenities with venue counts"""
        response = requests.get(f"{BASE_URL}/api/venues/amenities")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        for amenity in data:
            assert "amenity" in amenity
            assert "count" in amenity
            assert isinstance(amenity["count"], int)
    
    def test_amenities_includes_common_amenities(self):
        """Should include common amenities like Parking, Floodlights"""
        response = requests.get(f"{BASE_URL}/api/venues/amenities")
        data = response.json()
        
        amenity_names = [a["amenity"] for a in data]
        expected = ["Parking", "Floodlights", "Cafe", "AC"]
        
        for expected_amenity in expected:
            assert expected_amenity in amenity_names


class TestVenueListFilters:
    """Test /api/venues with various filters"""
    
    def test_venues_list_default(self):
        """Should return venues sorted by rating (default)"""
        response = requests.get(f"{BASE_URL}/api/venues")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 16  # 16 venues in seed data
    
    def test_filter_by_city(self):
        """Should filter venues by city"""
        response = requests.get(f"{BASE_URL}/api/venues", params={"city": "Chennai"})
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 4  # 4 venues in Chennai
        
        for venue in data:
            assert venue["city"] == "Chennai"
    
    def test_filter_by_sport(self):
        """Should filter venues by sport"""
        response = requests.get(f"{BASE_URL}/api/venues", params={"sport": "football"})
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) > 0
        
        for venue in data:
            assert "football" in venue["sports"]
    
    def test_filter_by_city_and_sport(self):
        """Should filter venues by city AND sport"""
        response = requests.get(f"{BASE_URL}/api/venues", params={"city": "Mumbai", "sport": "football"})
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 2  # Only 2 football venues in Mumbai
        
        for venue in data:
            assert venue["city"] == "Mumbai"
            assert "football" in venue["sports"]
    
    def test_search_by_name(self):
        """Should search venues by name"""
        response = requests.get(f"{BASE_URL}/api/venues", params={"search": "PowerPlay"})
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 1
        assert "PowerPlay" in data[0]["name"]
    
    def test_search_by_area(self):
        """Should search venues by area"""
        response = requests.get(f"{BASE_URL}/api/venues", params={"search": "Koramangala"})
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) >= 1
        # Should find PowerPlay Arena in Koramangala
        found = any("Koramangala" in v.get("area", "") for v in data)
        assert found
    
    def test_search_by_city(self):
        """Should search venues by city name"""
        response = requests.get(f"{BASE_URL}/api/venues", params={"search": "Bengaluru"})
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 5  # 5 venues in Bengaluru
    
    def test_sort_by_price_low(self):
        """Should sort venues by price (ascending)"""
        response = requests.get(f"{BASE_URL}/api/venues", params={"sort_by": "price_low"})
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) > 0
        
        # Verify prices are in ascending order
        prices = [v["base_price"] for v in data]
        assert prices == sorted(prices)
    
    def test_sort_by_price_high(self):
        """Should sort venues by price (descending)"""
        response = requests.get(f"{BASE_URL}/api/venues", params={"sort_by": "price_high"})
        assert response.status_code == 200
        
        data = response.json()
        prices = [v["base_price"] for v in data]
        assert prices == sorted(prices, reverse=True)
    
    def test_sort_by_rating(self):
        """Should sort venues by rating (descending)"""
        response = requests.get(f"{BASE_URL}/api/venues", params={"sort_by": "rating"})
        assert response.status_code == 200
        
        data = response.json()
        ratings = [v["rating"] for v in data]
        assert ratings == sorted(ratings, reverse=True)
    
    def test_filter_by_amenity(self):
        """Should filter venues by amenity"""
        response = requests.get(f"{BASE_URL}/api/venues", params={"amenity": "AC"})
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) > 0
        
        for venue in data:
            assert "AC" in venue["amenities"]
    
    def test_filter_by_price_range(self):
        """Should filter venues by max price"""
        response = requests.get(f"{BASE_URL}/api/venues", params={"max_price": 1200})
        assert response.status_code == 200
        
        data = response.json()
        for venue in data:
            assert venue["base_price"] <= 1200
    
    def test_filter_by_min_price(self):
        """Should filter venues by min price"""
        response = requests.get(f"{BASE_URL}/api/venues", params={"min_price": 2500})
        assert response.status_code == 200
        
        data = response.json()
        for venue in data:
            assert venue["base_price"] >= 2500
    
    def test_combined_filters(self):
        """Should apply multiple filters together"""
        response = requests.get(f"{BASE_URL}/api/venues", params={
            "city": "Bengaluru",
            "sport": "football",
            "max_price": 2200,
            "sort_by": "price_low"
        })
        assert response.status_code == 200
        
        data = response.json()
        for venue in data:
            assert venue["city"] == "Bengaluru"
            assert "football" in venue["sports"]
            assert venue["base_price"] <= 2200


class TestVenueDataFields:
    """Test venue response includes area field and all required data"""
    
    def test_venue_has_area_field(self):
        """Each venue should have area field"""
        response = requests.get(f"{BASE_URL}/api/venues")
        data = response.json()
        
        for venue in data:
            assert "area" in venue, f"Venue {venue['name']} missing area field"
            # Area should be non-empty string
            assert isinstance(venue["area"], str)
            assert len(venue["area"]) > 0
    
    def test_venue_has_required_fields(self):
        """Each venue should have all required fields for display"""
        response = requests.get(f"{BASE_URL}/api/venues")
        data = response.json()
        
        required_fields = ["id", "name", "description", "city", "area", "sports", 
                          "base_price", "rating", "amenities", "images"]
        
        for venue in data:
            for field in required_fields:
                assert field in venue, f"Venue {venue.get('name', 'unknown')} missing {field}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
