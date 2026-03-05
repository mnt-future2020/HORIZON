"""
Social Feed + Player Cards + Stories + Reactions + Follow + Streaks + Trending
Full Instagram-level sports social platform.
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from typing import Optional, List
from pydantic import BaseModel as PydanticBaseModel
from datetime import datetime, timezone, timedelta
from database import db, client, redis_client, db_retry
from auth import get_current_user
from tz import now_ist
from models import SocialPostCreate
import uuid
import math
import logging
import time
import json
import asyncio
import re as _re
from services.algorithms import rank_feed_posts, compute_trending_scores

# In-memory trending fallback (single-worker only; Redis is primary cache)
_trending_cache: dict = {"posts": [], "expires": 0.0}

router = APIRouter()
logger = logging.getLogger("horizon")

REACTION_TYPES = ["fire", "trophy", "clap", "heart", "100", "muscle"]


async def _rate_limit(user_id: str, action: str, max_per_min: int):
    """Reusable Redis rate limiter. Raises 429 if exceeded. Silent if Redis is down."""
    if not redis_client:
        return
    try:
        rl_key = f"rl:{action}:{user_id}"
        count = await redis_client.incr(rl_key)
        if count == 1:
            await redis_client.expire(rl_key, 60)
        if count > max_per_min:
            raise HTTPException(429, "Too many requests. Slow down!")
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Redis rate limit unavailable: {e}")
STORY_EXPIRY_HOURS = 24
POST_PROMPTS = [
    "How was your game today?",
    "Share your best moment from today's match!",
    "Any new personal record?",
    "Who's looking for a game this weekend?",
    "Rate your performance today (1-10)",
    "What's your training plan this week?",
    "Shoutout to your MVP today!",
    "Post your match score!",
    "Which venue are you playing at today?",
    "What sport are you picking up next?",
]


# ═══════════════════════════════════════════════════════════════════════════════
# STORIES (24hr ephemeral posts — Instagram-style)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/stories")
async def create_story(request: Request, user=Depends(get_current_user)):
    data = await request.json()
    content = data.get("content", "")
    media_url = data.get("media_url", "")
    bg_color = data.get("bg_color", "")
    sport_tag = data.get("sport_tag", "")

    if not content and not media_url:
        raise HTTPException(400, "Story must have text or media")
    if len(content) > 2000:
        raise HTTPException(400, "Story text must be under 2000 characters")

    story = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user.get("name", "Unknown"),
        "user_avatar": user.get("avatar", ""),
        "content": content,
        "media_url": media_url,
        "bg_color": bg_color,
        "sport_tag": sport_tag,
        "view_count": 0,
        "reactions": {},
        "expires_at": (now_ist() + timedelta(hours=STORY_EXPIRY_HOURS)).isoformat(),
        "created_at": now_ist().isoformat(),
    }
    await db.stories.insert_one(story)
    story.pop("_id", None)

    # Update posting streak
    await _update_streak(user["id"])

    return story


@router.get("/stories")
@db_retry
async def get_stories(user=Depends(get_current_user)):
    """Get active stories from people user follows + own stories."""
    now = now_ist().isoformat()

    # Get people the user follows
    following_ids = await _get_following_ids(user["id"])
    # Include own stories
    target_ids = list(set(following_ids + [user["id"]]))

    stories = await db.stories.find(
        {"user_id": {"$in": target_ids}, "expires_at": {"$gt": now}},
        {"_id": 0}, max_time_ms=10000
    ).sort("created_at", -1).to_list(200)

    # Batch check which stories the current user has viewed
    story_ids = [s["id"] for s in stories]
    viewed_docs = await db.story_views.find(
        {"story_id": {"$in": story_ids}, "viewer_id": user["id"]},
        {"_id": 0, "story_id": 1}
    ).to_list(len(story_ids))
    viewed_set = {d["story_id"] for d in viewed_docs}

    # Group by user
    user_stories = {}
    for s in stories:
        uid = s["user_id"]
        s.pop("views", None)
        s["viewed_by_me"] = s["id"] in viewed_set
        if uid not in user_stories:
            user_stories[uid] = {
                "user_id": uid,
                "user_name": s["user_name"],
                "user_avatar": s["user_avatar"],
                "has_unviewed": False,
                "stories": []
            }
        if not s["viewed_by_me"]:
            user_stories[uid]["has_unviewed"] = True
        user_stories[uid]["stories"].append(s)

    # Sort: own stories first, then unviewed first, then viewed
    result = sorted(user_stories.values(), key=lambda x: (
        x["user_id"] != user["id"],
        not x["has_unviewed"],
    ))
    return result


@router.post("/stories/{story_id}/view")
async def view_story(story_id: str, user=Depends(get_current_user)):
    result = await db.story_views.update_one(
        {"story_id": story_id, "viewer_id": user["id"]},
        {"$setOnInsert": {"story_id": story_id, "viewer_id": user["id"], "viewed_at": now_ist().isoformat()}},
        upsert=True,
    )
    if result.upserted_id:
        await db.stories.update_one({"id": story_id}, {"$inc": {"view_count": 1}})
    return {"viewed": True}


@router.post("/stories/{story_id}/react")
async def react_to_story(story_id: str, request: Request, user=Depends(get_current_user)):
    data = await request.json()
    reaction = data.get("reaction", "fire")
    if reaction not in REACTION_TYPES:
        raise HTTPException(400, f"Invalid reaction. Must be one of: {REACTION_TYPES}")
    await db.stories.update_one(
        {"id": story_id},
        {"$inc": {f"reactions.{reaction}": 1}}
    )
    return {"reacted": True, "reaction": reaction}


@router.delete("/stories/{story_id}")
async def delete_story(story_id: str, user=Depends(get_current_user)):
    story = await db.stories.find_one({"id": story_id})
    if not story:
        raise HTTPException(404, "Story not found")
    if story["user_id"] != user["id"]:
        raise HTTPException(403, "Not your story")
    await db.stories.delete_one({"id": story_id})
    return {"message": "Story deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# SOCIAL FEED (enhanced with reactions, follows, engagement)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/feed")
@db_retry
async def get_feed(
    before: Optional[str] = Query(None),  # cursor: ISO timestamp (following) or int offset (for_you)
    limit: int = Query(20, ge=1, le=50),
    tab: str = Query("for_you"),
    user=Depends(get_current_user)
):
    if tab == "following":
        following_ids = await _get_following_ids(user["id"])
        query = {"user_id": {"$in": following_ids + [user["id"]]}}
        # Timestamp cursor works perfectly for chronological feed
        if before:
            query["created_at"] = {"$lt": before}
        posts = await db.social_posts.find(query, {"_id": 0}, max_time_ms=10000).sort(
            "created_at", -1
        ).limit(limit).to_list(limit)
        next_cursor = posts[-1]["created_at"] if posts else None
    else:
        # "for_you" — rank once, cache in Redis, paginate from cached order
        offset = int(before) if before and before.isdigit() else 0
        cache_key = f"feed:foryou:{user['id']}"
        ranked_ids = None

        # Try to read cached ranked post IDs
        if redis_client and offset > 0:
            try:
                cached = await redis_client.get(cache_key)
                if cached:
                    ranked_ids = json.loads(cached)
            except Exception:
                pass

        if ranked_ids is None:
            # Fresh rank: fetch recent posts, rank, cache the ID order
            query = {"$or": [{"visibility": "public"}, {"user_id": user["id"]}]}
            raw_posts = await db.social_posts.find(query, {"_id": 0}, max_time_ms=10000).sort(
                "created_at", -1
            ).limit(200).to_list(200)
            try:
                ranked = await rank_feed_posts(raw_posts, user["id"])
            except Exception as e:
                logger.warning(f"Feed ranking fallback to chronological: {e}")
                ranked = raw_posts
            ranked_ids = [p["id"] for p in ranked]
            # Cache for 5 min so pagination is stable
            if redis_client:
                try:
                    await redis_client.setex(cache_key, 300, json.dumps(ranked_ids))
                except Exception:
                    pass
            # We already have the post objects — slice and return
            posts = ranked[offset:offset + limit]
            next_cursor = str(offset + limit) if offset + limit < len(ranked) else None
        else:
            # Paginate from cached ID list — fetch only the page we need
            page_ids = ranked_ids[offset:offset + limit]
            if page_ids:
                id_docs = await db.social_posts.find(
                    {"id": {"$in": page_ids}}, {"_id": 0}, max_time_ms=10000
                ).to_list(len(page_ids))
                id_map = {p["id"]: p for p in id_docs}
                posts = [id_map[pid] for pid in page_ids if pid in id_map]
            else:
                posts = []
            next_cursor = str(offset + limit) if offset + limit < len(ranked_ids) else None

    # Batch queries — 4 queries total instead of 4×N
    post_ids = [p["id"] for p in posts]
    author_ids = list(set(p["user_id"] for p in posts))

    liked_set = {d["post_id"] for d in await db.social_likes.find(
        {"post_id": {"$in": post_ids}, "user_id": user["id"]}, {"_id": 0, "post_id": 1}
    ).to_list(len(post_ids))}

    bookmarked_set = {d["post_id"] for d in await db.bookmarks.find(
        {"post_id": {"$in": post_ids}, "user_id": user["id"]}, {"_id": 0, "post_id": 1}
    ).to_list(len(post_ids))}

    following_set = {d["following_id"] for d in await db.follows.find(
        {"follower_id": user["id"], "following_id": {"$in": author_ids}}, {"_id": 0, "following_id": 1}
    ).to_list(len(author_ids))}

    reaction_map = {d["post_id"]: d["reaction"] for d in await db.social_reactions.find(
        {"post_id": {"$in": post_ids}, "user_id": user["id"]}, {"_id": 0, "post_id": 1, "reaction": 1}
    ).to_list(len(post_ids))}

    for post in posts:
        post["liked_by_me"] = post["id"] in liked_set
        post["bookmarked_by_me"] = post["id"] in bookmarked_set
        post["is_following"] = post["user_id"] in following_set
        post["my_reaction"] = reaction_map.get(post["id"])

    return {"posts": posts, "next_cursor": next_cursor, "has_more": next_cursor is not None}


@router.post("/feed")
@db_retry
async def create_post(inp: SocialPostCreate, user=Depends(get_current_user)):
    await _rate_limit(user["id"], "post", 10)
    if len(inp.content) > 5000:
        raise HTTPException(400, "Post content must be under 5000 characters")
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
        "visibility": "public",
        "likes_count": 0,
        "comments_count": 0,
        "reactions": {},
        "created_at": now_ist().isoformat(),
    }
    await db.social_posts.insert_one(post)
    post.pop("_id", None)

    # Update posting streak
    await _update_streak(user["id"])

    return post


@router.post("/feed/{post_id}/like")
@db_retry
async def toggle_like(post_id: str, user=Depends(get_current_user)):
    await _rate_limit(user["id"], "like", 30)
    try:
        # Transaction: both ops succeed or both fail (requires replica set / Atlas M10+)
        async with await client.start_session() as session:
            async with session.start_transaction():
                removed = await db.social_likes.find_one_and_delete(
                    {"post_id": post_id, "user_id": user["id"]}, session=session
                )
                if removed:
                    await db.social_posts.update_one(
                        {"id": post_id}, {"$inc": {"likes_count": -1}}, session=session
                    )
                    return {"liked": False}
                try:
                    await db.social_likes.insert_one({
                        "post_id": post_id, "user_id": user["id"],
                        "created_at": now_ist().isoformat()
                    }, session=session)
                    await db.social_posts.update_one(
                        {"id": post_id}, {"$inc": {"likes_count": 1}}, session=session
                    )
                    return {"liked": True}
                except Exception:
                    return {"liked": True}
    except Exception:
        # Fallback: non-transactional (free tier / standalone MongoDB)
        removed = await db.social_likes.find_one_and_delete(
            {"post_id": post_id, "user_id": user["id"]}
        )
        if removed:
            await db.social_posts.update_one({"id": post_id}, {"$inc": {"likes_count": -1}})
            return {"liked": False}
        try:
            await db.social_likes.insert_one({
                "post_id": post_id, "user_id": user["id"],
                "created_at": now_ist().isoformat()
            })
            await db.social_posts.update_one({"id": post_id}, {"$inc": {"likes_count": 1}})
            return {"liked": True}
        except Exception:
            return {"liked": True}


@router.post("/feed/{post_id}/react")
async def react_to_post(post_id: str, request: Request, user=Depends(get_current_user)):
    """Add/change reaction on a post (fire, trophy, clap, heart, 100, muscle)."""
    data = await request.json()
    reaction = data.get("reaction", "fire")
    if reaction not in REACTION_TYPES:
        raise HTTPException(400, f"Invalid reaction. Must be one of: {REACTION_TYPES}")

    try:
        async with await client.start_session() as session:
            async with session.start_transaction():
                # Step 1: Toggle off?
                removed = await db.social_reactions.find_one_and_delete(
                    {"post_id": post_id, "user_id": user["id"], "reaction": reaction}, session=session
                )
                if removed:
                    await db.social_posts.update_one(
                        {"id": post_id}, {"$inc": {f"reactions.{reaction}": -1}}, session=session
                    )
                    return {"reacted": False, "reaction": None}
                # Step 2: Change existing?
                old = await db.social_reactions.find_one_and_update(
                    {"post_id": post_id, "user_id": user["id"]},
                    {"$set": {"reaction": reaction}}, session=session
                )
                if old:
                    old_reaction = old["reaction"]
                    await db.social_posts.update_one(
                        {"id": post_id},
                        {"$inc": {f"reactions.{old_reaction}": -1, f"reactions.{reaction}": 1}}, session=session
                    )
                    return {"reacted": True, "reaction": reaction}
                # Step 3: New reaction
                try:
                    await db.social_reactions.insert_one({
                        "post_id": post_id, "user_id": user["id"],
                        "reaction": reaction, "created_at": now_ist().isoformat()
                    }, session=session)
                    await db.social_posts.update_one(
                        {"id": post_id}, {"$inc": {f"reactions.{reaction}": 1}}, session=session
                    )
                    return {"reacted": True, "reaction": reaction}
                except Exception:
                    return {"reacted": True, "reaction": reaction}
    except Exception:
        # Fallback: non-transactional (free tier / standalone MongoDB)
        removed = await db.social_reactions.find_one_and_delete(
            {"post_id": post_id, "user_id": user["id"], "reaction": reaction}
        )
        if removed:
            await db.social_posts.update_one(
                {"id": post_id}, {"$inc": {f"reactions.{reaction}": -1}}
            )
            return {"reacted": False, "reaction": None}
        old = await db.social_reactions.find_one_and_update(
            {"post_id": post_id, "user_id": user["id"]},
            {"$set": {"reaction": reaction}},
        )
        if old:
            old_reaction = old["reaction"]
            await db.social_posts.update_one(
                {"id": post_id},
                {"$inc": {f"reactions.{old_reaction}": -1, f"reactions.{reaction}": 1}}
            )
            return {"reacted": True, "reaction": reaction}
        try:
            await db.social_reactions.insert_one({
                "post_id": post_id, "user_id": user["id"],
                "reaction": reaction, "created_at": now_ist().isoformat()
            })
            await db.social_posts.update_one(
                {"id": post_id}, {"$inc": {f"reactions.{reaction}": 1}}
            )
            return {"reacted": True, "reaction": reaction}
        except Exception:
            return {"reacted": True, "reaction": reaction}


@router.post("/feed/{post_id}/comment")
async def add_comment(post_id: str, request: Request, user=Depends(get_current_user)):
    await _rate_limit(user["id"], "comment", 20)
    data = await request.json()
    content = data.get("content", "").strip()
    if not content or len(content) > 2000:
        raise HTTPException(400, "Comment must be 1-2000 characters")
    comment = {
        "id": str(uuid.uuid4()),
        "post_id": post_id,
        "user_id": user["id"],
        "user_name": user.get("name", "Unknown"),
        "user_avatar": user.get("avatar", ""),
        "content": content,
        "created_at": now_ist().isoformat(),
    }
    try:
        async with await client.start_session() as session:
            async with session.start_transaction():
                await db.social_comments.insert_one(comment, session=session)
                await db.social_posts.update_one(
                    {"id": post_id}, {"$inc": {"comments_count": 1}}, session=session
                )
    except Exception:
        # Fallback: non-transactional (free tier / standalone MongoDB)
        await db.social_comments.insert_one(comment)
        await db.social_posts.update_one({"id": post_id}, {"$inc": {"comments_count": 1}})
    comment.pop("_id", None)
    return comment


@router.get("/feed/{post_id}/comments")
@db_retry
async def get_comments(
    post_id: str,
    user=Depends(get_current_user),
    after: str = None,
    limit: int = Query(30, ge=1, le=50),
):
    query = {"post_id": post_id}
    if after:
        query["created_at"] = {"$gt": after}
    comments = await db.social_comments.find(
        query, {"_id": 0}
    ).sort("created_at", 1).limit(limit).to_list(limit)
    next_cursor = comments[-1]["created_at"] if len(comments) == limit else None
    return {"comments": comments, "next_cursor": next_cursor, "has_more": next_cursor is not None}


@router.delete("/feed/{post_id}")
async def delete_post(post_id: str, user=Depends(get_current_user)):
    post = await db.social_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(404, "Post not found")
    if post["user_id"] != user["id"]:
        raise HTTPException(403, "Not your post")
    await asyncio.gather(
        db.social_posts.delete_one({"id": post_id}),
        db.social_comments.delete_many({"post_id": post_id}),
        db.social_likes.delete_many({"post_id": post_id}),
        db.social_reactions.delete_many({"post_id": post_id}),
        db.bookmarks.delete_many({"post_id": post_id}),
    )
    return {"message": "Post deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# TRENDING POSTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/feed/trending")
async def trending_posts(
    limit: int = Query(10, ge=1, le=30),
    user=Depends(get_current_user)
):
    """Trending posts using Wilson score confidence interval + velocity + recency."""
    await _rate_limit(user["id"], "trending", 20)
    global _trending_cache
    posts = None

    # Primary: Redis cache (shared across all workers/pods)
    if redis_client:
        try:
            cached = await redis_client.get("trending:posts")
            if cached:
                posts = json.loads(cached)
        except Exception as e:
            logger.warning(f"Redis trending read failed: {e}")

    # Fallback: in-memory cache (single-worker dev / Redis unavailable)
    if posts is None:
        now_ts = time.time()
        if _trending_cache["expires"] > now_ts and len(_trending_cache["posts"]) >= limit:
            posts = _trending_cache["posts"]

    # Cache miss — compute fresh
    if posts is None:
        try:
            posts = await compute_trending_scores(hours=48, limit=30)
        except Exception as e:
            logger.warning(f"Wilson trending fallback to simple sort: {e}")
            cutoff = (now_ist() - timedelta(hours=48)).isoformat()
            posts = await db.social_posts.find(
                {"created_at": {"$gte": cutoff}, "visibility": "public"},
                {"_id": 0}, max_time_ms=10000
            ).sort("likes_count", -1).limit(30).to_list(30)
        for p in posts:
            p.pop("_trending_score", None)
            p.pop("_engagement_total", None)
            p.pop("_velocity", None)
        # Store in Redis (primary) or in-memory (fallback)
        if redis_client:
            try:
                await redis_client.setex("trending:posts", 300, json.dumps(posts))
            except Exception as e:
                logger.warning(f"Redis trending write failed: {e}")
        _trending_cache = {"posts": posts, "expires": time.time() + 300}

    posts = posts[:limit]

    if posts:
        t_ids = [p["id"] for p in posts]
        t_liked = {d["post_id"] for d in await db.social_likes.find(
            {"post_id": {"$in": t_ids}, "user_id": user["id"]}, {"_id": 0, "post_id": 1}
        ).to_list(len(t_ids))}
        t_rxn_docs = await db.social_reactions.find(
            {"post_id": {"$in": t_ids}, "user_id": user["id"]}, {"_id": 0, "post_id": 1, "reaction": 1}
        ).to_list(len(t_ids))
        t_rxn_map = {d["post_id"]: d["reaction"] for d in t_rxn_docs}
        for post in posts:
            post["liked_by_me"] = post["id"] in t_liked
            post["my_reaction"] = t_rxn_map.get(post["id"])

    return posts


# ═══════════════════════════════════════════════════════════════════════════════
# FOLLOW SYSTEM
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/follow/{target_id}")
@db_retry
async def toggle_follow(target_id: str, user=Depends(get_current_user)):
    await _rate_limit(user["id"], "follow", 30)
    if target_id == user["id"]:
        raise HTTPException(400, "Cannot follow yourself")

    target = await db.users.find_one({"id": target_id})
    if not target:
        raise HTTPException(404, "User not found")

    # Atomic: try delete first — if doc existed, it was an unfollow
    removed = await db.follows.find_one_and_delete(
        {"follower_id": user["id"], "following_id": target_id}
    )
    if removed:
        await db.users.update_one({"id": user["id"]}, {"$inc": {"following_count": -1}})
        await db.users.update_one({"id": target_id}, {"$inc": {"followers_count": -1}})
        return {"following": False}
    # Not found → insert (unique index prevents duplicates if double-tapped)
    try:
        await db.follows.insert_one({
            "follower_id": user["id"],
            "following_id": target_id,
            "created_at": now_ist().isoformat()
        })
        await db.users.update_one({"id": user["id"]}, {"$inc": {"following_count": 1}})
        await db.users.update_one({"id": target_id}, {"$inc": {"followers_count": 1}})
        return {"following": True}
    except Exception:
        # Duplicate key — already followed by a concurrent request
        return {"following": True}


@router.get("/follow/status/{target_id}")
async def follow_status(target_id: str, user=Depends(get_current_user)):
    is_following = await db.follows.find_one(
        {"follower_id": user["id"], "following_id": target_id}
    ) is not None
    is_followed_by = await db.follows.find_one(
        {"follower_id": target_id, "following_id": user["id"]}
    ) is not None
    return {"is_following": is_following, "is_followed_by": is_followed_by}


@router.get("/followers/{user_id}")
async def get_followers(
    user_id: str, user=Depends(get_current_user),
    after: str = None, limit: int = Query(50, ge=1, le=100),
):
    query = {"following_id": user_id}
    if after:
        query["created_at"] = {"$lt": after}
    follows = await db.follows.find(
        query, {"_id": 0, "follower_id": 1, "created_at": 1}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    ids = [f["follower_id"] for f in follows]
    users = await db.users.find(
        {"id": {"$in": ids}},
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "skill_rating": 1, "role": 1}
    ).to_list(limit)
    next_cursor = follows[-1]["created_at"] if len(follows) == limit else None
    return {"users": users, "next_cursor": next_cursor, "has_more": next_cursor is not None}


@router.get("/following/{user_id}")
async def get_following(
    user_id: str, user=Depends(get_current_user),
    after: str = None, limit: int = Query(50, ge=1, le=100),
):
    query = {"follower_id": user_id}
    if after:
        query["created_at"] = {"$lt": after}
    follows = await db.follows.find(
        query, {"_id": 0, "following_id": 1, "created_at": 1}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    ids = [f["following_id"] for f in follows]
    users = await db.users.find(
        {"id": {"$in": ids}},
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "skill_rating": 1, "role": 1}
    ).to_list(limit)
    next_cursor = follows[-1]["created_at"] if len(follows) == limit else None
    return {"users": users, "next_cursor": next_cursor, "has_more": next_cursor is not None}


# ═══════════════════════════════════════════════════════════════════════════════
# ACTIVITY STREAKS & ENGAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/engagement/me")
@db_retry
async def my_engagement(user=Depends(get_current_user)):
    """Get current user's engagement stats: streak, post count, prompts."""
    streak = await db.streaks.find_one({"user_id": user["id"]}, {"_id": 0})
    if not streak:
        streak = {"current_streak": 0, "longest_streak": 0, "last_post_date": None}

    # Total posts
    total_posts = await db.social_posts.count_documents({"user_id": user["id"]})

    # Posts today
    today_start = now_ist().replace(hour=0, minute=0, second=0).isoformat()
    posts_today = await db.social_posts.count_documents(
        {"user_id": user["id"], "created_at": {"$gte": today_start}}
    )

    # Stories today
    stories_today = await db.stories.count_documents(
        {"user_id": user["id"], "created_at": {"$gte": today_start}}
    )

    # Followers/following count
    followers_count = await db.follows.count_documents({"following_id": user["id"]})
    following_count = await db.follows.count_documents({"follower_id": user["id"]})

    # Daily prompt (deterministic per day)
    day_of_year = now_ist().timetuple().tm_yday
    prompt_idx = day_of_year % len(POST_PROMPTS)

    posted_today = posts_today > 0 or stories_today > 0

    return {
        "current_streak": streak.get("current_streak", 0),
        "longest_streak": streak.get("longest_streak", 0),
        "last_post_date": streak.get("last_post_date"),
        "total_posts": total_posts,
        "posts_today": posts_today,
        "stories_today": stories_today,
        "posted_today": posted_today,
        "followers_count": followers_count,
        "following_count": following_count,
        "daily_prompt": POST_PROMPTS[prompt_idx],
    }


