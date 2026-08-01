---
agent: code-auditor
status: warn
findings: 8
date: 2026-07-31
---

## Summary

Graphify-oriented re-audit. Substantial cleanup has landed since the previous `AUDIT_CODE.md` pass: the formerly dead `hooks/dataManagement/*` module is now genuinely wired up (`hooks/useDataManagement.ts` is down from 1,569 to 356 lines and delegates to it — prior finding 1 resolved), `LeftoversHotZone.tsx` and its direct `onSnapshot` subscription were deleted (finding 2 resolved), the QuickAddModal voice-listener leak is fixed (`listenerHandle.remove()` now in a `finally`, `QuickAddModal.tsx:143-154`), `currencyService.ts` labels its fallback as `USD ...` (line 118), and `shoppingListCacheService.ts:99` now uses strict `===` for cache-version checks. No `console.log` sprawl (only `logService`/`versionService`/`databaseMonitoringService`), zero TODO/FIXME markers in services/hooks/contexts, and near-zero `any` in app code outside three files that disable the lint rule wholesale.

What remains is concentrated in a handful of oversized god components and one naming/duplication hazard in the notification layer.

## Findings

### Important

1. **`PantryScanner.tsx` god component — unchanged** — `components/pantry/PantryScanner.tsx`: 3,427 lines, 48 `useState` calls, and a single component function spanning `PantryScannerComponent` (L93) to `export const PantryScanner` (L3427). Camera capture, receipt parsing, virtualized list rendering (`VirtualizedRow` at L27 takes `data: any`), filtering/search, and quick-consume/undo all live in one closure. Extraction already started (`usePantryScannerScan.ts`, 343 lines) but the host has only shrunk ~100 lines since the last audit. Confidence: 90.
   - Fix: continue the established extraction pattern — next candidates are the virtualized list renderer (`VirtualizedRow` + row-data plumbing) into `components/pantry/PantryList.tsx` and quick-consume/undo state into a `usePantryQuickConsume` hook.

2. **`Community.tsx` is a second god component forming** — `components/household/Community.tsx`: 1,766 lines, single `CommunityComponent` function L76–L1767, 23 `useState`/`useEffect` calls. Same trajectory PantryScanner followed; cheaper to split now than at 3,000 lines. Confidence: 85.
   - Fix: split feed rendering, recipe-card actions, and data-fetch effects into subcomponents/hooks under `components/household/`.

3. **Twin notification services with colliding type names** — `services/notificationService.ts` (945 lines) and `services/notificationsService.ts` both export a `NotificationItem` interface with *different shapes* (`notificationService.ts:13` has `userId`; `notificationsService.ts:6` has `title`/`body`/`message`/`dedupeKey`). `notificationService.ts` imports helpers from `notificationsService.ts`, and consumers (`App.tsx`, `PendingNotifications.tsx`, `useUserNotifications.ts`, `useNotificationPolling.ts`) import from one or the other by near-identical path — a one-character typo silently compiles against the wrong type. Confidence: 85.
   - Fix: rename to reflect roles (e.g. `notificationSchedulingService.ts` vs `userNotificationStoreService.ts`) and unify or explicitly distinguish the two `NotificationItem` types (e.g. `ScheduledNotification` vs `UserNotification`).

4. **`App.tsx` modal-visibility sprawl — known deferred item, still open** — `App.tsx`: 1,998 lines, 26 `useState` calls; 10+ ad-hoc modal booleans plus their payload states at L140-155 (`showHousehold`, `showOnboarding`, `showNotificationsModal`, `showHouseholdInviteModal`, `showExpiredItemsModal` + `expiredItemsModalSpecificItems`, `showExpiredLaunchSheet` + `expiredLaunchItems`, ...) and more at L697-699 (`globalModalRecipe`/`showGlobalRecipeModal`/`globalModalIsSavedView`). Deliberately deferred 2026-07-29 pending sign-off — listed for continuity, not re-litigation. Confidence: 90.
   - Fix (when approved): single `useReducer` modal-stack (`{ type: 'expiredItems', items } | { type: 'globalRecipe', recipe, isSavedView } | ...`), which also simplifies the Android hardware-back history handling.

5. **Blanket `no-explicit-any` disables hide type debt in three files** — file-level `/* eslint-disable @typescript-eslint/no-explicit-any */` in `services/notificationService.ts:1`, `services/databaseMonitoringService.ts:1`, and mid-file at `contexts/AppActionsContext.tsx:66`. The rest of the codebase is nearly `any`-free, so these three are where type-safety erosion is concentrated — `AppActionsContext` especially, since it types the app-wide action surface every component consumes. Confidence: 75.
   - Fix: scope the disable to individual lines, then burn down: type `AppActionsContext` action signatures first (highest blast radius).

### Minor

6. **`utils/appUtils.ts` is a 2,562-line grab-bag** — expiry alerts (`shouldShowExpiryAlert`), ingredient math (`deductIngredientAmount` at L2405), and assorted helpers share one file despite `utils/pantry/`, `utils/recipe/`, `utils/shared/` subfolders existing for exactly this split. Not broken, but it defeats the documented directory layout and makes graphify/grep results noisy. Confidence: 70.
   - Fix: mechanical move of domain clusters into the existing subfolders with re-exports from `appUtils.ts` to avoid a big-bang import rewrite.

7. **Tab-like controls implemented three different ways** — carried from `AUDIT_UI.md` finding 6; deliberately deferred 2026-07-29 (needs review of all three implementations before consolidating). Listed for continuity. Confidence: 60.

8. **Dead constant `_STAPLES` in `Community.tsx:37`** — 15-entry array with an underscore prefix signalling "intentionally unused"; if nothing will use it, delete rather than warehouse. Confidence: 60.

## Non-findings (checked, clean)

- Direct `firebase/firestore` imports in `components/` are now only `serverTimestamp`/`Timestamp` value imports (`Settings.tsx:2,22`, `Household.tsx:7`, `PendingNotifications.tsx:6`) — no reads/writes bypassing `useDataManagement.ts`; acceptable boundary leak.
- All `*CacheService` files use strict `===` version checks and integer `CACHE_VERSION`.
- No stray `console.log` in components/hooks/utils; logging goes through `logService`.
- Zero TODO/FIXME/HACK markers in `services/`, `hooks/`, `contexts/`.

## Metrics

- Largest files: `PantryScanner.tsx` 3,427 (48 useState) · `utils/appUtils.ts` 2,562 · `App.tsx` 1,998 (26 useState) · `Settings.tsx` 1,772 (31 useState) · `Community.tsx` 1,766 · `MealPlanner.tsx` 1,376 · `groceryPriceService.ts` 1,203.
- Resolved since prior audit: dead `hooks/dataManagement` module (now wired, `useDataManagement.ts` 1,569 → 356 lines), `LeftoversHotZone.tsx` (deleted), QuickAddModal listener leak, `currencyService` fallback labeling, `shoppingListCacheService` `>=` check.
