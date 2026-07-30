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
