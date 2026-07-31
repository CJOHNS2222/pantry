---
agent: perf-auditor
status: warn
findings: 6
---

# Perf Audit — Stock & Spoon

## Summary

No memory-leak-causing timers/listeners found (all `setInterval`/`addEventListener` call sites checked have matching cleanup in `useEffect` return functions). The main risks are **render-perf**, not leaks: a monolithic, un-sliced `AppContext`/`AppActionsContext` re-renders the entire consumer tree on any state change, and the shopping-list row component both subscribes to that full context *and* is rendered unmemoized in a `.map()`, so every keystroke/tick/toast anywhere in the app re-renders every visible shopping-list row. Bundle size is a known, already-tracked issue (`deploy-checker` finding 3) — `index` and `firebase-vendor` chunks both exceed the 600 kB warning threshold; `manualChunks` in `vite.config.ts` splits `firebase/`, `lucide-react`, `@zxing/library`, `tesseract.js` but leaves all other first-party code (including the 3525-line `PantryScanner.tsx`) in the default/eager chunk.

## Findings

### 1. [WARN] Shopping list rows re-render on every unrelated app state change
- **Location:** `components/shopping-list/EnhancedShoppingListItem.tsx:1-12` (649 lines, calls `useApp()` directly at module scope of the component) rendered via `components/shopping-list/ShoppingListItemsSection.tsx:59-73`.
- **Description:** `EnhancedShoppingListItem` is (a) not wrapped in `React.memo`, and (b) calls `useApp()` internally to read from the single monolithic `AppContextValue` (inventory, mealPlan, savedRecipes, settings, activeTab, etc. all in one object — see `contexts/AppContext.tsx:7-61`). Because `App.tsx`'s `appContextValue` `useMemo` depends on ~25 pieces of state (`App.tsx:1508-1512`), *any* of them changing (an inventory edit, a toast, a tab switch, a settings tweak) produces a new context value, which re-renders every mounted `EnhancedShoppingListItem` row — even though most of those rows only care about their own `item` prop. With a non-trivial shopping list (organized view groups can hold dozens of items) this means full list re-renders on unrelated interactions elsewhere in the app.
- **Remediation:** Wrap `EnhancedShoppingListItem` in `React.memo`; stop reading `useApp()` inside the row component and instead pass the specific fields it needs (savedRecipes/mealPlan for `findRecipeByTitle`, settings for currency/measurement) down as props from `ShoppingList.tsx`/`ShoppingListItemsSection.tsx`, which already receives them from context once. Longer-term, consider splitting `AppContext` into narrower slices (inventory context, settings context, ui-state context) so unrelated state changes don't invalidate every consumer — this overlaps with the already-deferred "App.tsx modal-state sprawl" refactor.

### 2. [INFO] `PantryScanner.tsx` is a 3525-line component with 14 `useEffect`s, loaded eagerly
- **Location:** `components/pantry/PantryScanner.tsx`.
- **Description:** Far larger than any other component in the repo (next largest is `ShoppingList.tsx` at 1184 lines). 14 separate `useEffect` hooks in one component makes it hard to verify each has correct, minimal dependencies, and a component this size re-parses/re-diffs a large render tree on every state update inside it (scanner has multiple pieces of transient state: camera frames, OCR progress, barcode results). `vite.config.ts`'s `manualChunks` comment explicitly declines to force first-party files into their own chunk, but doesn't confirm `PantryScanner` is behind a `React.lazy()` boundary either.
- **Remediation:** Confirm `PantryScanner` (and its `barcode-vendor`/`ocr-vendor` dependents) is only reached via `React.lazy()`/dynamic `import()` from wherever it's opened (scan button), not statically imported into a component that's part of the initial tab render — otherwise the barcode/OCR vendor chunks and this 3525-line component load on first paint for users who never open the scanner. Longer-term, split into subcomponents (camera view, OCR review, barcode review, manual-entry form) so state updates in one phase don't force a diff over the whole tree.

### 3. [INFO] Bundle size — main and firebase-vendor chunks over Vite's warning threshold (carried over from deploy-checker)
- **Location:** `vite.config.ts:66-97` (manualChunks); build output `dist/assets/index-*.js` (~815 kB / 239 kB gzip), `dist/assets/firebase-vendor-*.js` (~798 kB / 236 kB gzip).
- **Description:** Already flagged by `deploy-checker` as non-blocking; restating with perf framing since it directly affects mobile/Capacitor WebView TTI. `firebase-vendor` bundles all of `firebase/*` (auth, firestore, storage, functions, remote-config, messaging, analytics) into one chunk regardless of which are used on a given screen. The default/`index` chunk sweeps in all first-party code not reachable only via a lazy boundary — per the comment at `vite.config.ts:70-77`, this is intentional to avoid fighting Rollup's graph-based splitting, but it means any component imported eagerly (even transitively) from `App.tsx` stays in the eager path.
- **Remediation:** Audit `App.tsx`'s top-level imports for anything that could become `React.lazy()` (Settings, RecipeFinder, MealPlanner, less-common modals) to shrink the eager `index` chunk; consider whether `firebase/messaging`/`firebase/functions` can be dynamically imported only where used (push notification setup, IAP verification) rather than pulled in for every page load.

