"""
Tournament & League Management System
Supports knockout, round-robin, and league formats with automatic bracket generation.
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import Optional
from datetime import datetime, timezone
from database import db
from auth import get_current_user, get_razorpay_client, get_platform_settings
import uuid
import math
import random
import hmac
import hashlib

router = APIRouter(prefix="/tournaments", tags=["tournaments"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _require_organizer(tournament: dict, user: dict):
    """Assert the user is the tournament organizer or admin."""
    if user["role"] == "super_admin":
        return
    if tournament["organizer_id"] != user["id"]:
        raise HTTPException(403, "Not authorized for this tournament")


def _generate_knockout_bracket(participants: list) -> list:
    """Generate knockout bracket matches. Pads to nearest power of 2 with byes."""
    n = len(participants)
    if n < 2:
        return []
    # Pad to power of 2
    bracket_size = 2 ** math.ceil(math.log2(n))
    padded = participants + [None] * (bracket_size - n)
    random.shuffle(padded)

    total_rounds = int(math.log2(bracket_size))
    matches = []
    match_num = 1

    # Round 1 matchups
    for i in range(0, bracket_size, 2):
        p1 = padded[i]
        p2 = padded[i + 1]
        match = {
            "id": str(uuid.uuid4()),
            "match_number": match_num,
            "round": 1,
            "player_a": p1,
            "player_b": p2,
            "winner": None,
            "score_a": None,
            "score_b": None,
            "status": "pending",
        }
        # Auto-advance byes
        if p1 is None and p2 is not None:
            match["winner"] = p2
            match["status"] = "bye"
        elif p2 is None and p1 is not None:
            match["winner"] = p1
            match["status"] = "bye"
        elif p1 is None and p2 is None:
            match["status"] = "bye"
        matches.append(match)
        match_num += 1

    # Generate placeholder matches for subsequent rounds
    for round_num in range(2, total_rounds + 1):
        matches_in_round = bracket_size // (2 ** round_num)
        for _ in range(matches_in_round):
            matches.append({
                "id": str(uuid.uuid4()),
                "match_number": match_num,
                "round": round_num,
                "player_a": None,
                "player_b": None,
                "winner": None,
                "score_a": None,
                "score_b": None,
                "status": "pending",
            })
            match_num += 1

    return matches


def _generate_round_robin(participants: list) -> list:
    """Generate round-robin schedule where every participant plays every other."""
    matches = []
    match_num = 1
    n = len(participants)
    for i in range(n):
        for j in range(i + 1, n):
            matches.append({
                "id": str(uuid.uuid4()),
                "match_number": match_num,
                "round": 1,  # All in single round for round-robin
                "player_a": participants[i],
                "player_b": participants[j],
                "winner": None,
                "score_a": None,
                "score_b": None,
                "status": "pending",
            })
            match_num += 1
    return matches


# ─── Tournament CRUD ──────────────────────────────────────────────────────────

@router.post("")
async def create_tournament(request: Request, user=Depends(get_current_user)):
    """Create a new tournament. Venue owners and admins only."""
    if user["role"] not in ("venue_owner", "super_admin", "coach"):
        raise HTTPException(403, "Only venue owners, coaches, and admins can create tournaments")

    data = await request.json()
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(400, "Tournament name required")

    format_type = data.get("format", "knockout")
    if format_type not in ("knockout", "round_robin", "league"):
        raise HTTPException(400, "Format must be knockout, round_robin, or league")

    tournament = {
        "id": str(uuid.uuid4()),
        "name": name,
        "description": data.get("description", ""),
        "sport": data.get("sport", "football"),
        "format": format_type,
        "venue_id": data.get("venue_id", ""),
        "venue_name": "",
        "organizer_id": user["id"],
        "organizer_name": user.get("name", ""),
        "max_participants": int(data.get("max_participants", 16)),
        "entry_fee": int(data.get("entry_fee", 0)),
        "prize_pool": data.get("prize_pool", ""),
        "start_date": data.get("start_date", ""),
        "end_date": data.get("end_date", ""),
        "registration_deadline": data.get("registration_deadline", ""),
        "rules": data.get("rules", ""),
        "status": "registration",  # registration, in_progress, completed, cancelled
        "participants": [],
        "matches": [],
        "standings": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    # Fetch venue name if venue_id provided
    if tournament["venue_id"]:
        venue = await db.venues.find_one({"id": tournament["venue_id"]}, {"_id": 0, "name": 1})
        if venue:
            tournament["venue_name"] = venue["name"]

    await db.tournaments.insert_one(tournament)
    tournament.pop("_id", None)
    return tournament


@router.get("")
async def list_tournaments(
    sport: Optional[str] = None,
    status: Optional[str] = None,
    my_tournaments: bool = False,
    user=Depends(get_current_user),
):
    """List tournaments with optional filters."""
    query = {}
    if sport:
        query["sport"] = sport
    if status:
        query["status"] = status
    if my_tournaments:
        query["$or"] = [
            {"organizer_id": user["id"]},
            {"participants.user_id": user["id"]},
        ]

    tournaments = await db.tournaments.find(
        query, {"_id": 0, "matches": 0}
    ).sort("created_at", -1).to_list(100)

    # Add participant count
    for t in tournaments:
        t["participant_count"] = len(t.get("participants", []))

    return tournaments


@router.get("/{tournament_id}")
async def get_tournament(tournament_id: str, user=Depends(get_current_user)):
    """Get full tournament details including bracket/matches."""
    tournament = await db.tournaments.find_one({"id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(404, "Tournament not found")
    return tournament


@router.put("/{tournament_id}")
async def update_tournament(tournament_id: str, request: Request, user=Depends(get_current_user)):
    """Update tournament details. Organizer only."""
    tournament = await db.tournaments.find_one({"id": tournament_id})
    if not tournament:
        raise HTTPException(404, "Tournament not found")
    await _require_organizer(tournament, user)

    data = await request.json()
    allowed = ["name", "description", "sport", "max_participants", "entry_fee",
               "prize_pool", "start_date", "end_date", "registration_deadline", "rules"]
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        await db.tournaments.update_one({"id": tournament_id}, {"$set": updates})
    updated = await db.tournaments.find_one({"id": tournament_id}, {"_id": 0})
    return updated


@router.delete("/{tournament_id}")
async def cancel_tournament(tournament_id: str, user=Depends(get_current_user)):
    """Cancel a tournament. Organizer only."""
    tournament = await db.tournaments.find_one({"id": tournament_id})
    if not tournament:
        raise HTTPException(404, "Tournament not found")
    await _require_organizer(tournament, user)

    if tournament["status"] == "completed":
        raise HTTPException(400, "Cannot cancel a completed tournament")

    await db.tournaments.update_one(
        {"id": tournament_id},
        {"$set": {"status": "cancelled"}}
    )

    # Notify participants
    for p in tournament.get("participants", []):
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": p["user_id"],
            "type": "tournament_cancelled",
            "title": "Tournament Cancelled",
            "message": f'"{tournament["name"]}" has been cancelled by the organizer.',
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    return {"message": "Tournament cancelled"}


# ─── Registration ─────────────────────────────────────────────────────────────

@router.post("/{tournament_id}/register")
async def register_for_tournament(tournament_id: str, user=Depends(get_current_user)):
    """Register for a tournament."""
    tournament = await db.tournaments.find_one({"id": tournament_id})
    if not tournament:
        raise HTTPException(404, "Tournament not found")

    if tournament["status"] != "registration":
        raise HTTPException(400, "Registration is closed")

    if len(tournament.get("participants", [])) >= tournament["max_participants"]:
        raise HTTPException(400, "Tournament is full")

    # Check if already registered
    existing = next(
        (p for p in tournament.get("participants", []) if p["user_id"] == user["id"]),
        None
    )
    if existing:
        raise HTTPException(409, "Already registered")

    entry_fee = tournament.get("entry_fee", 0)

    participant = {
        "user_id": user["id"],
        "name": user.get("name", ""),
        "rating": user.get("skill_rating", 1500),
        "registered_at": datetime.now(timezone.utc).isoformat(),
    }

    result_data = {"message": "Registered successfully", "participant": participant}

    if entry_fee > 0:
        # Payment required — create Razorpay order
        platform = await get_platform_settings()
        commission_pct = platform.get("tournament_commission_pct", 10)
        commission_amount = int(entry_fee * commission_pct / 100)

        participant["payment_status"] = "pending"
        participant["commission_amount"] = commission_amount

        rzp_client = await get_razorpay_client()
        if rzp_client:
            try:
                rzp_order = rzp_client.order.create({
                    "amount": entry_fee * 100,
                    "currency": "INR",
                    "payment_capture": 1,
                    "notes": {"tournament_id": tournament_id, "user_id": user["id"], "type": "tournament_entry"}
                })
                participant["razorpay_order_id"] = rzp_order["id"]
                participant["payment_gateway"] = "razorpay"
                result_data["razorpay_order_id"] = rzp_order["id"]
                gw = platform.get("payment_gateway", {})
                result_data["razorpay_key_id"] = gw.get("key_id", "")
            except Exception:
                raise HTTPException(502, "Payment gateway error. Please try again.")
        else:
            participant["payment_gateway"] = "test"

        result_data["payment_gateway"] = participant.get("payment_gateway", "test")
        result_data["payment_status"] = "pending"
        result_data["entry_fee"] = entry_fee
        result_data["message"] = "Registration pending payment"
    else:
        # Free tournament — instant registration
        participant["payment_status"] = "free"

    await db.tournaments.update_one(
        {"id": tournament_id},
        {"$push": {"participants": participant}}
    )

    return result_data


@router.delete("/{tournament_id}/register")
async def withdraw_from_tournament(tournament_id: str, user=Depends(get_current_user)):
    """Withdraw from a tournament before it starts."""
    tournament = await db.tournaments.find_one({"id": tournament_id})
    if not tournament:
        raise HTTPException(404, "Tournament not found")

    if tournament["status"] != "registration":
        raise HTTPException(400, "Cannot withdraw after tournament has started")

    result = await db.tournaments.update_one(
        {"id": tournament_id},
        {"$pull": {"participants": {"user_id": user["id"]}}}
    )

    if result.modified_count == 0:
        raise HTTPException(404, "Not registered in this tournament")

    return {"message": "Withdrawn from tournament"}


# ─── Entry Fee Payment Verification ──────────────────────────────────────────

@router.post("/{tournament_id}/verify-entry-payment")
async def verify_entry_payment(tournament_id: str, request: Request, user=Depends(get_current_user)):
    """Verify Razorpay payment for tournament entry fee."""
    data = await request.json()
    razorpay_payment_id = data.get("razorpay_payment_id", "")
    razorpay_order_id = data.get("razorpay_order_id", "")
    razorpay_signature = data.get("razorpay_signature", "")

    tournament = await db.tournaments.find_one({"id": tournament_id})
    if not tournament:
        raise HTTPException(404, "Tournament not found")

    # Find participant
    participant = next(
        (p for p in tournament.get("participants", []) if p["user_id"] == user["id"]),
        None
    )
    if not participant:
        raise HTTPException(404, "Not registered in this tournament")
    if participant.get("payment_status") == "paid":
        raise HTTPException(400, "Entry fee already paid")

    settings = await get_platform_settings()
    gw = settings.get("payment_gateway", {})
    key_secret = gw.get("key_secret", "")

    if key_secret:
        msg = f"{razorpay_order_id}|{razorpay_payment_id}"
        expected = hmac.new(key_secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
        if expected != razorpay_signature:
            raise HTTPException(400, "Payment verification failed")
    elif participant.get("payment_gateway") == "razorpay":
        raise HTTPException(500, "Payment gateway not configured properly")

    await db.tournaments.update_one(
        {"id": tournament_id, "participants.user_id": user["id"]},
        {"$set": {
            "participants.$.payment_status": "paid",
            "participants.$.payment_details": {
                "razorpay_payment_id": razorpay_payment_id,
                "razorpay_order_id": razorpay_order_id,
                "razorpay_signature": razorpay_signature,
                "paid_at": datetime.now(timezone.utc).isoformat()
            }
        }}
    )
    return {"message": "Entry fee paid, registration confirmed", "payment_status": "paid"}


@router.post("/{tournament_id}/test-confirm-entry")
async def test_confirm_entry(tournament_id: str, user=Depends(get_current_user)):
    """Confirm entry fee for test-mode tournaments (no payment gateway configured)."""
    tournament = await db.tournaments.find_one({"id": tournament_id})
    if not tournament:
        raise HTTPException(404, "Tournament not found")

    participant = next(
        (p for p in tournament.get("participants", []) if p["user_id"] == user["id"]),
        None
    )
    if not participant:
        raise HTTPException(404, "Not registered in this tournament")
    if participant.get("payment_gateway") not in ("test", "mock"):
        raise HTTPException(400, "This endpoint is only for test-mode registrations")
    if participant.get("payment_status") == "paid":
        raise HTTPException(400, "Entry fee already paid")

    await db.tournaments.update_one(
        {"id": tournament_id, "participants.user_id": user["id"]},
        {"$set": {
            "participants.$.payment_status": "paid",
            "participants.$.payment_details": {
                "method": "test",
                "test_payment_id": f"test_{uuid.uuid4().hex[:12]}",
                "paid_at": datetime.now(timezone.utc).isoformat()
            }
        }}
    )
    return {"message": "Test entry fee confirmed", "payment_status": "paid"}


# ─── Start Tournament (Generate Bracket) ─────────────────────────────────────

@router.post("/{tournament_id}/start")
async def start_tournament(tournament_id: str, user=Depends(get_current_user)):
    """Start the tournament — generates bracket/schedule. Organizer only."""
    tournament = await db.tournaments.find_one({"id": tournament_id})
    if not tournament:
        raise HTTPException(404, "Tournament not found")
    await _require_organizer(tournament, user)

    if tournament["status"] != "registration":
        raise HTTPException(400, "Tournament already started or completed")

    participants = tournament.get("participants", [])

    # For paid tournaments, only include participants who have paid
    if tournament.get("entry_fee", 0) > 0:
        participants = [p for p in participants if p.get("payment_status") in ("paid", "free")]

    if len(participants) < 2:
        raise HTTPException(400, "Need at least 2 paid participants to start")

    # Build participant ID list
    player_ids = [p["user_id"] for p in participants]

    # Generate matches based on format
    if tournament["format"] == "knockout":
        matches = _generate_knockout_bracket(player_ids)
    elif tournament["format"] in ("round_robin", "league"):
        matches = _generate_round_robin(player_ids)
    else:
        matches = _generate_knockout_bracket(player_ids)

    # Initialize standings for round-robin/league
    standings = []
    if tournament["format"] in ("round_robin", "league"):
        for p in participants:
            standings.append({
                "user_id": p["user_id"],
                "name": p["name"],
                "played": 0,
                "won": 0,
                "drawn": 0,
                "lost": 0,
                "goals_for": 0,
                "goals_against": 0,
                "points": 0,
            })

    # Advance byes in knockout
    if tournament["format"] == "knockout":
        _advance_byes(matches)

    await db.tournaments.update_one(
        {"id": tournament_id},
        {"$set": {
            "status": "in_progress",
            "matches": matches,
            "standings": standings,
            "started_at": datetime.now(timezone.utc).isoformat(),
        }}
    )

    # Notify all participants
    for p in participants:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": p["user_id"],
            "type": "tournament_started",
            "title": "Tournament Started!",
            "message": f'"{tournament["name"]}" has begun. Check your matches!',
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    updated = await db.tournaments.find_one({"id": tournament_id}, {"_id": 0})
    return updated


def _advance_byes(matches: list):
    """For knockout, advance bye winners to the next round."""
    # Group matches by round
    rounds = {}
    for m in matches:
        r = m["round"]
        if r not in rounds:
            rounds[r] = []
        rounds[r].append(m)

    max_round = max(rounds.keys()) if rounds else 0

    for r in range(1, max_round):
        round_matches = sorted(rounds.get(r, []), key=lambda x: x["match_number"])
        next_round_matches = sorted(rounds.get(r + 1, []), key=lambda x: x["match_number"])

        for i, match in enumerate(round_matches):
            if match["winner"] and match["status"] == "bye":
                # Find which next-round match this feeds into
                next_idx = i // 2
                if next_idx < len(next_round_matches):
                    slot = "player_a" if i % 2 == 0 else "player_b"
                    next_round_matches[next_idx][slot] = match["winner"]


# ─── Submit Match Result ──────────────────────────────────────────────────────

@router.post("/{tournament_id}/matches/{match_id}/result")
async def submit_match_result(
    tournament_id: str, match_id: str, request: Request, user=Depends(get_current_user)
):
    """Submit a match result. Organizer only."""
    tournament = await db.tournaments.find_one({"id": tournament_id})
    if not tournament:
        raise HTTPException(404, "Tournament not found")
    await _require_organizer(tournament, user)

    if tournament["status"] != "in_progress":
        raise HTTPException(400, "Tournament is not in progress")

    data = await request.json()
    winner = data.get("winner")  # user_id of winner, or "draw"
    score_a = data.get("score_a")
    score_b = data.get("score_b")

    matches = tournament.get("matches", [])
    match_idx = next((i for i, m in enumerate(matches) if m["id"] == match_id), None)
    if match_idx is None:
        raise HTTPException(404, "Match not found")

    match = matches[match_idx]
    if match["status"] == "completed":
        raise HTTPException(400, "Match result already submitted")

    if not winner:
        raise HTTPException(400, "Winner is required")

    # Validate winner
    if winner != "draw" and winner not in (match["player_a"], match["player_b"]):
        raise HTTPException(400, "Winner must be one of the players or 'draw'")

    # Update match
    match["winner"] = winner if winner != "draw" else None
    match["score_a"] = score_a
    match["score_b"] = score_b
    match["status"] = "completed"
    match["completed_at"] = datetime.now(timezone.utc).isoformat()
    matches[match_idx] = match

    # Format-specific logic
    if tournament["format"] == "knockout":
        # Advance winner to next round
        if winner != "draw":
            _advance_winner_knockout(matches, match)

        # Check if tournament is complete (final match done)
        total_rounds = max(m["round"] for m in matches)
        final_matches = [m for m in matches if m["round"] == total_rounds]
        if all(m["status"] in ("completed", "bye") for m in final_matches):
            tournament_status = "completed"
        else:
            tournament_status = "in_progress"

    elif tournament["format"] in ("round_robin", "league"):
        # Update standings
        standings = tournament.get("standings", [])
        _update_standings(standings, match, winner, score_a, score_b)

        # Check if all matches are done
        all_done = all(m["status"] in ("completed", "bye") for m in matches)
        tournament_status = "completed" if all_done else "in_progress"

        # Sort standings by points, then goal difference
        standings.sort(key=lambda s: (s["points"], s["goals_for"] - s["goals_against"]), reverse=True)
        await db.tournaments.update_one(
            {"id": tournament_id},
            {"$set": {"standings": standings}}
        )
    else:
        tournament_status = "in_progress"

    update_set = {"matches": matches, "status": tournament_status}
    if tournament_status == "completed":
        update_set["completed_at"] = datetime.now(timezone.utc).isoformat()

    await db.tournaments.update_one({"id": tournament_id}, {"$set": update_set})

    # ── Auto-create performance records for both players ──
    now = datetime.now(timezone.utc).isoformat()
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
            "title": f"{tournament['name']} — Round {match.get('round', 1)}",
            "stats": {"score_a": score_a, "score_b": score_b, "result": result},
            "notes": "",
            "source_type": "tournament",
            "source_id": tournament_id,
            "source_name": tournament["name"],
            "organization_id": None,
            "tournament_id": tournament_id,
            "session_id": None,
            "date": match.get("completed_at", now)[:10],
            "verified": True,
            "created_at": now
        }
        await db.performance_records.insert_one(perf_record)

    updated = await db.tournaments.find_one({"id": tournament_id}, {"_id": 0})
    return updated


def _advance_winner_knockout(matches: list, completed_match: dict):
    """Advance the winner to the next round's appropriate match slot."""
    current_round = completed_match["round"]
    match_num = completed_match["match_number"]
    winner = completed_match["winner"]

    # Find matches in the next round
    next_round_matches = sorted(
        [m for m in matches if m["round"] == current_round + 1],
        key=lambda x: x["match_number"]
    )
    current_round_matches = sorted(
        [m for m in matches if m["round"] == current_round],
        key=lambda x: x["match_number"]
    )

    if not next_round_matches:
        return  # This was the final

    # Determine position in current round
    idx = next(
        (i for i, m in enumerate(current_round_matches) if m["match_number"] == match_num),
        0
    )
    next_match_idx = idx // 2
    if next_match_idx < len(next_round_matches):
        slot = "player_a" if idx % 2 == 0 else "player_b"
        next_round_matches[next_match_idx][slot] = winner


def _update_standings(standings: list, match: dict, winner: str, score_a, score_b):
    """Update round-robin/league standings after a match result."""
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


# ─── Leaderboard / Stats ─────────────────────────────────────────────────────

@router.get("/{tournament_id}/standings")
async def get_standings(tournament_id: str, user=Depends(get_current_user)):
    """Get current standings for a round-robin/league tournament."""
    tournament = await db.tournaments.find_one({"id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(404, "Tournament not found")
    return {
        "format": tournament["format"],
        "standings": tournament.get("standings", []),
        "participants": tournament.get("participants", []),
    }
