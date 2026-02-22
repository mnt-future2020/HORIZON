"""
Notification Service – Port 8005
Handles: Multi-channel notifications (in-app, email/SMTP/SendGrid, SMS/Twilio, push/Expo),
         notification subscriptions, delivery logging.
"""
import sys, os
sys.path.insert(0, "/app/shared")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "shared"))

import uuid
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from database import db
from auth import get_current_user
from models import NotifySubscribeInput

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("notification-service")

app = FastAPI(title="Lobbi Notification Service", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

# ─── Configuration ────────────────────────────────────────────────────────────
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "noreply@lobbi.in")
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
TWILIO_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM = os.environ.get("TWILIO_FROM_NUMBER", "")
PUSH_ENABLED = os.environ.get("PUSH_ENABLED", "false").lower() == "true"


def is_email_configured():
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASS) or bool(SENDGRID_API_KEY)


def is_sms_configured():
    return bool(TWILIO_SID and TWILIO_AUTH and TWILIO_FROM)


# ═══════════════════════════════════════════════════════════════════════════════
# EMAIL SENDING
# ═══════════════════════════════════════════════════════════════════════════════

async def send_email(to_email: str, subject: str, body_html: str, body_text: str = ""):
    if not to_email:
        return False
    if SENDGRID_API_KEY:
        return await _send_email_sendgrid(to_email, subject, body_html, body_text)
    elif SMTP_HOST:
        return await _send_email_smtp(to_email, subject, body_html, body_text)
    logger.debug("Email not configured, skipping")
    return False


async def _send_email_smtp(to_email: str, subject: str, body_html: str, body_text: str):
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
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={"Authorization": f"Bearer {SENDGRID_API_KEY}", "Content-Type": "application/json"},
                json={
                    "personalizations": [{"to": [{"email": to_email}]}],
                    "from": {"email": SMTP_FROM, "name": "Lobbi"},
                    "subject": subject,
                    "content": [
                        {"type": "text/plain", "value": body_text or subject},
                        {"type": "text/html", "value": body_html}
                    ]
                }
            )
            if response.status_code in (200, 201, 202):
                logger.info(f"SendGrid email sent to {to_email}")
                return True
            logger.error(f"SendGrid failed ({response.status_code}): {response.text}")
            return False
    except Exception as e:
        logger.error(f"SendGrid email failed: {e}")
        return False


# ═══════════════════════════════════════════════════════════════════════════════
# SMS SENDING
# ═══════════════════════════════════════════════════════════════════════════════

async def send_sms(to_phone: str, message: str):
    if not to_phone or not is_sms_configured():
        return False
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_SID}/Messages.json",
                auth=(TWILIO_SID, TWILIO_AUTH),
                data={"From": TWILIO_FROM, "To": to_phone, "Body": message}
            )
            if response.status_code in (200, 201):
                logger.info(f"SMS sent to {to_phone}")
                return True
            logger.error(f"Twilio SMS failed ({response.status_code})")
            return False
    except Exception as e:
        logger.error(f"Twilio SMS failed: {e}")
        return False


# ═══════════════════════════════════════════════════════════════════════════════
# PUSH NOTIFICATION
# ═══════════════════════════════════════════════════════════════════════════════

async def send_push(user_id: str, title: str, body: str, data: dict = None):
    if not PUSH_ENABLED:
        return False
    user = await db.users.find_one({"id": user_id}, {"push_token": 1})
    if not user or not user.get("push_token"):
        return False
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json={"to": user["push_token"], "title": title, "body": body,
                      "data": data or {}, "sound": "default"}
            )
            if response.status_code == 200:
                logger.info(f"Push sent to {user_id}")
                return True
            return False
    except Exception as e:
        logger.error(f"Push failed for {user_id}: {e}")
        return False


# ═══════════════════════════════════════════════════════════════════════════════
# UNIFIED DISPATCH
# ═══════════════════════════════════════════════════════════════════════════════

