Phase 1 — Zero‑Friction Leftover Capture

Goal
- Implement a quick, low-friction leftovers capture flow and enforce cooked‑rice safety rules so users can save leftovers fast and the app prevents high-risk food hazards.

Scope
- Leftover data model and persistence
- LeftoverQuickCapture UI (photo + servings + save)
- LeftoversHotZone component (quick access + countdowns)
- `leftoverService.ts` server/service layer
- Cooked Rice enforcement: hard 4‑day best‑before cap
- Seed `product_master` with Absolute Immortals and Danger Zone entries
- Wire `risk_level` into notification copy and aggregated Danger Zone alerts
- Tests for logic and Cooked Rice enforcement

Tasks
1. Define `Leftover` model
   - Fields: id, householdId, createdBy, createdAt (ISO), sourcePantryItemId?, photoUrl, servings, estimatedBestBefore (ISO), computedBestBefore (ISO), notes, productMasterId?, tags (['leftover','cooked'] optional), metadata (risk_level?), isFromRecipe?, freezerState ('fresh'|'frozen'|'defrosting')
   - Compute `computedBestBefore` at creation time using product_master.risk_level OR rule overrides (e.g., Cooked Rice → 4 days)

2. `leftoverService.ts`
   - Methods: createLeftover({householdId,user,photo,servings,sourceItem,productMasterId,metadata}), computeBestBefore(...), moveToPantryFromLeftover(), freezeLeftover(), defrostLeftover()
   - Persist to `households/{householdId}/leftovers/{leftoverId}` and optionally mirror a compact cache to `users/{uid}/cache/leftovers/{id}` for fast reads
   - Enforce Cooked Rice rule: if productMaster.name matches cooked-rice canonical IDs OR productMaster.tags includes 'cooked-rice' then computedBestBefore = min(clientProvidedBestBefore, createdAt + 4 days)

3. `LeftoverQuickCapture` UI
   - Small modal or bottom-sheet triggered from scanner/pantry row/meal planner
   - Fields: photo (camera or library), servings (1..), optional notes, quick tag picker (cooked, freezer), save button
   - On save: call `leftoverService.createLeftover`, provide optimistic UI + toast
   - Accessibility: keyboard input, camera permission handling

4. `LeftoversHotZone` component
   - Shows recently captured leftovers with countdowns (days left), quick actions: Add to Pantry, Move to Freezer, Discard
   - Visual: risk‑level color bands, cooked‑rice banner if within danger window

5. Product master seeding
   - Add entries for: salt, dry beans, honey (is_immortal=true), cooked‑rice canonical (risk_level=4, tags include 'cooked-rice'), deli items, high‑risk dairy (risk_level=5)
   - Provide migration script or admin seed helper to write into `product_master/{id}`

6. Notification & Alerts
   - Update `notificationService` to accept `risk_level` and `leftover` sources
   - Aggregated Danger Zone notification: when multiple items cross thresholds, bundle into single push/email with summary
   - Cooked Rice alert copy template: "Cooked Rice alert! 🍚 This batch is X days old—time to toss to avoid foodborne illness."
   - For `risk_level=5`: daily urgent push + red UI banner (user selected strict behaviour)

7. Tests & Typechecks
   - Unit tests for `computeBestBefore` including Cooked Rice hard cap
   - Integration tests for `LeftoverQuickCapture` save flow (mock `leftoverService`)
   - TypeScript check and run existing test suite focusing on affected modules

8. Verification & QA
   - Manual QA: capture leftover via camera, verify countdown, test MoveToFreezer and AddToPantry flows
   - Confirm that `is_immortal` items never surface expiry alerts
   - Confirm aggregated Danger Zone notifications trigger and show correct copy

9. Rollout & Migration
   - Deploy in a feature-flag gated release (LeftoversEnabled)
   - Seed product_master entries via migration script run by admin
   - Monitor notifications, support requests, and tweak risk levels if needed

Acceptance Criteria
- Users can capture a leftover in <= 3 taps and the item appears in `LeftoversHotZone` with correct countdown
- Cooked Rice leftovers are capped at 4 days best‑before and generate an urgent notification if nearing expiry
- `is_immortal` items remain excluded from expiry/alert flows and render the Shelf Stable badge
- Tests for `computeBestBefore` and leftover creation pass locally

Next Steps for Implementation
- Confirm approval to implement Phase 1
- I'll scaffold `leftoverService.ts`, `LeftoverQuickCapture` component, basic Firestore writes, and tests; then run `npm run type-check` and focused tests
- Optionally: create the migration script to seed `product_master` entries

Notes
- Keep serverTimestamp for top-level write metadata, but store `createdAt` and `computedBestBefore` as ISO strings for client comparisons and robust cross-platform behavior.
- Mirror small leftover cache into `users/{uid}/cache/leftovers` to enable fast local reads and offline-friendly UI.

