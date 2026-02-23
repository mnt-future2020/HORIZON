# LOBBI — Monolith Deep Audit Report

**Date:** February 23, 2026
**Scope:** Backend (`backend/`) + Frontend (`frontend/`) + Mobile (`mobile/`) — Monolith only
**Microservices:** Excluded (planned, not deployed)

---

## Architecture: Pure Monolith

```
Nginx (SSL + Rate Limit)
    │
    ├── React 19 SPA (Port 80)
    │
    └── FastAPI Monolith (Port 8000)
         ├── 27 route modules
         ├── MongoDB 7
         ├── Redis 7 (slot locking)
         ├── Razorpay (payments)
         ├── AWS S3 (file uploads)
         ├── MQTT (IoT)
         └── Gemini AI (video analysis)
```

**No microservices in production. Single FastAPI process handles everything.**

---

## File-by-File Audit

---

### 1. `backend/server.py` — App Entry Point

**Risk Level: MODERATE-HIGH**

#### Good
- Lines 47–57: `SecurityHeadersMiddleware` adds HSTS, X-Frame-Options, XSS-Protection
- Line 136: CORS origins loaded from env var (configurable)
- Lines 178–181: Shutdown event properly closes DB + Redis connections

#### Bad

| Line | Issue | Severity |
|------|-------|----------|
| 153–157 | JWT_SECRET check only **warns**, doesn't **hard-fail** in production. Weak secrets like `"abc"` pass through. | HIGH |
| 81–88 | Seed endpoint disabled only when `ENVIRONMENT == "production"`. If env var is missing or typo'd (e.g., `"Production"`), seed is EXPOSED. | HIGH |
| 65–67 | `/api/uploads` mounted as `StaticFiles` with **zero access control**. Anyone can browse uploaded files by guessing filenames. | HIGH |
| 107–133 | Contact form: no rate limiting, no CAPTCHA, basic email regex (`a@b.c` passes). Spam/DoS vector. | MEDIUM |
| 70–77 | No API versioning (`/api/` not `/api/v1/`). Breaking changes break all clients simultaneously. | LOW |

---

### 2. `backend/database.py` — DB Connection

**Risk Level: MODERATE**

#### Good
- Lines 29–38: Redis connection wrapped in try-catch, graceful fallback
- Lines 17–18: Lock TTL constants defined (SOFT: 10min, HARD: 30min)

#### Bad

| Line | Issue | Severity |
|------|-------|----------|
| 8–10 | `AsyncIOMotorClient` created once at module import. **No retry logic.** If MongoDB is down at startup → crash, no recovery. | HIGH |
| 13 | Redis URL checks `REDIS_URL` then `REDIS_PRIVATE_URL`. If both missing, Redis silently disabled — **slot locking stops working without any alert**. | HIGH |
| — | No `maxPoolSize` / `minPoolSize` configured. Default pool may be too small under load → "too many connections" errors. | MEDIUM |
| 41–45 | `close_connections()` doesn't properly await async close operations. Potential resource leaks on shutdown. | LOW |

---

### 3. `backend/auth.py` — Authentication Core

**Risk Level: HIGH**

#### Good
- Lines 17, 24–37: bcrypt via `passlib.CryptContext` (secure)
- Lines 20–21, 24–29: Password strength enforced (8+ chars, upper, lower, digit)
- Line 42: Access token 2-hour expiry (reasonable)
- Lines 54–61: Refresh token validates token type field

#### Bad

| Line | Issue | Severity |
|------|-------|----------|
| 11 | `JWT_SECRET` from env with **no validation**. If empty string → tokens signed with empty key → anyone can forge tokens. | CRITICAL |
| 13 | `REFRESH_SECRET = os.environ.get('REFRESH_SECRET', secrets.token_hex(32))` — auto-generates random secret if missing. **Every restart = new secret = all refresh tokens invalidated.** Multiple pods = different secrets. | CRITICAL |
| 42, 49 | Uses `datetime.now()` (naive, local timezone) instead of `datetime.now(timezone.utc)`. Token expiry may be wrong across servers in different timezones. | MEDIUM |
| 72 | **No token blacklist/revocation.** Compromised token valid until expiry. Password change doesn't invalidate old tokens. | MEDIUM |
| 88 | `get_optional_user()` catches `except Exception:` — swallows ALL errors including database failures. Returns None even if DB is down. | MEDIUM |
| 21 | Password allows only 8 chars minimum without special characters. `Abcdef12` is accepted. | LOW |

