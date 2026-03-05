# Horizon Payout System — Complete Implementation Plan

> **Date:** 2026-03-05
> **Status:** Awaiting approval
> **Scope:** Bank account fix, refund system, clawback deductions, settlement improvements, frontend dashboard

---

## Current State Summary

| What | Status |
|------|--------|
| `rzp.account.create()` (Route account) | Done — `payouts.py:72` |
| Bank details sent to Razorpay | **MISSING** — stored locally only (masked) |
| Bank verification webhook | **MISSING** — no `account.*` handler |
| Razorpay refund on cancel | **MISSING** — no `rzp.payment.refund()` anywhere |
| Refund % based on time | **MISSING** — no time-tier logic |
| Post-payout clawback | **MISSING** — no `payout_deductions` collection |
| Settlement deduction math | **MISSING** — only positive amounts |
| Payout guard (bank verified?) | **PARTIAL** — pending list filters active, but settlement endpoint doesn't explicitly block |
| Venue finance clawback UI | **MISSING** — no deduction tab |

---

## New Collections

### 1. `payout_deductions`
Created when a booking is cancelled AFTER its payout has already been processed.

```json
{
  "id": "uuid",
  "venue_owner_id": "user-uuid",
  "venue_id": "venue-uuid",
  "booking_id": "booking-uuid",
  "original_settlement_id": "settlement-uuid",
  "booking_amount": 2000,
  "commission_amount": 200,
  "player_refund_amount": 1800,
  "venue_clawback_amount": 1800,
  "refund_pct": 100,
  "deduction_status": "pending",
  "applied_settlement_id": null,
  "created_at": "IST ISO8601"
}
```
**Statuses:** `pending` → `applied` (included in next settlement) → or `reversed` (if settlement fails)

### 2. `finance_events`
Append-only audit trail for every financial action. Used for reconciliation and debugging.

```json
{
  "id": "uuid",
  "event_type": "booking_cancelled_post_payout",
  "actor_id": "user-uuid",
  "owner_id": "venue-owner-uuid",
  "booking_id": "booking-uuid",
  "settlement_id": "settlement-uuid",
  "amount": 1800,
  "metadata": {},
  "created_at": "IST ISO8601"
}
```
**Event types:**
- `booking_payment_captured`
- `booking_cancelled_pre_payout`
- `booking_cancelled_post_payout`
- `refund_initiated`, `refund_processed`, `refund_failed`
- `payout_initiated`, `payout_completed`, `payout_failed`, `payout_rolled_back`
- `deduction_created`, `deduction_applied`

**Write pattern:** Fire-and-forget (`asyncio.create_task`) — never block the user request.

### 3. `webhook_logs`
Raw log of every incoming Razorpay webhook for debugging and replay.

```json
{
  "id": "uuid",
  "source": "razorpay",
  "event_type": "transfer.processed",
  "payload": { "...raw webhook body..." },
  "received_at": "IST ISO8601",
  "processed_status": "success",
  "error_message": ""
}
```
**Statuses:** `success` | `failed` | `skipped` | `signature_mismatch`

### 4. `linked_accounts` — New Fields (existing collection)
```
razorpay_bank_account_id    ← NEW (from Razorpay bank_accounts API response)
bank_account_verified       ← NEW boolean (true when Razorpay confirms)
```

### 5. `bookings` — New Fields on Cancel (existing collection)
```
refund_amount               ← amount refunded to player
refund_pct                  ← 100 / 50 / 0
refund_status               ← "pending" / "processed" / "failed" / "not_applicable"
razorpay_refund_id          ← Razorpay refund ID
refund_created_at           ← IST ISO8601
cancelled_at                ← IST ISO8601
cancelled_by                ← user ID who cancelled
```

---

## PART 1 — Razorpay Bank Account Fix

### Step 1 — Add Bank Details API Call

**File:** `backend/routes/payouts.py` → `create_linked_account()` (line 27)

**Current:** Only calls `rzp.account.create()` — sends email, phone, business info. Bank details (account_number, IFSC) saved locally only (masked).

**Change:** After `rzp.account.create()` succeeds, make a second API call:

```python
# After line 74 (rzp_account_id obtained)
# Call 2: Add bank account to the Route account
if rzp_account_id:
    try:
        bank_resp = rzp.account.bank_account.create(rzp_account_id, {
            "beneficiary_name": beneficiary_name,
            "account_type": "current",  # or "savings" based on business_type
            "account_number": account_number,   # FULL number to Razorpay
            "ifsc_code": ifsc_code,
        })
        rzp_bank_account_id = bank_resp.get("id")
    except Exception as e:
        logger.warning(f"Bank account creation on Razorpay failed: {e}")
        rzp_bank_account_id = None
```

