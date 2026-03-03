"""
Core Algorithms Engine — Horizon Sports Platform
═════════════════════════════════════════════════
Feed ranking, trending detection, player compatibility,
recommendation engine, engagement scoring, churn prediction.
"""
import math
import logging
import json
import asyncio
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from database import db, redis_client
from tz import now_ist

logger = logging.getLogger("horizon")


# ═══════════════════════════════════════════════════════════════════════════════
# 1. FEED RANKING — EdgeRank-inspired algorithm
#    Score = Affinity × ContentWeight × TimeDecay × QualityBoost
# ═══════════════════════════════════════════════════════════════════════════════

# Content type weights
CONTENT_WEIGHTS = {
    "match_result": 1.5,    # Match scores are high-value
    "highlight": 1.4,       # Video highlights engage
    "photo": 1.2,           # Photos above text
    "text": 1.0,            # Base
}

# Engagement signal weights for ranking
SIGNAL_WEIGHTS = {
    "like": 1.0,
    "comment": 2.0,         # Comments = deeper engagement
    "reaction": 1.5,        # Reactions show emotion
    "share": 3.0,           # Shares are highest signal
}

# Time decay half-life in hours
DECAY_HALF_LIFE = 12.0


async def rank_feed_posts(posts: list, viewer_id: str) -> list:
    """
    Rank posts using EdgeRank-inspired algorithm.
    Score = Affinity(viewer, author) × ContentWeight × TimeDecay × EngagementVelocity × QualityBoost
    """
    if not posts:
        return posts

    # Affinity map — Redis cache (15 min TTL), fallback to compute
    author_ids = [p["user_id"] for p in posts]
    affinity_cache = None
    if redis_client:
        try:
            cached = await redis_client.get(f"affinity:{viewer_id}")
            if cached:
                affinity_cache = json.loads(cached)
        except Exception as e:
            logger.warning(f"Redis affinity read failed: {e}")

    if affinity_cache is None:
        affinity_cache = await _compute_affinity_map(viewer_id, author_ids)
        if redis_client:
            try:
                await redis_client.setex(f"affinity:{viewer_id}", 900, json.dumps(affinity_cache))
            except Exception as e:
                logger.warning(f"Redis affinity write failed: {e}")

    now = now_ist()
    scored = []

    for post in posts:
        # 1. Affinity: How close is viewer to author?
        affinity = affinity_cache.get(post["user_id"], 0.1)

        # 2. Content weight
        content_w = CONTENT_WEIGHTS.get(post.get("post_type", "text"), 1.0)

        # 3. Time decay — exponential decay with half-life
        created = datetime.fromisoformat(post["created_at"].replace("Z", "+00:00")) if isinstance(post["created_at"], str) else post["created_at"]
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        hours_old = max((now - created).total_seconds() / 3600, 0.01)
        time_decay = math.pow(0.5, hours_old / DECAY_HALF_LIFE)

        # 4. Engagement velocity — engagement per hour since posting
        total_engagement = (
            (post.get("likes_count", 0) * SIGNAL_WEIGHTS["like"]) +
            (post.get("comments_count", 0) * SIGNAL_WEIGHTS["comment"]) +
            (sum((post.get("reactions", {}) or {}).values()) * SIGNAL_WEIGHTS["reaction"])
        )
        velocity = total_engagement / max(hours_old, 0.1)
        velocity_boost = 1.0 + math.log1p(velocity) * 0.5

        # 5. Quality boost — reward longer, meaningful content
        content_len = len(post.get("content", ""))
        quality = 1.0
        if content_len > 100:
            quality = 1.1
        if content_len > 300:
            quality = 1.2
        if post.get("media_url"):
            quality *= 1.15

        # 6. Diversity penalty — penalize if we've seen too many from same author
        # (applied later in dedup pass)

        score = affinity * content_w * time_decay * velocity_boost * quality
        scored.append((score, post))

    # Sort by score descending
    scored.sort(key=lambda x: x[0], reverse=True)

    # Diversity pass: no more than 3 consecutive posts from same author
    result = []
    author_consecutive = defaultdict(int)
    deferred = []

    for score, post in scored:
        uid = post["user_id"]
        if author_consecutive[uid] < 3:
            result.append(post)
            author_consecutive[uid] += 1
            # Reset other authors
            for k in author_consecutive:
                if k != uid:
                    author_consecutive[k] = 0
        else:
            deferred.append(post)

    # Append deferred at end
    result.extend(deferred)

    return result


