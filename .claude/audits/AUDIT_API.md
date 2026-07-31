---
agent: api-tester
status: fail
findings: 11
---

# API / Cloud Functions Audit — Stock & Spoon

## Summary
Audited all 14 exported Firebase Cloud Functions in `functions/src/` (callable, HTTP, scheduled, Pub/Sub, and Firestore-trigger). Most functions have solid auth/validation on the "happy path," but there are several serious contract gaps: an unauthenticated, unrestricted claims-migration endpoint that can rewrite every user's auth claims; a fully open (unauthenticated) USDA proxy that anyone can hammer for free API usage; permissive CORS (`Access-Control-Allow-Origin` reflects request origin + `Allow-Credentials: true`) on multiple HTTP fallback endpoints; a household-invite-status endpoint that intentionally allows unauthenticated calls and is not rate-limited; and dead duplicate `leaveHousehold`/`leaveHouseholdHttp` implementations shadowed in `inviteMember.ts` that are not exported but will confuse future maintainers (and diverge in behavior — role check uses `'admin'` in one copy vs `'Admin'` in the other).

## Findings

### 1. [CRITICAL] `migrateHouseholdClaims` / `migrateHouseholdClaimsHttp` — no authorization, mutates every user's auth claims
`functions/src/migrateHouseholdClaims.ts:56-70` (callable) and `:73-96` (HTTP)
The callable only checks `request.auth` is present — **any authenticated user** can trigger a full scan of every household and overwrite `setCustomUserClaims` for every member of every household. The HTTP version (`migrateHouseholdClaimsHttp`) has **no authentication check at all** — it's a public POST endpoint that iterates all households/users and mutates auth claims. Comments in the code explicitly flag this ("you should restrict this in production") but it was never fixed. This is a live admin-only migration tool exposed as an open/low-bar endpoint — an attacker (or a stray bot hitting the URL) can trigger it repeatedly, and any authenticated non-admin user can invoke the callable to force claim churn across the whole user base.
**Remediation**: Require a custom admin claim (e.g. `request.auth.token.admin === true`) before running; remove or auth-gate `migrateHouseholdClaimsHttp` entirely (this looks like a one-time migration script that should not still be deployed as a public function).

### 2. [HIGH] `getNutritionData` — no authentication, unrestricted proxy
`functions/src/nutrition.ts:14`
`onCall` handler has zero `request.auth` check. Anyone with the callable's URL/project config (which is not secret — it's shipped in the client bundle) can invoke this function to proxy arbitrary search/detail calls to the USDA FoodData Central API at the project's expense, with no per-user rate limiting. Combined with no App Check enforcement, this is an open relay that can be scripted for cost/quota abuse.
**Remediation**: Add `if (!request.auth) throw new HttpsError('unauthenticated', ...)`, and consider App Check + per-user usage tracking mirroring `usageService.ts`.

### 3. [HIGH] Permissive CORS on HTTP fallback endpoints — reflects any origin + allows credentials
`functions/src/inviteMember.ts:173-175`, `functions/src/leaveHousehold.ts:157-159` (and the dead-code duplicate at `functions/src/inviteMember.ts:200-465`)
```
res.set('Access-Control-Allow-Origin', req.get('origin') || '*');
res.set('Access-Control-Allow-Credentials', 'true');
```
Reflecting the request's `Origin` header verbatim while also setting `Allow-Credentials: true` effectively disables the same-origin protection CORS is meant to provide for credentialed requests — any website can issue a fetch with `credentials: 'include'`/a bearer token obtained via other means and the browser will honor the response as if it were an allowed origin. In practice these endpoints require a bearer ID token in the `Authorization` header (not cookies), so the credential-theft blast radius is smaller than classic cookie-based CORS misconfig, but it's still an unnecessary and incorrect CORS contract — the allow-list should be an explicit set of known origins.
**Remediation**: Whitelist known origins (web app domain, capacitor scheme) instead of reflecting `req.get('origin')`; drop `Allow-Credentials: true` if not actually needed (these use bearer tokens, not cookies).