**Store in linked_accounts document:**
```python
"razorpay_bank_account_id": rzp_bank_account_id,
"bank_account_verified": False,  # Will be set true via webhook
```

**Same change for `update_linked_account()` (line 116):** When bank details change, call Razorpay again to update.

**Note:** `account_number` goes to Razorpay as-is (full). DB stores only masked `****1234`.

---

### Step 2 — Bank Verification Webhook

**File:** `backend/routes/payouts.py` → NEW endpoint

**Endpoint:** `POST /payouts/webhook/razorpay-account`

```python
@router.post("/webhook/razorpay-account")
async def razorpay_account_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    # 1. Log to webhook_logs immediately
    log_id = str(uuid.uuid4())
    import json as _json
    try:
        payload = _json.loads(body)
    except:
        payload = {}
    asyncio.create_task(_log_webhook(log_id, "razorpay", payload.get("event", ""), payload))

    # 2. Verify HMAC signature
    settings = await get_platform_settings()
    webhook_secret = settings.get("payment_gateway", {}).get("account_webhook_secret", "")
    if webhook_secret and signature:
        expected = hmac.new(webhook_secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            asyncio.create_task(_update_webhook_log(log_id, "signature_mismatch"))
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
        # Notify venue owner
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": linked["user_id"],
            "type": "bank_verified",
            "title": "Bank Account Verified",
            "message": "Your bank account is verified. Payouts are now enabled.",
            "is_read": False,
            "created_at": now,
        })
        asyncio.create_task(_log_finance_event(
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

    asyncio.create_task(_update_webhook_log(log_id, "success"))
    return {"ok": True, "event": event}
```

**Register in `server.py`:** Already registered — payouts router is included.

**New webhook secret field in platform_settings:** `payment_gateway.account_webhook_secret`

**IMPORTANT — Also update `seed.py` (line 35):**
Current seed has incomplete payment_gateway:
```python
"payment_gateway": {"provider": "razorpay", "key_id": "", "key_secret": "", "is_live": False}
```
**Change to:**
```python
"payment_gateway": {
    "provider": "razorpay",
    "key_id": "",
    "key_secret": "",
    "webhook_secret": "",
    "account_webhook_secret": "",
    "transfer_webhook_secret": "",
    "is_live": False,
}
```
This ensures all three webhook secrets exist in the document from seed, so `.get()` calls don't silently fail.

---

### Step 3 — Daily Cron Jobs

**File:** `backend/routes/payouts.py` → 3 new async functions (no new file needed)

**Registration:** Add to `server.py` scheduler (line 236 area)

#### Job 1 — Bank Verification Fallback (daily 10:00 AM)
```python
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
                # Notify
                await db.notifications.insert_one({...})
        except Exception as e:
            logger.warning(f"Bank sync failed for {la['user_id']}: {e}")
```

#### Job 2 — Stuck Payout Sync (daily 10:30 AM)
```python
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
            transfer = rzp.transfer.fetch(s["razorpay_transfer_id"])
            # Update based on actual Razorpay status
            # (same logic as transfer webhook handler)
        except Exception as e:
            logger.warning(f"Stuck payout sync failed for settlement {s['id']}: {e}")
```

#### Job 3 — Stuck Refund Sync (daily 11:00 AM)
```python
async def run_stuck_refund_sync():
    """Fallback: Check refunds stuck in 'pending' for >24h."""
    cutoff = (now_ist() - timedelta(hours=24)).isoformat()
    stuck = await db.bookings.find(
        {"refund_status": "pending", "refund_created_at": {"$lt": cutoff}},
        {"_id": 0, "id": 1, "razorpay_refund_id": 1}
    ).to_list(50)
    rzp = await get_razorpay_client()
    if not rzp:
        return
    for b in stuck:
        try:
            refund = rzp.refund.fetch(b["razorpay_refund_id"])
            status = refund.get("status", "")
            if status == "processed":
                await db.bookings.update_one({"id": b["id"]}, {"$set": {"refund_status": "processed"}})
            elif status == "failed":
                await db.bookings.update_one({"id": b["id"]}, {"$set": {"refund_status": "failed"}})
                # Notify admin
        except Exception as e:
            logger.warning(f"Stuck refund sync failed for booking {b['id']}: {e}")
```

**server.py additions (line ~241):**
```python
from routes.payouts import run_bank_verification_sync, run_stuck_payout_sync, run_stuck_refund_sync

scheduler.add_job(run_bank_verification_sync, "cron", hour=10, minute=0,  id="bank_verify_sync",  replace_existing=True)
scheduler.add_job(run_stuck_payout_sync,      "cron", hour=10, minute=30, id="stuck_payout_sync", replace_existing=True)
scheduler.add_job(run_stuck_refund_sync,       "cron", hour=11, minute=0,  id="stuck_refund_sync", replace_existing=True)
```

