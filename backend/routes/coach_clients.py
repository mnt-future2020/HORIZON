"""
Coach Client Management
Offline client CRUD + merged client list (online + offline).
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import Optional
from datetime import datetime, timezone
from database import db
from auth import get_current_user
from whatsapp_service import send_message, build_client_welcome_message
import uuid
import logging

logger = logging.getLogger("horizon.coach_clients")

APP_DOWNLOAD_LINK = "https://lobbi.in/download"

router = APIRouter(prefix="/coaching", tags=["coaching-clients"])


@router.post("/clients")
async def add_client(request: Request, user=Depends(get_current_user)):
    """Add an offline client (walk-in, referral, etc.)."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can add clients")
    data = await request.json()
    name = (data.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Client name is required")
    now = datetime.now(timezone.utc).isoformat()
    try:
        monthly_fee = max(0, int(data.get("monthly_fee") or 0))
    except (ValueError, TypeError):
        monthly_fee = 0
    try:
        reminder_day = max(1, min(28, int(data.get("reminder_day") or 1)))
    except (ValueError, TypeError):
        reminder_day = 1

    try:
        age = max(1, min(100, int(data.get("age") or 0))) if data.get("age") else None
    except (ValueError, TypeError):
        age = None

    client = {
        "id": str(uuid.uuid4()),
        "coach_id": user["id"],
        "name": name,
        "phone": (data.get("phone") or "").strip(),
        "email": (data.get("email") or "").strip().lower(),
        "sport": data.get("sport", ""),
        "source": data.get("source", "walk_in"),
        "notes": data.get("notes", ""),
        "payment_mode": data.get("payment_mode", "cash"),
        "monthly_fee": monthly_fee,
        "reminder_day": reminder_day,
        # Extended client details
        "age": age,
        "skill_level": data.get("skill_level", ""),        # beginner | intermediate | advanced | professional
        "coaching_goal": data.get("coaching_goal", ""),    # fitness | competition | hobby | school_exam
        "guardian_name": (data.get("guardian_name") or "").strip(),
        "linked_user_id": None,
        "whatsapp_welcome_sent": False,
        "whatsapp_sent_at": None,
        "status": "active",
        "created_at": now,
        "updated_at": now,
    }
    await db.coach_clients.insert_one(client)
    client.pop("_id", None)

    # Auto-send WhatsApp welcome message if phone is available
    if client.get("phone"):
        try:
            settings = await db.platform_settings.find_one({"key": "platform"}, {"_id": 0})
            wa = (settings or {}).get("whatsapp", {})
            coach_doc = await db.users.find_one({"id": user["id"]}, {"name": 1})
            msg = build_client_welcome_message(
                coach_doc.get("name", "Your Coach") if coach_doc else "Your Coach",
                client["name"],
                APP_DOWNLOAD_LINK,
            )
            result = await send_message(wa, client["phone"], msg)
            if result.get("ok"):
                await db.coach_clients.update_one(
                    {"id": client["id"]},
                    {"$set": {"whatsapp_welcome_sent": True, "whatsapp_sent_at": now}},
                )
                client["whatsapp_welcome_sent"] = True
                client["whatsapp_sent_at"] = now
        except Exception as e:
            logger.warning(f"WhatsApp welcome failed for client {client['id']}: {e}")

    return client


@router.get("/clients")
async def list_clients(
    user=Depends(get_current_user),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
):
    """List all clients — offline from coach_clients + online from sessions/subscriptions."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can view clients")

    # 1. Offline clients
    q = {"coach_id": user["id"]}
    if status:
        q["status"] = status
    if search:
        q["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]
    offline_clients = []
    async for c in db.coach_clients.find(q, {"_id": 0}).sort("created_at", -1):
        c["client_source"] = "offline"
        offline_clients.append(c)

    # 2. Online clients — unique players from sessions + subscriptions
    online_ids = set()
    online_clients = []

    # From sessions
    async for s in db.coaching_sessions.find(
        {"coach_id": user["id"], "status": {"$in": ["confirmed", "completed"]}},
        {"player_id": 1, "player_name": 1, "sport": 1, "_id": 0}
    ):
        pid = s.get("player_id")
        if pid and pid not in online_ids:
            online_ids.add(pid)

    # From subscriptions
    async for sub in db.coaching_subscriptions.find(
        {"coach_id": user["id"], "status": {"$in": ["active", "expired"]}},
        {"player_id": 1, "_id": 0}
    ):
        pid = sub.get("player_id")
        if pid:
            online_ids.add(pid)

    # Fetch user details for online clients
    if online_ids:
        async for u in db.users.find(
            {"id": {"$in": list(online_ids)}},
            {"_id": 0, "id": 1, "name": 1, "phone": 1, "email": 1, "avatar": 1, "sports": 1}
        ):
            client_data = {
                "id": u["id"],
                "coach_id": user["id"],
                "name": u.get("name", ""),
                "phone": u.get("phone", ""),
                "email": u.get("email", ""),
                "sport": (u.get("sports") or [""])[0] if u.get("sports") else "",
                "source": "online",
                "client_source": "online",
                "linked_user_id": u["id"],
                "status": "active",
                "avatar": u.get("avatar", ""),
            }
            if search:
                s_lower = search.lower()
                if not (s_lower in client_data["name"].lower() or s_lower in client_data["phone"] or s_lower in client_data["email"].lower()):
                    continue
            if source and source != "online":
                continue
            online_clients.append(client_data)

    if source == "offline":
        return offline_clients
    if source == "online":
        return online_clients
    return offline_clients + online_clients


@router.get("/clients/{client_id}")
async def get_client(client_id: str, user=Depends(get_current_user)):
    """Get client detail + session history."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can view client details")

    # Check offline clients first
    client = await db.coach_clients.find_one({"id": client_id, "coach_id": user["id"]}, {"_id": 0})
    if client:
        client["client_source"] = "offline"
        # Auto-link to Lobbi social profile by phone number
        if not client.get("linked_user_id") and client.get("phone"):
            phone_raw = client["phone"].replace("+", "").replace(" ", "").replace("-", "")
            last10 = phone_raw[-10:] if len(phone_raw) >= 10 else phone_raw
            linked_user = await db.users.find_one(
                {"phone": {"$regex": f".*{last10}$"}}, {"id": 1}
            )
            if linked_user:
                client["linked_user_id"] = linked_user["id"]
                await db.coach_clients.update_one(
                    {"id": client_id}, {"$set": {"linked_user_id": linked_user["id"]}}
                )
        # Get offline sessions for this client
        sessions = []
        async for s in db.coach_offline_sessions.find(
            {"coach_id": user["id"], "client_id": client_id}, {"_id": 0}
        ).sort("date", -1).limit(50):
            sessions.append(s)
        # Get offline payments
        payments = []
        async for p in db.coach_offline_payments.find(
            {"coach_id": user["id"], "client_id": client_id}, {"_id": 0}
        ).sort("created_at", -1).limit(50):
            payments.append(p)
        client["sessions"] = sessions
        client["payments"] = payments
        client["total_sessions"] = len(sessions)
        client["total_paid"] = sum(p.get("amount", 0) for p in payments)
        return client

    # Check if it's an online client (user ID)
    online_user = await db.users.find_one({"id": client_id}, {"_id": 0, "password_hash": 0})
    if not online_user:
        raise HTTPException(404, "Client not found")

    # Get online sessions with this coach
    sessions = []
    async for s in db.coaching_sessions.find(
        {"coach_id": user["id"], "player_id": client_id}, {"_id": 0}
    ).sort("date", -1).limit(50):
        sessions.append(s)

    # Get subscriptions
    subs = []
    async for sub in db.coaching_subscriptions.find(
        {"coach_id": user["id"], "player_id": client_id}, {"_id": 0}
    ).sort("created_at", -1):
        subs.append(sub)

    return {
        "id": online_user["id"],
        "name": online_user.get("name", ""),
        "phone": online_user.get("phone", ""),
        "email": online_user.get("email", ""),
        "avatar": online_user.get("avatar", ""),
        "client_source": "online",
        "sessions": sessions,
        "subscriptions": subs,
        "total_sessions": len(sessions),
        "total_paid": sum(s.get("amount", 0) for s in sessions if s.get("payment_status") == "captured"),
    }


