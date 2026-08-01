# Bug Audit — Runtime Defects, Logic Errors, Races, Edge Cases

Date: 2026-07-31
Auditor: bug-auditor
Scope: FEFO batch consumption, offline queue/sync, household migration checkpoints, cache serialization, quantity legacy/current fields, date/ISO handling, Firestore listener lifecycles.
Method: graphify orientation (`graphify query`) then targeted source reads.

---

## HIGH

### H1. Inventory cache round-trip silently drops ~10 PantryItem fields
**File:** `services/inventoryCacheService.ts:27-153` (`ITEM_FIELD_ORDER` / `pantryItemToArray` / `arrayToPantryItem`) vs `types.ts:1-72`
**Bug:** The serialized field array omits: `consumptionHistory`, `tags`, `cooked_rice`, `originalQuantity`, `leftoverMeta`, `estimatedPrice`, `expiryDate`, `freezerZone`, `freezerLabelPhotoUrl`, `freezerPortionCount`. Any write path that rebuilds the whole cache doc from deserialized items (`updateCache` via `addItemsToCache`, `bulkUpdateInventoryCache`, migration) permanently destroys those fields.
**Repro:** Add cooked-rice leftovers via `PantryService.processDetectedItem` (sets `cooked_rice: true`, `tags: ['cooked-rice']`, `estimatedPrice` from receipt). Bulk-delete another item (`deleteItems` -> `bulkUpdateInventoryCache`). Reload: rice item has lost `cooked_rice`/`tags` — food-safety expiry logic degrades to generic; `estimatedPrice` gone so waste analytics always uses the $2.50 fallback (`hooks/dataManagement/useInventory.ts:389,422,499`).
**Also:** `reservations` are collapsed to a single `{recipeId, recipeName}` pair, and on restore `quantity: 0, unit: ''` (`inventoryCacheService.ts:80-81,117`) — reservation quantities are always destroyed.
**Fix:** Add missing fields to `ITEM_FIELD_ORDER` + both converters (JSON-encode arrays/objects like `batches`), serialize full `reservations` as JSON, and bump `CACHE_VERSION` to 2 with a read-side migration.

### H2. CACHE_VERSION bump bricks/wipes existing users' pantry
**File:** `hooks/dataManagement/useInventory.ts:107` vs `services/inventoryCacheService.ts:171-207`
**Bug:** The listener only accepts snapshots where `data.version === CACHE_VERSION`; there is no migration/rewrite path for an old-version doc. After any version bump, existing users' listener silently ignores their cache doc forever — inventory renders empty. Worse: the next `deleteItems`/`addItems` calls `updateCache` with the (empty) local state, `setDoc`-replacing the doc and destroying all real data. Meanwhile `getCachedInventory` (used by household migration) performs NO version check at all — the two readers disagree on validity.
**Repro:** Bump `CACHE_VERSION` to 2, ship. Any existing user: empty pantry on load; first mutation wipes the doc.
**Fix:** On version mismatch, deserialize with a versioned migrator and rewrite the doc at the current version (or at minimum fall back to parsing instead of ignoring). Make `getCachedInventory` apply the same versioning.

### H3. Whole-doc `setDoc` on shared household cache = lost-update race between members
**File:** `services/inventoryCacheService.ts:220-259` (`updateCache`), called from `hooks/dataManagement/useInventory.ts:556` (`deleteItems`) and `addItemsToCache`
**Bug:** `deleteItems` computes `updatedInventory` from member A's local state and `setDoc`s the entire household cache doc. If member B added/edited an item that hasn't reached A's snapshot yet (or B's write lands between A's read and write), B's item is silently deleted or reverted. Single-item paths (`addItemToCache`/`updateItemInCache`) correctly use field-scoped `updateDoc`; the bulk paths do not.
**Repro:** Two household members online. B adds "Milk". Within the propagation window A bulk-deletes 2 unrelated items. Milk vanishes for everyone.
**Fix:** For bulk delete, build an `updateDoc` payload of `deleteField()` per removed id instead of rewriting the doc; for bulk add, `updateDoc` with only the new item keys (create with `setDoc({merge:true})` if absent).

### H4. Migration treats cache-read failure as "no data" — checkpoint cleared, personal data stranded
**File:** `services/householdMigrationService.ts:40-45` + `services/inventoryCacheService.ts:200-206`
**Bug:** All `get*` cache methods swallow errors and return `[]`. If the user is offline or a read fails during `migrateUserDataToHousehold`, every list appears empty, `allSucceeded` stays `true`, and the `pending_migration_{userId}` checkpoint is removed at line 98 — the retry mechanism (`useHouseholdMigrationRetry`) never fires, and the personal data is never merged into the household (it sits invisible in the personal cache while the app now reads the household path).
**Repro:** Join a household while offline (Firestore persistent cache miss / permission race right after join). Migration "succeeds" instantly; pantry items from personal account never appear in the household.
**Fix:** Have the cache getters rethrow (or return a `{ok, items}` result) for the migration path; only clear the checkpoint when all four reads verifiably succeeded.