@router.get("/engagement/suggested-follows")
async def suggested_follows(user=Depends(get_current_user)):
    """Suggest users to follow based on recent co-players and active posters."""
    # Users the person played with recently
    recent_bookings = await db.bookings.find(
        {"$or": [{"host_id": user["id"]}, {"players": user["id"]}],
         "status": {"$in": ["confirmed", "completed"]}},
        {"_id": 0, "host_id": 1, "players": 1}
    ).sort("created_at", -1).limit(20).to_list(20)

    co_player_ids = set()
    for b in recent_bookings:
        if b.get("host_id") and b["host_id"] != user["id"]:
            co_player_ids.add(b["host_id"])
        for p in b.get("players", []):
            if p != user["id"]:
                co_player_ids.add(p)

    # Remove already-followed
    following_ids = set(await _get_following_ids(user["id"]))
    co_player_ids -= following_ids
    co_player_ids.discard(user["id"])

    # Top active posters not yet followed (fallback)
    week_ago = (now_ist() - timedelta(days=7)).isoformat()
    active_pipeline = [
        {"$match": {"created_at": {"$gte": week_ago}, "user_id": {"$nin": list(following_ids) + [user["id"]]}}},
        {"$group": {"_id": "$user_id", "post_count": {"$sum": 1}}},
        {"$sort": {"post_count": -1}},
        {"$limit": 10}
    ]
    active_posters = []
    async for doc in db.social_posts.aggregate(active_pipeline):
        active_posters.append(doc["_id"])

    suggest_ids = list(co_player_ids)[:10] + [p for p in active_posters if p not in co_player_ids][:5]
    suggest_ids = suggest_ids[:15]

    users = await db.users.find(
        {"id": {"$in": suggest_ids}},
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "skill_rating": 1, "role": 1}
    ).to_list(15)

    # Mark co-players
    for u in users:
        u["reason"] = "played_together" if u["id"] in co_player_ids else "active_poster"

    return users


