# Changelog

All notable changes to Stock & Spoon will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.14] - 2026-04-10

### Changed
- **Recipe recommendations now use the app recipe cache** (audit D): `recipeRecommendationService` completely rewritten. All mock data and per-call Firestore rating queries removed. Recommendations are now generated entirely from `recipe_caches/recipes_cache_1` (400+ recipes) which is loaded once and cached in memory for 30 minutes.
  - **Pantry-match** (`similar-ingredients`): scores every cached recipe by ingredient overlap with the user's current pantry items; returns top 5 by match count with dynamic confidence scoring.
  - **Seasonal** (`seasonal`): keyword-matches recipe titles, descriptions, and tags against a season table (winter/spring/summer/fall keyword sets) to return contextually relevant picks.
  - **Trending** (`trending`): deterministic pseudo-shuffle of remaining cache entries for diversity without repeating pantry or seasonal results.
  - `getSimilarRecipes()` also uses the cache, scoring by shared ingredient count with the base recipe.
  - Net Firestore reads per recommendation call: **1** (cache load, then 0 for 30 min). Previously fired 3 queries (up to 120 docs) on every render, returning mock results.

## [1.5.13] - 2026-04-10

### Added
- **`getOpenedShelfLifeDays(itemName, category)`** (audit U): New USDA/FDA-based helper in `utils/appUtils.ts` covering dairy, deli/meat, canned goods, condiments, bread, nut butters, produce, and beverages. Returns `undefined` for unknown categories so no spurious `openedExpiry` is set.
- **FreezeTransitionModal USDA pre-fill** (audit S): Modal now accepts an `itemName` prop and initialises the freezer-days input via `getFreezerShelfLifeDays(itemName)` — e.g. chicken defaults to 270 days, salmon to 90 days. The subtitle shows the USDA source value so users know where the default came from.
- **Batch FEFO read-time derivation** (audit W): Inventory cache listener in `useDataManagement.ts` now sets `item.expirationDate` to the earliest `batch.expires` value when batches are present. Read-time only; Firestore data is unchanged.

### Fixed
- **Frozen items in ExpiredItems modal** (audit R): `ExpiredItemsModal.tsx` and `App.tsx` expiry filters now use `freezerExpiry` as the reference date for frozen items, preventing false "expired" alerts for items safely stored in the freezer.
- **ItemDetailModal opened expiry coverage** (audit U): All supported categories now receive an accurate `openedExpiry` date when an item is marked opened — not just Canned Goods and Condiments.
- **FreezeTransitionModal Tailwind restyle** (audit X): Fully ported from raw HTML with inline `style={{}}` objects to Tailwind + theme CSS vars, matching the visual style of ItemDetailModal and ExpiredItemsModal. Added Snowflake lucide icon, fixed `catch (e: any)` → `catch (e: unknown)`.

## [1.5.12] - 2026-04-10

### Fixed
- **GroceryCostEstimator anonymous_user** (audit CC): Replaced hardcoded `'anonymous_user'` string with real authenticated user ID via `useApp()`. Previously every price submission silently failed at the Firestore rule layer (rule requires `userId == auth.uid`), causing a confusing double-toast and leaving no price data in the database.
- **Expiry filter blind to frozen items** (audit DD): The "expiring-soon" filter in `filterPantryItems` now mirrors `generateExpirationAlerts` logic — frozen items (`is_frozen` or `storageLocation === 'freezer'`) use `freezerExpiry` as the reference date and a 30-day threshold, preventing pre-freeze fridge dates from triggering false "expiring soon" classifications.
- **offlineQueueService `catch (err: any)`** (audit EE): Changed to `catch (err: unknown)` consistent with project-wide `no-explicit-any` ESLint rule.
- **usageService PLAN_LIMITS missing `free:` key**: Restored missing `free:` key in `PLAN_LIMITS` object literal that caused TypeScript parse errors across the entire service file.
- **geminiService type errors**: Added missing `GroundingChunk` import; fixed queue `push` covariance and request cache result cast to resolve TypeScript strictness errors introduced during prior `any` cleanup.
- **recipeService `FirestoreDocLike` missing `exists`**: Added optional `exists` property to the local `FirestoreDocLike` type used for Firestore document existence checks.


### Added
- **Freezer-aware shelf life** (audit Q foundation): `getFreezerShelfLifeDays(itemName)` in `appUtils.ts` returns USDA-based freezer durations by food type — ground/hamburger meat 4 months, chicken/turkey 9 months, beef/pork steaks 9 months, sausage/bacon/ham 6 months, lean fish 6 months, fatty fish (salmon/tuna) 3 months, shrimp/shellfish 4 months, deli meats 2 months, bread/baked goods 3 months, butter 1 year, unrecognised items 4 months.
- **`getAutoExpirationDate` freezer branch** (audit Q foundation): New optional third param `storageLocation?`. When `'freezer'` is passed the function returns the USDA freezer shelf-life date instead of fridge/pantry durations. Dry goods still return `undefined` (no auto-expiry) regardless of location.
- **Auto-extend expiry on freezer move**: When a user changes a pantry item's storage location to Freezer in `ItemDetailModal` and saves, the app automatically sets `is_frozen`, `frozenAt`, `freezerExpiry`, and `expirationDate` to the USDA-derived date. Moving back out of the freezer clears all frozen-state fields.
- **Frozen items skip fridge-style alerts**: `shouldShowExpiryAlert` and `generateExpirationAlerts` in `appUtils.ts` now detect frozen items (`is_frozen` or `storageLocation === 'freezer'`) and use `freezerExpiry` as the reference date. Frozen items only surface alerts within 30 days (vs 7 days for fridge items) and display gentler language — "best used within N days (frozen)" rather than urgent expiry warnings. Overdue frozen items show "past its freezer date" rather than "expired".
- **pantryService freezer-pass-through**: All three `getAutoExpirationDate` call sites in `pantryService.ts` now pass `inferStorageLocationFromItemName(name)` as the third arg, so a scanned "frozen chicken breast" gets a 9-month expiry automatically at item creation time.

### Fixed
- **TypeScript `any` cleanup — three major service files** (audit N complete):
  - `services/recipeService.ts`: Added typed interfaces `AnalyzedInstruction`, `ExtendedIngredient`, `WinePairing`, and local `FirestoreDocLike`. Eliminated all 28 explicit `any` annotations including `catch (err: any)` → `catch (err: unknown)` and cast-free Firestore snapshot handling.
  - `services/geminiService.ts`: Imported `PerformanceTrace` from `firebase/performance`. Typed `QueuedRequest.reject` as `(error: unknown) => void`, queue as `QueuedRequest<unknown>[]`, request cache as `Map<string, { result: unknown; timestamp: number }>`, and `performSearch` perfTrace param. All 26 explicit `any` eliminated.
  - `services/groceryPriceService.ts`: Replaced all verbose `(DatabaseMonitoringService as any)` defensive runtime-check cascades (`getIngredientPrice`, `getPriceTrends`, `saveGroceryPrice`) with direct typed method calls. All 26 explicit `any` eliminated.
- **ESLint `no-explicit-any` rule re-enabled**: `eslint.config.ts` changed from `"off"` to `"error"`. Lint passes with 0 errors across all three cleaned files.

## [1.5.10] - 2026-04-10

### Added
- **Notifications load-more** (audit I): AppHeader notification dropdown now shows 50 at a time. A "Load more (N remaining)" button appears at the bottom of the list and loads 50 more per tap — purely display-side, no extra Firestore reads.
- **Bulk ops contextual tip** (audit J): First time a user enters bulk select mode in PantryScanner a small inline hint bar appears: "Tap items to select them, then delete, move to shopping list, or change storage location." Auto-hides after 6 seconds; ✕ to dismiss early. Shown once per device via localStorage.
- **Household onboarding wired** (audit K): `ModernOnboardingFlow` now accepts and passes through `onOpenHousehold`. App.tsx passes a handler that closes onboarding and opens the Household panel, so new users can set up household sharing from the first-run flow.
- **Bulk ops progress bar** (audit L): `bulkDelete` and `bulkMoveToShoppingList` in PantryScanner now show an animated progress bar (`Processing… X / Y`) above the item list while operations run. Bar clears automatically on completion.

### Won't Fix
- **LeftoverQuickCapture in ItemDetailModal** (audit H): Leftovers can only originate from a cooked meal — not individual pantry items.
- **Recipe modal jump-to-section** (audit M): Most recipes fit on one screen without scrolling; not worth adding navigation anchors.

## [1.5.9] - 2026-04-10

