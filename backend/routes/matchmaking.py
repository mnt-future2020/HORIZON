from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional
from datetime import datetime, timezone
from database import db
from auth import get_current_user, get_razorpay_client, get_platform_settings
from models import MatchRequestCreate, MercenaryCreate, MatchResultSubmit
from glicko2 import update_rating, calculate_compatibility, suggest_balanced_teams
import uuid
import logging

router = APIRouter()
logger = logging.getLogger("horizon")


# --- Matchmaking Routes ---
@router.get("/matchmaking")
async def list_matches(sport: Optional[str] = None, status: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    else:
        query["status"] = {"$in": ["open", "filled"]}
    if sport:
        query["sport"] = sport
    matches = await db.match_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return matches


@router.post("/matchmaking")
async def create_match(input: MatchRequestCreate, user=Depends(get_current_user)):
    match = {
        "id": str(uuid.uuid4()), "creator_id": user["id"],
        "creator_name": user["name"], **input.model_dump(),
        "players_joined": [user["id"]], "player_names": [user["name"]],
        "player_ratings": {user["id"]: user.get("skill_rating", 1500)},
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.match_requests.insert_one(match)
    match.pop("_id", None)
    return match


@router.post("/matchmaking/{match_id}/join")
async def join_match(match_id: str, user=Depends(get_current_user)):
    match = await db.match_requests.find_one({"id": match_id})
    if not match:
        raise HTTPException(404, "Match not found")
    if user["id"] in match.get("players_joined", []):
        raise HTTPException(400, "Already joined")
    joined = match.get("players_joined", [])
    names = match.get("player_names", [])
    joined.append(user["id"])
    names.append(user["name"])
    ratings = match.get("player_ratings", {})
    ratings[user["id"]] = user.get("skill_rating", 1500)
    updates = {"players_joined": joined, "player_names": names, "player_ratings": ratings}
    if len(joined) >= match.get("players_needed", 10):
        updates["status"] = "filled"
    await db.match_requests.update_one({"id": match_id}, {"$set": updates})
    return {"message": "Joined match"}


@router.get("/matchmaking/recommended")
async def recommended_matches(user=Depends(get_current_user)):
    """Get open matches sorted by skill compatibility for the current user."""
    user_rating = user.get("skill_rating", 1500)
    user_rd = user.get("skill_deviation", 350)
    user_sports = user.get("sports", [])

    query = {"status": "open", "creator_id": {"$ne": user["id"]}}
    matches = await db.match_requests.find(query, {"_id": 0}).to_list(100)

    scored = []
    for m in matches:
        if user["id"] in m.get("players_joined", []):
            continue
        compat = calculate_compatibility(
            user_rating, user_rd,
            m.get("min_skill", 0), m.get("max_skill", 3000)
        )
        sport_bonus = 10 if m.get("sport") in user_sports else 0
        spots_left = m.get("players_needed", 10) - len(m.get("players_joined", []))
        m["compatibility_score"] = min(100, compat + sport_bonus)
        m["spots_left"] = spots_left
        scored.append(m)

    scored.sort(key=lambda x: x["compatibility_score"], reverse=True)
    return scored


@router.post("/matchmaking/auto-match")
async def auto_match(request: Request, user=Depends(get_current_user)):
    """Find the best match for the user or suggest creating one."""
    body = await request.json()
    sport = body.get("sport", "")
    user_rating = user.get("skill_rating", 1500)
    user_rd = user.get("skill_deviation", 350)

    query = {"status": "open", "creator_id": {"$ne": user["id"]}}
    if sport:
        query["sport"] = sport
    matches = await db.match_requests.find(query, {"_id": 0}).to_list(100)

    best_match = None
    best_score = -1

    for m in matches:
        if user["id"] in m.get("players_joined", []):
            continue
        spots = m.get("players_needed", 10) - len(m.get("players_joined", []))
        if spots <= 0:
            continue
        compat = calculate_compatibility(
            user_rating, user_rd,
            m.get("min_skill", 0), m.get("max_skill", 3000)
        )
        if compat > best_score:
            best_score = compat
            best_match = m

    if best_match:
        best_match["compatibility_score"] = best_score
        return {"found": True, "match": best_match}
    return {"found": False, "message": "No compatible matches found. Try creating one!"}


@router.get("/matchmaking/{match_id}/suggest-teams")
async def suggest_teams(match_id: str, user=Depends(get_current_user)):
    """Suggest balanced team splits for a filled/active match."""
    match = await db.match_requests.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(404, "Match not found")

    player_ids = match.get("players_joined", [])
    if len(player_ids) < 2:
        raise HTTPException(400, "Need at least 2 players")

    players = []
    for pid in player_ids:
        u = await db.users.find_one({"id": pid}, {"_id": 0, "password_hash": 0})
        if u:
            players.append({
                "id": u["id"], "name": u["name"],
                "skill_rating": u.get("skill_rating", 1500),
                "skill_deviation": u.get("skill_deviation", 350)
            })

    team_a, team_b, rating_diff = suggest_balanced_teams(players)
    avg_a = round(sum(p["skill_rating"] for p in team_a) / max(len(team_a), 1))
    avg_b = round(sum(p["skill_rating"] for p in team_b) / max(len(team_b), 1))

    return {
        "team_a": team_a, "team_b": team_b,
        "avg_rating_a": avg_a, "avg_rating_b": avg_b,
        "rating_diff": rating_diff, "balance_quality": max(0, 100 - rating_diff)
    }


@router.post("/matchmaking/{match_id}/submit-result")
async def submit_match_result(match_id: str, input: MatchResultSubmit, user=Depends(get_current_user)):
    """Submit match result. Any player in the match can submit."""
    match = await db.match_requests.find_one({"id": match_id})
    if not match:
        raise HTTPException(404, "Match not found")
    if user["id"] not in match.get("players_joined", []):
        raise HTTPException(403, "Only players in this match can submit results")
    if match.get("result", {}).get("confirmed"):
        raise HTTPException(400, "Result already confirmed")
    if input.winner not in ("team_a", "team_b", "draw"):
        raise HTTPException(400, "Winner must be team_a, team_b, or draw")

    result = {
        "submitted_by": user["id"],
        "team_a": input.team_a,
        "team_b": input.team_b,
        "winner": input.winner,
        "score_a": input.score_a,
        "score_b": input.score_b,
        "confirmations": [{"user_id": user["id"], "confirmed": True}],
        "confirmed": False,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }

    all_players = set(input.team_a + input.team_b)
    needed = max(2, len(all_players) // 2 + 1)  # Majority
    if len(all_players) <= 2:
        needed = len(all_players)

    # Auto-confirm if only submitter is enough (solo/duo)
    if len(result["confirmations"]) >= needed:
        result["confirmed"] = True
        result["confirmed_at"] = datetime.now(timezone.utc).isoformat()

    await db.match_requests.update_one(
        {"id": match_id},
        {"$set": {"result": result, "status": "completed" if result["confirmed"] else "pending_result"}}
    )

    if result["confirmed"]:
        await _apply_rating_updates(match_id, result)

    return {
        "message": "Result submitted" + (" and confirmed!" if result["confirmed"] else ". Waiting for confirmations."),
        "confirmations": len(result["confirmations"]),
        "needed": needed,
        "confirmed": result["confirmed"]
    }


@router.post("/matchmaking/{match_id}/confirm-result")
async def confirm_match_result(match_id: str, request: Request, user=Depends(get_current_user)):
    """Confirm or dispute a submitted match result."""
    body = await request.json()
    confirmed = body.get("confirmed", True)

    match = await db.match_requests.find_one({"id": match_id})
    if not match:
        raise HTTPException(404, "Match not found")
    if user["id"] not in match.get("players_joined", []):
        raise HTTPException(403, "Only players in this match can confirm")

    result = match.get("result")
    if not result:
        raise HTTPException(400, "No result submitted yet")
    if result.get("confirmed"):
        raise HTTPException(400, "Result already confirmed")

    # Check if user already confirmed
    existing = [c for c in result.get("confirmations", []) if c["user_id"] == user["id"]]
    if existing:
        raise HTTPException(400, "You already responded to this result")

    result["confirmations"].append({"user_id": user["id"], "confirmed": confirmed})

    all_players = set(result.get("team_a", []) + result.get("team_b", []))
    needed = max(2, len(all_players) // 2 + 1)
    if len(all_players) <= 2:
        needed = len(all_players)

    confirmed_count = sum(1 for c in result["confirmations"] if c["confirmed"])
    disputed_count = sum(1 for c in result["confirmations"] if not c["confirmed"])

    if confirmed_count >= needed:
        result["confirmed"] = True
        result["confirmed_at"] = datetime.now(timezone.utc).isoformat()
        await db.match_requests.update_one(
            {"id": match_id},
            {"$set": {"result": result, "status": "completed"}}
        )
        await _apply_rating_updates(match_id, result)
        return {"message": "Result confirmed! Ratings updated.", "confirmed": True}
    elif disputed_count >= needed:
        # Majority disputed - reset result
        await db.match_requests.update_one(
            {"id": match_id},
            {"$unset": {"result": ""}, "$set": {"status": "filled"}}
        )
        return {"message": "Result disputed by majority. Please re-submit.", "confirmed": False, "disputed": True}
    else:
        await db.match_requests.update_one(
            {"id": match_id},
            {"$set": {"result": result}}
        )
        return {
            "message": f"Response recorded. {confirmed_count}/{needed} confirmations.",
            "confirmed": False, "confirmations": confirmed_count, "needed": needed
        }


async def _apply_rating_updates(match_id: str, result: dict):
    """Apply Glicko-2 rating updates after a confirmed result."""
    team_a_ids = result.get("team_a", [])
    team_b_ids = result.get("team_b", [])
    winner = result.get("winner", "draw")

    # Fetch all players
    all_ids = team_a_ids + team_b_ids
    players = {}
    for pid in all_ids:
        u = await db.users.find_one({"id": pid}, {"_id": 0})
        if u:
            players[pid] = u

    if not players:
        return

    # Calculate team averages for opponents
    team_a_ratings = [(players[p]["skill_rating"], players[p].get("skill_deviation", 350))
                      for p in team_a_ids if p in players]
    team_b_ratings = [(players[p]["skill_rating"], players[p].get("skill_deviation", 350))
                      for p in team_b_ids if p in players]

    if not team_a_ratings or not team_b_ratings:
        return

    avg_a = sum(r for r, _ in team_a_ratings) / len(team_a_ratings)
    avg_rd_a = sum(d for _, d in team_a_ratings) / len(team_a_ratings)
    avg_b = sum(r for r, _ in team_b_ratings) / len(team_b_ratings)
    avg_rd_b = sum(d for _, d in team_b_ratings) / len(team_b_ratings)

    # Determine scores
    if winner == "team_a":
        score_a, score_b = 1.0, 0.0
    elif winner == "team_b":
        score_a, score_b = 0.0, 1.0
    else:
        score_a, score_b = 0.5, 0.5

    updates = []

    # Update Team A players
    for pid in team_a_ids:
        if pid not in players:
            continue
        p = players[pid]
        new_r, new_rd, new_vol = update_rating(
            p.get("skill_rating", 1500),
            p.get("skill_deviation", 350),
            p.get("volatility", 0.06),
            [(avg_b, avg_rd_b, score_a)]
        )
        update_fields = {
            "skill_rating": new_r,
            "skill_deviation": new_rd,
            "volatility": new_vol,
        }
        if winner == "team_a":
            update_fields["wins"] = p.get("wins", 0) + 1
        elif winner == "team_b":
            update_fields["losses"] = p.get("losses", 0) + 1
        else:
            update_fields["draws"] = p.get("draws", 0) + 1
        updates.append((pid, update_fields, new_r - p.get("skill_rating", 1500)))

    # Update Team B players
    for pid in team_b_ids:
        if pid not in players:
            continue
        p = players[pid]
        new_r, new_rd, new_vol = update_rating(
            p.get("skill_rating", 1500),
            p.get("skill_deviation", 350),
            p.get("volatility", 0.06),
            [(avg_a, avg_rd_a, score_b)]
        )
        update_fields = {
            "skill_rating": new_r,
            "skill_deviation": new_rd,
            "volatility": new_vol,
        }
        if winner == "team_b":
            update_fields["wins"] = p.get("wins", 0) + 1
        elif winner == "team_a":
            update_fields["losses"] = p.get("losses", 0) + 1
        else:
            update_fields["draws"] = p.get("draws", 0) + 1
        updates.append((pid, update_fields, new_r - p.get("skill_rating", 1500)))

    # Apply all updates
    for pid, fields, delta in updates:
        await db.users.update_one({"id": pid}, {"$set": fields})
        # Notify player of rating change
        direction = "+" if delta > 0 else ""
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()), "user_id": pid,
            "type": "rating_update",
            "title": "Rating Updated!",
            "message": f"Your skill rating changed by {direction}{delta} to {fields['skill_rating']} after the match.",
            "is_read": False, "created_at": datetime.now(timezone.utc).isoformat()
        })

    logger.info(f"Glicko-2 ratings updated for match {match_id}: {len(updates)} players")


# --- Leaderboard ---
@router.get("/leaderboard")
async def get_leaderboard(sport: Optional[str] = None, limit: int = 50):
    """Get top players by skill rating, optionally filtered by sport."""
    query = {"role": {"$in": ["player", "coach"]}, "account_status": "active"}
    if sport:
        query["sports"] = sport
    players = await db.users.find(
        query, {"_id": 0, "password_hash": 0, "volatility": 0}
    ).sort("skill_rating", -1).to_list(limit)

    leaderboard = []
    for i, p in enumerate(players):
        leaderboard.append({
            "rank": i + 1,
            "id": p["id"],
            "name": p["name"],
            "skill_rating": p.get("skill_rating", 1500),
            "skill_deviation": p.get("skill_deviation", 350),
            "total_games": p.get("total_games", 0),
            "wins": p.get("wins", 0),
            "losses": p.get("losses", 0),
            "draws": p.get("draws", 0),
            "sports": p.get("sports", []),
            "reliability_score": p.get("reliability_score", 100),
        })
    return leaderboard


# --- Mercenary Routes ---
@router.get("/mercenary")
async def list_mercenary(sport: Optional[str] = None):
    query = {"status": "open"}
    if sport:
        query["sport"] = sport
    posts = await db.mercenary_posts.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return posts


@router.get("/mercenary/my-posts")
async def my_mercenary_posts(user=Depends(get_current_user)):
    posts = await db.mercenary_posts.find(
        {"host_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return posts


@router.post("/mercenary")
async def create_mercenary(input: MercenaryCreate, user=Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": input.booking_id, "host_id": user["id"]}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Booking not found or not owned by you")
    venue = await db.venues.find_one({"id": booking["venue_id"]}, {"_id": 0, "name": 1})
    post = {
        "id": str(uuid.uuid4()), "host_id": user["id"],
        "host_name": user["name"], "booking_id": input.booking_id,
        "venue_id": booking["venue_id"],
        "venue_name": venue["name"] if venue else booking.get("venue_name", ""),
        "sport": booking.get("sport", "football"),
        "date": booking["date"], "time": booking["start_time"],
        "position_needed": input.position_needed,
        "description": input.description,
        "amount_per_player": input.amount_per_player,
        "spots_available": input.spots_available,
        "spots_filled": 0,
        "applicants": [], "accepted": [], "paid_players": [],
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.mercenary_posts.insert_one(post)
    post.pop("_id", None)
    return post


@router.post("/mercenary/{post_id}/apply")
async def apply_mercenary(post_id: str, user=Depends(get_current_user)):
    post = await db.mercenary_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(404, "Post not found")
    if post["host_id"] == user["id"]:
        raise HTTPException(400, "Cannot apply to your own post")
    if user["id"] in [a.get("id") for a in post.get("applicants", [])]:
        raise HTTPException(400, "Already applied")
    if user["id"] in [a.get("id") for a in post.get("accepted", [])]:
        raise HTTPException(400, "Already accepted")
    applicant = {
        "id": user["id"], "name": user["name"],
        "skill_rating": user.get("skill_rating", 1500),
        "sports": user.get("sports", []),
        "applied_at": datetime.now(timezone.utc).isoformat()
    }
    await db.mercenary_posts.update_one(
        {"id": post_id}, {"$push": {"applicants": applicant}}
    )
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "user_id": post["host_id"],
        "type": "mercenary_application",
        "title": "New Mercenary Application",
        "message": f"{user['name']} (Rating: {user.get('skill_rating', 1500)}) applied for {post['position_needed']}",
        "is_read": False, "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Applied successfully"}


@router.post("/mercenary/{post_id}/accept/{applicant_id}")
async def accept_mercenary(post_id: str, applicant_id: str, user=Depends(get_current_user)):
    post = await db.mercenary_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(404, "Post not found")
    if post["host_id"] != user["id"]:
        raise HTTPException(403, "Only the host can accept applicants")
    applicant = next((a for a in post.get("applicants", []) if a["id"] == applicant_id), None)
    if not applicant:
        raise HTTPException(404, "Applicant not found")
    if len(post.get("accepted", [])) >= post.get("spots_available", 1):
        raise HTTPException(400, "All spots already filled")
    await db.mercenary_posts.update_one({"id": post_id}, {
        "$pull": {"applicants": {"id": applicant_id}},
        "$push": {"accepted": applicant}
    })
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "user_id": applicant_id,
        "type": "mercenary_accepted",
        "title": "You're In!",
        "message": f"You've been accepted for {post['position_needed']} at {post['venue_name']} on {post['date']} at {post['time']}. Pay {chr(8377)}{post['amount_per_player']} to confirm.",
        "venue_id": post.get("venue_id", ""),
        "mercenary_post_id": post_id,
        "is_read": False, "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Applicant accepted"}


@router.post("/mercenary/{post_id}/reject/{applicant_id}")
async def reject_mercenary(post_id: str, applicant_id: str, user=Depends(get_current_user)):
    post = await db.mercenary_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(404, "Post not found")
    if post["host_id"] != user["id"]:
        raise HTTPException(403, "Only the host can reject applicants")
    await db.mercenary_posts.update_one(
        {"id": post_id}, {"$pull": {"applicants": {"id": applicant_id}}}
    )
    return {"message": "Applicant rejected"}


@router.post("/mercenary/{post_id}/pay")
async def pay_mercenary(post_id: str, user=Depends(get_current_user)):
    post = await db.mercenary_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(404, "Post not found")
    accepted_ids = [a["id"] for a in post.get("accepted", [])]
    if user["id"] not in accepted_ids:
        raise HTTPException(403, "You must be accepted before paying")
    if user["id"] in [p["id"] for p in post.get("paid_players", [])]:
        raise HTTPException(400, "Already paid")

    amount = post["amount_per_player"]
    rzp_client = await get_razorpay_client()

    if rzp_client:
        try:
            rzp_order = rzp_client.order.create({
                "amount": amount * 100, "currency": "INR", "payment_capture": 1,
                "notes": {"mercenary_post_id": post_id, "payer_id": user["id"]}
            })
            gw = (await get_platform_settings()).get("payment_gateway", {})
            return {
                "payment_gateway": "razorpay",
                "razorpay_order_id": rzp_order["id"],
                "razorpay_key_id": gw.get("key_id", ""),
                "amount": amount
            }
        except Exception as e:
            logger.warning(f"Razorpay failed for mercenary: {e}")

    paid_player = {"id": user["id"], "name": user["name"], "paid_at": datetime.now(timezone.utc).isoformat()}
    new_filled = post.get("spots_filled", 0) + 1
    updates = {"$push": {"paid_players": paid_player}, "$set": {"spots_filled": new_filled}}
    if new_filled >= post.get("spots_available", 1):
        updates["$set"]["status"] = "filled"
    await db.mercenary_posts.update_one({"id": post_id}, updates)

    if post.get("booking_id"):
        await db.bookings.update_one(
            {"id": post["booking_id"]}, {"$addToSet": {"players": user["id"]}}
        )
    return {"payment_gateway": "mock", "message": "Payment successful", "amount": amount}


@router.post("/mercenary/{post_id}/verify-payment")
async def verify_mercenary_payment(post_id: str, request: Request, user=Depends(get_current_user)):
    post = await db.mercenary_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(404, "Post not found")

    paid_player = {"id": user["id"], "name": user["name"], "paid_at": datetime.now(timezone.utc).isoformat()}
    new_filled = post.get("spots_filled", 0) + 1
    updates = {"$push": {"paid_players": paid_player}, "$set": {"spots_filled": new_filled}}
    if new_filled >= post.get("spots_available", 1):
        updates["$set"]["status"] = "filled"
    await db.mercenary_posts.update_one({"id": post_id}, updates)

    if post.get("booking_id"):
        await db.bookings.update_one(
            {"id": post["booking_id"]}, {"$addToSet": {"players": user["id"]}}
        )

    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "user_id": post["host_id"],
        "type": "mercenary_paid",
        "title": "Player Confirmed!",
        "message": f"{user['name']} paid and joined your game at {post['venue_name']}",
        "is_read": False, "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Payment verified, you're in the game!"}
