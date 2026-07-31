---
name: verify
description: Use when about to claim a change works, before committing, or when the user asks to "verify"/"check everything's good"/"run the checks" in the Stock & Spoon (pantry) repo — runs type-check, lint, and related tests scoped to what actually changed, and reports only failures.
---

# Verify

Runs the project's three checks (`tsc --noEmit`, `eslint`, `vitest`) scoped to
changed files, in a subagent, so raw pass/fail spam never lands in the main
thread's context. Only failures come back.

## When to use

- Before telling the user a fix/feature is done
- Before a commit
- User says "verify", "check", "run the checks", "does this pass"

## Workflow

1. Determine changed files: `git status --porcelain` + `git diff --name-only`
   (staged and unstaged). If nothing changed, say so and stop — don't run a
   full-repo sweep for no reason.
2. Dispatch **one** `general-purpose` subagent (or `test-runner` if the task
   is test-heavy) with this exact scope, so the noisy tool output stays out
   of the main thread:
   - `npx tsc --noEmit` (whole-project — TS has no reliable per-file mode
     that respects project references, so this always runs full but is fast)
   - `npx eslint <changed .ts/.tsx files>` (scoped — do not lint the whole
     repo)
   - `npx vitest run <related test files>` — map changed files to tests via
     `src/test/**` mirroring the domain path (e.g. `services/foo.ts` →
     `src/test/services/foo.test.ts`); if unsure, ask the subagent to find
     tests that import the changed module via `Grep`, not to run the whole
     suite
3. Subagent returns ONLY: pass/fail per check, and for failures the
   trimmed error output (file:line + message, not full stack/log dumps).
4. If all pass, report one line: "verify passed: tsc, eslint (N files),
   vitest (N tests)." Do not paste full command output into the main
   thread.
5. If anything fails, fix it, then re-run step 2 for just the
   still-failing check (not the whole set again) until green.

## Why scoped, not full-repo

Full `eslint .` / full `vitest run` dumps thousands of tokens of output
for files nobody touched. Scoping to the diff is what actually matters —
CI (if configured) can catch anything scoping misses.

## Common mistakes

- Running checks inline in the main thread instead of via subagent —
  defeats the purpose (output still lands in context)
- Re-running all three checks after fixing one failure — only re-run the
  failing one
- Full-repo eslint/vitest when only 2 files changed
