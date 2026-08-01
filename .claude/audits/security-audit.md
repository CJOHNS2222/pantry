# Security Audit — Stock & Spoon
Date: 2026-07-31 | Auditor: security-auditor (defensive review) | Scope: firestore.rules, storage.rules, functions/, VITE_ env exposure, App Check, injection, auth persistence

Severity scale: CRITICAL / HIGH / MEDIUM / LOW

---

## HIGH

### H1. `checkInvitation` is callable unauthenticated and leaks full household documents
**File:** `functions/src/checkInvitation.ts:12-34, 81`
Auth is explicitly optional (`if (!request.auth) { /* allow */ }`, `enforceAppCheck: false`), and `userEmail` is attacker-supplied (takes precedence over the token email). On a match it returns `{ isInvited: true, household }` — the **entire household doc**: every member's name, email, uid, role, household name.
**Exploit:** Unauthenticated attacker who knows/guesses a householdId (they appear in invite links/actionData) iterates candidate emails → confirms which emails have pending invites and dumps all members' PII. No auth token, no App Check, no rate limit.
**Fix:** Require `request.auth`; derive email only from `request.auth.token.email` (never from `request.data`); return a boolean plus minimal fields (household name only); set `enforceAppCheck: true`.

### H2. `inviteMember` grants household access and overwrites custom claims before the invitee accepts
**File:** `functions/src/inviteMember.ts:141-159`
For a registered invitee the function immediately (a) appends their uid to `memberIds` and (b) calls `setCustomUserClaims(memberIdToStore, { householdId })` — with no consent from the invitee. `firestore.rules:47-56` grants full household read/write to anyone in `memberIds`.
**Exploit:** Any household member invites `victim@example.com`. The victim, without ever tapping Accept: (1) can read/write the inviter's household data (or, from the attacker's view, the attacker now shares data with an unwitting victim); (2) has any **existing** `householdId` custom claim clobbered — the claims object is replaced wholesale — silently attaching the victim to the attacker's household and breaking claim-dependent logic for their real household. It is also an unauthenticated-consent membership-forcing primitive (harassment/DoS).
**Fix:** Store invites as `status: 'pending'` only; add to `memberIds` and set claims exclusively in an explicit `acceptInvitation` callable invoked by the invitee. Never call `setCustomUserClaims` on a user who did not initiate the action; merge rather than replace claims.

### H3. `verifyPurchase` allows purchase-token replay across accounts (subscription sharing / RTDN hijack)
**File:** `functions/src/verifyPurchase.ts:117-139`
Verification with Play is done correctly (no client-trust fallback — good), but there is no check that `purchaseToken` isn't already bound to a **different** uid. `purchaseTokens/{token}` is overwritten with the latest caller's uid.
**Exploit:** User A buys premium, extracts the receipt JSON (trivially visible on a rooted device / via the plugin), shares it. User B calls `verifyPurchase` with the same receipt → B gets `tier: premium` written to `users/B`. Bonus damage: the token→uid map now points at B, so future RTDN renewals/cancellations update B and orphan A. One purchase funds N accounts.
**Fix:** In `verifyPurchase`, read `purchaseTokens/{token}` first; if it exists with a different uid, reject (`already-exists`). Also pass `obfuscatedExternalAccountId` (set to the Firebase uid at purchase time in `purchaseService.ts`) and compare it to `request.auth.uid`, and call `purchases.subscriptions.acknowledge` server-side.

### H4. Third-party API credentials shipped in the client bundle
**Files:** `services/groceryCheckoutService.ts:649-650` (`VITE_IMPACT_ACCOUNT_SID` / `VITE_IMPACT_AUTH_TOKEN`), `services/geminiService.ts:28` (`VITE_GEMINI_API_KEY`), `services/imageService.ts:4-5` (`VITE_GOOGLE_CSE_API_KEY`), `vite-env.d.ts:12` (`VITE_SPOONACULAR_API_KEY`), `services/emailService.ts:11-13` (EmailJS), plus `VITE_USDA_API_KEY`, OpenRouter key.
Every `VITE_`-prefixed var is inlined into the public JS bundle. The **Impact auth token is an account API credential** (Basic-auth secret, not a publishable key) — anyone can extract it from the APK/site and query/manipulate the affiliate account. Gemini/CSE/Spoonacular/USDA keys are quota-bearing: extraction → quota exhaustion and billing abuse.
**Exploit:** `curl` the deployed bundle (or unzip the APK), grep for the tokens, use them directly against api.impact.com / generativelanguage.googleapis.com.
**Fix:** Move Impact and Gemini/OpenRouter calls behind Cloud Functions (secrets via `defineSecret`). For keys that must stay client-side (Firebase apiKey is fine by design), restrict by HTTP referrer / Android package + SHA-1 in Google Cloud Console and enforce App Check. Rotate the Impact token now — treat it as compromised.

