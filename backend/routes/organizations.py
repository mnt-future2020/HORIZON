from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional
from datetime import datetime, timezone
from database import db
from auth import get_current_user
from models import OrganizationCreate
import uuid

router = APIRouter()


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _get_org_or_404(org_id: str):
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(404, "Organization not found")
    return org


def _is_org_member(org, user_id: str) -> bool:
    if org["owner_id"] == user_id:
        return True
    return any(s["user_id"] == user_id for s in org.get("staff", []))


def _require_org_access(org, user):
    if not _is_org_member(org, user["id"]):
        raise HTTPException(403, "You don't have access to this organization")


# ─── CRUD ─────────────────────────────────────────────────────────────────────

@router.post("/organizations")
async def create_organization(input: OrganizationCreate, user=Depends(get_current_user)):
    if user["role"] not in ("coach", "super_admin"):
        raise HTTPException(403, "Only coaches and admins can create organizations")

    if input.org_type not in ("individual_coach", "academy", "school", "college"):
        raise HTTPException(400, "org_type must be individual_coach, academy, school, or college")

    org = {
        "id": str(uuid.uuid4()),
        "name": input.name,
        "org_type": input.org_type,
        "owner_id": user["id"],
        "owner_name": user.get("name", ""),
        "sports": input.sports,
        "description": input.description,
        "location": input.location,
        "city": input.city,
        "logo_url": input.logo_url,
        "contact_email": input.contact_email or user.get("email", ""),
        "contact_phone": input.contact_phone or user.get("phone", ""),
        "staff": [{
            "user_id": user["id"],
            "name": user.get("name", ""),
            "role": "head_coach",
            "joined_at": datetime.now(timezone.utc).isoformat()
        }],
        "players": [],
        "player_count": 0,
        "staff_count": 1,
        "stats": {"total_records": 0, "total_training_sessions": 0, "tournaments_organized": 0},
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.organizations.insert_one(org)
    org.pop("_id", None)
    return org


@router.get("/organizations")
async def list_organizations(
    org_type: Optional[str] = None,
    sport: Optional[str] = None,
    city: Optional[str] = None,
    search: Optional[str] = None
):
    query = {"status": "active"}
    if org_type:
        query["org_type"] = org_type
    if sport:
        query["sports"] = sport
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    orgs = await db.organizations.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return orgs


@router.get("/organizations/my")
async def my_organizations(user=Depends(get_current_user)):
    orgs = await db.organizations.find(
        {"$or": [
            {"owner_id": user["id"]},
            {"staff.user_id": user["id"]}
        ], "status": "active"},
        {"_id": 0}
    ).to_list(50)
    return orgs


@router.get("/organizations/{org_id}")
async def get_organization(org_id: str):
    return await _get_org_or_404(org_id)


@router.put("/organizations/{org_id}")
async def update_organization(org_id: str, request: Request, user=Depends(get_current_user)):
    org = await _get_org_or_404(org_id)
    _require_org_access(org, user)

    data = await request.json()
    allowed = ["name", "description", "sports", "location", "city", "logo_url",
               "contact_email", "contact_phone"]
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        await db.organizations.update_one({"id": org_id}, {"$set": updates})
    updated = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    return updated


# ─── Staff Management ─────────────────────────────────────────────────────────

@router.post("/organizations/{org_id}/staff")
async def add_staff(org_id: str, request: Request, user=Depends(get_current_user)):
    org = await _get_org_or_404(org_id)
    if org["owner_id"] != user["id"]:
        raise HTTPException(403, "Only the organization owner can manage staff")

    data = await request.json()
    email = data.get("email", "").strip().lower()
    if not email:
        raise HTTPException(400, "Staff email is required")

    staff_user = await db.users.find_one({"email": email}, {"_id": 0, "id": 1, "name": 1, "role": 1})
    if not staff_user:
        raise HTTPException(404, "No user found with that email")

    if any(s["user_id"] == staff_user["id"] for s in org.get("staff", [])):
        raise HTTPException(409, "User is already staff")

    staff_entry = {
        "user_id": staff_user["id"],
        "name": staff_user["name"],
        "role": data.get("role", "assistant"),
        "joined_at": datetime.now(timezone.utc).isoformat()
    }
    await db.organizations.update_one(
        {"id": org_id},
        {"$push": {"staff": staff_entry}, "$inc": {"staff_count": 1}}
    )
    return staff_entry


@router.delete("/organizations/{org_id}/staff/{staff_user_id}")
async def remove_staff(org_id: str, staff_user_id: str, user=Depends(get_current_user)):
    org = await _get_org_or_404(org_id)
    if org["owner_id"] != user["id"]:
        raise HTTPException(403, "Only the organization owner can manage staff")
    if staff_user_id == org["owner_id"]:
        raise HTTPException(400, "Cannot remove the owner from staff")

    staff = [s for s in org.get("staff", []) if s["user_id"] != staff_user_id]
    await db.organizations.update_one(
        {"id": org_id},
        {"$set": {"staff": staff, "staff_count": len(staff)}}
    )
    return {"message": "Staff member removed"}


# ─── Player Management ────────────────────────────────────────────────────────

@router.post("/organizations/{org_id}/players")
async def enroll_player(org_id: str, request: Request, user=Depends(get_current_user)):
    org = await _get_org_or_404(org_id)
    _require_org_access(org, user)

    data = await request.json()
    email = data.get("email", "").strip().lower()
    phone = data.get("phone", "").strip()
    if not email and not phone:
        raise HTTPException(400, "Player email or phone is required")

    query = {}
    if email:
        query["email"] = email
    elif phone:
        query["phone"] = phone
    player = await db.users.find_one(query, {"_id": 0, "id": 1, "name": 1})
    if not player:
        raise HTTPException(404, "No player found with that email/phone")

    if any(p["user_id"] == player["id"] for p in org.get("players", [])):
        raise HTTPException(409, "Player is already enrolled")

    entry = {
        "user_id": player["id"],
        "name": player["name"],
        "enrolled_at": datetime.now(timezone.utc).isoformat(),
        "status": "active"
    }
    await db.organizations.update_one(
        {"id": org_id},
        {"$push": {"players": entry}, "$inc": {"player_count": 1}}
    )
    return entry


@router.delete("/organizations/{org_id}/players/{player_user_id}")
async def remove_player(org_id: str, player_user_id: str, user=Depends(get_current_user)):
    org = await _get_org_or_404(org_id)
    _require_org_access(org, user)

    players = [p for p in org.get("players", []) if p["user_id"] != player_user_id]
    await db.organizations.update_one(
        {"id": org_id},
        {"$set": {"players": players, "player_count": len(players)}}
    )
    return {"message": "Player removed"}


# ─── Dashboard / Analytics ────────────────────────────────────────────────────

@router.get("/organizations/{org_id}/dashboard")
async def org_dashboard(org_id: str, user=Depends(get_current_user)):
    org = await _get_org_or_404(org_id)
    _require_org_access(org, user)

    player_ids = [p["user_id"] for p in org.get("players", [])]

    total_records = await db.performance_records.count_documents({"organization_id": org_id})
    total_training = await db.training_logs.count_documents({"organization_id": org_id})
    total_tournaments = await db.tournaments.count_documents({"organizer_id": {"$in": [s["user_id"] for s in org.get("staff", [])]}})

    recent_records = await db.performance_records.find(
        {"organization_id": org_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(10)

    recent_training = await db.training_logs.find(
        {"organization_id": org_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(5)

    return {
        "organization": org,
        "total_players": len(player_ids),
        "total_staff": org.get("staff_count", 1),
        "total_records": total_records,
        "total_training_sessions": total_training,
        "total_tournaments": total_tournaments,
        "recent_records": recent_records,
        "recent_training": recent_training
    }
