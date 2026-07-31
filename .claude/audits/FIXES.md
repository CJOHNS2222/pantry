---
agent: fix-planner
status: complete
findings: 64
critical: 3
high: 14
medium: 22
low: 25
---

# FIXES.md — Consolidated Fix Plan

Sources: AUDIT_CODE, AUDIT_BUGS, AUDIT_SECURITY, AUDIT_DOCS, AUDIT_INFRA, AUDIT_UI, AUDIT_DB, AUDIT_PERF, AUDIT_DEPS, AUDIT_SEO, AUDIT_API (this pass) + prior UI+bugs-only FIXES.md (2026-07-30 pass, recovered from workflow journal after overwrite). That prior pass's P0/P1 items were already marked done and are not re-listed. Its still-open P2 (orphaned-component keep/wire/delete calls) and P3 (design-system consistency) items are folded in below as Batch 4 (F48-F64), renumbered to continue this pass's sequence.

## Batch 0 — STOP THE BLEEDING (do first, today)

### F1 [CRITICAL] Android release keystore committed to git
- **File:** `android/app/pantry-release-new.keystore`
- **Source:** infra-auditor
- **Issue:** Signing keystore tracked in git; `.gitignore` rule (`pantry-release.keystore`) doesn't match actual filename (`pantry-release-new.keystore`), so it was never excluded.
- **Fix:** Rotate/reissue the signing key if this repo has ever been public or shared beyond the immediate team; `git rm --cached` the file, fix the `.gitignore` glob to match the real filename pattern, purge from history (`git filter-repo`/BFG) if exposure risk is real.
- **Effort:** M (rotation decision + history rewrite coordination)

### F2 [CRITICAL] `migrateHouseholdClaims` has no authorization
- **File:** `functions/src/migrateHouseholdClaims.ts:56,73`
- **Source:** api-tester
- **Issue:** Both the callable and HTTP variant let any caller rewrite auth custom claims for every user in every household — full privilege-escalation primitive. HTTP variant has zero auth check.
- **Fix:** Require admin/service-account-only invocation (e.g. check custom claim `admin: true` or restrict to Cloud Scheduler/internal invoker), reject HTTP variant entirely or gate behind the same check with signed internal token.
- **Effort:** S

### F3 [CRITICAL] Dependency vulnerabilities in `functions/`
- **File:** `functions/package.json`
- **Source:** dep-auditor
- **Issue:** protobufjs (critical, transitive via googleapis), nodemailer <=9.0.0 (critical, drags in vulnerable form-data), fast-xml-parser <=5.6.0 + websocket-driver <=0.7.4 (critical, transitive via @google-cloud/storage / aws-sdk ses).
- **Fix:** Bump `nodemailer` to `9.0.3`; bump `googleapis` to `173.0.0` (audit call sites first — breaking major); bump `firebase-admin` to `14.2.0` to match root devDependency pin (14.1.0) and fix protobufjs range; re-run `npm audit` after to confirm fast-xml-parser/websocket-driver resolve transitively.
- **Effort:** L (major version bumps need call-site verification + full functions test pass)

## Batch 1 — HIGH severity, low-to-medium effort (this sprint)

### F4 [HIGH] LeftoverAnalytics displays inflated/wrong savings figures
- **File:** `components/leftovers/LeftoverAnalytics.tsx:483,495,623`
- **Source:** bug-auditor
- **Issue:** "Value Saved (Est.)" and "Net Savings (Est.)" render `analytics.moneySaved` (= `estimatedValueSaved` + `moneySavedFromCooking`) instead of `analytics.estimatedValueSaved`, duplicating the "Eco Savings" hero stat under a contradictory label and breaking reconciliation between rows.
- **Fix:** Use `analytics.estimatedValueSaved` for the "Value Saved" line; keep `moneySaved` only where the combined total is the intended label; verify "Net Savings" math against its stated components.
- **Effort:** S

### F5 [HIGH] `inviteMemberHttp`/`leaveHouseholdHttp` CORS reflects any Origin with credentials allowed
- **File:** `functions/src/inviteMember.ts:173-175`, `functions/src/leaveHousehold.ts:157-159`
- **Source:** api-tester (confirmed by security-auditor, lower severity there)
- **Issue:** Reflects arbitrary `Origin` header while setting `Access-Control-Allow-Credentials: true` — classic CORS bypass, defeats origin protection even though auth is Bearer-token based.
- **Fix:** Replace with an explicit allowlist of known app origins (web app domain, Capacitor scheme); drop `Allow-Credentials: true` if cookies aren't actually used.
- **Effort:** S

