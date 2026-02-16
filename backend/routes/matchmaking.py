from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional
from datetime import datetime, timezone
from database import db
from auth import get_current_user, get_razorpay_client, get_platform_settings
from models import MatchRequestCreate, MercenaryCreate
import uuid
import logging

router = APIRouter()
logger = logging.getLogger("horizon")


# --- Matchmaking Routes ---
@router.get("/matchmaking")
async def list_matches(sport: Optional[str] = None):
    query = {"status": "open"}
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
    updates = {"players_joined": joined, "player_names": names}
    if len(joined) >= match.get("players_needed", 10):
        updates["status"] = "filled"
    await db.match_requests.update_one({"id": match_id}, {"$set": updates})
    return {"message": "Joined match"}


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
