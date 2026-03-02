from fastapi import APIRouter, HTTPException, Depends
from database import db
from auth import get_current_user
from datetime import datetime, timedelta
from tz import now_ist, IST

router = APIRouter()

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


@router.get("/analytics/venue/{venue_id}/insights")
async def venue_insights(venue_id: str, days: int = 90, user=Depends(get_current_user)):
    """Booking analytics insights — heatmap, occupancy, key stats, actionable text.
    days=0 means all-time (no date filter).
    """
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(404, "Venue not found")
    if user.get("role") not in ("super_admin",) and venue.get("owner_id") != user["id"]:
        raise HTTPException(403, "Not authorized")

    query: dict = {"venue_id": venue_id}
    if days > 0:
        since_str = (now_ist() - timedelta(days=days)).strftime("%Y-%m-%d")
        query["date"] = {"$gte": since_str}

    period_label = f"{days} days" if days > 0 else "all time"

    bookings = await db.bookings.find(
        query,
        {"_id": 0, "status": 1, "date": 1, "start_time": 1, "end_time": 1,
         "turf_number": 1, "sport": 1, "total_amount": 1, "host_id": 1, "created_at": 1},
    ).to_list(5000)

    confirmed = [b for b in bookings if b.get("status") in ("confirmed", "completed")]
    cancelled  = [b for b in bookings if b.get("status") == "cancelled"]

    # ── Heatmap: booking count per (hour, dow) ──────────────────────────────
    freq: dict = {}
    for b in confirmed:
        try:
            h = int(b.get("start_time", "12:00").split(":")[0])
        except (ValueError, IndexError):
            h = 12
        try:
            dow = datetime.strptime(b.get("date", "2025-01-01"), "%Y-%m-%d").weekday()
        except ValueError:
            dow = 0
        key = f"{h}_{dow}"
        freq[key] = freq.get(key, 0) + 1

    heatmap = [
        {"hour": int(k.split("_")[0]), "dow": int(k.split("_")[1]), "count": v}
        for k, v in freq.items()
    ]

    # ── Per-turf heatmap ────────────────────────────────────────────────────
    freq_by_turf: dict = {}
    for b in confirmed:
        try:
            h = int(b.get("start_time", "12:00").split(":")[0])
        except (ValueError, IndexError):
            h = 12
        try:
            dow = datetime.strptime(b.get("date", "2025-01-01"), "%Y-%m-%d").weekday()
        except ValueError:
            dow = 0
        t = b.get("turf_number", 1)
        key = f"{h}_{dow}"
        if t not in freq_by_turf:
            freq_by_turf[t] = {}
        freq_by_turf[t][key] = freq_by_turf[t].get(key, 0) + 1

    heatmap_by_turf = {
        str(t): [
            {"hour": int(k.split("_")[0]), "dow": int(k.split("_")[1]), "count": v}
            for k, v in tfreq.items()
        ]
        for t, tfreq in freq_by_turf.items()
    }

    # ── Turf list from venue config ─────────────────────────────────────────
    turf_list = []
    turf_config = venue.get("turf_config", [])
    if turf_config:
        idx = 1
        for tc in turf_config:
            for t in tc.get("turfs", []):
                turf_list.append({
                    "turf_number": idx,
                    "name": t.get("name", f"Turf {idx}"),
                    "sport": tc.get("sport", ""),
                })
                idx += 1
    else:
        for i in range(1, venue.get("turfs", 1) + 1):
            turf_list.append({"turf_number": i, "name": f"Turf {i}", "sport": ""})

    # ── Occupancy per turf ───────────────────────────────────────────────────
    slot_min   = venue.get("slot_duration_minutes", 60)
    open_h     = venue.get("opening_hour", 6)
    close_h    = venue.get("closing_hour", 23)
    slots_per_day = (close_h - open_h) * 60 // slot_min
    days_in_period = days if days > 0 else 365

    turf_bookings: dict = {}
    for b in confirmed:
        t = b.get("turf_number", 1)
        turf_bookings[t] = turf_bookings.get(t, 0) + 1

    total_slots_per_turf = slots_per_day * days_in_period
    occupancy_by_turf = {
        str(t): round(cnt / max(total_slots_per_turf, 1) * 100, 1)
        for t, cnt in turf_bookings.items()
    }
    avg_occupancy = round(
        sum(occupancy_by_turf.values()) / max(len(occupancy_by_turf), 1), 1
    ) if occupancy_by_turf else 0.0

    # ── Cancellation rate — denominator = confirmed + cancelled only ─────────
    decided = len(confirmed) + len(cancelled)
    cancellation_rate = round(len(cancelled) / max(decided, 1) * 100, 1)

    # ── Repeat customer rate ────────────────────────────────────────────────
    user_counts: dict = {}
    for b in confirmed:
        uid = b.get("host_id", "")
        if uid:
            user_counts[uid] = user_counts.get(uid, 0) + 1
    total_unique = len(user_counts)
    repeat_users = sum(1 for c in user_counts.values() if c > 1)
    repeat_customer_rate = round(repeat_users / max(total_unique, 1) * 100, 1)

    # ── Average lead time (days between booking creation and slot date) ─────
    lead_times = []
    for b in confirmed:
        try:
            slot_date = datetime.strptime(b["date"], "%Y-%m-%d").replace(tzinfo=IST)
            created   = b.get("created_at")
            if isinstance(created, str):
                created = datetime.fromisoformat(created.replace("Z", "+05:30"))
            if created and slot_date > created:
                lead_times.append((slot_date - created).days)
        except Exception:
            pass
    avg_lead_time = round(sum(lead_times) / max(len(lead_times), 1), 1)

    # ── Revenue by sport / turf ─────────────────────────────────────────────
    revenue_by_sport: dict = {}
    revenue_by_turf: dict = {}
    for b in confirmed:
        amt = b.get("total_amount", 0)
        revenue_by_sport[b.get("sport", "other")] = revenue_by_sport.get(b.get("sport", "other"), 0) + amt
        tk = str(b.get("turf_number", 1))
        revenue_by_turf[tk] = revenue_by_turf.get(tk, 0) + amt

    # ── Insights ─────────────────────────────────────────────────────────────
    insights = []
    if heatmap:
        peak = max(heatmap, key=lambda x: x["count"])
        insights.append({
            "type": "peak",
            "text": f"Busiest slot: {peak['hour']:02d}:00 on {DAYS[peak['dow']]}s "
                    f"({peak['count']} bookings, {period_label})",
            "hour": peak["hour"],
            "dow": peak["dow"],
        })
        dead_candidates = [h for h in heatmap if h["count"] < peak["count"] * 0.3]
        if dead_candidates:
            dead = min(dead_candidates, key=lambda x: x["count"])
            insights.append({
                "type": "low",
                "text": f"Low bookings at {dead['hour']:02d}:00 on {DAYS[dead['dow']]}s "
                        f"— a discount or promotion could help",
                "hour": dead["hour"],
                "dow": dead["dow"],
            })

    if repeat_customer_rate >= 30:
        insights.append({
            "type": "loyalty",
            "text": f"{int(repeat_customer_rate)}% of your customers return — great retention!",
        })
    elif repeat_customer_rate < 15 and total_unique > 5:
        insights.append({
            "type": "loyalty",
            "text": "Most bookings are from new customers — consider a loyalty discount",
        })

    if cancellation_rate > 15:
        insights.append({
            "type": "warning",
            "text": f"High cancellation rate ({cancellation_rate}%) — consider a stricter policy",
        })

    return {
        "heatmap": heatmap,
        "occupancy_by_turf": occupancy_by_turf,
        "avg_occupancy": avg_occupancy,
        "cancellation_rate": cancellation_rate,
        "repeat_customer_rate": repeat_customer_rate,
        "avg_lead_time_days": avg_lead_time,
        "revenue_by_sport": revenue_by_sport,
        "revenue_by_turf": revenue_by_turf,
        "insights": insights,
        "heatmap_by_turf": heatmap_by_turf,
        "turf_list": turf_list,
        "confirmed_count": len(confirmed),
        "period_days": days,
    }


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
    if user["id"] != player_id and user.get("role") != "admin":
        raise HTTPException(403, "Not authorized to view this player's career data")
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
