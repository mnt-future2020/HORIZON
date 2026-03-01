# HORIZON — Mobile Responsive Fix Guide

> Complete file-by-file guide with current code, fix code, and priority levels.
> Backend-a touch pannathe — frontend UI only.

---

## Current Status: ~70% Responsive

| Area | Status | Notes |
|------|--------|-------|
| Viewport meta tag | Working | `width=device-width, initial-scale=1` |
| PWA support | Working | apple-mobile-web-app-capable, manifest |
| Bottom nav (mobile) | Working | Instagram-style 5 tabs, safe-area-inset |
| Sidebar hide on mobile | Working | `hidden lg:flex` |
| Bottom padding for nav | Working | `pb-20 md:pb-8` on most pages |
| Responsive grids | Partial | Most pages ok, some missing breakpoints |
| Touch targets | Partial | Most h-9+, some h-5/h-6 too small |
| Text sizing | Needs fix | Excessive text-[8px]/[9px]/[10px] |
| Dialogs | Needs fix | Missing rounded-[28px], responsive max-w |
| Landing page | Broken | 1050px font breaks mobile |
| Tablet (768-1024px) | Needs fix | Sidebar gap, no search |

---

## Tailwind Breakpoints (Reference)

```
sm  → 640px   (small phones landscape, large phones)
md  → 768px   (tablets portrait)
lg  → 1024px  (tablets landscape, small laptops)
xl  → 1280px  (desktops)
2xl → 1536px  (large desktops)
```

---

## PRIORITY 1 — CRITICAL FIXES

### 1.1 Landing Page `.simteste` Class — Layout Breaks Mobile

**File:** `frontend/src/index.css` — Lines 514-518

```css
/* CURRENT (BROKEN) */
.simteste {
  color: #c8f550;
  font-size: 1050px;
  line-height: 600px;
}
```

```css
/* FIX — responsive clamp */
.simteste {
  color: #c8f550;
  font-size: clamp(80px, 25vw, 1050px);
  line-height: clamp(60px, 15vw, 600px);
}
```

**Why:** 1050px font overflows on any screen under 1200px wide. `clamp()` scales from 80px (mobile) to 1050px (4K). Used in `ArenaCalloutSection.js` line 13.

---

### 1.2 App.js — Main Layout Missing Mobile Padding

**File:** `frontend/src/App.js` — Line 233

```jsx
/* CURRENT */
<div className="flex flex-1 w-full gap-8 relative px-6 max-w-[1600px] mx-auto">
```

```jsx
/* FIX — responsive padding & gap */
<div className="flex flex-1 w-full gap-4 lg:gap-8 relative px-3 sm:px-4 md:px-6 max-w-[1600px] mx-auto">
```

**Why:** `px-6` (24px) is too much on 320px phones. `gap-8` (32px) wastes space on mobile. Progressive padding: 12px → 16px → 24px.

---

### 1.3 AboutPage.js — Stats Grid Not Responsive

**File:** `frontend/src/pages/AboutPage.js` — Line 61

```jsx
/* CURRENT (BROKEN on mobile) */
<div className="grid grid-cols-3 gap-6 mb-12">
```

```jsx
/* FIX */
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-12">
```

**Why:** 3 columns on a 320px phone = each card is ~100px wide. Unreadable. Stack on mobile, 3 cols on sm+.

---

### 1.4 Navbar — Mobile Tab Labels Too Small

**File:** `frontend/src/components/Navbar.js`

| Line | Current | Fix | Element |
|------|---------|-----|---------|
| 265 | `text-[9px]` | `text-[10px]` | Mobile nav tab labels |
| 276 | `text-[8px]` | `text-[9px]` | Notification count badge |
| 281 | `text-[9px]` | `text-[10px]` | "Alerts" tab label |
| 297 | `text-[9px]` | `text-[10px]` | "Me" tab label |

**Line 265 — Tab labels:**
```jsx
/* CURRENT */
<span className="text-[9px] font-bold leading-tight">{l.label}</span>
```
```jsx
/* FIX */
<span className="text-[10px] font-medium leading-tight">{l.label}</span>
```

**Line 276 — Notification badge:**
```jsx
/* CURRENT */
<span className="absolute -top-1 -right-1.5 h-3.5 min-w-[14px] px-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold ...">
```
```jsx
/* FIX */
<span className="absolute -top-1 -right-1.5 h-4 min-w-[16px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-semibold ...">
```

---

## PRIORITY 2 — HIGH IMPACT FIXES

### 2.1 Desktop Search Bar — Hidden on Mobile/Tablet

