import DatabaseMonitoringService from './databaseMonitoringService';
import { PriceTrend } from '../types/app';
import { priceCacheService } from './priceCacheService';
import { log } from './logService';

export interface GroceryPrice {
  id: string;
  ingredient: string;
  price: number;
  unit: string;
  store?: string;
  location?: string;
  currency: string;
  lastUpdated: Date;
  source: 'user' | 'api' | 'crowdsourced';
  userId?: string;
  votes?: number;
}

export interface PriceData {
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  sampleSize: number;
  lastUpdated: Date;
  unit: string;
}

// Open Prices API interfaces
export interface OpenPricesProduct {
  id: string;
  product_name: string;
  brands?: string;
  categories?: string[];
  image_url?: string;
}

export interface OpenPricesPrice {
  id: string;
  product_id: string;
  price: number;
  currency: string;
  location?: string;
  store?: string;
  date: string;
  proof_url?: string;
}

export interface OpenPricesResponse {
  items: OpenPricesPrice[];
  page: number;
  pages: number;
  size: number;
  total: number;
}

class GroceryPriceService {
  private readonly COLLECTION_NAME = 'groceryPrices';
  private readonly PRICE_HISTORY_COLLECTION = 'priceHistory';

  // Default prices are lazy-loaded from groceryPriceDefaults.ts (H5) - the ~200-entry
  // dataset is only pulled into memory the first time a caller needs a default price,
  // not on every app load. All access goes through getDefaultPricesMap()/getDefaultPrice().
  private defaultPricesPromise: Promise<Record<string, { price: number; unit: string }>> | null = null;

  private async getDefaultPricesMap(): Promise<Record<string, { price: number; unit: string }>> {
    if (!this.defaultPricesPromise) {
      this.defaultPricesPromise = import('./groceryPriceDefaults').then(mod => mod.buildMergedDefaultPrices());
    }
    return this.defaultPricesPromise;
  }

  // Get current price data for an ingredient
  async getIngredientPrice(ingredient: string, location?: string): Promise<PriceData | null> {
    try {
      const ingredientKey = this.normalizeIngredientName(ingredient);

      // Firestore user-submitted-price lookup (Source 1) is disabled until there's a
      // customer base contributing prices - re-enable once that data exists.

      // Source 2: Try Open Prices API
      try {
        const openPrices = await this.fetchOpenPrices(ingredient, location);
        const openPriceData = this.convertOpenPricesToPriceData(openPrices);
        if (openPriceData) {
          log.debug(`Using Open Prices API data for ${ingredient}`, { openPriceData }, 'GroceryPriceService');
          if (process.env.NODE_ENV !== 'test') {
            priceCacheService.setPriceData(ingredientKey, openPriceData);
          }
          return openPriceData;
        }
      } catch (err: unknown) {
        log.warn('Open Prices API fallback failed:', { err }, 'GroceryPriceService');
      }

      // Check cache as a final attempt before returning defaults
      const cachedData = priceCacheService.getPriceData(ingredientKey);
      if (cachedData) {
        return cachedData;
      }

      // Source 3: Use curated default prices as final fallback
      const defaultPricesMap = await this.getDefaultPricesMap();
      const defaultPrice = defaultPricesMap[ingredientKey];
      if (defaultPrice) {
        const priceData = {
          averagePrice: defaultPrice.price,
          minPrice: defaultPrice.price,
          maxPrice: defaultPrice.price,
          sampleSize: 1,
          lastUpdated: new Date(),
          unit: defaultPrice.unit
        };
        log.debug(`Using default price for ${ingredient}: $${defaultPrice.price.toFixed(2)}`, {}, 'GroceryPriceService');
        priceCacheService.setPriceData(ingredientKey, priceData);
        return priceData;
      }

      // If nothing found, return null and let component handle it
      log.warn(`No price data found for ${ingredient} from any source`, {}, 'GroceryPriceService');
      return null;
    } catch (err: unknown) {
      log.error('Error fetching ingredient price:', { err }, 'GroceryPriceService');
      // Try to at least return default price on error
      const ingredientKey = this.normalizeIngredientName(ingredient);
      const defaultPricesMap = await this.getDefaultPricesMap();
      const defaultPrice = defaultPricesMap[ingredientKey];
      if (defaultPrice) {
        const priceData = {
          averagePrice: defaultPrice.price,
          minPrice: defaultPrice.price,
          maxPrice: defaultPrice.price,
          sampleSize: 1,
          lastUpdated: new Date(),
          unit: defaultPrice.unit
        };
        log.debug(`Using default price (error fallback) for ${ingredient}: $${defaultPrice.price.toFixed(2)}`, {}, 'GroceryPriceService');
        priceCacheService.setPriceData(ingredientKey, priceData);
        return priceData;
      }
      return null;
    }
  }

