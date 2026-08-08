import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FoodWasteAnalyticsService from '../../../services/foodWasteAnalyticsService';
import DatabaseMonitoringService from '../../../services/databaseMonitoringService';

vi.mock('../../../services/databaseMonitoringService', () => ({
  default: {
    doc: vi.fn().mockReturnValue('mock-doc-ref'),
    getDoc: vi.fn(),
    updateDoc: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('FoodWasteAnalyticsService', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    store = {};
    vi.mocked(localStorage.getItem).mockImplementation((key) => store[key] ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key, val) => {
      store[key] = String(val);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('recordDisposal', () => {
    it('updates Firestore inventory cache document via atomic increments', async () => {
      await FoodWasteAnalyticsService.recordDisposal(
        {
          itemId: 'item1',
          itemName: 'Milk',
          disposalReason: 'thrown_away',
          daysExpired: 2,
          userId: 'user123',
          estimatedValue: 4.5
        },
        'household123'
      );

      expect(DatabaseMonitoringService.updateDoc).toHaveBeenCalled();
    });

    it('records guest user disposals in localStorage', async () => {
      await FoodWasteAnalyticsService.recordDisposal({
        itemId: 'item2',
        itemName: 'Bread',
        disposalReason: 'cooked',
        daysExpired: 0,
        userId: 'guest',
        estimatedValue: 3.0
      });

      expect(DatabaseMonitoringService.updateDoc).not.toHaveBeenCalled();
      expect(store['guest_food_waste_summary']).toBeDefined();
    });
  });

  describe('recordBulkDisposals', () => {
    it('returns early when disposals array is empty', async () => {
      await FoodWasteAnalyticsService.recordBulkDisposals([]);
      expect(DatabaseMonitoringService.updateDoc).not.toHaveBeenCalled();
    });

    it('records multiple disposals in a single batch write', async () => {
      await FoodWasteAnalyticsService.recordBulkDisposals(
        [
          { itemId: '1', itemName: 'Apple', disposalReason: 'thrown_away', daysExpired: 1, userId: 'user1', estimatedValue: 1.0 },
          { itemId: '2', itemName: 'Chicken', disposalReason: 'cooked', daysExpired: 0, userId: 'user1', estimatedValue: 8.0 }
        ],
        'hh1'
      );

      expect(DatabaseMonitoringService.updateDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAnalyticsFromData & getAnalytics', () => {
    it('parses raw food waste data into FoodWasteAnalytics structure', () => {
      const rawData = {
        _foodWaste: {
          totalItemsDisposed: 10,
          totalDaysExpired: 20,
          totalEstimatedValue: 50.0,
          totalCookedValue: 30.0,
          itemsByReason: { thrown_away: 4, cooked: 5, remove: 1 }
        }
      };

      const result = FoodWasteAnalyticsService.getAnalyticsFromData(rawData);
      expect(result).toBeDefined();
      expect(result?.totalItemsDisposed).toBe(10);
      expect(result?.averageDaysExpired).toBe(2);
      expect(result?.itemsByReason.cooked).toBe(5);
    });

    it('returns null when no food waste data exists', () => {
      expect(FoodWasteAnalyticsService.getAnalyticsFromData({})).toBeNull();
    });

    it('returns guest analytics from localStorage when userId is guest', async () => {
      store['guest_food_waste_summary'] = JSON.stringify({
        totalItemsDisposed: 2,
        totalEstimatedValue: 5,
        totalCookedValue: 2,
        totalDaysExpired: 4,
        itemsByReason: { thrown_away: 1, cooked: 1, remove: 0 }
      });

      const analytics = await FoodWasteAnalyticsService.getAnalytics(undefined, 'guest');
      expect(analytics?.totalItemsDisposed).toBe(2);
      expect(analytics?.averageDaysExpired).toBe(2);
    });
  });
});
