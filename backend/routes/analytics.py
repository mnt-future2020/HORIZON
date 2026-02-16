from fastapi import APIRouter, HTTPException, Depends
from database import db
from auth import get_current_user

router = APIRouter()


@router.get("/analytics/venue/{venue_id}")
async def venue_analytics(venue_id: str, user=Depends(get_current_user)):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(404, "Venue not found")
    bookings = await db.bookings.find({"venue_id": venue_id}, {"_id": 0}).to_list(500)
    total_revenue = sum(b.get("total_amount", 0) for b in bookings if b.get("status") in ["confirmed", "completed"])
    confirmed = [b for b in bookings if b.get("status") in ["confirmed", "completed"]]
    cancelled = [b for b in bookings if b.get("status") == "cancelled"]
    sports_breakdown = {}
    for b in confirmed:
        s = b.get("sport", "other")
        sports_breakdown[s] = sports_breakdown.get(s, 0) + 1
    daily_revenue = {}
    for b in confirmed:
        d = b.get("date", "unknown")
        daily_revenue[d] = daily_revenue.get(d, 0) + b.get("total_amount", 0)
    return {
        "total_bookings": len(bookings), "confirmed_bookings": len(confirmed),
        "cancelled_bookings": len(cancelled), "total_revenue": total_revenue,
        "avg_booking_value": total_revenue // max(len(confirmed), 1),
        "sports_breakdown": sports_breakdown,
        "daily_revenue": [{"date": k, "revenue": v} for k, v in sorted(daily_revenue.items())]
    }


@router.get("/analytics/player")
async def player_analytics(user=Depends(get_current_user)):
    bookings = await db.bookings.find(
        {"$or": [{"host_id": user["id"]}, {"players": user["id"]}]}, {"_id": 0}
    ).to_list(200)
    total_spent = sum(b.get("total_amount", 0) for b in bookings if b.get("status") in ["confirmed", "completed"])
    sports_played = {}
    for b in bookings:
        s = b.get("sport", "other")
        sports_played[s] = sports_played.get(s, 0) + 1
    return {
        "total_games": len(bookings), "total_spent": total_spent,
        "skill_rating": user.get("skill_rating", 1500),
        "reliability_score": user.get("reliability_score", 100),
        "wins": user.get("wins", 0), "losses": user.get("losses", 0),
        "draws": user.get("draws", 0), "sports_played": sports_played
    }
