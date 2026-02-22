"""
Social Service – Port 8004
Handles: Social Feed, Player Cards, Clubs & Squads, Tournament Engine,
         DM Chat (encrypted), Groups, Teams, Live Scoring
NEW PRD v2.0 features that don't exist in the monolith.
"""
import sys, os
sys.path.insert(0, "/app/shared")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "shared"))

import uuid
import logging
import math
import json
import re as _re
from datetime import datetime, timezone
from typing import Optional, List, Dict
from pathlib import Path

from fastapi import (
    FastAPI, HTTPException, Depends, Query, Request,
    WebSocket, WebSocketDisconnect, UploadFile, File as FileParam,
)
from fastapi.middleware.cors import CORSMiddleware
from database import db, get_redis
from auth import get_current_user
from models import (
    SocialPostCreate, ClubCreate, TournamentCreate,
    MessageCreate, GroupCreate, TeamCreate,
    LiveScoreStart, LiveScoreUpdate, LiveScoreEvent, LivePeriodChange,
)
from encryption import encrypt_message, decrypt_message

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("lobbi")

JWT_SECRET = os.environ.get("JWT_SECRET", "lobbi-secret-key-change-in-production")

app = FastAPI(title="Lobbi Social Service", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


# ═══════════════════════════════════════════════════════════════════════════════
# CHAT WEBSOCKET CONNECTION MANAGER
# ═══════════════════════════════════════════════════════════════════════════════

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
# LIVE SCORING WEBSOCKET CONNECTION MANAGER
# ═══════════════════════════════════════════════════════════════════════════════

class MatchConnectionManager:
    def __init__(self):
        self._clients: Dict[str, List[WebSocket]] = {}

    async def connect(self, match_id: str, ws: WebSocket):
        await ws.accept()
        self._clients.setdefault(match_id, []).append(ws)
        logger.info(f"Live WS connected match={match_id} total={len(self._clients[match_id])}")

    def disconnect(self, match_id: str, ws: WebSocket):
        lst = self._clients.get(match_id, [])
        if ws in lst:
            lst.remove(ws)
        if not lst:
            self._clients.pop(match_id, None)

    async def broadcast(self, match_id: str, message: dict):
        clients = list(self._clients.get(match_id, []))
        dead = []
        for ws in clients:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(match_id, ws)

    def get_count(self, match_id: str) -> int:
        return len(self._clients.get(match_id, []))


match_manager = MatchConnectionManager()


# ═══════════════════════════════════════════════════════════════════════════════
# SOCIAL FEED
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/feed")
async def get_feed(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user=Depends(get_current_user)
):
    """Get social feed -- posts from followed users, clubs, and trending."""
    skip = (page - 1) * limit

    # Get user's club memberships for relevant content
    user_clubs = await db.club_members.find(
        {"user_id": user["id"], "status": "active"}, {"club_id": 1}
    ).to_list(100)
    club_ids = [c["club_id"] for c in user_clubs]

    # Feed: public posts + posts from user's clubs
    query = {"$or": [
        {"visibility": "public"},
        {"club_id": {"$in": club_ids}},
        {"user_id": user["id"]}
    ]}

    posts = await db.social_posts.find(query, {"_id": 0}).sort(
        "created_at", -1
    ).skip(skip).limit(limit).to_list(limit)

    # Enrich with like status
    for post in posts:
        post["liked_by_me"] = await db.social_likes.find_one(
            {"post_id": post["id"], "user_id": user["id"]}
        ) is not None

    total = await db.social_posts.count_documents(query)
    return {"posts": posts, "total": total, "page": page, "pages": math.ceil(total / limit)}


@app.post("/feed")
async def create_post(inp: SocialPostCreate, user=Depends(get_current_user)):
    """Create a new social post."""
    post = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user.get("name", "Unknown"),
        "user_avatar": user.get("avatar", ""),
        "content": inp.content,
        "media_url": inp.media_url or "",
        "venue_id": inp.venue_id or "",
        "match_id": inp.match_id or "",
        "post_type": inp.post_type,
        "club_id": "",
        "visibility": "public",
        "likes_count": 0,
        "comments_count": 0,
        "shares_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.social_posts.insert_one(post)
    post.pop("_id", None)
    return post


@app.post("/feed/{post_id}/like")
async def toggle_like(post_id: str, user=Depends(get_current_user)):
    """Toggle like on a post."""
    existing = await db.social_likes.find_one(
        {"post_id": post_id, "user_id": user["id"]}
    )
    if existing:
        await db.social_likes.delete_one({"_id": existing["_id"]})
        await db.social_posts.update_one({"id": post_id}, {"$inc": {"likes_count": -1}})
        return {"liked": False}
    else:
        await db.social_likes.insert_one({
            "post_id": post_id, "user_id": user["id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        await db.social_posts.update_one({"id": post_id}, {"$inc": {"likes_count": 1}})
        return {"liked": True}


@app.post("/feed/{post_id}/comment")
async def add_comment(post_id: str, request: Request, user=Depends(get_current_user)):
    """Add a comment to a post."""
    data = await request.json()
    comment = {
        "id": str(uuid.uuid4()),
        "post_id": post_id,
        "user_id": user["id"],
        "user_name": user.get("name", "Unknown"),
        "content": data.get("content", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.social_comments.insert_one(comment)
    await db.social_posts.update_one({"id": post_id}, {"$inc": {"comments_count": 1}})
    comment.pop("_id", None)
    return comment


@app.get("/feed/{post_id}/comments")
async def get_comments(post_id: str, user=Depends(get_current_user)):
    """Get comments for a post."""
    comments = await db.social_comments.find(
        {"post_id": post_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    return comments


@app.delete("/feed/{post_id}")
async def delete_post(post_id: str, user=Depends(get_current_user)):
    """Delete own post."""
    post = await db.social_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(404, "Post not found")
    if post["user_id"] != user["id"]:
        raise HTTPException(403, "Not your post")
    await db.social_posts.delete_one({"id": post_id})
    await db.social_comments.delete_many({"post_id": post_id})
    await db.social_likes.delete_many({"post_id": post_id})
    return {"message": "Post deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# PLAYER CARDS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/player-card/{user_id}")
async def get_player_card(user_id: str):
    """Get a player's public card with stats."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(404, "Player not found")

    # Gather stats
    bookings = await db.bookings.count_documents(
        {"$or": [{"host_id": user_id}, {"players": user_id}], "status": {"$in": ["confirmed", "completed"]}}
    )
    reviews = await db.reviews.find({"user_id": user_id}, {"_id": 0, "rating": 1}).to_list(100)
    avg_rating = sum(r.get("rating", 0) for r in reviews) / max(len(reviews), 1) if reviews else 0

    # Sport frequency
    sport_bookings = await db.bookings.find(
        {"$or": [{"host_id": user_id}, {"players": user_id}]},
        {"sport": 1, "_id": 0}
    ).to_list(500)
    sport_freq = {}
    for b in sport_bookings:
        s = b.get("sport", "other")
        sport_freq[s] = sport_freq.get(s, 0) + 1
    primary_sport = max(sport_freq, key=sport_freq.get) if sport_freq else "none"

    card = {
        "user_id": user_id,
        "name": user.get("name", "Unknown"),
        "avatar": user.get("avatar", ""),
        "role": user.get("role", "player"),
        "skill_rating": user.get("skill_rating", 1500),
        "reliability_score": user.get("reliability_score", 100),
        "wins": user.get("wins", 0),
        "losses": user.get("losses", 0),
        "draws": user.get("draws", 0),
        "total_games": bookings,
        "avg_review_rating": round(avg_rating, 1),
        "primary_sport": primary_sport,
        "sports_played": sport_freq,
        "member_since": user.get("created_at", ""),
        "badges": _compute_badges(user, bookings),
    }
    return card


def _compute_badges(user: dict, total_games: int) -> list:
    """Compute achievement badges for player card."""
    badges = []
    if total_games >= 100:
        badges.append({"name": "Century", "icon": "trophy", "description": "100+ games played"})
    elif total_games >= 50:
        badges.append({"name": "Veteran", "icon": "star", "description": "50+ games played"})
    elif total_games >= 10:
        badges.append({"name": "Regular", "icon": "zap", "description": "10+ games played"})

    rating = user.get("skill_rating", 1500)
    if rating >= 2000:
        badges.append({"name": "Elite", "icon": "crown", "description": "2000+ skill rating"})
    elif rating >= 1700:
        badges.append({"name": "Pro", "icon": "award", "description": "1700+ skill rating"})

    reliability = user.get("reliability_score", 100)
    if reliability >= 95:
        badges.append({"name": "Reliable", "icon": "shield", "description": "95%+ reliability"})

    wins = user.get("wins", 0)
    if wins >= 50:
        badges.append({"name": "Champion", "icon": "medal", "description": "50+ wins"})

    return badges


@app.get("/player-card/me")
async def get_my_card(user=Depends(get_current_user)):
    """Get current user's player card."""
    return await get_player_card(user["id"])


# ═══════════════════════════════════════════════════════════════════════════════
# CLUBS & SQUADS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/clubs")
async def list_clubs(
    sport: Optional[str] = None,
    search: Optional[str] = None,
    user=Depends(get_current_user)
):
    """List public clubs."""
    query = {"is_public": True}
    if sport:
        query["sport"] = sport
    if search:
        query["name"] = {"$regex": search, "$options": "i"}

    clubs = await db.clubs.find(query, {"_id": 0}).sort("members_count", -1).to_list(50)
    return clubs


@app.post("/clubs")
async def create_club(inp: ClubCreate, user=Depends(get_current_user)):
    """Create a new club."""
    club = {
        "id": str(uuid.uuid4()),
        "name": inp.name,
        "sport": inp.sport,
        "description": inp.description,
        "max_members": inp.max_members,
        "is_public": inp.is_public,
        "owner_id": user["id"],
        "owner_name": user.get("name", ""),
        "members_count": 1,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.clubs.insert_one(club)
    club.pop("_id", None)

    # Auto-add creator as member
    await db.club_members.insert_one({
        "club_id": club["id"], "user_id": user["id"],
        "user_name": user.get("name", ""), "role": "owner",
        "status": "active", "joined_at": datetime.now(timezone.utc).isoformat()
    })
    return club


@app.get("/clubs/{club_id}")
async def get_club(club_id: str, user=Depends(get_current_user)):
    """Get club details with members."""
    club = await db.clubs.find_one({"id": club_id}, {"_id": 0})
    if not club:
        raise HTTPException(404, "Club not found")
    members = await db.club_members.find(
        {"club_id": club_id, "status": "active"}, {"_id": 0}
    ).to_list(100)
    club["members"] = members
    club["is_member"] = any(m["user_id"] == user["id"] for m in members)
    return club


@app.post("/clubs/{club_id}/join")
async def join_club(club_id: str, user=Depends(get_current_user)):
    """Join a club."""
    club = await db.clubs.find_one({"id": club_id})
    if not club:
        raise HTTPException(404, "Club not found")

    existing = await db.club_members.find_one(
        {"club_id": club_id, "user_id": user["id"], "status": "active"}
    )
    if existing:
        raise HTTPException(400, "Already a member")

    if club.get("members_count", 0) >= club.get("max_members", 50):
        raise HTTPException(400, "Club is full")

    await db.club_members.insert_one({
        "club_id": club_id, "user_id": user["id"],
        "user_name": user.get("name", ""), "role": "member",
        "status": "active", "joined_at": datetime.now(timezone.utc).isoformat()
    })
    await db.clubs.update_one({"id": club_id}, {"$inc": {"members_count": 1}})
    return {"message": "Joined club successfully"}


@app.post("/clubs/{club_id}/leave")
async def leave_club(club_id: str, user=Depends(get_current_user)):
    """Leave a club."""
    member = await db.club_members.find_one(
        {"club_id": club_id, "user_id": user["id"], "status": "active"}
    )
    if not member:
        raise HTTPException(400, "Not a member")
    if member.get("role") == "owner":
        raise HTTPException(400, "Owner cannot leave. Transfer ownership first.")

    await db.club_members.update_one(
        {"club_id": club_id, "user_id": user["id"]},
        {"$set": {"status": "left"}}
    )
    await db.clubs.update_one({"id": club_id}, {"$inc": {"members_count": -1}})
    return {"message": "Left club"}


@app.delete("/clubs/{club_id}")
async def delete_club(club_id: str, user=Depends(get_current_user)):
    """Delete a club (owner only)."""
    club = await db.clubs.find_one({"id": club_id})
    if not club:
        raise HTTPException(404, "Club not found")
    if club["owner_id"] != user["id"]:
        raise HTTPException(403, "Only the owner can delete this club")
    await db.clubs.delete_one({"id": club_id})
    await db.club_members.delete_many({"club_id": club_id})
    return {"message": "Club deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# GROUPS / COMMUNITIES
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/groups")
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


@app.get("/groups")
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


@app.get("/groups/my")
async def my_groups(user=Depends(get_current_user)):
    groups = await db.groups.find(
        {"members": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    for g in groups:
        g["is_member"] = True
        g["is_admin"] = user["id"] in g.get("admins", [])
    return groups


@app.get("/groups/{group_id}")
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


@app.post("/groups/{group_id}/join")
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


@app.post("/groups/{group_id}/leave")
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


@app.delete("/groups/{group_id}")
async def delete_group(group_id: str, user=Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(404, "Group not found")
    if user["id"] != group.get("created_by"):
        raise HTTPException(403, "Only the group creator can delete it")
    await db.groups.delete_one({"id": group_id})
    await db.group_messages.delete_many({"group_id": group_id})
    return {"message": "Group deleted"}


@app.put("/groups/{group_id}")
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

@app.get("/groups/{group_id}/messages")
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


@app.post("/groups/{group_id}/messages")
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

@app.post("/teams")
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


@app.get("/teams")
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


@app.get("/teams/my")
async def my_teams(user=Depends(get_current_user)):
    teams = await db.teams.find(
        {"players.id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    for t in teams:
        t["is_member"] = True
        t["is_captain"] = t.get("captain_id") == user["id"]
    return teams


@app.get("/teams/{team_id}")
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


@app.post("/teams/{team_id}/join")
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


@app.post("/teams/{team_id}/leave")
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


@app.delete("/teams/{team_id}")
async def delete_team(team_id: str, user=Depends(get_current_user)):
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(404, "Team not found")
    if user["id"] != team.get("captain_id"):
        raise HTTPException(403, "Only the captain can disband the team")
    await db.teams.delete_one({"id": team_id})
    return {"message": "Team disbanded"}


# ═══════════════════════════════════════════════════════════════════════════════
# TOURNAMENT ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/tournaments")
async def list_tournaments(
    sport: Optional[str] = None,
    status: Optional[str] = None,
    user=Depends(get_current_user)
):
    """List tournaments."""
    query = {}
    if sport:
        query["sport"] = sport
    if status:
        query["status"] = status
    tournaments = await db.tournaments.find(query, {"_id": 0}).sort(
        "created_at", -1
    ).to_list(50)
    return tournaments


@app.post("/tournaments")
async def create_tournament(inp: TournamentCreate, user=Depends(get_current_user)):
    """Create a new tournament."""
    tournament = {
        "id": str(uuid.uuid4()),
        "name": inp.name,
        "sport": inp.sport,
        "venue_id": inp.venue_id or "",
        "format": inp.format,
        "max_teams": inp.max_teams,
        "team_size": inp.team_size,
        "entry_fee": inp.entry_fee,
        "start_date": inp.start_date,
        "description": inp.description,
        "organizer_id": user["id"],
        "organizer_name": user.get("name", ""),
        "status": "registration",  # registration, in_progress, completed, cancelled
        "teams": [],
        "teams_count": 0,
        "bracket": [],
        "prize_pool": inp.entry_fee * inp.max_teams,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.tournaments.insert_one(tournament)
    tournament.pop("_id", None)
    return tournament


@app.get("/tournaments/{tournament_id}")
async def get_tournament(tournament_id: str, user=Depends(get_current_user)):
    """Get tournament details."""
    t = await db.tournaments.find_one({"id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Tournament not found")
    return t


@app.post("/tournaments/{tournament_id}/register")
async def register_team_tournament(tournament_id: str, request: Request, user=Depends(get_current_user)):
    """Register a team for a tournament."""
    t = await db.tournaments.find_one({"id": tournament_id})
    if not t:
        raise HTTPException(404, "Tournament not found")
    if t["status"] != "registration":
        raise HTTPException(400, "Registration is closed")
    if t["teams_count"] >= t["max_teams"]:
        raise HTTPException(400, "Tournament is full")

    data = await request.json()
    team = {
        "id": str(uuid.uuid4()),
        "name": data.get("team_name", f"Team {t['teams_count'] + 1}"),
        "captain_id": user["id"],
        "captain_name": user.get("name", ""),
        "players": data.get("players", [user["id"]]),
        "registered_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.tournaments.update_one(
        {"id": tournament_id},
        {"$push": {"teams": team}, "$inc": {"teams_count": 1}}
    )
    return {"message": "Team registered", "team": team}


@app.post("/tournaments/{tournament_id}/start")
async def start_tournament(tournament_id: str, user=Depends(get_current_user)):
    """Start a tournament and generate bracket (organizer only)."""
    t = await db.tournaments.find_one({"id": tournament_id})
    if not t:
        raise HTTPException(404, "Tournament not found")
    if t["organizer_id"] != user["id"]:
        raise HTTPException(403, "Only organizer can start tournament")
    if t["status"] != "registration":
        raise HTTPException(400, "Tournament already started")
    if t["teams_count"] < 2:
        raise HTTPException(400, "Need at least 2 teams")

    bracket = _generate_bracket(t["teams"], t["format"])
    await db.tournaments.update_one(
        {"id": tournament_id},
        {"$set": {"status": "in_progress", "bracket": bracket}}
    )
    return {"message": "Tournament started", "bracket": bracket}


@app.post("/tournaments/{tournament_id}/result")
async def submit_match_result(tournament_id: str, request: Request, user=Depends(get_current_user)):
    """Submit a match result in the tournament bracket."""
    t = await db.tournaments.find_one({"id": tournament_id})
    if not t:
        raise HTTPException(404, "Tournament not found")
    if t["organizer_id"] != user["id"]:
        raise HTTPException(403, "Only organizer can submit results")

    data = await request.json()
    match_id = data.get("match_id")
    winner_team_id = data.get("winner_team_id")
    score = data.get("score", "")

    bracket = t.get("bracket", [])
    updated = False
    for match in bracket:
        if match["id"] == match_id:
            match["winner_team_id"] = winner_team_id
            match["score"] = score
            match["status"] = "completed"
            updated = True

            # Advance winner to next round if applicable
            next_match_id = match.get("next_match_id")
            if next_match_id:
                for nm in bracket:
                    if nm["id"] == next_match_id:
                        if not nm.get("team_a_id"):
                            nm["team_a_id"] = winner_team_id
                        else:
                            nm["team_b_id"] = winner_team_id
                        break
            break

    if not updated:
        raise HTTPException(404, "Match not found in bracket")

    # Check if tournament is complete
    final_matches = [m for m in bracket if not m.get("next_match_id")]
    all_complete = all(m.get("status") == "completed" for m in final_matches)
    status = "completed" if all_complete else "in_progress"

    await db.tournaments.update_one(
        {"id": tournament_id},
        {"$set": {"bracket": bracket, "status": status}}
    )
    return {"message": "Result recorded", "tournament_status": status}


def _generate_bracket(teams: list, fmt: str) -> list:
    """Generate tournament bracket based on format."""
    bracket = []
    if fmt == "round_robin":
        match_num = 0
        for i in range(len(teams)):
            for j in range(i + 1, len(teams)):
                match_num += 1
                bracket.append({
                    "id": str(uuid.uuid4()),
                    "round": 1,
                    "match_number": match_num,
                    "team_a_id": teams[i]["id"],
                    "team_a_name": teams[i]["name"],
                    "team_b_id": teams[j]["id"],
                    "team_b_name": teams[j]["name"],
                    "winner_team_id": None,
                    "score": "",
                    "status": "pending",
                    "next_match_id": None,
                })
    else:
        # Single elimination (default)
        num_teams = len(teams)
        # Pad to next power of 2
        rounds_needed = math.ceil(math.log2(max(num_teams, 2)))
        total_slots = 2 ** rounds_needed

        # Create all matches
        match_map = {}
        match_counter = [0]

        def create_round_matches(round_num, num_matches):
            matches = []
            for i in range(num_matches):
                match_counter[0] += 1
                m = {
                    "id": str(uuid.uuid4()),
                    "round": round_num,
                    "match_number": match_counter[0],
                    "team_a_id": None,
                    "team_a_name": "",
                    "team_b_id": None,
                    "team_b_name": "",
                    "winner_team_id": None,
                    "score": "",
                    "status": "pending",
                    "next_match_id": None,
                }
                matches.append(m)
                bracket.append(m)
            return matches

        # Build rounds from final backward
        all_rounds = []
        for r in range(rounds_needed, 0, -1):
            num_matches = 2 ** (r - 1)
            round_matches = create_round_matches(rounds_needed - r + 1, num_matches)
            all_rounds.append(round_matches)

        # Link matches to next round
        for r_idx in range(len(all_rounds) - 1):
            current_round = all_rounds[r_idx]
            next_round = all_rounds[r_idx + 1]
            for i, m in enumerate(current_round):
                m["next_match_id"] = next_round[i // 2]["id"]

        # Assign teams to first round
        first_round = all_rounds[0]
        for i, team in enumerate(teams):
            match_idx = i // 2
            if match_idx < len(first_round):
                if i % 2 == 0:
                    first_round[match_idx]["team_a_id"] = team["id"]
                    first_round[match_idx]["team_a_name"] = team["name"]
                else:
                    first_round[match_idx]["team_b_id"] = team["id"]
                    first_round[match_idx]["team_b_name"] = team["name"]

        # Auto-advance byes
        for m in first_round:
            if m["team_a_id"] and not m["team_b_id"]:
                m["winner_team_id"] = m["team_a_id"]
                m["status"] = "bye"
            elif m["team_b_id"] and not m["team_a_id"]:
                m["winner_team_id"] = m["team_b_id"]
                m["status"] = "bye"

    return bracket


# ═══════════════════════════════════════════════════════════════════════════════
# DIRECT MESSAGES (WhatsApp-like 1-on-1 chat with AES-256-GCM encryption)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/chat/conversations")
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
        # Decrypt last_message preview
        if c.get("last_message"):
            c["last_message"] = decrypt_message(c["last_message"], c["id"])
        # Unread count
        c["unread_count"] = await db.direct_messages.count_documents({
            "conversation_id": c["id"],
            "sender_id": {"$ne": user["id"]},
            "read": False
        })
    return convos


@app.post("/chat/conversations")
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


@app.get("/chat/unread-total")
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


@app.get("/chat/{conversation_id}/messages")
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


@app.post("/chat/{conversation_id}/messages")
async def send_dm(conversation_id: str, inp: MessageCreate, user=Depends(get_current_user)):
    convo = await db.conversations.find_one({"id": conversation_id})
    if not convo or user["id"] not in convo.get("participants", []):
        raise HTTPException(403, "Not your conversation")

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
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.direct_messages.insert_one(msg)
    msg.pop("_id", None)

    preview = plaintext_content[:100] if plaintext_content else (
        "Voice message" if inp.media_type == "voice" else
        f"{inp.file_name or 'File'}" if inp.media_type else ""
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


# ═══════════════════════════════════════════════════════════════════════════════
# MESSAGE DELETE + ONLINE STATUS + TYPING
# ═══════════════════════════════════════════════════════════════════════════════

@app.delete("/chat/{conversation_id}/messages/{message_id}")
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


@app.post("/chat/online")
async def update_online_status(user=Depends(get_current_user)):
    """Heartbeat to track online status."""
    await db.online_status.update_one(
        {"user_id": user["id"]},
        {"$set": {"user_id": user["id"], "last_seen": datetime.now(timezone.utc).isoformat(), "online": True}},
        upsert=True,
    )
    return {"ok": True}


@app.get("/chat/online/{user_id}")
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


@app.post("/chat/{conversation_id}/typing")
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


@app.get("/chat/{conversation_id}/typing")
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

@app.get("/users/search")
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


@app.post("/chat/{conversation_id}/messages/{message_id}/react")
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
        raise HTTPException(400, "Invalid reaction")

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
# MESSAGE SEARCH (server-side decrypt + search)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/chat/{conversation_id}/search")
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


@app.post("/chat/upload")
async def upload_chat_file(file: UploadFile = FileParam(...), user=Depends(get_current_user)):
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

    url = f"/api/uploads/chat/{filename}"
    try:
        import s3_service
        data = filepath.read_bytes()
        s3_url = await s3_service.upload_bytes(data, "chat", filename, mime)
        if s3_url:
            url = s3_url
    except Exception:
        pass

    return {"url": url, "filename": file.filename, "file_type": file_type, "file_size": size, "mime_type": mime}


# ═══════════════════════════════════════════════════════════════════════════════
# CHAT WEBSOCKET
# ═══════════════════════════════════════════════════════════════════════════════

@app.websocket("/chat/ws")
async def chat_websocket(ws: WebSocket):
    """WebSocket for real-time chat -- auth via ?token= query param."""
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


# ═══════════════════════════════════════════════════════════════════════════════
# LIVE SCORING
# ═══════════════════════════════════════════════════════════════════════════════

async def _require_scorer(live_match: dict, user: dict):
    if user.get("role") == "super_admin":
        return
    if live_match["scorer_id"] != user["id"]:
        raise HTTPException(403, "Only the scorer can update this match")


async def _broadcast_and_save(live_match_id: str, live_match: dict, msg_type: str, extra: dict = None):
    """Save to DB and broadcast to spectators."""
    now = datetime.now(timezone.utc).isoformat()
    live_match["updated_at"] = now
    live_match["spectator_count"] = match_manager.get_count(live_match_id)
    await db.live_matches.update_one({"id": live_match_id}, {"$set": live_match})
    message = {
        "type": msg_type,
        "home": live_match["home"],
        "away": live_match["away"],
        "status": live_match["status"],
        "period": live_match["period"],
        "period_label": live_match["period_label"],
        "spectator_count": live_match["spectator_count"],
        "updated_at": now,
    }
    if extra:
        message.update(extra)
    await match_manager.broadcast(live_match_id, message)


@app.post("/live/start")
async def start_live_scoring(body: LiveScoreStart, user=Depends(get_current_user)):
    """Start live scoring for a tournament match. Organizer only."""
    tournament = await db.tournaments.find_one({"id": body.tournament_id})
    if not tournament:
        raise HTTPException(404, "Tournament not found")

    # Check organizer
    if user.get("role") != "super_admin" and tournament["organizer_id"] != user["id"]:
        raise HTTPException(403, "Only the tournament organizer can start live scoring")

    if tournament["status"] != "in_progress":
        raise HTTPException(400, "Tournament must be in progress")

    # Find the match
    matches = tournament.get("matches", [])
    match = next((m for m in matches if m["id"] == body.match_id), None)
    if not match:
        raise HTTPException(404, "Match not found in tournament")

    if match["status"] == "completed":
        raise HTTPException(400, "Match is already completed")

    # Check not already live
    existing = await db.live_matches.find_one({
        "match_id": body.match_id,
        "status": {"$in": ["live", "paused", "warmup", "halftime"]}
    })
    if existing:
        raise HTTPException(400, "This match already has active live scoring")

    # Look up player names
    home_id = match.get("player_a")
    away_id = match.get("player_b")
    home_name = ""
    away_name = ""
    if home_id:
        p = await db.users.find_one({"id": home_id}, {"_id": 0, "name": 1})
        home_name = p.get("name", "") if p else ""
    if away_id:
        p = await db.users.find_one({"id": away_id}, {"_id": 0, "name": 1})
        away_name = p.get("name", "") if p else ""

    # Build match label
    total_rounds = max((m["round"] for m in matches), default=1)
    round_num = match.get("round", 1)
    from_end = total_rounds - round_num
    if from_end == 0:
        round_label = "Final"
    elif from_end == 1:
        round_label = "Semi-Final"
    elif from_end == 2:
        round_label = "Quarter-Final"
    else:
        round_label = f"Round {round_num}"
    match_label = f"{round_label} -- Match #{match.get('match_number', 1)}"

    now = datetime.now(timezone.utc).isoformat()
    live_match = {
        "id": str(uuid.uuid4()),
        "tournament_id": body.tournament_id,
        "tournament_name": tournament["name"],
        "match_id": body.match_id,
        "sport": tournament.get("sport", ""),
        "match_label": match_label,
        "status": "live",
        "home": {"id": home_id or "", "name": home_name, "score": 0},
        "away": {"id": away_id or "", "name": away_name, "score": 0},
        "sets": [],
        "period": 1,
        "period_label": "1st Half",
        "events": [],
        "scorer_id": user["id"],
        "scorer_name": user.get("name", ""),
        "spectator_count": 0,
        "started_at": now,
        "updated_at": now,
    }

    await db.live_matches.insert_one(live_match)
    live_match.pop("_id", None)
    return live_match


@app.get("/live/active")
async def get_active_matches(user=Depends(get_current_user)):
    """List all currently live matches."""
    cursor = db.live_matches.find(
        {"status": {"$in": ["live", "paused", "warmup", "halftime"]}},
        {"_id": 0}
    ).sort("started_at", -1)
    matches = await cursor.to_list(50)
    # Update spectator counts
    for m in matches:
        m["spectator_count"] = match_manager.get_count(m["id"])
    return matches


@app.get("/live/{live_match_id}")
async def get_live_match(live_match_id: str, user=Depends(get_current_user)):
    """Get current state of a live match (REST fallback)."""
    live_match = await db.live_matches.find_one({"id": live_match_id}, {"_id": 0})
    if not live_match:
        raise HTTPException(404, "Live match not found")
    live_match["spectator_count"] = match_manager.get_count(live_match_id)
    return live_match


@app.post("/live/{live_match_id}/score")
async def update_score(live_match_id: str, body: LiveScoreUpdate, user=Depends(get_current_user)):
    """Update score for a team. Scorer only."""
    live_match = await db.live_matches.find_one({"id": live_match_id}, {"_id": 0})
    if not live_match:
        raise HTTPException(404, "Live match not found")
    await _require_scorer(live_match, user)

    if live_match["status"] not in ("live", "warmup"):
        raise HTTPException(400, "Match is not currently live")

    if body.team not in ("home", "away"):
        raise HTTPException(400, "Team must be 'home' or 'away'")

    live_match[body.team]["score"] = max(0, live_match[body.team]["score"] + body.delta)
    await _broadcast_and_save(live_match_id, live_match, "score_update")

    return {"home": live_match["home"], "away": live_match["away"]}


@app.post("/live/{live_match_id}/event")
async def add_event(live_match_id: str, body: LiveScoreEvent, user=Depends(get_current_user)):
    """Add a timeline event (goal, card, point, etc.). Scorer only."""
    live_match = await db.live_matches.find_one({"id": live_match_id}, {"_id": 0})
    if not live_match:
        raise HTTPException(404, "Live match not found")
    await _require_scorer(live_match, user)

    if live_match["status"] not in ("live", "warmup"):
        raise HTTPException(400, "Match is not currently live")

    event = {
        "id": str(uuid.uuid4()),
        "type": body.type,
        "team": body.team,
        "player_name": body.player_name,
        "minute": body.minute,
        "description": body.description or body.type.replace("_", " ").title(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    live_match["events"].append(event)
    await _broadcast_and_save(live_match_id, live_match, "event", {"event": event})

    return event


@app.post("/live/{live_match_id}/period")
async def change_period(live_match_id: str, body: LivePeriodChange, user=Depends(get_current_user)):
    """Change the current period/half/set. Scorer only."""
    live_match = await db.live_matches.find_one({"id": live_match_id}, {"_id": 0})
    if not live_match:
        raise HTTPException(404, "Live match not found")
    await _require_scorer(live_match, user)

    live_match["period"] = body.period
    live_match["period_label"] = body.period_label or f"Period {body.period}"
    live_match["status"] = "live"

    # If there were set scores from previous period, save them
    if body.period > 1 and live_match.get("sets") is not None:
        # Snapshot current scores as a completed set
        live_match["sets"].append({
            "period": body.period - 1,
            "home": live_match["home"]["score"],
            "away": live_match["away"]["score"],
        })

    await _broadcast_and_save(live_match_id, live_match, "period_change")

    return {"period": live_match["period"], "period_label": live_match["period_label"]}


@app.post("/live/{live_match_id}/pause")
async def pause_match(live_match_id: str, user=Depends(get_current_user)):
    """Toggle pause/resume for the match. Scorer only."""
    live_match = await db.live_matches.find_one({"id": live_match_id}, {"_id": 0})
    if not live_match:
        raise HTTPException(404, "Live match not found")
    await _require_scorer(live_match, user)

    if live_match["status"] == "paused":
        live_match["status"] = "live"
    elif live_match["status"] == "live":
        live_match["status"] = "paused"
    else:
        raise HTTPException(400, f"Cannot pause/resume from status: {live_match['status']}")

    await _broadcast_and_save(live_match_id, live_match, "status_change")

    return {"status": live_match["status"]}


@app.post("/live/{live_match_id}/end")
async def end_live_scoring(live_match_id: str, request: Request, user=Depends(get_current_user)):
    """End live scoring and sync final scores to the tournament match."""
    live_match = await db.live_matches.find_one({"id": live_match_id}, {"_id": 0})
    if not live_match:
        raise HTTPException(404, "Live match not found")
    await _require_scorer(live_match, user)

    if live_match["status"] == "completed":
        raise HTTPException(400, "Match is already completed")

    live_match["status"] = "completed"
    await _broadcast_and_save(live_match_id, live_match, "status_change")

    # Determine winner
    home_score = live_match["home"]["score"]
    away_score = live_match["away"]["score"]
    if home_score > away_score:
        winner = live_match["home"]["id"]
    elif away_score > home_score:
        winner = live_match["away"]["id"]
    else:
        winner = "draw"

    # Sync to tournament match via the existing submit_match_result logic
    tournament_id = live_match["tournament_id"]
    match_id = live_match["match_id"]
    tournament = await db.tournaments.find_one({"id": tournament_id})
    if tournament and tournament["status"] == "in_progress":
        matches = tournament.get("matches", [])
        match_idx = next((i for i, m in enumerate(matches) if m["id"] == match_id), None)
        if match_idx is not None:
            match = matches[match_idx]
            if match["status"] != "completed":
                now = datetime.now(timezone.utc).isoformat()
                match["winner"] = winner if winner != "draw" else None
                match["score_a"] = home_score
                match["score_b"] = away_score
                match["status"] = "completed"
                match["completed_at"] = now
                matches[match_idx] = match

                # Format-specific logic
                if tournament["format"] == "knockout":
                    if winner != "draw":
                        _advance_winner_knockout(matches, match)
                    total_rounds = max(m["round"] for m in matches)
                    final_matches = [m for m in matches if m["round"] == total_rounds]
                    tournament_status = "completed" if all(
                        m["status"] in ("completed", "bye") for m in final_matches
                    ) else "in_progress"
                elif tournament["format"] in ("round_robin", "league"):
                    standings = tournament.get("standings", [])
                    _update_standings(standings, match, winner, home_score, away_score)
                    standings.sort(
                        key=lambda s: (s["points"], s["goals_for"] - s["goals_against"]),
                        reverse=True,
                    )
                    await db.tournaments.update_one(
                        {"id": tournament_id}, {"$set": {"standings": standings}}
                    )
                    all_done = all(m["status"] in ("completed", "bye") for m in matches)
                    tournament_status = "completed" if all_done else "in_progress"
                else:
                    tournament_status = "in_progress"

                update_set = {"matches": matches, "status": tournament_status}
                if tournament_status == "completed":
                    update_set["completed_at"] = now
                await db.tournaments.update_one({"id": tournament_id}, {"$set": update_set})

                # Auto-create performance records
                for pid in [match.get("player_a"), match.get("player_b")]:
                    if not pid:
                        continue
                    p = await db.users.find_one({"id": pid}, {"_id": 0, "name": 1})
                    p_name = p.get("name", "") if p else ""
                    result = "draw"
                    if winner and winner != "draw":
                        result = "win" if winner == pid else "loss"
                    perf_record = {
                        "id": str(uuid.uuid4()),
                        "player_id": pid,
                        "player_name": p_name,
                        "record_type": "tournament_result",
                        "sport": tournament.get("sport", ""),
                        "title": f"{tournament['name']} -- {live_match['match_label']}",
                        "stats": {
                            "score_a": home_score,
                            "score_b": away_score,
                            "result": result,
                        },
                        "notes": f"Live scored by {live_match['scorer_name']}",
                        "source_type": "tournament",
                        "source_id": tournament_id,
                        "source_name": tournament["name"],
                        "organization_id": None,
                        "tournament_id": tournament_id,
                        "session_id": None,
                        "date": now[:10],
                        "verified": True,
                        "created_at": now,
                    }
                    await db.performance_records.insert_one(perf_record)

    return {"status": "completed", "home_score": home_score, "away_score": away_score, "winner": winner}


# ---------------------------------------------------------------------------
# Live Scoring WebSocket Spectator Stream
# ---------------------------------------------------------------------------

@app.websocket("/live/ws/{live_match_id}")
async def live_score_websocket(websocket: WebSocket, live_match_id: str):
    """WebSocket endpoint for spectators to watch live score updates."""
    live_match = await db.live_matches.find_one({"id": live_match_id}, {"_id": 0})
    if not live_match:
        await websocket.close(code=4004, reason="Live match not found")
        return

    await match_manager.connect(live_match_id, websocket)
    try:
        # Send initial full state
        count = match_manager.get_count(live_match_id)
        await db.live_matches.update_one(
            {"id": live_match_id}, {"$set": {"spectator_count": count}}
        )
        initial = {
            "type": "initial_state",
            "id": live_match["id"],
            "tournament_name": live_match["tournament_name"],
            "match_label": live_match["match_label"],
            "sport": live_match["sport"],
            "status": live_match["status"],
            "home": live_match["home"],
            "away": live_match["away"],
            "sets": live_match.get("sets", []),
            "period": live_match["period"],
            "period_label": live_match["period_label"],
            "events": live_match["events"],
            "spectator_count": count,
            "started_at": live_match["started_at"],
        }
        await websocket.send_text(json.dumps(initial))

        # Broadcast updated spectator count
        await match_manager.broadcast(live_match_id, {
            "type": "spectator_count",
            "spectator_count": count,
        })

        # Keep connection alive -- wait for client messages (ping/pong)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        match_manager.disconnect(live_match_id, websocket)
        count = match_manager.get_count(live_match_id)
        await db.live_matches.update_one(
            {"id": live_match_id}, {"$set": {"spectator_count": count}}
        )
        await match_manager.broadcast(live_match_id, {
            "type": "spectator_count",
            "spectator_count": count,
        })


# ---------------------------------------------------------------------------
# Tournament bracket helpers (for end-match sync in live scoring)
# ---------------------------------------------------------------------------

def _advance_winner_knockout(matches: list, completed_match: dict):
    current_round = completed_match["round"]
    match_num = completed_match["match_number"]
    winner = completed_match["winner"]
    next_round_matches = sorted(
        [m for m in matches if m["round"] == current_round + 1],
        key=lambda x: x["match_number"],
    )
    current_round_matches = sorted(
        [m for m in matches if m["round"] == current_round],
        key=lambda x: x["match_number"],
    )
    if not next_round_matches:
        return
    idx = next(
        (i for i, m in enumerate(current_round_matches) if m["match_number"] == match_num), 0
    )
    next_match_idx = idx // 2
    if next_match_idx < len(next_round_matches):
        slot = "player_a" if idx % 2 == 0 else "player_b"
        next_round_matches[next_match_idx][slot] = winner


def _update_standings(standings: list, match: dict, winner: str, score_a, score_b):
    pa = match["player_a"]
    pb = match["player_b"]
    sa = int(score_a) if score_a is not None else 0
    sb = int(score_b) if score_b is not None else 0
    for s in standings:
        if s["user_id"] == pa:
            s["played"] += 1
            s["goals_for"] += sa
            s["goals_against"] += sb
            if winner == pa:
                s["won"] += 1
                s["points"] += 3
            elif winner == "draw" or winner is None:
                s["drawn"] += 1
                s["points"] += 1
            else:
                s["lost"] += 1
        elif s["user_id"] == pb:
            s["played"] += 1
            s["goals_for"] += sb
            s["goals_against"] += sa
            if winner == pb:
                s["won"] += 1
                s["points"] += 3
            elif winner == "draw" or winner is None:
                s["drawn"] += 1
                s["points"] += 1
            else:
                s["lost"] += 1


# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {"service": "social", "status": "healthy", "port": 8004}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
