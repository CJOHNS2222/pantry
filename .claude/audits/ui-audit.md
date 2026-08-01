# UI/UX Audit — Stock & Spoon

Date: 2026-07-31
Auditor: ui-auditor (Claude)
Scope: accessibility, responsive layout, pantry/shopping/meal-planner/recipe flow friction, App.tsx modal sprawl, Android hardware-back, loading/empty/error states, i18n coverage.
Method: graphify-oriented (`graphify query` on App shell, back handling, i18n, state handling), then targeted source reads/greps.

Severity: **P1** = user-visible defect or a11y blocker · **P2** = meaningful friction/inconsistency · **P3** = polish/improvement opportunity.

---

## 1. Android hardware-back

### UI-01 (P1) — Back-stack ordering breaks with unstable `onClose` callbacks
`hooks/useAndroidBack.ts:26-36` — the effect depends on `[isOpen, onClose]` and every call site passes an **inline arrow** (e.g. `App.tsx:332-340`, `components/pantry/PantryScanner.tsx:322-451`, `components/shopping-list/ShoppingList.tsx:167-171`). Each re-render of a registered component removes its callback and re-pushes it to the **top** of the LIFO stack. The "topmost modal" therefore becomes "the component that re-rendered most recently", not "the modal opened last". With two modals open (e.g. PantryScanner filters over a detail modal) a background re-render (toast, polling, context update) will make the back button close the *wrong* layer.
**Fix:** key the stack by a stable registration token pushed once when `isOpen` flips true (e.g. `useRef` entry object holding a mutable `onClose`), updating the callback in place rather than splice+push. The hook's own doc comment ("Provide a stable onClose reference") is not enforced and is violated by nearly every caller.

### UI-02 (P2) — `Modal.tsx` does not self-register with the Android back stack
`components/ui/Modal.tsx` handles Escape/focus/backdrop but never calls `useAndroidBack`. Every consumer must remember to wire it manually; the changelog (`constants/changelogEntries.ts:1446`) shows this was retro-fitted across 20+ modal states, and new modals will keep regressing.
**Fix:** call `useAndroidBack(isOpen, onClose)` inside `Modal` itself (and `BottomSheet`/`ConfirmDialog`), then delete per-caller registrations for Modal-based dialogs.

### UI-03 (P2) — `searchQuery` registered as a back-stack "modal"
`components/pantry/PantryScanner.tsx:450` — `useAndroidBack(searchQuery.length > 0, () => setSearchQuery(''))`. Combined with UI-01, a re-render while typing puts "clear search" on top of the stack, so back can silently clear the user's search instead of closing an overlay opened afterwards. Even without the bug, back-clears-search is surprising when the keyboard's own back-to-dismiss already fires first.
**Fix:** only register search when the dedicated search modal is open (`isSearchModalOpen` already is, line 451); drop line 450 or gate it on search UI focus.

### UI-04 (P3) — Back through tab history retraces every visit; bypasses `switchTab`
`App.tsx:1139-1145` — tab history caps at 20 and back retraces each entry (Pantry→Shop→Pantry→Shop… requires up to 20 presses before "press again to exit"). Also the back path calls `setActiveTab(prev)` directly, skipping `switchTab`'s scroll reset, haptics, and analytics (`App.tsx:111-137`), so back-navigation lands mid-scroll and is invisible in analytics.
**Fix:** dedupe consecutive entries or use Android's standard "back returns to home tab once, then exits"; route through a shared `navigateTo(tab, {recordHistory:false})` helper so scroll reset/analytics stay consistent.

---

## 2. Modal sprawl and hand-rolled overlays

### UI-05 (P1) — Hand-rolled "Add to plan" dialog: no dialog semantics + broken dark theme
`App.tsx:1679-1700` — the Add-to-Meal-Plan overlay is a raw `fixed inset-0` div: no `role="dialog"`, no `aria-modal`, no focus trap, no Escape handling. Worse, its `<select>` uses `bg-white text-black` (`App.tsx:1689`) — hardcoded light colors inside a themed dark-mode panel.
**Fix:** rebuild on `components/ui/Modal.tsx` and theme tokens (`bg-theme-primary`, `text-theme-text`). This is the flagship "recipe → plan" flow, so it's high-traffic.

### UI-06 (P2) — 27 files still render bespoke `fixed inset-0` overlays outside the Modal design system
Grep count: 42 occurrences across 27 files, incl. `components/household/Community.tsx` (3), `components/household/Household.tsx` (3), `components/pantry/PantryScanner.tsx` (5), `components/settings/Settings.tsx` (3), `components/recipes-meals/RecipeModal.tsx`, `components/auth-onboarding/*`. Each re-implements (or omits) backdrop click, scroll-lock, focus trap, and z-index management that `Modal.tsx` already provides — the source of both the a11y gaps and the useAndroidBack boilerplate.
**Fix:** migration pass to `Modal`/`BottomSheet`; add an ESLint rule or grep-based CI check banning new `fixed inset-0` in `components/` outside `ui/`.