---

### Step 4 — Shared Finance Helpers (New File)

**File:** `backend/routes/finance_utils.py` ← **NEW shared file**

**Why:** `_log_finance_event` is needed in both `payouts.py` and `bookings.py`. Putting it in either file causes circular imports (`server.py` imports both routers). Shared utility file avoids this.

```python
"""Shared finance helpers — used by both payouts.py and bookings.py."""
from database import db
from tz import now_ist
import uuid
import logging

logger = logging.getLogger(__name__)


async def log_webhook(log_id, source, event_type, payload):
    """Log webhook to webhook_logs collection (fire-and-forget)."""
    try:
        await db.webhook_logs.insert_one({
            "id": log_id,
            "source": source,
            "event_type": event_type,
            "payload": payload,
            "received_at": now_ist().isoformat(),
            "processed_status": "pending",
            "error_message": "",
        })
    except Exception as e:
        logger.warning(f"Failed to log webhook: {e}")


async def update_webhook_log(log_id, status, error=""):
    try:
        await db.webhook_logs.update_one(
            {"id": log_id}, {"$set": {"processed_status": status, "error_message": error}}
        )
    except Exception:
        pass


async def log_finance_event(event_type, actor_id, owner_id, booking_id=None, settlement_id=None, amount=0, metadata=None):
    """Log to finance_events collection (fire-and-forget)."""
    try:
        await db.finance_events.insert_one({
            "id": str(uuid.uuid4()),
            "event_type": event_type,
            "actor_id": actor_id,
            "owner_id": owner_id,
            "booking_id": booking_id,
            "settlement_id": settlement_id,
            "amount": amount,
            "metadata": metadata or {},
            "created_at": now_ist().isoformat(),
        })
    except Exception as e:
        logger.warning(f"Failed to log finance event: {e}")
```

**Import in both files:**
```python
# In payouts.py:
from routes.finance_utils import log_webhook, update_webhook_log, log_finance_event

# In bookings.py:
from routes.finance_utils import log_webhook, update_webhook_log, log_finance_event
```

**Apply to existing transfer webhook (line 739):** Add `log_webhook` call at top of `razorpay_transfer_webhook()`.

---

### Step 5 — Payout Guard (Triple Check)

**File:** `backend/routes/payouts.py` → `create_settlement()` (line 358)

**Current (line 375-377):** Only checks if linked account exists.

**Change:** Add after line 377:

```python
# Guard 1: linked account exists? (already here — line 376-377)

# Guard 2: Razorpay account active?
if linked.get("razorpay_account_status") != "active":
    raise HTTPException(400, "Bank account verification pending. Payout blocked until Razorpay activates the account.")

# Guard 3: Bank account verified?
if not linked.get("bank_account_verified"):
    raise HTTPException(400, "Bank account not verified by Razorpay. Payout blocked.")
```

**Same guard in `_process_single_settlement()` (line 530)** and `bulk_settle()` loop.

---

## PART 2 — Cancellation + Refund System

### Step 6 — Cancel Handler Guard Layer

**File:** `backend/routes/bookings.py` → `cancel_booking()` (line 517)

**Current flow:** exists → auth → status check → time check → atomic cancel

**Change:** Make the flow:

```python
@router.post("/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: str, user=Depends(get_current_user)):
    # Guard 1: Booking exists
    booking = await db.bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(404, "Booking not found")

    # Guard 2: Auth — host or venue owner only (NO admin/super_admin)
    is_host = booking["host_id"] == user["id"]
    is_venue_owner = False
    if user.get("role") == "venue_owner":
        venue = await db.venues.find_one({"id": booking["venue_id"], "owner_id": user["id"]}, {"_id": 0, "id": 1})
        is_venue_owner = venue is not None
    if not (is_host or is_venue_owner):
        raise HTTPException(403, "Only the host or venue owner can cancel")

    # Guard 3: Idempotent — already cancelled? Return success, don't error
    if booking.get("status") == "cancelled":
        return {"message": "Booking already cancelled"}

    # Guard 4: Terminal state
    if booking.get("status") == "expired":
        raise HTTPException(400, "Booking is already expired")

    # Guard 5: Time check — can't cancel if slot time has passed
    booking_start = parse_ist(booking["date"], booking["start_time"])
    if booking_start <= now_ist():
        raise HTTPException(400, "Cannot cancel a booking that has already started")

    # Atomic cancel
    result = await db.bookings.update_one(
        {"id": booking_id, "status": {"$nin": ["cancelled", "expired"]}},
        {"$set": {"status": "cancelled", "cancelled_at": now_ist().isoformat(), "cancelled_by": user["id"]}}
    )
    if result.modified_count == 0:
        return {"message": "Booking already cancelled"}  # Race condition — still idempotent

    # ... (counter decrements, lock release, refund logic — see steps 7-11)
```

