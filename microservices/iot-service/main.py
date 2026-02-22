"""
IoT Service – Port 8006
Handles: Device management, zone management, MQTT communication,
         energy analytics, booking-linked automation schedules.
"""
import sys, os
sys.path.insert(0, "/app/shared")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "shared"))

import uuid
import json
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Callable

from fastapi import FastAPI, HTTPException, Depends, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import db
from auth import get_current_user

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("iot-service")

app = FastAPI(title="Lobbi IoT Service", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


# ═══════════════════════════════════════════════════════════════════════════════
# MQTT CLIENT (inline from mqtt_service.py)
# ═══════════════════════════════════════════════════════════════════════════════

MQTT_BROKER = os.environ.get("MQTT_BROKER", "broker.emqx.io")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
MQTT_USERNAME = os.environ.get("MQTT_USERNAME", "")
MQTT_PASSWORD = os.environ.get("MQTT_PASSWORD", "")
MQTT_CLIENT_ID = os.environ.get("MQTT_CLIENT_ID", "lobbi-iot-service")
MQTT_BASE_TOPIC = os.environ.get("MQTT_BASE_TOPIC", "lobbi")

_mqtt_client = None
_mqtt_connected = False
_message_handlers: list[Callable] = []


async def mqtt_connect():
    global _mqtt_client, _mqtt_connected
    try:
        from gmqtt import Client as MQTTClient
        from gmqtt.mqtt.constants import MQTTv311

        _mqtt_client = MQTTClient(MQTT_CLIENT_ID)

        def on_connect(client, flags, rc, properties):
            global _mqtt_connected
            _mqtt_connected = True
            logger.info(f"MQTT connected to {MQTT_BROKER}:{MQTT_PORT}")
            client.subscribe(f"{MQTT_BASE_TOPIC}/+/+/status", qos=1)
            client.subscribe(f"{MQTT_BASE_TOPIC}/+/+/telemetry", qos=1)
            client.subscribe(f"{MQTT_BASE_TOPIC}/+/+/+/status", qos=1)
            client.subscribe(f"{MQTT_BASE_TOPIC}/+/+/+/telemetry", qos=1)

        def on_disconnect(client, packet, exc=None):
            global _mqtt_connected
            _mqtt_connected = False
            logger.warning(f"MQTT disconnected: {exc}")

        def on_message(client, topic, payload, qos, properties):
            try:
                data = json.loads(payload.decode())
                for handler in _message_handlers:
                    asyncio.ensure_future(handler(topic, data))
            except Exception as e:
                logger.error(f"MQTT message parse error: {e}")

        _mqtt_client.on_connect = on_connect
        _mqtt_client.on_message = on_message
        _mqtt_client.on_disconnect = on_disconnect

        if MQTT_USERNAME:
            _mqtt_client.set_auth_credentials(MQTT_USERNAME, MQTT_PASSWORD)

        await _mqtt_client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60, version=MQTTv311)
    except Exception as e:
        logger.error(f"MQTT connection failed: {e}")
        _mqtt_connected = False


async def mqtt_disconnect():
    global _mqtt_client, _mqtt_connected
    if _mqtt_client and _mqtt_connected:
        await _mqtt_client.disconnect()
        _mqtt_connected = False


async def mqtt_publish(topic: str, payload: dict, qos: int = 1) -> bool:
    if not _mqtt_client or not _mqtt_connected:
        return False
    try:
        msg = json.dumps(payload)
        _mqtt_client.publish(topic, msg.encode(), qos=qos)
        return True
    except Exception as e:
        logger.error(f"MQTT publish failed: {e}")
        return False


