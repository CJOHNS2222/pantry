## [2.4.6] - 2026-06-16

### Added
- **Offline Recipe Classification** — Added rule-based keyword classification script (`classify-recipes-rules.js`) and corresponding npm script shortcut (`classify-recipes`) to classify cached popular recipes offline.

### Changed
- **Firestore Listener Optimization** — Introduced a global `SubscriptionContext` and `SubscriptionProvider` to establish `onSnapshot` listeners once at login and reuse them, dramatically reducing Firestore read costs. Removed duplicate auth snapshot listeners by sharing user profile state from context.
- **Meal Planner Auto-Fill** — Updated auto-fill algorithm to strictly exclude recipes containing allergy-violating ingredients and apply dietary/dislike preference scoring penalties. Added duplicate prevention so users do not receive the same suggestions repeatedly.
- **Popular Recipes Search** — Integrated allergy screening and preference ranking into the popular recipes search modal (`RecipeSearchModal.tsx`) to match the updated meal planning recommendations.

---

## [2.4.5] - 2026-06-16

### Added
- **Meal Planner Auto-Fill**: Added preference-based auto-fill (breakfast, lunch, dinner options) prioritizing leftover items and expiring pantry goods.
- **Gemini Token Debugger**: Added developer panel/dialog for tracking AI prompt token usage and budget configurations.

### Changed
- **Single-Member Household Deletion**: Empty households are now disbanded automatically when a member departs, and the remaining admin's local/remote household associations and custom claims are cleared.
- **Cache Data Preservation**: Copies all household databases (inventory, shopping lists, and meal plans) directly to the remaining member's personal cache upon household disbanding to prevent data loss.
- **EmailJS Invitation Support**: Integrated household invitations directly with client-side EmailJS for direct family email notifications.
- **Capacitor Firebase Analytics**: Added a native Capacitor Firebase Analytics bridge to log app actions and screen view transitions by tab name (e.g. Pantry, Shopping List, Meal Planner) on Android devices instead of generic `MainActivity` group logging.

### Fixed
- **Recipe Ingredient Extraction & Notes**: Resolved quantity extraction bugs by mapping ingredients per-recipe and attaching source details as notes to the shopping list cards.
- **Smart Layout Organizer**: Aligned the custom aisle organizer with store profile definitions.

---

## [2.4.4] - 2026-06-13

### Changed
- **Login Screen Themes**: Redesigned the authentication screen to use modern dark slate themes instead of hardcoded burgundy.
- **Member Activity Box Header Style**: Aligned the member presence and activity status indicator box in the header with dynamic system theme variables.
- **Recipe Ingredient Source Tags**: Added custom recipe metadata annotations on shopping list items when they are batch-added from meal planner ingredients, detailing exactly which recipe they belong to.
- **Visual Fill Level Quantity Modifier**: Fixed the portion fill-level selector on the item detail modal (1/4, 1/2, 3/4, Full) to automatically scale and update the item's local quantity when selected.

---

## [2.4.3] - 2026-06-13

### Changed
- **Suggested Item Label & Wrapping**: Renamed "Suggested item" to "Quick Add" (and optimized other sources to use short text tags like "Manual", "Meal planner", "Scanner") in the shopping list item card, ensuring it never wraps to a second line.
- **Dotted Meal Planner Placeholder**: Tightened margins, paddings, and font sizes of the "Plan Your Day's Meals" placeholder box to reclaim deadspace.

### Fixed
- **Bypassing Redundant Search Dropdowns**: Modified the meal planner search flow to immediately schedule a recipe bypassing the redundant day/meal selection modal.
- **Household Modal Themes**: Aligned the household modal styling to match the application's dynamic theme colors instead of hardcoded burgundy.
- **Redundant Shopping List Selection Control**: Removed the duplicate batch select/deselect checkbox container from the bottom of the shopping list.
- **Checkout Expiration Modal Overlap**: Increased the z-index of the expiration modal backdrop so it renders on top of the fixed navigation bar, and added safe area bottom padding to prevent buttons from being hidden.
- **Smart Shelf-Life Presets**: Integrated smart expiration category defaults (e.g., 1 week for milk/yogurt/produce, 1 month for eggs, shelf-stable for spices) during checkout.
- **Meal Planner Headers '+' Icon**: Added clickable active "+" buttons next to the meal planner section headers to schedule additional items.
- **Firestore Read Optimization**: Implemented localized in-memory caches in `recipeService.ts` for popular recipes, community favorites, and cached recipes to prevent duplicate database reads on tab switches.

---

## [2.4.2] - 2026-06-13

### Added
- **Pantry Health Score** — added interactive letter grade A–F ring in Pantry tab based on 5 health factors (freshness, variety, nutritional balance, item utilization, and waste reduction).
- **Leftover prompt trigger** — surfaces an action chip asking "Log leftovers?" after a scheduled day's meal has passed, driving engagement with the leftover capture feature.
- **Household presence strip** — added real-time "Sarah is shopping now 🛒" indicator banner in Shopping List to coordinate active shopping trips.
- **Settings account hero card** — settings dashboard now displays a premium subscription/membership status card containing total items tracked, tier details, and active contextual CTAs.

