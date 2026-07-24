---
agent: deploy-checker
status: fail
findings: 3
---

# Deploy Checker Report — Stock & Spoon

Date: 2026-07-24
Branch: `main` (release v3.0.13 tagged at HEAD's parent commit `24d4016`)

## Summary

Build, type-check, lint, and test all pass cleanly with no blocking code-level issues. However, a **critical secrets-hygiene failure** blocks deploy sign-off: three private-key-shaped files (`private.pem`, `public.pem`, `com.smart.pantry.enc`) are committed and tracked in git at the repo root, unlike the `*-service-account.json` pattern which is correctly gitignored. There are also uncommitted working-tree changes across ~17 files plus 3 new untracked `functions/src/*.ts` files that must be staged/committed before deploy (all 3 are confirmed wired into `functions/src/index.ts`, so they are not dead code — just uncommitted).

## Findings

### 1. [CRITICAL] Private key material tracked in git — `private.pem`, `public.pem`, `com.smart.pantry.enc`
- **Location:** repo root — `private.pem`, `public.pem`, `com.smart.pantry.enc` (confirmed via `git ls-files`, each has a git blob SHA, i.e. committed and present in history).
- **Description:** These filenames strongly suggest RSA keypair + encrypted payload, most likely for Android app signing / Google Play licensing (`.enc` matching `com.smart.pantry` package id) or IAP receipt verification. `.gitignore` explicitly excludes `*-service-account.json` but has no rule for `*.pem` or `*.enc`, so these were committed (likely unintentionally) and remain in git history even if later removed from the working tree.
- **Remediation:**
  1. Confirm what these files are used for (Android keystore/signing key export, Play licensing public key, encrypted IAP config, etc.) before touching them.
  2. Add `*.pem` and `*.enc` (or the specific filenames) to `.gitignore`.
  3. Remove them from the current tree with `git rm --cached` and, since git history retains the blobs, treat any private key material in them as **compromised** — rotate/regenerate if `private.pem` is a real private key, then purge history (e.g. `git filter-repo`) if this repo is or will be shared/public.
  4. Do not deploy/release further until this is resolved or explicitly accepted as a known/intentional risk by the team.

### 2. [WARN] Uncommitted changes in working tree
- **Location:** `git status --short` output (see Metrics below) — 17 modified files (components, hooks, services, functions/src, functions/lib, types.ts, test) + 3 untracked `functions/src/*.ts` files + 5 deleted stray files (`.gradle/.../fileHashes.lock`, `ANDROID_UI_UX_AUDIT_RECOMMENDATIONS.txt`, `audit.txt`, `items.txt`, `ollama_access_test.txt`, `test-parse.ts`).
- **Description:** A meaningful amount of in-progress work is uncommitted. Deploying from an uncommitted working tree (e.g. via CI that builds from HEAD) would silently ship different code than what's on `main`, or a manual local build would ship work that isn't in version control/reviewable history.
- **Remediation:** Review and commit (or stash/discard) all pending changes before deploy. The 3 untracked functions files (`googlePlayHelpers.ts`, `removeHouseholdMember.ts`, `subscriptionNotifications.ts`) are legitimate new modules — confirmed imported/exported from `functions/src/index.ts` and `verifyPurchase.ts` (not orphaned) — so they should be added and committed, not deleted. The stray deleted files (`audit.txt`, `items.txt`, `ollama_access_test.txt`, `test-parse.ts`, `ANDROID_UI_UX_AUDIT_RECOMMENDATIONS.txt`) look like scratch/debug artifacts being cleaned up — fine to let those deletions land, just confirm intentional.

### 3. [INFO] Large main JS chunks over Vite's 600 kB warning threshold
- **Location:** `dist/assets/index-B4xWc_a3.js` (815 kB / 239 kB gzip), `dist/assets/firebase-vendor-C1TZAO11.js` (798 kB / 236 kB gzip), `dist/assets/barcode-vendor-DTymxg3i.js` (452 kB / 119 kB gzip), `dist/assets/searchUtils-Db72SQBE.js` (386 kB / 76 kB gzip).
- **Description:** Non-blocking build warning; bundle size affects load performance especially on mobile/Capacitor WebView. Vite also flagged `utils/appUtils.ts` as both dynamically imported (from `hooks/dataManagement/useHousehold.ts`) and statically imported elsewhere, so the dynamic import isn't actually code-splitting it.
- **Remediation:** Not a deploy blocker. Consider follow-up with `npm run build:analyze` / perf-auditor to split `firebase-vendor` and the main `index` chunk further, and resolve the mixed static/dynamic import of `appUtils.ts` so it can move into its own chunk.

## Metrics

| Check | Result |
|---|---|
| `npm run type-check` | **PASS** — 0 errors |
| `npm run lint` | **PASS** (warnings only) — 0 errors, 610 warnings (all `@typescript-eslint/no-explicit-any`, pre-existing pattern across `utils/`, test files) |
| `npm test` (vitest) | **PASS** — 493 passed, 9 skipped, 0 failed (45 test files passed, 1 skipped, of 46) |
| `npm run build` | **PASS** — built in 4.46s, PWA precache 79 entries / 3971.37 KiB; largest chunk `index-B4xWc_a3.js` 815.31 kB (239.13 kB gzip) |
| `functions/` — `tsc --noEmit` | **PASS** — 0 errors |
| `functions/` — `eslint --ext .ts .` | **PASS** (warnings only) — 0 errors, 3 warnings (`no-non-null-assertion` x2, `no-unused-vars` x1 in `deleteAccount.ts`, `inviteMember.ts`) |
| Secrets check — `firebase-service-account.json` | Not tracked (correctly excluded via `.gitignore` `*-service-account.json`) |
| Secrets check — `private.pem` | **TRACKED — FAIL** |
| Secrets check — `public.pem` | **TRACKED — FAIL** (lower severity, public key, but still worth ignoring) |
| Secrets check — `com.smart.pantry.enc` | **TRACKED — FAIL** |
| Secrets check — generic `key` file | Not found |
| `git status --short` | 17 modified, 3 untracked (`functions/src/googlePlayHelpers.ts`, `removeHouseholdMember.ts`, `subscriptionNotifications.ts` — all wired into `index.ts`/`verifyPurchase.ts`, not orphaned), 5 deleted (scratch/debug files) |
| `firestore.rules` / `storage.rules` | No uncommitted changes — nothing pending review |

## Overall status: **FAIL**

Blocking reason: tracked private-key-shaped files (`private.pem`, `com.smart.pantry.enc`) in git. All functional gates (type-check, lint, tests, build, functions build) pass. Recommend resolving Finding 1 and committing/reviewing pending work (Finding 2) before deploying.
