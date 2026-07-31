---
agent: infra-auditor
status: fail
findings: 6
---

## Summary

No Docker usage in this repo (Firebase/Capacitor stack, not expected). The critical gap is the complete absence of CI/CD automation: there are no GitHub Actions workflows, so nothing gates merges to `main` — no automated `type-check`/`lint`/`test`/`build` runs on PRs, and the entire release pipeline (`.github/skills/release-build/SKILL.md`) is an agent-driven manual sequence that pushes straight to `main` with no branch protection or review gate enforced in-repo. Additionally, an Android release-signing keystore is committed to git, and `.gitignore`'s keystore rule doesn't match the actual committed filename (config drift that let the secret slip through).

## Findings

### CRITICAL: Android release keystore committed to git, `.gitignore` pattern doesn't match it
- **File**: `android/app/pantry-release-new.keystore` (tracked since commit `047ad48`)
- **Description**: The release-signing keystore binary is committed to the repository history. `.gitignore` only excludes `pantry-release.keystore` (line 40), but the actual file on disk/in git is named `pantry-release-new.keystore` — the ignore rule never matched, so the keystore was never excluded from commits. Anyone with read access to the repo (or its history/forks) has the signing key material used to sign production Android release builds. Even without the password, this is a supply-chain risk (weak/reused/leaked password would allow forging updates that Google Play or sideloaded installs trust as legitimate).
- **Remediation**: Rotate the Android app signing key via Play App Signing if enrolled (or treat this as a signing-key compromise otherwise), purge the file from git history (`git filter-repo`/BFG), fix `.gitignore` to match the real filename (or use a glob `android/app/*.keystore`), and move the keystore to a secrets manager / CI secret store, never disk-committed.

### HIGH: No CI/CD pipeline — nothing gates merges or catches regressions automatically
- **File**: `.github/` (no `workflows/` directory exists)
- **Description**: The repo has `dependabot.yml` and Copilot/skill prompt docs under `.github/`, but zero GitHub Actions workflows. `npm run lint`, `type-check`, `test`, and `build` are documented as commands but nothing runs them automatically on push/PR. `firebase.json`'s `predeploy` hooks run lint+build only for Cloud Functions deploys, not for the main app or hosting. The entire release process (`.github/skills/release-build/SKILL.md`) is a locally/agent-run script sequence ending in `git push` directly, with no server-side check before code lands on `main` or before a production release is published to Firestore.
- **Remediation**: Add a GitHub Actions workflow (`.github/workflows/ci.yml`) running `npm run lint`, `npm run type-check`, `npm test`, and `npm run build` on every push/PR to `main`; enable branch protection requiring it to pass before merge.

### HIGH: Firebase Cloud Functions deploy has no CI verification gate
- **File**: `firebase.json:21-24`
- **Description**: `predeploy` runs lint+build for `functions/`, but this only executes locally when a developer/agent runs `firebase deploy`. There's no CI step verifying functions build/lint before that point, and no environment separation (single `.firebaserc` project `ornate-compass-478504-e1` used for both hosting sites and functions — no staging/prod split visible).
- **Remediation**: Add functions build+lint (and ideally functions unit tests) to the CI workflow above; consider a staging Firebase project for pre-prod verification of Cloud Functions and Firestore rules changes.

### MEDIUM: Firestore/Storage security rules have no automated validation
- **File**: `firestore.rules`, `storage.rules`, `firestore.indexes.json`
- **Description**: Rules changes are deployed via `firebase deploy` with no CI check (e.g. `firebase emulators:exec` running rules unit tests, or the Firebase MCP's `firebase_validate_security_rules`) before merge. A rules regression (e.g. accidentally loosening household-scoping) would only surface after deploy.
- **Remediation**: Add a CI step (or pre-push hook) that runs Firestore rules unit tests against the emulator, or at minimum calls rules validation before allowing `firebase deploy` of rules.

### MEDIUM: No automated secret-scanning in CI despite documented policy
- **File**: `.github/secret_scanning.yml`, `.github/skills/secret-scanning/SKILL.md`
- **Description**: There's a documented secret-scanning exclusions policy and skill, implying reliance on GitHub's native secret scanning (a GitHub-hosted feature, not something in this repo's CI). Since there's no CI workflow at all, there's also no local/CI-side pre-commit or pre-push secret scan (e.g. gitleaks) as a second line of defense — which is how the keystore file above slipped through undetected.
- **Remediation**: Add a lightweight secret-scan step (gitleaks or similar) to a pre-commit hook (repo already uses Husky + lint-staged — natural place to add it) and/or CI, covering binary files too (keystores, `.p12`, `.pem`) since GitHub secret scanning primarily targets known credential *patterns* in text, not arbitrary key files.

### LOW: `android/gradle.properties` is tracked in git with commented-out secret placeholders
- **File**: `android/gradle.properties:43-51`
- **Description**: The tracked file contains commented-out lines for `FIREBASE_TOKEN` and `sentry.authToken` (currently placeholder/redacted values, not live secrets — no active leak today). However, this file being tracked (rather than only `gradle.properties.example`) means it's easy for a future edit to accidentally uncomment and commit a real token, especially since Android Studio writes IDE-local overrides here by convention.
- **Remediation**: Gitignore `android/gradle.properties` itself (keep only `gradle.properties.example` tracked, matching how root `.env` is handled), and document that developers copy the example locally — consistent with the existing `android/gradle.properties.example` pattern already provided for signing values.

## Metrics

- GitHub Actions workflows: 0
- Dockerfiles: 0 (not expected for this stack)
- `.github/` automation files: `dependabot.yml`, `secret_scanning.yml`, skill/prompt docs only — no enforced workflows
- Secrets found committed to git: 1 (Android release keystore)
- `.gitignore` rules with filename drift vs. actual tracked/untracked files: 1 (keystore name mismatch)
- Firebase projects configured: 1 (`ornate-compass-478504-e1`), 2 hosting sites, no staging/prod split apparent
