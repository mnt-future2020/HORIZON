# Horizon - Sports Facility Operating System

## Original Problem Statement
Build "Horizon", a Super App for the amateur sports ecosystem in India.

## User Personas
- **Player**: Books venues, joins matches, pays | **Venue Owner**: Manages venues (admin-approved) | **Coach**: Academies | **Super Admin**: Platform management

## Tech Stack
FastAPI + MongoDB + Redis + Razorpay SDK | React + Tailwind + shadcn/ui + Framer Motion

## Implemented Features

### Phase 1 - Foundation (COMPLETE)
- JWT Auth (4 roles), Venue CRUD/Discovery, Calendar booking, Redis slot locking
- Matchmaking, Coach Academy, Dark UI theme, Seeded demo data

### Notify Me (COMPLETE - Feb 15)
- Bell icon, in-app notifications, slot availability alerts on booking cancellation

### Super Admin System (COMPLETE - Feb 15)
- Admin Console (Overview, Users, Venues, Settings)
- Payment Gateway (dynamic Razorpay creds), Commission, SaaS Plans

### Razorpay + SaaS + Split Pay + Dynamic Pricing (COMPLETE - Feb 15)
- Live Razorpay checkout, mock fallback, commission tracking
- Free/Basic/Pro plans with venue limits, split pay flow, rule-based pricing

### Mercenary Marketplace (COMPLETE - Feb 16)
- Linked to bookings, apply/accept/reject/pay flow

### Backend Modularization (COMPLETE - Feb 16)
- 1833-line monolith -> 14 modular files, server.py now 58 lines

### AI-Driven Matchmaking with Glicko-2 (COMPLETE - Feb 16)
- Glicko-2 rating algorithm (rating, deviation, volatility)
- Recommended matches (compatibility scoring 0-100%), Auto-Match, AI team balancing
- Match result submission with majority-rule confirmation
- Leaderboard with tier badges, sport filter, clickable rows

### Tamper-Proof Rating History (COMPLETE - Feb 16)
- **Blockchain-style SHA-256 chain hashing** — Each rating change is a cryptographic record chained to the previous via prev_hash
- **GENESIS hash** as chain start; no manual edits possible
- **`/api/rating/verify/{userId}`** — Cryptographic verification of entire chain integrity
- **`/api/rating/certificate/{userId}`** — Shareable certificate with journey stats, peak/lowest, timeline
- **Rating Profile page** (`/profile`, `/profile/:userId}`) with:
  - Rating card (tier, RD, W/L/D), Canvas sparkline chart
  - Chain Integrity panel (status, fingerprint, Verify Now button)
  - Expandable match history showing SHA-256 hash, prev_hash, opponents, confirmations
  - Green "Verified Rating" badge when chain is intact
- **Leaderboard** rows clickable → navigate to player rating profiles

## Architecture
```
backend/
  server.py, database.py, models.py, auth.py, seed.py, glicko2.py
  routes/ auth.py, venues.py, bookings.py, matchmaking.py,
          notifications.py, admin.py, academies.py, analytics.py, ratings.py
```

## DB Collections
users, venues, bookings, split_payments, pricing_rules, match_requests, mercenary_posts, academies, notifications, notification_subscriptions, platform_settings, **rating_history**

## Test Credentials
Admin: admin@horizon.com/admin123 | Player: demo@player.com/demo123 | Owner: demo@owner.com/demo123 | Coach: demo@coach.com/demo123

## Mocked: Razorpay (SDK wired, mock fallback when no keys)

### Booking Flow Redis Graceful Degradation (COMPLETE - Feb 16)
- Frontend handles Redis 503/520 errors gracefully — only blocks on 409 (real conflict)
- Booking proceeds without slot locking when Redis is unavailable
- Lock extension conditionally skipped when no lock is held

## Remaining Backlog
- **P1**: Fix mobile responsiveness (nav truncation, small screen layouts)
- **P2**: Rule-based dynamic pricing UI for venue owners
- **P3**: Automated video highlights, IoT lighting, Offline POS
