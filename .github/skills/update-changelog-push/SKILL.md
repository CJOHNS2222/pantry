---
name: update-changelog-push
description: '**WORKFLOW SKILL** — Update CHANGELOG.md with recent changes and push all commits to GitHub. USE FOR: committing and pushing already-built changes without a version bump. For a full release (type-check + version bump + build + publish + push), use the release-build skill instead.'
---

# Update Changelog and Push Changes

> **Tip:** For a full end-to-end release (type-check, version bump, build, Capacitor sync, Firestore publish, and push), use `/release-build` instead — it covers everything this skill does plus more.

This skill handles the final commit-and-push step when changes are already built and ready.

## Workflow Steps

1. **Review Recent Changes**: Run `git status` and `git log --oneline -10` to understand what has changed.

2. **Update CHANGELOG.md**: Add entries for recent changes at the top, following the format:
   - Version header: `## [version] - YYYY-MM-DD`
   - Sections: `### Added`, `### Changed`, `### Fixed`
   - Entries: `- Description of change`
   - Extract the current version from `package.json` if not provided.

3. **Stage Changes**: Run `git add -A` to stage all modified files including CHANGELOG.md.

4. **Commit Changes**: Create a commit with a descriptive message, e.g. `chore: update changelog and release vX.Y.Z`.

5. **Push to GitHub**: Run `git push` to push to the remote branch.

## Parameters

- `version`: The version number for the changelog entry (optional — extracted from `package.json` if omitted)
- `changes`: List of changes to add (optional — inferred from recent commits if omitted)

## Usage Examples

- "Update changelog and push all uncommitted changes"
- "Add changelog entry for notification fixes and push"

## See Also

- `/release-build` — Full pipeline: type-check → version bump → changelog → build → cap sync → Firestore publish → commit → push