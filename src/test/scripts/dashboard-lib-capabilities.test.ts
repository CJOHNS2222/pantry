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
