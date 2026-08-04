# CLAUDE.md

Guidance for Claude Code (claude.ai/code) here.

## Project
**Stock & Spoon** (`stockandspoon`) - household pantry, shopping list, meal planner, recipe app. React 19 + TS + Vite, Firebase (Firestore/Auth/Storage/Functions/Remote Config), Capacitor (Android only). Free/premium/family tiers via Google Play Billing.

> [!] Full architecture, cache-service internals, Firebase setup, domain-model conventions, integrations, directory map, Capacitor/mobile detail, subagent roster: **Obsidian vault** `C:\Users\cjohn\Documents\Obsidian Vault\Stock and Spoon\Overview.md` - Read on demand, not preloaded here. This file wins if the two ever conflict.

## Commands

```
npm install                  # use --legacy-peer-deps if @capacitor-firebase/* conflicts with capacitor-google-auth
npm run dev                  # vite dev server, port 3000
npm run build                # production build (predev/prebuild regenerate constants/changelogEntries.ts from CHANGELOG.md)
npm run build:analyze        # build + rollup-plugin-visualizer treemap at dist/stats.html
npm run lint                 # eslint .
npm run type-check           # tsc --noEmit (run with increased heap: already set in the script)
npm test                     # vitest (single run, not watch)
npm run test:rules           # Firestore security-rules tests (vitest.rules.config.ts) - run after any firestore.rules change
npm run test:ui              # vitest --ui
npm run e2e:playwright       # playwright test (e2e/playwright.config.ts)
npm run generate:changelog   # manually regenerate constants/changelogEntries.ts from CHANGELOG.md
npm run dashboard            # regenerate .claude/dashboard/summary.md
npm run build:release        # sync-release-notes then build - release pipeline entry point
npm run sync-release-notes   # sync CHANGELOG.md/changelogEntries.ts into release notes
npm run version:publish      # publish a new version (release pipeline)
npx cap sync android         # sync web build into the Android native project
npx cap run android          # build + run on device/emulator
omniroute launch --profile auto-best-coding # run omniroute launch with auto-best-coding profile
```

Single test file: `npx vitest run src/test/services/pantryService.fefo.test.ts`
Single test by name: `npx vitest run -t "test name"`
Single Playwright spec: `npx playwright test e2e/tests/scan.pw.ts` - note Playwright only picks up `*.pw.ts` files (`testMatch` in `e2e/playwright.config.ts`); stray `*.spec.ts` in `e2e/tests/` silently won't run.

## Verification
- Run `/verify` (tsc + eslint + tests) once at the end of a change batch. Do NOT run ad-hoc inline `npx tsc` / `tsc --noEmit` after every individual edit.
- Never run the live/emulator test suite unless explicitly asked — it is slow. Use the fast unit suite only.

## Non-negotiable data-flow rule
All Firestore reads/writes for pantry, shopping, meal plan, recipes must go through **`hooks/useDataManagement.ts`** - never ad-hoc Firestore calls from a UI component. Domain logic belongs in `services/`, not components. (Full architecture: vault.)

## Secrets & Infra Constraints
- Do not introduce paid services (e.g. Google Secret Manager) for config. Use gitignored `.env` files.
- Canonical production domain is the `.firebaseapp.com` URL — never substitute `.web.app`.
- Deploys and `git push` are run by the user, not by Claude. Prepare the change, then hand off the exact command.

## Environment essentials
- Env vars use `VITE_` prefix; actual Firebase SDK config in `VITE_firebaseConfig.ts`, not generic `.env`.
- `npm install` needs `--legacy-peer-deps` for `@capacitor-firebase/*` due to peer conflict with `@codetrix-studio/capacitor-google-auth`.
- `@/*` path alias -> project root (`tsconfig.json` + `vite.config.ts`).
- Tests: Vitest + jsdom under `src/test/**/*.test.{ts,tsx}`, globals mocked in `src/test/setup.ts`. `vi.mock()` over MSW. (Rest of pitfalls, mock list, directory map: vault.)

## graphify
Project has knowledge graph at graphify-out/ with god nodes, community structure, cross-file relationships.

Rules:
- Codebase questions: run `graphify query "<question>"` first when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships, `graphify explain "<concept>"` for focused concepts. Returns scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain don't surface enough context.
- After modifying code, run `graphify update .` to keep graph current (AST-only, no API cost).

## Bash/tool hygiene
- Use absolute paths in every Bash command; never `cd` into repo first (working directory already correct, `cd` resets across calls).
- Use Grep/Read/Glob tools instead of shell `grep`/`cat`/`find` - faster, respect `.gitignore`, don't dump raw output into context.
- Before claiming change works, use [[verify]] skill (`.claude/skills/verify/`) instead of running `tsc`/`eslint`/`vitest` inline - scopes to changed files, returns only failures.

## Rules
1. Never do work yourself — always delegate to correct agent.
2. Auditors run parallel; fixers run sequence.
3. All outputs go to `.claude/audits/`.

## Subagent Rules
- Every custom agent definition in `.claude/agents/` must have valid YAML frontmatter (`name`, `description`) or it will not register — verify before dispatching.
- When delegating implementation, include the exact regex/API contract in the prompt and require the subagent to run a type-check before reporting done. Parent must re-verify; do not trust 'complete' claims.

## Subagents (`.claude/agents/`)
24 predefined subagents + documented workflows (`full-audit`, `pre-commit`, `pre-deploy`, `new-feature`, `bug-fix`, `release-prep`). Full roster: vault `Subagents and Workflows` note. Auditor outputs go to `.claude/audits/`.
