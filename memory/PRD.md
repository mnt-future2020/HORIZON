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
- Venue Owner approval flow (pending -> approved)

### Razorpay Payment Integration (COMPLETE - Feb 15)
- Dynamic gateway from admin Settings, checkout when configured, mock fallback

### SaaS Subscription Plans (COMPLETE - Feb 15)
- Free/Basic/Pro plans with venue limits enforced

### Split & Pay + Dynamic Pricing (COMPLETE - Feb 15)
- Host creates split -> share link -> friends pay -> auto-confirm
- Rule-based pricing: weekend surge, peak hours, early bird

### Mercenary Marketplace (COMPLETE - Feb 16)
- Linked to bookings, apply/accept/reject/pay flow, Razorpay + mock

### Backend Modularization (COMPLETE - Feb 16)
- 1833-line monolith -> 14 modular files, server.py now 58 lines

### AI-Driven Matchmaking with Glicko-2 (COMPLETE - Feb 16)
- **Glicko-2 Rating System**: Full algorithm (rating, deviation, volatility) updates after confirmed match results
- **Match Result Flow**: Any player submits result -> others confirm (majority rule) -> ratings auto-update
- **Recommended Matches**: "For You" tab shows matches sorted by skill compatibility (0-100% score)
- **Auto-Match**: One-click find best available match for player's skill level + sport
- **Team Suggestion**: AI-balanced team splits using serpentine draft by rating
- **Leaderboard**: `/leaderboard` page with tier badges (Diamond/Gold/Silver/Bronze), sport filter, W/L/D records
- **Rating Notifications**: Players get notified of rating changes after each confirmed match

## Architecture
```
backend/
  server.py          # 58 lines - FastAPI app init + router includes
  database.py        # MongoDB & Redis connections, lock helpers
  models.py          # All Pydantic models
  auth.py            # JWT auth, password hashing, Razorpay client
  seed.py            # Demo data seeding
  glicko2.py         # Glicko-2 algorithm + compatibility + team balancing
  routes/
    auth.py          # Register, Login, Profile
    venues.py        # Venue CRUD, Slots, Locks, Pricing Rules
    bookings.py      # Bookings, Payments, Split Pay
    matchmaking.py   # Matchmaking, Mercenary, Leaderboard, Results
    notifications.py # Notifications + Subscriptions
    admin.py         # Admin Dashboard + Subscription Management
    academies.py     # Coach Academies
    analytics.py     # Venue & Player Analytics
```

## DB Collections
users, venues, bookings, split_payments, pricing_rules, match_requests, mercenary_posts, academies, notifications, notification_subscriptions, platform_settings

## Test Credentials
Admin: admin@horizon.com/admin123 | Player: demo@player.com/demo123 | Owner: demo@owner.com/demo123 | Coach: demo@coach.com/demo123

## Mocked: Razorpay (SDK wired, mock fallback when no keys)

## Remaining Backlog
- **P1**: Fix mobile responsiveness (nav truncation, small screen layouts)
- **P2**: Rule-based dynamic pricing engine for venue owners
- **P3**: Automated video highlights, IoT lighting, Offline POS
