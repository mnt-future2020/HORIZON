"""
Coach Invoice Management
Invoice CRUD + PDF generation (fpdf2) + GST settings + WhatsApp sharing.
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime, timezone, timedelta
from database import db
from tz import now_ist
from auth import get_current_user
import uuid
import io
import logging
import urllib.parse

logger = logging.getLogger("horizon.coach_invoices")

router = APIRouter(prefix="/coaching", tags=["coaching-invoices"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def _get_invoice_number(coach_id: str, prefix: str = "INV") -> str:
    """Auto-increment invoice number per coach."""
    result = await db.coach_invoice_counters.find_one_and_update(
        {"coach_id": coach_id},
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


# ─── GST Settings ─────────────────────────────────────────────────────────────

@router.get("/settings/gst")
async def get_gst_settings(user=Depends(get_current_user)):
    """Get coach's GST & invoice settings."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Coaches only")
    s = await db.coach_gst_settings.find_one({"coach_id": user["id"]}, {"_id": 0})
    if not s:
        return {"coach_id": user["id"], "gst_enabled": False, "gst_rate": 18, "gstin": "", "invoice_prefix": "INV"}
    return s


@router.put("/settings/gst")
async def save_gst_settings(request: Request, user=Depends(get_current_user)):
    """Save coach's GST & invoice settings."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Coaches only")
    data = await request.json()
    allowed = ["gst_enabled", "gst_rate", "gstin", "invoice_prefix"]
    updates = {k: v for k, v in data.items() if k in allowed}
    if "gst_rate" in updates and updates["gst_rate"] not in (0, 5, 12, 18):
        raise HTTPException(400, "GST rate must be 0, 5, 12, or 18")
    updates["updated_at"] = now_ist().isoformat()
    await db.coach_gst_settings.update_one(
        {"coach_id": user["id"]},
        {"$set": {**updates, "coach_id": user["id"]}},
        upsert=True,
    )
    return await db.coach_gst_settings.find_one({"coach_id": user["id"]}, {"_id": 0})


# ─── Invoice CRUD ─────────────────────────────────────────────────────────────

@router.post("/invoices")
async def create_invoice(request: Request, user=Depends(get_current_user)):
    """Create a new invoice."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Coaches only")
    data = await request.json()

    items = data.get("items", [])
    if not items:
        raise HTTPException(400, "At least one item is required")

    # Process items
    processed_items = []
    for item in items:
        qty = float(item.get("qty", 1))
        rate = float(item.get("rate", 0))
        processed_items.append({
            "description": (item.get("description") or "").strip(),
            "qty": qty,
            "rate": rate,
            "amount": round(qty * rate, 2),
        })

    # GST settings
    gst_cfg = await db.coach_gst_settings.find_one({"coach_id": user["id"]}, {"_id": 0})
    gst_enabled = bool(data.get("gst_enabled", (gst_cfg or {}).get("gst_enabled", False)))
    gst_rate = int(data.get("gst_rate", (gst_cfg or {}).get("gst_rate", 18)))
    gstin = (gst_cfg or {}).get("gstin", "")
    prefix = (gst_cfg or {}).get("invoice_prefix", "INV")

    totals = _compute_totals(processed_items, gst_enabled, gst_rate)

    invoice_no = await _get_invoice_number(user["id"], prefix)
    now = now_ist().isoformat()
    today = now[:10]
    default_due = (now_ist() + timedelta(days=7)).strftime("%Y-%m-%d")

    coach_doc = await db.users.find_one({"id": user["id"]}, {"name": 1, "phone": 1, "email": 1})

    invoice = {
        "id": str(uuid.uuid4()),
        "invoice_no": invoice_no,
        "coach_id": user["id"],
        "coach_name": (coach_doc or {}).get("name", ""),
        "coach_phone": (coach_doc or {}).get("phone", ""),
        "coach_email": (coach_doc or {}).get("email", ""),
        "coach_gstin": gstin,
        "client_id": data.get("client_id", ""),
        "client_name": data.get("client_name", ""),
        "client_phone": data.get("client_phone", ""),
        "client_email": data.get("client_email", ""),
        "date": data.get("date", today),
        "due_date": data.get("due_date", default_due),
        "items": processed_items,
        "subtotal": totals["subtotal"],
        "gst_enabled": gst_enabled,
        "gst_rate": gst_rate,
        "gst_amount": totals["gst_amount"],
        "total": totals["total"],
        "status": data.get("status", "sent"),          # draft | sent | paid
        "payment_mode": data.get("payment_mode", "cash"),
        "notes": data.get("notes", ""),
        "created_at": now,
        "updated_at": now,
    }
    await db.coach_invoices.insert_one(invoice)
    invoice.pop("_id", None)
    return invoice