---

## MEDIUM

### M1. Any household member can rewrite `memberIds`, `members`, `ownerId` arbitrarily
**File:** `firestore.rules:48`
`allow update: if request.auth.uid in resource.data.memberIds` with zero field validation.
**Exploit:** A non-admin member (or an H2-style never-accepted invitee) adds arbitrary uids to `memberIds` (instant data access for outsiders), removes other members (lockout), self-promotes `role: 'admin'` in `members` (defeating `leaveHousehold`'s admin check at `functions/src/leaveHousehold.ts:56` and `removeHouseholdMember`'s check at `functions/src/removeHouseholdMember.ts:85`, both of which trust that array), or flips `ownerId`. Member-count tier caps are also unenforceable here.
**Fix:** In rules, on update require `request.resource.data.ownerId == resource.data.ownerId`, restrict `memberIds`/`members` mutation to remove-self-only (`memberIds.toSet().difference(...)`) and cap `memberIds.size()`; route all other membership mutation through Cloud Functions (which already exist).

### M2. Globally-shared cache docs are writable by any authenticated user (data poisoning)
**Files:** `firestore.rules:294-302` (`system/community_rated_recipes`), `firestore.rules:254-266` (`price_cache/priceData`), `firestore.rules:273-289` (`leaderboard_cache/global` — key ownership enforced but entry **values** unvalidated), `firestore.rules:239-248` (`image_cache` — arbitrary `url` string, no https/host allowlist).
**Exploit:** Any free-tier account overwrites the community recipes doc with spam/offensive content served to every user; poisons global price data; writes an absurd leaderboard score or an entry containing markup/oversized payloads; plants an `image_cache` URL pointing to malicious/inappropriate content that all clients render.
**Fix:** Make `system/*` and `price_cache` admin/function-write-only (write via scheduled/callable functions), validate leaderboard entry shape (`score is number`, name size caps), require `url.matches('https://firebasestorage.googleapis.com/.*')` (or your CDN) in `image_cache`.

### M3. Email→uid enumeration via `inviteMember` response
**File:** `functions/src/inviteMember.ts:98-107, 204`
`getUserByEmail` result (uid, displayName, canonical email) is embedded in `newMember` and returned to the caller. Cooldown is per household+email, so an attacker rotating their own throwaway households bypasses it.
**Exploit:** Authenticated attacker probes arbitrary emails → learns which are registered app users, their uid and display name (PII, phishing prep).
**Fix:** Return only `{ success: true }`; make the cooldown global per caller (per-uid rate limit); don't reflect resolved account data.

### M4. App Check effectively absent
**Files:** `firebaseConfig.ts:40-51`, `functions/src/checkInvitation.ts:15`, all other functions.
App Check initializes only on web, only when `VITE_RECAPTCHA_SITE_KEY` is set, never in dev; **no Play Integrity provider on Android** (the primary platform). No callable sets `enforceAppCheck: true` (the one mention sets it `false`), so even where tokens exist nothing verifies them.
**Impact:** Every callable (`verifyPurchase`, `deleteAccount`, invites) and Firestore/Storage are reachable from arbitrary scripts with a stolen/anon auth token — amplifies H1/H3/M2 and quota-burn attacks.
**Fix:** Add `@capacitor-firebase/app-check` with Play Integrity on Android; set `enforceAppCheck: true` on all callables; enable enforcement for Firestore/Storage once metrics show real traffic passing.

