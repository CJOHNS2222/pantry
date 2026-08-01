# API Audit — Stock & Spoon

Date: 2026-07-31 | Auditor: api-tester (static analysis only; no live API calls)
Scope: `functions/src/*` callable/HTTP/pubsub contracts; third-party clients (`spoonacularRecipeClient`, `spoonacularFoodClient`, `nutritionService`, `currencyService`, `geminiService`, `openRouterService`).

Severity: CRITICAL / HIGH / MEDIUM / LOW / INFO

---

## Cloud Functions (functions/src)

### 1. [HIGH] `checkInvitation` leaks full household doc to unauthenticated callers with attacker-chosen email
`functions/src/checkInvitation.ts:20-35, 81`
Auth is explicitly optional ("Allow unauthenticated requests"), `enforceAppCheck: false`, and `userEmail` from request data **overrides** the auth token email. Anyone who knows/guesses a `householdId` and a pending invitee's email gets `{ isInvited: true, household: <entire doc> }` — member names, emails, ids. Also enables invite-status enumeration for arbitrary emails.
**Fix:** require `request.auth`; ignore client-supplied `userEmail` and use `request.auth.token.email` only (or verify it matches). Return a minimal shape (`{isInvited, householdName}`), never the raw doc.

### 2. [HIGH] `inviteMember` sets the invitee's `householdId` custom claim before they accept
`functions/src/inviteMember.ts:151-153`
Any member of any household can invite an arbitrary registered email; the function immediately overwrites that user's `householdId` custom claim (their only claim object — `setCustomUserClaims` replaces all claims). A malicious user can hijack/break another user's household binding (rules key off this claim) without any consent from the invitee.
**Fix:** set the claim only in the accept-invitation flow (after the invitee confirms), and never clobber the claim of a user who already belongs to another household.

### 3. [HIGH] `verifyPurchase` allows purchase-token replay across accounts
`functions/src/verifyPurchase.ts:117-139`
No check that the `purchaseToken` isn't already bound to a different uid. Two (or N) accounts can submit the same valid Google Play receipt; each gets the paid tier, and `purchaseTokens/{token}` is silently overwritten to the last caller — so RTDN downgrades only ever reach one of them.
**Fix:** before granting, read `purchaseTokens/{purchaseToken}`; if it exists with a different `uid`, reject (`failed-precondition`, "receipt already linked to another account") or run an explicit transfer flow. Wrap grant + token-mapping in a transaction.

### 4. [MEDIUM] `inviteMember` cooldown write happens before membership/existence checks
`functions/src/inviteMember.ts:55-60` (`assertNotInCooldown` called first)
Any authenticated user, member or not, can write `households/{anyId}/inviteCooldowns/{email}` docs — and thereby put a 5-minute (renewable indefinitely) cooldown on a household they don't belong to, blocking the real admin from inviting that email (targeted invite-DoS), plus unbounded junk-doc writes under arbitrary household paths.
**Fix:** verify household existence + caller membership first, then check/write the cooldown.

### 5. [MEDIUM] Callable/HTTP drift: admin role compared as `'admin'` vs `'Admin'`
`functions/src/leaveHousehold.ts:56` (callable, `'admin'`) vs `functions/src/leaveHousehold.ts:223` (HTTP, `'Admin'`)
The HTTP fallback's admin-leave guard compares against `'Admin'`; if roles are stored lowercase (as the callable and `removeHouseholdMember.ts:85` assume), the guard never fires — an admin can leave via the HTTP path while members remain, orphaning the household with no admin. The whole ~150-line body is copy-pasted; drift is guaranteed to recur.
**Fix:** normalize (`role?.toLowerCase() === 'admin'`) and extract a shared `leaveHouseholdCore()` like `inviteMemberCore`.

### 6. [MEDIUM] HTTP wrappers collapse every error to 500 and leak internal messages
`functions/src/inviteMember.ts:250-253`, `functions/src/leaveHousehold.ts:317-320`
`HttpsError`s thrown by the core (invalid-argument, permission-denied, resource-exhausted, not-found) all surface as `500 {error: err.message}`. Clients can't distinguish user error from server error; raw internal messages are returned to the caller.
**Fix:** map `HttpsError.code` → HTTP status (invalid-argument→400, unauthenticated→401, permission-denied→403, not-found→404, resource-exhausted→429), and return a generic message for real internals.

