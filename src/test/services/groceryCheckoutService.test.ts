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
      expect(getWalmartItemId('eggs')).toBe('145051970');
      expect(hasWalmartMatch({ item: 'eggs' } as ShoppingItem)).toBe(true);
    });

    it('should fuzzy match item names', () => {
      expect(getWalmartItemId('organic whole milk')).toBe('10450115');
      expect(getWalmartItemId('yellow onions')).toBe('51259212');
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
      expect(url).toBe('https://www.walmart.com/sc/cart/addToCart?items=10450115_1,145051970_1');
    });

    it('should support numeric amount quantities', () => {
      const items: ShoppingItem[] = [
        { id: '1', item: 'milk', checked: false, amount: 2 } as ShoppingItem
      ];

      const url = generateWalmartCartUrl(items);
      expect(url).toBe('https://www.walmart.com/sc/cart/addToCart?items=10450115_2');
    });

    it('should return null if no items are matched', () => {
      const items: ShoppingItem[] = [
        { id: '1', item: 'dragon fruit', checked: false } as ShoppingItem
      ];

      expect(generateWalmartCartUrl(items)).toBeNull();
    });

    it('should consolidate items mapping to the same Product ID and sum their quantities', () => {
      const items: ShoppingItem[] = [
        { id: '1', item: 'milk', checked: false, amount: 2 } as ShoppingItem,
        { id: '2', item: 'organic whole milk', checked: false, amount: 1 } as ShoppingItem
      ];
      // Milk ID is 10450115, total should be 2 + 1 = 3
      expect(generateWalmartCartUrl(items)).toBe('https://www.walmart.com/sc/cart/addToCart?items=10450115_3');
    });

    it('should consolidate raw eggs to a dozen pack by default', () => {
      const items: ShoppingItem[] = [
        { id: '1', item: 'eggs', checked: false } as ShoppingItem
      ];
      // Default eggs ID is 145051970, quantity should default to 1 pack (1 dozen)
      expect(generateWalmartCartUrl(items)).toBe('https://www.walmart.com/sc/cart/addToCart?items=145051970_1');
    });

    it('should sum individual egg counts from different recipes and round up to the nearest dozen', () => {
      const items: ShoppingItem[] = [
        { id: '1', item: 'eggs', checked: false, amount: 2 } as ShoppingItem, // Recipe 1: 2 eggs
        { id: '2', item: 'large white eggs', checked: false, amount: 3 } as ShoppingItem // Recipe 2: 3 eggs
      ];
      // Total individual eggs = 5. Ceil to dozen pack = 1 pack
      expect(generateWalmartCartUrl(items)).toBe('https://www.walmart.com/sc/cart/addToCart?items=145051970_1');
    });

    it('should scale egg dozen packs correctly when total count exceeds 12', () => {
      const items: ShoppingItem[] = [
        { id: '1', item: 'eggs', checked: false, amount: 8 } as ShoppingItem,
        { id: '2', item: 'large white eggs', checked: false, amount: 6 } as ShoppingItem
      ];
      // Total individual eggs = 14. Ceil to dozen pack = 2 packs (24 eggs)
      expect(generateWalmartCartUrl(items)).toBe('https://www.walmart.com/sc/cart/addToCart?items=145051970_2');
    });

    it('should support explicit dozens unit in egg count calculation', () => {
      const items: ShoppingItem[] = [
        { id: '1', item: 'eggs', checked: false, amount: 2, unit: 'dozen' } as ShoppingItem
      ];
      // 2 dozen = 24 eggs. Cart qty should be 2
      expect(generateWalmartCartUrl(items)).toBe('https://www.walmart.com/sc/cart/addToCart?items=145051970_2');
    });

    it('should default weight/volume/container quantities to a single pack when there is no known package size', () => {
      // "200g shrimp" should not add 200 units of shrimp to the cart — shrimp has no
      // package-size data, so this falls back to a single default pack.
      const shrimpItems: ShoppingItem[] = [
        { id: '1', item: 'shrimp', checked: false, amount: 200, unit: 'g' } as ShoppingItem
      ];
      expect(generateWalmartCartUrl(shrimpItems)).toBe('https://www.walmart.com/sc/cart/addToCart?items=791288879_1');
    });

    it('should fall back to a single pack when the needed unit and package unit are different kinds (volume vs weight)', () => {
      // Flour's known package size is in lbs (weight). "2 cups" is a volume — we don't
      // convert between the two (no density data), so this safely defaults to 1 pack
      // rather than guessing.
      const flourItems: ShoppingItem[] = [
        { id: '1', item: 'flour', checked: false, amount: 2, unit: 'cups' } as ShoppingItem
      ];
      expect(generateWalmartCartUrl(flourItems)).toBe('https://www.walmart.com/sc/cart/addToCart?items=178921158_1');
    });

    it('should compute an accurate pack count for items with known package sizes', () => {
      // Flour's smallest known package is a 1 lb bag. "3 lb flour" needs 3 packs.
      const items: ShoppingItem[] = [
        { id: '1', item: 'flour', checked: false, amount: 3, unit: 'lbs' } as ShoppingItem
      ];
      expect(generateWalmartCartUrl(items)).toBe('https://www.walmart.com/sc/cart/addToCart?items=178921158_3');
    });

    it('should sum weight/volume quantities across line items before rounding up to packs', () => {
      // Flour's smallest known package is 1 lb. Three separate 0.3 lb needs (0.9 lb
      // total) should round up to just 1 pack — not 3, which is what naive per-line
      // rounding (ceil(0.3/1) = 1, repeated 3 times) would incorrectly produce.
      const items: ShoppingItem[] = [
        { id: '1', item: 'flour', checked: false, amount: 0.3, unit: 'lbs' } as ShoppingItem,
        { id: '2', item: 'flour', checked: false, amount: 0.3, unit: 'lbs' } as ShoppingItem,
        { id: '3', item: 'flour', checked: false, amount: 0.3, unit: 'lbs' } as ShoppingItem
      ];
      expect(generateWalmartCartUrl(items)).toBe('https://www.walmart.com/sc/cart/addToCart?items=178921158_1');
    });

    it('should not multiply pack count when a matching-kind and mismatched-kind quantity both reference the same product', () => {
      const items: ShoppingItem[] = [
        { id: '1', item: 'flour', checked: false, amount: 2, unit: 'cups' } as ShoppingItem, // volume — mismatched kind, ignored
        { id: '2', item: 'flour', checked: false, amount: 400, unit: 'g' } as ShoppingItem // weight — matches package kind, used
      ];
      // 400g needs ceil(400 / 453.59) = 1 pack; the cups quantity can't be combined in.
      expect(generateWalmartCartUrl(items)).toBe('https://www.walmart.com/sc/cart/addToCart?items=178921158_1');
    });

    it('should still use the literal count when a genuine per-item count unit is given', () => {
      const items: ShoppingItem[] = [
        { id: '1', item: 'onion', checked: false, amount: 3, unit: 'pcs' } as ShoppingItem
      ];
      expect(generateWalmartCartUrl(items)).toBe('https://www.walmart.com/sc/cart/addToCart?items=51259212_3');
    });

    it('should prefer a literal count over a non-count reference to the same product', () => {
      const items: ShoppingItem[] = [
        { id: '1', item: 'onion', checked: false, amount: 3, unit: 'pcs' } as ShoppingItem,
        { id: '2', item: 'onion', checked: false, amount: 1, unit: 'bag' } as ShoppingItem
      ];
      // The literal count (3 onions) wins; the bag reference doesn't add a spurious extra pack.
      expect(generateWalmartCartUrl(items)).toBe('https://www.walmart.com/sc/cart/addToCart?items=51259212_3');
    });
  });

  describe('generateSearchUrl', () => {
    it('should generate Walmart search URL prepended with Great Value for staples', () => {
      expect(generateSearchUrl('eggs', 'walmart'))
        .toBe('https://www.walmart.com/search?q=Great%20Value%20eggs');
    });

    it('should generate Target search URL prepended with Good & Gather for staples', () => {
      expect(generateSearchUrl('sugar', 'target'))
        .toBe('https://www.target.com/s?searchTerm=Good%20%26%20Gather%20sugar');
    });

    it('should generate Kroger search URL prepended with Kroger for staples', () => {
      expect(generateSearchUrl('milk', 'kroger'))
        .toBe('https://www.kroger.com/search?query=Kroger%20milk');
    });

    it('should generate Instacart search URL without prepended brand (unsupported merchant)', () => {
      expect(generateSearchUrl('eggs', 'instacart'))
        .toBe('https://www.instacart.com/store/partner/search/eggs');
    });

    it('should generate Albertsons/Safeway search URL prepended with Signature Select for staples', () => {
      expect(generateSearchUrl('butter', 'albertsons'))
        .toBe('https://www.albertsons.com/shop/search-results.html?q=Signature%20Select%20butter');
    });

    it('should generate Thrive Market search URL without prepending for non-staple ingredients', () => {
      expect(generateSearchUrl('truffle oil', 'thrive'))
        .toBe('https://thrivemarket.com/page/search?q=truffle%20oil');
    });

    it('should not prepend the brand if it is already present in the search query', () => {
      expect(generateSearchUrl('Good & Gather organic milk', 'target'))
        .toBe('https://www.target.com/s?searchTerm=Good%20%26%20Gather%20organic%20milk');
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

    it('should build Walmart tracking redirect link when credentials and campaign IDs exist', () => {
      import.meta.env.VITE_IMPACT_ACCOUNT_SID = 'test-sid';
      import.meta.env.VITE_IMPACT_AUTH_TOKEN = 'test-token';
      import.meta.env.VITE_WALMART_CAMPAIGN_ID = '11463';
      import.meta.env.VITE_WALMART_AD_ID = '1126749';

      const target = 'https://www.walmart.com/some-path';
      const result = wrapWithImpactTracker(target, 'walmart');

      expect(result).toContain('https://goto.walmart.com/m/3624855/1126749/11463');
      expect(result).toContain('u=https%3A%2F%2Fwww.walmart.com%2Fsome-path');
    });

    it('should build Target tracking redirect link when credentials and campaign IDs exist', () => {
      import.meta.env.VITE_IMPACT_ACCOUNT_SID = 'test-sid';
      import.meta.env.VITE_IMPACT_AUTH_TOKEN = 'test-token';
      import.meta.env.VITE_TARGET_CAMPAIGN_ID = '11466';
      import.meta.env.VITE_TARGET_AD_ID = '1126750';

      const target = 'https://www.target.com/s?searchTerm=eggs';
      const result = wrapWithImpactTracker(target, 'target');

      expect(result).toContain('https://target.sjv.io/m/3624855/1126750/11466');
    });

    it('should build Kroger tracking redirect link when credentials and campaign IDs exist', () => {
      import.meta.env.VITE_IMPACT_ACCOUNT_SID = 'test-sid';
      import.meta.env.VITE_IMPACT_AUTH_TOKEN = 'test-token';
      import.meta.env.VITE_KROGER_CAMPAIGN_ID = '11468';
      import.meta.env.VITE_KROGER_AD_ID = '1126751';

      const target = 'https://www.kroger.com/search?query=milk';
      const result = wrapWithImpactTracker(target, 'kroger');

      expect(result).toContain('https://kroger.sjv.io/m/3624855/1126751/11468');
    });

    it('should fallback to direct link when specific campaign IDs are missing', () => {
      import.meta.env.VITE_IMPACT_ACCOUNT_SID = 'test-sid';
      import.meta.env.VITE_IMPACT_AUTH_TOKEN = 'test-token';
      import.meta.env.VITE_WALMART_CAMPAIGN_ID = '';
      import.meta.env.VITE_WALMART_AD_ID = '';

      const target = 'https://www.walmart.com/some-path';
      const result = wrapWithImpactTracker(target, 'walmart');

      expect(result).toBe(target);
    });
  });
});