---

### 4. `backend/routes/bookings.py` — Payment & Booking Flow

**Risk Level: CRITICAL**

#### Good
- Lines 31–39: Slot lock check before booking creation
- Lines 49–70: Dynamic pricing rules applied correctly
- Lines 187–196: Atomic `find_one_and_update` for split payment increments

#### Bad

| Line | Issue | Severity |
|------|-------|----------|
| 295 | `GET /bookings/{booking_id}` — **ZERO authentication.** Any anonymous user can read ANY booking by guessing the ID. Exposes payment amounts, user details, booking metadata. | CRITICAL |
| 358–406 | `POST /split/{token}/pay` — **No auth.** Anyone with a split token can view booking details AND submit payments. Token is the only guard. | CRITICAL |
| 170 | `if key_secret:` — falsy check. Empty string `""` skips signature verification. Should be `if key_secret is not None:`. A config error = payment forgery possible. | CRITICAL |
| 188–200 | Two separate DB updates for split payment confirmation. Between the atomic increment (line 188) and the status update (line 200), a **race condition** can trigger double-confirmation. | HIGH |
| 48 | `price = venue.get("base_price", 2000)` — no validation that price is positive. Corrupted data = negative charges. | MEDIUM |
| 68–70 | Discount `value > 1.0` creates negative price. No bounds check. `int(price * (1 - 1.5))` = negative booking. | MEDIUM |
| 161–163 | Any player in a booking can verify payment — not just the host. Attacker joins booking, then verifies fake payment. | MEDIUM |
| 376 | `payer_name` from user input stored without sanitization in split payment notes. | LOW |

---

### 5. `backend/routes/auth.py` — Login & Registration

**Risk Level: MODERATE-HIGH**

#### Good
- Line 15–17: Email uniqueness checked before registration
- Line 18: Password strength validated via imported function
- Lines 19–42: Sensible defaults for new user creation

#### Bad

| Line | Issue | Severity |
|------|-------|----------|
| 11, 50 | `/auth/register` and `/auth/login` — **no rate limiting**. Brute force, credential stuffing, user enumeration all possible. | HIGH |
| 52–53 | Timing leak: if user not found, returns immediately. Valid email = slower response (bcrypt runs). Attacker can enumerate valid emails. | HIGH |
| 91–105 | Refresh endpoint — no validation on empty token string. `data.get("refresh_token", "")` passes empty string to JWT decoder. | MEDIUM |
| 19 | `venue_owner` / `coach` set to `"pending"` but tokens still issued immediately. Pending users can hit API endpoints. | MEDIUM |

---

### 6. `backend/routes/venues.py` — Venue Management

**Risk Level: HIGH**

#### Good
- Lines 52–73: Slug generation with uniqueness logic
- `re.escape()` used on user input for MongoDB regex

#### Bad

| Line | Issue | Severity |
|------|-------|----------|
| 84–130 | List venues endpoint is fully public. No auth, no pagination limit visible. Full venue scraping possible. | MEDIUM |
| 95–96 | `re.escape()` escapes Python regex, **not MongoDB regex**. MongoDB uses different escape rules. Potential NoSQL injection. | MEDIUM |
| 109–113 | Price range query construction — `query["base_price"]` can overwrite existing filters if both `$gte` and `$lte` set in wrong order. | LOW |
| 300 | WebSocket venue updates broadcast unvalidated user input through `update_venue`. | MEDIUM |

---

### 7. `backend/encryption.py` — Chat Encryption

**Risk Level: MODERATE**

#### Good
- Lines 9, 21–31: AES-256-GCM with proper 12-byte nonce
- Lines 34–49: Decryption error handling with fallback

#### Bad

| Line | Issue | Severity |
|------|-------|----------|
| 11–13 | Falls back to `JWT_SECRET` then **hardcoded `"default-dev-key"`**. All deployments missing `CHAT_ENCRYPTION_KEY` share the same master key. All chats readable. | CRITICAL |
| 18 | Key derivation uses simple `SHA256(master_key + conversation_id)` — NOT proper HKDF. Weaker than standard. Should use `cryptography.hazmat.primitives.kdf.hkdf.HKDF`. | MEDIUM |
| 48 | `except Exception:` swallows all decryption errors. Hides DB corruption, key rotation failures silently. | LOW |

