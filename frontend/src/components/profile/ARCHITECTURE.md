# Profile Components Architecture Diagram

## Component Hierarchy

```
ProfilePageRefactored
│
├─── ProfileHeader
│    ├─── Avatar (clickable with upload)
│    ├─── User Info (name, email)
│    └─── Role Badge
│
├─── Stats Section (conditional by role)
│    ├─── PlayerStats (if role === "player")
│    │    └─── StatCard × 7 (rating, games, wins, etc.)
│    │
│    ├─── VenueOwnerStats (if role === "venue_owner")
│    │    └─── StatCard × 4 (venues, bookings, revenue, rating)
│    │
│    └─── CoachStats (if role === "coach")
│         └─── StatCard × 4 (sessions, revenue, rating, subscribers)
│
├─── OverallScoreCard (if playerCard exists)
│    ├─── Circular Progress
│    ├─── Score Display
│    └─── Tier Badge
│
├─── VerificationBanner (conditional)
│    └─── Status Message (rejected/pending/not_uploaded)
│
└─── Tabs
     │
     ├─── Info Tab
     │    ├─── PersonalInfoForm
     │    │    ├─── Display Mode
     │    │    │    └─── InfoRow × N
     │    │    │
     │    │    └─── Edit Mode
     │    │         ├─── PlayerFields (if player)
     │    │         ├─── VenueOwnerFields (if venue_owner)
     │    │         └─── CoachFields (if coach)
     │    │
     │    ├─── PasswordChangeSection
     │    │    ├─── Collapsible Header
     │    │    └─── Password Form (when expanded)
     │    │
     │    └─── Logout Button
     │
     ├─── History Tab (player only)
     │    └─── BookingHistory
     │         └─── BookingCard × N
     │
     └─── Performance Tab (player only)
          └─── PerformanceTab
               ├─── PerformanceStats
               │    └─── StatCard × 4
               │
               ├─── RecordsTimeline
               │    └─── RecordCard × N
               │
               ├─── SportBreakdown
               │    └─── Badge × N
               │
               └─── SourceBreakdown
                    └─── Row × N
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     ProfilePageRefactored                    │
│                                                              │
│  State:                                                      │
│  • user, stats, bookings, career, playerCard               │
│  • form, editing, saving                                    │
│  • ownerVenues, venueAnalytics, reviewSummaries            │
│  • coachStats, coachOrgs, coachSessions                    │
│                                                              │
│  Effects:                                                    │
│  • Load data on mount (parallel with Promise.all)          │
│  • Initialize form based on user role                       │
│                                                              │
│  Handlers:                                                   │
│  • handleSave (useCallback)                                 │
│  • handleAvatarUpload (useCallback)                         │
│                                                              │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ Props ↓
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
┌──────────────┐ ┌──────────┐ ┌─────────────┐
│ProfileHeader │ │  Stats   │ │    Tabs     │
│              │ │Components│ │             │
│Props:        │ │          │ │Props:       │
│• user        │ │Props:    │ │• user       │
│• playerCard  │ │• user    │ │• form       │
│• uploading   │ │• stats   │ │• bookings   │
│• onUpload    │ │• tier    │ │• career     │
└──────────────┘ └──────────┘ └─────────────┘
```

## Component Communication

### Parent → Child (Props)
```javascript
// ProfilePageRefactored passes data down
<ProfileHeader
  user={user}
  playerCard={playerCard}
  uploadingAvatar={uploadingAvatar}
  onAvatarUpload={handleAvatarUpload}
/>
```

### Child → Parent (Callbacks)
```javascript
// Child calls parent's callback
const handleAvatarUpload = useCallback(async (e) => {
  // Update parent state
  setUploadingAvatar(true);
  // ... upload logic
}, [updateUser]);
```

### Sibling Communication (Lifted State)
```javascript
// State lifted to parent
const [editing, setEditing] = useState(false);

// Shared between Edit button and Form
<Button onClick={() => setEditing(true)}>Edit</Button>
<PersonalInfoForm editing={editing} />
```

## State Management Strategy

### Local State (useState)
Used for:
- UI state (editing, uploading, loading)
- Form data
- Temporary data

### Derived State (useMemo)
Used for:
- Calculated values (tier from rating)
- Filtered/sorted data
- Expensive computations

### Callbacks (useCallback)
Used for:
- Event handlers passed to children
- Functions with dependencies
- Preventing unnecessary re-renders

### Context (useAuth)
Used for:
- Global user state
- Authentication methods
- User updates