**File:** `frontend/src/components/Navbar.js` — Line 152

```jsx
/* CURRENT — completely hidden below lg */
<div className="relative flex-1 max-w-md hidden lg:block">
  <Search className="..." />
  <input className="..." placeholder="Search athletes, teams, or results..." type="text" />
</div>
```

```jsx
/* FIX — show compact search icon on tablet, full bar on desktop */
<div className="relative flex-1 max-w-md hidden md:block">
  {/* Tablet: icon-only search button */}
  <div className="lg:hidden">
    <button className="h-10 w-10 rounded-xl flex items-center justify-center hover:bg-secondary/50 text-muted-foreground transition-all">
      <Search className="h-5 w-5" />
    </button>
  </div>
  {/* Desktop: full search bar */}
  <div className="hidden lg:block relative">
    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
    <input className="w-full bg-secondary/20 border border-border/40 rounded-full py-2 pl-10 pr-4 text-sm focus:border-brand-600 outline-none transition-all placeholder:text-muted-foreground/70" placeholder="Search athletes, teams, or results..." type="text" />
  </div>
</div>
```

---

### 2.2 Desktop Navbar — Excessive Padding on Tablet

**File:** `frontend/src/components/Navbar.js` — Line 142

```jsx
/* CURRENT */
<header className="hidden md:flex fixed top-0 left-0 w-full z-50 h-[72px] items-center justify-between px-8 bg-card/90 ...">
```

```jsx
/* FIX — responsive padding */
<header className="hidden md:flex fixed top-0 left-0 w-full z-50 h-[72px] items-center justify-between px-4 lg:px-8 bg-card/90 ...">
```

---

### 2.3 Desktop Navbar — Search Bar Border Too Thick

**File:** `frontend/src/components/Navbar.js` — Line 154

```jsx
/* CURRENT */
<input className="... border-2 border-brand-600/40 ..." />
```

```jsx
/* FIX — match UI guide border style */
<input className="... border border-border/40 ..." />
```

---

### 2.4 ChatPage — Message Width Too Narrow on Small Phones

**File:** `frontend/src/pages/ChatPage.js` — Line 1070

```jsx
/* CURRENT */
<div className={`max-w-[78%] relative group ${isMe ? "items-end" : "items-start"}`}>
```

```jsx
/* FIX — wider on mobile, narrower on desktop */
<div className={`max-w-[85%] sm:max-w-[78%] relative group ${isMe ? "items-end" : "items-start"}`}>
```

**Why:** On a 320px phone, 78% = 249px. With padding, only ~200px for text. 85% gives ~272px — much better readability.

---

### 2.5 POSPage — Quantity Button Touch Targets Too Small

**File:** `frontend/src/pages/POSPage.js` — Lines 86-89 (ProductCard)

```jsx
/* CURRENT — h-6 w-6 = 24px, below 44px minimum */
<button onClick={() => onRemove(product)}
  className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center ...">
  <Minus className="h-3 w-3" />
</button>
<button onClick={() => onAdd(product)}
  className="h-6 w-6 rounded-full bg-brand-600/20 flex items-center justify-center ...">
  <Plus className="h-3 w-3" />
</button>
```

```jsx
/* FIX — h-8 w-8 = 32px, reasonable for compact POS grid */
<button onClick={() => onRemove(product)}
  className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center ...">
  <Minus className="h-3.5 w-3.5" />
</button>
<button onClick={() => onAdd(product)}
  className="h-8 w-8 rounded-full bg-brand-600/20 flex items-center justify-center ...">
  <Plus className="h-3.5 w-3.5" />
</button>
```

**Also fix cart quantity buttons (same file, lines ~600-602):**
```jsx
/* CURRENT */
<button ... className="h-5 w-5 rounded-full ...">
```
```jsx
/* FIX */
<button ... className="h-7 w-7 rounded-full ...">
```

---

### 2.6 IoT Dashboard — Dialogs Missing Mobile Width

**File:** `frontend/src/pages/IoTDashboard.js`

| Line | Current | Fix |
|------|---------|-----|
| 709 | `sm:max-w-[500px]` | `max-w-[95vw] sm:max-w-[500px]` |
| 787 | `sm:max-w-[400px]` | `max-w-[95vw] sm:max-w-[400px]` |

```jsx
/* CURRENT */
<DialogContent className="sm:max-w-[500px] max-h-[85vh] ...">
```

```jsx
/* FIX — prevent dialog exceeding mobile screen */
<DialogContent className="max-w-[95vw] sm:max-w-[500px] max-h-[85vh] ...">
```