### M5. HTTP fallback endpoints leak internals and take mutating params from query strings
**Files:** `functions/src/inviteMember.ts:245-252`, `functions/src/leaveHousehold.ts:188, 317-320`
Both `onRequest` wrappers accept `req.query` for mutations (GET with side effects → params in access logs, cacheable, link-clickable) and return raw `err?.message` on 500 (internal path/config disclosure, e.g. Firestore errors).
**Fix:** Require POST + JSON body only; map errors to generic messages; ideally delete these wrappers now that callables work (each is a full duplicate implementation that can drift — `leaveHouseholdHttp` already drifted: role check `'Admin'` at line 223 vs `'admin'` at line 56, so the admin-leave guard silently never fires on the HTTP path).

---

## LOW

### L1. Recipe doc `userId` not immutable on update
**File:** `firestore.rules:182-186`
Owner check reads `resource.data.userId` but nothing pins `request.resource.data.userId`, so an owner can reassign a recipe to another uid (attribution spoofing; the new "owner" then controls it).
**Fix:** Add `request.resource.data.userId == resource.data.userId` to the update rule.

### L2. `recipes/submissions` path shadowing
**File:** `firestore.rules:157, 192`
`recipes/submissions/{submissionId}` is a subcollection under document `recipes/submissions`; that parent doc id also matches `/recipes/{recipeId}`, and rules `keys().hasAll([...])` checks don't use `hasOnly`, so extra unvalidated fields ride along on creates throughout the ruleset.
**Fix:** Move submissions to a top-level `recipeSubmissions` collection; consider `hasOnly` allowlists on create rules.

### L3. Public-read Storage paths
**File:** `storage.rules:6, 19`
`recipes/{recipeId}` and `recipe-photos/**` are `allow read: if true` — user-uploaded photos are world-readable by URL guess. Accepted trade-off for shared recipe images, but user rating photos may contain personal content (kitchens, faces).
**Fix:** If acceptable, document it; otherwise require auth for `recipe-photos` reads.

### L4. `setPersistence` race and notification-string injection surface
**Files:** `firebaseConfig.ts:84-90` — `setPersistence` promise unawaited; a sign-in racing init can land in default persistence for one session (minor). Platform split (browserLocal on web, indexedDB native) is otherwise sound.
`functions/src/inviteMember.ts:170` — `inviterName`/`householdName` come from the member-editable household doc (see M1) and are interpolated into notification messages written into the victim's `users/{uid}/cache/notifications`. React's default escaping mitigates XSS today; cap lengths server-side and sanitize before any push-notification or email rendering.

### L5. Feedback docs undeletable growth / notifications field freedom
**File:** `firestore.rules:100-123`
`feedback` create allows arbitrary extra fields (`hasAny(['message'])` only). `notifications` update lets the recipient rewrite any field including `actionData.householdId` — combine with a naive "join household from notification" client flow and a user can only footgun themselves, but validate `actionData` on the accept path server-side (ties into H2's `acceptInvitation` fix).

---

## What's done well (keep)
- `verifyPurchase` refuses to trust the client on Play API failure (no fallback grant) and validates receipt shape defensively.
- Default-deny final rule in `firestore.rules:319`; per-user `users/{uid}/**` and household-subcollection membership `get()` checks are correct.
- `deleteAccount` server-side checkpoint (`accountDeletions`) + scheduled retry avoids orphaned auth records; deletes via Admin SDK with caller-uid scoping only.
- RTDN handler re-verifies with Play instead of trusting notification type; immediate downgrade on REVOKED/EXPIRED.
- Storage `uploader` metadata ownership checks on write/delete; size and content-type caps.
- CORS allowlists on HTTP wrappers are explicit, no wildcard, no credentials.

## Priority fix order
1. H1 checkInvitation (auth + minimal response) — smallest diff, biggest PII exposure.
2. H4 rotate Impact token, move Impact/Gemini behind functions, key-restrict the rest.
3. H2/M1 together: acceptInvitation flow + household update rule hardening (they compound).
4. H3 purchase-token uid binding + obfuscatedExternalAccountId.
5. M4 App Check (Play Integrity + enforceAppCheck) — force-multiplier for everything above.
