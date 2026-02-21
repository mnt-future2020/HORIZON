"""
ML Dynamic Pricing Routes
Exposes ML pricing predictions and model training endpoints.
"""
from fastapi import APIRouter, HTTPException, Depends
from auth import get_current_user
from services.pricing_ml import get_ml_price, train_venue_model, get_demand_forecast
from database import db
import logging

router = APIRouter(prefix="/pricing", tags=["pricing"])
logger = logging.getLogger("horizon")


@router.get("/ml-suggest")
async def get_ml_suggestion(
    venue_id: str, date: str, start_time: str, turf_number: int = 1,
    user=Depends(get_current_user)
):
    """Get ML-suggested price for a specific slot."""
    result = await get_ml_price(venue_id, date, start_time, turf_number)
    return result


@router.get("/demand-forecast")
async def get_forecast(venue_id: str, date: str, user=Depends(get_current_user)):
    """Get demand forecast for all slots on a given date."""
    if user["role"] not in ("venue_owner", "super_admin"):
        raise HTTPException(403, "Only venue owners and admins can access demand forecasts")
    forecasts = await get_demand_forecast(venue_id, date)
    return {"venue_id": venue_id, "date": date, "forecasts": forecasts}


@router.post("/train-model")
async def train_model(venue_id: str, user=Depends(get_current_user)):
    """Train ML pricing model for a venue. Requires sufficient historical data."""
    if user["role"] not in ("venue_owner", "super_admin"):
        raise HTTPException(403, "Only venue owners and admins can train pricing models")

    # Verify venue ownership
    if user["role"] == "venue_owner":
        venue = await db.venues.find_one({"id": venue_id}, {"owner_id": 1})
        if not venue or venue.get("owner_id") != user["id"]:
            raise HTTPException(403, "Not authorized for this venue")

    success = await train_venue_model(venue_id)
    if success:
        return {"message": "ML pricing model trained successfully", "status": "trained"}
    else:
        return {
            "message": "Insufficient data for ML training. Need at least 50 confirmed bookings.",
            "status": "insufficient_data"
        }


@router.get("/pricing-mode")
async def get_pricing_mode(venue_id: str, user=Depends(get_current_user)):
    """Get current pricing mode (rule-based or ML) for a venue."""
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "pricing_mode": 1})
    if not venue:
        raise HTTPException(404, "Venue not found")

    mode = venue.get("pricing_mode", "rule_based")
    return {"venue_id": venue_id, "pricing_mode": mode}


@router.put("/pricing-mode")
async def set_pricing_mode(venue_id: str, mode: str, user=Depends(get_current_user)):
    """Toggle between rule-based and ML pricing."""
    if user["role"] not in ("venue_owner", "super_admin"):
        raise HTTPException(403, "Only venue owners can change pricing mode")
    if mode not in ("rule_based", "ml"):
        raise HTTPException(400, "Mode must be 'rule_based' or 'ml'")
    if user["role"] == "venue_owner":
        venue = await db.venues.find_one({"id": venue_id}, {"owner_id": 1})
        if not venue or venue.get("owner_id") != user["id"]:
            raise HTTPException(403, "Not authorized for this venue")

    await db.venues.update_one({"id": venue_id}, {"$set": {"pricing_mode": mode}})
    return {"message": f"Pricing mode set to {mode}", "pricing_mode": mode}