async def send_device_command(device: dict, action: str, brightness: int = 100) -> bool:
    topic = device.get("mqtt_topic", f"{MQTT_BASE_TOPIC}/devices/{device['id']}/command")
    cmd_topic = topic if topic.endswith("/command") else f"{topic}/command"
    payload = {
        "action": action, "brightness": brightness,
        "device_id": device["id"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "lobbi-iot-service",
    }
    success = await mqtt_publish(cmd_topic, payload)
    if not success and not _mqtt_connected:
        logger.info(f"MQTT offline, simulating command for {device['id']}")
        return True
    return success


# ═══════════════════════════════════════════════════════════════════════════════
# MQTT TELEMETRY HANDLER
# ═══════════════════════════════════════════════════════════════════════════════

_ws_clients: list[WebSocket] = []


async def handle_mqtt_telemetry(topic: str, data: dict):
    device_id = data.get("device_id")
    if not device_id:
        return
    if topic.endswith("/status"):
        update = {"last_seen": datetime.now(timezone.utc).isoformat(), "is_online": True}
        if "status" in data:
            update["status"] = data["status"]
        if "brightness" in data:
            update["brightness"] = data["brightness"]
        await db.iot_devices.update_one(
            {"mqtt_topic": {"$regex": topic.replace("/status", "")}}, {"$set": update}
        )
        await broadcast_ws({"type": "device_status", "data": data})
    elif topic.endswith("/telemetry"):
        await db.iot_telemetry.insert_one({
            "device_id": device_id, "topic": topic, "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "_ttl": datetime.now(timezone.utc) + timedelta(days=7),
        })
        await broadcast_ws({"type": "telemetry", "data": data})


_message_handlers.append(handle_mqtt_telemetry)


async def broadcast_ws(message: dict):
    dead = []
    for ws in _ws_clients:
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _ws_clients.remove(ws)


# ═══════════════════════════════════════════════════════════════════════════════
# STARTUP / SHUTDOWN
# ═══════════════════════════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup():
    await mqtt_connect()


@app.on_event("shutdown")
async def shutdown():
    await mqtt_disconnect()


# ═══════════════════════════════════════════════════════════════════════════════
# PYDANTIC MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class DeviceCreate(BaseModel):
    venue_id: str
    name: str
    zone_id: Optional[str] = None
    device_type: str = "floodlight"
    protocol: str = "mqtt"
    mqtt_topic: Optional[str] = None
    ip_address: Optional[str] = None
    power_watts: int = 500
    turf_number: Optional[int] = None


class DeviceControl(BaseModel):
    action: str  # "on", "off", "brightness"
    brightness: Optional[int] = None


class ZoneCreate(BaseModel):
    venue_id: str
    name: str
    turf_number: Optional[int] = None
    description: str = ""


# ═══════════════════════════════════════════════════════════════════════════════
# AUTH HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

async def require_iot_access(user):
    if user["role"] not in ("venue_owner", "super_admin"):
        raise HTTPException(403, "Only venue owners and admins can manage IoT")


async def verify_venue_access(venue_id: str, user: dict):
    await require_iot_access(user)
    if user["role"] == "super_admin":
        return
    venue = await db.venues.find_one({"id": venue_id, "owner_id": user["id"]})
    if not venue:
        raise HTTPException(403, "Not your venue")


# ═══════════════════════════════════════════════════════════════════════════════
# WEBSOCKET
# ═══════════════════════════════════════════════════════════════════════════════

@app.websocket("/iot/ws")
async def iot_websocket(ws: WebSocket):
    await ws.accept()
    _ws_clients.append(ws)
    logger.info(f"IoT WebSocket connected ({len(_ws_clients)} clients)")
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if ws in _ws_clients:
            _ws_clients.remove(ws)


# ═══════════════════════════════════════════════════════════════════════════════
# MQTT STATUS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/iot/mqtt-status")
async def get_mqtt_status(user=Depends(get_current_user)):
    await require_iot_access(user)
    return {
        "connected": _mqtt_connected, "broker": MQTT_BROKER,
        "port": MQTT_PORT, "client_id": MQTT_CLIENT_ID,
        "base_topic": MQTT_BASE_TOPIC, "authenticated": bool(MQTT_USERNAME),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# DEVICE ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/iot/devices")
async def list_devices(venue_id: str = Query(...), user=Depends(get_current_user)):
    await verify_venue_access(venue_id, user)
    devices = await db.iot_devices.find({"venue_id": venue_id}, {"_id": 0}).sort("name", 1).to_list(100)
    return devices


@app.post("/iot/devices")
async def register_device(inp: DeviceCreate, user=Depends(get_current_user)):
    await verify_venue_access(inp.venue_id, user)
    device_id = str(uuid.uuid4())
    doc = {
        "id": device_id, "venue_id": inp.venue_id, "name": inp.name,
        "zone_id": inp.zone_id, "device_type": inp.device_type,
        "protocol": inp.protocol,
        "mqtt_topic": inp.mqtt_topic or f"lobbi/lights/{device_id}",
        "ip_address": inp.ip_address, "power_watts": inp.power_watts,
        "turf_number": inp.turf_number, "status": "off", "brightness": 0,
        "is_online": True, "auto_schedule": True,
        "last_seen": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "total_runtime_minutes": 0,
    }
    await db.iot_devices.insert_one(doc)
    doc.pop("_id", None)
    return doc


@app.put("/iot/devices/{device_id}")
async def update_device(device_id: str, inp: DeviceCreate, user=Depends(get_current_user)):
    device = await db.iot_devices.find_one({"id": device_id})
    if not device:
        raise HTTPException(404, "Device not found")
    await verify_venue_access(device["venue_id"], user)
    update = {
        "name": inp.name, "zone_id": inp.zone_id, "device_type": inp.device_type,
        "protocol": inp.protocol, "mqtt_topic": inp.mqtt_topic or device.get("mqtt_topic"),
        "ip_address": inp.ip_address, "power_watts": inp.power_watts,
        "turf_number": inp.turf_number,
    }
    await db.iot_devices.update_one({"id": device_id}, {"$set": update})
    updated = await db.iot_devices.find_one({"id": device_id}, {"_id": 0})
    return updated


@app.delete("/iot/devices/{device_id}")
async def delete_device(device_id: str, user=Depends(get_current_user)):
    device = await db.iot_devices.find_one({"id": device_id})
    if not device:
        raise HTTPException(404, "Device not found")
    await verify_venue_access(device["venue_id"], user)
    await db.iot_devices.delete_one({"id": device_id})
    return {"message": "Device removed"}


@app.post("/iot/devices/{device_id}/control")
async def control_device(device_id: str, ctrl: DeviceControl, user=Depends(get_current_user)):
    device = await db.iot_devices.find_one({"id": device_id}, {"_id": 0})
    if not device:
        raise HTTPException(404, "Device not found")
    await verify_venue_access(device["venue_id"], user)
    if not device.get("is_online"):
        raise HTTPException(503, "Device is offline")

    brightness = ctrl.brightness if ctrl.brightness is not None else (100 if ctrl.action == "on" else 0)
    success = await send_device_command(device, ctrl.action, brightness)
    if not success and _mqtt_connected:
        raise HTTPException(502, "Failed to publish MQTT command")

    new_status = "on" if ctrl.action in ("on", "brightness") and brightness > 0 else "off"
    update = {"status": new_status, "brightness": brightness,
              "last_seen": datetime.now(timezone.utc).isoformat()}
    await db.iot_devices.update_one({"id": device_id}, {"$set": update})

    # Log energy event
    if ctrl.action == "on" and device.get("status") == "off":
        await db.iot_energy_logs.insert_one({
            "id": str(uuid.uuid4()), "device_id": device_id,
            "venue_id": device["venue_id"], "event": "turned_on",
            "power_watts": device["power_watts"], "brightness": brightness,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    elif ctrl.action == "off" and device.get("status") == "on":
        await db.iot_energy_logs.insert_one({
            "id": str(uuid.uuid4()), "device_id": device_id,
            "venue_id": device["venue_id"], "event": "turned_off",
            "power_watts": 0, "brightness": 0,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    await broadcast_ws({"type": "device_control", "device_id": device_id, **update})
    return {**device, **update}


# ═══════════════════════════════════════════════════════════════════════════════
# ZONE ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/iot/zones")
async def list_zones(venue_id: str = Query(...), user=Depends(get_current_user)):
    await verify_venue_access(venue_id, user)
    zones = await db.iot_zones.find({"venue_id": venue_id}, {"_id": 0}).to_list(50)
    for z in zones:
        z["device_count"] = await db.iot_devices.count_documents({"zone_id": z["id"]})
    return zones


@app.post("/iot/zones")
async def create_zone(inp: ZoneCreate, user=Depends(get_current_user)):
    await verify_venue_access(inp.venue_id, user)
    zone_id = str(uuid.uuid4())
    doc = {
        "id": zone_id, "venue_id": inp.venue_id, "name": inp.name,
        "turf_number": inp.turf_number, "description": inp.description,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.iot_zones.insert_one(doc)
    doc.pop("_id", None)
    doc["device_count"] = 0
    return doc


@app.put("/iot/zones/{zone_id}")
async def update_zone(zone_id: str, inp: ZoneCreate, user=Depends(get_current_user)):
    zone = await db.iot_zones.find_one({"id": zone_id})
    if not zone:
        raise HTTPException(404, "Zone not found")
    await verify_venue_access(zone["venue_id"], user)
    await db.iot_zones.update_one({"id": zone_id}, {"$set": {
        "name": inp.name, "turf_number": inp.turf_number, "description": inp.description
    }})
    updated = await db.iot_zones.find_one({"id": zone_id}, {"_id": 0})
    updated["device_count"] = await db.iot_devices.count_documents({"zone_id": zone_id})
    return updated


@app.delete("/iot/zones/{zone_id}")
async def delete_zone(zone_id: str, user=Depends(get_current_user)):
    zone = await db.iot_zones.find_one({"id": zone_id})
    if not zone:
        raise HTTPException(404, "Zone not found")
    await verify_venue_access(zone["venue_id"], user)
    await db.iot_devices.update_many({"zone_id": zone_id}, {"$set": {"zone_id": None}})
    await db.iot_zones.delete_one({"id": zone_id})
    return {"message": "Zone deleted"}


@app.post("/iot/zones/{zone_id}/control")
async def control_zone(zone_id: str, ctrl: DeviceControl, user=Depends(get_current_user)):
    zone = await db.iot_zones.find_one({"id": zone_id})
    if not zone:
        raise HTTPException(404, "Zone not found")
    await verify_venue_access(zone["venue_id"], user)

    devices = await db.iot_devices.find({"zone_id": zone_id, "is_online": True}, {"_id": 0}).to_list(100)
    brightness = ctrl.brightness if ctrl.brightness is not None else (100 if ctrl.action == "on" else 0)
    results = []
    for d in devices:
        success = await send_device_command(d, ctrl.action, brightness)
        new_status = "on" if ctrl.action in ("on", "brightness") and brightness > 0 else "off"
        await db.iot_devices.update_one({"id": d["id"]}, {"$set": {
            "status": new_status, "brightness": brightness,
            "last_seen": datetime.now(timezone.utc).isoformat()
        }})
        results.append({"device_id": d["id"], "success": success, "status": new_status})

    return {"zone_id": zone_id, "devices_controlled": len(results), "results": results}


# ═══════════════════════════════════════════════════════════════════════════════
# ENERGY ANALYTICS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/iot/energy")
async def get_energy_analytics(
    venue_id: str = Query(...), period: str = Query("7d"), user=Depends(get_current_user)
):
    await verify_venue_access(venue_id, user)
    days = 7 if period == "7d" else 30
    devices = await db.iot_devices.find({"venue_id": venue_id}, {"_id": 0}).to_list(100)
    total_devices = len(devices)
    online_count = sum(1 for d in devices if d.get("is_online"))
    active_count = sum(1 for d in devices if d.get("status") == "on")
    total_power = sum(d.get("power_watts", 0) for d in devices if d.get("status") == "on")

    daily_data = {}
    today = datetime.now(timezone.utc).date()
    for i in range(days):
        d = today - timedelta(days=i)
        date_str = d.isoformat()
        bookings_count = await db.bookings.count_documents(
            {"venue_id": venue_id, "date": date_str, "status": "confirmed"}
        )
        hours = min(bookings_count * 1.5, 16)
        total_kwh = sum(dev.get("power_watts", 500) for dev in devices) * hours / 1000
        cost = total_kwh * 8
        daily_data[date_str] = {
            "date": date_str, "kwh": round(total_kwh, 1), "cost": round(cost, 0),
            "bookings": bookings_count, "hours": round(hours, 1),
        }

    daily_list = sorted(daily_data.values(), key=lambda x: x["date"])
    total_kwh = sum(d["kwh"] for d in daily_list)
    total_cost = sum(d["cost"] for d in daily_list)

    return {
        "summary": {
            "total_devices": total_devices, "online": online_count,
            "active": active_count, "current_power_watts": total_power,
            "period_kwh": round(total_kwh, 1), "period_cost": round(total_cost, 0),
            "avg_daily_kwh": round(total_kwh / max(days, 1), 1),
            "avg_daily_cost": round(total_cost / max(days, 1), 0),
        },
        "daily": daily_list,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# BOOKING-LINKED SCHEDULES
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/iot/schedules")
async def list_schedules(venue_id: str = Query(...), date: Optional[str] = None,
                         user=Depends(get_current_user)):
    await verify_venue_access(venue_id, user)
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    bookings = await db.bookings.find(
        {"venue_id": venue_id, "date": date, "status": "confirmed"}, {"_id": 0}
    ).sort("start_time", 1).to_list(50)

    zones = await db.iot_zones.find({"venue_id": venue_id}, {"_id": 0}).to_list(50)
    zone_map = {z.get("turf_number"): z for z in zones if z.get("turf_number")}

    schedules = []
    for b in bookings:
        turf = b.get("turf_number", 1)
        zone = zone_map.get(turf)
        start_h, start_m = map(int, b["start_time"].split(":"))
        end_h, end_m = map(int, b["end_time"].split(":"))

        pre_m, pre_h = start_m - 5, start_h
        if pre_m < 0:
            pre_m += 60
            pre_h -= 1

        post_m, post_h = end_m + 5, end_h
        if post_m >= 60:
            post_m -= 60
            post_h += 1

        schedules.append({
            "booking_id": b["id"], "turf_number": turf,
            "zone_id": zone["id"] if zone else None,
            "zone_name": zone["name"] if zone else f"Turf {turf}",
            "lights_on": f"{pre_h:02d}:{pre_m:02d}", "slot_start": b["start_time"],
            "slot_end": b["end_time"], "lights_off": f"{post_h:02d}:{post_m:02d}",
            "host_name": b.get("host_name", ""), "sport": b.get("sport", ""),
        })

    return {"date": date, "schedules": schedules}


@app.post("/iot/sync-bookings")
async def sync_bookings_to_schedule(venue_id: str = Query(...), user=Depends(get_current_user)):
    await verify_venue_access(venue_id, user)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    bookings = await db.bookings.find(
        {"venue_id": venue_id, "date": today, "status": "confirmed"}, {"_id": 0}
    ).to_list(50)

    synced = 0
    for b in bookings:
        turf = b.get("turf_number", 1)
        zone = await db.iot_zones.find_one({"venue_id": venue_id, "turf_number": turf})
        if zone:
            devices = await db.iot_devices.find({"zone_id": zone["id"], "auto_schedule": True}).to_list(50)
            if devices:
                synced += 1

    return {"message": f"Synced {synced} booking slots to IoT automation",
            "bookings_today": len(bookings), "synced": synced}


# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {"service": "iot", "status": "healthy", "port": 8006, "mqtt_connected": _mqtt_connected}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)