## Performance Optimization Points

### 1. Parallel Data Loading
```javascript
// All independent requests start simultaneously
Promise.all([
  analyticsAPI.player(),
  bookingAPI.list(),
  careerAPI.getCareer(user.id),
  playerCardAPI.getCard(user.id)
])
```

### 2. Memoized Calculations
```javascript
// Only recalculates when skill_rating changes
const tier = useMemo(() => {
  const r = user?.skill_rating || 1500;
  // ... calculation
}, [user?.skill_rating]);
```

### 3. Stable Callbacks
```javascript
// Function reference stays the same
const handleSave = useCallback(async () => {
  // ... save logic
}, [form, user?.role, updateUser]);
```

### 4. Component-Level Re-renders
```javascript
// Only ProfileHeader re-renders when avatar changes
// Other components remain unchanged
<ProfileHeader uploadingAvatar={uploadingAvatar} />
```

## Accessibility Architecture

### Semantic HTML
```
<main>
  <header> (ProfileHeader)
  <section> (Stats)
  <section> (Tabs)
    <nav> (TabsList)
    <article> (TabsContent)
```

### ARIA Labels
```javascript
// Icon buttons
<button aria-label="Change profile photo">
  <Camera aria-hidden="true" />
</button>

// Form inputs
<Label htmlFor="profile-name">Name</Label>
<Input id="profile-name" name="name" />
```

### Keyboard Navigation
```javascript
// Focus visible only on keyboard
className="focus-visible:ring-2"

// Tab navigation
<Tabs defaultValue="info">
  <TabsList>
    <TabsTrigger value="info">Info</TabsTrigger>
  </TabsList>
</Tabs>
```

## Error Handling Strategy

### API Errors
```javascript
// Graceful fallback
const statsPromise = analyticsAPI.player()
  .catch(() => ({ data: null }));

// Toast notifications
try {
  await authAPI.updateProfile(payload);
  toast.success("Profile updated!");
} catch (err) {
  toast.error("Failed to update profile");
}
```

### Loading States
```javascript
// Component-level loading
{careerLoading ? (
  <Loader2 className="animate-spin" />
) : (
  <PerformanceTab career={career} />
)}
```

### Empty States
```javascript
// Meaningful empty states
{bookings.length === 0 ? (
  <div>
    <Calendar className="h-12 w-12" />
    <p>No booking history</p>
  </div>
) : (
  <BookingHistory bookings={bookings} />
)}
```

## Testing Strategy

### Unit Tests
```javascript
// Test individual components
describe("ProfileHeader", () => {
  it("displays user name", () => {
    render(<ProfileHeader user={{ name: "John" }} />);
    expect(screen.getByText("John")).toBeInTheDocument();
  });
});
```

### Integration Tests
```javascript
// Test component interactions
describe("PersonalInfoForm", () => {
  it("saves changes when clicking save", async () => {
    const mockSave = jest.fn();
    render(<PersonalInfoForm onSave={mockSave} />);
    // ... interact with form
    expect(mockSave).toHaveBeenCalled();
  });
});
```

### E2E Tests
```javascript
// Test full user flows
test("user can update profile", async () => {
  // Navigate to profile
  // Click edit
  // Change name
  // Click save
  // Verify success message
});
```

## Scalability Considerations

### Adding New Roles
```javascript
// Easy to add new role-specific components
{user?.role === "new_role" && (
  <NewRoleStats stats={newRoleStats} />
)}
```

### Adding New Tabs
```javascript
// Simple tab addition
<TabsTrigger value="new-tab">New Tab</TabsTrigger>
<TabsContent value="new-tab">
  <NewTabComponent />
</TabsContent>
```

### Adding New Features
```javascript
// Create new component
// Import and use
import { NewFeature } from "@/components/profile/NewFeature";

<NewFeature data={data} />
```

## Maintenance Guidelines

### When to Create a New Component
- Component exceeds 200 lines
- Logic is reused in multiple places
- Component has multiple responsibilities
- Testing becomes difficult

### When to Extract a Hook
- Logic is reused across components
- Complex state management
- Side effects need to be shared

### When to Lift State
- Multiple components need the same data
- Sibling components need to communicate
- Parent needs to control child state

## Conclusion

This architecture provides:
- ✅ Clear separation of concerns
- ✅ Easy to understand and modify
- ✅ Optimized performance
- ✅ Accessible by default
- ✅ Testable components
- ✅ Scalable structure
