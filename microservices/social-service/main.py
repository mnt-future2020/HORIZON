"""
Social Service – Port 8004
Handles: Social Feed, Player Cards, Clubs & Squads, Tournament Engine
NEW PRD v2.0 features that don't exist in the monolith.
"""
import sys, os
sys.path.insert(0, "/app/shared")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "shared"))

import uuid
import logging
import math
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from database import db, get_redis
from auth import get_current_user
from models import SocialPostCreate, ClubCreate, TournamentCreate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("social-service")

app = FastAPI(title="Horizon Social Service", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


# ═══════════════════════════════════════════════════════════════════════════════
# SOCIAL FEED
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/feed")
async def get_feed(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user=Depends(get_current_user)
):
    """Get social feed – posts from followed users, clubs, and trending."""
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
async def register_team(tournament_id: str, request: Request, user=Depends(get_current_user)):
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
# HEALTH
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {"service": "social", "status": "healthy", "port": 8004}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
