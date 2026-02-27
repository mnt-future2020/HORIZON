"""
Live Scorecard & Real-Time Score Streaming
Scorer sends updates via REST. Spectators watch via WebSocket.
"""
from fastapi import APIRouter, HTTPException, Depends, Request, WebSocket, WebSocketDisconnect
from typing import Dict, List
from datetime import datetime, timezone
from database import db
from tz import now_ist
from auth import get_current_user
from models import LiveScoreStart, LiveScoreUpdate, LiveScoreEvent, LivePeriodChange
import uuid
import json
import logging

router = APIRouter(prefix="/live", tags=["live-scoring"])
logger = logging.getLogger("horizon")


# ---------------------------------------------------------------------------
# Match WebSocket Connection Manager
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def _require_scorer(live_match: dict, user: dict):
    if user["role"] == "super_admin":
        return
    if live_match["scorer_id"] != user["id"]:
        raise HTTPException(403, "Only the scorer can update this match")


async def _broadcast_and_save(live_match_id: str, live_match: dict, msg_type: str, extra: dict = None):
    """Save to DB and broadcast to spectators."""
    now = now_ist().isoformat()
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


# ---------------------------------------------------------------------------
# Start Live Scoring
# ---------------------------------------------------------------------------
@router.post("/start")
async def start_live_scoring(body: LiveScoreStart, user=Depends(get_current_user)):
    """Start live scoring for a tournament match. Organizer only."""
    tournament = await db.tournaments.find_one({"id": body.tournament_id})
    if not tournament:
        raise HTTPException(404, "Tournament not found")

    # Check organizer
    if user["role"] != "super_admin" and tournament["organizer_id"] != user["id"]:
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
    match_label = f"{round_label} — Match #{match.get('match_number', 1)}"

    now = now_ist().isoformat()
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
    # Return without _id
    live_match.pop("_id", None)
    return live_match


# ---------------------------------------------------------------------------
# Get Active Live Matches
# ---------------------------------------------------------------------------
@router.get("/active")
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


# ---------------------------------------------------------------------------
# Get Single Live Match
# ---------------------------------------------------------------------------
@router.get("/{live_match_id}")
async def get_live_match(live_match_id: str, user=Depends(get_current_user)):
    """Get current state of a live match (REST fallback)."""
    live_match = await db.live_matches.find_one({"id": live_match_id}, {"_id": 0})
    if not live_match:
        raise HTTPException(404, "Live match not found")
    live_match["spectator_count"] = match_manager.get_count(live_match_id)
    return live_match


# ---------------------------------------------------------------------------
# Update Score
# ---------------------------------------------------------------------------
@router.post("/{live_match_id}/score")
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


# ---------------------------------------------------------------------------
# Add Event
# ---------------------------------------------------------------------------
@router.post("/{live_match_id}/event")
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
        "timestamp": now_ist().isoformat(),
    }
    live_match["events"].append(event)
    await _broadcast_and_save(live_match_id, live_match, "event", {"event": event})

    return event


# ---------------------------------------------------------------------------
# Change Period
# ---------------------------------------------------------------------------
@router.post("/{live_match_id}/period")
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


# ---------------------------------------------------------------------------
# Pause / Resume
# ---------------------------------------------------------------------------
@router.post("/{live_match_id}/pause")
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


# ---------------------------------------------------------------------------
# End Live Scoring
# ---------------------------------------------------------------------------
@router.post("/{live_match_id}/end")
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
                now = now_ist().isoformat()
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
                        "title": f"{tournament['name']} — {live_match['match_label']}",
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
# WebSocket Spectator Stream
# ---------------------------------------------------------------------------
@router.websocket("/ws/{live_match_id}")
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

        # Keep connection alive — wait for client messages (ping/pong)
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
# Tournament bracket helpers (duplicated minimally for end-match sync)
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
