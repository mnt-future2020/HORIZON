import os
import uuid
import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from auth import get_current_user
from database import db
from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType

router = APIRouter(prefix="/highlights", tags=["highlights"])
logger = logging.getLogger(__name__)

UPLOAD_DIR = Path("/app/backend/uploads/videos")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

GEMINI_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

ANALYSIS_PROMPT = """You are an expert sports match analyst. Analyze this video recording of a sports match.

Provide your analysis in this EXACT JSON format (no markdown, no code fences, just raw JSON):
{
  "summary": "A 2-3 sentence overall summary of the match",
  "sport_detected": "The sport being played (e.g., football, cricket, badminton, tennis)",
  "duration_estimate": "Estimated match duration",
  "match_intensity": "low / medium / high / intense",
  "players_observed": "Approximate number of players and brief team description",
  "key_moments": [
    {
      "timestamp": "Approximate time in the video (e.g., 0:30, 2:15)",
      "description": "What happened at this moment",
      "significance": "goal / save / rally / foul / celebration / turning_point / skill_move / other"
    }
  ]
}

Identify at least 3-5 key moments. Focus on exciting plays, goals, saves, rallies, turning points, and skillful moves. If you cannot clearly see the video content, provide your best analysis based on what you can observe."""


@router.post("/upload")
async def upload_video(
    file: UploadFile = File(...),
    title: str = Form("Match Recording"),
    user=Depends(get_current_user)
):
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(400, "Only video files are accepted")

    max_size = 100 * 1024 * 1024  # 100MB
    highlight_id = str(uuid.uuid4())
    ext = Path(file.filename or "video.mp4").suffix or ".mp4"
    filename = f"{highlight_id}{ext}"
    filepath = UPLOAD_DIR / filename

    size = 0
    with open(filepath, "wb") as f:
        while chunk := await file.read(1024 * 512):  # 512KB chunks
            size += len(chunk)
            if size > max_size:
                filepath.unlink(missing_ok=True)
                raise HTTPException(413, "File too large. Max 100MB.")
            f.write(chunk)

    mime = file.content_type or "video/mp4"
    doc = {
        "id": highlight_id,
        "user_id": user["id"],
        "user_name": user.get("name", "Unknown"),
        "title": title,
        "video_filename": filename,
        "video_path": str(filepath),
        "mime_type": mime,
        "file_size": size,
        "status": "uploaded",
        "analysis": None,
        "share_id": None,
        "is_shared": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "analyzed_at": None,
    }
    await db.highlights.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.post("/{highlight_id}/analyze")
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
        if not Path(video_path).exists():
            raise HTTPException(404, "Video file not found on disk")

        chat = LlmChat(
            api_key=GEMINI_KEY,
            session_id=f"highlight-{highlight_id}",
            system_message="You are an expert sports video analyst. Always respond with valid JSON only."
        ).with_model("gemini", "gemini-2.5-flash-preview-04-17")

        video_file = FileContentWithMimeType(
            file_path=video_path,
            mime_type=hl.get("mime_type", "video/mp4")
        )

        response = await chat.send_message(UserMessage(
            text=ANALYSIS_PROMPT,
            file_contents=[video_file]
        ))

        import json
        response_text = response if isinstance(response, str) else str(response)
        # Clean response - strip markdown fences if present
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
                "summary": response_text[:500],
                "sport_detected": "Unknown",
                "duration_estimate": "Unknown",
                "match_intensity": "medium",
                "players_observed": "Unknown",
                "key_moments": []
            }

        await db.highlights.update_one(
            {"id": highlight_id},
            {"$set": {
                "status": "completed",
                "analysis": analysis,
                "analyzed_at": datetime.now(timezone.utc).isoformat()
            }}
        )

        updated = await db.highlights.find_one({"id": highlight_id}, {"_id": 0})
        return updated

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis failed for {highlight_id}: {e}")
        await db.highlights.update_one(
            {"id": highlight_id},
            {"$set": {"status": "failed"}}
        )
        raise HTTPException(500, f"Analysis failed: {str(e)}")


@router.get("")
async def list_highlights(user=Depends(get_current_user)):
    cursor = db.highlights.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(50)


@router.get("/shared/{share_id}")
async def get_shared_highlight(share_id: str):
    hl = await db.highlights.find_one({"share_id": share_id, "is_shared": True}, {"_id": 0})
    if not hl:
        raise HTTPException(404, "Shared highlight not found")
    hl.pop("video_path", None)
    return hl


@router.get("/{highlight_id}")
async def get_highlight(highlight_id: str, user=Depends(get_current_user)):
    hl = await db.highlights.find_one({"id": highlight_id}, {"_id": 0})
    if not hl:
        raise HTTPException(404, "Highlight not found")
    if hl["user_id"] != user["id"]:
        raise HTTPException(403, "Not your highlight")
    return hl


@router.post("/{highlight_id}/share")
async def toggle_share(highlight_id: str, user=Depends(get_current_user)):
    hl = await db.highlights.find_one({"id": highlight_id}, {"_id": 0})
    if not hl:
        raise HTTPException(404, "Highlight not found")
    if hl["user_id"] != user["id"]:
        raise HTTPException(403, "Not your highlight")

    if hl.get("is_shared"):
        await db.highlights.update_one(
            {"id": highlight_id},
            {"$set": {"is_shared": False, "share_id": None}}
        )
        return {"is_shared": False, "share_id": None}
    else:
        share_id = hl.get("share_id") or str(uuid.uuid4())[:8]
        await db.highlights.update_one(
            {"id": highlight_id},
            {"$set": {"is_shared": True, "share_id": share_id}}
        )
        return {"is_shared": True, "share_id": share_id}


@router.delete("/{highlight_id}")
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
