"""
Communities, Groups & Teams — Sports social platform.
Supports: community creation, membership, group chat, team management.
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request, WebSocket, WebSocketDisconnect, UploadFile, File as FileParam
from typing import Optional, Dict
from datetime import datetime, timezone
from database import db
from auth import get_current_user
from tz import now_ist
from models import GroupCreate, TeamCreate, MessageCreate
import uuid
import math
import logging
import json
import os
import re as _re
from pathlib import Path
from encryption import encrypt_message, decrypt_message

router = APIRouter()
logger = logging.getLogger("horizon")

JWT_SECRET = os.environ.get("JWT_SECRET")


# ---------------------------------------------------------------------------
# Chat WebSocket Connection Manager
# ---------------------------------------------------------------------------
class ChatConnectionManager:
    def __init__(self):
        self._clients: Dict[str, WebSocket] = {}  # user_id -> WebSocket

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        old = self._clients.get(user_id)
        if old:
            try:
                await old.close(code=4001, reason="New connection opened")
            except Exception:
                pass
        self._clients[user_id] = ws

    def disconnect(self, user_id: str, ws: WebSocket):
        if self._clients.get(user_id) is ws:
            self._clients.pop(user_id, None)

    async def send_to_user(self, user_id: str, message: dict):
        ws = self._clients.get(user_id)
        if ws:
            try:
                await ws.send_text(json.dumps(message, default=str))
            except Exception:
                self.disconnect(user_id, ws)

    def is_online(self, user_id: str) -> bool:
        return user_id in self._clients


chat_manager = ChatConnectionManager()


# ═══════════════════════════════════════════════════════════════════════════════
# GROUPS / COMMUNITIES
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/groups")
async def create_group(inp: GroupCreate, user=Depends(get_current_user)):
    group = {
        "id": str(uuid.uuid4()),
        "name": inp.name,
        "description": inp.description,
        "group_type": inp.group_type,
        "sport": inp.sport,
        "avatar_url": inp.avatar_url or "",
        "cover_url": inp.cover_url or "",
        "is_private": inp.is_private,
        "max_members": inp.max_members,
        "created_by": user["id"],
        "creator_name": user.get("name", ""),
        "member_count": 1,
        "members": [user["id"]],
        "admins": [user["id"]],
        "created_at": now_ist().isoformat(),
    }
    await db.groups.insert_one(group)
    group.pop("_id", None)
    return group


@router.get("/groups")
async def list_groups(
    search: str = "",
    sport: str = "",
    group_type: str = "",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user=Depends(get_current_user)
):
    query = {}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    if sport:
        query["sport"] = sport
    if group_type:
        query["group_type"] = group_type

    skip = (page - 1) * limit
    groups = await db.groups.find(query, {"_id": 0}).sort(
        "member_count", -1
    ).skip(skip).limit(limit).to_list(limit)

    # Mark which groups user is a member of
    for g in groups:
        g["is_member"] = user["id"] in g.get("members", [])
        g["is_admin"] = user["id"] in g.get("admins", [])

    total = await db.groups.count_documents(query)
    return {"groups": groups, "total": total, "page": page, "pages": math.ceil(total / max(limit, 1))}


@router.get("/groups/my")
async def my_groups(user=Depends(get_current_user)):
    groups = await db.groups.find(
        {"members": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    for g in groups:
        g["is_member"] = True
        g["is_admin"] = user["id"] in g.get("admins", [])
    return groups


@router.get("/groups/{group_id}")
async def get_group(group_id: str, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(404, "Group not found")
    group["is_member"] = user["id"] in group.get("members", [])
    group["is_admin"] = user["id"] in group.get("admins", [])

    # Fetch member details
    member_ids = group.get("members", [])[:50]
    members = await db.users.find(
        {"id": {"$in": member_ids}},
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "skill_rating": 1, "role": 1}
    ).to_list(50)
    group["member_details"] = members
    return group


@router.post("/groups/{group_id}/join")
async def join_group(group_id: str, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(404, "Group not found")
    if user["id"] in group.get("members", []):
        raise HTTPException(400, "Already a member")
    if group.get("member_count", 0) >= group.get("max_members", 500):
        raise HTTPException(400, "Group is full")

    await db.groups.update_one(
        {"id": group_id},
        {"$push": {"members": user["id"]}, "$inc": {"member_count": 1}}
    )
    return {"message": "Joined group", "group_id": group_id}


@router.post("/groups/{group_id}/leave")
async def leave_group(group_id: str, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(404, "Group not found")
    if user["id"] not in group.get("members", []):
        raise HTTPException(400, "Not a member")
    if user["id"] == group.get("created_by") and group.get("member_count", 0) > 1:
        raise HTTPException(400, "Creator must transfer ownership before leaving")

    await db.groups.update_one(
        {"id": group_id},
        {"$pull": {"members": user["id"], "admins": user["id"]}, "$inc": {"member_count": -1}}
    )
    return {"message": "Left group"}


@router.delete("/groups/{group_id}")
async def delete_group(group_id: str, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(404, "Group not found")
    if user["id"] != group.get("created_by"):
        raise HTTPException(403, "Only the group creator can delete it")
    await db.groups.delete_one({"id": group_id})
    await db.group_messages.delete_many({"group_id": group_id})
    return {"message": "Group deleted"}


@router.post("/groups/{group_id}/promote")
async def promote_to_admin(group_id: str, request: Request, user=Depends(get_current_user)):
    """Promote a member to admin. Only existing admins can promote."""
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(404, "Group not found")
    if user["id"] not in group.get("admins", []):
        raise HTTPException(403, "Only admins can promote members")
    data = await request.json()
    target_id = data.get("user_id", "")
    if not target_id or target_id not in group.get("members", []):
        raise HTTPException(400, "User is not a member of this group")
    if target_id in group.get("admins", []):
        raise HTTPException(400, "User is already an admin")
    await db.groups.update_one({"id": group_id}, {"$push": {"admins": target_id}})
    return {"message": "Member promoted to admin"}


@router.post("/groups/{group_id}/demote")
async def demote_admin(group_id: str, request: Request, user=Depends(get_current_user)):
    """Demote an admin to regular member. Only the creator can demote."""
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(404, "Group not found")
    if user["id"] != group.get("created_by"):
        raise HTTPException(403, "Only the group creator can demote admins")
    data = await request.json()
    target_id = data.get("user_id", "")
    if target_id == group.get("created_by"):
        raise HTTPException(400, "Cannot demote the group creator")
    if target_id not in group.get("admins", []):
        raise HTTPException(400, "User is not an admin")
    await db.groups.update_one({"id": group_id}, {"$pull": {"admins": target_id}})
    return {"message": "Admin demoted to member"}


@router.post("/groups/{group_id}/remove-member")
async def remove_member(group_id: str, request: Request, user=Depends(get_current_user)):
    """Remove a member from the group. Only admins can remove."""
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(404, "Group not found")
    if user["id"] not in group.get("admins", []):
        raise HTTPException(403, "Only admins can remove members")
    data = await request.json()
    target_id = data.get("user_id", "")
    if not target_id or target_id not in group.get("members", []):
        raise HTTPException(400, "User is not a member")
    if target_id == group.get("created_by"):
        raise HTTPException(400, "Cannot remove the group creator")
    await db.groups.update_one(
        {"id": group_id},
        {"$pull": {"members": target_id, "admins": target_id}, "$inc": {"member_count": -1}}
    )
    return {"message": "Member removed"}


@router.put("/groups/{group_id}")
async def update_group(group_id: str, request: Request, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(404, "Group not found")
    if user["id"] not in group.get("admins", []):
        raise HTTPException(403, "Only admins can update group")
    data = await request.json()
    allowed = {"name", "description", "sport", "avatar_url", "cover_url", "is_private", "max_members"}
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        await db.groups.update_one({"id": group_id}, {"$set": updates})
    return {"message": "Group updated"}


# ═══════════════════════════════════════════════════════════════════════════════
# GROUP CHAT (message-based, polling)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/groups/{group_id}/messages")
async def get_group_messages(
    group_id: str,
    before: str = "",
    limit: int = Query(50, ge=1, le=100),
    user=Depends(get_current_user)
):
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(404, "Group not found")
    if user["id"] not in group.get("members", []):
        raise HTTPException(403, "Must be a member to read messages")

    query = {"group_id": group_id}
    if before:
        query["created_at"] = {"$lt": before}

    # Per-user clear chat: filter out messages before user's cleared_at timestamp
    cleared_at = group.get("cleared_at", {}).get(user["id"])
    if cleared_at:
        query["created_at"] = {**(query.get("created_at") or {}), "$gt": cleared_at}

    messages = await db.group_messages.find(query, {"_id": 0}).sort(
        "created_at", -1
    ).limit(limit).to_list(limit)
    messages.reverse()
    return messages


@router.post("/groups/{group_id}/messages")
async def send_group_message(group_id: str, inp: MessageCreate, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(404, "Group not found")
    if user["id"] not in group.get("members", []):
        raise HTTPException(403, "Must be a member to send messages")

    # Extract @mentions from content
    mentioned_ids = []
    if inp.content:
        import re as _mention_re
        mentions = _mention_re.findall(r"@\[([^\]]+)\]\(([^)]+)\)", inp.content)
        mentioned_ids = [m[1] for m in mentions]

    msg = {
        "id": str(uuid.uuid4()),
        "group_id": group_id,
        "sender_id": user["id"],
        "sender_name": user.get("name", "Unknown"),
        "sender_avatar": user.get("avatar", ""),
        "content": inp.content,
        "media_url": inp.media_url or "",
        "media_type": inp.media_type or "",
        "duration": inp.duration,
        "reply_to": inp.reply_to or "",
        "mentioned_users": mentioned_ids,
        "pinned": False,
        "reactions": [],
        "created_at": now_ist().isoformat(),
    }
    await db.group_messages.insert_one(msg)
    msg.pop("_id", None)

    preview = inp.content[:100] if inp.content else (
        "🎤 Voice message" if inp.media_type == "voice" else
        "📷 Photo" if inp.media_type == "image" or inp.media_url else ""
    )
    await db.groups.update_one({"id": group_id}, {"$set": {
        "last_message": preview,
        "last_message_at": msg["created_at"],
        "last_message_by": user.get("name", "")
    }})

    # Broadcast to group members via WebSocket
    for member_id in group.get("members", []):
        if member_id != user["id"]:
            await chat_manager.send_to_user(member_id, {
                "type": "group_message",
                "group_id": group_id,
                "message": msg,
            })

    return msg


# ═══════════════════════════════════════════════════════════════════════════════
# GROUP CHAT — REACTIONS, DELETE, PIN, SEARCH, TYPING, READ, POLLS
# ═══════════════════════════════════════════════════════════════════════════════

GROUP_REACTIONS = {"thumbsup", "heart", "laugh", "wow", "fire", "clap"}


@router.post("/groups/{group_id}/messages/{message_id}/react")
async def react_group_message(group_id: str, message_id: str, request: Request, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group or user["id"] not in group.get("members", []):
        raise HTTPException(403, "Not a member")
    msg = await db.group_messages.find_one({"id": message_id, "group_id": group_id})
    if not msg:
        raise HTTPException(404, "Message not found")
    data = await request.json()
    emoji = data.get("emoji", "")
    if emoji not in GROUP_REACTIONS:
        raise HTTPException(400, "Invalid reaction")

    reactions = msg.get("reactions", [])
    existing = next((r for r in reactions if r["user_id"] == user["id"] and r["emoji"] == emoji), None)
    if existing:
        await db.group_messages.update_one({"id": message_id}, {"$pull": {"reactions": {"user_id": user["id"], "emoji": emoji}}})
        action = "removed"
    else:
        await db.group_messages.update_one({"id": message_id}, {"$pull": {"reactions": {"user_id": user["id"]}}})
        await db.group_messages.update_one({"id": message_id}, {"$push": {"reactions": {"user_id": user["id"], "user_name": user.get("name", ""), "emoji": emoji}}})
        action = "added"

    for mid in group.get("members", []):
        if mid != user["id"]:
            await chat_manager.send_to_user(mid, {"type": "group_reaction", "group_id": group_id, "message_id": message_id, "user_id": user["id"], "emoji": emoji, "action": action})
    return {"action": action, "emoji": emoji}


@router.delete("/groups/{group_id}/messages/{message_id}")
async def delete_group_message(group_id: str, message_id: str, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group or user["id"] not in group.get("members", []):
        raise HTTPException(403, "Not a member")
    msg = await db.group_messages.find_one({"id": message_id, "group_id": group_id})
    if not msg:
        raise HTTPException(404, "Message not found")
    is_admin = user["id"] in group.get("admins", [])
    if msg["sender_id"] != user["id"] and not is_admin:
        raise HTTPException(403, "Can only delete your own messages (or admin)")
    await db.group_messages.update_one({"id": message_id}, {"$set": {"content": "", "media_url": "", "deleted": True, "deleted_at": now_ist().isoformat(), "deleted_by": user["id"]}})
    for mid in group.get("members", []):
        if mid != user["id"]:
            await chat_manager.send_to_user(mid, {"type": "group_message_deleted", "group_id": group_id, "message_id": message_id})
    return {"deleted": True}


@router.get("/groups/{group_id}/messages/search")
async def search_group_messages(group_id: str, q: str = Query("", min_length=1), page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=50), user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group or user["id"] not in group.get("members", []):
        raise HTTPException(403, "Not a member")
    query = {"group_id": group_id, "deleted": {"$ne": True}, "content": {"$regex": q, "$options": "i"}}
    total = await db.group_messages.count_documents(query)
    skip = (page - 1) * limit
    results = await db.group_messages.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return {"results": results, "total": total, "page": page, "pages": math.ceil(total / max(limit, 1))}


@router.post("/groups/{group_id}/typing")
async def group_typing(group_id: str, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group or user["id"] not in group.get("members", []):
        raise HTTPException(403, "Not a member")
    await db.typing_status.update_one(
        {"group_id": group_id, "user_id": user["id"]},
        {"$set": {"group_id": group_id, "user_id": user["id"], "user_name": user.get("name", ""), "typing_at": now_ist().isoformat()}},
        upsert=True
    )
    for mid in group.get("members", []):
        if mid != user["id"]:
            await chat_manager.send_to_user(mid, {"type": "group_typing", "group_id": group_id, "user_id": user["id"], "user_name": user.get("name", "")})
    return {"ok": True}


@router.get("/groups/{group_id}/typing")
async def get_group_typing(group_id: str, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group or user["id"] not in group.get("members", []):
        return {"typing": []}
    cutoff = now_ist().isoformat()[:-7]  # ~5s tolerance handled client-side
    statuses = await db.typing_status.find({"group_id": group_id, "user_id": {"$ne": user["id"]}}, {"_id": 0}).to_list(50)
    now = now_ist()
    typing = []
    for s in statuses:
        try:
            t = datetime.fromisoformat(s["typing_at"].replace("Z", "+00:00"))
            if (now - t).total_seconds() < 5:
                typing.append({"user_id": s["user_id"], "user_name": s.get("user_name", "")})
        except Exception:
            pass
    return {"typing": typing}


@router.post("/groups/{group_id}/read")
async def mark_group_read(group_id: str, user=Depends(get_current_user)):
    """Mark all messages as read for this user in this group."""
    group = await db.groups.find_one({"id": group_id})
    if not group or user["id"] not in group.get("members", []):
        raise HTTPException(403, "Not a member")
    now = now_ist().isoformat()
    await db.group_read_status.update_one(
        {"group_id": group_id, "user_id": user["id"]},
        {"$set": {"group_id": group_id, "user_id": user["id"], "last_read_at": now}},
        upsert=True
    )
    return {"ok": True}


@router.get("/groups/{group_id}/unread")
async def get_group_unread(group_id: str, user=Depends(get_current_user)):
    status = await db.group_read_status.find_one({"group_id": group_id, "user_id": user["id"]})
    last_read = status.get("last_read_at", "") if status else ""
    query = {"group_id": group_id}
    if last_read:
        query["created_at"] = {"$gt": last_read}
    count = await db.group_messages.count_documents(query)
    return {"unread": count}


@router.get("/groups/{group_id}/seen-by/{message_id}")
async def get_seen_by(group_id: str, message_id: str, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group or user["id"] not in group.get("members", []):
        raise HTTPException(403, "Not a member")
    msg = await db.group_messages.find_one({"id": message_id, "group_id": group_id})
    if not msg:
        return {"seen_by": []}
    msg_time = msg["created_at"]
    reads = await db.group_read_status.find({"group_id": group_id, "last_read_at": {"$gte": msg_time}}, {"_id": 0}).to_list(500)
    user_ids = [r["user_id"] for r in reads if r["user_id"] != msg.get("sender_id")]
    if not user_ids:
        return {"seen_by": []}
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "name": 1, "avatar": 1}).to_list(500)
    return {"seen_by": users}


# --- Pin messages ---

@router.post("/groups/{group_id}/messages/{message_id}/pin")
async def pin_group_message(group_id: str, message_id: str, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group or user["id"] not in group.get("admins", []):
        raise HTTPException(403, "Only admins can pin messages")
    await db.group_messages.update_one({"id": message_id, "group_id": group_id}, {"$set": {"pinned": True, "pinned_by": user["id"], "pinned_at": now_ist().isoformat()}})
    return {"pinned": True}


@router.delete("/groups/{group_id}/messages/{message_id}/pin")
async def unpin_group_message(group_id: str, message_id: str, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group or user["id"] not in group.get("admins", []):
        raise HTTPException(403, "Only admins can unpin messages")
    await db.group_messages.update_one({"id": message_id, "group_id": group_id}, {"$set": {"pinned": False}})
    return {"unpinned": True}


@router.get("/groups/{group_id}/pinned")
async def get_pinned_messages(group_id: str, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group or user["id"] not in group.get("members", []):
        raise HTTPException(403, "Not a member")
    msgs = await db.group_messages.find({"group_id": group_id, "pinned": True}, {"_id": 0}).sort("pinned_at", -1).to_list(50)
    return msgs


# --- Polls ---

@router.post("/groups/{group_id}/polls")
async def create_group_poll(group_id: str, request: Request, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group or user["id"] not in group.get("members", []):
        raise HTTPException(403, "Not a member")
    data = await request.json()
    question = data.get("question", "").strip()
    options = data.get("options", [])
    if not question or len(options) < 2:
        raise HTTPException(400, "Need a question and at least 2 options")

    msg = {
        "id": str(uuid.uuid4()),
        "group_id": group_id,
        "sender_id": user["id"],
        "sender_name": user.get("name", "Unknown"),
        "sender_avatar": user.get("avatar", ""),
        "content": f"📊 Poll: {question}",
        "message_type": "poll",
        "poll": {"question": question, "options": [{"text": o, "votes": []} for o in options[:10]], "multiple": data.get("multiple", False)},
        "media_url": "",
        "reactions": [],
        "pinned": False,
        "created_at": now_ist().isoformat(),
    }
    await db.group_messages.insert_one(msg)
    msg.pop("_id", None)

    await db.groups.update_one({"id": group_id}, {"$set": {"last_message": f"📊 Poll: {question}"[:100], "last_message_at": msg["created_at"], "last_message_by": user.get("name", "")}})
    for mid in group.get("members", []):
        if mid != user["id"]:
            await chat_manager.send_to_user(mid, {"type": "group_message", "group_id": group_id, "message": msg})
    return msg


@router.post("/groups/{group_id}/polls/{message_id}/vote")
async def vote_group_poll(group_id: str, message_id: str, request: Request, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group or user["id"] not in group.get("members", []):
        raise HTTPException(403, "Not a member")
    msg = await db.group_messages.find_one({"id": message_id, "group_id": group_id, "message_type": "poll"})
    if not msg:
        raise HTTPException(404, "Poll not found")
    data = await request.json()
    option_index = data.get("option_index", -1)
    poll = msg.get("poll", {})
    options = poll.get("options", [])
    if option_index < 0 or option_index >= len(options):
        raise HTTPException(400, "Invalid option")

    # Remove previous votes if not multiple choice
    if not poll.get("multiple"):
        for i, opt in enumerate(options):
            if user["id"] in opt.get("votes", []):
                await db.group_messages.update_one({"id": message_id}, {"$pull": {f"poll.options.{i}.votes": user["id"]}})

    # Toggle vote
    if user["id"] in options[option_index].get("votes", []):
        await db.group_messages.update_one({"id": message_id}, {"$pull": {f"poll.options.{option_index}.votes": user["id"]}})
        action = "removed"
    else:
        await db.group_messages.update_one({"id": message_id}, {"$push": {f"poll.options.{option_index}.votes": user["id"]}})
        action = "added"

    updated = await db.group_messages.find_one({"id": message_id}, {"_id": 0, "poll": 1})
    for mid in group.get("members", []):
        if mid != user["id"]:
            await chat_manager.send_to_user(mid, {"type": "group_poll_update", "group_id": group_id, "message_id": message_id, "poll": updated.get("poll")})
    return {"action": action, "poll": updated.get("poll")}


# --- Media gallery ---

@router.get("/groups/{group_id}/media")
async def get_group_media(group_id: str, page: int = Query(1, ge=1), limit: int = Query(30, ge=1, le=100), user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group or user["id"] not in group.get("members", []):
        raise HTTPException(403, "Not a member")
    query = {"group_id": group_id, "media_url": {"$ne": ""}, "deleted": {"$ne": True}}
    total = await db.group_messages.count_documents(query)
    skip = (page - 1) * limit
    media = await db.group_messages.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return {"media": media, "total": total, "page": page}


# --- Mute group ---

@router.post("/groups/{group_id}/mute")
async def toggle_group_mute(group_id: str, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group or user["id"] not in group.get("members", []):
        raise HTTPException(403, "Not a member")
    muted_by = group.get("muted_by", [])
    if user["id"] in muted_by:
        await db.groups.update_one({"id": group_id}, {"$pull": {"muted_by": user["id"]}})
        return {"muted": False}
    else:
        await db.groups.update_one({"id": group_id}, {"$push": {"muted_by": user["id"]}})
        return {"muted": True}


@router.get("/groups/{group_id}/mute")
async def get_group_mute(group_id: str, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(404, "Group not found")
    return {"muted": user["id"] in group.get("muted_by", [])}


@router.post("/groups/{group_id}/clear")
async def clear_group_chat(group_id: str, user=Depends(get_current_user)):
    """Per-user clear chat — only hides messages for this user."""
    group = await db.groups.find_one({"id": group_id})
    if not group or user["id"] not in group.get("members", []):
        raise HTTPException(403, "Not a member")
    now = now_ist().isoformat()
    await db.groups.update_one(
        {"id": group_id},
        {"$set": {f"cleared_at.{user['id']}": now}}
    )
    return {"cleared": True, "cleared_at": now}


# --- Invite link ---

@router.post("/groups/{group_id}/invite-link")
async def generate_invite_link(group_id: str, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group or user["id"] not in group.get("admins", []):
        raise HTTPException(403, "Only admins can generate invite links")
    code = group.get("invite_code")
    if not code:
        code = str(uuid.uuid4())[:8]
        await db.groups.update_one({"id": group_id}, {"$set": {"invite_code": code}})
    return {"invite_code": code, "group_id": group_id}


@router.post("/groups/join/{invite_code}")
async def join_via_invite(invite_code: str, user=Depends(get_current_user)):
    group = await db.groups.find_one({"invite_code": invite_code})
    if not group:
        raise HTTPException(404, "Invalid invite link")
    if user["id"] in group.get("members", []):
        return {"message": "Already a member", "group_id": group["id"]}
    if group.get("member_count", 0) >= group.get("max_members", 500):
        raise HTTPException(400, "Group is full")
    await db.groups.update_one({"id": group["id"]}, {"$push": {"members": user["id"]}, "$inc": {"member_count": 1}})
    return {"message": "Joined group", "group_id": group["id"], "group_name": group.get("name", "")}


# --- Join requests (private groups) ---

@router.post("/groups/{group_id}/join-request")
async def request_to_join(group_id: str, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(404, "Group not found")
    if not group.get("is_private"):
        raise HTTPException(400, "This group is public — join directly")
    if user["id"] in group.get("members", []):
        raise HTTPException(400, "Already a member")
    existing = await db.group_join_requests.find_one({"group_id": group_id, "user_id": user["id"], "status": "pending"})
    if existing:
        raise HTTPException(400, "Request already pending")

    req = {
        "id": str(uuid.uuid4()),
        "group_id": group_id,
        "user_id": user["id"],
        "user_name": user.get("name", ""),
        "user_avatar": user.get("avatar", ""),
        "status": "pending",
        "created_at": now_ist().isoformat(),
    }
    await db.group_join_requests.insert_one(req)
    req.pop("_id", None)
    return req


@router.get("/groups/{group_id}/join-requests")
async def list_join_requests(group_id: str, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group or user["id"] not in group.get("admins", []):
        raise HTTPException(403, "Only admins can view join requests")
    requests = await db.group_join_requests.find({"group_id": group_id, "status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return requests


@router.post("/groups/{group_id}/join-requests/{request_id}/approve")
async def approve_join_request(group_id: str, request_id: str, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group or user["id"] not in group.get("admins", []):
        raise HTTPException(403, "Only admins can approve requests")
    req = await db.group_join_requests.find_one({"id": request_id, "group_id": group_id, "status": "pending"})
    if not req:
        raise HTTPException(404, "Request not found")
    await db.group_join_requests.update_one({"id": request_id}, {"$set": {"status": "approved"}})
    await db.groups.update_one({"id": group_id}, {"$push": {"members": req["user_id"]}, "$inc": {"member_count": 1}})
    return {"message": "Request approved"}


@router.post("/groups/{group_id}/join-requests/{request_id}/reject")
async def reject_join_request(group_id: str, request_id: str, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group or user["id"] not in group.get("admins", []):
        raise HTTPException(403, "Only admins can reject requests")
    await db.group_join_requests.update_one({"id": request_id, "group_id": group_id}, {"$set": {"status": "rejected"}})
    return {"message": "Request rejected"}


# --- Member roles/badges ---

@router.put("/groups/{group_id}/members/{target_id}/role")
async def set_member_role(group_id: str, target_id: str, request: Request, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group or user["id"] not in group.get("admins", []):
        raise HTTPException(403, "Only admins can set roles")
    if target_id not in group.get("members", []):
        raise HTTPException(400, "User is not a member")
    data = await request.json()
    role = data.get("role", "").strip()
    if role:
        await db.groups.update_one({"id": group_id}, {"$set": {f"member_roles.{target_id}": role}})
    else:
        await db.groups.update_one({"id": group_id}, {"$unset": {f"member_roles.{target_id}": ""}})
    return {"message": f"Role set to '{role}'" if role else "Role removed"}


# --- Online members ---

@router.get("/groups/{group_id}/online")
async def get_group_online(group_id: str, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group or user["id"] not in group.get("members", []):
        raise HTTPException(403, "Not a member")
    online = [mid for mid in group.get("members", []) if chat_manager.is_online(mid)]
    return {"online": online, "count": len(online)}


# --- Unread counts for all user groups ---

@router.get("/groups/unread/all")
async def get_all_group_unreads(user=Depends(get_current_user)):
    groups = await db.groups.find({"members": user["id"]}, {"id": 1}).to_list(100)
    result = {}
    for g in groups:
        gid = g["id"]
        status = await db.group_read_status.find_one({"group_id": gid, "user_id": user["id"]})
        last_read = status.get("last_read_at", "") if status else ""
        query = {"group_id": gid}
        if last_read:
            query["created_at"] = {"$gt": last_read}
        result[gid] = await db.group_messages.count_documents(query)
    return result


# --- Message forwarding ---

@router.post("/messages/forward")
async def forward_message(request: Request, user=Depends(get_current_user)):
    """Forward a message to a group or DM conversation."""
    data = await request.json()
    source_type = data.get("source_type", "")  # "group" or "dm"
    source_id = data.get("source_id", "")  # group_id or conversation_id
    message_id = data.get("message_id", "")
    target_type = data.get("target_type", "")  # "group" or "dm"
    target_id = data.get("target_id", "")  # group_id or conversation_id

    # Fetch original message
    if source_type == "group":
        orig = await db.group_messages.find_one({"id": message_id, "group_id": source_id})
    else:
        orig = await db.direct_messages.find_one({"id": message_id, "conversation_id": source_id})
    if not orig:
        raise HTTPException(404, "Message not found")

    content = orig.get("content", "")
    if source_type == "dm" and content:
        content = decrypt_message(content, source_id)

    now = now_ist().isoformat()

    if target_type == "group":
        group = await db.groups.find_one({"id": target_id})
        if not group or user["id"] not in group.get("members", []):
            raise HTTPException(403, "Not a member of target group")
        fwd = {
            "id": str(uuid.uuid4()), "group_id": target_id,
            "sender_id": user["id"], "sender_name": user.get("name", "Unknown"), "sender_avatar": user.get("avatar", ""),
            "content": content, "media_url": orig.get("media_url", ""),
            "forwarded_from": orig.get("sender_name", ""), "reactions": [], "pinned": False,
            "created_at": now,
        }
        await db.group_messages.insert_one(fwd)
        fwd.pop("_id", None)
        await db.groups.update_one({"id": target_id}, {"$set": {"last_message": content[:100], "last_message_at": now, "last_message_by": user.get("name", "")}})
        for mid in group.get("members", []):
            if mid != user["id"]:
                await chat_manager.send_to_user(mid, {"type": "group_message", "group_id": target_id, "message": fwd})
        return fwd
    else:
        convo = await db.conversations.find_one({"id": target_id})
        if not convo or user["id"] not in convo.get("participants", []):
            raise HTTPException(403, "Not your conversation")
        encrypted = encrypt_message(content, target_id) if content else ""
        fwd = {
            "id": str(uuid.uuid4()), "conversation_id": target_id,
            "sender_id": user["id"], "sender_name": user.get("name", "Unknown"), "sender_avatar": user.get("avatar", ""),
            "content": encrypted, "media_url": orig.get("media_url", ""), "media_type": orig.get("media_type", ""),
            "forwarded_from": orig.get("sender_name", ""), "read": False,
            "created_at": now,
        }
        await db.direct_messages.insert_one(fwd)
        fwd.pop("_id", None)
        preview = encrypt_message(content[:100], target_id) if content else ""
        await db.conversations.update_one({"id": target_id}, {"$set": {"last_message": preview, "last_message_at": now, "last_message_by": user.get("name", "")}})
        fwd_response = {**fwd, "content": content}
        other_id = next((p for p in convo.get("participants", []) if p != user["id"]), None)
        if other_id:
            await chat_manager.send_to_user(other_id, {"type": "new_message", "conversation_id": target_id, "message": fwd_response})
        return fwd_response


# ═══════════════════════════════════════════════════════════════════════════════
# TEAMS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/teams")
async def create_team(inp: TeamCreate, user=Depends(get_current_user)):
    team = {
        "id": str(uuid.uuid4()),
        "name": inp.name,
        "sport": inp.sport,
        "description": inp.description,
        "avatar_url": inp.avatar_url or "",
        "max_players": inp.max_players,
        "skill_range_min": inp.skill_range_min,
        "skill_range_max": inp.skill_range_max,
        "captain_id": user["id"],
        "captain_name": user.get("name", ""),
        "players": [{"id": user["id"], "name": user.get("name", ""), "role": "captain", "joined_at": now_ist().isoformat()}],
        "player_count": 1,
        "wins": 0,
        "losses": 0,
        "draws": 0,
        "created_at": now_ist().isoformat(),
    }
    await db.teams.insert_one(team)
    team.pop("_id", None)
    return team


@router.get("/teams")
async def list_teams(
    search: str = "",
    sport: str = "",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user=Depends(get_current_user)
):
    query = {}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    if sport:
        query["sport"] = sport

    skip = (page - 1) * limit
    teams = await db.teams.find(query, {"_id": 0}).sort(
        "wins", -1
    ).skip(skip).limit(limit).to_list(limit)

    for t in teams:
        player_ids = [p["id"] for p in t.get("players", [])]
        t["is_member"] = user["id"] in player_ids
        t["is_captain"] = t.get("captain_id") == user["id"]

    total = await db.teams.count_documents(query)
    return {"teams": teams, "total": total, "page": page, "pages": math.ceil(total / max(limit, 1))}


@router.get("/teams/my")
async def my_teams(user=Depends(get_current_user)):
    teams = await db.teams.find(
        {"players.id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    for t in teams:
        t["is_member"] = True
        t["is_captain"] = t.get("captain_id") == user["id"]
    return teams


@router.get("/teams/{team_id}")
async def get_team(team_id: str, user=Depends(get_current_user)):
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(404, "Team not found")
    player_ids = [p["id"] for p in team.get("players", [])]
    team["is_member"] = user["id"] in player_ids
    team["is_captain"] = team.get("captain_id") == user["id"]

    # Enrich player details
    details = await db.users.find(
        {"id": {"$in": player_ids}},
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "skill_rating": 1}
    ).to_list(50)
    detail_map = {d["id"]: d for d in details}
    for p in team.get("players", []):
        info = detail_map.get(p["id"], {})
        p["avatar"] = info.get("avatar", "")
        p["skill_rating"] = info.get("skill_rating", 1500)
    return team


@router.post("/teams/{team_id}/join")
async def join_team(team_id: str, user=Depends(get_current_user)):
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(404, "Team not found")
    player_ids = [p["id"] for p in team.get("players", [])]
    if user["id"] in player_ids:
        raise HTTPException(400, "Already on this team")
    if team.get("player_count", 0) >= team.get("max_players", 20):
        raise HTTPException(400, "Team is full")

    player_entry = {
        "id": user["id"],
        "name": user.get("name", ""),
        "role": "player",
        "joined_at": now_ist().isoformat()
    }
    await db.teams.update_one(
        {"id": team_id},
        {"$push": {"players": player_entry}, "$inc": {"player_count": 1}}
    )
    return {"message": "Joined team", "team_id": team_id}


@router.post("/teams/{team_id}/leave")
async def leave_team(team_id: str, user=Depends(get_current_user)):
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(404, "Team not found")
    player_ids = [p["id"] for p in team.get("players", [])]
    if user["id"] not in player_ids:
        raise HTTPException(400, "Not on this team")
    if user["id"] == team.get("captain_id") and team.get("player_count", 0) > 1:
        raise HTTPException(400, "Captain must transfer captaincy before leaving")

    await db.teams.update_one(
        {"id": team_id},
        {"$pull": {"players": {"id": user["id"]}}, "$inc": {"player_count": -1}}
    )
    return {"message": "Left team"}


@router.delete("/teams/{team_id}")
async def delete_team(team_id: str, user=Depends(get_current_user)):
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(404, "Team not found")
    if user["id"] != team.get("captain_id"):
        raise HTTPException(403, "Only the captain can disband the team")
    await db.teams.delete_one({"id": team_id})
    return {"message": "Team disbanded"}


# ═══════════════════════════════════════════════════════════════════════════════
# DIRECT MESSAGES (WhatsApp-like 1-on-1 chat)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/chat/conversations")
async def get_conversations(user=Depends(get_current_user)):
    """List DM conversations for current user.
    Shows: active convos + requests where user is the sender (they see it in main inbox).
    Hides: requests where user is the recipient (those go to /chat/requests).
    """
    convos = await db.conversations.find(
        {"participants": user["id"]}, {"_id": 0}
    ).sort("last_message_at", -1).to_list(50)

    result = []
    request_count = 0
    for c in convos:
        status = c.get("status", "active")  # backward compat: missing = active
        # Count incoming requests for badge
        if status == "request" and c.get("requester_id") != user["id"]:
            request_count += 1
            continue  # Don't show in main inbox
        if status == "declined":
            continue  # Hide declined

        # Find the other participant
        other_id = next((p for p in c.get("participants", []) if p != user["id"]), None)
        if other_id:
            other = await db.users.find_one(
                {"id": other_id}, {"_id": 0, "id": 1, "name": 1, "avatar": 1}
            )
            c["other_user"] = other or {"id": other_id, "name": "Unknown", "avatar": ""}
        # Decrypt last_message preview
        if c.get("last_message"):
            c["last_message"] = decrypt_message(c["last_message"], c["id"])
        # Unread count
        c["unread_count"] = await db.direct_messages.count_documents({
            "conversation_id": c["id"],
            "sender_id": {"$ne": user["id"]},
            "read": False
        })
        result.append(c)
    # Attach request count as header so frontend can show badge
    return {"conversations": result, "request_count": request_count}


@router.get("/chat/unified-conversations")
async def get_unified_conversations(user=Depends(get_current_user)):
    """Merge DM conversations + user's groups into one sorted list."""
    # 1. DM conversations (reuse get_conversations logic)
    convos = await db.conversations.find(
        {"participants": user["id"]}, {"_id": 0}
    ).sort("last_message_at", -1).to_list(50)

    result = []
    request_count = 0
    for c in convos:
        status = c.get("status", "active")
        if status == "request" and c.get("requester_id") != user["id"]:
            request_count += 1
            continue
        if status == "declined":
            continue
        other_id = next((p for p in c.get("participants", []) if p != user["id"]), None)
        if other_id:
            other = await db.users.find_one(
                {"id": other_id}, {"_id": 0, "id": 1, "name": 1, "avatar": 1, "current_streak": 1}
            )
            c["other_user"] = other or {"id": other_id, "name": "Unknown", "avatar": ""}
        if c.get("last_message"):
            c["last_message"] = decrypt_message(c["last_message"], c["id"])
        c["unread_count"] = await db.direct_messages.count_documents({
            "conversation_id": c["id"],
            "sender_id": {"$ne": user["id"]},
            "read": False
        })
        c["type"] = "dm"
        c["display_name"] = c.get("other_user", {}).get("name", "Unknown")
        c["display_avatar"] = c.get("other_user", {}).get("avatar", "")
        result.append(c)

    # 2. User's groups
    groups = await db.groups.find(
        {"members": user["id"]}, {"_id": 0}
    ).sort("last_message_at", -1).to_list(100)

    for g in groups:
        # Compute unread count
        read_status = await db.group_read_status.find_one(
            {"group_id": g["id"], "user_id": user["id"]}
        )
        last_read = read_status.get("last_read_at", "") if read_status else ""
        unread_query = {"group_id": g["id"]}
        if last_read:
            unread_query["created_at"] = {"$gt": last_read}
        unread = await db.group_messages.count_documents(unread_query)

        g["type"] = "group"
        g["unread_count"] = unread
        g["display_name"] = g.get("name", "Group")
        g["display_avatar"] = g.get("avatar_url", "")
        g["is_member"] = True
        g["is_admin"] = user["id"] in g.get("admins", [])
        result.append(g)

    # 3. Sort merged list by last_message_at DESC
    result.sort(key=lambda x: x.get("last_message_at", ""), reverse=True)

    return {"conversations": result, "request_count": request_count}


