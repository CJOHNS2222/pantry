# Stock & Spoon — Copilot Project Rules (/init)

Use this file as the authoritative project context. Keep changes minimal, typed, and consistent with existing architecture.

## Quick Do / Don't
- **Do** keep changes minimal, scoped, and architecture-aligned.
- **Do** use existing types, hooks, and services before creating new patterns.
- **Do** preserve household scoping and Firestore ownership/membership checks.
- **Do** run type-check/tests when behavior changes.
- **Don't** add unrelated refactors, files, or abstractions.
- **Don't** bypass `hooks/useDataManagement.ts` with ad-hoc UI Firestore writes.
- **Don't** introduce ad-hoc data shapes when `types.ts` already defines the model.
- **Don't** log secrets or sensitive user data.

## 1) Stack & Style
- Stack: React 19 + TypeScript + Vite + Firebase + Capacitor.
- Prefer functional components + hooks.
- Reuse existing domain types from `types.ts` and `types/`.
- Do not introduce ad-hoc data shapes when an existing type can be extended.
- Keep imports, naming, and formatting consistent with nearby files.
- Prefer existing utilities/services over duplicate logic (`utils/`, `services/`).

## 2) Core Architecture Boundaries
- App bootstrap provider order in `index.tsx`:
  - `I18nProvider` → `AppProvider` → `AppActionsProvider`.
- `App.tsx` is the orchestration shell (routing/tabs/top-level wiring).
- Centralized data flow belongs in `hooks/useDataManagement.ts`.
- Avoid direct Firestore logic in random UI components; place domain logic in `services/`.
- Prefer context/hook wiring over prop drilling for global app state.

## 3) Data Model Conventions
- Key models: `PantryItem`, `ShoppingItem`, `SavedRecipe`, `DayPlan`, `Household`, `User`.
- Dates should be ISO strings (`YYYY-MM-DD` or ISO-8601 timestamps).
- Keep backward-compatible fields where the codebase already relies on them.
- Preserve immutable update patterns (no in-place mutation).

## 4) Firebase & Household Scoping
- Preserve household-aware scoping patterns:
 
- Maintain membership/ownership checks used by app logic and `firestore.rules`.
- Keep cache sync flows intact (`services/*CacheService.ts`, `services/syncStateService.ts`).

## 5) Platform & Integration Rules
- For platform-specific behavior, follow existing `Capacitor.getPlatform()` guards.
- Firebase setup is centralized in `firebaseConfig.ts`.
- Security constraints are governed by `firestore.rules`, `storage.rules`, and indexes.
- PWA/build chunking conventions live in `vite.config.ts`; align with existing strategy.

## 6) Security & Privacy
- Never commit secrets or keys.
- Use existing local env/config patterns (`.env.local`, `VITE_firebaseConfig.ts`).
- Preserve auth and ownership constraints in all reads/writes.
- Do not put sensitive user data in logs, analytics, or notifications payloads.

## 7) Observability & Errors
- Route telemetry through `services/analyticsService.ts`.
- Use Sentry helpers in `services/sentryService.ts` for JS-layer error reporting (`reportDatabaseError`, `reportSyncIssue`, `reportGeminiError`, `setUserContext`).
- Use `services/crashlyticsService.ts` for native Firebase Crashlytics reporting. **Never** call `@capacitor-firebase/crashlytics` directly — the wrapper handles `isNativePlatform()` guards and is a silent no-op on web.
- `ErrorBoundary.tsx` and `ComponentErrorBoundary.tsx` report to both Sentry and Crashlytics; keep both paths intact.
- Prefer centralized user-facing error messaging patterns already in the repo.

## 8) Build, Lint, and Test Commands
- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Build (analyze): `npm run build:analyze`
- Build (release): `npm run build:release`
- Lint: `npm run lint`
- Type-check: `npm run type-check`
- Unit tests: `npm test`
- Vitest UI: `npm run test:ui`
- E2E: `npm run e2e:playwright`
- Capacitor sync: `npx cap sync android` / `npx cap sync ios`
- Capacitor run: `npx cap run android` / `npx cap run ios`
- Capacitor open: `npx cap open android` / `npx cap open ios`

## 9) Change Strategy for AI Edits
- Fix root cause; avoid superficial patches.
- Keep edits focused and minimal; avoid unrelated refactors.
- Add/adjust tests when behavior changes and tests exist nearby.
- Respect existing naming and file structure conventions.
- When uncertain, choose the simplest implementation aligned with current patterns.

## 10) Testing Patterns & Conventions
- **Framework**: Vitest with jsdom environment, globals enabled.
- **Setup**: `./src/test/setup.ts` for global test configuration.
- **File patterns**: `*.spec.ts`, `*.test.ts`, `*.spec.tsx` in `tests/`, `src/`, `components/`.
- **Mocking**: Use Vitest's `vi.mock()` for external dependencies (Firebase, APIs).
- **Component testing**: Smoke tests for basic rendering, focus on integration over unit isolation.
- **Service testing**: Unit tests for business logic, mock external services.
- **Error testing**: Test error boundaries and error handling with `AppError` class.

