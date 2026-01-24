import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GroceryPriceService from '../../services/groceryPriceService';
import { GroceryPrice, PriceData } from '../../services/groceryPriceService';

// Mock Firebase services
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  addDoc: vi.fn(),
}));

vi.mock('../firebaseConfig', () => ({
  db: {},
}));

vi.mock('./databaseMonitoringService', () => ({
  default: {
    trackOperation: vi.fn(),
  },
}));

// Mock fetch for Open Prices API
global.fetch = vi.fn();

describe('GroceryPriceService', () => {
  let service: GroceryPriceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GroceryPriceService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getIngredientPrice', () => {
    it('returns cached price data when available', async () => {
      const mockPriceData: PriceData = {
        averagePrice: 2.99,
        minPrice: 2.49,
        maxPrice: 3.49,
        sampleSize: 10,
        lastUpdated: new Date(),
        unit: 'lb',
      };

      // Mock Firestore to return existing price data
      const { getDocs } = await import('firebase/firestore');
      (getDocs as any).mockResolvedValueOnce({
        docs: [
          {
            data: () => ({
              ingredient: 'chicken breast',
              price: 2.99,
              unit: 'lb',
              lastUpdated: new Date(),
              source: 'crowdsourced',
            }),
          },
          {
            data: () => ({
              ingredient: 'chicken breast',
              price: 3.49,
              unit: 'lb',
              lastUpdated: new Date(),
              source: 'api',
            }),
          },
        ],
      });

      const result = await service.getIngredientPrice('chicken breast');

      expect(result).toBeTruthy();
      expect(result?.averagePrice).toBeGreaterThan(0);
      expect(result?.sampleSize).toBeGreaterThan(0);
    });

    it('fetches from Open Prices API when no cached data', async () => {
      // Mock empty Firestore results
      const { getDocs } = await import('firebase/firestore');
      (getDocs as any).mockResolvedValueOnce({
        docs: [],
      });

      // Mock Open Prices API response
      (global.fetch as any).mockResolvedValueOnce({
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
          ],
        }),
      });

      const result = await service.getIngredientPrice('chicken breast');

      expect(global.fetch).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });

    it('handles API errors gracefully', async () => {
      const { getDocs } = await import('firebase/firestore');
      (getDocs as any).mockResolvedValueOnce({
        docs: [],
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await service.getIngredientPrice('chicken breast');

      expect(result).toBeNull();
    });

    it('handles network errors', async () => {
      const { getDocs } = await import('firebase/firestore');
      (getDocs as any).mockResolvedValueOnce({
        docs: [],
      });

      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

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

      const { getDocs } = await import('firebase/firestore');
      (getDocs as any).mockResolvedValueOnce({
        docs: mockPrices.map(price => ({
          id: price.id,
          data: () => price,
        })),
      });

      const result = await service.getPriceTrends('chicken breast', 30);

      expect(result).toHaveLength(1);
      expect(result[0].price).toBe(2.99);
    });

    it('returns empty array when no trends found', async () => {
      const { getDocs } = await import('firebase/firestore');
      (getDocs as any).mockResolvedValueOnce({
        docs: [],
      });

      const result = await service.getPriceTrends('unknown ingredient', 30);

      expect(result).toEqual([]);
    });

    it('handles query errors', async () => {
      const { getDocs } = await import('firebase/firestore');
      (getDocs as any).mockRejectedValueOnce(new Error('Query failed'));

      await expect(service.getPriceTrends('chicken breast', 30)).rejects.toThrow('Query failed');
    });
  });

  describe('saveGroceryPrice', () => {
    it('saves price data successfully', async () => {
      const priceData: Omit<GroceryPrice, 'id'> = {
        ingredient: 'chicken breast',
        price: 3.99,
        unit: 'lb',
        store: 'Test Store',
        currency: 'USD',
        lastUpdated: new Date(),
        source: 'user',
        userId: 'user123',
      };

      const { addDoc } = await import('firebase/firestore');
      (addDoc as any).mockResolvedValueOnce({ id: 'price123' });

      const result = await service.saveGroceryPrice(priceData);

      expect(addDoc).toHaveBeenCalled();
      expect(result).toBe('price123');
    });

    it('handles save errors', async () => {
      const priceData: Omit<GroceryPrice, 'id'> = {
        ingredient: 'chicken breast',
        price: 2.99,
        unit: 'lb',
        currency: 'USD',
        lastUpdated: new Date(),
        source: 'user',
      };

      const { addDoc } = await import('firebase/firestore');
      (addDoc as any).mockRejectedValueOnce(new Error('Save failed'));

      await expect(service.saveGroceryPrice(priceData)).rejects.toThrow('Save failed');
    });
  });

  describe('getPriceTrendsFromAPI', () => {
    it('fetches trends from Open Prices API', async () => {
      const mockApiResponse = {
        items: [
          {
            product_id: 'chicken',
            price: 2.99,
            currency: 'USD',
            store: 'Store A',
            date: '2024-01-01',
          },
          {
            product_id: 'chicken',
            price: 3.49,
            currency: 'USD',
            store: 'Store B',
            date: '2024-01-15',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      });

      const result = await service.getPriceTrendsFromAPI('chicken breast', 30);

      expect(global.fetch).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('handles API errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await service.getPriceTrendsFromAPI('unknown ingredient', 30);

      expect(result).toEqual([]);
    });

    it('handles network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

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

      expect(result.averagePrice).toBe(0);
      expect(result.minPrice).toBe(0);
      expect(result.maxPrice).toBe(0);
      expect(result.sampleSize).toBe(0);
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