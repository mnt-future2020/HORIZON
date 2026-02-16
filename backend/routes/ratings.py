from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from database import db
from auth import get_current_user
import hashlib
import logging

router = APIRouter()
logger = logging.getLogger("horizon")

GENESIS_HASH = "GENESIS_0000000000000000000000000000000000000000000000000000000000000000"


def compute_record_hash(record: dict, prev_hash: str) -> str:
    """Compute SHA-256 hash of a rating history record for tamper detection."""
    payload = (
        f"{record['user_id']}|{record['match_id']}|"
        f"{record['previous_rating']}|{record['new_rating']}|{record['delta']}|"
        f"{record['previous_rd']}|{record['new_rd']}|"
        f"{record['result']}|{record['team']}|"
        f"{record['timestamp']}|{prev_hash}"
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


async def create_rating_record(
    user_id: str, match_id: str,
    prev_rating: int, new_rating: int,
    prev_rd: int, new_rd: int,
    prev_vol: float, new_vol: float,
    result: str, team: str,
    opponent_snapshot: list,
    confirmations: list,
    match_sport: str, match_date: str,
    timestamp: str
):
    """Create a tamper-proof rating history record with chain hash."""
    # Get the last record for this user to chain
    last_record = await db.rating_history.find_one(
        {"user_id": user_id},
        {"_id": 0, "record_hash": 1},
        sort=[("seq", -1)]
    )
    prev_hash = last_record["record_hash"] if last_record else GENESIS_HASH

    # Get sequence number
    count = await db.rating_history.count_documents({"user_id": user_id})

    record = {
        "user_id": user_id,
        "match_id": match_id,
        "seq": count + 1,
        "previous_rating": prev_rating,
        "new_rating": new_rating,
        "delta": new_rating - prev_rating,
        "previous_rd": prev_rd,
        "new_rd": new_rd,
        "previous_volatility": round(prev_vol, 6),
        "new_volatility": round(new_vol, 6),
        "result": result,
        "team": team,
        "sport": match_sport,
        "match_date": match_date,
        "opponent_snapshot": opponent_snapshot,
        "confirmations": confirmations,
        "timestamp": timestamp,
        "prev_hash": prev_hash,
    }

    record["record_hash"] = compute_record_hash(record, prev_hash)

    await db.rating_history.insert_one(record)
    record.pop("_id", None)
    logger.info(f"Rating record #{record['seq']} created for {user_id}: {prev_rating}->{new_rating} (hash: {record['record_hash'][:16]}...)")
    return record


@router.get("/rating/history/{user_id}")
async def get_rating_history(user_id: str, limit: int = 50, user=Depends(get_current_user)):
    """Get the rating history for a user."""
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(404, "User not found")

    records = await db.rating_history.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("seq", -1).to_list(limit)

    total_records = await db.rating_history.count_documents({"user_id": user_id})

    return {
        "user": {
            "id": target["id"],
            "name": target["name"],
            "skill_rating": target.get("skill_rating", 1500),
            "skill_deviation": target.get("skill_deviation", 350),
            "wins": target.get("wins", 0),
            "losses": target.get("losses", 0),
            "draws": target.get("draws", 0),
        },
        "total_records": total_records,
        "records": records,
    }


@router.get("/rating/verify/{user_id}")
async def verify_rating_chain(user_id: str, user=Depends(get_current_user)):
    """Cryptographically verify the entire rating history chain for a user."""
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(404, "User not found")

    records = await db.rating_history.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("seq", 1).to_list(10000)

    if not records:
        return {
            "verified": True,
            "total_records": 0,
            "message": "No rating history yet — clean slate.",
            "current_rating": target.get("skill_rating", 1500),
            "chain_intact": True,
        }

    chain_valid = True
    broken_at = None
    prev_hash = GENESIS_HASH

    for i, rec in enumerate(records):
        # Verify record hash
        expected_hash = compute_record_hash(rec, prev_hash)
        if expected_hash != rec.get("record_hash"):
            chain_valid = False
            broken_at = {"seq": rec["seq"], "reason": "record_hash mismatch", "expected": expected_hash[:16], "actual": rec.get("record_hash", "")[:16]}
            break

        # Verify prev_hash chain
        if rec.get("prev_hash") != prev_hash:
            chain_valid = False
            broken_at = {"seq": rec["seq"], "reason": "prev_hash chain broken"}
            break

        # Verify sequence
        if rec.get("seq") != i + 1:
            chain_valid = False
            broken_at = {"seq": rec.get("seq"), "reason": "sequence gap detected"}
            break

        prev_hash = rec["record_hash"]

    # Verify final rating matches user's current rating
    last = records[-1]
    rating_matches = last["new_rating"] == target.get("skill_rating", 1500)

    return {
        "verified": chain_valid and rating_matches,
        "chain_intact": chain_valid,
        "rating_consistent": rating_matches,
        "total_records": len(records),
        "current_rating": target.get("skill_rating", 1500),
        "first_record_hash": records[0]["record_hash"][:16] + "..." if records else None,
        "last_record_hash": records[-1]["record_hash"][:16] + "..." if records else None,
        "broken_at": broken_at,
        "message": "Rating chain verified — all records are authentic and unbroken." if (chain_valid and rating_matches) else "WARNING: Rating chain integrity issue detected!",
    }


@router.get("/rating/certificate/{user_id}")
async def get_rating_certificate(user_id: str, user=Depends(get_current_user)):
    """Get a shareable rating certificate with verification proof."""
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(404, "User not found")

    records = await db.rating_history.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("seq", 1).to_list(10000)

    # Verify chain
    chain_valid = True
    prev_hash = GENESIS_HASH
    for rec in records:
        expected = compute_record_hash(rec, prev_hash)
        if expected != rec.get("record_hash"):
            chain_valid = False
            break
        if rec.get("prev_hash") != prev_hash:
            chain_valid = False
            break
        prev_hash = rec["record_hash"]

    rating_matches = (not records) or (records[-1]["new_rating"] == target.get("skill_rating", 1500))

    # Compute overall chain fingerprint
    chain_fingerprint = hashlib.sha256(
        f"{user_id}|{len(records)}|{prev_hash}".encode()
    ).hexdigest()[:32]

    # Rating journey stats
    peak_rating = max((r["new_rating"] for r in records), default=target.get("skill_rating", 1500))
    lowest_rating = min((r["new_rating"] for r in records), default=target.get("skill_rating", 1500))
    total_wins = sum(1 for r in records if r["result"] == "win")
    total_losses = sum(1 for r in records if r["result"] == "loss")
    total_draws = sum(1 for r in records if r["result"] == "draw")

    # Rating timeline (for chart)
    timeline = [{"seq": r["seq"], "rating": r["new_rating"], "date": r["match_date"], "delta": r["delta"], "result": r["result"]} for r in records]

    tier_label = "Diamond" if target.get("skill_rating", 1500) >= 2500 else "Gold" if target.get("skill_rating", 1500) >= 2000 else "Silver" if target.get("skill_rating", 1500) >= 1500 else "Bronze"

    return {
        "player": {
            "id": target["id"],
            "name": target["name"],
            "skill_rating": target.get("skill_rating", 1500),
            "skill_deviation": target.get("skill_deviation", 350),
            "tier": tier_label,
        },
        "verification": {
            "chain_intact": chain_valid,
            "rating_consistent": rating_matches,
            "verified": chain_valid and rating_matches,
            "total_matches_recorded": len(records),
            "chain_fingerprint": chain_fingerprint,
        },
        "journey": {
            "peak_rating": peak_rating,
            "lowest_rating": lowest_rating,
            "total_wins": total_wins,
            "total_losses": total_losses,
            "total_draws": total_draws,
            "first_match": records[0]["match_date"] if records else None,
            "last_match": records[-1]["match_date"] if records else None,
        },
        "timeline": timeline,
    }
