# Profile Components Architecture

This directory contains a modular, component-based architecture for the Profile page, following React best practices and the .agent skills guidelines.

## Component Structure

```
profile/
├── ProfileHeader.js           # Avatar, name, email, role badge
├── PlayerStats.js             # Player statistics grid
├── VenueOwnerStats.js         # Venue owner statistics grid
├── CoachStats.js              # Coach statistics grid
├── OverallScoreCard.js        # Player overall score display
├── VerificationBanner.js      # Document verification status banners
├── PasswordChangeSection.js   # Password change form (collapsible)
├── PersonalInfoForm.js        # Personal info edit/display form
├── BookingHistory.js          # Booking history list
├── PerformanceTab.js          # Performance data and records
└── README.md                  # This file
```

## Design Principles

### 1. **Single Responsibility**
Each component has one clear purpose:
- `ProfileHeader` → Display user avatar and basic info
- `PlayerStats` → Display player statistics
- `PersonalInfoForm` → Handle personal info editing

### 2. **Composition Over Inheritance**
Components are composed together rather than using complex inheritance:
```jsx
<ProfileHeader user={user} onAvatarUpload={handleUpload} />
<PlayerStats user={user} stats={stats} tier={tier} />
```

### 3. **Props-Based Configuration**
Components receive data via props, making them:
- Testable
- Reusable
- Predictable

### 4. **Performance Optimized**
Following React Best Practices from .agent skills:
- `useMemo` for expensive calculations
- `useCallback` for stable function references
- Parallel data fetching with `Promise.all()`
- Derived state calculated during render

### 5. **Accessibility First**
Following Web Interface Guidelines from .agent skills:
- Proper `htmlFor` on labels
- `aria-label` on icon buttons
- `inputMode` for mobile keyboards
- `focus-visible` for keyboard navigation
- Semantic HTML elements

## Component Details

### ProfileHeader
**Purpose:** Display user avatar, name, email, and role badge

**Props:**
- `user` - User object with name, email, avatar, role
- `playerCard` - Player card data for verification badge
- `uploadingAvatar` - Boolean for upload state
- `onAvatarUpload` - Callback for avatar upload

**Features:**
- Clickable avatar with hover overlay
- Camera icon on hover
- Loading spinner during upload
- Verification badge for verified users
- Accessible file input

### PlayerStats
**Purpose:** Display player statistics in a grid

**Props:**
- `user` - User object with skill_rating, reliability_score, no_shows
- `stats` - Statistics object with total_games, wins, losses, draws
- `tier` - Tier object with label, color, bg

**Features:**
- Responsive grid (2 cols mobile, 3-4 cols desktop)
- Color-coded stat cards
- Tabular numbers for alignment
- Hover effects

### PersonalInfoForm
**Purpose:** Display and edit personal information

**Props:**
- `user` - User object
- `form` - Form state object
- `setForm` - Form state setter
- `editing` - Boolean for edit mode

**Features:**
- Role-specific fields (player, venue_owner, coach)
- Proper form labels and inputs
- Phone number formatting
- Display mode with InfoRow components
- Accessibility attributes

### PasswordChangeSection
**Purpose:** Collapsible password change form

**Features:**
- Collapsible section
- Show/hide password toggle
- Password validation
- Loading state
- Toast notifications

### BookingHistory
**Purpose:** Display list of bookings

**Props:**
- `bookings` - Array of booking objects

**Features:**
- Empty state
- Status badges
- Formatted dates and times
- Responsive layout

### PerformanceTab
**Purpose:** Display performance data and records

**Props:**
- `career` - Career data object
- `careerLoading` - Boolean for loading state

**Features:**
- Performance stats grid
- Records timeline
- Sport breakdown
- Source breakdown
- Loading and empty states

## Usage Example

```jsx
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { PlayerStats } from "@/components/profile/PlayerStats";
import { PersonalInfoForm } from "@/components/profile/PersonalInfoForm";

function ProfilePage() {
  const { user } = useAuth();
  const [form, setForm] = useState({});
  const [editing, setEditing] = useState(false);

  return (
    <div>
      <ProfileHeader
        user={user}
        uploadingAvatar={false}
        onAvatarUpload={handleUpload}
      />
      
      {user?.role === "player" && (
        <PlayerStats user={user} stats={stats} tier={tier} />
      )}
      
      <PersonalInfoForm
        user={user}
        form={form}
        setForm={setForm}
        editing={editing}
      />
    </div>
  );
}
```

## Testing

Each component can be tested independently:

```jsx
import { render, screen } from "@testing-library/react";
import { ProfileHeader } from "./ProfileHeader";

test("displays user name", () => {
  const user = { name: "John Doe", email: "john@example.com" };
  render(<ProfileHeader user={user} />);
  expect(screen.getByText("John Doe")).toBeInTheDocument();
});
```

## Benefits of This Architecture

### 1. **Maintainability**
- Easy to locate and fix bugs
- Clear component boundaries
- Self-documenting code structure

### 2. **Reusability**
- Components can be used in other pages
- Easy to create variations
- Consistent UI patterns

### 3. **Testability**
- Each component can be tested in isolation
- Mock props easily
- Clear input/output contracts

### 4. **Performance**
- Smaller components = smaller re-render scope
- Easier to optimize individual components
- Better code splitting opportunities

### 5. **Developer Experience**
- Easier onboarding for new developers
- Clear file organization
- Predictable patterns

### 6. **Scalability**
- Easy to add new features
- Components can be extended without breaking existing code
- Clear separation of concerns

## Migration from Monolithic ProfilePage

The original `ProfilePage.js` (1684 lines) has been refactored into:
- 1 main page component (~200 lines)
- 10 focused components (~100-200 lines each)

**Benefits:**
- 90% reduction in main file size
- Each component is independently testable
- Easier to understand and modify
- Better performance through targeted re-renders

## Future Enhancements

Potential improvements:
1. Add Storybook stories for each component
2. Create unit tests for all components
3. Add TypeScript types
4. Extract common patterns into hooks
5. Add error boundaries for each major section
6. Implement skeleton loaders for better UX
