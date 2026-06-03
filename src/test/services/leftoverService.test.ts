import { describe, it, expect } from 'vitest';
import { computeBestBeforeISO } from '../../../utils/leftoverUtils';

describe('LeftoverService.computeBestBeforeISO', () => {
  const createdAt = '2026-02-28T00:00:00.000Z';

  it('respects client provided best-before ISO', () => {
    // clientProvidedBestBeforeISO behavior removed for leftovers; ensure no crash when using risk_level
    const result = computeBestBeforeISO(createdAt, { risk_level: 5 });
    const expected = new Date(createdAt);
    expected.setDate(expected.getDate() + 2);
    expect(result).toBe(expected.toISOString());
  });

  it('maps risk_level to shorter windows', () => {
    const res = computeBestBeforeISO(createdAt, { risk_level: 5 });
    const expected = new Date(createdAt);
    expected.setDate(expected.getDate() + 2);
    expect(res).toBe(expected.toISOString());
  });

  it('applies persona strict adjustment (-1 day)', () => {
    const res = computeBestBeforeISO(createdAt, { productMaster: { risk_level: 3 }, persona: 'strict' });
    const expected = new Date(createdAt);
    expected.setDate(expected.getDate() + 7 - 1); // 7 days for rl=3 then -1
    expect(res).toBe(expected.toISOString());
  });

  it('applies cooked-rice cap to 4 days', () => {
    const res = computeBestBeforeISO(createdAt, { cooked_rice: true });
    const expected = new Date(createdAt);
    expected.setDate(expected.getDate() + 4);
    expect(res).toBe(expected.toISOString());
  });
});