@router.post("/chat/conversations")
async def start_conversation(request: Request, user=Depends(get_current_user)):
    """Start or get existing conversation with another user.
    Checks mutual follow — if both follow each other, conversation is active.
    Otherwise it's a message request that the recipient must accept.
    """
    data = await request.json()
    other_id = data.get("user_id", "")
    if not other_id or other_id == user["id"]:
        raise HTTPException(400, "Invalid user ID")

    other = await db.users.find_one({"id": other_id})
    if not other:
        raise HTTPException(404, "User not found")

    # Check for existing conversation
    existing = await db.conversations.find_one({
        "participants": {"$all": [user["id"], other_id], "$size": 2}
    }, {"_id": 0})
    if existing:
        # If previously declined, allow re-request
        if existing.get("status") == "declined" and existing.get("requester_id") == user["id"]:
            await db.conversations.update_one(
                {"id": existing["id"]},
                {"$set": {"status": "request", "requested_at": now_ist().isoformat()}}
            )
            existing["status"] = "request"
        existing["other_user"] = {"id": other_id, "name": other.get("name", ""), "avatar": other.get("avatar", "")}
        return existing

    # Check mutual follow to decide active vs request
    i_follow = await db.follows.find_one({"follower_id": user["id"], "following_id": other_id})
    they_follow = await db.follows.find_one({"follower_id": other_id, "following_id": user["id"]})
    is_mutual = bool(i_follow and they_follow)

    now = now_ist().isoformat()
    convo = {
        "id": str(uuid.uuid4()),
        "participants": [user["id"], other_id],
        "status": "active" if is_mutual else "request",
        "requester_id": user["id"] if not is_mutual else "",
        "requested_at": now if not is_mutual else "",
        "last_message": "",
        "last_message_at": now,
        "last_message_by": "",
        "created_at": now,
    }
    await db.conversations.insert_one(convo)
    convo.pop("_id", None)
    convo["other_user"] = {"id": other_id, "name": other.get("name", ""), "avatar": other.get("avatar", "")}
    return convo


