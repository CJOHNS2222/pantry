---
agent: bug-auditor
status: warn
findings: 17
---

# Bug Audit — Stock & Spoon

## Summary

Re-run against the current uncommitted working tree. **11 of the 26 findings from the prior pass have been resolved** in this diff: 10 previously-orphaned components/hooks/services were deleted outright (`FirstTimeFlow.tsx`, `ValueDemo.tsx`, `PortionSelector.tsx`, `BulkQuantityEditModal.tsx`, `RecipeModalTimerSubstitutionsSection.tsx`, `RecipeRatingPage.tsx`, `SettingsPowerFeaturesSection.tsx`, `usePantryBulkActions.ts`, `usePantryFilters.ts`, `useToasts.ts`, `writeQueueService.ts`), and the shopping-list silent-catch write bug (`ShoppingList.tsx` `handleUpdateItem`, old finding #26) is now fixed with proper `log.error` + optimistic-rollback + user-facing toast.

This pass audited the new diff itself (currency-display layer, new nutrition/barcode-scanner feature, native voice input, App/Settings/Household tweaks) plus re-verified the remaining previously-reported orphaned components (still orphaned, unchanged by this diff — listed below for continuity, not newly discovered). Found one high-severity data-correctness bug (wrong dollar figures shown to users), one native-resource-leak bug in the new voice-input flow, and one minor React key-collision edge case in the new nutrition comparison UI.

## Findings

### New in this diff

1. **[HIGH] `components/leftovers/LeftoverAnalytics.tsx:483,495,623`** — "Value Saved (Est.)" and "Net Savings (Est.)" now display the wrong metric, inflating figures. While wiring up the new `formatCurrency()` currency-display layer, `analytics.estimatedValueSaved` was swapped for `analytics.moneySaved`. These are not the same value:
   ```
   estimatedValueSaved = totalServingsConsumed * avgCostPerServing        (line 279)
   moneySaved = moneySavedFromCooking + estimatedValueSaved               (line 303; moneySavedFromCooking = wasteData?.totalCookedValue)
   ```
   - Line 483 "Value Saved (Est.):" now renders `moneySaved`, double-counting `moneySavedFromCooking` on top of what the label describes.
   - Line 495 "Net Savings (Est.):" computes `moneySaved - estimatedValueWasted`, mixing two different bases, so it no longer reconciles with the "Value Saved" / "Potential Waste" rows shown directly above it.
   - The "Eco Savings" hero stat (line 623) already correctly used `moneySaved`, so that same inflated number is now shown twice under two different, contradictory labels.
   **Fix:** revert line 483 to `formatCurrency(analytics.estimatedValueSaved)` and line 495 to `formatCurrency(analytics.estimatedValueSaved - analytics.estimatedValueWasted)`; keep `moneySaved` only for the "Eco Savings" hero stat.

2. **[MEDIUM] `components/pantry/QuickAddModal.tsx:142-148`** — native voice-input `partialResults` listener leaks on timeout/no-speech.
   ```ts
   const { matches } = await new Promise<{ matches: string[] }>((resolve, reject) => {
     const listener = SpeechRecognition.addListener('partialResults', (data) => {
       listener.then(h => h.remove());
       resolve(data);
     });
     setTimeout(() => reject(new Error('timeout')), 10000);
   });
   ```
   The listener is only removed inside its own callback (i.e. only if speech is actually recognized in time). If the user says nothing for 10s, the promise rejects via the timeout; the listener handle registered at line 143 is never removed. Each timed-out mic tap leaks another live listener on the native plugin (not tied to component lifecycle), which accumulates for the app session and can fire against stale closures later.
   **Fix:** capture the listener handle outside the executor and remove it unconditionally after the awaited promise settles (success, reject, or timeout), e.g. via a `finally`.

3. **[LOW] `components/pantry/NutritionScannerModal.tsx:58-68,142`** — duplicate-barcode scan produces a React key collision. `slots` is keyed by `slot.upc` with no de-dup check before `setSlots(prev => [...prev, { upc: barcode, ... }])`. Scanning the same product twice (re-scan after a bad read, or comparing two of the same item) yields two slots sharing one key; React may fail to reconcile them correctly, and the completion handler's `s.upc === barcode` match updates both simultaneously.
   **Fix:** guard against re-adding an existing `upc`, or key slots by a generated id instead.

### Still outstanding from prior pass (unchanged by this diff — not newly discovered, listed for continuity)

4. **`components/leftovers/LeftoversHotZone.tsx`** — never imported/rendered anywhere; `constants/changelogEntries.ts:2072` claims a fix was shipped for it.
5. **`components/pantry/SmartCategorySelector.tsx`** — never rendered; category-suggestion UX unreachable.
6. **`components/pantry/UseSoonRecommendations.tsx`** — never rendered; expiring-item recipe recommendations unreachable.
7. **`components/pantry/modals/CameraPermissionsModals.tsx`** — never rendered; no in-app guidance shown on camera-permission denial.
8. **`components/ui/RiskExplanationModal.tsx`** — never rendered; no way to open the risk-level explanation shown elsewhere.
9. **`components/shopping-list/OfflineShoppingIndicator.tsx`** — never rendered; no offline/sync cue on the shopping list.
10. **`components/settings/SettingsHelpSection.tsx`** — never rendered; no Help/FAQ entry point in Settings.
11. **`components/pantry/PantryAnalytics.tsx`** — never rendered; its `AnalyticsService` view-tracking call never fires.
12. **`components/ui/ContextualPermissions.tsx`** — never rendered; raw OS permission prompts shown with no in-app context first.
13. **`components/household/HouseholdStatusIndicator.tsx`** — never rendered.
14. **`components/admin-analytics/MonitoringDashboard.tsx`**, 15. **`PerformanceMonitoringDashboard.tsx`**, 16. **`UserBehaviorAnalytics.tsx`** — three admin/monitoring dashboards, fully dead.
17. **`components/auth-onboarding/FeatureTooltip.tsx`** — never rendered; onboarding tooltip flow unreachable.

Re-verified (grep for each symbol across the repo, excluding the defining file and `src/test/smoke-all-components.test.tsx`, which imports components generically for smoke-testing and doesn't count as real usage): all 14 above are still zero-reference. Recommend a product decision (wire in vs. delete) rather than repeated re-flagging each audit pass.

## Findings

### Critical — Orphaned features (component exists, built, never rendered)

1. **`components/leftovers/LeftoversHotZone.tsx`** (whole file, `export default function LeftoversHotZone`) — Not imported anywhere in the app. `constants/changelogEntries.ts:2072` even has a changelog entry ("LeftoversHotZone Doc Snapshot: Rewritten to use Firestore doc snapshot listener for live updates") describing a fix to this component, implying it was wired up at some point and later lost its mount point (or was removed from a parent during a refactor). **Symptom:** users never see the leftovers "hot zone" surface described in the changelog; the linked live-update fix is effectively invisible/unused. **Fix:** re-mount `<LeftoversHotZone householdId={...} onNavigateToRecipes={...} />` in the leftovers/dashboard view it was designed for, or remove the dead code and the stale changelog claim.

2. **`components/pantry/PortionSelector.tsx`** — Full portion-scaling UI (`calculatePortionScaling`, `PORTION_PRESETS`, `getRecommendedServings`) never rendered. **Symptom:** any "scale recipe/portions by household size" feature is unreachable — users can't adjust serving sizes via this control anywhere. **Fix:** wire into the recipe/meal-planning flow it was built for, or remove.

3. **`components/pantry/SmartCategorySelector.tsx`** — Category auto-suggestion selector (`getCategorySuggestions`, `getAllCategories`) never rendered. **Symptom:** pantry item category suggestions/autocomplete this component implements never appear; users fall back to manual category entry. **Fix:** mount in the add/edit-item form, or remove.

4. **`components/pantry/UseSoonRecommendations.tsx`** — "Use it soon" recipe recommendation panel (ties expiring pantry items to recipe suggestions) never rendered. **Symptom:** a core expiration-reduction feature (recommend recipes for soon-to-expire items) is completely invisible to users despite being fully built. **Fix:** mount on the Pantry or Dashboard tab; high product value if genuinely missing.

5. **`components/pantry/modals/BulkQuantityEditModal.tsx`** — Bulk quantity-edit modal for multi-selected pantry items, never rendered. **Symptom:** any "select multiple items → bulk-edit quantity" UX is unreachable even if a bulk-select mode exists elsewhere (see also `usePantryBulkActions` below, also orphaned — the whole bulk-edit subsystem appears disconnected). **Fix:** wire into `PantryList`/`PantryScanner` bulk-select flow.

6. **`components/pantry/modals/CameraPermissionsModals.tsx`** — Camera permission pre-prompt/denied modals (uses `@capacitor/camera`), never rendered. **Symptom:** on native, if camera permission is denied, the user gets no explanatory modal telling them how to proceed — likely falls through to a generic error or silent failure instead of this purpose-built guidance UI. **Fix:** invoke from the camera/scan entry points (`PantryScanner.tsx`) on permission-denied.

7. **`components/ui/RiskExplanationModal.tsx`** — Explains food-safety "risk level" concepts (Shield/Clock/TrendingUp icons), never rendered. **Symptom:** users see risk-level indicators elsewhere in the app (e.g. `RiskAssessmentQuestionnaire`, which *is* wired into `App.tsx:1631`) with no way to open this explanation, since nothing renders it. **Fix:** hook an "explain this" affordance next to risk indicators to open this modal.

8. **`components/shopping-list/OfflineShoppingIndicator.tsx`** — Offline/sync status indicator for the shopping list, never rendered. **Symptom:** users get no visual cue when the shopping list is operating offline or mid-sync, despite this exact component existing to show it (contrast with `MealPlanCacheService`/`offlineQueueService` elsewhere in the app which do have UI feedback). **Fix:** mount in `ShoppingList.tsx` header.

9. **`components/settings/SettingsHelpSection.tsx`** — Settings "Help" section (FAQ button etc.), never rendered. **Symptom:** users have no Help/FAQ entry point in Settings even though one was built. **Fix:** add to `Settings.tsx` composition.

10. **`components/settings/SettingsPowerFeaturesSection.tsx`** — Settings "power features" section, never rendered. **Symptom:** whatever advanced/power-user settings this exposes are unreachable via Settings. **Fix:** add to `Settings.tsx` composition or confirm intentionally deprecated and remove.

11. **`components/recipes-meals/RecipeRatingPage.tsx`** — Full recipe rating page composing `RecipeRatingUI` + `RecipeCommunityInsights` + `RecipeRecommendations`, never rendered by any parent. **Symptom:** because this page is the only caller of `RecipeRecommendations`, the recommendation-dismiss/select callbacks in that child are also dead by extension — an entire rating/recommendation flow is unreachable. **Fix:** route to this page from the recipe detail/rating entry point, or remove all three components if superseded.

12. **`components/recipe-modal/RecipeModalTimerSubstitutionsSection.tsx`** — Cook-mode timer + ingredient-substitutions section for the recipe modal, never rendered. **Symptom:** in-recipe cooking timers and substitution suggestions (a meaningfully useful cooking feature) never appear in the recipe modal. **Fix:** include in `RecipeModal`'s cook-mode section composition.

13. **`components/pantry/PantryAnalytics.tsx`** — Pantry analytics panel wired to `AnalyticsService` (tracks its own view event on mount), never rendered. **Symptom:** users never see pantry-level analytics (waste trends, package counts, etc.), and the `AnalyticsService` view-tracking call inside it never fires, so any dashboard relying on that event is undercounting. **Fix:** mount on Pantry/Dashboard tab.

14. **`components/ui/ContextualPermissions.tsx`** — Contextual permission-request UI (camera/notifications/location/mic), never rendered. **Symptom:** the app likely falls back to raw OS permission prompts with no in-app context/explanation before asking, hurting grant rates and confusing users about why access is requested. **Fix:** invoke ahead of native permission requests (scan, push notifications, etc.).

15. **`components/household/HouseholdStatusIndicator.tsx`** — Household connection/status indicator, never rendered. **Symptom:** no visual household-status affordance shown anywhere despite being built. **Fix:** mount in header or household screen, or remove.

16. **`components/admin-analytics/MonitoringDashboard.tsx`**, 17. **`PerformanceMonitoringDashboard.tsx`**, 18. **`UserBehaviorAnalytics.tsx`** — Three separate admin/monitoring dashboards, none rendered anywhere. **Symptom:** if there's meant to be an internal/admin analytics view, it doesn't exist in the running app — these are fully dead. **Fix:** confirm whether an admin route was planned/removed; wire in or delete.

19. **`components/auth-onboarding/FeatureTooltip.tsx`**, 20. **`FirstTimeFlow.tsx`**, 21. **`ValueDemo.tsx`** — Three onboarding components (first-run tooltips, first-time flow, premium value demo), none rendered. **Symptom:** new users get none of the onboarding tooltips/value-demo/first-time flow this code implements — onboarding is silently degraded to whatever remains wired (e.g. `ModernOnboarding.tsx`, which is used). **Fix:** high-impact for activation/conversion — confirm whether `ModernOnboarding` superseded these (safe to delete) or whether they were meant to be composed together and got dropped.

### High — Dead hooks/services (logic built, never invoked)

22. **`hooks/usePantryBulkActions.ts`** — Bulk pantry-action hook, never imported. Corroborates finding #5 (`BulkQuantityEditModal`): the entire bulk-select/bulk-edit pantry subsystem is disconnected from the app.

23. **`hooks/usePantryFilters.ts`** (`usePantryFilters`, `DisplayedPantryItem` type) — Pantry filtering hook, never imported. **Symptom:** if pantry list filtering is expected to use this shared hook, it isn't — check whether `PantryList`/`PantryScreen` reimplements filtering ad hoc instead (duplication risk) or filtering is simply missing.

24. **`hooks/useToasts.ts`** — Duplicate/legacy toast hook, never imported; the app's real toast system is `components/ui/Toast.tsx`'s `ToastProvider`/`useToast` (singular), which is correctly wired in `index.tsx`. Low user impact (the real one works) but dead code that could mislead future edits into using the wrong hook.

25. **`services/writeQueueService.ts`** (`enqueueInventorySync`, `processQueue`, `withRetry`, etc.) — A full offline-write-queue-with-retry implementation, never imported anywhere. The app's actual offline queue is `services/offlineQueueService.ts` (imported by `hooks/useOfflineStatus.ts`), confirmed live. **Symptom:** none currently (the real queue works), but this is a parallel, more sophisticated implementation (exponential backoff, retryable-error classification) sitting completely unused — worth checking whether `offlineQueueService.ts` should have adopted this retry logic and didn't.

### Medium — Silent-fail write (optimistic UI desyncs from Firestore)

26. **`components/shopping-list/ShoppingList.tsx:698-714`** (`handleUpdateItem`) — Local state (`setItems`) is updated immediately and unconditionally, then `ShoppingListCacheService.updateItem(...)` is awaited inside a `try/catch` whose catch block only contains the comment `// best-effort; local state already updated` (line 711-713) — no toast, no log, no rollback. **Symptom:** if the Firestore write fails (offline, permission error, quota), the user sees their shopping-list edit (quantity/name/etc.) take effect immediately and permanently in the UI, but it never actually persists — on next reload or on another household member's device, the edit is gone with zero indication anything went wrong. **Fix:** at minimum log via `log.error`/`reportDatabaseError` in the catch, and consider a toast + optimistic rollback or queuing the write via `offlineQueueService` on failure, consistent with how the rest of the app handles offline writes.

## Metrics

- Files scanned for orphan-detection: 164 components + 34 hooks/contexts + 67 services = 265 non-test source files.
- Orphaned components confirmed: 20 (~4,300 LOC)
- Orphaned hooks/services confirmed: 4 (~300 LOC)
- Silent-catch / desync bugs confirmed high-confidence: 1 (others reviewed — `services/pantryService.ts:294,342` and `services/featureFlags.ts:334` and `components/recipes-meals/PopularRecipes.tsx:38` — were judged genuinely best-effort/non-critical: unit-mismatch fallback and feature-flag fetch failure respectively, not user-facing data-loss risks, so not reported as bugs)
- Verified-not-orphaned (checked because plausible false positives): `AppHeader` (`onNotificationAction` correctly wired from `App.tsx:1760`), `GroceryCostEstimator`, `RiskAssessmentQuestionnaire`, `Community`, `EnhancedShoppingListItem`, `LeftoverQuickCapture` — all correctly rendered/wired, no issue.
