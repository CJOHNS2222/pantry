# Infrastructure Audit — Stock & Spoon

Date: 2026-07-31
Scope: CI/CD, firebase.json, Android/Gradle config, build scripts, env handling, web/native drift.

---

## HIGH

### H1. Secret API token exposed in client bundle: `VITE_IMPACT_AUTH_TOKEN`
- Files: `services/groceryCheckoutService.ts:649-650`, `.env.example:41-42`, `vite-env.d.ts`
- `VITE_IMPACT_ACCOUNT_SID` and `VITE_IMPACT_AUTH_TOKEN` are read via `import.meta.env` and therefore statically inlined into the shipped JS bundle. The Impact auth token is a Basic-auth credential (account secret), not a publishable key — anyone can extract it from `dist/` or the APK webview assets and make API calls billed/attributed to your account.
- Fix: move Impact API calls behind a Firebase Cloud Function (like Stripe secrets already are, per `.env.example` comment) and delete both vars from the client env surface. Rotate the token after removal.

### H2. Release-critical Android changes uncommitted (config drift vs repo)
- Files (all modified, unstaged): `android/app/build.gradle` (targetSdk 35→36), `android/build.gradle` (AGP classpath 8.8.2→8.13.2), `android/gradle/libs.versions.toml` (agp 8.13.2, compileSdk 36), `android/app/src/main/AndroidManifest.xml` (`enableOnBackInvokedCallback="true"`).
- The last released build (v3.0.15, versionCode 108, commit c148233) does not match the working tree. A clean checkout builds targetSdk 35 on AGP 8.8.2 with Gradle wrapper 9.4.1 — AGP 8.8.x is **not** compatible with Gradle 9, so a fresh clone will fail to build Android at all until these are committed.
- Fix: commit the four android/ files together (plus `constants/changelogEntries.ts` housekeeping) as the "targetSdk 36 / AGP 8.13 / Gradle 9" upgrade. Verify a clean `./gradlew assembleDebug` from a fresh checkout.

### H3. Kotlin version drift: 2.2.10 vs 2.4.0
- `android/variables.gradle:17`: `kotlin_version = '2.2.10'`
- `android/gradle/libs.versions.toml:3`: `kotlin = "2.4.0"`
- Two declared Kotlin versions; whichever wins depends on which module reads which source. Capacitor plugin modules consume `variables.gradle` while the app module uses the version catalog — mixed Kotlin stdlib versions across modules can cause metadata-incompatibility build errors or subtle runtime issues.
- Fix: pick one source of truth (recommend the version catalog) and have `variables.gradle` read from it, or at minimum set both to the same version.

---

## MEDIUM

### M1. CI never runs the production web build
- File: `.github/workflows/ci.yml` — jobs: gitleaks, lint/type-check/test, functions lint/build, rules tests. `npm run build` (Vite production build) is never executed, so rollup/chunking/env-define/prebuild-changelog failures ship undetected until a manual deploy. There is also no Android assemble job (understandable given `google-services.json` is gitignored, see M4).
- Fix: add a `build` step (`npm run build`) to the `app` job; optionally upload `dist/` as an artifact.

### M2. No deploy pipeline; hosting deploys can ship stale `dist/`
- File: `firebase.json` — the app hosting target (`ornate-compass-478504-e1`, `public: "dist"`) has **no `predeploy`** (functions do have lint+build predeploy). A manual `firebase deploy --only hosting` publishes whatever old `dist/` is on disk.
- Fix: add `"predeploy": ["npm run build"]` to the app hosting entry, or add a GitHub Actions deploy workflow (e.g. `FirebaseExtended/action-hosting-deploy`) so hosting deploys are built from CI, not a dev machine.

