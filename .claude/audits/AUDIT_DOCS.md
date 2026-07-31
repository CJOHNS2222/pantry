---
agent: doc-auditor
status: warn
findings: 6
---

## Summary

Core architecture doc (`CLAUDE.md`) is accurate and well-maintained relative to current code (checked `householdMigrationService.ts`, cache services, directory map — all still correct). The problems are concentrated in `README.md`, which is stale/self-contradictory in several places, and in a completely undocumented new feature surface (nutrition lookup + barcode scan + currency conversion) that shipped with no README/CLAUDE.md coverage. No stale references to the files deleted in the current working tree (`PortionSelector.tsx`, `BulkQuantityEditModal.tsx`, `usePantryBulkActions.ts`, `usePantryFilters.ts`, `useToasts.ts`, `writeQueueService.ts`, `FirstTimeFlow.tsx`, `ValueDemo.tsx`, `RecipeModalTimerSubstitutionsSection.tsx`, `RecipeRatingPage.tsx`, `SettingsPowerFeaturesSection.tsx`) were found in any `.md` file, so that cleanup is not a doc-debt item.

## Findings

1. **[Medium]** `README.md:315-318` — Dead/contradictory doc links: the "Useful Links" section still lists Stripe and PayPal documentation links even though line 3 explicitly states "Stripe and PayPal have been removed for Play Store compliance." Remediation: delete the four Stripe/PayPal links.

2. **[Medium]** `README.md:270` — Setup instructions tell readers to "Update `services/firebase.ts` (or `firebaseConfig.ts`)" — `services/firebase.ts` does not exist in the repo (confirmed via graphify + `firebaseConfig.ts` is root-level per `CLAUDE.md`'s own Firebase setup section). Remediation: drop the `services/firebase.ts` alternative, point solely at `firebaseConfig.ts` and `VITE_firebaseConfig.ts` per `CLAUDE.md`.

3. **[Medium]** New nutrition/barcode/currency subsystem is entirely undocumented. `services/nutritionService.ts`, `services/spoonacularFoodClient.ts`, `services/currencyService.ts`, `utils/barcodeScan.ts`, `components/pantry/NutritionFactsCard.tsx`, and `components/pantry/NutritionScannerModal.tsx` (all new, untracked files per `git status`) have no mention in `README.md`'s "Key Features"/"API Documentation" sections or in `CLAUDE.md`'s "Integrations" section (which lists Gemini, OpenRouter/Groq, Spoonacular recipes, but not the new Spoonacular food-nutrition client or currency conversion). Remediation: add a short "Nutrition Lookup & Currency" subsection to `CLAUDE.md` Integrations (client name, cache/fallback behavior, `SUPPORTED_CURRENCIES`) and to `README.md` Key Features.

4. **[Low]** `README.md:329` — Roadmap item "Barcode/Product Lookup: Integrate OpenFoodFacts or similar for barcode->product lookup to auto-fill nutrition and images" is still listed as an open/planned item without a **(Done)** marker, but the feature now exists (`utils/barcodeScan.ts` `captureAndDecodeBarcode()`, wired into `NutritionScannerModal.tsx` via `SpoonacularFoodClient`). Remediation: mark **(Done)** and correct the implementation note (uses Spoonacular, not OpenFoodFacts) or update to reflect actual source.

5. **[Low]** `README.md:328` — Roadmap item "Onboarding & First-run Flow ... persisted to `user.hasSeenTutorial` in `useAuth`" references a design that predates the just-deleted `components/auth-onboarding/FirstTimeFlow.tsx` and `ValueDemo.tsx`. The onboarding surface has moved to `ModernOnboarding.tsx`/`ModernOnboardingFlow.tsx`/`ContextualTutorial.tsx`/`FeatureDiscovery.tsx` (still present), so the roadmap note no longer matches either the old or new implementation. Remediation: update or remove the stale implementation note now that onboarding has been reworked.

6. **[Low]** `services/householdDataMigrationService.ts` exists alongside `services/householdMigrationService.ts` (the latter is the one documented in `CLAUDE.md`'s "Household join migration" section) but the former is undocumented and its relationship to the documented service isn't explained anywhere. Remediation: either fold a one-line note into `CLAUDE.md` distinguishing the two, or confirm one is dead code for the dep/code auditor to flag separately (out of scope here, noting only the doc gap).

## Metrics
- Files reviewed: `README.md`, `CLAUDE.md` (root + `.claude/CLAUDE.md`), `readme/*.md` (9 files), graphify subgraphs for nutrition/currency/barcode and migration services.
- Stale-reference checks against 11 deleted files in working tree: 0 dangling doc references found.
- Undocumented new modules: 6 (`nutritionService.ts`, `spoonacularFoodClient.ts`, `currencyService.ts`, `barcodeScan.ts`, `NutritionFactsCard.tsx`, `NutritionScannerModal.tsx`).
- Findings: 6 (0 high, 3 medium, 3 low).