# ═══════════════════════════════════════════════════════════════════════════════
# PLAYER CARDS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/player-card/me")
async def get_my_card(user=Depends(get_current_user)):
    return await _build_player_card(user["id"], viewer_id=user["id"])


@router.get("/player-card/{user_id}")
async def get_player_card(user_id: str, user=Depends(get_current_user)):
    await _rate_limit(user["id"], "player_card", 60)
    return await _build_player_card(user_id, viewer_id=user["id"])


@db_retry
async def _build_player_card(user_id: str, viewer_id: str = None):
    # Redis cache check (viewer-agnostic data only)
    cache_key = f"player_card:{user_id}"
    card = None
    if redis_client:
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                card = json.loads(cached)
        except Exception as e:
            logger.warning(f"Redis player_card read failed: {e}")

    if card is None:
        # Parallel fetch — all 9 queries at once
        (
            user, bookings_count, reviews, sport_bookings,
            streak, followers_count, following_count, post_count, perf_records
        ) = await asyncio.gather(
            db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0}),
            db.bookings.count_documents(
                {"$or": [{"host_id": user_id}, {"players": user_id}],
                 "status": {"$in": ["confirmed", "completed"]}}
            ),
            db.reviews.find({"user_id": user_id}, {"_id": 0, "rating": 1}, max_time_ms=10000).to_list(100),
            db.bookings.find(
                {"$or": [{"host_id": user_id}, {"players": user_id}]},
                {"sport": 1, "_id": 0}, max_time_ms=10000
            ).to_list(500),
            db.streaks.find_one({"user_id": user_id}, {"_id": 0}),
            db.follows.count_documents({"following_id": user_id}),
            db.follows.count_documents({"follower_id": user_id}),
            db.social_posts.count_documents({"user_id": user_id}),
            db.performance_records.find(
                {"player_id": user_id}, {"_id": 0, "record_type": 1, "tournament_id": 1, "stats": 1}, max_time_ms=10000
            ).to_list(500),
        )

        if not user:
            raise HTTPException(404, "Player not found")

        avg_rating = sum(r.get("rating", 0) for r in reviews) / max(len(reviews), 1) if reviews else 0

        sport_freq = {}
        for b in sport_bookings:
            s = b.get("sport", "other")
            sport_freq[s] = sport_freq.get(s, 0) + 1
        primary_sport = max(sport_freq, key=sport_freq.get) if sport_freq else "none"

        badges = []
        if user.get("is_verified"):
            badges.append({"name": "Verified", "icon": "badge-check", "description": "Verified by Horizon"})
        if bookings_count >= 100:
            badges.append({"name": "Century", "icon": "trophy", "description": "100+ games played"})
        elif bookings_count >= 50:
            badges.append({"name": "Veteran", "icon": "star", "description": "50+ games played"})
        elif bookings_count >= 10:
            badges.append({"name": "Regular", "icon": "zap", "description": "10+ games played"})

        rating = user.get("skill_rating", 1500)
        if rating >= 2000:
            badges.append({"name": "Elite", "icon": "crown", "description": "2000+ skill rating"})
        elif rating >= 1700:
            badges.append({"name": "Pro", "icon": "award", "description": "1700+ skill rating"})

        if user.get("reliability_score", 100) >= 95:
            badges.append({"name": "Reliable", "icon": "shield", "description": "95%+ reliability"})
        if user.get("wins", 0) >= 50:
            badges.append({"name": "Champion", "icon": "medal", "description": "50+ wins"})

        if streak and streak.get("current_streak", 0) >= 7:
            badges.append({"name": "On Fire", "icon": "flame", "description": f"{streak['current_streak']}-day posting streak"})

        sr = user.get("skill_rating", 1500)
        skill_score = max(0, min(100, (sr - 1000) / 15))
        total_g = user.get("total_games", 0) or bookings_count
        wins_count = user.get("wins", 0)
        losses_count = user.get("losses", 0)
        draws_count = user.get("draws", 0)
        played = wins_count + losses_count + draws_count
        win_rate_score = (wins_count / played * 100) if played > 0 else 0

        t_ids = set()
        t_wins = 0
        train_mins = 0
        for pr in perf_records:
            if pr.get("record_type") == "tournament_result":
                tid = pr.get("tournament_id")
                if tid:
                    t_ids.add(tid)
                if pr.get("stats", {}).get("result") == "win":
                    t_wins += 1
            if pr.get("record_type") == "training":
                train_mins += pr.get("stats", {}).get("duration_minutes", 0)
        tournaments_played = len(t_ids)
        training_hours = round(train_mins / 60, 1)

        tournament_score = min(100, tournaments_played * 8 + t_wins * 12)
        training_score = min(100, training_hours * 4)
        reliability = user.get("reliability_score", 100)
        experience_score = min(100, total_g * 2)

        overall_score = round(
            skill_score * 0.40 + win_rate_score * 0.20 +
            tournament_score * 0.15 + training_score * 0.10 +
            reliability * 0.10 + experience_score * 0.05
        )
        overall_score = max(0, min(100, overall_score))

        if overall_score >= 86:
            overall_tier = "Elite"
        elif overall_score >= 71:
            overall_tier = "Pro"
        elif overall_score >= 51:
            overall_tier = "Advanced"
        elif overall_score >= 31:
            overall_tier = "Intermediate"
        else:
            overall_tier = "Beginner"

        card = {
            "user_id": user_id,
            "name": user.get("name", "Unknown"),
            "avatar": user.get("avatar", ""),
            "role": user.get("role", "player"),
            "is_verified": user.get("is_verified", False),
            "skill_rating": sr,
            "reliability_score": reliability,
            "wins": wins_count,
            "losses": losses_count,
            "draws": draws_count,
            "total_games": bookings_count,
            "avg_review_rating": round(avg_rating, 1),
            "primary_sport": primary_sport,
            "sports_played": sport_freq,
            "member_since": user.get("created_at", ""),
            "badges": badges,
            "followers_count": followers_count,
            "following_count": following_count,
            "post_count": post_count,
            "current_streak": streak.get("current_streak", 0) if streak else 0,
            "overall_score": overall_score,
            "overall_tier": overall_tier,
            "score_breakdown": {
                "skill": round(skill_score),
                "win_rate": round(win_rate_score),
                "tournament": round(tournament_score),
                "training": round(training_score),
                "reliability": round(reliability),
                "experience": round(experience_score),
            },
        }

        # Store in Redis (without is_following — viewer specific)
        if redis_client:
            try:
                await redis_client.setex(cache_key, 300, json.dumps(card))
            except Exception as e:
                logger.warning(f"Redis player_card write failed: {e}")

    # is_following — always fresh, viewer specific
    card["is_following"] = False
    if viewer_id and viewer_id != user_id:
        try:
            card["is_following"] = await db.follows.find_one(
                {"follower_id": viewer_id, "following_id": user_id}
            ) is not None
        except Exception:
            pass

    return card