@router.put("/clients/{client_id}")
async def update_client(client_id: str, request: Request, user=Depends(get_current_user)):
    """Update offline client info."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can update clients")
    client = await db.coach_clients.find_one({"id": client_id, "coach_id": user["id"]})
    if not client:
        raise HTTPException(404, "Client not found")
    data = await request.json()
    allowed = ["name", "phone", "email", "sport", "source", "notes", "payment_mode", "status",
               "age", "skill_level", "coaching_goal", "guardian_name", "monthly_fee", "reminder_day"]
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.coach_clients.update_one({"id": client_id}, {"$set": updates})
    updated = await db.coach_clients.find_one({"id": client_id}, {"_id": 0})
    return updated


@router.delete("/clients/{client_id}")
async def deactivate_client(client_id: str, user=Depends(get_current_user)):
    """Soft-deactivate an offline client."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can deactivate clients")
    client = await db.coach_clients.find_one({"id": client_id, "coach_id": user["id"]})
    if not client:
        raise HTTPException(404, "Client not found")
    await db.coach_clients.update_one(
        {"id": client_id},
        {"$set": {"status": "inactive", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Client deactivated"}


@router.post("/clients/{client_id}/send-welcome")
async def send_welcome_whatsapp(client_id: str, user=Depends(get_current_user)):
    """Manually (re-)send the app download WhatsApp message to an offline client."""
    if user.get("role") != "coach":
        raise HTTPException(403, "Only coaches can send messages")
    client = await db.coach_clients.find_one({"id": client_id, "coach_id": user["id"]}, {"_id": 0})
    if not client:
        raise HTTPException(404, "Client not found")
    if not client.get("phone"):
        raise HTTPException(400, "Client has no phone number")

    settings = await db.platform_settings.find_one({"key": "platform"}, {"_id": 0})
    wa = (settings or {}).get("whatsapp", {})
    coach_doc = await db.users.find_one({"id": user["id"]}, {"name": 1})
    msg = build_client_welcome_message(
        coach_doc.get("name", "Your Coach") if coach_doc else "Your Coach",
        client["name"],
        APP_DOWNLOAD_LINK,
    )
    result = await send_message(wa, client["phone"], msg)
    if result.get("ok"):
        now = datetime.now(timezone.utc).isoformat()
        await db.coach_clients.update_one(
            {"id": client_id},
            {"$set": {"whatsapp_welcome_sent": True, "whatsapp_sent_at": now}},
        )
        return {"message": "Welcome message sent", "whatsapp_sent_at": now}
    else:
        # Return wa.me fallback link so coach can send manually
        import urllib.parse
        wa_link = f"https://wa.me/{client['phone']}?text={urllib.parse.quote(msg)}"
        return {
            "message": "WhatsApp API not configured — use the link below",
            "wa_link": wa_link,
            "ok": False,
        }
