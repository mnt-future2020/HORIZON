# LOBBI — Production Readiness Assessment Report

**Date:** February 23, 2026
**Project:** LOBBI (formerly Horizon Sports)
**Domain:** lobbi.in
**Assessed By:** Independent Code & Architecture Review

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Overview](#2-project-overview)
3. [Technology Stack](#3-technology-stack)
4. [Architecture Analysis](#4-architecture-analysis)
5. [Feature Inventory](#5-feature-inventory)
6. [Security Assessment](#6-security-assessment)
7. [Code Quality Analysis](#7-code-quality-analysis)
8. [Testing Assessment](#8-testing-assessment)
9. [Deployment & Infrastructure](#9-deployment--infrastructure)
10. [Observability & Monitoring](#10-observability--monitoring)
11. [Scalability Readiness](#11-scalability-readiness)
12. [Critical Issues — Must Fix](#12-critical-issues--must-fix)
13. [Non-Critical Weaknesses](#13-non-critical-weaknesses)
14. [What's Missing for Production](#14-whats-missing-for-production)
15. [Strengths](#15-strengths)
16. [Final Scorecard](#16-final-scorecard)
17. [Recommendations & Roadmap](#17-recommendations--roadmap)

---

## 1. Executive Summary

**Overall Production Readiness Score: 6.5 / 10**

LOBBI is an ambitious, feature-rich sports platform with impressive breadth — 200+ API endpoints, 38 web pages, real-time features, payment processing, IoT integration, and AI-powered highlights. The tech stack is modern and well-chosen.

However, several critical security gaps, insufficient testing depth, and absent observability tooling prevent it from being classified as production-hardened. The platform reads as a **very capable MVP/demo** rather than a battle-tested production system.

**Verdict:** Not ready for public launch with payments enabled. Fixable with 2–4 focused sprints of hardening work.

---

## 2. Project Overview

### What Is LOBBI?

India's first all-in-one sports platform connecting **Players**, **Venue Owners**, and **Coaches** in a unified ecosystem.

**Core Value Proposition:** "Book. Play. Connect. Compete."

### Problem Statement

| Stakeholder | Pain Point |
|-------------|------------|
| **Players** | Can't find venues, opponents, or coaches easily |
| **Venue Owners** | No online booking system, manual payments, zero analytics |
| **Coaches** | Can't get discovered, manual session management |
| **Community** | No sports-specific social network in India |

### Key Metrics

| Metric | Count |
|--------|-------|
| Total Source Files | 305 |
| Backend API Endpoints | 200+ |
| Backend Route Modules | 27 |
| Frontend Pages | 38 |
| Frontend Components | 40+ |
| Mobile Screens | 20+ |
| Microservices (planned, not deployed) | 9 |
| Database Collections | 15+ |
| User Roles | 4 (Player, Venue Owner, Coach, Super Admin) |
| Total Project Size | ~40 MB |

---

## 3. Technology Stack

### Backend (Production — Monolith)

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | FastAPI (async Python) | 0.110.1 |
| Server | Uvicorn (ASGI) | 0.25.0 |
| Database | MongoDB (NoSQL) | 7.x |
| Caching / Locking | Redis | 7.x |
| Validation | Pydantic | 2.12.5 |
| Authentication | JWT (PyJWT) | 2.11.0 |
| Encryption | AES-256-GCM (cryptography) | 46.0.4 |
| Payments | Razorpay | 2.0.0 |
| File Storage | AWS S3 (boto3) + local fallback | — |
| IoT/MQTT | fastapi-mqtt + paho-mqtt | 2.2.0 / 2.1.0 |
| AI/ML | Google Gemini AI | 1.62 |
| ML Libraries | scikit-learn, pandas, numpy | 1.6.1 / 3.0 / 2.4.2 |
| Real-time | WebSockets (Starlette) | 0.37.2 |
| Password Hashing | bcrypt | 4.1.3 |
| Testing | pytest | 9.0.2 |
| Code Quality | black, flake8, mypy, isort | — |

### Frontend (Web)

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.x |
| Build Tool | Craco (CRA wrapper) | — |
| Styling | Tailwind CSS | 3.4.17 |
| UI Components | Radix UI + Shadcn/ui | 20+ primitives |
| Animations | Framer Motion | 12.34 |
| Charts | Recharts | 3.6 |
| Forms | React Hook Form + Zod | — |
| HTTP Client | Axios | 1.8 |
| Icons | Lucide React | 0.507 |
| QR Code | qrcode.react + html5-qrcode | — |
| Routing | React Router DOM | 7.5 |

### Mobile App

| Layer | Technology |
|-------|-----------|
| Framework | React Native (Expo) |
| Navigation | React Navigation |
| Build | Expo for iOS + Android |
| Web Export | Webpack-based web build |

### Infrastructure

| Layer | Technology |
|-------|-----------|
| Containerization | Docker |
| Orchestration | Docker Compose |
| Reverse Proxy | Nginx (Alpine) |
| SSL/TLS | Let's Encrypt (Certbot) |
| Hosting | Digital Ocean |

---

## 4. Architecture Analysis

### Current Architecture (Production — Monolithic)

```
Internet
    │
    ▼
┌─────────────────────────────────────────────┐
│  Nginx (Reverse Proxy)                      │
│  • SSL/TLS termination                      │
│  • Rate limiting (5r/s auth, 30r/s API)     │
│  • Security headers (HSTS, CSP, etc.)       │
│  • Gzip compression                         │
│  • WebSocket upgrade support                │
└───────┬──────────────────┬──────────────────┘
        │                  │
        ▼                  ▼
┌───────────────┐  ┌───────────────┐
│ React Frontend│  │ FastAPI Backend│
│ (Port 80)     │  │ (Port 8000)   │
│ SPA + Nginx   │  │ 27 route      │
│               │  │ modules       │
└───────────────┘  └───┬───┬───┬───┘
                       │   │   │
              ┌────────┘   │   └────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ MongoDB 7│ │ Redis 7  │ │ AWS S3   │
        │ (Data)   │ │ (Cache/  │ │ (Files)  │
        │          │ │  Locks)  │ │          │
        └──────────┘ └──────────┘ └──────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Razorpay │ │ MQTT     │ │ Gemini AI│
        │ (Pay)    │ │ (IoT)    │ │ (Video)  │
        └──────────┘ └──────────┘ └──────────┘
```

### Microservices — Planned, NOT in Production

A `microservices/` folder exists in the codebase with 9 pre-built FastAPI services. However, **these are NOT deployed or used in production.** The production `docker-compose.prod.yml` references only the monolith backend — zero microservices are wired up.

| Service | Port | Status |
|---------|------|--------|
| auth-service | 8001 | Code exists, NOT deployed |
| venue-service | 8002 | Code exists, NOT deployed |
| booking-service | 8003 | Code exists, NOT deployed |
| social-service | 8004 | Code exists, NOT deployed |
| notification-service | 8005 | Code exists, NOT deployed |
| iot-service | 8006 | Code exists, NOT deployed |
| analytics-service | 8007 | Code exists, NOT deployed |
| pos-service | 8008 | Code exists, NOT deployed |
| coaching-service | 8009 | Code exists, NOT deployed |

**Current Reality:** The application is a **pure monolith** in production. The microservices folder is a future plan / architectural blueprint only.

**Concern:** The same business logic exists in *two places* — `backend/routes/` (monolith, active) and `microservices/*/` (planned, inactive). This creates confusion about which is the source of truth and risks code drift over time. **Recommendation:** Either remove the microservices folder until you're ready to migrate, or clearly mark it as deprecated/future-only to avoid confusion.

---

## 5. Feature Inventory

### Player Features
- Venue discovery with location-based search and city filtering
- Slot booking with calendar view and real-time availability
- Matchmaking (find opponents, suggest balanced teams)
- Tournament browsing, registration, and bracket viewing
- Coach discovery and session booking
- Glicko-2 skill rating system with leaderboard
- Performance tracking and training logs
- Social feed (posts, stories, likes, comments, follows)
- Encrypted DM chat (AES-256-GCM)
- Community groups and team creation
- Video highlights with AI analysis (Gemini)
- Split payment (2–22 players)
- Player card with shareable stats
- Contact sync for finding friends

### Venue Owner Features
- Venue creation and management with image uploads
- Slot management with dynamic pricing
- QR code generation for public venue pages
- Real-time booking notifications (WebSocket)
- Booking analytics and revenue dashboard
- Point of Sale (POS) system with offline-first support
- IoT smart lighting control via MQTT
- Staff management

### Coach Features
- Profile creation and discovery listing
- Session scheduling and management
- Package creation (monthly, per-session)
- Subscription management with dunning
- Organization/academy management

### Admin Features
- User management (approve, suspend, delete)
- Venue approval workflow
- Platform settings (payment gateway, S3, commission rates)
- SaaS subscription plan management
- Analytics dashboard
- Contact form message management

### Compliance & Legal
- DPDP (Digital Personal Data Protection) compliance
- Consent management (Essential, Analytics, Marketing, Location)
- One-click data export
- Account deletion with data anonymization
- Privacy Policy, Terms of Service, Refund Policy pages

---

## 6. Security Assessment

### Authentication & Authorization

| Check | Status | Notes |
|-------|--------|-------|
| JWT implementation | ✅ Good | 2-hour access tokens, 7-day refresh tokens |
| Password hashing | ✅ Good | bcrypt with 12 rounds |
| Password strength validation | ✅ Good | 8+ chars, uppercase, lowercase, digit required |
| Refresh token type checking | ✅ Good | Prevents token confusion attacks |
| Account status validation | ✅ Good | Suspended/deleted accounts rejected |
| Admin endpoint guards | ✅ Good | `require_admin()` dependency consistently applied |
| Seed endpoint production guard | ✅ Good | Disabled when ENVIRONMENT=production |
| JWT secret fallback | ❌ Critical | REFRESH_SECRET auto-generates if missing — breaks on restart |
| Booking endpoint auth | ❌ Critical | `/api/bookings/{booking_id}` has NO authentication |

### Encryption

| Feature | Implementation |
|---------|---------------|
| Chat messages | AES-256-GCM with per-conversation derived keys |
| File uploads | S3 server-side encryption |
| Passwords | bcrypt with salt |
| Data in transit | TLS 1.2+ via Nginx |

### Payment Security

| Check | Status | Notes |
|-------|--------|-------|
| Razorpay HMAC signature verification | ✅ Good | SHA-256 timing-safe comparison |
| Atomic split payment operations | ✅ Good | `find_one_and_update` prevents races |
| Payment verification bypass | ❌ Medium | Skips verification if key_secret is empty |
| Anonymous payers | ❌ Medium | Split payment allows "Anonymous" without identity |

### Input Validation

| Check | Status | Notes |
|-------|--------|-------|
| Pydantic model validation | ✅ Good | All inputs typed and validated |
| MongoDB query escaping | ✅ Good | `re.escape()` on user-provided regex |
| Contact form length limits | ✅ Good | 100/254/200/5000 char limits |
| Email regex validation | ✅ Good | Pattern validation on inputs |
| No eval/exec patterns | ✅ Good | No dynamic code execution found |
| Arbitrary dict fields | ⚠️ Minor | Some models accept unvalidated `dict` types |

### Infrastructure Security

| Check | Status | Notes |
|-------|--------|-------|
| HSTS | ✅ Good | 1-year max-age |
| X-Frame-Options | ✅ Good | DENY |
| X-Content-Type-Options | ✅ Good | nosniff |
| X-XSS-Protection | ✅ Good | 1; mode=block |
| CSP | ✅ Good | Basic implementation |
| Referrer-Policy | ✅ Good | strict-origin-when-cross-origin |
| Rate limiting (Nginx) | ✅ Good | 5r/s auth, 30r/s API |
| App-level rate limiting | ❌ Missing | Contact form, payment endpoints unprotected |
| CAPTCHA | ❌ Missing | No bot protection on forms |

---

## 7. Code Quality Analysis

### Backend Code Quality

**Strengths:**
- Clean, readable Python with proper async/await patterns
- Good separation of concerns (routes / auth / models / database / services)
- Consistent use of Pydantic for request/response validation
- Proper use of MongoDB atomic operations for race conditions
- 76 logging statements across route files showing awareness

**Weaknesses:**
- No structured (JSON) logging — uses basic Python string formatting
- Generic HTTPException responses without request correlation IDs
- Some try/except blocks silently swallow errors
- Redis connection failures log warnings but don't alert
- No graceful shutdown signal handling

### Frontend Code Quality

**Strengths:**
- React 19 with modern patterns (hooks, context, functional components)
- Consistent use of Tailwind CSS design system
- ErrorBoundary component catches render errors
- Loading states implemented across pages
- Auto token refresh on 401 responses

**Weaknesses:**
- ErrorBoundary doesn't report errors to backend
- No centralized error logging service
- localStorage for tokens (XSS risk, but necessary for SPA)

### Code Metrics

| Metric | Value |
|--------|-------|
| Backend Python LOC | ~19,976 |
| Backend dependencies | 131 |
| Frontend dependencies | 60+ |
| Backend route modules | 27 |
| Logging statements | 76 |
| TODO/FIXME comments | 0 (unusually clean) |

---

## 8. Testing Assessment

### Current State

| Metric | Value |
|--------|-------|
| Test files | 20 |
| Test LOC | ~16,500 |
| Test type | Integration / E2E |
| Framework | pytest 9.0.2 |

### What's Tested

- Redis slot locking and double-booking prevention
- Booking flow end-to-end (create → confirm → cancel)
- Payment flow with mock Razorpay
- Split payment with atomic operations
- Admin approval/rejection workflows
- Status transitions (payment_pending → confirmed)

### What's NOT Tested

| Gap | Risk Level |
|-----|-----------|
| Unit tests for auth logic (password hashing, token generation) | High |
| Unit tests for Glicko-2 rating calculation | Medium |
| Unit tests for AES-256-GCM encryption/decryption | High |
| Security tests (CORS validation, auth bypass, NoSQL injection) | High |
| Load/stress tests for concurrent bookings | High |
| Frontend component tests | Medium |
| API contract tests | Medium |
| WebSocket connection tests | Medium |

### Test Infrastructure Gaps

- No CI/CD pipeline (no GitHub Actions or equivalent)
- No automated test execution on push/PR
- No code coverage reporting
- Test fixtures depend on seed data existing

---

## 9. Deployment & Infrastructure

### Docker Architecture

| Service | Image | Port | Health Check |
|---------|-------|------|-------------|
| mongodb | mongo:7 | internal | mongosh ping |
| redis | redis:7-alpine | internal | redis-cli ping |
| backend | FastAPI (custom build) | 8000 | `/api/health` |
| frontend | React (custom build) | 80 | depends_on |
| nginx | nginx:alpine | 80, 443 | implicit |
| certbot | certbot/certbot | — | cron (12h) |

### Deployment Automation

- `deploy.sh`: 250+ line automated deployment script
  1. Prerequisite checks (Docker, Docker Compose)
  2. Environment configuration (auto-generates secure secrets)
  3. SSL certificate provisioning (Let's Encrypt)
  4. Docker Compose deployment
  5. Service health verification
  6. Post-deployment summary

### SSL/TLS Configuration

- Let's Encrypt with Certbot
- Automated renewal every 12 hours
- TLS 1.2 and 1.3 support
- Modern ECDHE-based cipher suites

### Persistent Volumes

| Volume | Purpose |
|--------|---------|
| mongo_data | Database persistence |
| uploads_data | User-uploaded files |
| certbot_www | ACME challenge files |
| certbot_certs | SSL certificates |

### Environment Management

- `.env.production.example` provided (42 variables)
- `.env` files in `.gitignore`
- Secrets generated via `openssl rand -hex 32`
- No secrets management tool (Vault, AWS Secrets Manager)

---

## 10. Observability & Monitoring

### Current State: **MINIMAL**

| Capability | Status |
|-----------|--------|
| Application logging | ✅ Basic (Python logging module) |
| Structured (JSON) logging | ❌ Missing |
| Request correlation IDs | ❌ Missing |
| Distributed tracing | ❌ Missing |
| Metrics collection (Prometheus/Datadog) | ❌ Missing |
| Error tracking (Sentry) | ❌ Missing |
| APM (Application Performance Monitoring) | ❌ Missing |
| Alerting | ❌ Missing |
| Log aggregation | ❌ Missing |
| Health check endpoint | ✅ Present (shallow) |
| Uptime monitoring | ❌ Missing |

**Impact:** In production, the team will be **flying blind**. Debugging issues will require SSH-ing into containers and tailing raw log files. No way to proactively detect issues before users report them.

---

## 11. Scalability Readiness

### Current Limitations

| Concern | Detail |
|---------|--------|
| Single MongoDB instance | No replica set — one crash = full outage |
| Single Redis instance | No Redis Sentinel or Cluster |
| No horizontal scaling | Single backend instance, no load balancer |
| No database indexes visible | Queries will degrade with data growth |
| No connection pooling config | Default MongoDB driver pooling only |
| No CDN | Static assets served from origin |
| No database migration strategy | Schema changes could break existing data |
| No API versioning | All endpoints under `/api/` with no version prefix |

### What's Prepared

| Positive | Detail |
|----------|--------|
| Microservices planned | 9 services exist as code but NOT deployed — future blueprint only |
| Docker Compose | Easy to add services when ready |
| Redis slot locking | Designed for distributed operation |
| Async FastAPI | Non-blocking I/O handles concurrent requests well |
| Stateless JWT auth | No server-side session state to manage |

---

## 12. Critical Issues — Must Fix

### Issue #1: Unauthenticated Booking Endpoint

- **Endpoint:** `GET /api/bookings/{booking_id}`
- **Severity:** CRITICAL
- **Impact:** Any unauthenticated user can read any booking by ID, exposing payment details, user information, and booking metadata
- **Fix:** Add `current_user = Depends(get_current_user)` and verify ownership or admin role

### Issue #2: JWT Secret Fallback on Restart

- **Location:** `backend/auth.py` line 13
- **Severity:** HIGH
- **Impact:** `REFRESH_SECRET` auto-generates if env var is missing. On every restart, a new secret is generated, invalidating all existing refresh tokens. With multiple instances, each gets a different secret.
- **Fix:** Require explicit `JWT_SECRET` and `REFRESH_SECRET` in production; fail loudly on startup if missing

### Issue #3: No App-Level Rate Limiting

- **Affected Endpoints:** Contact form, payment verification, auth endpoints
- **Severity:** HIGH
- **Impact:** While Nginx provides global rate limiting, specific high-risk endpoints need stricter per-user rate limits. Contact form can be spammed without CAPTCHA.
- **Fix:** Add `slowapi` or custom rate limiter; add CAPTCHA to public forms

### Issue #4: Optional Payment Verification

- **Location:** `backend/routes/bookings.py` lines 169–175
- **Severity:** MEDIUM
- **Impact:** If `key_secret` is empty, Razorpay signature verification is skipped entirely. A configuration error could allow forged payment confirmations.
- **Fix:** Fail hard if payment gateway credentials are missing when payment verification is attempted

### Issue #5: Anonymous Split Payments

- **Location:** `backend/routes/bookings.py` line 361
- **Severity:** MEDIUM
- **Impact:** Split payment allows "Anonymous" payers with no identity verification, enabling potential fraud
- **Fix:** Require authenticated user identity for all payment operations

---

## 13. Non-Critical Weaknesses

| # | Area | Issue | Impact |
|---|------|-------|--------|
| 1 | Logging | No structured JSON logs | Hard to search/filter in production |
| 2 | Logging | No request correlation IDs | Can't trace requests across services |
| 3 | Error Handling | Generic HTTPException messages | Poor debugging experience |
| 4 | Error Handling | Silent Redis failure fallback | Slot locking silently disabled |
| 5 | Database | No visible index definitions | Performance degrades with scale |
| 6 | Database | No backup strategy | Data loss risk |
| 7 | Frontend | ErrorBoundary doesn't report to backend | Silent frontend crashes |
| 8 | Frontend | No error logging service | Invisible JavaScript errors |
| 9 | Config | CORS origins not validated | Misconfiguration goes undetected |
| 10 | Config | MONGO_URL defaults to localhost | Silent wrong-database connections |
| 11 | Security | Seed file hardcoded passwords | In git history permanently |
| 12 | Security | Slot lock exposes user IDs without auth | Information disclosure |
| 13 | Architecture | Monolith + microservices duplication | Double maintenance burden |

---

## 14. What's Missing for Production

| Missing Piece | Priority | Impact |
|---------------|----------|--------|
| Error Tracking (Sentry) | P0 | Can't diagnose production crashes |
| Structured Logging (JSON) | P0 | Can't search/analyze logs |
| CI/CD Pipeline | P1 | No automated testing on push |
| Database Indexes | P1 | Performance will degrade |
| Database Backups | P1 | Unrecoverable data loss risk |
| Load/Stress Testing | P1 | Core booking feature untested under load |
| Unit Tests (auth, crypto, ratings) | P1 | Core logic unverified in isolation |
| API Versioning (`/api/v1/`) | P2 | Breaking changes affect all clients |
| Metrics & Alerting | P2 | No proactive issue detection |
| CDN for Static Assets | P2 | Slower load times, higher origin load |
| Database Replica Set | P2 | Single point of failure |
| Secrets Management (Vault) | P2 | Plain env vars are risky at scale |
| API Documentation (Swagger exposed) | P3 | FastAPI auto-generates but not confirmed exposed |
| Graceful Shutdown Handling | P3 | Requests dropped on deploy |

---

## 15. Strengths

| Strength | Detail |
|----------|--------|
| **Feature Completeness** | Rivals apps built by funded teams over years |
| **Modern Stack** | FastAPI + React 19 + MongoDB + Redis is well-suited for this use case |
| **Input Validation** | Pydantic throughout, MongoDB queries properly escaped |
| **Payment Flow** | Razorpay HMAC verification, atomic split payments, Redis slot locking |
| **Real-time Features** | WebSocket for chat, live scoring, and venue updates |
| **Deployment Infrastructure** | Docker Compose, Nginx SSL, automated deploy script |
| **Security Headers** | HSTS, CSP, X-Frame-Options, rate limiting all configured |
| **Compliance** | DPDP compliance with consent, data export, deletion |
| **Design System** | Consistent athletic dark theme, well-documented in design_guidelines.json |
| **AI Integration** | Gemini-powered video highlight analysis, ML-based pricing |
| **IoT Integration** | MQTT-based smart lighting control for venues |
| **Offline-First POS** | localStorage queue with batch sync for venue point-of-sale |
| **Code Organization** | Clean separation of concerns across the codebase |
| **Product Documentation** | 1,055-line Product Bible with comprehensive specs |

---

## 16. Final Scorecard

| Category | Score | Details |
|----------|-------|---------|
| Feature Completeness | **9 / 10** | Exceptionally comprehensive for an MVP |
| Code Quality | **7 / 10** | Clean and readable, minor gaps in error handling |
| Security | **6 / 10** | Good basics, but critical auth gap and payment bypass risk |
| Testing | **5 / 10** | Integration tests exist, but no unit/security/load tests |
| Deployment | **8 / 10** | Docker + Nginx + SSL + automation is solid |
| Observability | **4 / 10** | Basic logging only — no metrics, tracing, or alerting |
| Scalability | **5 / 10** | Single instances, no indexes, but microservices prepared |
| Documentation | **8 / 10** | Product Bible and design guidelines are excellent |
| Compliance | **8 / 10** | DPDP compliant with full consent management |
| **OVERALL** | **6.5 / 10** | **Strong MVP, not yet production-hardened** |

---

## 17. Recommendations & Roadmap

### Phase 1: Critical Fixes (Before Any Launch)

- [ ] Add authentication to `/api/bookings/{booking_id}` endpoint
- [ ] Remove JWT secret fallbacks; fail on startup if secrets missing
- [ ] Make payment verification mandatory (fail if credentials missing)
- [ ] Require authenticated users for all payment operations
- [ ] Add CAPTCHA to contact form

### Phase 2: Hardening (Before Public Launch)

- [ ] Integrate Sentry for error tracking (backend + frontend)
- [ ] Switch to structured JSON logging with correlation IDs
- [ ] Add MongoDB indexes for all query patterns
- [ ] Set up automated database backups (daily)
- [ ] Add app-level rate limiting with `slowapi`
- [ ] Write unit tests for auth, encryption, and Glicko-2 logic
- [ ] Set up CI/CD pipeline (GitHub Actions)
- [ ] Add API versioning (`/api/v1/`)

### Phase 3: Scale Preparation (Before Growth)

- [ ] Configure MongoDB replica set (minimum 3 nodes)
- [ ] Set up Redis Sentinel or Cluster
- [ ] Add Prometheus metrics + Grafana dashboards
- [ ] Implement CDN for static assets
- [ ] Run load tests on booking flow (target: 100 concurrent bookings)
- [ ] Clean up unused microservices folder (remove or clearly mark as future-only blueprint)
- [ ] Implement secrets management (HashiCorp Vault or AWS Secrets Manager)
- [ ] Add graceful shutdown handling for zero-downtime deploys

### Phase 4: Maturity (Ongoing)

- [ ] Security penetration testing by third party
- [ ] OWASP Top 10 audit
- [ ] Performance profiling and optimization
- [ ] Disaster recovery testing
- [ ] SLA monitoring and reporting

---

## Appendix A: File Structure Overview

```
LOBBI/
├── backend/                     # FastAPI production monolith
│   ├── server.py                # App initialization (182 lines)
│   ├── auth.py                  # JWT + bcrypt (124 lines)
│   ├── database.py              # MongoDB + Redis init (50 lines)
│   ├── models.py                # Pydantic schemas (214 lines)
│   ├── encryption.py            # AES-256-GCM chat encryption (72 lines)
│   ├── glicko2.py               # Skill rating algorithm (271 lines)
│   ├── mqtt_service.py          # IoT device control (177 lines)
│   ├── push_service.py          # Push notifications (107 lines)
│   ├── s3_service.py            # AWS S3 uploads (88 lines)
│   ├── seed.py                  # Demo data generation (1,500 lines)
│   ├── requirements.txt         # 131 dependencies
│   ├── Dockerfile
│   └── routes/                  # 27 route modules (~8,500 lines)
│       ├── auth.py, venues.py, bookings.py, matchmaking.py
│       ├── tournaments.py, coaching.py, social.py, communities.py
│       ├── live_scoring.py, ratings.py, performance.py, iot.py
│       ├── pos.py, notifications.py, admin.py, analytics.py
│       ├── reviews.py, highlights.py, pricing_ml.py
│       ├── recommendations.py, waitlist.py, compliance.py
│       ├── subscriptions.py, academies.py, organizations.py
│       └── training.py
├── frontend/                    # React 19 SPA
│   ├── src/
│   │   ├── App.js               # Router + layout
│   │   ├── pages/               # 38 page components
│   │   ├── components/ui/       # Radix + Shadcn library
│   │   ├── contexts/            # Auth, Theme, WebSocket
│   │   ├── hooks/               # Custom React hooks
│   │   └── lib/                 # API client, utilities
│   ├── tailwind.config.js
│   ├── package.json
│   └── Dockerfile
├── mobile/player-app/           # React Native (Expo)
├── microservices/               # 9 pre-built services
│   ├── auth-service/            # Port 8001
│   ├── venue-service/           # Port 8002
│   ├── booking-service/         # Port 8003
│   ├── social-service/          # Port 8004
│   ├── notification-service/    # Port 8005
│   ├── iot-service/             # Port 8006
│   ├── analytics-service/       # Port 8007
│   ├── pos-service/             # Port 8008
│   ├── coaching-service/        # Port 8009
│   ├── gateway/                 # API Gateway
│   └── shared/                  # Shared utilities
├── nginx/                       # Reverse proxy config
├── scripts/                     # Deployment utilities
├── tests/                       # Test suite
├── docker-compose.prod.yml      # Production orchestration
├── deploy.sh                    # Automated deployment
├── LOBBI-Product-Bible.md       # Product documentation
├── design_guidelines.json       # Design system
└── README.md
```

## Appendix B: Environment Variables (Production)

| Variable | Purpose | Required |
|----------|---------|----------|
| DOMAIN | Production domain (lobbi.in) | Yes |
| EMAIL | Admin email for SSL certs | Yes |
| MONGO_URL | MongoDB connection string | Yes |
| DB_NAME | Database name | Yes |
| JWT_SECRET | Token signing secret | Yes |
| REFRESH_SECRET | Refresh token secret | Yes |
| CHAT_ENCRYPTION_KEY | AES-256 key for chat | Yes |
| RAZORPAY_KEY_ID | Payment gateway key | Yes |
| RAZORPAY_KEY_SECRET | Payment gateway secret | Yes |
| AWS_ACCESS_KEY_ID | S3 file storage | Optional |
| AWS_SECRET_ACCESS_KEY | S3 authentication | Optional |
| S3_BUCKET_NAME | S3 bucket | Optional |
| SMTP_HOST | Email server | Optional |
| SMTP_USER | Email username | Optional |
| SMTP_PASSWORD | Email password | Optional |
| MQTT_BROKER | IoT broker address | Optional |
| MQTT_PORT | IoT broker port | Optional |
| CORS_ORIGINS | Allowed origins (comma-separated) | Yes |
| ENVIRONMENT | "development" or "production" | Yes |

---

*This report was generated through comprehensive static analysis of 305 source files across the LOBBI codebase. It represents a point-in-time assessment and should be updated as issues are resolved.*