**Key changes from current:**
- Idempotent: already-cancelled returns success (not 400 error)
- Added `cancelled_at` and `cancelled_by` fields
- Uses `parse_ist()` from `tz.py` instead of inline parsing

---

### Step 7 — Refund Amount Calculation

**File:** `backend/routes/bookings.py` → inside `cancel_booking()`, after atomic cancel

**All timestamps use IST** (project convention).

```python
# Calculate refund percentage based on hours until booking starts
hours_until_slot = (booking_start - now_ist()).total_seconds() / 3600

if hours_until_slot >= 24:
    refund_pct = 100
elif hours_until_slot >= 4:
    refund_pct = 50
else:
    refund_pct = 0

refund_amount = round(booking.get("total_amount", 0) * refund_pct / 100)
```

**Store on booking:**
```python
await db.bookings.update_one({"id": booking_id}, {"$set": {
    "refund_pct": refund_pct,
    "refund_amount": refund_amount,
}})
```

---

### Step 8 — Razorpay Refund Call

**File:** `backend/routes/bookings.py` → inside `cancel_booking()`, after refund % calculated

```python
# Validation 1: Test/mock booking → skip Razorpay refund
if booking.get("payment_gateway") in ("test", "mock"):
    await db.bookings.update_one({"id": booking_id}, {"$set": {"refund_status": "not_applicable"}})

# Validation 2: 0% refund → skip
elif refund_amount <= 0:
    await db.bookings.update_one({"id": booking_id}, {"$set": {"refund_status": "not_applicable"}})

# Validation 3: Already refunding → skip
elif booking.get("refund_status") in ("pending", "processed"):
    pass  # Don't double-refund

# All validations pass → call Razorpay
else:
    rzp = await get_razorpay_client()
    if rzp:
        try:
            refund_ids = []

            if booking.get("split_config"):
                # ── SPLIT PAYMENT: refund each payer separately ──
                split_payments = await db.split_payments.find(
                    {"booking_id": booking_id, "status": "paid", "razorpay_payment_id": {"$exists": True, "$ne": ""}},
                    {"_id": 0}
                ).to_list(20)

                if split_payments:
                    per_payer_refund = refund_amount // len(split_payments)
                    # Last payer gets remainder to avoid rounding loss
                    remainder = refund_amount - (per_payer_refund * (len(split_payments) - 1))

                    for idx, sp in enumerate(split_payments):
                        payer_refund = remainder if idx == len(split_payments) - 1 else per_payer_refund
                        if payer_refund <= 0:
                            continue
                        try:
                            resp = rzp.payment.refund(sp["razorpay_payment_id"], {
                                "amount": payer_refund * 100,
                                "notes": {"booking_id": booking_id, "payer": sp.get("payer_name", ""), "reason": "booking_cancellation"},
                            })
                            refund_ids.append(resp.get("id"))
                            await db.split_payments.update_one(
                                {"id": sp["id"]},
                                {"$set": {"status": "refunded", "refund_id": resp.get("id"), "refund_amount": payer_refund}}
                            )
                        except Exception as e:
                            logger.error(f"Split refund failed for payer {sp.get('payer_name')}: {e}")
                            refund_ids.append(f"failed:{sp['id']}")
                else:
                    # Fallback: split payments don't have razorpay_payment_id (test mode splits)
                    await db.bookings.update_one({"id": booking_id}, {"$set": {"refund_status": "not_applicable"}})
                    refund_ids = None  # Skip further processing

            else:
                # ── SINGLE PAYMENT: refund the one payment_id ──
                payment_id = (booking.get("payment_details") or {}).get("razorpay_payment_id")
                if not payment_id:
                    await db.bookings.update_one({"id": booking_id}, {"$set": {"refund_status": "not_applicable"}})
                    refund_ids = None
                else:
                    resp = rzp.payment.refund(payment_id, {
                        "amount": refund_amount * 100,
                        "notes": {"booking_id": booking_id, "reason": "booking_cancellation"},
                    })
                    refund_ids = [resp.get("id")]

            # Update booking with refund info
            if refund_ids is not None:
                failed_count = sum(1 for r in refund_ids if r.startswith("failed:"))
                await db.bookings.update_one({"id": booking_id}, {"$set": {
                    "razorpay_refund_id": refund_ids[0] if len(refund_ids) == 1 else refund_ids,
                    "refund_status": "pending" if failed_count == 0 else "partial_failed",
                    "refund_created_at": now_ist().isoformat(),
                }})
                asyncio.create_task(log_finance_event(
                    "refund_initiated", user["id"], booking.get("venue_id"),
                    booking_id=booking_id, amount=refund_amount,
                    metadata={"split": bool(booking.get("split_config")), "refund_ids": refund_ids},
                ))
                # Notify player
                await db.notifications.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": booking["host_id"],
                    "type": "refund_initiated",
                    "title": "Refund Initiated",
                    "message": f"Refund of ₹{refund_amount:,} initiated for your cancelled booking. 3-5 business days.",
                    "is_read": False,
                    "created_at": now_ist().isoformat(),
                })

        except Exception as e:
            logger.error(f"Razorpay refund failed for booking {booking_id}: {e}")
            await db.bookings.update_one({"id": booking_id}, {"$set": {"refund_status": "failed"}})
            asyncio.create_task(log_finance_event(
                "refund_failed", user["id"], booking.get("venue_id"),
                booking_id=booking_id, amount=refund_amount,
                metadata={"error": str(e)},
            ))
            # Notify admin — NO auto retry (duplicate refund risk)
            admins = await db.users.find({"role": "super_admin"}, {"id": 1}).to_list(10)
            for admin in admins:
                await db.notifications.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": admin["id"],
                    "type": "refund_failed",
                    "title": "Refund Failed — Manual Action Needed",
                    "message": f"Razorpay refund failed for booking {booking_id}. Amount: ₹{refund_amount:,}. Error: {str(e)[:100]}",
                    "is_read": False,
                    "created_at": now_ist().isoformat(),
                })
    else:
        await db.bookings.update_one({"id": booking_id}, {"$set": {"refund_status": "not_applicable"}})
```

