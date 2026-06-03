Plan: Remove product_master + add cooked_rice flag

TL;DR — remove all product_master code and data, add a `cooked_rice: boolean` flag on inventory/leftover items (set by leftover UI checkbox), and update services to rely on denormalized fields only. No DB migrations.

Steps
1. Discovery — find all product_master usages and seeds
- Run a global search for `product_master` / `productMaster` / `product_masterId` and list matches.
- Files to inspect: `services/`, `scripts/`, `components/`, `hooks/`.

2. Remove product_master code + seeds
- Delete or stop using product_master seed files (e.g., `scripts/seedProductMaster.cjs`) and any runtime code that seeds product_master.
- Remove runtime lookups that query product_master (queries, getDoc, etc.) and replace them with denormalized usage.
- Files likely to edit: `services/pantryService.ts`, `services/leftoverService.ts`, and other services referencing product_master.

3. Add `cooked_rice` boolean to inventory/leftover model
- Update types: add `cooked_rice?: boolean` to inventory item / pantry item types in `types.ts`.
- Ensure code that creates inventory or leftover docs writes `cooked_rice: true` when applicable.

4. Wire UI checkbox to the new flag (only for leftover creation)
- Update leftover creation UIs to set the flag on payload:
  - `components/LeftoverQuickCapture.tsx`: replace behavior that wrote `productMasterTags`/`productMasterRiskLevel` with `cooked_rice: true` (and optionally set `tags`/`productRiskLevel` for compatibility).
  - Any other leftover entry points (MealPlanner cook flows, FreezeTransitionModal triggers) — ensure they set `cooked_rice` when user marks cooked-rice.
- Do NOT add cooked checkbox to `ItemDetailModal.tsx` (removed earlier).

5. Update leftover and freezer logic to use new flag
- Modify `computeBestBeforeISO` in `services/leftoverService.ts` to accept `cooked_rice?: boolean` and enforce the 4-day cap when true.
- When creating inventory docs for leftovers, set `tags`, `productRiskLevel`, and `cooked_rice` as denormalized fields.

6. Remove migration task & update todo list
- Remove any planned DB migrations from the project todo; we will not run migrations.

7. Tests
- Add unit tests:
  - `tests/leftoverService.computeBestBefore.test.ts` — verify cooked-rice 4-day cap and persona adjustments.
  - `tests/leftoverService.createConsumeDiscardRestore.test.ts` — create a leftover with `cooked_rice: true` and exercise flows.
  - `tests/LeftoverQuickCapture.spec.tsx` — ensure checkbox sets `cooked_rice` on payload and `simpleAddOrMarkLeftover` receives it.
- Update existing tests that assumed `product_master` lookups to use denormalized fields.

8. Verification & CI
- Run unit tests: `npm test`.
- Type-check: `npm run type-check`.
- Manual verification:
  - Create leftover with cooked-rice checked → inventory doc includes `cooked_rice: true` and `computedBestBefore` ≤ createdAt+4d.
  - Create leftover from linked pantry item → pantry item marked `is_leftover: true` and `leftoverMeta` stored.
  - Ensure no runtime code queries `product_master`.

Files / Targets (edit list)
- `types.ts` — add `cooked_rice?: boolean` to PantryItem/inventory types.
- `services/leftoverService.ts` — remove product_master lookups and accept/use `cooked_rice` in compute/create flows.
- `components/LeftoverQuickCapture.tsx` — set `cooked_rice` on payload; stop sending `productMasterTags`/`productMasterRiskLevel`.
- `services/pantryService.ts` — when creating items, prefer denormalized `cooked_rice` where applicable.
- Remove or archive: `scripts/seedProductMaster.cjs` and other product_master seeding code.
- Search-result edits wherever `product_master` was referenced.

Decisions / Rationale
- No migrations: write `cooked_rice` only for new writes; existing items remain unchanged.
- Denormalization: keep item-level safety metadata to avoid runtime product_master calls.
- Leftover image privacy: unchanged in this step.

Risks / Notes
- Some code may still expect `productMasterTags`/`productMasterRiskLevel` — create a compatibility shim where sensible (populate `tags`/`productRiskLevel` from `cooked_rice` in create flows).
- Tests that simulated product_master lookups must be updated.
- Server/cloud functions relying on `product_master` must be reviewed separately.

Next actions available
- Run a repo-wide search for `product_master`/`productMaster` and produce a precise edit list (files & exact lines), OR
- Implement the changes now (edit `types.ts`, `leftoverService.ts`, `LeftoverQuickCapture.tsx`, remove seeds, add tests).

Choose which next action to perform.