### 4. [MEDIUM] `checkInvitation` — intentionally unauthenticated, allows household-membership enumeration
`functions/src/checkInvitation.ts:16-20`
```
if (!request.auth) {
  // Allow unauthenticated requests for email-based invite checks
}
```
No auth is enforced (comment explicitly documents this as intentional), and there's no rate limiting on `enforceAppCheck: false`. Given a guessed/leaked `householdId` (Firestore auto-IDs, but still enumerable if leaked via logs/share links) and a guessed `userEmail`, an anonymous caller can probe whether that email has a pending invite to that household, and on a hit gets back the **entire household document** (`household: isInvited ? household : null`) including all members' names/emails/ids. This is a low-severity but real information-disclosure surface with no throttling.
**Remediation**: At minimum rate-limit by IP/App Check token; consider trimming the returned `household` object to only what the client needs (household name + inviter name) rather than the full members array with everyone's PII.

### 5. [MEDIUM] `inviteMemberHttp` / `leaveHouseholdHttp` accept ID token via query string
`functions/src/inviteMember.ts:182`, `functions/src/leaveHousehold.ts:167`
```
const idToken = ... : (typeof req.query?.idToken === 'string' ? req.query.idToken : undefined);
```
Falling back to a query-string `idToken` means the bearer credential can end up in server access logs, browser history, and Referer headers. This is a "dev fallback" per the comment, but it's shipped in production functions.
**Remediation**: Drop the query-string fallback in production, or gate it behind an explicit dev-only flag.

### 6. [MEDIUM] Dead duplicate `leaveHousehold`/`leaveHouseholdHttp` in `inviteMember.ts` diverge from the real exported implementation
`functions/src/inviteMember.ts:201-465` defines its own `leaveHousehold`/`leaveHouseholdHttp` (not exported by `index.ts` — the real ones come from `functions/src/leaveHousehold.ts`), but:
- It never sets/clears the `householdId` custom auth claim on leave (the real `leaveHousehold.ts` does).
- Its "last member" disband logic copies data to `users/{uid}` collections directly rather than to the `cache/*` documents the real version and `removeHouseholdMember.ts` use — inconsistent with the cache-service architecture described in CLAUDE.md.
- The callable checks `role === 'admin'` while its own HTTP twin checks `role === 'Admin'` (line 210) — a casing bug that would make the two code paths behave differently if either were ever wired up.
Since neither is currently exported this isn't live-exploitable, but it's ~270 lines of stale, diverging duplicate contract code sitting in a file whose name suggests it only handles invites — high risk of someone re-exporting the wrong one later.
**Remediation**: Delete the dead code from `inviteMember.ts`; keep `leaveHousehold.ts` as the single source of truth.

### 7. [LOW] `verifyPurchase` trusts client-supplied `productId`/receipt shape without schema validation
`functions/src/verifyPurchase.ts:41-52`
`receipt.transactions?.[0]` and nested fields are read with optional chaining but no shape/type validation beyond truthiness checks on the two extracted strings. A malformed or crafted `receipt` object with unexpected nesting won't crash (good), but there's no validation that `productId` is a `PRODUCT_TIER_MAP` key sourced from the actual receipt (it is checked against the map at line 54, which mitigates most abuse) — low severity, flagging for completeness since this endpoint gates paid-tier access.
**Remediation**: Add a minimal runtime schema check (e.g. zod) on the `receipt` shape for defense-in-depth and clearer error messages.

### 8. [LOW] `resetUsageLimitsNow` — disabled endpoint still deployed and publicly reachable
`functions/src/resetUsageLimits.ts:113-123`
Handler unconditionally returns 403 "Manual reset disabled" — functionally inert, but still deployed as a public `onRequest` with `cors: true` and no auth check, so it's attack surface (DoS/cost) for zero functional benefit.
**Remediation**: Remove the function from `index.ts`/deployment entirely rather than keeping a stub online.