@router.get("/chat/{conversation_id}/messages")
async def get_dm_messages(
    conversation_id: str,
    before: str = "",
    limit: int = Query(50, ge=1, le=100),
    user=Depends(get_current_user)
):
    convo = await db.conversations.find_one({"id": conversation_id})
    if not convo or user["id"] not in convo.get("participants", []):
        raise HTTPException(403, "Not your conversation")

    query = {"conversation_id": conversation_id}
    if before:
        query["created_at"] = {"$lt": before}

    # Per-user clear chat: filter out messages before user's cleared_at timestamp
    cleared_at = convo.get("cleared_at", {}).get(user["id"])
    if cleared_at:
        query["created_at"] = {**(query.get("created_at") or {}), "$gt": cleared_at}

    messages = await db.direct_messages.find(query, {"_id": 0}).sort(
        "created_at", -1
    ).limit(limit).to_list(limit)
    messages.reverse()

    # Decrypt message content
    for m in messages:
        if m.get("content"):
            m["content"] = decrypt_message(m["content"], conversation_id)

    # Mark as read
    result = await db.direct_messages.update_many(
        {"conversation_id": conversation_id, "sender_id": {"$ne": user["id"]}, "read": False},
        {"$set": {"read": True}}
    )
    # Broadcast read receipt via WebSocket
    if result.modified_count > 0:
        other_id = next((p for p in convo.get("participants", []) if p != user["id"]), None)
        if other_id:
            await chat_manager.send_to_user(other_id, {
                "type": "messages_read",
                "conversation_id": conversation_id,
                "reader_id": user["id"],
            })
    return messages


