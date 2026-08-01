---
agent: perf-auditor
date: 2026-07-31
status: warn
findings: 9
---

# Performance Audit — Stock & Spoon

Method: graphify-oriented (`graphify query`/`explain`), then targeted reads of `vite.config.ts`, `contexts/AppContext.tsx`, `components/layout/MainContent.tsx`, `hooks/dataManagement/useInventory.ts`, `hooks/useOfflineStatus.ts`, `services/imageCacheService.ts`. Builds on and corrects the earlier `.claude/audits/AUDIT_PERF.md`.

## Findings

### 1. [HIGH] `useOfflineStatus` 4s poll forces an App-level re-render every tick, even when nothing changed
- **File:** `hooks/useOfflineStatus.ts:74-81` (setState), `hooks/useOfflineStatus.ts:90` (interval); consumed at `App.tsx:217` and `components/shopping-list/ShoppingList.tsx:300`.
- **Detail:** `checkQueue` runs every 4000ms and calls `setSyncStatus(prev => ({ ...prev, ... }))` unconditionally — a **new object every tick**, even when `pendingOperations`, `hasConflicts`, and `isSyncing` are all unchanged (the overwhelmingly common case: 0 pending ops while online). Because the hook is called at the top of `App()` (1983 lines) this re-renders the entire App render tree every 4 seconds for the app's whole lifetime. Combined with Finding 2 (unmemoized row components reading a monolithic context) this is a steady background render churn: on a Capacitor WebView it costs CPU/battery continuously.
- **Estimated impact:** Full App-tree reconciliation every 4s, forever. Largest single steady-state render cost in the app.
- **Fix:** Bail out when values are equal: `setSyncStatus(prev => (prev.pendingOperations === count && prev.hasConflicts === (conflicts.length > 0) && prev.isSyncing === isSyncing) ? prev : { ...prev, ... })` — returning `prev` skips the re-render. Also consider event-driven updates (queue emits on enqueue/flush) instead of polling IndexedDB every 4s.

### 2. [HIGH] Monolithic `AppContext` + unmemoized list rows: every state change re-renders every visible shopping-list row
- **File:** `contexts/AppContext.tsx:7-61` (single ~30-field context value); `components/shopping-list/EnhancedShoppingListItem.tsx` (649 lines, calls `useApp()` per row, not `React.memo`-wrapped), rendered in a `.map()` from `ShoppingListItemsSection.tsx:59-73`; `App.tsx:1508-1512` (`appContextValue` useMemo with ~25 deps).
- **Detail:** Verified carried finding. Any inventory edit, toast, tab switch, settings tweak — or the 4s tick from Finding 1 while ShoppingList also calls `useOfflineStatus` — produces a new context value and re-renders every mounted row. `React.memo` exists in only 7 components repo-wide; no frequently-mapped row component is among them.
- **Estimated impact:** O(rows) full re-renders on unrelated interactions; dominant interaction-latency cost on the shopping-list tab with large lists.
- **Fix:** (a) `React.memo(EnhancedShoppingListItem)` and pass needed fields (savedRecipes/mealPlan/settings) as props from the section component instead of `useApp()` per row; (b) longer-term, split `AppContext` into slices (data / settings / ui-state) — overlaps the already-deferred App.tsx modal-state refactor.

### 3. [MEDIUM] Image cache localStorage round-trip breaks `Date` fields — expiry check throws / cache defeated
- **File:** `services/imageCacheService.ts:107-126` (`loadLocalCache`), `services/imageCacheService.ts:215-230` (`getCachedImageUrl`), `services/imageCacheService.ts:47-57` (`evictLruIfNeeded`).
- **Detail:** `saveLocalCache` JSON-stringifies `memoryCache`; `loadLocalCache` restores entries with `memoryCache.set(key, value as CachedImage)` **without reviving `createdAt`/`lastUsed` back to `Date`** — after a reload they are ISO strings. `getCachedImageUrl` then calls `memoryCached.createdAt.getTime()` (L223) which throws `TypeError` for every localStorage-restored entry (no try/catch in that path), and `evictLruIfNeeded`'s sort calls `.lastUsed.getTime()` on the same broken entries. Net effect: after any page reload the persisted image cache is unusable (or crashes lookups), silently forcing Firestore/network refetches the cache exists to avoid.
- **Estimated impact:** Image cache effectively session-only; extra Firestore reads + image fetches after every app launch — the exact read amplification the cache was built to prevent.
- **Fix:** In `loadLocalCache`, revive dates: `memoryCache.set(key, { ...value, createdAt: new Date(value.createdAt), lastUsed: new Date(value.lastUsed) })`, and/or store epoch numbers instead of `Date` objects.

