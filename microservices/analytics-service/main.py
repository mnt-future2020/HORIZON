"""
Analytics Service -- Port 8007
Handles: Venue analytics, player analytics, video highlights (Gemini AI),
         DPDP compliance, academies, training logs, performance records,
         recommendations, compatibility, engagement scoring, churn prediction.
"""
import sys, os
sys.path.insert(0, "/app/shared")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "shared"))

import math
import uuid
import json
import logging
import tempfile
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List
from collections import defaultdict

from fastapi import FastAPI, HTTPException, Depends, Query, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import db, init_redis, close_connections
from auth import get_current_user
from models import AcademyCreate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("lobbi")

app = FastAPI(title="Lobbi Analytics Service", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

UPLOAD_DIR = Path("/app/uploads/videos")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
GEMINI_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# S3 config (inline helper)
AWS_ACCESS_KEY = os.environ.get("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
S3_BUCKET = os.environ.get("S3_BUCKET_NAME", "")
S3_REGION = os.environ.get("AWS_REGION", "ap-south-1")


# ===============================================================================
# Pydantic models for Training / Performance (ported from monolith)
# ===============================================================================

class TrainingLogCreate(BaseModel):
    title: str
    sport: str
    date: str
    duration_minutes: int = 60
    drills: List[str] = []
    player_ids: List[str] = []
    notes: str = ""
    performance_notes: dict = {}  # {player_id: "note"}


class PerformanceRecordCreate(BaseModel):
    player_id: str
    record_type: str  # match_result, training, assessment, tournament_result, achievement
    sport: str
    title: str
    stats: dict = {}
    notes: str = ""
    date: str  # YYYY-MM-DD


class BulkRecordCreate(BaseModel):
    player_ids: List[str]
    record_type: str
    sport: str
    title: str
    stats: dict = {}
    date: str


# ===============================================================================
# Startup / Shutdown
# ===============================================================================

@app.on_event("startup")
async def startup():
    await init_redis()
    logger.info("Analytics service started on port 8007")


@app.on_event("shutdown")
async def shutdown():
    await close_connections()


# ===============================================================================
# S3 helper
# ===============================================================================

async def upload_to_s3(data: bytes, folder: str, filename: str, content_type: str) -> str:
    if not AWS_ACCESS_KEY or not S3_BUCKET:
        return ""
    try:
        import boto3
        s3 = boto3.client("s3", region_name=S3_REGION,
                          aws_access_key_id=AWS_ACCESS_KEY,
                          aws_secret_access_key=AWS_SECRET_KEY)
        key = f"{folder}/{filename}"
        s3.put_object(Bucket=S3_BUCKET, Key=key, Body=data,
                      ContentType=content_type, ACL="public-read")
        return f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{key}"
    except Exception as e:
        logger.warning(f"S3 upload failed: {e}")
        return ""


# ===============================================================================
# VENUE ANALYTICS
# ===============================================================================

@app.get("/analytics/venue/{venue_id}")
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


@app.get("/analytics/player")
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


# ===============================================================================
# VIDEO HIGHLIGHTS
# ===============================================================================

ANALYSIS_PROMPT = """You are an expert sports match analyst. Analyze this video recording of a sports match.
Provide your analysis in this EXACT JSON format (no markdown, no code fences, just raw JSON):
{
  "summary": "A 2-3 sentence overall summary of the match",
  "sport_detected": "The sport being played",
  "duration_estimate": "Estimated match duration",
  "match_intensity": "low / medium / high / intense",
  "players_observed": "Approximate number of players",
  "key_moments": [
    {"timestamp": "0:30", "description": "What happened", "significance": "goal / save / rally / other"}
  ]
}
Identify at least 3-5 key moments."""


@app.post("/highlights/upload")
async def upload_video(
    file: UploadFile = File(...),
    title: str = Form("Match Recording"),
    user=Depends(get_current_user)
):
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(400, "Only video files are accepted")

    max_size = 100 * 1024 * 1024
    highlight_id = str(uuid.uuid4())
    ext = Path(file.filename or "video.mp4").suffix or ".mp4"
    filename = f"{highlight_id}{ext}"
    filepath = UPLOAD_DIR / filename

    size = 0
    with open(filepath, "wb") as f:
        while chunk := await file.read(1024 * 512):
            size += len(chunk)
            if size > max_size:
                filepath.unlink(missing_ok=True)
                raise HTTPException(413, "File too large. Max 100MB.")
            f.write(chunk)

    mime = file.content_type or "video/mp4"
    doc = {
        "id": highlight_id, "user_id": user["id"],
        "user_name": user.get("name", "Unknown"), "title": title,
        "video_filename": filename, "video_path": str(filepath),
        "video_url": None, "mime_type": mime, "file_size": size,
        "status": "uploaded", "analysis": None, "share_id": None,
        "is_shared": False, "created_at": datetime.now(timezone.utc).isoformat(),
        "analyzed_at": None,
    }

    # Try S3 backup
    try:
        with open(filepath, "rb") as vf:
            video_bytes = vf.read()
        s3_url = await upload_to_s3(video_bytes, "videos", filename, mime)
        if s3_url:
            doc["video_url"] = s3_url
    except Exception as e:
        logger.warning(f"S3 upload failed: {e}")

    await db.highlights.insert_one(doc)
    doc.pop("_id", None)
    return doc


@app.post("/highlights/{highlight_id}/analyze")
async def analyze_video(highlight_id: str, user=Depends(get_current_user)):
    hl = await db.highlights.find_one({"id": highlight_id}, {"_id": 0})
    if not hl:
        raise HTTPException(404, "Highlight not found")
    if hl["user_id"] != user["id"]:
        raise HTTPException(403, "Not your highlight")
    if hl["status"] == "analyzing":
        raise HTTPException(409, "Analysis already in progress")
    if not GEMINI_KEY:
        raise HTTPException(503, "AI service not configured")

    await db.highlights.update_one({"id": highlight_id}, {"$set": {"status": "analyzing"}})

    try:
        video_path = hl["video_path"]
        local_path = Path(video_path)

        tmp_file = None
        if not local_path.exists():
            s3_url = hl.get("video_url")
            if s3_url:
                import httpx
                tmp = tempfile.NamedTemporaryFile(suffix=Path(video_path).suffix or ".mp4",
                                                   delete=False, dir=UPLOAD_DIR)
                tmp_file = tmp.name
                async with httpx.AsyncClient() as client:
                    resp = await client.get(s3_url, follow_redirects=True, timeout=120.0)
                    resp.raise_for_status()
                    tmp.write(resp.content)
                tmp.close()
                local_path = Path(tmp_file)
            else:
                raise HTTPException(404, "Video file not found. Re-upload the video.")

        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
            chat = LlmChat(
                api_key=GEMINI_KEY, session_id=f"highlight-{highlight_id}",
                system_message="You are an expert sports video analyst. Always respond with valid JSON only."
            ).with_model("gemini", "gemini-2.5-flash")

            video_file = FileContentWithMimeType(file_path=str(local_path),
                                                  mime_type=hl.get("mime_type", "video/mp4"))
            response = await chat.send_message(UserMessage(text=ANALYSIS_PROMPT, file_contents=[video_file]))
        finally:
            if tmp_file:
                Path(tmp_file).unlink(missing_ok=True)

        response_text = response if isinstance(response, str) else str(response)
        clean = response_text.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[-1]
        if clean.endswith("```"):
            clean = clean.rsplit("```", 1)[0]
        clean = clean.strip()

        try:
            analysis = json.loads(clean)
        except json.JSONDecodeError:
            analysis = {
                "summary": response_text[:500], "sport_detected": "Unknown",
                "duration_estimate": "Unknown", "match_intensity": "medium",
                "players_observed": "Unknown", "key_moments": []
            }

        await db.highlights.update_one({"id": highlight_id}, {"$set": {
            "status": "completed", "analysis": analysis,
            "analyzed_at": datetime.now(timezone.utc).isoformat()
        }})
        return await db.highlights.find_one({"id": highlight_id}, {"_id": 0})

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis failed for {highlight_id}: {e}")
        await db.highlights.update_one({"id": highlight_id}, {"$set": {"status": "failed"}})
        raise HTTPException(500, f"Analysis failed: {str(e)}")


@app.get("/highlights")
async def list_highlights(user=Depends(get_current_user)):
    return await db.highlights.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)


@app.get("/highlights/shared/{share_id}")
async def get_shared_highlight(share_id: str):
    hl = await db.highlights.find_one({"share_id": share_id, "is_shared": True}, {"_id": 0})
    if not hl:
        raise HTTPException(404, "Shared highlight not found")
    hl.pop("video_path", None)
    return hl


@app.get("/highlights/{highlight_id}")
async def get_highlight(highlight_id: str, user=Depends(get_current_user)):
    hl = await db.highlights.find_one({"id": highlight_id}, {"_id": 0})
    if not hl:
        raise HTTPException(404, "Highlight not found")
    if hl["user_id"] != user["id"]:
        raise HTTPException(403, "Not your highlight")
    return hl


@app.post("/highlights/{highlight_id}/share")
async def toggle_share(highlight_id: str, user=Depends(get_current_user)):
    hl = await db.highlights.find_one({"id": highlight_id}, {"_id": 0})
    if not hl:
        raise HTTPException(404, "Highlight not found")
    if hl["user_id"] != user["id"]:
        raise HTTPException(403, "Not your highlight")
    if hl.get("is_shared"):
        await db.highlights.update_one({"id": highlight_id}, {"$set": {"is_shared": False, "share_id": None}})
        return {"is_shared": False, "share_id": None}
    else:
        share_id = hl.get("share_id") or str(uuid.uuid4())[:8]
        await db.highlights.update_one({"id": highlight_id}, {"$set": {"is_shared": True, "share_id": share_id}})
        return {"is_shared": True, "share_id": share_id}


@app.delete("/highlights/{highlight_id}")
async def delete_highlight(highlight_id: str, user=Depends(get_current_user)):
    hl = await db.highlights.find_one({"id": highlight_id})
    if not hl:
        raise HTTPException(404, "Highlight not found")
    if hl["user_id"] != user["id"]:
        raise HTTPException(403, "Not your highlight")
    filepath = Path(hl.get("video_path", ""))
    if filepath.exists():
        filepath.unlink(missing_ok=True)
    await db.highlights.delete_one({"id": highlight_id})
    return {"message": "Highlight deleted"}


# ===============================================================================
# DPDP COMPLIANCE
# ===============================================================================

@app.get("/compliance/consent")
async def get_consent_status(user=Depends(get_current_user)):
    consents = await db.consents.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("updated_at", -1).to_list(20)

    categories = {
        "essential": {"required": True, "description": "Essential service functionality"},
        "analytics": {"required": False, "description": "Usage analytics and performance monitoring"},
        "marketing": {"required": False, "description": "Marketing communications and promotions"},
        "location": {"required": False, "description": "Location data for nearby venue discovery"},
        "notifications": {"required": False, "description": "Push notifications and alerts"},
    }

    consent_map = {c["category"]: c for c in consents}
    result = []
    for cat, info in categories.items():
        existing = consent_map.get(cat)
        result.append({
            "category": cat, "description": info["description"],
            "required": info["required"],
            "granted": existing["granted"] if existing else info["required"],
            "updated_at": existing["updated_at"] if existing else None
        })
    return {"consents": result}


@app.put("/compliance/consent")
async def update_consent(request: Request, user=Depends(get_current_user)):
    data = await request.json()
    category = data.get("category")
    granted = data.get("granted", False)

    if not category:
        raise HTTPException(400, "category is required")
    if category == "essential" and not granted:
        raise HTTPException(400, "Essential consent cannot be revoked")

    now = datetime.now(timezone.utc).isoformat()
    consent = await db.consents.find_one({"user_id": user["id"], "category": category})

    if consent:
        await db.consents.update_one(
            {"user_id": user["id"], "category": category},
            {"$set": {"granted": granted, "updated_at": now},
             "$push": {"history": {"action": "granted" if granted else "revoked",
                                   "timestamp": now, "ip": data.get("ip", "")}}}
        )
    else:
        await db.consents.insert_one({
            "id": str(uuid.uuid4()), "user_id": user["id"], "category": category,
            "granted": granted, "created_at": now, "updated_at": now,
            "history": [{"action": "granted" if granted else "revoked",
                         "timestamp": now, "ip": data.get("ip", "")}]
        })

    await _audit_log(user["id"], "consent_update", {"category": category, "granted": granted})
    return {"message": f"Consent {'granted' if granted else 'revoked'} for {category}", "granted": granted}


@app.get("/compliance/data-export")
async def export_user_data(user=Depends(get_current_user)):
    user_id = user["id"]
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    bookings = await db.bookings.find(
        {"$or": [{"host_id": user_id}, {"players": user_id}]}, {"_id": 0}
    ).to_list(500)
    reviews = await db.reviews.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    notifications = await db.notifications.find({"user_id": user_id}, {"_id": 0}).to_list(200)
    consents = await db.consents.find({"user_id": user_id}, {"_id": 0}).to_list(20)
    waitlist = await db.waitlist.find({"user_id": user_id}, {"_id": 0}).to_list(50)
    split_payments = await db.split_payments.find({"payer_id": user_id}, {"_id": 0}).to_list(100)

    export = {
        "export_date": datetime.now(timezone.utc).isoformat(), "user_id": user_id,
        "personal_info": user_data, "bookings": bookings, "reviews": reviews,
        "notifications": notifications, "consent_records": consents,
        "waitlist_entries": waitlist, "split_payments": split_payments,
    }
    await _audit_log(user_id, "data_export", {"collections_exported": 7})
    return export


@app.post("/compliance/erasure-request")
async def request_data_erasure(request: Request, user=Depends(get_current_user)):
    data = await request.json()
    reason = data.get("reason", "User requested deletion")
    confirm = data.get("confirm", False)

    if not confirm:
        return {
            "message": "Please confirm data erasure by setting confirm=true",
            "warning": "This action is irreversible.",
            "affected_data": [
                "Personal info -> anonymized", "Booking history -> retained anonymized",
                "Reviews -> anonymized author", "Notifications -> deleted",
                "Consent records -> retained for compliance", "Account -> deactivated"
            ]
        }

    user_id = user["id"]
    now = datetime.now(timezone.utc).isoformat()

    await db.erasure_requests.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id,
        "original_email": user.get("email", ""), "reason": reason,
        "status": "completed", "requested_at": now, "completed_at": now
    })

    anon_name = f"Deleted User {user_id[:8]}"
    anon_email = f"deleted_{user_id[:8]}@anonymized.local"
    await db.users.update_one({"id": user_id}, {"$set": {
        "name": anon_name, "email": anon_email, "phone": "", "avatar": "",
        "push_token": "", "password_hash": "DELETED",
        "account_status": "deleted", "anonymized_at": now
    }})
    await db.reviews.update_many({"user_id": user_id}, {"$set": {"user_name": anon_name}})
    await db.bookings.update_many({"host_id": user_id}, {"$set": {"host_name": anon_name}})
    await db.notifications.delete_many({"user_id": user_id})
    await db.waitlist.update_many(
        {"user_id": user_id, "status": "waiting"},
        {"$set": {"status": "cancelled", "user_name": anon_name}}
    )
    await db.notification_subscriptions.delete_many({"user_id": user_id})

    await _audit_log(user_id, "data_erasure", {"reason": reason, "status": "completed"})
    return {"message": "Your data has been anonymized. Account deactivated.", "erasure_id": str(uuid.uuid4())}