@router.post("/chat/{conversation_id}/messages")
async def send_dm(conversation_id: str, inp: MessageCreate, user=Depends(get_current_user)):
    convo = await db.conversations.find_one({"id": conversation_id})
    if not convo or user["id"] not in convo.get("participants", []):
        raise HTTPException(403, "Not your conversation")

    # Message request enforcement
    status = convo.get("status", "active")
    if status == "request" and convo.get("requester_id") != user["id"]:
        raise HTTPException(403, "Accept the message request before replying")
    if status == "declined":
        raise HTTPException(403, "This conversation request was declined")

    plaintext_content = inp.content or ""
    encrypted_content = encrypt_message(plaintext_content, conversation_id) if plaintext_content else ""

    msg = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "sender_id": user["id"],
        "sender_name": user.get("name", "Unknown"),
        "sender_avatar": user.get("avatar", ""),
        "content": encrypted_content,
        "media_url": inp.media_url or "",
        "media_type": inp.media_type or "",
        "file_name": inp.file_name or "",
        "duration": inp.duration,
        "reply_to": inp.reply_to or "",
        "read": False,
        "created_at": now_ist().isoformat(),
    }
    if inp.shared_post:
        msg["shared_post"] = inp.shared_post
    await db.direct_messages.insert_one(msg)
    msg.pop("_id", None)

    preview = plaintext_content[:100] if plaintext_content else (
        "🔗 Shared a post" if inp.shared_post else
        "🎤 Voice message" if inp.media_type == "voice" else
        f"📎 {inp.file_name or 'File'}" if inp.media_type else ""
    )
    encrypted_preview = encrypt_message(preview, conversation_id) if preview else ""
    await db.conversations.update_one({"id": conversation_id}, {"$set": {
        "last_message": encrypted_preview,
        "last_message_at": msg["created_at"],
        "last_message_by": user.get("name", "")
    }})

    # Return plaintext to sender + broadcast plaintext via WebSocket
    msg_response = {**msg, "content": plaintext_content}
    other_id = next((p for p in convo.get("participants", []) if p != user["id"]), None)
    if other_id:
        await chat_manager.send_to_user(other_id, {
            "type": "new_message",
            "conversation_id": conversation_id,
            "message": msg_response,
        })

    return msg_response


