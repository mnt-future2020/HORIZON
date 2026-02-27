"""
Coach Payment Reminders
- Send monthly fee reminders via WhatsApp with Razorpay payment links
- Daily APScheduler job to auto-remind all due clients
- Webhook to mark reminders as paid
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import Optional
from datetime import datetime, timezone
from database import db
from auth import get_current_user, create_razorpay_payment_link
from whatsapp_service import send_message, build_payment_reminder_message
import uuid
import logging
import urllib.parse

router = APIRouter(prefix="/coaching", tags=["coaching-reminders"])
logger = logging.getLogger("horizon.reminders")


# ─── Shared helper ────────────────────────────────────────────────────────────

async def _do_send_reminder(client: dict, coach_name: str, wa_config: dict, current_month: str) -> dict:
    """
    Core logic: create Razorpay payment link → build WhatsApp message → send.
    Upserts a payment_reminders document for this client+month.
    Returns {ok, payment_link_url, wa_result, reminder_id}
    """
    now = datetime.now(timezone.utc).isoformat()
    today_str = now[:10]
    amount = int(client.get("monthly_fee", 0))
    if amount <= 0:
        return {"ok": False, "detail": "Client has no monthly fee set"}

    phone = client.get("phone", "")
    if not phone:
        return {"ok": False, "detail": "Client has no phone number"}

    package_name = client.get("sport", "Coaching") or "Coaching"
    due_date = f"{current_month}-{client.get('reminder_day', 1):02d}"

    # Load existing reminder for this month to get attempt count
    existing = await db.payment_reminders.find_one({
        "client_id": client["id"], "month": current_month
    })
    attempt = (existing.get("reminder_count", 0) + 1) if existing else 1

    # Create Razorpay payment link
    rzp_result = await create_razorpay_payment_link(
        amount=amount,
        description=f"Monthly coaching fee — {package_name} ({current_month})",
        name=client.get("name", ""),
        phone=phone,
        email=client.get("email", ""),
        expire_days=7,
    )

    payment_link_url = rzp_result.get("url", "")
    razorpay_link_id = rzp_result.get("id", "")

    # Fallback if Razorpay not configured: use UPI link
    if not payment_link_url:
        upi_id = ""  # Could be configured per coach in future
        payment_link_url = f"upi://pay?am={amount}&cu=INR"
        logger.warning(f"Razorpay not configured, using UPI fallback for client {client['id']}")

    # Build WhatsApp message
    msg = build_payment_reminder_message(
        client_name=client.get("name", ""),
        coach_name=coach_name,
        package_name=package_name,
        amount=amount,
        payment_link=payment_link_url,
        due_date=due_date,
        attempt=attempt,
    )

    # Send WhatsApp
    wa_result = await send_message(wa_config, phone, msg)

    # Build wa.me fallback link
    wa_fallback = f"https://wa.me/{phone.replace('+', '')}?text={urllib.parse.quote(msg)}"

    # Upsert reminder record
    if existing:
        await db.payment_reminders.update_one(
            {"client_id": client["id"], "month": current_month},
            {"$set": {
                "reminder_count": attempt,
                "last_reminder_at": now,
                "payment_link_url": payment_link_url,
                "razorpay_link_id": razorpay_link_id,
                "whatsapp_ok": wa_result.get("ok", False),
            }},
        )
        reminder_id = existing["id"]
    else:
        reminder_id = str(uuid.uuid4())
        doc = {
            "id": reminder_id,
            "coach_id": client["coach_id"],
            "client_id": client["id"],
            "client_name": client.get("name", ""),
            "phone": phone,
            "amount": amount,
            "payment_link_url": payment_link_url,
            "razorpay_link_id": razorpay_link_id,
            "status": "sent",
            "month": current_month,
            "reminder_count": 1,
            "sent_at": now,
            "last_reminder_at": now,
            "whatsapp_ok": wa_result.get("ok", False),
        }
        await db.payment_reminders.insert_one(doc)

    return {
        "ok": True,
        "reminder_id": reminder_id,
        "payment_link_url": payment_link_url,
        "wa_fallback": wa_fallback,
        "whatsapp_sent": wa_result.get("ok", False),
        "attempt": attempt,
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/reminders")
async def list_reminders(
    user=Depends(get_current_user),
    month: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    """List payment reminders for this coach."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can view reminders")
    q = {"coach_id": user["id"]}
    if month:
        q["month"] = month
    if status:
        q["status"] = status
    reminders = []
    async for r in db.payment_reminders.find(q, {"_id": 0}).sort("last_reminder_at", -1).limit(200):
        reminders.append(r)
    return reminders


