---
agent: fix-planner
status: open
date: 2026-07-31
revised: 2026-08-06
sources: code-audit, bug-audit, security-audit, ui-audit, perf-audit, db-audit, dep-audit, doc-audit, infra-audit, seo-audit, api-audit (2026-07-31 pass); db/api/security-audit-subscription (2026-08-05 pass)
findings: 65
remaining: 8
completion:
  shipped: 2026-08-01
  commits: 65850eb (F01-F58 full pass), 7fbd0dc (P2 batch), be61eed (P3 batch)
  subscription_pass: F59-F65 verified fixed in working tree as of 2026-08-06
  fixbatch: F38-F39 closed 2026-08-07
---
# FIXES.md — Consolidated Fix Plan

**Status: 60 of 65 closed.** F01–F36, F38-F39, F41, F42, F43, F44–F50, F51–F65 verified fixed. 5 items remain, all P2/P3 refactors and deferrals — no open P0 or P1.

Verified against the working tree on 2026-08-06 (not merely against the shipping commits). Effort: S (<1h), M (half-day), L (multi-day).

---

## Remaining work

### P2 — Quality / maintenance

- [x] **F36. `PantryScanner.tsx` god component** — **M** *(closed 2026-08-05)*
  3,427 → **1,010 lines**. Quick-consume/swipe-gesture row handlers extracted to `components/pantry/usePantryQuickConsume.ts`. VirtualizedRow no longer exists (removed in an earlier pass, `PantryList.tsx` unnecessary); scanner phases already split across `AddItemsModal`/`ScanReviewModal`/`usePantryScan`.
  `components/pantry/PantryScanner.tsx` · **Sources:** code 1, perf 8

- [ ] **F37. `Community.tsx` second god component** — **S** *(was M; substantially reduced)*
  1,766 → **909 lines** and relocated to `components/household/`. Split feed/actions/effects if it grows again; low urgency at current size.
  `components/household/Community.tsx` · **Sources:** code 2 (+8)

- [x] **F38. Twin notification services with colliding `NotificationItem` types** — **M** *(closed 2026-08-07)*
  Type collision was already resolved in a prior pass (`AppNotification` vs `NotificationCacheItem`, cross-referencing doc comments). Completed the remaining ask: renamed the files to role-based names — `notificationService.ts` → `services/notificationBuilderService.ts`, `notificationsService.ts` → `services/notificationCacheService.ts` — and updated all 18 importers plus cross-referencing comments (`dailyReminders.ts`, doc comments in both files). `constants/changelogEntries.ts`'s historical entries intentionally left untouched (frozen changelog text, not live code).
  `services/notificationBuilderService.ts`, `services/notificationCacheService.ts` · **Sources:** code 3

- [x] **F39. Blanket `no-explicit-any` disables** — **M** *(closed 2026-08-07)*
  `AppActionsContext` was already fully typed (no `any`). All 10 named files (`MonitoringDashboard`, `PerformanceMonitoringDashboard`, `AppGlobalModals`, `LeftoverQuickCapture`, `PantryItemRow`, `QuickAddModal`, `usePantryScan`, `CookingMode`, `MealPlanner`, `PopularRecipes`) already used scoped `eslint-disable-next-line`, not blanket file-level disables — the remaining work was eliminating the individual `any` occurrences: typed `DatabaseMetrics` (exported from `databaseMonitoringService.ts`) into the two dashboards, `PerformanceObserver` entries to their DOM types, `AppGlobalModals`' `modals`/`notificationHandlers`/`featureMilestones` props via `ReturnType<typeof useXxx>`, `handleDeleteRecipe`/`submitRating`/`onRate`/`onAddToPlan` to `SavedRecipe`/`RecipeRating`/`StructuredRecipe`, `PantryItemRow`'s `getRowActionHandlers` to the existing `PantryRowActionHandlers` type, and `catch (err: any)` blocks to `catch (err)` with `instanceof Error` narrowing. Added `types/webSpeech.ts` (a minimal typed Web Speech Recognition surface, since no official TS lib covers it) shared by `QuickAddModal.tsx` and `CookingMode.tsx`, replacing two separate ad-hoc `any`-based shims.
  **Sources:** code 5