### F6 [HIGH] ID token accepted via query string on HTTP function fallbacks
- **File:** `functions/src/inviteMember.ts:182`, `functions/src/leaveHousehold.ts:167`
- **Source:** api-tester (confirmed by security-auditor)
- **Issue:** `?idToken=` query param accepted as auth fallback, risking exposure via server/proxy logs, browser history, referrer headers.
- **Fix:** Require `Authorization: Bearer <token>` header only; remove query-string fallback.
- **Effort:** S

### F7 [HIGH] `getNutritionData` function has no auth check
- **File:** `functions/src/nutrition.ts:14`
- **Source:** api-tester
- **Issue:** Open, unauthenticated relay to USDA API with no rate limiting.
- **Fix:** Add `request.auth` check (reject unauthenticated calls) and apply existing rate-limit pattern used elsewhere in `functions/src`.
- **Effort:** S

### F8 [HIGH] `PriceTrends` modal fails accessibility basics + hardcodes light theme
- **File:** `components/pantry/PriceTrends.tsx:52-153`
- **Source:** ui-auditor
- **Issue:** Hand-rolled modal bypassing `components/ui/Modal.tsx` — no `role="dialog"`, no `aria-modal`, no Escape handling, no focus trap; 14 hardcoded light-mode Tailwind classes break dark theme.
- **Fix:** Rewrite on top of `Modal.tsx`; replace hardcoded `bg-white`/`text-gray-*`/`bg-gray-50` with theme-aware tokens matching rest of app.
- **Effort:** M

### F9 [HIGH] `Modal.tsx` still unused by feature modals (carried forward)
- **File:** `components/ui/Modal.tsx`
- **Source:** ui-auditor
- **Issue:** Shared accessible modal primitive exists but isn't adopted — directly causes F8 and similar future regressions.
- **Fix:** Track as a migration checklist; prioritize `PriceTrends.tsx` (F8) first, then audit remaining hand-rolled modals repo-wide.
- **Effort:** L (tracking item, execute incrementally)

### F10 [HIGH] Recipe rating/search N+1 and unbounded collection scans
- **File:** `services/recipeService.ts:301-343` (`rebuildCommunityRatedRecipesFromRatings`), `services/recipeService.ts:1034-1056` (`searchRecipesInFirestoreFallback`), `services/recipeService.ts:962-1022` (`searchRecipesInFirestore`)
- **Source:** db-auditor
- **Issue:** Per-item loop re-scans entire `recipes` collection + sequential unbatched `getDoc` calls (up to 50 iterations); fallback search does a full unbounded collection scan on any index error; primary search reads entire `recipe_search_index` collection every call then N individual `getDoc`s.
- **Fix:** Batch reads with chunked `Promise.all` on ID arrays; add `limit()` to fallback scan; add `where`/`limit` to search-index query instead of full-collection read.
- **Effort:** M

Skip for now........### F11 [HIGH] `PantryScanner.tsx` remains an oversized god component
- **File:** `components/pantry/PantryScanner.tsx`
- **Source:** code-auditor (confirmed by perf-auditor)
- **Issue:** 3,525 lines, 48 `useState`, 14 `useEffect` — largest component in repo despite partial extraction of `usePantryScannerScan.ts`/`NutritionScannerModal.tsx`.
- **Fix (2-part):**
  1. Perf quick win: verify it's behind `React.lazy()` so barcode/OCR vendor chunks (zxing/tesseract) don't load for non-scanner users — check `vite.config.ts` manualChunks + import site.
  2. Structural: continue extraction (state grouping via `useReducer` or split into scan-mode subcomponents) — larger refactor, route through `architect-reviewer` before starting.
- **Effort:** S (lazy-load check) / XL (full decomposition — defer)

### F12 [HIGH] `hooks/dataManagement/*` fully dead code (1,883 lines)
- **File:** `hooks/dataManagement/*`
- **Source:** code-auditor
- **Issue:** Entirely unimported, contradicting CLAUDE.md's documented directory map.
- **Fix:** Either delete outright (repo has precedent this pass — 11 orphaned files already removed) or wire it in if the split was intentional and mid-migration; update CLAUDE.md directory map to match reality either way.
- **Effort:** S (delete)  <~~yes, delete>

