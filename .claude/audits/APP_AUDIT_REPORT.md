# Stock & Spoon — App Audit Report

Consolidated from existing `.claude/audits/` findings (AUDIT_BUGS.md, FIXES.md and sources therein). Grouped by functionality, major coding issues, UX. `F#` refs = `FIXES.md` items.

## Functionality — broken or wrong behavior

1. **Wrong dollar figures shown to users** (F4, HIGH) — `LeftoverAnalytics.tsx:483,495,623`. "Value Saved" / "Net Savings" render `moneySaved` instead of `estimatedValueSaved`, double-counting and duplicating the "Eco Savings" stat under a contradictory label.
2. **Voice-input listener leak** (F21, MEDIUM) — `QuickAddModal.tsx:127-155`. Native `partialResults` listener only removed on success; 10s no-speech timeout leaks a live native listener per failed attempt.
3. **React key collision on duplicate barcode scan** (F35, LOW) — `NutritionScannerModal.tsx:58-68`. Slots keyed by raw `upc` with no de-dup; scanning same product twice breaks reconciliation.
4. **Shopping list silent-fail write** — now fixed per latest bug-audit pass (was F-equivalent #26); confirm still holds.
5. **~20 built features never wired into the app** (dead but functional code, ~4,600 LOC) — biggest functionality gap. Notable ones with real user value:
   - `UseSoonRecommendations.tsx` (F48, HIGH) — expiring-item recipe recommendations, never rendered.
   - `RecipeCommunityInsights.tsx` (F50, MEDIUM) — ratings are collected but never displayed anywhere.
   - `RecipeRecommendations.tsx` (F51) — server-driven personalized recommendation engine, fully built, unreachable.
   - `CameraPermissionsModals.tsx` / `ContextualPermissions.tsx` (F49) — permission-denied guidance either duplicated inline or broken (wrong API for native).
   - `OfflineShoppingIndicator.tsx`, `HouseholdStatusIndicator.tsx`, `SettingsHelpSection.tsx` (F53-F55) — status/help UI built, not surfaced.
   - Admin dashboards (`MonitoringDashboard`, `PerformanceMonitoringDashboard`, `UserBehaviorAnalytics`, F56) — no admin UI exists despite three dashboards built.

## Major coding issues

1. **`PantryScanner.tsx` — 3,525 lines, 48 `useState`, 14 `useEffect`** (F11, HIGH). Largest file in repo. Verify it's lazy-loaded (vendor chunks shouldn't hit non-scanner users); structural decomposition needed but defer — route through architect review first.
2. **`hooks/dataManagement/*` fully dead, 1,883 lines** (F12, HIGH) — unimported, contradicts CLAUDE.md's documented directory map. Delete or wire in; update docs either way.
3. **Recipe service N+1 / unbounded scans** (F10, HIGH) — `recipeService.ts` re-scans entire `recipes` collection per item, unbatched sequential `getDoc` calls (up to 50), unbounded fallback scan on index error.
4. **`EnhancedShoppingListItem.tsx` not memoized** (F15, HIGH) — 649-line row calls `useApp()` directly; any unrelated app-state change re-renders every visible row.
5. **Stored XSS in recipe export** (F13, HIGH, security) — `RecipeExportModal.tsx:319-337` interpolates recipe fields unescaped into `innerHTML` for print window; recipe content can originate from untrusted imports.
6. **No CI/CD gate** (F14, HIGH) — no lint/type-check/test/build check on push/PR; release pushes straight to main.
7. **Authorization gaps in Cloud Functions** (F2 CRITICAL, F5/F6 HIGH, F7 HIGH) — `migrateHouseholdClaims` has zero auth check (privilege escalation), CORS reflects any Origin with credentials allowed on invite/leave HTTP functions, ID token accepted via query string (log/history leak risk), `getNutritionData` has no auth check at all.
8. **Storage rules missing ownership checks** (F16, HIGH) — any authenticated user can delete another user's recipe photos or overwrite public recipe images.
9. **Committed release keystore** (F1, CRITICAL) — `android/app/pantry-release-new.keystore` tracked in git; `.gitignore` glob doesn't match actual filename.
10. **Critical dependency vulnerabilities** (F3, CRITICAL) — protobufjs, nodemailer, fast-xml-parser, websocket-driver all flagged critical in `functions/`.

## UX issues

1. **Hand-rolled modals bypass shared `Modal.tsx`** (F8/F9, HIGH; F58 LOW) — `PriceTrends.tsx` has no `role="dialog"`, no `aria-modal`, no Escape handling, no focus trap, plus 14 hardcoded light-mode classes that break dark theme. Same pattern in `AddMealDialog.tsx`.
2. **Accessibility gaps across icon-only controls** (F22-F24, MEDIUM) — close buttons (`PriceTrends`, `GroceryCostEstimator`) and primary submit button (`QuickAddModal`) have no accessible name; `ItemDetailModal` accordion buttons (6 of them) missing `aria-expanded`.
3. **Touch targets under 44px minimum** (F25, MEDIUM) — `EnhancedShoppingListItem.tsx:495,508`, 36×22px controls.
4. **Visual/interaction inconsistencies** (F60-F63, LOW) — Settings nav icon collides visually with theme-toggle icon; inconsistent close-button icon (literal `✕` vs `<X />` component) across the app; two separate undo mechanisms coexisting undocumented; notification/activity dropdowns aren't real popovers (no `role="menu"`, no focus trap, force-close on a 15s timer mid-read).
5. **No shared paywall component** (F64, MEDIUM) — every usage-limit surface (recipes, meal plans, household) rolls its own copy/UI instead of one shared `PaywallPrompt`/`LimitReachedCard`.
6. **Household PII leak on invitation probe** (F17, MEDIUM, security/UX-adjacent) — unauthenticated, unrate-limited; a guessed email+householdId returns the full household doc.

## Recommended priority

1. **Today:** F1 (keystone), F2 (auth bypass), F3 (critical deps) — see FIXES.md Batch 0.
2. **This sprint:** F4 (wrong savings numbers, single file), F13 (XSS, single file), F5/F6/F7/F16 (function/rules auth gaps), F14 (CI gate).
3. **Next sprint:** accessibility batch (F22-F25), doc-only batch (F27/F28/F44/F45), db batch (F19/F20).
4. **Product decision needed before work starts:** the ~20 orphaned components (F48-F57) — each needs an explicit keep/wire-in/delete call; several (UseSoonRecommendations, RecipeCommunityInsights, RecipeRecommendations) represent real, already-built user value sitting unused.

Full detail with file:line citations, fixes, and effort estimates: see `.claude/audits/FIXES.md` (64 findings, sourced from bug/code/security/db/perf/dep/doc/infra/ui/seo/api auditors) and `.claude/audits/AUDIT_BUGS.md`.
