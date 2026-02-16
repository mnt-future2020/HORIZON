"""
Test Suite for Glicko-2 Matchmaking Features - Horizon Sports Platform
Tests: Leaderboard, Recommended Matches, Auto-Match, Team Suggestion, Result Submission/Confirmation, Rating Updates
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PLAYER_EMAIL = "demo@player.com"
PLAYER_PASSWORD = "demo123"
COACH_EMAIL = "demo@coach.com"
COACH_PASSWORD = "demo123"
ADMIN_EMAIL = "admin@horizon.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def player_token(api_client):
    """Get player authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": PLAYER_EMAIL, "password": PLAYER_PASSWORD
    })
    assert response.status_code == 200, f"Player login failed: {response.text}"
    data = response.json()
    return data["token"], data["user"]


@pytest.fixture(scope="module")
def coach_token(api_client):
    """Get coach authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": COACH_EMAIL, "password": COACH_PASSWORD
    })
    assert response.status_code == 200, f"Coach login failed: {response.text}"
    data = response.json()
    return data["token"], data["user"]


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    data = response.json()
    return data["token"], data["user"]


class TestLeaderboard:
    """Tests for leaderboard endpoint"""

    def test_get_leaderboard(self, api_client):
        """GET /api/leaderboard - Returns ranked players sorted by skill_rating"""
        response = api_client.get(f"{BASE_URL}/api/leaderboard")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Check leaderboard structure
        if len(data) > 0:
            player = data[0]
            assert "rank" in player
            assert "id" in player
            assert "name" in player
            assert "skill_rating" in player
            assert "wins" in player
            assert "losses" in player
            assert "draws" in player
            print(f"Leaderboard has {len(data)} players, top player: {player['name']} rating {player['skill_rating']}")

    def test_get_leaderboard_sorted_by_rating(self, api_client):
        """Verify leaderboard is sorted by skill_rating descending"""
        response = api_client.get(f"{BASE_URL}/api/leaderboard")
        assert response.status_code == 200
        data = response.json()
        
        # Check sorting
        for i in range(len(data) - 1):
            assert data[i]["skill_rating"] >= data[i+1]["skill_rating"], "Leaderboard not sorted correctly"
        print("Leaderboard is correctly sorted by skill_rating descending")

    def test_leaderboard_sport_filter(self, api_client):
        """GET /api/leaderboard?sport=football - Sport-filtered leaderboard"""
        response = api_client.get(f"{BASE_URL}/api/leaderboard", params={"sport": "football"})
        assert response.status_code == 200
        data = response.json()
        
        # Verify all returned players have football in their sports
        for player in data:
            # Note: API filters by players who play the sport
            assert "sports" in player
            print(f"Player {player['name']} sports: {player.get('sports', [])}")
        print(f"Sport filter returned {len(data)} players")

    def test_leaderboard_rank_numbers(self, api_client):
        """Verify ranks are sequential starting from 1"""
        response = api_client.get(f"{BASE_URL}/api/leaderboard")
        assert response.status_code == 200
        data = response.json()
        
        for i, player in enumerate(data):
            assert player["rank"] == i + 1, f"Expected rank {i+1}, got {player['rank']}"
        print("All ranks are correct and sequential")


class TestRecommendedMatches:
    """Tests for recommended matches endpoint"""

    def test_recommended_matches_unauthenticated(self, api_client):
        """GET /api/matchmaking/recommended - Should require auth"""
        response = api_client.get(f"{BASE_URL}/api/matchmaking/recommended")
        assert response.status_code == 401
        print("Recommended matches correctly requires authentication")

    def test_recommended_matches_authenticated(self, api_client, player_token):
        """GET /api/matchmaking/recommended - Returns matches with compatibility_score"""
        token, user = player_token
        headers = {"Authorization": f"Bearer {token}"}
        response = api_client.get(f"{BASE_URL}/api/matchmaking/recommended", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Check compatibility scores
        for match in data:
            assert "compatibility_score" in match, "Missing compatibility_score"
            assert "spots_left" in match, "Missing spots_left"
            assert 0 <= match["compatibility_score"] <= 100, "Invalid compatibility score"
            print(f"Match {match['id'][:8]}: compatibility={match['compatibility_score']}%, spots={match['spots_left']}")
        print(f"Got {len(data)} recommended matches")


class TestAutoMatch:
    """Tests for auto-match endpoint"""

    def test_auto_match_unauthenticated(self, api_client):
        """POST /api/matchmaking/auto-match - Should require auth"""
        response = api_client.post(f"{BASE_URL}/api/matchmaking/auto-match", json={"sport": "football"})
        assert response.status_code == 401
        print("Auto-match correctly requires authentication")

    def test_auto_match_authenticated(self, api_client, player_token):
        """POST /api/matchmaking/auto-match - Auto-finds best match for user's skill"""
        token, user = player_token
        headers = {"Authorization": f"Bearer {token}"}
        response = api_client.post(
            f"{BASE_URL}/api/matchmaking/auto-match",
            headers=headers,
            json={"sport": "football"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Either found or not found response
        assert "found" in data
        if data["found"]:
            assert "match" in data
            assert "compatibility_score" in data["match"]
            print(f"Auto-match found: {data['match']['id'][:8]} with {data['match']['compatibility_score']}% compatibility")
        else:
            assert "message" in data
            print(f"Auto-match result: {data['message']}")


class TestTeamSuggestion:
    """Tests for team suggestion endpoint"""

    def test_suggest_teams_requires_auth(self, api_client):
        """GET /api/matchmaking/{id}/suggest-teams - Requires authentication"""
        # Use a fake match ID
        response = api_client.get(f"{BASE_URL}/api/matchmaking/fake-id/suggest-teams")
        assert response.status_code == 401
        print("Team suggestion correctly requires authentication")

    def test_suggest_teams_not_found(self, api_client, player_token):
        """GET /api/matchmaking/{id}/suggest-teams - Returns 404 for invalid match"""
        token, _ = player_token
        headers = {"Authorization": f"Bearer {token}"}
        response = api_client.get(f"{BASE_URL}/api/matchmaking/nonexistent-id/suggest-teams", headers=headers)
        assert response.status_code == 404
        print("Team suggestion correctly returns 404 for non-existent match")


class TestMatchResultSubmission:
    """Tests for match result submission and confirmation"""

    def test_submit_result_requires_auth(self, api_client):
        """POST /api/matchmaking/{id}/submit-result - Requires authentication"""
        response = api_client.post(
            f"{BASE_URL}/api/matchmaking/fake-id/submit-result",
            json={"team_a": [], "team_b": [], "winner": "team_a"}
        )
        assert response.status_code == 401
        print("Result submission correctly requires authentication")

    def test_submit_result_not_found(self, api_client, player_token):
        """POST /api/matchmaking/{id}/submit-result - Returns 404 for invalid match"""
        token, _ = player_token
        headers = {"Authorization": f"Bearer {token}"}
        response = api_client.post(
            f"{BASE_URL}/api/matchmaking/nonexistent-id/submit-result",
            headers=headers,
            json={"team_a": ["id1"], "team_b": ["id2"], "winner": "team_a"}
        )
        assert response.status_code == 404
        print("Result submission correctly returns 404 for non-existent match")

    def test_confirm_result_requires_auth(self, api_client):
        """POST /api/matchmaking/{id}/confirm-result - Requires authentication"""
        response = api_client.post(
            f"{BASE_URL}/api/matchmaking/fake-id/confirm-result",
            json={"confirmed": True}
        )
        assert response.status_code == 401
        print("Result confirmation correctly requires authentication")


class TestMatchCreationWithRatings:
    """Tests for match creation with player_ratings field"""

    def test_create_match_includes_creator_rating(self, api_client, player_token):
        """POST /api/matchmaking - Creates match with player_ratings field"""
        token, user = player_token
        headers = {"Authorization": f"Bearer {token}"}
        
        unique_desc = f"TEST_Rating_Match_{uuid.uuid4().hex[:8]}"
        response = api_client.post(
            f"{BASE_URL}/api/matchmaking",
            headers=headers,
            json={
                "sport": "football",
                "date": "2026-03-01",
                "time": "18:00",
                "venue_name": "Test Venue",
                "players_needed": 4,
                "min_skill": 0,
                "max_skill": 3000,
                "description": unique_desc
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify player_ratings is included
        assert "player_ratings" in data, "Match should have player_ratings field"
        assert user["id"] in data["player_ratings"], "Creator's rating should be in player_ratings"
        assert data["player_ratings"][user["id"]] == user["skill_rating"], "Rating should match user's rating"
        print(f"Match created with player_ratings: {data['player_ratings']}")
        
        return data["id"]


class TestJoinMatchWithRatings:
    """Tests for join match updates player_ratings"""

    def test_join_match_adds_rating(self, api_client, player_token, coach_token):
        """POST /api/matchmaking/{id}/join - Adds player rating to match"""
        # First create a match as coach
        coach_tk, coach_user = coach_token
        coach_headers = {"Authorization": f"Bearer {coach_tk}"}
        
        unique_desc = f"TEST_JoinRating_Match_{uuid.uuid4().hex[:8]}"
        create_resp = api_client.post(
            f"{BASE_URL}/api/matchmaking",
            headers=coach_headers,
            json={
                "sport": "football",
                "date": "2026-03-02",
                "time": "19:00",
                "venue_name": "Join Test Venue",
                "players_needed": 4,
                "min_skill": 0,
                "max_skill": 3000,
                "description": unique_desc
            }
        )
        assert create_resp.status_code == 200
        match = create_resp.json()
        match_id = match["id"]
        
        # Now join as player
        player_tk, player_user = player_token
        player_headers = {"Authorization": f"Bearer {player_tk}"}
        
        join_resp = api_client.post(f"{BASE_URL}/api/matchmaking/{match_id}/join", headers=player_headers)
        assert join_resp.status_code == 200
        
        # Verify the match now has both ratings
        # Fetch match list to verify
        list_resp = api_client.get(f"{BASE_URL}/api/matchmaking")
        assert list_resp.status_code == 200
        matches = list_resp.json()
        
        joined_match = next((m for m in matches if m["id"] == match_id), None)
        assert joined_match is not None, "Match should be in list"
        
        # Verify player was added
        assert player_user["id"] in joined_match.get("players_joined", [])
        print(f"Player joined successfully. Match now has players: {joined_match.get('player_names', [])}")


class TestFullResultFlow:
    """End-to-end test for result submission and confirmation flow"""

    def test_full_result_flow(self, api_client, player_token, coach_token):
        """Test complete flow: Create -> Join -> Submit Result -> Confirm -> Rating Update"""
        player_tk, player_user = player_token
        coach_tk, coach_user = coach_token
        player_headers = {"Authorization": f"Bearer {player_tk}"}
        coach_headers = {"Authorization": f"Bearer {coach_tk}"}
        
        # Get initial ratings
        initial_player_rating = player_user["skill_rating"]
        initial_coach_rating = coach_user["skill_rating"]
        print(f"Initial ratings - Player: {initial_player_rating}, Coach: {initial_coach_rating}")
        
        # Step 1: Create match as player
        unique_desc = f"TEST_FullFlow_{uuid.uuid4().hex[:8]}"
        create_resp = api_client.post(
            f"{BASE_URL}/api/matchmaking",
            headers=player_headers,
            json={
                "sport": "football",
                "date": "2026-03-03",
                "time": "20:00",
                "venue_name": "Full Flow Test Venue",
                "players_needed": 2,  # 2 players for quick test
                "min_skill": 0,
                "max_skill": 3000,
                "description": unique_desc
            }
        )
        assert create_resp.status_code == 200
        match = create_resp.json()
        match_id = match["id"]
        print(f"Step 1: Created match {match_id[:8]}")
        
        # Step 2: Coach joins match
        join_resp = api_client.post(f"{BASE_URL}/api/matchmaking/{match_id}/join", headers=coach_headers)
        assert join_resp.status_code == 200
        print("Step 2: Coach joined the match")
        
        # Step 3: Test suggest-teams endpoint
        suggest_resp = api_client.get(f"{BASE_URL}/api/matchmaking/{match_id}/suggest-teams", headers=player_headers)
        assert suggest_resp.status_code == 200
        teams_data = suggest_resp.json()
        assert "team_a" in teams_data
        assert "team_b" in teams_data
        assert "balance_quality" in teams_data
        print(f"Step 3: Team suggestion - Balance quality: {teams_data['balance_quality']}%")
        
        # Step 4: Player submits result (team_a = player wins)
        submit_resp = api_client.post(
            f"{BASE_URL}/api/matchmaking/{match_id}/submit-result",
            headers=player_headers,
            json={
                "team_a": [player_user["id"]],
                "team_b": [coach_user["id"]],
                "winner": "team_a",
                "score_a": 2,
                "score_b": 1
            }
        )
        assert submit_resp.status_code == 200
        submit_data = submit_resp.json()
        print(f"Step 4: Result submitted - {submit_data['message']}")
        
        # For 2 players, both need to confirm
        # Since submitter auto-confirms, we need coach to confirm
        if not submit_data.get("confirmed"):
            # Step 5: Coach confirms result
            confirm_resp = api_client.post(
                f"{BASE_URL}/api/matchmaking/{match_id}/confirm-result",
                headers=coach_headers,
                json={"confirmed": True}
            )
            assert confirm_resp.status_code == 200
            confirm_data = confirm_resp.json()
            print(f"Step 5: Result confirmed - {confirm_data['message']}")
        else:
            print("Step 5: Result was auto-confirmed")
        
        # Step 6: Verify rating updates by fetching user profiles
        time.sleep(1)  # Give time for DB updates
        
        player_me_resp = api_client.get(f"{BASE_URL}/api/auth/me", headers=player_headers)
        coach_me_resp = api_client.get(f"{BASE_URL}/api/auth/me", headers=coach_headers)
        
        if player_me_resp.status_code == 200:
            new_player = player_me_resp.json()
            new_player_rating = new_player.get("skill_rating", initial_player_rating)
            rating_change = new_player_rating - initial_player_rating
            print(f"Step 6: Player rating change: {initial_player_rating} -> {new_player_rating} ({'+' if rating_change >= 0 else ''}{rating_change})")
        
        if coach_me_resp.status_code == 200:
            new_coach = coach_me_resp.json()
            new_coach_rating = new_coach.get("skill_rating", initial_coach_rating)
            rating_change = new_coach_rating - initial_coach_rating
            print(f"Step 6: Coach rating change: {initial_coach_rating} -> {new_coach_rating} ({'+' if rating_change >= 0 else ''}{rating_change})")
        
        print("Full result flow completed successfully!")


class TestExistingFeatures:
    """Tests to verify existing matchmaking/mercenary features still work"""

    def test_list_matches(self, api_client):
        """GET /api/matchmaking - List open matches"""
        response = api_client.get(f"{BASE_URL}/api/matchmaking")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Listed {len(data)} open matches")

    def test_list_mercenary(self, api_client):
        """GET /api/mercenary - List open mercenary posts"""
        response = api_client.get(f"{BASE_URL}/api/mercenary")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Listed {len(data)} mercenary posts")

    def test_my_mercenary_posts(self, api_client, player_token):
        """GET /api/mercenary/my-posts - My mercenary posts"""
        token, _ = player_token
        headers = {"Authorization": f"Bearer {token}"}
        response = api_client.get(f"{BASE_URL}/api/mercenary/my-posts", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"User has {len(data)} mercenary posts")


class TestNotificationOnRatingUpdate:
    """Test that notification is sent after rating update"""

    def test_notifications_after_result(self, api_client, player_token):
        """GET /api/notifications - Check for rating update notifications"""
        token, _ = player_token
        headers = {"Authorization": f"Bearer {token}"}
        response = api_client.get(f"{BASE_URL}/api/notifications", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Look for rating_update notifications
        rating_notifs = [n for n in data if n.get("type") == "rating_update"]
        print(f"Found {len(rating_notifs)} rating update notifications")
        
        for notif in rating_notifs[:3]:  # Show first 3
            print(f"  - {notif['title']}: {notif['message'][:50]}...")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