@app.get("/compliance/audit-log")
async def get_audit_log(user=Depends(get_current_user), limit: int = 50):
    logs = await db.audit_log.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("timestamp", -1).to_list(limit)
    return logs


async def _audit_log(user_id: str, action: str, details: dict = None):
    await db.audit_log.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id, "action": action,
        "details": details or {}, "timestamp": datetime.now(timezone.utc).isoformat()
    })


@app.get("/compliance/notification-preferences")
async def get_notification_preferences(user=Depends(get_current_user)):
    return user.get("notification_preferences", {
        "email": True, "sms": True, "push": True, "in_app": True
    })


@app.put("/compliance/notification-preferences")
async def update_notification_preferences(request: Request, user=Depends(get_current_user)):
    data = await request.json()
    allowed = {"email", "sms", "push", "in_app"}
    prefs = {k: bool(v) for k, v in data.items() if k in allowed}
    prefs["in_app"] = True
    await db.users.update_one({"id": user["id"]}, {"$set": {"notification_preferences": prefs}})
    await _audit_log(user["id"], "preferences_update", {"notification_preferences": prefs})
    return {"message": "Preferences updated", "preferences": prefs}


# ===============================================================================
# ACADEMIES
# ===============================================================================

@app.get("/academies")
async def list_academies(sport: Optional[str] = None):
    query = {"status": "active"}
    if sport:
        query["sport"] = sport
    return await db.academies.find(query, {"_id": 0}).to_list(100)