**Split refund logic:** Each split payer has their own `razorpay_payment_id` in the `split_payments` collection. Refund is split proportionally. Last payer gets remainder (avoids rounding loss — same pattern as split payment collection).

**Critical: NO auto-retry** — duplicate refunds are worse than a delayed manual refund.

---

### Step 9 — Refund Status Webhook

**File:** `backend/routes/bookings.py` → extend existing `razorpay_webhook()` (line 382)

Add handling for `refund.processed` and `refund.failed` events alongside existing `payment.captured`:

```python
# Inside razorpay_webhook(), after the payment.captured block (line 474):

elif event == "refund.processed":
    refund_entity = payload.get("payload", {}).get("refund", {}).get("entity", {})
    payment_id = refund_entity.get("payment_id", "")
    if payment_id:
        booking = await db.bookings.find_one(
            {"payment_details.razorpay_payment_id": payment_id, "refund_status": "pending"}
        )
        if booking:
            await db.bookings.update_one(
                {"id": booking["id"]},
                {"$set": {"refund_status": "processed"}}
            )
            asyncio.create_task(_log_finance_event(
                "refund_processed", "system", booking.get("venue_id"),
                booking_id=booking["id"], amount=booking.get("refund_amount", 0),
            ))
            # Notify player
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": booking["host_id"],
                "type": "refund_processed",
                "title": "Refund Processed",
                "message": f"Your refund of ₹{booking.get('refund_amount', 0):,} has been processed.",
                "is_read": False,
                "created_at": now_ist().isoformat(),
            })

elif event == "refund.failed":
    refund_entity = payload.get("payload", {}).get("refund", {}).get("entity", {})
    payment_id = refund_entity.get("payment_id", "")
    if payment_id:
        booking = await db.bookings.find_one(
            {"payment_details.razorpay_payment_id": payment_id, "refund_status": "pending"}
        )
        if booking:
            await db.bookings.update_one(
                {"id": booking["id"]},
                {"$set": {"refund_status": "failed"}}
            )
            # Notify admin
```

**Add webhook logging** to the existing `razorpay_webhook()` — same `_log_webhook` pattern.

---

### Step 10 — Post-Payout Deduction Record

**File:** `backend/routes/bookings.py` → inside `cancel_booking()`, after refund logic

