import { describe, it, expect } from 'vitest';
import { computeBestBeforeISO } from '../utils/leftoverUtils';

describe('LeftoverService basic', () => {
  it('computeBestBeforeISO accepts ISO string input', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z').toISOString();
    const res = computeBestBeforeISO(createdAt, { cooked_rice: true });
    expect(typeof res).toBe('string');
  });
});
