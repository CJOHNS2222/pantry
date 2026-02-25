import { describe, it, expect } from 'vitest';
import { Batch } from '../types';

describe('batch totals', () => {
  it('sums batch quantities correctly', () => {
    const batches: Batch[] = [
      { batchId: 'a', quantity: 1, unit: 'gal', expires: '2026-02-20' },
      { batchId: 'b', quantity: 1, unit: 'gal', expires: '2026-03-03' }
    ];

    const total = batches.reduce((s, b) => s + (b.quantity || 0), 0);
    expect(total).toBe(2);
  });
});
