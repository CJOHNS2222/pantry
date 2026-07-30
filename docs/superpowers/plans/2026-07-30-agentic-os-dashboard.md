# Agentic OS Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One-command (`npm run dashboard`) self-contained dark HTML status board showing the repo's Claude capabilities (agents/skills/workflows), routine cadence status, and audit/fix state, customizable via `.claude/dashboard/config.json`, with an optional `/dashboard` Claude-summary skill.

**Architecture:** Pure parsing/merge logic in `scripts/dashboard/lib.mjs` (unit-tested), filesystem+git collection in `scripts/dashboard/collect.mjs`, HTML rendering in `scripts/dashboard/render.mjs`, thin CLI in `scripts/dashboard.mjs`. Data inlined into a single `dashboard.html` (gitignored). Config + manual-stamp state versioned in `.claude/dashboard/`.

**Tech Stack:** Plain Node ESM (no new dependencies), Vitest for unit tests.

## Global Constraints

- No new npm dependencies. Node built-ins only (`node:fs`, `node:path`, `node:child_process`, `node:url`).
- Output HTML is fully self-contained: inline CSS/JS, zero external requests, works via `file://`.
- All parsers lenient: missing/unparseable input → empty/unknown state, never a thrown build failure.
- Tests live under `src/test/scripts/`, run with `npx vitest run <file>`.
- Windows is the dev platform: browser-open uses `cmd /c start ""`, guard with `process.platform === 'win32'`, fall back to `open` (darwin) / `xdg-open`.
- Repo-relative paths resolved from repo root (CWD of `npm run dashboard`), not `import.meta.url`.
- Spec: `docs/superpowers/specs/2026-07-30-agentic-os-dashboard-design.md`.

## Known input formats (verified against real files)

- **Agent files** `.claude/agents/<name>.md`: NO frontmatter. `# Title` heading; `## Role` section whose first non-empty line is the one-line description.
- **Skill files** `.claude/skills/<dir>/SKILL.md`: YAML frontmatter `name:` / `description:` (single-line values).
- **Workflows**: `.claude/CLAUDE.md` section `## Available Workflows`, bullets `- **name**: description`.
- **Audit files** `.claude/audits/AUDIT_*.md`: YAML frontmatter `agent:`, `status:`, `findings:` (integer). Body has severity headings like `### Critical — ...`, `### High — ...` with numbered items.
- **FIXES.md**: no checkboxes. Done items marked `✅`; open items tagged `🔴`/`🟡`/`🟢` (legend in file). Progress heuristic: done = count of `✅`, total = done + count of `🔴` + `🟡` + `🟢`.

---

### Task 1: Capability parsers (agents, skills, workflows)

**Files:**
- Create: `scripts/dashboard/lib.mjs`
- Test: `src/test/scripts/dashboard-lib-capabilities.test.ts`

**Interfaces:**
- Produces (used by Tasks 2-4):
  - `parseFrontmatter(text: string): { data: Record<string,string>, body: string }`
  - `parseAgentFile(filename: string, text: string): { id: string, name: string, description: string, invoke: string }` — id `agent:<basename>`, invoke `` `run <basename> agent` ``
  - `parseSkillFile(dirName: string, text: string): { id, name, description, invoke }` — id `skill:<dirName>`, invoke `/<dirName>`
  - `parseWorkflows(claudeMdText: string): Array<{ id, name, description, invoke }>` — id `workflow:<name>`, invoke `` `run <name> workflow` ``

- [ ] **Step 1: Write the failing test**

```ts
// src/test/scripts/dashboard-lib-capabilities.test.ts
import { describe, it, expect } from 'vitest';
import { parseFrontmatter, parseAgentFile, parseSkillFile, parseWorkflows } from '../../../scripts/dashboard/lib.mjs';

describe('parseFrontmatter', () => {
  it('extracts simple key: value pairs and body', () => {
    const { data, body } = parseFrontmatter('---\nname: verify\ndescription: Runs checks\n---\n\n# Verify\n');
    expect(data.name).toBe('verify');
    expect(data.description).toBe('Runs checks');
    expect(body).toContain('# Verify');
  });
  it('returns empty data when no frontmatter', () => {
    const { data, body } = parseFrontmatter('# Just a doc');
    expect(data).toEqual({});
    expect(body).toBe('# Just a doc');
  });
});

describe('parseAgentFile', () => {
  const agentMd = '# Bug Auditor\n\nYou are the **Bug Auditor** agent.\nOutput: `.claude/audits/AUDIT_BUGS.md`\n\n## Role\nRuntime bugs, logic errors, edge cases\n\n## Scope\nAnalyze the codebase.\n';
  it('takes name from filename, description from ## Role section', () => {
    const card = parseAgentFile('bug-auditor.md', agentMd);
    expect(card).toEqual({
      id: 'agent:bug-auditor',
      name: 'bug-auditor',
      description: 'Runtime bugs, logic errors, edge cases',
      invoke: 'run bug-auditor agent',
    });
  });
  it('falls back to first body paragraph when no ## Role section', () => {
    const card = parseAgentFile('x.md', '# X\n\nDoes a thing.\n');
    expect(card.description).toBe('Does a thing.');
  });
  it('returns empty description for empty file', () => {
    expect(parseAgentFile('x.md', '').description).toBe('');
  });
});

describe('parseSkillFile', () => {
  it('reads name/description from frontmatter, invoke is slash command', () => {
    const card = parseSkillFile('verify', '---\nname: verify\ndescription: Runs type-check, lint, tests\n---\n# Verify\n');
    expect(card).toEqual({
      id: 'skill:verify',
      name: 'verify',
      description: 'Runs type-check, lint, tests',
      invoke: '/verify',
    });
  });
  it('truncates description to 160 chars', () => {
    const long = 'x'.repeat(300);
    const card = parseSkillFile('s', `---\ndescription: ${long}\n---\n`);
    expect(card.description.length).toBeLessThanOrEqual(160);
  });
});

describe('parseWorkflows', () => {
  const claudeMd = '## Available Agents\n- **code-auditor**: Code quality\n\n## Available Workflows\n- **full-audit**: All 11 auditors in parallel → fix-planner\n- **pre-commit**: Quick code + test check before commit\n\n## Rules\n1. Never\n';
  it('parses only the Available Workflows section', () => {
    const wfs = parseWorkflows(claudeMd);
    expect(wfs).toHaveLength(2);
    expect(wfs[0]).toEqual({
      id: 'workflow:full-audit',
      name: 'full-audit',
      description: 'All 11 auditors in parallel → fix-planner',
      invoke: 'run full-audit workflow',
    });
  });
  it('returns [] when section missing', () => {
    expect(parseWorkflows('# nothing here')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/scripts/dashboard-lib-capabilities.test.ts`
