#!/usr/bin/env python3
"""
IoT Device Simulator for Horizon Smart Lighting.
Simulates virtual IoT devices that:
- Subscribe to command topics and respond to on/off/brightness commands
- Publish periodic telemetry (status, power, temperature)
- Publish status changes when commands are received

Usage: python device_simulator.py [--devices N] [--broker URL] [--port PORT]
"""
import os
import sys
import json
import asyncio
import random
import logging
import argparse
from datetime import datetime, timezone
from tz import now_ist
from gmqtt import Client as MQTTClient
from gmqtt.mqtt.constants import MQTTv311

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("device-sim")

BROKER = os.environ.get("MQTT_BROKER", "broker.emqx.io")
PORT = int(os.environ.get("MQTT_PORT", "1883"))
USERNAME = os.environ.get("MQTT_USERNAME", "")
PASSWORD = os.environ.get("MQTT_PASSWORD", "")
BASE_TOPIC = os.environ.get("MQTT_BASE_TOPIC", "horizon")


class VirtualDevice:
    def __init__(self, device_id, name, device_type, power_watts, topic_base):
        self.id = device_id
        self.name = name
        self.device_type = device_type
        self.power_watts = power_watts
        self.topic_base = topic_base
        self.status = "off"
        self.brightness = 0
        self.temperature = round(random.uniform(25, 35), 1)
        self.uptime_seconds = 0

    def handle_command(self, payload):
        action = payload.get("action", "")
        if action == "on":
            self.status = "on"
            self.brightness = payload.get("brightness", 100)
            logger.info(f"[{self.name}] Turned ON at {self.brightness}%")
        elif action == "off":
            self.status = "off"
            self.brightness = 0
            logger.info(f"[{self.name}] Turned OFF")
        elif action == "brightness":
            b = payload.get("brightness", 100)
            self.brightness = b
            self.status = "on" if b > 0 else "off"
            logger.info(f"[{self.name}] Brightness set to {b}%")
        return self.get_status()

    def get_status(self):
        return {
            "device_id": self.id,
            "name": self.name,
            "status": self.status,
            "brightness": self.brightness,
            "power_draw": round(self.power_watts * (self.brightness / 100)) if self.status == "on" else 0,
            "temperature": self.temperature,
            "uptime_seconds": self.uptime_seconds,
            "timestamp": now_ist().isoformat(),
        }

    def get_telemetry(self):
        # Simulate slight temperature variation
        self.temperature += random.uniform(-0.3, 0.3)
        self.temperature = round(max(20, min(60, self.temperature)), 1)
        self.uptime_seconds += 10
        return {
            "device_id": self.id,
            "power_draw": round(self.power_watts * (self.brightness / 100)) if self.status == "on" else 0,
            "temperature": self.temperature,
            "voltage": round(random.uniform(220, 240), 1),
            "current": round(random.uniform(0.5, 5.0), 2) if self.status == "on" else 0,
            "uptime_seconds": self.uptime_seconds,
            "timestamp": now_ist().isoformat(),
        }


# Default simulated devices (matching seed data topics)
DEFAULT_DEVICES = [
    {"id": "sim-turf1-north", "name": "Turf 1 - North Flood", "type": "floodlight", "watts": 1000, "topic": f"{BASE_TOPIC}/powerplay/turf1/north"},
    {"id": "sim-turf1-south", "name": "Turf 1 - South Flood", "type": "floodlight", "watts": 1000, "topic": f"{BASE_TOPIC}/powerplay/turf1/south"},
    {"id": "sim-turf1-east", "name": "Turf 1 - East LED", "type": "led_panel", "watts": 300, "topic": f"{BASE_TOPIC}/powerplay/turf1/east"},
    {"id": "sim-turf2-main", "name": "Turf 2 - Main Flood", "type": "floodlight", "watts": 1500, "topic": f"{BASE_TOPIC}/powerplay/turf2/main"},
    {"id": "sim-parking", "name": "Parking Lights", "type": "ambient", "watts": 200, "topic": f"{BASE_TOPIC}/powerplay/common/parking"},
    {"id": "sim-emergency", "name": "Emergency Exit", "type": "emergency", "watts": 50, "topic": f"{BASE_TOPIC}/powerplay/common/emergency"},
]


async def run_simulator(devices_config=None):
    devices_config = devices_config or DEFAULT_DEVICES
    devices = {}
    client = MQTTClient(f"horizon-sim-{random.randint(1000, 9999)}")

    for d in devices_config:
        dev = VirtualDevice(d["id"], d["name"], d["type"], d["watts"], d["topic"])
        devices[d["topic"]] = dev

    def on_connect(c, flags, rc, properties):
        logger.info(f"Simulator connected to {BROKER}:{PORT} (rc={rc})")
        # Subscribe to command topics for all devices
        for topic_base in devices:
            cmd_topic = f"{topic_base}/command"
            c.subscribe(cmd_topic, qos=1)
            logger.info(f"  Subscribed: {cmd_topic}")

    def on_message(c, topic, payload, qos, properties):
        try:
            data = json.loads(payload.decode())
            # Find matching device
            cmd_suffix = "/command"
            if topic.endswith(cmd_suffix):
                base_topic = topic[:-len(cmd_suffix)]
                dev = devices.get(base_topic)
                if dev:
                    status = dev.handle_command(data)
                    # Publish status response
                    status_topic = f"{base_topic}/status"
                    c.publish(status_topic, json.dumps(status).encode(), qos=1)
                    logger.info(f"  Published status to {status_topic}")
        except Exception as e:
            logger.error(f"Error processing command on {topic}: {e}")

    def on_disconnect(c, packet, exc=None):
        logger.warning(f"Simulator disconnected: {exc}")

    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect

    if USERNAME:
        client.set_auth_credentials(USERNAME, PASSWORD)

    logger.info(f"Connecting to MQTT broker {BROKER}:{PORT}...")
    await client.connect(BROKER, PORT, keepalive=60, version=MQTTv311)

    logger.info(f"Simulator running with {len(devices)} virtual devices")
    logger.info("Devices:")
    for topic, dev in devices.items():
        logger.info(f"  {dev.name} ({dev.device_type}, {dev.power_watts}W) -> {topic}")

    # Periodically publish telemetry
    try:
        while True:
            await asyncio.sleep(10)
            for topic_base, dev in devices.items():
                telemetry = dev.get_telemetry()
                telemetry_topic = f"{topic_base}/telemetry"
                client.publish(telemetry_topic, json.dumps(telemetry).encode(), qos=0)
            logger.debug(f"Published telemetry for {len(devices)} devices")
    except asyncio.CancelledError:
        logger.info("Simulator shutting down...")
    finally:
        await client.disconnect()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Horizon IoT Device Simulator")
    parser.add_argument("--broker", default=BROKER, help=f"MQTT broker host (default: {BROKER})")
    parser.add_argument("--port", type=int, default=PORT, help=f"MQTT broker port (default: {PORT})")
    parser.add_argument("--username", default=USERNAME, help="MQTT username")
    parser.add_argument("--password", default=PASSWORD, help="MQTT password")
    args = parser.parse_args()

    # Override globals
    BROKER = args.broker
    PORT = args.port
    USERNAME = args.username
    PASSWORD = args.password

    try:
        asyncio.run(run_simulator())
    except KeyboardInterrupt:
        logger.info("Simulator stopped by user")
