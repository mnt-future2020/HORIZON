"""
POS Service – Port 8008
Handles: Products CRUD, sales recording, batch offline sync, sales summaries.
"""
import sys, os
sys.path.insert(0, "/app/shared")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "shared"))

import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from database import db
from auth import get_current_user

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pos-service")

app = FastAPI(title="Horizon POS Service", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

async def _require_venue_owner(venue_id: str, user: dict):
    if user["role"] == "super_admin":
        return
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "owner_id": 1})
    if not venue:
        raise HTTPException(404, "Venue not found")
    if venue["owner_id"] != user["id"]:
        raise HTTPException(403, "Not authorized for this venue")


# ═══════════════════════════════════════════════════════════════════════════════
# PRODUCTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/pos/products")
async def list_products(venue_id: str, user=Depends(get_current_user)):
    await _require_venue_owner(venue_id, user)
    products = await db.pos_products.find(
        {"venue_id": venue_id}, {"_id": 0}
    ).sort("category", 1).to_list(500)
    return products


@app.post("/pos/products")
async def create_product(request: Request, user=Depends(get_current_user)):
    data = await request.json()
    venue_id = data.get("venue_id")
    if not venue_id:
        raise HTTPException(400, "venue_id required")
    await _require_venue_owner(venue_id, user)

    product = {
        "id": str(uuid.uuid4()), "venue_id": venue_id,
        "name": data.get("name", "").strip(),
        "category": data.get("category", "other"),
        "price": float(data.get("price", 0)),
        "stock": int(data.get("stock", -1)),
        "is_active": True,
        "emoji": data.get("emoji", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if not product["name"]:
        raise HTTPException(400, "Product name required")
    await db.pos_products.insert_one(product)
    product.pop("_id", None)
    return product


@app.put("/pos/products/{product_id}")
async def update_product(product_id: str, request: Request, user=Depends(get_current_user)):
    product = await db.pos_products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Product not found")
    await _require_venue_owner(product["venue_id"], user)

    data = await request.json()
    allowed = ["name", "category", "price", "stock", "is_active", "emoji"]
    updates = {k: v for k, v in data.items() if k in allowed}
    if "price" in updates:
        updates["price"] = float(updates["price"])
    if "stock" in updates:
        updates["stock"] = int(updates["stock"])
    if updates:
        await db.pos_products.update_one({"id": product_id}, {"$set": updates})
    return await db.pos_products.find_one({"id": product_id}, {"_id": 0})


@app.delete("/pos/products/{product_id}")
async def delete_product(product_id: str, user=Depends(get_current_user)):
    product = await db.pos_products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Product not found")
    await _require_venue_owner(product["venue_id"], user)
    await db.pos_products.delete_one({"id": product_id})
    return {"message": "Product deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# SALES
# ═══════════════════════════════════════════════════════════════════════════════

async def _insert_sale(data: dict, user: dict) -> dict:
    venue_id = data.get("venue_id")
    if not venue_id:
        raise HTTPException(400, "venue_id required")
    await _require_venue_owner(venue_id, user)

    items = data.get("items", [])
    if not items:
        raise HTTPException(400, "items required")

    total = sum(float(i.get("price", 0)) * int(i.get("qty", 1)) for i in items)

    # Decrement finite stock
    for item in items:
        pid = item.get("product_id")
        qty = int(item.get("qty", 1))
        if pid:
            product = await db.pos_products.find_one({"id": pid})
            if product and product.get("stock", -1) >= 0:
                new_stock = max(0, product["stock"] - qty)
                await db.pos_products.update_one({"id": pid}, {"$set": {"stock": new_stock}})

    sale = {
        "id": data.get("offline_id") or str(uuid.uuid4()),
        "venue_id": venue_id,
        "served_by": user["id"],
        "served_by_name": user.get("name", ""),
        "items": items,
        "total": total,
        "payment_method": data.get("payment_method", "cash"),
        "note": data.get("note", ""),
        "offline_at": data.get("offline_at"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    # Upsert to handle duplicate offline sync
    existing = await db.pos_sales.find_one({"id": sale["id"]})
    if not existing:
        await db.pos_sales.insert_one(sale)
    sale.pop("_id", None)
    return sale


@app.post("/pos/sales")
async def record_sale(request: Request, user=Depends(get_current_user)):
    """Record a single sale OR a batch of offline sales."""
    data = await request.json()
    if "batch" in data:
        results = []
        for sale_data in data["batch"]:
            result = await _insert_sale(sale_data, user)
            results.append(result)
        return {"synced": len(results), "sales": results}
    sale = await _insert_sale(data, user)
    return sale


@app.get("/pos/sales")
async def list_sales(venue_id: str, user=Depends(get_current_user), limit: int = 50):
    await _require_venue_owner(venue_id, user)
    sales = await db.pos_sales.find(
        {"venue_id": venue_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    return sales


@app.get("/pos/summary")
async def sales_summary(venue_id: str, user=Depends(get_current_user)):
    """Today's sales summary for the venue."""
    await _require_venue_owner(venue_id, user)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    all_sales = await db.pos_sales.find(
        {"venue_id": venue_id, "created_at": {"$regex": f"^{today}"}}, {"_id": 0}
    ).to_list(1000)

    total_revenue = sum(s.get("total", 0) for s in all_sales)
    total_items = sum(sum(i.get("qty", 1) for i in s.get("items", [])) for s in all_sales)
    by_method = {}
    for s in all_sales:
        m = s.get("payment_method", "cash")
        by_method[m] = by_method.get(m, 0) + s.get("total", 0)

    return {
        "today": today, "total_sales": len(all_sales),
        "total_revenue": total_revenue, "total_items_sold": total_items,
        "by_payment_method": by_method,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {"service": "pos", "status": "healthy", "port": 8008}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8008)
