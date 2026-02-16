from fastapi import APIRouter, Depends
from database import db
from auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/venue/{venue_id}")
async def venue_analytics(venue_id: str, user=Depends(get_current_user)):
    bookings = await db.bookings.find({"venue_id": venue_id, "status": {"$in": ["confirmed", "completed"]}}, {"_id": 0}).to_list(1000)
    total_revenue = sum(b.get("total_amount", 0) for b in bookings)
    by_sport = {}
    by_day = {}
    for b in bookings:
        s = b.get("sport", "unknown")
        by_sport[s] = by_sport.get(s, 0) + 1
        d = b.get("date", "")
        by_day[d] = by_day.get(d, 0) + b.get("total_amount", 0)
    return {
        "total_bookings": len(bookings), "total_revenue": total_revenue,
        "by_sport": [{"sport": k, "count": v} for k, v in by_sport.items()],
        "revenue_by_day": [{"date": k, "revenue": v} for k, v in sorted(by_day.items())[-30:],]
    }


@router.get("/player")
async def player_analytics(user=Depends(get_current_user)):
    bookings = await db.bookings.find({"$or": [{"host_id": user["id"]}, {"players": user["id"]}]}, {"_id": 0}).to_list(500)
    total_spent = sum(b.get("total_amount", 0) for b in bookings if b.get("host_id") == user["id"])
    sports_played = {}
    for b in bookings:
        s = b.get("sport", "unknown")
        sports_played[s] = sports_played.get(s, 0) + 1
    return {
        "total_bookings": len(bookings), "total_spent": total_spent,
        "sports_played": sports_played,
        "wins": user.get("wins", 0), "losses": user.get("losses", 0),
        "draws": user.get("draws", 0)
    }