### Changed
- **Expiration date picker chips** — redesigned expiration date inputs to a chips-first layout offering quick presets (3 days, 1 week, 2 weeks, 1 month, 3 months, 1 year, and no expiry).
- **Voice search visual feedback** — voice mic icon in Recipe Finder is now accented and features a pulse ring animation while active.
- **Recipe search result scaling** — increased default AI recipe recommendations to 3 results (5 for premium/family tier), replacing the hardcoded 2-recipe limit.
- **Recipe import CTA highlighting** — highlighted the CSV/URL import button with accent color when the pantry list is empty.
- **Offline indicator status clarity** — updated the offline status ribbon to describe precisely which local features remain available vs actions needing active network.
- **Height and weight unit formatting** — Settings now formats height (cm) and weight (kg) measurements contextually depending on active metric vs imperial profile preference.
- **CSV fallback recipes** — fallback recipes from CSV database are now integrated when the popular recipes cache is empty.
- **Dietary preferences pre-fill** — Recipe Finder searches now automatically pre-populate restrictions directly from the user's active profile settings.

### Fixed
- **Structured logging migration** — replaced all 13 direct `console.log`, `console.warn`, and `console.error` calls in `notificationService.ts` with structured logs via `logService`.
- **Token estimator cleanup** — removed dead `estimateTokens` calls and related state from Recipe Finder.
- **Placeholder image cleanup** — removed obsolete `generateRecipePlaceholderImage` function from Meal Planner components.
- **Recipe Finder search retry** — fixed `onRetry` handler to invoke `handleGenerate` directly instead of leaving search stuck in error.

---

## [2.4.1] - 2026-06-12

### Added
- **Keyboard viewport hook** — added new `useKeyboard` hook that dynamically detects virtual soft keyboard and handles auto-scrolling focused inputs/textareas to the center of the viewport.
- **Pre-permission educator screen** — added pre-permission educator dialog explaining camera privacy before requesting access on Android devices, alongside a denied settings fallback prompt.

### Changed
- **Navigation viewport auto-hiding** — bottom navigation bar automatically hides when the virtual keyboard is visible.
- **Haptic feedback improvements** — integrated light feedback on checkmark clicks, medium feedback on item long-presses, and success feedback on key milestones (cooking meal, checkout, bulk-deleting).
- **Cloud sync indicators** — updated connection status icons to cloud themes (`Cloud`, `CloudOff`, `RefreshCw` spin).

### Fixed
- **Hardware back button stack** — integrated autocomplete lists, details dropdowns, notes editors, and search overlays into the LIFO stack to support clean back-dismissals.
- **AppNavigation tests** — updated test suite to reference standard button roles instead of obsolete tab roles.

---

## [2.4.0] - 2026-06-03

### Added
- **Progressive onboarding milestones** — added milestone tracking to stage post-onboarding feature discovery based on user behavior (`onboarding-completed`, first pantry/shopping/meal-planning actions)

### Changed
- **Feature discovery gating** — `FeatureDiscoveryManager` now supports milestone-based eligibility so one-time tips are shown when context is relevant, rather than all at once

### Fixed
- **RecipeFinder typing** — restored missing `Tab` type import used by settings navigation actions
- **ShoppingList compile breakages** — restored missing utility/log imports (`log`, `inferCategoryFromItemName`, `isHouseholdMember`, validation helpers)
- **Meal plan cache import casing** — normalized `mealPlanCacheService` imports to resolve TypeScript casing conflict across Windows/macOS builds

---

## [2.3.1] - 2026-06-01

### Fixed
- **Recipe Finder — search-on-keystroke removed** — Gemini/Spoonacular search no longer fires after every character typed; search only triggers when the user presses the **Search** button or hits Enter
- **Recipe Finder search button** — replaced the hidden inline search icon (only shown when input was non-empty) with a persistent accent-coloured **Search** button beside the input field; pressing Enter in the input also triggers search

### Added
- **Chef tab cache filters** — added meal-type chips (`All Meals`, `breakfast`, `lunch`, `dinner`) plus cuisine dropdown filters above Popular Recipes; filters now apply to cache-backed popular results and cached text-query matches
- **Preference-aware cache ranking** — added shared cache ranking/filter helpers in `utils/preferenceUtils.ts` so cache recipe matches are boosted by favorite cuisines/proteins and down-ranked for disliked ingredients
- **Recommendation explainability badges** — recommendation cards now show compact preference signals (favorite cuisine/protein matches and disliked-ingredient warnings) so users can see why recipes were ranked