### F13 [HIGH] Recipe export modal — stored XSS via unescaped `innerHTML`
- **File:** `components/recipe-finder/RecipeExportModal.tsx:319-337`
- **Source:** security-auditor
- **Issue:** Recipe title/description/ingredients/instructions interpolated unescaped into HTML then assigned via `innerHTML` in a print window; recipe content can originate from untrusted URL imports or open community submissions (Firestore rules allow arbitrary `title` strings).
- **Fix:** HTML-escape all interpolated fields before building the print-window markup, or build DOM nodes via `textContent` instead of string-concatenated `innerHTML`.
- **Effort:** S

### F14 [HIGH] Zero CI/CD — no automated gate on push/PR
- **File:** `.github/` (missing `workflows/`)
- **Source:** infra-auditor
- **Issue:** No lint/type-check/test/build gate; release process pushes directly to main via an agent-run skill with no server-side check.
- **Fix:** Add a minimal GitHub Actions workflow: `npm run lint && npm run type-check && npm test` on PR + push to main; add a `functions/` equivalent job.
- **Effort:** M

### F15 [HIGH] EnhancedShoppingListItem not memoized, subscribes to whole AppContext
- **File:** `components/shopping-list/EnhancedShoppingListItem.tsx`
- **Source:** perf-auditor
- **Issue:** 649-line row component not `React.memo`'d, calls `useApp()` directly — any unrelated app state change re-renders every visible shopping-list row (context value depends on ~25 state pieces in `App.tsx:1471-1512`).
- **Fix:** Wrap in `React.memo`; either narrow context consumption or lift required data into props from `ShoppingListItemsSection.tsx` so the row doesn't need `useApp()` at all.
- **Effort:** M

### F16 [HIGH] Storage rules — no ownership checks on delete/write
- **File:** `storage.rules:4-11` (recipes write), `storage.rules:14-23` (recipe-photos delete)
- **Source:** security-auditor
- **Issue:** Any authenticated user can delete another user's uploaded recipe photos, or overwrite public recipe images at any path — no ownership/admin check.
- **Fix:** Add ownership check (`request.auth.uid == resource.metadata.ownerId` or equivalent) matching pattern used elsewhere in the rules file; restrict public `recipes/{recipeId}` writes to admin/service accounts or validated ownership.
- **Effort:** S

## Batch 2 — MEDIUM severity

### F17 [MEDIUM] `checkInvitation` leaks household PII on probe
- **File:** `functions/src/checkInvitation.ts:16-20`
- **Source:** api-tester
- **Issue:** Intentionally unauthenticated + unrate-limited; a successful email+householdId guess returns the full household doc including all members' PII.
- **Fix:** Add rate limiting (per-IP or per-email); narrow the response to only fields needed to confirm/deny an invitation.
- **Effort:** M

### F18 [MEDIUM] `firestore.rules` — `price_cache/priceData` fully open write
- **File:** `firestore.rules:250-253`
- **Source:** security-auditor
- **Issue:** Any authenticated user can overwrite the shared global pricing doc with zero validation, inconsistent with sibling caches that scope/validate writes.
- **Fix:** Add schema/shape validation matching `leaderboard_cache`/`system/community_rated_recipes` pattern,
- **Effort:** S

### F19 [MEDIUM] Missing composite Firestore indexes for recipe ratings
- **File:** `firestore.indexes.json`
- **Source:** db-auditor
- **Issue:** Missing indexes for `recipeRatings`(recipeTitle+householdId+date), `recipeModifications`(recipeTitle+helpful+date), `recipeRatings`(userId/householdId+date), `recipeRatings`(date range+wouldMakeAgain); the one declared rating-related index (`ratings` collection group) matches no actual query (code uses `recipeRatings`).
- **Fix:** Add the four missing composite indexes; remove or repoint the dead `ratings` collection-group index.
- **Effort:** S

### F20 [MEDIUM] `updateCommunityStats` re-reads entire rating history per submission
- **File:** `services/recipeRatingService.ts:226-271`
- **Source:** db-auditor
- **Issue:** Every rating submission re-reads full rating history for the recipe to recompute aggregates instead of incremental counters.
- **Fix:** Switch to a Firestore transaction with incremental counter fields updated via `FieldValue.increment()`.
- **Effort:** M

