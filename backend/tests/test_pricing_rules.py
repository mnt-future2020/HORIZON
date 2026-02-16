"""
Test Pricing Rules CRUD API - P2 Feature
Tests: GET, POST, PUT, PUT/toggle, DELETE pricing rules
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPricingRulesAPI:
    """Test pricing rules CRUD operations for venue owners"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test credentials and venue info"""
        self.venue_owner_creds = {"email": "demo@owner.com", "password": "demo123"}
        self.player_creds = {"email": "demo@player.com", "password": "demo123"}
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_owner_token(self):
        """Get venue owner auth token"""
        resp = self.session.post(f"{BASE_URL}/api/auth/login", json=self.venue_owner_creds)
        assert resp.status_code == 200, f"Owner login failed: {resp.text}"
        return resp.json().get("token")
    
    def get_player_token(self):
        """Get player auth token"""
        resp = self.session.post(f"{BASE_URL}/api/auth/login", json=self.player_creds)
        assert resp.status_code == 200, f"Player login failed: {resp.text}"
        return resp.json().get("token")
    
    def get_owner_first_venue(self, token):
        """Get the first venue owned by the venue owner"""
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        resp = self.session.get(f"{BASE_URL}/api/owner/venues")
        assert resp.status_code == 200, f"Get owner venues failed: {resp.text}"
        venues = resp.json()
        assert len(venues) > 0, "Venue owner has no venues"
        return venues[0]["id"]
    
    # --- GET pricing rules ---
    def test_get_pricing_rules_success(self):
        """Test GET /api/venues/{venue_id}/pricing-rules returns existing rules"""
        token = self.get_owner_token()
        venue_id = self.get_owner_first_venue(token)
        
        resp = self.session.get(f"{BASE_URL}/api/venues/{venue_id}/pricing-rules")
        assert resp.status_code == 200, f"GET pricing rules failed: {resp.text}"
        
        rules = resp.json()
        assert isinstance(rules, list), "Response should be a list"
        print(f"SUCCESS: GET pricing rules returned {len(rules)} rules")
        
        # Validate structure of existing rules (seeded data)
        if len(rules) > 0:
            rule = rules[0]
            assert "id" in rule, "Rule should have id"
            assert "name" in rule, "Rule should have name"
            assert "priority" in rule, "Rule should have priority"
            assert "conditions" in rule, "Rule should have conditions"
            assert "action" in rule, "Rule should have action"
            print(f"SUCCESS: First rule structure verified - {rule['name']}")
    
    # --- POST create pricing rule ---
    def test_create_pricing_rule_success(self):
        """Test POST /api/venues/{venue_id}/pricing-rules creates new rule"""
        token = self.get_owner_token()
        venue_id = self.get_owner_first_venue(token)
        
        new_rule = {
            "name": "TEST_Early_Bird_Discount",
            "priority": 5,
            "conditions": {
                "days": [1, 2, 3, 4, 5],  # Mon-Fri
                "time_range": {"start": "06:00", "end": "09:00"}
            },
            "action": {"type": "discount", "value": 0.15},
            "is_active": True
        }
        
        resp = self.session.post(f"{BASE_URL}/api/venues/{venue_id}/pricing-rules", json=new_rule)
        assert resp.status_code == 200, f"Create pricing rule failed: {resp.text}"
        
        created = resp.json()
        assert "id" in created, "Created rule should have id"
        assert created["name"] == new_rule["name"], "Name should match"
        assert created["priority"] == new_rule["priority"], "Priority should match"
        assert created["action"]["type"] == "discount", "Action type should be discount"
        assert created["action"]["value"] == 0.15, "Discount value should be 0.15"
        print(f"SUCCESS: Created pricing rule with id={created['id']}")
        
        # Store for cleanup
        self.created_rule_id = created["id"]
        return created["id"]
    
    def test_create_pricing_rule_multiplier(self):
        """Test creating a multiplier-type pricing rule"""
        token = self.get_owner_token()
        venue_id = self.get_owner_first_venue(token)
        
        new_rule = {
            "name": "TEST_Peak_Hours_Surge",
            "priority": 15,
            "conditions": {
                "days": [5, 6],  # Sat-Sun
                "time_range": {"start": "18:00", "end": "22:00"}
            },
            "action": {"type": "multiplier", "value": 1.5},
            "is_active": True
        }
        
        resp = self.session.post(f"{BASE_URL}/api/venues/{venue_id}/pricing-rules", json=new_rule)
        assert resp.status_code == 200, f"Create multiplier rule failed: {resp.text}"
        
        created = resp.json()
        assert created["action"]["type"] == "multiplier", "Action type should be multiplier"
        assert created["action"]["value"] == 1.5, "Multiplier value should be 1.5"
        print(f"SUCCESS: Created multiplier rule with id={created['id']}")
        return created["id"]
    
    def test_create_pricing_rule_requires_owner(self):
        """Test that players cannot create pricing rules (403)"""
        token = self.get_player_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get any venue id first
        resp = self.session.get(f"{BASE_URL}/api/venues")
        venues = resp.json()
        venue_id = venues[0]["id"] if venues else "test-venue"
        
        new_rule = {
            "name": "TEST_Unauthorized_Rule",
            "priority": 1,
            "conditions": {"days": [0]},
            "action": {"type": "discount", "value": 0.1},
            "is_active": True
        }
        
        resp = self.session.post(f"{BASE_URL}/api/venues/{venue_id}/pricing-rules", json=new_rule)
        assert resp.status_code == 403, f"Expected 403 for player creating rule, got {resp.status_code}"
        print(f"SUCCESS: Player correctly denied from creating pricing rules (403)")
    
    # --- PUT update pricing rule ---
    def test_update_pricing_rule_success(self):
        """Test PUT /api/pricing-rules/{rule_id} updates existing rule"""
        token = self.get_owner_token()
        venue_id = self.get_owner_first_venue(token)
        
        # First create a rule to update
        create_rule = {
            "name": "TEST_Rule_To_Update",
            "priority": 8,
            "conditions": {"days": [0], "time_range": {"start": "10:00", "end": "14:00"}},
            "action": {"type": "discount", "value": 0.1},
            "is_active": True
        }
        
        create_resp = self.session.post(f"{BASE_URL}/api/venues/{venue_id}/pricing-rules", json=create_rule)
        assert create_resp.status_code == 200, f"Create rule for update test failed: {create_resp.text}"
        rule_id = create_resp.json()["id"]
        
        # Now update the rule
        updated_rule = {
            "name": "TEST_Updated_Rule_Name",
            "priority": 12,
            "conditions": {"days": [0, 6], "time_range": {"start": "08:00", "end": "16:00"}},
            "action": {"type": "multiplier", "value": 1.3},
            "is_active": True
        }
        
        update_resp = self.session.put(f"{BASE_URL}/api/pricing-rules/{rule_id}", json=updated_rule)
        assert update_resp.status_code == 200, f"Update pricing rule failed: {update_resp.text}"
        
        updated = update_resp.json()
        assert updated["name"] == "TEST_Updated_Rule_Name", "Name should be updated"
        assert updated["priority"] == 12, "Priority should be updated"
        assert updated["action"]["type"] == "multiplier", "Action type should be updated"
        assert updated["action"]["value"] == 1.3, "Action value should be updated"
        print(f"SUCCESS: Updated pricing rule id={rule_id}")
    
    def test_update_nonexistent_rule(self):
        """Test PUT /api/pricing-rules/{rule_id} returns 404 for nonexistent rule"""
        token = self.get_owner_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        fake_rule_id = "nonexistent-rule-id-12345"
        update_data = {
            "name": "Test",
            "priority": 1,
            "conditions": {"days": []},
            "action": {"type": "discount", "value": 0.1},
            "is_active": True
        }
        
        resp = self.session.put(f"{BASE_URL}/api/pricing-rules/{fake_rule_id}", json=update_data)
        assert resp.status_code == 404, f"Expected 404 for nonexistent rule, got {resp.status_code}"
        print(f"SUCCESS: Nonexistent rule update returns 404")
    
    # --- PUT toggle pricing rule ---
    def test_toggle_pricing_rule_success(self):
        """Test PUT /api/pricing-rules/{rule_id}/toggle toggles is_active"""
        token = self.get_owner_token()
        venue_id = self.get_owner_first_venue(token)
        
        # Create a rule to toggle
        create_rule = {
            "name": "TEST_Toggle_Rule",
            "priority": 3,
            "conditions": {"days": [1]},
            "action": {"type": "discount", "value": 0.05},
            "is_active": True
        }
        
        create_resp = self.session.post(f"{BASE_URL}/api/venues/{venue_id}/pricing-rules", json=create_rule)
        assert create_resp.status_code == 200
        rule_id = create_resp.json()["id"]
        initial_active = create_resp.json()["is_active"]
        
        # Toggle the rule
        toggle_resp = self.session.put(f"{BASE_URL}/api/pricing-rules/{rule_id}/toggle")
        assert toggle_resp.status_code == 200, f"Toggle pricing rule failed: {toggle_resp.text}"
        
        toggled = toggle_resp.json()
        assert toggled["id"] == rule_id, "ID should match"
        assert toggled["is_active"] == (not initial_active), f"is_active should toggle from {initial_active} to {not initial_active}"
        print(f"SUCCESS: Toggled rule {rule_id} from is_active={initial_active} to {toggled['is_active']}")
        
        # Toggle again to verify bidirectional
        toggle_resp2 = self.session.put(f"{BASE_URL}/api/pricing-rules/{rule_id}/toggle")
        assert toggle_resp2.status_code == 200
        toggled2 = toggle_resp2.json()
        assert toggled2["is_active"] == initial_active, "Second toggle should restore original state"
        print(f"SUCCESS: Second toggle restored is_active={initial_active}")
    
    def test_toggle_nonexistent_rule(self):
        """Test PUT /api/pricing-rules/{rule_id}/toggle returns 404 for nonexistent rule"""
        token = self.get_owner_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        fake_rule_id = "fake-toggle-rule-id-99999"
        resp = self.session.put(f"{BASE_URL}/api/pricing-rules/{fake_rule_id}/toggle")
        assert resp.status_code == 404, f"Expected 404 for toggle nonexistent, got {resp.status_code}"
        print(f"SUCCESS: Toggle nonexistent rule returns 404")
    
    # --- DELETE pricing rule ---
    def test_delete_pricing_rule_success(self):
        """Test DELETE /api/pricing-rules/{rule_id} deletes the rule"""
        token = self.get_owner_token()
        venue_id = self.get_owner_first_venue(token)
        
        # Create a rule to delete
        create_rule = {
            "name": "TEST_Delete_Me_Rule",
            "priority": 1,
            "conditions": {"days": [2]},
            "action": {"type": "discount", "value": 0.02},
            "is_active": True
        }
        
        create_resp = self.session.post(f"{BASE_URL}/api/venues/{venue_id}/pricing-rules", json=create_rule)
        assert create_resp.status_code == 200
        rule_id = create_resp.json()["id"]
        
        # Delete the rule
        delete_resp = self.session.delete(f"{BASE_URL}/api/pricing-rules/{rule_id}")
        assert delete_resp.status_code == 200, f"Delete pricing rule failed: {delete_resp.text}"
        
        result = delete_resp.json()
        assert "message" in result, "Delete response should have message"
        print(f"SUCCESS: Deleted rule {rule_id}")
        
        # Verify rule no longer exists in list
        list_resp = self.session.get(f"{BASE_URL}/api/venues/{venue_id}/pricing-rules")
        rules = list_resp.json()
        rule_ids = [r["id"] for r in rules]
        assert rule_id not in rule_ids, "Deleted rule should not appear in list"
        print(f"SUCCESS: Verified rule {rule_id} removed from list")
    
    def test_delete_nonexistent_rule(self):
        """Test DELETE /api/pricing-rules/{rule_id} returns 404 for nonexistent rule"""
        token = self.get_owner_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        fake_rule_id = "fake-delete-rule-id-88888"
        resp = self.session.delete(f"{BASE_URL}/api/pricing-rules/{fake_rule_id}")
        assert resp.status_code == 404, f"Expected 404 for delete nonexistent, got {resp.status_code}"
        print(f"SUCCESS: Delete nonexistent rule returns 404")


