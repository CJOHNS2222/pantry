# AI Agent Instructions for Smart Pantry Chef

## Project Overview
**Smart Pantry Chef** is a cross-platform React/TypeScript mobile app (iOS/Android/Web) for household pantry management, meal planning, and recipe discovery. Built with Firebase, Capacitor, and Google Gemini AI. Users manage shared household inventories, shopping lists, and meal plans in real time.

**Key Stack:** React 19, TypeScript, Vite, Firebase (Firestore/Auth/Storage/Functions), Capacitor 7, Google Play Billing (Android), Gemini AI, Context API

---

## Architecture Essentials

### Global State Management
- **`AppContext` + `AppActionsContext`:** Core app state (user, household, inventory, shoppingList, mealPlan, savedRecipes, settings, UI state)
  - Located: [contexts/AppContext.tsx](contexts/AppContext.tsx), [contexts/AppActionsContext.tsx](contexts/AppActionsContext.tsx)
  - All major data lives here; use `useAppContext()` hook throughout components
  - Global UI state (activeTab, loading flags, notifications, consumption/expiration suggestions)

### Service Layer Pattern
- **Static class services** in `services/` (e.g., `PantryService`, `RecipeService`, `HouseholdService`)
  - Encapsulate Firestore queries, Gemini API calls, and domain logic
  - Example: [services/pantryService.ts](services/pantryService.ts) handles item detection, creation, validation
  - Each service typically has async static methods; rarely instantiated

### Data Models
- **Core types** in [types.ts](types.ts): `PantryItem`, `ShoppingItem`, `SavedRecipe`, `DayPlan`, `Household`, `User`
- **PantryItem:** Includes quantity (amount + unit), storageLocation, expirationDate, consumptionHistory, image, reservations (for recipes)
- **ShoppingItem:** Tracked by source (e.g., "recipe: Chicken Stir Fry"), purchase quantities, estimated price, checked status
- **SavedRecipe:** Title, description, ingredients, instructions, cook time, rating info (communal ratings)
- **Dates:** Always ISO strings (`YYYY-MM-DD` or full ISO 8601); use `new Date().toISOString()`

### Firebase Integration
- **Real-time listeners** in hooks via `onSnapshot(query(...))` → updates AppContext
  - Household access control: users must be members of the household document
  - All data keyed by `householdId` for sharing
- **Auth:** Email/password + Google, stored in Firestore `users/{userId}` and `households` subcollection
- **Firestore rules** in [firestore.rules](firestore.rules): Enforce household membership; storage rules in [storage.rules](storage.rules)
- **Functions:** Cloud Functions for sensitive ops (subscriptions, Stripe webhooks, etc.)
- **Cache Collections:** User-scoped Firestore caches at `users/{userId}/cache/` for fast data retrieval:
  - `users/{userId}/cache/inventory` – Cached pantry items, synced from household inventory for quick access
  - `users/{userId}/cache/shoppingList` – Cached shopping list items, synced from household shopping list
  - Purpose: Reduce real-time listener load, enable faster local-first queries, support offline scenarios
  - See [inventoryCacheService.ts](services/inventoryCacheService.ts) for cache management patterns

### Capacitor Integration
- **Platform detection:** Use `Capacitor.getPlatform()` to branch web vs Android/iOS
- **Native APIs:** Camera ([PantryScanner.tsx](components/PantryScanner.tsx)), local notifications, haptics
- **Persistence:** Web uses `browserLocalPersistence`, native uses `indexedDBLocalPersistence` (set in [firebaseConfig.ts](firebaseConfig.ts))
- **Safe area:** `SafeAreaService` adjusts UI for notches/insets

---

## Development Workflow

### Running the App
```bash
npm run dev      # User will start server, and test. Start Vite dev server on http://localhost:3000
npm run build    # Production build
npm run lint     # ESLint check
npm run test     # Vitest unit tests
npm run test:ui  # Vitest UI dashboard
```