### F21 [MEDIUM] QuickAddModal voice-input listener leak on timeout path
- **File:** `components/pantry/QuickAddModal.tsx:127-155,142-148`
- **Source:** code-auditor + bug-auditor (same finding, both flagged it)
- **Issue:** Native voice-input `partialResults` listener is removed on successful recognition but never removed on the 10s timeout/no-speech path — leaks a live native plugin listener per failed attempt for the app session.
- **Fix:** Move listener removal into a `finally`/cleanup path shared by both success and timeout branches.
- **Effort:** S

### F22 [MEDIUM] Icon-only close buttons lack accessible names
- **File:** `components/pantry/PriceTrends.tsx:71,90`, `components/shopping-list/GroceryCostEstimator.tsx:404-409`
- **Source:** ui-auditor
- **Fix:** Add `aria-label="Close"` (or equivalent) to icon-only "✕" buttons.
- **Effort:** S

### F23 [MEDIUM] ItemDetailModal accordion buttons missing `aria-expanded`
- **File:** `components/pantry/ItemDetailModal.tsx:415-421,529-535,613-619,714-720,746-752,776-782`
- **Source:** ui-auditor
- **Fix:** Add `aria-expanded={isOpen}` to all six disclosure buttons.
- **Effort:** S

### F24 [MEDIUM] QuickAddModal primary submit button is icon-only, no accessible name
- **File:** `components/pantry/QuickAddModal.tsx:270-277`
- **Source:** ui-auditor
- **Fix:** Add `aria-label="Add item"` (or visible text) matching sibling Cancel/Voice/Scan buttons.
- **Effort:** S

### F25 [MEDIUM] `EnhancedShoppingListItem` touch targets under 44px minimum (carried forward)
- **File:** `components/shopping-list/EnhancedShoppingListItem.tsx:495,508`
- **Source:** ui-auditor
- **Fix:** Increase 36×22px targets to ≥44×44px.
- **Effort:** S

### F26 [MEDIUM] Nutrition/barcode/currency feature undocumented
- **File:** `services/nutritionService.ts`, `services/spoonacularFoodClient.ts`, `services/currencyService.ts`, `utils/barcodeScan.ts`, `components/pantry/NutritionFactsCard.tsx`, `components/pantry/NutritionScannerModal.tsx`
- **Source:** doc-auditor
- **Fix:** Add a section to README Key Features, FAQ,  and CLAUDE.md Integrations describing the nutrition/barcode/currency subsystem (Spoonacular-backed, not OpenFoodFacts).
- **Effort:** S

### F27 [MEDIUM] README dead Stripe/PayPal links contradict removal note
- **File:** `README.md:315-318`
- **Source:** doc-auditor
- **Fix:** Remove dead links; align with line 3's "Stripe and PayPal have been removed" statement.
- **Effort:** S

### F28 [MEDIUM] README references non-existent `services/firebase.ts`
- **File:** `README.md:270`
- **Source:** doc-auditor
- **Fix:** Point to `firebaseConfig.ts` / `VITE_firebaseConfig.ts` instead.
- **Effort:** S

### F29 [MEDIUM] `functions/` predeploy checks are local-only, no CI verification
- **File:** `firebase.json:21-24`
- **Source:** infra-auditor
- **Fix:** Covered by F14's CI workflow — add a `functions/` lint+build job; flag single-project (no staging/prod split) as a longer-term infra improvement.
- **Effort:** M (part of F14)

### F30 [MEDIUM] No automated Firestore/Storage rules validation
- **File:** `firestore.rules`, `storage.rules`
- **Source:** infra-auditor
- **Fix:** Add Firebase emulator-based rules unit tests to the CI workflow from F14 (`@firebase/rules-unit-testing`), covering household-scoping and the F16/F18 fixes at minimum.
- **Effort:** M

- **File### F31 [MEDIUM] No local/CI secret scanning (how the keystore leak went undetected)
:** `.github/secret_scanning.yml`
- **Source:** infra-auditor
- **Fix:** Add `gitleaks` (or similar) as a pre-commit hook and/or CI step as defense-in-depth alongside GitHub's hosted scanning. Directly relevant given F1.
- **Effort:** S

