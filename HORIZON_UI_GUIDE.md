# HORIZON UI Style Guide
## The definitive rulebook — strictly follow this for every page

> Reference source: `SuperAdminDashboard.js` + `frontend/src/index.css`
> This guide covers: Components · Icons · Colors · Typography · UX Patterns · Animations

---

## 1. PAGE LAYOUT

```jsx
// Outer page wrapper
<div className="min-h-screen bg-transparent pb-20 md:pb-8">
  <div className="w-full py-6 flex flex-col gap-8 items-start">
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full">

      {/* Page header */}
      <div className="mb-8">
        <h1 className="admin-page-title mb-1">Page Title</h1>
        <p className="text-sm text-muted-foreground">Subtitle description</p>
      </div>

      {/* Content */}
    </motion.div>
  </div>
</div>
```

---

## 2. TAB NAVIGATION

```jsx
// Add TabsIndicator component to the file
function TabsIndicator() {
  return (
    <div className="absolute bottom-0 left-0 w-full h-[3px] bg-brand-600 rounded-t-full opacity-0 transition-opacity [[data-state=active]_&]:opacity-100" />
  );
}

// Tab navigation
<div className="flex items-center justify-between border-b border-border/40 pb-2 mb-6">
  <TabsList className="bg-transparent h-auto p-0 rounded-none space-x-8 flex items-center w-full justify-start overflow-x-auto hide-scrollbar">
    <TabsTrigger value="tab1"
      className="relative pb-2 admin-btn text-sm text-muted-foreground hover:text-foreground data-[state=active]:text-brand-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-none bg-transparent shadow-none transition-colors capitalize px-0">
      Tab Name
      <TabsIndicator />
    </TabsTrigger>
  </TabsList>
</div>
```

### Sub-tab / Filter Pills

```jsx
// Individual pill buttons (NOT a container with bg)
<div className="flex flex-wrap gap-3 mb-6">
  {["all", "active", "pending"].map(f => (
    <button key={f} onClick={() => setFilter(f)}
      className={`px-5 py-2 rounded-full admin-btn transition-all duration-300 active:scale-95 ${
        filter === f
          ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
          : "bg-card border border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
      }`}>
      {f}
    </button>
  ))}
</div>
```

---

## 3. CARDS

### Stat / Metric Card
```jsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: index * 0.08, duration: 0.4, ease: "easeOut" }}
  whileHover={{ y: -4, transition: { duration: 0.2 } }}
  className="bg-card rounded-[28px] p-7 border border-border/40 shadow-sm overflow-hidden relative group h-full flex flex-col justify-between transition-all duration-300"
>
  <div className="flex items-center justify-between mb-6">
    <div className="admin-label">{label}</div>
    <div className="p-3 rounded-2xl bg-brand-600/10 flex items-center justify-center border border-border/40">
      <Icon className="h-5 w-5 text-brand-600" />
    </div>
  </div>
  <div>
    <div className="admin-value mb-2">{value}</div>
    <div className="admin-label flex items-center gap-1.5 mt-2 bg-secondary/20 py-1.5 px-3 rounded-full w-fit border border-border/40">
      {subText}
    </div>
  </div>
</motion.div>
```

**Stat card icon color variants:**
| Color | bgClass | colorClass |
|-------|---------|------------|
| Brand | `bg-brand-600/10` | `text-brand-600` |
| Green | `bg-green-500/10` | `text-green-600` |
| Amber | `bg-amber-500/10` | `text-amber-500` |
| Red | `bg-red-500/10` | `text-red-500` |
| Purple | `bg-purple-500/10` | `text-purple-600` |

### List Card Container
```jsx
<div className="bg-card border border-border/40 rounded-[28px] overflow-hidden shadow-sm">
  <div className="divide-y divide-border/20">
    {items.map((item, i) => <ListItem key={item.id} item={item} index={i} />)}
  </div>
</div>
```

### Content / Detail Card
```jsx
<div className="bg-card rounded-[28px] p-7 border border-border/40 shadow-sm">
  {/* content */}
</div>
```

