"""
WhatsApp Business Cloud API service.

Sends template/text messages via Meta's WhatsApp Cloud API.
Credentials (phone_number_id, access_token) are stored in
platform_settings.whatsapp and configured from the Admin dashboard.

Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages
"""

import httpx
import logging

logger = logging.getLogger("horizon.whatsapp")

GRAPH_API = "https://graph.facebook.com/v21.0"


async def send_message(settings: dict, to_phone: str, body: str) -> dict:
    """
    Send a text message via WhatsApp Cloud API.

    Args:
        settings: whatsapp config from platform_settings
                  {phone_number_id, access_token, ...}
        to_phone: recipient phone in international format (e.g. "919876543210")
        body:     message text

    Returns:
        {"ok": True/False, "detail": ...}
    """
    phone_number_id = settings.get("phone_number_id", "").strip()
    access_token = settings.get("access_token", "").strip()

    if not phone_number_id or not access_token:
        logger.warning("WhatsApp credentials not configured — skipping message")
        return {"ok": False, "detail": "WhatsApp credentials not configured"}

    # Clean recipient number and ensure country code (default India +91)
    clean_number = to_phone.replace("+", "").replace(" ", "").replace("-", "")
    if clean_number and len(clean_number) == 10 and clean_number.isdigit():
        clean_number = "91" + clean_number

    url = f"{GRAPH_API}/{phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": clean_number,
        "type": "text",
        "text": {"body": body},
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, json=payload, headers=headers)
            data = resp.json()
            if resp.status_code == 200 and data.get("messages"):
                msg_id = data["messages"][0].get("id", "")
                logger.info(f"WhatsApp sent to {clean_number} msg_id={msg_id}")
                return {"ok": True, "message_id": msg_id}
            else:
                err = data.get("error", {}).get("message", resp.text)
                logger.error(f"WhatsApp API error: {err}")
                return {"ok": False, "detail": err}
    except Exception as e:
        logger.error(f"WhatsApp send failed: {e}")
        return {"ok": False, "detail": str(e)}


def build_client_welcome_message(coach_name: str, client_name: str, app_link: str) -> str:
    """Welcome message sent to a new offline client to download the app."""
    return (
        f"Hi {client_name}! 👋\n\n"
        f"Welcome to *{coach_name}*'s coaching program! 🎯\n\n"
        f"Download the Lobbi app to:\n"
        f"✅ View your session schedule\n"
        f"✅ Track your performance\n"
        f"✅ Book sessions online\n\n"
        f"📱 *Download:* {app_link}\n\n"
        f"See you on the field! 💪"
    )


def build_payment_reminder_message(
    client_name: str,
    coach_name: str,
    package_name: str,
    amount: int,
    payment_link: str,
    due_date: str,
    attempt: int = 1,
) -> str:
    """Payment reminder with Razorpay link for monthly coaching fee."""
    prefix = "Friendly reminder" if attempt == 1 else f"Reminder #{attempt}"
    return (
        f"*{prefix}* — {client_name} 👋\n\n"
        f"Your monthly coaching fee is due.\n\n"
        f"📦 *Package:* {package_name}\n"
        f"💰 *Amount:* ₹{amount:,}\n"
        f"📅 *Due:* {due_date}\n\n"
        f"👉 *Pay now:* {payment_link}\n\n"
        f"— {coach_name}\n"
        f"_Powered by Lobbi_"
    )


def build_session_reminder_message(
    client_name: str,
    coach_name: str,
    sport: str,
    date: str,
    start_time: str,
    location: str = "",
) -> str:
    """Reminder sent the day before an upcoming session."""
    loc_line = f"📍 *Venue:* {location}\n" if location else ""
    return (
        f"Hi {client_name}! 🔔\n\n"
        f"Reminder — your *{sport.title()}* session is tomorrow!\n\n"
        f"📅 *Date:* {date}\n"
        f"⏰ *Time:* {start_time}\n"
        f"{loc_line}"
        f"\n— {coach_name}\n"
        f"_Powered by Lobbi_"
    )


def build_package_expiry_message(
    client_name: str,
    coach_name: str,
    package_name: str,
    days_left: int,
    sessions_remaining: int,
) -> str:
    """Alert sent N days before a package expires."""
    day_word = "day" if days_left == 1 else "days"
    return (
        f"Hi {client_name}! ⚠️\n\n"
        f"Your *{package_name}* package expires in *{days_left} {day_word}*.\n\n"
        f"📦 Sessions remaining: *{sessions_remaining}*\n\n"
        f"Don't lose your progress — contact your coach to renew!\n\n"
        f"— {coach_name}\n"
        f"_Powered by Lobbi_"
    )


def build_booking_confirmation_message(
    client_name: str,
    coach_name: str,
    sport: str,
    date: str,
    start_time: str,
    location: str = "",
) -> str:
    """Sent when a session is confirmed (payment or package)."""
    loc_line = f"📍 *Venue:* {location}\n" if location else ""
    return (
        f"Booking Confirmed! ✅\n\n"
        f"Hi {client_name}, your *{sport.title()}* session is booked.\n\n"
        f"👨‍🏫 *Coach:* {coach_name}\n"
        f"📅 *Date:* {date}\n"
        f"⏰ *Time:* {start_time}\n"
        f"{loc_line}"
        f"\nSee you on the field! 💪\n\n"
        f"_Powered by Lobbi_"
    )


def build_monthly_progress_message(
    client_name: str,
    coach_name: str,
    month: str,
    sessions_attended: int,
    sessions_total: int,
    attendance_pct: float,
) -> str:
    """Monthly progress summary sent on the last day of the month."""
    if attendance_pct >= 80:
        emoji, verdict = "🔥", "Great consistency! Keep it up! 🏆"
    elif attendance_pct >= 60:
        emoji, verdict = "📈", "Good progress — keep pushing! 💪"
    else:
        emoji, verdict = "💪", "Let's aim for more sessions next month!"
    return (
        f"Hi {client_name}! 📊\n\n"
        f"Here's your *{month}* training summary:\n\n"
        f"✅ Sessions attended: *{sessions_attended}/{sessions_total}*\n"
        f"📈 Attendance: *{attendance_pct:.0f}%* {emoji}\n\n"
        f"{verdict}\n\n"
        f"— {coach_name}\n"
        f"_Powered by Lobbi_"
    )


def build_no_show_message(
    client_name: str,
    coach_name: str,
    sport: str,
    date: str,
) -> str:
    """Sent when a client misses a confirmed session."""
    return (
        f"Hi {client_name}! 😊\n\n"
        f"We missed you at today's *{sport.title()}* session ({date})!\n\n"
        f"If you need to reschedule or had any issues, just reply here.\n\n"
        f"— {coach_name}\n"
        f"_Powered by Lobbi_"
    )


def build_enquiry_message(venue_name: str, enquiry: dict) -> str:
    """Build a formatted enquiry message."""
    lines = [
        f"New Enquiry - {venue_name}",
        "",
        f"Name: {enquiry.get('name', '')}",
        f"Phone: {enquiry.get('phone', '')}",
    ]
    if enquiry.get("sport"):
        lines.append(f"Sport: {enquiry['sport']}")
    if enquiry.get("date"):
        lines.append(f"Date: {enquiry['date']}")
    if enquiry.get("time"):
        lines.append(f"Time: {enquiry['time']}")
    if enquiry.get("message"):
        lines.append(f"Message: {enquiry['message']}")
    lines.append("")
    lines.append("Via Lobbi (lobbi.in)")
    return "\n".join(lines)