- [ ] **F40. Bespoke `fixed inset-0` overlays** — **L**
  Still **28 files** (was 27 — grew slightly). Migrate to `Modal`/`BottomSheet`; lint-ban new ones. Includes padding-var underlap fix.
  **Scoping pass (2026-08-07, no code changed):** classified all 40 `fixed inset-0` occurrences. Breakdown —
  **23 MODAL sites** (migrate to `<Modal>`): `RecipeModalDetailsSection.tsx:234` (substitutions, self-gated), `AppGlobalModals.tsx:432` (badge-unlocked, explicit-button-only close), `LeftoverAnalytics.tsx:547` (achievements), `HouseholdInviteModal.tsx:56` (needs close-trigger check past line 100), `Household.tsx:306/361/388` (3 sequential early-return dialogs sharing one visual shell — consider collapsing into one `<Modal>` with conditional body), `RecipeImportModal.tsx:85`, `Community.tsx:671` (badge detail) `Community.tsx:783` (waste report), `RecipeFinderSavedView.tsx:394/489`, `SubscriptionManager.tsx:546/667`, `ExpiredItemsModal.tsx:148`, `Settings.tsx:1517` (member prefs), `Settings.tsx:1734` (FAQ wrapper — wraps standalone-fullscreen `FAQPage`, only the wrapper migrates), `Settings.tsx:1763` (delete-account confirm, simplest candidate), `CategoryManager.tsx:104`, `PantryScanner.tsx:947` (wraps `FreezeTransitionModal` — inner component's header needs extracting into Modal's title slot), `NotificationSettings.tsx:335` (needs close-trigger check past line 360), `PantryImportModal.tsx:106`, `CameraPermissionsModals.tsx:31/92` (both button-only close, no X/backdrop), `RecipeModal.tsx:803` (large/complex: tabs + editable custom header — substantial migration, do last).
  **2 BOTTOMSHEET sites** (migrate to `<BottomSheet>`): `AppGlobalModals.tsx:218` (risk questionnaire wrapper — title lives inside child `RiskAssessmentQuestionnaire`, needs threading), `WhatsNewModal.tsx:72` (dual controlled/uncontrolled-via-localStorage logic must be preserved), `ModernOnboarding.tsx:444` (multi-step flow — evaluate step-header against Body/Footer slots carefully).
  **4 FULLSCREEN — leave as bespoke `fixed inset-0`, add lint-exception comment when the lint rule lands:** `ChangelogPage.tsx:71`, `FAQPage.tsx:585`, `CookingMode.tsx:502/516`.
  **6 NOT-A-MODAL — do not touch, not dialogs:** `CurrentDayMealsSection.tsx:239` (dropdown click-catcher), `AppGlobalModals.tsx:428` + `Community.tsx:905` (decorative canvas confetti/fireworks), `ContextualTutorial.tsx:101` + `FeatureDiscovery.tsx:129` (tutorial spotlight backdrops), `Login.tsx:278` (decorative gradient layer).
  Recommended execution for the next batch: sequential, file-by-file, simplest first (`Settings.tsx:1763` delete-confirm is the best starting point), saving `RecipeModal.tsx`, `Household.tsx`'s 3-dialog shell, and `PantryScanner.tsx`'s wrapped `FreezeTransitionModal` for last since they need structural care beyond a wrapper swap. Add the lint-ban only after all MODAL/BOTTOMSHEET sites are migrated (FULLSCREEN sites need an explicit exception carve-out first).
  **Sources:** ui 6 (+17)

- [x] **F41. App.tsx modal sprawl → reducer-based modal router** — **M** *(closed 2026-08-07, verified already resolved)*
  App.tsx is down to **633 lines / 4 useState** (from 3,427); no modal state remains in App.tsx itself — it all already lives in `useAppModals`. F18 and F23, the items this was blocking, are both independently closed (see Closed items). A reducer-based router over the remaining 4 non-modal `useState` calls would be pure-optional consolidation with no correctness or unblocking value; not implemented.
  `App.tsx` · **Sources:** code 4, ui 7

- [x] **F43. `max-w-md` hard cap wastes tablet/desktop/foldable space** — **M** *(closed 2026-08-07, verified already resolved)*
  Both `App.tsx` occurrences (main shell container, household-invite banner) already carry `md:max-w-lg lg:max-w-2xl` per-breakpoint scaling — confirmed via `git log -p`, the breakpoints were added in a prior commit. FIXES.md's "2 occurrences remain" was stale. No bare unscaled `max-w-md` remains.
  `App.tsx` · **Sources:** ui 16

- [ ] **F49. Migrate off `@codetrix-studio/capacitor-google-auth`** — **L**
  Abandoned RC pinned to Capacitor 6 while project is on 8. Move to `@capacitor-firebase/authentication` or `@capgo/capacitor-social-login`; retires the patch-package gradle patch.
  **Note (2026-08-06):** the `--legacy-peer-deps` requirement this item cited is **already retired** — a scoped `overrides` block in `package.json` now pins the plugin to the hoisted `@capacitor/core`. The migration remains worthwhile for the gradle patch and RC-version risk, but is no longer install-blocking.
  **Sources:** dep §4

- [x] **F50. Android provisioning/config drift** — **S** *(closed 2026-08-07, verified already resolved)*
  Both halves already done: `android/README.md` documents `google-services.json` provisioning (intentionally gitignored per security commit `2b9c93e2`, with pull-from-Firebase-console steps) and the SDK-version single-source (`android/variables.gradle` is authoritative, cross-referenced by comments in `libs.versions.toml` and both `build.gradle` files, each explicitly citing F50).
  `android/README.md`, `android/variables.gradle`, `android/gradle/libs.versions.toml`, `android/build.gradle`, `android/app/build.gradle` · **Sources:** infra M4, M5

### Deferred (revisit on trigger, not scheduled)