@router.get("/invoices")
async def list_invoices(
    user=Depends(get_current_user),
    status: Optional[str] = Query(None),
    month: Optional[str] = Query(None),
    client_id: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    limit: int = Query(100, le=200),
):
    """List invoices for this coach."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Coaches only")
    q = {"coach_id": user["id"]}
    if status and status != "all":
        q["status"] = status
    if client_id:
        q["client_id"] = client_id
    if month:
        q["date"] = {"$regex": f"^{month}"}
    if source == "auto":
        q["auto_generated"] = True
    elif source == "manual":
        q["auto_generated"] = {"$ne": True}
    invoices = []
    async for inv in db.coach_invoices.find(q, {"_id": 0}).sort("date", -1).limit(limit):
        invoices.append(inv)
    return invoices


@router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, user=Depends(get_current_user)):
    """Get a single invoice."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Coaches only")
    inv = await db.coach_invoices.find_one({"id": invoice_id, "coach_id": user["id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    return inv


@router.put("/invoices/{invoice_id}")
async def update_invoice(invoice_id: str, request: Request, user=Depends(get_current_user)):
    """Update invoice status, notes, due_date, payment_mode."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Coaches only")
    inv = await db.coach_invoices.find_one({"id": invoice_id, "coach_id": user["id"]})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    data = await request.json()
    allowed = ["status", "notes", "due_date", "payment_mode", "date"]
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        updates["updated_at"] = now_ist().isoformat()
        await db.coach_invoices.update_one({"id": invoice_id}, {"$set": updates})
    return await db.coach_invoices.find_one({"id": invoice_id}, {"_id": 0})


@router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, user=Depends(get_current_user)):
    """Delete an invoice."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Coaches only")
    inv = await db.coach_invoices.find_one({"id": invoice_id, "coach_id": user["id"]})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    if inv.get("auto_generated"):
        raise HTTPException(400, "Cannot delete auto-generated invoices")
    await db.coach_invoices.delete_one({"id": invoice_id})
    return {"message": "Invoice deleted"}


@router.post("/invoices/{invoice_id}/mark-paid")
async def mark_invoice_paid(invoice_id: str, user=Depends(get_current_user)):
    """Mark invoice as paid."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Coaches only")
    result = await db.coach_invoices.update_one(
        {"id": invoice_id, "coach_id": user["id"]},
        {"$set": {"status": "paid", "updated_at": now_ist().isoformat()}},
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Invoice not found")
    return {"message": "Marked as paid"}


# ─── PDF Generation ───────────────────────────────────────────────────────────

@router.get("/invoices/{invoice_id}/pdf")
async def download_invoice_pdf(invoice_id: str, user=Depends(get_current_user)):
    """Generate and return invoice as PDF (viewable + downloadable)."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Coaches only")
    inv = await db.coach_invoices.find_one({"id": invoice_id, "coach_id": user["id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    try:
        pdf_bytes = _generate_invoice_pdf(inv)
    except Exception as e:
        logger.error(f"PDF generation failed for invoice {invoice_id}: {e}")
        raise HTTPException(500, "PDF generation failed")

    filename = f"invoice-{inv['invoice_no']}.pdf"
    # inline = viewable in browser; attachment = force download
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


def _generate_invoice_pdf(inv: dict) -> bytes:
    """Generate a professional invoice PDF using fpdf2."""
    from fpdf import FPDF

    class PDF(FPDF):
        def header(self):
            pass
        def footer(self):
            self.set_y(-12)
            self.set_font("Helvetica", "I", 7)
            self.set_text_color(160, 160, 160)
            self.cell(0, 5, "Generated by Lobbi · lobbi.in", align="C")

    pdf = PDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=18)

    # ── Dark header banner ──
    pdf.set_fill_color(10, 10, 25)
    pdf.rect(0, 0, 210, 38, "F")

    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_xy(14, 8)
    pdf.cell(90, 10, "INVOICE", ln=False)

    pdf.set_font("Helvetica", "", 9)
    pdf.set_xy(130, 7)
    pdf.cell(65, 5, f"Invoice No: {inv.get('invoice_no', '')}", align="R", ln=True)
    pdf.set_xy(130, 13)
    pdf.cell(65, 5, f"Date: {inv.get('date', '')}", align="R", ln=True)
    pdf.set_xy(130, 19)
    pdf.cell(65, 5, f"Due: {inv.get('due_date', '')}", align="R", ln=True)

    status = inv.get("status", "")
    if status == "paid":
        pdf.set_text_color(16, 185, 129)
    elif status == "sent":
        pdf.set_text_color(245, 158, 11)
    else:
        pdf.set_text_color(148, 163, 184)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_xy(130, 26)
    pdf.cell(65, 5, status.upper(), align="R")

    # ── From / Bill To ──
    pdf.set_text_color(30, 30, 30)
    pdf.set_xy(14, 48)

    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(100, 100, 120)
    pdf.cell(90, 5, "FROM", ln=False)
    pdf.cell(90, 5, "BILL TO", ln=True)

    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(20, 20, 20)
    pdf.set_x(14)
    pdf.cell(90, 5, inv.get("coach_name", ""), ln=False)
    pdf.cell(90, 5, inv.get("client_name", ""), ln=True)

    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(80, 80, 80)
    if inv.get("coach_phone") or inv.get("client_phone"):
        pdf.set_x(14)
        pdf.cell(90, 4, f"Ph: {inv.get('coach_phone', '')}", ln=False)
        pdf.cell(90, 4, f"Ph: {inv.get('client_phone', '')}", ln=True)
    if inv.get("coach_email") or inv.get("client_email"):
        pdf.set_x(14)
        pdf.cell(90, 4, inv.get("coach_email", ""), ln=False)
        pdf.cell(90, 4, inv.get("client_email", ""), ln=True)
    if inv.get("coach_gstin"):
        pdf.set_x(14)
        pdf.set_text_color(60, 60, 80)
        pdf.cell(90, 4, f"GSTIN: {inv['coach_gstin']}", ln=True)

    # ── Items Table ──
    y = pdf.get_y() + 8
    pdf.set_xy(14, y)

    # Table header
    pdf.set_fill_color(235, 235, 248)
    pdf.set_text_color(40, 40, 60)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(88, 7, "Description", border="B", fill=True, align="L")
    pdf.cell(20, 7, "Qty", border="B", fill=True, align="C")
    pdf.cell(35, 7, "Rate (₹)", border="B", fill=True, align="R")
    pdf.cell(35, 7, "Amount (₹)", border="B", fill=True, align="R", ln=True)

    # Table rows
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(40, 40, 40)
    for i, item in enumerate(inv.get("items", [])):
        fill = i % 2 == 1
        pdf.set_fill_color(248, 248, 252) if fill else pdf.set_fill_color(255, 255, 255)
        pdf.set_x(14)
        desc = str(item.get("description", ""))
        # Truncate long descriptions
        if len(desc) > 50:
            desc = desc[:47] + "..."
        pdf.cell(88, 6, desc, border=0, fill=fill)
        pdf.cell(20, 6, str(item.get("qty", "")), border=0, fill=fill, align="C")
        pdf.cell(35, 6, f"{float(item.get('rate', 0)):,.2f}", border=0, fill=fill, align="R")
        pdf.cell(35, 6, f"{float(item.get('amount', 0)):,.2f}", border=0, fill=fill, align="R", ln=True)

    # Separator line
    y2 = pdf.get_y()
    pdf.set_draw_color(200, 200, 220)
    pdf.line(14, y2, 196, y2)

    # ── Totals ──
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(60, 60, 60)
    y3 = y2 + 5
    pdf.set_xy(120, y3)
    pdf.cell(45, 5, "Subtotal:", align="R")
    pdf.cell(31, 5, f"Rs {inv.get('subtotal', 0):,.2f}", align="R", ln=True)

    if inv.get("gst_enabled"):
        rate = inv.get("gst_rate", 18)
        half = rate / 2
        gst_half = inv.get("gst_amount", 0) / 2
        pdf.set_x(120)
        pdf.cell(45, 5, f"CGST ({half:.1f}%):", align="R")
        pdf.cell(31, 5, f"Rs {gst_half:,.2f}", align="R", ln=True)
        pdf.set_x(120)
        pdf.cell(45, 5, f"SGST ({half:.1f}%):", align="R")
        pdf.cell(31, 5, f"Rs {gst_half:,.2f}", align="R", ln=True)

    # Total row
    pdf.set_fill_color(10, 10, 25)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_x(120)
    pdf.cell(45, 8, "TOTAL:", fill=True, align="R")
    pdf.cell(31, 8, f"Rs {inv.get('total', 0):,.2f}", fill=True, align="R", ln=True)

    # ── Payment mode + Notes ──
    y4 = pdf.get_y() + 6
    pdf.set_xy(14, y4)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(80, 80, 80)
    if inv.get("payment_mode"):
        pdf.cell(0, 5, f"Payment Mode: {inv['payment_mode'].upper()}", ln=True)
    if inv.get("notes"):
        pdf.set_x(14)
        pdf.set_font("Helvetica", "I", 9)
        pdf.multi_cell(0, 4.5, f"Notes: {inv['notes']}")

    # ── PAID stamp ──
    if status == "paid":
        pdf.set_text_color(16, 185, 129)
        pdf.set_font("Helvetica", "B", 40)
        pdf.set_xy(50, 200)
        pdf.cell(0, 20, "PAID", align="C")

    return bytes(pdf.output())


# ─── WhatsApp Sharing ─────────────────────────────────────────────────────────

@router.post("/invoices/{invoice_id}/send-whatsapp")
async def send_invoice_whatsapp(invoice_id: str, user=Depends(get_current_user)):
    """Send invoice details via WhatsApp (API or wa.me fallback)."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Coaches only")
    inv = await db.coach_invoices.find_one({"id": invoice_id, "coach_id": user["id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")

    # Build message
    items_text = "\n".join(
        f"  • {item['description']}: ₹{float(item['amount']):,.0f}"
        for item in inv.get("items", [])
    )
    gst_line = ""
    if inv.get("gst_enabled"):
        gst_line = f"\nGST ({inv['gst_rate']}%): ₹{inv.get('gst_amount', 0):,.0f}"

    msg = (
        f"*Invoice {inv['invoice_no']}* 📄\n\n"
        f"Hi {inv.get('client_name', '')}! 👋\n\n"
        f"Please find your invoice details below:\n\n"
        f"📋 *Invoice No:* {inv['invoice_no']}\n"
        f"📅 *Date:* {inv.get('date', '')}\n"
        f"🗓 *Due:* {inv.get('due_date', '')}\n\n"
        f"*Items:*\n{items_text}"
        f"{gst_line}\n\n"
        f"💰 *Total: ₹{inv.get('total', 0):,.0f}*\n\n"
        f"Payment Mode: {(inv.get('payment_mode') or 'cash').upper()}\n\n"
        f"Thank you! 🙏\n_— {inv.get('coach_name', 'Your Coach')}_\n_Powered by Lobbi_"
    )

    phone = inv.get("client_phone", "")
    wa_link = f"https://wa.me/{phone}?text={urllib.parse.quote(msg)}" if phone else \
              f"https://wa.me/?text={urllib.parse.quote(msg)}"

    # Try WhatsApp API
    settings = await db.platform_settings.find_one({"key": "platform"}, {"_id": 0})
    wa_cfg = (settings or {}).get("whatsapp", {})
    if phone and wa_cfg.get("enabled"):
        try:
            from whatsapp_service import send_message
            result = await send_message(wa_cfg, phone, msg)
            if result.get("ok"):
                return {"ok": True, "sent_via_api": True, "wa_link": wa_link}
        except Exception as e:
            logger.warning(f"WhatsApp API send failed: {e}")

    return {"ok": True, "sent_via_api": False, "wa_link": wa_link}