```python
# Check if booking was already settled (payout already sent to venue owner)
if booking.get("settlement_id"):
    # POST-PAYOUT cancellation — venue owner already received money
    # Create clawback deduction record
    venue = await db.venues.find_one({"id": booking["venue_id"]}, {"_id": 0, "owner_id": 1})
    owner_id = (venue or {}).get("owner_id")

    if owner_id and refund_amount > 0:
        deduction = {
            "id": str(uuid.uuid4()),
            "venue_owner_id": owner_id,
            "venue_id": booking["venue_id"],
            "booking_id": booking_id,
            "original_settlement_id": booking["settlement_id"],
            "booking_amount": booking.get("total_amount", 0),
            "commission_amount": booking.get("commission_amount", 0),
            "player_refund_amount": refund_amount,
            "venue_clawback_amount": refund_amount,  # Same as player refund — venue loses what player gets back
            "refund_pct": refund_pct,
            "deduction_status": "pending",
            "applied_settlement_id": None,
            "created_at": now_ist().isoformat(),
        }
        await db.payout_deductions.insert_one(deduction)

        asyncio.create_task(_log_finance_event(
            "deduction_created", user["id"], owner_id,
            booking_id=booking_id, settlement_id=booking["settlement_id"],
            amount=refund_amount,
        ))

        # Notify venue owner
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": owner_id,
            "type": "booking_clawback",
            "title": "Booking Cancelled — Deduction Applied",
            "message": f"Booking on {booking['date']} {booking['start_time']} was cancelled. ₹{refund_amount:,} will be adjusted in your next payout.",
            "is_read": False,
            "created_at": now_ist().isoformat(),
        })

else:
    # PRE-PAYOUT cancellation — booking not yet settled
    # No deduction record needed — cancelled bookings are auto-excluded
    # from settlement query (status filter: confirmed/completed only)
    asyncio.create_task(_log_finance_event(
        "booking_cancelled_pre_payout", user["id"], booking.get("venue_id"),
        booking_id=booking_id, amount=booking.get("total_amount", 0),
    ))
```

---

## PART 3 — Settlement System Changes

### Step 11 — Settlement Lock + Idempotency

**File:** `backend/routes/payouts.py` → `create_settlement()` (line 358)

**Add before the unsettled items fetch (after line 377):**

```python
# Lock check — prevent two admins processing same venue owner simultaneously
lock_until = linked.get("settlement_lock_until", "")
if lock_until and lock_until > now_ist().isoformat():
    raise HTTPException(400, f"Payout already in progress for this user. Try after lock expires.")

# Set lock (5-minute TTL)
await db.linked_accounts.update_one(
    {"user_id": target_user_id},
    {"$set": {"settlement_lock_until": (now_ist() + timedelta(minutes=5)).isoformat()}}
)

# Idempotency check — period-based, not time-based
existing_settlement = await db.settlements.find_one({
    "user_id": target_user_id,
    "period_start": period_start,
    "period_end": period_end,
    "status": {"$nin": ["failed"]},
})
if existing_settlement:
    # Clear lock and return existing
    await db.linked_accounts.update_one(
        {"user_id": target_user_id}, {"$unset": {"settlement_lock_until": ""}}
    )
    return existing_settlement  # Don't create duplicate

# Payout guards (Step 5 — see above)
```

**Clear lock at end of settlement (success or failure):**
```python
# After settlement insert + stamping (line ~477):
await db.linked_accounts.update_one(
    {"user_id": target_user_id}, {"$unset": {"settlement_lock_until": ""}}
)
```

**Why lock on `linked_accounts` instead of a separate collection?**
One document per user already exists. Adding a field avoids a new collection. TTL ensures auto-expiry if process crashes.

---

### Step 12 — Settlement Calculation with Deductions

**File:** `backend/routes/payouts.py` → `_get_unsettled_venue_items()` (line 225)

**Current:** Only fetches positive bookings.

**Change `create_settlement()` (line 390 area):**

```python
# Existing: positive items
gross = sum(i["amount"] for i in items)
commission = sum(i["commission"] for i in items)
positive_net = sum(i["net"] for i in items)

# NEW: fetch pending deductions for this venue owner
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
        # Otherwise they stay "pending" forever and block all future settlements
        deduction_ids = [d["id"] for d in deductions]
        await db.payout_deductions.update_many(
            {"id": {"$in": deduction_ids}},
            {"$set": {"deduction_status": "applied", "applied_settlement_id": "carried_forward"}}
        )
        asyncio.create_task(log_finance_event(
            "negative_balance_carried_forward", user["id"], target_user_id,
            amount=net, metadata={"positive": positive_net, "deductions": total_deductions},
        ))
        # Notify venue owner
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": target_user_id,
            "type": "deduction_carried_forward",
            "title": "Payout Adjustment",
            "message": f"Deductions (₹{total_deductions:,}) exceed current earnings (₹{positive_net:,}). Remaining ₹{abs(net):,} carried to next cycle.",
            "is_read": False,
            "created_at": now_ist().isoformat(),
        })
        # Clear settlement lock
        await db.linked_accounts.update_one(
            {"user_id": target_user_id}, {"$unset": {"settlement_lock_until": ""}}
        )
        raise HTTPException(400, f"Net amount after deductions is ₹{net}. Deductions applied and carried forward.")
    else:
        raise HTTPException(400, "No pending items to settle")
```