@app.post("/academies")
async def create_academy(inp: AcademyCreate, user=Depends(get_current_user)):
    if user["role"] != "coach":
        raise HTTPException(403, "Only coaches can create academies")
    academy = {
        "id": str(uuid.uuid4()), "coach_id": user["id"],
        "coach_name": user["name"], **inp.model_dump(),
        "current_students": 0, "students": [], "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.academies.insert_one(academy)
    academy.pop("_id", None)
    return academy


@app.get("/academies/{academy_id}")
async def get_academy(academy_id: str):
    academy = await db.academies.find_one({"id": academy_id}, {"_id": 0})
    if not academy:
        raise HTTPException(404, "Academy not found")
    return academy


@app.post("/academies/{academy_id}/students")
async def add_student(academy_id: str, request: Request, user=Depends(get_current_user)):
    body = await request.json()
    student = {
        "id": str(uuid.uuid4()), "name": body.get("name", ""),
        "email": body.get("email", ""), "phone": body.get("phone", ""),
        "joined_at": datetime.now(timezone.utc).isoformat(),
        "subscription_status": "active"
    }
    await db.academies.update_one(
        {"id": academy_id},
        {"$push": {"students": student}, "$inc": {"current_students": 1}}
    )
    return student


@app.delete("/academies/{academy_id}/students/{student_id}")
async def remove_student(academy_id: str, student_id: str, user=Depends(get_current_user)):
    academy = await db.academies.find_one({"id": academy_id})
    if not academy:
        raise HTTPException(404, "Academy not found")
    students = [s for s in academy.get("students", []) if s["id"] != student_id]
    await db.academies.update_one(
        {"id": academy_id},
        {"$set": {"students": students, "current_students": len(students)}}
    )
    return {"message": "Student removed"}


# ===============================================================================
# TRAINING LOGS (ported from monolith backend/routes/training.py)
# ===============================================================================

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


@app.post("/training/log")
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
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.training_logs.insert_one(log)
    log.pop("_id", None)

    # Auto-create performance records for each present player
    now = datetime.now(timezone.utc).isoformat()
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


@app.get("/training/logs")
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


@app.get("/training/logs/{log_id}")
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


@app.put("/training/logs/{log_id}")
async def update_training_log(log_id: str, request: Request, user=Depends(get_current_user)):
    log = await db.training_logs.find_one({"id": log_id}, {"_id": 0})
    if not log:
        raise HTTPException(404, "Training log not found")
    if log["coach_id"] != user["id"]:
        raise HTTPException(403, "Only the creator can update this log")

    body = await request.json()
    allowed = ["title", "notes", "drills", "duration_minutes"]
    updates = {k: v for k, v in body.items() if k in allowed}
    if updates:
        await db.training_logs.update_one({"id": log_id}, {"$set": updates})
    updated = await db.training_logs.find_one({"id": log_id}, {"_id": 0})
    return updated


@app.get("/training/player/{player_id}")
async def player_training_history(player_id: str, limit: int = 30, user=Depends(get_current_user)):
    logs = await db.training_logs.find(
        {"attendance.player_id": player_id}, {"_id": 0}
    ).sort("date", -1).to_list(limit)
    return logs


@app.get("/training/stats")
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


# ===============================================================================
# PERFORMANCE RECORDS (ported from monolith backend/routes/performance.py)
# ===============================================================================

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


@app.post("/performance/records")
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
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.performance_records.insert_one(record)
    record.pop("_id", None)

    # Update org stats if applicable
    if org_id:
        await db.organizations.update_one({"id": org_id}, {"$inc": {"stats.total_records": 1}})

    return record


@app.post("/performance/records/bulk")
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
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.performance_records.insert_one(record)
        record.pop("_id", None)
        created.append(record)

    return {"created": len(created), "records": created}


@app.get("/performance/my-records")
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


@app.get("/performance/records/{player_id}")
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


@app.get("/performance/records/{player_id}/summary")
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


@app.delete("/performance/records/{record_id}")
async def delete_record(record_id: str, user=Depends(get_current_user)):
    record = await db.performance_records.find_one({"id": record_id}, {"_id": 0})
    if not record:
        raise HTTPException(404, "Record not found")
    if record.get("source_id") != user["id"] and user["role"] != "super_admin":
        raise HTTPException(403, "Only the record creator can delete it")

    await db.performance_records.delete_one({"id": record_id})
    return {"message": "Record deleted"}


# ===============================================================================
# RECOMMENDATION ALGORITHM HELPERS (ported from monolith backend/services/algorithms.py)
# ===============================================================================

def _score_to_grade(score: float) -> str:
    if score >= 85:
        return "S"
    if score >= 70:
        return "A"
    if score >= 55:
        return "B"
    if score >= 40:
        return "C"
    return "D"


def _score_to_level(score: float) -> str:
    if score >= 80:
        return "Legend"
    if score >= 60:
        return "All-Star"
    if score >= 40:
        return "Pro"
    if score >= 20:
        return "Rookie"
    return "Bench"


async def recommend_venues(user_id: str, limit: int = 10) -> list:
    """
    Recommend venues using collaborative filtering + content signals.
    1. Find users with similar booking patterns (collaborative)
    2. Weight by sport preference match (content-based)
    3. Boost by rating and proximity
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        return []

    # User's booking history
    user_bookings = await db.bookings.find(
        {"$or": [{"host_id": user_id}, {"players": user_id}],
         "status": {"$in": ["confirmed", "completed"]}},
        {"_id": 0, "venue_id": 1, "sport": 1}
    ).to_list(200)

    user_venues = set(b["venue_id"] for b in user_bookings)
    user_sports = defaultdict(int)
    for b in user_bookings:
        user_sports[b.get("sport", "other")] += 1

    # Find similar users: people who booked the same venues
    similar_pipeline = [
        {"$match": {"venue_id": {"$in": list(user_venues)},
                     "$or": [{"host_id": {"$ne": user_id}}, {"players": {"$ne": user_id}}]}},
        {"$group": {"_id": {"$ifNull": ["$host_id", "unknown"]}, "shared_venues": {"$addToSet": "$venue_id"}}},
        {"$project": {"_id": 1, "overlap": {"$size": "$shared_venues"}}},
        {"$sort": {"overlap": -1}},
        {"$limit": 30}
    ]
    similar_users = []
    async for doc in db.bookings.aggregate(similar_pipeline):
        if doc["_id"] != user_id and doc["_id"] != "unknown":
            similar_users.append(doc["_id"])

    # Get venues these similar users booked (but current user hasn't)
    if similar_users:
        collab_pipeline = [
            {"$match": {"$or": [{"host_id": {"$in": similar_users}}, {"players": {"$elemMatch": {"$in": similar_users}}}],
                         "venue_id": {"$nin": list(user_venues)}}},
            {"$group": {"_id": "$venue_id", "booking_count": {"$sum": 1}}},
            {"$sort": {"booking_count": -1}},
            {"$limit": 30}
        ]
        collab_venue_ids = []
        async for doc in db.bookings.aggregate(collab_pipeline):
            collab_venue_ids.append(doc["_id"])
    else:
        collab_venue_ids = []

    # Fallback: popular venues the user hasn't tried
    popular_pipeline = [
        {"$match": {"venue_id": {"$nin": list(user_venues)}}},
        {"$group": {"_id": "$venue_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20}
    ]
    popular_ids = []
    async for doc in db.bookings.aggregate(popular_pipeline):
        popular_ids.append(doc["_id"])

    # Combine: collab first, then popular
    candidate_ids = list(dict.fromkeys(collab_venue_ids + popular_ids))[:30]

    if not candidate_ids:
        # No data -- return top rated venues
        venues = await db.venues.find(
            {"status": {"$ne": "suspended"}}, {"_id": 0}
        ).sort("average_rating", -1).limit(limit).to_list(limit)
        for v in venues:
            v["rec_reason"] = "top_rated"
            v["rec_score"] = v.get("average_rating", 0) * 20
        return venues

    venues = await db.venues.find(
        {"id": {"$in": candidate_ids}, "status": {"$ne": "suspended"}}, {"_id": 0}
    ).to_list(30)

    # Score each venue
    top_sport = max(user_sports, key=user_sports.get) if user_sports else ""
    scored = []
    for v in venues:
        score = 0
        reason = "popular"

        # Collaborative score (was it recommended by similar users?)
        if v["id"] in collab_venue_ids:
            collab_rank = collab_venue_ids.index(v["id"])
            score += max(0, 40 - collab_rank * 2)  # Up to 40 points
            reason = "players_like_you"

        # Sport match
        venue_sports = set(v.get("sports", []))
        if top_sport and top_sport in venue_sports:
            score += 25
            reason = "matches_sport"

        sport_overlap = set(user_sports.keys()) & venue_sports
        score += len(sport_overlap) * 5

        # Rating boost
        avg_rating = v.get("average_rating", 0)
        score += avg_rating * 5  # Up to 25 points

        # Review count (social proof)
        review_count = v.get("review_count", 0)
        score += min(10, math.log1p(review_count) * 3)

        v["rec_score"] = round(score, 1)
        v["rec_reason"] = reason
        scored.append(v)

    scored.sort(key=lambda x: x["rec_score"], reverse=True)
    return scored[:limit]


async def recommend_players(user_id: str, limit: int = 15) -> list:
    """
    Recommend players to follow/connect with.
    Signals: co-play history, sport overlap, skill proximity, mutual follows.
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        return []

    # Already following
    following_ids = set()
    async for doc in db.follows.find({"follower_id": user_id}, {"following_id": 1}):
        following_ids.add(doc["following_id"])

    # 1. Co-players (strongest signal)
    coplay_pipeline = [
        {"$match": {"$or": [{"host_id": user_id}, {"players": user_id}]}},
        {"$project": {"all_players": {"$concatArrays": [
            {"$ifNull": ["$players", []]},
            [{"$ifNull": ["$host_id", ""]}]
        ]}}},
        {"$unwind": "$all_players"},
        {"$match": {"all_players": {"$ne": user_id, "$ne": ""}}},
        {"$group": {"_id": "$all_players", "games": {"$sum": 1}}},
        {"$sort": {"games": -1}},
        {"$limit": 50}
    ]
    coplayers = {}
    async for doc in db.bookings.aggregate(coplay_pipeline):
        if doc["_id"] not in following_ids:
            coplayers[doc["_id"]] = doc["games"]

    # 2. Mutual follows (friend-of-friend)
    mutual_pipeline = [
        {"$match": {"follower_id": {"$in": list(following_ids)}}},
        {"$group": {"_id": "$following_id", "mutual_count": {"$sum": 1}}},
        {"$match": {"_id": {"$nin": list(following_ids) + [user_id]}}},
        {"$sort": {"mutual_count": -1}},
        {"$limit": 30}
    ]
    mutuals = {}
    async for doc in db.follows.aggregate(mutual_pipeline):
        mutuals[doc["_id"]] = doc["mutual_count"]

    # 3. Skill-similar active players
    user_rating = user.get("skill_rating", 1500)
    similar_players = await db.users.find(
        {"id": {"$nin": list(following_ids) + [user_id]},
         "skill_rating": {"$gte": user_rating - 200, "$lte": user_rating + 200}},
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "skill_rating": 1, "role": 1}
    ).limit(20).to_list(20)

    # Score all candidates
    all_candidates = set(coplayers.keys()) | set(mutuals.keys()) | set(p["id"] for p in similar_players)
    all_candidates.discard(user_id)

    candidate_users = await db.users.find(
        {"id": {"$in": list(all_candidates)}},
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "skill_rating": 1, "role": 1,
         "reliability_score": 1, "sports": 1}
    ).to_list(100)

    user_sports = set(user.get("sports", []))
    scored = []
    for c in candidate_users:
        score = 0
        reason = "suggested"

        # Co-play score (strongest)
        games = coplayers.get(c["id"], 0)
        if games > 0:
            score += min(40, 15 * math.log1p(games))
            reason = "played_together"

        # Mutual follows
        mutual_count = mutuals.get(c["id"], 0)
        if mutual_count > 0:
            score += min(25, 10 * math.log1p(mutual_count))
            if reason == "suggested":
                reason = "mutual_friends"

        # Skill proximity
        c_rating = c.get("skill_rating", 1500)
        rating_diff = abs(user_rating - c_rating)
        score += max(0, 15 * (1 - rating_diff / 500))

        # Sport overlap
        c_sports = set(c.get("sports", []))
        overlap = user_sports & c_sports
        score += len(overlap) * 5

        # Reliability bonus
        if c.get("reliability_score", 100) >= 90:
            score += 5

        c["rec_score"] = round(score, 1)
        c["rec_reason"] = reason
        c["mutual_count"] = mutual_count
        c["games_together"] = games
        scored.append(c)

    scored.sort(key=lambda x: x["rec_score"], reverse=True)
    return scored[:limit]


