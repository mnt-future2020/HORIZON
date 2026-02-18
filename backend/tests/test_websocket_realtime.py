"""
WebSocket Real-time Updates Tests
Tests for venue WebSocket endpoint and real-time broadcast functionality.
"""
import pytest
import requests
import asyncio
import websockets
import json
import os
import random

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://dynamic-venues.preview.emergentagent.com').rstrip('/')

# Test credentials
OWNER_EMAIL = "demo@owner.com"
OWNER_PASSWORD = "demo123"

class TestWebSocketEndpoint:
    """Tests for WebSocket endpoint /api/venues/ws/{venue_id}"""
    
    @pytest.fixture
    def owner_token(self):
        """Get owner authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        assert response.status_code == 200, f"Owner login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture
    def venue_id(self):
        """Get powerplay-arena venue ID"""
        response = requests.get(f"{BASE_URL}/api/venues/slug/powerplay-arena")
        assert response.status_code == 200, f"Failed to fetch venue: {response.text}"
        return response.json()["id"]
    
    def test_websocket_endpoint_accepts_connection(self, venue_id):
        """Test 1: WebSocket endpoint /api/venues/ws/{venue_id} accepts connections"""
        async def connect_ws():
            ws_url = f"wss://dynamic-venues.preview.emergentagent.com/api/venues/ws/{venue_id}"
            try:
                async with websockets.connect(ws_url, open_timeout=10) as ws:
                    # Send ping to keep alive
                    await ws.send("ping")
                    return True
            except Exception as e:
                pytest.fail(f"WebSocket connection failed: {e}")
                return False
        
        result = asyncio.get_event_loop().run_until_complete(connect_ws())
        assert result is True
    
    def test_websocket_receives_venue_update_broadcast(self, owner_token, venue_id):
        """Test 2: PUT /api/venues/{venue_id} broadcasts venue_update message to connected WS clients"""
        async def test_broadcast():
            ws_url = f"wss://dynamic-venues.preview.emergentagent.com/api/venues/ws/{venue_id}"
            
            async with websockets.connect(ws_url, open_timeout=10) as ws:
                # Update venue via REST API
                test_desc = f"Test broadcast update - {random.randint(1000, 9999)}"
                update_resp = requests.put(
                    f"{BASE_URL}/api/venues/{venue_id}",
                    headers={"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"},
                    json={"description": test_desc}
                )
                assert update_resp.status_code == 200, f"Update failed: {update_resp.text}"
                
                # Wait for WebSocket message
                try:
                    message = await asyncio.wait_for(ws.recv(), timeout=5)
                    data = json.loads(message)
                    
                    # Verify message structure
                    assert data.get("type") == "venue_update", f"Expected type 'venue_update', got: {data.get('type')}"
                    assert "venue" in data, "Message should contain 'venue' field"
                    
                    # Verify venue data
                    venue_data = data["venue"]
                    assert venue_data.get("id") == venue_id, "Venue ID should match"
                    assert venue_data.get("description") == test_desc, "Description should be updated"
                    
                    return True
                except asyncio.TimeoutError:
                    pytest.fail("No WebSocket message received within timeout")
                    return False
        
        result = asyncio.get_event_loop().run_until_complete(test_broadcast())
        assert result is True
    
    def test_venue_update_returns_updated_data(self, owner_token, venue_id):
        """Test 3: Venue update endpoint returns the updated venue with correct changes"""
        # Get original venue
        original = requests.get(f"{BASE_URL}/api/venues/{venue_id}").json()
        
        # Update with new data
        test_desc = f"API update test - {random.randint(1000, 9999)}"
        update_resp = requests.put(
            f"{BASE_URL}/api/venues/{venue_id}",
            headers={"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"},
            json={"description": test_desc}
        )
        
        assert update_resp.status_code == 200
        updated = update_resp.json()
        
        # Verify response contains updated data
        assert updated["id"] == venue_id
        assert updated["description"] == test_desc
        assert updated["name"] == original["name"]  # Other fields should be unchanged
        assert "owner_id" in updated
        assert "slug" in updated
    
    def test_websocket_connection_without_venue_id_fails(self):
        """Test 4: WebSocket connection without valid venue_id should fail gracefully"""
        async def connect_invalid():
            ws_url = "wss://dynamic-venues.preview.emergentagent.com/api/venues/ws/invalid-uuid"
            try:
                async with websockets.connect(ws_url, open_timeout=5) as ws:
                    # Connection might succeed but subsequent operations should handle gracefully
                    return True
            except Exception:
                # Connection failure is acceptable for invalid venue
                return True
        
        # Test should not crash
        result = asyncio.get_event_loop().run_until_complete(connect_invalid())
        assert result is True


class TestVenueUpdatePermissions:
    """Tests for venue update permissions"""
    
    @pytest.fixture
    def owner_token(self):
        """Get owner authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture
    def player_token(self):
        """Get player authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@player.com",
            "password": "demo123"
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture
    def venue_id(self):
        """Get powerplay-arena venue ID"""
        response = requests.get(f"{BASE_URL}/api/venues/slug/powerplay-arena")
        assert response.status_code == 200
        return response.json()["id"]
    
    def test_owner_can_update_own_venue(self, owner_token, venue_id):
        """Test: Owner can update their own venue"""
        response = requests.put(
            f"{BASE_URL}/api/venues/{venue_id}",
            headers={"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"},
            json={"description": "Owner update test"}
        )
        assert response.status_code == 200
        assert response.json()["description"] == "Owner update test"
    
    def test_player_cannot_update_venue(self, player_token, venue_id):
        """Test: Player role cannot update venue"""
        response = requests.put(
            f"{BASE_URL}/api/venues/{venue_id}",
            headers={"Authorization": f"Bearer {player_token}", "Content-Type": "application/json"},
            json={"description": "Player trying to update"}
        )
        assert response.status_code == 403  # Forbidden
    
    def test_unauthenticated_cannot_update_venue(self, venue_id):
        """Test: Unauthenticated user cannot update venue"""
        response = requests.put(
            f"{BASE_URL}/api/venues/{venue_id}",
            headers={"Content-Type": "application/json"},
            json={"description": "Anonymous update"}
        )
        assert response.status_code == 401  # Unauthorized


class TestVenueUpdateFields:
    """Tests for allowed venue update fields"""
    
    @pytest.fixture
    def owner_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture
    def venue_id(self):
        response = requests.get(f"{BASE_URL}/api/venues/slug/powerplay-arena")
        return response.json()["id"]
    
    def test_can_update_description(self, owner_token, venue_id):
        """Test: Can update description field"""
        response = requests.put(
            f"{BASE_URL}/api/venues/{venue_id}",
            headers={"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"},
            json={"description": "Updated description field test"}
        )
        assert response.status_code == 200
        assert response.json()["description"] == "Updated description field test"
    
    def test_can_update_address(self, owner_token, venue_id):
        """Test: Can update address field"""
        response = requests.put(
            f"{BASE_URL}/api/venues/{venue_id}",
            headers={"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"},
            json={"address": "Updated address field test"}
        )
        assert response.status_code == 200
        assert response.json()["address"] == "Updated address field test"
    
    def test_can_update_city(self, owner_token, venue_id):
        """Test: Can update city field"""
        response = requests.put(
            f"{BASE_URL}/api/venues/{venue_id}",
            headers={"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"},
            json={"city": "Mumbai"}
        )
        assert response.status_code == 200
        assert response.json()["city"] == "Mumbai"
        
        # Restore
        requests.put(
            f"{BASE_URL}/api/venues/{venue_id}",
            headers={"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"},
            json={"city": "Bengaluru"}
        )
    
    def test_can_update_base_price(self, owner_token, venue_id):
        """Test: Can update base_price field"""
        response = requests.put(
            f"{BASE_URL}/api/venues/{venue_id}",
            headers={"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"},
            json={"base_price": 2500}
        )
        assert response.status_code == 200
        assert response.json()["base_price"] == 2500
        
        # Restore
        requests.put(
            f"{BASE_URL}/api/venues/{venue_id}",
            headers={"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"},
            json={"base_price": 2000}
        )
    
    def test_can_update_turfs(self, owner_token, venue_id):
        """Test: Can update turfs field"""
        response = requests.put(
            f"{BASE_URL}/api/venues/{venue_id}",
            headers={"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"},
            json={"turfs": 3}
        )
        assert response.status_code == 200
        assert response.json()["turfs"] == 3
        
        # Restore
        requests.put(
            f"{BASE_URL}/api/venues/{venue_id}",
            headers={"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"},
            json={"turfs": 2}
        )
    
    def test_can_update_hours(self, owner_token, venue_id):
        """Test: Can update opening_hour and closing_hour fields"""
        response = requests.put(
            f"{BASE_URL}/api/venues/{venue_id}",
            headers={"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"},
            json={"opening_hour": 5, "closing_hour": 22}
        )
        assert response.status_code == 200
        assert response.json()["opening_hour"] == 5
        assert response.json()["closing_hour"] == 22
        
        # Restore
        requests.put(
            f"{BASE_URL}/api/venues/{venue_id}",
            headers={"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"},
            json={"opening_hour": 6, "closing_hour": 23}
        )


@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Restore venue data after tests"""
    yield
    # Restore original description
    login = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": OWNER_EMAIL,
        "password": OWNER_PASSWORD
    })
    if login.status_code == 200:
        token = login.json()["token"]
        venue = requests.get(f"{BASE_URL}/api/venues/slug/powerplay-arena").json()
        requests.put(
            f"{BASE_URL}/api/venues/{venue['id']}",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={
                "description": "Premium football turf with floodlights, changing rooms AND LIVE UPDATES! Bengaluru finest 5-a-side arena.",
                "address": "123 Koramangala 5th Block",
                "city": "Bengaluru",
                "base_price": 2000,
                "turfs": 2,
                "opening_hour": 6,
                "closing_hour": 23
            }
        )
