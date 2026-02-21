"""
Recommendation & Algorithm API Routes
Venue recs, player recs, group recs, compatibility, engagement scores, churn prediction.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from auth import get_current_user
from services.algorithms import (
    recommend_venues,
    recommend_players,
    recommend_groups,
    compute_player_compatibility,
    compute_engagement_score,
    predict_churn_risk,
)
import logging

router = APIRouter()
logger = logging.getLogger("horizon")


# ═══════════════════════════════════════════════════════════════════════════════
# VENUE RECOMMENDATIONS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/recommendations/venues")
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


# ═══════════════════════════════════════════════════════════════════════════════
# PLAYER RECOMMENDATIONS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/recommendations/players")
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


# ═══════════════════════════════════════════════════════════════════════════════
# GROUP RECOMMENDATIONS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/recommendations/groups")
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


# ═══════════════════════════════════════════════════════════════════════════════
# PLAYER COMPATIBILITY
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/compatibility/{target_id}")
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


# ═══════════════════════════════════════════════════════════════════════════════
# ENGAGEMENT SCORE
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/engagement/score")
async def get_engagement_score(user=Depends(get_current_user)):
    """Get detailed engagement score breakdown for the current user."""
    try:
        result = await compute_engagement_score(user["id"])
        return result
    except Exception as e:
        logger.error(f"Engagement score error: {e}")
        return {"score": 0, "grade": "D", "level": "Bench", "breakdown": {}}


@router.get("/engagement/score/{user_id}")
async def get_user_engagement_score(user_id: str, user=Depends(get_current_user)):
    """Get engagement score for any user (public data)."""
    try:
        result = await compute_engagement_score(user_id)
        return result
    except Exception as e:
        logger.error(f"Engagement score error: {e}")
        return {"score": 0, "grade": "D", "level": "Bench", "breakdown": {}}


# ═══════════════════════════════════════════════════════════════════════════════
# CHURN PREDICTION (admin/self only)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/engagement/churn-risk")
async def get_churn_risk(user=Depends(get_current_user)):
    """Get churn risk prediction for the current user."""
    try:
        result = await predict_churn_risk(user["id"])
        return result
    except Exception as e:
        logger.error(f"Churn prediction error: {e}")
        return {"risk_score": 0, "risk_level": "low", "signals": {}}
