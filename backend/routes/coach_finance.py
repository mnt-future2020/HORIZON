"""
Coach Finance & Accounts
Expense tracking, P&L analytics, client outstanding, unified transaction ledger.
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import Optional
from datetime import datetime, timezone, timedelta
from database import db
from tz import now_ist
from auth import get_current_user
import uuid

router = APIRouter(prefix="/coaching", tags=["coaching-finance"])

EXPENSE_CATEGORIES = [
    "venue_rent", "equipment", "travel", "marketing", "software",
    "insurance", "utilities", "professional_fees", "other",
]


# ─── Expense CRUD ─────────────────────────────────────────────────────────────

@router.post("/expenses")
async def create_expense(request: Request, user=Depends(get_current_user)):
    """Create a new expense entry."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can add expenses")
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
        "coach_id": user["id"],
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
    await db.coach_expenses.insert_one(expense)
    expense.pop("_id", None)
    return expense


@router.get("/expenses")
async def list_expenses(
    user=Depends(get_current_user),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    payment_mode: Optional[str] = Query(None),
    limit: int = Query(200, le=500),
):
    """List expenses with optional filters."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can view expenses")
    q = {"coach_id": user["id"]}
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
    expenses = []
    async for e in db.coach_expenses.find(q, {"_id": 0}).sort("date", -1).limit(limit):
        expenses.append(e)
    return expenses


@router.put("/expenses/{expense_id}")
async def update_expense(expense_id: str, request: Request, user=Depends(get_current_user)):
    """Update an expense entry."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can update expenses")
    expense = await db.coach_expenses.find_one({"id": expense_id, "coach_id": user["id"]})
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
        await db.coach_expenses.update_one({"id": expense_id}, {"$set": updates})
    updated = await db.coach_expenses.find_one({"id": expense_id}, {"_id": 0})
    return updated


@router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, user=Depends(get_current_user)):
    """Delete an expense entry."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can delete expenses")
    expense = await db.coach_expenses.find_one({"id": expense_id, "coach_id": user["id"]})
    if not expense:
        raise HTTPException(404, "Expense not found")
    await db.coach_expenses.delete_one({"id": expense_id})
    return {"message": "Expense deleted"}


# ─── Finance Summary (P&L + Payment Mode Breakdown) ──────────────────────────

@router.get("/analytics/finance-summary")
async def finance_summary(user=Depends(get_current_user)):
    """Full P&L: income by source, expenses by category, payment mode breakdown, monthly trend."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can view finance summary")

    coach_id = user["id"]

    # ── Income: Online sessions ──
    online_session_income = 0
    async for s in db.coaching_sessions.find(
        {"coach_id": coach_id, "status": "completed", "payment_status": "captured"},
        {"amount": 1, "_id": 0}
    ):
        online_session_income += s.get("amount", 0)

    # ── Income: Package/subscriptions ──
    package_income = 0
    async for sub in db.coaching_subscriptions.find(
        {"coach_id": coach_id, "payment_status": "captured"},
        {"amount": 1, "_id": 0}
    ):
        package_income += sub.get("amount", 0)

    # ── Income: Offline payments ──
    offline_income = 0
    income_by_mode = {"cash": 0, "upi": 0, "bank_transfer": 0, "cheque": 0, "razorpay": 0}

    async for p in db.coach_offline_payments.find(
        {"coach_id": coach_id}, {"amount": 1, "mode": 1, "_id": 0}
    ):
        amt = p.get("amount", 0)
        offline_income += amt
        mode = p.get("mode", "cash")
        if mode in income_by_mode:
            income_by_mode[mode] += amt
        else:
            income_by_mode["cash"] += amt

    # Also count offline sessions marked as paid (avoid double count with offline_payments)
    offline_session_income = 0
    async for s in db.coach_offline_sessions.find(
        {"coach_id": coach_id, "payment_status": "paid"},
        {"amount": 1, "payment_mode": 1, "_id": 0}
    ):
        offline_session_income += s.get("amount", 0)

    # Use the larger of the two to avoid double-counting
    offline_income = max(offline_income, offline_session_income)

    # Online income goes to razorpay
    income_by_mode["razorpay"] += online_session_income + package_income

    total_income = online_session_income + package_income + offline_income

    # ── Commission ──
    settings = await db.platform_settings.find_one({"key": "platform"})
    commission_pct = (settings or {}).get("coaching_commission_pct", 10) if settings else 10
    online_total = online_session_income + package_income
    commission_total = round(online_total * commission_pct / 100, 2)
    net_income = total_income - commission_total

    # ── Expenses by category ──
    total_expenses = 0
    expenses_by_category = {cat: 0 for cat in EXPENSE_CATEGORIES}
    async for e in db.coach_expenses.find({"coach_id": coach_id}, {"amount": 1, "category": 1, "_id": 0}):
        amt = e.get("amount", 0)
        total_expenses += amt
        cat = e.get("category", "other")
        if cat in expenses_by_category:
            expenses_by_category[cat] += amt
        else:
            expenses_by_category["other"] += amt

    # Remove zero categories
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
        # Online sessions
        async for s in db.coaching_sessions.find(
            {"coach_id": coach_id, "status": "completed", "payment_status": "captured",
             "date": {"$regex": f"^{month_key}"}},
            {"amount": 1, "_id": 0}
        ):
            m_income += s.get("amount", 0)
        # Offline payments
        async for p in db.coach_offline_payments.find(
            {"coach_id": coach_id, "collected_at": {"$regex": f"^{month_key}"}},
            {"amount": 1, "_id": 0}
        ):
            m_income += p.get("amount", 0)
        # Subscriptions
        async for sub in db.coaching_subscriptions.find(
            {"coach_id": coach_id, "payment_status": "captured",
             "created_at": {"$regex": f"^{month_key}"}},
            {"amount": 1, "_id": 0}
        ):
            m_income += sub.get("amount", 0)

        m_expenses = 0
        async for e in db.coach_expenses.find(
            {"coach_id": coach_id, "date": {"$regex": f"^{month_key}"}},
            {"amount": 1, "_id": 0}
        ):
            m_expenses += e.get("amount", 0)

        monthly_trend.append({
            "month": month_label, "income": m_income,
            "expenses": m_expenses, "net": round(m_income - m_expenses, 2),
        })

        if month_key == current_month_key:
            current_month_income = m_income
            current_month_expenses = m_expenses

    return {
        "total_income": total_income,
        "online_income": online_total,
        "offline_income": offline_income,
        "commission_pct": commission_pct,
        "commission_total": commission_total,
        "net_income": round(net_income, 2),
        "total_expenses": round(total_expenses, 2),
        "expenses_by_category": expenses_by_category,
        "net_profit": net_profit,
        "income_by_mode": income_by_mode,
        "monthly_trend": monthly_trend,
        "current_month": {
            "income": current_month_income,
            "expenses": current_month_expenses,
            "net": round(current_month_income - current_month_expenses, 2),
        },
    }


