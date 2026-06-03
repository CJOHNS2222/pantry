<#
PowerShell helper to purge sensitive files from git history using git-filter-repo.

Usage (run locally, **after** making a backup):
1. Install git-filter-repo (https://github.com/newren/git-filter-repo).
   e.g. `pip install git-filter-repo` or follow platform instructions.
2. From the repo root run in PowerShell as admin:
   ./scripts/purge-git-history.ps1 -PathsToPurge @('key','keyid','keyid.pub','pantry-release.keystore')

This script will:
 - remove the files from the current working tree and commit
 - run git-filter-repo to remove them from history
 - show next steps to force-push and rotate any credentials found

WARNING: Rewriting git history is destructive. Coordinate with your team.
#>

param(
  [string[]]$PathsToPurge = @('key','keyid','keyid.pub','pantry-release.keystore')
)

Write-Host "Removing listed files from HEAD and staging .gitignore updates..."
git rm --cached -r $PathsToPurge -f -q
git commit -m "chore(secrets): remove sensitive files from HEAD; add to .gitignore" || Write-Host "No files removed from HEAD or commit needed."

Write-Host "Checking for git-filter-repo..."
try {
  git filter-repo --version > $null 2>&1
  $hasFilterRepo = $true
} catch {
  $hasFilterRepo = $false
}

if (-not $hasFilterRepo) {
  Write-Host "git-filter-repo not found. Install it and re-run this script. See: https://github.com/newren/git-filter-repo"
  exit 1
}

$pathsCsv = $PathsToPurge -join ','
Write-Host "Running git-filter-repo to remove: $pathsCsv"
git filter-repo --invert-paths --paths $PathsToPurge

Write-Host "Done. Review the repo, then force-push to remote:"
Write-Host "  git push --force --all"
Write-Host "  git push --force --tags"
Write-Host "Rotate any secrets that were exposed and notify collaborators to re-clone the repo."
