"""
Analytics Service – Port 8007
Handles: Venue analytics, player analytics, video highlights (Gemini AI),
         DPDP compliance, academies.
"""
import sys, os
sys.path.insert(0, "/app/shared")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "shared"))

import uuid
import json
import logging
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Query, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from database import db
from auth import get_current_user
from models import AcademyCreate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("analytics-service")

app = FastAPI(title="Horizon Analytics Service", version="2.0.0")
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


# ═══════════════════════════════════════════════════════════════════════════════
# VENUE ANALYTICS
# ═══════════════════════════════════════════════════════════════════════════════

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


# ═══════════════════════════════════════════════════════════════════════════════
# VIDEO HIGHLIGHTS
# ═══════════════════════════════════════════════════════════════════════════════

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


# ═══════════════════════════════════════════════════════════════════════════════
# DPDP COMPLIANCE
# ═══════════════════════════════════════════════════════════════════════════════

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
                "Personal info → anonymized", "Booking history → retained anonymized",
                "Reviews → anonymized author", "Notifications → deleted",
                "Consent records → retained for compliance", "Account → deactivated"
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


# ═══════════════════════════════════════════════════════════════════════════════
# ACADEMIES
# ═══════════════════════════════════════════════════════════════════════════════

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


# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {"service": "analytics", "status": "healthy", "port": 8007,
            "gemini_configured": bool(GEMINI_KEY)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8007)
