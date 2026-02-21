from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional
from datetime import datetime, timezone
from database import db
from auth import get_current_user
from models import AcademyCreate
import uuid

router = APIRouter()


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
        "current_students": 0, "students": [],
        "status": "active",
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
    academy = await db.academies.find_one({"id": academy_id})
    if not academy:
        raise HTTPException(404, "Academy not found")
    if academy.get("coach_id") != user["id"]:
        raise HTTPException(403, "Only the academy coach can manage students")
    body = await request.json()
    student = {
        "id": str(uuid.uuid4()),
        "name": body.get("name", ""),
        "email": body.get("email", ""),
        "phone": body.get("phone", ""),
        "joined_at": datetime.now(timezone.utc).isoformat(),
        "subscription_status": "active"
    }
    await db.academies.update_one(
        {"id": academy_id},
        {"$push": {"students": student}, "$inc": {"current_students": 1}}
    )
    return student


@router.delete("/academies/{academy_id}/students/{student_id}")
async def remove_student(academy_id: str, student_id: str, user=Depends(get_current_user)):
    academy = await db.academies.find_one({"id": academy_id})
    if not academy:
        raise HTTPException(404, "Academy not found")
    if academy.get("coach_id") != user["id"]:
        raise HTTPException(403, "Only the academy coach can manage students")
    students = [s for s in academy.get("students", []) if s["id"] != student_id]
    await db.academies.update_one(
        {"id": academy_id},
        {"$set": {"students": students, "current_students": len(students)}}
    )
    return {"message": "Student removed"}
