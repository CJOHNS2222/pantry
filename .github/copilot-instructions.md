# Smart Pantry Chef - AI Coding Guidelines

## Architecture Overview
This is a React/TypeScript mobile-first app using Firebase Firestore for real-time data sync across household members. Key architectural patterns:

### Core Data Flow
- **Real-time subscriptions**: All data uses Firestore `onSnapshot` for live updates
- **Household sharing**: Data is scoped to households, not individual users
- **Optimistic updates**: UI updates immediately, then syncs with Firestore
- **Usage limits**: Subscription-based limits enforced at service layer

### Component Patterns
```typescript
// Lazy load major components for performance
const Component = React.lazy(() => import('./Component'));

// Premium features wrapper
<PremiumFeature feature="mealPlanning">
  <Component />
</PremiumFeature>

// Error boundaries for resilience
<ErrorBoundary>
  <Component />
</ErrorBoundary>
```

### State Management
- **useDataManagement hook**: Centralizes all CRUD operations and real-time subscriptions
- **Custom hooks**: `useAuth`, `useSettings`, `useTheme`, `useToasts` for specific concerns
- **Local state**: Component-level state for UI interactions
- **Firestore direct**: Services handle direct Firestore operations

## Critical Workflows

### Build & Deploy
```bash
# Development
npm run dev                    # Vite dev server on port 3000

# Production build
npm run build                  # Creates dist/ with PWA assets
npm run build:release          # Syncs changelog + builds

# Mobile deployment
npx cap sync android           # Sync web assets to Android
npx cap open android           # Open in Android Studio
```

### Testing
```bash
npm run test                   # Run Vitest tests
npm run test:ui               # Open Vitest UI
```

### Release Process
```bash
# Update CHANGELOG.md first
npm run sync-release-notes     # Converts markdown to android/release-notes.txt
npm run build:release          # Production build with synced notes
```

## Key Conventions

### Data Structures
```typescript
// User-scoped data (Firestore collections under /users/{userId}/)
userMealPlan: DayPlan[]        // /users/{userId}/mealPlan
userInventory: PantryItem[]    // /users/{userId}/inventory
userShoppingList: ShoppingItem[] // /users/{userId}/shoppingList
userSavedRecipes: SavedRecipe[] // /users/{userId}/savedRecipes
userUsage: UsageLimits         // /users/{userId}/usage

// Household-scoped data (Firestore collections under /households/{householdId}/)
sharedInventory: PantryItem[]  // /households/{householdId}/inventory
sharedMealPlan: DayPlan[]      // /households/{householdId}/mealPlan
sharedShoppingList: ShoppingItem[] // /households/{householdId}/shoppingList
sharedRecipes: SavedRecipe[]   // /households/{householdId}/sharedRecipes
household: Household           // /households/{householdId}
```

### Service Layer Pattern
```typescript
// services/exampleService.ts
class ExampleService {
  static async operation(params: Params): Promise<Result> {
    try {
      const docRef = doc(db, 'collection', id);
      await setDoc(docRef, data);
      AnalyticsService.trackEvent('operation_completed', { id });
    } catch (error) {
      console.error('Operation failed:', error);
      throw error;
    }
  }
}
```

### Component Props Interface
```typescript
interface ComponentProps {
  // Data props first
  data: DataType;
  onDataChange: (data: DataType) => void;

  // Callback props
  onAction: () => void;

  // Configuration
  settings?: SettingsType;

  // User context
  user: User;
}
```

### Error Handling
```typescript
// Async operations with user feedback
try {
  await operation();
  addToast('Success message');
} catch (error) {
  console.error('Operation failed:', error);
  addToast('Error message', 'error');
}
```

## Mobile-Specific Patterns

### Back Button Handling
```typescript
// App.tsx - Global back button listener
useEffect(() => {
  const handleBackButton = (event: BackButtonListenerEvent) => {
    // Priority: modals > search > default navigation
    if (hasOpenModal) {
      closeModal();
      event.preventDefault();
    }
  };

  App.addListener('backButton', handleBackButton);
  return () => App.removeListener('backButton', handleBackButton);
}, [hasOpenModal]);
```

### Capacitor Plugins
```typescript
// capacitor.config.ts
plugins: {
  LocalNotifications: {},  // Daily reminders
  Camera: {},             // Pantry scanning
  App: {}                 // Back button, app state
}
```

## Subscription System

### Usage Limits Pattern
```typescript
// Check limits before operations
const canSaveRecipe = await checkRecipeSaveLimit();
if (!canSaveRecipe) {
  setRecipeSaveLimitExceeded(true);
  return;
}

// Track usage after successful operations
await UsageService.trackRecipeSave(user.id);
```

