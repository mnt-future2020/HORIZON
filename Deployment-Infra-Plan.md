# Deployment & Infrastructure — Decision Log

## Decision: DO App Platform + Atlas M10 (Option B)

### Final Stack
| Service | Provider | Plan | Cost/month |
|---|---|---|---|
| Frontend (React) | DO App Platform Static | Free | $0 |
| Backend (FastAPI) | DO App Platform Web Service | 1GB RAM, 1 vCPU | $12 |
| MongoDB | Atlas M10 | 2GB RAM, replica set built-in | $57 |
| Redis | Upstash | Pay-per-use | ~$10 |
| **Total** | | | **~$79/month** |

---

## Why Not Full DO (Option A)?

DO Managed MongoDB HA (3-node replica set) = **3× cost**:
- 4GB single node: $60/mo
- 4GB + 2 standby (HA): $60 × 3 = **$180/mo**

Atlas M10 = $57/mo with replica set built-in → DO HA not worth it for startup stage.

---

## Performance Trade-off (Acknowledged)

DO same-DC would be faster:
```
DO App → Private network → DO MongoDB = 1-2ms latency
DO App → Internet       → Atlas      = 20-50ms latency
```

9 queries per feed × latency difference = ~360ms vs ~18ms DB time at scale.

**Decision:** Accept Atlas latency for now. When revenue comes → migrate to DO HA ($180/mo) for full performance + HA.

---

## DO Managed MongoDB — Key Finding
- Single node: no replica set, no failover → crash = full downtime
- HA (3-node): standby nodes cost same as primary → 3× price
- Only makes sense at scale when $180/mo is justified

---

## Atlas M10 Advantages
- Already using Atlas (zero migration)
- Built-in 3-node replica set → auto-failover, no downtime
- Read replicas available → Issue 3 (ReadPreference) fix works
- Atlas Search text indexes already configured
- Scale: M10 → M20 ($117) with zero downtime

---

## Deployment Files — Already Ready
- `backend/Dockerfile` ✅ — uvicorn, port 8000, --proxy-headers
- `frontend/Dockerfile` ✅ — nginx
- `frontend/nginx.conf` ✅

## Env Variables needed on DO App Platform
```
MONGO_URL           = mongodb+srv://...atlas...
REDIS_URL           = rediss://...upstash...
JWT_SECRET          = ...
RAZORPAY_KEY_ID     = ...
RAZORPAY_KEY_SECRET = ...
DB_NAME             = lobbi_db
```

---

## Current Problem — All Reads + Writes Hit Same Node

```
Feed load    (read)  → Primary
Comments     (read)  → Primary
Like         (write) → Primary
New post     (write) → Primary
Player card  (read)  → Primary
Trending     (read)  → Primary
← All 10K users hitting 1 node
```

Read:Write ratio = 85:15 — 85% reads are unnecessarily hitting the primary.

At 10K users: ~30,000 queries/sec on single primary → bottleneck → slow feeds → crashes.

**Fix (when replica set available):**
```python
# database.py
from pymongo import ReadPreference

feed_db = client.get_database('lobbi_db',
    read_preference=ReadPreference.SECONDARY_PREFERRED
)
# Reads  → Secondary node (85% of traffic offloaded)
# Writes → Primary node (only 15% traffic remains)
```

Use `feed_db` in: `/feed`, `/trending`, `/player-card`, `/stories`, `/explore`
Keep `db` (primary) in: like, post create, follow, comment (writes)

---

## Issue 3 (Read Replicas) — Revisit When Migrating to DO HA
- Atlas M10: ReadPreference.SECONDARY_PREFERRED works (SRV string has all nodes) ✅
- DO single node: No secondaries → no benefit
- DO HA ($180/mo): Works — verify connection string exposes all nodes first
- **Status: Pending — apply when migrating to DO HA or when on Atlas M10 production**