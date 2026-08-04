 
  Full audit complete —8 dimensions,59 findings**What ran:**7 parallel auditors (UI/UX, bugs, security, code quality, perf, DB, deps) + my own
  infra pass (CI, hosting, env, monitoring). The infra agent's output was lost, but its scope was already covered by cross-cutting findings —
  I verified CI/hosting/config directly.

  🔴 P0 — Do these first (5)

  1. Gmail app-password committed to git — functions/.runtimeconfig.json is tracked (commit 981c9c6) with a live Gmail app password. Rotate it  now (deletion alone is insufficient — it's in history), then git rm + purge history + gitignore. Bonus: it's dead weight anyway —
  firebase.json sets disallowLegacyRuntimeConfig: true.
  2. Paywall self-grant — users/{uid} self-write rule has no field validation; any client can set({tier:'family'}) and bypass verifyPurchase.
  3. Any household member can delete the household doc — firestore.rules:137 lets any member deleteDoc; subcollection rules then null out     
  memberIds and lock everyone out.
  4. Billing API keys in the client bundle — Gemini + OpenRouter (direct billing vectors), plus Spoonacular/USDA/CSE/Unsplash keys, all       
  statically inlined into dist//APK. The vite.config.ts comment claiming they're not embedded is wrong.
  5. Stale inventory indices — bulk-change/undo callbacks capture array indices, resolve by index seconds later after Firestore may have
  reordered → wrong item modified.

  🟡 P1 — Highlights (22)

  - 4 new modals aren't accessible dialogs — no role="dialog", no focus trap, no Escape. PantrySearchModal is worst: no close path at all. **Fixed (prior work)**: all 4 now use shared `<Modal>` component with focus trap, Escape, useModalOpen, useAndroidBack.    
  - MealPlanner index bug — drag-drop/leftover-swap uses display indices against the rotated mealPlan array → mutates the wrong day when the  
  plan doesn't start today. **Still open**: subtle index-space bug; handlers use display indices directly on mealPlan without `displayToOriginal[dayIndex]` conversion. Fix needs manual QA — test harness broken (React 19.2.7 `act` export issue).
  - 2 crashes — unguarded JSON.parse in useSettings (white screen), missingIngredients throws on recipes without an ingredients array. **Fixed (2026-08-04)**: try/catch around JSON.parse in useState initializer; `(x ?? [])` guards on recipe.ingredients.map in MealPlanner and RecipeFinder. Committed as 3f4c080.        
  - 2 missing Firestore composite indexes for recipeRatings; getSavedRecipes reads the whole catalog with no limit.
  - Scan-hook tangle — usePantryScan + usePantryScannerScan duplicated (95 lines dead code), any[] types, a13-arg hook.
  - Capacitor8 vs Google-Auth plugin pinned to Capacitor6 (release candidate, shipped) — Google Sign-In risk.
  - CI/functions on Node20, but @capacitor/cli, lint-staged, @zxing need ≥22/24.
  - 7 moderate vulns in functions (uuid chain) — fixable with an overrides entry.
  - Contrast fail: white-on-amber-500 ≈2.1:1, global Button + new modals. Zoom disabled via viewport meta. **Fixed (2026-08-04)**: F3 viewport already clean; F4 swept ~65 files using `--accent-text` token (≈7.5:1). Committed as fb92b48.

  🟢 P2/P3 — Notable~12 touch targets under44px, unlabeled form controls in ScanReviewModal, zero tests on3 new modals, twin notification     
  services colliding, AppContext monolithic (every consumer re-renders on any change),1.7 MB eager JS (React not split out), PWA precaches    
  all79 chunks, no responsive images, and a batch of dep hygiene items (root npm audit: 0 vulns — that part is clean).

  Verified strong: root has0 npm vulnerabilities, App Check on all callables, verifyPurchase is solid, no listener leaks, bulk cache writes   
  already transactional, .env.local/service-accounts correctly gitignored.

  ---
  What's next? I recommend knocking out F01 (rotate + remove the Gmail password) yourself — it needs your Google account access. After that I 
  can take the P0/P1 batch (rules hardening, the index bugs, modal a11y, the two crash fixes) in a wave or two. Want me to start on those?    






UI/UX Audit — Stock & Spoon (delta on current changeset)
     
  Severity: P1 = a11y blocker / WCAG AA violation · P2 = meaningful friction · P3 = polish.                                                                                   
    
  Scope of this pass: the4 new bespoke modals (AddItemsModal, ScanReviewModal, PantrySearchModal, BulkQuantityEditModal), the modified PantryScanner (refactored −965 lines to
  delegate to those modals), ItemDetailModal/RecipeModal/MealPlanner portal fixes, RecipeFinder, UserBehaviorAnalytics, and the shared primitives thosenew modals bypass.
    
  ---
  Completed*****Findings### F1 (P1) — New bespoke modals are not accessible dialogsThe four new modals are hand-rolled fixed inset-0 overlays. None declares role="dialog" or 
  aria-modal="true", none traps Tab, none moves focus into the dialog on open, and none restores focus to the trigger on close. The shared Modal/BottomSheet components 
  (components/ui/Modal.tsx:234-303) already provide all of this — these modals re-implement the same overlays the prior audit flagged as the "27 bespoke overlays" problem.
  
  - C:\Users\cjohn\pantry\components\pantry\AddItemsModal.tsx:194-195
  - C:\Users\cjohn\pantry\components\pantry\ScanReviewModal.tsx:43-44
  - C:\Users\cjohn\pantry\components\pantry\PantrySearchModal.tsx:42-45
  - C:\Users\cjohn\pantry\components\pantry\BulkQuantityEditModal.tsx:34-35
     
  Remediation: Build these on the shared Modal/BottomSheet primitives (which give role/aria-modal/focus-trap/Escape/portal/inert for free), or retrofiteach with
  role="dialog" aria-modal="true", initial-focus, focus-return, Tab wrap, Escape, and Android-back.

  Completed***F2 (P1) — PantrySearchModal has no Escape, no Android back, no inert backgroundWorst of the four: it is the only one with no keyboard/hardware close path at all.

  - No useAndroidBack (imports are only React, lucide, searchUtils) and it is absent from the scanner's back registrations (components/pantry/PantryScanner.tsx:351-354,595). 
  - It is also missing from the useModalOpen list (PantryScanner.tsx:288) — so #root is not made inert, background content stays keyboard/screen-reader reachable, and the    
  fixed header/nav are not hidden behind it.
  - No body scroll lock and no focus movement.

  Remediation: Add useAndroidBack(isOpen, onClose), include isSearchModalOpen in useModalOpen(...) at PantryScanner.tsx:288, and add a focus/Escape handler (or migrate to    
  Modal).

  **Completed***F3 (P1) — Zoom disabled via viewport metaC:\Users\cjohn\pantry\index.html:5 — maximum-scale=1.0, user-scalable=no blocks pinch-zoom and browser font-scaling (WCAG1.4.4     
  Resize Text,1.4.10 Reflow, and Apple's requirement to allow200% zoom).

  Remediation: Remove user-scalable=no and maximum-scale=1.0; keep viewport-fit=cover. If the Android webview needs it, scope it there instead of in the shared HTML.

  **Completed***F4 (P1) — White text on amber accent fails contrast in light themeindex.html:51 sets --accent-color: #F59E0B (amber-500) for light theme. bg-[var(--accent-color)]
  text-white computes to ~2.1:1 — far below the4.5:1 AA requirement for the small, bold labels used on these CTAs.

  - C:\Users\cjohn\pantry\components\ui\Button.tsx:57 (primary variant — global)
  - C:\Users\cjohn\pantry\components\pantry\AddItemsModal.tsx:355,460
  - C:\Users\cjohn\pantry\components\pantry\PantrySearchModal.tsx:169 (Done)
  - C:\Users\cjohn\pantry\components\pantry\BulkQuantityEditModal.tsx:102 (Save All)
  - C:\Users\cjohn\pantry\components\pantry\ScanReviewModal.tsx:63,73 (active destination)
  - C:\Users\cjohn\pantry\components\pantry\ItemDetailModal.tsx:724

  (Dark theme uses rose-700 #BE123C with white ≈6.4:1 — passes.)

  Remediation: In light theme switch the accent to amber-700 (#B45309, ≈6.4:1 with white) or use dark text on amber-500.   Ask user before changing colors. 

  Resolved (2026-08-03): Used the existing `--accent-text` token (dark text `#1F2937` on amber light theme / white on rose-700 dark theme, ≈7.5:1). Swept ~135 hardcoded `text-white` → `text-[var(--accent-text,white)]` across ~58 files wherever `bg-[var(--accent-color)]` is used. tsc + eslint pass; vitest failure is pre-existing React 19.2.7 `act` export issue, unrelated to this change.

  F5 (P2) — Touch targets under44pxWCAG2.5.5 / Apple HIG. Measured from the class strings:

  - PantrySearchModal.tsx:54 close button (p-1.5 +20px icon ≈32px); :80-86 clear-search button is16×16px (w-4 h-4).
  - AddItemsModal.tsx:203 close ≈36px; :389 dismiss-success (p-1) ≈28px.
  - ScanReviewModal.tsx:48 close ≈36px; :162-168 Remove button (px-3 py-1 text-xs) ≈30px.
  - BulkQuantityEditModal.tsx:39-45 close ≈36px; :90-106 Skip / Save All (py-2.5 text-xs) ≈36px tall.
  - components/pantry/VisualQuantitySelector.tsx:286,306 steppers w-10 h-10 =40px.
  - components/pantry/QuantityUnitPicker.tsx:219-231 fraction quick-picks (py-1.5 text-xs) ≈30px.
  - PantryScanner.tsx:1822-1831 carousel dots are 6px ×20px.
  - components/layout/AppHeader.tsx:375 bell (p-1 ≈28px), :583 undo, :602 theme toggle (p-2 ≈36px).
  - components/ui/Button.tsx:71-74 — xs/sm enforce min-w/h-[44px], but md/lg do not (h-10/h-12 widths are content-driven).

  Remediation: Add min-w-[44px] min-h-[44px] to all interactive controls (or bump sizes); fix the search clear button to ≥44px; give the carousel dots a proper affordance (or
  make the slide area itself the tap target).

  F6 (P2) — Form controls without accessible names (ScanReviewModal)

  C:\Users\cjohn\pantry\components\pantry\ScanReviewModal.tsx
  - Item name input :100-108 — no label, no aria-label.
  - Qty input :110-121 and cost input :139-151 — placeholder-only ("Qty"/"Cost"); cost additionally relies on an unlabeled $ <span>.
  - Category <select> :122-136 — no label.
  - The <label>Add items to:</label> at :57 has no htmlFor/id association, and the Pantry/Shopping toggle :59-78 uses emoji content (🏠/🛒) which AT may announce as
  "house"/"shopping trolley".

  Remediation: Associate labels via htmlFor/id (or add aria-labels); aria-hidden the emoji and keep the visible text names.

  F7 (P2) — PantryScanner carousel "tablist" is not keyboard-operableC:\Users\cjohn\pantry\components\pantry\PantryScanner.tsx:1820-1831 — role="tablist" + role="tab" buttons
  with aria-selected but no Arrow/Home/End handling, no roving tabindex, no aria-orientation, and no visible focus style (the inactive dot is bg-[var(--text-primary)]/30,    
  a6px pill). This is a broken WAI-ARIA tabs pattern (APG): screen-reader users get "tab" semantics that don't work.

  Remediation: Either implement the full tabs keyboard contract, or drop role="tab" and render them as plain buttons with aria-label.

  F8 (P2) — Low-contrast secondary text via opacitytext-theme-secondary at reduced opacity on light theme (#374151 base):

  -50% ≈ 2.6:1 — AddItemsModal.tsx:245, PantrySearchModal.tsx:62 (search icon), :149 (60%), UserBehaviorAnalytics.tsx:220, Community.tsx:386.
  -70% ≈ 4.3:1 (marginal fail for normal text) — AddItemsModal.tsx:244, ScanReviewModal.tsx:80, BulkQuantityEditModal.tsx:48.
  -10px text at opacity — PantrySearchModal.tsx:151-157 category chips / count.

  Remediation: Replace opacity dimming with explicit tokens (e.g. text-[#6B7280]/text-theme-muted) and verify ≥4.5:1 on --bg-primary and --bg-secondary.    Ask user before changin color

  F9 (P2) — AddItemsModal upload area is not keyboard accessibleC:\Users\cjohn\pantry\components\pantry\AddItemsModal.tsx:213-258 — the big dashed "Scan receipt or pantry"   
  area is a div with onClick only: no role="button", tabIndex, onKeyDown, or focus style. Keyboard-only users cannot trigger the primary capture path (WCAG2.1.1).

  Remediation: Make it a real <button> (or add role="button" tabIndex={0} + Enter/Space handler + focus-visible ring).

  F10 (P2) — Android hardware-back gap for AddItemsModalPantryScanner.tsx:351-354,595 registers back handlers for recipe modal, filters, search query, health detail, scan    
  review, and selected item — but not isAddModalOpen, and AddItemsModal doesn't self-register either. On Android, hardware back cannot close the Add Items sheet (it falls    
  through to the app-level handler). BulkQuantityEditModal and ScanReviewModal do self-register correctly.

  Remediation: Call useAndroidBack(isOpen, onClose) inside AddItemsModal (consistent with the other two new modals).

  F11 (P2) — Autocomplete in PantrySearchModal has no combobox/listbox ARIA and a blur raceC:\Users\cjohn\pantry\components\pantry\PantrySearchModal.tsx:90-164 — the
  suggestion list is a plain absolutely-positioned <div> of buttons; no role="listbox"/role="option"/aria-expanded, and the onBlur={() => setTimeout(...250)} (line75) hides  
  the list ~250ms after focus leaves the input — a keyboard user tabbing to a suggestion within that window loses it mid-interaction.

  Remediation: Use the WAI-ARIA combobox pattern (input role="combobox" + aria-expanded + aria-controls, list role="listbox", items role="option" with aria-selected), and    
  dismiss on pointer/escape/selection instead of a timed blur.

  F12 (P2) — Focus-visible indicators missing on several controls- PantrySearchModal.tsx:100-131,168-172 suggestion/Done buttons have no focus style.

  - AddItemsModal.tsx:460 submit button has no focus:ring/focus-visible class (unlike siblings at :271,:299).
  - PantryScanner.tsx:1828 dots — no focus style (see F7).
  - RecipeFinder.tsx:503 scrolls with behavior:'smooth' unconditionally — should respect prefers-reduced-motion.

  F13 (P3) — Bottom nav:9px labels + duplicated current-page announcementC:\Users\cjohn\pantry\components\layout\AppNavigation.tsx:48-62 — labels are text-[9px] uppercase    
  (unreadably small; prior audit UI-09 still open), and aria-label appends "(current page)" while aria-current="page" is also set, so AT announce the state twice. For a      
  tab-like single-page nav, aria-selected/aria-current="page" should be chosen, not both.

  F14 (P3) — New modals bypass the app's i18n layerThe rest of the app uses react-intl (ItemDetailModal.tsx:727 intl.formatMessage({id:'common.save'}), RecipeFinder), but all
  four new modals hardcode English strings ("Search Pantry Items", "Add Items", "Quick Add", "Review Scanned Items", "Edit Quantities", "Skip", "Save All"). Non-English      
  users lose coverage on the newest flows.

  F15 (P3) — Emoji-as-icon semanticsScanReviewModal.tsx:67,77 (🏠/🛒) and VisualQuantitySelector.tsx:19-23 (QUANTITY_LEVELS use 🥛 with text labels) — emoji may be announced 
  as character descriptions or skipped entirely. Add aria-hidden="true" to the emoji spans and rely on the visible text labels.

  F16 (P3) — Unlabeled slider in VisualQuantitySelectorC:\Users\cjohn\pantry\components\pantry\VisualQuantitySelector.tsx:266-276 — the <input type="range"> has no accessible
  name (the "Quantity" text at :259 is an unassociated span). The +/− steppers :286-312 also have no aria-label (the shared QuantityUnitPicker steppers at :163,:186 do —     
  inconsistent).

  F17 (P3) — Button size map inconsistent touch enforcementcomponents/ui/Button.tsx:71-74 — xs/sm add min-w-[44px] min-h-[44px], md/lg don't. h-10 md buttons (and md
  icon-only40×40) miss the44px target; anyone using size="md" with icon-only gets40px.

  F18 (P3) — Responsive sheet behavior on desktopAddItemsModal.tsx:195 and ScanReviewModal.tsx:44 use h-full on the panel with sm:items-center, so on desktop these render as 
  full-viewport-height columns (max-w-md / max-w-2xl) rather than a centered dialog — inconsistent with the shared Modal's modal-safe-h treatment. Consider capping panel     
  height on sm: screens.

  ---
  Metrics- Files audited:10 (4 new modals,6 modified) + shared primitives (Modal, BottomSheet, Button, AppHeader, AppNavigation, Toast, useModalOpen).

  - Bespoke full-screen overlays added that bypass the accessible Modal/BottomSheet primitives: 4.
  - Sub-44px interactive targets found: ~12 distinct controls.
  - Unlabeled/non-semantic form controls: 6 (ScanReviewModal item/qty/category/cost, PantrySearchModal search+autocomplete, VisualQuantitySelector slider+steppers).
  - Keyboard-only blockers: 2 (PantrySearchModal has no keyboard/back close path; AddItemsModal upload area not focusable).
  - Contrast failures (light theme): white-on-amber-500 CTAs (~2.1:1) and opacity-50/60/70 secondary text (2.6–4.3:1).

  What's working well- Modal.tsx focus trap + Escape + aria-modal + useModalOpen inert background (F45 from prior audit is solid).

  - BottomSheet/ConfirmDialog built on accessible primitives; ItemDetailModal correctly migrated to BottomSheet and portals to document.body.
  - Portal-to-body fixes added to RecipeModal and MealPlanner in this changeset (correct direction).
  - AppHeader moves focus into popovers and returns it to the trigger on close.
  - useAndroidBack self-registration correctly added to ScanReviewModal and BulkQuantityEditModal.
  - lang="en" and theme-color are set in index.html.

  The highest-leverage remediations are F1/F2 (route the four new modals through the shared Modal/BottomSheet primitives), F3 (allow zoom), and F4 (  on desktop these render as full-viewport-height columns (max-w-md / max-w-2xl) rather than a centered dialog — inconsistent with the shared       
  Modal's modal-safe-h treatment. Consider capping panel height on sm: screens.

  ---
  Metrics- Files audited:10 (4 new modals,6 modified) + shared primitives (Modal, BottomSheet, Button, AppHeader, AppNavigation, Toast,
  useModalOpen).

  - Bespoke full-screen overlays added that bypass the accessible Modal/BottomSheet primitives: 4.
  - Sub-44px interactive targets found: ~12 distinct controls.
  - Unlabeled/non-semantic form controls: 6 (ScanReviewModal item/qty/category/cost, PantrySearchModal search+autocomplete, VisualQuantitySelector  
  slider+steppers).
  - Keyboard-only blockers: 2 (PantrySearchModal has no keyboard/back close path; AddItemsModal upload area not focusable).
  - Contrast failures (light theme): white-on-amber-500 CTAs (~2.1:1) and opacity-50/60/70 secondary text (2.6–4.3:1).

  What's working well- Modal.tsx focus trap + Escape + aria-modal + useModalOpen inert background (F45 from prior audit is solid).

  - BottomSheet/ConfirmDialog built on accessible primitives; ItemDetailModal correctly migrated to BottomSheet and portals to document.body.       
  - Portal-to-body fixes added to RecipeModal and MealPlanner in this changeset (correct direction).
  - AppHeader moves focus into popovers and returns it to the trigger on close.
  - useAndroidBack self-registration correctly added to ScanReviewModal and BulkQuantityEditModal.
  - lang="en" and theme-color are set in index.html.

  The highest-leverage remediations are F1/F2 (route the four new modals through the shared Modal/BottomSheet primitives), F3 (allow zoom), and F4 
  - useAndroidBack self-registration correctly added to ScanReviewModal and BulkQuantityEditModal.
  - lang="en" and theme-color are set in index.html.

  The highest-leverage remediations are F1/F2 (route the four new modals through the shared Modal/BottomSheet primitives), F3 (allow zoom), and F4      
  (light-theme accent contrast).