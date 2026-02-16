"""
Test Suite: Tamper-proof Rating History (Blockchain-style Chain Hashing)

Tests:
- GET /api/rating/history/{userId} - Rating history records with hashes
- GET /api/rating/verify/{userId} - Chain integrity verification
- GET /api/rating/certificate/{userId} - Rating certificate with journey stats
- Chain integrity validation - SHA-256 hash chain
- Match result flow creates rating_history records
"""
import pytest
import requests
import os
import hashlib
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

GENESIS_HASH = "GENESIS_0000000000000000000000000000000000000000000000000000000000000000"


def compute_record_hash(record: dict, prev_hash: str) -> str:
    """Compute SHA-256 hash of a rating history record - mirrors backend logic."""
    payload = (
        f"{record['user_id']}|{record['match_id']}|"
        f"{record['previous_rating']}|{record['new_rating']}|{record['delta']}|"
        f"{record['previous_rd']}|{record['new_rd']}|"
        f"{record['result']}|{record['team']}|"
        f"{record['timestamp']}|{prev_hash}"
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


@pytest.fixture(scope="session")
def player_token():
    """Authenticate as demo player."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "demo@player.com",
        "password": "demo123"
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("token"), data.get("user")
    pytest.fail(f"Player login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="session")
def coach_token():
    """Authenticate as demo coach."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "demo@coach.com",
        "password": "demo123"
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("token"), data.get("user")
    pytest.fail(f"Coach login failed: {response.status_code} - {response.text}")


@pytest.fixture
def player_headers(player_token):
    """Auth headers for player."""
    token, _ = player_token
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture
def coach_headers(coach_token):
    """Auth headers for coach."""
    token, _ = coach_token
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


class TestRatingHistoryEndpoint:
    """Tests for GET /api/rating/history/{userId}"""

    def test_history_requires_auth(self):
        """Rating history endpoint requires authentication."""
        response = requests.get(f"{BASE_URL}/api/rating/history/some-user-id")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Rating history requires authentication")

    def test_history_returns_records_for_user(self, player_headers, player_token):
        """History returns rating records with hash fields."""
        _, user = player_token
        user_id = user["id"]
        
        response = requests.get(f"{BASE_URL}/api/rating/history/{user_id}", headers=player_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "user" in data, "Response should contain 'user' field"
        assert "records" in data, "Response should contain 'records' field"
        assert "total_records" in data, "Response should contain 'total_records' field"
        
        # Verify user fields
        assert data["user"]["id"] == user_id
        assert "name" in data["user"]
        assert "skill_rating" in data["user"]
        print(f"PASS: History returns user with rating {data['user']['skill_rating']}")
        
        # Check record structure if records exist
        if data["records"]:
            record = data["records"][0]
            required_fields = [
                "user_id", "match_id", "seq", "previous_rating", "new_rating",
                "delta", "previous_rd", "new_rd", "result", "team",
                "opponent_snapshot", "confirmations", "timestamp",
                "prev_hash", "record_hash"
            ]
            for field in required_fields:
                assert field in record, f"Record missing field: {field}"
            print(f"PASS: Record has all required fields including record_hash and prev_hash")
        else:
            print("INFO: No records yet for this user")

    def test_history_user_not_found(self, player_headers):
        """History returns 404 for non-existent user."""
        response = requests.get(f"{BASE_URL}/api/rating/history/nonexistent-user-id", headers=player_headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: History returns 404 for nonexistent user")


class TestRatingVerifyEndpoint:
    """Tests for GET /api/rating/verify/{userId}"""

    def test_verify_requires_auth(self):
        """Verify endpoint requires authentication."""
        response = requests.get(f"{BASE_URL}/api/rating/verify/some-user-id")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Verify requires authentication")

    def test_verify_returns_chain_status(self, player_headers, player_token):
        """Verify returns chain integrity status."""
        _, user = player_token
        user_id = user["id"]
        
        response = requests.get(f"{BASE_URL}/api/rating/verify/{user_id}", headers=player_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Required fields in verification response
        required_fields = ["verified", "chain_intact", "current_rating", "total_records", "message"]
        for field in required_fields:
            assert field in data, f"Verify response missing field: {field}"
        
        # Chain should be intact (no tampering)
        assert data["chain_intact"] == True, f"Expected chain_intact=True, got {data['chain_intact']}"
        print(f"PASS: Verify returns chain_intact={data['chain_intact']}, verified={data['verified']}")
        print(f"INFO: Message: {data['message']}")
        
        if data["total_records"] > 0:
            assert "first_record_hash" in data
            assert "last_record_hash" in data
            print(f"PASS: Verify includes record hash summaries for {data['total_records']} records")

    def test_verify_user_not_found(self, player_headers):
        """Verify returns 404 for non-existent user."""
        response = requests.get(f"{BASE_URL}/api/rating/verify/nonexistent-user-id", headers=player_headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Verify returns 404 for nonexistent user")


class TestRatingCertificateEndpoint:
    """Tests for GET /api/rating/certificate/{userId}"""

    def test_certificate_requires_auth(self):
        """Certificate endpoint requires authentication."""
        response = requests.get(f"{BASE_URL}/api/rating/certificate/some-user-id")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Certificate requires authentication")

    def test_certificate_returns_full_data(self, player_headers, player_token):
        """Certificate returns player, verification, journey, and timeline."""
        _, user = player_token
        user_id = user["id"]
        
        response = requests.get(f"{BASE_URL}/api/rating/certificate/{user_id}", headers=player_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Check top-level sections
        assert "player" in data, "Certificate should have 'player' section"
        assert "verification" in data, "Certificate should have 'verification' section"
        assert "journey" in data, "Certificate should have 'journey' section"
        assert "timeline" in data, "Certificate should have 'timeline' section"
        
        # Player fields
        player = data["player"]
        assert player["id"] == user_id
        assert "name" in player
        assert "skill_rating" in player
        assert "tier" in player
        print(f"PASS: Certificate player section: {player['name']}, Rating: {player['skill_rating']}, Tier: {player['tier']}")
        
        # Verification fields
        verification = data["verification"]
        assert "chain_intact" in verification
        assert "rating_consistent" in verification
        assert "verified" in verification
        assert "chain_fingerprint" in verification
        print(f"PASS: Certificate verification: verified={verification['verified']}, fingerprint={verification['chain_fingerprint'][:16]}...")
        
        # Journey fields
        journey = data["journey"]
        journey_fields = ["peak_rating", "lowest_rating", "total_wins", "total_losses", "total_draws"]
        for field in journey_fields:
            assert field in journey, f"Journey missing field: {field}"
        print(f"PASS: Journey stats - Peak: {journey['peak_rating']}, Wins: {journey['total_wins']}, Losses: {journey['total_losses']}")
        
        # Timeline for chart
        assert isinstance(data["timeline"], list), "Timeline should be a list"
        if data["timeline"]:
            timeline_entry = data["timeline"][0]
            assert "seq" in timeline_entry
            assert "rating" in timeline_entry
            assert "delta" in timeline_entry
            assert "result" in timeline_entry
            print(f"PASS: Timeline has {len(data['timeline'])} entries for chart")

    def test_certificate_user_not_found(self, player_headers):
        """Certificate returns 404 for non-existent user."""
        response = requests.get(f"{BASE_URL}/api/rating/certificate/nonexistent-user-id", headers=player_headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Certificate returns 404 for nonexistent user")


class TestChainIntegrity:
    """Tests for SHA-256 hash chain integrity."""

    def test_chain_hash_validation(self, player_headers, player_token):
        """Verify that record hashes match when recomputed."""
        _, user = player_token
        user_id = user["id"]
        
        # Get history with all records
        response = requests.get(f"{BASE_URL}/api/rating/history/{user_id}?limit=100", headers=player_headers)
        assert response.status_code == 200
        
        records = response.json().get("records", [])
        if not records:
            print("INFO: No records to verify hash chain")
            return
        
        # Sort by seq to ensure order
        records_sorted = sorted(records, key=lambda r: r["seq"])
        
        prev_hash = GENESIS_HASH
        for record in records_sorted:
            # Verify prev_hash chain
            assert record["prev_hash"] == prev_hash, f"Record #{record['seq']} prev_hash mismatch! Expected {prev_hash[:16]}..., got {record['prev_hash'][:16]}..."
            
            # Recompute and verify record_hash
            expected_hash = compute_record_hash(record, prev_hash)
            assert record["record_hash"] == expected_hash, f"Record #{record['seq']} record_hash mismatch!"
            
            prev_hash = record["record_hash"]
        
        print(f"PASS: All {len(records_sorted)} records have valid hash chain")
        print(f"INFO: First record linked to GENESIS, last hash: {prev_hash[:16]}...")

    def test_first_record_has_genesis_prev_hash(self, player_headers, player_token):
        """First record should have prev_hash = GENESIS hash."""
        _, user = player_token
        user_id = user["id"]
        
        response = requests.get(f"{BASE_URL}/api/rating/history/{user_id}?limit=100", headers=player_headers)
        assert response.status_code == 200
        
        records = response.json().get("records", [])
        if not records:
            print("INFO: No records, skipping GENESIS hash test")
            return
        
        # Find record with seq=1
        first_record = next((r for r in records if r["seq"] == 1), None)
        assert first_record is not None, "Could not find record with seq=1"
        
        assert first_record["prev_hash"] == GENESIS_HASH, f"First record prev_hash should be GENESIS, got {first_record['prev_hash'][:32]}..."
        print(f"PASS: First record has correct GENESIS prev_hash")


class TestRecordContent:
    """Tests for rating history record content."""

    def test_record_contains_opponent_snapshot(self, player_headers, player_token):
        """Records should contain opponent_snapshot with name and rating_at_time."""
        _, user = player_token
        user_id = user["id"]
        
        response = requests.get(f"{BASE_URL}/api/rating/history/{user_id}", headers=player_headers)
        assert response.status_code == 200
        
        records = response.json().get("records", [])
        if not records:
            print("INFO: No records to check opponent_snapshot")
            return
        
        for record in records:
            assert "opponent_snapshot" in record, "Record missing opponent_snapshot"
            snap = record["opponent_snapshot"]
            assert isinstance(snap, list), "opponent_snapshot should be a list"
            
            if snap:
                for opp in snap:
                    assert "name" in opp, "Opponent snapshot missing name"
                    assert "rating_at_time" in opp, "Opponent snapshot missing rating_at_time"
        
        print(f"PASS: All {len(records)} records have valid opponent_snapshot structure")

    def test_record_contains_confirmations(self, player_headers, player_token):
        """Records should contain confirmations from the match."""
        _, user = player_token
        user_id = user["id"]
        
        response = requests.get(f"{BASE_URL}/api/rating/history/{user_id}", headers=player_headers)
        assert response.status_code == 200
        
        records = response.json().get("records", [])
        if not records:
            print("INFO: No records to check confirmations")
            return
        
        for record in records:
            assert "confirmations" in record, "Record missing confirmations"
            confs = record["confirmations"]
            assert isinstance(confs, list), "confirmations should be a list"
        
        print(f"PASS: All {len(records)} records have confirmations field")


class TestMatchResultCreatesHistory:
    """Test that match result flow creates rating_history records."""

    def test_match_flow_creates_rating_records(self, player_headers, coach_headers, player_token, coach_token):
        """Full match flow: Create -> Join -> Submit -> Confirm -> Check history records created."""
        _, player = player_token
        _, coach = coach_token
        
        player_id = player["id"]
        coach_id = coach["id"]
        
        # Get initial history counts
        player_history_before = requests.get(f"{BASE_URL}/api/rating/history/{player_id}", headers=player_headers).json()
        coach_history_before = requests.get(f"{BASE_URL}/api/rating/history/{coach_id}", headers=coach_headers).json()
        
        player_records_before = player_history_before.get("total_records", 0)
        coach_records_before = coach_history_before.get("total_records", 0)
        
        print(f"INFO: Before match - Player has {player_records_before} records, Coach has {coach_records_before} records")
        
        # 1. Create match
        match_data = {
            "sport": "football",
            "venue_id": "",
            "venue_name": "TEST Rating History Test Venue",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "time": "18:00",
            "players_needed": 2,
            "min_skill": 0,
            "max_skill": 3000,
            "description": f"TEST_RATING_CHAIN_{uuid.uuid4().hex[:8]}"
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/matchmaking", json=match_data, headers=player_headers)
        assert create_resp.status_code == 200, f"Create match failed: {create_resp.status_code}"
        match = create_resp.json()
        match_id = match["id"]
        print(f"PASS: Match created: {match_id[:8]}...")
        
        # 2. Coach joins match
        join_resp = requests.post(f"{BASE_URL}/api/matchmaking/{match_id}/join", headers=coach_headers)
        assert join_resp.status_code == 200, f"Join match failed: {join_resp.status_code}"
        print("PASS: Coach joined the match")
        
        # 3. Submit result (player wins)
        result_data = {
            "team_a": [player_id],
            "team_b": [coach_id],
            "winner": "team_a",
            "score_a": 3,
            "score_b": 1
        }
        
        submit_resp = requests.post(f"{BASE_URL}/api/matchmaking/{match_id}/submit-result", json=result_data, headers=player_headers)
        assert submit_resp.status_code == 200, f"Submit result failed: {submit_resp.status_code}"
        submit_result = submit_resp.json()
        print(f"PASS: Result submitted - confirmed: {submit_result.get('confirmed')}")
        
        # 4. Coach confirms result if not auto-confirmed
        if not submit_result.get("confirmed"):
            confirm_resp = requests.post(f"{BASE_URL}/api/matchmaking/{match_id}/confirm-result", 
                                         json={"confirmed": True}, headers=coach_headers)
            assert confirm_resp.status_code == 200, f"Confirm result failed: {confirm_resp.status_code}"
            confirm_result = confirm_resp.json()
            print(f"PASS: Result confirmed: {confirm_result.get('confirmed')}")
        
        # 5. Verify history records were created
        player_history_after = requests.get(f"{BASE_URL}/api/rating/history/{player_id}", headers=player_headers).json()
        coach_history_after = requests.get(f"{BASE_URL}/api/rating/history/{coach_id}", headers=coach_headers).json()
        
        player_records_after = player_history_after.get("total_records", 0)
        coach_records_after = coach_history_after.get("total_records", 0)
        
        assert player_records_after > player_records_before, f"Player records should increase: {player_records_before} -> {player_records_after}"
        assert coach_records_after > coach_records_before, f"Coach records should increase: {coach_records_before} -> {coach_records_after}"
        
        print(f"PASS: Rating history records created!")
        print(f"  Player: {player_records_before} -> {player_records_after} (+{player_records_after - player_records_before})")
        print(f"  Coach: {coach_records_before} -> {coach_records_after} (+{coach_records_after - coach_records_before})")
        
        # 6. Verify the latest record has correct fields
        latest_player_record = player_history_after["records"][0]  # Sorted by seq desc
        assert latest_player_record["match_id"] == match_id, "Latest record should be from our test match"
        assert latest_player_record["result"] == "win", "Player should have won"
        assert "record_hash" in latest_player_record
        assert "prev_hash" in latest_player_record
        assert "opponent_snapshot" in latest_player_record
        
        # Verify opponent snapshot contains coach
        opp_names = [o["name"] for o in latest_player_record["opponent_snapshot"]]
        assert coach["name"] in opp_names, f"Opponent snapshot should include coach {coach['name']}"
        
        print(f"PASS: Latest record has correct structure with opponent snapshot including {coach['name']}")
        
        # 7. Verify chain is still intact after new records
        verify_resp = requests.get(f"{BASE_URL}/api/rating/verify/{player_id}", headers=player_headers)
        assert verify_resp.status_code == 200
        verify_data = verify_resp.json()
        assert verify_data["chain_intact"] == True, "Chain should still be intact after new record"
        print(f"PASS: Chain integrity verified after new match record")


class TestViewOtherPlayerProfile:
    """Test that users can view other players' rating profiles."""

    def test_player_can_view_coach_history(self, player_headers, coach_token):
        """Player can view coach's rating history."""
        _, coach = coach_token
        coach_id = coach["id"]
        
        response = requests.get(f"{BASE_URL}/api/rating/history/{coach_id}", headers=player_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["user"]["id"] == coach_id
        print(f"PASS: Player can view coach's history - {data['user']['name']} ({data['total_records']} records)")

    def test_player_can_view_coach_certificate(self, player_headers, coach_token):
        """Player can view coach's rating certificate."""
        _, coach = coach_token
        coach_id = coach["id"]
        
        response = requests.get(f"{BASE_URL}/api/rating/certificate/{coach_id}", headers=player_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["player"]["id"] == coach_id
        print(f"PASS: Player can view coach's certificate - Tier: {data['player']['tier']}")

    def test_player_can_verify_coach_chain(self, player_headers, coach_token):
        """Player can verify coach's rating chain."""
        _, coach = coach_token
        coach_id = coach["id"]
        
        response = requests.get(f"{BASE_URL}/api/rating/verify/{coach_id}", headers=player_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        print(f"PASS: Player can verify coach's chain - verified={data['verified']}, chain_intact={data['chain_intact']}")


class TestLeaderboardNavigation:
    """Test leaderboard returns data needed for navigation to profiles."""

    def test_leaderboard_returns_player_ids(self, player_headers):
        """Leaderboard returns player IDs for profile navigation."""
        response = requests.get(f"{BASE_URL}/api/leaderboard", headers=player_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Leaderboard should return a list"
        
        if data:
            player = data[0]
            assert "id" in player, "Leaderboard player should have 'id' for navigation"
            assert "name" in player
            assert "skill_rating" in player
            print(f"PASS: Leaderboard returns {len(data)} players with IDs for profile navigation")
            print(f"INFO: Top player: {player['name']} (Rating: {player['skill_rating']})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