### F32 [MEDIUM] index.html / public HTML files missing SEO metadata or pointing at wrong domain
- **File:** `index.html:1-128`, `public/index.html:1-24`, `public/landing.html:1-24`
- **Source:** seo-auditor
- **Fix:** Add meta description + OG/Twitter tags + canonical link to app shell `index.html`; fix `public/index.html`/`public/landing.html` OG/Twitter metadata pointing at unowned `smartpantrychef.com` — replace with actual project domain.
- **Effort:** S

### F33 [MEDIUM] `firebase-admin`/`googleapis` version skew (root vs functions)
- **File:** `functions/package.json:20,22`
- **Source:** dep-auditor
- **Fix:** Bundled with F3 — align `firebase-admin` to `14.2.0` across root devDependency and `functions/`.
- **Effort:** Included in F3

### F34 [MEDIUM] Root eslint chain + vite-plugin-pwa + puppeteer-extra vulnerable dev-only deps
- **File:** `package.json:122-124,134`
- **Source:** dep-auditor
- **Issue:** eslint@9.21.0 chain high-severity via minimatch; `vite-plugin-pwa` pulls vulnerable workbox-build→jake→ejs chain; `puppeteer-extra`/`puppeteer-extra-plugin-stealth` vulnerable rimraf/glob/google-gax chain (only used by `scripts/scrape-allrecipes.js`).
- **Fix:** Bump eslint to 10.8.0 (major, dev-only, low risk to schedule); evaluate whether `scripts/scrape-allrecipes.js` is still needed — remove if not, else accept dev-only risk; re-check vite-plugin-pwa for a patched release.
- **Effort:** M

## Batch 3 — LOW severity / cleanup

### F35 [LOW] `NutritionScannerModal` slot keying causes React key collision on duplicate barcode scan
- **File:** `components/pantry/NutritionScannerModal.tsx:58-68,142`
- **Source:** bug-auditor
- **Fix:** De-dupe by barcode before adding to `slots`, or key by scan-attempt id instead of raw `upc`.
- **Effort:** S

### F36 [LOW] `formatCurrency` catch fallback returns wrong currency symbol
- **File:** `services/currencyService.ts:107-118`
- **Source:** code-auditor
- **Fix:** On conversion failure, either surface the raw USD amount labeled as USD, or fail loudly instead of silently mislabeling with `$`.
- **Effort:** S

### F37 [LOW] `shoppingListCacheService` cache-version check uses `>=` inconsistent with siblings
- **File:** `services/shoppingListCacheService.ts:99`
- **Source:** code-auditor
- **Fix:** Change to `===` to match the invalidation contract used by other `*CacheService` files.
- **Effort:** S

### F38 [LOW] Direct `onSnapshot` bypasses `useDataManagement.ts`
- **File:** `components/leftovers/LeftoversHotZone.tsx:2,31`
- **Source:** code-auditor
- **Note:** Prior audit pass found this component orphaned/unmounted — verify it's actually rendered anywhere before spending effort; if orphaned, delete instead of refactoring.
- **Fix:** If in use: route through `useDataManagement.ts`/appropriate hook per CLAUDE.md's data-flow rule. If orphaned: delete.
- **Effort:** S

### F39 [LOW] `pantry_images` storage read rule not household/owner scoped
- **File:** `storage.rules:31-34`
- **Source:** security-auditor
- **Fix:** Scope read to household members/owner, matching the comment's stated intent.
- **Effort:** S

### F40 [LOW] Duplicate dead `leaveHousehold`/`leaveHouseholdHttp` implementation
- **File:** `functions/src/inviteMember.ts:201-465`
- **Source:** api-tester
- **Fix:** Delete the unexported duplicate (diverges from real implementation — no claim cleanup, wrong collections, `'admin'` vs `'Admin'` casing bug).
- **Effort:** S

### F41 [LOW] `resetUsageLimitsNow` deployed as public 403 stub
- **File:** `functions/src/resetUsageLimits.ts:113-123`
- **Source:** api-tester
- **Fix:** Remove from deployment (unexport or delete) since it's permanently disabled.
- **Effort:** S

### F42 [LOW] Unbounded full-collection scans in scheduled functions
- **File:** `functions/src/resetUsageLimits.ts:22-23`, `functions/src/dailyReminders.ts:299`
- **Source:** api-tester
- **Fix:** Paginate with `.limit()` + cursor loop instead of unbounded `db.collection('users').get()`.
- **Effort:** M