### Changed
- **Recipe cache labelling script** — `scripts/label-recipe-cache.js` rewritten to use local Ollama (default `gemma3:1b`) with batched classification, model preflight checks, robust JSON extraction, timeout handling, and fallback labels; supports `--dry-run`, `--force`, and `--model`
- **Chef cache search ordering** — cached search results in Recipe Finder now pass through shared mealType/cuisine filtering and household/user preference ranking before display
- **Meal Planner cache search ordering** — recipe search modal in Meal Planner now applies meal-type filter plus the same household/user preference ranking used by Recipe Finder
- **Recommendation ranking consistency** — `RecipeRecommendationService` now incorporates user profile preference scoring in final sort order so cache-backed recommendations align with cache search behavior

---

## [2.3.0] - 2026-05-29

### Added
- **Meal Prep Planner — household size + batch scaling** — new "Household size" picker (1/2/4/6 people) beside the day-range selector; each suggested batch session now shows a ×N multiplier badge and adjusted serving count so quantities reflect your actual household and duration (e.g. ×4 batches for 7 days, 2 people on a 4-serving recipe)
- **Local grocery price defaults** — 29 real local-area prices seeded into the pricing fallback (butter, bacon, pork chops, deli turkey, cream cheese, Greek yogurt, OJ, strawberries, shredded cheddar, olive oil, peanut butter, marinara, canned tomatoes/beans, frozen veg/pizza, ice cream, cereal, soda, and more); plural item name variants added so Quick Add chip lookups always resolve

### Changed
- **Quick Add chips (Shopping list)** — complete rewrite: single `onClick` handler, `useRef` scroll container, green checkmark flash on tap, scroll-snap, left/right arrow buttons; chips now reliably add items on first tap
- **Recipe Finder — preference warnings** — per-card allergen (red shield) and dislike/restriction (amber warning) badges replace the previous batch toast; Gemini search prompt trimmed to reduce token usage
- **Grocery price defaults updated** — eggs corrected to per-dozen pricing; apples, lemons, bell peppers, broccoli, onions, lettuce, tomatoes, flour, rice, and pasta updated to current local averages

---

## [2.2.1] - 2026-05-27

### Fixed
- **Feedback form** — "Failed to send feedback" error resolved; field name mismatch (`text` → `message`) now matches Firestore security rule
- **QuickAdd suggestion chips** — multiple taps required on mobile to register resolved; added `touch-action: manipulation`, `onTouchEnd` with `preventDefault`, and removed pointer-event interference from scroll arrow overlays

### Changed
- **Meal Prep button** — now uses accent colour fill (`bg-[var(--accent-color)]` with white text) for better visual prominence in the Meal Planner toolbar
- **Meal Planner** — removed redundant "Search" shortcut button from the planner header
- **Free plan calendar limit** — forward-navigation arrow in Meal Planner is now disabled after day 7 for free users, with a tooltip prompting upgrade to Premium

### Added (Help & FAQ)
- New FAQ entry: **Recipes (Chef) tab** — covers Smart Recommendations, Recipe Finder, saved recipes, and Cooking Mode
- New FAQ entry: **Copy / Clear / Export week** — documents Clear week, Copy to next week, and Export .ics meal plan actions
- New FAQ entry: **Imperial vs Metric units** — Settings → Account → Measurement System
- New FAQ entry: **Hide/show navigation tabs** — Settings → Preferences → Navigation Tabs
- Updated **tabs overview** FAQ entry to include the Recipes (Chef) tab

---

## [2.2.0] - 2026-05-26

### Added
- **Shopping item assignment** - assign household members to shopping items via an inline picker; assigned member shown as a badge; persisted to cache
- **Shopping item notes** - add inline notes to shopping items; italic preview on the item row; persisted to cache
- **Multi-store layout profiles** - named store profiles (e.g. Whole Foods, Costco) each with independent aisle ordering; store picker on shopping list screen
- **In-app account deletion** - confirmation modal permanently deletes Firestore user data and Firebase Auth account via new `deleteAccount` Cloud Function
- **AdMob banner ads** - `@capacitor-community/admob` wired; set `VITE_ADMOB_ENABLED=true` in release env to activate
- **Community inline star rating** - quick 5-star row on Community cards; submits rating without opening modal
- **Leftover persona in onboarding** - Food Safety step (Strict / Normal / Relaxed) added to `ModernOnboarding`; writes `profile.leftoverPersona` to Firestore
- **Recipe recommendations improved** - full recipe objects fetched from cache; pantry ingredient token-overlap scoring for `similar-ingredients` results

### Changed
- **`autoReaddStaples` setting wired** - staple re-add now respects `settings.shopping.autoReaddStaples` (opt-out, default true)
- **MealPlanner two-week gate** - uses `UsageService.getUsageLimits()` to derive `canUseTwoWeekPlanning`; falls back to `isPremium || isFamily`  if not loaded
- **Shopping suggestion dismissals persisted** - via `localStorage` key `shop_dismissed_suggestions`; shared between `SmartShoppingSuggestions` and `QuickAdd`; survives reload
- **GroceryCostEstimator upgrade CTA** - free-user truncation is now a clickable button with lock icon that navigates to Settings/Subscriptions
- **Console.log cleanup** - all `console.*` in 9 service files migrated to the structured `log` service (`householdActivityService`, `householdPreferenceService`, `groceryPriceService`, `geminiService`, `householdService`, `importService`, `leftoverNotificationService`, `leftoverImageService`, `foodWasteAnalyticsService`)
- **Cloud Function logging** - `inviteMember.ts` now uses `firebase-functions/v2` `logger`; eliminates PII in Cloud Logging
- **Barcode scan button hidden on web** - wrapped in `Capacitor.isNativePlatform()`; does not render in the PWA/browser build
- **Upgrade prompts** - MealPlanner disabled-month span and navigation arrow show actionable toasts with an `Upgrade` button

