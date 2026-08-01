# Firestore / Database Audit — Stock & Spoon

Date: 2026-07-31
Auditor: db-auditor
Scope: query patterns vs `firestore.indexes.json`, cache-document 1MB risk, write batching, offline queue conflict handling, type-vs-cache field drift.
Method: oriented via `graphify query` (OfflineQueueService / cache services / query-site communities), then targeted source reads. Prior audit `.claude/audits/AUDIT_DB.md` reviewed; its index findings (#4) are now largely fixed in `firestore.indexes.json` — this report supersedes it for the areas re-checked.

---

## HIGH

### H1. Inventory cache serialization silently drops PantryItem fields — permanent data loss
`services/inventoryCacheService.ts:27-55` (`ITEM_FIELD_ORDER`, 27 entries) vs `types.ts` `PantryItem`.
The inventory cache document is now the *only* persistence for pantry items (`loadAndCacheInventory` at `inventoryCacheService.ts:212-215` returns `[]` — "No longer loading from collections"; all reads/writes in `hooks/dataManagement/useInventory.ts:290-594` go through the cache doc). But `pantryItemToArray()` omits these `PantryItem` fields entirely:
`expiryDate`, `consumptionHistory`, `tags`, `leftoverMeta`, `cooked_rice`, `freezerZone`, `freezerLabelPhotoUrl`, `freezerPortionCount`, `estimatedPrice`.
Any of these set in memory are lost on the next cache write and never survive a reload or reach other household members. `cooked_rice` and `leftoverMeta` are documented domain flags in CLAUDE.md.
**Fix:** add the missing fields to `ITEM_FIELD_ORDER` + both converters, bump `CACHE_VERSION` — but see H3 first (a version bump currently wipes data).

### H2. Reservations lossily collapsed to one entry with zeroed quantity
`services/inventoryCacheService.ts:80-81` serializes only `reservations[0].recipeId/recipeName`; `arrayToPantryItem` at `:117` reconstructs a single reservation with `quantity: 0, unit: ''`. Multiple recipe reservations are dropped and the surviving one loses its reserved quantity — the FEFO/reservation feature cannot survive a round-trip through Firestore.
**Fix:** store `JSON.stringify(item.reservations || [])` as its own array slot (like `batches`), parse on read.

### H3. `CACHE_VERSION` bump on inventory = data wipe (no rebuild path)
`hooks/dataManagement/useInventory.ts:107-124` returns/sets `[]` when `data.version !== InventoryCacheService.CACHE_VERSION`, and `InventoryCacheService.refreshCache()`/`loadAndCacheInventory()` (`inventoryCacheService.ts:407-410, 212-215`) are stubbed to return `[]`. Since the cache doc is the sole store (H1), bumping the version — which CLAUDE.md instructs you to do on layout change — makes every user's inventory disappear with no migration.
Also inconsistent: `InventoryCacheService.getCachedInventory()` (`inventoryCacheService.ts:180-195`) never checks `version` at all, so the two read paths disagree on invalidation.
**Fix:** implement an in-place migration on version mismatch (read old array layout, convert, rewrite with new version) instead of discarding; never "invalidate" a cache that is actually the primary store.

### H4. `getUserHouseholds` query matches on whole member object — returns nothing
`services/householdService.ts:340-343`:
```ts
DatabaseMonitoringService.where('members', 'array-contains', { email: userEmail })
```
Firestore `array-contains` on a map requires *exact* equality of the entire map. `Household.members` entries carry more fields than `email` (name/role/etc.), so this query silently returns `[]` for every user. Contrast the working pattern at `householdService.ts:31-33` (`where('memberIds','array-contains', user.id)`).
**Fix:** query `memberIds` (or a `memberEmails` string array) instead.

### H5. `image_cache/global` — single shared unbounded Firestore doc (1MB cap + cross-user clobbering)
`services/imageCacheService.ts:389-390, 462-483`. One global document accumulates a field per distinct item name across *all* users forever (~200-300 bytes per `CachedImage` entry → cap hit around 3-5k entries). No server-side eviction (the LRU at `:23-53` is memory-only). Once it hits 1,048,576 bytes every write fails and image caching dies app-wide.
Worse, `cacheImagesFromUrls` (`imageCacheService.ts:463-483`) does read-full-doc → mutate → `setDoc` **without merge**, so two users batch-caching concurrently clobber each other's entries (the single-image path at `:390` correctly uses `{merge:true}`).
**Fix:** shard by key prefix (e.g. `image_cache/{firstLetter}` or hash buckets), use `setDoc(..., {merge:true})` or field-path `updateDoc` in the batch path, and add a size/entry cap with server-side pruning of oldest `lastUsed`.

---

## MEDIUM

### M1. Inventory cache doc 1MB risk — unbounded item count with embedded JSON blobs
`services/inventoryCacheService.ts:86-87` embeds `JSON.stringify(batches)` and `JSON.stringify(quantity)` per item into the single cache doc; item count is uncapped (free tier caps recipes, not pantry items). A household with many items × multi-batch histories can approach the 1MB doc limit; when exceeded, `setDoc` in `updateCache` fails and (per `:255-258`) the error is swallowed — the app keeps running against stale data with no user-visible signal. Same pattern for `recipesCacheService.ts` (bounded at 20 recipes premium — lower risk, but `image`/`imagePlaceholder` strings would blow it if ever a data URI) and `MealPlanCacheService`.
**Fix:** track serialized size in `updateCache`; when near ~900KB, shard the cache doc (e.g. `cache/inventory_0..n`) or at minimum surface the failure instead of logging silently.

### M2. Offline queue misclassifies permission errors as "conflicts" and never merges
`services/offlineQueueService.ts:210-214` — `isConflictError` treats `permission-denied` and `not-found` as conflicts, so a user who left a household (permission-denied forever) gets their failed writes parked in the conflict store awaiting "resolution" that can't succeed. `resolveConflict('merge')` at `:308-311` just re-enqueues the local op verbatim (comment admits "Would need merge logic here") — merge is a lie; it's last-writer-wins.
Additionally, on conflict the op stays in the queue (only removed on success, `:156`), so every subsequent `processQueueWithSync` re-detects it and calls `handleConflict` again — `store.add` with the same `conflict_${op.id}` key (`:221, 232`) rejects, and that rejection propagates as a failed op.
**Fix:** classify `permission-denied` as terminal failure (drop + notify), `not-found` as terminal for updates/deletes; remove the op from the queue when its conflict record is created; implement real field-level merge or remove the 'merge' option.

### M3. Offline queue conflict detection crashes on non-Timestamp `updatedAt`
`services/offlineQueueService.ts:196-199` calls `serverTimestampValue.toMillis()` unconditionally. Many docs in this codebase store ISO-string dates (CLAUDE.md: "Dates ISO strings") — a string/number `updatedAt` throws `toMillis is not a function`, which is *not* matched by `isConflictError`, so the op goes into retry (`handleRetry`) and dies after 3 attempts as a spurious failure.
**Fix:** normalize: `const ms = v?.toMillis?.() ?? (typeof v === 'string' ? Date.parse(v) : typeof v === 'number' ? v : NaN)`.

### M4. Offline queue `add` ops are not idempotent — duplicate documents on retry
`services/offlineQueueService.ts:187-188` replays `add` via `addDoc` (random ID). If the write succeeds server-side but the client errors/disconnects before `remove(op.id)` (`:156`), the retry creates a duplicate document. The queue already generates a stable op id (`:80`).
**Fix:** use `setDoc(doc(coll, deterministicId))` derived from the queued op id so replays are idempotent.

### M5. Read-modify-write races on shared cache docs (household concurrency)
`inventoryCacheService.ts:277-287` (`addItemToCache`: getDoc → compute `itemCount+1` → updateDoc), `:296-322` (`addItemsToCache`: getDoc → merge arrays in memory → full `setDoc` via `updateCache`), `:393-397` (`bulkUpdateInventoryCache`: full-doc `setDoc` overwrite). None use `runTransaction`/`increment()`. Two household members writing concurrently: single-item paths corrupt only `itemCount` (benign-ish), but `addItemsToCache`/`bulkUpdateInventoryCache` overwrite the *entire* doc from a stale in-memory snapshot — the other member's items added in the interim are deleted. `runTransaction` is already used elsewhere (`notificationsService.ts:61`, `recipeRatingService.ts:296`), so the pattern exists in-repo.
**Fix:** wrap read-modify-write cycles in `runTransaction`; use `increment(1)` for `itemCount`; make bulk updates field-level (`updateDoc` with per-item field paths + `deleteField()` for removals) instead of whole-doc `setDoc`.

### M6. `updateCommunityStats` still recomputes from unbounded full rating history per write
`services/recipeRatingService.ts:252-254` — `where('recipeTitle','==', title)` with no `limit()` on every rating submit, recomputing aggregates client-side. Carried over from prior audit (AUDIT_DB.md #5), still unfixed. Cost grows linearly with a recipe's popularity per single write.
**Fix:** transaction + `increment()` running aggregates (transaction machinery already present at `:296`).

### M7. Search still does full `recipe_search_index` scan + unbounded fallback scan
`services/recipeService.ts:1018` (full index-collection `getDocs`, filter client-side, then per-match `getDoc`s) and `:1087` fallback `getDocs` over the whole `recipes` collection with no `limit`. Carried over from prior audit (#2/#3), still present. Reads scale with catalog size on every search.
**Fix:** `searchTokens` array field + `array-contains` query, and `limit()` the fallback or fail closed.

---

## LOW

### L1. Dead composite index on `cache` collection group
`firestore.indexes.json` — index on `cache` (`is_leftover ASC, leftoverMeta.createdAt DESC, __name__ DESC`). Cache docs store items as *string arrays* keyed by item id; `is_leftover`/`leftoverMeta.createdAt` never exist as top-level document fields (and `leftoverMeta` isn't even serialized — see H1). No query in `services/` or `hooks/` uses `where('is_leftover', ...)`. The index costs write amplification on every cache write for nothing.
**Fix:** delete the index entry (`firebase deploy --only firestore:indexes` after removal).

### L2. Composite index coverage — currently OK, keep in sync
Verified live query shapes against `firestore.indexes.json`: `groceryPriceService.ts:545-549` & `:697-701` ↔ (`ingredient`,`lastUpdated DESC`) ✓; `recipeRatingService.ts:411-415` ↔ `recipeModifications` (`recipeTitle`,`helpful DESC`,`date DESC`) ✓; `:465-469` ↔ (`recipeTitle`,`householdId`,`date DESC`) ✓; `:498-501` ↔ (`userId`,`date DESC`) ✓; `:510-513` ↔ (`householdId`,`date DESC`) ✓; `recipeService.ts:947-950` ↔ (`wouldMakeAgain`,`date`) ✓. The prior audit's missing-index finding (#4) is resolved. Single-field queries (`notificationService.ts:537`, `recipeService.ts:270`) need no composite entries.

### L3. `getPendingCount` loads all queued ops to count them
`services/offlineQueueService.ts:269-272` — uses `getAll()` + `.length`; IndexedDB `store.count()` is O(1). Trivial today, but this is called for UI badges.

### L4. Inventory cache metadata keys can collide with item ids
`inventoryCacheService.ts:185-191` distinguishes items from metadata only by `Array.isArray(value)`; `recipesCacheService.ts:91` by hardcoded key names. A future scalar metadata field added to the inventory doc is silently skipped (fine), but an item whose id equals `lastUpdated`/`version`/`totalRecipes` in the recipes cache would be dropped. Prefer a nested `items: {}` map + `metadata: {}` on the next version migration.

---

## Summary of counts
- HIGH: 5 (field-drift data loss, reservation loss, version-bump wipe, broken household query, global image-cache doc)
- MEDIUM: 7 (1MB risk, 4 offline-queue defects, 2 carried-over N+1/scan issues)
- LOW: 4
