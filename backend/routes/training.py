from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone
from database import db
from tz import now_ist
from auth import get_current_user
from models import TrainingLogCreate
import uuid

router = APIRouter()


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _get_coach_org(user, org_id: Optional[str] = None):
    """Get organization if org_id provided and user has access."""
    if not org_id:
        return None
    org = await db.organizations.find_one({"id": org_id, "status": "active"}, {"_id": 0})
    if not org:
        return None
    if org["owner_id"] != user["id"] and not any(s["user_id"] == user["id"] for s in org.get("staff", [])):
        return None
    return org


# ─── Training Log CRUD ───────────────────────────────────────────────────────

@router.post("/training/log")
async def create_training_log(input: TrainingLogCreate, org_id: Optional[str] = None, user=Depends(get_current_user)):
    if user["role"] not in ("coach", "super_admin"):
        raise HTTPException(403, "Only coaches can log training sessions")

    org = await _get_coach_org(user, org_id)

    # Resolve player names
    attendance = []
    for pid in input.player_ids:
        player = await db.users.find_one({"id": pid}, {"_id": 0, "id": 1, "name": 1})
        if player:
            attendance.append({
                "player_id": pid,
                "player_name": player.get("name", ""),
                "present": True,
                "performance_note": input.performance_notes.get(pid, "")
            })

    log = {
        "id": str(uuid.uuid4()),
        "coach_id": user["id"],
        "coach_name": user.get("name", ""),
        "organization_id": org["id"] if org else None,
        "organization_name": org["name"] if org else None,
        "title": input.title,
        "sport": input.sport,
        "date": input.date,
        "duration_minutes": input.duration_minutes,
        "drills": input.drills,
        "attendance": attendance,
        "notes": input.notes,
        "total_players": len(attendance),
        "present_count": len(attendance),
        "created_at": now_ist().isoformat()
    }
    await db.training_logs.insert_one(log)
    log.pop("_id", None)

    # Auto-create performance records for each present player
    now = now_ist().isoformat()
    for att in attendance:
        if att["present"]:
            record = {
                "id": str(uuid.uuid4()),
                "player_id": att["player_id"],
                "player_name": att["player_name"],
                "record_type": "training",
                "sport": input.sport,
                "title": input.title,
                "stats": {
                    "duration_minutes": input.duration_minutes,
                    "drills": input.drills,
                },
                "notes": att.get("performance_note", ""),
                "source_type": "organization" if org else "coach",
                "source_id": user["id"],
                "source_name": org["name"] if org else user.get("name", ""),
                "organization_id": org["id"] if org else None,
                "tournament_id": None,
                "session_id": log["id"],
                "date": input.date,
                "verified": True,
                "created_at": now
            }
            await db.performance_records.insert_one(record)

    # Update org stats
    if org:
        await db.organizations.update_one(
            {"id": org["id"]},
            {"$inc": {"stats.total_training_sessions": 1, "stats.total_records": len(attendance)}}
        )

    return log


@router.get("/training/logs")
async def list_training_logs(
    org_id: Optional[str] = None,
    sport: Optional[str] = None,
    limit: int = 50,
    user=Depends(get_current_user)
):
    query = {"coach_id": user["id"]}
    if org_id:
        query["organization_id"] = org_id
    if sport:
        query["sport"] = sport

    logs = await db.training_logs.find(
        query, {"_id": 0}
    ).sort("date", -1).to_list(limit)
    return logs


@router.get("/training/logs/{log_id}")
async def get_training_log(log_id: str, user=Depends(get_current_user)):
    log = await db.training_logs.find_one({"id": log_id}, {"_id": 0})
    if not log:
        raise HTTPException(404, "Training log not found")
    if log["coach_id"] != user["id"] and user["role"] != "super_admin":
        # Check if user is staff of the org
        if log.get("organization_id"):
            org = await db.organizations.find_one({"id": log["organization_id"]}, {"_id": 0})
            if not org or not any(s["user_id"] == user["id"] for s in org.get("staff", [])):
                raise HTTPException(403, "Access denied")
        else:
            raise HTTPException(403, "Access denied")
    return log


@router.put("/training/logs/{log_id}")
async def update_training_log(log_id: str, request: dict, user=Depends(get_current_user)):
    log = await db.training_logs.find_one({"id": log_id}, {"_id": 0})
    if not log:
        raise HTTPException(404, "Training log not found")
    if log["coach_id"] != user["id"]:
        raise HTTPException(403, "Only the creator can update this log")

    allowed = ["title", "notes", "drills", "duration_minutes"]
    updates = {k: v for k, v in request.items() if k in allowed}
    if updates:
        await db.training_logs.update_one({"id": log_id}, {"$set": updates})
    updated = await db.training_logs.find_one({"id": log_id}, {"_id": 0})
    return updated


@router.get("/training/player/{player_id}")
async def player_training_history(player_id: str, limit: int = 30, user=Depends(get_current_user)):
    logs = await db.training_logs.find(
        {"attendance.player_id": player_id}, {"_id": 0}
    ).sort("date", -1).to_list(limit)
    return logs


@router.get("/training/stats")
async def training_stats(org_id: Optional[str] = None, user=Depends(get_current_user)):
    query = {"coach_id": user["id"]}
    if org_id:
        query["organization_id"] = org_id

    total_sessions = await db.training_logs.count_documents(query)
    logs = await db.training_logs.find(query, {"_id": 0, "duration_minutes": 1, "present_count": 1, "total_players": 1}).to_list(500)

    total_hours = sum(l.get("duration_minutes", 0) for l in logs) / 60
    total_attendance = sum(l.get("present_count", 0) for l in logs)
    total_expected = sum(l.get("total_players", 0) for l in logs)
    attendance_rate = round((total_attendance / total_expected * 100), 1) if total_expected > 0 else 0

    return {
        "total_sessions": total_sessions,
        "total_hours": round(total_hours, 1),
        "total_player_attendances": total_attendance,
        "attendance_rate": attendance_rate
    }