# ═══════════════════════════════════════════════════════════════════════════════
# BOOKMARKS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/feed/{post_id}/bookmark")
async def toggle_bookmark(post_id: str, user=Depends(get_current_user)):
    # Atomic: try delete first — if found, was an unbookmark
    removed = await db.bookmarks.find_one_and_delete(
        {"user_id": user["id"], "post_id": post_id}
    )
    if removed:
        return {"bookmarked": False}
    try:
        await db.bookmarks.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "post_id": post_id,
            "created_at": now_ist().isoformat(),
        })
        return {"bookmarked": True}
    except Exception:
        return {"bookmarked": True}


@router.get("/feed/bookmarks")
async def get_bookmarks(user=Depends(get_current_user), before: str = None, limit: int = Query(20, ge=1, le=50)):
    query = {"user_id": user["id"]}
    if before:
        query["created_at"] = {"$lt": before}
    bookmarks = await db.bookmarks.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    post_ids = [b["post_id"] for b in bookmarks]
    if not post_ids:
        return {"posts": [], "total": 0}
    posts = await db.social_posts.find(
        {"id": {"$in": post_ids}}, {"_id": 0}
    ).to_list(limit)
    # Batch enrich with author info and like status
    bm_author_ids = list({p["user_id"] for p in posts})
    bm_authors = {u["id"]: u for u in await db.users.find(
        {"id": {"$in": bm_author_ids}}, {"_id": 0, "id": 1, "name": 1, "avatar": 1}
    ).to_list(len(bm_author_ids))}
    bm_liked_set = {d["post_id"] for d in await db.social_likes.find(
        {"post_id": {"$in": post_ids}, "user_id": user["id"]}, {"_id": 0, "post_id": 1}
    ).to_list(len(post_ids))}
    for p in posts:
        au = bm_authors.get(p["user_id"], {})
        p["user_name"] = au.get("name", "Unknown")
        p["user_avatar"] = au.get("avatar", "")
        p["bookmarked_by_me"] = True
        p["liked_by_me"] = p["id"] in bm_liked_set
    next_cursor = bookmarks[-1]["created_at"] if len(bookmarks) == limit else None
    return {"posts": posts, "next_cursor": next_cursor, "has_more": next_cursor is not None}


