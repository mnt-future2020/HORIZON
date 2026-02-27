"""
Coach Offline Sessions, Payments & Analytics
Offline session logging, payment tracking, and revenue/client analytics.
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import Optional
from datetime import datetime, timezone, timedelta
from database import db
from auth import get_current_user
import uuid

router = APIRouter(prefix="/coaching", tags=["coaching-offline"])


# ─── Offline Sessions ────────────────────────────────────────────────────────

@router.post("/offline-sessions")
async def log_offline_session(request: Request, user=Depends(get_current_user)):
    """Log an offline coaching session (walk-in, direct client)."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can log offline sessions")
    data = await request.json()
    client_id = data.get("client_id", "")
    client_name = data.get("client_name", "")
    # Resolve client name from ID if not provided
    if client_id and not client_name:
        client = await db.coach_clients.find_one({"id": client_id, "coach_id": user["id"]})
        if client:
            client_name = client.get("name", "")
    now = datetime.now(timezone.utc).isoformat()
    session = {
        "id": str(uuid.uuid4()),
        "coach_id": user["id"],
        "client_id": client_id,
        "client_name": client_name,
        "date": data.get("date", now[:10]),
        "start_time": data.get("start_time", ""),
        "end_time": data.get("end_time", ""),
        "sport": data.get("sport", ""),
        "status": data.get("status", "completed"),
        "payment_status": data.get("payment_status", "paid"),
        "payment_mode": data.get("payment_mode", "cash"),
        "amount": float(data.get("amount", 0)),
        "attendance": data.get("attendance", "present"),
        "notes": data.get("notes", ""),
        "source": "offline",
        "created_at": now,
    }
    await db.coach_offline_sessions.insert_one(session)
    session.pop("_id", None)
    return session


@router.get("/offline-sessions")
async def list_offline_sessions(
    user=Depends(get_current_user),
    client_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
):
    """List offline sessions with optional filters."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can view offline sessions")
    q = {"coach_id": user["id"]}
    if client_id:
        q["client_id"] = client_id
    if payment_status:
        q["payment_status"] = payment_status
    if date_from or date_to:
        date_q = {}
        if date_from:
            date_q["$gte"] = date_from
        if date_to:
            date_q["$lte"] = date_to
        if date_q:
            q["date"] = date_q
    sessions = []
    async for s in db.coach_offline_sessions.find(q, {"_id": 0}).sort("date", -1).limit(200):
        sessions.append(s)
    return sessions


@router.put("/offline-sessions/{session_id}")
async def update_offline_session(session_id: str, request: Request, user=Depends(get_current_user)):
    """Update an offline session."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can update offline sessions")
    session = await db.coach_offline_sessions.find_one({"id": session_id, "coach_id": user["id"]})
    if not session:
        raise HTTPException(404, "Session not found")
    data = await request.json()
    allowed = ["payment_status", "payment_mode", "amount", "attendance", "notes", "status",
               "date", "start_time", "end_time", "sport", "client_name"]
    updates = {k: v for k, v in data.items() if k in allowed}
    if "amount" in updates:
        updates["amount"] = float(updates["amount"])
    if updates:
        await db.coach_offline_sessions.update_one({"id": session_id}, {"$set": updates})
    updated = await db.coach_offline_sessions.find_one({"id": session_id}, {"_id": 0})
    return updated


# ─── Offline Payments ─────────────────────────────────────────────────────────

@router.post("/payments/offline")
async def record_offline_payment(request: Request, user=Depends(get_current_user)):
    """Record an offline payment (cash, UPI, bank transfer)."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can record payments")
    data = await request.json()
    amount = float(data.get("amount", 0))
    if amount <= 0:
        raise HTTPException(400, "Amount must be greater than 0")
    now = datetime.now(timezone.utc).isoformat()
    payment = {
        "id": str(uuid.uuid4()),
        "coach_id": user["id"],
        "client_id": data.get("client_id", ""),
        "client_name": data.get("client_name", ""),
        "type": data.get("type", "session_payment"),
        "amount": amount,
        "mode": data.get("mode", "cash"),
        "reference": data.get("reference", ""),
        "period": data.get("period", ""),
        "package_id": data.get("package_id", ""),
        "notes": data.get("notes", ""),
        "collected_at": data.get("collected_at", now),
        "created_at": now,
    }
    await db.coach_offline_payments.insert_one(payment)
    payment.pop("_id", None)
    return payment


@router.get("/payments")
async def list_payments(
    user=Depends(get_current_user),
    source: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    """List all payments — online (from sessions/subscriptions) + offline combined."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can view payments")

    all_payments = []

    # Online session payments (completed sessions with payment)
    if source != "offline":
        async for s in db.coaching_sessions.find(
            {"coach_id": user["id"], "status": "completed", "payment_status": "captured"},
            {"_id": 0, "id": 1, "player_name": 1, "amount": 1, "date": 1, "sport": 1, "created_at": 1}
        ).sort("date", -1).limit(100):
            all_payments.append({
                "id": s["id"], "client_name": s.get("player_name", ""),
                "amount": s.get("amount", 0), "mode": "razorpay",
                "type": "online_session", "source": "online",
                "date": s.get("date", ""), "created_at": s.get("created_at", ""),
            })

        # Online subscription payments
        async for sub in db.coaching_subscriptions.find(
            {"coach_id": user["id"], "payment_status": "captured"},
            {"_id": 0, "id": 1, "player_name": 1, "amount": 1, "created_at": 1}
        ).sort("created_at", -1).limit(100):
            all_payments.append({
                "id": sub["id"], "client_name": sub.get("player_name", ""),
                "amount": sub.get("amount", 0), "mode": "razorpay",
                "type": "subscription", "source": "online",
                "date": sub.get("created_at", "")[:10], "created_at": sub.get("created_at", ""),
            })

    # Offline payments
    if source != "online":
        q = {"coach_id": user["id"]}
        if date_from or date_to:
            date_q = {}
            if date_from:
                date_q["$gte"] = date_from
            if date_to:
                date_q["$lte"] = date_to
            if date_q:
                q["collected_at"] = date_q
        async for p in db.coach_offline_payments.find(q, {"_id": 0}).sort("created_at", -1).limit(100):
            all_payments.append({
                "id": p["id"], "client_name": p.get("client_name", ""),
                "amount": p.get("amount", 0), "mode": p.get("mode", "cash"),
                "type": p.get("type", "offline_payment"), "source": "offline",
                "date": p.get("collected_at", "")[:10], "created_at": p.get("created_at", ""),
                "reference": p.get("reference", ""), "notes": p.get("notes", ""),
            })

    # Sort by date descending
    all_payments.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return all_payments