Expected: FAIL — cannot resolve `scripts/dashboard/lib.mjs`.

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/dashboard/lib.mjs
// Pure parsing/merge logic for the Agentic OS dashboard. No fs/git access here.

export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text || '');
  if (!m) return { data: {}, body: text || '' };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^(\w[\w-]*):\s*(.*)$/.exec(line);
    if (kv) data[kv[1]] = kv[2].trim();
  }
  return { data, body: text.slice(m[0].length) };
}

const clip = (s, n = 160) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function firstParagraph(body) {
  for (const block of body.split(/\r?\n\r?\n/)) {
    const t = block.trim();
    if (t && !t.startsWith('#')) return t.split(/\r?\n/)[0].trim();
  }
  return '';
}

export function parseAgentFile(filename, text) {
  const name = filename.replace(/\.md$/i, '');
  const { body } = parseFrontmatter(text || '');
  let description = '';
  const role = /^## Role\s*\r?\n+([^\r\n#]+)/m.exec(body);
  if (role) description = role[1].trim();
  else description = firstParagraph(body);
  return { id: `agent:${name}`, name, description: clip(description), invoke: `run ${name} agent` };
}

export function parseSkillFile(dirName, text) {
  const { data } = parseFrontmatter(text || '');
  return {
    id: `skill:${dirName}`,
    name: data.name || dirName,
    description: clip(data.description || ''),
    invoke: `/${dirName}`,
  };
}

