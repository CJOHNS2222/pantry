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
  it('preserves a customCard\'s own pre-set domain, override still wins', () => {
    const customCards = [
      { id: 'custom:My Tool', name: 'My Tool', description: 'x', invoke: 'y', domain: 'Skills' },
    ];
    const out = applyOverrides(customCards, DEFAULT_CONFIG);
    expect(out.find(c => c.id === 'custom:My Tool')!.domain).toBe('Skills');

    const cfg = mergeConfig({ overrides: { 'custom:My Tool': { domain: 'Audit' } } });
    const out2 = applyOverrides(customCards, cfg);
    expect(out2.find(c => c.id === 'custom:My Tool')!.domain).toBe('Audit');
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