# ─── Analytics ────────────────────────────────────────────────────────────────

@router.get("/analytics/revenue")
async def revenue_analytics(user=Depends(get_current_user)):
    """Revenue breakdown by source — online sessions, packages, offline."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can view analytics")

    # Online session revenue
    online_session_rev = 0
    async for s in db.coaching_sessions.find(
        {"coach_id": user["id"], "status": "completed", "payment_status": "captured"},
        {"amount": 1, "_id": 0}
    ):
        online_session_rev += s.get("amount", 0)

    # Package/subscription revenue
    package_rev = 0
    async for sub in db.coaching_subscriptions.find(
        {"coach_id": user["id"], "payment_status": "captured"},
        {"amount": 1, "_id": 0}
    ):
        package_rev += sub.get("amount", 0)

    # Offline revenue (from payments collection)
    offline_rev = 0
    async for p in db.coach_offline_payments.find(
        {"coach_id": user["id"]}, {"amount": 1, "_id": 0}
    ):
        offline_rev += p.get("amount", 0)

    # Also count offline sessions marked as paid
    offline_session_rev = 0
    async for s in db.coach_offline_sessions.find(
        {"coach_id": user["id"], "payment_status": "paid"},
        {"amount": 1, "_id": 0}
    ):
        offline_session_rev += s.get("amount", 0)

    total_offline = max(offline_rev, offline_session_rev)
    total_online = online_session_rev + package_rev

    # Commission (from platform settings)
    settings = await db.platform_settings.find_one({"key": "platform"})
    commission_pct = (settings or {}).get("coaching_commission_pct", 10) if settings else 10
    commission_total = round(total_online * commission_pct / 100, 2)

    # Monthly trend (last 6 months)
    monthly = []
    now = datetime.now(timezone.utc)
    for i in range(5, -1, -1):
        d = now - timedelta(days=i * 30)
        month_key = d.strftime("%Y-%m")
        month_label = d.strftime("%b %Y")

        m_online = 0
        async for s in db.coaching_sessions.find(
            {"coach_id": user["id"], "status": "completed", "payment_status": "captured",
             "date": {"$regex": f"^{month_key}"}},
            {"amount": 1, "_id": 0}
        ):
            m_online += s.get("amount", 0)

        m_offline = 0
        async for p in db.coach_offline_payments.find(
            {"coach_id": user["id"], "collected_at": {"$regex": f"^{month_key}"}},
            {"amount": 1, "_id": 0}
        ):
            m_offline += p.get("amount", 0)

        monthly.append({"month": month_label, "online": m_online, "offline": m_offline, "total": m_online + m_offline})

    return {
        "online_session_revenue": online_session_rev,
        "package_revenue": package_rev,
        "offline_revenue": total_offline,
        "total_online": total_online,
        "total_revenue": total_online + total_offline,
        "commission_pct": commission_pct,
        "commission_total": commission_total,
        "net_revenue": total_online - commission_total + total_offline,
        "monthly_trend": monthly,
    }


@router.get("/analytics/clients")
async def client_analytics(user=Depends(get_current_user)):
    """Client stats — total, online, offline, sources breakdown."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can view analytics")

    # Offline clients
    offline_total = await db.coach_clients.count_documents({"coach_id": user["id"]})
    offline_active = await db.coach_clients.count_documents({"coach_id": user["id"], "status": "active"})

    # Online clients (unique players from sessions + subscriptions)
    online_ids = set()
    async for s in db.coaching_sessions.find(
        {"coach_id": user["id"], "status": {"$in": ["confirmed", "completed"]}},
        {"player_id": 1, "_id": 0}
    ):
        if s.get("player_id"):
            online_ids.add(s["player_id"])
    async for sub in db.coaching_subscriptions.find(
        {"coach_id": user["id"], "status": {"$in": ["active", "expired"]}},
        {"player_id": 1, "_id": 0}
    ):
        if sub.get("player_id"):
            online_ids.add(sub["player_id"])
    online_total = len(online_ids)

    # New this month
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1).isoformat()[:10]
    new_offline = await db.coach_clients.count_documents(
        {"coach_id": user["id"], "created_at": {"$gte": month_start}}
    )

    # Source breakdown
    sources = {}
    async for c in db.coach_clients.find({"coach_id": user["id"]}, {"source": 1, "_id": 0}):
        src = c.get("source", "unknown")
        sources[src] = sources.get(src, 0) + 1

    return {
        "total_clients": online_total + offline_total,
        "online_clients": online_total,
        "offline_clients": offline_total,
        "offline_active": offline_active,
        "new_this_month": new_offline,
        "sources_breakdown": sources,
    }