def _build_email_html(title: str, message: str) -> str:
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0a;color:#fafafa;padding:40px 20px;">
    <div style="max-width:600px;margin:0 auto;background:#141414;border-radius:16px;padding:40px;border:1px solid #262626;">
    <div style="text-align:center;margin-bottom:32px;">
    <h1 style="font-size:28px;font-weight:900;letter-spacing:-0.03em;margin:0;background:linear-gradient(135deg,#22c55e,#16a34a);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">LOBBI</h1>
    <p style="color:#737373;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;margin-top:4px;">Sports Platform</p></div>
    <h2 style="font-size:22px;font-weight:800;margin-bottom:16px;">{title}</h2>
    <p style="color:#a3a3a3;font-size:16px;line-height:1.6;">{message}</p>
    <div style="margin-top:32px;padding-top:24px;border-top:1px solid #262626;text-align:center;">
    <p style="color:#525252;font-size:12px;">Automated notification from Lobbi.</p></div></div></body></html>"""


async def send_notification(user_id: str, title: str, message: str,
                            channels: list = None, data: dict = None,
                            notification_type: str = "general"):
    if channels is None:
        channels = ["in_app", "email", "sms", "push"]

    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return {"sent": False}

    prefs = user.get("notification_preferences", {})
    results = {}

    if "in_app" in channels:
        notif = {
            "id": str(uuid.uuid4()), "user_id": user_id,
            "type": notification_type, "title": title, "message": message,
            "data": data or {}, "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notif)
        results["in_app"] = True

    if "email" in channels and prefs.get("email", True) and is_email_configured():
        html = _build_email_html(title, message)
        results["email"] = await send_email(user.get("email", ""), f"Lobbi: {title}", html, message)
    else:
        results["email"] = False

    if "sms" in channels and prefs.get("sms", True) and is_sms_configured():
        sms_text = f"Lobbi: {title}\n{message}"[:160]
        results["sms"] = await send_sms(user.get("phone", ""), sms_text)
    else:
        results["sms"] = False

    if "push" in channels and prefs.get("push", True):
        results["push"] = await send_push(user_id, title, message, data)
    else:
        results["push"] = False

    # Log delivery
    await db.notification_delivery_log.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id,
        "notification_type": notification_type, "title": title,
        "channels_attempted": channels, "results": results,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return results


# ═══════════════════════════════════════════════════════════════════════════════
# SLOT NOTIFICATION HELPER
# ═══════════════════════════════════════════════════════════════════════════════

async def notify_slot_available(venue_id: str, date: str, start_time: str, turf_number: int):
    subs = await db.notification_subscriptions.find({
        "venue_id": venue_id, "date": date, "start_time": start_time,
        "turf_number": turf_number, "status": "active"
    }, {"_id": 0}).to_list(100)
    if not subs:
        return

    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "name": 1})
    venue_name = venue["name"] if venue else "Unknown Venue"

    notifications = []
    for sub in subs:
        notifications.append({
            "id": str(uuid.uuid4()), "user_id": sub["user_id"],
            "type": "slot_available", "title": "Slot Now Available!",
            "message": f"{venue_name} - {start_time} on {date} (Turf {turf_number}) is now free!",
            "venue_id": venue_id, "date": date, "start_time": start_time,
            "turf_number": turf_number, "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    if notifications:
        await db.notifications.insert_many(notifications)
        sub_ids = [s["id"] for s in subs]
        await db.notification_subscriptions.update_many(
            {"id": {"$in": sub_ids}}, {"$set": {"status": "notified"}}
        )

    for sub in subs:
        await send_notification(
            user_id=sub["user_id"], title="Slot Now Available!",
            message=f"{venue_name} - {start_time} on {date} (Turf {turf_number}) is now free!",
            channels=["email", "sms", "push"], notification_type="slot_available",
            data={"venue_id": venue_id, "date": date, "start_time": start_time}
        )

    logger.info(f"Sent {len(notifications)} slot-available notifications for {venue_id}")


# ═══════════════════════════════════════════════════════════════════════════════
# NOTIFICATION ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/notifications/subscribe")
async def subscribe_notification(inp: NotifySubscribeInput, user=Depends(get_current_user)):
    existing = await db.notification_subscriptions.find_one({
        "user_id": user["id"], "venue_id": inp.venue_id, "date": inp.date,
        "start_time": inp.start_time, "turf_number": inp.turf_number, "status": "active"
    })
    if existing:
        return {"message": "Already subscribed", "subscribed": True}

    sub = {
        "id": str(uuid.uuid4()), "user_id": user["id"],
        "venue_id": inp.venue_id, "date": inp.date,
        "start_time": inp.start_time, "turf_number": inp.turf_number,
        "status": "active", "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notification_subscriptions.insert_one(sub)
    sub.pop("_id", None)
    return {"message": "You'll be notified when this slot opens up!", "subscribed": True, "subscription": sub}


@app.delete("/notifications/subscribe")
async def unsubscribe_notification(inp: NotifySubscribeInput, user=Depends(get_current_user)):
    result = await db.notification_subscriptions.delete_one({
        "user_id": user["id"], "venue_id": inp.venue_id, "date": inp.date,
        "start_time": inp.start_time, "turf_number": inp.turf_number, "status": "active"
    })
    return {"message": "Unsubscribed", "removed": result.deleted_count > 0}


@app.get("/notifications")
async def get_notifications(user=Depends(get_current_user)):
    notifs = await db.notifications.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return notifs


@app.get("/notifications/unread-count")
async def get_unread_count(user=Depends(get_current_user)):
    count = await db.notifications.count_documents({"user_id": user["id"], "is_read": False})
    return {"count": count}


@app.put("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, user=Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": notif_id, "user_id": user["id"]}, {"$set": {"is_read": True}}
    )
    return {"message": "Marked as read"}


@app.put("/notifications/read-all")
async def mark_all_read(user=Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user["id"], "is_read": False}, {"$set": {"is_read": True}}
    )
    return {"message": "All marked as read"}


@app.get("/notifications/subscriptions")
async def get_my_subscriptions(user=Depends(get_current_user),
                               venue_id: Optional[str] = None, date: Optional[str] = None):
    query = {"user_id": user["id"], "status": "active"}
    if venue_id:
        query["venue_id"] = venue_id
    if date:
        query["date"] = date
    subs = await db.notification_subscriptions.find(query, {"_id": 0}).to_list(100)
    return subs


# ─── Send notification endpoint (internal / inter-service) ───────────────────

@app.post("/notifications/send")
async def send_notification_endpoint(request_data: dict = None):
    """Internal endpoint for other services to trigger notifications."""
    from fastapi import Request
    # Accept JSON body directly
    if request_data is None:
        return {"error": "No data provided"}
    results = await send_notification(
        user_id=request_data.get("user_id", ""),
        title=request_data.get("title", ""),
        message=request_data.get("message", ""),
        channels=request_data.get("channels"),
        data=request_data.get("data"),
        notification_type=request_data.get("notification_type", "general")
    )
    return results


@app.get("/notifications/config")
async def get_notification_config(user=Depends(get_current_user)):
    """Get notification service configuration status."""
    return {
        "email_configured": is_email_configured(),
        "sms_configured": is_sms_configured(),
        "push_enabled": PUSH_ENABLED,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {"service": "notification", "status": "healthy", "port": 8005,
            "email": is_email_configured(), "sms": is_sms_configured(), "push": PUSH_ENABLED}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
