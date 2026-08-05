---
agent: fix-planner
status: complete
date: 2026-07-31
sources: code-audit, bug-audit, security-audit, ui-audit, perf-audit, db-audit, dep-audit, doc-audit, infra-audit, seo-audit, api-audit (all 2026-07-31 pass)
findings: 58
p0: 12
p1: 18
p2: 16
p3: 12
completion:
  shipped: 2026-08-01
  commits: 65850eb (F01-F58 full pass), 7fbd0dc (P2 batch), be61eed (P3 batch)
  deferred: F32 (Spoonacular TTL), F33 (i18n hardcoding)
---
# FIXES.md — Consolidated Fix Plan (2026-07-31 audit pass)

**Status: COMPLETE** — Shipped in commits 65850eb/7fbd0dc/be61eed (2026-08-01). F32 + F33 deferred per audit notes.

Supersedes 2026-07-30 FIXES.md. Cross-audit duplicates merged; each entry lists every sourcing audit. Effort: S (<1h), M (half-day), L (multi-day).

---

## P0 — Data loss / security / payment integrity

### F01. `checkInvitation` unauthenticated household-doc PII leak — **S**
- **Problem:** Callable allows unauth requests, trusts attacker-supplied `userEmail` over token, returns entire household doc (all members' names/emails/uids).
- **Files:** `functions/src/checkInvitation.ts:12-35,81`
- **Fix:** Require `request.auth`; use only `request.auth.token.email`; return `{isInvited, householdName}` minimal shape; `enforceAppCheck: true`.
- **Sources:** security H1, api 1

### F02. `verifyPurchase` purchase-token replay across accounts — **S**
- **Problem:** Same Play receipt grants premium to N accounts; `purchaseTokens/{token}` overwritten to last caller, RTDN renewals/cancellations hit wrong uid.
- **Files:** `functions/src/verifyPurchase.ts:117-139`, `services/purchaseService.ts` (set `obfuscatedExternalAccountId`)
- **Fix:** In transaction, read `purchaseTokens/{token}`; reject `already-exists` if bound to different uid. Pass/compare `obfuscatedExternalAccountId` = Firebase uid; acknowledge server-side.
- **Sources:** security H3, api 3

### F03. `inviteMember` grants membership + clobbers custom claims before invitee accepts — **M**
- **Problem:** Invitee's uid added to `memberIds` and `setCustomUserClaims` wholesale-replaces their claims at invite time — consentless membership forcing, hijacks victim's real household binding.
- **Files:** `functions/src/inviteMember.ts:141-159`; new `functions/src/acceptInvitation.ts`; client accept flow
- **Fix:** Invites stay `status:'pending'`; add to `memberIds` + set claims only in new `acceptInvitation` callable invoked by invitee; merge (never replace) claims; validate `actionData` server-side on accept (closes security L5 footgun too).
- **Depends:** none, but F10 (rules hardening) should land with/after it — compound.
- **Sources:** security H2, api 2

### F04. Secret API credentials shipped in client bundle (Impact token et al.) — **M**
- **Problem:** `VITE_IMPACT_AUTH_TOKEN` = Basic-auth account secret inlined into public bundle/APK; Gemini/CSE/Spoonacular/USDA/OpenRouter keys extractable for quota/billing abuse.
- **Files:** `services/groceryCheckoutService.ts:649-650`, `services/geminiService.ts:28`, `services/imageService.ts:4-5`, `services/emailService.ts:11-13`, `vite-env.d.ts`, `.env.example:41-42`
- **Fix:** **Rotate Impact token now** (treat as compromised); move Impact + Gemini/OpenRouter calls behind Cloud Functions with `defineSecret`; referrer/package+SHA-1-restrict remaining client keys in Cloud Console.
- **Sources:** security H4, infra H1

### F05. Inventory cache serialization drops ~10 PantryItem fields + collapses reservations — **M**
- **Problem:** `ITEM_FIELD_ORDER` omits `consumptionHistory`, `tags`, `cooked_rice`, `leftoverMeta`, `estimatedPrice`, `expiryDate`, `freezerZone`, `freezerLabelPhotoUrl`, `freezerPortionCount`, `originalQuantity`; `reservations` collapse to one entry with `quantity:0`. Cache doc is **sole** persistence — every bulk rewrite permanently destroys these fields for whole household.
- **Files:** `services/inventoryCacheService.ts:27-153`, `types.ts`
- **Fix:** Add missing fields to `ITEM_FIELD_ORDER` + both converters (JSON-encode complex values like `batches`); serialize full `reservations` as JSON; bump `CACHE_VERSION` to 2.
- **Depends:** **F06 MUST ship first (or same release)** — today version bump wipes user data.
- **Sources:** bug H1, db H1, db H2

### F06. `CACHE_VERSION` bump wipes all users' inventory (no migration path) — **M**
- **Problem:** Listener ignores docs where `version !== CACHE_VERSION`; next mutation `setDoc`s empty local state over real doc. `getCachedInventory` (migration path) does no version check at all — readers disagree.
- **Files:** `hooks/dataManagement/useInventory.ts:107-124`, `services/inventoryCacheService.ts:171-215,407-410`
- **Fix:** On version mismatch, run versioned read-side migrator (parse old layout, convert, rewrite doc at current version); make `getCachedInventory` apply same versioning. Never discard doc that is primary store.
- **Ordering:** Blocks F05's version bump.
- **Sources:** bug H2, db H3

### F07. Whole-doc `setDoc` on shared household cache — lost-update races delete other members' items — **M**
- **Problem:** `deleteItems`/`addItemsToCache`/`bulkUpdateInventoryCache` rewrite entire cache doc from one member's stale local state; concurrent member's adds/edits silently vanish. `image_cache` batch path has same no-merge clobber.
- **Files:** `services/inventoryCacheService.ts:220-259,296-322,393-397`, `hooks/dataManagement/useInventory.ts:556`
- **Fix:** Field-scoped `updateDoc` with per-item paths + `deleteField()` for removals; `runTransaction` for read-modify-write; `increment(1)` for `itemCount`.
- **Sources:** bug H3, db M5, perf 4 (partial)

### F08. Household migration treats cache-read failure as "no data" → checkpoint cleared, personal data stranded — **S**
- **Problem:** Cache getters swallow errors → `[]`; migration "succeeds", `pending_migration_{userId}` removed, retry never fires, personal pantry never reaches household.
- **Files:** `services/householdMigrationService.ts:40-45,98`, `services/inventoryCacheService.ts:200-206` (and sibling cache services)
- **Fix:** Getters rethrow (or return `{ok, items}`) on migration path; clear checkpoint only when all four reads verifiably succeed. Also add module-level in-flight guard for retry toast (bug L4) and clear stale checkpoint when `householdId` goes null (bug L6).
- **Sources:** bug H4 (+L4, L6)

### F09. Offline queue: poison-pill ops, conflict `ConstraintError` aborts sync, misclassified errors, duplicate adds — **M**
- **Problem:** (a) retry-exhausted ops never removed → permanent retry loop; (b) `handleConflict` re-`add`s same key → `ConstraintError` escapes loop, skips remaining ops; (c) `permission-denied`/`not-found` classified as "conflicts", parked forever; (d) `toMillis()` crashes on non-Timestamp `updatedAt`; (e) `add` ops replayed via `addDoc` → duplicate docs.
- **Files:** `services/offlineQueueService.ts:153-247,269-272,308-311`
- **Fix:** Remove op on give-up (dead-letter store); `store.put()` + dequeue when parking conflicts; per-op try/catch; classify permission-denied/not-found as terminal; normalize timestamps (`toMillis?.() ?? Date.parse`); replay adds via `setDoc(doc(coll, opId))` for idempotency. Fix false "changes synced" toast (bug L5).
- **Sources:** bug H5, bug H6, bug M7, db M2, db M3, db M4 (+bug L5)

### F10. Firestore rules: any member can rewrite `memberIds`/`members`/`ownerId` — **M**
- **Problem:** Household update rule has zero field validation — members can add outsider uids, remove members, self-promote to admin, flip ownerId; defeats leaveHousehold/removeMember admin checks and tier member caps.
- **Files:** `firestore.rules:48`
- **Fix:** Pin `ownerId` immutable; restrict `memberIds`/`members` mutation to remove-self-only; cap `memberIds.size()`; route all other membership mutation through existing Cloud Functions. Add `request.resource.data.userId == resource.data.userId` to recipes update (security L1) while in file. Run `npm run test:rules`.
- **Depends:** F03 (acceptInvitation must exist before invite-time writes locked down).
- **Sources:** security M1 (+L1)

### F11. Uncommitted release-critical Android config — fresh clone cannot build — **S**
- **Problem:** targetSdk 36 / AGP 8.13.2 / manifest changes unstaged; committed AGP 8.8.2 incompatible with committed Gradle 9.4.1 wrapper. Kotlin declared both 2.2.10 (`variables.gradle`) and 2.4.0 (version catalog).
- **Files:** `android/app/build.gradle`, `android/build.gradle`, `android/gradle/libs.versions.toml`, `android/app/src/main/AndroidManifest.xml`, `android/variables.gradle:17`
- **Fix:** Commit four android/ files (+ changelog housekeeping) as one upgrade commit; unify Kotlin on version catalog; verify clean-clone `./gradlew assembleDebug`.
- **Sources:** infra H2, infra H3 (+L5)

Currently using AGP 8.13.2

### F12. `image_cache/global` — single shared doc: 1MB hard-fail + open-write poisoning + no-merge clobber — **M**
- **Problem:** One global doc grows unbounded toward 1MB cap (write failure app-wide); any authenticated user can write arbitrary `url`s served to all clients; batch path `setDoc`s without merge, clobbers concurrent writers. Same open-write applies to `system/community_rated_recipes`, `price_cache`, leaderboard values.
- **Files:** `services/imageCacheService.ts:389-390,462-483`, `firestore.rules:239-302`
- **Fix:** Shard by key prefix/hash; `{merge:true}` or field-path updates in batch path; size/entry cap with pruning; rules: https/host-allowlist `url`s, make `system/*` + `price_cache` function-write-only, validate leaderboard entry shape.
- **Sources:** db H5, perf 4, security M2

---

## P1 — Major correctness / UX / perf

### F13. Gemini 429 retry is dead code — **S**
`performSearch` re-wraps 429 into friendly message before retry loop's substring match runs, so backoff never happens. Rethrow original (or set `cause`) and match structurally. `services/geminiService.ts:273,449-450`. Also fix abandoned (not aborted) timeout races at `:69-71,174-176,327-329` and fabricated placeholder recipe that burns quota on failure (`:524-532`). **Sources:** api 13 (+18, 21)

### F14. OpenRouter path bypasses free-tier AI usage limits — **S**
With `VITE_GEMINI_DISABLED=true` (production path) `recordGeminiUsage` never called — caps unenforced. Pre-check limits + record usage mirroring geminiService. `services/openRouterService.ts:109-111`. **Sources:** api 17

### F15. `getUserHouseholds` query can never match — **S**
`array-contains` on `{email}` vs full member maps → always `[]`. Query `memberIds` instead. `services/householdService.ts:340-343`. **Sources:** db H4

### F16. `useOfflineStatus` re-renders entire App tree every 4s forever — **S**
Unconditional new-object `setSyncStatus` each poll tick. Return `prev` when unchanged; consider event-driven queue signals. `hooks/useOfflineStatus.ts:74-95`. **Sources:** perf 1

### F17. Image cache localStorage restore breaks `Date` fields — persisted cache dead after every reload — **S**
Revive `createdAt`/`lastUsed` (or store epoch numbers) in `loadLocalCache`. `services/imageCacheService.ts:107-126,215-230`. **Sources:** perf 3

### F18. `useAndroidBack` LIFO stack reorders on re-render — back closes wrong modal — **M**
Key stack by stable registration token pushed once on `isOpen` flip; mutable `onClose` ref. Then have `Modal`/`BottomSheet`/`ConfirmDialog` self-register (delete 20+ per-caller registrations) and un-register `searchQuery` as pseudo-modal. `hooks/useAndroidBack.ts:26-36`, `components/ui/Modal.tsx`, `components/pantry/PantryScanner.tsx:450`. **Sources:** ui 1, ui 2, ui 3

### F19. Add-to-plan dialog: no dialog semantics + hardcoded light colors in dark mode — **S**
Rebuild flagship recipe→plan overlay on `Modal` + theme tokens; later upgrade to BottomSheet with 7-day strip (ui 18). `App.tsx:1679-1700`. **Sources:** ui 5 (+18)

### F20. UTC/local date mixing shifts expiry boundaries by day — **M**
Centralize `localDateString()` + parse date-only strings as local `new Date(y,m-1,d)`. `services/pantryService.ts:122-129`, `hooks/dataManagement/useInventory.ts:145,160-171,383-387,416-420`. **Sources:** bug M4

### F21. FEFO consumption defects: in-place mutation, batch reorder, unit-blind deduction — **M**
Fix shallow-copy mutation of `quantity` (`pantryService.ts:407-414`); consume via sorted view but write back original batch order; skip/convert unit-mismatched batches; handle legacy number/`quantity_estimate` items (currently silently not decremented). `services/pantryService.ts:407-441`. **Sources:** bug M1, bug M2 (+M5 stale aggregate)

### F22. Index-based updateItem/deleteItem race vs snapshot reordering — **S**
Address mutations by item id (pattern exists in `performUndo`). `hooks/dataManagement/useInventory.ts:331-332,369-370`. **Sources:** bug M3

### F23. Monolithic AppContext + unmemoized rows — O(rows) re-renders on any state change — **M**
`React.memo(EnhancedShoppingListItem)` + props instead of per-row `useApp()`; longer-term slice context (ties to F41 modal reducer). `contexts/AppContext.tsx:7-61`, `components/shopping-list/EnhancedShoppingListItem.tsx`. **Sources:** perf 2

### F24. inviteMember: pre-check cooldown DoS + email→uid enumeration — **S**
Move cooldown check/write after membership verification; per-caller global rate limit; return only `{success:true}` (no resolved uid/displayName). `functions/src/inviteMember.ts:55-60,98-107,204`. **Sources:** api 4, security M3

### F25. HTTP fallback wrappers: role-case drift, GET mutations, raw error leak — **S**
`'Admin'` vs `'admin'` means HTTP admin-leave guard never fires. Prefer deleting wrappers; else POST-only, extract shared `leaveHouseholdCore()`, map HttpsError→status, generic messages (also `verifyPurchase.ts:108-113`, `removeHouseholdMember.ts:131`). `functions/src/leaveHousehold.ts:56,223,317-320`, `functions/src/inviteMember.ts:245-253`. **Sources:** security M5, api 5, api 6, api 8

### F26. App Check effectively absent — **M**
Add `@capacitor-firebase/app-check` with Play Integrity (Android is primary platform); `enforceAppCheck: true` on all callables; enable Firestore/Storage enforcement after metrics. `firebaseConfig.ts:40-51`, `functions/src/*`. **Depends:** land after F01-F03 so callables correct before locking. **Sources:** security M4

### F27. Dependency hygiene batch — **S**
`npm audit fix` (root, no --force); remove `react-router-dom` (+ swap test `MemoryRouter` → fragment, 3 files — clears both HIGH advisories); remove unused runtime deps `date-fns`, `react-swipeable`, `@opentelemetry/api`; `cd functions && npm audit fix && npm update firebase-functions-test`. **Sources:** dep 1-3, dep §1-3

### F28. CI never runs production build; hosting can deploy stale dist/ — **S**
Add `npm run build` to CI app job; add `"predeploy": ["npm run build"]` to app hosting target; pin `gitleaks` and `firebase-tools` versions. `.github/workflows/ci.yml`, `firebase.json`. **Sources:** infra M1, M2, M3

### F29. `deleteAccount` orphans subcollections; >500-doc sweeps silently partial — **S**
Use `db.recursiveDelete` (already pattern in leaveHousehold/removeMember). `functions/src/deleteAccount.ts:53,81-90`. **Sources:** api 9

### F30. `resetUsageLimits` hardcoded defaults grant 25x free-tier caps — **S**
Single `set(..., {merge:true})`, no pre-read; source limits from one shared constant matching `IN_APP_DEFAULTS`. `functions/src/resetUsageLimits.ts:66-87`. **Sources:** api 11

### F31. `subscriptionNotifications`: no packageName check, unknown tier defaults to premium — **S**
Drop mismatched `packageName`; derive tier from `PRODUCT_TIER_MAP[subscriptionId]`; validate `purchaseToken` type. `functions/src/subscriptionNotifications.ts:101-130`. **Sources:** api 10

### F32. Third-party client TTL/timeout defects (nutrition, currency, Spoonacular) — **M** — **DEFERRED**
Nutrition: per-entry TTL (7d negative / 90d hit) + LRU cap. Currency: TTL-aware `ratesPromise`, clear on rejection, validate rates numeric. Spoonacular: distinguish 402/401/429 from "no results", shared `fetchWithTimeout`, quota cooldown. `services/nutritionService.ts:21,58-61,182-186`, `services/currencyService.ts:39,82-85`, `services/spoonacular*Client.ts`. **Sources:** api 14, 15, 16 (+19 keys→headers, 20 brand-strip no-op)
- **Deferred:** Spoonacular error-handling + timeout issues; nutrition/currency TTL fixes stable. Add to backlog if quota/timeout incidents surface.

### F33. i18n: 7 shipped locales but ~80% of UI hardcoded English — **L** — **DEFERRED**
Priority batch: nav labels, ui/ primitive defaults, toasts, empty states; add scoped `react/jsx-no-literals` lint; then double coverage (~345 keys/locale). `src/locales/*`, `components/**`. **Sources:** ui 15 (+ui 14 "Loading...")
- **Deferred:** Large multi-locale effort; prioritize if user-base expands to non-English regions.

### F34. Non-guest `addItems` never updates local state; listener flag not in deps — **S**
Optimistic `setInventory` in `addItems`; add `disableInventoryListeners` to effect deps. `hooks/dataManagement/useInventory.ts:594,140`. **Sources:** bug M6

---

## P2 — Quality / maintenance

### F35. Firebase bundle: split messaging/functions/analytics out of eager `firebase-vendor` (~475kB gz pre-paint) — **M** — `vite.config.ts:69-99`, dynamic imports at first use; check `searchUtils` (386kB) via build:analyze. **Sources:** perf 5
### F36. `PantryScanner.tsx` god component (3,427 lines, 48 useState) — **L** — continue extraction: VirtualizedRow → `PantryList.tsx`, quick-consume → `usePantryQuickConsume`; split scanner phases. **Sources:** code 1, perf 8
### F37. `Community.tsx` second god component forming (1,766 lines) — **M** — split feed/actions/effects now, cheaper than at 3,000 lines; delete dead `_STAPLES` const. **Sources:** code 2 (+8)
### F38. Twin notification services with colliding `NotificationItem` types — **M** — rename to role-based names, distinguish `ScheduledNotification` vs `UserNotification`. `services/notificationService.ts`, `services/notificationsService.ts`. **Sources:** code 3
### F39. Blanket `no-explicit-any` disables in 3 files — **M** — scope to lines; type `AppActionsContext` first (highest blast radius). **Sources:** code 5
### F40. Bespoke `fixed inset-0` overlays in 27 files — **L** — migrate to `Modal`/`BottomSheet`; lint-ban new ones. Includes padding-var underlap fix. **Sources:** ui 6 (+17)
### F41. App.tsx modal sprawl → reducer-based modal router — **L** — deferred 2026-07-29, still open; unblocks F18 consolidation + F23 context slicing. `App.tsx:140-155,697-699`. **Sources:** code 4, ui 7
### F42. Tap targets <44px in Modal close / Button xs/sm — **S** — `min-w/h-[44px]` hit areas in primitives (copy EnhancedShoppingListItem standard). **Sources:** ui 8 (+9 nav label size/dup aria, 11 contrast tokens)
### F43. `max-w-md` hard cap wastes tablet/desktop/foldable space — **M** — per-breakpoint caps + 2-col grids; Play Store scores large-screen layouts. `App.tsx:1576` etc. **Sources:** ui 16
### F44. Native `alert()` in 4 sites — **S** — route through `useToast`/`ConfirmDialog`; lint-ban `alert(`. **Sources:** ui 13
### F45. Focus trap escapes to non-inert background — **S** — `inert` app root while modal open; preventDefault fallback. `components/ui/Modal.tsx:106-125`. **Sources:** ui 10
### F46. Rating/search Firestore scans (carried) — **M** — `updateCommunityStats` → transaction + `increment()`; `recipe_search_index` full scan → `searchTokens` array-contains + `limit()` fallback. `services/recipeRatingService.ts:252-254`, `services/recipeService.ts:1018,1087`. **Sources:** db M6, M7
### F47. Inventory/recipes cache doc 1MB risk unmonitored — **S** — track serialized size in `updateCache`, surface failure (currently swallowed), telemetry guard before sharding. `services/inventoryCacheService.ts:255-258`. **Sources:** db M1, perf 6
### F48. Functions toolchain 2+ majors stale (TS 4.9, ESLint 8 EOL) — **M** — upgrade TS≥5, ESLint 9+, @typescript-eslint 8; clears most functions' 16 advisories; consider scoped `@googleapis/androidpublisher` for cold starts. **Sources:** dep §2, §5, §6
### F49. Migrate off `@codetrix-studio/capacitor-google-auth` (Capacitor-6 RC pin) — **L** — to `@capacitor-firebase/authentication` or `@capgo/capacitor-social-login`; retires `--legacy-peer-deps` + gradle patch. **Sources:** dep §4
### F50. Android provisioning/config drift — **S** — commit or document `google-services.json` provisioning; single source for SDK versions (catalog) instead of triplication. **Sources:** infra M4, M5

---

## P3 — Docs / SEO / nice-to-have

### F51. App canonical/OG points at marketing site + permissive robots — **S** — noindex auth-gated app, fix `og:url`, `Disallow: /` in `public/robots.txt`. `index.html:16-30`. **Sources:** seo H1, H2
### F52. Real 1200x630 OG image (new filename — immutable caching) + `name=` on twitter metas + `content=` on impact-verification meta — **S** — both `index.html` and `website/*.html`. **Sources:** seo H3, M1, M2
### F53. Manifest icons claim wrong sizes; icon192/512 exist unused — **S** — point entries at real files, add maskable/description/id. `public/manifest.webmanifest`. **Sources:** seo M3
### F54. Per-tab `document.title` in `switchTab()` — **S** — plus optional hash deep-links. **Sources:** seo M4
### F55. Drop marketing-site SPA rewrite (soft-404s) + remove leftover `aistudiocdn.com` import map + font `@import` → preconnect links — **S** — `firebase.json`, `index.html:38,129-139`. **Sources:** seo M5, L2, L6
### F56. CLAUDE.md corrections — **S** — changelog direction is CHANGELOG.md → changelogEntries.ts (doc says reverse); add `test:rules` + release scripts to Commands; clarify member-cap location; prune dead wiki pointer. **Sources:** doc H1-H4
### F57. `.env.example` regeneration — **S** — add ~20 missing vars (Sentry, OpenRouter, reCAPTCHA, Unsplash, affiliate IDs...), delete stale Stripe/Functions-URL vars, default `VITE_ADMOB_ENABLED=false`; complete `vite-env.d.ts`; rename `VITE_COOLDOWN_MS` in functions. **Sources:** doc E1-E4, infra L2
### F58. readme/ refresh — **S/M** — delete README's stale top-of-file Play Billing plan (wrong plugin named); purge Stripe from IMPROVEMENT_SUGGESTIONS; add short setup docs for nutrition/barcode, currency, Play Billing, OpenRouter. **Sources:** doc R1-R3
### Also-P3 (one-liners): dead `cache` collection-group index — delete (db L1); dead external-image fetch in `createManualItem` (bug L1); `setFlagTemporarily` 100ms race (bug L3); `getPendingCount` → `store.count()` (db L3); tab-history back retrace + Settings sub-state reset (ui 4, 19, 20); public-read recipe-photos decision + persistence race (security L3, L4); CI path filters (infra L4); drop `msw`/`ts-node`/`puppeteer` devDeps + minor `npm update` batch (dep 6); `useDataListener` callback refs (perf 7); metadata/item-id key collision — fold into next cache version (db L4).

---

## Dependencies / ordering constraints

1. **F06 → F05**: CACHE_VERSION migration path must exist before F05's field additions bump version, else every user's pantry wiped. Ship as one unit: F06 migrator, then F05 fields, `CACHE_VERSION = 2`.
2. **F03 → F10**: `acceptInvitation` callable must exist before firestore.rules lock down membership mutation, else accept flow breaks. F01/F24 (same file family) land alongside.
3. **F02 before F26**: get verifyPurchase semantics right, then App Check enforcement wraps all callables (F26 amplifies F01-F03 fixes).
4. **F07 pairs with F05/F06**: bulk-path rewrite touches same functions; do in same PR series to avoid re-serializing twice.
5. **F11 first among infra**: unblocks anyone cloning; F28 (CI build) fails until F11 committed anyway.
6. **F41 (modal router) unblocks** F18's final cleanup and F23's context slicing — but F18's stack fix itself must NOT wait on F41.
7. **F27 before F48**: root audit fix independent; functions toolchain upgrade own PR.
8. **F04 rotation immediate** (ops action) even before code move lands.

## Suggested execution sequence

**Wave 0 — same-day quick wins (all S):**
F11 (commit android), F04-rotate (rotate Impact token in Impact dashboard), F01, F02, F08, F15, F16, F17, F27, F28, F30, F31, F29.

**Wave 1 — P0 cache/data-integrity batch (one PR series, in order):**
F06 → F05 → F07 → F09 → F12. Verify with `/verify` + `npm run test:rules` + manual two-member household smoke test.

**Wave 2 — P0/P1 security batch:**
F03 (acceptInvitation) → F10 (rules) → F24 → F25 → F26 (App Check) → F04 (server-side proxy completion).

**Wave 3 — P1 correctness/UX:**
F13, F14, F20, F21, F22, F34, F18, F19, F23, F32.

**Wave 4 — P2 maintenance (interleave as capacity allows):**
F35, F42, F44, F45, F47, F50 (small) → F37, F38, F39, F46, F48, F43 (medium) → F36, F40, F41, F49, F33 (large).

**Wave 5 — P3 docs/SEO sweep:** F51-F58 in one or two housekeeping PRs.

---

# FIXES.md addendum — 2026-08-05 subscription/membership-tier audit pass

Sources: `db-audit-subscription.md`, `api-audit-subscription.md`, `security-audit-subscription.md` (all 2026-08-05, scope: Play Billing plan-switch + household-tier entitlement). Continues F-numbering from F58. F02 and F04 above are the same underlying issues these three audits cross-reference — not re-numbered here.

## P0 — Payment/entitlement integrity

### F59. `households/{id}.ownerSubscriptionTier` is client-writable with no server-side gate — free members can self-grant family tier — **S** — **CRITICAL**
- **Problem:** The household `allow update` rule validates `ownerId`, `memberIds`, `members`, and the member-count ceiling, but never touches `ownerSubscriptionTier`. Any authenticated member (not just the admin) can call `updateDoc(households/{id}, {ownerSubscriptionTier: 'family'})` directly from the client SDK and every non-admin member instantly inherits family-tier limits: `hooks/useSubscription.ts:112-117` reads `data.ownerSubscriptionTier` off the household doc with no revalidation, and `services/usageService.ts:146-148` independently grants usage limits from the same unguarded field. Contrast `users/{userId}.subscription`, which IS locked via `subscriptionUnchanged()`/`newSubscriptionIsFree()` — this is the same class of field left unprotected on the household doc.
- **Concrete exploit:** Account A creates a household (free tier, no purchase), then directly writes `ownerSubscriptionTier: 'family'` to `households/{id}` — passes every existing rule check since none inspect that field. Account A invites Account B through the normal invite flow. B is a non-admin member; both `useSubscription.ts` and `usageService.ts` read the forged field and grant B full family-tier access, with no Cloud Function ever re-checking or overwriting it. Repeatable for any number of member accounts, indefinitely, at zero cost.
- **Files:** `firestore.rules:143-153` (households `allow update` block — add the guard here, alongside `ownerIdUnchanged()`/`memberIdsChangeAllowed()`), `hooks/useSubscription.ts:98-109` (client write to be removed), `services/usageService.ts:146-148` (read site, unaffected by rule fix but confirms blast radius).
- **Fix:**
  1. In `firestore.rules`, add a `ownerSubscriptionTierUnchanged()` helper mirroring `subscriptionUnchanged()` (line 117-119): `return request.resource.data.get('ownerSubscriptionTier', null) == resource.data.get('ownerSubscriptionTier', null);` and AND it into the household `allow update` condition at line 148-153, next to `ownerIdUnchanged()`.
  2. Remove the client `DatabaseMonitoringService.updateDoc(households/{householdId}, {ownerSubscriptionTier: ownTier})` call in `hooks/useSubscription.ts:98-109` — it will now always fail with `permission-denied`.
  3. Replace it with a Cloud Function write: add an `onDocumentWritten` trigger on `users/{uid}` (or extend `verifyPurchase.ts`/`subscriptionNotifications.ts`, both already Admin SDK) that, when the writing uid is a household admin (look up `households` where `ownerId == uid` or member role `admin`), pushes the verified `subscription.tier` onto `households/{id}.ownerSubscriptionTier` server-side.
  4. Run `npm run test:rules` after the rules change; add a rules-test case asserting a non-admin/non-function client write to `ownerSubscriptionTier` is rejected.
- **Sources:** security-audit-subscription C1

### F60. `linkedPurchaseToken` never reconciled on plan-switch — RTDN webhook can clobber a valid new-tier grant with a stale cancelled one, and the client purchase call never signals Play it's a replace — **M** — **CRITICAL**
- **Problem (two angles, one root cause: nothing correlates old-token and new-token purchase records across a plan change):**
  - **Client side:** `services/purchaseService.ts:184-227` (`purchaseProduct`) calls `IAP.store.order(orderTarget)` with no `oldPurchaseToken`/proration/replace parameter. `components/settings/SubscriptionManager.tsx` (`handleUpgrade`) never looks up the user's current `purchase_token`/`product_id` before calling `purchaseProduct(productId)`, so there's nothing to pass even if the plugin's replace API were wired up. Without this, Google Play may treat an upgrade as an independent second subscription rather than a plan-change/replace, and depending on Play Console config can double-charge or reject the order.
  - **Server side:** `functions/src/subscriptionNotifications.ts:139-206` and `functions/src/googlePlayHelpers.ts:31-62` (`resolveSubscriptionState`) never call `purchases.subscriptionsv2.get` or read `linkedPurchaseToken`, and never compare the notification's `purchaseToken` against `users/{uid}.subscription.purchase_token` before writing. Play delivers two independent RTDN messages on a real plan change — `SUBSCRIPTION_CANCELED` (type 3) for the old token, `SUBSCRIPTION_PURCHASED` (type 4) for the new token — with no ordering guarantee. `purchaseTokens/{oldToken}` is never deleted or marked superseded, so it still resolves to the same uid indefinitely.
- **Concrete failure scenario:** User on `premium_monthly` (token A) upgrades to `family_monthly`. Client orders without an old-token reference; Play issues token B and marks A's purchase `cancelReason`-set with `linkedPurchaseToken` pointing back to A. `verifyPurchase` (triggered by the client's `verified()` handler with token B) correctly writes `tier: family, product_id: family_monthly, purchase_token: B`. But if the RTDN for token A (CANCELED) is processed after that — a plain race, both fire within the same second, and is independently retried on cold-start/timeout — `subscriptionNotifications.ts:181-199` re-verifies against Play using token A, gets back `tier: premium, status: cancelled`, and the unconditional `userRef.update({subscription: {...}})` at line 183-193 overwrites the correct family/active state. The user is shown `cancelled` on the old premium product despite actively paying for family. This isn't a one-time race either: any later redelivery of a stale RTDN for token A (Pub/Sub redelivery, or a late `EXPIRED` for A months later) resolves to the same uid via `purchaseTokens/A` and can stomp whatever tier the user has since legitimately purchased. Additionally, if the app is backgrounded/killed mid-checkout before `verifyPurchase` fires (common when the Play billing sheet backgrounds the app), there is no automatic recovery — `restorePurchases()` is only invoked from a manual button in `SubscriptionManager.tsx:480`, not on app resume.
- **Files:** `functions/src/subscriptionNotifications.ts:139-206` (write guard), `functions/src/googlePlayHelpers.ts:31-62` (`resolveSubscriptionState` — needs `linkedPurchaseToken` read), `services/purchaseService.ts:184-227` (`purchaseProduct` — needs old-token param), `components/settings/SubscriptionManager.tsx` `handleUpgrade` (needs to source current token before calling `purchaseProduct`).
- **Fix:**
  1. **Server (primary guard, do this first):** In `subscriptionNotifications.ts`, before the `userRef.update(...)` calls at both line 164-169 (immediate-downgrade branch) and line 183-193 (re-verify branch), add: `if (currentSub?.purchase_token && currentSub.purchase_token !== purchaseToken)` — fetch `purchases.subscriptionsv2.get` (or extend `resolveSubscriptionState` to also return `linkedPurchaseToken` off `data.linkedPurchaseToken`) and if the response's `linkedPurchaseToken` matches the user's *current* on-file token, treat this notification as informational about a now-superseded predecessor purchase and `return` without writing (no-op), rather than blind last-write-wins. Simplest version: reject the write outright whenever `purchaseToken !== currentSub.purchase_token` unless the incoming token IS what's on file (an old-token terminal event should never override a newer one already recorded).
  2. Once a token is confirmed superseded, delete (or mark `superseded: true` on) `purchaseTokens/{oldToken}` so late redeliveries become no-ops via the existing `tokenDoc.exists` check at line 131-138.
  3. **Client:** In `services/purchaseService.ts`, extend `purchaseProduct(productId, oldPurchaseToken?: string)` to pass `oldPurchaseToken` through to `IAP.store.order(orderTarget)` (cordova-plugin-purchase's Google Play `Offer.order()` accepts an old-purchase reference to invoke Play Billing's `SubscriptionUpdateParams` replace flow — check the plugin's order-options shape for the exact param name, likely `{oldPurchaseToken, prorationMode}` on the offer/order call). In `SubscriptionManager.tsx handleUpgrade`, read the user's current `subscription.purchase_token` before calling `purchaseProduct`, and pass it through.
- **Ordering:** Land the server-side guard (step 1-2) before the client change (step 3) — it closes the write-clobber hole regardless of whether the client change ships same-release, and the client change alone doesn't fix the RTDN race.
- **Sources:** db-audit-subscription H2, api-audit-subscription Finding 1 (merged — same root cause, different files/angles)

## P1 — High-severity entitlement gaps

### F61. No scheduled fallback re-check of `subscription.status`/`current_period_end` — RTDN webhook is a single point of failure for downgrade enforcement — **M** — **HIGH**
- **Problem:** No `onSchedule` function anywhere in `functions/src` walks `users/{uid}.subscription` and re-verifies/expires stale entitlements. The entire downgrade path depends on Play's RTDN topic never silently failing (misconfigured topic, IAM permission drift on the publisher service account, transient Pub/Sub issue) and on `purchaseTokens/{token}` already existing (`subscriptionNotifications.ts:131-138` is a no-op with just a `logger.warn` if `verifyPurchase` was never called for that token). `functions/src/resetUsageLimits.ts` only resets usage counters weekly — it never reads or compares `subscription.current_period_end`/`status` against `Date.now()`.
- **Concrete failure scenario:** A user cancels or lets their subscription lapse. If the specific RTDN event for that cancellation is ever missed (misconfigured topic, transient delivery failure, or F62's swallowed-error case), `subscription.tier` simply stays at its last-granted value forever — nothing outside the RTDN handler itself ever compares `current_period_end` to "now". The user keeps full paid-tier access indefinitely unless they personally trigger `verifyPurchase` again via the manual "Restore Purchases" button, which they have no incentive to do once they've stopped paying.
- **Files:** new `functions/src/checkExpiredSubscriptions.ts` (or extend `functions/src/resetUsageLimits.ts`), `functions/src/googlePlayHelpers.ts` (`resolveSubscriptionState`, reusable for re-verification).
- **Fix:** Add a daily `onSchedule` function that queries `users` where `subscription.status in ['active','trialing']` and `subscription.current_period_end < now` (Firestore query on `subscription.current_period_end`, requires that field to stay a `Timestamp` — confirm no composite index needed since it's a single-field range query with no additional `where`). For each match, if `subscription.purchase_token` is on file, re-verify via `resolveSubscriptionState(product_id, purchase_token)` and write the real state; if no token, downgrade directly to `{tier: 'free', status: 'cancelled'}`. This closes the gap regardless of RTDN reliability.
- **Sources:** security-audit-subscription H1

### F62. RTDN Cloud Function trigger has no retry, and the re-verify catch block swallows Play API errors instead of rethrowing — transient failures permanently drop the sync — **S** — **HIGH**
- **Problem:** `onMessagePublished({topic: 'play-store-notifications', region: 'us-east1'}, ...)` at `functions/src/subscriptionNotifications.ts:86-89` does not set `retry: true` — Cloud Functions v2 default is `false`, so a failed invocation is not redelivered by Pub/Sub, just logged and dropped. Compounding this, the re-verify branch's `catch` block at `functions/src/subscriptionNotifications.ts:200-206` only `logger.error`s the caught error — it never rethrows, so the function returns success (implicit ACK) even when `resolveSubscriptionState` fails (rate limit, expired Play API auth token, transient 5xx from `androidpublisher.purchases.subscriptions.get`).
- **Concrete failure scenario:** A plan-change or cancellation RTDN arrives; `resolveSubscriptionState` hits a transient Play API 5xx or auth-token expiry. The error is caught, logged, and swallowed — Pub/Sub sees an ACK (explicit via the try/catch, or implicit via the immediate-downgrade path's uncaught-throw with `retry` off) so there's no second chance for that specific event. If it was the notification for a plan-change or cancellation, the user's tier is left stale indefinitely with nothing to trigger a correction until an unrelated later RTDN happens to fire, or F61's scheduled fallback (once it exists) catches it.
- **Files:** `functions/src/subscriptionNotifications.ts:86-89` (trigger config), `functions/src/subscriptionNotifications.ts:200-206` (catch block).
- **Fix:** Change the trigger options to `{topic: 'play-store-notifications', region: 'us-east1', retry: true}`. In the catch block at line 200-206, after `logger.error(...)`, `throw err;` (rethrow) so Pub/Sub's built-in redelivery/backoff retries the invocation instead of swallowing it. If indefinite retries are undesirable long-term, pair with a dead-letter topic — but rethrow-with-retry is the immediate fix; DLQ is a follow-up, not a blocker.
- **Sources:** api-audit-subscription Finding 2

## P2 — Medium

### F63. `PRODUCT_TIER_MAP` duplicated between `functions/src/googlePlayHelpers.ts` and `services/purchaseService.ts` with no shared source of truth — **S** — **MEDIUM**
- **Problem:** `functions/src/googlePlayHelpers.ts:10-15` and `services/purchaseService.ts:34-39` each hand-maintain the identical 4-entry product-to-tier map (`premium_monthly`/`premium_yearly` → `premium`, `family_monthly`/`family_yearly` → `family`). Nothing enforces they stay in sync. Adding a new product SKU (e.g. a promo tier) to only one map causes silent drift: `verifyPurchase.ts:83-86` throws `invalid-argument "Unknown product"` for a purchase the client just sold, or the RTDN handler's fallback-to-current-tier at `subscriptionNotifications.ts:149` silently keeps the user on their prior tier forever for that product — exactly the failure mode most likely at the next tier launch, not at the original 4-product launch.
- **Files:** `functions/src/googlePlayHelpers.ts:10-15`, `services/purchaseService.ts:34-39`.
- **Fix:** Create one shared constants file, e.g. `shared/productTierMap.ts` (or `constants/productTierMap.ts` importable by both `functions/` and root `services/` — check existing `functions/` tsconfig for whether it can resolve a root-level import today; if not, generate `functions/src/generated/productTierMap.ts` from a single root JSON via a small `predev`/`prebuild`-style script, following the existing `constants/changelogEntries.ts` generation pattern in this repo). Both `googlePlayHelpers.ts` and `purchaseService.ts` import from that single source instead of hand-maintaining separate literals.
- **Sources:** db-audit-subscription M1

### F64. Dead optimistic client write to `users/{uid}.subscription` always hits `permission-denied` and is silently swallowed — invites future weakening of `subscriptionUnchanged()` — **S** — **MEDIUM**
- **Problem:** `components/settings/SubscriptionManager.tsx:124-135` calls `updateSubscription({...})` (→ `hooks/useSubscription.ts:129-146` → plain `updateDoc`) immediately after `purchaseProduct()` resolves, framed as an "optimistic" instant UI update. `firestore.rules:117-119` (`subscriptionUnchanged()`) rejects every client-initiated change to `subscription` on `users/{userId}` by design — only `verifyPurchase.ts`/`subscriptionNotifications.ts` (Admin SDK) may write it. So this call reliably throws `permission-denied` on every single purchase; the failure is caught at `SubscriptionManager.tsx:133` and only `log.error`'d, while the success toast still fires immediately. It's harmless today only because the real Admin-SDK write from `verifyPurchase` already lands before or shortly after `purchaseProduct()`'s promise resolves (`purchaseService.ts:136-145`) — `useSubscription.ts`'s `onSnapshot` listener (line 49) is what actually updates the UI. But the dead code and misleading "instant zero-ms refresh" comment are exactly the kind of `permission-denied` noise a future refactor could "fix" by loosening `subscriptionUnchanged()` — reopening a client-side privilege-escalation hole identical in shape to F59/C1.
- **Files:** `components/settings/SubscriptionManager.tsx:124-135`, `hooks/useSubscription.ts:129-146` (`updateSubscription`), `firestore.rules:117-119` (`subscriptionUnchanged()` — do NOT loosen this).
- **Fix:** Remove the `updateSubscription({...})` call at `SubscriptionManager.tsx:124-135` entirely (rules will never allow it to succeed). If a genuinely optimistic UI is wanted, replace it with local component state (`useState`) set immediately after `purchaseProduct()` resolves and cleared once `useSubscription.ts`'s `onSnapshot` listener observes the real Admin-SDK-written tier — never a Firestore write. Leave `subscriptionUnchanged()` in `firestore.rules` untouched.
- **Sources:** db-audit-subscription M2, security-audit-subscription M1 (merged — same dead code, same root cause, flagged from both a data-correctness and a security-hardening angle)

### F65. `canAddHouseholdMember` skips the active-status clamp `getUsageLimits` applies — a lapsed/cancelled subscriber can still add members at their stale tier's limit — **S** — **MEDIUM**
- **Problem:** `services/usageService.ts:405-419` (`canAddHouseholdMember`) computes `maxMembers` straight from `user.subscription?.tier` (line 408-409: family→5, premium→3, else→2) with no status check at all. Contrast `getUsageLimits` at `usageService.ts:132-134`, which explicitly clamps `planTier` to `'free'` unless `subStatus === 'active' || subStatus === 'trialing'`, with an inline comment noting RTDN-driven Firestore updates can lag and that `CANCELED`/`ON_HOLD` notification types intentionally leave `tier` untouched (see `subscriptionNotifications.ts:181-199`, the re-verify branch, which sets `status` to `cancelled`/`past_due` but keeps `tier` at whatever `PRODUCT_TIER_MAP` resolves to, line 149).
- **Concrete failure scenario:** A family-tier user's payment fails or they cancel; `subscriptionNotifications.ts`'s re-verify branch sets `status: cancelled`/`past_due` while `tier` stays `family` (this is intentional per the code comment — not a bug in that file). During that window (grace period, payment retry, or the CANCELED period before a terminal `EXPIRED`/`REVOKED` event lands), `getUsageLimits` correctly clamps the user to free-tier limits everywhere it's called, but `canAddHouseholdMember` still reads `tier === 'family'` and allows growing the household to 5 members. The extra invited members will later get clamped down (or, compounding with F60's unfixed race, inherit stale premium/family access) once other checks catch up — and the invited slots are never reclaimed anywhere.
- **Files:** `services/usageService.ts:405-419` (`canAddHouseholdMember`), `services/usageService.ts:132-134` (`getUsageLimits`, the pattern to reuse).
- **Fix:** In `canAddHouseholdMember`, replace the direct `user.subscription?.tier === 'family' ? 5 : ...` ternary at line 408-409 with the same `isSubActive` gate used in `getUsageLimits`: compute `const subStatus = user.subscription?.status; const isSubActive = subStatus === 'active' || subStatus === 'trialing'; const effectiveTier = isSubActive ? (user.subscription?.tier || 'free') : 'free';` then derive `maxMembers` from `effectiveTier`. Better: extract a single `resolveEffectiveTier(user): 'free'|'premium'|'family'` helper in `usageService.ts` that both `getUsageLimits` and `canAddHouseholdMember` call, so the two can't drift again.
- **Sources:** db-audit-subscription M3