# ═══════════════════════════════════════════════════════════════════════════════
# USER POSTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/feed/user/{user_id}")
async def get_user_posts(
    user_id: str, user=Depends(get_current_user),
    before: str = None, limit: int = Query(20, ge=1, le=50),
):
    # Visibility: own posts always visible, others' only public
    if user_id == user["id"]:
        query = {"user_id": user_id}
    else:
        query = {"user_id": user_id, "visibility": "public"}
    if before:
        query["created_at"] = {"$lt": before}
    posts = await db.social_posts.find(
        query, {"_id": 0}, max_time_ms=10000
    ).sort("created_at", -1).limit(limit).to_list(limit)
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "avatar": 1})
    u_name = u.get("name", "Unknown") if u else "Unknown"
    u_avatar = u.get("avatar", "") if u else ""
    up_ids = [p["id"] for p in posts]
    up_liked, up_bm = set(), set()
    if up_ids:
        up_liked = {d["post_id"] for d in await db.social_likes.find(
            {"post_id": {"$in": up_ids}, "user_id": user["id"]}, {"_id": 0, "post_id": 1}
        ).to_list(len(up_ids))}
        up_bm = {d["post_id"] for d in await db.bookmarks.find(
            {"post_id": {"$in": up_ids}, "user_id": user["id"]}, {"_id": 0, "post_id": 1}
        ).to_list(len(up_ids))}
    for p in posts:
        p["user_name"] = u_name
        p["user_avatar"] = u_avatar
        p["liked_by_me"] = p["id"] in up_liked
        p["bookmarked_by_me"] = p["id"] in up_bm
    next_cursor = posts[-1]["created_at"] if len(posts) == limit else None
    return {"posts": posts, "next_cursor": next_cursor, "has_more": next_cursor is not None}


