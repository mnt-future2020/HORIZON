"""
Payout / Settlement System
Linked account management, settlement calculation, Razorpay Route transfers,
and self-service payout views for coaches & venue owners.
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import Optional
from datetime import datetime, timezone
from database import db
from tz import now_ist
from auth import get_current_user, require_admin, get_razorpay_client, get_platform_settings
import uuid
import math
import re
import hmac
import hashlib
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payouts", tags=["payouts"])

IFSC_REGEX = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")


# ─── Linked Account Management ──────────────────────────────────────────────

@router.post("/linked-account")
async def create_linked_account(request: Request, user=Depends(get_current_user)):
    """Coach or venue owner registers their bank account for payouts."""
    if user.get("role") not in ("coach", "venue_owner"):
        raise HTTPException(403, "Only coaches and venue owners can link bank accounts")

    existing = await db.linked_accounts.find_one({"user_id": user["id"]}, {"_id": 0})
    if existing:
        raise HTTPException(409, "You already have a linked account. Use PUT to update.")

    data = await request.json()
    account_number = (data.get("account_number") or "").strip()
    ifsc_code = (data.get("ifsc_code") or "").strip().upper()
    beneficiary_name = (data.get("beneficiary_name") or "").strip()
    business_type = data.get("business_type", "individual")
    bank_name = (data.get("bank_name") or "").strip()

    if not account_number or not ifsc_code or not beneficiary_name:
        raise HTTPException(400, "account_number, ifsc_code, and beneficiary_name are required")
    if not IFSC_REGEX.match(ifsc_code):
        raise HTTPException(400, "Invalid IFSC code format")

    now = now_ist().isoformat()
    masked_account = "****" + account_number[-4:] if len(account_number) >= 4 else account_number

    # Try creating Razorpay linked account
    rzp_account_id = None
    rzp_status = "pending_verification"
    rzp = await get_razorpay_client()
    if rzp:
        try:
            phone = (user.get("phone") or "").replace("+", "").replace(" ", "").replace("-", "")
            if len(phone) == 10 and phone.isdigit():
                phone = "+91" + phone
            elif phone and not phone.startswith("+"):
                phone = "+" + phone

            account_data = {
                "email": user.get("email", ""),
                "phone": phone,
                "type": "route",
                "legal_business_name": beneficiary_name,
                "business_type": business_type,
                "contact_name": user.get("name", beneficiary_name),
            }
            rzp_account = rzp.account.create(account_data)
            rzp_account_id = rzp_account.get("id")
            rzp_status = rzp_account.get("status", "created")
            logger.info(f"Razorpay linked account created: {rzp_account_id} for user {user['id']}")
        except Exception as e:
            logger.warning(f"Razorpay linked account creation failed: {e}. Saving locally only.")
            rzp_account_id = None
            rzp_status = "pending_verification"

    linked = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_role": user["role"],
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "razorpay_account_id": rzp_account_id,
        "razorpay_account_status": rzp_status,
        "bank_account": {
            "account_number": masked_account,
            "ifsc_code": ifsc_code,
            "beneficiary_name": beneficiary_name,
            "bank_name": bank_name,
        },
        "business_type": business_type,
        "status": "active" if rzp_account_id else "pending_verification",
        "created_at": now,
        "updated_at": now,
    }
    await db.linked_accounts.insert_one(linked)
    linked.pop("_id", None)
    return linked


@router.get("/linked-account")
async def get_linked_account(user=Depends(get_current_user)):
    """Coach or venue owner views their linked bank account."""
    if user.get("role") not in ("coach", "venue_owner"):
        raise HTTPException(403, "Only coaches and venue owners have linked accounts")
    linked = await db.linked_accounts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not linked:
        return {"linked": False}
    return {"linked": True, **linked}


@router.put("/linked-account")
async def update_linked_account(request: Request, user=Depends(get_current_user)):
    """Coach or venue owner updates their bank details."""
    if user.get("role") not in ("coach", "venue_owner"):
        raise HTTPException(403, "Only coaches and venue owners can update bank accounts")

    existing = await db.linked_accounts.find_one({"user_id": user["id"]})
    if not existing:
        raise HTTPException(404, "No linked account found. Create one first.")

    data = await request.json()
    updates = {"updated_at": now_ist().isoformat()}

    account_number = (data.get("account_number") or "").strip()
    ifsc_code = (data.get("ifsc_code") or "").strip().upper()
    beneficiary_name = (data.get("beneficiary_name") or "").strip()

    if account_number:
        updates["bank_account.account_number"] = "****" + account_number[-4:] if len(account_number) >= 4 else account_number
    if ifsc_code:
        if not IFSC_REGEX.match(ifsc_code):
            raise HTTPException(400, "Invalid IFSC code format")
        updates["bank_account.ifsc_code"] = ifsc_code
    if beneficiary_name:
        updates["bank_account.beneficiary_name"] = beneficiary_name
    if data.get("bank_name"):
        updates["bank_account.bank_name"] = data["bank_name"]

    await db.linked_accounts.update_one({"user_id": user["id"]}, {"$set": updates})
    updated = await db.linked_accounts.find_one({"user_id": user["id"]}, {"_id": 0})
    return updated


@router.get("/linked-account/{user_id}")
async def admin_get_linked_account(user_id: str, user=Depends(get_current_user)):
    """Admin views any user's linked account."""
    await require_admin(user)
    linked = await db.linked_accounts.find_one({"user_id": user_id}, {"_id": 0})
    if not linked:
        return {"linked": False}
    return {"linked": True, **linked}


