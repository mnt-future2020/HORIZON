"""Venue Service - Venues, slots, pricing, reviews, ML pricing, drive-time."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "shared"))

from fastapi import FastAPI, HTTPException, Depends, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Dict, List
from datetime import datetime, timezone
from database import db, get_redis, lock_key, SOFT_LOCK_TTL, HARD_LOCK_TTL, init_redis, close_connections
from auth import get_current_user, get_optional_user, get_platform_settings
from models import VenueCreate, SlotLockInput, PricingRuleCreate
import uuid, random, math, re, json, logging, pickle, os as _os

app = FastAPI(title="Lobbi Venue Service")
logger = logging.getLogger("venue-service")
logging.basicConfig(level=logging.INFO)

app.add_middleware(CORSMiddleware, allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
async def startup():
    await init_redis()

@app.on_event("shutdown")
async def shutdown():
    await close_connections()

# ─── WebSocket Manager ───────────────────────────────────────────────────────
class VenueConnectionManager:
    def __init__(self):
        self._clients: Dict[str, List[WebSocket]] = {}
    async def connect(self, venue_id, ws):
        await ws.accept()
        self._clients.setdefault(venue_id, []).append(ws)
    def disconnect(self, venue_id, ws):
        lst = self._clients.get(venue_id, [])
        if ws in lst: lst.remove(ws)
        if not lst: self._clients.pop(venue_id, None)
    async def broadcast(self, venue_id, message):
        dead = []
        for ws in list(self._clients.get(venue_id, [])):
            try: await ws.send_text(json.dumps(message))
            except: dead.append(ws)
        for ws in dead: self.disconnect(venue_id, ws)

venue_manager = VenueConnectionManager()

# ─── Helpers ─────────────────────────────────────────────────────────────────
def generate_slug(name):
    slug = re.sub(r'[^a-z0-9\s-]', '', name.lower())
    return re.sub(r'-+', '-', re.sub(r'[\s_]+', '-', slug)).strip('-')

async def unique_slug(base_slug, exclude_id=None):
    slug, counter = base_slug, 1
    while True:
        query = {"slug": slug}
        if exclude_id: query["id"] = {"$ne": exclude_id}
        if not await db.venues.find_one(query): return slug
        slug = f"{base_slug}-{counter}"; counter += 1

def haversine_km(lat1, lng1, lat2, lng2):
    R = 6371
    dlat, dlng = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

# ─── Drive Time ──────────────────────────────────────────────────────────────
GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "")

def _haversine_estimate(lat1, lng1, lat2, lng2):
    dist = haversine_km(lat1, lng1, lat2, lng2)
    speed = 25 if dist < 10 else 40 if dist < 30 else 50
    return {"duration_minutes": max(1, round(dist / speed * 60)), "distance_km": round(dist, 1), "method": "haversine_estimate", "traffic_aware": False}

async def get_drive_time(olat, olng, dlat, dlng):
    redis_client = get_redis()
    cache_key = f"drivetime:{olat:.4f},{olng:.4f}:{dlat:.4f},{dlng:.4f}"
    if redis_client:
        try:
            cached = await redis_client.get(cache_key)
            if cached: return json.loads(cached.decode() if isinstance(cached, bytes) else cached)
        except: pass
    if GOOGLE_MAPS_API_KEY:
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                resp = await client.post("https://routes.googleapis.com/directions/v2:computeRoutes",
                    headers={"X-Goog-Api-Key": GOOGLE_MAPS_API_KEY, "X-Goog-FieldMask": "routes.duration,routes.distanceMeters"},
                    json={"origin": {"location": {"latLng": {"latitude": olat, "longitude": olng}}},
                          "destination": {"location": {"latLng": {"latitude": dlat, "longitude": dlng}}},
                          "travelMode": "DRIVE", "routingPreference": "TRAFFIC_AWARE"}, timeout=5.0)
                if resp.status_code == 200:
                    routes = resp.json().get("routes", [])
                    if routes:
                        dur = int(routes[0].get("duration", "0s").rstrip("s"))
                        dist = routes[0].get("distanceMeters", 0)
                        result = {"duration_minutes": round(dur/60), "distance_km": round(dist/1000, 1), "method": "google_routes", "traffic_aware": True}
                        if redis_client:
                            try: await redis_client.set(cache_key, json.dumps(result), ex=86400)
                            except: pass
                        return result
        except: pass
    result = _haversine_estimate(olat, olng, dlat, dlng)
    if redis_client:
        try: await redis_client.set(cache_key, json.dumps(result), ex=86400)
        except: pass
    return result

async def sort_venues_by_drive_time(venues, ulat, ulng):
    for v in venues:
        if v.get("lat") and v.get("lng"):
            v["drive_time"] = await get_drive_time(ulat, ulng, v["lat"], v["lng"])
        else:
            v["drive_time"] = {"duration_minutes": None, "distance_km": None, "method": "unknown", "traffic_aware": False}
    venues.sort(key=lambda v: v["drive_time"].get("duration_minutes") or 9999)
    return venues

# ─── Sentiment Analysis ──────────────────────────────────────────────────────
try:
    from textblob import TextBlob
    HAS_TEXTBLOB = True
except ImportError:
    HAS_TEXTBLOB = False

POSITIVE_WORDS = {"great","excellent","amazing","awesome","fantastic","wonderful","perfect","love","loved","best","good","nice","clean","well","maintained","friendly","professional","recommended","superb","brilliant","outstanding","quality","worth","enjoyed","happy","satisfied"}
NEGATIVE_WORDS = {"bad","terrible","awful","horrible","worst","poor","dirty","broken","rude","expensive","overpriced","disappointed","waste","never","avoid","mediocre","crowded","noisy","unsafe","smelly","unprofessional","disgusting","pathetic","scam"}

def analyze_sentiment(text):
    if not text or not text.strip():
        return {"score": 0.0, "label": "neutral", "confidence": 0, "keywords": []}
    if HAS_TEXTBLOB:
        blob = TextBlob(text)
        p, s = blob.sentiment.polarity, blob.sentiment.subjectivity
        label = "positive" if p > 0.1 else "negative" if p < -0.1 else "neutral"
        keywords = [w for w in set(text.lower().split()) if w in POSITIVE_WORDS or w in NEGATIVE_WORDS]
        return {"score": round(p, 3), "label": label, "confidence": int(min(100, abs(p)*100 + s*20)), "subjectivity": round(s, 3), "keywords": keywords[:10]}
    words = set(re.findall(r'\b[a-z]+\b', text.lower()))
    pos, neg = words & POSITIVE_WORDS, words & NEGATIVE_WORDS
    total = len(pos) + len(neg)
    if total == 0: return {"score": 0.0, "label": "neutral", "confidence": 30, "keywords": []}
    score = max(-1.0, min(1.0, (len(pos) - len(neg)) / total))
    label = "positive" if score > 0.15 else "negative" if score < -0.15 else "neutral"
    return {"score": round(score, 3), "label": label, "confidence": int(min(100, total*15 + abs(score)*50)), "keywords": list(pos | neg)[:10]}

async def get_venue_sentiment_summary(venue_id):
    reviews = await db.reviews.find({"venue_id": venue_id, "sentiment": {"$exists": True}}, {"_id": 0, "sentiment": 1}).to_list(500)
    if not reviews: return {"total_analyzed": 0, "avg_sentiment_score": 0, "sentiment_distribution": {"positive": 0, "neutral": 0, "negative": 0}}
    dist = {"positive": 0, "neutral": 0, "negative": 0}
    scores = []
    for r in reviews:
        s = r.get("sentiment", {})
        scores.append(s.get("score", 0))
        dist[s.get("label", "neutral")] = dist.get(s.get("label", "neutral"), 0) + 1
    return {"total_analyzed": len(reviews), "avg_sentiment_score": round(sum(scores)/len(scores), 3), "sentiment_distribution": dist}

# ─── ML Pricing ──────────────────────────────────────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), "pricing_model.pkl")

class DemandPredictor:
    def __init__(self):
        self.model = self.scaler = None
        self.is_trained = False
        if os.path.exists(MODEL_PATH):
            try:
                with open(MODEL_PATH, "rb") as f:
                    data = pickle.load(f)
                    self.model, self.scaler, self.is_trained = data.get("model"), data.get("scaler"), True
            except: pass

    @staticmethod
    def _extract_features(b):
        try:
            d = datetime.strptime(b.get("date", "2025-01-01"), "%Y-%m-%d")
            h = int(b.get("start_time", "12:00").split(":")[0])
        except: d, h = datetime.now(), 12
        dow, month = d.weekday(), d.month
        return [h, dow, month, 1 if dow >= 5 else 0, math.sin(2*math.pi*h/24), math.cos(2*math.pi*h/24),
                math.sin(2*math.pi*dow/7), math.cos(2*math.pi*dow/7), math.sin(2*math.pi*month/12), math.cos(2*math.pi*month/12), b.get("turf_number", 1)]

    async def train(self, venue_id):
        try:
            from sklearn.ensemble import RandomForestRegressor
            from sklearn.preprocessing import StandardScaler
            import numpy as np
        except ImportError: return False
        bookings = await db.bookings.find({"venue_id": venue_id, "status": "confirmed"}, {"_id": 0, "date": 1, "start_time": 1, "turf_number": 1, "total_amount": 1}).to_list(5000)
        if len(bookings) < 50: return False
        X = [self._extract_features(b) for b in bookings]
        y = [b.get("total_amount", 2000) for b in bookings]
        import numpy as np
        X, y = np.array(X), np.array(y)
        self.scaler = StandardScaler()
        X_s = self.scaler.fit_transform(X)
        self.model = RandomForestRegressor(n_estimators=100, max_depth=10, min_samples_split=5, random_state=42)
        self.model.fit(X_s, y)
        self.is_trained = True
        with open(MODEL_PATH, "wb") as f: pickle.dump({"model": self.model, "scaler": self.scaler}, f)
        return True

    async def predict_price(self, venue_id, date, start_time, turf_number, base_price):
        if not self.is_trained: return {"suggested_price": base_price, "confidence": 0, "method": "base_price", "demand_level": "unknown"}
        try: import numpy as np
        except: return {"suggested_price": base_price, "confidence": 0, "method": "base_price", "demand_level": "unknown"}
        f = self._extract_features({"date": date, "start_time": start_time, "turf_number": turf_number})
        fs = self.scaler.transform([f])
        preds = [t.predict(fs)[0] for t in self.model.estimators_]
        pred = int(round(sum(preds)/len(preds)))
        std = float(np.std(preds))
        conf = max(0, min(100, int(100 * (1 - std / max(float(np.mean(preds)), 1)))))
        ratio = pred / max(base_price, 1)
        demand = "high" if ratio > 1.3 else "medium" if ratio > 1.1 else "low" if ratio < 0.85 else "normal"
        suggested = max(int(base_price*0.5), min(int(base_price*2.0), pred))
        return {"suggested_price": suggested, "confidence": conf, "method": "ml_random_forest", "demand_level": demand, "base_price": base_price, "price_multiplier": round(suggested/max(base_price,1), 2)}

demand_predictor = DemandPredictor()

# ─── Venue Routes ────────────────────────────────────────────────────────────
@app.get("/venues")
async def list_venues(sport: Optional[str]=None, city: Optional[str]=None, area: Optional[str]=None,
    search: Optional[str]=None, min_price: Optional[int]=None, max_price: Optional[int]=None,
    sort_by: Optional[str]=None, amenity: Optional[str]=None):
    query = {"status": "active"}
    if sport: query["sports"] = {"$in": [sport]}
    if city: query["city"] = {"$regex": f"^{city}$", "$options": "i"}
    if area: query["area"] = {"$regex": area, "$options": "i"}
    if search: query["$or"] = [{"name": {"$regex": search, "$options": "i"}}, {"address": {"$regex": search, "$options": "i"}}, {"city": {"$regex": search, "$options": "i"}}]
    if min_price is not None: query.setdefault("base_price", {})["$gte"] = min_price
    if max_price is not None: query.setdefault("base_price", {})["$lte"] = max_price
    if amenity: query["amenities"] = {"$in": [amenity]}
    sf = {"price_low": [("base_price",1)], "price_high": [("base_price",-1)], "rating": [("rating",-1)], "name": [("name",1)], "bookings": [("total_bookings",-1)]}.get(sort_by, [("rating",-1)])
    return await db.venues.find(query, {"_id": 0}).sort(sf).to_list(200)

@app.get("/venues/cities")
async def list_cities():
    result = await db.venues.aggregate([{"$match": {"status": "active"}}, {"$group": {"_id": "$city", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]).to_list(100)
    return [{"city": r["_id"], "count": r["count"]} for r in result if r["_id"]]

@app.get("/venues/areas")
async def list_areas(city: Optional[str]=None):
    match = {"status": "active", "area": {"$ne": "", "$exists": True}}
    if city: match["city"] = {"$regex": f"^{city}$", "$options": "i"}
    result = await db.venues.aggregate([{"$match": match}, {"$group": {"_id": "$area", "count": {"$sum": 1}, "city": {"$first": "$city"}}}, {"$sort": {"count": -1}}]).to_list(200)
    return [{"area": r["_id"], "city": r["city"], "count": r["count"]} for r in result if r["_id"]]

@app.get("/venues/amenities")
async def list_amenities():
    result = await db.venues.aggregate([{"$match": {"status": "active"}}, {"$unwind": "$amenities"}, {"$group": {"_id": "$amenities", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]).to_list(100)
    return [{"amenity": r["_id"], "count": r["count"]} for r in result if r["_id"]]

@app.get("/venues/nearby")
async def nearby_venues(lat: float, lng: float, radius_km: float=50, sport: Optional[str]=None, limit: int=20):
    query = {"status": "active", "lat": {"$exists": True}, "lng": {"$exists": True}}
    if sport: query["sports"] = {"$in": [sport]}
    venues = await db.venues.find(query, {"_id": 0}).to_list(200)
    results = []
    for v in venues:
        dist = haversine_km(lat, lng, v.get("lat", 0), v.get("lng", 0))
        if dist <= radius_km: v["distance_km"] = round(dist, 1); results.append(v)
    results.sort(key=lambda x: x["distance_km"])
    return results[:limit]

@app.get("/venues/nearby/drive-time")
async def nearby_drive_time(lat: float, lng: float, radius_km: float=50, sport: Optional[str]=None, limit: int=20):
    query = {"status": "active", "lat": {"$exists": True}, "lng": {"$exists": True}}
    if sport: query["sports"] = {"$in": [sport]}
    venues = await db.venues.find(query, {"_id": 0}).to_list(200)
    nearby = [v for v in venues if haversine_km(lat, lng, v.get("lat",0), v.get("lng",0)) <= radius_km]
    for v in nearby: v["distance_km"] = round(haversine_km(lat, lng, v.get("lat",0), v.get("lng",0)), 1)
    try: results = await sort_venues_by_drive_time(nearby, lat, lng)
    except: results = sorted(nearby, key=lambda x: x.get("distance_km", 999))
    return results[:limit]

@app.get("/venues/slug/{venue_slug}")
async def get_venue_by_slug(venue_slug: str):
    venue = await db.venues.find_one({"slug": venue_slug, "status": "active"}, {"_id": 0})
    if not venue: raise HTTPException(404, "Venue not found")
    return venue

@app.websocket("/venues/ws/{venue_id}")
async def venue_websocket(venue_id: str, ws: WebSocket):
    await venue_manager.connect(venue_id, ws)
    try:
        while True: await ws.receive_text()
    except WebSocketDisconnect: pass
    finally: venue_manager.disconnect(venue_id, ws)

@app.get("/venues/{venue_id}")
async def get_venue(venue_id: str):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue: raise HTTPException(404, "Venue not found")
    return venue

@app.post("/venues")
async def create_venue(input: VenueCreate, user=Depends(get_current_user)):
    if user["role"] != "venue_owner": raise HTTPException(403, "Only venue owners can create venues")
    if user.get("account_status") != "active": raise HTTPException(403, "Account pending approval")
    platform = await get_platform_settings()
    plans = platform.get("subscription_plans", [])
    plan_config = next((p for p in plans if p["id"] == user.get("subscription_plan", "free")), None)
    max_venues = plan_config["max_venues"] if plan_config else 1
    current_venues = await db.venues.count_documents({"owner_id": user["id"]})
    if current_venues >= max_venues: raise HTTPException(403, f"Plan allows max {max_venues} venue(s)")
    slug = await unique_slug(generate_slug(input.name))
    venue = {"id": str(uuid.uuid4()), "owner_id": user["id"], "slug": slug, **input.model_dump(),
             "rating": 4.0 + round(random.random(), 1), "total_reviews": 0, "total_bookings": 0,
             "status": "active", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.venues.insert_one(venue)
    venue.pop("_id", None)
    return venue

@app.put("/venues/{venue_id}")
async def update_venue(venue_id: str, request: Request, user=Depends(get_current_user)):
    venue = await db.venues.find_one({"id": venue_id})
    if not venue or venue["owner_id"] != user["id"]: raise HTTPException(403, "Not authorized")
    data = await request.json()
    allowed = ["name","description","sports","address","city","amenities","images","base_price","slot_duration_minutes","opening_hour","closing_hour","turfs"]
    updates = {k: v for k, v in data.items() if k in allowed}
    if "name" in updates: updates["slug"] = await unique_slug(generate_slug(updates["name"]), exclude_id=venue_id)
    if updates: await db.venues.update_one({"id": venue_id}, {"$set": updates})
    updated = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    await venue_manager.broadcast(venue_id, {"type": "venue_update", "venue": updated})
    return updated

@app.get("/owner/venues")
async def get_owner_venues(user=Depends(get_current_user)):
    if user["role"] != "venue_owner": raise HTTPException(403, "Only venue owners")
    return await db.venues.find({"owner_id": user["id"]}, {"_id": 0}).to_list(100)

# ─── Slot Routes ─────────────────────────────────────────────────────────────
@app.get("/venues/{venue_id}/slots")
async def get_slots(venue_id: str, date: str, request: Request):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue: raise HTTPException(404, "Venue not found")
    current_user = await get_optional_user(request)
    current_uid = current_user["id"] if current_user else None
    redis_client = get_redis()
    rules = await db.pricing_rules.find({"venue_id": venue_id, "is_active": True}, {"_id": 0}).sort("priority", -1).to_list(100)
    bookings = await db.bookings.find({"venue_id": venue_id, "date": date, "status": {"$in": ["confirmed","pending","payment_pending"]}}, {"_id": 0}).to_list(100)
    booked_set = {f"{b['start_time']}-{b.get('turf_number',1)}" for b in bookings}
    try: dow = datetime.strptime(date, "%Y-%m-%d").weekday()
    except: dow = 0
    duration = venue.get("slot_duration_minutes", 60)
    slot_defs = [(f"{h:02d}:00", f"{h+(duration//60):02d}:00", t) for t in range(1, venue.get("turfs",1)+1) for h in range(venue.get("opening_hour",6), venue.get("closing_hour",23))]
    lock_map = {}
    if redis_client:
        try:
            pipe = redis_client.pipeline()
            for s, e, t in slot_defs: pipe.get(lock_key(venue_id, date, s, t))
            results = await pipe.execute()
            for i, (s, e, t) in enumerate(slot_defs):
                if results[i]: lock_map[f"{s}-{t}"] = results[i].decode() if isinstance(results[i], bytes) else results[i]
        except: pass
    slots = []
    for start, end, turf in slot_defs:
        is_booked = f"{start}-{turf}" in booked_set
        locked_by = lock_map.get(f"{start}-{turf}")
        status = "booked" if is_booked else "locked_by_you" if locked_by and locked_by == current_uid else "on_hold" if locked_by else "available"
        price = venue.get("base_price", 2000)
        for rule in rules:
            cond, act = rule.get("conditions", {}), rule.get("action", {})
            match = True
            if "days" in cond and dow not in cond["days"]: match = False
            if "time_range" in cond:
                tr = cond["time_range"]
                if start < tr.get("start","00:00") or start >= tr.get("end","23:59"): match = False
            if match:
                if act.get("type") == "multiplier": price = int(price * act.get("value", 1))
                elif act.get("type") == "discount": price = int(price * (1 - act.get("value", 0)))
        slots.append({"start_time": start, "end_time": end, "turf_number": turf, "price": price, "status": status, "locked_by": locked_by if locked_by and locked_by != current_uid else None})
    return {"venue_id": venue_id, "date": date, "slots": slots}

@app.post("/slots/lock")
async def acquire_slot_lock(input: SlotLockInput, user=Depends(get_current_user)):
    redis_client = get_redis()
    if not redis_client: raise HTTPException(503, "Locking service unavailable")
    key = lock_key(input.venue_id, input.date, input.start_time, input.turf_number)
    existing = await db.bookings.find_one({"venue_id": input.venue_id, "date": input.date, "start_time": input.start_time, "turf_number": input.turf_number, "status": {"$in": ["confirmed","pending","payment_pending"]}})
    if existing: raise HTTPException(409, "Slot already booked")
    acquired = await redis_client.set(key, user["id"], nx=True, ex=SOFT_LOCK_TTL)
    if not acquired:
        current = await redis_client.get(key)
        cv = current.decode() if isinstance(current, bytes) else current
        if cv == user["id"]:
            await redis_client.expire(key, SOFT_LOCK_TTL)
            return {"locked": True, "lock_key": key, "ttl": await redis_client.ttl(key), "lock_type": "soft", "message": "Lock refreshed"}
        raise HTTPException(409, "Slot is on hold by another user")
    return {"locked": True, "lock_key": key, "ttl": await redis_client.ttl(key), "lock_type": "soft", "message": "Slot locked for 10 minutes"}

@app.post("/slots/unlock")
async def release_slot_lock(input: SlotLockInput, user=Depends(get_current_user)):
    redis_client = get_redis()
    if not redis_client: raise HTTPException(503, "Locking service unavailable")
    key = lock_key(input.venue_id, input.date, input.start_time, input.turf_number)
    current = await redis_client.get(key)
    if not current: return {"released": True, "message": "No lock found"}
    cv = current.decode() if isinstance(current, bytes) else current
    if cv != user["id"]: raise HTTPException(403, "You don't own this lock")
    await redis_client.delete(key)
    return {"released": True, "message": "Lock released"}

@app.post("/slots/extend-lock")
async def extend_slot_lock(input: SlotLockInput, user=Depends(get_current_user)):
    redis_client = get_redis()
    if not redis_client: raise HTTPException(503, "Locking service unavailable")
    key = lock_key(input.venue_id, input.date, input.start_time, input.turf_number)
    current = await redis_client.get(key)
    if not current: raise HTTPException(404, "No active lock found")
    cv = current.decode() if isinstance(current, bytes) else current
    if cv != user["id"]: raise HTTPException(403, "You don't own this lock")
    await redis_client.expire(key, HARD_LOCK_TTL)
    return {"locked": True, "lock_key": key, "ttl": await redis_client.ttl(key), "lock_type": "hard", "message": "Lock extended for payment processing"}

@app.get("/slots/my-locks")
async def get_my_locks(user=Depends(get_current_user)):
    redis_client = get_redis()
    if not redis_client: return {"locks": []}
    try:
        all_keys = await redis_client.keys("lock:*")
        locks = []
        for key in all_keys:
            ks = key.decode("utf-8") if isinstance(key, bytes) else str(key)
            val = await redis_client.get(key)
            if not val: continue
            vs = val.decode("utf-8") if isinstance(val, bytes) else str(val)
            if vs == user["id"]:
                ttl = await redis_client.ttl(key)
                parts = ks.split(":")
                if len(parts) >= 6:
                    locks.append({"lock_key": ks, "venue_id": parts[1], "date": parts[2], "start_time": f"{parts[3]}:{parts[4]}", "turf_number": int(parts[5]), "ttl": ttl})
        return {"locks": locks}
    except: return {"locks": []}

@app.get("/slots/lock-status")
async def get_lock_status(venue_id: str, date: str, start_time: str, turf_number: int=1):
    redis_client = get_redis()
    if not redis_client: return {"locked": False}
    key = lock_key(venue_id, date, start_time, turf_number)
    val = await redis_client.get(key)
    if not val: return {"locked": False, "lock_key": key}
    ttl = await redis_client.ttl(key)
    return {"locked": True, "lock_key": key, "locked_by": val.decode() if isinstance(val, bytes) else val, "ttl": ttl}

# ─── Pricing Rules ───────────────────────────────────────────────────────────
@app.get("/venues/{venue_id}/pricing-rules")
async def get_pricing_rules(venue_id: str):
    return await db.pricing_rules.find({"venue_id": venue_id}, {"_id": 0}).sort("priority", -1).to_list(100)

@app.post("/venues/{venue_id}/pricing-rules")
async def create_pricing_rule(venue_id: str, input: PricingRuleCreate, user=Depends(get_current_user)):
    if user["role"] != "venue_owner": raise HTTPException(403, "Only venue owners")
    rule = {"id": str(uuid.uuid4()), "venue_id": venue_id, **input.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.pricing_rules.insert_one(rule); rule.pop("_id", None)
    return rule

@app.put("/pricing-rules/{rule_id}")
async def update_pricing_rule(rule_id: str, input: PricingRuleCreate, user=Depends(get_current_user)):
    if user["role"] != "venue_owner": raise HTTPException(403, "Only venue owners")
    result = await db.pricing_rules.update_one({"id": rule_id}, {"$set": {**input.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}})
    if result.matched_count == 0: raise HTTPException(404, "Rule not found")
    return await db.pricing_rules.find_one({"id": rule_id}, {"_id": 0})

@app.put("/pricing-rules/{rule_id}/toggle")
async def toggle_pricing_rule(rule_id: str, user=Depends(get_current_user)):
    if user["role"] != "venue_owner": raise HTTPException(403, "Only venue owners")
    rule = await db.pricing_rules.find_one({"id": rule_id})
    if not rule: raise HTTPException(404, "Rule not found")
    new_status = not rule.get("is_active", True)
    await db.pricing_rules.update_one({"id": rule_id}, {"$set": {"is_active": new_status}})
    return {"id": rule_id, "is_active": new_status}

@app.delete("/pricing-rules/{rule_id}")
async def delete_pricing_rule(rule_id: str, user=Depends(get_current_user)):
    result = await db.pricing_rules.delete_one({"id": rule_id})
    if result.deleted_count == 0: raise HTTPException(404, "Rule not found")
    return {"message": "Rule deleted"}

# ─── Review Routes ───────────────────────────────────────────────────────────
@app.get("/venues/{venue_id}/reviews")
async def get_reviews(venue_id: str, limit: int=50):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "id": 1})
    if not venue: raise HTTPException(404, "Venue not found")
    return await db.reviews.find({"venue_id": venue_id}, {"_id": 0}).sort("created_at", -1).to_list(limit)

@app.get("/venues/{venue_id}/reviews/summary")
async def get_review_summary(venue_id: str):
    pipeline = [{"$match": {"venue_id": venue_id}}, {"$group": {"_id": None, "avg_rating": {"$avg": "$rating"}, "total": {"$sum": 1},
        "r5": {"$sum": {"$cond": [{"$eq": ["$rating", 5]}, 1, 0]}}, "r4": {"$sum": {"$cond": [{"$eq": ["$rating", 4]}, 1, 0]}},
        "r3": {"$sum": {"$cond": [{"$eq": ["$rating", 3]}, 1, 0]}}, "r2": {"$sum": {"$cond": [{"$eq": ["$rating", 2]}, 1, 0]}},
        "r1": {"$sum": {"$cond": [{"$eq": ["$rating", 1]}, 1, 0]}}}}]
    result = await db.reviews.aggregate(pipeline).to_list(1)
    if not result: return {"avg_rating": 0, "total": 0, "distribution": {5:0,4:0,3:0,2:0,1:0}}
    r = result[0]
    return {"avg_rating": round(r["avg_rating"], 1), "total": r["total"], "distribution": {5: r["r5"], 4: r["r4"], 3: r["r3"], 2: r["r2"], 1: r["r1"]}}

@app.post("/venues/{venue_id}/reviews")
async def create_review(venue_id: str, request_data: dict, user=Depends(get_current_user)):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "id": 1})
    if not venue: raise HTTPException(404, "Venue not found")
    rating, comment, booking_id = request_data.get("rating"), request_data.get("comment", "").strip(), request_data.get("booking_id")
    if not rating or not isinstance(rating, int) or rating < 1 or rating > 5: raise HTTPException(400, "Rating must be 1-5")
    if not booking_id: raise HTTPException(400, "Booking ID required")
    booking = await db.bookings.find_one({"id": booking_id, "venue_id": venue_id, "status": "confirmed", "$or": [{"host_id": user["id"]}, {"players": user["id"]}]}, {"_id": 0, "id": 1})
    if not booking: raise HTTPException(403, "Must have confirmed booking to review")
    existing = await db.reviews.find_one({"booking_id": booking_id, "user_id": user["id"]})
    if existing: raise HTTPException(409, "Already reviewed this booking")
    sentiment = analyze_sentiment(comment) if comment else {}
    review = {"id": str(uuid.uuid4()), "venue_id": venue_id, "booking_id": booking_id, "user_id": user["id"], "user_name": user["name"],
              "rating": rating, "comment": comment, "sentiment": sentiment, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.reviews.insert_one(review); review.pop("_id", None)
    agg = await db.reviews.aggregate([{"$match": {"venue_id": venue_id}}, {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}]).to_list(1)
    if agg: await db.venues.update_one({"id": venue_id}, {"$set": {"rating": round(agg[0]["avg"], 1), "total_reviews": agg[0]["count"]}})
    return review

@app.get("/venues/{venue_id}/reviews/can-review")
async def can_review(venue_id: str, user=Depends(get_current_user)):
    bookings = await db.bookings.find({"venue_id": venue_id, "status": "confirmed", "$or": [{"host_id": user["id"]}, {"players": user["id"]}]}, {"_id": 0, "id": 1, "date": 1, "start_time": 1}).to_list(50)
    if not bookings: return {"can_review": False, "eligible_bookings": []}
    reviewed = await db.reviews.find({"booking_id": {"$in": [b["id"] for b in bookings]}, "user_id": user["id"]}, {"_id": 0, "booking_id": 1}).to_list(100)
    reviewed_ids = {r["booking_id"] for r in reviewed}
    eligible = [b for b in bookings if b["id"] not in reviewed_ids]
    return {"can_review": len(eligible) > 0, "eligible_bookings": eligible}

@app.get("/venues/{venue_id}/reviews/sentiment")
async def get_sentiment_summary_ep(venue_id: str):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "id": 1})
    if not venue: raise HTTPException(404, "Venue not found")
    return await get_venue_sentiment_summary(venue_id)

# ─── ML Pricing Routes ──────────────────────────────────────────────────────
@app.get("/pricing/ml-suggest")
async def ml_suggest(venue_id: str, date: str, start_time: str, turf_number: int=1, user=Depends(get_current_user)):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "base_price": 1})
    if not venue: return {"error": "Venue not found"}
    return await demand_predictor.predict_price(venue_id, date, start_time, turf_number, venue.get("base_price", 2000))

@app.get("/pricing/demand-forecast")
async def demand_forecast(venue_id: str, date: str, user=Depends(get_current_user)):
    if user["role"] not in ("venue_owner", "super_admin"): raise HTTPException(403, "Access denied")
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue: return {"venue_id": venue_id, "date": date, "forecasts": []}
    bp = venue.get("base_price", 2000)
    forecasts = []
    for h in range(venue.get("opening_hour",6), venue.get("closing_hour",23)):
        for t in range(1, venue.get("turfs",1)+1):
            p = await demand_predictor.predict_price(venue_id, date, f"{h:02d}:00", t, bp)
            forecasts.append({"start_time": f"{h:02d}:00", "turf_number": t, **p})
    return {"venue_id": venue_id, "date": date, "forecasts": forecasts}

@app.post("/pricing/train-model")
async def train_model(venue_id: str, user=Depends(get_current_user)):
    if user["role"] not in ("venue_owner", "super_admin"): raise HTTPException(403, "Access denied")
    success = await demand_predictor.train(venue_id)
    return {"message": "Model trained" if success else "Insufficient data (need 50+ bookings)", "status": "trained" if success else "insufficient_data"}

@app.get("/pricing/pricing-mode")
async def get_pricing_mode(venue_id: str, user=Depends(get_current_user)):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "pricing_mode": 1})
    if not venue: raise HTTPException(404, "Venue not found")
    return {"venue_id": venue_id, "pricing_mode": venue.get("pricing_mode", "rule_based")}

@app.put("/pricing/pricing-mode")
async def set_pricing_mode(venue_id: str, mode: str, user=Depends(get_current_user)):
    if user["role"] not in ("venue_owner", "super_admin"): raise HTTPException(403, "Access denied")
    if mode not in ("rule_based", "ml"): raise HTTPException(400, "Mode must be 'rule_based' or 'ml'")
    await db.venues.update_one({"id": venue_id}, {"$set": {"pricing_mode": mode}})
    return {"message": f"Pricing mode set to {mode}", "pricing_mode": mode}

@app.get("/health")
async def health():
    return {"status": "ok", "service": "venue-service"}
