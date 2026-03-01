# Stock & Spoon — Copilot Project Rules (/init)

Use this file as the authoritative project context. Keep changes minimal, typed, and consistent with existing architecture.

## Quick Do / Don't
- **Do** keep changes minimal, scoped, and architecture-aligned.
- **Do** use existing types, hooks, and services before creating new patterns.
- **Do** preserve household scoping and Firestore ownership/membership checks.
- **Do** run type-check/tests when behavior changes.
- **Don't** add unrelated refactors, files, or abstractions.
- **Don't** bypass `hooks/useDataManagement.ts` with ad-hoc UI Firestore writes.
- **Don't** introduce ad-hoc data shapes when `types.ts` already defines the model.
- **Don't** log secrets or sensitive user data.

## 1) Stack & Style
- Stack: React 19 + TypeScript + Vite + Firebase + Capacitor.
- Prefer functional components + hooks.
- Reuse existing domain types from `types.ts` and `types/`.
- Do not introduce ad-hoc data shapes when an existing type can be extended.
- Keep imports, naming, and formatting consistent with nearby files.
- Prefer existing utilities/services over duplicate logic (`utils/`, `services/`).

## 2) Core Architecture Boundaries
- App bootstrap provider order in `index.tsx`:
  - `I18nProvider` → `AppProvider` → `AppActionsProvider`.
- `App.tsx` is the orchestration shell (routing/tabs/top-level wiring).
- Centralized data flow belongs in `hooks/useDataManagement.ts`.
- Avoid direct Firestore logic in random UI components; place domain logic in `services/`.
- Prefer context/hook wiring over prop drilling for global app state.

## 3) Data Model Conventions
- Key models: `PantryItem`, `ShoppingItem`, `SavedRecipe`, `DayPlan`, `Household`, `User`.
- Dates should be ISO strings (`YYYY-MM-DD` or ISO-8601 timestamps).
- Keep backward-compatible fields where the codebase already relies on them.
- Preserve immutable update patterns (no in-place mutation).

## 4) Firebase & Household Scoping
- Preserve household-aware scoping patterns:
  - `users/{uid}/...` for user-scoped data/cache.
  - `households/{householdId}/...` for shared household data.
- Maintain membership/ownership checks used by app logic and `firestore.rules`.
- Keep cache sync flows intact (`services/*CacheService.ts`, `services/syncStateService.ts`).

## 5) Platform & Integration Rules
- For platform-specific behavior, follow existing `Capacitor.getPlatform()` guards.
- Firebase setup is centralized in `firebaseConfig.ts`.
- Security constraints are governed by `firestore.rules`, `storage.rules`, and indexes.
- PWA/build chunking conventions live in `vite.config.ts`; align with existing strategy.

## 6) Security & Privacy
- Never commit secrets or keys.
- Use existing local env/config patterns (`.env.local`, `VITE_firebaseConfig.ts`).
- Preserve auth and ownership constraints in all reads/writes.
- Do not put sensitive user data in logs, analytics, or notifications payloads.

## 7) Observability & Errors
- Route telemetry through `services/analyticsService.ts`.
- Use Sentry helpers in `services/sentryService.ts` for error reporting.
- Prefer centralized user-facing error messaging patterns already in the repo.

## 8) Build, Lint, and Test Commands
- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Type-check: `npm run type-check`
- Unit tests: `npm test`
- Vitest UI: `npm run test:ui`
- E2E: `npm run e2e:playwright`

## 9) Change Strategy for AI Edits
- Fix root cause; avoid superficial patches.
- Keep edits focused and minimal; avoid unrelated refactors.
- Add/adjust tests when behavior changes and tests exist nearby.
- Respect existing naming and file structure conventions.
- When uncertain, choose the simplest implementation aligned with current patterns.

## 10) Quick Directory Guide
- `components/` UI components
- `hooks/` data/state hooks
- `services/` domain logic + integrations
- `contexts/` global app context/actions
- `utils/` shared helpers
- `types/` typed contracts
- `constants/` app constants/messages
- `functions/` backend/serverless scripts

## 11) High-Frequency Feature Patterns
### Pantry changes
1. Update `PantryItem` type.
2. Update relevant logic in `services/pantryService.ts` and/or `hooks/useDataManagement.ts`.
3. Update related UI components.
4. Validate security implications in rules if write/query shape changed.

### Shopping list changes
1. Update `ShoppingItem` type.
2. Update data flow/hook wiring.
3. Update UI components and interactions.
4. Run tests and type-check.

### Recipe feature changes
1. Implement/update in recipe services.
2. Wire through existing recipe components and context flows.
3. Preserve save/rating/meal-plan behaviors and limits.

---

If two rules conflict, prioritize:
1) security/data correctness,
2) existing architecture boundaries,
3) minimal, maintainable changes.
