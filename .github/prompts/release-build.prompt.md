---
description: "Automate the release build process for the Capacitor app: type check, update version and version code, update changelog, build, and sync Android"
name: "release-build"
argument-hint: "Provide the new version number (e.g., 1.2.3) and version code (e.g., 123)"
---

To perform a release build for the Capacitor app, follow these steps:

1. Run TypeScript type checking: Execute `npx tsc --noemit` to ensure no type errors.

2. Update version number and version code:
   - Update `version` in `package.json` to the new version.
   - Update `versionCode` in `android/app/build.gradle` to the new version code.

3. Update the changelog: Add an entry in `CHANGELOG.md` for the new version.

4. Run the build: Execute `npm run build` to build the app.

5. Sync with Capacitor for Android: Execute `npx cap sync android` to sync the build with the Android project.

Ensure all steps complete successfully before proceeding.

This prompt takes parameters: version and versionCode.