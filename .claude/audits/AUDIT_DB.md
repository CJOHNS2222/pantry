---
agent: db-auditor
status: fail
findings: 7
---

## Summary

Reviewed Firestore read/query patterns across `services/recipeService.ts`, `services/recipeRatingService.ts`, `services/groceryPriceService.ts`, `services/householdActivityService.ts`, `services/databaseMonitoringService.ts`, and `firestore.indexes.json`. The pantry/shopping/meal-plan/inventory cache-service layer (per `CLAUDE.md`) is well-designed and avoids per-item reads. The recipe rating/community/search subsystem, however, has several serious N+1 and full-collection-scan patterns, plus composite indexes that are missing or point at a collection name nothing in the codebase actually queries.

## Findings

### 1. [HIGH] N+1 + repeated full collection scan inside loop — `services/recipeService.ts:301-343` (`rebuildCommunityRatedRecipesFromRatings`)
For each of up to `topN` (default 50) aggregated recipe titles, the loop does a sequential `await` per item: one `getDoc` for the recipe-by-id, and — whenever that misses — a **second `getDocs` of the entire `recipes` collection** (`DatabaseMonitoringService.getDocs(DatabaseMonitoringService.collection('recipes'))`, line 318) just to `.find()` by title, plus a third `getDoc` for `recipeCommunityStats/{title}` (line 338). Worst case this is `O(topN * |recipes collection|)` reads for one rebuild run, entirely sequential (no `Promise.all`). This function is intended to run periodically (per its docstring, from an admin script/Cloud Function) but as written its cost scales multiplicatively with both the number of trending titles and total recipe count.
Remediation: batch-fetch recipes once via a single `where('title','in',[...])`-chunked query (or maintain a title→id index), and parallelize the per-item stats/recipe lookups with `Promise.all`.

### 2. [HIGH] Unbounded full-collection scan on every search-index failure — `services/recipeService.ts:1034-1056` (`searchRecipesInFirestoreFallback`)
Called from the `catch` block of `searchRecipesInFirestore` (line 1027) whenever the primary search-index path throws for any reason. It runs `DatabaseMonitoringService.getDocs(recipesRef)` with **no `where`/`limit`**, pulling every document in `recipes` into memory and filtering client-side. As the recipe catalog grows this becomes an increasingly expensive read (billed per document) triggered by any transient error in the primary path, not just a genuine fallback case.
Remediation: cap with `limit()`, or fail closed (return `[]`/cached results) rather than falling back to an unbounded scan; if fallback search is required, back it by a bounded/paginated query or the existing search index doc instead of the raw `recipes` collection.

### 3. [HIGH] Full collection read + per-match N single-doc reads on every search — `services/recipeService.ts:962-1022` (`searchRecipesInFirestore`)
Every call does `getDocs` over the **entire** `recipe_search_index` collection with no `where`/`limit` filter (line 978), filters in memory, then issues one `getDoc` per matching id via `Promise.all` (lines 1003-1007). Total Firestore reads per search = `|recipe_search_index|` (always) + `N` (matches). This is a full scan on every keystroke/search call, not just a rare fallback, and read cost grows linearly with catalog size regardless of how selective the search term is.
Remediation: move filtering server-side (Firestore array-contains/prefix queries on a `keywords`/`searchTokens` field, or a proper search service like Algolia/Typesense as the code comment already suggests) so only matching docs are read.