### M3. Unpinned CI tooling
- `.github/workflows/ci.yml:27` — `zricethezav/gitleaks:latest` docker tag; behavior/ruleset can change under you.
- `.github/workflows/ci.yml:100` — `npm install -g firebase-tools` unversioned; emulator behavior drifts between runs.
- Fix: pin gitleaks to a version tag and firebase-tools to a known-good major (e.g. `npm install -g firebase-tools@13`).

### M4. Android build not reproducible from clone: `google-services.json` gitignored, undocumented provisioning
- `android/app/google-services.json` exists locally but is ignored. Any other machine/CI cannot build the Android app and nothing in `readme/` documents how to obtain it. (Note: the Firebase Android config file is not actually a secret — it's the same class of data as the web config in `VITE_firebaseConfig.ts`, which *is* committed. The web/native treatment is inconsistent.)
- Fix: either commit it (consistent with web config policy, protected by App Check/rules) or document provisioning (e.g. CI secret + write-to-file step) in `readme/`.

### M5. SDK versions triplicated across Gradle sources
- `minSdk`/`compileSdk`/`targetSdk` are declared in three places: `android/variables.gradle` (24/36/36), `android/gradle/libs.versions.toml` (`compileSdk`), and hardcoded in `android/app/build.gradle` (`minSdk 24`, `targetSdk 36`). Similarly, AGP is declared in `libs.versions.toml` **and** hardcoded as a `classpath` string in `android/build.gradle:11` — directly under a comment saying "Use AGP version from libs.versions.toml". These only stay in sync by manual discipline (the compileSdk 35-vs-36 mismatch existed until this week's uncommitted change).
- Fix: root `build.gradle` should use `libs.versions.agp` (or the plugins DSL); app module should read min/target from a single source; keep `variables.gradle` (Capacitor's contract) as that source or derive it from the catalog.

---

## LOW

### L1. AGP 8.13.x on Gradle 9.4.1 — verify supported combo
- Wrapper: `android/gradle/wrapper/gradle-wrapper.properties` → Gradle 9.4.1; AGP 8.13.2. This pairing works in practice but is ahead of Google's officially tested matrix for the 8.x line. When AGP 9 stabilizes for the Capacitor ecosystem, plan the move; until then pin and note the combo in `readme/`.
- The `patches/@codetrix-studio+capacitor-google-auth+3.4.0-rc.4.patch` (commit c5a7d51) correctly removes dead `jcenter()` repos for Gradle 9; it is applied via `postinstall: patch-package`, and CI's `npm ci` does run postinstall, so CI and local stay consistent. Good.

### L2. `.env.example` defaults `VITE_ADMOB_ENABLED=true`
- `.env.example:36` — a blind copy to `.env.local` enables AdMob paths in dev despite the comment saying to leave it unset/false. Fix: ship the example as `false`.

### L3. Aggressive immutable caching on website assets
- `firebase.json` `stock-spoon-website` target sets `Cache-Control: public,max-age=31536000,immutable` on all js/css/png/etc. Safe only if filenames are content-hashed; the static `website/` folder likely isn't. Verify or reduce max-age for non-hashed files.

### L4. Every CI job runs on every push
- No path filtering: android-only or docs-only changes still run functions build + emulator rules tests. Add `paths`/`paths-ignore` filters if CI minutes matter.

### L5. Uncommitted housekeeping files
- `.claude/dashboard/summary.md`, `constants/changelogEntries.ts` modified but uncommitted — commit or discard alongside H2 to keep the release history coherent.

---

## Verified-good
- `versionName "3.0.15"` / package.json `3.0.15` in sync; versionCode 108.
- `.env.local` and `android/app/google-services.json` are gitignored; `VITE_firebaseConfig.ts` contains only env-var references, no literals.
- Functions deploy has predeploy lint+build and `disallowLegacyRuntimeConfig: true`.
- CI runs rules tests against real emulators with a demo project id; gitleaks secret scanning present.
- patch-package patches (`capacitor-google-auth`, `capacitor-plugin-safe-area`) are committed and wired via `postinstall`.