### Info / Summary Box
```jsx
<div className="bg-secondary/30 rounded-2xl p-4 space-y-2 text-sm">
  <div className="flex justify-between">
    <span className="text-muted-foreground">Label</span>
    <span className="font-medium">Value</span>
  </div>
</div>
```

### Warning / Alert Box
```jsx
// Amber warning
<div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1.5">
  <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
    <AlertCircle className="h-3.5 w-3.5" />
    Warning message
  </div>
</div>

// Error/destructive
<div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive">
  Error message
</div>
```

### Empty State
```jsx
<div className="bg-card border border-border/40 rounded-[28px] p-20 text-center flex flex-col items-center justify-center min-h-[300px]">
  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
    <div className="p-6 rounded-3xl bg-secondary/30 mb-4">
      <Icon className="h-10 w-10 text-muted-foreground/30" />
    </div>
    <p className="text-muted-foreground text-sm font-medium">No items found</p>
  </motion.div>
</div>
```

---

## 4. BUTTONS

| Variant | Classes |
|---------|---------|
| **Primary** | `bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all h-11 px-5` |
| **Primary Full-width** | `w-full h-12 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all` |
| **Secondary/Outline** | `admin-btn rounded-xl h-11 border border-border/40 bg-card text-foreground hover:bg-secondary` |
| **Destructive** | `text-destructive border-destructive/30 hover:bg-destructive/10 admin-btn h-11 rounded-xl` |
| **Ghost** | `text-muted-foreground hover:bg-secondary/50 h-8 px-3 text-xs rounded-full` |
| **Icon button** | `h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all` |
| **Filter pill active** | `px-5 py-2 rounded-full admin-btn bg-brand-600 text-white shadow-md shadow-brand-600/20` |
| **Filter pill inactive** | `px-5 py-2 rounded-full admin-btn bg-card border border-border/40 text-muted-foreground hover:text-foreground hover:border-border` |
| **Save (large)** | `w-full h-14 bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm tracking-wide rounded-full shadow-2xl shadow-brand-600/40 transition-all hover:scale-[1.01] active:scale-95` |

> **Rule:** Always use `admin-btn` class on ALL buttons. Never use `font-bold` on buttons.

---

## 5. INPUT & FORM FIELDS

```jsx
// Standard input
<Input className="h-11 rounded-xl bg-secondary/20 border-border/40 px-4 font-medium" />

// Textarea
<Textarea className="rounded-xl bg-secondary/20 border-border/40 px-4 py-3 font-medium" rows={3} />

// Select
<SelectTrigger className="h-11 rounded-xl bg-secondary/20 border-border/40">
  <SelectValue placeholder="Choose..." />
</SelectTrigger>

// Input with prefix
<div className="flex">
  <span className="inline-flex items-center px-3 bg-secondary/20 border border-r-0 border-border/40 rounded-l-xl admin-label select-none">+91</span>
  <Input className="rounded-l-none h-11 rounded-r-xl bg-secondary/20 border-border/40" />
</div>

// Form label
<label className="admin-section-label mb-1.5 block">Field Name</label>

// Form group spacing
<div className="space-y-1.5">
  <label className="admin-section-label">Label</label>
  <Input className="h-11 rounded-xl bg-secondary/20 border-border/40" />
</div>
```

---

## 6. BADGES & STATUS CHIPS

```jsx
// Standard badge usage
<Badge variant="outline" className="admin-badge px-3 py-1 rounded-full border-none bg-brand-600/10 text-brand-600">
  Active
</Badge>
```

**Color variants:**
| Status | Classes |
|--------|---------|
| Active / Success | `bg-green-500/10 text-green-600` |
| Pending / Warning | `bg-amber-500/10 text-amber-600` |
| Rejected / Error | `bg-red-500/10 text-red-600` |
| Brand / Primary | `bg-brand-600/10 text-brand-600` |
| Venue Owner | `bg-purple-500/10 text-purple-600` |
| Coach | `bg-blue-500/10 text-blue-600` |
| Player | `bg-emerald-500/10 text-emerald-600` |
| Neutral / Draft | `bg-secondary/50 text-muted-foreground` |

