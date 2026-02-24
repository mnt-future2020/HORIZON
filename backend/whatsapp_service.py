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