---

## PRIORITY 3 — MEDIUM FIXES

### 3.1 All Dialogs — Consistent Mobile Pattern

Apply this pattern to ALL `<DialogContent>` across the app:

```jsx
/* STANDARD MOBILE-FRIENDLY DIALOG */
<DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-[28px] p-0">
```

**Files with dialogs that need this fix:**

| File | Lines | Current max-w |
|------|-------|--------------|
| `CoachDashboard.js` | ~2750, ~3150, ~3700 | `max-w-md` / `max-w-lg` |
| `CoachSettingsPage.js` | ~320 | `max-w-md` |
| `CommunitiesPage.js` | ~280 | `max-w-md` |
| `GroupDetailPage.js` | ~450 | `max-w-md` |
| `HighlightsPage.js` | ~284 | `max-w-2xl` |
| `IoTDashboard.js` | ~709, ~787 | `sm:max-w-[500px]` / `sm:max-w-[400px]` |
| `MatchmakingPage.js` | ~350 | `max-w-md` |
| `NotificationsPage.js` | ~200 | `max-w-md` |
| `PlayerDashboard.js` | ~540 | `max-w-sm` |
| `ProfilePage.js` | ~800, ~1200 | `max-w-md` / `max-w-lg` |
| `SuperAdminDashboard.js` | ~473, ~815 | `max-w-2xl` / `max-w-lg` |
| `TournamentDetailPage.js` | ~700 | `max-w-md` |
| `TournamentsPage.js` | ~329 | `max-w-md` |
| `VenueOwnerDashboard.js` | ~1250, ~1580, ~2200 | `max-w-md` / `max-w-lg` |

---

### 3.2 Text Size — Minimum Readable Sizes

**Rule:** Never use text smaller than `text-[10px]` for any meaningful content.

| Size | Usage | Verdict |
|------|-------|---------|
| `text-[8px]` | Notification badge count | Change to `text-[9px]` |
| `text-[9px]` | Nav labels, stock warnings, badges | Change to `text-[10px]` |
| `text-[10px]` | Secondary info, timestamps | Acceptable (keep) |
| `text-[11px]` | Tertiary info | Acceptable (keep) |
| `text-xs` (12px) | Standard small text | Good |

**Files with text-[8px] or text-[9px] to fix:**

| File | Lines | Current | Fix |
|------|-------|---------|-----|
| `Navbar.js` | 265, 281, 297 | `text-[9px]` | `text-[10px]` |
| `Navbar.js` | 276 | `text-[8px]` | `text-[9px]` |
| `POSPage.js` | 93 | `text-[9px]` | `text-[10px]` |
| `ExplorePage.js` | ~256 | `text-[9px]` | `text-[10px]` |
| `TeamsPage.js` | ~188 | `text-[9px]` | `text-[10px]` |
| `MatchmakingPage.js` | ~35 | `text-[9px]` | `text-[10px]` |

---

### 3.3 Grid Responsive Gaps

Many grids use fixed `gap-6` or `gap-4` on all screen sizes. Mobile should have smaller gaps.

**Pattern:**
```jsx
/* Instead of */
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

/* Use */
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
```

**Files to apply:**

| File | Line(s) | Current gap | Fix |
|------|---------|-------------|-----|
| `PlayerDashboard.js` | ~196 | `gap-4` | `gap-3 sm:gap-4` |
| `PlayerDashboard.js` | ~267 | `gap-6` | `gap-4 lg:gap-6` |
| `VenueOwnerDashboard.js` | ~924 | `gap-4` | `gap-3 sm:gap-4` |
| `CoachDashboard.js` | ~800 | `gap-6` | `gap-4 lg:gap-6` |
| `AboutPage.js` | ~40 | `gap-6` | `gap-4 sm:gap-6` |
| `CommunitiesPage.js` | ~150 | `gap-4` | `gap-3 sm:gap-4` |
| `TournamentsPage.js` | ~200 | `gap-4` | `gap-3 sm:gap-4` |

---

### 3.4 PlayerDashboard — Missing Grid Breakpoints

**File:** `frontend/src/pages/PlayerDashboard.js`

**Line ~196 — Stat cards:**
```jsx
/* CURRENT */
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
```
```jsx
/* FIX — add sm breakpoint */
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
```

**Line ~267 — Engagement + Venues layout:**
```jsx
/* CURRENT */
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
```
```jsx
/* FIX — add md breakpoint for tablets */
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
```

---

### 3.5 VenueOwnerDashboard — Venue Pill Text Too Small