### F43 [LOW] Unused/dead dependencies
- **File:** `package.json:78` (`adb`), `package.json:125` (`react-router-dom`), `functions/package.json:18-19,24` (`@paypal/paypal-server-sdk`, `@paypal/react-paypal-js`, `stripe`)
- **Source:** dep-auditor
- **Fix:** Remove all — zero references found; `react-router-dom` removal also clears 2 of the high-severity dep findings transitively.
- **Effort:** S

### F44 [LOW] README roadmap items stale
- **File:** `README.md:328-329`
- **Source:** doc-auditor
- **Fix:** Mark "Barcode/Product Lookup" as implemented (Spoonacular-backed, not OpenFoodFacts); update onboarding roadmap note to reflect current `ModernOnboarding.tsx` design, not the deleted `FirstTimeFlow.tsx`/`ValueDemo.tsx`.
- **Effort:** S

### F45 [LOW] `householdDataMigrationService` vs `householdMigrationService` naming ambiguity
- **File:** `services/householdDataMigrationService.ts`
- **Source:** doc-auditor
- **Fix:** Add a one-line doc comment distinguishing the two services' responsibilities, or merge if truly redundant.
- **Effort:** S

### F46 [LOW] SEO — sitemap/robots/landing page gaps
- **File:** `public/landing.html:453-468` (404ing screenshots), `public/landing.html:389-393` (dead nav routes), missing `robots.txt` for app hosting site, `website/sitemap.xml` missing `<lastmod>`, `website/index.html:58-63` hardcoded `"price": "0"` in JSON-LD despite paid tiers.
- **Source:** seo-auditor
- **Fix:** Fix/remove broken screenshot references, remove or implement dead nav links, add app-site `robots.txt`, add `<lastmod>` to sitemap entries, correct JSON-LD pricing or omit `offers.price`.
- **Effort:** S (batch of small fixes)

### F47 [LOW] `verifyPurchase.ts` / `deleteAccount.ts` / `inviteMember.ts` minor hardening
- **File:** `functions/src/verifyPurchase.ts:41-52`, `functions/src/deleteAccount.ts:60`, `functions/src/inviteMember.ts:16,166`
- **Source:** api-tester
- **Fix:** Add schema validation for receipt shape (verifyPurchase); reconcile hard-coded subcollection cleanup list with actual `*CacheService` paths + add retry checkpoint if `auth.deleteUser` fails post-cleanup (deleteAccount); add email format validation + invite cooldown (inviteMember).
- **Effort:** M

## Batch 4 — Carried forward from prior UI+bugs audit pass (2026-07-30, still unresolved)

Orphaned-component keep/wire/delete calls and design-system items that were still open when the prior audit's FIXES.md was superseded by this pass. Renumbered into this sequence; not re-verified by this pass's auditors (outside their scope), so re-confirm still-orphaned status before acting.

### F48 [HIGH] `UseSoonRecommendations.tsx` orphaned — core waste-reduction feature never wired in
- **File:** `components/pantry/UseSoonRecommendations.tsx`
- **Source:** prior UI audit (P2)
- **Issue:** Not redundant with `SmartRecommendations.tsx` — dedicated per-item urgency view with delete-from-inventory action and multi-recipe suggestion chips that the generic component lacks. Never rendered by any live parent.
- **Fix:**  port its per-item features into `SmartRecommendations.tsx`.
- **Effort:** M (needs product decision first)

### F49 [MEDIUM] Camera/permission UI — dead duplicate + broken generalized version
- **File:** `components/pantry/CameraPermissionsModals.tsx`, `components/ui/ContextualPermissions.tsx`, inline duplicate in `components/pantry/PantryScanner.tsx:323-325,3273+`
- **Source:** prior UI audit (P1 item 7 / P2)
- **Issue:** Live permission-education UX is a byte-for-byte inline duplicate of `CameraPermissionsModals.tsx` inside `PantryScanner.tsx`, correctly wired to native `@capacitor/camera`. `ContextualPermissions.tsx` is the generalized version but uses `navigator.mediaDevices` — wrong API for native builds, broken as-is.
- **Fix:** Extract the inline `PantryScanner.tsx` logic back into `CameraPermissionsModals.tsx` (dedupe), delete `ContextualPermissions.tsx` unless someone commits to rewriting it against the native API.
- **Effort:** M

