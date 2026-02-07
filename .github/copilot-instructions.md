# Smart Pantry Chef - AI Coding Guidelines

## Architecture Overview
This is a React/TypeScript mobile-first PWA using Firebase Firestore for real-time data sync across household members. Built with Vite + React 19 + TypeScript, deployed via Capacitor for Android/iOS.

### Tech Stack
- **Frontend**: React 19.2, TypeScript, Vite, Capacitor 7
- **Backend**: Firebase (Firestore, Functions, Analytics, Auth)
- **AI/ML**: Google Gemini API for recipe generation
- **Payments**: Stripe + PayPal subscription system
- **Mobile**: Capacitor with Camera, LocalNotifications, Push Notifications
- **Testing**: Vitest + Playwright E2E

### Core Data Flow
- **Real-time subscriptions**: All data uses Firestore `onSnapshot` for live updates
- **Household sharing**: Data is scoped to households, not individual users
- **Optimistic updates**: UI updates immediately, then syncs with Firestore
- **Usage limits**: Subscription-based limits enforced at service layer
- **Context-based state**: `AppContext` + `AppActionsContext` for global state management

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
- **Context API**: `AppContext` provides read-only state, `AppActionsContext` provides actions
- **useDataManagement hook**: Centralizes all CRUD operations and real-time subscriptions
- **Custom hooks**: `useAuth`, `useSettings`, `useTheme`, `useToasts`, `useOfflineStatus` for specific concerns
- **Local state**: Component-level state for UI interactions only
- **Firestore direct**: Services handle direct Firestore operations with analytics tracking

## Critical Workflows

### Build & Deploy
```bash
# Development
npm run dev                    # Vite dev server on port 3000

# Production build
npm run build                  # Creates dist/ with PWA assets
npm run build:release          # Syncs changelog + builds
npm run build:analyze          # Analyze bundle size

# Mobile deployment
npx cap sync android           # Sync web assets to Android
npx cap open android           # Open in Android Studio

# Linting
npm run lint                   # ESLint with TypeScript + React plugins
```

### Testing
```bash
npm run test                   # Run Vitest tests
npm run test:ui               # Open Vitest UI
npm run e2e:playwright        # Run Playwright E2E tests
npm run type-check            # TypeScript type checking without emit
```

### Release Process
```bash
# Update CHANGELOG.md first
npm run sync-release-notes     # Converts markdown to android/release-notes.txt
npm run build:release          # Production build with synced release notes
```

### Firebase Functions
```bash
firebase deploy --only functions  # Deploy server-side functions
npm run test-firebase            # Test Firebase functions locally
```

### Data Management Scripts
```bash
npm run bulk-upload-recipes              # Upload recipes to Firestore
npm run bulk-delete-incomplete-recipes   # Clean up incomplete recipe data
npm run clean-duplicate-descriptions     # Remove duplicate recipe descriptions
npm run migrate-firebase                 # Run database migrations
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

### Component Testing (Vitest + React Testing Library)
```typescript
// Use React Testing Library
import { render, screen, fireEvent } from '@testing-library/react';

// Mock Firebase services
jest.mock('../services/firebaseConfig');

// Test files: src/**/__tests__/** or *.spec.tsx or *.test.tsx
// Setup file: src/test/setup.ts
// Environment: jsdom
```

### ESLint Configuration
```typescript
// eslint.config.ts - Flat config format
// Relaxed rules for better DX:
// - @typescript-eslint/no-explicit-any: off
// - @typescript-eslint/no-unused-vars: warn
// - react/no-unescaped-entities: off
// Ignores: dist/**, functions/lib/**, android/**, build/**
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

## Household Data Migration

### Inventory Migration on Household Creation
```typescript
// Automatically migrate user inventory to household when creating household
// Located in Household.tsx createHousehold() function
const userInventoryRef = collection(db, 'users', user.id, 'inventory');
const userInventorySnapshot = await getDocs(userInventoryRef);

if (!userInventorySnapshot.empty) {
  const batch = writeBatch(db);
  const householdInventoryRef = collection(db, 'households', householdRef.id, 'inventory');

  userInventorySnapshot.docs.forEach((doc) => {
    const itemData = doc.data();
    const newItemRef = doc(householdInventoryRef, doc.id);
    batch.set(newItemRef, itemData);
    batch.delete(doc.ref);
  });

  await batch.commit();
}
```

### Household Membership Validation
```typescript
// Firebase Functions validate household membership before operations
// Check both memberIds array and members array for backward compatibility
const isMember = memberIds.includes(userId) ||
  members.some(member => member.id === userId);
```

## Firebase Functions Patterns