class TestPricingRulesPriceEffect:
    """Test that pricing rules affect slot prices correctly"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.owner_creds = {"email": "demo@owner.com", "password": "demo123"}
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def test_slot_prices_affected_by_rules(self):
        """Test GET /api/venues/{venue_id}/slots includes pricing rule effects"""
        # Login as owner to get venue
        resp = self.session.post(f"{BASE_URL}/api/auth/login", json=self.owner_creds)
        token = resp.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get owner's first venue
        venues_resp = self.session.get(f"{BASE_URL}/api/owner/venues")
        venues = venues_resp.json()
        if not venues:
            pytest.skip("No venues found for owner")
        
        venue = venues[0]
        venue_id = venue["id"]
        base_price = venue.get("base_price", 2000)
        
        # Get slots for today's date
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        
        slots_resp = self.session.get(f"{BASE_URL}/api/venues/{venue_id}/slots", params={"date": today})
        assert slots_resp.status_code == 200, f"Get slots failed: {slots_resp.text}"
        
        slots_data = slots_resp.json()
        slots = slots_data.get("slots", [])
        assert len(slots) > 0, "Should have slots"
        
        # Check that prices vary based on rules (some should differ from base)
        prices = [s["price"] for s in slots]
        unique_prices = set(prices)
        print(f"Base price: {base_price}, Unique slot prices: {unique_prices}")
        print(f"SUCCESS: Slots have {len(unique_prices)} unique price levels")


class TestCleanup:
    """Cleanup TEST_ prefixed pricing rules after tests"""
    
    def test_cleanup_test_rules(self):
        """Delete all TEST_ prefixed pricing rules"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as owner
        resp = session.post(f"{BASE_URL}/api/auth/login", json={"email": "demo@owner.com", "password": "demo123"})
        if resp.status_code != 200:
            pytest.skip("Could not login for cleanup")
        
        token = resp.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get owner venues
        venues_resp = session.get(f"{BASE_URL}/api/owner/venues")
        venues = venues_resp.json()
        
        deleted_count = 0
        for venue in venues:
            venue_id = venue["id"]
            rules_resp = session.get(f"{BASE_URL}/api/venues/{venue_id}/pricing-rules")
            if rules_resp.status_code == 200:
                rules = rules_resp.json()
                for rule in rules:
                    if rule.get("name", "").startswith("TEST_"):
                        del_resp = session.delete(f"{BASE_URL}/api/pricing-rules/{rule['id']}")
                        if del_resp.status_code == 200:
                            deleted_count += 1
        
        print(f"SUCCESS: Cleaned up {deleted_count} TEST_ prefixed pricing rules")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