### 9. [LOW] `deleteAccount` — incomplete cleanup list vs. actual cache footprint
`functions/src/deleteAccount.ts:60`
`subcollections = ['cache', 'usage', 'pantryCache', 'shoppingCache', 'mealPlanCache', 'savedRecipes']` is hard-coded and doesn't match the cache doc names used elsewhere (`services/*CacheService.ts` write to `users/{uid}/cache/{inventory|shoppingList|mealPlan|savedRecipes|notifications}` as a single doc per domain under the `cache` subcollection, which IS covered by wiping `cache` wholesale — but `pantryCache`/`shoppingCache`/`mealPlanCache` as separate top-level subcollections don't appear to be referenced by any cache service found in this audit pass, suggesting either stale/legacy names being cleaned defensively, or real collections this list is missing). Also does not clear the `householdId` custom auth claim before/after deleting the Auth user (moot since the account is deleted, but if `auth.deleteUser` fails after Firestore cleanup already ran, the user is left in a half-deleted state with a stale claim and no retry mechanism, unlike the household-migration flow which has `useHouseholdMigrationRetry.ts`).
**Remediation**: Verify subcollection name list against current `*CacheService.ts` `getHouseholdOrUserCachePath()` outputs; add an idempotent retry/checkpoint for the multi-step delete similar to the household migration checkpoint pattern.

### 10. [LOW] `inviteMember` — no duplicate-invite throttling, no email format validation
`functions/src/inviteMember.ts:16,166`
`email` is only checked for truthiness (`!email`), no format validation. A member can be invited repeatedly (the code does dedupe by `id` in the members array itself, so re-invite becomes a no-op for the household doc), but each call still writes a fresh notification into the invitee's cache and unconditionally calls `auth.getUserByEmail` — no cooldown, so a household member could spam an invitee with notifications by calling the endpoint in a loop.
**Remediation**: Basic email regex validation; dedupe/cooldown check against `status: 'pending'` before creating another notification.

### 11. [LOW] Scheduled functions (`resetWeeklyUsageLimits`, `sendDailyReminders`) do full unbounded `db.collection('users').get()` scans
`functions/src/resetUsageLimits.ts:22-23`, `functions/src/dailyReminders.ts:299`
Both load the entire `users` collection into memory in one `.get()` with no pagination/batching. Not an "endpoint contract" bug per se, but as the user base grows this is the kind of unbounded read that will eventually hit function memory/timeout limits — `sendDailyReminders` at least sets `timeoutSeconds: 540, memory: '512MiB'` defensively, `resetWeeklyUsageLimits` has no memory override. Flagging here since perf-auditor may not cover Cloud Functions specifically.
**Remediation**: Paginate with `.startAfter()`/cursor batches once user count grows past a few thousand.

## Metrics
- Cloud Functions inspected: 14 exported (`functions/src/index.ts`) + 2 unexported dead-code duplicates in `inviteMember.ts`
- Callable (`onCall`) functions: `inviteMember`, `leaveHousehold`, `removeHouseholdMember`, `checkInvitation`, `migrateHouseholdClaims`, `getNutritionData`, `verifyPurchase`, `deleteAccount`
- HTTP (`onRequest`) functions: `inviteMemberHttp`, `leaveHouseholdHttp`, `migrateHouseholdClaimsHttp`, `resetUsageLimitsNow`
- Scheduled (`onSchedule`): `resetWeeklyUsageLimits`, `sendDailyReminders`
- Trigger-based: `handlePlaySubscriptionNotification` (Pub/Sub), `sendPushNotificationOnWrite` (Firestore onWrite)
- Functions missing an authentication check entirely: 2 (`getNutritionData`, `migrateHouseholdClaimsHttp`) + 1 intentionally public (`checkInvitation`)
- Functions with authorization present but not scoped to admin/privileged role where it should be: 1 (`migrateHouseholdClaims` callable)
- Duplicate/dead endpoint implementations found: 2 (`leaveHousehold`/`leaveHouseholdHttp` shadow copies in `inviteMember.ts`)
