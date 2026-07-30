# Agentic OS Dashboard — Design

Date: 2026-07-30
Status: Approved approach A (self-contained HTML generator, hybrid Claude layer, config-driven customization)

## Purpose

A live status board for the Stock & Spoon repo's Claude tooling: what capabilities exist (skills, agents, workflows), what recurring routines are due, and the current audit/fix state. Regenerated on demand with one command; optionally enriched by a Claude-written summary.

## Non-goals

- No always-running server. Static, self-contained HTML opened via `file://`.
- No repo-health panel (git dirty files, test pass/fail) — explicitly excluded by user.
- No automatic scheduling/cron; routines are tracked, not executed.

## Architecture

Three pieces:

1. **Generator script** — `scripts/dashboard.mjs`, plain Node (no new dependencies). Scans repo state, merges config, renders one self-contained `dashboard.html` with all data and CSS inlined. Run via `npm run dashboard` (regenerates and opens in default browser). `npm run dashboard -- --done <routineId>` stamps a manual routine and regenerates.
2. **Config + state** — `.claude/dashboard/config.json` (versioned, user-editable customization) and `.claude/dashboard/state.json` (manual routine timestamps, versioned).
3. **Claude summary skill** — `.claude/skills/dashboard/SKILL.md`. When invoked (`/dashboard`), Claude reads audits + repo state, writes a prioritized summary with next actions to `.claude/dashboard/summary.md`, then runs the generator. The generator inlines `summary.md` (with its own file date) whenever the file exists.

Output location: `.claude/dashboard/dashboard.html` (gitignored — generated artifact).

## Data sources (auto-scan)

| Panel | Source |
|---|---|
| Agents | `.claude/agents/*.md` — name from filename, description from frontmatter/first paragraph |
| Skills | `.claude/skills/*/SKILL.md` — name + description from frontmatter |
| Workflows | Documented workflow list in `.claude/CLAUDE.md` (parse the "Available Workflows" section) |
| Audit findings | `.claude/audits/AUDIT_BUGS.md` — count findings by severity (parse headings/severity tags) |
| Fix progress | `.claude/audits/FIXES.md` — checked vs unchecked task items |
| Auditor freshness | File mtimes of `.claude/audits/*` outputs |
| Routine last-run | Per-routine `detect` rule (below) |

Parsers are lenient: if a file is missing or a section doesn't parse, the panel renders an empty/unknown state rather than failing the build.

## Customization model

`.claude/dashboard/config.json`, merged over auto-scan. Auto-scan is the source of truth for what exists; config augments/overrides. Shape:

```json
{
  "domains": ["Audit", "Fix & Test", "QA & Browser", "Release & Deploy", "Skills", "Workflows"],
  "routines": [
    {
      "id": "full-audit",
      "name": "Full audit",
      "cadenceDays": 7,
      "command": "run full-audit workflow",
      "detect": { "type": "auditDir" }
    },
    {
      "id": "release",
      "name": "Release",
      "cadenceDays": 14,
      "command": "/release",
      "detect": { "type": "commitPattern", "pattern": "^chore: release v" }
    },
    {
      "id": "graphify-update",
      "name": "Graphify update",
      "cadenceDays": 7,
      "command": "graphify update .",
      "detect": { "type": "fileMtime", "path": "graphify-out/graph.json" }
    },
    {
      "id": "dep-audit",
      "name": "Dependency audit",
      "cadenceDays": 30,
      "command": "run dep-auditor agent",
      "detect": { "type": "manual" }
    }
  ],
  "customCards": [
    { "domain": "Skills", "name": "…", "description": "…", "invoke": "…" }
  ],
  "overrides": {
    "agent:bug-auditor": { "description": "…", "domain": "Audit", "hidden": false }
  }
}
```

- **`routines[]`** — each has `id`, `name`, `cadenceDays`, `command` (what to type/run), `detect` rule:
  - `auditDir` — newest mtime in `.claude/audits/`
  - `commitPattern` — date of newest commit matching regex (via `git log`)
  - `fileMtime` — mtime of a given path
  - `manual` — stamped via `npm run dashboard -- --done <id>` into `state.json`
- **`customCards[]`** — arbitrary capability cards auto-scan can't see.
- **`overrides`** — keyed `agent:<name>` / `skill:<name>` / `workflow:<name>`; can rename, re-describe, re-domain, or hide.
- **`domains[]`** — column order/titles for the capability map. Unlisted domains append at the end.

Generator ships with a starter `config.json` containing the four routines above and a default domain mapping for the 24 existing agents. Missing config file → sensible defaults (same starter content, held in the script).

## Page layout (dark theme, screenshot-inspired)

1. **Header** — "Stock & Spoon — Agentic OS", generated timestamp, Claude summary banner (rendered from `summary.md` + its date) when present, with a hint to run `/dashboard` to refresh it.
2. **Routines strip** — one card per routine: name, cadence badge, last-done date, status color (green = within cadence, amber = due within 25% of cadence, red = overdue or never), `command` shown click-to-copy.
3. **Audit & fixes panel** — open finding counts by severity, FIXES.md progress bar (done/total), per-audit-file freshness list.
4. **Capability map** — columns per domain; card per agent/skill/workflow/customCard: name, one-line description, exact invoke text with click-to-copy button.

Single HTML file, inline CSS/JS, no external requests. Click-to-copy via `navigator.clipboard` with fallback.

## Error handling

- Missing/invalid `config.json` → log warning to console, use built-in defaults.
- Unparseable audit files → panel shows "could not parse" with file link, build continues.
- `git log` unavailable (non-git env) → commitPattern routines show "unknown".
- `--done <id>` with unknown id → error listing valid ids, exit 1.

## Testing

- Vitest unit tests for the pure parsing/merging functions (config merge, audit markdown parsing, routine status computation) in `src/test/services/` style, with the script's logic factored into importable functions (`scripts/dashboard/lib.mjs`) so the CLI entry stays thin.
- Manual smoke: run `npm run dashboard`, open output, verify panels against known repo state.

## Claude summary skill contract

`/dashboard` skill instructions: read `.claude/audits/*`, routine states (rerun generator's scan via `node scripts/dashboard.mjs --json` which prints collected data as JSON), write ≤200-word prioritized summary with 3-5 next actions to `.claude/dashboard/summary.md`, then run `npm run dashboard`. Summary file is optional input to the generator — plain Markdown, rendered with a minimal inline converter (headings, bold, lists).