### Fixed
- **PII leak in `inviteMemberCore`** - removed `console.log` printing `{ inviterUid, email, householdId }` to Cloud Logging
- **Undo toast TTL** - confirmed all undo toasts use 5 000 ms; FAQ updated from "6 seconds" to "5 seconds"
- **Household invite feedback** - `Household.tsx` distinguishes pending vs existing-account invite with separate toast messages

---

---

## [2.1.6] - 2026-05-26

### Fixed
- **Camera scan timeout** — `handleTakePhoto` was setting the loading state to `LOADING` before the OS camera opened, causing `GeminiLoadingOverlay` to immediately start its 60-second countdown and time out before Gemini was ever called; loading state is now only set after the photo is captured

### Changed
- **`customCategories` consolidated onto user doc** — custom pantry categories are now stored as a field on `users/{uid}` instead of a separate `users/{uid}/cache/customCategories` subcollection document; `useAuth`'s existing `onSnapshot` delivers them for free, saving 1 Firestore read per cold start; existing users are migrated automatically on first load
- **Stripe packages removed** — `stripe`, `@stripe/react-stripe-js`, and `@stripe/stripe-js` were unused and have been uninstalled
- **Dependencies updated** — all patch/minor versions bumped (`@capacitor/*` 8.3.4, `firebase` 12.13.0, `react`/`react-dom` 19.2.6, `vite` 8.0.14, `@sentry/react` 10.53.1, `tailwindcss` 4.3.0, `date-fns` 4.3.0, `vitest` 4.1.7, `lucide-react` 1.16.0, and others); `@google/genai` bumped 1→2, `react-intl` 8→10, `lint-staged` 16→17, `@capacitor/local-notifications` 8.0→8.2
- **Repository cleanup** — removed audit/planning docs (`AUDIT_NOTES.txt`, `FULL_APP_AUDIT.txt`, `PRODUCTION_READINESS_AUDIT.txt`, `IMPROVEMENTS_PLAN.md`), build artifacts (`app-debug.apk`, `smart-pantry-release.apk`, `sentry-wizard.exe`), stray screenshots from `public/` and `testlab/robo/`, duplicate root `manifest.json`, and `.github/issues/` planning files; moved `addTestData.cjs`, `clean_csv.cjs`, `parse_csv.cjs`, `migrate-firebase.js`, and `test-firebase.js` from root into `scripts/`

## [2.1.5] - 2026-05-23

### Fixed
- **Notification badge mismatch** — "Pending Notifications" in Settings now shows the same count as the header bell; previously read notifications were being merged into the pending list, inflating the badge
- **Recipe ingredient units lost on purchase** — ingredients with a quantity string like "225 g" or "800 ml" now preserve the unit when moved to pantry; previously they always showed as "cnt"
- **Bulk delete N+1 Firestore writes and toast flooding** — selecting and deleting multiple pantry items now performs a single cache write and shows a single summary toast instead of one write + one toast per item

### Changed
- **Remote Config cleaned up** — removed phantom `openrouter_model`, `openrouter_vision_model`, `gemini_max_batch_size`, and `gemini_debounce_delay_ms` entries that were appearing in the Remote Config debug view despite never being published; active Gemini model params (`gemini_model`, `gemini_model_vision`) remain

## [2.1.4] - 2026-05-20

### Fixed
- **OpenRouter recipe search returning empty results** — default text model `baidu/cobuddy:free` was deprecated on OpenRouter; replaced with `meta-llama/llama-3.3-70b-instruct:free`
- **OpenRouter pantry/receipt image scan hanging** — default vision model `meta-llama/llama-4-maverick:free` was unreliable on free tier; replaced with `qwen/qwen2.5-vl-72b-instruct:free`
- **Image scan opening blank review modal** — `analyzePantryImageViaOpenRouter` and `analyzeReceiptImageViaOpenRouter` now throw a user-friendly error when the model responds but no items are parsed, instead of silently opening an empty review modal
- **Meal Prep Planner modal header hidden behind app bar** — changed overlay from `items-center z-50` to `items-start z-[9999]` with `pt-[calc(var(--safe-area-top,0px)+72px)]` so the modal card starts below the fixed `AppHeader`
- **GeminiLoadingOverlay hanging at 97%** — added `onTimeout` callback to the pantry scanner overlay so the loading state resets to error when the 60-second visual timer completes

