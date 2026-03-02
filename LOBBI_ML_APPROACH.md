# LOBBI - ML Dynamic Pricing Pipeline
## Problem, Approach and Execution Knowledge

---

## PROBLEM

LOBBI is a sports venue booking platform. Venue owners want to know:
- Which time slots have high demand? Should I charge more?
- Which slots are always empty? Should I give discounts?

Currently owners set FIXED prices for all slots. A 6AM slot and a 7PM prime-time slot cost the same. Owners lose revenue on peak hours and cant attract players during off-peak hours.

We need an ML system that analyzes past booking patterns and SUGGESTS dynamic prices to the owner.

---

## WHY ML SHOULD NEVER TOUCH ACTUAL PRICES

If ML directly changes prices:
- Model goes wrong then Player gets charged 50000 for a 1500 slot
- Owner has no control then Trust lost then They leave the platform
- Legal issues then Who set this price? Your AI? I want a refund

Solution: Two completely separate pipelines

ML Pipeline:      Historical bookings > Train model > Suggest prices > Owner reads > Owner decides
Pricing Pipeline: New booking created > pricing_rules applied > Player pays

ML only writes to: ml_models collection (suggestions)
Prices come from:  pricing_rules collection (owner-created rules)
ML has ZERO access to pricing_rules. Complete separation.

---

## THE TRAINING PROBLEM - WHY WE NEED CELERY + REDIS

### Problem

ML model training is CPU-heavy work (10-30 seconds). If it runs on the main API server:

Owner clicks Train Model
API Server starts training (30 seconds of heavy CPU)
During these 30 seconds:
- Player tries to book a slot > SLOW or TIMEOUT
- Player tries to pay > SLOW or TIMEOUT
- Another owner opens dashboard > SLOW
- 10 owners click train at same time > SERVER CRASH

The API servers job is to handle fast requests (booking, payment, venue listing). ML training blocks everything.

### Solution: Celery + Redis

Offload heavy ML work to a SEPARATE background worker. API server stays free.

API Server (fast, lightweight)          Worker (heavy lifting, separate process)
- Handle bookings                       - Train model venue A
- Handle payments        Redis Queue    - Train model venue B
- Handle listings                       - Train model venue C
- Queue ML jobs                         - (runs independently)
  Process 1                               Process 2
  (same codebase)                         (same codebase)

### What is each component?

Celery  = Python library (pip install celery)
          Manages background workers, retries, scheduling, monitoring
          Think of it as FastAPI but for background tasks

Redis   = Temporary message database (like MongoDB but for quick messages)
          Acts as the queue between API server and worker
          Think of it as WhatsApp between API and Worker

Worker  = A separate process running your same Python code
          Picks up jobs from Redis, executes them, saves results to MongoDB
          Think of it as a chef in a separate kitchen

### Why Celery and not a manual Redis loop?

You CAN write a manual while-loop that checks Redis for jobs. But youd end up building:
- Retry logic on failure (~80 lines)
- Concurrency/parallel workers (~100 lines)
- Task monitoring/status tracking (~100 lines)
- Scheduled jobs (~60 lines)
- Crash recovery (~70 lines)
- Graceful shutdown (~40 lines)

Total: ~450+ lines of infrastructure code. Celery gives all of this with pip install + 10 lines of config. Battle-tested by Instagram, Stripe, Mozilla.

---

## EXECUTION FLOW - STEP BY STEP

### Flow 1: Owner Trains the Model

Step 1: Owner clicks Analyze Bookings button in frontend

Step 2: Frontend sends POST /pricing/train-model?venue_id=xxx

Step 3: API server receives request
- Saves status training in MongoDB ml_models collection
- Pushes a job to Redis queue (takes ~1 millisecond)
- Returns IMMEDIATELY: { status: training, task_id: abc123 }
- API server is now FREE for other requests

Step 4: Celery Worker (separate process) picks up job from Redis
- Fetches venue document > gets slot_duration_minutes
- Fetches all confirmed bookings for this venue
- For each booking:
    Calculate per-slot price = total_amount / num_slots
    (Example: 18:00-21:00, total 6750, slot=60min > 3 slots > 2250 per slot)
    Extract features: [hour, day_of_week, month, is_weekend,
    hour_sin, hour_cos, dow_sin, dow_cos, month_sin, month_cos, turf_number]
- Trains RandomForest model (X = features, y = per_slot_prices)
- Saves trained model binary to MongoDB ml_models collection
- Updates status to completed

Step 5: Frontend polls GET /pricing/training-status every 3 seconds
- While training: shows spinner Training your model...
- When completed: shows Model trained! 312 bookings analyzed
- If failed: shows error with retry button

### Flow 2: Owner Views Demand Forecast

Step 1: Owner picks a date in the forecast calendar

Step 2: Frontend sends GET /pricing/demand-forecast?venue_id=xxx&date=2026-03-01

Step 3: API server handles this DIRECTLY (fast, no Celery needed):
- Fetches venue document
- Builds turf list from turf_config
  Example: [(1, Ground A, football, 1500), (2, Ground B, football, 2500)]
- Generates all time slots using venues slot_duration_minutes
  Example (30min slots): 06:00, 06:30, 07:00 ... 22:30
- For each (time_slot x turf) combination:
    Loads trained model from memory cache (or MongoDB if not cached)
    Extracts features for that slot
    Runs prediction > gets predicted_price
    Calculates ratio = predicted_price / base_price (turf-specific)
    Determines demand_level:
        ratio >= 1.3 > high
        ratio >= 1.1 > medium
        ratio >= 0.85 > normal
        ratio < 0.85 > low
    Clamps suggested price to 50%-200% of base_price