### F50 [MEDIUM] `RecipeCommunityInsights.tsx` orphaned — ratings collected with nowhere to display
- **File:** `components/recipe-modal/RecipeCommunityInsights.tsx`
- **Source:** prior UI audit (P2)
- **Issue:** Rating *submission* is live (`RecipeRatingUI` inside `RecipeModal.tsx` writes via `RecipeRatingService.submitRating`), but the aggregate display component was only reachable via the now-deleted `RecipeRatingPage.tsx`. `RecipeRating.tsx` already accepts an unused `communityStats` prop.
- **Fix:** Wire `RecipeCommunityInsights.tsx` into `RecipeModal.tsx` via the existing `communityStats` prop path. Do not delete.
- **Effort:** S-M

### F51 [LOW] `RecipeRecommendations.tsx` newly orphaned (side effect of deleting `RecipeRatingPage.tsx`)
- **File:** `components/recipes-meals/RecipeRecommendations.tsx`
- **Source:** prior UI audit (P2)
- **Issue:** Confirmed orphaned — repo-wide grep for `RecipeRecommendations`/`<RecipeRecommendations` finds only its own definition/export and an unrelated `scripts/fix-imports.mjs` path-mapping table; no JSX usage anywhere. `services/recipeRecommendationService.ts` (`getPersonalizedRecommendations`) is likewise only consumed by this component. Not redundant with the live `components/pantry/SmartRecommendations.tsx` (rendered in `RecipeFinder.tsx`): `SmartRecommendations` is a client-side heuristic dashboard nudge (pantry/saved-recipe overlap, time-of-day, expiring items, premium upsell, onboarding) with no backend service, while `RecipeRecommendations` is a server-driven personalized recommendation engine (household-loved, trending, similar-ingredients, seasonal, personal-preference types) that reads household rating data plus user cuisine/protein/dislike preferences and produces per-type confidence scoring — none of which `SmartRecommendations` does.
- **Fix:** Keep, do not delete — offers functionality no live component covers. Recommended wire-in point: render inside `RecipeFinder.tsx` alongside/below `SmartRecommendations` (both already live there), passing current pantry item names as `pantryItems` and the user's dietary restrictions; needs a product decision on placement/visibility (e.g. collapsed section, or replacing `SmartRecommendations`' "Recipe Match" bucket) before implementing — not implemented here.
- **Effort:** S (investigate) — wire-in itself is a separate M-effort product decision

### F52 [LOW] `FeatureTooltip.tsx` orphaned — only post-onboarding feature-discovery component
- **File:** `components/auth-onboarding/FeatureTooltip.tsx`
- **Source:** prior UI audit (P2)
- **Fix:**  wire in.
- **Effort:** M

### F53 [LOW] `OfflineShoppingIndicator.tsx` orphaned
- **File:** `components/shopping-list/OfflineShoppingIndicator.tsx`
- **Source:** prior UI audit (P2)
- **Fix:** Complementary to `AppHeader.tsx`'s compact global connectivity icon, not a duplicate. Wire into `ShoppingList.tsx` near `ShoppingListActionBars`, using the existing `isOnline`/`offlineQueue` state.
- **Effort:** S

### F54 [LOW] `HouseholdStatusIndicator.tsx` orphaned
- **File:** `components/household/HouseholdStatusIndicator.tsx`
- **Source:** prior UI audit (P2)
- **Fix:** Presence logic already duplicated as condensed text in `AppHeader.tsx`'s `activityText` memo (lines 289-357) — adding to header would be redundant. Wire into `Household.tsx`'s member list instead for a richer per-member view.
- **Effort:** S

### F55 [LOW] `SettingsHelpSection.tsx` orphaned — no Help/FAQ entry point
- **File:** `components/settings/SettingsHelpSection.tsx`
- **Source:** prior UI audit (P2)
- **Fix:** Generic, logic-free FAQ card; `Settings.tsx` already has `showFAQModal`/`FAQPage` — just needs to be dropped in wired to that.
- **Effort:** S

### F56 [LOW] Admin dashboards orphaned — no consolidated admin UI
- **File:** `components/admin-analytics/MonitoringDashboard.tsx`, `PerformanceMonitoringDashboard.tsx`, `UserBehaviorAnalytics.tsx`
- **Source:** prior UI audit (P2)
- **Fix:** Consolidate into one admin-gated settings menu using the existing `useIsAdmin(user?.id)` check in `Settings.tsx`, rather than deleting.
- **Effort:** M