### 7. [MEDIUM] `getNutritionData` proxy hits the wrong USDA host with no API key — and is dead code anyway
`functions/src/nutrition.ts:29, 58`
URLs use `https://fdc.nal.usda.gov/api/foods/...` (the website's private API, wrong host, no `api_key`); the documented endpoint is `https://api.nal.usda.gov/fdc/v1/...` with `api_key`. Meanwhile the client (`services/nutritionService.ts:108,201`) calls `api.nal.usda.gov` directly with `VITE_USDA_API_KEY`, so this CORS proxy appears unused. Also: `pageSize` is never type-checked (`Math.min({}, 10)` → `pageSize=NaN` in the URL), `fdcId` is not range-checked, and the outbound `fetch` has no timeout/AbortController.
**Fix:** either delete the function or fix the host/version, add `defineSecret('USDA_API_KEY')`, validate `pageSize`/`fdcId` as bounded integers, and add an AbortController timeout — then route the client through it so the key leaves the bundle.

### 8. [MEDIUM] `verifyPurchase` internal error message forwards raw upstream `err.message` to the client
`functions/src/verifyPurchase.ts:108-113`
Google API client errors (IAM emails, project ids, endpoint details) are interpolated into the client-facing `HttpsError`. Same pattern in `removeHouseholdMember.ts:131` (`throw new HttpsError('internal', err.message ...)`).
**Fix:** log the detail server-side (already done), return a generic "Purchase verification failed, try again later."

### 9. [LOW] `deleteAccount` household cleanup uses plain `.delete()` and single 500-doc batch
`functions/src/deleteAccount.ts:53, 81-90`
- `householdRef.delete()` orphans `cache/*`, `presence/*`, `activity/*` subcollections — `leaveHousehold.ts:125` and `removeHouseholdMember.ts:122` deliberately use `db.recursiveDelete` for exactly this reason.
- Subcollection sweep does one `limit(500)` batch with no loop; >500 docs are silently left behind.
**Fix:** use `db.recursiveDelete(householdRef)` and `db.recursiveDelete(userRef)` (which also removes subcollections + the doc).

### 10. [LOW] `subscriptionNotifications` doesn't validate `packageName` and defaults unknown tier to `'premium'`
`functions/src/subscriptionNotifications.ts:101-130`
RTDN payload's `packageName` is never checked against `PACKAGE_NAME`; and on re-verify, `tier = currentSub?.tier ?? 'premium'` — if the user doc's subscription was cleared but the token mapping survives, a renewal event re-grants premium. Also `notificationType`/`purchaseToken` types are not validated before use as a doc id.
**Fix:** drop messages where `payload.packageName !== PACKAGE_NAME`; derive tier from `PRODUCT_TIER_MAP[subscriptionId]` instead of defaulting to premium; guard `typeof purchaseToken === 'string' && purchaseToken.length`.

### 11. [LOW] `resetUsageLimits` free-plan defaults drift from `IN_APP_DEFAULTS`
`functions/src/resetUsageLimits.ts:66-87`
Hardcoded defaults (searches 10/week, recipes max 50, mealPlanning 5/week, gemini 5) contradict the product's free-tier caps (2 saved recipes / 1 meal-plan search per week per CLAUDE.md and `services/remoteConfigService.ts` `IN_APP_DEFAULTS`). A brand-new `usage/limits` doc created by this job grants 25x the intended recipe cap until the client rewrites it. Also does 2 sequential Firestore ops per user (read then write) — the read is unnecessary since both branches `set(..., {merge:true})`-style write the same reset fields.
**Fix:** single `set(..., {merge: true})` without the pre-read; source limits from one shared constant (env/Remote Config) instead of a second hardcoded copy.

### 12. [INFO] `inviteMember` callable skips type validation present elsewhere
`functions/src/inviteMember.ts:210-212` — `householdId` only truthiness-checked (a non-string crashes `db.doc()` → opaque `internal`). Mirror `checkInvitation.ts:26`'s `typeof === 'string'` checks. `leaveHousehold.ts:18-23` same.

---

## Third-party API clients (services/)

### 13. [HIGH] Gemini rate-limit retry is dead code — transformed error message defeats the retry match
`services/geminiService.ts:273` vs `services/geminiService.ts:449-450`
`searchRecipes` retries only when `errMsg` contains `'429'`, `'Too Many Requests'`, or `'Resource exhausted'`. But `performSearch`'s own catch **re-wraps** the 429 as `new Error('API rate limit exceeded. Please wait a moment and try again.')` before it reaches the retry loop — none of the retry markers survive, so the backoff/retry never runs and every rate limit surfaces immediately to the user.
**Fix:** in `performSearch`, rethrow the original error (or attach a `code`/`cause` the retry loop checks: `err.cause?.message`), and match on a structured flag rather than message substrings.

### 14. [MEDIUM] `nutritionService` negative-result cache: comment says 7 days, code caches 90 days
`services/nutritionService.ts:182-186` vs `services/nutritionService.ts:21, 58-61`
"Cache the negative result for 7 days" — but the entry goes through the same `isCacheValid` 90-day TTL. A transient USDA outage or missing key poisons an item's nutrition lookup for 3 months. Related: `nutrition_cache` grows unbounded in localStorage (no entry cap/eviction), and the whole map is rewritten on every lookup.
**Fix:** store a `ttlMs` per entry (7d for `data: null`, 90d for hits) and check it in `isCacheValid`; cap entries (e.g. LRU 500).

### 15. [MEDIUM] `currencyService` in-session promise cache never honors the 24h TTL
`services/currencyService.ts:39, 82-85`
`ratesPromise` is memoized forever at module scope; the 24h localStorage TTL is only consulted inside `fetchRates`, which runs once per app session. Long-lived sessions (Capacitor app left open, PWA) keep stale rates indefinitely; a failed first fetch also pins the `{USD:1}` fallback for the whole session. Also no timeout on the `fetch`, and `data.rates` shape is not validated (a non-numeric rate would propagate NaN prices).
**Fix:** store `fetchedAt` alongside the promise and refetch when older than TTL (and clear `ratesPromise` on rejection); add AbortController timeout; validate `typeof rate === 'number' && isFinite(rate)`.

### 16. [MEDIUM] Spoonacular clients: no timeout, no rate limiting, quota errors indistinguishable from "not found"
`services/spoonacularRecipeClient.ts:57-67, 90-97, 116-122, 141-147`; `services/spoonacularFoodClient.ts:43-123`
Every method swallows errors and non-OK statuses to `null` — a 402 (daily quota exhausted) looks identical to "no results", so callers keep hammering a dead quota and users get silent empty results. No fetch timeout/AbortController anywhere, and despite CLAUDE.md describing this client as "cached + rate-limited", neither client contains caching or throttling (that lives, if anywhere, in callers). Generated-client calls (`spoonacularFoodClient.ts:47` positional 12-arg `ingredientSearch`) are `any`-typed and unverifiable.
**Fix:** distinguish at minimum `res.status === 402/401/429` (throw or return a typed error), add a shared `fetchWithTimeout` (10s), and add a module-level cooldown after quota errors.

### 17. [MEDIUM] `openRouterService` explicitly bypasses usage limits
`services/openRouterService.ts:109-111`
`_user` is accepted but unused — comment admits "not used for rate-limiting — this is a test/bypass path". With `VITE_GEMINI_DISABLED=true` this becomes the **production** AI path, so free-tier weekly AI caps (`UsageService.recordGeminiUsage`, enforced in the Gemini path at `geminiService.ts:116,222,422`) are never recorded or enforced.
**Fix:** call `UsageService.recordGeminiUsage(user)` on success and pre-check limits, mirroring geminiService.

### 18. [LOW] Client timeouts abandon, not abort, Gemini requests
`services/geminiService.ts:69-71, 174-176, 327-329`
`Promise.race` with a `setTimeout` rejection leaves the underlying `generateContent` request running (still billed, still consuming rate limit); the timer is also never cleared on success. openRouterService does this correctly with AbortController (`openRouterService.ts:132-133`).
**Fix:** use AbortController/`signal` if the SDK supports it, or at least clear the timer.

### 19. [LOW] API keys in URL query strings
`services/spoonacularRecipeClient.ts:56, 88, 115, 140`; `services/nutritionService.ts:108, 201`
`apiKey`/`api_key` as query params end up in browser history, extension logs, and any intermediary logging — on top of the already-known issue that these keys ship in the client bundle (see AUDIT_SECURITY.md #8). Spoonacular supports the `x-api-key` header; USDA supports `X-Api-Key`.
**Fix:** send keys via request headers; longer-term, proxy through Cloud Functions (see finding 7).

### 20. [LOW] `nutritionService` brand-strip fallback is a no-op
`services/nutritionService.ts:91`
`itemName.replace(/brand names/i, '')` literally removes the substring "brand names" — it never strips actual brands (Barilla etc.), so the third search fallback duplicates the first term (wasting one USDA call per miss).
**Fix:** drop the term or implement a real brand-word list.

### 21. [INFO] `parseNaturalLanguageRecipes` fabricates a placeholder "recipe" on total failure
`services/geminiService.ts:524-532`
Returning a fake recipe (`title: "Recipe Search Result"`) means `recipes.length > 0`, which then **records Gemini usage against the user's weekly quota** (`geminiService.ts:420-425`) for a failed search, and shows junk in the UI. Prefer returning `[]` and letting the caller show an error (openRouterService throws instead — the better contract).

---

## Summary counts
- HIGH: 4 (checkInvitation data leak, invite-time claim overwrite, purchase-token replay, dead Gemini retry)
- MEDIUM: 8
- LOW: 6
- INFO: 3

## Top 5 fixes by impact/effort
1. Require auth + strip `userEmail` override in `checkInvitation` (small diff, closes a data leak).
2. Bind purchase tokens to first uid in `verifyPurchase` (transaction + one read).
3. Move custom-claim set from invite-time to accept-time.
4. Rethrow original error (or `cause`) in `performSearch` so the 429 retry loop actually runs.
5. Per-entry TTL in nutrition cache + TTL-aware `ratesPromise` in currencyService.