  // Submit a price update from user
  async submitPriceUpdate(
    ingredient: string,
    price: number,
    unit: string,
    userId: string,
    store?: string,
    location?: string
  ): Promise<void> {
    try {
      const ingredientKey = this.normalizeIngredientName(ingredient);
      const priceId = `${ingredientKey}_${userId}_${Date.now()}`;

      const priceData: GroceryPrice = {
        id: priceId,
        ingredient: ingredientKey,
        price,
        unit,
        currency: 'USD',
        lastUpdated: new Date(),
        source: 'user',
        userId,
        votes: 1
      };

      if (store) {
        priceData.store = store;
      }
      if (location) {
        priceData.location = location;
      }

      await DatabaseMonitoringService.setDoc(DatabaseMonitoringService.doc(this.COLLECTION_NAME, priceId), priceData);

      // Also store in price history
      await this.storePriceHistory(priceData);
    } catch (err: unknown) {
      log.error('Error submitting price update:', { err }, 'GroceryPriceService');
      throw err;
    }
  }

  // Get price trends for an ingredient via Open Prices API. Firestore user-submitted
  // historical lookup is disabled until there's a customer base contributing prices -
  // re-enable once that data exists.
  async getPriceTrends(ingredient: string, days: number = 90, location?: string): Promise<GroceryPrice[]> {
    try {
      return await this.getPriceTrendsFromAPI(ingredient, days, location);
    } catch (err: unknown) {
      log.error('Error fetching price trends:', { err }, 'GroceryPriceService');
      return [];
    }
  }

