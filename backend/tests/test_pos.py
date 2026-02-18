"""
POS (Point of Sale) Backend API Tests
Tests: Products CRUD, Sales recording, Summary endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://dynamic-s3-flow.preview.emergentagent.com').rstrip('/')

# Test credentials for venue owner
VENUE_OWNER_EMAIL = "demo@owner.com"
VENUE_OWNER_PASSWORD = "demo123"

# Store shared state
TEST_STATE = {
    "auth_token": None,
    "venue_id": None,
    "product_id": None,
    "sale_id": None
}


class TestPOSAuthentication:
    """Test authentication and venue access"""
    
    def test_login_venue_owner(self):
        """Login as venue owner and get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": VENUE_OWNER_EMAIL, "password": VENUE_OWNER_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "venue_owner"
        TEST_STATE["auth_token"] = data["token"]
        print(f"✓ Logged in as venue_owner: {data['user']['name']}")
    
    def test_get_owner_venues(self):
        """Get venues owned by the logged in user"""
        headers = {"Authorization": f"Bearer {TEST_STATE['auth_token']}"}
        response = requests.get(f"{BASE_URL}/api/owner/venues", headers=headers)
        assert response.status_code == 200, f"Failed to get venues: {response.text}"
        venues = response.json()
        assert len(venues) > 0, "Venue owner should have at least one venue"
        TEST_STATE["venue_id"] = venues[0]["id"]
        print(f"✓ Found {len(venues)} venues. Using: {venues[0]['name']} ({TEST_STATE['venue_id']})")