@router.get("/chat/unread-total")
async def unread_total(user=Depends(get_current_user)):
    """Total unread DMs across all conversations."""
    count = await db.direct_messages.count_documents({
        "sender_id": {"$ne": user["id"]},
        "read": False,
        "conversation_id": {"$in": [
            c["id"] async for c in db.conversations.find(
                {"participants": user["id"]}, {"id": 1}
            )
        ]}
    })
    return {"count": count}


# ═══════════════════════════════════════════════════════════════════════════════
# MESSAGE DELETE + ONLINE STATUS + TYPING
# ═══════════════════════════════════════════════════════════════════════════════

@router.delete("/chat/{conversation_id}/messages/{message_id}")
async def delete_message(conversation_id: str, message_id: str, user=Depends(get_current_user)):
    """Delete a message (only sender can delete)."""
    msg = await db.direct_messages.find_one({"id": message_id, "conversation_id": conversation_id})
    if not msg:
        raise HTTPException(404, "Message not found")
    if msg["sender_id"] != user["id"]:
        raise HTTPException(403, "Can only delete your own messages")
    await db.direct_messages.update_one(
        {"id": message_id},
        {"$set": {"content": "", "deleted": True, "deleted_at": now_ist().isoformat()}}
    )
    # Broadcast deletion via WebSocket
    convo = await db.conversations.find_one({"id": conversation_id})
    if convo:
        other_id = next((p for p in convo.get("participants", []) if p != user["id"]), None)
        if other_id:
            await chat_manager.send_to_user(other_id, {
                "type": "message_deleted",
                "conversation_id": conversation_id,
                "message_id": message_id,
            })
    return {"deleted": True}