### UI-07 (P2) — App.tsx owns ~10 modal states plus their data companions (~40 `setShow*/setIs*Open` hits)
`App.tsx:140-153, 698-699` — `showHousehold`, `showOnboarding`, `showNotificationsModal`, `showHouseholdInviteModal`, `showExpiredItemsModal` (+`expiredItemsModalSpecificItems`), `showExpiredLaunchSheet` (+`expiredLaunchItems`), `notificationViewItem`, `showAddToPlanDialog` (+3 pending-selection states), `showGlobalRecipeModal` (+`globalModalIsSavedView`). Every open/close re-renders the entire 1998-line App tree. (Already noted in project memory as a deferred refactor.)
**Fix:** a single `useReducer`-based modal router (`{type: 'expiredItems', items} | {type:'addToPlan', recipe} | null`) in a small `AppModals` component below the shell, so modal churn stops re-rendering tabs, and useAndroidBack registration lives in one place.

---

## 3. Accessibility

### UI-08 (P2) — Sub-44px tap targets in the design system
- `components/ui/Modal.tsx:289` — header close button is `p-1.5` around a `w-5 h-5` icon ≈ 32px. On Android this is the single most-tapped control in the app.
- `components/ui/Button.tsx:71-72` — `xs` (h-7 = 28px) and `sm` (h-8 = 32px) sizes have no minimum touch extent when used `iconOnly`.
**Fix:** give the Modal close button `min-w-[44px] min-h-[44px]` (visual size can stay small via inner padding); for Button `xs`/`sm` add an invisible hit-area (`before:` pseudo or `min-h-[44px]` on touch media query `@media (pointer: coarse)`). `EnhancedShoppingListItem.tsx:372,392,497` already does `min-w-[44px] min-h-[44px]` — copy that standard down into the primitives so it's automatic.

### UI-09 (P2) — Bottom-nav labels at 9px and redundant a11y labeling
`components/layout/AppNavigation.tsx:60` — `text-[9px]` labels fail readable-text guidance and WCAG 1.4.4 resize expectations; `line 48` bakes "(current page)" into `aria-label` while also setting `aria-current="page"` (line 49), so screen readers announce it twice.
**Fix:** bump to ≥10-11px or rely on icons + larger active label; drop the "(current page)" suffix and keep `aria-current`. Also: labels ("Pantry", "Shop", "Chef"…) are hardcoded English — see UI-14.

### UI-10 (P2) — Focus trap misses Shift+Tab from body / roving focus edge cases
`components/ui/Modal.tsx:106-125` — trap only intercepts when `document.activeElement` is exactly first/last focusable. If focus is on the panel itself (`tabIndex={-1}`, the fallback at line 202) or an element gets removed, Tab escapes to the page behind (which is still in the DOM — background content is not `inert`/`aria-hidden`).
**Fix:** when no match, `preventDefault` and focus first/last; better, set `inert` on the app root while a modal is open (the `body.modal-open` hook already exists via `useModalOpen`) so background content is unreachable to both keyboard and screen readers.

### UI-11 (P3) — Low-contrast secondary text patterns
`components/ui/Modal.tsx:282` (`text-xs ... opacity-70` subtitle), `AppNavigation.tsx:46` (`opacity-60` inactive tabs), `EnhancedShoppingListItem.tsx:270,351` (`text-[10px]` badges). Layering opacity on already-secondary theme tokens frequently lands below 4.5:1, especially in dark theme.
**Fix:** define dedicated `--text-tertiary` tokens tuned per theme instead of opacity stacking; verify with the chrome-devtools a11y skill against the running app.

### UI-12 (P3) — Good foundations worth extending
Positives: `Modal.tsx` has real dialog semantics + focus restore; `Button.tsx` has visible `focus-visible` rings and loading state; `AppNavigation` has `role/aria-current`; 55 of 119 interactive component files use `aria-label`. The gap is the long tail of bespoke overlays and icon buttons outside `ui/` primitives.

---

## 4. Loading / empty / error states

### UI-13 (P2) — Blocking, uninformative errors via `alert()`
`components/recipe-finder/RecipeExportModal.tsx:122,230`, `components/recipe-finder/RecipeFinderSavedView.tsx:83`, `components/household/Community.tsx:1600` — native `alert()` despite a branded `ConfirmDialog`/toast system existing (`components/ui/ConfirmDialog.tsx` explicitly says it replaces `window.confirm`). On Android WebView these look foreign and steal back-button behavior.
**Fix:** route through `useToast()` (errors/info) or `ConfirmDialogProvider` (decisions). Add lint ban on `alert(`.

