---
name: fixbatch
description: Use when the user names specific item IDs from FIXES.md to implement (e.g. "do F12-F18", "fix F20 and F22"), rather than asking for a full audit-fix-verify cycle.
---

# fixbatch

Implement a named batch of `FIXES.md` items — nothing more, nothing less.

## Steps

1. Read `.claude/audits/FIXES.md`. Find the item IDs named in the request.
2. Implement only those IDs. If you notice an unrelated or unlisted bug nearby (even an obviously related one, like the same bug pattern in a neighboring function), leave it — name it in your final report as a candidate for a future item instead of fixing it inline.
3. Don't run `tsc`/lint/tests after every individual edit. Make all the edits for the batch first.
4. When the batch is done, run **/verify** once for the whole batch.
5. Update `FIXES.md` with `Edit`, not `Write` — change only the completed items' status lines (and the frontmatter `status`/count fields if present). Never regenerate or rewrite the file wholesale; a full rewrite risks dropping other items, especially if another fixer batch is touching the same file.
6. Skip live/emulator test suites unless the user explicitly asks for them.
7. Report: items done, items explicitly skipped and why (including any scope-creep candidates spotted in step 2), files touched.