# Single post by ID — MUST be after all /feed/xxx static routes to avoid conflicts
@router.get("/feed/{post_id}")
async def get_single_post(post_id: str, user=Depends(get_current_user)):
    post = await db.social_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Post not found")
    like = await db.social_likes.find_one({"post_id": post_id, "user_id": user["id"]})
    post["liked_by_me"] = like is not None
    bm = await db.bookmarks.find_one({"post_id": post_id, "user_id": user["id"]})
    post["bookmarked_by_me"] = bm is not None
    # Fetch user's reaction
    reaction = await db.social_reactions.find_one({"post_id": post_id, "user_id": user["id"]})
    post["my_reaction"] = reaction["reaction"] if reaction else None
    # Fetch user info
    u = await db.users.find_one({"id": post.get("user_id")}, {"_id": 0, "name": 1, "avatar": 1})
    if u:
        post["user_name"] = u.get("name", "Unknown")
        post["user_avatar"] = u.get("avatar", "")
    return post


# ═══════════════════════════════════════════════════════════════════════════════
# EXPLORE / SEARCH
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/explore")
@db_retry
async def explore(user=Depends(get_current_user), q: str = "", category: str = "all", page: int = 1, limit: int = 20):
    await _rate_limit(user["id"], "explore", 20)
    skip = (page - 1) * limit
    results = {"users": [], "posts": [], "venues": []}

    if q:
        # Parallel search: users, posts, venues at once
        user_query = {"$text": {"$search": q}, "id": {"$ne": user["id"]}}
        post_query = {"$text": {"$search": q}}
        venue_query = {"$text": {"$search": q}}
        users, posts, venues = await asyncio.gather(
            db.users.find(user_query, {"_id": 0, "password_hash": 0}).limit(10).to_list(10),
            db.social_posts.find(post_query, {"_id": 0}, max_time_ms=10000).sort("created_at", -1).skip(skip).limit(limit).to_list(limit),
            db.venues.find(venue_query, {"_id": 0}, max_time_ms=10000).limit(10).to_list(10),
        )
        # Enrich users with follow/post/follower stats
        if users:
            ex_user_ids = [u["id"] for u in users]
            ex_following_docs, ex_post_agg, ex_follower_agg = await asyncio.gather(
                db.follows.find(
                    {"follower_id": user["id"], "following_id": {"$in": ex_user_ids}}, {"_id": 0, "following_id": 1}
                ).to_list(10),
                db.social_posts.aggregate([
                    {"$match": {"user_id": {"$in": ex_user_ids}}},
                    {"$group": {"_id": "$user_id", "count": {"$sum": 1}}}
                ]).to_list(10),
                db.follows.aggregate([
                    {"$match": {"following_id": {"$in": ex_user_ids}}},
                    {"$group": {"_id": "$following_id", "count": {"$sum": 1}}}
                ]).to_list(10),
            )
            ex_following = {d["following_id"] for d in ex_following_docs}
            ex_post_counts = {d["_id"]: d["count"] for d in ex_post_agg}
            ex_follower_counts = {d["_id"]: d["count"] for d in ex_follower_agg}
            for u in users:
                u["is_following"] = u["id"] in ex_following
                u["post_count"] = ex_post_counts.get(u["id"], 0)
                u["followers_count"] = ex_follower_counts.get(u["id"], 0)
        results["users"] = users
        # Enrich posts with author info and like status
        if posts:
            ex_post_ids = [p["id"] for p in posts]
            ex_author_ids = list({p["user_id"] for p in posts})
            ex_author_docs, ex_liked_docs = await asyncio.gather(
                db.users.find(
                    {"id": {"$in": ex_author_ids}}, {"_id": 0, "id": 1, "name": 1, "avatar": 1}
                ).to_list(len(ex_author_ids)),
                db.social_likes.find(
                    {"post_id": {"$in": ex_post_ids}, "user_id": user["id"]}, {"_id": 0, "post_id": 1}
                ).to_list(len(ex_post_ids)),
            )
            ex_authors = {u["id"]: u for u in ex_author_docs}
            ex_liked = {d["post_id"] for d in ex_liked_docs}
            for p in posts:
                pu = ex_authors.get(p["user_id"], {})
                p["user_name"] = pu.get("name", "Unknown")
                p["user_avatar"] = pu.get("avatar", "")
                p["liked_by_me"] = p["id"] in ex_liked
        results["posts"] = posts
        results["venues"] = venues
    else:
        # No query — show trending/popular content
        # Popular users: cached in Redis to avoid full-collection aggregation
        pop_user_ids = None
        follower_count_map = {}
        if redis_client:
            try:
                cached = await redis_client.get("explore:popular")
                if cached:
                    _data = json.loads(cached)
                    pop_user_ids = _data["ids"]
                    follower_count_map = _data["counts"]
            except Exception:
                pass
        if pop_user_ids is None:
            follower_agg = await db.follows.aggregate([
                {"$group": {"_id": "$following_id", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 10},
            ]).to_list(10)
            pop_user_ids = [d["_id"] for d in follower_agg]
            follower_count_map = {d["_id"]: d["count"] for d in follower_agg}
            if redis_client:
                try:
                    await redis_client.setex("explore:popular", 600,
                        json.dumps({"ids": pop_user_ids, "counts": follower_count_map}))
                except Exception:
                    pass
        if pop_user_ids:
            pop_users = await db.users.find(
                {"id": {"$in": pop_user_ids}, "id": {"$ne": user["id"]}},
                {"_id": 0, "password_hash": 0}
            ).to_list(10)
            pop_post_counts = {d["_id"]: d["count"] for d in await db.social_posts.aggregate([
                {"$match": {"user_id": {"$in": pop_user_ids}}},
                {"$group": {"_id": "$user_id", "count": {"$sum": 1}}}
            ]).to_list(10)}
            pop_following = {d["following_id"] for d in await db.follows.find(
                {"follower_id": user["id"], "following_id": {"$in": pop_user_ids}}, {"_id": 0, "following_id": 1}
            ).to_list(10)}
            for u in pop_users:
                u["followers_count"] = follower_count_map.get(u["id"], 0)
                u["post_count"] = pop_post_counts.get(u["id"], 0)
                u["is_following"] = u["id"] in pop_following
            results["users"] = pop_users

        # Recent popular posts — batch author lookup and like status
        posts = await db.social_posts.find({}, {"_id": 0}).sort("likes_count", -1).skip(skip).limit(limit).to_list(limit)
        if posts:
            pop_post_ids = [p["id"] for p in posts]
            pop_author_ids = list({p["user_id"] for p in posts})
            pop_authors = {u["id"]: u for u in await db.users.find(
                {"id": {"$in": pop_author_ids}}, {"_id": 0, "id": 1, "name": 1, "avatar": 1}
            ).to_list(len(pop_author_ids))}
            pop_liked = {d["post_id"] for d in await db.social_likes.find(
                {"post_id": {"$in": pop_post_ids}, "user_id": user["id"]}, {"_id": 0, "post_id": 1}
            ).to_list(len(pop_post_ids))}
            for p in posts:
                pu = pop_authors.get(p["user_id"], {})
                p["user_name"] = pu.get("name", "Unknown")
                p["user_avatar"] = pu.get("avatar", "")
                p["liked_by_me"] = p["id"] in pop_liked
        results["posts"] = posts

    return results


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

async def _get_following_ids(user_id: str) -> list:
    follows = await db.follows.find(
        {"follower_id": user_id}, {"_id": 0, "following_id": 1}
    ).to_list(500)
    return [f["following_id"] for f in follows]


async def _update_streak(user_id: str):
    """Update posting streak when user creates a post or story. Atomic via conditional update."""
    today = now_ist().strftime("%Y-%m-%d")
    yesterday = (now_ist() - timedelta(days=1)).strftime("%Y-%m-%d")

    # Atomic: try to upsert. If last_post_date is already today → no-op.
    # Case 1: Continue streak (last_post_date == yesterday)
    result = await db.streaks.update_one(
        {"user_id": user_id, "last_post_date": yesterday},
        [{"$set": {
            "current_streak": {"$add": ["$current_streak", 1]},
            "longest_streak": {"$max": ["$longest_streak", {"$add": ["$current_streak", 1]}]},
            "last_post_date": today,
        }}],
    )
    if result.modified_count > 0:
        return

    # Case 2: Already posted today → skip
    exists_today = await db.streaks.find_one({"user_id": user_id, "last_post_date": today})
    if exists_today:
        return

    # Case 3: Streak broken or first post — reset to 1
    await db.streaks.update_one(
        {"user_id": user_id},
        {"$set": {"current_streak": 1, "last_post_date": today},
         "$max": {"longest_streak": 1}},
        upsert=True,
    )
