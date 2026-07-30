## Priorities

- **Run dep-auditor agent** — the Dependency audit routine is overdue (never completed, 30-day cadence).
- **Review the FIXES.md P2 list, then run code-fixer agent** — orphaned-feature decisions needed for UseSoonRecommendations, LeftoversHotZone, and OfflineShoppingIndicator (wire in or remove).
- **Run code-fixer agent on the camera/permission UI duplication** — merge the inline PantryScanner logic into CameraPermissionsModals and delete the broken ContextualPermissions.
- **Run code-fixer agent on the P3 design-system batch** once a P2 direction is picked — includes the scattered modal-flag pattern in App.tsx.
- **Run full-audit workflow next cycle** — AUDIT_CODE.md is stale (dated 2026-07-29); AUDIT_UI.md is current.

## Notes

- AUDIT_BUGS.md (fail, 26 findings) largely restates the P2 orphaned-component list already tracked in FIXES.md — no new action needed beyond the items above.
