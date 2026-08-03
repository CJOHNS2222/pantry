# Claude Summary

## Priorities

- **Run dep-auditor agent** — Dependency audit routine still overdue (never completed, 30-day cadence); AUDIT_DEPS.md status fail, 10 findings.
- **Land F02 fix** — `functions/src/verifyPurchase.ts` uncommitted, matches FIXES.md F02 (purchase-token replay across accounts, P0). Finish, run `npm run test:rules`, commit.
- **Work P0 batch (F01–F12)** — data loss/security/payment tier. F04 (secret API creds in client bundle) needs Impact token rotation first, independent of code. Run code-fixer agent per item.
- **Review uncommitted pantry/recipe changes** — 7 modified + 4 new files (`components/pantry/`, `components/recipes-meals/`, `hooks/dataManagement/useInventory.ts`) staged as WIP; confirm complete before next commit.
- **Track FIXES.md completion** — counter reads 0/0, F-numbered headings not checkboxes; mark items done as they land so dashboard can burn down P0/P1/P2/P3.

## Notes

- Full-audit, release (v3.0.16), graphify-update all on cadence, last done 2026-08-01/08-02.
- AUDIT_API.md, AUDIT_DB.md, AUDIT_INFRA.md, AUDIT_DEPS.md still status fail from 2026-07-30 pass — items already in FIXES.md.