@router.post("/reminders/send/{client_id}")
async def send_payment_reminder(client_id: str, user=Depends(get_current_user)):
    """Manually send a payment reminder to an offline client."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can send reminders")

    client = await db.coach_clients.find_one(
        {"id": client_id, "coach_id": user["id"], "status": "active"}, {"_id": 0}
    )
    if not client:
        raise HTTPException(404, "Client not found")
    if not client.get("monthly_fee", 0):
        raise HTTPException(400, "Client has no monthly fee set. Edit client to add a monthly fee.")
    if not client.get("phone"):
        raise HTTPException(400, "Client has no phone number")

    settings = await db.platform_settings.find_one({"key": "platform"}, {"_id": 0})
    wa = (settings or {}).get("whatsapp", {})
    coach_doc = await db.users.find_one({"id": user["id"]}, {"name": 1})
    coach_name = coach_doc.get("name", "Your Coach") if coach_doc else "Your Coach"
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")

    result = await _do_send_reminder(client, coach_name, wa, current_month)
    return result


@router.post("/reminders/run-daily")
async def trigger_daily_reminders(user=Depends(get_current_user)):
    """Manually trigger the daily reminder job (coach or super_admin)."""
    if user.get("role") not in ("coach", "super_admin"):
        raise HTTPException(403, "Not authorized")
    count = await run_daily_reminders(coach_id=user["id"] if user["role"] == "coach" else None)
    return {"message": f"Reminders processed: {count}"}


@router.post("/reminders/webhook/razorpay")
async def razorpay_webhook(request: Request):
    """
    Razorpay webhook to mark a payment reminder as paid.
    Configure in Razorpay dashboard: Settings → Webhooks → payment_link.paid
    """
    import hmac
    import hashlib

    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    # Verify webhook signature
    settings = await db.platform_settings.find_one({"key": "platform"}, {"_id": 0})
    webhook_secret = (settings or {}).get("payment_gateway", {}).get("webhook_secret", "")
    if webhook_secret:
        expected = hmac.new(webhook_secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise HTTPException(400, "Invalid webhook signature")

    import json
    try:
        payload = json.loads(body)
    except Exception:
        raise HTTPException(400, "Invalid JSON")

    event = payload.get("event", "")
    if event != "payment_link.paid":
        return {"ok": True, "skipped": True}

    entity = payload.get("payload", {}).get("payment_link", {}).get("entity", {})
    link_id = entity.get("id", "")
    if not link_id:
        return {"ok": True}

    now = datetime.now(timezone.utc).isoformat()
    result = await db.payment_reminders.update_one(
        {"razorpay_link_id": link_id},
        {"$set": {"status": "paid", "paid_at": now}},
    )
    logger.info(f"Razorpay webhook: marked reminder paid for link_id={link_id}, matched={result.matched_count}")
    return {"ok": True}


# ─── APScheduler daily job ─────────────────────────────────────────────────────

async def run_daily_reminders(coach_id: Optional[str] = None) -> int:
    """
    Find all active offline clients with monthly_fee > 0, due today or earlier.
    Skip if already paid or already reminded today.
    Send WhatsApp + Razorpay payment link.
    Returns count of reminders sent.
    """
    today = datetime.now(timezone.utc)
    current_month = today.strftime("%Y-%m")
    today_str = today.strftime("%Y-%m-%d")
    count = 0

    query = {
        "status": "active",
        "monthly_fee": {"$gt": 0},
        "reminder_day": {"$lte": today.day},
    }
    if coach_id:
        query["coach_id"] = coach_id

    async for client in db.coach_clients.find(query, {"_id": 0}):
        try:
            existing = await db.payment_reminders.find_one({
                "client_id": client["id"], "month": current_month
            })
            # Skip if already paid this month
            if existing and existing.get("status") == "paid":
                continue
            # Skip if already reminded today
            if existing and (existing.get("last_reminder_at") or "")[:10] == today_str:
                continue

            # Load coach settings
            settings = await db.platform_settings.find_one({"key": "platform"}, {"_id": 0})
            wa = (settings or {}).get("whatsapp", {})
            coach_doc = await db.users.find_one({"id": client["coach_id"]}, {"name": 1})
            coach_name = coach_doc.get("name", "Your Coach") if coach_doc else "Your Coach"

            result = await _do_send_reminder(client, coach_name, wa, current_month)
            if result.get("ok"):
                count += 1
                logger.info(f"Daily reminder sent: client={client['id']} month={current_month}")
        except Exception as e:
            logger.error(f"Daily reminder failed for client {client.get('id')}: {e}")
            continue

    logger.info(f"Daily reminders complete: {count} sent")
    return count


# ─── Session Reminder Job (daily 8 PM IST) ────────────────────────────────────

async def run_session_reminders() -> int:
    """
    Find all confirmed online sessions scheduled for tomorrow.
    Send WhatsApp reminder to the player if coach has enabled it.
    """
    from routes.coach_whatsapp import get_coach_wa_settings, send_wa_with_log
    from whatsapp_service import build_session_reminder_message
    from datetime import timedelta

    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
    count = 0

    async for session in db.coaching_sessions.find(
        {"date": tomorrow, "status": "confirmed"}, {"_id": 0}
    ):
        try:
            settings = await get_coach_wa_settings(session["coach_id"])
            if not settings.get("session_reminder", {}).get("enabled", True):
                continue

            # Deduplicate: skip if already sent today for this session
            already = await db.whatsapp_logs.find_one({
                "reference_id": session["id"],
                "automation_type": "session_reminder",
                "status": "sent",
            })
            if already:
                continue

            player = await db.users.find_one(
                {"id": session["player_id"]}, {"phone": 1, "name": 1}
            )
            if not player or not player.get("phone"):
                continue

            platform_s = await db.platform_settings.find_one({"key": "platform"}, {"_id": 0})
            wa = (platform_s or {}).get("whatsapp", {})
            coach_doc = await db.users.find_one({"id": session["coach_id"]}, {"name": 1})
            coach_name = coach_doc.get("name", "Your Coach") if coach_doc else "Your Coach"

            msg = build_session_reminder_message(
                client_name=player.get("name", ""),
                coach_name=coach_name,
                sport=session.get("sport", ""),
                date=session.get("date", ""),
                start_time=session.get("start_time", ""),
                location=session.get("location", ""),
            )
            result = await send_wa_with_log(
                wa, player["phone"], msg,
                coach_id=session["coach_id"],
                client_id=session["player_id"],
                client_name=player.get("name", ""),
                automation_type="session_reminder",
                reference_id=session["id"],
            )
            if result.get("ok"):
                count += 1
        except Exception as e:
            logger.error(f"Session reminder failed for session {session.get('id')}: {e}")

    logger.info(f"Session reminders sent: {count}")
    return count


# ─── Package Expiry Job (daily 9:30 AM IST) ───────────────────────────────────

async def run_package_expiry_reminders() -> int:
    """
    Find active subscriptions expiring in exactly N days (per coach setting).
    Send WhatsApp expiry alert to the player.
    """
    from routes.coach_whatsapp import get_coach_wa_settings, send_wa_with_log
    from whatsapp_service import build_package_expiry_message
    from datetime import timedelta

    today = datetime.now(timezone.utc).date()
    count = 0

    async for sub in db.coaching_subscriptions.find({"status": "active"}, {"_id": 0}):
        try:
            settings = await get_coach_wa_settings(sub["coach_id"])
            pkg_cfg = settings.get("package_expiry", {})
            if not pkg_cfg.get("enabled", True):
                continue

            days_before = int(pkg_cfg.get("days_before", 3))
            period_end_str = sub.get("current_period_end", "")
            if not period_end_str:
                continue

            expiry_date = datetime.fromisoformat(
                period_end_str.replace("Z", "+00:00")
            ).date()
            days_left = (expiry_date - today).days
            if days_left != days_before:
                continue

            # Deduplicate by subscription id
            already = await db.whatsapp_logs.find_one({
                "reference_id": sub["id"],
                "automation_type": "package_expiry",
                "status": "sent",
            })
            if already:
                continue

            player = await db.users.find_one(
                {"id": sub["player_id"]}, {"phone": 1, "name": 1}
            )
            if not player or not player.get("phone"):
                continue

            platform_s = await db.platform_settings.find_one({"key": "platform"}, {"_id": 0})
            wa = (platform_s or {}).get("whatsapp", {})
            coach_doc = await db.users.find_one({"id": sub["coach_id"]}, {"name": 1})
            coach_name = coach_doc.get("name", "Your Coach") if coach_doc else "Your Coach"

            sessions_remaining = max(
                0,
                sub.get("sessions_per_month", 0) - sub.get("sessions_used", 0),
            )
            msg = build_package_expiry_message(
                client_name=player.get("name", ""),
                coach_name=coach_name,
                package_name=sub.get("package_name", "Package"),
                days_left=days_left,
                sessions_remaining=sessions_remaining,
            )
            result = await send_wa_with_log(
                wa, player["phone"], msg,
                coach_id=sub["coach_id"],
                client_id=sub["player_id"],
                client_name=player.get("name", ""),
                automation_type="package_expiry",
                reference_id=sub["id"],
            )
            if result.get("ok"):
                count += 1
        except Exception as e:
            logger.error(f"Package expiry reminder failed for sub {sub.get('id')}: {e}")

    logger.info(f"Package expiry reminders sent: {count}")
    return count


# ─── No-Show Follow-up Job (daily 9 PM IST) ───────────────────────────────────

async def run_no_show_followup() -> int:
    """
    Find sessions from today that are still 'confirmed' (player didn't show,
    coach didn't mark complete). Send a follow-up WhatsApp.
    """
    from routes.coach_whatsapp import get_coach_wa_settings, send_wa_with_log
    from whatsapp_service import build_no_show_message

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    count = 0

    async for session in db.coaching_sessions.find(
        {"date": today_str, "status": "confirmed"}, {"_id": 0}
    ):
        try:
            settings = await get_coach_wa_settings(session["coach_id"])
            if not settings.get("no_show_followup", {}).get("enabled", True):
                continue

            already = await db.whatsapp_logs.find_one({
                "reference_id": session["id"],
                "automation_type": "no_show_followup",
                "status": "sent",
            })
            if already:
                continue

            player = await db.users.find_one(
                {"id": session["player_id"]}, {"phone": 1, "name": 1}
            )
            if not player or not player.get("phone"):
                continue

            platform_s = await db.platform_settings.find_one({"key": "platform"}, {"_id": 0})
            wa = (platform_s or {}).get("whatsapp", {})
            coach_doc = await db.users.find_one({"id": session["coach_id"]}, {"name": 1})
            coach_name = coach_doc.get("name", "Your Coach") if coach_doc else "Your Coach"

            msg = build_no_show_message(
                client_name=player.get("name", ""),
                coach_name=coach_name,
                sport=session.get("sport", ""),
                date=today_str,
            )
            result = await send_wa_with_log(
                wa, player["phone"], msg,
                coach_id=session["coach_id"],
                client_id=session["player_id"],
                client_name=player.get("name", ""),
                automation_type="no_show_followup",
                reference_id=session["id"],
            )
            if result.get("ok"):
                count += 1
        except Exception as e:
            logger.error(f"No-show followup failed for session {session.get('id')}: {e}")

    logger.info(f"No-show followups sent: {count}")
    return count


# ─── Monthly Progress Job (last day of month, 8 PM IST) ──────────────────────

async def run_monthly_progress() -> int:
    """
    Send monthly attendance/progress summary to all active subscription holders.
    Only sent if coach has enabled monthly_progress automation.
    """
    from routes.coach_whatsapp import get_coach_wa_settings, send_wa_with_log
    from whatsapp_service import build_monthly_progress_message

    now = datetime.now(timezone.utc)
    month_str = now.strftime("%Y-%m")
    month_display = now.strftime("%B %Y")
    count = 0

    async for sub in db.coaching_subscriptions.find({"status": "active"}, {"_id": 0}):
        try:
            settings = await get_coach_wa_settings(sub["coach_id"])
            if not settings.get("monthly_progress", {}).get("enabled", False):
                continue

            # Deduplicate: one per sub per month
            ref_id = f"{sub['id']}_{month_str}"
            already = await db.whatsapp_logs.find_one({
                "reference_id": ref_id,
                "automation_type": "monthly_progress",
                "status": "sent",
            })
            if already:
                continue

            player = await db.users.find_one(
                {"id": sub["player_id"]}, {"phone": 1, "name": 1}
            )
            if not player or not player.get("phone"):
                continue

            sessions_total = sub.get("sessions_per_month", 0)
            sessions_used = sub.get("sessions_used", 0)
            attendance_pct = (sessions_used / sessions_total * 100) if sessions_total > 0 else 0

            platform_s = await db.platform_settings.find_one({"key": "platform"}, {"_id": 0})
            wa = (platform_s or {}).get("whatsapp", {})
            coach_doc = await db.users.find_one({"id": sub["coach_id"]}, {"name": 1})
            coach_name = coach_doc.get("name", "Your Coach") if coach_doc else "Your Coach"

            msg = build_monthly_progress_message(
                client_name=player.get("name", ""),
                coach_name=coach_name,
                month=month_display,
                sessions_attended=sessions_used,
                sessions_total=sessions_total,
                attendance_pct=attendance_pct,
            )
            result = await send_wa_with_log(
                wa, player["phone"], msg,
                coach_id=sub["coach_id"],
                client_id=sub["player_id"],
                client_name=player.get("name", ""),
                automation_type="monthly_progress",
                reference_id=ref_id,
            )
            if result.get("ok"):
                count += 1
        except Exception as e:
            logger.error(f"Monthly progress failed for sub {sub.get('id')}: {e}")

    logger.info(f"Monthly progress messages sent: {count}")
    return count
