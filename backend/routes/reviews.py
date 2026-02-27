from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from database import db
from tz import now_ist
from auth import get_current_user
import uuid
import logging

router = APIRouter()
logger = logging.getLogger("horizon")


@router.get("/venues/{venue_id}/reviews")
async def get_reviews(venue_id: str, limit: int = 50):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "id": 1})
    if not venue:
        raise HTTPException(404, "Venue not found")
    reviews = await db.reviews.find(
        {"venue_id": venue_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    return reviews


@router.get("/venues/{venue_id}/reviews/summary")
async def get_review_summary(venue_id: str):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "id": 1})
    if not venue:
        raise HTTPException(404, "Venue not found")
    pipeline = [
        {"$match": {"venue_id": venue_id}},
        {"$group": {
            "_id": None,
            "avg_rating": {"$avg": "$rating"},
            "total": {"$sum": 1},
            "r5": {"$sum": {"$cond": [{"$eq": ["$rating", 5]}, 1, 0]}},
            "r4": {"$sum": {"$cond": [{"$eq": ["$rating", 4]}, 1, 0]}},
            "r3": {"$sum": {"$cond": [{"$eq": ["$rating", 3]}, 1, 0]}},
            "r2": {"$sum": {"$cond": [{"$eq": ["$rating", 2]}, 1, 0]}},
            "r1": {"$sum": {"$cond": [{"$eq": ["$rating", 1]}, 1, 0]}},
        }}
    ]
    result = await db.reviews.aggregate(pipeline).to_list(1)
    if not result:
        return {"avg_rating": 0, "total": 0, "distribution": {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}}
    r = result[0]
    return {
        "avg_rating": round(r["avg_rating"], 1),
        "total": r["total"],
        "distribution": {5: r["r5"], 4: r["r4"], 3: r["r3"], 2: r["r2"], 1: r["r1"]}
    }


@router.post("/venues/{venue_id}/reviews")
async def create_review(venue_id: str, request_data: dict, user=Depends(get_current_user)):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "id": 1})
    if not venue:
        raise HTTPException(404, "Venue not found")

    rating = request_data.get("rating")
    comment = request_data.get("comment", "").strip()
    booking_id = request_data.get("booking_id")

    if not rating or not isinstance(rating, int) or rating < 1 or rating > 5:
        raise HTTPException(400, "Rating must be 1-5")
    if not booking_id:
        raise HTTPException(400, "Booking ID is required")

    # Verify the user has a confirmed booking at this venue
    booking = await db.bookings.find_one({
        "id": booking_id, "venue_id": venue_id, "status": "confirmed",
        "$or": [{"host_id": user["id"]}, {"players": user["id"]}]
    }, {"_id": 0, "id": 1})
    if not booking:
        raise HTTPException(403, "You must have a confirmed booking at this venue to leave a review")

    # Perform NLP sentiment analysis on review text
    sentiment = {}
    if comment:
        try:
            from services.sentiment import analyze_sentiment
            sentiment = analyze_sentiment(comment)
        except Exception as e:
            logger.warning(f"Sentiment analysis failed: {e}")

    review_data = {
        "venue_id": venue_id,
        "booking_id": booking_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "rating": rating,
        "comment": comment,
        "sentiment": sentiment,
        "created_at": now_ist().isoformat()
    }
    # Atomic upsert to prevent duplicate reviews (race condition fix)
    result = await db.reviews.update_one(
        {"booking_id": booking_id, "user_id": user["id"]},
        {"$setOnInsert": {"id": str(uuid.uuid4()), **review_data}},
        upsert=True
    )
    if result.matched_count > 0:
        raise HTTPException(409, "You already reviewed this booking")
    review = await db.reviews.find_one(
        {"booking_id": booking_id, "user_id": user["id"]}, {"_id": 0}
    )

    # Update venue's average rating and total reviews
    pipeline = [
        {"$match": {"venue_id": venue_id}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
    ]
    agg = await db.reviews.aggregate(pipeline).to_list(1)
    if agg:
        await db.venues.update_one({"id": venue_id}, {"$set": {
            "rating": round(agg[0]["avg"], 1),
            "total_reviews": agg[0]["count"]
        }})

    return review


@router.get("/venues/{venue_id}/reviews/can-review")
async def can_review(venue_id: str, user=Depends(get_current_user)):
    """Returns list of confirmed bookings the user can review (not yet reviewed)."""
    bookings = await db.bookings.find({
        "venue_id": venue_id, "status": "confirmed",
        "$or": [{"host_id": user["id"]}, {"players": user["id"]}]
    }, {"_id": 0, "id": 1, "date": 1, "start_time": 1, "end_time": 1}).to_list(50)

    if not bookings:
        return {"can_review": False, "eligible_bookings": []}

    booking_ids = [b["id"] for b in bookings]
    reviewed = await db.reviews.find(
        {"booking_id": {"$in": booking_ids}, "user_id": user["id"]},
        {"_id": 0, "booking_id": 1}
    ).to_list(100)
    reviewed_ids = {r["booking_id"] for r in reviewed}

    eligible = [b for b in bookings if b["id"] not in reviewed_ids]
    return {"can_review": len(eligible) > 0, "eligible_bookings": eligible}


@router.get("/venues/{venue_id}/reviews/sentiment")
async def get_sentiment_summary(venue_id: str):
    """Get aggregated NLP sentiment analysis for a venue's reviews."""
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "id": 1})
    if not venue:
        raise HTTPException(404, "Venue not found")
    try:
        from services.sentiment import get_venue_sentiment_summary
        summary = await get_venue_sentiment_summary(venue_id)
        return summary
    except Exception as e:
        logger.warning(f"Sentiment summary failed: {e}")
        return {"total_analyzed": 0, "error": str(e)}
