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

export function parseAuditFile(filename, text, mtimeIso) {
  const { data, body } = parseFrontmatter(text || '');
  const severityCounts = {};
  const lines = body.split(/\r?\n/);
  let currentSeverity = null;
  let currentContent = [];
  for (const line of lines) {
    const severityMatch = /^### (Critical|High|Medium|Low)\b/.exec(line);
    if (severityMatch) {
      if (currentSeverity) {
        const items = currentContent.join('\n').match(/^\s*\d+\.\s/gm) || [];
        severityCounts[currentSeverity] = (severityCounts[currentSeverity] || 0) + items.length;
      }
      currentSeverity = severityMatch[1];
      currentContent = [];
    } else if (currentSeverity && line.match(/^##/)) {
      if (currentContent.length) {
        const items = currentContent.join('\n').match(/^\s*\d+\.\s/gm) || [];
        severityCounts[currentSeverity] = (severityCounts[currentSeverity] || 0) + items.length;
      }
      currentSeverity = null;
      currentContent = [];
    } else if (currentSeverity) {
      currentContent.push(line);
    }
  }
  if (currentSeverity && currentContent.length) {
    const items = currentContent.join('\n').match(/^\s*\d+\.\s/gm) || [];
    severityCounts[currentSeverity] = (severityCounts[currentSeverity] || 0) + items.length;
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