### Build & Release
- `npm run build:release` syncs release notes from changelog, then builds
- Android: `npx cap build android` after `npm run build` (requires Android Studio + emulator or device)
- PWA support: Vite PWA plugin auto-updates on user demand; manifest in [public/manifest.json](public/manifest.json)

### Testing & Type Safety
- **Vitest** for unit tests: [vitest.config.ts](vitest.config.ts)
- **TypeScript strict mode:** `tsc --noEmit` (run before commits)
- **ESLint:** Configured in [eslint.config.ts](eslint.config.ts); enforce on PR

---

## Key Conventions & Patterns

### Component Structure
- **Error Boundaries:** Wrap major sections with `ErrorBoundary` or `ComponentErrorBoundary`
  - [ErrorBoundary.tsx](components/ErrorBoundary.tsx) catches React errors; [ComponentErrorBoundary.tsx](components/ComponentErrorBoundary.tsx) for sub-components
- **Lazy Loading:** Heavy components (analytics, modals) use `React.lazy()` + `Suspense` with `LoadingSpinner`
  - Example: [DatabaseAnalytics](components/DatabaseAnalytics.tsx) in App.tsx
- **Modal Pattern:** Use inline state + conditional render or portal; modals are dismissible on overlay click

### Hooks & Data Fetching
- **Custom hooks** in `hooks/`: `useAuth()`, `useSettings()`, `useDataManagement()`, `useTheme()`, `useToasts()`, `useOfflineStatus()`, `useHouseholdActivity()`
- These manage subscriptions, Firestore listeners, and AppContext dispatch
- Avoid fetching same data in multiple components; centralize in hooks

### Naming & File Organization
- **Files:** kebab-case (`shopping-list.tsx`, `grocery-price-service.ts`)
- **Components:** PascalCase, one per file usually
- **Hooks:** `useXyzName` (camelCase)
- **Services:** `XyzService` static class or function

### Validation & Error Handling
- **Centralized validation:** [utils/validationUtils.ts](utils/validationUtils.ts) for PantryItem, ShoppingItem, etc.
- **Errors:** Catch and surface via toast (`useToasts()`) or error boundary
- **Log service:** [services/logService.ts](services/logService.ts) for structured logging
- **Sentry integration:** [services/sentryService.ts](services/sentryService.ts) for error tracking & breadcrumbs

### State Updates
- **Immutable patterns:** Never mutate arrays/objects directly; create new instances
- **Batch operations** in [BatchOperations.tsx](components/BatchOperations.tsx) for multi-item Firestore writes
- **Undo support:** [UndoService](services/undoService.ts) tracks reversible ops

### Analytics & Monitoring
- **AnalyticsService:** Track user actions (pantry scans, recipe saves, meal plans, purchases)
- **PerformanceMonitoringService:** Mark tab switches, lazy-load timing; report Core Web Vitals
- **DatabaseMonitoringService:** Monitor Firestore reads/writes; alert on anomalies
- Initialized early in [firebaseConfig.ts](firebaseConfig.ts)

### Feature Flags & Premium
- **`featureFlags.ts`:** `canUseGemini(userId)`, `isPremiumUser()` gates AI and premium features
- **Subscription limits:** Free tier: 5 saved recipes, 10 meals/week, 3 household members
- **Payment processor:** Google Play Billing for Android subscriptions; Stripe/PayPal removed for Play Store compliance

---

## Common Tasks for AI Agents

### Adding a New Pantry Item Feature
1. Extend `PantryItem` type in [types.ts](types.ts)
2. Update `PantryService` static methods to process the new field
3. Modify [PantryAnalytics.tsx](components/PantryAnalytics.tsx) or item detail modals if UI needed
4. Add Firestore validation in [firestore.rules](firestore.rules)
5. Update AppContext if it needs global state

### Creating a New Shopping List Feature
1. Extend `ShoppingItem` in [types.ts](types.ts)
2. Update fetching logic in the relevant hook (e.g., `useDataManagement`)
3. Modify [ShoppingList.tsx](components/ShoppingList.tsx) and [EnhancedShoppingListItem.tsx](components/EnhancedShoppingListItem.tsx)
4. Add Firestore query + listener in hook
5. Test with `npm run test`

