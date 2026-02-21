"""
Multi-Channel Notification Service
Supports: In-App, Email (SMTP/SendGrid), SMS (Twilio), Push
Gracefully degrades if services are not configured.
"""
import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone
from database import db
import uuid

logger = logging.getLogger("horizon")

# ─── Configuration ────────────────────────────────────────────────────────────

# Email config (SMTP or SendGrid)
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "noreply@horizon.sports")
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")

# SMS config (Twilio)
TWILIO_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM = os.environ.get("TWILIO_FROM_NUMBER", "")

# Push config
PUSH_ENABLED = os.environ.get("PUSH_ENABLED", "false").lower() == "true"


def is_email_configured():
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASS) or bool(SENDGRID_API_KEY)


def is_sms_configured():
    return bool(TWILIO_SID and TWILIO_AUTH and TWILIO_FROM)


# ─── Email Sending ────────────────────────────────────────────────────────────

async def send_email(to_email: str, subject: str, body_html: str, body_text: str = ""):
    """Send email via SMTP or SendGrid."""
    if not to_email:
        return False

    if SENDGRID_API_KEY:
        return await _send_email_sendgrid(to_email, subject, body_html, body_text)
    elif SMTP_HOST:
        return await _send_email_smtp(to_email, subject, body_html, body_text)
    else:
        logger.debug("Email not configured, skipping email notification")
        return False


async def _send_email_smtp(to_email: str, subject: str, body_html: str, body_text: str):
    """Send email via SMTP."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = to_email

        if body_text:
            msg.attach(MIMEText(body_text, "plain"))
        msg.attach(MIMEText(body_html, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, to_email, msg.as_string())

        logger.info(f"Email sent to {to_email}: {subject}")
        return True
    except Exception as e:
        logger.error(f"SMTP email failed to {to_email}: {e}")
        return False


async def _send_email_sendgrid(to_email: str, subject: str, body_html: str, body_text: str):
    """Send email via SendGrid API."""
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {SENDGRID_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "personalizations": [{"to": [{"email": to_email}]}],
                    "from": {"email": SMTP_FROM, "name": "Horizon Sports"},
                    "subject": subject,
                    "content": [
                        {"type": "text/plain", "value": body_text or subject},
                        {"type": "text/html", "value": body_html}
                    ]
                }
            )
            if response.status_code in (200, 201, 202):
                logger.info(f"SendGrid email sent to {to_email}: {subject}")
                return True
            else:
                logger.error(f"SendGrid failed ({response.status_code}): {response.text}")
                return False
    except Exception as e:
        logger.error(f"SendGrid email failed to {to_email}: {e}")
        return False


# ─── SMS Sending ──────────────────────────────────────────────────────────────

async def send_sms(to_phone: str, message: str):
    """Send SMS via Twilio."""
    if not to_phone or not is_sms_configured():
        logger.debug("SMS not configured or no phone number, skipping")
        return False

    try:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_SID}/Messages.json",
                auth=(TWILIO_SID, TWILIO_AUTH),
                data={
                    "From": TWILIO_FROM,
                    "To": to_phone,
                    "Body": message
                }
            )
            if response.status_code in (200, 201):
                logger.info(f"SMS sent to {to_phone}")
                return True
            else:
                logger.error(f"Twilio SMS failed ({response.status_code}): {response.text}")
                return False
    except Exception as e:
        logger.error(f"Twilio SMS failed to {to_phone}: {e}")
        return False


# ─── Push Notification ────────────────────────────────────────────────────────

async def send_push(user_id: str, title: str, body: str, data: dict = None):
    """Send push notification via Expo Push API. Requires PUSH_ENABLED=true and valid push token."""
    if not PUSH_ENABLED:
        return False

    user = await db.users.find_one({"id": user_id}, {"push_token": 1, "push_platform": 1})
    if not user or not user.get("push_token"):
        return False

    try:
        import httpx
        push_token = user["push_token"]
        # Expo Push API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json={
                    "to": push_token,
                    "title": title,
                    "body": body,
                    "data": data or {},
                    "sound": "default"
                }
            )
            if response.status_code == 200:
                logger.info(f"Push sent to {user_id}")
                return True
            else:
                logger.error(f"Push failed ({response.status_code}): {response.text}")
                return False
    except Exception as e:
        logger.error(f"Push notification failed for {user_id}: {e}")
        return False


# ─── Unified Notification Dispatch ────────────────────────────────────────────

async def send_notification(
    user_id: str,
    title: str,
    message: str,
    channels: list = None,
    data: dict = None,
    notification_type: str = "general"
):
    """
    Send notification through multiple channels based on user preferences.
    Channels: ['in_app', 'email', 'sms', 'push']
    Always creates in-app notification. Other channels are best-effort.
    """
    if channels is None:
        channels = ["in_app", "email", "sms", "push"]

    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        logger.warning(f"Notification target user {user_id} not found")
        return {"sent": False}

    # Check user notification preferences
    prefs = user.get("notification_preferences", {})
    results = {}

    # 1. Always create in-app notification
    if "in_app" in channels:
        notif = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": notification_type,
            "title": title,
            "message": message,
            "data": data or {},
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notif)
        results["in_app"] = True

    # 2. Email
    if "email" in channels and prefs.get("email", True) and is_email_configured():
        email = user.get("email", "")
        html = _build_email_html(title, message)
        results["email"] = await send_email(email, f"Horizon: {title}", html, message)
    else:
        results["email"] = False

    # 3. SMS
    if "sms" in channels and prefs.get("sms", True) and is_sms_configured():
        phone = user.get("phone", "")
        sms_text = f"Horizon: {title}\n{message}"
        if len(sms_text) > 160:
            sms_text = sms_text[:157] + "..."
        results["sms"] = await send_sms(phone, sms_text)
    else:
        results["sms"] = False

    # 4. Push
    if "push" in channels and prefs.get("push", True):
        results["push"] = await send_push(user_id, title, message, data)
    else:
        results["push"] = False

    # Log delivery record
    delivery = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "notification_type": notification_type,
        "title": title,
        "channels_attempted": channels,
        "results": results,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notification_delivery_log.insert_one(delivery)

    return results


def _build_email_html(title: str, message: str) -> str:
    """Build a branded HTML email template."""
    return f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fafafa; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: #141414; border-radius: 16px; padding: 40px; border: 1px solid #262626;">
            <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="font-size: 28px; font-weight: 900; letter-spacing: -0.03em; margin: 0; background: linear-gradient(135deg, #22c55e, #16a34a); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">HORIZON</h1>
                <p style="color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px;">Sports Platform</p>
            </div>
            <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 16px;">{title}</h2>
            <p style="color: #a3a3a3; font-size: 16px; line-height: 1.6;">{message}</p>
            <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #262626; text-align: center;">
                <p style="color: #525252; font-size: 12px;">This is an automated notification from Horizon Sports.</p>
            </div>
        </div>
    </body>
    </html>
    """
