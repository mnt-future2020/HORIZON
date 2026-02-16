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
- Glicko-2 rating algorithm, Recommended matches, Auto-Match, AI team balancing
- Match result submission, Leaderboard with tier badges

### Tamper-Proof Rating History (COMPLETE - Feb 16)
- Blockchain-style SHA-256 chain hashing, GENESIS hash
- Rating Profile page, Chain Integrity panel, Verified Rating badge

### Mobile Responsiveness Fix (COMPLETE - Feb 16)
- Bottom nav, card layouts, flex-wrap, responsive breakpoints

### Rule-Based Dynamic Pricing (COMPLETE - Feb 16)
- Full CRUD, day-of-week selector, time range, multiplier/discount actions

### AI Video Highlights (COMPLETE - Feb 16)
- Video Upload, Gemini AI Analysis, Key Moments, Shareable Links

### IoT Smart Lighting (COMPLETE - Feb 16)
- Real MQTT Broker (broker.emqx.io), Device Simulator, WebSocket, Zone Management
- Auto-Scheduling, Energy Analytics, Device Control

### Booking Flow Fix - Mock Payment Two-Step (COMPLETE - Feb 16)
- **Problem**: Mock payments instantly confirmed bookings without any payment step
- **Fix**: Mock payments now create bookings as `payment_pending`, requiring explicit confirmation
- **New endpoint**: `POST /api/bookings/{id}/mock-confirm` for explicit mock payment confirmation
- **Frontend**: 3-step flow: Pay -> Review ("Awaiting Payment") -> Confirm Payment -> Booking Confirmed
- **Expiry**: All bookings now have `expires_at` (24h), with `POST /api/bookings/cleanup-expired` for stale ones
- **Redis**: Correctly uses SOFT_LOCK_TTL=600s (10min), HARD_LOCK_TTL=1800s (30min), graceful degradation when unavailable

### Venue Owner Dashboard Enhancement (COMPLETE - Feb 16)
- **Booking Detail View**: Click any booking card to open full detail dialog showing: status banner, venue/host info, date/time/turf/sport, payment info (amount, commission, mode, gateway, paid_at, payment_id), split payment progress bar, timeline timestamps, and cancel booking action
- **Booking Stats Bar**: Quick stats showing Total, Confirmed, Pending, Cancelled, Upcoming counts
- **Booking Filters**: Time filter (All Time/Upcoming/Past), status dropdown (All/Confirmed/Pending/Awaiting Pay/Cancelled/Expired), sort toggle (Newest/Oldest)
- **History Tab**: Chronological timeline grouped by date with day totals, booking count badges, color-coded status indicators, and clickable entries that open the same detail dialog

## Architecture
```
backend/
  server.py, database.py, models.py, auth.py, seed.py, glicko2.py, mqtt_service.py, device_simulator.py
  routes/ auth.py, venues.py, bookings.py, matchmaking.py,
          notifications.py, admin.py, academies.py, analytics.py, ratings.py, highlights.py, iot.py
```

## DB Collections
users, venues, bookings, split_payments, pricing_rules, match_requests, mercenary_posts, academies, notifications, notification_subscriptions, platform_settings, rating_history, iot_devices, video_highlights

## Test Credentials
Player: demo@player.com/demo123 | Owner: demo@owner.com/demo123 | Coach: demo@coach.com/demo123 | Admin: admin@horizon.com/admin123

## Mocked: Razorpay (SDK wired, mock fallback with two-step confirmation when no keys)

## Remaining Backlog
- **P3**: Offline-First POS system for venue amenities