### Added
- **Household activity feed re-enabled**: The `HouseholdActivityFeed` lives in the `AppHeader` dropdown (accessible from any tab), so the subscription now activates as soon as the household is loaded — no tab gating. The `activityHousehold` state in `App.tsx` syncs from `useDataManagement`'s `household` value after load, resolving the circular hook dependency that kept the subscription permanently disabled.
- **Write throttle on activity logging**: `HouseholdActivityService.logActivity` is now throttled to at most one write per user per household every 30 seconds, preventing write storms from rapid item operations.
- **Household state sync**: Added `activityHousehold` state in `App.tsx` that syncs from `useDataManagement`'s `household` value after load, resolving the circular hook dependency that kept the subscription permanently disabled.

### Fixed
- **Audit items A + B (stale)**: Verified `MealPlanner.displayPlan` is already memoized over a 7-day window and `PantryScanner.processedInventory` is already memoized — both audit items were describing superseded code.

## [1.5.8] - 2026-04-10

### Added
- **Calendar export (.ics)**: MealPlanner week toolbar now has an "Export .ics" button. On web it downloads a standards-compliant `.ics` file; on mobile it adds native calendar events via CapacitorCalendar. `calendarService.ts` now has `exportWeekAsICS(days)`.
- **Shopping list delete undo toast**: A floating "X item removed · Undo" banner now appears above the bottom nav whenever a swipe-delete is pending. Tapping Undo cancels the 5-second timer and restores the item instantly.

### Fixed
- **MealPrepPlanner entry point** (audit F): Button in MealPlanner header (`CalendarClock` icon, top-right) was already present and functional — confirmed wired to `showMealPrepPlanner` state; audit item closed.

## [1.5.7] - 2026-04-09

### Fixed
- **Notification action buttons**: `view_item`, `view_recipe`, `add_to_shopping` actions in both `AppHeader` notification panel and `PendingNotifications` (Settings) were non-functional stubs — now fully wired with inventory lookup, tab navigation, and toast feedback
- **Notification panel auto-close**: Panel now stays open for 15 s (was 6 s); hovering pauses the timer, leaving resumes a 5 s countdown
- **`add_to_shopping` stacked notifications**: Now handles `actionData.items` array for batched alerts in addition to single `itemName`
- **Shopping list `confirm()` dialogs**: Replaced native `confirm()` / `alert()` calls in checkout flow and clipboard share with `addToast()`
- **All `alert()` / `confirm()` native dialogs removed** across every component — replaced with `addToast()` from `AppActionsContext`:
  - `MealPlanner`, `BatchOperations`, `ItemDetailModal`, `Household`, `PantryScanner` (bulk delete, receipt error, manual add error, move-to-shopping, defrost)
  - `Settings` (remove member, remove avatar, bulk image scan)
  - `ShoppingList` (duplicate item, SMS clipboard)
  - `GroceryCostEstimator`, `ImportModal`, `RecipeModal`, `RecipeFinder`
- **Login debug timer**: Removed `setInterval` that fired every 1 s during the entire Login component lifetime
- **AdMob gate**: `ADMOB_ENABLED` now reads `import.meta.env.VITE_ADMOB_ENABLED === 'true'` instead of hardcoded `false`
- **Offline queue ID**: Replaced `${Date.now()}_${Date.now()}` with `crypto.randomUUID()` for guaranteed uniqueness
- **Gemini timeout failsafe**: `GeminiLoadingOverlay` now accepts `onTimeout` prop; `useGeminiProgress` fires it when the countdown reaches zero
- **Image upload validation**: `ItemDetailModal` now rejects files that are not `image/*` or exceed 10 MB before uploading to Firebase Storage
- **PII removed from error logs**: `notificationService.ts` error log no longer includes `authUid` or `targetUid`
- **Source maps disabled in production**: `vite.config.ts` now sets `sourcemap: mode !== 'production'`
- **Console logs stripped from production bundle**: Added `esbuild: { drop: ['console','debugger'] }` for production builds
- **Safe area / notch support**: `index.html` viewport meta updated to `viewport-fit=cover`; `pt-safe` CSS class added; `AppHeader` uses `env(safe-area-inset-top)` for top padding
- **Barcode scan web fallback**: Shows informative toast on web/desktop instead of silently failing with a Capacitor error
- **Household member count**: Badge showing "N members" now visible next to household name in the household manager header
- **TypeScript `any` cleanup in core hooks**: `useDataManagement.ts` — `recentActions` typed as `UndoAction[]`, `handleAddToPlan` typed as `StructuredRecipe | SavedRecipe`, `recordUndo` data typed as `unknown`; `AppContext.tsx` — replaced two `as any` stubs with proper `React.Dispatch` types

### Removed
- `functions/src/paypal.ts`, `functions/lib/stripe.js`, `functions/lib/stripe.js.map` — dead payment code deleted
- `GEMINI_LEFTOVERS_NOTES.txt`, `GEMINI_SUGGESTIONS.txt`, `listing.txt`, `readme/consolelog.txt` — stale dev notes deleted

## [1.5.6] - 2026-03-24

### Added
- Performance optimizations for database operations and notification handling

### Fixed
- Various bug fixes and improvements

## [1.5.5] - 2026-03-23

### Added
- **Activity Feed in header**: Household activity feed is now accessible via the household members status indicator in the app header (centre section). Tapping the indicator opens a dropdown showing recent member actions — no longer buried in the Community tab. Only visible to multi-member households.
- **SmartRecommendations in Recipe Finder tab**: `SmartRecommendations` component renders above the RecipeFinder on the Recipes tab; reads only the already-cached `inventory` and `savedRecipes` arrays (zero extra Firestore reads), matching pantry items against saved recipe ingredients for "Cook with What You Have" suggestions, expiry alerts, and time-based dinner prompts.
- **Household activity tracking re-enabled**: Debounced `debouncedUpdateActivity` writes (tab-change + page-visibility) re-enabled in `useHouseholdActivity`.

### Removed
- **Email invite Cloud Function** (`sendHouseholdInvitation`): Deleted `functions/src/sendHouseholdInvitation.ts`, `functions/src/helpers/sendEmail.ts`, and `services/emailService.ts`; in-app bell notification (written directly to user cache) is the only invite signal.
- **Stripe payment code**: Deleted `functions/src/stripe.ts`, `components/StripeCheckout.tsx`, and `services/stripeService.ts`; Stripe integration was fully dormant (null stub + commented-out CF export).

### Fixed
- **Notification action buttons**: Action labels in the notification dropdown (e.g. "View Items", "Add to Shopping List") were non-interactive `<div>` elements — replaced with functional `<button>` elements that invoke the correct handler for each `actionType`.
- **Notification swipe-to-dismiss**: Added horizontal swipe gesture support on notification dropdown items with direction lock, red "Dismiss" reveal layer, 80 px threshold, and snap-back animation on release.
- **MealPlanner timezone bug**: "This Week" compact view showed wrong day labels/dates due to UTC-midnight parsing. Fixed by appending `'T12:00:00'` for local noon parsing and recomputing `dayName` from the date string.

## [1.5.4] - 2026-03-23

### Added
- **SmartRecommendations in Recipe Finder tab**: `SmartRecommendations` component now renders above the RecipeFinder on the Recipes tab; reads only the already-cached `inventory` and `savedRecipes` arrays (no extra Firestore reads), matching pantry items against saved recipe ingredients for "Cook with What You Have" suggestions, expiry alerts, and time-based dinner prompts
- **Household Activity Feed**: Re-enabled `HouseholdActivityFeed` in the Community tab; shows recent household member actions (adds, removals, recipes, meals) with live Firestore subscription; member "currently viewing" activity tracking re-enabled via debounced writes

### Removed
- **Email invite Cloud Function** (`sendHouseholdInvitation`): Deleted `functions/src/sendHouseholdInvitation.ts`, `functions/src/helpers/sendEmail.ts`, and `services/emailService.ts`; in-app bell notification (written directly to user cache) is the only invite signal
- **Stripe payment code**: Deleted `functions/src/stripe.ts`, `components/StripeCheckout.tsx`, and `services/stripeService.ts`; Stripe integration was fully dormant (null stub + commented-out CF export)

### Added
- **CookingMode component**: New step-by-step cooking mode view for guided recipe execution
- **NotificationSettings**: Expanded notification preference controls