# ─── Client Outstanding ──────────────────────────────────────────────────────

@router.get("/analytics/client-outstanding")
async def client_outstanding(user=Depends(get_current_user)):
    """Client-wise outstanding: billed vs paid for each client."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can view outstanding")

    coach_id = user["id"]
    result = []

    # Offline clients
    async for c in db.coach_clients.find({"coach_id": coach_id, "status": "active"}, {"_id": 0}):
        client_id = c["id"]

        # Total billed from offline sessions
        total_billed = 0
        last_session_date = None
        async for s in db.coach_offline_sessions.find(
            {"coach_id": coach_id, "client_id": client_id},
            {"amount": 1, "date": 1, "_id": 0}
        ):
            total_billed += s.get("amount", 0)
            sd = s.get("date", "")
            if not last_session_date or sd > last_session_date:
                last_session_date = sd

        # Total paid from offline payments
        total_paid = 0
        last_payment_date = None
        async for p in db.coach_offline_payments.find(
            {"coach_id": coach_id, "client_id": client_id},
            {"amount": 1, "collected_at": 1, "_id": 0}
        ):
            total_paid += p.get("amount", 0)
            pd = (p.get("collected_at") or "")[:10]
            if pd and (not last_payment_date or pd > last_payment_date):
                last_payment_date = pd

        # Also count sessions marked as paid directly
        paid_sessions_total = 0
        async for s in db.coach_offline_sessions.find(
            {"coach_id": coach_id, "client_id": client_id, "payment_status": "paid"},
            {"amount": 1, "_id": 0}
        ):
            paid_sessions_total += s.get("amount", 0)

        total_paid = max(total_paid, paid_sessions_total)
        outstanding = round(total_billed - total_paid, 2)

        # Determine status
        if outstanding <= 0:
            status = "paid"
        elif last_session_date:
            days_since = (now_ist() - datetime.fromisoformat(last_session_date + "T00:00:00+00:00")).days
            status = "overdue" if days_since > 30 else "pending"
        else:
            status = "pending"

        result.append({
            "client_id": client_id,
            "client_name": c.get("name", ""),
            "client_source": "offline",
            "total_billed": round(total_billed, 2),
            "total_paid": round(total_paid, 2),
            "outstanding": max(outstanding, 0),
            "status": status,
            "last_payment_date": last_payment_date,
            "last_session_date": last_session_date,
        })

    # Sort: overdue first, then pending, then paid
    status_order = {"overdue": 0, "pending": 1, "paid": 2}
    result.sort(key=lambda x: (status_order.get(x["status"], 3), -(x["outstanding"])))
    return result


# ─── Unified Transactions Ledger ──────────────────────────────────────────────

@router.get("/transactions")
async def list_transactions(
    user=Depends(get_current_user),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    type: Optional[str] = Query(None),  # "income" | "expense"
    category: Optional[str] = Query(None),
    payment_mode: Optional[str] = Query(None),
    limit: int = Query(200, le=500),
):
    """Unified transaction ledger: all income + expenses merged chronologically."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can view transactions")

    coach_id = user["id"]
    transactions = []

    def date_in_range(date_str):
        if not date_str:
            return True
        if date_from and date_str < date_from:
            return False
        if date_to and date_str > date_to:
            return False
        return True

    # ── Income transactions ──
    if type != "expense":
        # Online sessions
        if not category or category == "online_session":
            async for s in db.coaching_sessions.find(
                {"coach_id": coach_id, "status": "completed", "payment_status": "captured"},
                {"_id": 0, "id": 1, "player_name": 1, "amount": 1, "date": 1, "sport": 1, "created_at": 1}
            ).sort("date", -1).limit(100):
                if not date_in_range(s.get("date", "")):
                    continue
                if payment_mode and payment_mode != "razorpay":
                    continue
                transactions.append({
                    "id": s["id"], "type": "income", "category": "online_session",
                    "client_name": s.get("player_name", ""), "description": f"Online session ({s.get('sport', '')})",
                    "amount": s.get("amount", 0), "payment_mode": "razorpay",
                    "date": s.get("date", ""), "source": "online", "created_at": s.get("created_at", ""),
                })

        # Subscriptions
        if not category or category == "subscription":
            async for sub in db.coaching_subscriptions.find(
                {"coach_id": coach_id, "payment_status": "captured"},
                {"_id": 0, "id": 1, "player_name": 1, "amount": 1, "created_at": 1}
            ).sort("created_at", -1).limit(100):
                sub_date = (sub.get("created_at") or "")[:10]
                if not date_in_range(sub_date):
                    continue
                if payment_mode and payment_mode != "razorpay":
                    continue
                transactions.append({
                    "id": sub["id"], "type": "income", "category": "subscription",
                    "client_name": sub.get("player_name", ""), "description": "Package subscription",
                    "amount": sub.get("amount", 0), "payment_mode": "razorpay",
                    "date": sub_date, "source": "online", "created_at": sub.get("created_at", ""),
                })

        # Offline payments
        if not category or category == "offline_payment":
            q = {"coach_id": coach_id}
            if payment_mode:
                q["mode"] = payment_mode
            async for p in db.coach_offline_payments.find(q, {"_id": 0}).sort("created_at", -1).limit(100):
                p_date = (p.get("collected_at") or "")[:10]
                if not date_in_range(p_date):
                    continue
                transactions.append({
                    "id": p["id"], "type": "income", "category": "offline_payment",
                    "client_name": p.get("client_name", ""), "description": p.get("notes", "") or "Offline payment",
                    "amount": p.get("amount", 0), "payment_mode": p.get("mode", "cash"),
                    "date": p_date, "source": "offline", "created_at": p.get("created_at", ""),
                })

    # ── Expense transactions ──
    if type != "income":
        eq = {"coach_id": coach_id}
        if category and category in EXPENSE_CATEGORIES:
            eq["category"] = category
        if payment_mode:
            eq["payment_mode"] = payment_mode
        if date_from or date_to:
            date_q = {}
            if date_from:
                date_q["$gte"] = date_from
            if date_to:
                date_q["$lte"] = date_to
            if date_q:
                eq["date"] = date_q
        async for e in db.coach_expenses.find(eq, {"_id": 0}).sort("date", -1).limit(100):
            transactions.append({
                "id": e["id"], "type": "expense", "category": e.get("category", "other"),
                "client_name": "", "description": e.get("description", ""),
                "amount": e.get("amount", 0), "payment_mode": e.get("payment_mode", "cash"),
                "date": e.get("date", ""), "source": "expense", "created_at": e.get("created_at", ""),
            })

    # Sort by date descending
    transactions.sort(key=lambda x: x.get("date", ""), reverse=True)
    return transactions[:limit]