---

### 8. `backend/s3_service.py` — File Storage

**Risk Level: LOW**

#### Good
- Lines 36–55: Error handling with logging for upload failures
- Line 28: S3v4 signature (modern, secure)
- Lines 41, 50: UUID prefix prevents filename enumeration

#### Bad

| Line | Issue | Severity |
|------|-------|----------|
| 33 | Public URL format hardcoded (`https://{bucket}.s3.{region}.amazonaws.com`). Breaks with custom domains or non-standard bucket configs. | LOW |
| — | No upload size limit enforced at application level (only Nginx 25MB limit). | LOW |

---

### 9. `frontend/src/App.js` — Client Router

**Risk Level: MODERATE**

#### Good
- Lines 47–57: `ProtectedRoute` checks auth + loading state
- Line 122: `ErrorBoundary` wraps entire app

#### Bad

| Line | Issue | Severity |
|------|-------|----------|
| 87 | `/split/:token` route — no auth. Matches backend vulnerability. Financial flow unprotected. | HIGH |
| 6–42 | All 38 pages imported eagerly at top. **No lazy loading.** Entire bundle loaded even for single-page visit. Slow on mobile networks. | MEDIUM |
| 122 | Single `ErrorBoundary` for entire app. One route crash = whole app crash. No per-route isolation. | MEDIUM |
| 74–76 | Auth redirect to `/feed` while context still loading → momentary redirect loop possible. | LOW |

---

### 10. `frontend/src/contexts/AuthContext.js` — Token Management

**Risk Level: HIGH**

#### Good
- Line 10: Token loaded from localStorage on mount
- Lines 46–51: Logout clears both tokens

#### Bad

| Line | Issue | Severity |
|------|-------|----------|
| 10 | Tokens stored in `localStorage` — if ANY XSS vulnerability exists in the app, attacker steals all tokens. `httpOnly` cookies would prevent this. | HIGH |
| 15–21 | `.catch(() => { ... logout })` — ANY error (network timeout, 5xx, DNS failure) logs user out. API temporarily down = all users logged out. | HIGH |
| — | No token auto-refresh timer. 2-hour token expires → user sees 401 errors until refresh triggers via interceptor. Poor UX. | MEDIUM |
| — | No refresh token rotation. Stolen refresh token valid for full 7 days with no way to invalidate. | MEDIUM |

---

### 11. `frontend/src/lib/api.js` — HTTP Client

**Risk Level: MODERATE-HIGH**

#### Good
- Lines 10–17: Request interceptor auto-attaches Bearer token
- Lines 20–43: Response interceptor handles 401 → refresh flow
- Line 5: 30-second timeout configured

#### Bad

| Line | Issue | Severity |
|------|-------|----------|
| 3 | `REACT_APP_BACKEND_URL` undefined → becomes `undefined/api`. No validation, requests go to wrong URL silently. | HIGH |
| 29 | Refresh token sent in POST body (not httpOnly cookie). Visible in network logs, proxy middleware, XSS-stealable. | HIGH |
| 24–43 | Multiple simultaneous 401s all trigger parallel refresh requests. Only first succeeds, rest fail. **No queue/lock to serialize refresh.** | MEDIUM |
| — | No CSRF protection (`X-CSRF-Token` header missing). POST/PUT/DELETE vulnerable to cross-site request forgery. | MEDIUM |

---

## Consolidated Risk Summary

### CRITICAL (Must fix before ANY launch)

| # | File | Issue |
|---|------|-------|
| 1 | `routes/bookings.py:295` | GET booking by ID — zero authentication |
| 2 | `routes/bookings.py:358` | Split payment endpoints — zero authentication |
| 3 | `routes/bookings.py:170` | Payment signature verification skipped on empty string |
| 4 | `auth.py:11` | JWT_SECRET empty string = forgeable tokens |
| 5 | `auth.py:13` | REFRESH_SECRET auto-generates = breaks on restart |
| 6 | `encryption.py:13` | Hardcoded `"default-dev-key"` fallback for chat encryption |

### HIGH (Must fix before public launch)