async def _compute_affinity_map(viewer_id: str, author_ids: list) -> dict:
    """
    Compute affinity between viewer and each author.
    Based on: follow status, co-play history, interaction history.
    Range: 0.0 (stranger) to 1.0 (close friend).
    """
    unique_ids = list(set(author_ids))
    affinity = {}

    # 1. Follow status (0.3 boost)
    following = set()
    async for doc in db.follows.find(
        {"follower_id": viewer_id, "following_id": {"$in": unique_ids}},
        {"following_id": 1}
    ):
        following.add(doc["following_id"])

    # 2. Co-play frequency (up to 0.4 boost)
    coplay_counts = defaultdict(int)
    viewer_bookings = await db.bookings.find(
        {"$or": [{"host_id": viewer_id}, {"players": viewer_id}]},
        {"_id": 0, "host_id": 1, "players": 1}
    ).sort("created_at", -1).limit(50).to_list(50)

    for b in viewer_bookings:
        participants = set(b.get("players", []))
        if b.get("host_id"):
            participants.add(b["host_id"])
        participants.discard(viewer_id)
        for pid in participants:
            if pid in unique_ids:
                coplay_counts[pid] += 1

    # 3. Interaction history — likes/comments on their posts (up to 0.3 boost)
    interaction_counts = defaultdict(int)
    recent_likes = await db.social_likes.find(
        {"user_id": viewer_id}, {"_id": 0, "post_id": 1}
    ).sort("created_at", -1).limit(100).to_list(100)

    if recent_likes:
        liked_post_ids = [l["post_id"] for l in recent_likes]
        liked_posts = await db.social_posts.find(
            {"id": {"$in": liked_post_ids}}, {"_id": 0, "user_id": 1}
        ).to_list(100)
        for p in liked_posts:
            if p["user_id"] in unique_ids:
                interaction_counts[p["user_id"]] += 1

    # Compute final affinity
    for uid in unique_ids:
        score = 0.1  # Base affinity for any user

        if uid == viewer_id:
            score = 0.8  # Own posts get high affinity

        if uid in following:
            score += 0.3

        # Co-play: log scale, max 0.4
        coplays = coplay_counts.get(uid, 0)
        if coplays > 0:
            score += min(0.4, 0.15 * math.log1p(coplays))

        # Interactions: log scale, max 0.3
        interactions = interaction_counts.get(uid, 0)
        if interactions > 0:
            score += min(0.3, 0.1 * math.log1p(interactions))

        affinity[uid] = min(score, 1.0)

    return affinity


# ═══════════════════════════════════════════════════════════════════════════════
# 2. WILSON SCORE — Statistically robust trending detection
#    Better than raw counts: accounts for sample size confidence
# ═══════════════════════════════════════════════════════════════════════════════

def wilson_score(positive: int, total: int, z: float = 1.96) -> float:
    """
    Wilson score confidence interval lower bound.
    Used for ranking items by "best" with statistical confidence.
    z=1.96 → 95% confidence
    """
    if total == 0:
        return 0.0
    p = positive / total
    denominator = 1 + z * z / total
    centre = p + z * z / (2 * total)
    spread = z * math.sqrt((p * (1 - p) + z * z / (4 * total)) / total)
    return (centre - spread) / denominator


async def compute_trending_scores(hours: int = 48, limit: int = 20) -> list:
    """
    Compute trending posts using Wilson score + time boost.
    Considers: like ratio, engagement velocity, recency.
    """
    cutoff = (now_ist() - timedelta(hours=hours)).isoformat()
    posts = await db.social_posts.find(
        {"created_at": {"$gte": cutoff}, "visibility": "public"},
        {"_id": 0}
    ).to_list(500)

    now = now_ist()
    scored = []

    for post in posts:
        likes = post.get("likes_count", 0)
        comments = post.get("comments_count", 0)
        reactions = sum((post.get("reactions", {}) or {}).values())

        # Total engagement as "positive votes"
        total_engagement = likes + comments * 2 + reactions * 1.5

        # Impressions estimate: rough heuristic
        # (In production, track actual impressions)
        created = datetime.fromisoformat(post["created_at"].replace("Z", "+00:00")) if isinstance(post["created_at"], str) else post["created_at"]
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        hours_live = max((now - created).total_seconds() / 3600, 0.1)
        estimated_impressions = max(total_engagement * 3, hours_live * 5, 10)

        # Wilson score: engagement quality
        w_score = wilson_score(int(total_engagement), int(estimated_impressions))

        # Time boost: newer posts get a boost
        recency_boost = 1.0 / (1.0 + hours_live / 12.0)

        # Engagement velocity
        velocity = total_engagement / hours_live

        # Final trending score
        trending_score = (w_score * 0.4) + (velocity * 0.35) + (recency_boost * 0.25)

        post["_trending_score"] = trending_score
        post["_engagement_total"] = total_engagement
        post["_velocity"] = round(velocity, 2)
        scored.append(post)

    scored.sort(key=lambda x: x["_trending_score"], reverse=True)
    return scored[:limit]