> **Rule:** Always add `admin-badge px-3 py-1 rounded-full border-none` to ALL badges.

---

## 7. TABLE

```jsx
<div className="bg-card border border-border/40 rounded-[28px] overflow-hidden shadow-sm">
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border/40">
          <th className="text-left p-4 admin-th">Column</th>
          <th className="text-right p-4 admin-th">Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <motion.tr key={row.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.03 }}
            className="border-b border-border/20 hover:bg-white/5 transition-colors">
            <td className="p-4 font-medium text-foreground">{row.name}</td>
            <td className="p-4 text-right font-medium text-brand-600">₹{row.amount}</td>
          </motion.tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
```

---

## 8. LIST ITEMS

```jsx
// Standard list item
<motion.div
  initial={{ opacity: 0, x: -10 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ delay: index * 0.03 }}
  className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group rounded-2xl"
>
  {/* Left: icon + info */}
  <div className="flex items-center gap-4 min-w-0">
    <div className="h-11 w-11 rounded-full flex items-center justify-center bg-brand-600/10 shrink-0">
      <Icon className="h-5 w-5 text-brand-600" />
    </div>
    <div className="min-w-0">
      <p className="admin-name truncate">{item.name}</p>
      <p className="admin-secondary truncate">{item.meta}</p>
    </div>
  </div>

  {/* Right: actions */}
  <div className="flex items-center bg-secondary/30 rounded-xl overflow-hidden border border-border/30 shrink-0">
    <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-600/10 transition-colors border-r border-border/30">
      <Eye className="h-3.5 w-3.5" /> View
    </button>
    <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors">
      <Trash2 className="h-3.5 w-3.5" /> Delete
    </button>
  </div>
</motion.div>
```

---

## 9. MODAL / DIALOG

```jsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-[28px] p-0">

    {/* Header */}
    <DialogHeader className="border-b border-border/40 pb-4 px-7 pt-7">
      <DialogTitle className="flex items-center gap-3 admin-heading">
        <div className="p-2.5 rounded-2xl bg-brand-600/10">
          <Icon className="h-5 w-5 text-brand-600" />
        </div>
        Dialog Title
      </DialogTitle>
      <DialogDescription className="admin-label mt-2">
        Description text
      </DialogDescription>
    </DialogHeader>

    {/* Body */}
    <div className="space-y-5 px-7 py-5">
      {/* form fields */}
      <div className="space-y-1.5">
        <label className="admin-section-label">Field Name</label>
        <Input className="h-11 rounded-xl bg-secondary/20 border-border/40" />
      </div>

      {/* Info summary box */}
      <div className="bg-secondary/30 rounded-2xl p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total</span>
          <span className="font-medium text-brand-600">₹500</span>
        </div>
      </div>
    </div>

    {/* Footer */}
    <div className="border-t border-border/40 px-7 py-4 flex gap-3">
      <Button variant="outline" className="flex-1 admin-btn rounded-xl h-11"
        onClick={() => setOpen(false)}>Cancel</Button>
      <Button className="flex-1 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl h-11 shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all">
        Confirm
      </Button>
    </div>

  </DialogContent>
</Dialog>
```

---

## 10. COLOR TOKENS

### Primary Brand
```
text-brand-600        bg-brand-600        border-brand-600
bg-brand-600/10       bg-brand-600/5      shadow-brand-600/20
hover:bg-brand-500    hover:bg-brand-700
```

### Semantic UI
```
bg-card               text-foreground       bg-background
bg-secondary          bg-secondary/20       bg-secondary/30
text-muted-foreground bg-muted              border-border/40
```

### Status Colors
```
Success:  text-green-600   bg-green-500/10   border-green-500/30
Warning:  text-amber-600   bg-amber-500/10   border-amber-500/30
Error:    text-red-600     bg-red-500/10     text-destructive
Info:     text-blue-600    bg-blue-500/10
Brand:    text-brand-600   bg-brand-600/10
```

