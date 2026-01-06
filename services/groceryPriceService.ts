import { collection, doc, getDoc, setDoc, updateDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { PriceTrend } from '../types/app';

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

  // Default prices (fallback when no data available)
  private defaultPrices: Record<string, { price: number; unit: string }> = {
    // Proteins
    'chicken': { price: 3.99, unit: 'lb' },
    'beef': { price: 5.99, unit: 'lb' },
    'pork': { price: 4.49, unit: 'lb' },
    'fish': { price: 8.99, unit: 'lb' },
    'salmon': { price: 12.99, unit: 'lb' },
    'eggs': { price: 0.25, unit: 'each' },
    'milk': { price: 3.99, unit: 'gallon' },
    'cheese': { price: 4.99, unit: 'lb' },
    'yogurt': { price: 0.69, unit: 'cup' },
    'butter': { price: 4.99, unit: 'lb' },

    // Produce
    'onion': { price: 1.29, unit: 'lb' },
    'garlic': { price: 0.79, unit: 'head' },
    'tomato': { price: 2.49, unit: 'lb' },
    'lettuce': { price: 1.99, unit: 'head' },
    'carrot': { price: 1.49, unit: 'lb' },
    'potato': { price: 0.89, unit: 'lb' },
    'apple': { price: 2.49, unit: 'lb' },
    'banana': { price: 0.79, unit: 'lb' },
    'lemon': { price: 1.29, unit: 'each' },
    'lime': { price: 0.89, unit: 'each' },
    'broccoli': { price: 2.99, unit: 'head' },
    'spinach': { price: 3.99, unit: 'bag' },
    'bell pepper': { price: 1.99, unit: 'each' },
    'cucumber': { price: 1.49, unit: 'each' },

    // Pantry staples
    'flour': { price: 3.49, unit: 'lb' },
    'sugar': { price: 2.49, unit: 'lb' },
    'rice': { price: 2.99, unit: 'lb' },
    'pasta': { price: 1.49, unit: 'lb' },
    'bread': { price: 3.49, unit: 'loaf' },
    'oil': { price: 5.99, unit: 'bottle' },
    'salt': { price: 1.49, unit: 'container' },
    'pepper': { price: 2.99, unit: 'container' },

    // Spices & seasonings
    'cumin': { price: 4.99, unit: 'oz' },
    'paprika': { price: 3.99, unit: 'oz' },
    'oregano': { price: 3.49, unit: 'oz' },
    'thyme': { price: 3.99, unit: 'oz' },
    'basil': { price: 3.49, unit: 'oz' },
    'cinnamon': { price: 4.49, unit: 'oz' },
    'nutmeg': { price: 5.99, unit: 'oz' },
  };

  // Get current price data for an ingredient
  async getIngredientPrice(ingredient: string, location?: string): Promise<PriceData | null> {
    try {
      const ingredientKey = this.normalizeIngredientName(ingredient);

      // Source 1: Query for recent user-submitted prices (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('ingredient', '==', ingredientKey),
        where('lastUpdated', '>=', thirtyDaysAgo),
        orderBy('lastUpdated', 'desc'),
        limit(50)
      );

      const querySnapshot = await getDocs(q);
      const prices: number[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data() as GroceryPrice;
        prices.push(data.price);
      });

      if (prices.length > 0) {
        const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        console.log(`Using user-submitted price data for ${ingredient}: $${averagePrice.toFixed(2)}`);
        return {
          averagePrice,
          minPrice,
          maxPrice,
          sampleSize: prices.length,
          lastUpdated: new Date(),
          unit: 'lb' // Default unit, could be improved
        };
      }

      // Source 2: Try Open Prices API
      try {
        const openPrices = await this.fetchOpenPrices(ingredient, location);
        const openPriceData = this.convertOpenPricesToPriceData(openPrices);
        if (openPriceData) {
          console.log(`Using Open Prices API data for ${ingredient}:`, openPriceData);
          return openPriceData;
        }
      } catch (error) {
        console.warn('Open Prices API fallback failed:', error);
      }

      // Source 3: Use curated default prices as final fallback
      const defaultPrice = this.defaultPrices[ingredientKey];
      if (defaultPrice) {
        console.log(`Using default price for ${ingredient}: $${defaultPrice.price.toFixed(2)}`);
        return {
          averagePrice: defaultPrice.price,
          minPrice: defaultPrice.price,
          maxPrice: defaultPrice.price,
          sampleSize: 1,
          lastUpdated: new Date(),
          unit: defaultPrice.unit
        };
      }

      // If nothing found, return null and let component handle it
      console.warn(`No price data found for ${ingredient} from any source`);
      return null;
    } catch (error) {
      console.error('Error fetching ingredient price:', error);
      // Try to at least return default price on error
      const ingredientKey = this.normalizeIngredientName(ingredient);
      const defaultPrice = this.defaultPrices[ingredientKey];
      if (defaultPrice) {
        console.log(`Using default price (error fallback) for ${ingredient}: $${defaultPrice.price.toFixed(2)}`);
        return {
          averagePrice: defaultPrice.price,
          minPrice: defaultPrice.price,
          maxPrice: defaultPrice.price,
          sampleSize: 1,
          lastUpdated: new Date(),
          unit: defaultPrice.unit
        };
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
        store,
        location,
        currency: 'USD',
        lastUpdated: new Date(),
        source: 'user',
        userId,
        votes: 1
      };

      await setDoc(doc(db, this.COLLECTION_NAME, priceId), priceData);

      // Also store in price history
      await this.storePriceHistory(priceData);
    } catch (error) {
      console.error('Error submitting price update:', error);
      throw error;
    }
  }

  // Get price trends for an ingredient (combines user data + Open Prices API)
  async getPriceTrends(ingredient: string, days: number = 90, location?: string): Promise<GroceryPrice[]> {
    try {
      const ingredientKey = this.normalizeIngredientName(ingredient);

      // First try to get user-submitted historical data
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const q = query(
        collection(db, this.PRICE_HISTORY_COLLECTION),
        where('ingredient', '==', ingredientKey),
        where('lastUpdated', '>=', startDate),
        orderBy('lastUpdated', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const userTrends: GroceryPrice[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data() as GroceryPrice;
        userTrends.push(data);
      });

      // If we have enough user data, return it
      if (userTrends.length >= 5) {
        return userTrends;
      }

      // Otherwise, supplement with Open Prices API data
      console.log(`Limited user trend data for ${ingredient} (${userTrends.length} points), fetching from Open Prices API...`);
      const apiTrends = await this.getPriceTrendsFromAPI(ingredient, days, location);

      // Combine and deduplicate (prefer user data over API data for same time periods)
      const combinedTrends = [...userTrends];

      // Add API data points that don't conflict with recent user data
      const recentUserDates = new Set(
        userTrends
          .filter(trend => trend.source === 'user')
          .map(trend => trend.lastUpdated.toDateString())
      );

      apiTrends.forEach(apiTrend => {
        if (!recentUserDates.has(apiTrend.lastUpdated.toDateString())) {
          combinedTrends.push(apiTrend);
        }
      });

      return combinedTrends.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
    } catch (error) {
      console.error('Error fetching price trends:', error);

      // Fallback to Open Prices API only
      try {
        return await this.getPriceTrendsFromAPI(ingredient, days, location);
      } catch (fallbackError) {
        console.error('Fallback to Open Prices API also failed:', fallbackError);
        return [];
      }
    }
  }

  // Get analyzed price trend data for UI display
  async getPriceTrendAnalysis(ingredient: string, days: number = 90, location?: string): Promise<PriceTrend | null> {
    try {
      const trends = await this.getPriceTrends(ingredient, days, location);

      if (trends.length === 0) {
        // Return default price if no data available
        const defaultPrice = this.getDefaultPrice(ingredient);
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
      const currentPrice = sortedTrends[0].price;
      const lastUpdated = sortedTrends[0].lastUpdated;

      // Calculate price change from the oldest available data point
      let priceChange = 0;
      let priceChangePercent = 0;

      if (sortedTrends.length > 1) {
        // Get the oldest price point available
        const oldestPrice = sortedTrends[sortedTrends.length - 1].price;
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
    } catch (error) {
      console.error('Error analyzing price trends:', error);

      // Return default price on error
      const defaultPrice = this.getDefaultPrice(ingredient);
      return {
        currentPrice: defaultPrice.price,
        lastUpdated: new Date(),
        priceChange: 0,
        priceChangePercent: 0,
        priceHistory: []
      };
    }
  }

  // Get default price for an ingredient
  private getDefaultPrice(ingredient: string): { price: number; unit: string } {
    const normalizedIngredient = this.normalizeIngredientName(ingredient);
    return this.defaultPrices[normalizedIngredient] || { price: 2.99, unit: 'unit' };
  }

  // Fetch latest prices from external APIs (placeholder for future implementation)
  async fetchLatestPrices(): Promise<void> {
    // This would integrate with APIs like:
    // - USDA FoodData Central
    // - Walmart API
    // - Kroger API
    // - Instacart API
    // For now, we'll rely on user-submitted data
    console.log('Fetching latest prices from external APIs...');
  }

  // Vote on price accuracy
  async voteOnPrice(priceId: string, userId: string, vote: 'up' | 'down'): Promise<void> {
    try {
      const priceRef = doc(db, this.COLLECTION_NAME, priceId);
      const priceDoc = await getDoc(priceRef);

      if (!priceDoc.exists()) {
        throw new Error('Price not found');
      }

      const currentVotes = priceDoc.data().votes || 0;
      const newVotes = vote === 'up' ? currentVotes + 1 : Math.max(0, currentVotes - 1);

      await updateDoc(priceRef, { votes: newVotes });
    } catch (error) {
      console.error('Error voting on price:', error);
      throw error;
    }
  }

  // Normalize ingredient names for better matching
  private normalizeIngredientName(ingredient: string): string {
    return ingredient
      .toLowerCase()
      .trim()
      .replace(/s$/, '') // Remove plural 's'
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .split(' ')[0]; // Take first word
  }

  // Store price in history collection
  private async storePriceHistory(priceData: GroceryPrice): Promise<void> {
    try {
      const historyId = `${priceData.id}_history`;
      await setDoc(doc(db, this.PRICE_HISTORY_COLLECTION, historyId), {
        ...priceData,
        recordedAt: new Date()
      });
    } catch (error) {
      console.error('Error storing price history:', error);
    }
  }

  // Get all available ingredients with price data
  async getAvailableIngredients(): Promise<string[]> {
    try {
      const querySnapshot = await getDocs(collection(db, this.COLLECTION_NAME));
      const ingredients = new Set<string>();

      querySnapshot.forEach((doc) => {
        const data = doc.data() as GroceryPrice;
        ingredients.add(data.ingredient);
      });

      // Add default ingredients
      Object.keys(this.defaultPrices).forEach(ingredient => {
        ingredients.add(ingredient);
      });

      return Array.from(ingredients).sort();
    } catch (error) {
      console.error('Error fetching available ingredients:', error);
      return Object.keys(this.defaultPrices);
    }
  }

  // ===== OPEN PRICES API INTEGRATION =====

  private readonly OPEN_PRICES_BASE_URL = 'https://prices.openfoodfacts.org/api/v1';

  /**
   * Fetch historical prices from Open Prices API for trend analysis
   */
  private async fetchOpenPricesHistory(ingredient: string, days: number = 90, location?: string): Promise<OpenPricesPrice[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD format

      const params = new URLSearchParams({
        product_name__like: ingredient,
        date__gte: startDateStr, // Greater than or equal to start date
        currency: 'USD',
        limit: '100' // Get more data for trends
        // Note: location parameter may not be supported by the API
      });

      const response = await fetch(`${this.OPEN_PRICES_BASE_URL}/v1/prices?${params}`, {
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
    } catch (error) {
      console.warn('Failed to fetch historical prices from Open Prices API:', error);
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
    } catch (error) {
      console.error('Error fetching price trends from Open Prices API:', error);
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

      await setDoc(doc(db, this.PRICE_HISTORY_COLLECTION, snapshotId), {
        ...snapshotData,
        recordedAt: new Date()
      });

      console.log(`Stored Open Prices snapshot for ${ingredient}: $${averagePrice.toFixed(2)}`);
    } catch (error) {
      console.warn('Failed to store Open Prices snapshot:', error);
    }
  }

  /**
   * Convert Open Prices data to our PriceData format
   */
  private convertOpenPricesToPriceData(prices: OpenPricesPrice[]): PriceData | null {
    if (prices.length === 0) return null;

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

      console.log(`Updating price trends for ${ingredientsToUpdate.length} ingredients from Open Prices API...`);

      for (const ingredient of ingredientsToUpdate) {
        await this.storeOpenPricesSnapshot(ingredient, location);

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log('Price trend update completed');
    } catch (error) {
      console.error('Error updating price trends from API:', error);
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
    } catch (error) {
      console.warn('Failed to submit price to Open Prices:', error);
      return false;
    }
  }
}

export const groceryPriceService = new GroceryPriceService();