- Generates insights by grouping high/low demand slots

Step 4: Returns to frontend:
{
  forecasts: [{ start_time, turf_number, suggested_price, demand_level }],
  insights: [{ type, text, affected_slots }],
  model_meta: { trained_at, sample_count }
}

Step 5: Frontend renders forecast grid + insight cards with Apply as Rule + button

### Flow 3: Owner Applies Suggestion as Pricing Rule

Step 1: Owner sees insight: High demand 18:00-20:00 - suggest 2250 (currently 1500)

Step 2: Clicks Apply as Rule +

Step 3: Frontend pre-fills rule form:
- Name: AI: Peak 18:00-20:00
- Conditions: time 18:00-20:00, turf: Ground A
- Action: multiplier = 2250/1500 = 1.5x
- Live preview: 1500 > 2250

Step 4: Owner reviews, adjusts, saves > POST /venues/{id}/pricing-rules

Step 5: Next booking at 18:30 on Ground A:
booking_service applies rule > 1500 x 1.5 = 2250
ML had ZERO involvement in this transaction

---

## WHAT RUNS WHERE

ON CELERY WORKER (heavy, slow):
- Model training (10-30 seconds)
- Nightly batch retraining
- Future: report generation, bulk exports

ON API SERVER DIRECTLY (fast):
- Demand forecast/prediction (milliseconds - model already trained)
- Training status check (simple MongoDB read)
- Pricing rule CRUD (simple DB operations)
- All booking/payment/venue endpoints (existing)

---

## MODEL DETAILS

### Why RandomForest?
- Works with small datasets (50-5000 bookings)
- Handles non-linear demand patterns
- No feature scaling needed
- Fast training (seconds, not minutes)
- Upgrade path: swap to LightGBM later without changing feature pipeline

### Features (11 per data point)
hour, day_of_week, month, is_weekend,
hour_sin, hour_cos, dow_sin, dow_cos, month_sin, month_cos,
turf_number

### Why Cyclic Encoding?
Without it: model thinks 23:00 and 00:00 are far apart (distance=23)
With sin/cos: model correctly sees they are adjacent

### Per-Slot Price (Critical Training Fix)
WRONG:  Train on total booking amount (6750 for 3-hour booking)
RIGHT:  Train on per-slot price (6750 / 3 slots = 2250)

### Price Clamping
- Suggested price clamped to 50%-200% of base price
- Prevents absurd suggestions (50 or 15000 for a 1500 slot)
- Round to nearest 50 for clean display
- Make bounds configurable per venue later

---

## CELERY TASK BEHAVIOR

Single owner trains:
Job queued > Worker processes > Done in 30 sec

50 owners train simultaneously:
50 jobs queue in Redis > Worker processes one by one
Each owner sees their spinner > Gets notified when done
API server completely unaffected

Worker crashes mid-training:
acks_late=True > Job stays in Redis > Worker restarts > Job reprocessed
No data loss

Celery Beat (scheduled - optional for MVP):
Every night 2AM > Find venues with stale models + new bookings > Auto retrain

---

## COLD START HANDLING

0 bookings:    Hide forecast tab > Start receiving bookings to unlock AI pricing
< 30 bookings: Show progress > Need 30+ bookings (currently: 12)
30+ bookings:  Full functionality enabled

---

## MODEL STALENESS

50 new bookings since last training:  Subtle nudge Retrain?
30+ days since training:              Warning Model may be outdated
Celery Beat enabled:                  Auto-retrain nightly (no owner action needed)
After retraining:                     Clear in-memory cache > fresh model on next prediction

---

## SCALING ROADMAP

Stage 1 (0-500 venues):     Synchronous training on API server. No Celery.
Stage 2 (500-2000 venues):  Add Celery + Redis. Background worker. Same monolith.
Stage 3 (2000-10000):       Celery Beat nightly batch. Multiple workers. Dedicated machine.
Stage 4 (10000+):           Single global model with venue_id as feature instead of per-venue models.

---

## HOW TO RUN

Terminal 1: uvicorn main:app --port 8000                   (API server)
Terminal 2: redis-server                                    (message broker)
Terminal 3: celery -A celery_app worker --loglevel=info     (ML worker)

Same codebase. Same machine. Three processes.
Optional: celery -A celery_app flower                       (monitoring dashboard)

---

## FUTURE IMPROVEMENTS (Post-MVP)

1. Festival/holiday flags for Tamil Nadu (Pongal, Deepavali)
2. Weather data as feature
3. Adjacent-slot-booked feature (players avoid isolated slots)
4. LightGBM upgrade (better accuracy, same pipeline)
5. Rule expiry - AI rules auto-expire after 30/60/90 days
6. A/B testing - track AI suggestions earn X% more as selling point
7. Configurable clamp range per venue
8. Confidence threshold - only show high-confidence suggestions

---

## SUMMARY

Problem:    Flat pricing = lost revenue on peak, lost players on off-peak
Solution:   ML suggests dynamic prices, owner applies as rules
Safety:     ML never touches actual prices (complete pipeline separation)
Speed:      Celery + Redis offloads training to background worker
Celery is:  A Python library for background tasks (pip install)
Redis is:   A message broker between API and worker
Scale:      Synchronous > Celery > Batch > Global model
