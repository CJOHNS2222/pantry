---
name: update-changelog-push
description: '**WORKFLOW SKILL** — Update CHANGELOG.md with recent changes and push all commits to GitHub. USE FOR: releasing changes, updating version history, pushing commits after updates. DO NOT USE FOR: initial repository setup, merge conflicts, complex git rebasing.'
---

# Update Changelog and Push Changes

This skill automates the process of updating the changelog and pushing changes to GitHub after making updates to the pantry app.

## Workflow Steps

1. **Review Recent Changes**: Check git status and recent commits to understand what has changed.

2. **Update CHANGELOG.md**: Add entries for recent changes, following the format:
   - Version header: `## [version] - YYYY-MM-DD`
   - Sections: `### Added`, `### Changed`, `### Fixed`
   - Entries: `- Description of change`

3. **Stage Changes**: Add all modified files including CHANGELOG.md to git staging area.

4. **Commit Changes**: Create a commit with message "Update changelog and release changes".

5. **Push to GitHub**: Push the commits to the remote repository.

## Parameters

- `version`: The version number for the changelog entry (optional, can be extracted from package.json)
- `changes`: List of changes to add (optional, can be inferred from commits)

## Usage Examples

- "Update changelog for version 1.4.1 and push all changes"
- "Add changelog entry for notification fixes and commit with message 'Fix notification deduplication'"

## Assets

None required - uses standard git and file editing tools.