# ─── Settlement Calculation Helpers ──────────────────────────────────────────

async def _get_unsettled_coach_items(coach_id: str, period_start: str = None, period_end: str = None):
    """Get all unsettled coaching sessions and subscriptions for a coach."""
    items = []

    # Coaching sessions
    session_filter = {
        "coach_id": coach_id,
        "status": "completed",
        "settlement_id": {"$exists": False},
    }
    if period_start:
        session_filter["date"] = {"$gte": period_start}
    if period_end:
        session_filter.setdefault("date", {})
        if isinstance(session_filter["date"], dict):
            session_filter["date"]["$lte"] = period_end
        else:
            session_filter["date"] = {"$gte": period_start, "$lte": period_end}

    async for s in db.coaching_sessions.find(session_filter, {"_id": 0}):
        # Only include sessions with actual payment captured (not free/package)
        if s.get("payment_gateway") in ("package", None):
            continue
        if s.get("payment_gateway") == "test" or s.get("payment_details"):
            items.append({
                "type": "coaching_session",
                "ref_id": s["id"],
                "amount": s.get("price", 0),
                "commission": s.get("commission_amount", 0),
                "net": s.get("price", 0) - s.get("commission_amount", 0),
                "date": s.get("date", ""),
                "description": f"Session - {(s.get('sport') or 'General').replace('_', ' ').title()} ({s.get('player_name', 'Player')})",
            })

    # Coaching subscriptions
    sub_filter = {
        "coach_id": coach_id,
        "status": {"$in": ["active", "expired", "cancelled"]},
        "settlement_id": {"$exists": False},
    }
    if period_start or period_end:
        date_cond = {}
        if period_start:
            date_cond["$gte"] = period_start
        if period_end:
            date_cond["$lte"] = period_end
        if date_cond:
            sub_filter["created_at"] = date_cond

    async for s in db.coaching_subscriptions.find(sub_filter, {"_id": 0}):
        if s.get("payment_gateway") == "test" or s.get("payment_details"):
            items.append({
                "type": "coaching_subscription",
                "ref_id": s["id"],
                "amount": s.get("price", 0),
                "commission": s.get("commission_amount", 0),
                "net": s.get("price", 0) - s.get("commission_amount", 0),
                "date": (s.get("created_at") or "")[:10],
                "description": f"Package - {s.get('package_name', 'Subscription')} ({s.get('player_name', 'Player')})",
            })

    return items


