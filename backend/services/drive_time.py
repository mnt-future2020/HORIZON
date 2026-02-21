"""
Drive-Time Based Venue Sorting Service
Uses Google Routes API (or falls back to Haversine) for travel time estimation.
Results are cached in Redis for 24 hours.
"""
import os
import logging
import math
import json
from database import get_redis

logger = logging.getLogger("horizon")

GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "")
CACHE_TTL = 86400  # 24 hours


def is_drive_time_available():
    return bool(GOOGLE_MAPS_API_KEY)


async def get_drive_time(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> dict:
    """
    Get drive time between two points.
    Returns: {duration_minutes, distance_km, method}
    Uses Google Routes API if available, falls back to Haversine estimation.
    """
    # Check cache first
    cache_key = f"drivetime:{origin_lat:.4f},{origin_lng:.4f}:{dest_lat:.4f},{dest_lng:.4f}"
    redis_client = get_redis()

    if redis_client:
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                cached_str = cached.decode() if isinstance(cached, bytes) else cached
                return json.loads(cached_str)
        except Exception:
            pass

    if GOOGLE_MAPS_API_KEY:
        result = await _google_routes_api(origin_lat, origin_lng, dest_lat, dest_lng)
    else:
        result = _haversine_estimate(origin_lat, origin_lng, dest_lat, dest_lng)

    # Cache result
    if redis_client:
        try:
            await redis_client.set(cache_key, json.dumps(result), ex=CACHE_TTL)
        except Exception:
            pass

    return result


async def _google_routes_api(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> dict:
    """Get drive time from Google Routes API."""
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://routes.googleapis.com/directions/v2:computeRoutes",
                headers={
                    "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
                    "X-Goog-FieldMask": "routes.duration,routes.distanceMeters"
                },
                json={
                    "origin": {"location": {"latLng": {"latitude": origin_lat, "longitude": origin_lng}}},
                    "destination": {"location": {"latLng": {"latitude": dest_lat, "longitude": dest_lng}}},
                    "travelMode": "DRIVE",
                    "routingPreference": "TRAFFIC_AWARE"
                },
                timeout=5.0
            )

            if response.status_code == 200:
                data = response.json()
                routes = data.get("routes", [])
                if routes:
                    route = routes[0]
                    duration_str = route.get("duration", "0s")
                    duration_seconds = int(duration_str.rstrip("s"))
                    distance_meters = route.get("distanceMeters", 0)
                    return {
                        "duration_minutes": round(duration_seconds / 60),
                        "distance_km": round(distance_meters / 1000, 1),
                        "method": "google_routes",
                        "traffic_aware": True
                    }
    except Exception as e:
        logger.warning(f"Google Routes API failed: {e}")

    # Fall back to Haversine
    return _haversine_estimate(origin_lat, origin_lng, dest_lat, dest_lng)


def _haversine_estimate(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> dict:
    """Estimate drive time using Haversine distance with average speed assumption."""
    R = 6371  # Earth radius in km
    dlat = math.radians(dest_lat - origin_lat)
    dlng = math.radians(dest_lng - origin_lng)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(origin_lat)) * math.cos(math.radians(dest_lat)) *
         math.sin(dlng / 2) ** 2)
    distance_km = R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    # Estimate drive time: assume average 25 km/h in urban areas, 50 km/h for longer distances
    avg_speed = 25 if distance_km < 10 else 40 if distance_km < 30 else 50
    duration_minutes = round(distance_km / avg_speed * 60)

    return {
        "duration_minutes": max(1, duration_minutes),
        "distance_km": round(distance_km, 1),
        "method": "haversine_estimate",
        "traffic_aware": False
    }


async def sort_venues_by_drive_time(venues: list, user_lat: float, user_lng: float) -> list:
    """Sort venues by estimated drive time from user location."""
    results = []
    for venue in venues:
        v_lat = venue.get("lat", 0)
        v_lng = venue.get("lng", 0)
        if v_lat and v_lng:
            drive_info = await get_drive_time(user_lat, user_lng, v_lat, v_lng)
            venue["drive_time"] = drive_info
        else:
            venue["drive_time"] = {
                "duration_minutes": None,
                "distance_km": None,
                "method": "unknown",
                "traffic_aware": False
            }
        results.append(venue)

    # Sort by duration (None values at end)
    results.sort(key=lambda v: v["drive_time"].get("duration_minutes") or 9999)
    return results
