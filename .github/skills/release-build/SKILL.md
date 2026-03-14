---
name: release-build
description: '**WORKFLOW SKILL** — Perform a complete release build for the Capacitor app, including type checking, version updates, changelog, build, and sync. USE FOR: releasing new versions, automated deployment prep. DO NOT USE FOR: development builds, testing, or partial updates.'
---

# Release Build

This skill automates the complete release build process for the Stock & Spoon Capacitor app.

## Workflow Steps

1. **TypeScript Type Checking**: Execute `npx tsc --noemit` to ensure no type errors.

2. **Version Updates**:
   - Update `version` in `package.json` (increment patch version by default)
   - Update `versionCode` in `android/app/build.gradle` (increment by 1)
   - Update `versionName` in `android/app/build.gradle` to match package.json

3. **Changelog Update**: Add an entry in `CHANGELOG.md` for the new version with recent changes.

4. **Build**: Execute `npm run build` to build the app for production.

5. **Capacitor Sync**: Execute `npx cap sync android` to sync the build with the Android project.

## Parameters

- `versionIncrement`: How to increment version (default: "patch" for 0.0.1, or specify "major", "minor", "patch")
- `versionCodeIncrement`: How much to increment versionCode (default: 1)
- `changelogEntries`: Optional list of changes to add to changelog

## Usage Examples

- "Perform release build with patch version increment"
- "Release build for version 1.4.2 with custom changelog entries"
- "Build and sync for Android with version code +2"

## Assets

None required - uses standard build tools and file editing.