### Role Colors
```
Player:      text-emerald-600  bg-emerald-500/10
Coach:       text-blue-600     bg-blue-500/10
Venue Owner: text-purple-600   bg-purple-500/10
Admin:       text-brand-600    bg-brand-600/10
```

> **Rule:** NEVER use `bg-primary`, `text-primary`, `bg-white`, `bg-slate-*`, `text-slate-*`. Always use semantic tokens.

---

## 11. TYPOGRAPHY

All classes defined in `frontend/src/index.css`:

| Class | CSS | Usage |
|-------|-----|-------|
| `admin-page-title` | `text-2xl font-display font-medium tracking-tight text-foreground` | Page `<h1>` |
| `admin-heading` | `text-lg font-medium tracking-tight text-foreground` | Section headings, dialog titles |
| `admin-value` | `text-3xl font-bold font-display text-foreground tracking-tight` | Large numbers/stats |
| `admin-name` | `text-base font-medium tracking-tight text-foreground` | Names in lists |
| `admin-secondary` | `text-sm font-medium text-muted-foreground opacity-70` | Secondary info (email, address) |
| `admin-label` | `text-sm font-medium text-muted-foreground` | Stat labels, descriptions |
| `admin-badge` | `text-xs font-medium uppercase tracking-wide` | Status/role badges |
| `admin-btn` | `text-xs font-medium tracking-wide` | ALL buttons text |
| `admin-th` | `text-xs font-medium text-muted-foreground uppercase tracking-wide` | Table headers |
| `admin-section-label` | `text-xs font-medium text-muted-foreground uppercase tracking-wide` | Form labels, section dividers |

---

## 12. ICONS

```jsx
// Standard sizes
h-3.5 w-3.5   // in badges/toolbar buttons
h-4 w-4       // inline with text
h-5 w-5       // in stat card headers
h-6 w-6       // in section headings
h-8 w-8       // in empty states
h-10 w-10     // in large empty states

// Icon in stat card (most common)
<div className="p-3 rounded-2xl bg-brand-600/10 flex items-center justify-center border border-border/40">
  <Icon className="h-5 w-5 text-brand-600" />
</div>

// Icon in section header
<div className="p-3 rounded-2xl bg-brand-600/10 shadow-inner">
  <Icon className="h-6 w-6 text-brand-600" />
</div>

// Icon in dialog title
<div className="p-2.5 rounded-2xl bg-brand-600/10">
  <Icon className="h-5 w-5 text-brand-600" />
</div>

// Icon in button/toolbar
<Icon className="h-3.5 w-3.5" />
```

---

## 13. ANIMATIONS (Framer Motion)

```jsx
// Stat card
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ delay: index * 0.08, duration: 0.4, ease: "easeOut" }}
whileHover={{ y: -4, transition: { duration: 0.2 } }}

// List item (staggered)
initial={{ opacity: 0, x: -10 }}
animate={{ opacity: 1, x: 0 }}
transition={{ delay: index * 0.03 }}

// Table row (staggered)
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
transition={{ delay: index * 0.03 }}

// Card/section entrance
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.4, ease: "easeOut" }}

// Empty state
initial={{ opacity: 0, scale: 0.95 }}
animate={{ opacity: 1, scale: 1 }}

// Tab content (AnimatePresence)
initial={{ opacity: 0, x: 10 }}
animate={{ opacity: 1, x: 0 }}
exit={{ opacity: 0, x: -10 }}
transition={{ duration: 0.2 }}
```

**Hover/Active CSS transitions:**
```
hover:bg-white/5 transition-colors
active:scale-95
active:scale-[0.98]
transition-all duration-300
```

---

## 14. SPACING RULES

| Context | Value |
|---------|-------|
| Card padding (main) | `p-7` |
| Card padding (compact) | `p-6` |
| List item padding | `p-4` |
| Dialog body | `px-7 py-5` |
| Dialog header | `px-7 pt-7 pb-4` |
| Section gap | `gap-6` |
| Grid gap | `gap-4` |
| Section bottom margin | `mb-6` |
| Input height | `h-11` |
| Button height (standard) | `h-11` |
| Button height (large) | `h-12` |

---

