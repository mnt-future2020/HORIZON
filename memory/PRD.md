# Horizon - Sports Facility Operating System PRD

## Original Problem Statement
Build "Horizon" - a comprehensive Sports Facility Operating System that serves as the digital backbone for the amateur sports ecosystem in India. Features include booking, split payments, AI matchmaking, dynamic pricing, IoT automation, and multi-role management.

## Architecture
- **Frontend**: React 18 + Tailwind CSS + Shadcn/UI + Framer Motion
- **Backend**: FastAPI (Python) + JWT Auth
- **Database**: MongoDB (users, venues, bookings, split_payments, pricing_rules, match_requests, mercenary_posts, academies)
- **Theme**: "Midnight Stadium" dark theme with Chivo + Manrope fonts

## User Personas
1. **Players (B2C)**: Book venues, split costs, find opponents via matchmaking, track skill ratings
2. **Venue Owners (B2B)**: Manage venues, set dynamic pricing rules, view analytics/revenue
3. **Coaches (SaaS)**: Run academies, manage students, track subscriptions

## Core Requirements (Static)
- JWT-based auth with 3 roles (player, venue_owner, coach)
- Venue discovery with search/filter by sport and location
- Booking engine with calendar-based slot selection
- Split payment system with shareable links
- Dynamic pricing rules (multiplier/discount based on day/time)
- Skill-based matchmaking (Glicko-2 inspired ratings)
- Mercenary marketplace (find replacement players)
- Coach academy management with student roster
- DPDP Act 2023 compliance framework

## What's Been Implemented (Feb 2026)
### Phase 1 - Full Implementation
- [x] JWT Authentication (register, login, profile management) for 3 roles
- [x] Venue CRUD with search/filter (4 seeded demo venues)
- [x] Dynamic slot generation with pricing rule application
- [x] Booking engine with full/split payment modes
- [x] Split payment system with shareable token links
- [x] Dynamic pricing rules (CRUD, rule-based: multiplier, discount)
- [x] Matchmaking system (create/join matches)
- [x] Mercenary marketplace (post/apply for player spots)
- [x] Coach academy management (create academy, add/remove students)
- [x] Venue owner dashboard (bookings table, pricing rules, analytics with charts)
- [x] Player dashboard (stats, upcoming bookings, quick actions)
- [x] Profile page (stats, edit profile, booking history)
- [x] Landing page with features showcase
- [x] Responsive design (desktop top nav + mobile bottom nav)
- [x] Auto-seeding demo data on first startup
- [x] Dark "Midnight Stadium" theme

### Phase 1.1 - Redis Slot Locking (Feb 2026)
- [x] Redis-based distributed slot locking (SETNX atomic lock acquisition)
- [x] Soft lock (10 min TTL) on slot selection, hard lock (30 min) on payment initiation
- [x] Concurrency protection: second user gets 409 "on hold" when trying to lock same slot
- [x] Slots API returns lock-aware statuses: available, booked, on_hold, locked_by_you
- [x] Lock released automatically on: booking confirmation, dialog close, TTL expiry, cancel
- [x] Frontend shows color-coded slot states (green=your lock, amber=on hold, red=booked)
- [x] Lock status banner in booking dialog
- [x] Auto-refresh slots every 15s for real-time lock visibility
- [x] Lock management endpoints (lock, unlock, extend, my-locks, status)

### MOCKED
- [x] Razorpay payments (full UX simulated, ready for real integration)

## Prioritized Backlog
### P0 (Critical)
- Real Razorpay integration when API keys are available
- WebSocket-based real-time slot locking
- Redis caching for slot availability

### P1 (High)
- IoT lighting automation (ESP32 MQTT integration)
- Offline-first POS for venue operators
- Push notifications for match invites
- Advanced Glicko-2 skill calculation with match results

### P2 (Medium)
- Video highlights integration (CCTV + FFmpeg)
- Geospatial venue search (drive-time based)
- Subscription management with dunning for coaches
- Review and rating system for venues
- Algorithmic (ML) dynamic pricing

### P3 (Low)
- Social login (Google OAuth)
- WhatsApp/SMS notifications
- Data export and compliance audit tools
- Multi-language support (Hindi, Tamil, etc.)

## Next Tasks
1. Integrate real Razorpay payment gateway
2. Add Redis-based slot locking for concurrency
3. Implement match result recording and ELO updates
4. Build IoT lighting control prototype
5. Add venue image upload functionality
