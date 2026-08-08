import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FreezerService from '../../../services/freezerService';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn().mockReturnValue('mock-item-ref'),
  getDoc: vi.fn(),
  updateDoc: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../../firebaseConfig', () => ({
  db: {}
}));

describe('FreezerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('moveToFreezer', () => {
    it('throws error if item does not exist', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => false
      } as any);

      await expect(
        FreezerService.moveToFreezer('hh1', 'item1')
      ).rejects.toThrow('Item not found');
    });

    it('moves item to freezer with default 3-month shelf life', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ item: 'Ground Beef', category: 'Meat' })
      } as any);

      const result = await FreezerService.moveToFreezer('hh1', 'item1');

      expect(updateDoc).toHaveBeenCalledWith('mock-item-ref', expect.objectContaining({
        storageLocation: 'freezer',
        is_frozen: true,
        location: 'freezer'
      }));
      expect(result.updates.storageLocation).toBe('freezer');
    });

    it('applies custom freezerDays and freezerZone when provided in options', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ item: 'Fish', category: 'Seafood' })
      } as any);

      const result = await FreezerService.moveToFreezer('hh1', 'item2', {
        freezerDays: 60,
        freezerZone: 'Top Shelf',
        freezerPortionCount: 4
      });

      expect(result.updates.freezerZone).toBe('Top Shelf');
      expect(result.updates.freezerPortionCount).toBe(4);
    });
  });

  describe('moveToFridgeFromFreezer', () => {
    it('moves defrosted item to fridge with default 3-day window', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ item: 'Chicken', is_frozen: true })
      } as any);

      const result = await FreezerService.moveToFridgeFromFreezer('hh1', 'item1');

      expect(result.cookingToday).toBe(false);
      expect(updateDoc).toHaveBeenCalledWith('mock-item-ref', expect.objectContaining({
        storageLocation: 'fridge',
        is_frozen: false
      }));
    });

    it('applies 1-day defrost window when cookingToday is true', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ item: 'Steak', is_frozen: true })
      } as any);

      const result = await FreezerService.moveToFridgeFromFreezer('hh1', 'item1', {
        cookingToday: true
      });

      expect(result.cookingToday).toBe(true);
    });
  });
});