### Changed
- **OpenRouter models now configurable via Remote Config** — `openrouter_model` and `openrouter_vision_model` keys added to `remoteConfigService` in-app defaults; set in Firebase Console to hot-swap models without a deploy. `VITE_OPENROUTER_MODEL` / `VITE_OPENROUTER_VISION_MODEL` env vars remain as local dev overrides (highest priority)
- **Meal Prep Planner redesign** — Plan Duration selector now caps the number of suggested batch sessions (3 days → 3, 5 → 5, 7 → 7); suggestion cards reframed as "Cook together / Prep once, use in both" with estimated time savings; servings now summed from actual recipe data instead of hardcoded 8; custom plan builder shows shared-ingredient callout for selections of 2+ recipes

## [2.1.3] - 2026-05-19

### Fixed
- **Meal Prep Planner crash** — `parseTimeToMinutes` was declared after the `useMemo` that calls it, causing a Temporal Dead Zone `ReferenceError` in production builds whenever the Meal Prep button was tapped; moved declaration above the `useMemo`

### Added
- **Auto-generated "What's New" modal** — `scripts/generate-changelog.cjs` now parses `CHANGELOG.md` at build time and writes `constants/changelogEntries.ts`; `WhatsNewModal` imports from this file instead of a hand-maintained array. Runs automatically via `prebuild`/`predev` npm hooks — no manual updates needed on future releases

## [2.1.2] - 2026-05-19

### Added
- **OpenRouter / Groq AI provider** — New `openRouterService.ts` integrates the OpenAI-compatible OpenRouter API as an alternative to Gemini for all three AI features: recipe text search, pantry image scanning, and receipt scanning. Set `VITE_GEMINI_DISABLED=true` in `.env.local` to route all AI calls through OpenRouter instead of Gemini. Defaults to `baidu/cobuddy:free` for text search and `meta-llama/llama-4-maverick:free` for vision; both are confirmed free ($0/M tokens). Override per-feature via `VITE_OPENROUTER_MODEL` and `VITE_OPENROUTER_VISION_MODEL`. Compatible with Groq by setting `VITE_OPENROUTER_BASE_URL`.

## [2.1.1] - 2026-05-19

### Changed
- **Android build toolchain** — Updated Android Gradle Plugin to 8.13.2, Kotlin to 2.0.21, Gradle wrapper to 8.13; enabled `android.newDsl` and disabled legacy Jetifier for cleaner builds

## [2.1.0] - 2026-05-18

### Added
- **Star rating picker** — Recipe rating form now includes an interactive 1–5 star selector; star values are persisted to Firestore and reflected on community recipe cards

### Fixed
- **Gemini image scan never returning results** — `gemini-2.5-flash` thinking mode was enabled by default, causing pantry and receipt image analysis to exceed the 40-second timeout before responding; thinking is now disabled for image classification tasks and timeouts bumped to 60 seconds
- **Community tab rating input** — Rating form now correctly appears when opening a recipe from the Community tab (`onRate` prop was missing from the `RecipeModal` call)
- **Cook Tonight search re-running on tab switch** — Returning to the Recipes tab after a "What can I cook tonight?" search no longer re-fires the Gemini/Spoonacular search; results are preserved until intentionally refreshed
- **Meal Prep button crash** — Recipes with missing `ingredients` data in Firestore no longer crash the Meal Prep Planner with a TypeError on mount
- **Meal Prep `onAddToPlan` wrong prop** — Meal prep planner was receiving a 3-argument function where a 1-argument wrapper was expected, causing crashes when adding a recipe to the plan

### Changed
- **Header title size** — "Stock & Spoon" title in the app header enlarged for better visual presence

## [2.0.2] - 2026-05-18

### Added
- **Sentry error reporting for Gemini** — All three Gemini operations (pantry image scan, receipt scan, AI recipe search) now report failures to Sentry with structured context (operation type, model, image size, error classification). Rate-limit and quota errors are tagged as warnings; auth/network/parse errors as errors.
- **Firebase Crashlytics integration** — New `crashlyticsService.ts` wrapper provides native-safe access to Firebase Crashlytics (silent no-op on web). All major error paths now report to Crashlytics: domain errors via `sentryService.ts` helpers, React error boundaries (`ErrorBoundary`, `ComponentErrorBoundary`), and global unhandled error/rejection handlers in `index.tsx`.

### Fixed
- **Gemini batcher silent hang** — Requests queued in the `GeminiRequestBatcher` were never rejected on failure, causing promises to hang indefinitely. Now properly calls `reject(err)` in the catch path.

## [2.0.1] - 2026-05-17

### Added
- **Settings section icons** — Each settings section header now shows a colored accent icon (User, Bell, Gauge, ShieldCheck, Palette, etc.) for faster visual scanning
- **Meal Prep button** — MealPrepPlanner is now accessible via a labeled "Meal Prep" button in the Meal Planner header (was hidden behind an unlabeled icon)

