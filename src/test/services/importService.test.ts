import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock InventoryCacheService
vi.mock('../../../services/inventoryCacheService', () => ({
  InventoryCacheService: {
    addItemsToCache: vi.fn(() => Promise.resolve()),
    removeItemFromCache: vi.fn(() => Promise.resolve())
  }
}));

import { parseCsvToPantryItems, persistImportedPantryItems } from '../../../services/importService';
import { InventoryCacheService } from '../../../services/inventoryCacheService';

describe('ImportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses CSV into pantry items', () => {
    const csv = `name,amount,storageLocation,expirationDate,category
Apple,2,fridge,2026-03-01,Fruit
Milk,1,fridge,2026-02-27,Dairy
`;

    const items = parseCsvToPantryItems(csv);
    expect(items.length).toBe(2);
    expect(items[0].item).toBe('Apple');
    expect(items[0].storageLocation).toBe('fridge');
    expect(items[1].category).toBe('Dairy');
  });

  it('calls InventoryCacheService.addItemsToCache when persisting imported items', async () => {
    const items = [
      { id: 'imp-1', item: 'Test Item', category: 'Test', quantity_estimate: '1', storageLocation: 'pantry', dateAdded: new Date().toISOString(), image: '' }
    ];

    await persistImportedPantryItems(items, 'house-1', 'user-1');

    expect(InventoryCacheService.addItemsToCache).toHaveBeenCalledTimes(1);
    expect((InventoryCacheService.addItemsToCache as unknown as vi.Mock).mock.calls[0][0]).toBe(items);
    expect((InventoryCacheService.addItemsToCache as unknown as vi.Mock).mock.calls[0][1]).toBe('house-1');
    expect((InventoryCacheService.addItemsToCache as unknown as vi.Mock).mock.calls[0][2]).toBe('user-1');
  });
});