async def _get_unsettled_venue_items(owner_id: str, period_start: str = None, period_end: str = None):
    """Get all unsettled venue bookings for a venue owner."""
    items = []

    venue_ids = [v["id"] async for v in db.venues.find({"owner_id": owner_id}, {"id": 1})]
    if not venue_ids:
        return items

    booking_filter = {
        "venue_id": {"$in": venue_ids},
        "status": {"$in": ["confirmed", "completed"]},
        "settlement_id": {"$exists": False},
    }
    if period_start:
        booking_filter["date"] = {"$gte": period_start}
    if period_end:
        booking_filter.setdefault("date", {})
        if isinstance(booking_filter["date"], dict):
            booking_filter["date"]["$lte"] = period_end
        else:
            booking_filter["date"] = {"$gte": period_start, "$lte": period_end}

    async for b in db.bookings.find(booking_filter, {"_id": 0}):
        if b.get("payment_gateway") == "test" or b.get("payment_details"):
            items.append({
                "type": "venue_booking",
                "ref_id": b["id"],
                "amount": b.get("total_amount", 0),
                "commission": b.get("commission_amount", 0),
                "net": b.get("total_amount", 0) - b.get("commission_amount", 0),
                "date": b.get("date", ""),
                "description": f"Booking - {b.get('venue_name', 'Venue')} ({b.get('sport', 'Sport').replace('_', ' ').title()})",
            })

    return items


# ─── Admin: Pending Payouts ──────────────────────────────────────────────────

@router.get("/pending")
async def list_pending_payouts(
    role: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    user=Depends(get_current_user),
):
    """Admin: List all users with pending (unsettled) payout amounts."""
    await require_admin(user)

    # Get all linked accounts
    la_filter = {}
    if role:
        la_filter["user_role"] = role
    linked_accounts = await db.linked_accounts.find(la_filter, {"_id": 0}).to_list(500)

    # Also find coaches/venue owners WITHOUT linked accounts
    la_user_ids = {la["user_id"] for la in linked_accounts}
    role_filter = {"role": {"$in": ["coach", "venue_owner"]}}
    if role:
        role_filter["role"] = role
    all_users = await db.users.find(role_filter, {"_id": 0, "id": 1, "name": 1, "role": 1, "email": 1}).to_list(500)

    results = []
    for u in all_users:
        has_linked = u["id"] in la_user_ids
        la = next((la for la in linked_accounts if la["user_id"] == u["id"]), None)

        # Get unsettled items
        if u["role"] == "coach":
            items = await _get_unsettled_coach_items(u["id"])
        else:
            items = await _get_unsettled_venue_items(u["id"])

        if not items and not has_linked:
            continue  # Skip users with no pending and no bank account

        gross = sum(i["amount"] for i in items)
        commission = sum(i["commission"] for i in items)
        net = sum(i["net"] for i in items)

        if net <= 0 and not items:
            continue

        results.append({
            "user_id": u["id"],
            "user_name": u.get("name", ""),
            "user_email": u.get("email", ""),
            "user_role": u["role"],
            "has_linked_account": has_linked,
            "linked_account_status": la["status"] if la else None,
            "pending_items_count": len(items),
            "gross_amount": gross,
            "commission_amount": commission,
            "net_amount": net,
            "oldest_unsettled_date": min((i["date"] for i in items), default="") if items else "",
        })

    # Sort by net_amount descending
    results.sort(key=lambda x: x["net_amount"], reverse=True)
    total = len(results)
    skip = (page - 1) * limit
    paginated = results[skip:skip + limit]
    return {"payouts": paginated, "total": total, "page": page, "pages": math.ceil(total / max(limit, 1))}


@router.get("/pending/{user_id}")
async def pending_detail(user_id: str, user=Depends(get_current_user)):
    """Admin: Get detailed pending items for a specific user."""
    await require_admin(user)

    target = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "role": 1, "name": 1})
    if not target:
        raise HTTPException(404, "User not found")

    if target["role"] == "coach":
        items = await _get_unsettled_coach_items(user_id)
    elif target["role"] == "venue_owner":
        items = await _get_unsettled_venue_items(user_id)
    else:
        raise HTTPException(400, "User is not a coach or venue owner")

    gross = sum(i["amount"] for i in items)
    commission = sum(i["commission"] for i in items)
    net = sum(i["net"] for i in items)

    return {
        "user_id": user_id,
        "user_name": target.get("name", ""),
        "user_role": target["role"],
        "items": sorted(items, key=lambda x: x["date"], reverse=True),
        "gross_amount": gross,
        "commission_amount": commission,
        "net_amount": net,
    }


# ─── Admin: Create & Process Settlement ──────────────────────────────────────

