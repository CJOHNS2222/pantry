import { describe, it, expect } from 'vitest';
import LeftoverService from '../../../services/leftoverService';

describe('LeftoverService.computeBestBeforeISO', () => {
  const createdAt = '2026-02-28T00:00:00.000Z';

  it('respects client provided best-before ISO', () => {
    const provided = '2026-03-10T00:00:00.000Z';
    const result = LeftoverService.computeBestBeforeISO(createdAt, { clientProvidedBestBeforeISO: provided });
    expect(result).toBe(provided);
  });

  it('maps risk_level to shorter windows', () => {
    const res = LeftoverService.computeBestBeforeISO(createdAt, { risk_level: 5 });
    const expected = new Date(createdAt);
    expected.setDate(expected.getDate() + 2);
    expect(res).toBe(expected.toISOString());
  });

  it('applies persona strict adjustment (-1 day)', () => {
    const res = LeftoverService.computeBestBeforeISO(createdAt, { productMaster: { risk_level: 3 }, persona: 'strict' });
    const expected = new Date(createdAt);
    expected.setDate(expected.getDate() + 7 - 1); // 7 days for rl=3 then -1
    expect(res).toBe(expected.toISOString());
  });

  it('applies cooked-rice cap to 4 days', () => {
    const res = LeftoverService.computeBestBeforeISO(createdAt, { cooked_rice: true });
    const expected = new Date(createdAt);
    expected.setDate(expected.getDate() + 4);
    expect(res).toBe(expected.toISOString());
  });
});
