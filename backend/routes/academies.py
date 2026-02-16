from fastapi import APIRouter, Depends, Request, HTTPException
from typing import Optional
from database import db
from auth import get_current_user
from models import AcademyCreate
from datetime import datetime, timezone
import uuid

router = APIRouter(tags=["academies"])


@router.get("/academies")
async def list_academies(sport: Optional[str] = None):
    query = {"status": "active"}
    if sport:
        query["sport"] = sport
    academies = await db.academies.find(query, {"_id": 0}).to_list(100)
    return academies


@router.post("/academies")
async def create_academy(input: AcademyCreate, user=Depends(get_current_user)):
    if user["role"] != "coach":
        raise HTTPException(403, "Only coaches can create academies")
    academy = {
        "id": str(uuid.uuid4()), "coach_id": user["id"],
        "coach_name": user["name"], **input.model_dump(),
        "students": [], "current_students": 0, "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.academies.insert_one(academy)
    academy.pop("_id", None)
    return academy


@router.get("/academies/{academy_id}")
async def get_academy(academy_id: str):
    academy = await db.academies.find_one({"id": academy_id}, {"_id": 0})
    if not academy:
        raise HTTPException(404, "Academy not found")
    return academy


@router.post("/academies/{academy_id}/students")
async def add_student(academy_id: str, request: Request, user=Depends(get_current_user)):
    data = await request.json()
    academy = await db.academies.find_one({"id": academy_id})
    if not academy or academy["coach_id"] != user["id"]:
        raise HTTPException(403, "Not authorized")
    student = {
        "id": str(uuid.uuid4()), "name": data.get("name", ""),
        "email": data.get("email", ""), "phone": data.get("phone", ""),
        "joined_at": datetime.now(timezone.utc).isoformat()
    }
    await db.academies.update_one(
        {"id": academy_id},
        {"$push": {"students": student}, "$inc": {"current_students": 1}}
    )
    return student


@router.delete("/academies/{academy_id}/students/{student_id}")
async def remove_student(academy_id: str, student_id: str, user=Depends(get_current_user)):
    academy = await db.academies.find_one({"id": academy_id})
    if not academy or academy["coach_id"] != user["id"]:
        raise HTTPException(403, "Not authorized")
    await db.academies.update_one(
        {"id": academy_id},
        {"$pull": {"students": {"id": student_id}}, "$inc": {"current_students": -1}}
    )
    return {"message": "Student removed"}