@router.post("/chat/online")
async def update_online_status(user=Depends(get_current_user)):
    """Heartbeat to track online status."""
    await db.online_status.update_one(
        {"user_id": user["id"]},
        {"$set": {"user_id": user["id"], "last_seen": now_ist().isoformat(), "online": True}},
        upsert=True,
    )
    return {"ok": True}


@router.get("/chat/online/{user_id}")
async def get_online_status(user_id: str, user=Depends(get_current_user)):
    """Check if a user is online."""
    status = await db.online_status.find_one({"user_id": user_id}, {"_id": 0})
    if not status:
        return {"online": False, "last_seen": None}
    # Consider offline if last heartbeat > 30 seconds ago
    last_seen = status.get("last_seen", "")
    if last_seen:
        try:
            last_dt = datetime.fromisoformat(last_seen.replace("Z", "+00:00"))
            diff = (now_ist() - last_dt).total_seconds()
            return {"online": diff < 30, "last_seen": last_seen}
        except Exception:
            pass
    return {"online": False, "last_seen": last_seen}


@router.post("/chat/{conversation_id}/typing")
async def set_typing(conversation_id: str, user=Depends(get_current_user)):
    """Signal that user is typing."""
    await db.typing_status.update_one(
        {"conversation_id": conversation_id, "user_id": user["id"]},
        {"$set": {
            "conversation_id": conversation_id,
            "user_id": user["id"],
            "typing_at": now_ist().isoformat(),
        }},
        upsert=True,
    )
    return {"ok": True}


@router.get("/chat/{conversation_id}/typing")
async def get_typing(conversation_id: str, user=Depends(get_current_user)):
    """Check if other user is typing."""
    convo = await db.conversations.find_one({"id": conversation_id})
    if not convo:
        return {"typing": False}
    other_id = [p for p in convo["participants"] if p != user["id"]]
    if not other_id:
        return {"typing": False}
    status = await db.typing_status.find_one(
        {"conversation_id": conversation_id, "user_id": other_id[0]}, {"_id": 0}
    )
    if not status:
        return {"typing": False}
    try:
        typing_at = datetime.fromisoformat(status["typing_at"].replace("Z", "+00:00"))
        diff = (now_ist() - typing_at).total_seconds()
        return {"typing": diff < 5}  # Typing status expires after 5 seconds
    except Exception:
        return {"typing": False}


# ═══════════════════════════════════════════════════════════════════════════════
# USER SEARCH (for starting DMs, inviting to groups/teams)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/users/search")
async def search_users(
    q: str = Query("", min_length=1),
    limit: int = Query(20, ge=1, le=50),
    user=Depends(get_current_user)
):
    users = await db.users.find(
        {"name": {"$regex": q, "$options": "i"}, "id": {"$ne": user["id"]}},
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "role": 1, "skill_rating": 1}
    ).limit(limit).to_list(limit)
    return users


# ═══════════════════════════════════════════════════════════════════════════════
# MESSAGE REACTIONS
# ═══════════════════════════════════════════════════════════════════════════════