### Fixed
- **ESLint cleanup (round 2)** — Removed unused imports (`useEffect`, lucide icons, unused types) and renamed unused catch/destructured vars across 20+ components; updated `eslint.config.ts` with `argsIgnorePattern`/`varsIgnorePattern` for `_`-prefixed vars and added per-directory rule overrides so service/hook/util files and test files no longer error on `no-explicit-any`

## [2.0.0] - 2026-05-06

### Added
- **Feature Discovery** — New feature discovery cards for AI scan, smart recipe search, leftover tracker, and meal planner
- **Contextual Tutorials** — Tab-based contextual tips on first visit to each tab

### Fixed
- **Subscription Limits** — Fixed usage counters to sync with actual data instead of drift-prone increments; meal plan limits now count only current+future weeks
- **Android App Icon** — Fixed blank white icon issue; now displays correct Stock & Spoon branding

### Changed
- **Version bump** — Major version to 2.0.0 for significant feature additions

## [1.5.29] - 2026-04-18

### Fixed
- **Usage counter accuracy** — Gemini usage now only increments on successful searches/scans; saved recipe counter syncs to actual cached count instead of incrementing/decrementing

## [1.5.28] - 2026-04-18

### Fixed
- **ESLint cleanup** — removed unused imports, variables, and destructured assignments across all major components (App.tsx, ItemDetailModal, QuickAddModal, ShoppingList, MainContent, MealPlanner, PantryScanner, RecipeFinder, Settings, and 9 others); 0 lint errors remaining
- **Settings.tsx type error** — fixed `TS2352` double-cast (`prev as unknown as Record<string, unknown>`) in `handleChange` to satisfy TypeScript's type overlap check

## [1.5.27] - 2026-04-18

### Fixed
- **Usage counter reset bug** — weekly counters (`searches`, `mealPlanning`, `gemini`) were resetting to 0 on every `getUsageLimits` call due to incorrect `now > earliestResetDate` condition; changed to `weekStart > earliestResetDate` so reset only fires when a new week begins
- **Recipe count drift** — `handleDeleteRecipe` never decremented `recipes.used`; added `recordRecipeDelete()` that reads and decrements with a floor of 0
- **Android back button** — wired `useAndroidBack` to all remaining modal states across MealPlanner (7), RecipeModal sub-modals (6), ShoppingList (3), and Settings (4)
- **Store brand prefix stripping** — receipt-scanned item names now strip leading "CV" (Clover Valley) and "GV" (Great Value) prefixes in `parseItemText` and `cleanItemNameForShopping`

### Added
- **Admin usage reset** — `UsageService.resetUsage(user)` and a "Reset Usage Counters" panel in Settings → More tab for per-user manual resets

## [1.5.26] - 2026-04-17

### Added
- **Ingredient Substitutions panel** in `RecipeModal` — "Ingredient Substitutions" button scans the recipe's ingredient list against a built-in lookup table (~95 common ingredients) and shows substitutes with usage ratio and a practical note, all client-side with no API calls
- **Substitution lookup table** covers dairy, baking staples, sauces & condiments, nut butters, spices & aromatics, acids, proteins, nuts, and miscellaneous pantry items; longest key matched first to prevent false matches (e.g. "buttermilk" before "butter")
- **Recipe database** — 943 recipes now in Firestore sourced from TheMealDB (all categories + areas), up from 436

### Changed
- **`scripts/bulk-upload-recipes.js`** — switched to Firebase Admin SDK auth; replaced Spoonacular query loop with TheMealDB full-browse (all categories + areas); instruction parser now splits "step N …" strings into proper arrays
- **`scripts/rebuild-recipes-cache.js`** — added `CHUNK_SIZE = 400` chunking across `recipes_cache_1`, `_2`, `_3` … to stay within Firestore's 1 MB document limit
- **`services/recipeService.ts` `getCachedRecipesCache`** — reads all `_1.._N` chunks automatically and merges into a single array
- **`RecipeModal` substitution feature** — replaced old hardcoded 5-category pantry-match lookup with the new full ingredient substitution panel; works on any recipe regardless of pantry contents

### Fixed
- **TS errors in `useDataManagement.ts`** — fixed `d.id` accessed on `unknown` in both `getRatingsForRecipe` and `refreshCommunityRatings` map callbacks; changed to `doc.id` (the correctly typed `as any` alias)

## [Unreleased] - 2026-04-17

### Added
- **Ingredient Substitutions panel** in `RecipeModal` — an "Ingredient Substitutions" button scans the recipe's ingredient list against a built-in lookup table (~95 common ingredients) and shows substitutes with usage ratio and a practical note, all client-side with no API calls
- **Substitution lookup table** covers dairy, baking staples, sauces & condiments, nut butters, spices & aromatics, acids, proteins, nuts, and miscellaneous pantry items; longest key matched first to avoid false matches (e.g. "buttermilk" before "butter")
- **Recipe database seeded** — 943 recipes now in Firestore sourced from TheMealDB (all categories + areas), up from 436
- **Recipe cache chunking** — `rebuild-recipes-cache.js` now splits large recipe collections across multiple Firestore documents (`recipes_cache_1..N`, 400 per chunk) to stay under the 1 MB document limit; `getCachedRecipesCache` in `recipeService.ts` reads all chunks automatically
- **`scripts/fix-recipe-instructions.js`** — one-time migration script that reformatted "step 1 … step 2 …" raw strings into proper `string[]` arrays for 274 recipes; already executed

