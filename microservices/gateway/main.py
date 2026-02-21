"""
API Gateway – Port 8000
Reverse proxy that routes requests to the appropriate microservice.
Provides unified entry point, health aggregation, and service discovery.
"""
import os
import logging
import httpx
from fastapi import FastAPI, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gateway")

app = FastAPI(title="Horizon API Gateway", version="2.0.0",
              description="Unified entry point for all Horizon microservices")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

# ═══════════════════════════════════════════════════════════════════════════════
# SERVICE REGISTRY
# ═══════════════════════════════════════════════════════════════════════════════

SERVICES = {
    "auth": os.environ.get("AUTH_SERVICE_URL", "http://auth-service:8001"),
    "venue": os.environ.get("VENUE_SERVICE_URL", "http://venue-service:8002"),
    "booking": os.environ.get("BOOKING_SERVICE_URL", "http://booking-service:8003"),
    "social": os.environ.get("SOCIAL_SERVICE_URL", "http://social-service:8004"),
    "notification": os.environ.get("NOTIFICATION_SERVICE_URL", "http://notification-service:8005"),
    "iot": os.environ.get("IOT_SERVICE_URL", "http://iot-service:8006"),
    "analytics": os.environ.get("ANALYTICS_SERVICE_URL", "http://analytics-service:8007"),
    "pos": os.environ.get("POS_SERVICE_URL", "http://pos-service:8008"),
}

# Route prefix → service mapping
ROUTE_MAP = [
    # Auth Service
    ("/auth/", "auth"),
    ("/admin/", "auth"),
    ("/subscription/", "auth"),
    ("/upload/", "auth"),

    # Venue Service
    ("/venues", "venue"),
    ("/owner/venues", "venue"),
    ("/slots/", "venue"),
    ("/pricing-rules/", "venue"),
    ("/pricing/", "venue"),

    # Booking Service
    ("/bookings", "booking"),
    ("/split/", "booking"),
    ("/payment/", "booking"),
    ("/waitlist/", "booking"),
    ("/matchmaking/", "booking"),
    ("/mercenary/", "booking"),
    ("/rating/", "booking"),
    ("/leaderboard", "booking"),

    # Social Service
    ("/feed", "social"),
    ("/player-card/", "social"),
    ("/clubs", "social"),
    ("/tournaments", "social"),

    # Notification Service
    ("/notifications", "notification"),

    # IoT Service
    ("/iot/", "iot"),

    # Analytics Service
    ("/analytics/", "analytics"),
    ("/highlights", "analytics"),
    ("/compliance/", "analytics"),
    ("/academies", "analytics"),

    # POS Service
    ("/pos/", "pos"),
]


def resolve_service(path: str) -> str | None:
    """Determine which service handles a given path."""
    for prefix, service in ROUTE_MAP:
        if path.startswith(prefix):
            return service
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# PROXY HANDLER
# ═══════════════════════════════════════════════════════════════════════════════

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy(path: str, request: Request):
    """Proxy all requests to the appropriate microservice."""
    full_path = f"/{path}"
    service_name = resolve_service(full_path)

    if not service_name:
        return JSONResponse({"error": "No service found for this route", "path": full_path}, status_code=404)

    service_url = SERVICES.get(service_name)
    if not service_url:
        return JSONResponse({"error": f"Service {service_name} not configured"}, status_code=503)

    target_url = f"{service_url}{full_path}"
    if request.url.query:
        target_url += f"?{request.url.query}"

    # Forward headers (including auth)
    headers = dict(request.headers)
    headers.pop("host", None)

    try:
        body = await request.body()
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body,
            )

        # Forward response
        excluded_headers = {"content-encoding", "content-length", "transfer-encoding"}
        response_headers = {k: v for k, v in response.headers.items() if k.lower() not in excluded_headers}

        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=response_headers,
            media_type=response.headers.get("content-type")
        )

    except httpx.ConnectError:
        return JSONResponse(
            {"error": f"Service {service_name} is unavailable", "service": service_name},
            status_code=503
        )
    except httpx.TimeoutException:
        return JSONResponse(
            {"error": f"Service {service_name} timed out", "service": service_name},
            status_code=504
        )
    except Exception as e:
        logger.error(f"Gateway error proxying to {service_name}: {e}")
        return JSONResponse({"error": "Internal gateway error"}, status_code=502)


# ═══════════════════════════════════════════════════════════════════════════════
# WEBSOCKET PROXY (for venue & IoT live updates)
# ═══════════════════════════════════════════════════════════════════════════════

@app.websocket("/venues/{venue_id}/ws")
async def venue_ws_proxy(websocket: WebSocket, venue_id: str):
    await _ws_proxy(websocket, f"{SERVICES['venue']}/venues/{venue_id}/ws")


@app.websocket("/iot/ws")
async def iot_ws_proxy(websocket: WebSocket):
    await _ws_proxy(websocket, f"{SERVICES['iot']}/iot/ws")


async def _ws_proxy(client_ws: WebSocket, target_url: str):
    """Proxy WebSocket connection to a backend service."""
    await client_ws.accept()
    ws_url = target_url.replace("http://", "ws://").replace("https://", "wss://")

    try:
        async with httpx.AsyncClient() as client:
            # Use a simple forwarding approach
            import asyncio
            import websockets

            async with websockets.connect(ws_url) as backend_ws:
                async def forward_to_backend():
                    try:
                        while True:
                            data = await client_ws.receive_text()
                            await backend_ws.send(data)
                    except WebSocketDisconnect:
                        pass

                async def forward_to_client():
                    try:
                        async for message in backend_ws:
                            await client_ws.send_text(message)
                    except Exception:
                        pass

                await asyncio.gather(forward_to_backend(), forward_to_client())
    except Exception as e:
        logger.warning(f"WebSocket proxy failed: {e}")
        try:
            await client_ws.close()
        except Exception:
            pass


# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH & SERVICE DISCOVERY
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/")
async def root():
    return {
        "name": "Horizon API Gateway",
        "version": "2.0.0",
        "services": list(SERVICES.keys()),
        "docs": "/docs"
    }


@app.get("/health")
async def gateway_health():
    """Aggregate health from all services."""
    results = {}
    async with httpx.AsyncClient(timeout=5.0) as client:
        for name, url in SERVICES.items():
            try:
                resp = await client.get(f"{url}/health")
                results[name] = {"status": "healthy", "code": resp.status_code}
            except Exception:
                results[name] = {"status": "unreachable"}

    all_healthy = all(s["status"] == "healthy" for s in results.values())
    return {
        "gateway": "healthy",
        "overall": "healthy" if all_healthy else "degraded",
        "services": results
    }


@app.get("/services")
async def list_services():
    """List all registered services and their URLs."""
    return {name: {"url": url, "health": f"{url}/health"} for name, url in SERVICES.items()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
