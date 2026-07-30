---
name: dashboard
description: Use when the user asks to refresh, update, or summarize the Agentic OS dashboard ("/dashboard", "update the dashboard", "what should I work on") — writes a prioritized Claude summary and regenerates dashboard.html.
---

# Dashboard Summary

Refresh the Agentic OS dashboard with a Claude-written priority summary.

## Steps

1. Run `node scripts/dashboard.mjs --json` from the repo root and read the JSON output (routines with status, audit findings, fixes progress).
2. Read `.claude/audits/FIXES.md` "Still open" items and any overdue routines from the JSON.
3. Write `.claude/dashboard/summary.md` — plain Markdown, ≤200 words:
   - `## Priorities` — 3-5 bullet next actions, most urgent first (overdue routines, open P-level fixes, unresolved audit findings). Each bullet names the exact command or agent to run.
   - Optional `## Notes` — anything unusual (stale audits, parse failures).
   - Only `##`/`###` headings, `- ` bullets, `**bold**` — the renderer supports nothing else.
4. Run `npm run dashboard -- --no-open` to regenerate the HTML with the new summary.
5. Tell the user the dashboard is refreshed and list the top priorities inline.

## Notes

- Do not edit `dashboard.html` directly — it is generated.
- Manual routines are stamped with `npm run dashboard -- --done <id>` when the user says they completed one.