### 4. [MEDIUM] No client-side image compression/resizing before Storage upload; global `image_cache/global` doc grows unbounded
- **File:** `services/imageCacheService.ts:78-102` (`uploadImageToStorage` uploads the raw fetched blob as-is), `services/imageCacheService.ts:151-200` (`syncCacheWithFirestore` reads the single shared `image_cache/global` doc).
- **Detail:** `downloadImageAsBlob` + `uploadBytes` push whatever size the source image is — no canvas resize, no quality re-encode, despite the filename claiming `.jpg`. Storage rules cap uploads at 5-10MB but nothing shrinks a 4MB photo to the ~100-300px thumbnail actually rendered in list rows. Separately, `image_cache/global` is one Firestore document shared by all users: every client re-downloads the entire doc hourly, and it grows monotonically toward the 1MB document hard limit — when it hits the limit, writes to it start failing app-wide.
- **Estimated impact:** Bandwidth/storage cost per image ~10-40x larger than needed on mobile; a future hard failure mode on the global cache doc.
- **Fix:** Resize/re-encode via canvas (e.g. max 512px, JPEG q0.8) before `uploadBytes`; add a size/entry cap + pruning strategy (or shard) for `image_cache/global`.

### 5. [MEDIUM] Bundle: eager `index` (~815 kB / 239 kB gz) and `firebase-vendor` (~798 kB / 236 kB gz) both exceed the 600 kB warning limit
- **File:** `vite.config.ts:69-99` (manualChunks + `chunkSizeWarningLimit: 600`).
- **Detail:** Verified carried finding, with one correction to the prior audit: the heavy tab components (`PantryScanner`, `MealPlanner`, `ShoppingList`, `RecipeFinder`, `Community`, `Settings`) **are** behind `React.lazy` (`components/layout/MainContent.tsx:6-11`), and App.tsx lazy-loads 11 modals — so first-party splitting is in decent shape. The remaining costs: `firebase-vendor` lumps all `firebase/*` products (auth, firestore, storage, functions, remote-config, messaging, analytics) into one eager chunk regardless of screen; the `index` chunk still carries everything eagerly imported from `App.tsx`; `searchUtils` chunk is 386 kB.
- **Estimated impact:** ~475 kB gzip parsed before first paint in the Capacitor WebView — the main TTI lever.
- **Fix:** Dynamically import `firebase/messaging` (push setup), `firebase/functions` (IAP/invitations), and analytics at first use so they split out of `firebase-vendor`; audit remaining eager `App.tsx` imports; inspect `searchUtils` chunk contents via `npm run build:analyze`.

### 6. [LOW] Household cache-doc listener re-transmits and re-deserializes the entire inventory on every change
- **File:** `hooks/dataManagement/useInventory.ts:104-128`.
- **Detail:** The single-doc cache design (intentional, per CLAUDE.md — 1 read instead of N) means every item edit by any household member pushes the **whole** cache document over the wire to every listening member, then `arrayToPantryItem` re-deserializes all items and `setLocalInventoryCache` re-persists them, per snapshot. `hasPantryItemsChanged` correctly gates the React state update, so render cost is contained; this is bandwidth/CPU per snapshot plus a hard scaling ceiling: the whole inventory must fit in one 1MB Firestore doc.
- **Estimated impact:** Linear-in-inventory-size work per edit; acceptable now, but degrades with large households and hard-fails at the 1MB doc limit.
- **Fix:** No action needed short-term (design tradeoff is sound for read costs). Add an item-count/doc-size guard with telemetry so the 1MB ceiling is seen coming; consider sharding the cache doc if households approach it.

### 7. [LOW] `useDataListener` re-subscribes the Firestore listener when callers pass unmemoized callbacks
- **File:** `hooks/useDataListener.ts:16-35`.
- **Detail:** Carried finding — `onData`/`validator`/`errorHandler` in the effect deps cause unsubscribe/resubscribe churn on every caller render if not `useCallback`-wrapped. Domain hooks (`useInventory`) don't use it and are safe.
- **Fix:** Hold callbacks in refs (pattern already used for `addToastRef` in `useInventory.ts:54-57`) and drop them from deps.

### 8. [INFO] `PantryScanner.tsx` — 3525 lines, 14 `useEffect`s in one component
- **File:** `components/pantry/PantryScanner.tsx`.
- **Detail:** Correctly lazy-loaded (bundle impact contained) and `@zxing`/`tesseract` are split into on-demand `barcode-vendor`/`ocr-vendor` chunks — but every transient state update inside the scanner (camera frame, OCR progress) diffs the whole 3525-line tree.
- **Fix:** Split into phase subcomponents (camera / OCR review / barcode review / manual entry) when next touched.

### 9. [INFO] Timer/listener hygiene: no leaks found
- All sampled `setInterval`/`addEventListener`/`onSnapshot` sites have matching cleanup (`useInventory.ts:137-139, 203-212`, `useOfflineStatus.ts:92-95`, MealPlanner drag interval, admin polling panels). `MealPlanner.tsx:340-390` 16ms `setInterval` drag-scroll would be smoother as `requestAnimationFrame` (low priority). Image memory cache is LRU-capped at 300 entries with a debounced localStorage writer — good.

## Priority order
1. Finding 1 (one-line fix, kills app-wide 4s re-render churn)
2. Finding 3 (small fix, restores persisted image cache and removes hidden Firestore reads)
3. Finding 2 (memoize rows / slice context)
4. Finding 4 (image compression + global-doc cap)
5. Finding 5 (firebase-vendor dynamic imports)
