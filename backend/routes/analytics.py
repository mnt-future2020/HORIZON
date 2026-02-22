from fastapi import APIRouter, HTTPException, Depends
from database import db
from auth import get_current_user

router = APIRouter()


@router.get("/analytics/venue/{venue_id}")
async def venue_analytics(venue_id: str, user=Depends(get_current_user)):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(404, "Venue not found")
    if user.get("role") != "super_admin" and venue.get("owner_id") != user["id"]:
        raise HTTPException(403, "Not authorized to view this venue's analytics")
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


@router.get("/analytics/player/{player_id}/career")
async def player_career(player_id: str, user=Depends(get_current_user)):
    """Aggregated career data from all performance records."""
    records = await db.performance_records.find(
        {"player_id": player_id}, {"_id": 0}
    ).sort("date", -1).to_list(500)

    if not records:
        return {
            "total_records": 0, "records_by_type": {}, "records_by_sport": {},
            "records_by_source": [], "organizations": [],
            "tournaments_played": 0, "tournament_wins": 0,
            "training_sessions_attended": 0, "training_hours": 0,
            "recent_records": [], "monthly_activity": []
        }

    by_type, by_sport, by_source = {}, {}, {}
    tournament_ids, tournament_wins = set(), 0
    training_count, training_minutes = 0, 0
    monthly = {}

    for r in records:
        rt = r.get("record_type", "other")
        by_type[rt] = by_type.get(rt, 0) + 1
        sp = r.get("sport", "other")
        by_sport[sp] = by_sport.get(sp, 0) + 1
        sn = r.get("source_name", "Unknown")
        by_source[sn] = by_source.get(sn, 0) + 1

        if rt == "tournament_result":
            tid = r.get("tournament_id")
            if tid:
                tournament_ids.add(tid)
            if r.get("stats", {}).get("result") == "win":
                tournament_wins += 1
        if rt == "training":
            training_count += 1
            training_minutes += r.get("stats", {}).get("duration_minutes", 0)

        month = r.get("date", "")[:7]
        if month:
            monthly[month] = monthly.get(month, 0) + 1

    orgs = await db.organizations.find(
        {"players.user_id": player_id, "status": "active"},
        {"_id": 0, "id": 1, "name": 1, "org_type": 1, "logo_url": 1}
    ).to_list(20)

    source_list = sorted(
        [{"source_name": k, "count": v} for k, v in by_source.items()],
        key=lambda x: x["count"], reverse=True
    )
    monthly_list = [{"month": k, "records": v} for k, v in sorted(monthly.items())]

    training_hours_val = round(training_minutes / 60, 1)
    return {
        "total_records": len(records),
        "records_by_type": by_type,
        "records_by_sport": by_sport,
        "records_by_source": source_list,
        "organizations": orgs,
        "tournaments_played": len(tournament_ids),
        "tournament_wins": tournament_wins,
        "training_sessions_attended": training_count,
        "training_hours": training_hours_val,
        "recent_records": records[:10],
        "monthly_activity": monthly_list[-12:]
    }


@router.get("/analytics/player/{player_id}/overall-score")
async def player_overall_score(player_id: str, user=Depends(get_current_user)):
    """Calculate unified overall skill score (0-100) for a player."""
    target = await db.users.find_one({"id": player_id}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(404, "Player not found")

    sr = target.get("skill_rating", 1500)
    skill_score = max(0, min(100, (sr - 1000) / 15))

    wins = target.get("wins", 0)
    losses = target.get("losses", 0)
    draws = target.get("draws", 0)
    played = wins + losses + draws
    win_rate_score = (wins / played * 100) if played > 0 else 0

    total_games = target.get("total_games", 0)

    records = await db.performance_records.find(
        {"player_id": player_id}, {"_id": 0, "record_type": 1, "tournament_id": 1, "stats": 1}
    ).to_list(500)
    t_ids = set()
    t_wins = 0
    train_mins = 0
    for r in records:
        if r.get("record_type") == "tournament_result":
            tid = r.get("tournament_id")
            if tid:
                t_ids.add(tid)
            if r.get("stats", {}).get("result") == "win":
                t_wins += 1
        if r.get("record_type") == "training":
            train_mins += r.get("stats", {}).get("duration_minutes", 0)

    tournament_score = min(100, len(t_ids) * 8 + t_wins * 12)
    training_score = min(100, (train_mins / 60) * 4)
    reliability = target.get("reliability_score", 100)
    experience_score = min(100, total_games * 2)

    overall = round(
        skill_score * 0.40 + win_rate_score * 0.20 + tournament_score * 0.15 +
        training_score * 0.10 + reliability * 0.10 + experience_score * 0.05
    )
    overall = max(0, min(100, overall))

    if overall >= 86:
        tier = "Elite"
    elif overall >= 71:
        tier = "Pro"
    elif overall >= 51:
        tier = "Advanced"
    elif overall >= 31:
        tier = "Intermediate"
    else:
        tier = "Beginner"

    return {
        "overall_score": overall,
        "tier": tier,
        "breakdown": {
            "skill": round(skill_score),
            "win_rate": round(win_rate_score),
            "tournament": round(tournament_score),
            "training": round(training_score),
            "reliability": round(reliability),
            "experience": round(experience_score),
        }
    }
