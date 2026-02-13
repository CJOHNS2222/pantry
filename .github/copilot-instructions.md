# Project Guidelines

## Code Style
- **TypeScript strict mode**: Enable all strict checks in `tsconfig.json` (strict, noImplicitAny, strictNullChecks, etc.) for type safety
- **React 19 JSX transform**: Use automatic JSX runtime, no React imports needed in component files
- **ESLint relaxed rules**: Warnings instead of errors for `@typescript-eslint/no-unused-vars`, `@typescript-eslint/no-explicit-any`, `react/no-unescaped-entities` - reference `eslint.config.ts`
- **Path aliases**: Use `@/` for root imports in `tsconfig.json` and `vite.config.ts`

## Architecture
- **Service layer pattern**: Static classes for business logic (e.g., `AnalyticsService`, `NotificationService`) - all Firebase operations go through services
- **Context separation**: `AppContext` for read-only state, `AppActionsContext` for state mutations - prevents unnecessary re-renders
- **Household vs user scoping**: Data split between `/users/{userId}/` (personal) and `/households/{householdId}/` (shared) collections
- **Real-time subscriptions**: All data uses Firestore `onSnapshot` for live updates, with optimistic UI updates
- **Lazy component loading**: Major features loaded with `React.lazy()` + `Suspense` in `MainContent.tsx`
- **Error boundaries**: Wrap components in `ErrorBoundary` for resilience

## Build and Test
- **Development**: `npm run dev` starts Vite dev server on port 3000
- **Production build**: `npm run build` creates PWA assets in `dist/`
- **Mobile build**: `npx cap sync android` syncs web assets to Android Studio
- **Testing**: Vitest with jsdom environment, setup in `src/test/setup.ts`, run with `npm run test`
- **E2E**: Playwright tests with `npm run e2e:playwright`
- **Type checking**: `npm run type-check` runs TypeScript compiler without emit

## Project Conventions
- **Custom hooks**: Use `useAuth`, `useSettings`, `useTheme`, `useToasts` for specific concerns instead of component-level state
- **Analytics tracking**: Call `AnalyticsService.track*()` methods on all user actions and operations
- **Quantity handling**: Use `parseQuantity()`, `combineQuantities()`, `subtractQuantities()`, `formatItemQuantity()` from `appUtils.ts`
- **Firebase timestamps**: Use `Timestamp` objects, not ISO strings; `serverTimestamp()` for server-set timestamps
- **Data validation**: Clean undefined fields with `cleanObject()` before Firestore saves
- **Back button handling**: Global listener in `App.tsx` prioritizes modals > search > navigation

## Integration Points
- **Firebase services**: Auth, Firestore, Analytics, Storage, Functions all initialized in `firebaseConfig.ts`
- **Capacitor plugins**: Camera, LocalNotifications, PushNotifications, Haptics, App configured in `capacitor.config.ts`
- **AI integration**: Google Gemini API for recipe generation, check `canUseGemini()` before calls
- **Payment processing**: Stripe + PayPal integration for subscriptions
- **External APIs**: Spoonacular for recipe data (test with `npm run test-spoonacular`)

## Security
- **Firestore rules**: Strict membership validation for household data, user ownership for personal data - reference `firestore.rules`
- **Auth persistence**: `browserLocalPersistence` for web, `indexedDBLocalPersistence` for mobile
- **Data validation**: Server-side validation in Firebase Functions for household membership
- **Admin access**: Restricted collections require `isAdmin()` check with hardcoded UIDs
- **Input sanitization**: Validate emails, passwords, names in auth flows