**Store deduction info in settlement:**
```python
settlement["deductions"] = [
    {"id": d["id"], "booking_id": d["booking_id"], "amount": d["venue_clawback_amount"]}
    for d in deductions
]
settlement["total_deductions"] = total_deductions
settlement["net_amount"] = net  # Already deduction-adjusted
```

---

### Step 13 — Mark Deductions as Applied

**File:** `backend/routes/payouts.py` → after settlement success (line 457 area)

**Add alongside existing stamping logic:**

```python
# Existing: stamp bookings/sessions/subscriptions with settlement_id

# NEW: mark deductions as applied
if deductions and settlement["status"] != "failed":
    deduction_ids = [d["id"] for d in deductions]
    await db.payout_deductions.update_many(
        {"id": {"$in": deduction_ids}},
        {"$set": {
            "deduction_status": "applied",
            "applied_settlement_id": settlement_id,
        }}
    )
```

**On settlement failure/rollback (transfer webhook, line 780-840):**

```python
# Existing: unstamp bookings

# NEW: revert deductions back to pending
deduction_ids = [d["id"] for d in settlement.get("deductions", [])]
if deduction_ids:
    await db.payout_deductions.update_many(
        {"id": {"$in": deduction_ids}},
        {"$set": {"deduction_status": "pending", "applied_settlement_id": None}}
    )
```

---

### Step 14 — Same Changes for Bulk Settlement

**File:** `backend/routes/payouts.py` → `_process_single_settlement()` (line 530)

Apply the same changes:
1. Payout guard (bank_account_verified check)
2. Fetch pending deductions
3. Calculate net with deductions
4. Store deductions in settlement
5. Mark deductions as applied on success

---

## PART 4 — Frontend Updates

### Step 15 — VenueFinancePage Payout Tab Enhancements

**File:** `frontend/src/pages/VenueFinancePage.js`

#### A. Bank Account Status Badge
**Current:** Shows "active" or "pending" badge.
**Change:** Show 3 states:
- Verified (green) — `bank_account_verified === true`
- Pending Verification (yellow) — `bank_account_verified === false && status !== "rejected"`
- Failed (red) — `razorpay_account_status === "rejected"` + "Re-enter bank details" button

#### B. Deductions Section (new)
Add below payout summary cards:

```
If pending deductions exist:
  ┌─────────────────────────────────────────────────────┐
  │ ⚠️ Pending Deductions: ₹{total}                     │
  │ These will be subtracted from your next payout.      │
  │                                                      │
  │ Booking: 2026-03-01 15:00  |  Cancelled  |  -₹1,800 │
  │ Booking: 2026-03-02 18:00  |  Cancelled  |  -₹900   │
  └─────────────────────────────────────────────────────┘
```

#### C. Settlement Detail — Show Deductions
In payout detail dialog, add:
```
Gross Amount:       ₹5,000
Commission (10%):   -₹500
Deductions:         -₹1,800    ← NEW
─────────────────────────
Net Payout:          ₹2,700
```

#### D. API Changes
**File:** `frontend/src/lib/api.js`

Add to `payoutAPI`:
```javascript
myDeductions: () => api.get("/payouts/my-deductions"),
```

**Backend endpoint needed:**
```python
@router.get("/my-deductions")
async def my_deductions(user=Depends(get_current_user)):
    """Venue owner: List their pending and applied deductions."""
    deductions = await db.payout_deductions.find(
        {"venue_owner_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    pending_total = sum(d["venue_clawback_amount"] for d in deductions if d["deduction_status"] == "pending")
    return {"deductions": deductions, "pending_total": pending_total}
```

#### E. Fix `my-summary` Endpoint — Show Deduction-Adjusted Pending Amount

**File:** `backend/routes/payouts.py` → `my_payout_summary()` (line 657)

**Current:** Returns `pending_settlement` = raw pending_net (no deductions).

**Change:** After pending items calculation, also fetch deductions:

```python
# After line 688:
# NEW: fetch pending deductions
pending_deductions = await db.payout_deductions.find(
    {"venue_owner_id": user_id, "deduction_status": "pending"},
    {"_id": 0, "venue_clawback_amount": 1}
).to_list(100)
total_pending_deductions = sum(d["venue_clawback_amount"] for d in pending_deductions)

# In response, replace "pending_settlement" line:
"pending_settlement": pending_net - total_pending_deductions,
"pending_deductions": total_pending_deductions,
"pending_settlement_before_deductions": pending_net,
```

This way the dashboard shows the **actual** amount the venue owner will receive, not the inflated number.

---

## Database Indexes

**File:** `backend/indexes.py`

