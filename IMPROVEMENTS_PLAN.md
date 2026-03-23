# Stock & Spoon — UX Improvements Plan

Generated from a full app audit on 2026-03-23.

---

## Legend
- ✅ WILL DO — Implementing this session
- ⛔ SKIPPED — Skipped with reasoning below
- 🔄 IN PROGRESS
- ✔️ DONE

---

## ⛔ SKIPPED Items (DB reads/writes or external service dependency)

| # | Item | Reason Skipped |
|---|------|----------------|
| S1 | **Restore household invite email sending** (`functions/src/inviteMember.ts`) | Requires Cloud Functions deployment + Secret Manager re-integration for email service credentials. No safe local implementation path. |
| S2 | **Restore payment processing** (Stripe / PayPal / Google Play Billing) | All disabled at Cloud Functions level. Requires external billing service credentials and platform review compliance. Out of scope. |
| S3 | **Complete recipe recommendation TODOs** (`services/recipeRecommendationService.ts`) | The 3 TODOs (recipe lookup, ingredient matching, similarity algorithm) all require additional Firestore reads to fetch full recipe collections. Would meaningfully increase read count per recommendation request. |
| S4 | **Daily macro summary in Meal Planner** | `nutritionService.ts` fetches nutrition data from Spoonacular API or Firestore per-recipe. Showing macros for a full week's plan = multiple API/DB reads per render. |
| S5 | **Wire SmartRecommendations into UI** (`components/SmartRecommendations.tsx`) | Component generates recommendations by reading household recipe history and inventory from Firestore. Adding it to a visible screen would trigger those reads on every navigation. |
| S6 | **Re-enable Household Activity Feed** (`hooks/useHouseholdActivity.ts`) | Explicitly disabled in code with comment: "Temporarily disabled to test if this causes excessive reads." Enabling it adds a Firestore listener for every household event. |
| S7 | **Batch size profiling for large inventories** | Requires load testing infrastructure; no safe change to make without measured data. |

---

## ✅ Items Being Implemented

### Group 1 — Pantry / Item Detail

| # | Item | File(s) |
|---|------|---------|
| 1 | **Add "Mark as Opened" toggle + date** in ItemDetailModal | `components/ItemDetailModal.tsx` |
| 2 | **Improve pantry search bar discoverability** — ensure it's visible at top of inventory list | `components/PantryScanner.tsx` |
| 3 | **Surface LeftoverQuickCapture** — add "Save as Leftover" quick action to item context/detail | `components/ItemDetailModal.tsx`, `components/LeftoverQuickCapture.tsx` |
| 4 | **Wire ImportModal** to pantry scanner (it exists but has no entry point) | `components/PantryScanner.tsx` |

### Group 2 — Shopping List

| # | Item | File(s) |
|---|------|---------|
| 5 | **Undo toast on swipe-to-delete** — wire `undoService.ts` to shopping list deletions | `components/EnhancedShoppingListItem.tsx`, shopping page |
| 6 | **"Select All" quick action** in batch operations | `components/BatchOperations.tsx`, shopping page |
| 7 | **Offline queue detail** — show "X items pending sync" in expandable status | `components/OfflineShoppingIndicator` area |

### Group 3 — Meal Planner

| # | Item | File(s) |
|---|------|---------|
| 8 | **Optimize 360-object DayPlan generation** — reduce to actual visible window only (lazy) | `hooks/useDataManagement.ts` |
| 9 | **Add "Copy Week" / "Clear Week" bulk actions** to meal planner UI | `components/MealPlanner.tsx` |
| 10 | **Add entry point to MealPrepPlanner** — button/tab in MealPlanner | `components/MealPlanner.tsx` |

### Group 4 — Recipes

| # | Item | File(s) |
|---|------|---------|
| 11 | **Add "Top Rated" sort** to saved recipe list | `pages/Recipes.tsx` or recipe list component |
| 12 | **Add retry button** on recipe image load failure | recipe list / RecipeModal image elements |

### Group 5 — Household

| # | Item | File(s) |
|---|------|---------|
| 13 | **Member slots indicator** — show "2/3 members" before hitting the limit | `components/Household.tsx` |

### Group 6 — Settings / Notifications

| # | Item | File(s) |
|---|------|---------|
| 14 | **Notification presets** — add "Relaxed / Normal / Strict" one-tap presets | `pages/Settings.tsx` notification section |
| 15 | **Complete member preferences save logic** — ensure save persists properly | `pages/Settings.tsx` |

### Group 7 — Onboarding Cleanup

| # | Item | File(s) |
|---|------|---------|
| 16 | **Remove duplicate onboarding** — consolidate FirstTimeFlow + ModernOnboarding into single path | `App.tsx`, `components/FirstTimeFlow.tsx`, `components/ModernOnboarding.tsx` |

### Group 8 — Accessibility

| # | Item | File(s) |
|---|------|---------|
| 17 | **ARIA labels on modals** — add `aria-label`/`aria-modal`/`role="dialog"` to key modals | `components/ItemDetailModal.tsx`, `components/RecipeModal.tsx`, `components/HouseholdInviteModal.tsx` |
| 18 | **Alt text on recipe images** | Recipe image elements |
| 19 | **Keyboard focus management** in QuickAddModal and ItemDetailModal | Respective components |

### Group 9 — Code Quality

| # | Item | File(s) |
|---|------|---------|
| 20 | **Replace `any` types** in hooks and components with proper types | `hooks/useDataManagement.ts`, `hooks/useNotifications.ts`, `components/layout/AppHeader.tsx` |
| 21 | **Remove console.log calls** from functions and source | `functions/src/nutrition.ts`, other function files |
| 22 | **Fix @ts-ignore** in AdMobBanner — use proper type stubs | `components/AdMobBanner.tsx` |

---

## Implementation Order

Work proceeds top-to-bottom through the groups above. Each change is minimal and scoped — no unrelated refactors.

---
