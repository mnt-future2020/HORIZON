# Horizon - Sports Facility Operating System

## Original Problem Statement
Build "Horizon", a comprehensive Sports Facility Operating System / "Super App" for the amateur sports ecosystem in India.

## Core Requirements
- **Phase 1**: Venue POS, Basic Booking App with Static Pricing, IoT Lighting (Alpha)
- **Phase 2**: Split Payments, Rule-Based Dynamic Pricing, Mercenary Marketplace
- **Phase 3**: AI-Driven Matchmaking, Automated Video Highlights

## User Personas
- **Player**: Books venues, joins matches, pays
- **Venue Owner**: Manages venues, views analytics, sets pricing (requires admin approval)
- **Coach**: Manages academies, tracks students
- **Super Admin**: Platform management, user approvals, settings, revenue tracking

## Tech Stack
- **Backend**: FastAPI, MongoDB (Motor), Redis, JWT Auth
- **Frontend**: React, Tailwind CSS, shadcn/ui, Framer Motion
- **Architecture**: Full-stack monolith (React SPA + FastAPI backend)

## What's Been Implemented

### Phase 1 - Foundation (COMPLETE)
- JWT Authentication (4 roles: player, venue_owner, coach, super_admin)
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
- "Notify Me" button on booked/on-hold slots
- In-app notification system (bell icon with unread count)
- Auto-notification when booking cancelled

### Super Admin System (COMPLETE - Feb 15, 2026)
- **Super Admin Dashboard** with 4 tabs: Overview, Users, Venues, Settings
- **Overview**: Platform stats (users, venues, bookings, revenue, commission, earnings, pending approvals)
- **Users**: Role/status filters, Approve/Reject/Suspend/Activate venue owners
- **Venues**: List all venues with suspend/activate toggle
- **Settings**:
  - Payment Gateway (Razorpay key_id, key_secret, test/live mode) - dynamic
  - Booking Commission (editable percentage)
  - SaaS Subscription Plans (Free/Basic/Pro with editable price, max_venues, features)
  - Change Admin Password
- **Venue Owner Approval Flow**: Venue owners register → pending → admin approves → active
- Pending owners see "Account Pending Approval" screen
- Approval/rejection triggers in-app notification to venue owner

## DB Collections
- `users` (with `account_status`, `business_name`, `gst_number`)
- `venues`, `bookings`, `split_payments`, `pricing_rules`
- `match_requests`, `mercenary_posts`, `academies`
- `notifications`, `notification_subscriptions`
- `platform_settings` (key="platform": payment gateway, commission, plans)

## Key API Endpoints
- `/api/auth/{register,login,me,profile}`
- `/api/venues`, `/api/venues/{id}`, `/api/venues/{id}/slots`
- `/api/bookings`, `/api/bookings/{id}/cancel`
- `/api/slots/{lock,unlock,extend-lock,my-locks,lock-status}`
- `/api/notifications/*`
- `/api/admin/{dashboard,users,venues,settings,change-password}` (NEW)
- `/api/matchmaking`, `/api/mercenary`, `/api/academies`
- `/api/analytics/{venue,player}`

## Test Credentials
- **Admin**: `admin@horizon.com` / `admin123`
- **Player**: `demo@player.com` / `demo123`
- **Owner**: `demo@owner.com` / `demo123`
- **Coach**: `demo@coach.com` / `demo123`

## Mocked Integrations
- **Razorpay**: Payment processing is simulated. Credentials can be saved in admin settings but not used for live transactions yet.

## Prioritized Backlog

### P0 - Next Up
- Real Razorpay payment integration using admin-saved credentials
- Connect SaaS subscription plans to venue owner accounts

### P1
- Split & Pay financial engine (Phase 2)
- Rule-based dynamic pricing engine for venue owners

### P2
- "Mercenary" Marketplace (find fill-in players)
- AI-driven matchmaking (Glicko-2 skill rating)
- Automated video highlights, IoT integration, Offline POS

## Refactoring Needs
- `backend/server.py` is 1300+ lines - should be modularized into route files
