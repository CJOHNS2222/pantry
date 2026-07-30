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