### Changed
- **`scripts/bulk-upload-recipes.js`** — switched auth from anonymous signIn (disabled in project) to Firebase Admin SDK; replaced Spoonacular search-query loop with `fetchAllMealDBRecipes` (browses all TheMealDB categories + areas); instruction parser splits on `/step\s+\d+/i` regex into proper arrays
- **`scripts/rebuild-recipes-cache.js`** — added `CHUNK_SIZE = 400` chunking; writes `recipes_cache_1`, `_2`, `_3` … instead of a single document
- **`services/recipeService.ts` `getCachedRecipesCache`** — iterates `_1.._N` chunk documents until an empty chunk is found (up to 20), merges all into a single array
- **`RecipeModal` substitution feature** — replaced the old hardcoded 5-category pantry-match lookup (only showed missing items) with the new full ingredient substitution panel available on any recipe regardless of pantry contents

## [1.5.25] - 2026-04-17

### Fixed
- **Android crash (NPE)**: Added `RuntimeVisibleAnnotations` ProGuard keep rule so R8 doesn't strip `@CapacitorPlugin`/`@Permission` annotation data in release builds, which caused `Bridge.getPermissionStates()` to NPE
- **Android crash (NPE)**: Added `requestPermissionsWithRetry()` to `pushNotificationService` — retries up to 3× with exponential back-off to survive transient Bridge NPE on cold start
- **POST_NOTIFICATIONS**: Added explicit `<uses-permission>` to `AndroidManifest.xml` for Android 13+ (API 33+)
- **Offline mode**: Restored real network detection in `useOfflineStatus` — uses Capacitor `@capacitor/network` on Android/iOS and `window` online/offline events on web; was previously hardcoded to `isOnline: true`
- **Offline reconnect toast**: Re-enabled `offlineQueue.processQueue()` on reconnect using `addToastRef` to prevent stale-closure repeated-toast crash
- **Offline queue dead code**: Removed `if (false) {}` wrapper from `performWrite` in `useDataManagement`
- **Notification date crash**: Fixed `.toDate()` calls on `createdAt` and `snoozedUntil` fields which can be ISO strings or Firestore Timestamps — now handles both types
- **Notification action label**: Fixed missing `actionLabel` after `generateExpirationMessage` return-type was simplified; label is now set inline in the caller

### Added
- Analytics tracking for category create/update/delete events (`CategoryManager`)
- Analytics tracking for grocery cost estimator open and price submit events (`GroceryCostEstimator`)
- Analytics tracking for pantry import and recipe import events (`ImportModal`)
- Analytics tracking for recipe view, timer start, completion, save, rate, leftover capture, and cooking mode start events (`RecipeModal`)
- Analytics tracking for shopping list item add and check-off events (`ShoppingList`)
- `specificItems` prop on `ExpiredItemsModal` to support notification-driven expired-item flows

### Changed
- `generateExpirationMessage` return type simplified — removed `actionLabel` from return value; callers now determine the label contextually

## [1.5.24] - 2026-04-12

### Fixed
- Fatal `NullPointerException` crash in `PushNotificationsPlugin.requestPermissions` on Android cold start — `Bridge.getPermissionStates` called `getActivity()` before the Capacitor activity was fully initialized; fix defers permission request until `App.getState()` confirms the app is in the foreground

## [1.5.23] - 2026-04-12

### Fixed
- Rapid backButton listener add/remove cycling on startup caused by `addToast` missing `useCallback` — every render re-ran the backButton effect, skipping 30–54 frames and causing severe main thread jank on Android
- `appUrlOpen` Capacitor listener leak — was never cleaned up on effect re-runs, causing listeners to accumulate with each render cycle

## [1.5.22] - 2026-04-12

### Fixed
- **App crash on startup**: Fully stubbed out `useOfflineStatus` hook — disabled IndexedDB queue init, connectivity fetch (which triggered a 5-second `AbortSignal` timeout crash on Android WebView), and auto-sync logic. Firebase SDK handles offline writes natively. Also removed a dead duplicate `useDataManagement` call in `LeftoverQuickCapture` that was spawning extra Firestore listeners.

## [1.5.21] - 2026-04-12

### Fixed
- **Offline sync toast flood**: Disabled the offline queue processing effect that was causing the app to show dozens of "Offline changes synced." toasts on startup, locking up and crashing the Android app. Firebase's built-in offline persistence handles connectivity transparently in the meantime.

## [1.5.20] - 2026-04-11

### Added
- Comprehensive Google Analytics tracking across all major app features including recipe interactions, shopping list usage, household management, authentication flows, cost estimation, category management, and data imports for improved user behavior analysis and app insights.

## [1.5.19] - 2026-04-11

### Changed
- Enabled code minification for Android release builds to reduce app size and prepare for deobfuscation mapping.

