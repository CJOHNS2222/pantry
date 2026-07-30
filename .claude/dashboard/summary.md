## Priorities

- **Run `run dep-auditor agent`** — the Dependency audit routine is overdue (never completed, 30-day cadence).
- **Decide P2 orphaned-feature calls in `.claude/audits/FIXES.md`** — start with `components/pantry/UseSoonRecommendations.tsx` (wire in as a dedicated section vs. port into `SmartRecommendations.tsx`), then `components/leftovers/LeftoversHotZone.tsx` (mount on the Pantry screen) and `components/shopping-list/OfflineShoppingIndicator.tsx` (mount in `ShoppingList.tsx`).
- **Resolve the camera/permission UI duplication** — extract the inline `PantryScanner.tsx:323-325` logic back into `CameraPermissionsModals.tsx` and delete `ContextualPermissions.tsx` (broken, wrong API).
- **Batch the P3 design-system consistency items** with `run code-fixer agent` once a P2 direction is picked — includes the scattered `useState(false)` modal-flag pattern in `App.tsx:138-148`.
- **Refresh stale audits** — `AUDIT_CODE.md` and `AUDIT_UI.md` are `warn` and dated 2026-07-29; `run full-audit workflow` next cycle.

## Notes

- `AUDIT_BUGS.md` (`fail`, 26 findings) largely restates the P2 orphaned-component list already tracked in FIXES.md — no new action needed beyond the items above.
