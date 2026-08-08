---
agent: fix-planner
status: open
date: 2026-07-31
revised: 2026-08-08
sources: code-audit, bug-audit, security-audit, ui-audit, perf-audit, db-audit, dep-audit, doc-audit, infra-audit, seo-audit, api-audit (2026-07-31 pass); db/api/security-audit-subscription (2026-08-05 pass)
findings: 65
remaining: 8
---
# FIXES.md — Consolidated Fix Plan

**Status: 60 of 65 closed.** 5 items remain, all P2/P3 refactors and deferrals — no open P0 or P1.

Effort: S (<1h), M (half-day), L (multi-day).

---

## Remaining work

C3. ⚠️ PARTIALLY FIXED (2026-08-08, fixbatch) — No Virtual Scrolling for Large Lists
`PantryScanner.tsx` done: `VirtualizedPantryItemList.tsx` (`FixedSizeList`, 76px rows) wired into storage-view and category-view list-layout paths, gated at >50 items via `VIRTUALIZE_THRESHOLD`. Grid-layout view and section headers untouched (react-window doesn't virtualize multi-column grids well; headers must stay in normal flow for sticky/jump behavior).

**Still open:** `ShoppingList.tsx` and `RecipeFinder.tsx` — same grouped-list problem (collapsible headers, list/grid toggle, bulk-select, drag), need their own scoped items before a fixbatch can safely take them on.

🟠 HIGH Issues

H1. `rebuildCommunityRatedRecipesFromRatings` — Chunked N+1 Queries
`recipeService.ts` L254-350 — chunks parallel `getDoc()` calls in groups of 25. Still N+1: for 50 recipes → ~100 Firestore reads per rebuild.

Fix: batch-read with `in` queries (max 30 per query, client SDK) instead of per-doc `getDoc`.

H4. ✅ FIXED (2026-08-08) — imageCacheService Unbounded In-Memory Cache Growth
`imageCacheService.ts` — an `evictLruIfNeeded()` helper already existed (caps at `MAX_MEMORY_CACHE_SIZE = 300`) but was only wired into 1 of 7 `memoryCache.set()` call sites (the single-item write path in `cacheImageFromUrl`). The other 6 — `loadLocalCache()` init load, both branches of `getCachedImageUrl()`, both branches of the batch `getCachedImageUrls()`, and the batch write path in `cacheImagesFromUrls()` — skipped eviction, so the cache still grew unbounded via those paths, which are actually the heavier-traffic ones (bulk pantry scans, batch Firestore reads).
**Done:** added `evictLruIfNeeded()` before all 6 remaining `memoryCache.set()` call sites.

H6. PantryScanner.tsx — Category Filter Recomputed in Render
`PantryScanner.tsx` L511 — `Array.from(new Set(inventory.map(...).filter(Boolean)))` runs unmemoized on every render.

Fix: wrap in `useMemo` keyed on `inventory`.

H7. 6 Large Components > 40 KB Each — No Code-Splitting Within Tabs
`FAQPage.tsx` (64.5 KB), `RecipeFinder.tsx` (58.5 KB), `MealPlanner.tsx` (54.5 KB), `RecipeModal.tsx` (53.5 KB), `ShoppingList.tsx` (46.9 KB). (`Settings.tsx` already addressed under C4.)
Sub-components like modals, analytics panels, and bulk action sheets should be `React.lazy`'d within each tab.

🟡 MEDIUM Issues

M3. Missing Composite Firestore Index for date + recipeTitle on recipeRatings
`firestore.indexes.json` has indexes for `recipeTitle+householdId+date` and `userId+date`, but `rebuildCommunityRatedRecipesFromRatings` queries by `date >= cutoff` alone — forces a scan on the auto-created single-field index. The in-memory `filter()` fallback in `recipeService.ts` L274-278 suggests past issues with it.

M4. useEffect Proliferation
115+ `useEffect` calls across component files. Several have broad dependency arrays (e.g. `[user]` object reference) that fire on every user state update even when the effect only needs `user.id`.
Example, `App.tsx` L269-272: effect depends on `[user]` but only reads `user.profile.notificationSettings`.
Fix: narrow dependencies to primitives, e.g. `[user?.profile?.notificationSettings]`.

M5. firebase/performance Imported Eagerly via recipeService.ts
`recipeService.ts` L6 — static `import { getPerformance, trace } from "firebase/performance"` pulls the module into whatever chunk includes `recipeService`, used from multiple paths.

Fix: dynamic-import `firebase/performance` on first trace start, or move to a shared lazy `perfService.ts`.

M6. dailyReminders Cloud Function — Per-User Sequential Processing
`dailyReminders.ts` uses `USER_PAGE_SIZE = 500` but processes each user's inventory + meal plan reads sequentially within the page.

Fix: process users in parallel with a concurrency limit (`Promise.all` with chunking, or p-limit) — safe since each user's data is independent.

M7. ✅ FIXED (2026-08-08, fixbatch) — openRouterService.ts Still Exists (14.1 KB) — Dead Code?
**Done:** confirmed zero live imports (only a stale comment in `geminiService.ts` and changelog/doc text referenced it) and deleted `services/openRouterService.ts`.

M8. ⚠️ PARTIALLY FIXED (2026-08-08, fixbatch) — AppGlobalModals — 11 Lazy-Loaded Modals Always Mounted
**Done:** `GeminiTokenDebugger` (self-gates internally on `isAdmin` but was still unconditionally mounted/fetched for every user) is now wrapped in `{isAdmin && (...)}` in `AppGlobalModals.tsx`, matching the pattern already used for `DatabaseAnalytics`. `WhatsNewModal` was not gated — it's a general new-user feature, not admin/rare-use as the original item assumed, so gating it would hide it from its actual audience.
**Still open:** none of the other 9 lazy modals are admin/rare-use; no further gating candidates identified.

🟢 LOW Issues

L1. `next7DateKeys` Uses `toISOString()` Despite Having `localDateString`
`appUtils.ts` L95-103 — inconsistent with the file's own `localDateString()`; could cause timezone off-by-one in meal plan date matching near midnight.

L2. `resolveSeededItemImageFilename` — O(n) Loop on Every Item Render
`appUtils.ts` L33-37 — iterates all `Object.keys(itemImages)` for substring matching; ~500 iterations per pantry item render on a miss.
Fix: prefix trie or pre-sorted key array for binary search.

L3. Fuse.js Loaded Eagerly — **scoped, not fixed (2026-08-08, fixbatch)**
`searchUtils.ts` imports `fuse.js` (~12 KB minified) at top level. Not needed at first paint — dynamic import on first search keystroke saves initial parse time.
**Why not done in this batch:** `Fuse`'s constructor is synchronous, so a real dynamic-import fix requires making `searchPantryItems`/`searchRecipes`/`matchRecipeIngredients`/`getMealPrepSuggestions` async — which ripples into `usePantryFilterSort.ts`, `PantryScanner.tsx`, `MealPlanner.tsx`, and `RecipeSearchModal.tsx` (two of its `useMemo`s would need to become `useState`+`useEffect`). That's a multi-component refactor, not a mechanical import swap — needs its own scoped item.

L4. @zxing/library and tesseract.js Chunks Exist — Verify Lazy Loading
Both are in `manualChunks` in `vite.config.ts`. Verify import sites actually use `import()` — a single static import anywhere force-bundles them eagerly.

L5. console.warn in Production (databaseMonitoringService.ts)
`databaseMonitoringService.ts` L95 — stripped by `drop: ['console']` esbuild config in production, but fires frequently in dev for heavy writes.

---

- [ ] **F37. `Community.tsx` second god component** — **S** *(was M; substantially reduced)*
  1,766 → **909 lines** and relocated to `components/household/`. Split feed/actions/effects if it grows again; low urgency at current size.
  `components/household/Community.tsx` · **Sources:** code 2 (+8)

- [ ] **F40. Bespoke `fixed inset-0` overlays** — **L**
  Still **28 files** (was 27 — grew slightly). Migrate to `Modal`/`BottomSheet`; lint-ban new ones. Includes padding-var underlap fix.
  **Scoping pass (2026-08-07, no code changed):** classified all 40 `fixed inset-0` occurrences —
  **23 MODAL sites** (migrate to `<Modal>`): `RecipeModalDetailsSection.tsx:234`, `AppGlobalModals.tsx:432`, `LeftoverAnalytics.tsx:547`, `HouseholdInviteModal.tsx:56` (needs close-trigger check past line 100), `Household.tsx:306/361/388` (3 sequential early-return dialogs sharing one visual shell — consider collapsing into one `<Modal>` with conditional body), `RecipeImportModal.tsx:85`, `Community.tsx:671` (badge detail), `Community.tsx:783` (waste report), `RecipeFinderSavedView.tsx:394/489`, `SubscriptionManager.tsx:546/667`, `ExpiredItemsModal.tsx:148`, `Settings.tsx:1517` (member prefs), `Settings.tsx:1734` (FAQ wrapper — wraps standalone-fullscreen `FAQPage`, only wrapper migrates), `Settings.tsx:1763` (delete-account confirm, simplest candidate), `CategoryManager.tsx:104`, `PantryScanner.tsx:947` (wraps `FreezeTransitionModal` — inner header needs extracting into Modal's title slot), `NotificationSettings.tsx:335` (needs close-trigger check past line 360), `PantryImportModal.tsx:106`, `CameraPermissionsModals.tsx:31/92` (both button-only close), `RecipeModal.tsx:803` (large/complex: tabs + editable custom header — do last).
  **2 BOTTOMSHEET sites** (migrate to `<BottomSheet>`): `AppGlobalModals.tsx:218` (risk questionnaire wrapper — title lives inside child `RiskAssessmentQuestionnaire`, needs threading), `WhatsNewModal.tsx:72` (dual controlled/uncontrolled-via-localStorage logic must be preserved), `ModernOnboarding.tsx:444` (multi-step flow — evaluate step-header against Body/Footer slots carefully).
  **4 FULLSCREEN — leave as bespoke `fixed inset-0`, add lint-exception comment when the lint rule lands:** `ChangelogPage.tsx:71`, `FAQPage.tsx:585`, `CookingMode.tsx:502/516`.
  **6 NOT-A-MODAL — do not touch:** `CurrentDayMealsSection.tsx:239` (dropdown click-catcher), `AppGlobalModals.tsx:428` + `Community.tsx:905` (decorative canvas confetti/fireworks), `ContextualTutorial.tsx:101` + `FeatureDiscovery.tsx:129` (tutorial spotlight backdrops), `Login.tsx:278` (decorative gradient layer).
  Recommended execution: sequential, file-by-file, simplest first (`Settings.tsx:1763` delete-confirm), saving `RecipeModal.tsx`, `Household.tsx`'s 3-dialog shell, and `PantryScanner.tsx`'s wrapped `FreezeTransitionModal` for last. Add the lint-ban only after all MODAL/BOTTOMSHEET sites are migrated.
  **Sources:** ui 6 (+17)

- [ ] **F49. Migrate off `@codetrix-studio/capacitor-google-auth`** — **L**
  Abandoned RC pinned to Capacitor 6 while project is on 8. Move to `@capacitor-firebase/authentication` or `@capgo/capacitor-social-login`; retires the patch-package gradle patch.
  **Note (2026-08-06):** the `--legacy-peer-deps` requirement this item originally cited is already retired via a scoped `overrides` block in `package.json`. Migration remains worthwhile for the gradle patch and RC-version risk, but is no longer install-blocking.
  **Skipped in 2026-08-08 fixbatch:** genuinely L-effort — swapping native auth SDKs, gradle changes, and device-tested login flows are out of scope for a batch fix; needs its own dedicated pass.
  **Sources:** dep §4

### Deferred (revisit on trigger, not scheduled)

- [ ] **F32. Third-party client TTL/timeout defects — Spoonacular portion only** — **M**
  Nutrition and currency TTL fixes shipped and are stable. **Still open:** Spoonacular clients have no `fetchWithTimeout` and don't distinguish 402/401/429 from "no results" (verified: zero matches for either pattern in `spoonacularRecipeClient.ts`).
  `services/spoonacularFoodClient.ts`, `services/spoonacularRecipeClient.ts`
  **Trigger to schedule:** any quota-exhaustion or hung-request incident. **Sources:** api 14, 16 (+19, 20)

- [ ] **F33. i18n: 7 shipped locales but ~80% of UI hardcoded English** — **L**
  All 7 locale files present (`de, en, es, fr, ja, ru, zh`). Priority batch if resumed: nav labels, `ui/` primitive defaults, toasts, empty states; add scoped `react/jsx-no-literals` lint; then double coverage (~345 keys/locale).
  **Trigger to schedule:** expansion to a non-English user base. **Sources:** ui 15 (+14)

---

## Ordering for remaining items

Only one hard constraint survives — the rest are independent and can be picked up in any order:

1. **F41 before F40's final pass** — a modal router makes the 28-file overlay migration mechanical rather than bespoke per-site. Doing F40 first means touching those files twice.

Suggested sequence by cost: **F37** (small) → **F40, F49, F33** (large). F32 sits outside the sequence until its trigger fires.
