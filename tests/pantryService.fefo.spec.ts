import { describe, it, expect } from 'vitest';
import { PantryService } from '../services/pantryService';
import { PantryItem } from '../types';

function makeItemWithBatches(): PantryItem {
  return {
    id: 'item-1',
    item: 'Milk',
    category: 'dairy',
    quantity_estimate: '10',
    image: '/images/milk.svg',
    storageLocation: 'fridge',
    dateAdded: new Date().toISOString(),
    lastRestocked: new Date().toISOString(),
    batches: [
      { batchId: 'b1', quantity: 2, unit: 'count', expires: '2026-03-01', purchaseDate: '2026-02-01', note: '' },
      { batchId: 'b2', quantity: 3, unit: 'count', expires: '2026-02-25', purchaseDate: '2026-02-05', note: '' },
      { batchId: 'b3', quantity: 5, unit: 'count', expires: undefined, purchaseDate: '2026-02-10', note: '' }
    ]
  } as unknown as PantryItem;
}

describe('PantryService.consumeFromItem (FEFO)', () => {
  it('consumes from earliest-expiring batches first and updates quantities', () => {
    const item = makeItemWithBatches();
    const { updatedItem, consumed } = PantryService.consumeFromItem(item, 4, 'FEFO');

    // Expect consumed: take 3 from b2 (2026-02-25) then 1 from b1 (2026-03-01)
    expect(consumed).toHaveLength(2);
    expect(consumed).toEqual([
      { batchId: 'b2', amount: 3 },
      { batchId: 'b1', amount: 1 }
    ]);

    // Updated batches: b2 removed, b1 reduced to 1, b3 untouched
    const batchIds = (updatedItem.batches || []).map(b => ({ id: b.batchId, q: b.quantity }));
    expect(batchIds).toContainEqual({ id: 'b1', q: 1 });
    expect(batchIds).toContainEqual({ id: 'b3', q: 5 });
    expect(batchIds.find(b => b.id === 'b2')).toBeUndefined();
  });

  it('manual strategy consumes only from target batch', () => {
    const item = makeItemWithBatches();
    const { updatedItem, consumed } = PantryService.consumeFromItem(item, 2, 'MANUAL', 'b1');

    expect(consumed).toHaveLength(1);
    expect(consumed[0]).toEqual({ batchId: 'b1', amount: 2 });

    const b1 = (updatedItem.batches || []).find(b => b.batchId === 'b1');
    expect(b1).toBeUndefined(); // b1 had 2 and should be fully consumed
  });
});