## 11) Directory Map
- `components/` UI components
- `hooks/` data/state hooks
- `services/` domain logic + integrations
- `contexts/` global app context/actions
- `utils/` shared helpers
- `types/` typed contracts
- `constants/` app constants/messages
- `functions/` backend/serverless scripts

## 12) Advanced Features & Patterns
### Item Management
- **Batches**: Items support multiple `batches` with independent expirations (FEFO consumption).
- **Opened tracking**: `isOpened`, `openedAt`, `openedExpiry` for items with different shelf lives post-opening.
- **Reservations**: Pantry items can reserve quantities for recipes.
- **Flags**: `is_immortal` (never expires), `is_leftover`, `cooked_rice`, `is_frozen`.
- **Quantity handling**: Legacy `quantity_estimate` (string) vs. new `quantity` (number/object). Use `getQuantityValue()`.

### Offline & Caching
- **Cache services**: Multiple specialized caches (`inventoryCacheService`, `recipesCacheService`, `shoppingListCacheService`).
- **Offline queue**: `offlineQueueService.ts` queues writes; `offlineDataCache.ts` for reads.
- **Sync**: `syncStateService.ts` coordinates cache synchronization.
- **Undo system**: `undoService.ts` for reversible actions.

### Integrations
- **AI**: Gemini via `geminiService.ts`; OpenRouter/Groq fallback via `openRouterService.ts` (set `VITE_GEMINI_DISABLED=true` to route all AI through OpenRouter).
- **Recipes**: Spoonacular REST API via `spoonacularRecipeClient.ts` with caching and rate limiting; `typescript/dist/index.ts` is a shim that stubs the client when the generated SDK is absent.
- **Analytics**: Firebase Analytics + Sentry for errors/performance monitoring.
- **Notifications**: Push notifications, in-app alerts, haptic feedback.

### Performance & Monitoring
- **Core Web Vitals**: LCP, FID, CLS tracking via `performanceMonitoringService.ts`.
- **Error handling**: `AppError` class with codes/context; `ErrorBoundary.tsx` reports to Sentry + Crashlytics.
- **Crashlytics**: Native-only via `services/crashlyticsService.ts`; no-op on web. Reports non-fatals from error boundaries, global handlers, and `sentryService.ts` domain helpers.
- **Bundle optimization**: Manual chunks in `vite.config.ts`, PWA with auto-updates.

## 13) Quick Directory Guide
### Pantry changes
1. Update `PantryItem` type.
2. Update relevant logic in `services/pantryService.ts` and/or `hooks/useDataManagement.ts`.
3. Update related UI components.
4. Validate security implications in rules if write/query shape changed.

### Shopping list changes
1. Update `ShoppingItem` type.
2. Update data flow/hook wiring.
3. Update UI components and interactions.
4. Run tests and type-check.

### Recipe feature changes
1. Implement/update in recipe services.
2. Wire through existing recipe components and context flows.
3. Preserve save/rating/meal-plan behaviors and limits.

---

If two rules conflict, prioritize:
1) security/data correctness,
2) existing architecture boundaries,
3) minimal, maintainable changes.

## 14) Environment Setup & Pitfalls
- **Environment variables**: Use `VITE_` prefix (e.g., `VITE_GEMINI_API_KEY`). Web Firebase config in `VITE_firebaseConfig.ts`.
- **Circular imports**: Avoid cycles, especially around `firebaseConfig.ts`. Use dynamic imports where needed.
- **Household scoping**: Always check `isHouseholdMember()` and membership. Rules enforce strict scoping.
  - `users/{uid}/...` for user-scoped data/cache.
  - `households/{householdId}/...` for shared household data.
- **Storage limits**: Images capped at 5-10MB, content-type `image/*` enforced.
- **Platform guards**: Use `Capacitor.getPlatform()` for mobile-specific behavior.
- **API limits**: Spoonacular has rate limits; cache via dedicated services.
- **Error handling**: Use `AppError` class with codes/context. Route through `ErrorBoundary.tsx` → Sentry + Crashlytics.
- **npm install for `@capacitor-firebase/*`**: Always use `--legacy-peer-deps` due to peer dependency conflict with `@codetrix-studio/capacitor-google-auth`.

## 15) Key Exemplar Files
- `firebaseConfig.ts`: Firebase initialization, platform handling, monitoring setup
- `firestore.rules`: Access control patterns, household scoping, data validation
- `storage.rules`: Image upload rules, size/content limits
- `hooks/useDataManagement.ts`: Central data hook, service orchestration
- `utils/appUtils.ts`: Core helpers (expiry alerts, member checks, parsing)
- `utils/errorUtils.ts`: Error classes and standardized error handling
- `services/sentryService.ts`: JS error reporting, domain-specific report helpers
- `services/crashlyticsService.ts`: Native Crashlytics wrapper; no-op on web
- `vite.config.ts`: Build configuration, PWA setup, bundle optimization
- `capacitor.config.ts`: Mobile plugins and platform configuration
