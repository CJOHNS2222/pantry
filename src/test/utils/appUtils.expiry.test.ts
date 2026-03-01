import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shouldShowExpiryAlert } from '../../../utils/appUtils';

describe('shouldShowExpiryAlert', () => {
  const base = new Date('2026-02-28T00:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(base.getTime());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false for immortal items', () => {
    const item: any = { id: '1', item: 'Salt', category: 'baking', is_immortal: true };
    expect(shouldShowExpiryAlert(item)).toBe(false);
  });

  it('returns true for milk within 3-day threshold', () => {
    const expiration = new Date(base.getTime());
    expiration.setDate(expiration.getDate() + 1);
    const item: any = { id: '2', item: 'Whole Milk', category: 'Dairy', expirationDate: expiration.toISOString().slice(0, 10) };
    expect(shouldShowExpiryAlert(item)).toBe(true);
  });

  it('returns false for milk outside threshold', () => {
    const expiration = new Date(base.getTime());
    expiration.setDate(expiration.getDate() + 6);
    const item: any = { id: '3', item: 'Milk', category: 'Dairy', expirationDate: expiration.toISOString().slice(0, 10) };
    expect(shouldShowExpiryAlert(item)).toBe(false);
  });

  it('returns true for non-milk within 7-day threshold', () => {
    const expiration = new Date(base.getTime());
    expiration.setDate(expiration.getDate() + 5);
    const item: any = { id: '4', item: 'Lettuce', category: 'Vegetable', expirationDate: expiration.toISOString().slice(0, 10) };
    expect(shouldShowExpiryAlert(item)).toBe(true);
  });
});