  // Get analyzed price trend data for UI display
  async getPriceTrendAnalysis(ingredient: string, days: number = 90, location?: string): Promise<PriceTrend | null> {
    try {
      const trends = await this.getPriceTrends(ingredient, days, location);

      if (trends.length === 0) {
        // Return default price if no data available
        const defaultPrice = await this.getDefaultPrice(ingredient);
        return {
          currentPrice: defaultPrice.price,
          lastUpdated: new Date(),
          priceChange: 0,
          priceChangePercent: 0,
          priceHistory: []
        };
      }

      // Sort by date (most recent first)
      const sortedTrends = trends.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());

      // Current price is the most recent
      const currentPrice = sortedTrends[0]!.price;
      const lastUpdated = sortedTrends[0]!.lastUpdated;

      // Calculate price change from the oldest available data point
      let priceChange = 0;
      let priceChangePercent = 0;

      if (sortedTrends.length > 1) {
        // Get the oldest price point available
        const oldestPrice = sortedTrends[sortedTrends.length - 1]!.price;
        priceChange = currentPrice - oldestPrice;
        priceChangePercent = (priceChange / oldestPrice) * 100;
      }

      // Build price history (last 10 entries)
      const priceHistory = sortedTrends.slice(0, 10).map(trend => ({
        date: trend.lastUpdated,
        price: trend.price
      }));

      return {
        currentPrice,
        lastUpdated,
        priceChange,
        priceChangePercent,
        priceHistory
      };
    } catch (err: unknown) {
      log.error('Error analyzing price trends:', { err }, 'GroceryPriceService');

      // Return default price on error
      const defaultPrice = await this.getDefaultPrice(ingredient);
      return {
        currentPrice: defaultPrice.price,
        lastUpdated: new Date(),
        priceChange: 0,
        priceChangePercent: 0,
        priceHistory: []
      };
    }
  }

  // Get default price for an ingredient with plural fallback
  async getDefaultPrice(ingredient: string): Promise<{ price: number; unit: string }> {
    const key = this.normalizeIngredientName(ingredient);
    const defaultPricesMap = await this.getDefaultPricesMap();
    if (defaultPricesMap[key]) return defaultPricesMap[key];

    // Plural fallback: strip trailing 'es' or 's'
    if (key.endsWith('es') && defaultPricesMap[key.slice(0, -2)]) {
      return defaultPricesMap[key.slice(0, -2)];
    }
    if (key.endsWith('s') && defaultPricesMap[key.slice(0, -1)]) {
      return defaultPricesMap[key.slice(0, -1)];
    }

    return { price: 2.99, unit: 'unit' };
  }

  // Fetch latest prices from external APIs (placeholder for future implementation)
  async fetchLatestPrices(): Promise<void> {
    // This would integrate with APIs like:
    // - USDA FoodData Central
    // - Walmart API
    // - Kroger API
    // - Instacart API
    // For now, we'll rely on user-submitted data
    log.info('Fetching latest prices from external APIs...', {}, 'GroceryPriceService');
  }

  // Vote on price accuracy
  async voteOnPrice(priceId: string, userId: string, vote: 'up' | 'down'): Promise<void> {
    try {
      const priceRef = DatabaseMonitoringService.doc(this.COLLECTION_NAME, priceId);
      const priceDoc = await DatabaseMonitoringService.getDoc(priceRef);

      if (!priceDoc.exists()) {
        throw new Error('Price not found');
      }

      const currentVotes = priceDoc.data().votes || 0;
      const newVotes = vote === 'up' ? currentVotes + 1 : Math.max(0, currentVotes - 1);

      await DatabaseMonitoringService.updateDoc(priceRef, { votes: newVotes });
    } catch (err: unknown) {
      log.error('Error voting on price:', { err }, 'GroceryPriceService');
      throw err;
    }
  }

  // Store price in history collection
  private async storePriceHistory(priceData: GroceryPrice): Promise<void> {
    try {
      const historyId = `${priceData.id}_history`;
      await DatabaseMonitoringService.setDoc(DatabaseMonitoringService.doc(this.PRICE_HISTORY_COLLECTION, historyId), {
        ...priceData,
        recordedAt: new Date()
      });
    } catch (err: unknown) {
      log.error('Error storing price history:', { err }, 'GroceryPriceService');
    }
  }

  // Get all available ingredients with price data
  async getAvailableIngredients(): Promise<string[]> {
    try {
      // Option 1: Use direct Firestore (current)
      // const querySnapshot = await getDocs(collection(db, this.COLLECTION_NAME));

      // Option 2: Use DatabaseMonitoringService for tracking (recommended for analytics)
      const ingredientsRef = DatabaseMonitoringService.collection(this.COLLECTION_NAME);
      const querySnapshot = await DatabaseMonitoringService.getDocs(DatabaseMonitoringService.query(ingredientsRef));

      const ingredients = new Set<string>();

      querySnapshot.forEach((doc: { data(): GroceryPrice }) => {
        const data = doc.data();
        ingredients.add(data.ingredient);
      });

      // Add default ingredients
      const defaultPricesMap = await this.getDefaultPricesMap();
      Object.keys(defaultPricesMap).forEach(ingredient => {
        ingredients.add(ingredient);
      });

      return Array.from(ingredients).sort();
    } catch (err: unknown) {
      log.error('Error fetching available ingredients:', { err }, 'GroceryPriceService');
      const defaultPricesMap = await this.getDefaultPricesMap();
      return Object.keys(defaultPricesMap);
    }
  }

  // ===== OPEN PRICES API INTEGRATION =====

  private readonly OPEN_PRICES_BASE_URL = 'https://prices.openfoodfacts.org/api/v1';

  /**
   * Fetch historical prices from Open Prices API for trend analysis
   */
  private async fetchOpenPricesHistory(ingredient: string, days: number = 90, _location?: string): Promise<OpenPricesPrice[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD format

      const params = new URLSearchParams();
      params.append('product_name__like', ingredient);
      params.append('date__gte', startDateStr);
      params.append('currency', 'USD');
      params.append('limit', '100');

      const response = await fetch(`${this.OPEN_PRICES_BASE_URL}/prices?${params}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SmartPantry/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Open Prices API error: ${response.status}`);
      }

      const data: OpenPricesResponse = await response.json();
      return data.items || [];
    } catch (err: unknown) {
      log.warn('Failed to fetch historical prices from Open Prices API:', { err }, 'GroceryPriceService');
      return [];
    }
  }

  /**
   * Get price trends using Open Prices API data
   */
  async getPriceTrendsFromAPI(ingredient: string, days: number = 90, location?: string): Promise<GroceryPrice[]> {
    try {
      const ingredientKey = this.normalizeIngredientName(ingredient);
      const historicalPrices = await this.fetchOpenPricesHistory(ingredient, days, location);

      if (historicalPrices.length === 0) {
        return [];
      }

      // Convert Open Prices data to our GroceryPrice format
      const trends: GroceryPrice[] = historicalPrices
        .filter(price => price.currency === 'USD')
        .map(price => ({
          id: `openprices_${price.id}`,
          ingredient: ingredientKey,
          price: price.price,
          unit: 'each', // Open Prices doesn't specify units
          store: price.store || 'Unknown Store',
          location: price.location || location || 'Unknown Location',
          currency: price.currency,
          lastUpdated: new Date(price.date),
          source: 'api' as const,
          userId: undefined,
          votes: undefined
        }))
        .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime()); // Most recent first

      return trends;
    } catch (err: unknown) {
      log.error('Error fetching price trends from Open Prices API:', { err }, 'GroceryPriceService');
      return [];
    }
  }

  /**
   * Store Open Prices data periodically for trend analysis
   */
  async storeOpenPricesSnapshot(ingredient: string, location?: string): Promise<void> {
    try {
      const ingredientKey = this.normalizeIngredientName(ingredient);
      const currentPrices = await this.fetchOpenPrices(ingredient, location);

      if (currentPrices.length === 0) return;

      // Store current snapshot in history
      const snapshotId = `openprices_${ingredientKey}_${Date.now()}`;

      // Store aggregated data point
      const usdPrices = currentPrices
        .filter(p => p.currency === 'USD')
        .map(p => p.price);

      if (usdPrices.length === 0) return;

      const averagePrice = usdPrices.reduce((sum, price) => sum + price, 0) / usdPrices.length;

      const snapshotData: GroceryPrice = {
        id: snapshotId,
        ingredient: ingredientKey,
        price: Math.round(averagePrice * 100) / 100, // Round to 2 decimals
        unit: 'each',
        store: 'Open Prices API',
        location: location || 'Global Average',
        currency: 'USD',
        lastUpdated: new Date(),
        source: 'api',
        userId: undefined,
        votes: usdPrices.length // Use sample size as "votes"
      };

      await DatabaseMonitoringService.setDoc(DatabaseMonitoringService.doc(this.PRICE_HISTORY_COLLECTION, snapshotId), {
        ...snapshotData,
        recordedAt: new Date()
      });

      log.debug(`Stored Open Prices snapshot for ${ingredient}: $${averagePrice.toFixed(2)}`, {}, 'GroceryPriceService');
    } catch (err: unknown) {
      log.warn('Failed to store Open Prices snapshot:', { err }, 'GroceryPriceService');
    }
  }

  /**
   * Convert Open Prices data to our PriceData format
   */
  private convertOpenPricesToPriceData(prices: OpenPricesPrice[] | null): PriceData | null {
    if (!prices || prices.length === 0) return null;

    // Filter to USD prices only and convert to numbers
    const usdPrices = prices
      .filter(p => p.currency === 'USD' && typeof p.price === 'number')
      .map(p => p.price);

    if (usdPrices.length === 0) return null;

    const averagePrice = usdPrices.reduce((sum, price) => sum + price, 0) / usdPrices.length;
    const minPrice = Math.min(...usdPrices);
    const maxPrice = Math.max(...usdPrices);

    // Get the most recent date from the prices
    const latestDate = prices
      .map(p => new Date(p.date))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      averagePrice: Math.round(averagePrice * 100) / 100, // Round to 2 decimal places
      minPrice: Math.round(minPrice * 100) / 100,
      maxPrice: Math.round(maxPrice * 100) / 100,
      sampleSize: usdPrices.length,
      lastUpdated: latestDate || new Date(),
      unit: 'each' // Open Prices doesn't specify units, default to each
    };
  }

  /**
   * Update price trends for popular ingredients using Open Prices API
   * Call this periodically (e.g., daily) to build trend data
   */
  async updatePriceTrendsFromAPI(popularIngredients: string[] = [], location?: string): Promise<void> {
    try {
      const ingredientsToUpdate = popularIngredients.length > 0
        ? popularIngredients
        : ['banana', 'apple', 'milk', 'bread', 'chicken', 'eggs', 'cheese', 'tomato', 'lettuce', 'potato'];

      log.info(`Updating price trends for ${ingredientsToUpdate.length} ingredients from Open Prices API...`, {}, 'GroceryPriceService');

      for (const ingredient of ingredientsToUpdate) {
        await this.storeOpenPricesSnapshot(ingredient, location);

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      log.info('Price trend update completed', {}, 'GroceryPriceService');
    } catch (err: unknown) {
      log.error('Error updating price trends from API:', { err }, 'GroceryPriceService');
    }
  }

  /**
   * Submit a price to Open Prices (for users who want to contribute)
   */
  async submitToOpenPrices(priceData: {
    product_name: string;
    price: number;
    currency: string;
    location?: string;
    store?: string;
    date?: string;
  }): Promise<boolean> {
    try {
      const response = await fetch(`${this.OPEN_PRICES_BASE_URL}/prices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SmartPantry/1.0'
        },
        body: JSON.stringify({
          ...priceData,
          date: priceData.date || new Date().toISOString().split('T')[0]
        })
      });

      return response.ok;
    } catch (err: unknown) {
      log.warn('Failed to submit price to Open Prices:', { err }, 'GroceryPriceService');
      return false;
    }
  }

  private async fetchOpenPrices(ingredient: string, location?: string): Promise<OpenPricesPrice[]> {
    try {
      // Get recent prices (last 30 days) for current price estimation
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDateStr = thirtyDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD format

      const params = new URLSearchParams();
      params.append('product_name', ingredient);
      params.append('date__gte', startDateStr);
      params.append('currency', 'USD');
      params.append('limit', '50');
      params.append('order_by', '-date');

      if (location) {
        params.append('location__like', location);
      }

      const response = await fetch(`${this.OPEN_PRICES_BASE_URL}/prices?${params}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SmartPantry/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Open Prices API error: ${response.status}`);
      }

      const data: OpenPricesResponse = await response.json();
      return data.items || [];
    } catch (err: unknown) {
      log.warn(`Failed to fetch current prices from Open Prices API for ${ingredient}:`, { err }, 'GroceryPriceService');
      return [];
    }
  }

  async saveGroceryPrice(priceData: GroceryPrice): Promise<void> {
    try {
      const priceRef = DatabaseMonitoringService.doc(this.COLLECTION_NAME, priceData.id);
      await DatabaseMonitoringService.setDoc(priceRef, {
        ...priceData,
        lastUpdated: new Date()
      });
    } catch (err: unknown) {
      log.error('Error saving grocery price:', { err }, 'GroceryPriceService');
      throw err;
    }
  }

  calculatePriceStats(prices: number[]): PriceData | null {
    if (prices.length === 0) {
      return null;
    }

    const sum = prices.reduce((acc, price) => acc + price, 0);
    const averagePrice = sum / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    return {
      averagePrice,
      minPrice,
      maxPrice,
      sampleSize: prices.length,
      lastUpdated: new Date(),
      unit: 'lb' // Default unit
    };
  }

  normalizeIngredientName(name: string): string {
    return name.toLowerCase().trim();
  }
}

export const groceryPriceService = new GroceryPriceService();
