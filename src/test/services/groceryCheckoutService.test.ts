import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShoppingItem } from '../../../types';
import {
  getWalmartItemId,
  hasWalmartMatch,
  generateWalmartCartUrl,
  generateSearchUrl,
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

  describe('generateSearchUrl', () => {
    it('should generate Walmart search URL', () => {
      expect(generateSearchUrl('organic chicken breast', 'walmart'))
        .toBe('https://www.walmart.com/search?q=organic%20chicken%20breast');
    });

    it('should generate Target search URL', () => {
      expect(generateSearchUrl('organic chicken breast', 'target'))
        .toBe('https://www.target.com/s?searchTerm=organic%20chicken%20breast');
    });

    it('should generate Kroger search URL', () => {
      expect(generateSearchUrl('milk', 'kroger'))
        .toBe('https://www.kroger.com/search?query=milk');
    });

    it('should generate Instacart search URL', () => {
      expect(generateSearchUrl('eggs', 'instacart'))
        .toBe('https://www.instacart.com/store/partner/search/eggs');
    });

    it('should generate Albertsons/Safeway search URL', () => {
      expect(generateSearchUrl('butter', 'albertsons'))
        .toBe('https://www.albertsons.com/shop/search-results.html?q=butter');
    });

    it('should generate Thrive Market search URL', () => {
      expect(generateSearchUrl('coconut oil', 'thrive'))
        .toBe('https://thrivemarket.com/page/search?q=coconut%20oil');
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
      expect(wrapWithImpactTracker(target, 'walmart')).toBe(target);
    });

    it('should build Walmart tracking redirect link when credentials exist', () => {
      import.meta.env.VITE_IMPACT_ACCOUNT_SID = 'test-sid';
      import.meta.env.VITE_IMPACT_AUTH_TOKEN = 'test-token';

      const target = 'https://www.walmart.com/some-path';
      const result = wrapWithImpactTracker(target, 'walmart');

      expect(result).toContain('https://goto.walmart.com/m/3624855/1126749/11463');
      expect(result).toContain('u=https%3A%2F%2Fwww.walmart.com%2Fsome-path');
    });

    it('should build Target tracking redirect link when credentials exist', () => {
      import.meta.env.VITE_IMPACT_ACCOUNT_SID = 'test-sid';
      import.meta.env.VITE_IMPACT_AUTH_TOKEN = 'test-token';

      const target = 'https://www.target.com/s?searchTerm=eggs';
      const result = wrapWithImpactTracker(target, 'target');

      expect(result).toContain('https://target.sjv.io/m/3624855');
    });

    it('should build Kroger tracking redirect link when credentials exist', () => {
      import.meta.env.VITE_IMPACT_ACCOUNT_SID = 'test-sid';
      import.meta.env.VITE_IMPACT_AUTH_TOKEN = 'test-token';

      const target = 'https://www.kroger.com/search?query=milk';
      const result = wrapWithImpactTracker(target, 'kroger');

      expect(result).toContain('https://kroger.sjv.io/m/3624855');
    });
  });
});
