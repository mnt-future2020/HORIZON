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
- Dynamic gateway from admin Settings
- Razorpay checkout when configured, mock fallback when not
- Commission tracking per booking

### SaaS Subscription Plans (COMPLETE - Feb 15)
- Free/Basic/Pro plans with venue limits enforced
- Plan tab in owner dashboard, admin can set plans

### Split & Pay Engine (COMPLETE - Feb 15)
- Host creates split -> share link -> friends pay individually -> auto-confirm

### Dynamic Pricing (COMPLETE - Feb 15)
- Rule-based: weekend surge, peak hours, early bird, custom ranges

### Mercenary Marketplace (COMPLETE - Feb 16)
- Linked to bookings, full apply/accept/reject/pay flow
- Razorpay integration with mock fallback
- Notifications for all mercenary events

### Backend Modularization (COMPLETE - Feb 16)
- Refactored 1833-line monolithic server.py into 14 modular files
- server.py: 58 lines (slim entrypoint)
- Modules: database.py, models.py, auth.py, seed.py
- Routes: auth, venues, bookings, matchmaking, notifications, admin, academies, analytics
- 100% test pass rate (38 backend + all frontend flows verified)

## Architecture
```
backend/
  server.py          # 58 lines - FastAPI app init, router includes, startup/shutdown
  database.py        # MongoDB & Redis connections, lock helpers
  models.py          # All Pydantic models
  auth.py            # JWT auth, password hashing, Razorpay client, platform settings
  seed.py            # Demo data seeding
  routes/
    auth.py          # Register, Login, Profile
    venues.py        # Venue CRUD, Slots, Locks, Pricing Rules
    bookings.py      # Bookings, Payments, Split Pay
    matchmaking.py   # Matchmaking + Mercenary Marketplace
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
- **P2**: AI-driven matchmaking (Glicko-2 skill rating)
- **P3**: Automated video highlights, IoT lighting, Offline POS
