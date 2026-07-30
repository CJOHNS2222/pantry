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