### H5. Offline queue: op that exhausts retries is never removed — permanent poison-pill loop
**File:** `services/offlineQueueService.ts:239-247` (`handleRetry`)
**Bug:** When `retryCount >= maxRetries` the code logs and `return`s, but the operation is neither removed from `QUEUE_STORE` nor moved anywhere. Every subsequent sync (`processQueueWithSync` dequeues ALL ops) re-executes the failing op, fails, gives up, and leaves it in place — forever. `getPendingCount` stays inflated and every online transition re-attempts the doomed write.
**Fix:** `await this.remove(op.id)` (optionally archiving to a dead-letter store) in the give-up branch.

### H6. Offline queue: duplicate conflict id aborts the whole sync run
**File:** `services/offlineQueueService.ts:216-237` (`handleConflict`) + `153-176`
**Bug:** A conflicted op is left in the queue (only success removes it), so the next sync re-conflicts and `handleConflict` calls `store.add()` with the same key `conflict_${op.id}` — IndexedDB `add` rejects with `ConstraintError`. That rejection is thrown from inside the `catch` block of the per-op loop, escaping the loop entirely: remaining queued operations are skipped for that run and `processQueue().then(...)` in `useInventory.ts:219` never shows the sync toast, while `processQueueWithSync` rejects.
**Additional:** `isConflictError` classifies `permission-denied` and `not-found` as conflicts (`:210-214`), so a permanently-denied write also loops through this path every sync instead of being retired.
**Fix:** Use `store.put()` in `handleConflict`, remove the op from the queue once parked as a conflict, and wrap `handleConflict`/`handleRetry` calls in their own try/catch.

---

## MEDIUM

### M1. `consumeFromItem` legacy fallback mutates the caller's item in place
**File:** `services/pantryService.ts:407-414`
**Bug:** `updated = { ...item }` is a shallow copy, so `updated.quantity` is the same object reference as `item.quantity`. The no-batches fallback does `updated.quantity.amount = Math.max(0, ...)` — mutating the original item held in React state, violating the repo's immutable-update rule; `hasPantryItemsChanged` may then see no diff and skip re-render/sync.
**Fix:** `updated.quantity = { ...item.quantity, amount: Math.max(0, ...) }`.
**Related:** legacy items where `quantity` is a plain number, or only `quantity_estimate` exists, are silently NOT decremented at all (falls through, `consumed` stays empty).

### M2. FEFO consumption permanently reorders batches and ignores units
**File:** `services/pantryService.ts:425-441`
**Bug:** (a) The FEFO branch assigns the expiry-sorted array back to `updated.batches`, so a single consume permanently reorders purchase batches (purchase-order display/history lost). (b) Consumption subtracts `amount` across batches regardless of each batch's `unit` — with mixed units (e.g. one batch in "g", one in "count") it deducts 500 "count" after exhausting 200 "g". The aggregate recompute already guards on unit homogeneity; consumption does not.
**Fix:** Consume via a sorted view but write back in original order (map by batchId); skip/convert batches whose unit differs from the requested unit.

### M3. Index-based `updateItem`/`deleteItem` race against snapshot reordering
**File:** `hooks/dataManagement/useInventory.ts:331-332, 369-370`
**Bug:** Mutations address items by array index (`inventory[index]`). The listener rebuilds the array from `for (const itemId in data)` — Firestore map key order, which can differ between snapshots and clients. If a remote snapshot lands (another household member adds/deletes) between the UI capturing an index and the handler running, the wrong item is updated or deleted.
**Repro:** Member B deletes item #2 while member A has the delete-confirm open for item #5; A confirms; the item after the shifted position is removed.
**Fix:** Address mutations by item id; resolve index -> id at click time and re-find at mutation time (pattern already used in `performUndo`).

### M4. UTC/local date mixing shifts expiry boundaries by up to a day
**Files:** `services/pantryService.ts:122-129`; `hooks/dataManagement/useInventory.ts:145,160-171,383-387,416-420`
**Bug:** Expiry dates are `YYYY-MM-DD` strings produced with `new Date().toISOString().slice(0,10)` (UTC calendar day) but compared against local `new Date()`; `new Date('YYYY-MM-DD')` parses as UTC midnight. For users west of UTC in the evening: `todayString` is already "tomorrow", so `expirationDate <= today` marks items expired a day early, `daysUntilExpiry = Math.ceil((utcMidnight - nowLocal)/day)` flips at the wrong hour, and the once-per-day expiration check keys off the UTC day.
**Fix:** Centralize a `localDateString()` helper (year/month/day from local components) and parse date-only strings with `new Date(y, m-1, d)`.