**File:** `frontend/src/pages/VenueOwnerDashboard.js` — Line ~998-1001

```jsx
/* CURRENT */
className="... px-5 py-2.5 text-xs ..."
```

```jsx
/* FIX — slightly larger on mobile */
className="... px-4 sm:px-5 py-2 sm:py-2.5 text-xs ..."
```

---

## PRIORITY 4 — LOW / POLISH FIXES

### 4.1 Add `safe-area-inset` to Bottom Padding

For iPhone X+ notch and home indicator, add safe-area support to page wrappers:

```css
/* Add to frontend/src/index.css */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .safe-bottom {
    padding-bottom: calc(5rem + env(safe-area-inset-bottom));
  }
}
```

Or use inline style on pages:
```jsx
<main style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom, 0px))" }}>
```

---

### 4.2 Add Landscape Support for Modals

**File:** `frontend/src/pages/SocialFeedPage.js` already does this well (Line ~1704):

```jsx
/* GOOD pattern — use in other pages */
className="max-h-[70vh] landscape:max-h-[85vh]"
```

Apply to all large dialogs (highlights viewer, image galleries).

---

### 4.3 Hide Scrollbar Utility

Verify `hide-scrollbar` class exists in CSS. If not, add:

```css
/* frontend/src/index.css */
.hide-scrollbar::-webkit-scrollbar { display: none; }
.hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
```

---

### 4.4 Overflow Indicators for Horizontal Scroll

When using `overflow-x-auto` for tabs/pills, add a gradient fade to hint scrollable content:

```jsx
/* Wrap scrollable container */
<div className="relative">
  <div className="flex overflow-x-auto hide-scrollbar gap-3">
    {/* pills */}
  </div>
  {/* Right fade indicator */}
  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none md:hidden" />
</div>
```

Apply to: category pills, tab navigations, venue selectors on all pages.

---

### 4.5 Image Responsiveness

Ensure all images have:
```jsx
<img src={url} alt={alt} className="w-full h-full object-cover" loading="lazy" />
```

For hero/banner images, add responsive height:
```jsx
<div className="h-40 sm:h-48 md:h-56 lg:h-64 overflow-hidden rounded-[28px]">
  <img ... className="w-full h-full object-cover" />
</div>
```

---

## PAGE-BY-PAGE CHECKLIST

Use this checklist when fixing each page. Every page should have ALL of these:

```
[ ] Page wrapper: min-h-screen bg-transparent pb-20 md:pb-8
[ ] Content padding: px-3 sm:px-4 md:px-6 (or parent App.js handles it)
[ ] Grids: grid-cols-1 → sm → md → lg breakpoints
[ ] Gaps: responsive gap-3 sm:gap-4 lg:gap-6
[ ] Text: minimum text-[10px], no text-[8px] or text-[9px]
[ ] Touch targets: all buttons min h-8 w-8 (prefer h-9 w-9)
[ ] Inputs: h-11 minimum for mobile tap targets
[ ] Dialogs: max-w-[95vw] sm:max-w-lg rounded-[28px] max-h-[85vh] overflow-y-auto p-0
[ ] Horizontal scroll: overflow-x-auto hide-scrollbar on pills/tabs
[ ] Images: w-full object-cover with responsive container height
[ ] Cards: rounded-[28px] (matches UI guide)
[ ] Bottom spacing: last section has enough margin for bottom nav
```

---

## FILE-BY-FILE STATUS