CHAT_REACTIONS = {"thumbsup", "heart", "laugh", "wow", "fire", "clap"}


@router.post("/chat/{conversation_id}/messages/{message_id}/react")
async def react_to_message(conversation_id: str, message_id: str, request: Request, user=Depends(get_current_user)):
    convo = await db.conversations.find_one({"id": conversation_id})
    if not convo or user["id"] not in convo.get("participants", []):
        raise HTTPException(403, "Not your conversation")

    msg = await db.direct_messages.find_one({"id": message_id, "conversation_id": conversation_id})
    if not msg:
        raise HTTPException(404, "Message not found")

    data = await request.json()
    emoji = data.get("emoji", "")
    if emoji not in CHAT_REACTIONS:
        raise HTTPException(400, f"Invalid reaction")

    reactions = msg.get("reactions", [])
    existing = next((r for r in reactions if r["user_id"] == user["id"] and r["emoji"] == emoji), None)

    if existing:
        await db.direct_messages.update_one(
            {"id": message_id},
            {"$pull": {"reactions": {"user_id": user["id"], "emoji": emoji}}}
        )
        action = "removed"
    else:
        # Remove any previous reaction from this user, then add new
        await db.direct_messages.update_one(
            {"id": message_id},
            {"$pull": {"reactions": {"user_id": user["id"]}}}
        )
        await db.direct_messages.update_one(
            {"id": message_id},
            {"$push": {"reactions": {"user_id": user["id"], "user_name": user.get("name", ""), "emoji": emoji}}}
        )
        action = "added"

    # Broadcast via WebSocket
    other_id = next((p for p in convo["participants"] if p != user["id"]), None)
    if other_id:
        await chat_manager.send_to_user(other_id, {
            "type": "message_reaction",
            "conversation_id": conversation_id,
            "message_id": message_id,
            "user_id": user["id"],
            "emoji": emoji,
            "action": action,
        })

    return {"action": action, "emoji": emoji}


# ═══════════════════════════════════════════════════════════════════════════════
# MESSAGE SEARCH
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/chat/{conversation_id}/search")
async def search_messages(
    conversation_id: str,
    q: str = Query("", min_length=1),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user=Depends(get_current_user)
):
    convo = await db.conversations.find_one({"id": conversation_id})
    if not convo or user["id"] not in convo.get("participants", []):
        raise HTTPException(403, "Not your conversation")

    # Fetch all non-deleted messages, decrypt, and search server-side
    # (encrypted content can't be searched via MongoDB regex)
    all_msgs = await db.direct_messages.find(
        {"conversation_id": conversation_id, "deleted": {"$ne": True}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(5000)

    pattern = _re.compile(_re.escape(q), _re.IGNORECASE)
    matched = []
    for m in all_msgs:
        decrypted = decrypt_message(m.get("content", ""), conversation_id)
        if pattern.search(decrypted):
            m["content"] = decrypted
            matched.append(m)

    total = len(matched)
    skip_n = (page - 1) * limit
    results = matched[skip_n:skip_n + limit]

    return {"results": results, "total": total, "page": page, "pages": math.ceil(total / max(limit, 1)), "query": q}


# ═══════════════════════════════════════════════════════════════════════════════
# DM ENHANCEMENTS — PIN, POLLS, MEDIA GALLERY, MUTE
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/chat/{conversation_id}/messages/{message_id}/pin")
async def pin_dm_message(conversation_id: str, message_id: str, user=Depends(get_current_user)):
    convo = await db.conversations.find_one({"id": conversation_id})
    if not convo or user["id"] not in convo.get("participants", []):
        raise HTTPException(403, "Not your conversation")
    await db.direct_messages.update_one({"id": message_id, "conversation_id": conversation_id}, {"$set": {"pinned": True, "pinned_by": user["id"], "pinned_at": now_ist().isoformat()}})
    return {"pinned": True}


@router.delete("/chat/{conversation_id}/messages/{message_id}/pin")
async def unpin_dm_message(conversation_id: str, message_id: str, user=Depends(get_current_user)):
    convo = await db.conversations.find_one({"id": conversation_id})
    if not convo or user["id"] not in convo.get("participants", []):
        raise HTTPException(403, "Not your conversation")
    await db.direct_messages.update_one({"id": message_id, "conversation_id": conversation_id}, {"$set": {"pinned": False}})
    return {"unpinned": True}


@router.get("/chat/{conversation_id}/pinned")
async def get_pinned_dm_messages(conversation_id: str, user=Depends(get_current_user)):
    convo = await db.conversations.find_one({"id": conversation_id})
    if not convo or user["id"] not in convo.get("participants", []):
        raise HTTPException(403, "Not your conversation")
    msgs = await db.direct_messages.find({"conversation_id": conversation_id, "pinned": True}, {"_id": 0}).sort("pinned_at", -1).to_list(50)
    for m in msgs:
        if m.get("content"):
            m["content"] = decrypt_message(m["content"], conversation_id)
    return msgs


@router.post("/chat/{conversation_id}/polls")
async def create_dm_poll(conversation_id: str, request: Request, user=Depends(get_current_user)):
    convo = await db.conversations.find_one({"id": conversation_id})
    if not convo or user["id"] not in convo.get("participants", []):
        raise HTTPException(403, "Not your conversation")
    data = await request.json()
    question = data.get("question", "").strip()
    options = data.get("options", [])
    if not question or len(options) < 2:
        raise HTTPException(400, "Need a question and at least 2 options")

    msg = {
        "id": str(uuid.uuid4()), "conversation_id": conversation_id,
        "sender_id": user["id"], "sender_name": user.get("name", "Unknown"), "sender_avatar": user.get("avatar", ""),
        "content": encrypt_message(f"📊 Poll: {question}", conversation_id),
        "message_type": "poll",
        "poll": {"question": question, "options": [{"text": o, "votes": []} for o in options[:10]], "multiple": data.get("multiple", False)},
        "media_url": "", "read": False, "created_at": now_ist().isoformat(),
    }
    await db.direct_messages.insert_one(msg)
    msg.pop("_id", None)

    preview = encrypt_message(f"📊 Poll: {question}"[:100], conversation_id)
    await db.conversations.update_one({"id": conversation_id}, {"$set": {"last_message": preview, "last_message_at": msg["created_at"], "last_message_by": user.get("name", "")}})

    msg_response = {**msg, "content": f"📊 Poll: {question}"}
    other_id = next((p for p in convo.get("participants", []) if p != user["id"]), None)
    if other_id:
        await chat_manager.send_to_user(other_id, {"type": "new_message", "conversation_id": conversation_id, "message": msg_response})
    return msg_response


@router.post("/chat/{conversation_id}/polls/{message_id}/vote")
async def vote_dm_poll(conversation_id: str, message_id: str, request: Request, user=Depends(get_current_user)):
    convo = await db.conversations.find_one({"id": conversation_id})
    if not convo or user["id"] not in convo.get("participants", []):
        raise HTTPException(403, "Not your conversation")
    msg = await db.direct_messages.find_one({"id": message_id, "conversation_id": conversation_id, "message_type": "poll"})
    if not msg:
        raise HTTPException(404, "Poll not found")
    data = await request.json()
    option_index = data.get("option_index", -1)
    poll = msg.get("poll", {})
    options = poll.get("options", [])
    if option_index < 0 or option_index >= len(options):
        raise HTTPException(400, "Invalid option")

    if not poll.get("multiple"):
        for i, opt in enumerate(options):
            if user["id"] in opt.get("votes", []):
                await db.direct_messages.update_one({"id": message_id}, {"$pull": {f"poll.options.{i}.votes": user["id"]}})

    if user["id"] in options[option_index].get("votes", []):
        await db.direct_messages.update_one({"id": message_id}, {"$pull": {f"poll.options.{option_index}.votes": user["id"]}})
        action = "removed"
    else:
        await db.direct_messages.update_one({"id": message_id}, {"$push": {f"poll.options.{option_index}.votes": user["id"]}})
        action = "added"

    updated = await db.direct_messages.find_one({"id": message_id}, {"_id": 0, "poll": 1})
    other_id = next((p for p in convo.get("participants", []) if p != user["id"]), None)
    if other_id:
        await chat_manager.send_to_user(other_id, {"type": "poll_update", "conversation_id": conversation_id, "message_id": message_id, "poll": updated.get("poll")})
    return {"action": action, "poll": updated.get("poll")}


@router.get("/chat/{conversation_id}/media")
async def get_dm_media(conversation_id: str, page: int = Query(1, ge=1), limit: int = Query(30, ge=1, le=100), user=Depends(get_current_user)):
    convo = await db.conversations.find_one({"id": conversation_id})
    if not convo or user["id"] not in convo.get("participants", []):
        raise HTTPException(403, "Not your conversation")
    query = {"conversation_id": conversation_id, "media_url": {"$ne": ""}, "deleted": {"$ne": True}}
    total = await db.direct_messages.count_documents(query)
    skip = (page - 1) * limit
    media = await db.direct_messages.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return {"media": media, "total": total, "page": page}


@router.post("/chat/{conversation_id}/mute")
async def toggle_dm_mute(conversation_id: str, user=Depends(get_current_user)):
    convo = await db.conversations.find_one({"id": conversation_id})
    if not convo or user["id"] not in convo.get("participants", []):
        raise HTTPException(403, "Not your conversation")
    muted_by = convo.get("muted_by", [])
    if user["id"] in muted_by:
        await db.conversations.update_one({"id": conversation_id}, {"$pull": {"muted_by": user["id"]}})
        return {"muted": False}
    else:
        await db.conversations.update_one({"id": conversation_id}, {"$push": {"muted_by": user["id"]}})
        return {"muted": True}


@router.post("/chat/{conversation_id}/clear")
async def clear_dm_chat(conversation_id: str, user=Depends(get_current_user)):
    """Per-user clear chat — only hides messages for this user, not the other."""
    convo = await db.conversations.find_one({"id": conversation_id})
    if not convo or user["id"] not in convo.get("participants", []):
        raise HTTPException(403, "Not your conversation")
    now = now_ist().isoformat()
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {f"cleared_at.{user['id']}": now}}
    )
    return {"cleared": True, "cleared_at": now}