### M5. Guest FEFO/quantity fallback: `getQuantityValue` vs bulk delete estimated value
**File:** `hooks/dataManagement/shared.ts:11-20` — behavior correct, but note it can disagree with batches: for items with `batches` whose units differ, `quantity` is stale/absent (`pantryService` leaves it untouched on unit mismatch, e.g. `mergeItemWithInventory:294-296` swallows `combineQuantities` failure), so staple auto-re-add in `useInventory.ts:358-365` compares stale aggregates and can fire (or fail to fire) incorrectly.
**Fix:** When `batches` exist, derive quantity from batches (sum per unit) rather than trusting the cached aggregate.

### M6. `addItems` (non-guest) never updates local state
**File:** `hooks/dataManagement/useInventory.ts:594`
**Bug:** Writes to the cache only; local `inventory` state updates rely on the snapshot listener. When `options.disableInventoryListeners` is set (option exists at `:101`), or while offline before the local snapshot echo, bulk-added items don't appear. Also the listener effect deps (`:140`) omit `options?.disableInventoryListeners`, so toggling it mid-session neither attaches nor detaches the listener.
**Fix:** Optimistically `setInventory` in `addItems`; add the flag to the effect deps.

### M7. Conflict detection assumes Firestore Timestamp — throws on other shapes
**File:** `services/offlineQueueService.ts:196-201`
**Bug:** `serverTimestampValue.toMillis()` is called unguarded; if `updatedAt`/`timestamp` is a number or ISO string (docs written by other paths don't use `serverTimestamp()` — e.g. cache docs store `lastUpdated: new Date()`), this throws a TypeError which is mis-classified as a retryable failure, burning all 3 retries on a healthy op.
**Fix:** `typeof v?.toMillis === 'function' ? v.toMillis() : new Date(v).getTime()` with NaN guard.

---

## LOW

### L1. Dead external-image fetch in `createManualItem`
**File:** `services/pantryService.ts:199-210`
`fetchExternalItemImage(...).then(ext => { if (ext) image = ext; })` mutates a local variable after the function has already returned the item — the fetched image is always discarded (and the network call wasted).
**Fix:** Either await it (make caller async-tolerant) or drop the block.

### L2. `updateItemInCache` never updates `itemCount` metadata; `addItemToCache` read-then-update increments race between members (non-transactional) — `itemCount` drifts. Cosmetic (only used for logging/metadata) but if ever used for limits it will be wrong.
**File:** `services/inventoryCacheService.ts:264-291, 332-360`

### L3. `setFlagTemporarily` 100ms auto-clear race
**File:** `services/syncStateService.ts:39-44, 62-66`
`setRemoteInventoryUpdate(true)` self-clears after 100ms regardless of whether the corresponding local effect has run; on slow devices the "this change came from remote" signal disappears before consumers check it, risking echo writes. Fix: clear the flag explicitly at the consumption site instead of on a timer.

### L4. Migration retry toast can run concurrently with an in-flight migration
**File:** `hooks/useHouseholdMigrationRetry.ts:37-43`
The persistent toast's "Retry now" action calls `migrateUserDataToHousehold` with no in-progress guard; a user can also trigger the original join-flow migration concurrently. Inventory/recipes are id-keyed (idempotent), but the meal-plan merge (`householdMigrationService.ts:70-81`) does read-merge-write of the whole plan and can interleave, resurrecting the user's just-cleared plan or dropping the other writer's days. Fix: module-level `inFlight` promise guard.

### L5. "Back online — changes synced." toast shown even when every op failed
**File:** `hooks/dataManagement/useInventory.ts:217-225`
`processQueueWithSync` resolves with failures folded into `progress`; the `.then` unconditionally reports success. Fix: inspect `result.failed/conflicts` before choosing toast text.

### L6. `useHouseholdMigrationRetry` leaves a stale checkpoint when the user leaves the household
**File:** `hooks/useHouseholdMigrationRetry.ts:19`
If `user.householdId` becomes null (left household) the effect early-returns without cleaning the checkpoint; rejoining a *different* household later removes it (mismatch branch), but rejoining the *same* household resurfaces a misleading "previous migration incomplete" toast that will then merge long-deleted personal data.

---

## Notes / non-findings
- `addItemsToCache` retries during migration are effectively idempotent for inventory/recipes because the cache doc is keyed by item id (duplicates collapse). Meal plan merge is date-deduped. Good.
- Listener lifecycles audited (`useInventory`, `useShoppingList`, `useMealPlan`, `useSavedRecipes`, `useHousehold`, `useAuth`, `useSubscription`, `notificationsService.listenToUserNotifications`): all return/collect unsubscribes correctly; `listenToUserNotifications` also clears its throttle timer. No leaks found.
- `useInventory` expiration-check throttle correctly avoids stamping on auth mismatch (early return before try/finally).
