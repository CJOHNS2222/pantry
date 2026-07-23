# CLAUDE.md

Guidance for Claude Code (claude.ai/code) in this repo.

## Project

**Stock & Spoon** (`package.json` name: `stockandspoon`) - household pantry, shopping list, meal planner, recipe app. Stack: React 19 + TypeScript + Vite, Firebase (Firestore/Auth/Storage/Functions/Remote Config), Capacitor (Android; iOS not added yet). Household data shared real-time via Firestore; free tier capped 5 saved recipes / 10 meals-per-week / 3 household members, premium unlimited via Google Play Billing.

## Commands

```
npm install                  # use --legacy-peer-deps if @capacitor-firebase/* conflicts with capacitor-google-auth
npm run dev                  # vite dev server, port 3000
npm run build                # production build (predev/prebuild regenerate CHANGELOG.md)
npm run build:analyze        # build + rollup-plugin-visualizer treemap at dist/stats.html
npm run lint                 # eslint .
npm run type-check           # tsc --noEmit (run with increased heap: already set in the script)
npm test                     # vitest (single run, not watch)
npm run test:ui              # vitest --ui
npm run e2e:playwright       # playwright test (e2e/playwright.config.ts)
npx cap sync android         # sync web build into the Android native project
npx cap run android          # build + run on device/emulator
```

Single test file: `npx vitest run src/test/services/pantryService.fefo.test.ts`
Single test by name: `npx vitest run -t "test name"`
Single Playwright spec: `npx playwright test e2e/tests/scan.pw.ts` - note Playwright only picks up `*.pw.ts` files (`testMatch` in `e2e/playwright.config.ts`); stray `*.spec.ts` in `e2e/tests/` silently won't run.

## Architecture

### Bootstrap and top-level shell
`index.tsx` mounts providers in this exact order - don't reorder without understanding why:
```
I18nProvider > ToastProvider > ConfirmDialogProvider > AppProvider > AppActionsProvider > App
```
Also wires global `error`/`unhandledrejection` handlers (-> Sentry + Crashlytics), applies Firebase Remote Config to feature flags before render, initializes Sentry only in production builds with real `VITE_SENTRY_DSN`.

No router (react-router-dom dependency but unused for navigation). `App.tsx` tab-based single-page shell: `activeTab` state using `Tab` enum (`types/app.ts`), `switchTab()` also tracks analytics + Android hardware-back history stack, numerous modals toggled via local state. Layout components in `components/layout/` (`AppHeader`, `AppNavigation`, `MainContent`).

### Data flow - rule that matters most
All Firestore reads/writes for pantry, shopping, meal plan, recipes must go through **`hooks/useDataManagement.ts`** (central data hook) - never ad-hoc Firestore calls from UI component. Domain logic belongs in `services/`, not components.

Global read state lives in `contexts/AppContext.tsx` (`useApp()`); mutation/action functions in paired `contexts/AppActionsContext.tsx`.

### Cache services (bulk-read optimization layer)
Each domain has `*CacheService` (`inventoryCacheService`, `recipesCacheService`, `shoppingListCacheService`, `MealPlanCacheService`, `priceDataCacheService`, `imageCacheService`) serializing each Firestore document's fields into compact array (e.g. `InventoryCacheService.ITEM_FIELD_ORDER` / `pantryItemToArray()` / `arrayToPantryItem()`), stored as single versioned cache document per household/user, keyed via `getHouseholdOrUserCachePath()` in `cachePathUtils.ts`. Exists to avoid per-item document reads, not replace real Firestore documents. Changing domain type's shape → update both type and cache service's field order/serialization together, bump `CACHE_VERSION` if array layout changes.

Offline support sits alongside: `offlineQueueService.ts` (queues writes while offline), `offlineDataCache.ts` (reads), `syncStateService.ts` (coordinates sync), `undoService.ts` (reversible actions). Firestore itself initialized with `persistentLocalCache` + `persistentMultipleTabManager` in `firebaseConfig.ts`.

### Firebase setup
`firebaseConfig.ts` initializes `auth`, `db`, `storage`, `functions`, conditional App Check (skipped in dev), conditional Analytics, feature-detected FCM messaging. Auth persistence platform-based: `browserLocalPersistence` on web vs `indexedDBLocalPersistence` on native (`Capacitor.getPlatform()`). Actual SDK config values come from `VITE_firebaseConfig.ts` (not generic env example). `databaseMonitoringService` dynamically imported there to avoid circular import.

Household/ownership scoping enforced in `firestore.rules`, mirrored in app logic (`isHouseholdMember()` checks) - `users/{uid}/...` user-scoped, `households/{householdId}/...` shared. Preserve these checks in any new read/write path.

`functions/` separate Firebase Cloud Functions project (own `package.json`/`tsconfig.json`) covering household invitations/membership (`checkInvitation.ts`, `inviteMember.ts`, `leaveHousehold.ts`), account deletion, usage-limit resets, push notifications, IAP verification (`verifyPurchase.ts`), nutrition logic.

### Domain model conventions
Key types in `types.ts` / `types/`: `PantryItem`, `ShoppingItem`, `SavedRecipe`, `DayPlan`, `Household`, `User`. Notable pantry item conventions: multi-`batches` per item with independent expirations (FEFO consumption), opened-item tracking (`isOpened`/`openedAt`/`openedExpiry`), quantity reservations for recipes, flags (`is_immortal`, `is_leftover`, `cooked_rice`, `is_frozen`), legacy `quantity_estimate` (string) vs current `quantity` (number/object) split - use `getQuantityValue()` rather than reading either field directly. Dates ISO strings. Preserve immutable update patterns (no in-place mutation).