| File | Responsive | Issues | Priority |
|------|-----------|--------|----------|
| `index.css` | Broken | `.simteste` 1050px font | P1 CRITICAL |
| `App.js` | Partial | px-6 fixed, gap-8 fixed | P1 CRITICAL |
| `Navbar.js` | Good | text-[8px]/[9px] labels, no tablet search | P2 HIGH |
| `AboutPage.js` | Partial | grid-cols-3 no mobile | P1 CRITICAL |
| `ChatPage.js` | Partial | max-w-[78%] too narrow | P2 HIGH |
| `POSPage.js` | Good | h-6 touch targets too small | P2 HIGH |
| `IoTDashboard.js` | Partial | dialog max-w no mobile | P2 HIGH |
| `PlayerDashboard.js` | Good | missing sm grid breakpoints | P3 MEDIUM |
| `VenueOwnerDashboard.js` | Good | pill text small, gaps fixed | P3 MEDIUM |
| `ExplorePage.js` | Good | text-[9px] badges | P3 MEDIUM |
| `VenueDetail.js` | Good | text-[8px] offer badge | P3 MEDIUM |
| `VenueDiscovery.js` | Good | minor gap tweaks | P4 LOW |
| `MatchmakingPage.js` | Good | text-[10px] badges (ok) | P4 LOW |
| `TeamsPage.js` | Good | text-[10px] labels (ok) | P4 LOW |
| `TournamentsPage.js` | Good | minor gap tweaks | P4 LOW |
| `TournamentDetailPage.js` | Good | overflow-x handled | OK |
| `CommunitiesPage.js` | Good | minor gap tweaks | P4 LOW |
| `GroupDetailPage.js` | Good | dialog max-w | P3 MEDIUM |
| `BookmarksPage.js` | Good | pb-24 md:pb-6 correct | OK |
| `NotificationsPage.js` | Good | dialog max-w | P3 MEDIUM |
| `HighlightsPage.js` | Good | text-[10px] throughout (ok) | OK |
| `SocialFeedPage.js` | Excellent | best responsive code | OK |
| `CoachDashboard.js` | Good | dialog max-w, gaps | P3 MEDIUM |
| `CoachListingPage.js` | Good | overflow-x handled | OK |
| `CoachPublicProfilePage.js` | Good | overflow-x handled | OK |
| `CoachSettingsPage.js` | Good | dialog max-w | P3 MEDIUM |
| `ProfilePage.js` | Good | dialog max-w | P3 MEDIUM |
| `PlayerCardPage.js` | Good | overflow-x handled | OK |
| `RatingProfilePage.js` | Good | minor tweaks | P4 LOW |
| `SuperAdminDashboard.js` | Good | dialog max-w | P3 MEDIUM |
| `PrivacySettingsPage.js` | Good | minor tweaks | P4 LOW |
| `SplitPaymentPage.js` | Good | minor tweaks | P4 LOW |
| `PublicVenuePage.js` | Good | minor tweaks | P4 LOW |
| `ContactPage.js` | Good | responsive padding exists | OK |
| `TermsPage.js` | Good | minor tweaks | P4 LOW |
| `RefundPolicyPage.js` | Good | tables have overflow-x | OK |
| `NotFoundPage.js` | Good | simple page | OK |
| `AuthPage.js` | Good | responsive layout | OK |
| `LandingPage.js` | Partial | depends on simteste fix | P1 CRITICAL |

---

## TESTING CHECKLIST

### Devices to Test
- iPhone SE (375 × 667) — smallest common phone
- iPhone 14 (390 × 844) — standard phone
- iPhone 14 Pro Max (430 × 932) — large phone
- iPad Mini (744 × 1133) — small tablet
- iPad Air (820 × 1180) — standard tablet
- Galaxy A12 (360 × 800) — Android budget phone

### What to Check
1. No horizontal scrollbar on any page (except intentional scroll areas)
2. All text readable without zooming
3. All buttons tappable without mis-taps
4. Bottom nav doesn't overlap content
5. Dialogs don't overflow screen
6. Forms usable — inputs large enough to type into
7. Images don't break layout
8. Cards stack properly on mobile
9. Tab navigation scrollable when overflow
10. Dark mode looks correct on all sizes

### Browser DevTools Quick Test
```
Chrome → F12 → Toggle device toolbar (Ctrl+Shift+M)
→ Select "iPhone SE" → scroll through ALL pages
→ Select "iPad Air" → check sidebar/layout
→ Select "Responsive" → drag to 320px width → check for breaks
```

---

## EXECUTION ORDER

### Phase 1 — Critical (Do First)
1. Fix `index.css` `.simteste` class
2. Fix `App.js` main layout padding/gap
3. Fix `AboutPage.js` stats grid
4. Fix `Navbar.js` text sizes

### Phase 2 — High Impact
5. Fix `ChatPage.js` message width
6. Fix `POSPage.js` touch targets
7. Fix `IoTDashboard.js` dialog widths
8. Add tablet search icon to `Navbar.js`

### Phase 3 — Polish
9. Fix all dialog `max-w` across all pages
10. Fix grid gaps (responsive) across all pages
11. Fix missing grid breakpoints in `PlayerDashboard.js`
12. Add safe-area-inset support

### Phase 4 — Verify
13. Test all pages on iPhone SE (375px)
14. Test all pages on iPad Air (820px)
15. Test dark mode on mobile
16. Verify no regressions

---

*Guide created: 2026-03-01*
*Reference: HORIZON_UI_GUIDE.md for design tokens*
*Total files to fix: ~15 files (P1-P3)*
*Estimated changes: ~50 line edits across all files*
