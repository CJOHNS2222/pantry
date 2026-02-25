import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock DatabaseMonitoringService
vi.mock('../../../services/databaseMonitoringService', () => ({
  default: {
    trackOperation: vi.fn(),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    addDoc: vi.fn(),
    deleteDoc: vi.fn()
  }
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { groceryPriceService } from '../../../services/groceryPriceService';
import DatabaseMonitoringService from '../../../services/databaseMonitoringService';

const DatabaseMonitoringServiceMock = DatabaseMonitoringService as any;

describe('GroceryPriceService', () => {
  let service: typeof groceryPriceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = groceryPriceService as any;

    // Set up default mock behaviors for dependencies
    DatabaseMonitoringServiceMock.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ averagePrice: 2.99, minPrice: 2.49, maxPrice: 3.49, sampleSize: 10, lastUpdated: new Date(), unit: 'lb' }),
      id: 'test-doc-id'
    });

    DatabaseMonitoringServiceMock.getDocs.mockResolvedValue({
      size: 0,
      docs: [],
      forEach: vi.fn((callback) => {
        // Default empty implementation
      }),
      empty: true
    });

    DatabaseMonitoringServiceMock.setDoc.mockResolvedValue(undefined);
    DatabaseMonitoringServiceMock.updateDoc.mockResolvedValue(undefined);
    DatabaseMonitoringServiceMock.addDoc.mockResolvedValue({ id: 'price123' });
    DatabaseMonitoringServiceMock.deleteDoc.mockResolvedValue(undefined);

    // Mock fetch for API calls
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        items: [
          {
            product_id: 'chicken',
            price: 2.99,
            currency: 'USD',
            store: 'Test Store',
            date: '2024-01-01',
          },
          {
            product_id: 'chicken',
            price: 3.49,
            currency: 'USD',
            store: 'Test Store 2',
            date: '2024-01-02',
          },
        ],
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getIngredientPrice', () => {
    it('returns cached price data when available', async () => {
      // Mock DatabaseMonitoringService.getDocs to return cached price data
      const mockPrices = [
        { id: 'price1', data: () => ({ price: 2.99, ingredient: 'chicken breast', lastUpdated: new Date() }) },
        { id: 'price2', data: () => ({ price: 2.49, ingredient: 'chicken breast', lastUpdated: new Date() }) },
        { id: 'price3', data: () => ({ price: 3.49, ingredient: 'chicken breast', lastUpdated: new Date() }) },
      ];

      const mockQuerySnapshot = {
        docs: mockPrices,
        forEach: vi.fn((callback) => {
          mockPrices.forEach(callback);
        }),
        size: mockPrices.length,
        empty: false
      };

      vi.mocked(DatabaseMonitoringService.getDocs).mockResolvedValueOnce(mockQuerySnapshot);

      const result = await service.getIngredientPrice('chicken breast');

      expect(result).toBeTruthy();
      expect(result?.averagePrice).toBe(2.99); // (2.99 + 2.49 + 3.49) / 3 = 2.99
      expect(result?.sampleSize).toBe(3);
    });

    it('fetches from Open Prices API when no cached data', async () => {
      // Mock empty DatabaseMonitoringService results
      const mockEmptyQuerySnapshot = {
        docs: [],
        forEach: vi.fn(),
        size: 0,
        empty: true
      };

      vi.mocked(DatabaseMonitoringService.getDocs).mockResolvedValueOnce(mockEmptyQuerySnapshot);

      // Mock the private fetchOpenPrices method
      const fetchOpenPricesSpy = vi.spyOn(service as any, 'fetchOpenPrices').mockResolvedValueOnce([
        {
          product_id: 'chicken',
          price: 2.99,
          currency: 'USD',
          store: 'Test Store',
          date: '2024-01-01',
        },
      ]);

      const result = await service.getIngredientPrice('chicken breast');

      expect(fetchOpenPricesSpy).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });

    it('handles API errors gracefully', async () => {
      const mockEmptyQuerySnapshot = {
        docs: [],
        forEach: vi.fn(),
        size: 0,
        empty: true
      };

      vi.mocked(DatabaseMonitoringService.getDocs).mockResolvedValueOnce(mockEmptyQuerySnapshot);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await service.getIngredientPrice('chicken breast');

      expect(result).toBeNull();
    });

    it('handles network errors', async () => {
      const mockEmptyQuerySnapshot = {
        docs: [],
        forEach: vi.fn(),
        size: 0,
        empty: true
      };

      vi.mocked(DatabaseMonitoringService.getDocs).mockResolvedValueOnce(mockEmptyQuerySnapshot);

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.getIngredientPrice('chicken breast');

      expect(result).toBeNull();
    });
  });

  describe('getPriceTrends', () => {
    it('retrieves price trends from Firestore', async () => {
      const mockPrices: GroceryPrice[] = [
        {
          id: 'price1',
          ingredient: 'chicken breast',
          price: 2.99,
          unit: 'lb',
          store: 'Store A',
          currency: 'USD',
          lastUpdated: new Date(),
          source: 'crowdsourced',
        },
      ];

      const mockQuerySnapshot = {
        docs: mockPrices.map(price => ({
          id: price.id,
          data: () => price,
        })),
        forEach: vi.fn((callback) => {
          mockPrices.forEach(price => callback({
            id: price.id,
            data: () => price,
          }));
        }),
        size: mockPrices.length,
        empty: false
      };

      vi.mocked(DatabaseMonitoringService.getDocs).mockResolvedValueOnce(mockQuerySnapshot);

      // Mock API to return empty so we only get Firestore data
      const fetchOpenPricesHistorySpy = vi.spyOn(service as any, 'fetchOpenPricesHistory').mockResolvedValueOnce([]);

      const result = await service.getPriceTrends('chicken breast', 30);

      expect(result).toHaveLength(1);
      expect(result[0].price).toBe(2.99);
    });

    it('returns empty array when no trends found', async () => {
      const mockEmptyQuerySnapshot = {
        docs: [],
        forEach: vi.fn(),
        size: 0,
        empty: true
      };

      vi.mocked(DatabaseMonitoringService.getDocs).mockResolvedValueOnce(mockEmptyQuerySnapshot);

      const result = await service.getPriceTrends('unknown ingredient', 30);

      expect(result).toEqual([]);
    });

    it('handles query errors', async () => {
      vi.mocked(DatabaseMonitoringService.getDocs).mockRejectedValueOnce(new Error('Query failed'));

      // Mock API fallback to return empty
      const fetchOpenPricesHistorySpy = vi.spyOn(service as any, 'fetchOpenPricesHistory').mockResolvedValueOnce([]);

      const result = await service.getPriceTrends('chicken breast', 30);

      expect(result).toEqual([]);
    });
  });

  describe('saveGroceryPrice', () => {
    it('saves price data successfully', async () => {
      const priceData: GroceryPrice = {
        id: 'price123',
        ingredient: 'chicken breast',
        price: 3.99,
        unit: 'lb',
        store: 'Test Store',
        currency: 'USD',
        lastUpdated: new Date(),
        source: 'user',
        userId: 'user123',
      };

      await service.saveGroceryPrice(priceData);

      expect(DatabaseMonitoringService.setDoc).toHaveBeenCalled();
    });

    it('handles save errors', async () => {
      const priceData: GroceryPrice = {
        id: 'price123',
        ingredient: 'chicken breast',
        price: 2.99,
        unit: 'lb',
        currency: 'USD',
        lastUpdated: new Date(),
        source: 'user',
      };

      vi.mocked(DatabaseMonitoringService.setDoc).mockRejectedValueOnce(new Error('Save failed'));

      await expect(service.saveGroceryPrice(priceData)).rejects.toThrow('Save failed');
    });
  });

  describe('getPriceTrendsFromAPI', () => {
    it('fetches trends from Open Prices API', async () => {
      const mockApiResponse = [
        {
          id: '1',
          product_id: 'chicken',
          price: 2.99,
          currency: 'USD',
          store: 'Store A',
          date: '2024-01-01',
        },
        {
          id: '2',
          product_id: 'chicken',
          price: 3.49,
          currency: 'USD',
          store: 'Store B',
          date: '2024-01-15',
        },
      ];

      // Mock the private method
      const fetchOpenPricesHistorySpy = vi.spyOn(service as any, 'fetchOpenPricesHistory').mockResolvedValueOnce(mockApiResponse);

      const result = await service.getPriceTrendsFromAPI('chicken breast', 30);

      expect(fetchOpenPricesHistorySpy).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('handles API errors', async () => {
      // Mock the private method to throw an error
      const fetchOpenPricesHistorySpy = vi.spyOn(service as any, 'fetchOpenPricesHistory').mockRejectedValueOnce(new Error('API error'));

      const result = await service.getPriceTrendsFromAPI('unknown ingredient', 30);

      expect(result).toEqual([]);
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.getPriceTrendsFromAPI('chicken breast', 30);

      expect(result).toEqual([]);
    });
  });

  describe('calculatePriceStats', () => {
    it('calculates correct statistics from price array', () => {
      const prices = [2.99, 3.49, 2.79, 3.99, 2.89];

      const result = service.calculatePriceStats(prices);

      expect(result.averagePrice).toBeCloseTo(3.23, 2);
      expect(result.minPrice).toBe(2.79);
      expect(result.maxPrice).toBe(3.99);
      expect(result.sampleSize).toBe(5);
    });

    it('handles empty price array', () => {
      const result = service.calculatePriceStats([]);

      expect(result).toBeNull();
    });

    it('handles single price', () => {
      const result = service.calculatePriceStats([2.99]);

      expect(result.averagePrice).toBe(2.99);
      expect(result.minPrice).toBe(2.99);
      expect(result.maxPrice).toBe(2.99);
      expect(result.sampleSize).toBe(1);
    });
  });

  describe('normalizeIngredientName', () => {
    it('normalizes ingredient names correctly', () => {
      expect(service.normalizeIngredientName('Chicken Breast')).toBe('chicken breast');
      expect(service.normalizeIngredientName('FRESH TOMATOES')).toBe('fresh tomatoes');
      expect(service.normalizeIngredientName('organic spinach')).toBe('organic spinach');
    });

    it('handles empty strings', () => {
      expect(service.normalizeIngredientName('')).toBe('');
      expect(service.normalizeIngredientName('   ')).toBe('');
    });
  });
});