export function parseWorkflows(claudeMdText) {
  const sec = /## Available Workflows\s*\r?\n([\s\S]*?)(?=\r?\n## |$)/.exec(claudeMdText || '');
  if (!sec) return [];
  const out = [];
  for (const line of sec[1].split(/\r?\n/)) {
    const m = /^- \*\*([\w-]+)\*\*:\s*(.+)$/.exec(line.trim());
    if (m) out.push({ id: `workflow:${m[1]}`, name: m[1], description: clip(m[2]), invoke: `run ${m[1]} workflow` });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/scripts/dashboard-lib-capabilities.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/dashboard/lib.mjs src/test/scripts/dashboard-lib-capabilities.test.ts
git commit -m "feat(dashboard): capability parsers for agents, skills, workflows"
```

---

### Task 2: Audit + fixes parsers

**Files:**
- Modify: `scripts/dashboard/lib.mjs` (append)
- Test: `src/test/scripts/dashboard-lib-audits.test.ts`

**Interfaces:**
- Consumes: `parseFrontmatter` from Task 1.
- Produces (used by Task 4):
  - `parseAuditFile(filename: string, text: string, mtimeIso: string): { file, agent, status, findings: number|null, severityCounts: Record<string, number>, updated: string }`
  - `parseFixesProgress(text: string): { done: number, total: number }`

- [ ] **Step 1: Write the failing test**

```ts
// src/test/scripts/dashboard-lib-audits.test.ts
import { describe, it, expect } from 'vitest';
import { parseAuditFile, parseFixesProgress } from '../../../scripts/dashboard/lib.mjs';

describe('parseAuditFile', () => {
  const audit = `---
agent: bug-auditor
status: fail
findings: 26
---

# Bug Audit

### Critical — Orphaned features

1. **A** — thing one.

2. **B** — thing two.

### High — Dead hooks

22. **C** — thing.
`;
  it('reads frontmatter and counts numbered items per severity heading', () => {
    const r = parseAuditFile('AUDIT_BUGS.md', audit, '2026-07-30T10:00:00.000Z');
    expect(r.agent).toBe('bug-auditor');
    expect(r.status).toBe('fail');
    expect(r.findings).toBe(26);
    expect(r.severityCounts).toEqual({ Critical: 2, High: 1 });
    expect(r.updated).toBe('2026-07-30T10:00:00.000Z');
    expect(r.file).toBe('AUDIT_BUGS.md');
  });
  it('handles file with no frontmatter and no severity headings', () => {
    const r = parseAuditFile('AUDIT_X.md', '# Loose notes', '2026-01-01T00:00:00.000Z');
    expect(r.agent).toBe(null);
    expect(r.findings).toBe(null);
    expect(r.severityCounts).toEqual({});
  });
});

describe('parseFixesProgress', () => {
  it('counts ✅ as done, colored dots as open', () => {
    const md = '1. ✅ **Fixed thing**\n2. ✅ **Other fixed**\n- 🔴 keep or kill\n- 🟡 investigate\n- 🟢 mechanical\n';
    expect(parseFixesProgress(md)).toEqual({ done: 2, total: 5 });
  });
  it('empty input → zero/zero', () => {
    expect(parseFixesProgress('')).toEqual({ done: 0, total: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/scripts/dashboard-lib-audits.test.ts`
Expected: FAIL — `parseAuditFile` not exported.

- [ ] **Step 3: Write minimal implementation (append to lib.mjs)**

```js
export function parseAuditFile(filename, text, mtimeIso) {
  const { data, body } = parseFrontmatter(text || '');
  const severityCounts = {};
  const re = /^### (Critical|High|Medium|Low)\b[^\r\n]*\r?\n([\s\S]*?)(?=\r?\n### |\r?\n## |$)/gm;
  let m;
  while ((m = re.exec(body))) {
    const items = (m[2].match(/^\s*\d+\.\s/gm) || []).length;
    severityCounts[m[1]] = (severityCounts[m[1]] || 0) + items;
  }
  return {
    file: filename,
    agent: data.agent || null,
    status: data.status || null,
    findings: data.findings != null && /^\d+$/.test(data.findings) ? Number(data.findings) : null,
    severityCounts,
    updated: mtimeIso,
  };
}

export function parseFixesProgress(text) {
  const done = (text?.match(/✅/g) || []).length;
  const open = (text?.match(/[🔴🟡🟢]/gu) || []).length;
  return { done, total: done + open };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/scripts/dashboard-lib-audits.test.ts`
Expected: PASS (4 tests). Also rerun Task 1 file: `npx vitest run src/test/scripts/dashboard-lib-capabilities.test.ts` — still PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/dashboard/lib.mjs src/test/scripts/dashboard-lib-audits.test.ts
git commit -m "feat(dashboard): audit and fixes progress parsers"
```

---

### Task 3: Config defaults, merge, overrides, routine status

**Files:**
- Modify: `scripts/dashboard/lib.mjs` (append)
- Test: `src/test/scripts/dashboard-lib-config.test.ts`

**Interfaces:**
- Produces (used by Task 4/5):
  - `DEFAULT_CONFIG` — object with `domains`, `routines` (the 4 spec routines), `customCards: []`, `overrides: {}`, `agentDomains` (name→domain map)
  - `mergeConfig(userConfig: object|null): config` — deep-ish merge over `DEFAULT_CONFIG`: arrays replaced if provided, `overrides`/`agentDomains` object-merged
  - `applyOverrides(cards: Card[], config): Card[]` — applies `config.overrides[id]` (`description`, `domain`, `name`, `hidden`), assigns `domain` from `agentDomains`/card type defaults, drops hidden
  - `computeRoutineStatus(routine: {cadenceDays}, lastDoneIso: string|null, nowIso: string): { status: 'ok'|'due'|'overdue', daysSince: number|null }` — never done → overdue/daysSince null; ≥ cadence → overdue; ≥ 0.75×cadence → due; else ok

- [ ] **Step 1: Write the failing test**

```ts
// src/test/scripts/dashboard-lib-config.test.ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, mergeConfig, applyOverrides, computeRoutineStatus } from '../../../scripts/dashboard/lib.mjs';

describe('DEFAULT_CONFIG', () => {
  it('ships the four spec routines and domain list', () => {
    expect(DEFAULT_CONFIG.routines.map((r: any) => r.id)).toEqual(['full-audit', 'release', 'graphify-update', 'dep-audit']);
    expect(DEFAULT_CONFIG.domains).toContain('Audit');
    expect(DEFAULT_CONFIG.agentDomains['bug-auditor']).toBe('Audit');
  });
});

describe('mergeConfig', () => {
  it('null/undefined user config → defaults', () => {
    expect(mergeConfig(null)).toEqual(DEFAULT_CONFIG);
  });
  it('user routines replace default routines; overrides merge', () => {
    const merged = mergeConfig({ routines: [{ id: 'x', name: 'X', cadenceDays: 1, command: 'x', detect: { type: 'manual' } }], overrides: { 'agent:bug-auditor': { hidden: true } } });
    expect(merged.routines).toHaveLength(1);
    expect(merged.domains).toEqual(DEFAULT_CONFIG.domains);
    expect(merged.overrides['agent:bug-auditor'].hidden).toBe(true);
  });
});

describe('applyOverrides', () => {
  const cards = [
    { id: 'agent:bug-auditor', name: 'bug-auditor', description: 'bugs', invoke: 'run bug-auditor agent' },
    { id: 'skill:verify', name: 'verify', description: 'checks', invoke: '/verify' },
    { id: 'workflow:full-audit', name: 'full-audit', description: 'all auditors', invoke: 'run full-audit workflow' },
  ];
  it('assigns domains: agents via agentDomains, skills → Skills, workflows → Workflows', () => {
    const out = applyOverrides(cards, DEFAULT_CONFIG);
    expect(out.find(c => c.id === 'agent:bug-auditor')!.domain).toBe('Audit');
    expect(out.find(c => c.id === 'skill:verify')!.domain).toBe('Skills');
    expect(out.find(c => c.id === 'workflow:full-audit')!.domain).toBe('Workflows');
  });
  it('applies rename/re-describe/hide', () => {
    const cfg = mergeConfig({ overrides: { 'skill:verify': { description: 'better', domain: 'Release & Deploy' }, 'agent:bug-auditor': { hidden: true } } });
    const out = applyOverrides(cards, cfg);
    expect(out.some(c => c.id === 'agent:bug-auditor')).toBe(false);
    const v = out.find(c => c.id === 'skill:verify')!;
    expect(v.description).toBe('better');
    expect(v.domain).toBe('Release & Deploy');
  });
});

describe('computeRoutineStatus', () => {
  const now = '2026-07-30T12:00:00.000Z';
  const r = { cadenceDays: 8 };
  it('never done → overdue, daysSince null', () => {
    expect(computeRoutineStatus(r, null, now)).toEqual({ status: 'overdue', daysSince: null });
  });
  it('fresh → ok', () => {
    expect(computeRoutineStatus(r, '2026-07-29T12:00:00.000Z', now)).toEqual({ status: 'ok', daysSince: 1 });
  });
  it('at 75% of cadence → due', () => {
    expect(computeRoutineStatus(r, '2026-07-24T12:00:00.000Z', now).status).toBe('due');
  });
  it('past cadence → overdue', () => {
    expect(computeRoutineStatus(r, '2026-07-20T12:00:00.000Z', now).status).toBe('overdue');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/scripts/dashboard-lib-config.test.ts`
Expected: FAIL — `DEFAULT_CONFIG` not exported.

- [ ] **Step 3: Write minimal implementation (append to lib.mjs)**

```js
export const DEFAULT_CONFIG = {
  domains: ['Audit', 'Fix & Test', 'QA & Browser', 'Release & Deploy', 'Utility', 'Skills', 'Workflows'],
  routines: [
    { id: 'full-audit', name: 'Full audit', cadenceDays: 7, command: 'run full-audit workflow', detect: { type: 'auditDir' } },
    { id: 'release', name: 'Release', cadenceDays: 14, command: '/release', detect: { type: 'commitPattern', pattern: '^chore: release v' } },
    { id: 'graphify-update', name: 'Graphify update', cadenceDays: 7, command: 'graphify update .', detect: { type: 'fileMtime', path: 'graphify-out/graph.json' } },
    { id: 'dep-audit', name: 'Dependency audit', cadenceDays: 30, command: 'run dep-auditor agent', detect: { type: 'manual' } },
  ],
  customCards: [],
  overrides: {},
  agentDomains: {
    'code-auditor': 'Audit', 'bug-auditor': 'Audit', 'security-auditor': 'Audit', 'doc-auditor': 'Audit',
    'infra-auditor': 'Audit', 'ui-auditor': 'Audit', 'db-auditor': 'Audit', 'perf-auditor': 'Audit',
    'dep-auditor': 'Audit', 'seo-auditor': 'Audit',
    'fix-planner': 'Fix & Test', 'code-fixer': 'Fix & Test', 'test-runner': 'Fix & Test', 'test-writer': 'Fix & Test',
    'api-tester': 'QA & Browser', 'browser-qa-agent': 'QA & Browser', 'fullstack-qa-orchestrator': 'QA & Browser',
    'console-monitor': 'QA & Browser', 'visual-diff': 'QA & Browser',
    'deploy-checker': 'Release & Deploy', 'env-validator': 'Release & Deploy', 'pr-writer': 'Release & Deploy',
    'seed-generator': 'Utility', 'architect-reviewer': 'Utility',
  },
};

export function mergeConfig(userConfig) {
  const u = userConfig || {};
  return {
    domains: Array.isArray(u.domains) ? u.domains : DEFAULT_CONFIG.domains,
    routines: Array.isArray(u.routines) ? u.routines : DEFAULT_CONFIG.routines,
    customCards: Array.isArray(u.customCards) ? u.customCards : DEFAULT_CONFIG.customCards,
    overrides: { ...DEFAULT_CONFIG.overrides, ...(u.overrides || {}) },
    agentDomains: { ...DEFAULT_CONFIG.agentDomains, ...(u.agentDomains || {}) },
  };
}

export function applyOverrides(cards, config) {
  const out = [];
  for (const card of cards) {
    const o = config.overrides[card.id] || {};
    if (o.hidden) continue;
    let domain = o.domain;
    if (!domain) {
      if (card.id.startsWith('agent:')) domain = config.agentDomains[card.name] || 'Utility';
      else if (card.id.startsWith('skill:')) domain = 'Skills';
      else if (card.id.startsWith('workflow:')) domain = 'Workflows';
      else domain = 'Utility';
    }
    out.push({ ...card, name: o.name || card.name, description: o.description || card.description, domain });
  }
  return out;
}

export function computeRoutineStatus(routine, lastDoneIso, nowIso) {
  if (!lastDoneIso) return { status: 'overdue', daysSince: null };
  const days = (new Date(nowIso) - new Date(lastDoneIso)) / 86400000;
  const daysSince = Math.floor(days);
  if (days >= routine.cadenceDays) return { status: 'overdue', daysSince };
  if (days >= routine.cadenceDays * 0.75) return { status: 'due', daysSince };
  return { status: 'ok', daysSince };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/scripts/`
Expected: PASS, all three test files.

- [ ] **Step 5: Commit**

```bash
git add scripts/dashboard/lib.mjs src/test/scripts/dashboard-lib-config.test.ts
git commit -m "feat(dashboard): config defaults, merge, overrides, routine status"
```

---

### Task 4: Collector (fs + git) and CLI with --json / --done

**Files:**
- Create: `scripts/dashboard/collect.mjs`
- Create: `scripts/dashboard.mjs`
- Create: `.claude/dashboard/config.json`
- Create: `.claude/dashboard/state.json`
- Modify: `package.json` (add `"dashboard": "node scripts/dashboard.mjs"` to `scripts`)
- Modify: `.gitignore` (add `.claude/dashboard/dashboard.html`)

**Interfaces:**
- Consumes: everything exported by `lib.mjs`.
- Produces (used by Task 5):
  - `collect(rootDir: string, nowIso: string): DashboardData` where `DashboardData = { generatedAt, summary: {markdown, updated}|null, cards: Card[] (with domain), domains: string[], routines: Array<{id,name,cadenceDays,command,lastDone,status,daysSince}>, audits: {files: AuditInfo[], fixes: {done,total}|null} }`
  - CLI behaviors: no args → write `.claude/dashboard/dashboard.html` + open browser; `--json` → print `JSON.stringify(data, null, 2)`, no file write, no open; `--done <id>` → stamp `state.json` then regenerate; `--no-open` → write without opening.

No unit tests for this task (fs/git side effects) — verified by CLI smoke runs. Rendering is stubbed until Task 5.

- [ ] **Step 1: Create starter config and state files**

`.claude/dashboard/config.json` — starter content users edit (routines/customCards/overrides documented in spec):

```json
{
  "domains": ["Audit", "Fix & Test", "QA & Browser", "Release & Deploy", "Utility", "Skills", "Workflows"],
  "routines": [
    { "id": "full-audit", "name": "Full audit", "cadenceDays": 7, "command": "run full-audit workflow", "detect": { "type": "auditDir" } },
    { "id": "release", "name": "Release", "cadenceDays": 14, "command": "/release", "detect": { "type": "commitPattern", "pattern": "^chore: release v" } },
    { "id": "graphify-update", "name": "Graphify update", "cadenceDays": 7, "command": "graphify update .", "detect": { "type": "fileMtime", "path": "graphify-out/graph.json" } },
    { "id": "dep-audit", "name": "Dependency audit", "cadenceDays": 30, "command": "run dep-auditor agent", "detect": { "type": "manual" } }
  ],
  "customCards": [],
  "overrides": {}
}
```

`.claude/dashboard/state.json`:

```json
{ "manualStamps": {} }
```

- [ ] **Step 2: Write the collector**

```js
// scripts/dashboard/collect.mjs
// Filesystem + git collection. All reads lenient — failures degrade to null/empty.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  parseAgentFile, parseSkillFile, parseWorkflows, parseAuditFile, parseFixesProgress,
  mergeConfig, applyOverrides, computeRoutineStatus,
} from './lib.mjs';

const readSafe = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const readJsonSafe = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const mtimeSafe = (p) => { try { return fs.statSync(p).mtime.toISOString(); } catch { return null; } };
const listSafe = (p) => { try { return fs.readdirSync(p); } catch { return []; } };

function newestMtimeInDir(dir) {
  let newest = null;
  for (const f of listSafe(dir)) {
    const t = mtimeSafe(path.join(dir, f));
    if (t && (!newest || t > newest)) newest = t;
  }
  return newest;
}

function lastCommitDate(rootDir, pattern) {
  try {
    const out = execFileSync('git', ['log', '-1', '--grep', pattern, '--format=%cI'], { cwd: rootDir, encoding: 'utf8' }).trim();
    return out ? new Date(out).toISOString() : null;
  } catch { return null; }
}

function detectLastDone(routine, rootDir, state) {
  const d = routine.detect || { type: 'manual' };
  if (d.type === 'auditDir') return newestMtimeInDir(path.join(rootDir, '.claude', 'audits'));
  if (d.type === 'commitPattern') return lastCommitDate(rootDir, d.pattern || '');
  if (d.type === 'fileMtime') return mtimeSafe(path.join(rootDir, d.path || ''));
  return state?.manualStamps?.[routine.id] || null;
}

export function collect(rootDir, nowIso) {
  const dash = path.join(rootDir, '.claude', 'dashboard');
  const config = mergeConfig(readJsonSafe(path.join(dash, 'config.json')));
  const state = readJsonSafe(path.join(dash, 'state.json')) || { manualStamps: {} };

  const cards = [];
  const agentsDir = path.join(rootDir, '.claude', 'agents');
  for (const f of listSafe(agentsDir).filter((f) => f.endsWith('.md'))) {
    cards.push(parseAgentFile(f, readSafe(path.join(agentsDir, f)) || ''));
  }
  const skillsDir = path.join(rootDir, '.claude', 'skills');
  for (const dir of listSafe(skillsDir)) {
    const text = readSafe(path.join(skillsDir, dir, 'SKILL.md'));
    if (text != null) cards.push(parseSkillFile(dir, text));
  }
  for (const wf of parseWorkflows(readSafe(path.join(rootDir, '.claude', 'CLAUDE.md')) || '')) cards.push(wf);
  for (const c of config.customCards) {
    cards.push({ id: `custom:${c.name}`, name: c.name, description: c.description || '', invoke: c.invoke || '', domain: c.domain });
  }
  const finalCards = applyOverrides(cards, config);

  const auditsDir = path.join(rootDir, '.claude', 'audits');
  const auditFiles = listSafe(auditsDir)
    .filter((f) => /^AUDIT_.*\.md$/i.test(f))
    .map((f) => parseAuditFile(f, readSafe(path.join(auditsDir, f)) || '', mtimeSafe(path.join(auditsDir, f)) || nowIso));
  const fixesText = readSafe(path.join(auditsDir, 'FIXES.md'));
  const fixes = fixesText != null ? parseFixesProgress(fixesText) : null;

  const routines = config.routines.map((r) => {
    const lastDone = detectLastDone(r, rootDir, state);
    return { ...r, lastDone, ...computeRoutineStatus(r, lastDone, nowIso) };
  });

  const summaryMd = readSafe(path.join(dash, 'summary.md'));
  const summary = summaryMd != null ? { markdown: summaryMd, updated: mtimeSafe(path.join(dash, 'summary.md')) } : null;

  return { generatedAt: nowIso, summary, cards: finalCards, domains: config.domains, routines, audits: { files: auditFiles, fixes } };
}
```

- [ ] **Step 3: Write the CLI (render stubbed)**

```js
// scripts/dashboard.mjs
// CLI: npm run dashboard [-- --json | --done <id> | --no-open]
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { collect } from './dashboard/collect.mjs';

const root = process.cwd();
const args = process.argv.slice(2);
const dashDir = path.join(root, '.claude', 'dashboard');
const outPath = path.join(dashDir, 'dashboard.html');

if (args[0] === '--done') {
  const id = args[1];
  const statePath = path.join(dashDir, 'state.json');
  let state = { manualStamps: {} };
  try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch { /* fresh state */ }
  const data = collect(root, new Date().toISOString());
  const valid = data.routines.map((r) => r.id);
  if (!id || !valid.includes(id)) {
    console.error(`Unknown routine id "${id ?? ''}". Valid ids: ${valid.join(', ')}`);
    process.exit(1);
  }
  state.manualStamps[id] = new Date().toISOString();
  fs.mkdirSync(dashDir, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
  console.log(`Stamped ${id} at ${state.manualStamps[id]}`);
}

const data = collect(root, new Date().toISOString());

if (args.includes('--json')) {
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

const { renderHtml } = await import('./dashboard/render.mjs').catch(() => ({ renderHtml: (d) => `<pre>${JSON.stringify(d, null, 2)}</pre>` }));
fs.mkdirSync(dashDir, { recursive: true });
fs.writeFileSync(outPath, renderHtml(data));
console.log(`Wrote ${outPath}`);

if (!args.includes('--no-open') && !args.includes('--done')) {
  if (process.platform === 'win32') execFile('cmd', ['/c', 'start', '', outPath]);
  else if (process.platform === 'darwin') execFile('open', [outPath]);
  else execFile('xdg-open', [outPath]);
}
```

Note: after `--done`, execution falls through to regenerate — intended (spec: stamp then regenerate). The `--done` branch's open-suppression is handled by the final `!args.includes('--done')` guard.

- [ ] **Step 4: Add npm script and gitignore entry**

In `package.json` `scripts` block add:

```json
"dashboard": "node scripts/dashboard.mjs"
```

In `.gitignore` append:

```
.claude/dashboard/dashboard.html
```

- [ ] **Step 5: Smoke-verify**

Run: `npm run dashboard -- --json`
Expected: JSON with ~24 agent cards + 4 skills + 6 workflows, 4 routines (full-audit/graphify-update with real ISO `lastDone`, release with commit date, dep-audit overdue/null), audits.files including AUDIT_BUGS.md `findings: 26`, fixes done/total > 0.

Run: `npm run dashboard -- --done dep-audit`
Expected: "Stamped dep-audit at …", `state.json` updated, stub HTML written.

Run: `npm run dashboard -- --done nonsense`
Expected: exit 1, lists valid ids.

- [ ] **Step 6: Commit**

```bash
git add scripts/dashboard.mjs scripts/dashboard/collect.mjs .claude/dashboard/config.json .claude/dashboard/state.json package.json .gitignore
git commit -m "feat(dashboard): collector and CLI with --json and --done stamping"
```

---

### Task 5: HTML renderer (dark theme, panels, click-to-copy)

**Files:**
- Create: `scripts/dashboard/render.mjs`
- Test: `src/test/scripts/dashboard-render.test.ts`

**Interfaces:**
- Consumes: `DashboardData` shape from Task 4.
- Produces: `renderHtml(data): string`, `renderMarkdown(md): string` (minimal: `##`/`###` headings, `**bold**`, `- ` lists, paragraphs; all HTML-escaped first).

- [ ] **Step 1: Write the failing test**

```ts
// src/test/scripts/dashboard-render.test.ts
import { describe, it, expect } from 'vitest';
import { renderHtml, renderMarkdown } from '../../../scripts/dashboard/render.mjs';

const data = {
  generatedAt: '2026-07-30T12:00:00.000Z',
  summary: { markdown: '## Priorities\n- Fix **thing**', updated: '2026-07-30T11:00:00.000Z' },
  domains: ['Audit', 'Skills'],
  cards: [
    { id: 'agent:bug-auditor', name: 'bug-auditor', description: 'Runtime bugs', invoke: 'run bug-auditor agent', domain: 'Audit' },
    { id: 'skill:verify', name: 'verify', description: 'Runs checks <fast>', invoke: '/verify', domain: 'Skills' },
  ],
  routines: [
    { id: 'full-audit', name: 'Full audit', cadenceDays: 7, command: 'run full-audit workflow', lastDone: '2026-07-30T09:00:00.000Z', status: 'ok', daysSince: 0 },
    { id: 'dep-audit', name: 'Dependency audit', cadenceDays: 30, command: 'run dep-auditor agent', lastDone: null, status: 'overdue', daysSince: null },
  ],
  audits: {
    files: [{ file: 'AUDIT_BUGS.md', agent: 'bug-auditor', status: 'fail', findings: 26, severityCounts: { Critical: 21, High: 5 }, updated: '2026-07-30T10:00:00.000Z' }],
    fixes: { done: 7, total: 20 },
  },
};

describe('renderMarkdown', () => {
  it('renders headings, bold, lists; escapes HTML', () => {
    const html = renderMarkdown('## Hi\n- a **b** <script>');
    expect(html).toContain('<h2>Hi</h2>');
    expect(html).toContain('<strong>b</strong>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});

describe('renderHtml', () => {
  const html = renderHtml(data as any);
  it('is self-contained (no external refs)', () => {
    expect(html).not.toMatch(/(src|href)=["']https?:/);
  });
  it('renders all panels', () => {
    expect(html).toContain('Agentic OS');
    expect(html).toContain('Full audit');           // routine card
    expect(html).toContain('data-status="overdue"'); // never-done routine
    expect(html).toContain('AUDIT_BUGS.md');         // audit freshness
    expect(html).toContain('7/20');                  // fixes progress
    expect(html).toContain('bug-auditor');           // capability card
    expect(html).toContain('<h2>Priorities</h2>');   // summary rendered
  });
  it('escapes card content', () => {
    expect(html).toContain('Runs checks &lt;fast&gt;');
  });
  it('renders without summary', () => {
    expect(renderHtml({ ...data, summary: null } as any)).not.toContain('Priorities');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/scripts/dashboard-render.test.ts`
Expected: FAIL — cannot resolve `render.mjs`.

- [ ] **Step 3: Write the renderer**

```js
// scripts/dashboard/render.mjs
// Self-contained dark HTML. No external requests; inline CSS/JS only.

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderMarkdown(md) {
  const lines = esc(md).split(/\r?\n/);
  const out = [];
  let inList = false;
  for (const line of lines) {
    const bolded = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    if (/^### /.test(bolded)) { if (inList) { out.push('</ul>'); inList = false; } out.push(`<h3>${bolded.slice(4)}</h3>`); }
    else if (/^## /.test(bolded)) { if (inList) { out.push('</ul>'); inList = false; } out.push(`<h2>${bolded.slice(3)}</h2>`); }
    else if (/^- /.test(bolded)) { if (!inList) { out.push('<ul>'); inList = true; } out.push(`<li>${bolded.slice(2)}</li>`); }
    else if (bolded.trim() === '') { if (inList) { out.push('</ul>'); inList = false; } }
    else out.push(`<p>${bolded}</p>`);
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}

const fmtDate = (iso) => (iso ? iso.slice(0, 10) : 'never');

function routineCard(r) {
  const badge = r.daysSince == null ? 'never' : `${r.daysSince}d ago`;
  return `<div class="card routine" data-status="${esc(r.status)}">
    <div class="row"><span class="name">${esc(r.name)}</span><span class="pill">${r.cadenceDays}d</span></div>
    <div class="meta">last: ${fmtDate(r.lastDone)} · ${badge}</div>
    <button class="copy" data-copy="${esc(r.command)}">${esc(r.command)}</button>
  </div>`;
}

function capabilityCard(c) {
  return `<div class="card">
    <div class="name">${esc(c.name)}</div>
    <div class="desc">${esc(c.description)}</div>
    <button class="copy" data-copy="${esc(c.invoke)}">${esc(c.invoke)}</button>
  </div>`;
}

function auditRow(a) {
  const sev = Object.entries(a.severityCounts).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—';
  return `<div class="audit-row"><span class="mono">${esc(a.file)}</span><span>${a.findings ?? '?'} findings</span><span>${esc(sev)}</span><span class="meta">${fmtDate(a.updated)}</span></div>`;
}

export function renderHtml(data) {
  const summaryHtml = data.summary
    ? `<section class="summary"><div class="meta">Claude summary · ${fmtDate(data.summary.updated)} · refresh with /dashboard</div>${renderMarkdown(data.summary.markdown)}</section>`
    : `<section class="summary empty"><div class="meta">No Claude summary yet — run /dashboard in Claude Code to add one.</div></section>`;

  const routinesHtml = data.routines.map(routineCard).join('\n');

  const fixes = data.audits.fixes;
  const pct = fixes && fixes.total > 0 ? Math.round((100 * fixes.done) / fixes.total) : 0;
  const auditsHtml = `
    ${fixes ? `<div class="fixes"><div class="row"><span>FIXES.md</span><span>${fixes.done}/${fixes.total}</span></div><div class="bar"><div class="fill" style="width:${pct}%"></div></div></div>` : '<div class="meta">No FIXES.md</div>'}
    ${data.audits.files.map(auditRow).join('\n') || '<div class="meta">No audit files</div>'}`;

  const byDomain = new Map(data.domains.map((d) => [d, []]));
  for (const c of data.cards) {
    if (!byDomain.has(c.domain)) byDomain.set(c.domain, []);
    byDomain.get(c.domain).push(c);
  }
  const mapHtml = [...byDomain.entries()]
    .filter(([, cards]) => cards.length)
    .map(([domain, cards]) => `<div class="column"><h3>${esc(domain)}</h3>${cards.map(capabilityCard).join('\n')}</div>`)
    .join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stock &amp; Spoon — Agentic OS</title>
<style>
:root{--bg:#0b0e14;--panel:#131722;--card:#1a2030;--border:#2a3245;--text:#dbe2f0;--dim:#8b94a8;--accent:#e8833a;--ok:#3fb96a;--due:#e0b040;--overdue:#e05252;--mono:ui-monospace,Consolas,monospace}
*{box-sizing:border-box;margin:0}
body{background:var(--bg);color:var(--text);font:14px/1.5 system-ui,Segoe UI,sans-serif;padding:24px;max-width:1400px;margin:0 auto}
h1{font-size:20px;letter-spacing:.04em} h2{font-size:15px;margin:8px 0} h3{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin-bottom:8px}
header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px}
.meta{color:var(--dim);font-size:12px}
section{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:16px}
.summary h2{color:var(--accent)} .summary ul{padding-left:20px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.card{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px}
.card .name{font-weight:600} .card .desc{color:var(--dim);font-size:12px;margin:4px 0 8px}
.row{display:flex;justify-content:space-between;align-items:center}
.pill{background:var(--border);border-radius:99px;padding:1px 8px;font-size:11px;color:var(--dim)}
.routine{border-left:3px solid var(--border)}
.routine[data-status="ok"]{border-left-color:var(--ok)}
.routine[data-status="due"]{border-left-color:var(--due)}
.routine[data-status="overdue"]{border-left-color:var(--overdue)}
.copy{display:block;width:100%;margin-top:8px;background:#0e1220;border:1px dashed var(--border);border-radius:6px;color:var(--text);font-family:var(--mono);font-size:12px;padding:6px 8px;cursor:pointer;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.copy:hover{border-color:var(--accent)} .copy.copied{border-color:var(--ok)}
.columns{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
.column .card{margin-bottom:10px}
.audit-row{display:grid;grid-template-columns:1.4fr .7fr 1.6fr .6fr;gap:8px;padding:6px 0;border-top:1px solid var(--border);font-size:13px}
.mono{font-family:var(--mono)}
.fixes{margin-bottom:10px}
.bar{height:8px;background:var(--border);border-radius:99px;overflow:hidden;margin-top:4px}
.fill{height:100%;background:var(--ok)}
</style></head><body>
<header><h1>Stock &amp; Spoon — Agentic OS</h1><span class="meta">generated ${esc(data.generatedAt)}</span></header>
${summaryHtml}
<section><h2>Routines</h2><div class="grid">${routinesHtml}</div></section>
<section><h2>Audit &amp; Fixes</h2>${auditsHtml}</section>
<section><h2>Capability Map</h2><div class="columns">${mapHtml}</div></section>
<script>
document.addEventListener('click', function (e) {
  var btn = e.target.closest('.copy'); if (!btn) return;
  var text = btn.getAttribute('data-copy');
  function done(){ btn.classList.add('copied'); setTimeout(function(){ btn.classList.remove('copied'); }, 800); }
  if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, done); }
  else { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); }
});
</script>
</body></html>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/scripts/`
Expected: PASS, all four test files.

- [ ] **Step 5: Full smoke**

Run: `npm run dashboard -- --no-open`
Expected: "Wrote …dashboard.html". Open `.claude/dashboard/dashboard.html` in browser manually: dark page, 4 routine cards with correct colors, audit panel with AUDIT_BUGS.md + FIXES progress bar, capability columns with ~34 cards, click a command → copied.

- [ ] **Step 6: Commit**

```bash
git add scripts/dashboard/render.mjs src/test/scripts/dashboard-render.test.ts
git commit -m "feat(dashboard): dark self-contained HTML renderer with click-to-copy"
```

---

### Task 6: /dashboard Claude summary skill

**Files:**
- Create: `.claude/skills/dashboard/SKILL.md`

**Interfaces:**
- Consumes: `npm run dashboard -- --json` (machine-readable data), writes `.claude/dashboard/summary.md` (rendered by Task 5's summary panel).

- [ ] **Step 1: Write the skill**

```markdown
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
```

- [ ] **Step 2: Verify the skill end-to-end manually**

Run: `node scripts/dashboard.mjs --json` — confirm JSON prints.
Write a test `.claude/dashboard/summary.md` with `## Priorities` + two bullets, run `npm run dashboard -- --no-open`, open HTML — summary banner shows with date. Delete or keep the test summary as a real first summary.

- [ ] **Step 3: Run repo verification**

Use the `verify` skill (project convention) to type-check/lint/test changed files. Expected: no failures (scripts are plain `.mjs`; tests are the four new files).

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/dashboard/SKILL.md
git commit -m "feat(dashboard): /dashboard skill writes Claude summary and regenerates page"
```

---

## Self-review notes (done at planning time)

- Spec coverage: generator (T4-5), config customization incl. customCards/overrides/domains (T3-4), routines with 4 detect types + manual stamping (T3-4), audit/fixes panel (T2, T5), capability map (T1, T5), summary hybrid layer (T5-6), error handling (lenient helpers in collect.mjs, `--done` validation), tests (T1-3, T5), gitignored output + versioned config/state (T4). No repo-health panel — per spec non-goal.
- FIXES.md has no checkboxes (verified) — spec's "checked vs unchecked" implemented as the ✅/dot-emoji heuristic documented in Known input formats.
- Type consistency: `Card = {id,name,description,invoke,domain?}` used consistently; `DashboardData` shape defined in T4 and consumed verbatim by T5 tests.
```
