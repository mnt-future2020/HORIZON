# Horizon - Sports Facility Operating System

## Original Problem Statement
Build "Horizon", a comprehensive Sports Facility Operating System / "Super App" for the amateur sports ecosystem in India.

## Core Requirements
- **Phase 1**: Venue POS, Basic Booking App with Static Pricing, IoT Lighting (Alpha)
- **Phase 2**: Split Payments, Rule-Based Dynamic Pricing, Mercenary Marketplace
- **Phase 3**: AI-Driven Matchmaking, Automated Video Highlights

## User Personas
- **Player**: Books venues, joins matches, pays
- **Venue Owner**: Manages venues, views analytics, sets pricing
- **Coach**: Manages academies, tracks students

## Tech Stack
- **Backend**: FastAPI, MongoDB (Motor), Redis, JWT Auth
- **Frontend**: React, Tailwind CSS, shadcn/ui, Framer Motion
- **Architecture**: Full-stack monolith (React SPA + FastAPI backend)

## What's Been Implemented

### Phase 1 - Foundation (COMPLETE)
- JWT Authentication (3 roles: player, venue_owner, coach)
- Venue CRUD, discovery, search/filter
- Calendar-based slot booking with dynamic pricing
- Redis-based slot locking (soft 10min, hard 30min) for concurrency
- Split payment flow (MOCKED Razorpay)
- Matchmaking & Mercenary marketplace
- Coach Academy management
- Venue & Player analytics dashboards
- Dark "Midnight Stadium" themed UI
- Seeded demo data

### Notify Me When Available (COMPLETE - Feb 15, 2026)
- "Notify Me" button on booked/on-hold slots in VenueDetail
- In-app notification system (bell icon in Navbar with unread count)
- Notification panel with mark-all-read functionality
- Auto-notification when booking is cancelled (subscribers get notified)
- Subscribe/unsubscribe toggle on slot level
- Backend: `notification_subscriptions` + `notifications` MongoDB collections
- Polling every 10s for unread count

## DB Collections
- `users`, `venues`, `bookings`, `split_payments`, `pricing_rules`
- `match_requests`, `mercenary_posts`, `academies`
- `notifications`, `notification_subscriptions` (NEW)

## Key API Endpoints
- `/api/auth/{register,login,me,profile}`
- `/api/venues`, `/api/venues/{id}`, `/api/venues/{id}/slots`
- `/api/bookings`, `/api/bookings/{id}/cancel`
- `/api/slots/{lock,unlock,extend-lock,my-locks,lock-status}`
- `/api/notifications/{subscribe,list,unread-count,read,read-all,subscriptions}` (NEW)
- `/api/matchmaking`, `/api/mercenary`, `/api/academies`
- `/api/analytics/{venue,player}`

## Test Credentials
- Player: `demo@player.com` / `demo123`
- Owner: `demo@owner.com` / `demo123`
- Coach: `demo@coach.com` / `demo123`

## Mocked Integrations
- **Razorpay**: Payment processing is simulated (no real transactions)

## Prioritized Backlog

### P0 - Next Up
- Real Razorpay payment integration (replace mocked payments)

### P1
- Split & Pay financial engine (Phase 2)
- Rule-based dynamic pricing engine for venue owners

### P2
- "Mercenary" Marketplace (find fill-in players)
- AI-driven matchmaking (Glicko-2 skill rating)
- Automated video highlights (IP camera integration)
- IoT smart lighting integration
- Offline-first POS system

## Refactoring Needs
- `backend/server.py` is 1100+ lines - should be modularized into route files