class TestPOSProducts:
    """Test POS Product CRUD operations"""
    
    def test_list_products_empty_or_existing(self):
        """List products for venue - may be empty or have existing products"""
        headers = {"Authorization": f"Bearer {TEST_STATE['auth_token']}"}
        response = requests.get(
            f"{BASE_URL}/api/pos/products",
            params={"venue_id": TEST_STATE["venue_id"]},
            headers=headers
        )
        assert response.status_code == 200, f"Failed to list products: {response.text}"
        products = response.json()
        assert isinstance(products, list)
        print(f"✓ GET /api/pos/products returned {len(products)} products")
    
    def test_create_product(self):
        """Create a new POS product"""
        headers = {"Authorization": f"Bearer {TEST_STATE['auth_token']}"}
        product_data = {
            "venue_id": TEST_STATE["venue_id"],
            "name": "TEST_Energy Drink",
            "category": "beverages",
            "price": 50,
            "stock": 10,
            "emoji": "🔋"
        }
        response = requests.post(
            f"{BASE_URL}/api/pos/products",
            json=product_data,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to create product: {response.text}"
        product = response.json()
        
        # Data assertions
        assert product["name"] == "TEST_Energy Drink"
        assert product["category"] == "beverages"
        assert product["price"] == 50
        assert product["stock"] == 10
        assert product["emoji"] == "🔋"
        assert product["is_active"] == True
        assert "id" in product
        
        TEST_STATE["product_id"] = product["id"]
        print(f"✓ Created product: {product['name']} (id: {product['id']})")
    
    def test_verify_product_created(self):
        """GET the product to verify persistence"""
        headers = {"Authorization": f"Bearer {TEST_STATE['auth_token']}"}
        response = requests.get(
            f"{BASE_URL}/api/pos/products",
            params={"venue_id": TEST_STATE["venue_id"]},
            headers=headers
        )
        assert response.status_code == 200
        products = response.json()
        
        # Find our created product
        our_product = next((p for p in products if p["id"] == TEST_STATE["product_id"]), None)
        assert our_product is not None, "Created product not found in product list"
        assert our_product["name"] == "TEST_Energy Drink"
        print(f"✓ Verified product exists in list: {our_product['name']}")
    
    def test_update_product(self):
        """Update the product price and stock"""
        headers = {"Authorization": f"Bearer {TEST_STATE['auth_token']}"}
        update_data = {
            "price": 60,
            "stock": 20
        }
        response = requests.put(
            f"{BASE_URL}/api/pos/products/{TEST_STATE['product_id']}",
            json=update_data,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to update product: {response.text}"
        product = response.json()
        
        # Verify updates
        assert product["price"] == 60
        assert product["stock"] == 20
        assert product["name"] == "TEST_Energy Drink"  # Unchanged
        print(f"✓ Updated product: price={product['price']}, stock={product['stock']}")
    
    def test_toggle_product_inactive(self):
        """Toggle product to inactive"""
        headers = {"Authorization": f"Bearer {TEST_STATE['auth_token']}"}
        response = requests.put(
            f"{BASE_URL}/api/pos/products/{TEST_STATE['product_id']}",
            json={"is_active": False},
            headers=headers
        )
        assert response.status_code == 200
        product = response.json()
        assert product["is_active"] == False
        print(f"✓ Toggled product inactive")
    
    def test_toggle_product_active(self):
        """Toggle product back to active"""
        headers = {"Authorization": f"Bearer {TEST_STATE['auth_token']}"}
        response = requests.put(
            f"{BASE_URL}/api/pos/products/{TEST_STATE['product_id']}",
            json={"is_active": True},
            headers=headers
        )
        assert response.status_code == 200
        product = response.json()
        assert product["is_active"] == True
        print(f"✓ Toggled product active")


class TestPOSSales:
    """Test POS Sales recording and history"""
    
    def test_record_sale(self):
        """Record a sale"""
        headers = {"Authorization": f"Bearer {TEST_STATE['auth_token']}"}
        sale_data = {
            "venue_id": TEST_STATE["venue_id"],
            "items": [
                {
                    "product_id": TEST_STATE["product_id"],
                    "name": "TEST_Energy Drink",
                    "price": 60,
                    "qty": 2
                }
            ],
            "payment_method": "cash"
        }
        response = requests.post(
            f"{BASE_URL}/api/pos/sales",
            json=sale_data,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to record sale: {response.text}"
        sale = response.json()
        
        # Data assertions
        assert sale["total"] == 120  # 60 * 2
        assert sale["payment_method"] == "cash"
        assert len(sale["items"]) == 1
        assert "id" in sale
        
        TEST_STATE["sale_id"] = sale["id"]
        print(f"✓ Recorded sale: ₹{sale['total']} via {sale['payment_method']} (id: {sale['id']})")
    
    def test_verify_stock_decremented(self):
        """Verify product stock was decremented after sale"""
        headers = {"Authorization": f"Bearer {TEST_STATE['auth_token']}"}
        response = requests.get(
            f"{BASE_URL}/api/pos/products",
            params={"venue_id": TEST_STATE["venue_id"]},
            headers=headers
        )
        assert response.status_code == 200
        products = response.json()
        
        our_product = next((p for p in products if p["id"] == TEST_STATE["product_id"]), None)
        assert our_product is not None
        # Stock was 20, sold 2, should be 18
        assert our_product["stock"] == 18, f"Expected stock 18, got {our_product['stock']}"
        print(f"✓ Stock decremented correctly: {our_product['stock']}")
    
    def test_list_sales(self):
        """List sales for venue"""
        headers = {"Authorization": f"Bearer {TEST_STATE['auth_token']}"}
        response = requests.get(
            f"{BASE_URL}/api/pos/sales",
            params={"venue_id": TEST_STATE["venue_id"], "limit": 50},
            headers=headers
        )
        assert response.status_code == 200, f"Failed to list sales: {response.text}"
        sales = response.json()
        assert isinstance(sales, list)
        assert len(sales) > 0, "Should have at least one sale"
        
        # Find our sale
        our_sale = next((s for s in sales if s["id"] == TEST_STATE["sale_id"]), None)
        assert our_sale is not None
        assert our_sale["total"] == 120
        print(f"✓ GET /api/pos/sales returned {len(sales)} sales")
    
    def test_record_sale_upi(self):
        """Record a sale with UPI payment"""
        headers = {"Authorization": f"Bearer {TEST_STATE['auth_token']}"}
        sale_data = {
            "venue_id": TEST_STATE["venue_id"],
            "items": [
                {
                    "product_id": TEST_STATE["product_id"],
                    "name": "TEST_Energy Drink",
                    "price": 60,
                    "qty": 1
                }
            ],
            "payment_method": "upi"
        }
        response = requests.post(
            f"{BASE_URL}/api/pos/sales",
            json=sale_data,
            headers=headers
        )
        assert response.status_code == 200
        sale = response.json()
        assert sale["payment_method"] == "upi"
        print(f"✓ Recorded UPI sale: ₹{sale['total']}")
    
    def test_record_sale_card(self):
        """Record a sale with Card payment"""
        headers = {"Authorization": f"Bearer {TEST_STATE['auth_token']}"}
        sale_data = {
            "venue_id": TEST_STATE["venue_id"],
            "items": [
                {
                    "product_id": TEST_STATE["product_id"],
                    "name": "TEST_Energy Drink",
                    "price": 60,
                    "qty": 1
                }
            ],
            "payment_method": "card"
        }
        response = requests.post(
            f"{BASE_URL}/api/pos/sales",
            json=sale_data,
            headers=headers
        )
        assert response.status_code == 200
        sale = response.json()
        assert sale["payment_method"] == "card"
        print(f"✓ Recorded Card sale: ₹{sale['total']}")


class TestPOSSummary:
    """Test POS Summary/Analytics endpoint"""
    
    def test_get_summary(self):
        """Get today's sales summary"""
        headers = {"Authorization": f"Bearer {TEST_STATE['auth_token']}"}
        response = requests.get(
            f"{BASE_URL}/api/pos/summary",
            params={"venue_id": TEST_STATE["venue_id"]},
            headers=headers
        )
        assert response.status_code == 200, f"Failed to get summary: {response.text}"
        summary = response.json()
        
        # Data assertions
        assert "today" in summary
        assert "total_sales" in summary
        assert "total_revenue" in summary
        assert "total_items_sold" in summary
        assert "by_payment_method" in summary
        
        # We made sales, so values should be > 0
        assert summary["total_sales"] >= 3, f"Expected at least 3 sales, got {summary['total_sales']}"
        assert summary["total_revenue"] >= 240, f"Expected at least ₹240 revenue"  # 120 + 60 + 60
        
        print(f"✓ Summary: {summary['total_sales']} sales, ₹{summary['total_revenue']} revenue")
        print(f"  By payment: {summary['by_payment_method']}")


class TestPOSCleanup:
    """Cleanup test data"""
    
    def test_delete_product(self):
        """Delete the test product"""
        headers = {"Authorization": f"Bearer {TEST_STATE['auth_token']}"}
        response = requests.delete(
            f"{BASE_URL}/api/pos/products/{TEST_STATE['product_id']}",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to delete product: {response.text}"
        print(f"✓ Deleted test product: {TEST_STATE['product_id']}")
    
    def test_verify_product_deleted(self):
        """Verify product no longer exists"""
        headers = {"Authorization": f"Bearer {TEST_STATE['auth_token']}"}
        response = requests.get(
            f"{BASE_URL}/api/pos/products",
            params={"venue_id": TEST_STATE["venue_id"]},
            headers=headers
        )
        assert response.status_code == 200
        products = response.json()
        
        our_product = next((p for p in products if p["id"] == TEST_STATE["product_id"]), None)
        assert our_product is None, "Product should be deleted"
        print(f"✓ Verified product deleted")


class TestPOSEdgeCases:
    """Test edge cases and error handling"""
    
    def test_create_product_no_name(self):
        """Should fail when product name is missing"""
        headers = {"Authorization": f"Bearer {TEST_STATE['auth_token']}"}
        response = requests.post(
            f"{BASE_URL}/api/pos/products",
            json={"venue_id": TEST_STATE["venue_id"], "price": 50},
            headers=headers
        )
        assert response.status_code == 400
        print(f"✓ Correctly rejected product without name")
    
    def test_create_product_no_venue(self):
        """Should fail when venue_id is missing"""
        headers = {"Authorization": f"Bearer {TEST_STATE['auth_token']}"}
        response = requests.post(
            f"{BASE_URL}/api/pos/products",
            json={"name": "Test", "price": 50},
            headers=headers
        )
        assert response.status_code == 400
        print(f"✓ Correctly rejected product without venue_id")
    
    def test_sale_empty_items(self):
        """Should fail when sale has no items"""
        headers = {"Authorization": f"Bearer {TEST_STATE['auth_token']}"}
        response = requests.post(
            f"{BASE_URL}/api/pos/sales",
            json={"venue_id": TEST_STATE["venue_id"], "items": []},
            headers=headers
        )
        assert response.status_code == 400
        print(f"✓ Correctly rejected sale with no items")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
