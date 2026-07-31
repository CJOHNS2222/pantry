---
name: release
description: Use when the user asks to cut a release, bump the version, or ship a new version of Stock & Spoon (pantry) — e.g. "release v3.0.x", "ship this", "cut a release". Not for regular commits.
---

# Release

Reproduces the repo's established `chore: release vX.Y.Z` pattern
(seen repeatedly in git log: 5e64c6e, 5794a7c7 etc.) as a repeatable
checklist instead of ad-hoc recall each time.

## Preconditions

Run these as quick checks before starting, stop and report if any fail:
- `git status --porcelain` clean (or only expected release-prep changes)
- On `main`, up to date with remote
- superpowers:verification-before-completion has been satisfied for
  everything going into this release (i.e. tests/type-check/lint already
  green — do not re-run the whole suite here, use [[verify]] first if
  unsure)

## Steps

1. **Determine version bump.** Read current version from `package.json`.
   Ask the user (or infer from changes: breaking → major, feature → minor,
   fix-only → patch) if not specified.
2. **Bump `package.json` version** (Edit, not `npm version`, to avoid an
   unwanted extra git tag/commit at this point).
3. **Regenerate CHANGELOG.md.** `npm run build` already triggers
   `prebuild`/`predev` changelog regen per CLAUDE.md — running
   `npm run build` covers this. Confirm `CHANGELOG.md` picked up the new
   version section.
4. **Production build.** `npm run build` — must exit 0. This is also the
   changelog trigger from step 3, so one command does both.
5. **Sync Android.** `npx cap sync android` — must exit 0.
6. **Commit.** `chore: release vX.Y.Z` — stage `package.json`,
   `package-lock.json` (if bumped), `CHANGELOG.md`, and any `android/`
   files `cap sync` touched. Do not `git add -A`; name the files.
7. **Report** the version, changelog summary, and confirm build+sync were
   clean. Do not push or tag unless the user asks — releases in this repo
   have historically been local commits first.

## Common mistakes

- Using `npm version` (creates a tag + commit before build/sync are
  verified — bump manually instead, commit once at the end)
- Skipping `npx cap sync android` — stale native bundle ships silently
- `git add -A` sweeping in unrelated working-tree changes into the
  release commit