### Fixed
- **Repeated offline sync toasts** (audit 1F): Fixed useEffect in `useDataManagement.ts` that was triggering "offline changes synced" toast multiple times on app load by using a ref for `addToast` to avoid dependency array issues causing repeated effect execution.
- **Notification timestamp errors** (audit 1G): Fixed `TypeError: n.createdAt.toDate is not a function` in `notificationService.ts` by handling both Firestore Timestamp objects and ISO date strings for `createdAt`, `snoozedUntil`, and `expiresAt` fields in notification filtering, sorting, and cleanup methods.
- **Database monitoring logging** (audit 1H): Fixed incorrect subscription path logging in `databaseMonitoringService.ts` that was showing parent collection paths instead of document paths, making it appear that multiple subscriptions were to the same document when they were actually to different cache documents.

## [1.5.18] - 2026-04-11

### Added
- Admin-only Remote Config debug screen in Settings for viewing live resolved values
- Database Analytics visibility gated to admin users only

### Fixed
- Enforce remote-config receipt scanning kill switch

## [1.5.17] - 2026-04-10

### Fixed
- **Landing page styles** (audit 7D): Converted LandingPage.tsx from extensive inline style objects to Tailwind CSS utility classes for consistency with the rest of the application. Added custom font families (Inter, Playfair Display) to Tailwind config.
- **Memory leak cleanup** (audit 1A): Wired `pagehide` event in `index.tsx` to call `cleanupCacheService()`, `DatabaseMonitoringService.cleanupMonitoring()`, and `offlineDataCache.destroy()` — prevents orphaned intervals and listeners on page unload.
- **Cache eviction** (audit 1B): Added LRU eviction to `imageCacheService.ts` (`MAX_MEMORY_CACHE_SIZE = 300`, evicts oldest 10% on overflow) — prevents unbounded memory growth from cached image URLs.
- **Race conditions** (audit 1D): Added `isSyncingRef`/`isOnlineRef` refs to `useOfflineStatus.ts` so `syncNow` reads from refs instead of stale closure state, eliminating the risk of concurrent sync execution.
- **Stale closures** (audit 1E): Added `inventoryRef` in `useDataManagement.ts` to give Firestore snapshot listeners stable access to current inventory without re-subscription; added missing `addToast` to a `useEffect` dependency array.
- **Escape key handling** (audit 4B): Added Escape key handling to `CategoryManager` (via `useKeyboardNavigation`) and `ExpirationDatePicker` (via `useEffect` keydown listener).
- **Accessibility aria-labels** (audit 4A): Added `aria-label` attributes to icon-only buttons across `EnhancedShoppingListItem`, `QuantityUnitPicker`, `MealPlanner`, `RecipeFinder`, and `PantryScanner`.
- **Icon path casing** (audit 11A): Renamed `public/icons/icon.PNG` → `icon.png` and updated `index.html`, `android/capacitor.config.json`, and `public/manifest.webmanifest` for Linux/case-sensitive server compatibility.
- **TypeScript errors**: Fixed `maxLength` prop type in `Household.tsx` (`string` → `number`), narrowed `unknown` catch in `recipeService.ts`, and fixed undefined variable reference in `recipeService.ts`.
- **Offline queue logging**: Replaced remaining `console.error` in `offlineQueueService.ts` with `log.error`.

### Changed
- **ESLint ignores** (audit 11C): Added `ios/**` and `coverage/**` to ignore list in `eslint.config.ts`.
- **Vitest config** (audit 11B): Added explanatory comment to `watch: false` in `vitest.config.ts`.

## [1.5.16] - 2026-04-10

### Fixed
- **Form validation** (audit 7C): Added input validation constraints to prevent invalid data entry:
  - CategoryManager: maxLength="50" on category name inputs
  - FreezeTransitionModal: max="730" on freezer shelf-life input
  - GroceryCostEstimator: min="0.01" on price inputs
  - PantryScanner: min="0" on quantity inputs
  - Household: maxLength="50" on household name inputs
  - Settings: min="0" on weight and age inputs
  - RecipeFinder: min="0" on prep time, servings, cook time, and ingredients inputs

## [1.5.15] - 2026-04-10

### Fixed
- **Bundle optimization** (audit 2A): Removed `firebase-admin` from web dependencies — this Node.js-only library was bloating the production bundle unnecessarily.
- **Security fix** (audit 3A): Fixed Firebase Storage rules for pantry images — delete permissions now restricted to the original uploader only (previously any authenticated user could delete any image).
- **Build config** (audit 8C): Reduced Vite `chunkSizeWarningLimit` from 1000KB to 600KB to encourage smaller bundle chunks and better performance monitoring.
- **Config cleanup** (audit 2C): Removed duplicate `capacitor.config.json` file, keeping only the TypeScript config for consistency.

### Changed
- **Environment setup** (audit 8D): Verified `.env.example` exists with all required VITE_ variables (Firebase config, Gemini API key, etc.) for easier developer onboarding.

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