# ═══════════════════════════════════════════════════════════════════════════════
# MESSAGE REQUESTS (Instagram-style)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/chat/requests")
async def get_message_requests(user=Depends(get_current_user)):
    """List incoming message requests for the current user."""
    convos = await db.conversations.find(
        {"participants": user["id"], "status": "request", "requester_id": {"$ne": user["id"]}},
        {"_id": 0}
    ).sort("requested_at", -1).to_list(50)

    for c in convos:
        other_id = c.get("requester_id", "")
        if other_id:
            other = await db.users.find_one(
                {"id": other_id}, {"_id": 0, "id": 1, "name": 1, "avatar": 1}
            )
            c["other_user"] = other or {"id": other_id, "name": "Unknown", "avatar": ""}
        if c.get("last_message"):
            c["last_message"] = decrypt_message(c["last_message"], c["id"])
        c["unread_count"] = await db.direct_messages.count_documents({
            "conversation_id": c["id"], "sender_id": {"$ne": user["id"]}, "read": False
        })
    return convos


@router.post("/chat/{conversation_id}/accept")
async def accept_message_request(conversation_id: str, user=Depends(get_current_user)):
    """Accept a message request — moves conversation to active."""
    convo = await db.conversations.find_one({"id": conversation_id})
    if not convo or user["id"] not in convo.get("participants", []):
        raise HTTPException(403, "Not your conversation")
    if convo.get("status") != "request":
        raise HTTPException(400, "Not a pending request")
    if convo.get("requester_id") == user["id"]:
        raise HTTPException(400, "You sent this request — wait for the other person to accept")

    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"status": "active", "accepted_at": now_ist().isoformat()}}
    )
    # Notify requester via WebSocket
    await chat_manager.send_to_user(convo["requester_id"], {
        "type": "request_accepted",
        "conversation_id": conversation_id,
        "accepted_by": user.get("name", ""),
    })
    return {"accepted": True}


@router.post("/chat/{conversation_id}/decline")
async def decline_message_request(conversation_id: str, user=Depends(get_current_user)):
    """Decline a message request."""
    convo = await db.conversations.find_one({"id": conversation_id})
    if not convo or user["id"] not in convo.get("participants", []):
        raise HTTPException(403, "Not your conversation")
    if convo.get("status") != "request":
        raise HTTPException(400, "Not a pending request")
    if convo.get("requester_id") == user["id"]:
        raise HTTPException(400, "You sent this request")

    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"status": "declined", "declined_at": now_ist().isoformat()}}
    )
    return {"declined": True}


# ═══════════════════════════════════════════════════════════════════════════════
# CHAT FILE UPLOAD
# ═══════════════════════════════════════════════════════════════════════════════

CHAT_UPLOAD_DIR = Path(__file__).parent.parent / "uploads" / "chat"
CHAT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
ALLOWED_DOC_TYPES = {"application/pdf", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
ALLOWED_AUDIO_TYPES = {"audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/m4a", "audio/wav"}


@router.post("/chat/upload")
async def upload_chat_file(file: UploadFile = FileParam(...), user=Depends(get_current_user)):
    import s3_service

    mime = file.content_type or ""
    if mime in ALLOWED_IMAGE_TYPES:
        max_size, file_type = 10 * 1024 * 1024, "image"
    elif mime in ALLOWED_DOC_TYPES:
        max_size, file_type = 25 * 1024 * 1024, "document"
    elif mime in ALLOWED_AUDIO_TYPES:
        max_size, file_type = 10 * 1024 * 1024, "audio"
    else:
        raise HTTPException(400, "Unsupported file type")

    file_id = str(uuid.uuid4())
    ext = Path(file.filename or "file").suffix or ".bin"
    filename = f"{file_id}{ext}"
    filepath = CHAT_UPLOAD_DIR / filename

    size = 0
    with open(filepath, "wb") as f:
        while chunk := await file.read(512 * 1024):
            size += len(chunk)
            if size > max_size:
                filepath.unlink(missing_ok=True)
                raise HTTPException(413, f"File too large. Max {max_size // (1024 * 1024)}MB")
            f.write(chunk)

    # Upload to S3 (priority) — falls back to local URL automatically
    url = f"/api/uploads/chat/{filename}"
    try:
        data = filepath.read_bytes()
        uploaded_url = await s3_service.upload_bytes(data, "chat", filename, mime)
        if uploaded_url:
            url = uploaded_url
    except Exception:
        pass

    return {"url": url, "filename": file.filename, "file_type": file_type, "file_size": size, "mime_type": mime}


# ═══════════════════════════════════════════════════════════════════════════════
# CHAT WEBSOCKET
# ═══════════════════════════════════════════════════════════════════════════════

@router.websocket("/chat/ws")
async def chat_websocket(ws: WebSocket):
    """WebSocket for real-time chat — auth via ?token= query param."""
    token = ws.query_params.get("token", "")
    if not token:
        await ws.close(code=4001, reason="No token")
        return
    try:
        from jose import jwt as jose_jwt
        payload = jose_jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "id": 1, "name": 1})
        if not user:
            await ws.close(code=4001, reason="User not found")
            return
    except Exception:
        await ws.close(code=4001, reason="Invalid token")
        return

    user_id = user["id"]
    await chat_manager.connect(user_id, ws)

    # Notify conversation partners that user is online
    convos = await db.conversations.find({"participants": user_id}, {"participants": 1}).to_list(100)
    for c in convos:
        for pid in c.get("participants", []):
            if pid != user_id:
                await chat_manager.send_to_user(pid, {"type": "online_status", "user_id": user_id, "online": True})

    try:
        while True:
            data = await ws.receive_text()
            try:
                msg = json.loads(data)
            except Exception:
                continue
            if msg.get("type") == "typing":
                convo_id = msg.get("conversation_id")
                convo = await db.conversations.find_one({"id": convo_id})
                if convo and user_id in convo.get("participants", []):
                    for pid in convo["participants"]:
                        if pid != user_id:
                            await chat_manager.send_to_user(pid, {
                                "type": "typing", "conversation_id": convo_id, "user_id": user_id
                            })
            elif msg.get("type") == "ping":
                await ws.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        pass
    finally:
        chat_manager.disconnect(user_id, ws)
        for c in convos:
            for pid in c.get("participants", []):
                if pid != user_id:
                    await chat_manager.send_to_user(pid, {"type": "online_status", "user_id": user_id, "online": False})