@router.post("/settlements")
async def create_settlement(request: Request, user=Depends(get_current_user)):
    """Admin: Create a settlement and process Razorpay transfer."""
    await require_admin(user)
    data = await request.json()
    target_user_id = data.get("user_id")
    if not target_user_id:
        raise HTTPException(400, "user_id is required")

    period_start = data.get("period_start")
    period_end = data.get("period_end")
    notes = data.get("notes", "")

    target = await db.users.find_one({"id": target_user_id}, {"_id": 0, "id": 1, "role": 1, "name": 1})
    if not target:
        raise HTTPException(404, "User not found")

    linked = await db.linked_accounts.find_one({"user_id": target_user_id}, {"_id": 0})
    if not linked:
        raise HTTPException(400, "User has no linked bank account")

    # Get unsettled items
    if target["role"] == "coach":
        items = await _get_unsettled_coach_items(target_user_id, period_start, period_end)
    elif target["role"] == "venue_owner":
        items = await _get_unsettled_venue_items(target_user_id, period_start, period_end)
    else:
        raise HTTPException(400, "User is not a coach or venue owner")

    if not items:
        raise HTTPException(400, "No pending items to settle")

    gross = sum(i["amount"] for i in items)
    commission = sum(i["commission"] for i in items)
    net = sum(i["net"] for i in items)

    if net <= 0:
        raise HTTPException(400, "Net amount must be positive")

    now = now_ist().isoformat()
    settlement_id = str(uuid.uuid4())

    settlement = {
        "id": settlement_id,
        "user_id": target_user_id,
        "user_role": target["role"],
        "user_name": target.get("name", ""),
        "linked_account_id": linked["id"],
        "razorpay_account_id": linked.get("razorpay_account_id"),
        "period_start": period_start or min(i["date"] for i in items),
        "period_end": period_end or max(i["date"] for i in items),
        "gross_amount": gross,
        "commission_amount": commission,
        "commission_pct": commission / gross * 100 if gross > 0 else 0,
        "net_amount": net,
        "line_items": items,
        "razorpay_transfer_id": None,
        "transfer_status": "pending",
        "transfer_utr": "",
        "status": "processing",
        "initiated_by": user["id"],
        "failed_reason": "",
        "notes": notes,
        "created_at": now,
        "updated_at": now,
    }

    # Try Razorpay Route transfer
    rzp = await get_razorpay_client()
    if rzp and linked.get("razorpay_account_id"):
        try:
            transfer = rzp.transfer.create({
                "account": linked["razorpay_account_id"],
                "amount": net * 100,  # paise
                "currency": "INR",
                "notes": {
                    "settlement_id": settlement_id,
                    "user_id": target_user_id,
                    "type": f"{target['role']}_payout",
                },
            })
            settlement["razorpay_transfer_id"] = transfer.get("id")
            settlement["transfer_status"] = transfer.get("status", "processing")
            settlement["status"] = "completed" if transfer.get("status") == "processed" else "processing"
            logger.info(f"Razorpay transfer created: {transfer.get('id')} for settlement {settlement_id}")
        except Exception as e:
            logger.error(f"Razorpay transfer failed: {e}")
            settlement["status"] = "failed"
            settlement["failed_reason"] = str(e)
            settlement["transfer_status"] = "failed"
    else:
        # Test mode — mark as completed without real transfer
        settlement["status"] = "completed"
        settlement["transfer_status"] = "processed"
        logger.info(f"Test mode settlement {settlement_id} for {target_user_id}")

    await db.settlements.insert_one(settlement)
    settlement.pop("_id", None)

    # Stamp source documents if settlement didn't fail
    if settlement["status"] != "failed":
        ref_ids_sessions = [i["ref_id"] for i in items if i["type"] == "coaching_session"]
        ref_ids_subs = [i["ref_id"] for i in items if i["type"] == "coaching_subscription"]
        ref_ids_bookings = [i["ref_id"] for i in items if i["type"] == "venue_booking"]

        if ref_ids_sessions:
            await db.coaching_sessions.update_many(
                {"id": {"$in": ref_ids_sessions}, "settlement_id": {"$exists": False}},
                {"$set": {"settlement_id": settlement_id}}
            )
        if ref_ids_subs:
            await db.coaching_subscriptions.update_many(
                {"id": {"$in": ref_ids_subs}, "settlement_id": {"$exists": False}},
                {"$set": {"settlement_id": settlement_id}}
            )
        if ref_ids_bookings:
            await db.bookings.update_many(
                {"id": {"$in": ref_ids_bookings}, "settlement_id": {"$exists": False}},
                {"$set": {"settlement_id": settlement_id}}
            )

    # Notify the payee
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": target_user_id,
        "type": "payout_processed",
        "title": "Payout Processed!",
        "message": f"A settlement of ₹{net:,} has been {'initiated' if settlement['status'] == 'processing' else 'completed'} to your bank account.",
        "is_read": False,
        "created_at": now,
    })

    return settlement