# ═══════════════════════════════════════════════════════════════════════════════
# 3. PLAYER COMPATIBILITY — Cosine similarity on feature vectors
#    How well two players match for games
# ═══════════════════════════════════════════════════════════════════════════════

async def compute_player_compatibility(user_id_a: str, user_id_b: str) -> dict:
    """
    Compute compatibility score between two players.
    Features: skill rating, sports overlap, reliability, play times, location.
    Returns score 0-100 and breakdown.
    """
    user_a = await db.users.find_one({"id": user_id_a}, {"_id": 0, "password_hash": 0})
    user_b = await db.users.find_one({"id": user_id_b}, {"_id": 0, "password_hash": 0})
    if not user_a or not user_b:
        return {"score": 0, "breakdown": {}, "compatible": False}

    breakdown = {}

    # 1. Skill Rating Proximity (0-25 points)
    # Closer ratings = better match for competitive games
    rating_a = user_a.get("skill_rating", 1500)
    rating_b = user_b.get("skill_rating", 1500)
    rating_diff = abs(rating_a - rating_b)
    # 0 diff = 25pts, 500+ diff = 0pts
    skill_score = max(0, 25 * (1 - rating_diff / 500))
    breakdown["skill_proximity"] = {"score": round(skill_score, 1), "max": 25,
                                     "detail": f"Rating diff: {rating_diff}"}

    # 2. Sports Overlap (0-25 points)
    sports_a = set(user_a.get("sports", []))
    sports_b = set(user_b.get("sports", []))
    # Also check booking history for actual sports played
    bookings_a = await db.bookings.find(
        {"$or": [{"host_id": user_id_a}, {"players": user_id_a}]},
        {"sport": 1, "_id": 0}
    ).limit(50).to_list(50)
    bookings_b = await db.bookings.find(
        {"$or": [{"host_id": user_id_b}, {"players": user_id_b}]},
        {"sport": 1, "_id": 0}
    ).limit(50).to_list(50)
    played_a = set(b.get("sport", "") for b in bookings_a) | sports_a
    played_b = set(b.get("sport", "") for b in bookings_b) | sports_b
    played_a.discard("")
    played_b.discard("")

    if played_a and played_b:
        overlap = played_a & played_b
        union = played_a | played_b
        # Jaccard similarity
        jaccard = len(overlap) / len(union) if union else 0
        sport_score = 25 * jaccard
    else:
        sport_score = 5  # Unknown = some base compatibility
        overlap = set()

    breakdown["sports_overlap"] = {"score": round(sport_score, 1), "max": 25,
                                    "common_sports": list(overlap)}

    # 3. Reliability Match (0-20 points)
    # Both reliable = good; one unreliable = bad
    rel_a = user_a.get("reliability_score", 100)
    rel_b = user_b.get("reliability_score", 100)
    avg_reliability = (rel_a + rel_b) / 2
    rel_diff = abs(rel_a - rel_b)
    reliability_score = 20 * (avg_reliability / 100) * (1 - rel_diff / 100)
    breakdown["reliability"] = {"score": round(reliability_score, 1), "max": 20,
                                 "detail": f"Avg: {avg_reliability:.0f}%, diff: {rel_diff:.0f}%"}

    # 4. Play Time Overlap (0-15 points)
    # Check if they play at similar times
    recent_a = await db.bookings.find(
        {"$or": [{"host_id": user_id_a}, {"players": user_id_a}], "status": {"$in": ["confirmed", "completed"]}},
        {"start_time": 1, "_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    recent_b = await db.bookings.find(
        {"$or": [{"host_id": user_id_b}, {"players": user_id_b}], "status": {"$in": ["confirmed", "completed"]}},
        {"start_time": 1, "_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)

    times_a = [int(b.get("start_time", "12:00").split(":")[0]) for b in recent_a if b.get("start_time")]
    times_b = [int(b.get("start_time", "12:00").split(":")[0]) for b in recent_b if b.get("start_time")]

    if times_a and times_b:
        # Build hour distribution and compute overlap
        dist_a = defaultdict(int)
        dist_b = defaultdict(int)
        for h in times_a:
            dist_a[h] += 1
        for h in times_b:
            dist_b[h] += 1
        # Cosine similarity on time distributions
        all_hours = set(dist_a.keys()) | set(dist_b.keys())
        dot = sum(dist_a.get(h, 0) * dist_b.get(h, 0) for h in all_hours)
        mag_a = math.sqrt(sum(v * v for v in dist_a.values()))
        mag_b = math.sqrt(sum(v * v for v in dist_b.values()))
        cosine = dot / (mag_a * mag_b) if mag_a > 0 and mag_b > 0 else 0
        time_score = 15 * cosine
    else:
        time_score = 7.5  # Unknown = neutral

    breakdown["play_times"] = {"score": round(time_score, 1), "max": 15}

    # 5. Co-play History (0-15 points)
    # Have they played together before? More = better
    coplay_count = await db.bookings.count_documents({
        "players": {"$all": [user_id_a, user_id_b]},
        "status": {"$in": ["confirmed", "completed"]}
    })
    # Also check host+player combos
    coplay_count += await db.bookings.count_documents({
        "$or": [
            {"host_id": user_id_a, "players": user_id_b},
            {"host_id": user_id_b, "players": user_id_a}
        ],
        "status": {"$in": ["confirmed", "completed"]}
    })
    # Log scale: 0 games=0, 1=7, 5=12, 10+=15
    coplay_score = min(15, 7 * math.log1p(coplay_count))
    breakdown["coplay_history"] = {"score": round(coplay_score, 1), "max": 15,
                                    "games_together": coplay_count}

    total = skill_score + sport_score + reliability_score + time_score + coplay_score
    total = round(min(total, 100), 1)

    return {
        "score": total,
        "grade": _score_to_grade(total),
        "compatible": total >= 50,
        "breakdown": breakdown,
    }


def _score_to_grade(score: float) -> str:
    if score >= 85:
        return "S"
    if score >= 70:
        return "A"
    if score >= 55:
        return "B"
    if score >= 40:
        return "C"
    return "D"


# ═══════════════════════════════════════════════════════════════════════════════
# 4. RECOMMENDATION ENGINE — Collaborative + Content-based hybrid
# ═══════════════════════════════════════════════════════════════════════════════

async def recommend_venues(user_id: str, limit: int = 10) -> list:
    """
    Recommend venues using collaborative filtering + content signals.
    1. Find users with similar booking patterns (collaborative)
    2. Weight by sport preference match (content-based)
    3. Boost by rating and proximity
    """
    # Redis cache (5 min TTL) — these aggregations are expensive
    cache_key = f"rec:venues:{user_id}"
    if redis_client:
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                return json.loads(cached)[:limit]
        except Exception:
            pass

    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        return []

    # User's booking history
    user_bookings = await db.bookings.find(
        {"$or": [{"host_id": user_id}, {"players": user_id}],
         "status": {"$in": ["confirmed", "completed"]}},
        {"_id": 0, "venue_id": 1, "sport": 1}
    ).to_list(200)

    user_venues = set(b["venue_id"] for b in user_bookings)
    user_sports = defaultdict(int)
    for b in user_bookings:
        user_sports[b.get("sport", "other")] += 1

    # Find similar users: people who booked the same venues
    similar_pipeline = [
        {"$match": {"venue_id": {"$in": list(user_venues)},
                     "$or": [{"host_id": {"$ne": user_id}}, {"players": {"$ne": user_id}}]}},
        {"$group": {"_id": {"$ifNull": ["$host_id", "unknown"]}, "shared_venues": {"$addToSet": "$venue_id"}}},
        {"$project": {"_id": 1, "overlap": {"$size": "$shared_venues"}}},
        {"$sort": {"overlap": -1}},
        {"$limit": 30}
    ]
    similar_users = []
    async for doc in db.bookings.aggregate(similar_pipeline):
        if doc["_id"] != user_id and doc["_id"] != "unknown":
            similar_users.append(doc["_id"])

    # Get venues these similar users booked (but current user hasn't)
    if similar_users:
        collab_pipeline = [
            {"$match": {"$or": [{"host_id": {"$in": similar_users}}, {"players": {"$elemMatch": {"$in": similar_users}}}],
                         "venue_id": {"$nin": list(user_venues)}}},
            {"$group": {"_id": "$venue_id", "booking_count": {"$sum": 1}}},
            {"$sort": {"booking_count": -1}},
            {"$limit": 30}
        ]
        collab_venue_ids = []
        async for doc in db.bookings.aggregate(collab_pipeline):
            collab_venue_ids.append(doc["_id"])
    else:
        collab_venue_ids = []

    # Fallback: popular venues the user hasn't tried
    popular_pipeline = [
        {"$match": {"venue_id": {"$nin": list(user_venues)}}},
        {"$group": {"_id": "$venue_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20}
    ]
    popular_ids = []
    async for doc in db.bookings.aggregate(popular_pipeline):
        popular_ids.append(doc["_id"])

    # Combine: collab first, then popular
    candidate_ids = list(dict.fromkeys(collab_venue_ids + popular_ids))[:30]

    if not candidate_ids:
        # No data — return top rated venues
        venues = await db.venues.find(
            {"status": {"$ne": "suspended"}}, {"_id": 0}
        ).sort("average_rating", -1).limit(limit).to_list(limit)
        for v in venues:
            v["rec_reason"] = "top_rated"
            v["rec_score"] = v.get("average_rating", 0) * 20
        return venues

    venues = await db.venues.find(
        {"id": {"$in": candidate_ids}, "status": {"$ne": "suspended"}}, {"_id": 0}
    ).to_list(30)

    # Score each venue
    top_sport = max(user_sports, key=user_sports.get) if user_sports else ""
    scored = []
    for v in venues:
        score = 0
        reason = "popular"

        # Collaborative score (was it recommended by similar users?)
        if v["id"] in collab_venue_ids:
            collab_rank = collab_venue_ids.index(v["id"])
            score += max(0, 40 - collab_rank * 2)  # Up to 40 points
            reason = "players_like_you"

        # Sport match
        venue_sports = set(v.get("sports", []))
        if top_sport and top_sport in venue_sports:
            score += 25
            reason = "matches_sport"

        sport_overlap = set(user_sports.keys()) & venue_sports
        score += len(sport_overlap) * 5

        # Rating boost
        avg_rating = v.get("average_rating", 0)
        score += avg_rating * 5  # Up to 25 points

        # Review count (social proof)
        review_count = v.get("review_count", 0)
        score += min(10, math.log1p(review_count) * 3)

        v["rec_score"] = round(score, 1)
        v["rec_reason"] = reason
        scored.append(v)

    scored.sort(key=lambda x: x["rec_score"], reverse=True)
    result = scored[:limit]
    if redis_client:
        try:
            await redis_client.setex(cache_key, 300, json.dumps(result))
        except Exception:
            pass
    return result


async def recommend_players(user_id: str, limit: int = 15) -> list:
    """
    Recommend players to follow/connect with.
    Signals: co-play history, sport overlap, skill proximity, mutual follows.
    """
    cache_key = f"rec:players:{user_id}"
    if redis_client:
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                return json.loads(cached)[:limit]
        except Exception:
            pass

    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        return []

    # Already following
    following_ids = set()
    async for doc in db.follows.find({"follower_id": user_id}, {"following_id": 1}):
        following_ids.add(doc["following_id"])

    # 1. Co-players (strongest signal)
    coplay_pipeline = [
        {"$match": {"$or": [{"host_id": user_id}, {"players": user_id}]}},
        {"$project": {"all_players": {"$concatArrays": [
            {"$ifNull": ["$players", []]},
            [{"$ifNull": ["$host_id", ""]}]
        ]}}},
        {"$unwind": "$all_players"},
        {"$match": {"all_players": {"$ne": user_id, "$ne": ""}}},
        {"$group": {"_id": "$all_players", "games": {"$sum": 1}}},
        {"$sort": {"games": -1}},
        {"$limit": 50}
    ]
    coplayers = {}
    async for doc in db.bookings.aggregate(coplay_pipeline):
        if doc["_id"] not in following_ids:
            coplayers[doc["_id"]] = doc["games"]

    # 2. Mutual follows (friend-of-friend)
    mutual_pipeline = [
        {"$match": {"follower_id": {"$in": list(following_ids)}}},
        {"$group": {"_id": "$following_id", "mutual_count": {"$sum": 1}}},
        {"$match": {"_id": {"$nin": list(following_ids) + [user_id]}}},
        {"$sort": {"mutual_count": -1}},
        {"$limit": 30}
    ]
    mutuals = {}
    async for doc in db.follows.aggregate(mutual_pipeline):
        mutuals[doc["_id"]] = doc["mutual_count"]

    # 3. Skill-similar active players
    user_rating = user.get("skill_rating", 1500)
    similar_players = await db.users.find(
        {"id": {"$nin": list(following_ids) + [user_id]},
         "skill_rating": {"$gte": user_rating - 200, "$lte": user_rating + 200}},
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "skill_rating": 1, "role": 1}
    ).limit(20).to_list(20)

    # Score all candidates
    all_candidates = set(coplayers.keys()) | set(mutuals.keys()) | set(p["id"] for p in similar_players)
    all_candidates.discard(user_id)

    candidate_users = await db.users.find(
        {"id": {"$in": list(all_candidates)}},
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "skill_rating": 1, "role": 1,
         "reliability_score": 1, "sports": 1}
    ).to_list(100)

    user_sports = set(user.get("sports", []))
    scored = []
    for c in candidate_users:
        score = 0
        reason = "suggested"

        # Co-play score (strongest)
        games = coplayers.get(c["id"], 0)
        if games > 0:
            score += min(40, 15 * math.log1p(games))
            reason = "played_together"

        # Mutual follows
        mutual_count = mutuals.get(c["id"], 0)
        if mutual_count > 0:
            score += min(25, 10 * math.log1p(mutual_count))
            if reason == "suggested":
                reason = "mutual_friends"

        # Skill proximity
        c_rating = c.get("skill_rating", 1500)
        rating_diff = abs(user_rating - c_rating)
        score += max(0, 15 * (1 - rating_diff / 500))

        # Sport overlap
        c_sports = set(c.get("sports", []))
        overlap = user_sports & c_sports
        score += len(overlap) * 5

        # Reliability bonus
        if c.get("reliability_score", 100) >= 90:
            score += 5

        c["rec_score"] = round(score, 1)
        c["rec_reason"] = reason
        c["mutual_count"] = mutual_count
        c["games_together"] = games
        scored.append(c)

    scored.sort(key=lambda x: x["rec_score"], reverse=True)
    result = scored[:limit]
    if redis_client:
        try:
            await redis_client.setex(cache_key, 300, json.dumps(result))
        except Exception:
            pass
    return result


async def recommend_groups(user_id: str, limit: int = 10) -> list:
    """
    Recommend groups based on sport interests, friend memberships, and activity.
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return []

    user_sports = set(user.get("sports", []))

    # Already member of
    my_groups = await db.groups.find(
        {"members": user_id}, {"_id": 0, "id": 1}
    ).to_list(100)
    my_group_ids = set(g["id"] for g in my_groups)

    # Following
    following_ids = []
    async for doc in db.follows.find({"follower_id": user_id}, {"following_id": 1}):
        following_ids.append(doc["following_id"])

    # Groups that friends are in
    friend_groups = []
    if following_ids:
        friend_groups = await db.groups.find(
            {"members": {"$in": following_ids}, "id": {"$nin": list(my_group_ids)}},
            {"_id": 0}
        ).limit(20).to_list(20)

    # Groups matching user's sports
    sport_groups = await db.groups.find(
        {"sport": {"$in": list(user_sports)}, "id": {"$nin": list(my_group_ids)}},
        {"_id": 0}
    ).sort("member_count", -1).limit(20).to_list(20)

    # Popular groups
    popular_groups = await db.groups.find(
        {"id": {"$nin": list(my_group_ids)}}, {"_id": 0}
    ).sort("member_count", -1).limit(15).to_list(15)

    # Deduplicate and score
    seen = set()
    scored = []
    for g in friend_groups + sport_groups + popular_groups:
        if g["id"] in seen:
            continue
        seen.add(g["id"])

        score = 0
        reason = "popular"

        # Friends in group
        friend_members = set(g.get("members", [])) & set(following_ids)
        if friend_members:
            score += min(30, len(friend_members) * 10)
            reason = "friends_are_in"

        # Sport match
        if g.get("sport") in user_sports:
            score += 25
            if reason == "popular":
                reason = "matches_sport"

        # Activity (member count as proxy)
        score += min(20, math.log1p(g.get("member_count", 0)) * 5)

        # Recent activity
        if g.get("last_message_at"):
            last_msg = datetime.fromisoformat(g["last_message_at"].replace("Z", "+00:00"))
            hours_since = (now_ist() - last_msg).total_seconds() / 3600
            if hours_since < 24:
                score += 15
            elif hours_since < 168:
                score += 8

        g["rec_score"] = round(score, 1)
        g["rec_reason"] = reason
        g["friends_count"] = len(friend_members) if following_ids else 0
        scored.append(g)

    scored.sort(key=lambda x: x["rec_score"], reverse=True)
    return scored[:limit]


# ═══════════════════════════════════════════════════════════════════════════════
# 5. ENGAGEMENT SCORE — Composite user engagement metric
# ═══════════════════════════════════════════════════════════════════════════════

async def compute_engagement_score(user_id: str) -> dict:
    """
    Compute a 0-100 engagement score for a user.
    Factors: posting frequency, interaction rate, streak, response rate, diversity.
    """
    now = now_ist()
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()

    # Parallel fetch — all counts at once
    (
        posts_week, posts_month, comments_week, likes_week,
        reactions_week, stories_week, streak, bookings_month
    ) = await asyncio.gather(
        db.social_posts.count_documents({"user_id": user_id, "created_at": {"$gte": week_ago}}),
        db.social_posts.count_documents({"user_id": user_id, "created_at": {"$gte": month_ago}}),
        db.social_comments.count_documents({"user_id": user_id, "created_at": {"$gte": week_ago}}),
        db.social_likes.count_documents({"user_id": user_id, "created_at": {"$gte": week_ago}}),
        db.social_reactions.count_documents({"user_id": user_id, "created_at": {"$gte": week_ago}}),
        db.stories.count_documents({"user_id": user_id, "created_at": {"$gte": week_ago}}),
        db.streaks.find_one({"user_id": user_id}, {"_id": 0}),
        db.bookings.count_documents(
            {"$or": [{"host_id": user_id}, {"players": user_id}],
             "created_at": {"$gte": month_ago}}
        ),
    )
    current_streak = streak.get("current_streak", 0) if streak else 0

    # Scoring
    scores = {}

    # Posting frequency (0-20)
    # 1 post/day = 7/week is "ideal"
    scores["posting"] = min(20, posts_week * 3)

    # Interaction rate (0-20)
    interactions = comments_week + likes_week + reactions_week
    scores["interactions"] = min(20, interactions * 2)

    # Streak bonus (0-15)
    scores["streak"] = min(15, current_streak * 2)

    # Stories (0-10)
    scores["stories"] = min(10, stories_week * 3)

    # Platform usage — bookings (0-15)
    scores["platform_use"] = min(15, bookings_month * 3)

    # Parallel: consistency + community counts
    async def _empty():
        return []
    post_dates_coro = db.social_posts.find(
        {"user_id": user_id, "created_at": {"$gte": month_ago}},
        {"_id": 0, "created_at": 1}
    ).to_list(200) if posts_month > 0 else _empty()
    post_dates, groups_count, teams_count = await asyncio.gather(
        post_dates_coro,
        db.groups.count_documents({"members": user_id}),
        db.teams.count_documents({"players.id": user_id}),
    )

    # Consistency — posting across multiple days (0-10)
    if posts_month > 0 and post_dates:
        unique_days = len(set(p["created_at"][:10] for p in post_dates))
        scores["consistency"] = min(10, unique_days)
    else:
        scores["consistency"] = 0

    # Community (0-10)
    scores["community"] = min(10, (groups_count + teams_count) * 2)

    total = sum(scores.values())
    total = round(min(total, 100), 1)

    return {
        "score": total,
        "grade": _score_to_grade(total),
        "breakdown": scores,
        "level": _score_to_level(total),
        "posts_this_week": posts_week,
        "interactions_this_week": interactions,
        "current_streak": current_streak,
    }


def _score_to_level(score: float) -> str:
    if score >= 80:
        return "Legend"
    if score >= 60:
        return "All-Star"
    if score >= 40:
        return "Pro"
    if score >= 20:
        return "Rookie"
    return "Bench"


# ═══════════════════════════════════════════════════════════════════════════════
# 6. CHURN PREDICTION — Identify users at risk of leaving
# ═══════════════════════════════════════════════════════════════════════════════

async def predict_churn_risk(user_id: str) -> dict:
    """
    Predict churn risk based on declining activity patterns.
    Returns risk level (low/medium/high/critical) and signals.
    """
    now = now_ist()
    week_ago = (now - timedelta(days=7)).isoformat()
    two_weeks_ago = (now - timedelta(days=14)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()

    signals = {}

    # Parallel fetch: user, activity counts, streak — all at once
    (
        churn_user, posts_this_week, posts_last_week,
        bookings_this_week, bookings_last_week, streak
    ) = await asyncio.gather(
        db.users.find_one({"id": user_id}, {"_id": 0, "last_login": 1, "created_at": 1}),
        db.social_posts.count_documents({"user_id": user_id, "created_at": {"$gte": week_ago}}),
        db.social_posts.count_documents({"user_id": user_id, "created_at": {"$gte": two_weeks_ago, "$lt": week_ago}}),
        db.bookings.count_documents(
            {"$or": [{"host_id": user_id}, {"players": user_id}], "created_at": {"$gte": week_ago}}),
        db.bookings.count_documents(
            {"$or": [{"host_id": user_id}, {"players": user_id}], "created_at": {"$gte": two_weeks_ago, "$lt": week_ago}}),
        db.streaks.find_one({"user_id": user_id}, {"_id": 0}),
    )

    # 1. Login recency
    user = churn_user
    last_login = user.get("last_login", user.get("created_at", "")) if user else ""
    if last_login:
        try:
            last_dt = datetime.fromisoformat(last_login.replace("Z", "+00:00"))
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            days_since_login = (now - last_dt).days
        except (ValueError, AttributeError):
            days_since_login = 0
    else:
        days_since_login = 0
    signals["days_since_login"] = days_since_login

    # 2. Activity decline
    signals["posts_this_week"] = posts_this_week
    signals["posts_last_week"] = posts_last_week
    signals["bookings_this_week"] = bookings_this_week
    signals["bookings_last_week"] = bookings_last_week

    # 3. Streak broken?
    streak_broken = False
    if streak:
        last_post = streak.get("last_post_date", "")
        if last_post:
            try:
                last_post_date = datetime.strptime(last_post, "%Y-%m-%d").date()
                days_since_post = (now.date() - last_post_date).days
                streak_broken = days_since_post > 2
            except ValueError:
                pass
    signals["streak_broken"] = streak_broken

    # 4. Social isolation: no interactions received
    user_posts = await db.social_posts.find(
        {"user_id": user_id, "created_at": {"$gte": month_ago}}, {"_id": 0, "id": 1}
    ).to_list(200)
    user_post_ids = [p["id"] for p in user_posts]
    interactions_received = 0
    if user_post_ids:
        interactions_received = await db.social_likes.count_documents(
            {"post_id": {"$in": user_post_ids}}
        )
    signals["interactions_received_month"] = interactions_received

    # Compute risk score (0-100, higher = more at risk)
    risk = 0

    # Login recency
    if days_since_login > 14:
        risk += 30
    elif days_since_login > 7:
        risk += 20
    elif days_since_login > 3:
        risk += 10

    # Activity decline
    if posts_last_week > 0 and posts_this_week == 0:
        risk += 20
    elif posts_last_week > posts_this_week * 2:
        risk += 10

    if bookings_last_week > 0 and bookings_this_week == 0:
        risk += 15
    elif bookings_last_week > bookings_this_week * 2:
        risk += 8

    # Streak
    if streak_broken:
        risk += 10

    # Social isolation
    if interactions_received == 0 and posts_this_week + posts_last_week > 0:
        risk += 15  # Posting but no engagement = frustration risk

    # No activity at all in last month
    total_month, total_bookings_month = await asyncio.gather(
        db.social_posts.count_documents(
            {"user_id": user_id, "created_at": {"$gte": month_ago}}),
        db.bookings.count_documents(
            {"$or": [{"host_id": user_id}, {"players": user_id}],
             "created_at": {"$gte": month_ago}}),
    )
    if total_month == 0 and total_bookings_month == 0:
        risk += 25

    risk = min(risk, 100)

    if risk >= 70:
        level = "critical"
    elif risk >= 45:
        level = "high"
    elif risk >= 25:
        level = "medium"
    else:
        level = "low"

    return {
        "risk_score": risk,
        "risk_level": level,
        "signals": signals,
    }
