# SuperAdminDashboard — URL Persistence & Re-render Fix

## Page: `/admin` (SuperAdminDashboard.js)

---

## Problem

The SuperAdmin dashboard had **3 issues**:

### 1. Missing URL persistence on some tabs
- **VenuesTab**: Pagination (`page`) was not persisted to URL.
- **PayoutsTab**: Pagination (`pendingPage`, `historyPage`) was not persisted to URL.
- Main tab, UsersTab filter/page, SettingsTab subtab, PayoutsTab subtab/search — already had persistence.

### 2. Main tab lost on refresh (race condition)
- When clicking a main tab (e.g., "users"), parent and child `useEffect` both called `setSearchParams` in the same render cycle.
- Both read the **same stale `prev`** (pre-click URL). The child's call executed last and overwrote the parent's `tab` param.
- On refresh, `tab` was gone — fell back to "overview".

### 3. Cascading re-renders from `useSearchParams`
- React Router's `setSearchParams` gets a **new identity on every URL change** (it's `useCallback` depending on `searchParams`).
- Every sync `useEffect` had `setSearchParams` as a dependency.
- Result: URL write -> `searchParams` changes -> `setSearchParams` changes -> ALL effects re-fire -> another URL write -> re-render cascade.

---

## Solution

### Approach: Eliminate `useSearchParams` entirely

Following [Vercel React Best Practices](.agent/skills/vercel-react-best-practices/AGENTS.md):
- **Rule 5.7** — Put interaction logic in event handlers, not state + effect.
- **Rule 8.2/8.3** — Use refs/stable callbacks to prevent effect re-runs.

### Utilities added (top of SuperAdminDashboard.js)

```js
// Stable URL param writer — no React Router subscription, no re-renders
function replaceParams(updates) {
  const url = new URL(window.location);
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "" || value === false) url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  window.history.replaceState(null, "", url.pathname + url.search);
}

function getInitParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}
```

### Pattern applied to every tab component

**Before (bad — causes re-renders):**
```js
const [searchParams, setSearchParams] = useSearchParams();
const [filter, setFilter] = useState(searchParams.get("filter") || "all");

// Sync effect — re-fires when setSearchParams identity changes
useEffect(() => {
  setSearchParams(prev => { ... }, { replace: true });
}, [filter, setSearchParams]); // setSearchParams in deps = cascading re-renders
```

**After (good — zero re-renders):**
```js
// One-time read on mount — no subscription
const [filter, setFilter] = useState(() => getInitParam("filter") || "all");

// URL sync in API callback — no effect needed
const load = useCallback((p = 1) => {
  adminAPI.users(params).then(r => {
    setPage(data.page || p);
    replaceParams({ filter: f === "all" ? null : f, page: actualPage > 1 ? actualPage : null });
  });
}, []);

// URL sync in event handler — no effect needed
<button onClick={() => { setFilter(f); filterRef.current = f; load(1); }}>
```

### Main component tab handling

```js
// No useSearchParams, no effects
const [activeTab, setActiveTab] = useState(() => getInitParam("tab") || "overview");

const handleTabChange = useCallback((newTab) => {
  setActiveTab(newTab);
  replaceParams({ tab: newTab === "overview" ? null : newTab });
}, []);
```

---

## URL Params Reference (all tabs)

| Param | Tab | Purpose | Default (not in URL) |
|---|---|---|---|
| `tab` | Main | Active main tab | `overview` |
| `filter` | Users | User role/status filter | `all` |
| `page` | Users | User list pagination | `1` |
| `vp` | Venues | Venue list pagination | `1` |
| `subtab` | Settings | Settings sub-tab | `payments` |
| `ptab` | Payouts | Payouts sub-tab | `pending` |
| `q` | Payouts | Payout search query | `""` |
| `pp` | Payouts | Pending payouts page | `1` |
| `hp` | Payouts | History payouts page | `1` |

**Why distinct param names?**
- `page` (Users) vs `vp` (Venues) vs `pp`/`hp` (Payouts) — prevents collision when switching tabs. Leftover params from inactive tabs are harmless and preserve state when switching back.

---

## Skeleton Loading States

Replaced plain spinner (`animate-spin` div) with content-matching skeleton components.

| Tab | Skeleton Component | Location |
|---|---|---|
| Overview | `<AdminSkeleton />` | Already existed |
| Users | `<AdminUsersSkeleton />` | `SkeletonLoader.js` (new) |
| Venues | `<AdminVenuesSkeleton />` | `SkeletonLoader.js` (new) |
| Settings | `<AdminSettingsSkeleton />` | `SkeletonLoader.js` (new) |
| Payouts | `<AdminPayoutsSkeleton />` | `SkeletonLoader.js` (new) |

---

## Files Changed

| File | Changes |
|---|---|
| `src/pages/SuperAdminDashboard.js` | Removed `useSearchParams` import. Added `replaceParams`/`getInitParam` utils. Converted all 5 components to handler-based URL sync. Removed all sync `useEffect`s. Added skeleton imports. |
| `src/components/SkeletonLoader.js` | Added `AdminUsersSkeleton`, `AdminVenuesSkeleton`, `AdminSettingsSkeleton`, `AdminPayoutsSkeleton`. |

---

## Key Behaviors

- **Refresh**: All state (tab, subtab, filters, pagination) persists via URL params.
- **Sidebar navigation**: Goes to bare `/admin` (no params) — everything resets.
- **Tab switching within admin**: Other tabs' params stay in URL. Switching back restores previous state.
- **Re-renders**: Only from actual state changes. Zero URL-subscription re-renders.