### 4. [INFO] `hooks/useDataListener.ts` generic listener re-subscribes if callers pass fresh callbacks
- **Location:** `hooks/useDataListener.ts:16-35`.
- **Description:** `useDataListener`'s `useEffect` dependency array includes `onData`, `validator`, and `errorHandler` (function references) alongside `collectionPath`. If any caller passes these as inline arrow functions (not `useCallback`-memoized), the effect tears down and recreates the Firestore `onSnapshot` listener on every render of the calling component — extra listener churn and a brief data gap on each unsubscribe/resubscribe. Domain hooks checked directly (`hooks/dataManagement/useInventory.ts:104-134`) don't use this generic hook and manage their own effect with stable `[user?.id, user?.householdId]` deps, so they're unaffected — but any other caller of `useDataListener`/`useUserDataListener`/`useHouseholdDataListener`/`useScopedDataListener` should be checked for memoized callback args.
- **Remediation:** Either drop `onData`/`validator`/`errorHandler` from the dependency array (using refs internally, as `useInventory.ts` does with `addToastRef`) so the hook is resilient to unmemoized callers, or audit/enforce `useCallback` at every call site.

### 5. [INFO] `MealPlanner.tsx` drag-scroll interval fires every 16ms while dragging near viewport edges
- **Location:** `components/recipes-meals/MealPlanner.tsx:340-390`.
- **Description:** Cleanup is correct (interval cleared on drag end/unmount), so this isn't a leak, but each tick calls `window.scrollBy` inside a `setInterval` rather than `requestAnimationFrame`, which can drift from the browser's paint cycle and cause jank on lower-end devices (relevant given this app also ships as an Android Capacitor WebView).
- **Remediation:** Low priority; consider swapping to a `requestAnimationFrame` loop for smoother scroll if drag-and-drop jank is ever reported.

### 6. [INFO] Multiple independent polling intervals active simultaneously when relevant panels are open
- **Location:** `hooks/useOfflineStatus.ts:90` (4s), `hooks/useNotificationPolling.ts:69`, `services/cacheService.ts:29` (60s), `services/offlineDataCache.ts:39` (5 min), `services/leftoverNotificationService.ts:168`, `components/admin-analytics/DatabaseAnalytics.tsx:68` (5s, admin-only), `components/admin-analytics/PerformanceMonitoringDashboard.tsx:156` (1s, admin-only). All have matching `clearInterval` cleanup.
- **Description:** No leak, but worth noting for cumulative background CPU/battery cost on mobile: `useOfflineStatus`'s 4-second poll plus notification polling run continuously whenever the relevant provider/hook is mounted (likely app-wide, not scoped to a visible panel), unlike the admin-analytics ones which are gated by `isVisible`.
- **Remediation:** Confirm `useOfflineStatus`'s 4s interval and notification polling are actually necessary at that cadence app-wide (vs. event-driven via `navigator.onLine`/visibility change), especially for battery impact on the Capacitor Android build.

## Metrics
- Largest component: `components/pantry/PantryScanner.tsx` — 3525 lines, 14 `useEffect` hooks.
- `App.tsx` — 1983 lines; context value objects correctly memoized via `useMemo` (`App.tsx:1471`, `App.tsx:1516`) but with wide dependency arrays (~25 and ~30 entries respectively) that invalidate on most app state changes.
- `React.memo` usage found in only 7 files repo-wide (`Grep` for `React.memo|memo(` under `components/`): `Settings.tsx`, `ShoppingList.tsx`, `PantryScanner.tsx`, `MealPlanner.tsx`, `Community.tsx`, `RecipeFinder.tsx`, `SkeletonLoader.tsx`. Frequently-listed row components (`EnhancedShoppingListItem.tsx`) are not among them.
- Build output (from `deploy-checker` last run): `index` chunk 815.31 kB (239.13 kB gzip), `firebase-vendor` 798 kB (236 kB gzip), `barcode-vendor` 452 kB (119 kB gzip, correctly split/on-demand), `searchUtils` 386 kB (76 kB gzip) — all over the 600 kB `chunkSizeWarningLimit` set in `vite.config.ts:96`.
- Timer/listener cleanup audit: all 13 `setInterval` call sites and all `addEventListener`/`onSnapshot` sites sampled have matching `clearInterval`/`removeEventListener`/`unsubscribe()` in effect cleanup — no leaks found.