### Household join migration
When user joins household, `householdMigrationService.migrateUserDataToHousehold()` merges personal inventory/shopping-list/meal-plan/saved-recipes (read via `*CacheService`s) into household's shared copies, then clears personal ones. Writes `pending_migration_{userId}` localStorage checkpoint before starting, only clears on full success, so `hooks/useHouseholdMigrationRetry.ts` can detect and retry interrupted migration on next app load.

### Errors and observability
`services/sentryService.ts` provides domain-specific JS error helpers (`reportDatabaseError`, `reportSyncIssue`, `reportGeminiError`, `setUserContext`). `services/crashlyticsService.ts` wraps native Firebase Crashlytics - call this, never `@capacitor-firebase/crashlytics` directly, wrapper handles `isNativePlatform()` guard, no-op on web. `ErrorBoundary.tsx` / `ComponentErrorBoundary.tsx` report to both. Errors use `AppError` class with codes/context.

### Integrations
- AI: `geminiService.ts` (Gemini), OpenRouter/Groq fallback via `openRouterService.ts` (`VITE_GEMINI_DISABLED=true` routes all AI through OpenRouter).
- Recipes: `spoonacularRecipeClient.ts` (Spoonacular REST API, cached + rate-limited); `typescript/dist/index.ts` stubs client when generated SDK absent.
- Analytics/perf: Firebase Analytics + Sentry; Core Web Vitals via `performanceMonitoringService.ts`.

### Capacitor / mobile
`capacitor.config.ts`: `appId: com.smart.pantry`, `webDir: dist`. Android project in `android/` (Gradle); no `ios/` yet. Native plugins in use: App, Device, PushNotifications, Calendar, SafeArea, Haptics, Browser, GoogleAuth, plus Firebase Crashlytics/Analytics/AdMob and `cordova-plugin-purchase` for IAP. Guard platform-specific behavior with `Capacitor.getPlatform()` / `Capacitor.isNativePlatform()`, following pattern in `firebaseConfig.ts`.

### Directory map
- `components/` - feature-organized UI (`pantry/`, `shopping-list/`, `meal-planner/`, `recipe-finder/`, `recipe-modal/`, `household/`, `settings/`, `layout/`, shared primitives in `ui/`).
- `hooks/` - data/state hooks; `useDataManagement.ts` central one, helpers split into `hooks/dataManagement/`.
- `services/` - domain logic, Firebase access, third-party integrations, cache/offline/sync services.
- `contexts/` - `AppContext.tsx` (state) + `AppActionsContext.tsx` (actions).
- `utils/` - pure helpers, with `utils/pantry/`, `utils/recipe/`, `utils/shared/` subfolders.
- `types.ts` / `types/` - domain model types.
- `src/test/` - all Vitest tests (mirrors domain: `components/`, `services/`, `hooks/`, `utils/`), plus `setup.ts`/`test-utils.tsx`.
- `e2e/tests/*.pw.ts` - Playwright specs.
- `functions/` - Firebase Cloud Functions (separate TS project).
- `android/` - Capacitor Android native project.
- `scripts/` - one-off Node maintenance scripts (changelog, bulk recipe import/migration, image seeding).
- `readme/` - feature-specific setup docs (household invitations, recipe DB setup, expiration alerts, price integration, etc.) - check here before re-deriving how specific subsystem was set up.

### Testing
Vitest + jsdom, tests under `src/test/**/*.test.{ts,tsx}`. `src/test/setup.ts` globally mocks `firebase/firestore`, `firebase/storage`, `firebase/performance`, `firebase/analytics`, `firebase/auth`, local `firebaseConfig` module, plus `fetch`/`localStorage`/`sessionStorage`/`ResizeObserver`. Use `vi.mock()` for external dependencies rather than MSW (MSW devDependency but not part of global setup - only reach for it in isolated integration test needing real HTTP-shaped mocking). Favor smoke/integration-style component tests over deep isolation, unit-test business logic in `services/` with externals mocked.

### Path aliases
`@/*` -> project root (both `tsconfig.json` and `vite.config.ts`).

## Environment & pitfalls
- Env vars use `VITE_` prefix; actual Firebase SDK config in `VITE_firebaseConfig.ts`, not generic `.env`.
- Avoid import cycles around `firebaseConfig.ts` - use dynamic imports if needed.
- Image uploads capped (5-10MB), content-type restricted per `storage.rules`.
- `npm install` needs `--legacy-peer-deps` for `@capacitor-firebase/*` due to peer conflict with `@codetrix-studio/capacitor-google-auth`.

## Subagents (`.claude/agents/`)
Repo has 24 predefined subagents (code/bug/security/db/perf/dep/seo/infra/ui/doc auditors, `fix-planner`, `code-fixer`, `test-runner`, `test-writer`, `browser-qa-agent`, `console-monitor`, `visual-diff`, `deploy-checker`, `env-validator`, `pr-writer`, `seed-generator`, `architect-reviewer`, `fullstack-qa-orchestrator`, `api-tester`) and documented workflows (`full-audit`, `pre-commit`, `pre-deploy`, `new-feature`, `bug-fix`, `release-prep`) in `.claude/CLAUDE.md`. Auditor outputs go to `.claude/audits/`.