### 4. [MEDIUM] `firestore.indexes.json` missing composite indexes for live queries; existing `ratings` index doesn't match any real collection name
`firestore.indexes.json` only declares indexes for `groceryPrices`, `priceHistory`, `notifications`, `ratings`, and `cache` (collection groups). But every rating query in the codebase uses collection name `recipeRatings` (`RecipeRatingService.RATINGS_COLLECTION`, `services/recipeRatingService.ts:34`) — there is no collection literally named `ratings` anywhere queried, so that index entry is dead. Meanwhile these composite queries against `recipeRatings`/`recipeModifications` have no matching index declared:
- `getHouseholdRatings`: `where(recipeTitle==) + where(householdId==) + orderBy(date desc)` — `services/recipeRatingService.ts:378-384`
- `getPersonalizedRecommendations`: `where(userId==) + orderBy(date desc)` and `where(householdId==) + orderBy(date desc)` — `services/recipeRatingService.ts:411-427`
- `getTopModifications`: `where(recipeTitle==) + orderBy(helpful desc) + orderBy(date desc)` on `recipeModifications` — `services/recipeRatingService.ts:324-330`
- `rebuildCachedPopularRecipesFromRatings`: `where(date>) + where(wouldMakeAgain==)` on `recipeRatings` — `services/recipeService.ts:914-918`
None of these are covered by `firestore.indexes.json`. In production (unlike the dev emulator, which auto-suggests but doesn't build indexes) these will throw `FAILED_PRECONDITION: The query requires an index` the first time they run without a manually-created index, and there's nothing in the deploy pipeline (`firebase deploy --only firestore:indexes`) that would create them since they're absent from the file.
Remediation: add composite index definitions for all four query shapes above; remove/rename the stale `ratings` entry to `recipeRatings` matching what's actually queried, or delete it if genuinely unused.

### 5. [MEDIUM] Unbounded full-recipe-history scan on every single rating write — `services/recipeRatingService.ts:226-271` (`updateCommunityStats`)
Runs on every `submitRating` call (line 60/71) and does `where('recipeTitle','==',recipeTitle)` with **no `limit()`** against `recipeRatings`, pulling every historical rating for that recipe to recompute `totalRatings`/`averageRating`/`topFeedback` from scratch client-side. For a popular recipe with thousands of ratings, one new rating triggers a full re-read of the entire rating history — read cost (and latency) grows unboundedly with popularity instead of staying O(1).
Remediation: switch to Firestore `increment()`/transaction-based incremental aggregate updates (running sum + count, updated atomically per new rating) instead of recomputing from a full collection read each time.

### 6. [MEDIUM] Sequential per-item queries inside a loop — `services/recipeRatingService.ts:455-487` (`getPersonalizedRecommendations`)
Inside the `for (const [recipeTitle, count] of sortedLoved)` loop (max 2 iterations, but structurally an N+1 pattern), when a recipe isn't in the in-memory cache it does an `await DatabaseMonitoringService.getDocs(...)` per iteration serially rather than batching/parallelizing. Minor at today's `slice(0, 2)` cap, but the pattern will silently regress into a real N+1 if that cap is ever raised, and needlessly serializes network round-trips that could run concurrently via `Promise.all`.
Remediation: collect the missing titles first, fetch them concurrently with `Promise.all`, or better, batch via `where('title','in', missingTitles)`.

### 7. [LOW] `getCommunityStats` re-reads all household ratings with no limit — `services/recipeRatingService.ts:179-184`
When `householdId` is passed, queries all `recipeRatings` matching `recipeTitle + householdId` with no `limit()` to compute household-specific average/would-make-again%. Lower severity than #5 since household size bounds the fan-out somewhat, but still unbounded per-recipe-per-household growth over time.
Remediation: add a reasonable `limit()` (e.g. last 100) or move to the same incremental-counter approach as #5.

## Metrics

- Firestore-touching service files reviewed: `recipeService.ts`, `recipeRatingService.ts`, `groceryPriceService.ts`, `householdActivityService.ts`, `databaseMonitoringService.ts`, `inventoryCacheService.ts` (spot-checked), `firestore.indexes.json`
- Full-collection-scan call sites found: 3 (`recipeService.ts:318`, `:978`, `:1037`)
- Composite-query call sites lacking a matching declared index: 4
- Declared indexes total: 5 (`groceryPrices`, `priceHistory`, `notifications`, `ratings`, `cache`); 1 of 5 (`ratings`) matches no collection name actually queried in the codebase
- `groceryPriceService.getIngredientPrice`/`getPriceTrends` (services/groceryPriceService.ts:534-641, 686+) are correctly indexed (`ingredient` + `lastUpdated`) and not flagged
