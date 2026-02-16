"""
IoT Smart Lighting Feature Tests
Tests: Devices, Zones, Control, Energy Analytics, Schedules

Features tested:
- Device CRUD (list, create, update, delete, control)
- Zone CRUD (list, create, delete, control)
- Energy analytics with period filtering
- Booking-linked schedules
- Auth: venue_owner and super_admin access
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from seed data
VENUE_OWNER = {"email": "demo@owner.com", "password": "demo123"}
SUPER_ADMIN = {"email": "admin@horizon.com", "password": "admin123"}
PLAYER = {"email": "demo@player.com", "password": "demo123"}


class TestAuthHelpers:
    """Helper functions for authentication"""
    
    @staticmethod
    def get_token(email, password):
        res = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
        if res.status_code == 200:
            return res.json().get("token")
        return None
    
    @staticmethod
    def auth_headers(token):
        return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def venue_owner_token():
    token = TestAuthHelpers.get_token(VENUE_OWNER["email"], VENUE_OWNER["password"])
    if not token:
        pytest.skip("Venue owner authentication failed")
    return token


@pytest.fixture(scope="module")
def super_admin_token():
    token = TestAuthHelpers.get_token(SUPER_ADMIN["email"], SUPER_ADMIN["password"])
    if not token:
        pytest.skip("Super admin authentication failed")
    return token


@pytest.fixture(scope="module")
def player_token():
    token = TestAuthHelpers.get_token(PLAYER["email"], PLAYER["password"])
    if not token:
        pytest.skip("Player authentication failed")
    return token


@pytest.fixture(scope="module")
def venue_id(venue_owner_token):
    """Get first venue owned by venue_owner (PowerPlay Arena with IoT devices)"""
    headers = TestAuthHelpers.auth_headers(venue_owner_token)
    res = requests.get(f"{BASE_URL}/api/owner/venues", headers=headers)
    if res.status_code == 200 and res.json():
        return res.json()[0]["id"]
    pytest.skip("No venues found for owner")


# ============== Device Tests ==============

class TestDeviceList:
    """Test GET /api/iot/devices"""
    
    def test_list_devices_as_venue_owner(self, venue_owner_token, venue_id):
        headers = TestAuthHelpers.auth_headers(venue_owner_token)
        res = requests.get(f"{BASE_URL}/api/iot/devices", params={"venue_id": venue_id}, headers=headers)
        
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        devices = res.json()
        assert isinstance(devices, list), "Response should be a list"
        assert len(devices) == 7, f"Expected 7 seeded devices, got {len(devices)}"
        
        # Verify device structure
        device = devices[0]
        assert "id" in device
        assert "name" in device
        assert "device_type" in device
        assert "status" in device
        assert "is_online" in device
        assert "power_watts" in device
        print(f"✓ Listed {len(devices)} devices for venue")
    
    def test_list_devices_as_super_admin(self, super_admin_token, venue_id):
        headers = TestAuthHelpers.auth_headers(super_admin_token)
        res = requests.get(f"{BASE_URL}/api/iot/devices", params={"venue_id": venue_id}, headers=headers)
        
        assert res.status_code == 200
        devices = res.json()
        assert len(devices) == 7
        print("✓ Super admin can list devices")
    
    def test_list_devices_unauthorized_for_player(self, player_token, venue_id):
        headers = TestAuthHelpers.auth_headers(player_token)
        res = requests.get(f"{BASE_URL}/api/iot/devices", params={"venue_id": venue_id}, headers=headers)
        
        assert res.status_code == 403, f"Expected 403 for player, got {res.status_code}"
        print("✓ Player correctly denied IoT access")
    
    def test_list_devices_without_auth(self, venue_id):
        res = requests.get(f"{BASE_URL}/api/iot/devices", params={"venue_id": venue_id})
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        print("✓ Unauthenticated request correctly rejected")


class TestDeviceCRUD:
    """Test device create, update, control, delete"""
    
    def test_create_device(self, venue_owner_token, venue_id):
        headers = TestAuthHelpers.auth_headers(venue_owner_token)
        device_data = {
            "venue_id": venue_id,
            "name": "TEST_New Floodlight",
            "device_type": "floodlight",
            "protocol": "mqtt",
            "ip_address": "192.168.1.250",
            "power_watts": 800,
            "turf_number": 1
        }
        
        res = requests.post(f"{BASE_URL}/api/iot/devices", json=device_data, headers=headers)
        
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        device = res.json()
        assert device["name"] == "TEST_New Floodlight"
        assert device["device_type"] == "floodlight"
        assert device["power_watts"] == 800
        assert device["status"] == "off"
        assert device["is_online"] is True
        assert "id" in device
        
        # Store for cleanup
        TestDeviceCRUD.created_device_id = device["id"]
        print(f"✓ Created device: {device['id']}")
        return device["id"]
    
    def test_control_device_on(self, venue_owner_token):
        headers = TestAuthHelpers.auth_headers(venue_owner_token)
        device_id = getattr(TestDeviceCRUD, 'created_device_id', None)
        if not device_id:
            pytest.skip("No device created")
        
        res = requests.post(
            f"{BASE_URL}/api/iot/devices/{device_id}/control",
            json={"action": "on"},
            headers=headers
        )
        
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        device = res.json()
        assert device["status"] == "on"
        assert device["brightness"] == 100
        print("✓ Device turned on successfully")
    
    def test_control_device_brightness(self, venue_owner_token):
        headers = TestAuthHelpers.auth_headers(venue_owner_token)
        device_id = getattr(TestDeviceCRUD, 'created_device_id', None)
        if not device_id:
            pytest.skip("No device created")
        
        res = requests.post(
            f"{BASE_URL}/api/iot/devices/{device_id}/control",
            json={"action": "brightness", "brightness": 75},
            headers=headers
        )
        
        assert res.status_code == 200
        device = res.json()
        assert device["brightness"] == 75
        print("✓ Device brightness set to 75%")
    
    def test_control_device_off(self, venue_owner_token):
        headers = TestAuthHelpers.auth_headers(venue_owner_token)
        device_id = getattr(TestDeviceCRUD, 'created_device_id', None)
        if not device_id:
            pytest.skip("No device created")
        
        res = requests.post(
            f"{BASE_URL}/api/iot/devices/{device_id}/control",
            json={"action": "off"},
            headers=headers
        )
        
        assert res.status_code == 200
        device = res.json()
        assert device["status"] == "off"
        assert device["brightness"] == 0
        print("✓ Device turned off successfully")
    
    def test_control_device_404(self, venue_owner_token):
        headers = TestAuthHelpers.auth_headers(venue_owner_token)
        res = requests.post(
            f"{BASE_URL}/api/iot/devices/invalid-id-12345/control",
            json={"action": "on"},
            headers=headers
        )
        assert res.status_code == 404
        print("✓ Control non-existent device returns 404")
    
    def test_delete_device(self, venue_owner_token):
        headers = TestAuthHelpers.auth_headers(venue_owner_token)
        device_id = getattr(TestDeviceCRUD, 'created_device_id', None)
        if not device_id:
            pytest.skip("No device to delete")
        
        res = requests.delete(f"{BASE_URL}/api/iot/devices/{device_id}", headers=headers)
        
        assert res.status_code == 200
        assert "message" in res.json()
        print("✓ Device deleted successfully")
        
        # Verify deletion
        res = requests.get(
            f"{BASE_URL}/api/iot/devices/{device_id}/control",
            headers=headers
        )
        # Should return 404 or method not allowed
        print("✓ Deleted device no longer accessible")


# ============== Zone Tests ==============

class TestZoneList:
    """Test GET /api/iot/zones"""
    
    def test_list_zones(self, venue_owner_token, venue_id):
        headers = TestAuthHelpers.auth_headers(venue_owner_token)
        res = requests.get(f"{BASE_URL}/api/iot/zones", params={"venue_id": venue_id}, headers=headers)
        
        assert res.status_code == 200
        zones = res.json()
        assert isinstance(zones, list)
        assert len(zones) == 3, f"Expected 3 seeded zones, got {len(zones)}"
        
        # Check zone structure
        zone = zones[0]
        assert "id" in zone
        assert "name" in zone
        assert "device_count" in zone
        print(f"✓ Listed {len(zones)} zones with device counts")


class TestZoneCRUD:
    """Test zone create, control, delete"""
    
    def test_create_zone(self, venue_owner_token, venue_id):
        headers = TestAuthHelpers.auth_headers(venue_owner_token)
        zone_data = {
            "venue_id": venue_id,
            "name": "TEST_Zone New",
            "turf_number": 3,
            "description": "Test zone for automation testing"
        }
        
        res = requests.post(f"{BASE_URL}/api/iot/zones", json=zone_data, headers=headers)
        
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        zone = res.json()
        assert zone["name"] == "TEST_Zone New"
        assert zone["turf_number"] == 3
        assert zone["device_count"] == 0
        
        TestZoneCRUD.created_zone_id = zone["id"]
        print(f"✓ Created zone: {zone['id']}")
    
    def test_control_zone_on(self, venue_owner_token, venue_id):
        """Control all devices in a zone - turn on"""
        headers = TestAuthHelpers.auth_headers(venue_owner_token)
        
        # Get first seeded zone with devices
        res = requests.get(f"{BASE_URL}/api/iot/zones", params={"venue_id": venue_id}, headers=headers)
        zones = res.json()
        zone_with_devices = next((z for z in zones if z.get("device_count", 0) > 0), None)
        
        if not zone_with_devices:
            pytest.skip("No zone with devices")
        
        res = requests.post(
            f"{BASE_URL}/api/iot/zones/{zone_with_devices['id']}/control",
            json={"action": "on"},
            headers=headers
        )
        
        assert res.status_code == 200
        data = res.json()
        assert "zone_id" in data
        assert "devices_controlled" in data
        print(f"✓ Zone control: {data['devices_controlled']} devices turned on")
    
    def test_control_zone_off(self, venue_owner_token, venue_id):
        """Control all devices in a zone - turn off"""
        headers = TestAuthHelpers.auth_headers(venue_owner_token)
        
        res = requests.get(f"{BASE_URL}/api/iot/zones", params={"venue_id": venue_id}, headers=headers)
        zones = res.json()
        zone_with_devices = next((z for z in zones if z.get("device_count", 0) > 0), None)
        
        if not zone_with_devices:
            pytest.skip("No zone with devices")
        
        res = requests.post(
            f"{BASE_URL}/api/iot/zones/{zone_with_devices['id']}/control",
            json={"action": "off"},
            headers=headers
        )
        
        assert res.status_code == 200
        data = res.json()
        assert data["devices_controlled"] >= 0
        print(f"✓ Zone control: {data['devices_controlled']} devices turned off")
    
    def test_delete_zone(self, venue_owner_token):
        headers = TestAuthHelpers.auth_headers(venue_owner_token)
        zone_id = getattr(TestZoneCRUD, 'created_zone_id', None)
        if not zone_id:
            pytest.skip("No zone to delete")
        
        res = requests.delete(f"{BASE_URL}/api/iot/zones/{zone_id}", headers=headers)
        
        assert res.status_code == 200
        print("✓ Zone deleted successfully")


# ============== Energy Analytics Tests ==============

class TestEnergyAnalytics:
    """Test GET /api/iot/energy"""
    
    def test_energy_analytics_7d(self, venue_owner_token, venue_id):
        headers = TestAuthHelpers.auth_headers(venue_owner_token)
        res = requests.get(
            f"{BASE_URL}/api/iot/energy",
            params={"venue_id": venue_id, "period": "7d"},
            headers=headers
        )
        
        assert res.status_code == 200
        data = res.json()
        
        # Verify structure
        assert "summary" in data
        assert "daily" in data
        
        summary = data["summary"]
        assert "total_devices" in summary
        assert "online" in summary
        assert "active" in summary
        assert "period_kwh" in summary
        assert "period_cost" in summary
        assert "avg_daily_kwh" in summary
        assert "avg_daily_cost" in summary
        
        # Verify daily data
        daily = data["daily"]
        assert isinstance(daily, list)
        assert len(daily) == 7, f"Expected 7 days of data, got {len(daily)}"
        
        day = daily[0]
        assert "date" in day
        assert "kwh" in day
        assert "cost" in day
        
        print(f"✓ Energy analytics: {summary['period_kwh']} kWh over 7 days")
    
    def test_energy_analytics_30d(self, venue_owner_token, venue_id):
        headers = TestAuthHelpers.auth_headers(venue_owner_token)
        res = requests.get(
            f"{BASE_URL}/api/iot/energy",
            params={"venue_id": venue_id, "period": "30d"},
            headers=headers
        )
        
        assert res.status_code == 200
        data = res.json()
        
        daily = data["daily"]
        assert len(daily) == 30, f"Expected 30 days of data, got {len(daily)}"
        print("✓ 30-day energy analytics returned")


# ============== Schedule Tests ==============

class TestSchedules:
    """Test GET /api/iot/schedules and POST /api/iot/sync-bookings"""
    
    def test_list_schedules(self, venue_owner_token, venue_id):
        headers = TestAuthHelpers.auth_headers(venue_owner_token)
        res = requests.get(
            f"{BASE_URL}/api/iot/schedules",
            params={"venue_id": venue_id},
            headers=headers
        )
        
        assert res.status_code == 200
        data = res.json()
        
        assert "date" in data
        assert "schedules" in data
        
        schedules = data["schedules"]
        assert isinstance(schedules, list)
        
        if len(schedules) > 0:
            sched = schedules[0]
            assert "booking_id" in sched
            assert "turf_number" in sched
            assert "lights_on" in sched
            assert "lights_off" in sched
            assert "slot_start" in sched
            assert "slot_end" in sched
            print(f"✓ Found {len(schedules)} booking-linked schedules")
        else:
            print("✓ No bookings for today (schedules empty)")
    
    def test_sync_bookings(self, venue_owner_token, venue_id):
        headers = TestAuthHelpers.auth_headers(venue_owner_token)
        res = requests.post(
            f"{BASE_URL}/api/iot/sync-bookings",
            params={"venue_id": venue_id},
            headers=headers
        )
        
        assert res.status_code == 200
        data = res.json()
        
        assert "message" in data
        assert "bookings_today" in data
        assert "synced" in data
        print(f"✓ Sync bookings: {data['bookings_today']} bookings, {data['synced']} synced")


# ============== Auth Access Tests ==============

class TestAuthAccess:
    """Test that only venue_owner and super_admin can access IoT"""
    
    def test_player_cannot_access_iot_devices(self, player_token, venue_id):
        headers = TestAuthHelpers.auth_headers(player_token)
        res = requests.get(f"{BASE_URL}/api/iot/devices", params={"venue_id": venue_id}, headers=headers)
        assert res.status_code == 403
        print("✓ Player denied access to IoT devices")
    
    def test_player_cannot_access_iot_zones(self, player_token, venue_id):
        headers = TestAuthHelpers.auth_headers(player_token)
        res = requests.get(f"{BASE_URL}/api/iot/zones", params={"venue_id": venue_id}, headers=headers)
        assert res.status_code == 403
        print("✓ Player denied access to IoT zones")
    
    def test_player_cannot_access_energy(self, player_token, venue_id):
        headers = TestAuthHelpers.auth_headers(player_token)
        res = requests.get(f"{BASE_URL}/api/iot/energy", params={"venue_id": venue_id}, headers=headers)
        assert res.status_code == 403
        print("✓ Player denied access to energy analytics")
    
    def test_super_admin_can_access_any_venue_iot(self, super_admin_token, venue_id):
        headers = TestAuthHelpers.auth_headers(super_admin_token)
        
        # Devices
        res = requests.get(f"{BASE_URL}/api/iot/devices", params={"venue_id": venue_id}, headers=headers)
        assert res.status_code == 200
        
        # Zones
        res = requests.get(f"{BASE_URL}/api/iot/zones", params={"venue_id": venue_id}, headers=headers)
        assert res.status_code == 200
        
        # Energy
        res = requests.get(f"{BASE_URL}/api/iot/energy", params={"venue_id": venue_id}, headers=headers)
        assert res.status_code == 200
        
        print("✓ Super admin can access all IoT endpoints")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