| # | File | Issue |
|---|------|-------|
| 7 | `routes/auth.py:11,50` | No rate limiting on register/login |
| 8 | `routes/auth.py:52` | Timing leak enables email enumeration |
| 9 | `server.py:65` | Uploaded files publicly accessible without auth |
| 10 | `server.py:81` | Seed endpoint relies on case-sensitive env check |
| 11 | `database.py:8` | No MongoDB connection retry logic |
| 12 | `database.py:13` | Redis silently disabled if URL missing |
| 13 | `AuthContext.js:15` | Any API error logs user out |
| 14 | `api.js:3` | Undefined backend URL fails silently |
| 15 | `api.js:29` | Refresh token in POST body (XSS-stealable) |
| 16 | `routes/bookings.py:188` | Race condition in split payment confirmation |

### MEDIUM (Fix before scaling)

| # | File | Issue |
|---|------|-------|
| 17 | `auth.py:42` | Naive datetime (no UTC) for token expiry |
| 18 | `auth.py:72` | No token revocation/blacklist |
| 19 | `bookings.py:48` | No validation base_price is positive |
| 20 | `bookings.py:68` | Discount > 100% creates negative price |
| 21 | `encryption.py:18` | Non-standard key derivation (not HKDF) |
| 22 | `App.js:6-42` | No lazy loading — full bundle on every page |
| 23 | `api.js:24` | Concurrent refresh requests not serialized |
| 24 | `venues.py:300` | Unvalidated input broadcast via WebSocket |

---

## Revised Monolith-Only Scorecard

| Category | Score | Key Finding |
|----------|-------|-------------|
| Feature Completeness | **9 / 10** | Impressive breadth for a monolith |
| Code Organization | **7 / 10** | Clean route separation, proper async patterns |
| Authentication | **4 / 10** | JWT basics OK, but secret management is broken |
| Authorization | **3 / 10** | Critical endpoints missing auth entirely |
| Payment Security | **4 / 10** | Razorpay integration exists but bypassable |
| Input Validation | **7 / 10** | Pydantic helps a lot, minor gaps |
| Error Handling | **5 / 10** | Swallowed exceptions, no correlation IDs |
| Testing | **5 / 10** | Integration tests exist, no unit/security/load |
| Frontend Security | **4 / 10** | localStorage tokens, no CSRF, no lazy loading |
| Deployment | **8 / 10** | Docker + Nginx + SSL is solid |
| Observability | **3 / 10** | Basic logging only, blind in production |
| Database | **5 / 10** | No indexes, no backups, no retry, no pool config |
| **OVERALL MONOLITH** | **5.5 / 10** | **Good MVP, critical security holes for production** |

---

## Priority Fix Order (Effort Estimate)

### Sprint 1: Security Critical (2–3 days)
1. Add `Depends(get_current_user)` to `GET /bookings/{booking_id}` + ownership check
2. Add auth to split payment endpoints
3. Fix `if key_secret:` → `if key_secret is not None:`
4. Hard-fail on missing `JWT_SECRET` / `REFRESH_SECRET` in production startup
5. Remove `"default-dev-key"` fallback from encryption.py
6. Protect `/api/uploads` directory with auth middleware

### Sprint 2: Auth Hardening (2–3 days)
7. Add rate limiting to `/auth/register`, `/auth/login`, `/contact` (use `slowapi`)
8. Fix timing leak — always run bcrypt even if user not found
9. Use `datetime.now(timezone.utc)` everywhere
10. Add CAPTCHA to contact form
11. Validate `ENVIRONMENT` env var strictly on startup
12. Add MongoDB connection retry with exponential backoff

### Sprint 3: Frontend Security (2–3 days)
13. Switch to `httpOnly` cookies for token storage (requires backend CSRF)
14. Fix AuthContext to only logout on 401, not all errors
15. Add lazy loading with `React.lazy()` + `Suspense`
16. Validate `REACT_APP_BACKEND_URL` on app init
17. Serialize concurrent refresh token requests

### Sprint 4: Observability + Testing (3–5 days)
18. Integrate Sentry (backend + frontend)
19. Switch to structured JSON logging
20. Add request correlation IDs via middleware
21. Write unit tests for auth.py, encryption.py, glicko2.py
22. Add MongoDB indexes for high-query collections
23. Set up database backup cron job

**Total estimated effort: 40–60 hours of focused work.**

---

*This audit was performed through line-by-line static analysis of the monolith codebase only. The `microservices/` folder was excluded entirely as it is not deployed in production.*