### Premium Feature Wrapper
```typescript
// components/PremiumFeature.tsx
<PremiumFeature feature="mealPlanning">
  <AdvancedMealPlanner />
</PremiumFeature>
```

## Firebase Integration

### Real-time Subscriptions
```typescript
// User-scoped subscription pattern
useEffect(() => {
  if (!user?.id) return;

  const unsubscribe = onSnapshot(
    collection(db, 'users', user.id, 'inventory'),
    (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInventory(items);
    }
  );

  return unsubscribe;
}, [user?.id]);

// Household-scoped subscription pattern
useEffect(() => {
  if (!user?.householdId) return;

  const unsubscribe = onSnapshot(
    collection(db, 'households', user.householdId, 'inventory'),
    (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSharedInventory(items);
    }
  );

  return unsubscribe;
}, [user?.householdId]);
```

### Batch Operations
```typescript
// For multiple related writes
const batch = writeBatch(db);
batch.set(doc1, data1);
batch.set(doc2, data2);
await batch.commit();
```

## Analytics Integration

### Event Tracking
```typescript
// Track user actions
AnalyticsService.trackRecipeSave(recipe.id, recipe.title);
AnalyticsService.trackTabChange(newTab);

// Track feature usage
AnalyticsService.trackMealPlanAdd(recipeId, recipeTitle, mealType);
```

## Testing Patterns

### Component Testing
```typescript
// Use React Testing Library
import { render, screen, fireEvent } from '@testing-library/react';

// Mock Firebase services
jest.mock('../services/firebaseConfig');
```

## Common Gotchas

### Firestore Data Types
- Use `Timestamp` for dates, not ISO strings
- Clean undefined fields: `cleanObject(obj)` before saving
- Household-scoped collections: `/households/{householdId}/collection`

### Mobile Navigation
- Always handle back button in modals
- Use `setActiveTab()` for navigation, not direct routing
- Test double-tap exit on Android

### State Synchronization
- Real-time updates can cause race conditions
- Use `useEffect` dependencies carefully
- Validate data before saving to Firestore

### Performance
- Lazy load components in MainContent.tsx
- Use `React.memo` for expensive re-renders
- Debounce search inputs (300ms)

### Quantity Management
- Use `parseQuantity()` for parsing ingredient amounts
- Use `combineQuantities()` when merging same items
- Use `subtractQuantities()` for recipe consumption
- Use `formatItemQuantity()` for display
- Visual quantity selector in ItemDetailModal for easy estimation

### AI Integration Patterns
```typescript
// Gemini service for recipe generation
import { analyzePantryImage } from '../services/geminiService';

// Check feature availability before AI operations
if (canUseGemini()) {
  const recipes = await analyzePantryImage(imageData);
}
```

### Search & Filtering
```typescript
// Use searchUtils for pantry item filtering
import { searchPantryItems, filterPantryItems } from '../utils/searchUtils';

// Persist filter state
const filter = loadPantryFilter();
savePantryFilter(updatedFilter);
```

### Bulk Operations
```typescript
// Bulk item management in PantryScanner
const [bulkMode, setBulkMode] = useState(false);
const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

// Bulk quantity editing workflow
const [bulkQuantityEditItems, setBulkQuantityEditItems] = useState<PantryItem[]>([]);
```

## Cost Considerations

### Billing Awareness
- **AI Utilization**: Maintain low overhead costs on Google Gemini API usage
- **Firebase Monetization**: Be mindful of Firestore read/write operations and storage costs
- **Billing Limits**: Any changes affecting usage limits, API calls, or storage should be discussed
- **Subscription Features**: Premium features should respect usage limits to avoid unexpected costs

## Environment Setup
```bash
# Required environment variables (.env.local)
VITE_GEMINI_API_KEY=...
VITE_STRIPE_PUBLISHABLE_KEY=...
STRIPE_SECRET_KEY=...
VITE_PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
```

## Directory Structure
```
components/          # UI components
  layout/           # AppHeader, AppNavigation, MainContent
  *.tsx             # Feature components

services/           # Business logic
  *.ts              # Firebase operations, external APIs

hooks/              # State management
  use*.ts           # Custom React hooks

types/              # TypeScript definitions
  *.ts              # Interfaces, enums

utils/              # Helper functions
  appUtils.ts       # Core utilities

public/             # Static assets
dist/               # Build output (gitignored)
```

Remember: This app prioritizes real-time collaboration and mobile-first UX. Always test changes on both web and mobile platforms.