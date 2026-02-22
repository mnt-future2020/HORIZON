# LOBBI - Complete Product Bible

### The Ultimate Sports Community & Venue Management Platform

**Document Version:** 1.0 | **Last Updated:** February 2026
**Purpose:** This document is the single source of truth for every team at Lobbi — Marketing, Sales, Operations, Customer Support, and Product. Read this fully before starting your work.

---

## TABLE OF CONTENTS

1. [What is Lobbi?](#1-what-is-lobbi)
2. [Who Uses Lobbi? (User Roles)](#2-who-uses-lobbi)
3. [Platform Overview (Web + Mobile)](#3-platform-overview)
4. [PLAYER Features — Complete Guide](#4-player-features)
5. [VENUE OWNER Features — Complete Guide](#5-venue-owner-features)
6. [COACH Features — Complete Guide](#6-coach-features)
7. [ADMIN Features — Complete Guide](#7-admin-features)
8. [Revenue & Business Model](#8-revenue--business-model)
9. [Technology & Security](#9-technology--security)
10. [Key User Flows (Step-by-Step)](#10-key-user-flows)
11. [Marketing Team Guide](#11-marketing-team-guide)
12. [Sales Team Guide](#12-sales-team-guide)
13. [Operations Team Guide](#13-operations-team-guide)
14. [Customer Support Guide](#14-customer-support-guide)
15. [Glossary of Terms](#15-glossary-of-terms)

---

## 1. WHAT IS LOBBI?

Lobbi is India's first all-in-one sports platform that connects **Players**, **Venue Owners**, and **Coaches** in a single ecosystem. Think of it as **BookMyShow + Instagram + WhatsApp + Razorpay** — but built exclusively for sports.

### The Problem We Solve

| Problem | Who Faces It | How Lobbi Solves It |
|---------|-------------|-------------------|
| "I want to play but can't find a venue or players" | Players | Venue discovery + Matchmaking + Split payments |
| "I can't manage bookings, pricing, and payments efficiently" | Venue Owners | Smart booking engine + Dynamic pricing + Auto payments |
| "I can't find students or manage my coaching business" | Coaches | Coach marketplace + Session booking + Package subscriptions |
| "There's no sports community to connect with" | Everyone | Social feed + DM Chat + Groups + Teams + Tournaments |

### One-Line Pitch
> **"Book. Play. Connect. Compete."** — Lobbi is where India's sports community lives.

### Key Numbers (Platform Capabilities)
- **38 web pages** across 4 user roles
- **34 mobile screens** (iOS + Android)
- **200+ API endpoints** powering all features
- **9 microservices** ready for future scaling
- **4 user roles**: Player, Venue Owner, Coach, Super Admin

---

## 2. WHO USES LOBBI?

### 2.1 PLAYER (Primary User — 80% of users)

**Who they are:** Anyone who plays sports — weekend warriors, college students, fitness enthusiasts, amateur athletes.

**Why they use Lobbi:**
- Find and book sports venues near them
- Find players to play with (matchmaking)
- Hire a coach for private/group sessions
- Join tournaments and track their skill rating
- Connect with the sports community (feed, chat, groups)
- Track their performance and career stats

**Account Status:** Active immediately after registration.

### 2.2 VENUE OWNER (B2B User — Revenue Generator)

**Who they are:** Owners/managers of sports facilities — turf grounds, badminton courts, cricket nets, tennis clubs, multi-sport arenas.

**Why they use Lobbi:**
- Receive bookings online (no more phone calls)
- Dynamic pricing to maximize revenue
- Real-time analytics and revenue tracking
- IoT integration for smart lighting control
- POS system for on-ground sales (water, equipment rental)
- Manage reviews and reputation

**Account Status:** Requires admin approval before activation.

### 2.3 COACH (B2B User — Service Provider)

**Who they are:** Sports coaches, trainers, fitness instructors — freelance or academy-based.

**Why they use Lobbi:**
- Get discovered by players looking for coaching
- Manage sessions, availability, and payments
- Create monthly coaching packages
- Track student performance with training logs
- Run their own academy/organization
- Build their reputation via ratings and reviews

**Account Status:** Requires admin approval before activation.

### 2.4 SUPER ADMIN (Internal Team)

**Who they are:** Lobbi's internal operations team.

**What they do:**
- Approve/reject venue owner and coach registrations
- Monitor platform metrics (users, revenue, bookings)
- Manage platform settings (commission %, payment gateway)
- Suspend/activate users and venues
- Configure system features

---

## 3. PLATFORM OVERVIEW

### 3.1 Web Application (React)
- **URL:** lobbi.in
- **38 pages** with role-based access
- **Dark-first athletic UI** with premium design
- **Responsive:** Works on desktop, tablet, and mobile browsers
- **Real-time:** WebSocket for chat and live scoring

### 3.2 Mobile Application (React Native / Expo)
- **34 screens** with role-specific navigation
- **iOS + Android** via single codebase
- **Native features:** Camera, contacts sync, push notifications, QR scanning
- **Offline support:** POS works offline with sync

### 3.3 Navigation by Role

| Role | Web Navigation | Mobile Bottom Tabs |
|------|---------------|-------------------|
| **Player** | Feed, Explore, Dashboard, Venues, Matches, Groups, Teams, Chat, Tournaments, Coaching | Feed, Explore, Home, Chat, Profile |
| **Venue Owner** | Feed, Dashboard, POS, IoT, Groups, Chat, Tournaments | Feed, Dashboard, POS, IoT, Profile |
| **Coach** | Feed, Dashboard, Groups, Chat | Feed, Dashboard, Home, Chat, Profile |
| **Admin** | Feed, Admin Console, IoT | Dashboard, Feed, Chat, Profile |

---

## 4. PLAYER FEATURES — Complete Guide

### 4.1 Player Dashboard
The home screen for every player. Shows at a glance:
- **Skill Rating** with tier badge (Bronze < 1300 / Silver 1300-1599 / Gold 1600-1899 / Diamond 1900+)
- **Stats:** Skill Rating, Games Played, Win Rate, Upcoming Bookings
- **Quick Actions:** Find Venue, Find Game, Find Coach, My Profile
- **Engagement Score:** Posting streak, activity breakdown
- **Recommended Venues:** AI-powered venue suggestions (collaborative filtering)
- **Upcoming Bookings:** Next bookings with QR check-in button
- **Performance Insights:** Total bookings, matches, wins, spending
- **Sport Breakdown:** Which sports the player plays most
- **Monthly Activity Chart:** Visual activity over time
- **Waitlist:** Any slots the player is waiting for

### 4.2 Venue Discovery & Booking

**Finding a Venue:**
- Search by name, city, or area
- Filter by sport, price range, amenities
- "Near Me" button with GPS-based discovery
- Drive-time estimation to each venue
- Sort by rating, price, distance, or popularity

**Venue Detail Page:**
- Full venue info: photos, sports, amenities, hours, location
- **Star ratings** and **reviews** from other players
- **Calendar date picker** to select booking date
- **Slot grid** organized by turf showing availability:
  - Green = Available (with price)
  - Grey = Booked
  - Amber = On Hold (locked by another user)
  - Blue Glow = Locked by You

**Booking Process:**
1. Select a slot → Slot gets **soft-locked** for 10 minutes (no one else can take it)
2. Choose payment mode:
   - **Full Payment:** Pay entire amount via Razorpay
   - **Split Payment:** Choose 2-22 players, get a shareable link, each pays their share
3. Pay via Razorpay (UPI, Card, Net Banking, Wallet)
4. Booking confirmed → QR code generated for check-in at venue
5. If slot is booked → Player can **Join Waitlist** (auto-notified if slot opens)

**Slot Locking System:**
- **Soft Lock (10 min):** While browsing — prevents double-booking
- **Hard Lock (30 min):** During payment processing
- Uses Redis distributed locks for atomic operations

**Split Payment Flow:**
- Host books with split mode → System generates unique split link
- Share link via WhatsApp/SMS/Chat
- Each player opens link → Pays their share (no login required)
- Booking auto-confirms when all shares are paid
- Real-time tracking of who has paid

### 4.3 Matchmaking — Find Players to Play With

**Browse Matches:**
- Filter by sport (Football, Cricket, Basketball, Badminton, Tennis, etc.)
- Each match shows: sport, date, time, venue, spots left, skill range
- **Compatibility Score:** How well you match with the game (based on skill, sport, timing)

**Create a Match:**
- Choose sport, date, time, venue (optional), players needed
- Set minimum/maximum skill range
- Other players discover and join

**Auto-Match:**
- One-click "Find Me a Game" — AI finds the most compatible match
- If no match exists, suggests creating one

**After the Game — Result Submission:**
- AI suggests balanced team splits (based on Glicko-2 ratings)
- Players assign teams (Team A / Team B)
- Submit result: Winner, Scores
- **Majority Confirmation:** Other players vote to confirm result
- Skill ratings automatically update using **Glicko-2 algorithm**

**Leaderboard:**
- Global player rankings by skill rating
- Filter by sport
- Tier badges: Bronze, Silver, Gold, Diamond
- Shows: Rank, Name, Rating, W/L/D record

### 4.4 Mercenary System — Hire Players

**What it is:** A freelancer marketplace for sports. If you're short on players for a booking, post a mercenary request.

**How it works:**
1. Venue owner or player creates a mercenary post (linked to a booking)
2. Specifies: position needed, fee per player, spots available
3. Players browse and apply
4. Host accepts/rejects applicants
5. Accepted players pay through Razorpay
6. Everyone shows up and plays

### 4.5 Coaching — Find and Book a Coach

**Browse Coaches:**
- Search by name, sport, or city
- Coach cards show: photo, rating, sports, price per session, city

**Book a Session:**
1. View coach's available slots (date-specific)
2. Select a slot → Book session
3. Pay via Razorpay
4. Get QR code for session check-in
5. Coach marks session complete → Auto-creates performance record
6. Player rates and reviews the coach

**Monthly Packages:**
- Coaches create packages (e.g., "10 sessions/month for Rs 5000")
- Players subscribe to packages
- Sessions deducted from package balance
- Auto-renewal available

### 4.6 Tournaments — Compete and Win

**Browse Tournaments:**
- Filter by sport, status (Registration Open / In Progress / Completed)
- Formats: Knockout, Round Robin, League
- Shows: entry fee, prize pool, max participants, dates

**Register & Play:**
1. Register for a tournament (pay entry fee if applicable)
2. Organizer starts tournament → Bracket auto-generated
3. **Live Scoring** — Real-time score updates via WebSocket
4. Spectators can watch live on their phones
5. Results sync to bracket/standings automatically
6. Performance records auto-created for all matches

**Live Scoring Features:**
- Real-time score updates (home/away)
- Timeline events (goals, cards, points, substitutions)
- Period/half management
- Pause/resume match
- Spectator count tracking
- WebSocket-powered — updates in milliseconds

### 4.7 Social Feed — The Sports Instagram

**Stories (24-hour ephemeral content):**
- Post stories with text, photo, sport tag, background color
- React with: fire, trophy, clap, heart, 100, muscle
- View count tracking
- Auto-expires after 24 hours

**Feed Posts:**
- Post types: Text, Photo, Highlight, Match Result
- Like, React (6 emoji reactions), Comment, Bookmark, Share
- Two tabs: **For You** (AI-ranked) and **Following**
- **Trending** section with Wilson Score confidence algorithm

**Feed Ranking Algorithm (EdgeRank-inspired):**
The "For You" tab uses a sophisticated algorithm:
- **Affinity:** How close you are to the author (follow, co-play, interactions)
- **Content Weight:** Match results rank higher than text posts
- **Time Decay:** Newer posts rank higher (12-hour half-life)
- **Engagement Velocity:** Posts getting rapid engagement boost up
- **Quality Boost:** Longer posts with media rank higher
- **Diversity:** Max 3 consecutive posts from same author

**Follow System:**
- Follow/unfollow any user
- See followers and following lists
- Suggested follows based on co-play history and mutual connections

**Engagement Streaks:**
- Daily posting streak tracked
- Streak counter displayed on dashboard
- Motivates consistent engagement

### 4.8 Chat — WhatsApp-like Messaging

**Direct Messages (1-on-1):**
- End-to-end encrypted with **AES-256-GCM** encryption
- Text messages, photos, documents, voice notes
- Message reactions (thumbsup, heart, laugh, wow, fire, clap)
- Reply to specific messages
- Delete messages (for sender)
- Read receipts (single check = sent, double check = read)
- Online status indicator (green dot)
- Typing indicator ("typing...")
- Search messages within conversation
- File upload: Images (10MB), Documents (25MB), Audio (10MB)

**Real-time WebSocket:**
- Instant message delivery
- Online/offline status broadcasts
- Typing indicators
- Read receipt broadcasts

### 4.9 Communities — Groups & Teams

**Groups:**
- Create groups for any sport (casual or competitive)
- Public or private groups
- Group chat (message-based)
- Join/leave groups
- Admin management

**Teams:**
- Create competitive teams with captain
- Skill range requirements
- Win/loss/draw tracking per team
- Join/leave teams (captain approval optional)

### 4.10 Player Card & Profile

**Player Card:**
- Visual card with: name, avatar, sport, skill rating, tier badge
- **Overall Score (0-100):** Weighted breakdown:
  - Skill Rating (40%)
  - Win Rate (20%)
  - Tournament Performance (15%)
  - Training Hours (10%)
  - Reliability (10%)
  - Experience (5%)
- **Badges:** Century (100+ games), Veteran (50+), Regular (10+), Elite (2000+ rating), Pro (1700+), Reliable (95%+ reliability), Champion (50+ wins)

**Rating System (Glicko-2):**
- Every match updates your skill rating
- Considers: opponent's rating, rating uncertainty, match result
- **Tamper-proof chain:** Every rating change is cryptographically hashed
- Verify button confirms rating chain integrity
- Shareable rating certificate with verification proof

### 4.11 Video Highlights

- Upload match recordings (up to 100MB)
- **AI Analysis** powered by Gemini AI:
  - Sport detection
  - Key moment identification (goals, saves, rallies)
  - Match intensity assessment
  - Player count estimation
  - Summary generation
- Share highlights via public link
- S3 cloud storage with local fallback

### 4.12 Contact Sync & Invites

- Sync phone contacts to find friends already on Lobbi
- Generate personalized invite links
- Track who joined via your invite

### 4.13 Privacy & Data (DPDP Compliance)

- **Consent Management:** Essential, Analytics, Marketing, Location, Notifications
- **Data Export:** Download all your data in one click
- **Account Deletion:** Request full data erasure (DPDP-compliant anonymization)
- **Audit Log:** View all data access and changes
- **Notification Preferences:** Control email, SMS, push, in-app per channel

---

## 5. VENUE OWNER FEATURES — Complete Guide

### 5.1 Venue Owner Dashboard

**Overview Tab:**
- Total revenue, bookings today, occupancy %, average rating
- Revenue trend chart
- Top booking hours
- Sports breakdown
- Daily revenue breakdown

**Bookings Tab:**
- Today's upcoming bookings
- Booking details: guest name, time, sport, turf, status, amount
- Booking history with filters
- Cancel booking capability

**Pricing Tab:**
- **Base Price:** Default hourly rate
- **Dynamic Pricing Rules:**
  - Set conditions: Day of week (e.g., weekends), Time range (e.g., 6-10 PM)
  - Set actions: Multiplier (e.g., 1.5x) or Discount (e.g., 20% off)
  - Priority ordering (higher priority rules apply first)
  - Toggle rules on/off
  - Example: "Weekend Evening Premium" — 1.5x on Sat-Sun 6-10 PM
- **ML Pricing Suggestions** (optional): AI-recommended pricing based on demand

**Analytics Tab:**
- Detailed venue performance analytics
- Revenue by day, sport, time period
- Booking patterns and trends
- Customer demographics

### 5.2 Venue Management

- **Create venue:** Name, address, city, area, sports, amenities, photos, turf count, hours, pricing
- **Edit venue:** Update any detail including images
- **Multiple turfs:** Support for multi-turf venues (each turf has independent slots)
- **Image upload:** Multiple venue images (S3 cloud storage)
- **Public page:** Auto-generated public URL (e.g., lobbi.in/venue/green-turf-arena)

### 5.3 Reviews & Reputation

- Customers leave 1-5 star reviews after booking
- Review summary with star distribution
- Venue can view all reviews and ratings
- Average rating displayed on venue card

### 5.4 POS (Point of Sale) System

**What it is:** A built-in cash register for selling products at the venue (water, energy drinks, equipment rental, etc.)

**Products Management:**
- Add products with: name, price, category (Beverages, Snacks, Equipment, Apparel), stock count
- Update/delete products
- Track stock levels

**Sales Terminal:**
- Grid view of products
- Add to cart → Select payment method (Cash/Card/UPI) → Complete sale
- **Offline mode:** Sales queue when internet is down → Auto-syncs when back online

**Sales Reports:**
- Revenue summary by period
- Top-selling products
- Transaction history

### 5.5 IoT Smart Lighting Control

**What it is:** Remote control of venue floodlights and devices via MQTT protocol.

**Device Management:**
- Register devices: Floodlights, LED panels, ambient lights, emergency lights
- Protocols supported: MQTT, HTTP, Zigbee
- Per-device controls: On/Off, Brightness (0-100%)

**Zone Management:**
- Group devices into zones (Court 1, Court 2, Lounge, Parking)
- Zone-level control (turn all lights in a zone on/off)

**Energy Monitoring:**
- Real-time power consumption tracking
- Historical energy data by period
- Cost estimation

**Auto-Scheduling:**
- Sync with bookings — lights auto-on before booking starts, auto-off after
- Schedule-based automation

---

## 6. COACH FEATURES — Complete Guide

### 6.1 Coach Dashboard

**Overview:**
- Total students, active subscriptions, monthly revenue, average rating
- Upcoming sessions
- Recent reviews from students

**Sessions Tab:**
- View all coaching sessions (upcoming, completed, cancelled)
- Complete sessions → Auto-creates performance record for student
- Session details: student name, date, time, sport, status

### 6.2 Availability Management

- Set weekly availability: Day of week + Time range
- Example: Monday 9 AM - 6 PM, Wednesday 2 PM - 8 PM
- Players see only available slots when booking

### 6.3 Monthly Coaching Packages

**Create packages:**
- Name (e.g., "Pro Training - 10 Sessions")
- Sessions per month
- Monthly price
- Duration per session
- Description

**Subscriptions:**
- Players subscribe to packages
- Sessions deducted from package balance
- Auto-renewal option
- Cancel/pause subscription

### 6.4 Organizations & Academies

**Create an Organization:**
- Types: Individual Coach, Academy, School, College
- Sports offered, location, city
- Logo, contact email, phone

**Manage Staff:**
- Add coaches/assistants as staff members
- Role-based access within organization

**Manage Players:**
- Enroll players into organization
- Track player progress
- Submit performance records on behalf of players

**Organization Dashboard:**
- Total performance records
- Training sessions conducted
- Tournaments organized
- Player stats aggregation

### 6.5 Training Logs

- Log training sessions with: title, sport, date, duration, drills performed
- Record attendance (mark which players attended)
- Per-player performance notes
- Auto-creates performance records for all attending players

### 6.6 Performance Records

**Record Types:**
- Match Result
- Training Session
- Assessment
- Tournament Result
- Achievement

**Features:**
- Create individual or bulk records
- Records tied to player profile and organization
- Summary view: by type, sport, source, monthly activity
- Performance trends over time

### 6.7 QR Check-in System

- When a coaching session is booked, player receives a QR code
- Coach scans QR code at session start to verify attendance
- QR codes have expiry time for security
- Also works for venue bookings

---

## 7. ADMIN FEATURES — Complete Guide

### 7.1 Admin Dashboard

- **Platform Metrics:** Total users, active venues, total bookings, revenue
- **Pending Approvals:** Venue owners and coaches waiting for approval
- **Recent Registrations:** Latest user sign-ups with role and status

### 7.2 User Management

- **View all users** with filters: role (Player/Venue Owner/Coach), status
- **Approve:** Activate pending venue owner or coach accounts
- **Reject:** Decline registrations with reason
- **Suspend:** Temporarily block a user
- **Activate:** Reactivate suspended accounts
- **Toggle Verified:** Mark users as platform-verified
- **Set Plan:** Assign subscription plan to users

### 7.3 Venue Management

- View all venues on the platform
- Suspend venues (hides from search, blocks bookings)
- Activate suspended venues

### 7.4 Platform Settings

- **Payment Gateway:** Razorpay configuration (key_id, key_secret, live/test mode)
- **Commission Rates:**
  - Booking commission (default 10%)
  - Coaching commission (default 10%)
  - Tournament commission (default 10%)
- **S3 Storage:** AWS configuration for media uploads
- **Feature Toggles:** Enable/disable platform features

---

## 8. REVENUE & BUSINESS MODEL

### 8.1 Revenue Streams

| Revenue Stream | Source | Commission |
|---------------|--------|-----------|
| **Venue Booking Commission** | Every venue booking | 10% of booking amount |
| **Coaching Session Commission** | Every coaching session | 10% of session price |
| **Tournament Entry Commission** | Tournament registrations | 10% of entry fees |
| **Coaching Package Commission** | Monthly package subscriptions | 10% of package price |
| **Venue Subscription Plans** | Monthly plans for venue owners | Free / Rs 2,999 / Rs 7,999 per month |

### 8.2 Commission Calculation Example

**Venue Booking:**
- Slot price: Rs 2,000
- Platform commission (10%): Rs 200
- Venue owner receives: Rs 1,800
- Lobbi revenue: Rs 200

**Coaching Session:**
- Session price: Rs 500
- Platform commission (10%): Rs 50
- Coach receives: Rs 450
- Lobbi revenue: Rs 50

**Tournament Entry:**
- Entry fee: Rs 300 per player
- 16 players = Rs 4,800 total
- Platform commission (10%): Rs 480
- Organizer receives: Rs 4,320
- Lobbi revenue: Rs 480

### 8.3 Venue Subscription Plans

| Plan | Monthly Price | Max Venues | Features |
|------|-------------|-----------|----------|
| **Free** | Rs 0 | 1 | Basic booking, Basic analytics |
| **Basic** | Rs 2,999 | 3 | Advanced analytics, Priority support |
| **Pro** | Rs 7,999 | Unlimited | Full analytics, Dedicated support, Custom branding |

### 8.4 Payment Processing

- **Payment Gateway:** Razorpay (India's leading payment processor)
- **Methods Supported:** UPI, Credit/Debit Card, Net Banking, Wallets
- **Security:** HMAC-SHA256 signature verification on every payment
- **Split Payments:** Players can split booking cost (2-22 ways)
- **Test Mode:** Available for development/demo without real money

### 8.5 Dunning (Payment Failure Recovery)

When a subscription payment fails:
1. User notified immediately (in-app + email + SMS)
2. **Retry 1:** After 24 hours
3. **Retry 2:** After 72 hours
4. **Retry 3:** After 7 days
5. **Grace Period:** 14 days total before suspension
6. User can manually resolve payment anytime

---

## 9. TECHNOLOGY & SECURITY

### 9.1 Tech Stack

| Component | Technology |
|-----------|-----------|
| **Frontend (Web)** | React 18, Vite, Tailwind CSS, Framer Motion, Radix UI |
| **Mobile App** | React Native (Expo) — iOS + Android |
| **Backend** | Python, FastAPI, Uvicorn |
| **Database** | MongoDB 7 (NoSQL document store) |
| **Cache & Locks** | Redis 7 (distributed slot locking) |
| **Payments** | Razorpay (UPI, Cards, Net Banking, Wallets) |
| **File Storage** | AWS S3 (with local fallback) |
| **IoT** | MQTT Protocol (broker.emqx.io) |
| **AI/ML** | Gemini AI (video analysis), Custom algorithms |
| **Deployment** | Docker, Nginx, SSL/TLS, Digital Ocean |

### 9.2 Security Features

| Feature | Description |
|---------|------------|
| **Password Security** | Bcrypt hashing, strength validation (8+ chars, uppercase, lowercase, digit) |
| **Chat Encryption** | AES-256-GCM encryption with per-conversation derived keys |
| **Payment Verification** | HMAC-SHA256 timing-safe signature verification |
| **Rating Integrity** | Tamper-proof blockchain-style hash chain for skill ratings |
| **Slot Locking** | Redis distributed locks prevent double-booking |
| **JWT Auth** | 2-hour access tokens + 7-day refresh tokens |
| **CORS** | Configurable allowed origins (no wildcards in production) |
| **Security Headers** | HSTS, X-Frame-Options, X-Content-Type-Options, CSP |
| **DPDP Compliance** | Consent management, data export, right to erasure |
| **Account Protection** | Suspended/deleted accounts blocked from all API access |

### 9.3 Architecture

**Current (Monolith — Production):**
```
Frontend (React) → Nginx → Backend (FastAPI) → MongoDB + Redis
```

**Future (Microservices — Ready):**
```
Frontend → Nginx → API Gateway → 9 Microservices → MongoDB + Redis

Services:
├── Auth Service (8001)       - Login, Register, Organizations
├── Venue Service (8002)      - Venues, Slots, Reviews, Pricing
├── Booking Service (8003)    - Bookings, Payments, Matchmaking, Ratings
├── Social Service (8004)     - Feed, Chat, Groups, Teams, Live Scoring
├── Notification Service (8005) - Email, SMS, Push
├── IoT Service (8006)        - Device Control, Energy Monitoring
├── Analytics Service (8007)  - Stats, Training, Performance, Recommendations
├── POS Service (8008)        - Products, Sales, Offline Sync
└── Coaching Service (8009)   - Sessions, Packages, Subscriptions
```

---

## 10. KEY USER FLOWS (Step-by-Step)

### Flow 1: Player Books a Venue

```
1. Player opens Lobbi → Goes to "Venues"
2. Searches for "Football" near their location
3. Sees venue cards with ratings and prices
4. Taps "Green Turf Arena" → Opens venue detail
5. Selects date on calendar → Sees available slots
6. Taps "7:00 PM - 8:00 PM, Turf 1 — Rs 2,000"
7. Slot gets soft-locked (10-min timer starts)
8. Chooses "Split Payment - 4 players" → Rs 500 each
9. Pays Rs 500 via Razorpay UPI
10. Gets split link → Shares on WhatsApp
11. Friends open link → Pay Rs 500 each
12. When all 4 pay → Booking CONFIRMED
13. Gets QR code → Shows at venue for check-in
```

### Flow 2: Players Find Each Other for a Game

```
1. Player A goes to "Matchmaking" → Creates match
   - Football, Tomorrow 7 PM, 10 players needed, skill range 1400-1800
2. Match appears in "Browse" for all players
3. Players B-J join the match (see compatibility score)
4. Match reaches 10 players → Status = "Filled"
5. After playing, Player A submits result:
   - AI suggests balanced teams → Assigns Team A / Team B
   - Sets winner = Team A, Score = 3-2
6. Other players confirm the result (majority vote)
7. Once confirmed → Skill ratings update for all 10 players
8. Winners gain rating, losers lose (amount varies by opponent strength)
```

### Flow 3: Player Books a Coach

```
1. Player goes to "Coaching" → Browses coaches
2. Filters by "Badminton" → Sees Coach Priya (4.8 stars, Rs 500/session)
3. Taps on Coach Priya → Views available slots
4. Selects "Wednesday 5 PM - 6 PM"
5. Books session → Pays Rs 500 via Razorpay
6. Gets QR code for session check-in
7. At the session → Coach scans QR to verify
8. After session → Coach marks "Complete"
9. Player rates Coach Priya: 5 stars
10. Performance record auto-created for the player
```

### Flow 4: Venue Owner Sets Up Dynamic Pricing

```
1. Venue Owner goes to "Dashboard" → "Pricing" tab
2. Base price: Rs 1,500/hour
3. Creates Rule 1: "Weekend Premium"
   - Condition: Saturday + Sunday
   - Action: 1.3x multiplier → Rs 1,950/hour on weekends
4. Creates Rule 2: "Peak Hour Premium"
   - Condition: 6 PM - 10 PM
   - Action: 1.5x multiplier → Rs 2,250/hour on peak evenings
5. Creates Rule 3: "Weekday Morning Discount"
   - Condition: Monday-Friday, 6 AM - 10 AM
   - Action: 20% discount → Rs 1,200/hour
6. Players automatically see correct prices when booking
```

### Flow 5: Tournament from Creation to Completion

```
1. Organizer creates tournament:
   - "Badminton Open 2026", Knockout format, 16 players, Rs 200 entry, Rs 3,200 prize pool
2. 16 players register and pay entry fee
3. Organizer starts tournament → Bracket auto-generated (16 → 8 → 4 → 2 → Final)
4. First round: 8 matches
   - Organizer starts live scoring for Match 1
   - Real-time score updates to all spectators via WebSocket
   - Events tracked: points, timeouts, set changes
   - Match ends → Winner advances to next round
5. Process repeats through Semi-Finals and Final
6. Champion crowned → Performance records created for all players
7. Standings finalized → Available for all to view
```

---

## 11. MARKETING TEAM GUIDE

### Key Selling Points (USPs)

1. **"Split the Bill, Not the Fun"** — Split booking payments with friends in 2 taps
2. **"Find Your Game in 60 Seconds"** — Auto-matchmaking finds you the perfect game
3. **"Your Sports Career, Tracked"** — Glicko-2 skill rating with tamper-proof verification
4. **"Book Any Court, Anywhere"** — Venue discovery with real-time availability
5. **"Coach at Your Fingertips"** — Browse, book, and pay for coaching in one app
6. **"Watch Live, Cheer Loud"** — Real-time live scoring for tournaments
7. **"Your Sports Social Network"** — Feed, stories, chat, groups — all for sports
8. **"Military-Grade Chat Security"** — AES-256-GCM encrypted messaging

### Target Audiences for Campaigns

| Audience | Messaging Focus | Channel |
|----------|----------------|---------|
| College students (18-24) | Matchmaking, split payments, social feed | Instagram, YouTube Shorts |
| Working professionals (25-35) | Venue booking, coaching, tournaments | LinkedIn, Facebook |
| Venue owners | Revenue growth, dynamic pricing, analytics | Google Ads, Direct outreach |
| Coaches/Trainers | Student discovery, package subscriptions | LinkedIn, Coaching forums |
| Sports enthusiasts | Tournaments, leaderboard, player cards | Twitter/X, Sports communities |

### Content Ideas

- "Day in the Life of a Lobbi Player" — Show the full journey from booking to playing
- "Split Payment Demo" — Show how easy it is to split a booking
- "Coach Success Story" — How a coach grew from 0 to 50 students on Lobbi
- "Tournament Highlight Reel" — Live scoring in action, crowd reactions
- "From 1500 to Diamond" — A player's rating journey
- "Venue Owner Revenue Dashboard" — Show the analytics and pricing features
- "Secret Weapon: AI Video Analysis" — Upload a match, get AI insights

### Competitor Differentiation

| Feature | Lobbi | Playo | Hudle |
|---------|-------|-------|-------|
| Split Payments | Yes (2-22 ways) | No | No |
| Skill Rating (Glicko-2) | Yes (verified chain) | Basic | No |
| Live Tournament Scoring | Yes (WebSocket real-time) | No | No |
| Coach Marketplace | Yes (with packages) | No | Limited |
| Encrypted DM Chat | Yes (AES-256-GCM) | No | No |
| Social Feed + Stories | Yes (full Instagram-like) | No | Limited |
| IoT Lighting Control | Yes (MQTT) | No | No |
| POS System | Yes (with offline) | No | No |
| AI Video Analysis | Yes (Gemini AI) | No | No |
| Dynamic Pricing | Yes (rules engine) | No | Limited |
| Mercenary (Hire Players) | Yes | No | No |
| DPDP Compliance | Yes | Unknown | Unknown |

---

## 12. SALES TEAM GUIDE

### Venue Owner Sales Pitch

**Problem:** "You're losing bookings because customers can't book online. You're wasting time on phone calls. You have no visibility into revenue trends."

**Solution:** "Lobbi gives you a complete digital booking system with payments, dynamic pricing, analytics, and even IoT lighting control — starting at FREE."

**Demo Script:**
1. Show venue creation (2 minutes)
2. Show a player booking their venue (show the slot grid)
3. Show Razorpay payment flowing in
4. Show the revenue dashboard and analytics
5. Show dynamic pricing rules (weekend premium)
6. Show POS system for on-ground sales
7. End with: "Your venue gets discovered by thousands of players searching for [their sport]"

**Objection Handling:**

| Objection | Response |
|-----------|---------|
| "I already get bookings via phone" | "Phone bookings = missed bookings when you're busy. Lobbi works 24/7. Plus, automatic payment collection — no more chasing payments." |
| "10% commission is too high" | "You're not paying for bookings — you're paying for marketing, payment processing, analytics, IoT, and a complete business tool. Compare with 20-30% on food delivery apps." |
| "My customers won't use an app" | "Players already search online. 80% of our bookings come from players finding venues — they'll discover YOU. Plus, split payments bring more players per booking." |
| "I have my own website" | "Does your website have real-time slot management, Razorpay payments, dynamic pricing, split payments, matchmaking, and a community of thousands of players? Lobbi does." |

### Coach Sales Pitch

**Problem:** "You have great coaching skills but no platform to get discovered. Managing sessions, payments, and student progress is manual."

**Solution:** "Lobbi puts you in front of thousands of players. They browse, book, and pay — you just show up and coach."

**Key Points:**
1. Get discovered by players searching for coaches in your sport/city
2. Set your own rates and availability
3. Automatic Razorpay payments (no more cash collection)
4. Create monthly packages for recurring revenue
5. Track student performance with training logs
6. Build your reputation with ratings and reviews
7. Run your own academy/organization on the platform

### Pricing for Sales Conversations

| For Venue Owners | Free Plan | Basic Plan | Pro Plan |
|-----------------|-----------|-----------|---------|
| Monthly Price | Rs 0 | Rs 2,999 | Rs 7,999 |
| Max Venues | 1 | 3 | Unlimited |
| Analytics | Basic | Advanced | Full |
| Support | Community | Priority | Dedicated |
| Commission | 10% | 10% | 10% |

For coaches: No subscription fee — just 10% commission per session/package.

---

## 13. OPERATIONS TEAM GUIDE

### Daily Operations Checklist

- [ ] Check pending venue owner approvals → Approve/reject within 24 hours
- [ ] Check pending coach approvals → Approve/reject within 24 hours
- [ ] Monitor platform dashboard metrics (users, bookings, revenue)
- [ ] Review suspended accounts — any to reactivate?
- [ ] Check dunning queue — any payment failures needing manual intervention?
- [ ] Monitor system health (API response times, error rates)

### Venue Owner Approval Process

1. New venue owner registers → Status: **Pending**
2. Operations team reviews:
   - Is the venue real? (Check address, photos, Google Maps)
   - Is the contact info valid? (Phone, email)
   - Are the sports and amenities reasonable?
3. If valid → **Approve** (account becomes active)
4. If suspicious → **Reject** (account blocked, reason provided)

### Coach Approval Process

1. New coach registers → Status: **Pending**
2. Operations team reviews:
   - Is the coach profile complete? (Bio, sports, pricing)
   - Do they have relevant experience/certification?
   - Is contact info valid?
3. If valid → **Approve**
4. If suspicious → **Reject**

### Handling Disputes

**Booking Disputes:**
- Player claims they booked but venue says no → Check booking status and payment proof in admin panel
- Split payment incomplete → Check split payment status, contact remaining payers

**Rating Disputes:**
- Player claims rating is wrong → Use rating verification to check chain integrity
- If chain is valid → Rating is correct (explain Glicko-2 to player)

**Payment Issues:**
- Razorpay payment failed → Check dunning status, guide user to retry
- Refund needed → Process through Razorpay dashboard

### Key Metrics to Monitor

| Metric | Where to Find | Target |
|--------|--------------|--------|
| Daily Active Users | Admin Dashboard | Growth week-over-week |
| Daily Bookings | Admin Dashboard | Growth week-over-week |
| Pending Approvals | Admin > Users | < 24 hour response time |
| Payment Success Rate | Razorpay Dashboard | > 95% |
| Average Rating (Venues) | Admin > Venues | > 4.0 stars |
| Average Rating (Coaches) | Coach profiles | > 4.0 stars |
| User Churn Rate | Engagement > Churn Risk | < 15% monthly |

---

## 14. CUSTOMER SUPPORT GUIDE

### Common Player Issues

| Issue | Solution |
|-------|---------|
| "I can't book a slot — it says 'On Hold'" | Another player has temporarily locked that slot. Wait 10 minutes or choose another slot. |
| "My split payment link isn't working" | Check if the booking is still in 'pending' status. If expired (24hrs), the booking was auto-cancelled. |
| "My skill rating went down after a win" | Glicko-2 considers opponent strength. Beating a lower-rated opponent gives fewer points. If your rating deviation was high, ratings can fluctuate more. |
| "I can't see my booking QR code" | QR codes appear only for confirmed bookings. If payment is pending, complete the payment first. |
| "My chat messages aren't sending" | Check internet connection. Messages are encrypted — try refreshing the chat page. |
| "I want to delete my account" | Go to Privacy Settings > My Data > Delete Account. This anonymizes your data per DPDP regulations. |
| "How do I become verified?" | Verification is granted by admin based on platform activity and community contribution. |

### Common Venue Owner Issues

| Issue | Solution |
|-------|---------|
| "My account is still pending" | Admin approval takes up to 24 hours. Check email for updates. |
| "I'm not receiving bookings" | Check if venue is active, has correct sports listed, and prices are competitive. Encourage reviews for visibility. |
| "Dynamic pricing isn't working" | Verify rule conditions (day of week, time range) match the slot times. Check if rule is toggled ON. |
| "How do I add more turfs?" | Edit your venue → Update 'turfs' count. Slots will auto-generate for new turfs. |
| "Payment isn't reaching me" | Razorpay settlements are T+2 (2 business days). Check Razorpay dashboard for settlement status. |

### Common Coach Issues

| Issue | Solution |
|-------|---------|
| "Players can't see my available slots" | Set up your availability in Dashboard > Availability tab. Without slots, players can't book you. |
| "Session payment not received" | Check if session status is 'confirmed'. Razorpay settlements are T+2. |
| "How do I create a monthly package?" | Dashboard > Packages tab > Create Package. Set sessions per month, price, and description. |
| "Student didn't show up" | Mark session as cancelled. The player's reliability score will be affected over time. |

### Escalation Path

```
Level 1: Customer Support (chat/email) — Handle common issues
Level 2: Operations Team — Account approvals, disputes, refunds
Level 3: Technical Team — Bug fixes, system issues
Level 4: Management — Policy decisions, major disputes
```

---

## 15. GLOSSARY OF TERMS

| Term | Definition |
|------|-----------|
| **Glicko-2** | Advanced skill rating algorithm that accounts for rating uncertainty and player consistency. Standard in competitive gaming. |
| **AES-256-GCM** | Military-grade encryption standard used for chat messages. Each conversation has a unique encryption key. |
| **HMAC-SHA256** | Cryptographic signature verification used to confirm Razorpay payment authenticity. |
| **Soft Lock** | 10-minute temporary reservation on a venue slot while a player is browsing/booking. |
| **Hard Lock** | 30-minute firm reservation during payment processing. |
| **Split Payment** | Feature allowing 2-22 players to divide a booking cost equally. Each gets a payment link. |
| **Mercenary** | A player hired to fill a spot in a booking/match (like a sports freelancer). |
| **Rating Deviation (RD)** | Uncertainty in a player's skill rating. New players have high RD (350), experienced players have low RD (50-100). |
| **Tamper-Proof Chain** | SHA-256 hash chain linking every rating change. Like a blockchain — any tampering is detectable. |
| **EdgeRank** | Feed ranking algorithm (inspired by Facebook's) that determines which posts appear in "For You" tab. |
| **Wilson Score** | Statistical algorithm for trending detection — accounts for sample size, not just raw engagement counts. |
| **Dunning** | Automated payment failure recovery process with retries and grace periods. |
| **DPDP** | Digital Personal Data Protection Act — India's data privacy law. Lobbi is fully compliant. |
| **MQTT** | Messaging protocol for IoT devices. Used for controlling venue floodlights in real-time. |
| **WebSocket** | Real-time bidirectional communication. Used for chat messages and live scoring updates. |
| **Collaborative Filtering** | AI recommendation technique: "Players who booked Venue A also booked Venue B." |
| **Engagement Score** | 0-100 score measuring player activity (posting, playing, interactions, streaks). |
| **Churn Risk** | AI-predicted probability that a user will stop using the platform. Levels: Low, Medium, High, Critical. |
| **POS** | Point of Sale — Digital cash register for venue on-ground sales (drinks, equipment, etc.). |
| **Commission** | Percentage Lobbi takes from each transaction (default 10% on bookings, coaching, tournaments). |
| **Turf** | A single playing field within a venue. Multi-turf venues have independent booking slots per turf. |
| **QR Check-in** | QR code shown to players before sessions/bookings. Scanned at venue for attendance verification. |

---

*This document is maintained by the Lobbi Product Team. For questions, reach out to the product channel.*

*Last updated: February 2026 | Version 1.0*