### Server-side Validation
```typescript
// functions/src/inviteMember.ts - Validate household membership server-side
const householdDoc = await householdRef.get();
if (!householdDoc.exists) {
  throw new HttpsError("not-found", "Household does not exist.");
}

// Check membership with backward compatibility
const members = Array.isArray(householdData.members) ? householdData.members : [];
const memberIds = Array.isArray(householdData.memberIds) ? householdData.memberIds : [];
const isMember = memberIds.includes(inviterUid) ||
  members.some(member => member.id === inviterUid);
```

### Email Integration
```typescript
// Use sendEmail helper for notifications
import { sendEmail } from './helpers/sendEmail.js';
await sendEmail(recipientEmail, subject, htmlContent);
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

## Service Discovery Guide

### Core Services (All static classes)
Services handle business logic and external integrations. Import and call static methods:

**State & Sync Services**
- `AnalyticsService`: Firebase Analytics event tracking for all user actions
- `UsageService`: Subscription limit tracking and enforcement (recipes, meal plans, Gemini calls)
- `UndoService`: Action history and undo/redo functionality
- `SyncStateService`: Remote update detection for inventory/shopping/meal plan
- `OfflineQueueService`: IndexedDB-based offline operation queue with conflict resolution

**User Features**
- `NotificationService`: Contextual notifications with quiet hours and priority levels
- `PushNotificationService`: FCM integration for mobile push notifications
- `CalendarService`: Export meal plans to device calendar (iOS/Android)
- `RecipeRatingService`: Community recipe ratings and feedback
- `RecipeRecommendationService`: AI-powered recipe suggestions
- `PantryService`: Pantry-specific operations and inventory management

**UI Services**
- `SafeAreaService`: Handle device safe areas (notch, home indicator)
- `FeatureFlagService`: Toggle features based on subscription tier
- `DatabaseMonitoringService`: Track Firestore read/write operations
- `VersionService`: App version checking and update prompts

**External Integrations**
- `GroceryPriceService`: Community-driven price estimates for shopping items
- `BulkImageUpdateService`: Batch image fetching for pantry items
- `RecipePhotoService`: Recipe image management
- `HouseholdActivityService`: Real-time household activity feeds

**Usage Example**
```typescript
import AnalyticsService from '../services/analyticsService';
import { UsageService } from '../services/usageService';

// Track events
AnalyticsService.trackRecipeSave(recipe.id, recipe.title);

// Check usage limits
const canSave = await UsageService.canSaveRecipe(user);
if (!canSave) {
  addToast('Recipe save limit reached', 'error');
  return;
}
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

functions/          # Firebase Cloud Functions
  src/             # Function source code
    *.ts           # Server-side business logic
    helpers/       # Shared utilities
```

## PWA Configuration

### Progressive Web App Setup
```typescript
// vite.config.ts - VitePWA plugin configuration
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'Smart Pantry Chef',
    short_name: 'SmartPantry',
    start_url: '/',
    display: 'standalone',
    background_color: '#2A0A10',
    theme_color: '#2A0A10',
    orientation: 'portrait'
  }
})
```

### Offline-First Strategy
- **IndexedDB Queue**: `OfflineQueueService` stores failed operations in IndexedDB
- **Auto-sync**: Queue processes when connection restored
- **Conflict Resolution**: Server data wins, with conflict store for manual review
- **Visual Feedback**: `SyncIndicator` shows online/offline/syncing states

```typescript
// Offline operation pattern
import { offlineQueue } from '../services/offlineQueueService';

try {
  await updateDoc(docRef, data);
} catch (error) {
  if (!navigator.onLine) {
    await offlineQueue.enqueue({
      type: 'update',
      collection: 'inventory',
      docId: item.id,
      data
    });
    addToast('Saved offline - will sync when online', 'info');
  }
}
```

### Service Worker
- Auto-registered by VitePWA
- Handles app updates with `GlobalUpdatePrompt` component
- Caches static assets and Firebase config

## Component Architecture

### Layout Components (components/layout/)
The app uses a three-tier layout structure:

**1. AppHeader** - Fixed top bar with user context
```typescript
// Responsibilities:
// - User profile & household switching
// - Theme toggle (dark/light mode)
// - Undo button for recent actions
// - Sync status indicator
// - Usage limit indicators

<AppHeader 
  user={user}
  household={household}
  settings={settings}
  onShowHousehold={() => setShowHousehold(true)}
  syncStatus={syncStatus}
  onSyncClick={syncNow}
