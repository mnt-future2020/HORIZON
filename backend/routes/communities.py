"""
Communities, Groups & Teams — Sports social platform.
Supports: community creation, membership, group chat, team management.
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from typing import Optional
from datetime import datetime, timezone
from database import db
from auth import get_current_user
from models import GroupCreate, TeamCreate, MessageCreate
import uuid
import math
import logging

router = APIRouter()
logger = logging.getLogger("horizon")


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
        "created_at": datetime.now(timezone.utc).isoformat(),
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

    msg = {
        "id": str(uuid.uuid4()),
        "group_id": group_id,
        "sender_id": user["id"],
        "sender_name": user.get("name", "Unknown"),
        "sender_avatar": user.get("avatar", ""),
        "content": inp.content,
        "media_url": inp.media_url or "",
        "reply_to": inp.reply_to or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.group_messages.insert_one(msg)
    msg.pop("_id", None)

    # Update group last_message for previews
    await db.groups.update_one({"id": group_id}, {"$set": {
        "last_message": msg["content"][:100],
        "last_message_at": msg["created_at"],
        "last_message_by": user.get("name", "")
    }})

    return msg


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
        "players": [{"id": user["id"], "name": user.get("name", ""), "role": "captain", "joined_at": datetime.now(timezone.utc).isoformat()}],
        "player_count": 1,
        "wins": 0,
        "losses": 0,
        "draws": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
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
        "joined_at": datetime.now(timezone.utc).isoformat()
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
    """List all DM conversations for current user, sorted by last message."""
    convos = await db.conversations.find(
        {"participants": user["id"]}, {"_id": 0}
    ).sort("last_message_at", -1).to_list(50)

    for c in convos:
        # Find the other participant
        other_id = next((p for p in c.get("participants", []) if p != user["id"]), None)
        if other_id:
            other = await db.users.find_one(
                {"id": other_id}, {"_id": 0, "id": 1, "name": 1, "avatar": 1}
            )
            c["other_user"] = other or {"id": other_id, "name": "Unknown", "avatar": ""}
        # Unread count
        c["unread_count"] = await db.direct_messages.count_documents({
            "conversation_id": c["id"],
            "sender_id": {"$ne": user["id"]},
            "read": False
        })
    return convos


@router.post("/chat/conversations")
async def start_conversation(request: Request, user=Depends(get_current_user)):
    """Start or get existing conversation with another user."""
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
        existing["other_user"] = {"id": other_id, "name": other.get("name", ""), "avatar": other.get("avatar", "")}
        return existing

    convo = {
        "id": str(uuid.uuid4()),
        "participants": [user["id"], other_id],
        "last_message": "",
        "last_message_at": datetime.now(timezone.utc).isoformat(),
        "last_message_by": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
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

    messages = await db.direct_messages.find(query, {"_id": 0}).sort(
        "created_at", -1
    ).limit(limit).to_list(limit)
    messages.reverse()

    # Mark as read
    await db.direct_messages.update_many(
        {"conversation_id": conversation_id, "sender_id": {"$ne": user["id"]}, "read": False},
        {"$set": {"read": True}}
    )
    return messages


@router.post("/chat/{conversation_id}/messages")
async def send_dm(conversation_id: str, inp: MessageCreate, user=Depends(get_current_user)):
    convo = await db.conversations.find_one({"id": conversation_id})
    if not convo or user["id"] not in convo.get("participants", []):
        raise HTTPException(403, "Not your conversation")

    msg = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "sender_id": user["id"],
        "sender_name": user.get("name", "Unknown"),
        "sender_avatar": user.get("avatar", ""),
        "content": inp.content,
        "media_url": inp.media_url or "",
        "reply_to": inp.reply_to or "",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.direct_messages.insert_one(msg)
    msg.pop("_id", None)

    await db.conversations.update_one({"id": conversation_id}, {"$set": {
        "last_message": inp.content[:100],
        "last_message_at": msg["created_at"],
        "last_message_by": user.get("name", "")
    }})

    return msg


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
        {"$set": {"content": "", "deleted": True, "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"deleted": True}


@router.post("/chat/online")
async def update_online_status(user=Depends(get_current_user)):
    """Heartbeat to track online status."""
    await db.online_status.update_one(
        {"user_id": user["id"]},
        {"$set": {"user_id": user["id"], "last_seen": datetime.now(timezone.utc).isoformat(), "online": True}},
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
            diff = (datetime.now(timezone.utc) - last_dt).total_seconds()
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
            "typing_at": datetime.now(timezone.utc).isoformat(),
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
        diff = (datetime.now(timezone.utc) - typing_at).total_seconds()
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
