import { describe, it, expect } from 'vitest';
import { PRODUCT_IDS, PRODUCT_TIER_MAP } from '../../../services/purchaseService';
import sourceMap from '../../../constants/productTierMap.json';

// Guards F63: services/purchaseService.ts and functions/src/googlePlayHelpers.ts
// both import their PRODUCT_TIER_MAP from constants/productTierMap.json (generated
// by scripts/generate-product-tier-map.cjs). This fails if the generated file is
// stale relative to the JSON source of truth, or if a product ID is added to one
// side without regenerating.
describe('PRODUCT_TIER_MAP', () => {
  it('matches the JSON source of truth exactly', () => {
    expect(PRODUCT_TIER_MAP).toEqual(sourceMap);
  });

  it('has an entry for every known product ID', () => {
    for (const id of Object.values(PRODUCT_IDS)) {
      expect(PRODUCT_TIER_MAP[id]).toBeDefined();
    }
  });
});
