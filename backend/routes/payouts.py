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
import asyncio
import json as _json
from datetime import timedelta
from routes.finance_utils import log_webhook, update_webhook_log, log_finance_event

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

    # Call 2: Add bank account to the Route account
    rzp_bank_account_id = None
    if rzp and rzp_account_id:
        try:
            bank_resp = rzp.account.bank_account.create(rzp_account_id, {
                "beneficiary_name": beneficiary_name,
                "account_type": "current" if business_type != "individual" else "savings",
                "account_number": account_number,
                "ifsc_code": ifsc_code,
            })
            rzp_bank_account_id = bank_resp.get("id")
        except Exception as e:
            logger.warning(f"Bank account creation on Razorpay failed: {e}")
            rzp_bank_account_id = None

    linked = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_role": user["role"],
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "razorpay_account_id": rzp_account_id,
        "razorpay_account_status": rzp_status,
        "razorpay_bank_account_id": rzp_bank_account_id,
        "bank_account_verified": False,
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

    # If bank details changed, update on Razorpay too
    if account_number or ifsc_code or beneficiary_name:
        rzp = await get_razorpay_client()
        rzp_account_id = existing.get("razorpay_account_id")
        if rzp and rzp_account_id:
            try:
                bank_data = {
                    "beneficiary_name": beneficiary_name or existing.get("bank_account", {}).get("beneficiary_name", ""),
                    "account_number": account_number or "",
                    "ifsc_code": ifsc_code or existing.get("bank_account", {}).get("ifsc_code", ""),
                }
                if account_number:
                    bank_data["account_type"] = "current" if existing.get("business_type") != "individual" else "savings"
                bank_resp = rzp.account.bank_account.create(rzp_account_id, bank_data)
                updates["razorpay_bank_account_id"] = bank_resp.get("id")
                updates["bank_account_verified"] = False  # Re-verification needed
            except Exception as e:
                logger.warning(f"Bank account update on Razorpay failed: {e}")

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

    # Guard 2: Razorpay account active?
    if linked.get("razorpay_account_status") != "active":
        raise HTTPException(400, "Bank account verification pending. Payout blocked until Razorpay activates the account.")

    # Guard 3: Bank account verified?
    if not linked.get("bank_account_verified"):
        raise HTTPException(400, "Bank account not verified by Razorpay. Payout blocked.")

    # Lock check — prevent two admins processing same venue owner simultaneously
    lock_until = linked.get("settlement_lock_until", "")
    if lock_until and lock_until > now_ist().isoformat():
        raise HTTPException(400, "Payout already in progress for this user. Try after lock expires.")

    # Set lock (5-minute TTL)
    await db.linked_accounts.update_one(
        {"user_id": target_user_id},
        {"$set": {"settlement_lock_until": (now_ist() + timedelta(minutes=5)).isoformat()}}
    )

    # Compute effective period
    effective_period_start = period_start
    effective_period_end = period_end

    # Idempotency check — period-based, not time-based
    if effective_period_start and effective_period_end:
        existing_settlement = await db.settlements.find_one({
            "user_id": target_user_id,
            "period_start": effective_period_start,
            "period_end": effective_period_end,
            "status": {"$nin": ["failed"]},
        })
        if existing_settlement:
            # Clear lock and return existing
            await db.linked_accounts.update_one(
                {"user_id": target_user_id}, {"$unset": {"settlement_lock_until": ""}}
            )
            existing_settlement.pop("_id", None)
            return existing_settlement

    try:
        # Get unsettled items
        if target["role"] == "coach":
            items = await _get_unsettled_coach_items(target_user_id, period_start, period_end)
        elif target["role"] == "venue_owner":
            items = await _get_unsettled_venue_items(target_user_id, period_start, period_end)
        else:
            raise HTTPException(400, "User is not a coach or venue owner")

        gross = sum(i["amount"] for i in items)
        commission = sum(i["commission"] for i in items)
        positive_net = sum(i["net"] for i in items)

        # Fetch pending deductions for this venue owner
        deductions = await db.payout_deductions.find(
            {"venue_owner_id": target_user_id, "deduction_status": "pending"},
            {"_id": 0}
        ).to_list(100)
        total_deductions = sum(d.get("venue_clawback_amount", 0) for d in deductions)

        # Final net = positive earnings - deductions
        net = positive_net - total_deductions

        if net <= 0:
            if total_deductions > 0:
                # Negative balance — mark deductions as applied BEFORE returning
                deduction_ids = [d["id"] for d in deductions]
                await db.payout_deductions.update_many(
                    {"id": {"$in": deduction_ids}},
                    {"$set": {"deduction_status": "applied", "applied_settlement_id": "carried_forward"}}
                )
                asyncio.create_task(log_finance_event(
                    "negative_balance_carried_forward", user["id"], target_user_id,
                    amount=net, metadata={"positive": positive_net, "deductions": total_deductions},
                ))
                await db.notifications.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": target_user_id,
                    "type": "deduction_carried_forward",
                    "title": "Payout Adjustment",
                    "message": f"Deductions (₹{total_deductions:,}) exceed current earnings (₹{positive_net:,}). Remaining ₹{abs(net):,} carried to next cycle.",
                    "is_read": False,
                    "created_at": now_ist().isoformat(),
                })
                raise HTTPException(400, f"Net amount after deductions is ₹{net}. Deductions applied and carried forward.")
            elif not items:
                raise HTTPException(400, "No pending items to settle")
            else:
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
            "total_deductions": total_deductions,
            "deductions": [
                {"id": d["id"], "booking_id": d["booking_id"], "amount": d["venue_clawback_amount"]}
                for d in deductions
            ],
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

            # Mark deductions as applied
            if deductions:
                deduction_ids = [d["id"] for d in deductions]
                await db.payout_deductions.update_many(
                    {"id": {"$in": deduction_ids}},
                    {"$set": {"deduction_status": "applied", "applied_settlement_id": settlement_id}}
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

    finally:
        # Always clear settlement lock
        await db.linked_accounts.update_one(
            {"user_id": target_user_id}, {"$unset": {"settlement_lock_until": ""}}
        )


@router.post("/settlements/bulk")
async def bulk_settle(user=Depends(get_current_user)):
    """Admin: Process all pending settlements at once."""
    await require_admin(user)

    linked_accounts = await db.linked_accounts.find(
        {"status": "active", "bank_account_verified": True},
        {"_id": 0}
    ).to_list(500)
    processed = []
    failed = []

    for la in linked_accounts:
        target = await db.users.find_one({"id": la["user_id"]}, {"_id": 0, "id": 1, "role": 1, "name": 1})
        if not target:
            continue

        # Skip if Razorpay account not active
        if la.get("razorpay_account_status") != "active":
            continue

        if target["role"] == "coach":
            items = await _get_unsettled_coach_items(la["user_id"])
        elif target["role"] == "venue_owner":
            items = await _get_unsettled_venue_items(la["user_id"])
        else:
            continue

        if not items:
            continue

        try:
            result = await _process_single_settlement(user, la, target, items)
            processed.append({"user_id": la["user_id"], "user_name": target.get("name"), "amount": result.get("net_amount", 0), "status": result["status"]})
        except Exception as e:
            failed.append({"user_id": la["user_id"], "user_name": target.get("name"), "error": str(e)})

    return {"processed": processed, "failed": failed, "total_processed": len(processed), "total_failed": len(failed)}


async def _process_single_settlement(admin_user, linked, target, items):
    """Internal: Process a settlement for a single user (with deductions)."""
    gross = sum(i["amount"] for i in items)
    commission = sum(i["commission"] for i in items)
    positive_net = sum(i["net"] for i in items)

    # Fetch pending deductions
    deductions = await db.payout_deductions.find(
        {"venue_owner_id": target["id"], "deduction_status": "pending"},
        {"_id": 0}
    ).to_list(100)
    total_deductions = sum(d.get("venue_clawback_amount", 0) for d in deductions)
    net = positive_net - total_deductions

    if net <= 0:
        if total_deductions > 0:
            # Mark deductions as carried forward
            deduction_ids = [d["id"] for d in deductions]
            await db.payout_deductions.update_many(
                {"id": {"$in": deduction_ids}},
                {"$set": {"deduction_status": "applied", "applied_settlement_id": "carried_forward"}}
            )
        return {"status": "skipped", "net_amount": net, "reason": "net_zero_or_negative"}

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
        "total_deductions": total_deductions,
        "deductions": [
            {"id": d["id"], "booking_id": d["booking_id"], "amount": d["venue_clawback_amount"]}
            for d in deductions
        ],
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

        # Mark deductions as applied
        if deductions:
            deduction_ids = [d["id"] for d in deductions]
            await db.payout_deductions.update_many(
                {"id": {"$in": deduction_ids}},
                {"$set": {"deduction_status": "applied", "applied_settlement_id": settlement_id}}
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
    linked = await db.linked_accounts.find_one({"user_id": user_id}, {"_id": 0, "status": 1, "bank_account": 1, "bank_account_verified": 1, "razorpay_account_status": 1})

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

    # Fetch pending deductions
    pending_deductions = await db.payout_deductions.find(
        {"venue_owner_id": user_id, "deduction_status": "pending"},
        {"_id": 0, "venue_clawback_amount": 1}
    ).to_list(100)
    total_pending_deductions = sum(d["venue_clawback_amount"] for d in pending_deductions)

    return {
        "linked_account_status": linked["status"] if linked else "not_linked",
        "bank_account": linked.get("bank_account") if linked else None,
        "bank_account_verified": linked.get("bank_account_verified", False) if linked else False,
        "razorpay_account_status": linked.get("razorpay_account_status") if linked else None,
        "total_earned": total_gross + pending_gross,
        "total_commission": total_commission + pending_commission,
        "total_settled": total_settled,
        "pending_settlement": pending_net - total_pending_deductions,
        "pending_deductions": total_pending_deductions,
        "pending_settlement_before_deductions": pending_net,
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


@router.get("/my-deductions")
async def my_deductions(user=Depends(get_current_user)):
    """Venue owner: List their pending and applied deductions."""
    if user.get("role") not in ("coach", "venue_owner"):
        raise HTTPException(403, "Only coaches and venue owners can view deductions")
    deductions = await db.payout_deductions.find(
        {"venue_owner_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    pending_total = sum(d["venue_clawback_amount"] for d in deductions if d["deduction_status"] == "pending")
    return {"deductions": deductions, "pending_total": pending_total}


# ─── Razorpay Transfer Webhook ───────────────────────────────────────────────

@router.post("/webhook/razorpay-transfer")
async def razorpay_transfer_webhook(request: Request):
    """Handle Razorpay transfer status webhooks."""
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    # Log webhook immediately
    log_id = str(uuid.uuid4())
    try:
        raw_payload = _json.loads(body)
    except Exception:
        raw_payload = {}
    asyncio.create_task(log_webhook(log_id, "razorpay", raw_payload.get("event", ""), raw_payload))

    # Verify HMAC signature
    settings = await get_platform_settings()
    webhook_secret = settings.get("payment_gateway", {}).get("transfer_webhook_secret", "")
    if webhook_secret and signature:
        expected = hmac.new(webhook_secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            asyncio.create_task(update_webhook_log(log_id, "signature_mismatch"))
            raise HTTPException(400, "Invalid webhook signature")

    payload = raw_payload
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
        # Revert deductions back to pending
        deduction_ids = [d["id"] for d in settlement.get("deductions", [])]
        if deduction_ids:
            await db.payout_deductions.update_many(
                {"id": {"$in": deduction_ids}},
                {"$set": {"deduction_status": "pending", "applied_settlement_id": None}}
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
        # Revert deductions back to pending
        deduction_ids = [d["id"] for d in settlement.get("deductions", [])]
        if deduction_ids:
            await db.payout_deductions.update_many(
                {"id": {"$in": deduction_ids}},
                {"$set": {"deduction_status": "pending", "applied_settlement_id": None}}
            )
        logger.warning(f"Settlement {settlement['id']} reversed")

    asyncio.create_task(update_webhook_log(log_id, "success"))
    return {"ok": True, "event": event}


# ─── Razorpay Account Webhook (bank verification) ─────────────────────────

@router.post("/webhook/razorpay-account")
async def razorpay_account_webhook(request: Request):
    """Handle Razorpay account status webhooks (bank verification)."""
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    # 1. Log to webhook_logs immediately
    log_id = str(uuid.uuid4())
    try:
        payload = _json.loads(body)
    except Exception:
        payload = {}
    asyncio.create_task(log_webhook(log_id, "razorpay", payload.get("event", ""), payload))

    # 2. Verify HMAC signature
    settings = await get_platform_settings()
    webhook_secret = settings.get("payment_gateway", {}).get("account_webhook_secret", "")
    if webhook_secret and signature:
        expected = hmac.new(webhook_secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            asyncio.create_task(update_webhook_log(log_id, "signature_mismatch"))
            return {"ok": True}

    # 3. Handle account.activated / account.rejected / account.suspended
    event = payload.get("event", "")
    entity = payload.get("payload", {}).get("account", {}).get("entity", {})
    rzp_account_id = entity.get("id")

    if not rzp_account_id:
        return {"ok": True}

    linked = await db.linked_accounts.find_one({"razorpay_account_id": rzp_account_id})
    if not linked:
        return {"ok": True}

    now = now_ist().isoformat()

    if event == "account.activated":
        await db.linked_accounts.update_one(
            {"razorpay_account_id": rzp_account_id},
            {"$set": {
                "razorpay_account_status": "active",
                "bank_account_verified": True,
                "status": "active",
                "updated_at": now,
            }}
        )
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": linked["user_id"],
            "type": "bank_verified",
            "title": "Bank Account Verified",
            "message": "Your bank account is verified. Payouts are now enabled.",
            "is_read": False,
            "created_at": now,
        })
        asyncio.create_task(log_finance_event(
            "bank_account_verified", linked["user_id"], linked["user_id"], amount=0
        ))

    elif event in ("account.rejected", "account.suspended"):
        await db.linked_accounts.update_one(
            {"razorpay_account_id": rzp_account_id},
            {"$set": {
                "razorpay_account_status": "rejected",
                "bank_account_verified": False,
                "status": "pending_verification",
                "updated_at": now,
            }}
        )
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": linked["user_id"],
            "type": "bank_verification_failed",
            "title": "Bank Verification Failed",
            "message": "Your bank account verification failed. Please re-enter your bank details.",
            "is_read": False,
            "created_at": now,
        })

    asyncio.create_task(update_webhook_log(log_id, "success"))
    return {"ok": True, "event": event}


# ─── Daily Cron Jobs ───────────────────────────────────────────────────────

async def run_bank_verification_sync():
    """Fallback: Poll Razorpay for accounts still pending verification."""
    pending = await db.linked_accounts.find(
        {"bank_account_verified": {"$ne": True}, "razorpay_account_id": {"$ne": None}},
        {"_id": 0}
    ).to_list(100)
    rzp = await get_razorpay_client()
    if not rzp:
        return
    for la in pending:
        try:
            account = rzp.account.fetch(la["razorpay_account_id"])
            rzp_status = account.get("status", "")
            if rzp_status == "activated" and not la.get("bank_account_verified"):
                await db.linked_accounts.update_one(
                    {"id": la["id"]},
                    {"$set": {"razorpay_account_status": "active", "bank_account_verified": True, "status": "active", "updated_at": now_ist().isoformat()}}
                )
                await db.notifications.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": la["user_id"],
                    "type": "bank_verified",
                    "title": "Bank Account Verified",
                    "message": "Your bank account is verified. Payouts are now enabled.",
                    "is_read": False,
                    "created_at": now_ist().isoformat(),
                })
        except Exception as e:
            logger.warning(f"Bank sync failed for {la['user_id']}: {e}")


async def run_stuck_payout_sync():
    """Fallback: Check transfers stuck in 'processing' for >24h."""
    cutoff = (now_ist() - timedelta(hours=24)).isoformat()
    stuck = await db.settlements.find(
        {"status": "processing", "created_at": {"$lt": cutoff}},
        {"_id": 0}
    ).to_list(50)
    rzp = await get_razorpay_client()
    if not rzp:
        return
    for s in stuck:
        try:
            transfer_id = s.get("razorpay_transfer_id")
            if not transfer_id:
                continue
            transfer = rzp.transfer.fetch(transfer_id)
            t_status = transfer.get("status", "")
            now = now_ist().isoformat()
            if t_status == "processed":
                await db.settlements.update_one(
                    {"id": s["id"]},
                    {"$set": {"transfer_status": "processed", "status": "completed", "transfer_utr": transfer.get("utr", ""), "updated_at": now}}
                )
                logger.info(f"Stuck payout sync: settlement {s['id']} marked completed")
            elif t_status == "failed":
                await db.settlements.update_one(
                    {"id": s["id"]},
                    {"$set": {"transfer_status": "failed", "status": "failed", "failed_reason": transfer.get("failure_reason", "Transfer failed"), "updated_at": now}}
                )
                # Unstamp source documents
                for item in s.get("line_items", []):
                    collection = {"coaching_session": "coaching_sessions", "coaching_subscription": "coaching_subscriptions", "venue_booking": "bookings"}.get(item["type"])
                    if collection:
                        await db[collection].update_one({"id": item["ref_id"]}, {"$unset": {"settlement_id": ""}})
                # Revert deductions
                deduction_ids = [d["id"] for d in s.get("deductions", [])]
                if deduction_ids:
                    await db.payout_deductions.update_many(
                        {"id": {"$in": deduction_ids}},
                        {"$set": {"deduction_status": "pending", "applied_settlement_id": None}}
                    )
                logger.warning(f"Stuck payout sync: settlement {s['id']} marked failed")
        except Exception as e:
            logger.warning(f"Stuck payout sync failed for settlement {s['id']}: {e}")


async def run_stuck_refund_sync():
    """Fallback: Check refunds stuck in 'pending' for >24h."""
    cutoff = (now_ist() - timedelta(hours=24)).isoformat()
    stuck = await db.bookings.find(
        {"refund_status": "pending", "refund_created_at": {"$lt": cutoff}},
        {"_id": 0, "id": 1, "razorpay_refund_id": 1, "host_id": 1, "refund_amount": 1}
    ).to_list(50)
    rzp = await get_razorpay_client()
    if not rzp:
        return
    for b in stuck:
        try:
            refund_id = b.get("razorpay_refund_id")
            if not refund_id or (isinstance(refund_id, str) and refund_id.startswith("failed:")):
                continue
            # Handle single or first refund_id (for split, check the first one)
            check_id = refund_id if isinstance(refund_id, str) else refund_id[0] if isinstance(refund_id, list) and refund_id else None
            if not check_id or check_id.startswith("failed:"):
                continue
            refund = rzp.refund.fetch(check_id)
            status = refund.get("status", "")
            if status == "processed":
                await db.bookings.update_one({"id": b["id"]}, {"$set": {"refund_status": "processed"}})
                await db.notifications.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": b.get("host_id", ""),
                    "type": "refund_processed",
                    "title": "Refund Processed",
                    "message": f"Your refund of ₹{b.get('refund_amount', 0):,} has been processed.",
                    "is_read": False,
                    "created_at": now_ist().isoformat(),
                })
            elif status == "failed":
                await db.bookings.update_one({"id": b["id"]}, {"$set": {"refund_status": "failed"}})
                # Notify admin
                admins = await db.users.find({"role": "super_admin"}, {"id": 1}).to_list(10)
                for admin in admins:
                    await db.notifications.insert_one({
                        "id": str(uuid.uuid4()),
                        "user_id": admin["id"],
                        "type": "refund_failed",
                        "title": "Refund Failed — Manual Action Needed",
                        "message": f"Refund for booking {b['id']} failed after 24h. Amount: ₹{b.get('refund_amount', 0):,}.",
                        "is_read": False,
                        "created_at": now_ist().isoformat(),
                    })
        except Exception as e:
            logger.warning(f"Stuck refund sync failed for booking {b['id']}: {e}")
