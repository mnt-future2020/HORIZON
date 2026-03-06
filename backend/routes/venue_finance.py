"""
Venue Owner Finance & Accounts
Expense tracking, P&L analytics, unified transaction ledger.
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import Optional
from datetime import timedelta
from database import db
from tz import now_ist
from auth import get_current_user
import uuid
import math

router = APIRouter(prefix="/venue-finance", tags=["venue-finance"])

EXPENSE_CATEGORIES = [
    "maintenance", "staffing", "electricity", "water", "rent",
    "equipment", "marketing", "insurance", "cleaning", "other",
]


# ─── Expense CRUD ─────────────────────────────────────────────────────────────

@router.post("/expenses")
async def create_expense(request: Request, user=Depends(get_current_user)):
    """Create a new venue expense entry."""
    if user.get("role") != "venue_owner":
        raise HTTPException(403, "Only venue owners can add expenses")
    data = await request.json()
    amount = float(data.get("amount", 0))
    if amount <= 0:
        raise HTTPException(400, "Amount must be greater than 0")
    category = data.get("category", "other")
    if category not in EXPENSE_CATEGORIES:
        raise HTTPException(400, f"Invalid category. Must be one of: {', '.join(EXPENSE_CATEGORIES)}")
    now = now_ist().isoformat()
    expense = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "category": category,
        "amount": amount,
        "date": data.get("date", now[:10]),
        "description": data.get("description", ""),
        "payment_mode": data.get("payment_mode", "cash"),
        "reference": data.get("reference", ""),
        "recurring": data.get("recurring", False),
        "recurring_frequency": data.get("recurring_frequency", ""),
        "created_at": now,
        "updated_at": now,
    }
    await db.venue_expenses.insert_one(expense)
    expense.pop("_id", None)
    return expense


@router.get("/expenses")
async def list_expenses(
    user=Depends(get_current_user),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    payment_mode: Optional[str] = Query(None),
    page: Optional[int] = Query(None, ge=1),
    limit: int = Query(10, ge=1, le=100),
):
    """List venue expenses with optional filters."""
    if user.get("role") != "venue_owner":
        raise HTTPException(403, "Only venue owners can view expenses")
    q = {"owner_id": user["id"]}
    if category:
        q["category"] = category
    if payment_mode:
        q["payment_mode"] = payment_mode
    if date_from or date_to:
        date_q = {}
        if date_from:
            date_q["$gte"] = date_from
        if date_to:
            date_q["$lte"] = date_to
        if date_q:
            q["date"] = date_q
    if page is not None:
        total = await db.venue_expenses.count_documents(q)
        skip = (page - 1) * limit
        expenses = await db.venue_expenses.find(q, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        return {"expenses": expenses, "total": total, "page": page, "pages": math.ceil(total / max(limit, 1))}
    expenses = []
    async for e in db.venue_expenses.find(q, {"_id": 0}).sort("date", -1).limit(200):
        expenses.append(e)
    return expenses


@router.put("/expenses/{expense_id}")
async def update_expense(expense_id: str, request: Request, user=Depends(get_current_user)):
    """Update a venue expense entry."""
    if user.get("role") != "venue_owner":
        raise HTTPException(403, "Only venue owners can update expenses")
    expense = await db.venue_expenses.find_one({"id": expense_id, "owner_id": user["id"]})
    if not expense:
        raise HTTPException(404, "Expense not found")
    data = await request.json()
    allowed = ["category", "amount", "date", "description", "payment_mode", "reference", "recurring", "recurring_frequency"]
    updates = {k: v for k, v in data.items() if k in allowed}
    if "amount" in updates:
        updates["amount"] = float(updates["amount"])
        if updates["amount"] <= 0:
            raise HTTPException(400, "Amount must be greater than 0")
    if "category" in updates and updates["category"] not in EXPENSE_CATEGORIES:
        raise HTTPException(400, "Invalid category")
    if updates:
        updates["updated_at"] = now_ist().isoformat()
        await db.venue_expenses.update_one({"id": expense_id}, {"$set": updates})
    updated = await db.venue_expenses.find_one({"id": expense_id}, {"_id": 0})
    return updated


@router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, user=Depends(get_current_user)):
    """Delete a venue expense entry."""
    if user.get("role") != "venue_owner":
        raise HTTPException(403, "Only venue owners can delete expenses")
    expense = await db.venue_expenses.find_one({"id": expense_id, "owner_id": user["id"]})
    if not expense:
        raise HTTPException(404, "Expense not found")
    await db.venue_expenses.delete_one({"id": expense_id})
    return {"message": "Expense deleted"}


# ─── Finance Summary (P&L) ───────────────────────────────────────────────────

@router.get("/analytics/finance-summary")
async def finance_summary(
    user=Depends(get_current_user),
    venue_id: Optional[str] = Query(None),
):
    """Full P&L: income by sport/venue, expenses by category, monthly trend."""
    if user.get("role") != "venue_owner":
        raise HTTPException(403, "Only venue owners can view finance summary")

    owner_id = user["id"]

    # Resolve all venues owned by this user
    venues = []
    venue_ids = []
    venue_names = {}
    async for v in db.venues.find({"owner_id": owner_id}, {"_id": 0, "id": 1, "name": 1}):
        venues.append(v)
        venue_ids.append(v["id"])
        venue_names[v["id"]] = v.get("name", "Venue")

    # Filter to specific venue if requested
    if venue_id and venue_id in venue_ids:
        venue_ids = [venue_id]

    if not venue_ids:
        return {
            "total_income": 0, "total_bookings": 0, "commission_pct": 0, "commission_total": 0,
            "net_income": 0, "total_expenses": 0, "expenses_by_category": {},
            "net_profit": 0, "income_by_sport": {}, "income_by_venue": {},
            "monthly_trend": [], "current_month": {"income": 0, "expenses": 0, "net": 0},
        }

    # ── Income from confirmed/completed bookings ──
    total_income = 0
    total_bookings = 0
    income_by_sport = {}
    income_by_venue = {}

    async for b in db.bookings.find(
        {"venue_id": {"$in": venue_ids}, "status": {"$in": ["confirmed", "completed"]}},
        {"total_amount": 1, "sport": 1, "venue_id": 1, "_id": 0}
    ):
        amt = b.get("total_amount", 0)
        total_income += amt
        total_bookings += 1

        sport = (b.get("sport") or "other").replace("_", " ").title()
        income_by_sport[sport] = income_by_sport.get(sport, 0) + amt

        vid = b.get("venue_id", "")
        vname = venue_names.get(vid, "Other")
        income_by_venue[vname] = income_by_venue.get(vname, 0) + amt

    # ── Commission ──
    settings = await db.platform_settings.find_one({"key": "platform"})
    commission_pct = 10
    if settings:
        commission_pct = settings.get("booking_commission_pct", settings.get("venue_commission_pct", 10))
    commission_total = round(total_income * commission_pct / 100, 2)
    net_income = round(total_income - commission_total, 2)

    # ── Expenses by category ──
    total_expenses = 0
    expenses_by_category = {cat: 0 for cat in EXPENSE_CATEGORIES}
    async for e in db.venue_expenses.find({"owner_id": owner_id}, {"amount": 1, "category": 1, "_id": 0}):
        amt = e.get("amount", 0)
        total_expenses += amt
        cat = e.get("category", "other")
        if cat in expenses_by_category:
            expenses_by_category[cat] += amt
        else:
            expenses_by_category["other"] += amt

    expenses_by_category = {k: v for k, v in expenses_by_category.items() if v > 0}
    net_profit = round(net_income - total_expenses, 2)

    # ── Monthly trend (last 6 months) ──
    now = now_ist()
    monthly_trend = []
    current_month_key = now.strftime("%Y-%m")
    current_month_income = 0
    current_month_expenses = 0

    for i in range(5, -1, -1):
        d = now - timedelta(days=i * 30)
        month_key = d.strftime("%Y-%m")
        month_label = d.strftime("%b %Y")

        m_income = 0
        m_bookings = 0
        async for b in db.bookings.find(
            {"venue_id": {"$in": venue_ids}, "status": {"$in": ["confirmed", "completed"]},
             "date": {"$regex": f"^{month_key}"}},
            {"total_amount": 1, "_id": 0}
        ):
            m_income += b.get("total_amount", 0)
            m_bookings += 1

        m_expenses = 0
        async for e in db.venue_expenses.find(
            {"owner_id": owner_id, "date": {"$regex": f"^{month_key}"}},
            {"amount": 1, "_id": 0}
        ):
            m_expenses += e.get("amount", 0)

        monthly_trend.append({
            "month": month_label, "income": m_income, "bookings": m_bookings,
            "expenses": m_expenses, "net": round(m_income * (1 - commission_pct / 100) - m_expenses, 2),
        })

        if month_key == current_month_key:
            current_month_income = m_income
            current_month_expenses = m_expenses

    return {
        "total_income": total_income,
        "total_bookings": total_bookings,
        "commission_pct": commission_pct,
        "commission_total": commission_total,
        "net_income": net_income,
        "total_expenses": round(total_expenses, 2),
        "expenses_by_category": expenses_by_category,
        "net_profit": net_profit,
        "income_by_sport": income_by_sport,
        "income_by_venue": income_by_venue,
        "monthly_trend": monthly_trend,
        "current_month": {
            "income": current_month_income,
            "expenses": current_month_expenses,
            "net": round(current_month_income * (1 - commission_pct / 100) - current_month_expenses, 2),
        },
    }


# ─── Unified Transactions Ledger ──────────────────────────────────────────────

@router.get("/transactions")
async def list_transactions(
    user=Depends(get_current_user),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    venue_id: Optional[str] = Query(None),
    page: Optional[int] = Query(None, ge=1),
    limit: int = Query(10, ge=1, le=100),
):
    """Unified transaction ledger: booking income + expenses merged chronologically."""
    if user.get("role") != "venue_owner":
        raise HTTPException(403, "Only venue owners can view transactions")

    owner_id = user["id"]
    transactions = []

    # Get commission percentage
    settings = await db.platform_settings.find_one({"key": "platform"})
    commission_pct = 10
    if settings:
        commission_pct = settings.get("booking_commission_pct", settings.get("venue_commission_pct", 10))

    def date_in_range(date_str):
        if not date_str:
            return True
        if date_from and date_str < date_from:
            return False
        if date_to and date_str > date_to:
            return False
        return True

    # ── Income: Booking transactions ──
    if type != "expense":
        venue_ids = []
        venue_names = {}
        async for v in db.venues.find({"owner_id": owner_id}, {"_id": 0, "id": 1, "name": 1}):
            venue_ids.append(v["id"])
            venue_names[v["id"]] = v.get("name", "Venue")

        # Filter to specific venue if requested
        if venue_id and venue_id in venue_ids:
            venue_ids = [venue_id]

        if venue_ids:
            async for b in db.bookings.find(
                {"venue_id": {"$in": venue_ids}, "status": {"$in": ["confirmed", "completed", "cancelled"]}},
                {"_id": 0, "id": 1, "host_name": 1, "total_amount": 1, "date": 1,
                 "sport": 1, "venue_id": 1, "start_time": 1, "end_time": 1, "created_at": 1,
                 "status": 1, "cancelled_at": 1, "refund_status": 1, "refund_amount": 1}
            ).sort("date", -1).limit(200):
                if not date_in_range(b.get("date", "")):
                    continue
                vname = venue_names.get(b.get("venue_id", ""), "Venue")
                sport = (b.get("sport") or "").replace("_", " ").title()
                # Booking income entry (net after commission)
                gross = b.get("total_amount", 0)
                net = round(gross * (1 - commission_pct / 100))
                is_cancelled = b.get("status") == "cancelled"
                host = b.get("host_name", "")
                desc = f"{vname} — {sport} ({b.get('date', '')})"
                transactions.append({
                    "id": b["id"], "type": "income", "category": "venue_booking",
                    "client_name": host,
                    "description": desc,
                    "amount": net, "gross_amount": gross, "payment_mode": "razorpay",
                    "date": b.get("date", ""), "source": "online",
                    "status": b.get("status", "confirmed"),
                    "created_at": b.get("created_at", ""),
                })
                # Cancellation deduction entry
                if is_cancelled:
                    transactions.append({
                        "id": f"{b['id']}_cancel", "type": "deduction", "category": "booking_cancelled",
                        "client_name": host,
                        "description": desc,
                        "amount": net, "payment_mode": "razorpay",
                        "date": b.get("cancelled_at", b.get("date", ""))[:10] if b.get("cancelled_at") else b.get("date", ""),
                        "source": "cancellation",
                        "status": "cancelled",
                        "created_at": b.get("cancelled_at", ""),
                    })

    # ── Expense transactions ──
    if type != "income":
        eq = {"owner_id": owner_id}
        if date_from or date_to:
            date_q = {}
            if date_from:
                date_q["$gte"] = date_from
            if date_to:
                date_q["$lte"] = date_to
            if date_q:
                eq["date"] = date_q
        async for e in db.venue_expenses.find(eq, {"_id": 0}).sort("date", -1).limit(200):
            transactions.append({
                "id": e["id"], "type": "expense", "category": e.get("category", "other"),
                "client_name": "", "description": e.get("description", ""),
                "amount": e.get("amount", 0), "payment_mode": e.get("payment_mode", "cash"),
                "date": e.get("date", ""), "source": "expense",
                "created_at": e.get("created_at", ""),
            })

    # Post-filter by type
    if type == "cancelled":
        transactions = [t for t in transactions if t.get("status") == "cancelled"]
    elif type == "income":
        transactions = [t for t in transactions if t.get("type") == "income" and t.get("status") != "cancelled"]

    transactions.sort(key=lambda x: x.get("date", ""), reverse=True)
    if page is not None:
        total = len(transactions)
        skip = (page - 1) * limit
        return {"transactions": transactions[skip:skip + limit], "total": total, "page": page, "pages": math.ceil(total / max(limit, 1))}
    return transactions[:200]
