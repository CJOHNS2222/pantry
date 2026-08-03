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