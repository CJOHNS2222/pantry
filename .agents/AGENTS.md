# Stock & Spoon — Agent Project Rules (AGENTS.md)

Use this file as the authoritative instructions for any AI coding agent before editing code or adding features.

## 🚨 Critical Checklist (Always Do Before Committing)
1. **ESLint Cleanliness** — Every commit runs a pre-commit lint check (`eslint --fix --max-warnings=999`).
   - **Never** use `any` unless absolutely necessary. If required, use `/* eslint-disable-next-line @typescript-eslint/no-explicit-any */`.
   - **Never** leave unused imports or unused variables (even inside `catch` blocks—use `catch` without an unused parameter or prefix with `_`).
2. **Type Checking** — Always run `npx tsc --noEmit` to verify type safety.
3. **Response Protocol (VibeCheck)**:
   - End **every response** with the exact line `*verified by vibecheck*` on its own line at the end of the message.
   - If changes were made, place a **What's left** section directly above the badge showing remaining tasks (or `✅ Task complete — nothing remaining.` if fully finished).

---

## 1) Technology Stack & Conventions
- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS.
- **Backend & Database**: Firebase Firestore + Cloud Functions.
- **Mobile Integration**: Capacitor (Android / iOS).
- **Core Types**: Defined in `types.ts` and `types/` directory. Extend existing types rather than duplicating shapes.
- **Services**: Business logic belongs in `services/` (e.g. `groceryCheckoutService.ts`, `usageService.ts`), not inline in UI components.

---

## 2) Data Flow & Household Scoping
- **Central State**: Global state and actions are managed via `AppContext` and `AppActionsContext` in `contexts/`.
- **Database Operations**: Bypassing `hooks/useDataManagement.ts` for direct UI Firestore writes is strictly prohibited.
- **Multi-User Security**: Data is partitioned by household ID (`households/{householdId}/...`) or user ID (`users/{uid}/...`). Ensure all query modifications respect household membership validation.

---

## 3) Release Build Workflow (/releasebuild)
When publishing a new release, follow these exact steps in order:
1. **Type-Check** — Run `npx tsc --noEmit`.
2. **Version Bump**:
   - Increment `version` in `package.json`.
   - Increment `versionCode` in `android/app/build.gradle` (Android build number).
   - Match `versionName` in `android/app/build.gradle` to the new `package.json` version.
3. **Changelog** — Prepend the version and date header under `CHANGELOG.md` with descriptive bullet points of added/changed features.
4. **Vite Build** — Run `npm run build` to compile production assets.
5. **Capacitor Sync** — Run `npx cap sync android` to sync web assets to the native Android platform folder.
6. **Firestore Publish** — Run `node scripts/publish-version.cjs` to publish the version to Firestore, triggering the in-app update prompt for users.
7. **Git Commit & Push** — Commit changes via `git commit -m "chore: release v{version}"` and run `git push`.
8. **Native Bundle Assembly** — Build the signed AAB bundle by running `.\gradlew bundleRelease` in the `android/` directory.

---

## 4) Platform & UI Guardrails
- **Platform Guards** — Use `Capacitor.getPlatform()` or mobile-specific Capacitor plugin wrappers for mobile-native interactions.
- **Native-Only Features** — Wrap features like haptic feedback (`HapticService`) or immersive fullscreen/rotation guards in try-catch blocks and check platform bounds to prevent crashes on standard Web browsers.
- **Aesthetics & UI** — Use high-quality, polished HSL/CSS variables matching the theme design system. Avoid plain colors or generic designs.

---

If two rules conflict, prioritize:
1. Data security & multi-user boundaries.
2. ESLint compile-time correctness.
3. Architecture boundary alignment.