async def recommend_groups(user_id: str, limit: int = 10) -> list:
    """
    Recommend groups based on sport interests, friend memberships, and activity.
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return []

    user_sports = set(user.get("sports", []))

    # Already member of
    my_groups = await db.groups.find(
        {"members": user_id}, {"_id": 0, "id": 1}
    ).to_list(100)
    my_group_ids = set(g["id"] for g in my_groups)

    # Following
    following_ids = []
    async for doc in db.follows.find({"follower_id": user_id}, {"following_id": 1}):
        following_ids.append(doc["following_id"])

    # Groups that friends are in
    friend_groups = []
    if following_ids:
        friend_groups = await db.groups.find(
            {"members": {"$in": following_ids}, "id": {"$nin": list(my_group_ids)}},
            {"_id": 0}
        ).limit(20).to_list(20)

    # Groups matching user's sports
    sport_groups = await db.groups.find(
        {"sport": {"$in": list(user_sports)}, "id": {"$nin": list(my_group_ids)}},
        {"_id": 0}
    ).sort("member_count", -1).limit(20).to_list(20)

    # Popular groups
    popular_groups = await db.groups.find(
        {"id": {"$nin": list(my_group_ids)}}, {"_id": 0}
    ).sort("member_count", -1).limit(15).to_list(15)

    # Deduplicate and score
    seen = set()
    scored = []
    for g in friend_groups + sport_groups + popular_groups:
        if g["id"] in seen:
            continue
        seen.add(g["id"])

        score = 0
        reason = "popular"

        # Friends in group
        friend_members = set(g.get("members", [])) & set(following_ids)
        if friend_members:
            score += min(30, len(friend_members) * 10)
            reason = "friends_are_in"

        # Sport match
        if g.get("sport") in user_sports:
            score += 25
            if reason == "popular":
                reason = "matches_sport"

        # Activity (member count as proxy)
        score += min(20, math.log1p(g.get("member_count", 0)) * 5)

        # Recent activity
        if g.get("last_message_at"):
            last_msg = datetime.fromisoformat(g["last_message_at"].replace("Z", "+00:00"))
            hours_since = (datetime.now(timezone.utc) - last_msg).total_seconds() / 3600
            if hours_since < 24:
                score += 15
            elif hours_since < 168:
                score += 8

        g["rec_score"] = round(score, 1)
        g["rec_reason"] = reason
        g["friends_count"] = len(friend_members) if following_ids else 0
        scored.append(g)

    scored.sort(key=lambda x: x["rec_score"], reverse=True)
    return scored[:limit]


async def compute_player_compatibility(user_id_a: str, user_id_b: str) -> dict:
    """
    Compute compatibility score between two players.
    Features: skill rating, sports overlap, reliability, play times, location.
    Returns score 0-100 and breakdown.
    """
    user_a = await db.users.find_one({"id": user_id_a}, {"_id": 0, "password_hash": 0})
    user_b = await db.users.find_one({"id": user_id_b}, {"_id": 0, "password_hash": 0})
    if not user_a or not user_b:
        return {"score": 0, "breakdown": {}, "compatible": False}

    breakdown = {}

    # 1. Skill Rating Proximity (0-25 points)
    rating_a = user_a.get("skill_rating", 1500)
    rating_b = user_b.get("skill_rating", 1500)
    rating_diff = abs(rating_a - rating_b)
    skill_score = max(0, 25 * (1 - rating_diff / 500))
    breakdown["skill_proximity"] = {"score": round(skill_score, 1), "max": 25,
                                     "detail": f"Rating diff: {rating_diff}"}

    # 2. Sports Overlap (0-25 points)
    sports_a = set(user_a.get("sports", []))
    sports_b = set(user_b.get("sports", []))
    bookings_a = await db.bookings.find(
        {"$or": [{"host_id": user_id_a}, {"players": user_id_a}]},
        {"sport": 1, "_id": 0}
    ).limit(50).to_list(50)
    bookings_b = await db.bookings.find(
        {"$or": [{"host_id": user_id_b}, {"players": user_id_b}]},
        {"sport": 1, "_id": 0}
    ).limit(50).to_list(50)
    played_a = set(b.get("sport", "") for b in bookings_a) | sports_a
    played_b = set(b.get("sport", "") for b in bookings_b) | sports_b
    played_a.discard("")
    played_b.discard("")

    if played_a and played_b:
        overlap = played_a & played_b
        union = played_a | played_b
        jaccard = len(overlap) / len(union) if union else 0
        sport_score = 25 * jaccard
    else:
        sport_score = 5
        overlap = set()

    breakdown["sports_overlap"] = {"score": round(sport_score, 1), "max": 25,
                                    "common_sports": list(overlap)}

    # 3. Reliability Match (0-20 points)
    rel_a = user_a.get("reliability_score", 100)
    rel_b = user_b.get("reliability_score", 100)
    avg_reliability = (rel_a + rel_b) / 2
    rel_diff = abs(rel_a - rel_b)
    reliability_score = 20 * (avg_reliability / 100) * (1 - rel_diff / 100)
    breakdown["reliability"] = {"score": round(reliability_score, 1), "max": 20,
                                 "detail": f"Avg: {avg_reliability:.0f}%, diff: {rel_diff:.0f}%"}

    # 4. Play Time Overlap (0-15 points)
    recent_a = await db.bookings.find(
        {"$or": [{"host_id": user_id_a}, {"players": user_id_a}], "status": {"$in": ["confirmed", "completed"]}},
        {"start_time": 1, "_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    recent_b = await db.bookings.find(
        {"$or": [{"host_id": user_id_b}, {"players": user_id_b}], "status": {"$in": ["confirmed", "completed"]}},
        {"start_time": 1, "_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)

    times_a = [int(b.get("start_time", "12:00").split(":")[0]) for b in recent_a if b.get("start_time")]
    times_b = [int(b.get("start_time", "12:00").split(":")[0]) for b in recent_b if b.get("start_time")]

    if times_a and times_b:
        dist_a = defaultdict(int)
        dist_b = defaultdict(int)
        for h in times_a:
            dist_a[h] += 1
        for h in times_b:
            dist_b[h] += 1
        all_hours = set(dist_a.keys()) | set(dist_b.keys())
        dot = sum(dist_a.get(h, 0) * dist_b.get(h, 0) for h in all_hours)
        mag_a = math.sqrt(sum(v * v for v in dist_a.values()))
        mag_b = math.sqrt(sum(v * v for v in dist_b.values()))
        cosine = dot / (mag_a * mag_b) if mag_a > 0 and mag_b > 0 else 0
        time_score = 15 * cosine
    else:
        time_score = 7.5

    breakdown["play_times"] = {"score": round(time_score, 1), "max": 15}

    # 5. Co-play History (0-15 points)
    coplay_count = await db.bookings.count_documents({
        "players": {"$all": [user_id_a, user_id_b]},
        "status": {"$in": ["confirmed", "completed"]}
    })
    coplay_count += await db.bookings.count_documents({
        "$or": [
            {"host_id": user_id_a, "players": user_id_b},
            {"host_id": user_id_b, "players": user_id_a}
        ],
        "status": {"$in": ["confirmed", "completed"]}
    })
    coplay_score = min(15, 7 * math.log1p(coplay_count))
    breakdown["coplay_history"] = {"score": round(coplay_score, 1), "max": 15,
                                    "games_together": coplay_count}

    total = skill_score + sport_score + reliability_score + time_score + coplay_score
    total = round(min(total, 100), 1)

    return {
        "score": total,
        "grade": _score_to_grade(total),
        "compatible": total >= 50,
        "breakdown": breakdown,
    }


async def compute_engagement_score(user_id: str) -> dict:
    """
    Compute a 0-100 engagement score for a user.
    Factors: posting frequency, interaction rate, streak, response rate, diversity.
    """
    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()

    # Posts in last 7 days
    posts_week = await db.social_posts.count_documents(
        {"user_id": user_id, "created_at": {"$gte": week_ago}}
    )
    # Posts in last 30 days
    posts_month = await db.social_posts.count_documents(
        {"user_id": user_id, "created_at": {"$gte": month_ago}}
    )

    # Comments given in last 7 days
    comments_week = await db.social_comments.count_documents(
        {"user_id": user_id, "created_at": {"$gte": week_ago}}
    )

    # Likes given in last 7 days
    likes_week = await db.social_likes.count_documents(
        {"user_id": user_id, "created_at": {"$gte": week_ago}}
    )

    # Reactions given
    reactions_week = await db.social_reactions.count_documents(
        {"user_id": user_id, "created_at": {"$gte": week_ago}}
    )

    # Stories in last 7 days
    stories_week = await db.stories.count_documents(
        {"user_id": user_id, "created_at": {"$gte": week_ago}}
    )

    # Streak
    streak = await db.streaks.find_one({"user_id": user_id}, {"_id": 0})
    current_streak = streak.get("current_streak", 0) if streak else 0

    # Bookings (platform engagement)
    bookings_month = await db.bookings.count_documents(
        {"$or": [{"host_id": user_id}, {"players": user_id}],
         "created_at": {"$gte": month_ago}}
    )

    # Scoring
    scores = {}

    # Posting frequency (0-20)
    scores["posting"] = min(20, posts_week * 3)

    # Interaction rate (0-20)
    interactions = comments_week + likes_week + reactions_week
    scores["interactions"] = min(20, interactions * 2)

    # Streak bonus (0-15)
    scores["streak"] = min(15, current_streak * 2)

    # Stories (0-10)
    scores["stories"] = min(10, stories_week * 3)

    # Platform usage -- bookings (0-15)
    scores["platform_use"] = min(15, bookings_month * 3)

    # Consistency -- posting across multiple days (0-10)
    if posts_month > 0:
        post_dates = await db.social_posts.find(
            {"user_id": user_id, "created_at": {"$gte": month_ago}},
            {"_id": 0, "created_at": 1}
        ).to_list(200)
        unique_days = len(set(p["created_at"][:10] for p in post_dates))
        scores["consistency"] = min(10, unique_days)
    else:
        scores["consistency"] = 0

    # Community (0-10)
    groups_count = await db.groups.count_documents({"members": user_id})
    teams_count = await db.teams.count_documents({"players.id": user_id})
    scores["community"] = min(10, (groups_count + teams_count) * 2)

    total = sum(scores.values())
    total = round(min(total, 100), 1)

    return {
        "score": total,
        "grade": _score_to_grade(total),
        "breakdown": scores,
        "level": _score_to_level(total),
        "posts_this_week": posts_week,
        "interactions_this_week": interactions,
        "current_streak": current_streak,
    }


async def predict_churn_risk(user_id: str) -> dict:
    """
    Predict churn risk based on declining activity patterns.
    Returns risk level (low/medium/high/critical) and signals.
    """
    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()
    two_weeks_ago = (now - timedelta(days=14)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()

    signals = {}

    # 1. Login recency (check last activity)
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "last_login": 1, "created_at": 1})
    last_login = user.get("last_login", user.get("created_at", "")) if user else ""
    if last_login:
        try:
            last_dt = datetime.fromisoformat(last_login.replace("Z", "+00:00"))
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            days_since_login = (now - last_dt).days
        except (ValueError, AttributeError):
            days_since_login = 0
    else:
        days_since_login = 0
    signals["days_since_login"] = days_since_login

    # 2. Activity decline: compare this week vs last week
    posts_this_week = await db.social_posts.count_documents(
        {"user_id": user_id, "created_at": {"$gte": week_ago}})
    posts_last_week = await db.social_posts.count_documents(
        {"user_id": user_id, "created_at": {"$gte": two_weeks_ago, "$lt": week_ago}})

    bookings_this_week = await db.bookings.count_documents(
        {"$or": [{"host_id": user_id}, {"players": user_id}],
         "created_at": {"$gte": week_ago}})
    bookings_last_week = await db.bookings.count_documents(
        {"$or": [{"host_id": user_id}, {"players": user_id}],
         "created_at": {"$gte": two_weeks_ago, "$lt": week_ago}})

    signals["posts_this_week"] = posts_this_week
    signals["posts_last_week"] = posts_last_week
    signals["bookings_this_week"] = bookings_this_week
    signals["bookings_last_week"] = bookings_last_week

    # 3. Streak broken?
    streak = await db.streaks.find_one({"user_id": user_id}, {"_id": 0})
    streak_broken = False
    if streak:
        last_post = streak.get("last_post_date", "")
        if last_post:
            try:
                last_post_date = datetime.strptime(last_post, "%Y-%m-%d").date()
                days_since_post = (now.date() - last_post_date).days
                streak_broken = days_since_post > 2
            except ValueError:
                pass
    signals["streak_broken"] = streak_broken

    # 4. Social isolation: no interactions received
    user_post_ids = []
    async for p in db.social_posts.find(
        {"user_id": user_id, "created_at": {"$gte": month_ago}}, {"id": 1}
    ):
        user_post_ids.append(p["id"])

    interactions_received = 0
    if user_post_ids:
        interactions_received = await db.social_likes.count_documents({
            "post_id": {"$in": user_post_ids}
        })
    signals["interactions_received_month"] = interactions_received

    # Compute risk score (0-100, higher = more at risk)
    risk = 0

    # Login recency
    if days_since_login > 14:
        risk += 30
    elif days_since_login > 7:
        risk += 20
    elif days_since_login > 3:
        risk += 10

    # Activity decline
    if posts_last_week > 0 and posts_this_week == 0:
        risk += 20
    elif posts_last_week > posts_this_week * 2:
        risk += 10

    if bookings_last_week > 0 and bookings_this_week == 0:
        risk += 15
    elif bookings_last_week > bookings_this_week * 2:
        risk += 8

    # Streak
    if streak_broken:
        risk += 10

    # Social isolation
    if interactions_received == 0 and posts_this_week + posts_last_week > 0:
        risk += 15

    # No activity at all in last month
    total_month = await db.social_posts.count_documents(
        {"user_id": user_id, "created_at": {"$gte": month_ago}})
    total_bookings_month = await db.bookings.count_documents(
        {"$or": [{"host_id": user_id}, {"players": user_id}],
         "created_at": {"$gte": month_ago}})
    if total_month == 0 and total_bookings_month == 0:
        risk += 25

    risk = min(risk, 100)

    if risk >= 70:
        level = "critical"
    elif risk >= 45:
        level = "high"
    elif risk >= 25:
        level = "medium"
    else:
        level = "low"

    return {
        "risk_score": risk,
        "risk_level": level,
        "signals": signals,
    }


# ===============================================================================
# RECOMMENDATIONS ROUTES (ported from monolith backend/routes/recommendations.py)
# ===============================================================================

@app.get("/recommendations/venues")
async def get_venue_recommendations(
    limit: int = Query(10, ge=1, le=30),
    user=Depends(get_current_user)
):
    """Get personalized venue recommendations using collaborative filtering + content signals."""
    try:
        venues = await recommend_venues(user["id"], limit=limit)
        return {"venues": venues, "algorithm": "collaborative_filtering_hybrid"}
    except Exception as e:
        logger.error(f"Venue recommendation error: {e}")
        return {"venues": [], "algorithm": "collaborative_filtering_hybrid", "error": "Could not compute recommendations"}


@app.get("/recommendations/players")
async def get_player_recommendations(
    limit: int = Query(15, ge=1, le=50),
    user=Depends(get_current_user)
):
    """Get recommended players to follow based on co-play, mutual friends, skill proximity."""
    try:
        players = await recommend_players(user["id"], limit=limit)
        return {"players": players, "algorithm": "multi_signal_scoring"}
    except Exception as e:
        logger.error(f"Player recommendation error: {e}")
        return {"players": [], "algorithm": "multi_signal_scoring", "error": "Could not compute recommendations"}


@app.get("/recommendations/groups")
async def get_group_recommendations(
    limit: int = Query(10, ge=1, le=30),
    user=Depends(get_current_user)
):
    """Get recommended groups based on sport interests, friend memberships, activity."""
    try:
        groups = await recommend_groups(user["id"], limit=limit)
        return {"groups": groups, "algorithm": "interest_graph"}
    except Exception as e:
        logger.error(f"Group recommendation error: {e}")
        return {"groups": [], "algorithm": "interest_graph", "error": "Could not compute recommendations"}


@app.get("/compatibility/{target_id}")
async def get_compatibility(target_id: str, user=Depends(get_current_user)):
    """Compute compatibility score between current user and target player."""
    if target_id == user["id"]:
        raise HTTPException(400, "Cannot check compatibility with yourself")
    try:
        result = await compute_player_compatibility(user["id"], target_id)
        return result
    except Exception as e:
        logger.error(f"Compatibility error: {e}")
        return {"score": 0, "grade": "?", "compatible": False, "breakdown": {}}


@app.get("/engagement/score")
async def get_engagement_score(user=Depends(get_current_user)):
    """Get detailed engagement score breakdown for the current user."""
    try:
        result = await compute_engagement_score(user["id"])
        return result
    except Exception as e:
        logger.error(f"Engagement score error: {e}")
        return {"score": 0, "grade": "D", "level": "Bench", "breakdown": {}}


@app.get("/engagement/score/{user_id}")
async def get_user_engagement_score(user_id: str, user=Depends(get_current_user)):
    """Get engagement score for any user (public data)."""
    try:
        result = await compute_engagement_score(user_id)
        return result
    except Exception as e:
        logger.error(f"Engagement score error: {e}")
        return {"score": 0, "grade": "D", "level": "Bench", "breakdown": {}}


@app.get("/engagement/churn-risk")
async def get_churn_risk(user=Depends(get_current_user)):
    """Get churn risk prediction for the current user."""
    try:
        result = await predict_churn_risk(user["id"])
        return result
    except Exception as e:
        logger.error(f"Churn prediction error: {e}")
        return {"risk_score": 0, "risk_level": "low", "signals": {}}


# ===============================================================================
# HEALTH
# ===============================================================================

@app.get("/health")
async def health():
    return {"service": "analytics", "status": "healthy", "port": 8007,
            "gemini_configured": bool(GEMINI_KEY)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8007)
