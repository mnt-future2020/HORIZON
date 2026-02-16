# Horizon - Sports Facility Operating System

## Original Problem Statement
Build "Horizon", a comprehensive Sports Facility Operating System / "Super App" for the amateur sports ecosystem in India.

## User Personas
- **Player**: Books venues, joins matches, pays
- **Venue Owner**: Manages venues, analytics, pricing (requires admin approval)
- **Coach**: Manages academies, tracks students
- **Super Admin**: Platform management, user approvals, settings, revenue tracking

## Tech Stack
- **Backend**: FastAPI, MongoDB (Motor), Redis, JWT Auth, Razorpay SDK
- **Frontend**: React, Tailwind CSS, shadcn/ui, Framer Motion
- **Architecture**: Full-stack monolith (React SPA + FastAPI backend)

## What's Been Implemented

### Phase 1 - Foundation (COMPLETE)
- JWT Auth (4 roles), Venue CRUD, Calendar booking, Redis slot locking
- Matchmaking, Mercenary marketplace, Coach Academy
- Dark "Midnight Stadium" theme, Seeded demo data

### Notify Me When Available (COMPLETE - Feb 15)
- "Notify Me" button on booked/on-hold slots, in-app notifications with bell icon

### Super Admin System (COMPLETE - Feb 15)
- Admin Console: Overview, Users (approve/reject/suspend), Venues, Settings
- Payment Gateway (dynamic Razorpay credentials), Booking Commission, SaaS Plans
- Venue Owner approval flow with pending status

### Razorpay Payment Integration (COMPLETE - Feb 15)
- Dynamic gateway: reads Razorpay key_id/key_secret from admin Settings (MongoDB)
- When gateway configured: creates Razorpay order → frontend opens checkout → verifies payment
- When no gateway: graceful mock fallback (auto-confirms)
- Commission tracking: booking_commission_pct of each booking goes to platform
- Frontend: Razorpay checkout script loaded dynamically

### SaaS Subscription Plans (COMPLETE - Feb 15)
- Three plans: Free (1 venue), Basic (3 venues, ₹2,999/mo), Pro (unlimited, ₹7,999/mo)
- Venue creation enforces plan limits
- Venue owner dashboard Plan tab: current plan, usage bar, upgrade/switch
- Admin can set/change user plans

### Split & Pay Engine (COMPLETE - Feb 15)
- Host creates split booking → generates share link → friends pay individually
- Each share creates Razorpay order (or mock) → verify payment per share
- Auto-confirms when all shares paid
- Real-time tracking of paid/remaining shares

### Dynamic Pricing (COMPLETE - Feb 15)
- Rule-based: weekend surge, peak hours, early bird, custom time ranges
- Price rules applied during booking with priority ordering
- Venue owner can manage rules from Pricing Rules tab

## DB Collections
- `users` (account_status, subscription_plan, business_name, gst_number)
- `venues`, `bookings` (payment_gateway, commission_amount, razorpay_order_id)
- `split_payments`, `pricing_rules`, `match_requests`, `mercenary_posts`, `academies`
- `notifications`, `notification_subscriptions`, `platform_settings`

## Key API Endpoints
- `/api/auth/*`, `/api/venues/*`, `/api/bookings/*`
- `/api/bookings/{id}/verify-payment`, `/api/payment/gateway-info`
- `/api/split/{token}/*`, `/api/split/{token}/verify-payment`
- `/api/subscription/my-plan`, `/api/subscription/upgrade`
- `/api/admin/*` (dashboard, users, venues, settings, set-plan)
- `/api/notifications/*`, `/api/slots/*`

## Test Credentials
- **Admin**: admin@horizon.com / admin123
- **Player**: demo@player.com / demo123
- **Owner**: demo@owner.com / demo123
- **Coach**: demo@coach.com / demo123

## Mocked
- **Razorpay**: SDK installed, flow wired. Falls back to mock when no admin-saved keys or when API rejects test keys. Provide real Razorpay keys in Admin Settings for live payments.

## Remaining Backlog
- **P2**: Mercenary Marketplace (find fill-in players)
- **P2**: AI-driven matchmaking (Glicko-2 rating)
- **P3**: Automated video highlights, IoT lighting, Offline POS

## Refactoring
- `backend/server.py` is 1500+ lines - should modularize into route files