### Fixed
- **Notification action buttons**: Action labels in the notification dropdown (e.g. "View Items", "Add to Shopping List") were non-interactive `<div>` elements — replaced with functional `<button>` elements that invoke the correct handler for each `actionType` (`add_to_shopping`, `view_recipe`, `view_item`, `join_household`)
- **Notification swipe-to-dismiss**: Added horizontal swipe gesture support on notification dropdown items with direction lock (won't interfere with vertical scroll), red "Dismiss" reveal layer, 80 px threshold, and snap-back animation on release
- **MealPlanner timezone bug**: "This Week" compact view showed wrong day labels and date numbers due to `getUTCDay()` / `new Date("YYYY-MM-DD")` UTC-midnight parsing returning the previous calendar day in US timezones. Fixed by always appending `'T12:00:00'` for local noon parsing and always recomputing `dayName` from the date string instead of trusting a potentially corrupt stored value
- **`parseIngredientForShoppingList`**: Fixed several ingredient parsing edge cases — Unicode vulgar fractions (½, ¼, ¾, etc.) now normalised to ASCII before parsing; mixed fractions ("1 1/2 cups") collapsed to decimal; "to taste" variants handled (prefix, suffix, after comma); bare article "an" now treated same as "a"; bare article nouns ("an egg", "a garlic clove") correctly strip the article and default quantity to 1; parenthetical notes ("(optional)", "(14.5 oz)") stripped from item name
- **Smoke test suite**: Split into two workers (A–Q / R–Z) to prevent OOM under Vitest; replaced full `AppProvider` wrapper with minimal `MemoryRouter` wrapper to avoid Firebase service accumulation; added `afterEach` cleanup + fake timers; skip list for native-only components (`AdMobBanner`, `PantryScanner`, `QuickAdd`) that hang in jsdom
- **ARIA / accessibility**: Fixed missing ARIA labels, roles, and keyboard-navigation attributes across multiple components
- **TypeScript**: Removed `@ts-ignore` suppressions, resolved type errors in validation utilities and hooks

## [1.5.4] - 2026-03-22

### Fixed
- Added `@import "tailwindcss"` to `src/index.css` so Tailwind utility classes are compiled into the bundle; the app was previously relying entirely on the CDN for all utility styles, causing broken layout after CDN removal

## [1.5.3] - 2026-03-22

### Changed
- Switched Gemini AI model to `gemini-2.5-flash` for faster, more accurate pantry analysis
- Updated all npm packages: firebase 12.11.0, firebase-admin 13.7.0, @google/genai 1.46.0, @sentry/react 10.45.0, tailwindcss 4.2.2, vitest 4.1.0, typescript 5.9.3, lucide-react 0.577.0, @capacitor/core 8.2.0, vite-plugin-pwa 1.2.0

### Fixed
- Notification write race condition: concurrent expiry/leftover checks caused `failed-precondition` (HTTP 400) errors; writes are now serialized per-user with exponential-backoff retry
- Removed Tailwind CDN `<script>` tag from index.html (was triggering production warning; Tailwind is already bundled via PostCSS)
- Barcode scanner now performs Spoonacular UPC product lookup to populate item name instead of showing raw barcode number
- Add Item and Scan Review modals standardized to match `ItemDetailModal` pattern (centered, fixed header/footer)
- Scan buttons reorganized into two rows to prevent overflow on narrow screens

## [1.5.2] - 2026-03-22

### Fixed
- **Billing spike / Gemini API flood**: Fixed a critical bug in `RecipeFinder` and `MealPlanner` where `debounce()` was wrapped in `useMemo([query])`, causing a brand-new debounce instance to be created on every keystroke. This meant every character typed fired a separate Gemini API call instead of one call after the user stopped typing. Replaced with a stable `useRef`-based debounce so only one call is made per completed search.

## [1.5.0] - 2026-03-21

## [1.5.1] - 2026-03-22

### Added
- **Testability / Instrumentation**: Added stable `data-testid` attributes across many interactive components (examples: PantryScanner, MealPlanner, RecipeFinder, MealPrepPlanner, LeftoverQuickCapture, ProgressiveFeature, PriceTrends, Household, CategoryManager, BatchOperations) to improve Firebase Test Lab and automated UI test reliability.
- **Version bump**: Bumped app version to `1.5.1` (Android `versionCode` 26).

### Changed
- Minor testability and instrumentation improvements only; no user-facing behavior changes.


### Fixed
- **Android Launcher Icon**: Regenerated all mipmap density variants (ldpi → xxxhdpi) with the correct Stock & Spoon logo, replacing the placeholder gray square icon
- **Splash Screens**: Added splash screen assets for all screen densities, orientations, and night mode variants
- Committed `resources/icon.png` and `resources/icon-foreground.png` as canonical sources for future icon generation

## [1.4.10] - 2026-03-21

### Added
- **Hot-Patch Version System**: New `scripts/publish-version.cjs` script writes the current version to Firestore `app_versions/{android,ios,web}` — running `npm run version:publish` after any release immediately notifies all users of the update
- **In-App Update Prompt on Foreground**: `GlobalUpdatePrompt` now re-checks for updates every time the app returns to foreground using Capacitor `App.addListener('appStateChange')`, so users see the update prompt even if they had the app open before the release
- **Play Store Link in Version Check UI**: Settings → Check for Updates now always shows a direct link to the Google Play Store listing after any version check

### Changed
- **Update Dismiss Window**: Reduced the "remind me later" dismissal window from 7 days to 1 day — users are re-prompted daily instead of weekly for pending updates
- **Force Update Guard**: `GlobalUpdatePrompt` skips dismiss logic entirely when `forceUpdate: true` is set in Firestore, so critical updates cannot be deferred
- **Build-Time Version Injection**: `vite.config.ts` now injects `__APP_VERSION__` at build time from `package.json`; web version check fallback reads this value instead of a hardcoded string
- **Release Skill**: Combined `release-build` and `update-changelog-push` workflows into a single `/release-build` command that type-checks, bumps versions, builds, syncs, publishes to Firestore, commits, and pushes

### Fixed
- **Version Service Web Fallback**: Settings version check was reporting `1.4.8` as "up to date" — now correctly reads build-time `__APP_VERSION__` constant
- **Update Prompt Never Shown**: `GlobalUpdatePrompt` was never triggering because Firestore `app_versions` documents were empty; `publish-version.cjs` seeds all three platform documents automatically
- **Wrong Firebase Project in Publish Script**: `publish-version.cjs` was targeting the wrong project ID; now auto-detects service account key from `scripts/` and uses correct project `ornate-compass-478504-e1`

## [1.4.9] - 2026-03-20

### Added
- **Free Tier Invite Limit**: Free users are now capped at 1 household invite; `usageService.ts` enforces limit and `SubscriptionManager` surfaces upgrade prompt when cap is reached
- **Firestore Composite Index**: Added index for `cache` collection queries to support notification and cache data access patterns

### Changed
- **Quantity Fill Level Icons**: Replaced flat rectangle fill-bar with distinct colored unicode circle icons (◔ ¼ amber, ◑ ½ orange, ◕ ¾ green, ● full dark-green) with glow on selection in `ItemDetailModal`
- **Add to Schedule Default Date**: Schedule modal now pre-selects tomorrow's date when opening instead of always defaulting to Monday/index 0
- **Meal Plan Default Day**: `onShowAddToPlanDialog` callback finds tomorrow in the meal plan array by ISO date and falls back to index 0 only if tomorrow is not in the plan

### Fixed
- **Redundant Firestore Queries**: `getUnreadNotifications` was called once per expiring item in the notification loop — now fetched once before the loop and passed as a cache parameter to `createExpirationAlert`
- **"Checking In" Notification Spam**: Suppressed low-value notifications for risk levels 1 (Staples) and 2 (Hardy Fridge) entirely; suppressed level 3 (Produce) alerts when item has more than 3 days remaining
- **Stale "Online" Member Badge**: Household members shown as online only if `isOnline === true` AND `lastSeen` is within the last 5 minutes — prevents stale presence from persisting after app close without logout
- **Household Header Too Many Lines**: Status indicator capped at 2 lines (first online member's name + "+N others online") instead of 3; `recentlyActiveMembers` excludes anyone already counted as online
- **Expired Notification Pruning**: `notificationsService.ts` now prunes expired notifications from the queue during sync
- **LeftoversHotZone Doc Snapshot**: Rewritten to use Firestore doc snapshot listener for live updates instead of stale data
- **ItemDetailModal TDZ Crash**: Fixed temporal dead zone reference error on modal open

## [1.4.8] - 2026-03-20

### Changed
- Release build preparation and version updates (versionCode 22)

## [1.4.7] - 2026-03-20

### Added
- **Full Internationalization (i18n)**: All UI text across 9 components now translatable via `react-intl` — `App.tsx`, `ShoppingList`, `ItemDetailModal`, `MealPlanner`, `RecipeFinder`, `Settings`, `Household`, `ExpiredItemsModal`, and supporting views
- **7-Language Locale Support**: Complete translation files added for English, Spanish, French, German, Russian, Chinese (Simplified), and Japanese (`src/locales/`)
- **Dependabot Configuration**: `.github/dependabot.yml` set up with weekly dependency updates for npm (root, `/functions`, `/website`) and Gradle (`/android`), with minor/patch updates grouped to reduce PR noise
- **Secret Scanning**: `.github/secret_scanning.yml` added to configure path exclusions for test fixtures, example files, and third-party vendored clients; push protection guidance documented

### Fixed
- Minor packaging and build metadata updates for release (version bump)

## [1.4.6] - 2026-03-19


### Changed
- Release build preparation and version updates

## [1.4.4] - 2026-03-17

### Added
- **Personalized Greeting**: AppHeader now shows a time-based greeting ("Good morning/afternoon/evening, [Name]!") using the user's display name for a more personal experience
- **Household Data Migration on Join**: When a user accepts a household invitation, all personal data (inventory, shopping list, meal plan, saved recipes) is automatically migrated and merged into the household — no data is lost on join
- **Household Data Migration Retry**: Migration uses a localStorage checkpoint; if the app closes mid-migration or a step fails, a persistent "Retry now" toast appears on next load to resume
- **Persistent Invite Notifications**: A sticky banner beneath the app header and a persistent toast with a "View" action button now appear whenever pending household invitations are detected on login
- **User Profile Recipe Scoring**: RecipeFinder now filters and ranks recipes by personal profile — diet goals, favourite cuisines, preferred proteins, and disliked ingredients are all considered, with a score-based sort and toast highlight for top matches
- **Profile-Aware Preference Utilities**: New `checkRecipeAgainstUserProfile` and `filterRecipesByUserProfile` helpers in `preferenceUtils.ts` for personalised recipe recommendation scoring
- **Nutrition Utilities**: New `nutritionUtils.ts` with `getUserNutritionTargets` and `checkRecipeMacros` helpers; covered by unit tests in `src/test/utils/nutritionUtils.test.ts`
- **UserProfile Type Extensions**: Added `favoriteCuisines`, `preferredProteins`, `dislikedIngredients`, `specialNeeds`, and `userProfile` fields to the `UserProfile` type

### Changed
- **Settings Reorganisation**: Removed Database Monitoring from the More tab; moved Leftover Analytics to the Organisation tab; Privacy & Legal confirmed in More tab; user name field present in profile
- **HouseholdInviteModal Redesign**: Rebuilt as a theme-aware modal with accent-colour header, a checklist of what joining means, a prominent "Accept & Join" button, and a "Decide later" dismiss link — replaces the previous minimal dialog
- **RecipeFinder Search UI**: Added inline search button that appears when query text is present; search input now uses theme-consistent styling
- **MealPlanCacheService**: Extended to support household-scoped meal plan reads and writes needed by the data migration flow

### Fixed
- **Alert → Toast (Settings)**: All `alert()` calls in Settings.tsx (household creation, avatar update/remove, feedback submit, bulk image update, Privacy & Legal clipboard copy) replaced with non-blocking `addToast` notifications
- **Alert → Toast (ItemDetailModal)**: Image upload failure `alert` replaced with `addToast`; related `console.warn/error` calls routed through `logService`
- **Console Logging (Login)**: Replaced all `console.*` calls in `Login.tsx` with structured `logService` (`log.debug/warn/error/info`)
- **Console Logging (Household)**: `console.error` calls in `leaveHousehold` and `removeMember` replaced with `log.error`
- **Console Logging (HouseholdInviteModal)**: `console.error` replaced with `log.error`; removed unused `serverTimestamp`, `DatabaseMonitoringService`, and `markNotificationRead` imports
- **Gemini Service**: Minor fixes to model reference and error handling

## [1.4.3] - 2026-03-16

### Fixed
- **Premium Tier Enforcement**: Fixed critical bug where new users and users without stored subscriptions defaulted to premium tier instead of free tier, ensuring proper revenue gating
- **Premium Upgrade Navigation**: Upgrade buttons in PremiumFeature now navigate to the Settings/Subscription tab instead of showing a placeholder alert
- **Version Check Display**: Verified version check in Settings correctly reads current version from Capacitor App plugin with web fallback
- **Capacitor Plugins Update**: Updated all Capacitor plugins from v7 to v8 to resolve deprecated ProGuard configuration causing Gradle 9+ build failures
- **Safe Area Plugin ProGuard Fix**: Applied patch to capacitor-plugin-safe-area to use modern ProGuard configuration for Gradle 9+ compatibility
- **Safe Area Plugin Build Fix**: Built and added missing distribution files to capacitor-plugin-safe-area to resolve Vite import errors
- **Safe Area Plugin Patch Application**: Applied patch-package to capacitor-plugin-safe-area and committed patch files for persistent ProGuard fixes
- **Help Page Link**: Added "View FAQ & Help" button in Settings > More > Help & Support section to access the comprehensive FAQ page

### Changed
- **Capacitor Core**: Updated from v7.6.0 to v8.0.1
- **Capacitor Plugins**: Updated all plugins (app, browser, camera, device, haptics, local-notifications, push-notifications) to v8.0.1
- **Capacitor Android**: Updated to v9.0.0 (dev) to resolve ProGuard deprecation issues with Gradle 9+
- **Safe Area Plugin**: Updated to v4.0.3 from v6 branch with ProGuard compatibility patch and built distribution files

## [1.4.2] - 2026-03-16

### Changed
- **Android Build Modernization**: Migrated Android build configuration to use version catalogs for better dependency management and maintainability
- **Settings Performance**: Added debounced saving for profile changes to reduce unnecessary API calls and improve user experience
- **Copilot Instructions**: Enhanced AI agent documentation with comprehensive project context, testing patterns, advanced features, and development guidelines
- **Premium Upgrade Flow**: Updated PremiumFeature component to navigate to Settings tab instead of showing alert placeholders

### Fixed
- **Household Admin Leave Button**: Fixed issue where household admins couldn't see the leave household button due to conditional logic that only showed it for non-admin users
- **Gemini API Integration**: Updated all model references from incorrect names to `gemini-2.5-pro` for proper AI image analysis
- **Image Service Improvements**: Added timeout handling and Unsplash API fallback for pantry item images to resolve CORS issues
- **Modal UI Layout**: Fixed footer overlap in pantry scanner component with proper flex layout structure
- **Database Analytics Button**: Resized oversized button to 20×20px for consistent UI sizing
- **Meal Plan Calendar**: Fixed date selection logic to properly show today as default instead of being stuck on previous dates
- **App Code Cleanup**: Removed unused code and improved import organization in App.tsx
- **Premium Tier Enforcement**: Fixed critical bug where new users and users without stored subscriptions defaulted to premium tier instead of free, ensuring proper revenue gating
- **Production Readiness**: Added modal focus traps for accessibility, OS dark mode detection, camera permission error handling with user-friendly toasts, aria-live regions for validation errors, removed dead calendar export button
- **Console Logging**: Replaced all console.* calls with proper logService/Sentry routing for production monitoring
- **TypeScript Fixes**: Resolved type errors in MealPlanCacheService and useFocusTrap hook

## [1.4.1] - 2026-03-13

### Added
- PullToRefreshWrapper component for managing store layouts
- StoreLayoutEditor component for managing store layouts
- priceCalculator utility for price calculations
- purge-git-history script for repository maintenance

### Changed
- Comprehensive performance improvements across multiple components
- Enhanced notification system with deduplication
- Settings reorganization with Food Safety preferences moved to top
- Updated authentication and app URL handling
- Improved meal planning and shopping list features
- Enhanced database analytics and caching services

### Fixed
- Meal planner day selection: Fixed issue where clicking different days wouldn't load correctly due to race condition in day creation
- Removed race condition by ensuring all displayPlan days exist in mealPlan before rendering
- Fixed auth API errors by removing problematic configurations
- Improved Firebase redirects and app verification
- Resolved HTTP load errors in Android builds
- Updated app icon references for consistency

### Removed
- Pull-to-refresh functionality (causing scrolling issues and data loading problems)
- react-pull-to-refresh dependency

## [1.4.0] - 2026-03-13

### Added
- **Pull-to-Refresh Functionality**: Implemented pull-to-refresh across all app tabs using react-pull-to-refresh library
  - Added `PullToRefreshWrapper` component for consistent refresh behavior
  - Integrated `refreshAllData` function in data management hook for efficient data reloading
  - Maintains scroll position and provides smooth user experience across Pantry, Shopping List, Meal Planner, and Community tabs

- **Meal Planner Calendar Enhancements**: Improved visual indicators for better user experience
  - Days with meals now display white dots/text for clear identification
  - Selected day shows green background for improved navigation feedback
  - Enhanced calendar styling for better visual hierarchy and usability

- **Recipe Image Placeholders**: Added attractive SVG-based placeholder images for recipe search results
  - Implemented `generateRecipePlaceholderImage` function that creates consistent, colorful placeholders
  - Color generation based on recipe titles for visual variety and consistency
  - Fallback handling for all recipe sources (saved, cached, and Gemini-generated recipes)
  - Improved visual consistency in meal plan search results

### Changed
- **Recipe Search Modal**: Updated to display placeholder images instead of empty spaces for recipes without images
- **Meal Planner Component**: Enhanced with improved calendar styling and image handling logic

## [1.3.9] - 2026-03-09

### Performance
- Optimized database writes when adding multiple missing ingredients to shopping list
- Parallelized price lookups to reduce sequential query delays
- Improved caching batch operations for better performance

### Fixed
- Reduced excessive database reads on Community tab
- Fixed recipe images not saving with ratings
- Corrected usage limits reset function for all users

## [1.3.8] - 2026-03-07

### Added
- Household management enhancements: Admin controls for member removal with data migration, member name editing, and fixed "Manage Household" button functionality.

## [1.3.2] - 2026-03-03

### Added
- **Recipe Creation UX**: Completely redesigned the add recipe modal for better user experience
  - Added meal type dropdown (vegan, keto, paleo, gluten-free, dairy-free, etc.)
  - Implemented dynamic ingredient/step inputs that start with 4 fields and expand automatically
  - Changed from confusing portions section to simple servings count
  - Clarified "submit for inclusion" checkbox with better explanation

### Fixed
- **Missing Ingredients Count**: Fixed missing ingredients to only count current/future meals in the 7-day meal plan view
  - Previously included past meals that hadn't been manually removed
  - Now automatically excludes meals that have "passed" as days progress
  - Button resets to 0 when meals move from today to yesterday

### Changed
- **Recipe Modal**: Removed "Mark as Made" and "Add to Schedule" buttons from recipe creation mode
- **Recipe Modal**: Removed nutrition facts display from recipe creation (kept only in view mode)
- **Recipe Modal**: Changed from textarea inputs to single-line inputs for ingredients and instructions

## [Unreleased] - 2026-02-13

### Added
- **Risk-Based Notification System**: Implemented comprehensive 5-tier food safety risk classification system
  - **Risk Levels**: High-risk (meat/fish/poultry), Perishables (produce/eggs/dairy), Fridge items (cheese/yogurt), Hardy fridge (condiments), Staples (canned/pasta)
  - **Contextual Messaging**: Notifications vary in tone and urgency based on food safety risk to prevent "notification fatigue"
  - **Notification Stacking**: Multiple expiring items are grouped to avoid spam notifications
  - **Waste Notifications**: Guilt-free messaging when items are tossed with learning insights
- **Scenario-Based Onboarding**: Replaced boring direct risk tolerance questions with engaging "Vibe Check"
  - **Milk Test**: "Expired milk scenario" with conservative/moderate/risk-taking response options
  - **Meat Test**: "Chicken at Use By date scenario" with freezer/storage decision options
  - **Risk Level Computation**: Responses mapped to 5-tier safety levels (Purist=5, Pragmatist=3, Adventurer=1)
  - **Visual Interface**: Clean button-based selection instead of checkbox questions
- **Onboarding Flow Integration**: Risk assessment now occurs before tutorial to ensure completion
  - **Mandatory Phase**: Users must complete risk assessment before accessing interactive tutorials
  - **Data Persistence**: Risk levels saved to user profile in Firestore for personalized notifications
  - **Analytics Tracking**: Risk levels included in onboarding completion metrics
- **Expiry Alerts**: Added persistent expiry alert system with visual indicators
  - Items expiring within 7 days now show a clock icon in the pantry view
  - Alert status is stored with each item to avoid constant database queries
  - Automatic calculation when adding or updating items with expiration dates
 - **Community Quick-Save**: Added a "Save Recipe" quick action on Community cards to let users save recipes directly from community ratings
 - **Rating Persistence**: Ratings now persist the embedded `recipe` object at submission time so Community entries display correct title, image, and ingredients without additional lookups
 - **Sanitize Recipe Saves**: Recipe saves now strip placeholder or empty ingredient/instruction fields to prevent saving incomplete recipes

### Fixed
- **Database Performance**: Resolved critical performance issue causing excessive database reads
  - **Root Cause**: Random cleanup operations running 10% of the time on every inventory save
  - **Impact**: Reduced database reads from 1,002 per minute to ~2 per minute (99.8% reduction)
  - **Solution**: Removed unnecessary random cleanup operations that were causing periodic query spikes
  - **Result**: Database queries now remain stable instead of growing every 30 seconds
- **Meal Plan Performance**: Fixed infinite loop in meal plan listener causing excessive database reads
  - Replaced shallow array comparison with deep equality check using `hasMealPlansChanged`
  - Prevents unnecessary state updates when meal plan data hasn't actually changed
- **Database Monitoring**: Fixed TypeError in `DatabaseMonitoringService.getDocs` when queryRef.parent is null

### Fixed (2026-02-24)
- **Meal Planner today label & date handling**: Corrected local date handling and label logic so the Meal Planner shows the correct "today" meal and preserves meal-type labels when editing or saving plans.
- **Database instrumentation coverage**: Replaced several runtime direct Firestore calls with `DatabaseMonitoringService` wrappers to ensure reads/writes are tracked by analytics and monitoring.
- **TypeScript: defensive casts and guards**: Added defensive `doc.data()` casts/guards in services and small type fixes to reduce compile errors (e.g., `recipeRatingService`, `householdService`, `imageCacheService`).
- **Meal plan cache API**: Fixed incorrect `setDoc` call signature in `mealPlanCacheService` (removed unsupported options arg for wrapper).

### Changed (2026-02-24)
- **Developer**: Continued incremental TypeScript remediation focused on low-risk fixes (casting, adding missing local interfaces, and normalizing date handling) to make the codebase easier to iterate on.

### Changed
- **Inventory Management**: Migrated PantryScanner to use InventoryCacheService for efficient bulk operations
- **Database Monitoring**: Reduced update frequencies for PerformanceMonitoringDashboard (1s → 60s) and DatabaseAnalytics (5s → 60s)
- **Listener Optimization**: Added 6-second throttling to inventory listeners to prevent excessive reads
 - **AdMob Gating**: AdMob banners and interstitials are now shown only to non-premium (free) users; ad display is gated by feature flags and user subscription status
 - **Payments Migration**: Removed Stripe and PayPal client integrations; migrated in-app purchases and subscriptions to Google Play Billing (Android). Web payment UI components were removed or gated behind premium feature flags.

### Investigation
- **Database Read Issue**: Investigated excessive database reads occurring every 6 seconds; implemented throttling and monitoring adjustments (later reverted due to increased read volume)

### Fixed (2026-02-18)
- **Shopping List**: Fixed a dynamic-import runtime error by correcting a syntax issue in `components/ShoppingList.tsx`. Normalized selection behavior to use only the `checked` flag and removed top-level Select All / Delete Checked controls.
- **Price Cache Auth**: Made price-cache Firestore access auth-aware to prevent permission errors when the app initializes before authentication.
- **TypeScript Hygiene**: Applied targeted type fixes to reduce compiler noise: narrowed unknown `catch` types, adjusted optional properties in `groceryPriceService`, and fixed several utility typings (`utils/appUtils.ts`, `utils/errorUtils.ts`).

### Changed (developer)
- Continued incremental TypeScript remediation across the repository (focused, low-risk patches). Next focus: add typed Firestore test mock factories to resolve many test mock typing errors.

## [1.3.1] - 2026-02-09

### Fixed
- **Settings Component**: Resolved duplicate declaration error causing dynamic import failures
- **Household Member Management**: Fixed currentUser scope error in member preferences
- **Component Architecture**: Various component fixes and improvements across the application

## [1.3.0] - 2026-02-02

### Enhanced
- **Performance Optimizations**: Comprehensive performance improvements across the application
  - **Critical Fixes**: Replaced JSON.stringify with direct object comparison, deduplicated Firestore listeners, implemented batch operations
  - **Memory Management**: Added useCallback optimizations, list memoization, lazy loading for components
  - **UI Performance**: Implemented virtual scrolling for large lists, search debouncing (300ms), optimized re-renders
  - **Data Operations**: Enhanced Firestore batch operations and optimistic updates

### Enhanced
- **Code Architecture**: Major refactoring for maintainability and performance
  - **Service Layer**: Extracted business logic to dedicated services (pantryService.ts)
  - **State Management**: Implemented Context API to eliminate prop drilling (AppContext, AppActionsContext)
  - **Listener Management**: Created generic hooks (useDataListener) to remove duplicate Firestore listeners
  - **Error Handling**: Added comprehensive error boundaries for component resilience

### Enhanced
- **TypeScript Strict Mode**: Enabled strict TypeScript compiler options for better type safety
  - **Compiler Configuration**: Added "strict": true, "noImplicitAny": true, "strictNullChecks": true, and other strict options
  - **Type Safety**: Improved code reliability with compile-time error detection

### Enhanced
- **Progressive Image Loading**: Implemented blur-up technique for recipe images
  - **ProgressiveImage Component**: Created reusable component with blur placeholder and smooth transitions
  - **Blur Data URLs**: Added utility function to generate SVG-based blur placeholders
  - **Recipe Images**: Updated RecipeModal and RecipeFinder to use progressive loading
  - **Loading States**: Added loading indicators during image transitions

### Enhanced
- **Loading States**: Comprehensive loading indicators for all async operations
  - **Settings Component**: Added loading states for profile updates, avatar changes, and bulk image operations
  - **RecipeFinder**: Enhanced loading states with skeleton loaders during recipe searches
  - **User Feedback**: Visual loading indicators with disabled states and spinner animations

### Enhanced
- **Skeleton Loaders**: Data-dependent components now show skeleton placeholders
  - **SkeletonLoader Components**: Added PantryItemSkeleton, ShoppingListItemSkeleton, and MealPlanSkeleton
  - **RecipeFinder**: Shows skeleton recipe cards while loading search results
  - **Improved UX**: Better perceived performance with structured content placeholders

## [1.2.1] - 2026-01-28

### Fixed
- **Modal Header Positioning**: Fixed ItemDetailModal and RecipeModal headers to prevent overlap with app header
  - Headers now use fixed positioning at top-[100px] with proper z-index stacking
  - Added padding adjustments to ensure content scrolls correctly under fixed headers
  - Improved close button accessibility and modal usability
- **Scan Review Modal Positioning**: Fixed oversized display and navigation overlap issues
  - Adjusted modal positioning to account for app header (pt-24) and bottom navigation (pb-20)
  - Changed max height from 80vh to calc(100vh-160px) for proper viewport sizing
  - Added responsive width constraints (max-w-sm on mobile, max-w-2xl on larger screens)
  - Improved item layout with stacked remove buttons to ensure all controls are visible
  - Modal now displays correctly within screen bounds without cutting off top or bottom
- **Scan Review Modal**: Identified need for fixed header positioning (pending implementation)
  - AI image analysis confirmation modal should use same fixed header pattern
  - Will prevent header from scrolling away during item review process

### Enhanced
- **Android Build Compatibility**: Upgraded Java runtime to version 21 LTS for improved Android build stability
- **Shopping List Transfer**: Fixed quantity handling when transferring items from shopping list to pantry
  - Added default purchased quantities to prevent transfer failures
  - Improved data consistency during checkout operations

### Fixed
- **Nutrition API Integration**: Resolved USDA FoodData Central API loading issues
  - Changed from process.env to import.meta.env for proper Vite environment variable access
  - Prioritized survey and foundation food data for better nutrition information quality
  - Enhanced nutrient value extraction and display formatting

### Enhanced
- **Item Detail Modal**: Increased image size from w-20 h-20 to w-24 h-24 for better visual space utilization

## [1.2.0] - 2026-01-26

### Added
- **AI Features Opt-in System**: Comprehensive user consent management for Gemini AI-powered features
  - **Settings AI Section**: New "AI Features" section with toggle to enable/disable AI-powered image analysis and smart suggestions
  - **Usage Tracking**: Daily usage counter showing API requests (100/day limit) with clear visual feedback
  - **Privacy Controls**: Explicit user opt-in required before accessing Gemini AI services
  - **Graceful Degradation**: Clear error messages when AI features are disabled, preventing API errors

### Enhanced
- **Pantry Scanner Modal**: Improved modal positioning with 75px bottom padding for better screen centering
- **Mobile Experience**: Resolved horizontal scrolling issues across all components with global overflow-x-hidden
- **Component Architecture**: Updated PantryScanner and Settings components with proper user prop interfaces

### Fixed
- **Android Build System**: Upgraded Gradle Plugin (8.10.0) and Gradle (8.11.1) to resolve compatibility issues
- **Syntax Errors**: Resolved multiple TypeScript compilation errors and code structure issues
- **AI API Integration**: Added opt-in verification before Gemini API calls to prevent unauthorized usage

### Enhanced
- **Offline & Sync Experience**: Comprehensive offline capabilities and sync management
  - **Enhanced Offline Queue Service**: Upgraded with conflict resolution, retry logic, and progress tracking
  - **Sync Status Management**: Real-time sync status with pending operations counter and error handling
  - **Visual Sync Indicators**: Header-integrated sync status showing online/offline state, progress bars, and conflict alerts
  - **Automatic Background Sync**: Seamless data synchronization when connection is restored
  - **Conflict Detection**: Intelligent handling of data conflicts with user resolution options
- **Accessibility (a11y) Improvements**: Comprehensive accessibility enhancements across the application
  - **ARIA Labels**: Added descriptive labels for all interactive elements (buttons, forms, navigation)
  - **Keyboard Navigation**: Implemented full keyboard support with visible focus indicators
  - **Screen Reader Support**: Enhanced compatibility with screen readers using semantic HTML and ARIA attributes
  - **Focus Management**: Added proper focus rings and logical tab order for all components
  - **Semantic HTML**: Improved document structure with proper roles and landmarks
  - **Form Accessibility**: Added field labels, validation messages, and required field indicators

### Enhanced
- **Mobile Layout Optimization**: Comprehensive spacing improvements for mobile devices
  - **Header Spacing**: Optimized 120px top padding for proper content positioning below fixed header
  - **Navigation Spacing**: Minimized bottom gap to 8px minimum, eliminating excessive whitespace above navigation
  - **Safe Area Integration**: Enhanced compatibility with device notches and navigation bars
  - **Content Flow**: Improved vertical spacing throughout the application for better mobile UX

### Fixed
- **Mobile Layout Issues**: Resolved excessive padding and spacing problems in MainContent component
- **Component Spacing**: Fixed inconsistent spacing between header, content, and navigation elements

### Technical
- **Layout Calculations**: Updated MainContent height calculations to properly account for fixed header and navigation heights
- **Safe Area Service**: Improved mobile device compatibility with proper safe area handling

### Fixed
- **Shopping List Sync Issues**: Resolved purchased quantity deletion and reversion problems
  - **Data Validation**: Added `cleanObject()` function to remove undefined fields before Firestore writes
  - **Sync Logic**: Excluded `purchasedQuantity` from sync comparisons to prevent Firestore overwrites
  - **User Experience**: Shopping list items now maintain state when modifying purchased quantities
- **AI Image Processing Modal**: Fixed modal content being cut off behind header/navigation
  - **Modal Positioning**: Increased z-index to `z-[100]` and adjusted top padding to `pt-20`
  - **Modal Sizing**: Increased maximum height to `max-h-[90vh]` for better content visibility
  - **UI Improvements**: Enhanced modal display for AI-powered pantry scanning confirmation
- **Gemini API Rate Limiting**: Implemented automatic retry logic for API rate limit errors
  - **Retry Mechanism**: Added exponential backoff retry (up to 3 attempts, max 10s delay) for 429 errors
  - **Error Handling**: Improved error messages for rate limit scenarios with user-friendly feedback
  - **Multi-Search Support**: Users can now perform multiple AI searches per session without immediate failures

## [1.1.9] - 2026-01-24

### Enhanced
- **Interactive Tutorial System**: Complete overhaul of the onboarding tutorial with robust click detection
  - **Theme Toggle Tutorial**: Fixed click detection reliability for theme button interactions
  - **Add Item Tutorial**: Added data-tutorial attribute to pantry floating action button for proper click detection
  - **Voice Search Tutorial**: Added data-tutorial attribute to microphone button in recipe finder
  - **Click Detection Engine**: Implemented stable ref-based event handling to prevent race conditions and missed clicks
  - **Tutorial Flow**: Improved step completion logic with manual DOM traversal for reliable element detection

### Fixed
- **Tutorial Reliability**: Resolved issues where interactive tutorial steps required multiple clicks to register
- **User Experience**: Ensured smooth onboarding flow without getting stuck on tutorial steps

### Technical
- **Event Handling**: Enhanced click detection with refs and manual DOM traversal for consistent behavior
- **Component Attributes**: Added data-tutorial attributes to interactive elements (theme-toggle, add-item-button, voice-search)
- **State Management**: Improved tutorial state handling to prevent re-render interference with click detection

## [1.1.8] - 2026-01-22

### Fixed
- **Database Performance**: Optimized inventory sync with 1-second debouncing and remote update detection to reduce excessive Firestore reads (from 12-15 per item deletion to 1-2)
- **Nutrition API CORS**: Created Firebase Function proxy for USDA FoodData Central API calls to eliminate browser CORS restrictions
- **Content Security Policy**: Updated CSP policy to allow connections to Firebase Functions emulator (localhost:5001) for development

### Technical
- **Firebase Functions**: Added `getNutritionData` function with support for both food search and detailed nutrition retrieval
- **Nutrition Service**: Refactored to use Firebase Function proxy for all USDA API calls, eliminating direct browser requests
- **Error Handling**: Improved nutrition data fetching with proper fallback strategies and caching

## [1.1.8] - 2026-01-18

### Fixed
- **Critical Runtime Errors**: Resolved multiple TypeScript errors causing app crashes including `userProfile` undefined errors, missing `selectedDayIndex` state, and sodium property access issues
- **Settings Component**: Added proper null checking and optional chaining for user profile data to prevent crashes
- **MealPlanner Component**: Fixed missing state variable causing day selection modal errors
- **RecipeModal**: Fixed nutrition calculation errors with proper type handling
- **Bundle Optimization**: Resolved Vite dynamic import warning by consolidating householdService imports

### Enhanced
- **Saved Recipes UI**: Added beautiful thumbnail images to saved recipes tab for improved visual appeal
- **Recipe Cards**: Enhanced compact recipe display with 16:9 aspect ratio images and hover effects
- **Error Handling**: Improved image loading with fallback placeholders for missing recipe images

### Technical
- **Type Safety**: Added comprehensive optional chaining throughout Settings component
- **Import Optimization**: Converted dynamic imports to static imports for better bundle splitting
- **Build Process**: Cleaned up all TypeScript compilation errors and warnings

### Fixed
- **Capacitor App Listener**: Fixed runtime error "removeListener is not a function" by implementing proper async listener cleanup with useRef
- **TypeScript Compilation**: Resolved 77 TypeScript errors across the application including missing interfaces, methods, and type declarations
- **Form Accessibility**: Added proper id/name attributes and htmlFor labels to all form inputs for WCAG compliance
- **Visual Inventory Levels**: Fixed quantity display to show fractional amounts (½ gal, ¼ cup) when using visual fill level selector
- **Quantity Formatting**: Enhanced formatItemQuantity function to display common fractions (¼, ½, ¾) instead of decimals

### Technical
- **Type Definitions**: Added Member interface, visualLevel field to PantryItem type, and comprehensive Vite environment declarations
- **Service Methods**: Added trackHouseholdJoin and recordMealPlanAddition methods to analytics and usage services
- **Firebase Exports**: Added missing functions export to firebaseConfig.ts for cloud functions integration

## [1.1.7] - 2026-01-08

### Features
- **Usage Limit Enforcement**: Added button disabling when users hit weekly usage limits to prevent excessive database reads
- **Subscription Tier Rebalance**: Updated Premium plan limits (15 searches/week, 20 recipes, 7-day planning) and Family plan (unlimited everything, 5 members)
- **Mobile Back Button Support**: Implemented hardware back button functionality for Android devices to close modals and navigate between tabs
- **Double-Tap Exit**: Enhanced back button with double-tap to exit app, showing a toast message on first press
- **Meal Planner Help**: Added help icon (?) with tooltip explaining drag & drop and day-clicking functionality

### Removed
- **Cooking Reminders**: Removed bell icon notifications from meal planner to reduce UI clutter

### Fixed
- **Performance**: Prevented repeated API calls after hitting limits
- **Free Tier Limits**: Fixed issue where free users showed 0 available searches instead of 5

## [1.1.6] - 2026-01-07

### Infrastructure
- **Firebase Project Migration**: Complete migration from legacy project to new Firebase project
  - **Project ID Change**: Migrated from `gen-lang-client-0893655267` to `ornate-compass-478504-e1`
  - **Data Migration**: Successfully migrated 316 Firestore documents and 6 authentication users
  - **Configuration Updates**: Updated all Firebase configuration files (.firebaserc, .env.local, firebaseConfig.ts)
  - **Service Continuity**: Maintained all existing functionality during migration

### Monitoring & Analytics
- **Firebase Performance Monitoring**: Comprehensive performance tracking implementation
  - **AI Operations**: Added traces for `analyze_pantry_image` and `search_recipes` with custom metrics
  - **Database Operations**: Performance monitoring for Firestore read/write operations
  - **External API Calls**: Tracking Spoonacular API response times and success rates
  - **Image Processing**: Monitoring image upload operations and file sizes
  - **Household Management**: Performance traces for user management and household operations
  - **Utility Functions**: Ingredient parsing performance for shopping list generation

### Technical
- **Firebase Crashlytics**: Enhanced Android crash reporting setup
  - **SDK Integration**: Added Crashlytics 3.0.6 dependency and plugin configuration
  - **Debug Logging**: Enabled performance event logging in AndroidManifest.xml
  - **Test Crash Button**: Added crash testing functionality in MainActivity.java
- **Build Configuration**: Updated Android Gradle configuration for monitoring services
- **Performance Metrics**: Custom attributes and metrics for detailed performance analysis

## [1.1.5] - 2026-01-07

### Performance
- **Bundle Size Optimization**: 71% reduction in main bundle size through manual chunk splitting
  - **Main Bundle**: Reduced from ~1MB to 273KB (82KB gzipped)
  - **Firebase Vendor Chunk**: 670KB (157KB gzipped) - separated for independent loading
  - **Gemini AI Service Chunk**: 225KB (41KB gzipped) - lazy-loaded for AI features
  - **Analytics Service Chunk**: 13KB (5KB gzipped) - separated from AI services
  - **Faster Initial Load**: Improved app startup performance and reduced memory usage

### Fixed
- **Infinite Saving Loops**: Resolved constant Firestore writes in shopping list and inventory
  - **Data Change Detection**: Added JSON comparison checks in Firestore listeners
  - **Performance Improvement**: Eliminated unnecessary database operations
  - **Battery Life**: Reduced device battery drain from constant syncing
- **External Image Fetching**: Implemented async image loading for all item creation paths
  - **Pantry Scanner**: Async image fetching for scanned items
  - **Manual Item Addition**: Async image fetching for manually added items
  - **Shopping List Conversion**: Async image fetching when moving items to pantry

### Technical
- **Build Configuration**: Enhanced Vite config with manual chunk splitting strategy
- **Code Splitting**: Separated vendor libraries into logical, cacheable chunks
- **Lazy Loading**: Components and services load on-demand for better performance

## [1.1.4] - 2026-01-07

### Added
- **Interactive Tutorial System**: Complete overhaul of user onboarding experience
  - **15-Step Guided Tour**: Interactive walkthrough covering all major app features
  - **Glow Highlighting**: Replaced circle overlays with smooth CSS glow effects on actual buttons
  - **Dynamic Modal Positioning**: Tutorial modal automatically adjusts position to avoid navigation bar overlap
  - **Smart Timing**: 2-second pause for household button to allow visual identification before auto-click
  - **Theme Toggle Demo**: Automatic theme switching demonstration with return to dark theme
  - **Context-Aware Descriptions**: Updated tutorial text to match actual app interface and features
- **UI/UX Enhancements**: Comprehensive visual and interaction improvements
  - **Hover Animations**: Smooth scale and shadow transitions on interactive elements
  - **Progressive Loading**: Skeleton loaders and smooth content transitions throughout the app
  - **Voice Search Integration**: Microphone button for voice-powered recipe and ingredient search
  - **Accessibility Improvements**: Enhanced keyboard navigation, screen reader support, and focus management
  - **Cooking Reminders**: Smart notification system for meal preparation timing
  - **Enhanced Analytics Dashboard**: Improved Firebase Analytics integration with detailed usage insights
- **Tutorial Navigation Improvements**:
  - **Raised Modal Positioning**: Tutorial modal positioned 25px higher for navigation-related steps
  - **Corrected Feature Descriptions**: Updated tutorial text to accurately reflect app functionality
  - **Recipe Finder Clarification**: Tutorial now correctly references "Chef" tab and "Use Inventory Only" option
  - **Meal Planning Guidance**: Clear instructions for adding recipes by clicking days in the meal planner

### Changed
- **Tutorial Descriptions**: Updated all tutorial step descriptions to match actual app interface and functionality
- **Recipe Search Guidance**: Tutorial now explains clicking days to add recipes instead of non-existent search buttons
- **AI Recipe Finder**: Tutorial references correct tab name ("Chef") and search option ("Use Inventory Only")

### Fixed
- **Tutorial Timing**: Added appropriate delays for user comprehension before automatic actions
- **Theme Persistence**: Tutorial now returns to dark theme after theme toggle demonstration
- **Modal Positioning**: Tutorial modal no longer overlaps navigation bar during navigation steps

## [1.1.3] - 2026-01-06

## [1.1.3] - 2026-01-06

### Added
- **MealPlanner Redesign**: Complete reconfiguration of meal planning interface
  - **Unified Calendar View**: Removed list/calendar toggle, now uses calendar grid as primary interface
  - **Day Detail Modal**: Click any day to open fullscreen modal showing detailed meal planning for that day
  - **Recipe Search Integration**: "Add Recipe" buttons in empty meal slots open search modal
  - **Saved Recipes Access**: Search modal shows both AI-generated recipes and user's saved recipes
  - **Enhanced Meal Management**: View, add, and remove recipes directly from day detail modal
- **Context-Aware Recipe Modal**: Dynamic button display based on usage context
  - **Search Context**: Shows "Save Recipe" and "Add to Plan" buttons when browsing recipes
  - **Scheduled Context**: Shows "Mark as Made" and "Remove from Plan" buttons for planned meals
  - **Saved Recipes Context**: Shows "Add to Plan" and "Delete Recipe" buttons for saved recipes
- **Enhanced Recipe Search UI**: Improved recipe discovery with tile-based layout
  - **3-Column Tile Grid**: Recipes displayed in clean tiles with image, title, cook time, and calories
  - **Clickable Recipe Tiles**: Click any tile to preview recipe details before adding
  - **Unified Recipe Source**: Single search interface for both AI-generated and user-saved recipes
- **Smart Ingredient Cleaning**: Automatic removal of descriptive preparation words from shopping list items
  - **Recipe Ingredients**: Ingredients like "2 chopped onions" become "Onion" in shopping lists
  - **Pantry Items**: Descriptive words like "chopped", "minced", "diced", "sliced", "finely" are removed when adding to shopping lists
  - **Enhanced Shopping Experience**: Cleaner, more actionable shopping list items for better grocery shopping
- **Recipe Ratings System**: Complete rating and review functionality for recipes
  - **Post-Cooking Rating Prompt**: After marking a recipe as made, users are prompted to rate the recipe
  - **Dedicated Rating Modal**: Clean, focused modal for rating recipes with star selection and optional comments
  - **MealPlanner Integration**: Ratings functionality now available in MealPlanner recipe modals
  - **Event Handling Fix**: Resolved modal closing issues when interacting with rating inputs
- **Recipe Data Management Scripts**: New utility scripts for maintaining recipe database quality
  - **Bulk Recipe Upload Enhancements**: Improved deduplication and duplicate description prevention
  - **Incomplete Recipe Cleanup**: Script to remove recipes with missing instructions
  - **Duplicate Description Cleanup**: Script to remove redundant descriptions matching instructions
- **RecipeFinder Firebase Integration**: Replaced hardcoded recipes with dynamic Firebase data
  - **4-Column Tile Layout**: Updated from 3-column to 4-column grid for better space utilization
  - **Category Filtering**: Added filter buttons for different recipe categories
  - **Real-time Firebase Data**: Popular recipes section now loads from user's saved recipes
- **API Optimization**: Switched to free recipe API with paid fallback
  - **TheMealDB Primary API**: Free, reliable recipe source as primary data provider
  - **Spoonacular Fallback**: Paid API used only when free API is unavailable
  - **Cost Reduction**: Significantly reduced API costs while maintaining functionality

### Fixed
- **MealPlanner Grid Display**: Resolved 3-column tile layout issues in recipe search modal
- **Recipe Deduplication**: Added filtering to prevent duplicate recipes in saved recipes list
- **Bulk Upload Optimization**: Enhanced to fetch unique recipes and prevent duplicate API calls
- **Search Result Variety**: Improved query randomization to avoid repetitive recipe results
- **Modal Event Handling**: Fixed rating modal closing when clicking input fields

### Changed
- **MealPlanner UX**: Streamlined from dual-view system to single calendar-based workflow
- **Recipe Addition Flow**: Now integrated directly into meal planning with contextual search

### Removed
- **List View Toggle**: Eliminated list/calendar view switching buttons for simplified interface
- **Complex View State**: Removed viewMode state management in favor of modal-based interaction

## [1.1.2] - 2026-01-05

### Added
- **Cooking Timer**: Recipe timer feature in RecipeModal with MM:SS display, progress bar, and play/pause/reset controls
- **Smart Substitutions**: Missing ingredient detection with category-based ingredient suggestions
- **Weekly Meal Prep Calendar**: Dual-view meal planning with list and calendar view modes
- **Calendar View Toggle**: Switch between traditional list view and new grid-based calendar layout
- **Pantry Analytics Dashboard**: Statistics and visualization dashboard with charts and item metrics

### Changed
- **MealPlanner Calendar Layout**: Optimized from 7-column grid to 3-column grid for better mobile/tablet display
- **Calendar Cell Height**: Increased from 200px to 250px for improved meal content visibility
- **Calendar Header**: Removed redundant day name labels above calendar grid (Mon, Tue, Wed, etc.)

### Removed
- **Batch Selection Feature**: Removed multi-select/batch edit functionality from PantryScanner component for simplified UI

### Fixed
- **Calendar Feature**: Re-implemented calendar functionality with proper state management and view toggling

## [1.1.0] - 2026-01-04

### Added
#### Major Features
- **Item Cards UI**: Replaced cluttered inline controls with clean item cards for better pantry management
- **Fixed Price Trends**: Complete Open Prices API integration with proper error handling and data visualization
- **Original Quantity Preservation**: Added `originalQuantity` field to preserve recipe quantities (e.g., "1/2 cup", "4 oz") when moving items from shopping list to pantry
- **Improved Quantity Controls**: Replaced text input with intuitive +/- buttons for quantity adjustment
- **Enhanced Theming Consistency**: Applied consistent theming throughout all components using CSS custom properties

#### New Components (6 new)
- **ItemDetailModal**: Complete pantry item management interface with quantity controls and theming
- **PriceTrends**: Grocery price trend analysis and visualization component
- **CategoryManager**: Component for managing pantry item categories
- **GroceryCostEstimator**: Tool for estimating grocery costs based on pantry items
- **ErrorBoundary**: Error handling component for graceful failure recovery
- **GlobalUpdatePrompt**: Component for prompting users about app updates
- **SkeletonLoader**: Loading state component for better UX
- **VersionUpdate**: Component for handling version update notifications

#### Services & Integrations (4 new)
- **groceryPriceService**: Service for Open Prices API integration and price trend analysis
- **analyticsService**: Service for Firebase Analytics integration and usage tracking
- **usageService**: Service for tracking user usage patterns and app engagement
- **versionService**: Service for managing app versioning and update checks

#### Functions & Backend (3 new)
- **leaveHousehold**: Firebase function for users to leave household groups
- **migrateHouseholdClaims**: Function for migrating household ownership claims
- **sendHouseholdInvitation**: Function for sending household invitation emails

#### Assets (100+ new)
- **35 Avatar Images**: Enhanced user profile customization options
- **100+ Food Icons**: Comprehensive icon set for pantry items and recipes (converted from WebP to PNG for mobile compatibility)
- **Enhanced Visual Experience**: Improved UI assets for better user engagement

#### Testing (expanded)
- **New Test Files**: Comprehensive test coverage for new components and services
- **Hook Testing**: Added tests for custom React hooks (useAuth, useDataManagement, etc.)
- **Component Validation**: Enhanced component testing with proper validation

#### Infrastructure
- **Android Build Updates**: Improved Capacitor configuration and build processes
- **Firebase Enhancements**: Updated Firebase rules and configuration for better security
- **Capacitor Improvements**: Enhanced mobile app build and deployment
- **Performance Optimizations**: Code splitting and build optimizations for better performance
- **Database Maintenance**: Added automatic cleanup of old meal plan entries to prevent database bloat
- **Asset Management**: Improved image asset handling and mobile compatibility (WebP to PNG conversion)

### Fixed
- **Image Loading Issues**: Fixed pantry item images not loading in Android Capacitor builds by converting WebP assets to PNG and correcting asset serving paths
- **Shopping List Item Images**: Fixed items moved from shopping list to pantry not receiving proper image assignments
- **Meal Plan Database Cleanup**: Added automatic cleanup of old meal plan entries to prevent database bloat and performance issues
- **Milk Expiration Settings**: Updated milk expiration to 10 days with warning threshold at 3 days remaining (instead of 7 days)
- **Price Trends Functionality**: Fixed Firebase permission errors, API network issues, and undefined data crashes
- **Open Prices API Integration**: Corrected API URL from `api.open-prices.org` to `prices.openfoodfacts.org/api/v1`
- **API Response Handling**: Updated response interfaces to match actual Open Prices API structure
- **Theme Consistency**: Applied consistent theming throughout ItemDetailModal and other components
- **Type Safety**: Added proper TypeScript interfaces for PriceTrend and updated imports

### Changed
- **Quantity Editing UX**: Improved quantity adjustment workflow with visual feedback and conditional save buttons
- **Modal Theming**: Updated all modal sections to use CSS custom properties for consistent theming
- **API Parameter Handling**: Removed unsupported location parameter from Open Prices API calls

### Technical
- **New Interfaces**: Added `PriceTrend` and `PriceHistoryEntry` interfaces
- **Service Methods**: Added `getPriceTrendAnalysis()` method for comprehensive price trend data
- **State Management**: Enhanced quantity editing state with change detection
- **Build Optimization**: Successful builds with improved chunk management
- **Build Status**: Project builds successfully with `npm run build`
- **Test Status**: Tests currently failing (exit code 1), investigation needed

## [1.0.0] - 2025-12-XX

### Added
- Initial release of Stock & Spoon
- Cross-platform pantry and meal management
- Real-time household sharing via Firebase
- Recipe management and meal planning
- Grocery price estimation with community data
- Subscription system with Stripe integration
- Theme customization and notifications
- Firebase Analytics integration