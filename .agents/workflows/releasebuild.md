---
description: full release build pipeline
---

---
name: release-build
description: '**WORKFLOW SKILL** — Full release pipeline: type-check, version bump, changelog, production build, Capacitor sync, Firestore version publish, git commit, and push to GitHub. USE FOR: releasing new versions end-to-end with a single command. DO NOT USE FOR: development builds, testing, or partial updates.'
---

# Release Build (Full Pipeline)

This skill automates the **complete end-to-end release process** for the Stock & Spoon Capacitor app — from type checking all the way to pushing to GitHub and publishing the new version to Firestore so all clients receive the update prompt.

## Workflow Steps

### 1. TypeScript Type Checking
Run `npx tsc --noemit`. Fix any type errors before proceeding — do not skip.

### 2. Version Updates
- Increment `version` in `package.json` (patch by default: `0.0.1`)
- Increment `versionCode` in `android/app/build.gradle` by 1
- Update `versionName` in `android/app/build.gradle` to match the new `package.json` version

### 3. Changelog Update
- Add an entry at the top of `CHANGELOG.md` for the new version:
  ```
  ## [X.Y.Z] - YYYY-MM-DD
  ### Added / Changed / Fixed
  - ...
  ```
- Pull entries from recent git commits if `changelogEntries` is not provided.
- Ensure the new version header is the very first `##` heading — remove any duplicate old headers if present.
- Add changes made to the "What's New" modal in the app, which pulls from the latest changelog entry. This is what users see in the update prompt (`GlobalUpdatePrompt`) when they next open the app after the new version is published to Firestore.

### 4. Production Build
Run `npm run build`. Resolve any build errors before continuing.

### 5. Capacitor Sync
Run `npx cap sync android` to sync the web build into the Android project.

### 6. Publish Version to Firestore
Run `node scripts/publish-version.cjs` to write the new version into Firestore `app_versions/{android,ios,web}`. This is what triggers the in-app update prompt (`GlobalUpdatePrompt`) for all existing installs.

### 7. Stage All Changes
Run `git add -A` to stage every modified file (package.json, build.gradle, CHANGELOG.md, dist/, etc.).

### 8. Commit
Create a commit with a message that includes the new version, e.g.:
```
git commit -m "chore: release v{version}"
```

### 9. Push to GitHub
Run `git push` to push the commit to the current remote branch.

### 10. Build signed bundle
Run `cd android; .\gradlew bundleRelease` to assemble signedrelease bundle.

## Parameters

- `versionIncrement`: `patch` (default, `+0.0.1`), `minor` (`+0.1.0`), or `major` (`+1.0.0`)
- `versionCodeIncrement`: Integer to add to `versionCode` (default: `1`)
- `changelogEntries`: Optional explicit list of changes; if omitted, infer from recent commits

## Usage Examples

- `/release-build` — patch release with auto-inferred changelog
- `/release-build +0.1.0` — minor version bump
- `/release-build +1.0.0 +1` — major version bump
- `/release-build` with custom changelog entries provided inline

## Key Files

| File | Purpose |
|---|---|
| `package.json` | Source of truth for semver version |
| `android/app/build.gradle` | Android `versionCode` + `versionName` |
| `CHANGELOG.md` | Human-readable release history |
| `scripts/publish-version.cjs` | Pushes version to Firestore (`app_versions` collection) |
| `scripts/ornate-compass-478504-e1-firebase-adminsdk-fbsvc-b421e3c5e1.json` | Service account key (auto-detected by publish script) |

## Notes

- The `publish-version.cjs` script auto-detects the service account key in `scripts/` — no manual config needed.
- `GlobalUpdatePrompt.tsx` is already wired in `App.tsx` and will show the update modal to users on their next app foreground after Firestore is updated.
- If `npm run build` or `npx cap sync android` fail, stop and fix before committing.
- Never commit if `npx tsc --noemit` has errors.