@router.post("/settlements/bulk")
async def bulk_settle(user=Depends(get_current_user)):
    """Admin: Process all pending settlements at once."""
    await require_admin(user)

    linked_accounts = await db.linked_accounts.find({"status": "active"}, {"_id": 0}).to_list(500)
    processed = []
    failed = []

    for la in linked_accounts:
        target = await db.users.find_one({"id": la["user_id"]}, {"_id": 0, "id": 1, "role": 1, "name": 1})
        if not target:
            continue

        if target["role"] == "coach":
            items = await _get_unsettled_coach_items(la["user_id"])
        elif target["role"] == "venue_owner":
            items = await _get_unsettled_venue_items(la["user_id"])
        else:
            continue

        net = sum(i["net"] for i in items)
        if net <= 0 or not items:
            continue

        try:
            # Create settlement via the single endpoint logic
            from starlette.requests import Request as StarletteRequest
            # Reuse the create logic directly
            result = await _process_single_settlement(user, la, target, items)
            processed.append({"user_id": la["user_id"], "user_name": target.get("name"), "amount": net, "status": result["status"]})
        except Exception as e:
            failed.append({"user_id": la["user_id"], "user_name": target.get("name"), "error": str(e)})

    return {"processed": processed, "failed": failed, "total_processed": len(processed), "total_failed": len(failed)}


async def _process_single_settlement(admin_user, linked, target, items):
    """Internal: Process a settlement for a single user."""
    gross = sum(i["amount"] for i in items)
    commission = sum(i["commission"] for i in items)
    net = sum(i["net"] for i in items)
    now = now_ist().isoformat()
    settlement_id = str(uuid.uuid4())

    settlement = {
        "id": settlement_id,
        "user_id": target["id"],
        "user_role": target["role"],
        "user_name": target.get("name", ""),
        "linked_account_id": linked["id"],
        "razorpay_account_id": linked.get("razorpay_account_id"),
        "period_start": min(i["date"] for i in items),
        "period_end": max(i["date"] for i in items),
        "gross_amount": gross,
        "commission_amount": commission,
        "commission_pct": commission / gross * 100 if gross > 0 else 0,
        "net_amount": net,
        "line_items": items,
        "razorpay_transfer_id": None,
        "transfer_status": "pending",
        "transfer_utr": "",
        "status": "processing",
        "initiated_by": admin_user["id"],
        "failed_reason": "",
        "notes": "Bulk settlement",
        "created_at": now,
        "updated_at": now,
    }

    rzp = await get_razorpay_client()
    if rzp and linked.get("razorpay_account_id"):
        try:
            transfer = rzp.transfer.create({
                "account": linked["razorpay_account_id"],
                "amount": net * 100,
                "currency": "INR",
                "notes": {"settlement_id": settlement_id, "user_id": target["id"], "type": "bulk_payout"},
            })
            settlement["razorpay_transfer_id"] = transfer.get("id")
            settlement["transfer_status"] = transfer.get("status", "processing")
            settlement["status"] = "completed" if transfer.get("status") == "processed" else "processing"
        except Exception as e:
            settlement["status"] = "failed"
            settlement["failed_reason"] = str(e)
            settlement["transfer_status"] = "failed"
    else:
        settlement["status"] = "completed"
        settlement["transfer_status"] = "processed"

    await db.settlements.insert_one(settlement)
    settlement.pop("_id", None)

    if settlement["status"] != "failed":
        ref_ids_sessions = [i["ref_id"] for i in items if i["type"] == "coaching_session"]
        ref_ids_subs = [i["ref_id"] for i in items if i["type"] == "coaching_subscription"]
        ref_ids_bookings = [i["ref_id"] for i in items if i["type"] == "venue_booking"]
        if ref_ids_sessions:
            await db.coaching_sessions.update_many(
                {"id": {"$in": ref_ids_sessions}, "settlement_id": {"$exists": False}},
                {"$set": {"settlement_id": settlement_id}}
            )
        if ref_ids_subs:
            await db.coaching_subscriptions.update_many(
                {"id": {"$in": ref_ids_subs}, "settlement_id": {"$exists": False}},
                {"$set": {"settlement_id": settlement_id}}
            )
        if ref_ids_bookings:
            await db.bookings.update_many(
                {"id": {"$in": ref_ids_bookings}, "settlement_id": {"$exists": False}},
                {"$set": {"settlement_id": settlement_id}}
            )

        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": target["id"],
            "type": "payout_processed",
            "title": "Payout Processed!",
            "message": f"A settlement of ₹{net:,} has been initiated to your bank account.",
            "is_read": False,
            "created_at": now,
        })

    return settlement