/>
```

**2. MainContent** - Content area with lazy-loaded tabs
```typescript
// Lazy loads all major feature components:
// - PantryScanner (inventory management)
// - MealPlanner (weekly meal planning)
// - ShoppingList (shopping management)
// - RecipeFinder (AI recipe generation)
// - Community (recipe ratings & social)
// - Settings (preferences & subscription)

// Uses React.lazy() + Suspense for code splitting
const PantryScanner = React.lazy(() => import('../PantryScanner'));

<Suspense fallback={<LoadingSpinner />}>
  {activeTab === Tab.PANTRY && <PantryScanner {...props} />}
</Suspense>
```

**3. AppNavigation** - Fixed bottom navigation bar
```typescript
// Tab-based navigation with icons:
// - Pantry (ChefHat)
// - Shop (ShoppingBasket)
// - Plan (CalendarDays)
// - Chef (UtensilsCrossed)
// - Social (Users)
// - Settings (Sun)

// Active tab gets elevated with border and accent color
<AppNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
```

### Context Architecture
**AppContext** (Read-only state)
```typescript
// Provides global state to all components
const { user, inventory, shoppingList, mealPlan, savedRecipes } = useApp();
```

**AppActionsContext** (State modifiers)
```typescript
// Provides actions to modify state
const { addPantryItem, updateShoppingItem, deleteMealPlan } = useAppActions();
```

This separation prevents unnecessary re-renders and keeps actions discoverable.

## Firebase Security Rules

### Rule Patterns (firestore.rules)

**User-scoped Collections**
```javascript
// Users can only access their own data
match /users/{userId}/{documents=**} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

**Household-scoped Collections**
```javascript
// Check membership in household document
match /households/{householdId} {
  allow create: if request.auth.uid in request.resource.data.memberIds;
  allow read, update, delete: if request.auth.uid in resource.data.memberIds;
}

match /households/{householdId}/{subCollection=**} {
  allow read, write: if request.auth.uid in 
    get(/databases/$(database)/documents/households/$(householdId)).data.memberIds;
}
```

**Community Collections (with validation)**
```javascript
match /ratings/{docId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.userId == request.auth.uid
    && request.resource.data.rating >= 1
    && request.resource.data.rating <= 5;
  allow update, delete: if request.auth.uid == resource.data.userId;
}

match /groceryPrices/{docId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.userId == request.auth.uid
    && request.resource.data.price > 0
    && request.resource.data.price < 1000; // Prevent abuse
}
```

**Admin-only Collections**
```javascript
function isAdmin() {
  return request.auth.uid in ['admin-uid-1', 'admin-uid-2'];
}

match /app_versions/{platform} {
  allow read: if request.auth != null;
  allow write: if isAdmin();
}
```

## Capacitor Plugin Integration

### Camera Plugin (Pantry Scanning)
```typescript
import { Camera, CameraResultType } from '@capacitor/camera';

// Take photo for pantry item
const photo = await Camera.getPhoto({
  resultType: CameraResultType.DataUrl,
  quality: 90
});

// Send to Gemini AI for recognition
const items = await analyzePantryImage(photo.dataUrl);
```

### Local Notifications (Daily Reminders)
```typescript
import { LocalNotifications } from '@capacitor/local-notifications';

// Schedule daily shopping reminder
await LocalNotifications.schedule({
  notifications: [{
    title: 'Shopping List Reminder',
    body: `You have ${shoppingList.length} items to buy`,
    id: 1,
    schedule: { at: new Date(Date.now() + 1000 * 60 * 60 * 24) }
  }]
});
```

### Push Notifications (Household Updates)
```typescript
import { pushNotificationService } from '../services/pushNotificationService';

// Initialize on app startup
await pushNotificationService.initialize();

// Service handles:
// - FCM token registration
// - Foreground notification display
// - Notification action handling
// - Token storage for server-side sending
```

### App Plugin (Back Button & State)
```typescript
import { App } from '@capacitor/app';

// Handle Android back button
App.addListener('backButton', (event) => {
  if (hasOpenModal) {
    closeModal();
    event.preventDefault();
  } else {
    // Default: exit app or navigate back
  }
});

// Detect app state changes
App.addListener('appStateChange', ({ isActive }) => {
  if (isActive) {
    // Refresh data when app comes to foreground
    syncNow();
  }
});
```

### Calendar Plugin (Meal Plan Export)
```typescript
import { CalendarService } from '../services/calendarService';

const calendarService = new CalendarService();

// Export meal plan to device calendar
const success = await calendarService.exportMealPlan(
  mealPlan,
  new Date(),
  7 // days
);

if (success) {
  addToast('Meal plan exported to calendar', 'success');
}
```

Remember: This app prioritizes real-time collaboration and mobile-first UX. Always test changes on both web and mobile platforms.