### Integrating a Recipe Feature
- Services: [recipeService.ts](services/recipeService.ts) (CRUD, search), [recipeRecommendationService.ts](services/recipeRecommendationService.ts) (AI), [recipeRatingService.ts](services/recipeRatingService.ts) (community)
- Components: [RecipeFinder.tsx](components/RecipeFinder.tsx) (search), [RecipeModal.tsx](components/RecipeModal.tsx) (detail), [RecipeRating.tsx](components/RecipeRating.tsx) (ratings)
- Data flow: User search → local DB or fallback to gemini api → SavedRecipe[]  → AppContext → Redux-like dispatch

### Accessing Household Data
- All queries filtered by `householdId` (stored in AppContext.household)
- Validate user is household member: `isHouseholdMember(user, household)` from [utils/appUtils.ts](utils/appUtils.ts)
- Real-time subscriptions via `onSnapshot(collection(db, 'households', householdId, 'inventory'), ...)`

### Offline Support
- **Cache collections:** `users/{userId}/cache/inventory` and `users/{userId}/cache/shoppingList` provide persistent Firestore-backed caches for fast queries and offline fallbacks
- **Write queue:** [offlineQueueService.ts](services/offlineQueueService.ts) queues Firestore writes when offline
- **Cache:** [offlineDataCache.ts](services/offlineDataCache.ts) stores last-known data in IndexedDB
- **Sync on reconnect:** Automatic w/ listeners; cache collections update when connection restored
- **Indicators:** [OfflineShoppingIndicator.tsx](components/OfflineShoppingIndicator.tsx), [SyncIndicator.tsx](components/SyncIndicator.tsx)

### Image Handling
- **Local detection:** [PantryScanner.tsx](components/PantryScanner.tsx) captures camera input
- **Cloud analysis:** [geminiService.ts](services/geminiService.ts) sends base64 to Gemini for recognition
- **Caching:** [imageCacheService.ts](services/imageCacheService.ts) deduplicates; [ProgressiveImage.tsx](components/ProgressiveImage.tsx) lazy-loads
- **External fetch:** [fetchExternalItemImage()](utils/appUtils.ts) for stock photos

---

## Environment & Secrets

- **Firebase config:** [firebaseConfig.ts](firebaseConfig.ts) (production) and [VITE_firebaseConfig.ts](VITE_firebaseConfig.ts) (fallback)
- **Gemini API key:** `process.env.GEMINI_API_KEY` (set in .env.local)
- **Google Play Billing:** Managed via Capacitor plugin and Play Console; no secret keys required in .env.local
- **Sentry:** DSN in environment for error/perf tracking

---

## Tips for High-Quality Changes

- **Immutability:** Always spread/clone objects and arrays before mutations
- **Type safety:** Leverage TypeScript; avoid `any` types
- **Real-time sync:** Use `onSnapshot` for live data; avoid polling
- **Performance:** Lazy-load heavy components, memoize expensive computations, use react-window for large lists
- **Accessibility:** Semantic HTML, ARIA labels, keyboard navigation where UI has interactions
- **Testing:** Write tests for new services and utilities; test Firestore queries early
- **Error messages:** Use [constants/errorMessages.ts](constants/errorMessages.ts) for consistent user-facing text

---

## Key Directories Quick Reference
- `components/` – React components (modals, lists, settings, etc.)
- `services/` – Business logic, API calls, Firestore queries, feature flags
- `contexts/` – Global state (AppContext, AppActionsContext)
- `hooks/` – Custom hooks for data fetching, auth, theme, settings
- `utils/` – Shared utility functions (date parsing, validation, item inference)
- `types/` – TypeScript interfaces (types.ts, types/app.ts)
- `constants/` – Error messages, strings, categories
- `public/` – Static assets, PWA manifest, icons
- `android/` – Capacitor Android project (build, native config)
- `functions/` – Firebase Cloud Functions (if applicable in separate folder)