- [ ] **F32. Third-party client TTL/timeout defects — Spoonacular portion only** — **M**
  Nutrition and currency TTL fixes shipped and are stable. **Still open:** Spoonacular clients have no `fetchWithTimeout` and don't distinguish 402/401/429 from "no results" (verified: zero matches for either pattern in `spoonacularRecipeClient.ts`).
  `services/spoonacularFoodClient.ts`, `services/spoonacularRecipeClient.ts`
  **Trigger to schedule:** any quota-exhaustion or hung-request incident. **Sources:** api 14, 16 (+19, 20)

- [ ] **F33. i18n: 7 shipped locales but ~80% of UI hardcoded English** — **L**
  All 7 locale files present (`de, en, es, fr, ja, ru, zh`). Priority batch if resumed: nav labels, `ui/` primitive defaults, toasts, empty states; add scoped `react/jsx-no-literals` lint; then double coverage (~345 keys/locale).
  **Trigger to schedule:** expansion to a non-English user base. **Sources:** ui 15 (+14)

---

## Ordering for remaining items

Only one hard constraint survives — the rest are independent and can be picked up in any order:

1. **F41 before F40's final pass** — a modal router makes the 28-file overlay migration mechanical rather than bespoke per-site. Doing F40 first means touching those files twice.

Suggested sequence by cost: **F50, F37** (small) → **F43, F41** (medium) → **F40, F49, F33** (large). F32 sits outside the sequence until its trigger fires.

---

## Closed items

All verified against the working tree on 2026-08-06.

**P0 — data loss / security / payment integrity (12/12 closed):**
F01 `checkInvitation` PII leak · F02 purchase-token replay · F03 `inviteMember` consentless membership · F04 client-bundle secrets · F05 cache serialization field loss · F06 `CACHE_VERSION` wipe · F07 whole-doc `setDoc` races · F08 migration checkpoint loss · F09 offline-queue poison pills · F10 Firestore membership rules · F11 uncommitted Android config · F12 `image_cache/global` shared doc

**P1 — major correctness / UX / perf (21/22 closed):**
F13 Gemini 429 retry · F14 OpenRouter usage caps · F15 `getUserHouseholds` query · F16 `useOfflineStatus` re-renders · F17 image-cache `Date` revival · F18 `useAndroidBack` stack · F19 add-to-plan dialog · F20 UTC/local date mixing · F21 FEFO consumption · F22 index-based mutation races · F23 AppContext re-renders · F24 `inviteMember` DoS/enumeration · F25 HTTP fallback wrappers · F26 App Check · F27 dependency hygiene · F28 CI production build · F29 `deleteAccount` orphans · F30 `resetUsageLimits` caps · F31 `subscriptionNotifications` tier default · F34 non-guest `addItems` · *(F32, F33 deferred — see above)*

**P2 — quality / maintenance (7/16 closed):**
F35 Firebase bundle splitting · F42 tap targets · F44 native `alert()` (0 remaining) · F45 focus trap · F46 rating/search scans (`searchTokens` indexed lookup landed) · F47 cache 1MB telemetry · F48 functions toolchain (TS 5.7.3, ESLint 9.39.5)

**P3 — docs / SEO / nice-to-have (8/8 closed):**
F51 canonical/OG + robots · F52 OG image + twitter metas · F53 manifest icons · F54 per-tab `document.title` · F55 SPA rewrite + import map · F56 CLAUDE.md corrections · F57 `.env.example` regeneration · F58 readme refresh · plus the also-P3 one-liner batch

**Subscription/membership-tier pass, 2026-08-05 (7/7 closed):**
- **F59** `ownerSubscriptionTier` client-writable — `ownerSubscriptionTierUnchanged()` guard at `firestore.rules:59-60`, wired into the household update rule at line 161.
- **F60** `linkedPurchaseToken` plan-switch clobber — resolved via a `superseded` flag rather than reading `linkedPurchaseToken`: server compares incoming token against `currentSub.purchase_token` and marks stale tokens superseded (`subscriptionNotifications.ts:210-241`); client passes `oldPurchaseToken` with `replacementMode: 'IMMEDIATE_WITH_TIME_PRORATION'` (`purchaseService.ts:183,225-226`) sourced from `SubscriptionManager.tsx:123`.
- **F61** no scheduled entitlement re-check — `functions/src/checkExpiredSubscriptions.ts` added.
- **F62** RTDN no-retry + swallowed errors — `retry: true` at `subscriptionNotifications.ts:120`, rethrow with a max-retry-age cap.
- **F63** duplicated `PRODUCT_TIER_MAP` — single source at `constants/productTierMap.json`, generated into `functions/src/generated/productTierMap.ts` and imported by both sides.
- **F64** dead optimistic `updateSubscription` write — call removed from `SubscriptionManager.tsx`; `subscriptionUnchanged()` left intact.
- **F65** `canAddHouseholdMember` missing status clamp — `isSubActive`/`effectiveTier` gate now applied at `usageService.ts:412-413`, matching `getUsageLimits`.
