"""
Auto-Invoice Generation Utility
Generates invoices automatically when payments are confirmed.
Called via asyncio.create_task() from payment confirmation endpoints.
"""
import uuid
import logging
from database import db
from tz import now_ist

logger = logging.getLogger("horizon.invoice_utils")


# ─── Shared Helpers ──────────────────────────────────────────────────────────

async def _get_invoice_number(entity_id: str, prefix: str = "INV", counter_collection: str = "coach_invoice_counters") -> str:
    """Auto-increment invoice number per entity per year."""
    result = await db[counter_collection].find_one_and_update(
        {"coach_id": entity_id},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = result.get("seq", 1) if result else 1
    year = now_ist().year
    return f"{prefix}-{year}-{seq:04d}"


def _compute_totals(items: list, gst_enabled: bool, gst_rate: int) -> dict:
    subtotal = round(sum(float(i.get("qty", 1)) * float(i.get("rate", 0)) for i in items), 2)
    gst_amount = round(subtotal * gst_rate / 100, 2) if gst_enabled else 0
    return {"subtotal": subtotal, "gst_amount": gst_amount, "total": round(subtotal + gst_amount, 2)}


# ─── Coaching Auto-Invoice ───────────────────────────────────────────────────

async def generate_coaching_invoice(
    source_doc: dict,
    source_type: str,
    payment_details: dict,
) -> dict | None:
    """
    Generate an auto-invoice for a coaching payment.
    Inserts into coach_invoices collection (same as manual invoices).

    Args:
        source_doc: The session or subscription document (after payment confirmed).
        source_type: "coaching_session" | "coaching_subscription" | "coaching_renewal"
        payment_details: Dict with razorpay_payment_id or test_payment_id and paid_at.

    Returns:
        The invoice dict, or None on failure.
    """
    try:
        coach_id = source_doc["coach_id"]

        # Idempotency: skip if invoice already exists for this source
        existing = await db.coach_invoices.find_one({
            "source_type": source_type,
            "source_id": source_doc["id"],
            "auto_generated": True,
        })
        if existing:
            logger.info(f"Auto-invoice already exists for {source_type} {source_doc['id']}")
            return existing

        # Fetch coach details
        coach = await db.users.find_one({"id": coach_id}, {"_id": 0, "name": 1, "phone": 1, "email": 1})

        # Fetch GST settings
        gst_cfg = await db.coach_gst_settings.find_one({"coach_id": coach_id}, {"_id": 0}) or {}
        gst_enabled = gst_cfg.get("gst_enabled", False)
        gst_rate = gst_cfg.get("gst_rate", 18)
        gstin = gst_cfg.get("gstin", "")
        prefix = gst_cfg.get("invoice_prefix", "INV")

        # Fetch player details
        player_id = source_doc.get("player_id", "")
        player = None
        if player_id:
            player = await db.users.find_one({"id": player_id}, {"_id": 0, "name": 1, "phone": 1, "email": 1})

        # Build line items based on source_type
        if source_type == "coaching_session":
            price = source_doc.get("price", 0)
            sport = source_doc.get("sport", "Coaching").replace("_", " ").title()
            desc = f"{sport} Session — {source_doc.get('date', '')} {source_doc.get('start_time', '')}–{source_doc.get('end_time', '')}"
            items = [{"description": desc, "qty": 1, "rate": float(price), "amount": float(price)}]
        elif source_type in ("coaching_subscription", "coaching_renewal"):
            price = source_doc.get("price", 0)
            pkg_name = source_doc.get("package_name", "Coaching Package")
            sessions = source_doc.get("sessions_per_month", 0)
            desc = f"{pkg_name} ({sessions} sessions/month)"
            if source_type == "coaching_renewal":
                desc += " — Renewal"
            items = [{"description": desc, "qty": 1, "rate": float(price), "amount": float(price)}]
        else:
            items = [{"description": "Coaching Payment", "qty": 1, "rate": 0, "amount": 0}]

        totals = _compute_totals(items, gst_enabled, gst_rate)
        invoice_no = await _get_invoice_number(coach_id, prefix, "coach_invoice_counters")
        now = now_ist()
        today = now.strftime("%Y-%m-%d")

        payment_ref = payment_details.get("razorpay_payment_id") or payment_details.get("test_payment_id") or ""

        invoice = {
            "id": str(uuid.uuid4()),
            "invoice_no": invoice_no,
            "coach_id": coach_id,
            "coach_name": (coach or {}).get("name", source_doc.get("coach_name", "")),
            "coach_phone": (coach or {}).get("phone", ""),
            "coach_email": (coach or {}).get("email", ""),
            "coach_gstin": gstin,
            "client_id": player_id,
            "client_name": (player or {}).get("name", source_doc.get("player_name", "")),
            "client_phone": (player or {}).get("phone", ""),
            "client_email": (player or {}).get("email", ""),
            "date": today,
            "due_date": today,
            "items": items,
            "subtotal": totals["subtotal"],
            "gst_enabled": gst_enabled,
            "gst_rate": gst_rate,
            "gst_amount": totals["gst_amount"],
            "total": totals["total"],
            "status": "paid",
            "payment_mode": "razorpay" if payment_details.get("razorpay_payment_id") else "test",
            "notes": f"Auto-generated for {source_type.replace('_', ' ')}",
            # Auto-invoice specific fields
            "auto_generated": True,
            "source_type": source_type,
            "source_id": source_doc["id"],
            "payment_reference": payment_ref,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }

        await db.coach_invoices.insert_one(invoice)
        invoice.pop("_id", None)

        # Stamp invoice_id on the source document
        col = "coaching_sessions" if source_type == "coaching_session" else "coaching_subscriptions"
        await db[col].update_one({"id": source_doc["id"]}, {"$set": {"invoice_id": invoice["id"]}})

        logger.info(f"Auto-invoice {invoice_no} created for {source_type} {source_doc['id']}")
        return invoice

    except Exception as e:
        logger.error(f"Auto-invoice failed for {source_type} {source_doc.get('id', '?')}: {e}")
        return None


# ─── Venue Booking Auto-Invoice ──────────────────────────────────────────────

async def generate_venue_invoice(
    booking: dict,
    payment_details: dict,
) -> dict | None:
    """
    Generate an auto-invoice for a venue booking payment.
    Inserts into venue_invoices collection.

    Args:
        booking: The booking document (after payment confirmed).
        payment_details: Dict with razorpay_payment_id or test_payment_id and paid_at.

    Returns:
        The invoice dict, or None on failure.
    """
    try:
        # Idempotency check
        existing = await db.venue_invoices.find_one({
            "source_type": "venue_booking",
            "source_id": booking["id"],
            "auto_generated": True,
        })
        if existing:
            logger.info(f"Auto-invoice already exists for venue_booking {booking['id']}")
            return existing

        venue_id = booking.get("venue_id", "")
        venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "name": 1, "owner_id": 1})
        if not venue:
            logger.warning(f"Venue {venue_id} not found for invoice generation")
            return None

        owner_id = venue.get("owner_id", "")
        owner = None
        if owner_id:
            owner = await db.users.find_one({"id": owner_id}, {"_id": 0, "name": 1, "phone": 1, "email": 1})

        # Payer info
        host_id = booking.get("host_id", "")
        host = None
        if host_id:
            host = await db.users.find_one({"id": host_id}, {"_id": 0, "name": 1, "phone": 1, "email": 1})

        # Build line item
        total_amount = booking.get("total_amount", 0)
        sport = booking.get("sport", "").replace("_", " ").title()
        desc = f"{booking.get('venue_name', 'Venue')} — {sport} ({booking.get('date', '')} {booking.get('start_time', '')}–{booking.get('end_time', '')})"
        if booking.get("turf_name"):
            desc += f" [{booking['turf_name']}]"

        items = [{"description": desc, "qty": 1, "rate": float(total_amount), "amount": float(total_amount)}]
        totals = _compute_totals(items, False, 0)

        invoice_no = await _get_invoice_number(owner_id or venue_id, "VEN", "venue_invoice_counters")
        now = now_ist()
        today = now.strftime("%Y-%m-%d")

        payment_ref = payment_details.get("razorpay_payment_id") or payment_details.get("test_payment_id") or ""

        invoice = {
            "id": str(uuid.uuid4()),
            "invoice_no": invoice_no,
            "venue_id": venue_id,
            "venue_name": booking.get("venue_name", venue.get("name", "")),
            "owner_id": owner_id,
            "owner_name": (owner or {}).get("name", ""),
            "owner_phone": (owner or {}).get("phone", ""),
            "owner_email": (owner or {}).get("email", ""),
            "client_id": host_id,
            "client_name": (host or {}).get("name", booking.get("host_name", "")),
            "client_phone": (host or {}).get("phone", ""),
            "client_email": (host or {}).get("email", ""),
            "date": today,
            "due_date": today,
            "items": items,
            "subtotal": totals["subtotal"],
            "gst_enabled": False,
            "gst_rate": 0,
            "gst_amount": 0,
            "total": totals["total"],
            "status": "paid",
            "payment_mode": "razorpay" if payment_details.get("razorpay_payment_id") else "test",
            "notes": "Auto-generated for venue booking",
            "auto_generated": True,
            "source_type": "venue_booking",
            "source_id": booking["id"],
            "payment_reference": payment_ref,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }

        await db.venue_invoices.insert_one(invoice)
        invoice.pop("_id", None)

        # Stamp invoice_id on the booking
        await db.bookings.update_one({"id": booking["id"]}, {"$set": {"invoice_id": invoice["id"]}})

        logger.info(f"Auto-invoice {invoice_no} created for venue_booking {booking['id']}")
        return invoice

    except Exception as e:
        logger.error(f"Venue auto-invoice failed for booking {booking.get('id', '?')}: {e}")
        return None
