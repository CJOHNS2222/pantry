import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShoppingItem } from '../../../types';
import {
  getWalmartItemId,
  hasWalmartMatch,
  generateWalmartCartUrl,
  generateWalmartSearchUrl,
  wrapWithImpactTracker
} from '../../../services/groceryCheckoutService';

describe('groceryCheckoutService', () => {
  describe('getWalmartItemId & hasWalmartMatch', () => {
    it('should match exact staple items', () => {
      expect(getWalmartItemId('eggs')).toBe('172844358');
      expect(hasWalmartMatch({ item: 'eggs' } as ShoppingItem)).toBe(true);
    });

    it('should fuzzy match item names', () => {
      expect(getWalmartItemId('organic whole milk')).toBe('660768274');
      expect(getWalmartItemId('yellow onions')).toBe('44390977');
    });

    it('should return null for unmatched items', () => {
      expect(getWalmartItemId('dragon fruit')).toBeNull();
      expect(hasWalmartMatch({ item: 'dragon fruit' } as ShoppingItem)).toBe(false);
    });

    it('should prioritize custom walmartItemId if present', () => {
      const item = { item: 'dragon fruit', walmartItemId: '999888777' } as ShoppingItem;
      expect(getWalmartItemId('dragon fruit', item)).toBe('999888777');
      expect(hasWalmartMatch(item)).toBe(true);
    });
  });

  describe('generateWalmartCartUrl', () => {
    it('should build a cart URL with matched items and default quantity 1', () => {
      const items: ShoppingItem[] = [
        { id: '1', item: 'eggs', checked: false } as ShoppingItem,
        { id: '2', item: 'milk', checked: false } as ShoppingItem,
        { id: '3', item: 'dragon fruit', checked: false } as ShoppingItem // unmatched
      ];

      const url = generateWalmartCartUrl(items);
      expect(url).toBe('https://www.walmart.com/sc/cart/addToCart?items=172844358_1,660768274_1');
    });

    it('should support numeric amount quantities', () => {
      const items: ShoppingItem[] = [
        { id: '1', item: 'milk', checked: false, amount: 2 } as ShoppingItem
      ];

      const url = generateWalmartCartUrl(items);
      expect(url).toBe('https://www.walmart.com/sc/cart/addToCart?items=660768274_2');
    });

    it('should return null if no items are matched', () => {
      const items: ShoppingItem[] = [
        { id: '1', item: 'dragon fruit', checked: false } as ShoppingItem
      ];

      expect(generateWalmartCartUrl(items)).toBeNull();
    });
  });

  describe('generateWalmartSearchUrl', () => {
    it('should generate URL-encoded search links', () => {
      const url = generateWalmartSearchUrl('organic chicken breast');
      expect(url).toBe('https://www.walmart.com/search?q=organic%20chicken%20breast');
    });
  });

  describe('wrapWithImpactTracker', () => {
    const originalEnv = { ...import.meta.env };

    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => {
      // Restore environmental state
      Object.assign(import.meta.env, originalEnv);
    });

    it('should return direct URL if environment variables are not set', () => {
      import.meta.env.VITE_IMPACT_ACCOUNT_SID = '';
      import.meta.env.VITE_IMPACT_AUTH_TOKEN = '';

      const target = 'https://www.walmart.com/some-path';
      expect(wrapWithImpactTracker(target)).toBe(target);
    });

    it('should build tracking redirect link when credentials exist', () => {
      import.meta.env.VITE_IMPACT_ACCOUNT_SID = 'test-sid';
      import.meta.env.VITE_IMPACT_AUTH_TOKEN = 'test-token';

      const target = 'https://www.walmart.com/some-path';
      const result = wrapWithImpactTracker(target);

      expect(result).toContain('https://goto.walmart.com/m/3624855/1126749/11463');
      expect(result).toContain('u=https%3A%2F%2Fwww.walmart.com%2Fsome-path');
    });
  });
});