Add:
```python
# Payout deductions
await db.payout_deductions.create_index("venue_owner_id")
await db.payout_deductions.create_index("deduction_status")
await db.payout_deductions.create_index([("venue_owner_id", 1), ("deduction_status", 1)])

# Finance events
await db.finance_events.create_index("owner_id")
await db.finance_events.create_index("booking_id")
await db.finance_events.create_index("created_at")

# Webhook logs
await db.webhook_logs.create_index("event_type")
await db.webhook_logs.create_index("received_at")

# Linked accounts — bank verification
await db.linked_accounts.create_index("razorpay_account_id", unique=True, sparse=True)

# Bookings — refund status
await db.bookings.create_index("refund_status", sparse=True)
```

---

## Architecture Notes

### Timestamps: IST Everywhere
All timestamps use `now_ist()` from `tz.py`. No UTC anywhere. This matches the entire codebase convention. Financial calculations (hours_until_slot) work correctly because both sides are IST.

### Cancel Permission: Host + Venue Owner Only
No admin/super_admin cancel permission. This was explicitly decided in the previous session.

### No MongoDB Transactions
The current codebase uses zero multi-document transactions. This plan avoids introducing them. Instead:
- Atomic `update_one` with conditions (already used)
- Idempotent operations (re-runnable safely)
- Rollback via explicit reversal (unstamp settlement_id, revert deduction status)

### Finance Events: Fire-and-Forget
All `_log_finance_event()` calls use `asyncio.create_task()` — the main request never waits for audit log writes. If the log write fails, it's logged to stderr but doesn't affect the user.

### No Auto-Retry for Refunds
Razorpay refund failures are NOT automatically retried. Duplicate refunds are worse than delayed refunds. Admin is notified to handle manually. Daily cron (Job 3) catches stuck refunds.

### venue_balance Collection — NOT Included
The original plan proposed a `venue_balance` running total collection. This is **removed** because:
1. Calculated amount (from bookings + deductions) is the source of truth
2. A running total can drift if any update point is missed
3. The `my-summary` endpoint already computes balance on-the-fly
4. If performance becomes an issue later, add it as a **cache** with reconciliation — not as primary source

---

## Implementation Order

| # | Task | Files |
|---|------|-------|
| 1 | Shared finance helpers (new file) | `finance_utils.py` ← NEW |
| 2 | New fields in `linked_accounts` + bank details API call to Razorpay | `payouts.py` |
| 3 | Bank verification webhook (`/webhook/razorpay-account`) | `payouts.py` |
| 4 | Seed.py — add missing webhook secret fields | `seed.py` |
| 5 | Daily cron jobs (3 jobs) + register in scheduler | `payouts.py`, `server.py` |
| 6 | Payout guard (triple check) + settlement lock + idempotency | `payouts.py` |
| 7 | Cancel guard layer refactor | `bookings.py` |
| 8 | Refund % calculation (IST time-based) | `bookings.py` |
| 9 | Razorpay refund call — single + split payment support | `bookings.py` |
| 10 | Refund webhook handler (`refund.processed`, `refund.failed`) | `bookings.py` |
| 11 | Post-payout deduction record creation | `bookings.py` |
| 12 | Settlement calculation with deductions + negative balance handling | `payouts.py` |
| 13 | Mark deductions applied + rollback on failure | `payouts.py` |
| 14 | Bulk settlement — same deduction logic | `payouts.py` |
| 15 | My-summary endpoint — show deduction-adjusted pending | `payouts.py` |
| 16 | My-deductions API endpoint | `payouts.py` |
| 17 | Database indexes | `indexes.py` |
| 18 | Frontend: bank status, deductions section, settlement detail | `VenueFinancePage.js`, `api.js` |

---

## Files Touched

| File | Changes |
|------|---------|
| `backend/routes/finance_utils.py` | **NEW** — shared helpers (`log_webhook`, `log_finance_event`, `update_webhook_log`) |
| `backend/routes/payouts.py` | Bank API call, webhook handler, payout guard, settlement lock, deductions, cron jobs, my-deductions, my-summary fix |
| `backend/routes/bookings.py` | Cancel refactor, refund calc, Razorpay refund (single + split), deduction creation, refund webhook |
| `backend/server.py` | Register 3 new cron jobs |
| `backend/seed.py` | Add `webhook_secret`, `account_webhook_secret`, `transfer_webhook_secret` to platform_settings |
| `backend/indexes.py` | New indexes for deductions, finance_events, webhook_logs |
| `frontend/src/pages/VenueFinancePage.js` | Bank status badge, deductions section, settlement detail |
| `frontend/src/lib/api.js` | Add `myDeductions` to payoutAPI |