## 15. GRID LAYOUTS

```jsx
// Stat cards grid
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

// Two-column
<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

// Three-column
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

// Dialog form fields (two side by side)
<div className="grid grid-cols-2 gap-3">

// Dialog form fields (three)
<div className="grid grid-cols-3 gap-3">
```

---

## 16. DO's AND DON'Ts

### ✅ DO
- Use `bg-card` for all card backgrounds
- Use `rounded-[28px]` for cards, `rounded-xl` for inputs/buttons, `rounded-full` for pills/badges
- Use `border border-border/40` — single border, opacity 40
- Use `admin-btn` class on EVERY button
- Use `shadow-sm` on cards, `shadow-lg shadow-brand-600/20` on primary buttons
- Use `hover:bg-white/5` on list rows and table rows
- Use `text-brand-600` for primary accent (icons, values, links)
- Use `admin-heading` for section titles, `admin-label` for labels
- Add Framer Motion entrance animations on all cards and list items
- Use `TabsIndicator` component in all tab navigations

### ❌ DON'T
- Never use `glass-card` class (replace with explicit Tailwind)
- Never use `bg-primary` or `text-primary` (use `bg-brand-600`)
- Never use `bg-white` on cards (use `bg-card`)
- Never use `text-slate-*` colors (use semantic tokens)
- Never use `border-2` (use `border border-border/40`)
- Never use `rounded-lg` on cards (use `rounded-[28px]`)
- Never use `font-bold` on buttons (use `admin-btn`)
- Never use `bg-secondary/50 p-1 rounded-lg` as filter container (use individual pills)
- Never use hardcoded hex colors — always use CSS variables/tokens

---

## 17. LOADING / SPINNER

```jsx
// Inline spinner
<div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />

// Large spinner
<div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />

// Full page loading
<div className="flex items-center justify-center min-h-[200px]">
  <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
</div>
```

---

## 18. COMPLETE PAGE TEMPLATE

```jsx
export default function MyPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-transparent pb-20 md:pb-8">
      <div className="w-full py-6 flex flex-col gap-8 items-start">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          {/* Page header */}
          <div className="mb-8">
            <h1 className="admin-page-title mb-1">My Page</h1>
            <p className="text-sm text-muted-foreground">Page description</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Tab navigation */}
            <div className="flex items-center border-b border-border/40 pb-2 mb-6">
              <TabsList className="bg-transparent h-auto p-0 rounded-none space-x-8 flex items-center w-full justify-start overflow-x-auto hide-scrollbar">
                {["overview", "details", "settings"].map(tab => (
                  <TabsTrigger key={tab} value={tab}
                    className="relative pb-2 admin-btn text-sm text-muted-foreground hover:text-foreground data-[state=active]:text-brand-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-none bg-transparent shadow-none transition-colors capitalize px-0">
                    {tab}
                    <TabsIndicator />
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard icon={Users} label="Total" value="1,234" index={0} />
            </div>

            {/* Tab content */}
            <TabsContent value="overview" className="mt-0 outline-none">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card rounded-[28px] p-7 border border-border/40 shadow-sm">
                  {/* content */}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}

function TabsIndicator() {
  return (
    <div className="absolute bottom-0 left-0 w-full h-[3px] bg-brand-600 rounded-t-full opacity-0 transition-opacity [[data-state=active]_&]:opacity-100" />
  );
}

function StatCard({ icon: Icon, label, value, index = 0, colorClass = "text-brand-600", bgClass = "bg-brand-600/10" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="bg-card rounded-[28px] p-7 border border-border/40 shadow-sm overflow-hidden relative group h-full flex flex-col justify-between transition-all duration-300"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="admin-label">{label}</div>
        <div className={`p-3 rounded-2xl ${bgClass} flex items-center justify-center border border-border/40`}>
          <Icon className={`h-5 w-5 ${colorClass}`} />
        </div>
      </div>
      <div className="admin-value">{value}</div>
    </motion.div>
  );
}
```

---

*Last updated: based on SuperAdminDashboard.js — the single source of truth for HORIZON UI.*
