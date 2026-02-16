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

### Mobile Responsiveness Fix (COMPLETE - Feb 16)
- Bottom nav: tighter spacing (w-14, text-[9px]) prevents truncation on 375px screens
- VenueOwnerDashboard: bookings tab uses card layout instead of table for mobile
- All tabs use flex-wrap for mobile-safe wrapping
- Stat cards, pricing rule cards, plan cards responsive with sm: breakpoints

### Rule-Based Dynamic Pricing (COMPLETE - Feb 16)
- **Full CRUD** for pricing rules: Create, Read, Update, Delete
- **Day-of-week selector**: Toggle buttons (Sun-Sat) for targeted pricing
- **Time range**: Start/end time inputs for peak/off-peak hours
- **Action types**: Multiplier (e.g., 1.5x surge) or Discount (e.g., 15% off)
- **Toggle active/inactive**: Switch component per rule
- **Live price preview**: Shows base price -> effective price with diff badge
- **Color-coded cards**: Amber border for surcharge, emerald for discount
- **Backend endpoints**: PUT /pricing-rules/{id}, PUT /pricing-rules/{id}/toggle

### AI Video Highlights (COMPLETE - Feb 16)
- **Video Upload**: Drag & drop or browse, up to 100MB, progress bar
- **AI Analysis**: Gemini 2.5 Flash analyzes match videos via Emergent LLM key
- **Key Moments**: Auto-detected with timestamps, descriptions, and significance badges
- **Match Summary**: Sport detection, duration, intensity, player count
- **Shareable Links**: Toggle public share with 8-char unique ID
- **Public Page**: /highlights/shared/{shareId} renders without auth
- **Multi-role**: Both players and venue owners can use
- **Backend**: Full CRUD + AI endpoints at /api/highlights/*
- **Frontend**: HighlightsPage.js + SharedHighlightPage.js + nav link

## Remaining Backlog
- **P3**: IoT lighting, Offline POS
