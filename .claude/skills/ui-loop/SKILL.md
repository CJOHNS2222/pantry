---
name: ui-loop
description: Use for iterative visual/layout tweaks in Stock & Spoon — pixel nudges, spacing, carousel/grouping bugs, "move this up 15px", "the layout looks off" — anything needing a screenshot-fix-reshoot cycle against the running dev app.
---

# UI Loop

Screenshot-driven layout fixing without flooding the main thread with
screenshots. Each screenshot is ~1-2k tokens; a naive main-thread loop of
4-5 iterations burns 10k+ tokens on images alone.

## When to use

- User describes a visual/spacing/layout problem in the running app
- Iterating on a component's look ("carousel isn't grouped", "needs 15px
  more", "dots aren't aligned")

## Workflow

1. Confirm dev server is running (`npm run dev`, port 3000) — start it if
   not, in the background.
2. Dispatch a `browser-qa-agent` (or general-purpose with chrome-devtools
   MCP tools if browser-qa-agent isn't a fit) subagent with:
   - The exact user complaint verbatim
   - The component file path if known (Grep first to find it if not)
   - Instructions: navigate to the relevant tab/screen, take_screenshot,
     assess against the complaint, Edit the component, re-screenshot,
     repeat up to 3 rounds, then report back — file changed + before/after
     description in words, NOT the raw screenshots (those stay in the
     subagent's context)
3. Read the subagent's final summary. If it says fixed, do a quick manual
   sanity read of the diff (Read the file, don't reshoot yourself).
4. If not resolved in 3 rounds, the subagent should report what it tried
   and why it's stuck — don't let it silently loop forever.

## Common mistakes

- Taking screenshots directly in the main thread across multiple turns —
  each one stays in context for the rest of the session
- Not giving the subagent the user's exact wording — "make it bigger" vs
  "add 15px top margin" changes what gets tried first
