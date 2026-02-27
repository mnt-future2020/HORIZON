from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional, List
from datetime import datetime, timezone
from database import db
from tz import now_ist
from auth import get_current_user
import uuid

router = APIRouter(prefix="/pos", tags=["pos"])


# ─── Helpers ───────────────────────────────────────────────────────────────────

async def _require_venue_owner(venue_id: str, user: dict):
    """Assert the user owns this venue (or is super_admin)."""
    if user["role"] == "super_admin":
        return
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "owner_id": 1})
    if not venue:
        raise HTTPException(404, "Venue not found")
    if venue["owner_id"] != user["id"]:
        raise HTTPException(403, "Not authorized for this venue")


# ─── Products ──────────────────────────────────────────────────────────────────

@router.get("/products")
async def list_products(venue_id: str, user=Depends(get_current_user)):
    """List all POS products for a venue."""
    await _require_venue_owner(venue_id, user)
    products = await db.pos_products.find(
        {"venue_id": venue_id}, {"_id": 0}
    ).sort("category", 1).to_list(500)
    return products


@router.post("/products")
async def create_product(request: Request, user=Depends(get_current_user)):
    data = await request.json()
    venue_id = data.get("venue_id")
    if not venue_id:
        raise HTTPException(400, "venue_id required")
    await _require_venue_owner(venue_id, user)
    product = {
        "id": str(uuid.uuid4()),
        "venue_id": venue_id,
        "name": data.get("name", "").strip(),
        "category": data.get("category", "other"),
        "price": float(data.get("price", 0)),
        "stock": int(data.get("stock", -1)),    # -1 = unlimited
        "is_active": True,
        "emoji": data.get("emoji", "🛒"),
        "created_at": now_ist().isoformat(),
    }
    if not product["name"]:
        raise HTTPException(400, "Product name required")
    await db.pos_products.insert_one(product)
    product.pop("_id", None)
    return product


@router.put("/products/{product_id}")
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
    updated = await db.pos_products.find_one({"id": product_id}, {"_id": 0})
    return updated


@router.delete("/products/{product_id}")
async def delete_product(product_id: str, user=Depends(get_current_user)):
    product = await db.pos_products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Product not found")
    await _require_venue_owner(product["venue_id"], user)
    await db.pos_products.delete_one({"id": product_id})
    return {"message": "Product deleted"}


# ─── Sales ─────────────────────────────────────────────────────────────────────

@router.post("/sales")
async def record_sale(request: Request, user=Depends(get_current_user)):
    """Record a single sale OR a batch of offline sales."""
    data = await request.json()

    # Support batch (offline sync): if 'batch' key exists, process array
    if "batch" in data:
        results = []
        for sale_data in data["batch"]:
            result = await _insert_sale(sale_data, user)
            results.append(result)
        return {"synced": len(results), "sales": results}

    sale = await _insert_sale(data, user)
    return sale


async def _insert_sale(data: dict, user: dict) -> dict:
    venue_id = data.get("venue_id")
    if not venue_id:
        raise HTTPException(400, "venue_id required")
    await _require_venue_owner(venue_id, user)

    items = data.get("items", [])
    if not items:
        raise HTTPException(400, "items required")

    subtotal = sum(float(i.get("price", 0)) * int(i.get("qty", 1)) for i in items)

    # Discount handling
    discount_type = data.get("discount_type")  # "percent" or "flat"
    discount_value = float(data.get("discount_value", 0))
    discount_amount = 0.0
    if discount_type == "percent" and 0 < discount_value <= 100:
        discount_amount = round(subtotal * discount_value / 100, 2)
    elif discount_type == "flat" and discount_value > 0:
        discount_amount = min(round(discount_value, 2), subtotal)
    total = round(subtotal - discount_amount, 2)

    sale = {
        "id": data.get("offline_id") or str(uuid.uuid4()),   # honour offline ID for idempotency
        "venue_id": venue_id,
        "served_by": user["id"],
        "served_by_name": user.get("name", ""),
        "items": items,
        "subtotal": subtotal,
        "discount_type": discount_type,
        "discount_value": discount_value if discount_type else 0,
        "discount_amount": discount_amount,
        "total": total,
        "payment_method": data.get("payment_method", "cash"),
        "note": data.get("note", ""),
        "customer_name": data.get("customer_name", ""),
        "customer_phone": data.get("customer_phone", ""),
        "offline_at": data.get("offline_at"),   # original timestamp if offline sale
        "created_at": now_ist().isoformat(),
    }
    # Idempotency check BEFORE stock decrement to avoid double-decrement
    existing = await db.pos_sales.find_one({"id": sale["id"]})
    if not existing:
        # Decrement finite stock atomically
        for item in items:
            pid = item.get("product_id")
            qty = int(item.get("qty", 1))
            if pid:
                await db.pos_products.update_one(
                    {"id": pid, "stock": {"$gte": 0}},
                    {"$inc": {"stock": -qty}}
                )
                # Clamp to zero if it went negative
                await db.pos_products.update_one(
                    {"id": pid, "stock": {"$lt": 0}},
                    {"$set": {"stock": 0}}
                )
        await db.pos_sales.insert_one(sale)
    sale.pop("_id", None)
    return sale


@router.get("/sales")
async def list_sales(
    venue_id: str,
    user=Depends(get_current_user),
    limit: int = 50,
):
    await _require_venue_owner(venue_id, user)
    sales = await db.pos_sales.find(
        {"venue_id": venue_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    return sales


@router.get("/summary")
async def sales_summary(venue_id: str, user=Depends(get_current_user)):
    """Today's sales summary for the venue."""
    await _require_venue_owner(venue_id, user)
    today = now_ist().strftime("%Y-%m-%d")
    # All sales for today
    all_sales = await db.pos_sales.find(
        {"venue_id": venue_id, "created_at": {"$regex": f"^{today}"}},
        {"_id": 0}
    ).to_list(1000)
    total_revenue = sum(s.get("total", 0) for s in all_sales)
    total_items = sum(sum(i.get("qty", 1) for i in s.get("items", [])) for s in all_sales)
    by_method = {}
    for s in all_sales:
        m = s.get("payment_method", "cash")
        by_method[m] = by_method.get(m, 0) + s.get("total", 0)
    return {
        "today": today,
        "total_sales": len(all_sales),
        "total_revenue": total_revenue,
        "total_items_sold": total_items,
        "by_payment_method": by_method,
    }


@router.get("/report")
async def daily_report(venue_id: str, date: str, user=Depends(get_current_user)):
    """Return all sales for a venue on a specific date for CSV export."""
    await _require_venue_owner(venue_id, user)
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD")

    all_sales = await db.pos_sales.find(
        {"venue_id": venue_id, "created_at": {"$regex": f"^{date}"}},
        {"_id": 0}
    ).sort("created_at", 1).to_list(5000)

    total_revenue = sum(s.get("total", 0) for s in all_sales)
    total_items = sum(sum(i.get("qty", 1) for i in s.get("items", [])) for s in all_sales)

    return {
        "date": date,
        "venue_id": venue_id,
        "total_sales": len(all_sales),
        "total_revenue": total_revenue,
        "total_items_sold": total_items,
        "sales": all_sales,
    }
