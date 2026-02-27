from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone
from database import db
from tz import now_ist
from auth import get_current_user
from models import PerformanceRecordCreate, BulkRecordCreate
import uuid

router = APIRouter()


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _can_submit_for_player(user, player_id: str) -> tuple:
    """Check if user can submit records for a player. Returns (allowed, source_type, source_id, source_name, org_id)."""
    # Super admins can always submit
    if user["role"] == "super_admin":
        return True, "system", user["id"], "System Admin", None

    # Check if player is in any of user's organizations
    orgs = await db.organizations.find(
        {"$or": [
            {"owner_id": user["id"]},
            {"staff.user_id": user["id"]}
        ], "players.user_id": player_id, "status": "active"},
        {"_id": 0, "id": 1, "name": 1}
    ).to_list(10)
    if orgs:
        return True, "organization", user["id"], user.get("name", ""), orgs[0]["id"]

    # Check if user has coaching sessions with this player
    session = await db.coaching_sessions.find_one(
        {"coach_id": user["id"], "player_id": player_id, "status": {"$in": ["confirmed", "completed"]}},
        {"_id": 0}
    )
    if session:
        return True, "coach", user["id"], user.get("name", ""), None

    return False, None, None, None, None


# ─── CRUD ─────────────────────────────────────────────────────────────────────

@router.post("/performance/records")
async def create_record(input: PerformanceRecordCreate, user=Depends(get_current_user)):
    if input.record_type not in ("match_result", "training", "assessment", "tournament_result", "achievement"):
        raise HTTPException(400, "Invalid record_type")

    allowed, source_type, source_id, source_name, org_id = await _can_submit_for_player(user, input.player_id)
    if not allowed:
        raise HTTPException(403, "You can only submit records for players in your organization or coaching sessions")

    player = await db.users.find_one({"id": input.player_id}, {"_id": 0, "id": 1, "name": 1})
    if not player:
        raise HTTPException(404, "Player not found")

    record = {
        "id": str(uuid.uuid4()),
        "player_id": input.player_id,
        "player_name": player.get("name", ""),
        "record_type": input.record_type,
        "sport": input.sport,
        "title": input.title,
        "stats": input.stats,
        "notes": input.notes,
        "source_type": source_type,
        "source_id": source_id,
        "source_name": source_name,
        "organization_id": org_id,
        "tournament_id": None,
        "session_id": None,
        "date": input.date,
        "verified": True,
        "created_at": now_ist().isoformat()
    }
    await db.performance_records.insert_one(record)
    record.pop("_id", None)

    # Update org stats if applicable
    if org_id:
        await db.organizations.update_one({"id": org_id}, {"$inc": {"stats.total_records": 1}})

    return record


@router.post("/performance/records/bulk")
async def create_bulk_records(input: BulkRecordCreate, user=Depends(get_current_user)):
    if not input.player_ids:
        raise HTTPException(400, "At least one player_id required")

    created = []
    for pid in input.player_ids:
        allowed, source_type, source_id, source_name, org_id = await _can_submit_for_player(user, pid)
        if not allowed:
            continue

        player = await db.users.find_one({"id": pid}, {"_id": 0, "id": 1, "name": 1})
        if not player:
            continue

        record = {
            "id": str(uuid.uuid4()),
            "player_id": pid,
            "player_name": player.get("name", ""),
            "record_type": input.record_type,
            "sport": input.sport,
            "title": input.title,
            "stats": input.stats,
            "notes": "",
            "source_type": source_type,
            "source_id": source_id,
            "source_name": source_name,
            "organization_id": org_id,
            "tournament_id": None,
            "session_id": None,
            "date": input.date,
            "verified": True,
            "created_at": now_ist().isoformat()
        }
        await db.performance_records.insert_one(record)
        record.pop("_id", None)
        created.append(record)

    return {"created": len(created), "records": created}


@router.get("/performance/records/{player_id}")
async def get_player_records(
    player_id: str,
    record_type: Optional[str] = None,
    sport: Optional[str] = None,
    limit: int = 50,
    user=Depends(get_current_user)
):
    query = {"player_id": player_id}
    if record_type:
        query["record_type"] = record_type
    if sport:
        query["sport"] = sport

    records = await db.performance_records.find(
        query, {"_id": 0}
    ).sort("date", -1).to_list(limit)
    return records


@router.get("/performance/records/{player_id}/summary")
async def get_player_summary(player_id: str, user=Depends(get_current_user)):
    records = await db.performance_records.find(
        {"player_id": player_id}, {"_id": 0}
    ).to_list(500)

    if not records:
        return {
            "total_records": 0, "records_by_type": {}, "records_by_sport": {},
            "records_by_source": [], "organizations": [],
            "tournaments_played": 0, "tournament_wins": 0,
            "training_sessions_attended": 0, "training_hours": 0,
            "recent_records": [], "monthly_activity": []
        }

    by_type = {}
    by_sport = {}
    by_source = {}
    tournament_ids = set()
    tournament_wins = 0
    training_count = 0
    training_minutes = 0
    monthly = {}

    for r in records:
        rt = r.get("record_type", "other")
        by_type[rt] = by_type.get(rt, 0) + 1

        sp = r.get("sport", "other")
        by_sport[sp] = by_sport.get(sp, 0) + 1

        sn = r.get("source_name", "Unknown")
        if sn not in by_source:
            by_source[sn] = 0
        by_source[sn] += 1

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

    # Get player's organizations
    orgs = await db.organizations.find(
        {"players.user_id": player_id, "status": "active"},
        {"_id": 0, "id": 1, "name": 1, "org_type": 1, "logo_url": 1}
    ).to_list(20)

    source_list = [{"source_name": k, "count": v} for k, v in by_source.items()]
    source_list.sort(key=lambda x: x["count"], reverse=True)

    monthly_list = [{"month": k, "records": v} for k, v in sorted(monthly.items())]

    return {
        "total_records": len(records),
        "records_by_type": by_type,
        "records_by_sport": by_sport,
        "records_by_source": source_list,
        "organizations": orgs,
        "tournaments_played": len(tournament_ids),
        "tournament_wins": tournament_wins,
        "training_sessions_attended": training_count,
        "training_hours": round(training_minutes / 60, 1),
        "recent_records": records[:10],
        "monthly_activity": monthly_list[-12:]
    }


@router.get("/performance/my-records")
async def my_records(
    record_type: Optional[str] = None,
    sport: Optional[str] = None,
    limit: int = 50,
    user=Depends(get_current_user)
):
    query = {"player_id": user["id"]}
    if record_type:
        query["record_type"] = record_type
    if sport:
        query["sport"] = sport

    records = await db.performance_records.find(
        query, {"_id": 0}
    ).sort("date", -1).to_list(limit)
    return records


@router.delete("/performance/records/{record_id}")
async def delete_record(record_id: str, user=Depends(get_current_user)):
    record = await db.performance_records.find_one({"id": record_id}, {"_id": 0})
    if not record:
        raise HTTPException(404, "Record not found")
    if record.get("source_id") != user["id"] and user["role"] != "super_admin":
        raise HTTPException(403, "Only the record creator can delete it")

    await db.performance_records.delete_one({"id": record_id})
    return {"message": "Record deleted"}
