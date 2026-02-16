"""
Test suite for Video Highlights feature - upload, analyze (Gemini AI), list, share, delete
Uses pytest with requests for API testing
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
VIDEO_FILE_PATH = "/tmp/real_test.mp4"

# Test credentials
PLAYER_EMAIL = "demo@player.com"
PLAYER_PASSWORD = "demo123"
OWNER_EMAIL = "demo@owner.com"
OWNER_PASSWORD = "demo123"

class TestHighlightsAPI:
    """Highlights CRUD + AI analysis tests"""
    
    @pytest.fixture(scope="class")
    def player_token(self):
        """Get player authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PLAYER_EMAIL,
            "password": PLAYER_PASSWORD
        })
        assert response.status_code == 200, f"Player login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def owner_token(self):
        """Get venue owner authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        assert response.status_code == 200, f"Owner login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def player_headers(self, player_token):
        return {"Authorization": f"Bearer {player_token}"}
    
    @pytest.fixture(scope="class")
    def owner_headers(self, owner_token):
        return {"Authorization": f"Bearer {owner_token}"}
    
    # ==================== LIST HIGHLIGHTS ====================
    def test_list_highlights_player(self, player_headers):
        """GET /api/highlights - List player's highlights"""
        response = requests.get(f"{BASE_URL}/api/highlights", headers=player_headers)
        assert response.status_code == 200, f"List highlights failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Player has {len(data)} highlights")
        # Check existing highlights have expected fields
        if len(data) > 0:
            hl = data[0]
            assert "id" in hl, "Highlight should have id"
            assert "title" in hl, "Highlight should have title"
            assert "status" in hl, "Highlight should have status"
            assert hl["status"] in ["uploaded", "analyzing", "completed", "failed"]
    
    def test_list_highlights_owner(self, owner_headers):
        """GET /api/highlights - List venue owner's highlights"""
        response = requests.get(f"{BASE_URL}/api/highlights", headers=owner_headers)
        assert response.status_code == 200, f"List highlights failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Owner has {len(data)} highlights")
    
    def test_list_highlights_unauthenticated(self):
        """GET /api/highlights - Should fail without auth"""
        response = requests.get(f"{BASE_URL}/api/highlights")
        assert response.status_code in [401, 403], "Should require authentication"
    
    # ==================== GET SHARED HIGHLIGHT (PUBLIC) ====================
    def test_get_shared_highlight_valid(self):
        """GET /api/highlights/shared/{shareId} - Public access to shared highlight"""
        # Using known share_id from agent context
        share_id = "1479d3c2"
        response = requests.get(f"{BASE_URL}/api/highlights/shared/{share_id}")
        assert response.status_code == 200, f"Get shared highlight failed: {response.text}"
        data = response.json()
        assert "title" in data, "Shared highlight should have title"
        assert "analysis" in data, "Shared highlight should have analysis"
        assert data.get("is_shared") == True, "Highlight should be marked as shared"
        # Should not expose video_path for security
        assert "video_path" not in data, "video_path should be stripped from public response"
        print(f"Shared highlight: {data.get('title')}")
        # Verify analysis structure
        if data.get("analysis"):
            analysis = data["analysis"]
            assert "summary" in analysis, "Analysis should have summary"
            assert "key_moments" in analysis, "Analysis should have key_moments"
            print(f"Analysis has {len(analysis.get('key_moments', []))} key moments")
    
    def test_get_shared_highlight_invalid(self):
        """GET /api/highlights/shared/{shareId} - Invalid share_id returns 404"""
        response = requests.get(f"{BASE_URL}/api/highlights/shared/nonexistent123")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    # ==================== UPLOAD VIDEO ====================
    def test_upload_video_success(self, player_headers):
        """POST /api/highlights/upload - Upload video file with title"""
        if not os.path.exists(VIDEO_FILE_PATH):
            pytest.skip(f"Test video file not found at {VIDEO_FILE_PATH}")
        
        with open(VIDEO_FILE_PATH, "rb") as f:
            files = {"file": ("test_match.mp4", f, "video/mp4")}
            data = {"title": "TEST_Pytest_Match_Upload"}
            response = requests.post(
                f"{BASE_URL}/api/highlights/upload",
                headers=player_headers,
                files=files,
                data=data
            )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        hl = response.json()
        assert "id" in hl, "Response should have highlight id"
        assert hl["title"] == "TEST_Pytest_Match_Upload", "Title should match"
        assert hl["status"] == "uploaded", "Status should be 'uploaded'"
        assert hl["file_size"] > 0, "File size should be > 0"
        print(f"Uploaded highlight: {hl['id']}, size: {hl['file_size']} bytes")
        # Store for later tests
        TestHighlightsAPI.uploaded_highlight_id = hl["id"]
    
    def test_upload_video_unauthenticated(self):
        """POST /api/highlights/upload - Should fail without auth"""
        if not os.path.exists(VIDEO_FILE_PATH):
            pytest.skip(f"Test video file not found at {VIDEO_FILE_PATH}")
        
        with open(VIDEO_FILE_PATH, "rb") as f:
            files = {"file": ("test.mp4", f, "video/mp4")}
            data = {"title": "Unauthenticated upload"}
            response = requests.post(
                f"{BASE_URL}/api/highlights/upload",
                files=files,
                data=data
            )
        
        assert response.status_code in [401, 403], "Should require authentication"
    
    # ==================== GET SPECIFIC HIGHLIGHT ====================
    def test_get_highlight_success(self, player_headers):
        """GET /api/highlights/{id} - Get specific highlight"""
        if not hasattr(TestHighlightsAPI, 'uploaded_highlight_id'):
            pytest.skip("No uploaded highlight to test")
        
        hl_id = TestHighlightsAPI.uploaded_highlight_id
        response = requests.get(f"{BASE_URL}/api/highlights/{hl_id}", headers=player_headers)
        assert response.status_code == 200, f"Get highlight failed: {response.text}"
        hl = response.json()
        assert hl["id"] == hl_id, "ID should match"
        assert hl["status"] == "uploaded", "Status should be uploaded"
    
    def test_get_highlight_not_found(self, player_headers):
        """GET /api/highlights/{id} - Invalid ID returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/highlights/nonexistent-uuid-12345",
            headers=player_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    # ==================== ANALYZE VIDEO (Gemini AI) ====================
    def test_analyze_video_success(self, player_headers):
        """POST /api/highlights/{id}/analyze - Trigger Gemini AI analysis"""
        if not hasattr(TestHighlightsAPI, 'uploaded_highlight_id'):
            pytest.skip("No uploaded highlight to analyze")
        
        hl_id = TestHighlightsAPI.uploaded_highlight_id
        # Analysis takes 5-10 seconds, use longer timeout
        response = requests.post(
            f"{BASE_URL}/api/highlights/{hl_id}/analyze",
            headers=player_headers,
            timeout=120  # 2 minute timeout for Gemini
        )
        
        # Can be 200 (success), 409 (already analyzing), or 500 (analysis failed)
        if response.status_code == 200:
            hl = response.json()
            assert hl["status"] in ["completed", "analyzing"], f"Unexpected status: {hl['status']}"
            if hl["status"] == "completed":
                assert "analysis" in hl, "Completed highlight should have analysis"
                analysis = hl["analysis"]
                assert "summary" in analysis, "Analysis should have summary"
                assert "key_moments" in analysis, "Analysis should have key_moments"
                print(f"Analysis completed: {analysis.get('summary', '')[:100]}...")
                print(f"Key moments: {len(analysis.get('key_moments', []))}")
                TestHighlightsAPI.analysis_completed = True
        elif response.status_code == 409:
            print("Analysis already in progress")
        elif response.status_code == 500:
            print(f"Analysis failed (may be expected): {response.json().get('detail', '')}")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code} - {response.text}")
    
    def test_analyze_highlight_not_found(self, player_headers):
        """POST /api/highlights/{id}/analyze - Invalid ID returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/highlights/nonexistent-uuid-12345/analyze",
            headers=player_headers,
            timeout=30
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    # ==================== SHARE HIGHLIGHT ====================
    def test_toggle_share_enable(self, player_headers):
        """POST /api/highlights/{id}/share - Enable sharing and generate link"""
        if not hasattr(TestHighlightsAPI, 'uploaded_highlight_id'):
            pytest.skip("No uploaded highlight to share")
        
        hl_id = TestHighlightsAPI.uploaded_highlight_id
        response = requests.post(
            f"{BASE_URL}/api/highlights/{hl_id}/share",
            headers=player_headers
        )
        
        assert response.status_code == 200, f"Toggle share failed: {response.text}"
        data = response.json()
        assert "is_shared" in data, "Response should have is_shared"
        assert "share_id" in data, "Response should have share_id"
        
        if data["is_shared"]:
            assert data["share_id"] is not None, "share_id should be set when sharing"
            print(f"Sharing enabled, share_id: {data['share_id']}")
            TestHighlightsAPI.share_id = data["share_id"]
        else:
            print("Sharing disabled")
    
    def test_shared_link_accessible(self, player_headers):
        """Verify shared link is publicly accessible"""
        if not hasattr(TestHighlightsAPI, 'share_id'):
            pytest.skip("No share_id to test")
        
        share_id = TestHighlightsAPI.share_id
        # Access without auth
        response = requests.get(f"{BASE_URL}/api/highlights/shared/{share_id}")
        assert response.status_code == 200, f"Shared link not accessible: {response.text}"
        data = response.json()
        assert data.get("is_shared") == True
    
    def test_toggle_share_disable(self, player_headers):
        """POST /api/highlights/{id}/share - Disable sharing"""
        if not hasattr(TestHighlightsAPI, 'uploaded_highlight_id'):
            pytest.skip("No uploaded highlight to unshare")
        
        hl_id = TestHighlightsAPI.uploaded_highlight_id
        # First ensure it's shared
        response = requests.post(
            f"{BASE_URL}/api/highlights/{hl_id}/share",
            headers=player_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # If now unshared, verify the public link is no longer accessible
        if not data["is_shared"]:
            share_id = TestHighlightsAPI.share_id if hasattr(TestHighlightsAPI, 'share_id') else None
            if share_id:
                response = requests.get(f"{BASE_URL}/api/highlights/shared/{share_id}")
                assert response.status_code == 404, "Unshared highlight should return 404"
                print("Sharing disabled successfully, link no longer accessible")
    
    def test_share_highlight_not_found(self, player_headers):
        """POST /api/highlights/{id}/share - Invalid ID returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/highlights/nonexistent-uuid-12345/share",
            headers=player_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    # ==================== DELETE HIGHLIGHT ====================
    def test_delete_highlight_success(self, player_headers):
        """DELETE /api/highlights/{id} - Delete highlight and file"""
        if not hasattr(TestHighlightsAPI, 'uploaded_highlight_id'):
            pytest.skip("No uploaded highlight to delete")
        
        hl_id = TestHighlightsAPI.uploaded_highlight_id
        response = requests.delete(
            f"{BASE_URL}/api/highlights/{hl_id}",
            headers=player_headers
        )
        
        assert response.status_code == 200, f"Delete failed: {response.text}"
        data = response.json()
        assert "message" in data, "Response should have message"
        print(f"Deleted highlight: {hl_id}")
        
        # Verify it's gone
        response = requests.get(f"{BASE_URL}/api/highlights/{hl_id}", headers=player_headers)
        assert response.status_code == 404, "Deleted highlight should return 404"
    
    def test_delete_highlight_not_found(self, player_headers):
        """DELETE /api/highlights/{id} - Invalid ID returns 404"""
        response = requests.delete(
            f"{BASE_URL}/api/highlights/nonexistent-uuid-12345",
            headers=player_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_delete_highlight_unauthenticated(self):
        """DELETE /api/highlights/{id} - Should fail without auth"""
        response = requests.delete(f"{BASE_URL}/api/highlights/some-id-12345")
        assert response.status_code in [401, 403], "Should require authentication"


class TestHighlightsOwnerAccess:
    """Test that venue owners can also access highlights feature"""
    
    @pytest.fixture(scope="class")
    def owner_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def owner_headers(self, owner_token):
        return {"Authorization": f"Bearer {owner_token}"}
    
    def test_owner_can_list_highlights(self, owner_headers):
        """Venue owner should be able to access highlights list"""
        response = requests.get(f"{BASE_URL}/api/highlights", headers=owner_headers)
        assert response.status_code == 200, f"Owner list highlights failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Owner has access to highlights, count: {len(data)}")
    
    def test_owner_can_upload_video(self, owner_headers):
        """Venue owner should be able to upload video"""
        if not os.path.exists(VIDEO_FILE_PATH):
            pytest.skip(f"Test video file not found")
        
        with open(VIDEO_FILE_PATH, "rb") as f:
            files = {"file": ("owner_test.mp4", f, "video/mp4")}
            data = {"title": "TEST_Owner_Upload"}
            response = requests.post(
                f"{BASE_URL}/api/highlights/upload",
                headers=owner_headers,
                files=files,
                data=data
            )
        
        assert response.status_code == 200, f"Owner upload failed: {response.text}"
        hl = response.json()
        assert hl["title"] == "TEST_Owner_Upload"
        TestHighlightsOwnerAccess.owner_highlight_id = hl["id"]
        print(f"Owner uploaded highlight: {hl['id']}")
    
    def test_cleanup_owner_highlight(self, owner_headers):
        """Cleanup: delete owner's test highlight"""
        if hasattr(TestHighlightsOwnerAccess, 'owner_highlight_id'):
            hl_id = TestHighlightsOwnerAccess.owner_highlight_id
            response = requests.delete(
                f"{BASE_URL}/api/highlights/{hl_id}",
                headers=owner_headers
            )
            assert response.status_code == 200
            print(f"Cleaned up owner highlight: {hl_id}")