### F57 [LOW] Remaining orphaned components — likely safe delete
- **File:** `components/pantry/SmartCategorySelector.tsx`, `components/pantry/PantryAnalytics.tsx`, `components/ui/RiskExplanationModal.tsx`
- **Source:** prior UI audit (P2)
- **Fix:** Confirm zero live importers, then delete alongside the batch of 11 orphans already removed this pass.
- **Effort:** S

### F58 [LOW] `AddMealDialog.tsx` — no Escape/backdrop dismiss, no `role="dialog"`
- **File:** `components/meal-planner/AddMealDialog.tsx:29`
- **Source:** prior UI audit (P3)
- **Fix:** Same `Modal.tsx` non-adoption pattern as F8/F9 — migrate onto `Modal.tsx`.
- **Effort:** S

### F59 [LOW] `EmptyState.tsx` underadopted
- **File:** `components/ui/EmptyState.tsx`
- **Source:** prior UI audit (P3)
- **Fix:** Only used by `CurrentDayMealsSection.tsx`; audit other empty-list UIs for hand-rolled equivalents and migrate.
- **Effort:** S

### F60 [LOW] Settings nav icon collides visually with theme-toggle icon
- **File:** `components/layout/AppNavigation.tsx:20`, `components/layout/AppHeader.tsx:526`
- **Source:** prior UI audit (P3)
- **Fix:** Both use a "Sun"-style icon; swap one for a visually distinct icon.
- **Effort:** S

### F61 [LOW] Inconsistent close-button icon
- **File:** `components/layout/AppHeader.tsx:339,401,487` (literal `✕` glyph) vs `components/ui/Modal.tsx:286` (`<X />` icon)
- **Source:** prior UI audit (P3)
- **Fix:** Standardize on one close-icon component.
- **Effort:** S

### F62 [LOW] No standardized undo pattern
- **File:** global header undo (latest-action-only) vs `components/shopping-list/ShoppingListUndoBanners.tsx` (separate local pattern)
- **Source:** prior UI audit (P3)
- **Fix:** Consolidate to one undo mechanism, or document why two coexist.
- **Effort:** M

### F63 [LOW] Notification/activity dropdowns aren't real popovers
- **File:** `components/layout/AppHeader.tsx:320-452,479-496`
- **Source:** prior UI audit (P3)
- **Fix:** Auto-closes on a 15s timer mid-read with no `role="menu"`/focus trap. Add proper popover semantics and remove the forced timeout close.
- **Effort:** M

### F64 [LOW] No single shared paywall/"limit reached" component
- **File:** repo-wide — each usage limit (recipes, meal plans, household) rolls its own copy/UI
- **Source:** prior UI audit (P3)
- **Fix:** Extract one shared `PaywallPrompt`/`LimitReachedCard` component, migrate call sites.
- **Effort:** M

---

## Suggested execution order

1. **Batch 0** (F1–F3) — today, before anything else touches `main` or ships.
2. **Batch 1** (F4–F16) — this sprint; F4 (LeftoverAnalytics) and F13 (XSS) are single-file S-effort with real user/security impact, do first within the batch.
3. **Batch 2** (F17–F34) — next sprint; group F19+F20 (db-auditor) as one PR, group F22–F25 (ui-auditor a11y) as one PR, group F27+F28+F44+F45 (doc-auditor) as one docs-only PR.
4. **Batch 3** (F35–F47) — opportunistic/cleanup, bundle into pre-existing PRs touching the same files rather than standalone.
5. **Batch 4** (F48–F64) — carried-forward orphan/design-system items; F48-F50 (UseSoonRecommendations, camera-permission dedupe, RecipeCommunityInsights) are the highest-value re-wires and need a product call first, route through `architect-reviewer`; F51-F57 (remaining orphans) each need their own quick keep/delete call before batching into PRs; F58-F64 (design-system) bundle into one pass whenever there's slack.

Deferred (not a fix-batch item, tracked separately): full `PantryScanner.tsx` decomposition (F11 part 2) and `hooks/dataManagement/*` disposition (F12) both need a product/codeowner decision before execution — route through `architect-reviewer` first. Also deferred per standing decision (2026-07-29, see project memory): tab-controls triplication (`RecipeFinderTabs` vs `ShoppingListViewModeToggle` vs native `<select>`) and `App.tsx` modal-state sprawl (8+ scattered `useState(false)` flags) — both flagged again in this pass's Batch 4 context but intentionally not re-batched.