# ─── Admin: Settlement History ───────────────────────────────────────────────

@router.get("/settlements")
async def list_settlements(
    status: Optional[str] = None,
    user_id: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    user=Depends(get_current_user),
):
    """Admin: List all settlements."""
    await require_admin(user)

    f = {}
    if status:
        f["status"] = status
    if user_id:
        f["user_id"] = user_id

    total = await db.settlements.count_documents(f)
    skip = (page - 1) * limit
    settlements = await db.settlements.find(f, {"_id": 0, "line_items": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    return {"settlements": settlements, "total": total, "page": page, "pages": math.ceil(total / max(limit, 1)), "limit": limit}


@router.get("/settlements/{settlement_id}")
async def get_settlement(settlement_id: str, user=Depends(get_current_user)):
    """Admin: Get settlement detail with line items."""
    await require_admin(user)
    settlement = await db.settlements.find_one({"id": settlement_id}, {"_id": 0})
    if not settlement:
        raise HTTPException(404, "Settlement not found")
    return settlement


# ─── Self-Service: Coach / Venue Owner ───────────────────────────────────────

@router.get("/my-summary")
async def my_payout_summary(user=Depends(get_current_user)):
    """Coach or venue owner: View payout summary dashboard."""
    if user.get("role") not in ("coach", "venue_owner"):
        raise HTTPException(403, "Only coaches and venue owners can view payouts")

    user_id = user["id"]

    # Linked account status
    linked = await db.linked_accounts.find_one({"user_id": user_id}, {"_id": 0, "status": 1, "bank_account": 1})

    # Total settled
    settlements = await db.settlements.find(
        {"user_id": user_id, "status": {"$in": ["completed", "processing"]}},
        {"_id": 0, "net_amount": 1, "gross_amount": 1, "commission_amount": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(1000)

    total_settled = sum(s["net_amount"] for s in settlements)
    total_gross = sum(s["gross_amount"] for s in settlements)
    total_commission = sum(s["commission_amount"] for s in settlements)

    last_payout = settlements[0] if settlements else None

    # Pending settlement
    if user["role"] == "coach":
        pending_items = await _get_unsettled_coach_items(user_id)
    else:
        pending_items = await _get_unsettled_venue_items(user_id)

    pending_gross = sum(i["amount"] for i in pending_items)
    pending_commission = sum(i["commission"] for i in pending_items)
    pending_net = sum(i["net"] for i in pending_items)

    return {
        "linked_account_status": linked["status"] if linked else "not_linked",
        "bank_account": linked.get("bank_account") if linked else None,
        "total_earned": total_gross + pending_gross,
        "total_commission": total_commission + pending_commission,
        "total_settled": total_settled,
        "pending_settlement": pending_net,
        "pending_items_count": len(pending_items),
        "last_payout_date": last_payout["created_at"] if last_payout else None,
        "last_payout_amount": last_payout["net_amount"] if last_payout else 0,
        "recent_settlements": [
            {"id": s.get("id"), "net_amount": s["net_amount"], "created_at": s["created_at"]}
            for s in settlements[:5]
        ],
    }


@router.get("/my-payouts")
async def my_payouts(
    page: int = 1,
    limit: int = 20,
    user=Depends(get_current_user),
):
    """Coach or venue owner: List their settlement history."""
    if user.get("role") not in ("coach", "venue_owner"):
        raise HTTPException(403, "Only coaches and venue owners can view payouts")

    f = {"user_id": user["id"]}
    total = await db.settlements.count_documents(f)
    skip = (page - 1) * limit
    settlements = await db.settlements.find(f, {"_id": 0, "line_items": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    return {"settlements": settlements, "total": total, "page": page, "pages": math.ceil(total / max(limit, 1)), "limit": limit}


@router.get("/my-payouts/{settlement_id}")
async def my_payout_detail(settlement_id: str, user=Depends(get_current_user)):
    """Coach or venue owner: View specific settlement detail."""
    if user.get("role") not in ("coach", "venue_owner"):
        raise HTTPException(403, "Only coaches and venue owners can view payouts")

    settlement = await db.settlements.find_one({"id": settlement_id, "user_id": user["id"]}, {"_id": 0})
    if not settlement:
        raise HTTPException(404, "Settlement not found")
    return settlement


# ─── Razorpay Transfer Webhook ───────────────────────────────────────────────

@router.post("/webhook/razorpay-transfer")
async def razorpay_transfer_webhook(request: Request):
    """Handle Razorpay transfer status webhooks."""
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    # Verify HMAC signature
    settings = await get_platform_settings()
    webhook_secret = settings.get("payment_gateway", {}).get("transfer_webhook_secret", "")
    if webhook_secret and signature:
        expected = hmac.new(webhook_secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise HTTPException(400, "Invalid webhook signature")

    payload = await request.json()
    event = payload.get("event", "")
    entity = payload.get("payload", {}).get("transfer", {}).get("entity", {})
    transfer_id = entity.get("id")

    if not transfer_id:
        return {"ok": True, "message": "No transfer_id in payload"}

    settlement = await db.settlements.find_one({"razorpay_transfer_id": transfer_id})
    if not settlement:
        logger.warning(f"Webhook for unknown transfer: {transfer_id}")
        return {"ok": True, "message": "Transfer not found"}

    now = now_ist().isoformat()

    if event in ("transfer.processed", "transfer.settled"):
        await db.settlements.update_one(
            {"razorpay_transfer_id": transfer_id},
            {"$set": {
                "transfer_status": "processed",
                "transfer_utr": entity.get("utr", ""),
                "status": "completed",
                "updated_at": now,
            }}
        )
        logger.info(f"Settlement {settlement['id']} completed. UTR: {entity.get('utr')}")

    elif event == "transfer.failed":
        await db.settlements.update_one(
            {"razorpay_transfer_id": transfer_id},
            {"$set": {
                "transfer_status": "failed",
                "status": "failed",
                "failed_reason": entity.get("failure_reason", "Transfer failed"),
                "updated_at": now,
            }}
        )
        # Unstamp source documents so they reappear as pending
        for item in settlement.get("line_items", []):
            collection = {
                "coaching_session": "coaching_sessions",
                "coaching_subscription": "coaching_subscriptions",
                "venue_booking": "bookings",
            }.get(item["type"])
            if collection:
                await db[collection].update_one(
                    {"id": item["ref_id"]},
                    {"$unset": {"settlement_id": ""}}
                )
        logger.warning(f"Settlement {settlement['id']} failed: {entity.get('failure_reason')}")

        # Notify admin
        admins = await db.users.find({"role": "super_admin"}, {"id": 1}).to_list(10)
        for admin in admins:
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": admin["id"],
                "type": "payout_failed",
                "title": "Payout Failed",
                "message": f"Settlement for {settlement.get('user_name')} (₹{settlement.get('net_amount', 0):,}) failed: {entity.get('failure_reason', 'Unknown')}",
                "is_read": False,
                "created_at": now,
            })

    elif event == "transfer.reversed":
        await db.settlements.update_one(
            {"razorpay_transfer_id": transfer_id},
            {"$set": {
                "transfer_status": "reversed",
                "status": "failed",
                "failed_reason": "Transfer reversed",
                "updated_at": now,
            }}
        )
        for item in settlement.get("line_items", []):
            collection = {
                "coaching_session": "coaching_sessions",
                "coaching_subscription": "coaching_subscriptions",
                "venue_booking": "bookings",
            }.get(item["type"])
            if collection:
                await db[collection].update_one(
                    {"id": item["ref_id"]},
                    {"$unset": {"settlement_id": ""}}
                )
        logger.warning(f"Settlement {settlement['id']} reversed")

    return {"ok": True, "event": event}