### UI-14 (P3) — Generic global loading; good per-section states
`components/layout/MainContent.tsx:18-22` — lazy-tab fallback is a spinner + literal "Loading..." (hardcoded, not localized). Per-domain flags exist (`isLoadingInventory`, `isLoadingShoppingList`, …) and `ShoppingListItemsSection.tsx:52,90` does the right thing (skeleton/spinner + `EmptyState`), but `EmptyState` is only adopted in 4 feature files.
**Fix:** tab-shaped skeletons (list rows for pantry/shopping, calendar grid for planner) instead of a centered spinner; adopt `components/ui/EmptyState.tsx` in pantry main list, meal-planner empty week, and recipe-finder saved view for consistent first-run guidance with CTA ("Scan your first item", "Plan this week").

---

## 5. i18n coverage

### UI-15 (P1) — Translation infrastructure exists but ~80% of UI is hardcoded English
Seven locales ship with good key parity (`src/locales/{en,de,es,fr,ja,ru,zh}.json`, 343-346 keys each) and `I18nProvider`/react-intl wrap the app (`index.tsx`, `src/components/I18nProvider.tsx`). But only **21 of ~119** interactive component files call `formatMessage`. Untranslated hot paths include: bottom-nav labels (`AppNavigation.tsx:15-20`), Button/Modal defaults (`Modal.tsx:255` "Dialog", `:290` "Close dialog"), the exit toast (`App.tsx:1153` "Press back again to exit"), `MainContent.tsx:22` "Loading...", most of ShoppingList, EnhancedShoppingListItem, PantryScanner, EmptyState copy. A German or Japanese user gets a mostly-English app with translated islands — worse than either extreme.
**Fix:** (a) treat nav labels, ui/ primitives' default strings, toasts, and empty states as the priority batch (highest visibility per key); (b) add an ESLint rule (`react/jsx-no-literals` scoped to `components/`) to stop new hardcoded strings; (c) locale files are small (≈345 keys), so budget ~1-2 sessions to double coverage.

---

## 6. Responsive layout

### UI-16 (P2) — Entire app hard-capped at `max-w-md` (~448px)
`App.tsx:1576` (shell), `components/layout/AppHeader.tsx:333` (header), `AppNavigation.tsx:31` (nav). On tablets, desktop web, and Android large-screen/foldable modes the app is a narrow phone column with dead gutters — Play Store now scores large-screen layouts.
**Fix:** keep the single-column mental model but raise the cap per breakpoint (e.g. `md:max-w-2xl` with 2-col pantry/shopping grids at `sm:grid-cols-2`, planner week view side-by-side). The tab shell makes this incremental — start with Pantry grid and ShoppingList two-column.

### UI-17 (P3) — Modal panel padding vars are a good pattern; extend to bespoke overlays
`Modal.tsx:247` reserves `--app-header-h`/`--app-nav-h` so panels never sit under fixed chrome. Bespoke overlays (UI-06) don't, so tall custom sheets can underlap the nav on small screens. Fold into the migration in UI-06.

---

## 7. Flow friction (pantry / shopping / planner / recipes)

### UI-18 (P2) — Recipe → plan flow drops context
The Add-to-plan dialog (`App.tsx:1679+`) asks the user to pick day + meal from raw `<select>`s with `new Date(...).toLocaleDateString()` labels — no indication of which days already have meals planned, and it lives at App level disconnected from the planner UI.
**Fix:** replace with a `BottomSheet` showing the 7-day strip with existing meals ghosted in, tap-to-place; default to the next empty dinner slot.

### UI-19 (P3) — Double-back-to-exit toast timing
`App.tsx:1150-1155` — 2000ms window matches the toast TTL exactly; if toast render lags, the affordance disappears while the window is still open (or vice versa). Minor: use a single constant for both, and consider `HapticService.light()` on the first press.

### UI-20 (P3) — `switchTab` resets Settings category but no other tab sub-state
`App.tsx:131-133` special-cases Settings (`setActiveSettingsCategory(null)`), while other tabs preserve sub-state. Decide one rule (preserve everywhere is friendlier: a user hopping to Pantry and back to Settings loses their place today).

---

## Prioritized top 5

1. **UI-01** — useAndroidBack stack reordering (wrong modal closes on back). `hooks/useAndroidBack.ts:26`
2. **UI-15** — i18n at ~18% component coverage despite 7 shipped locales. `src/locales/*`, `components/**`
3. **UI-05** — Add-to-plan dialog: no a11y semantics + hardcoded light colors in dark mode. `App.tsx:1679`
4. **UI-02/06/07** — Consolidate modal system: Modal self-registers back handling; migrate 27 bespoke overlays; reduce App.tsx modal states to a reducer-based modal router.
5. **UI-08/16** — 32px tap targets in Modal close / small Buttons; `max-w-md` cap wastes tablet/desktop space. `components/ui/Modal.tsx:289`, `App.tsx:1576`
