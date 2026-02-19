import DatabaseMonitoringService from './databaseMonitoringService';
import { PriceData } from './groceryPriceService';
import { getAuth } from 'firebase/auth';

export interface CachedPriceData {
  // Ingredient key -> PriceData
  [ingredientKey: string]: {
    averagePrice: number;
    minPrice: number;
    maxPrice: number;
    sampleSize: number;
    lastUpdated: string; // ISO string
    unit: string;
  };
}

// Metadata stored separately in the cache document
export interface PriceDataCacheMetadata {
  lastUpdated: Date;
  version: number;
  totalItems: number;
}

/**
 * Service for caching price data in Firestore for efficient bulk reads
 * Stores all price data in a single root-level document for global access
 */
export class PriceDataCacheService {
  private static readonly CACHE_DOC_ID = 'price_cache/global';
  private static readonly CACHE_VERSION = 1;

  /**
   * Get the cache document reference
   */
  private static getCacheRef() {
    return doc(db, this.CACHE_DOC_ID);
  }

  /**
   * Load all cached price data
   */
  static async loadPriceData(): Promise<Map<string, PriceData>> {
    try {
      // Check if user is authenticated before accessing Firestore
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        console.warn('Cannot load price data cache: user not authenticated');
        return new Map();
      }

      const cacheRef = this.getCacheRef();

      const cacheDoc = await DatabaseMonitoringService.getDoc(cacheRef);
      if (!cacheDoc.exists()) {
        return new Map();
      }

      const data = cacheDoc.data();
      const priceData = data?.priceData as CachedPriceData | undefined;

      if (!priceData) return new Map();

      const result = new Map<string, PriceData>();
      for (const [key, cached] of Object.entries(priceData)) {
        result.set(key, {
          ...cached,
          lastUpdated: new Date(cached.lastUpdated)
        });
      }

      return result;
    } catch (err: any) {
      console.warn('Failed to load price data cache:', err);
      return new Map();
    }
  }

  /**
   * Save price data cache (batch write)
   */
  static async savePriceData(priceData: Map<string, PriceData>): Promise<void> {
    if (priceData.size === 0) return;

    try {
      // Check if user is authenticated before accessing Firestore
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        console.warn('Cannot save price data cache: user not authenticated');
        return;
      }

      const cacheRef = this.getCacheRef();

      // Convert Map to object for Firestore
      const cachedData: CachedPriceData = {};
      for (const [key, data] of priceData.entries()) {
        cachedData[key] = {
          ...data,
          lastUpdated: data.lastUpdated.toISOString()
        };
      }

      const metadata: PriceDataCacheMetadata = {
        lastUpdated: new Date(),
        version: this.CACHE_VERSION,
        totalItems: priceData.size
      };

      await DatabaseMonitoringService.setDoc(cacheRef, {
        priceData: cachedData,
        metadata
      }, { merge: true });

    } catch (err: any) {
      console.error('Failed to save price data cache:', err);
      throw err;
    }
  }

  /**
   * Update specific price data in the cache
   */
  static async updatePriceData(ingredientKey: string, priceData: PriceData): Promise<void> {
    try {
      // Check if user is authenticated before accessing Firestore
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        console.warn('Cannot update price data cache: user not authenticated');
        return;
      }

      const cacheRef = this.getCacheRef();

      const updateData = {
        [`priceData.${ingredientKey}`]: {
          ...priceData,
          lastUpdated: priceData.lastUpdated.toISOString()
        },
        'metadata.lastUpdated': new Date(),
        'metadata.version': this.CACHE_VERSION
      };

      await DatabaseMonitoringService.updateDoc(cacheRef, updateData);
    } catch (err: any) {
      console.error('Failed to update price data cache:', err);
      throw err;
    }
  }

  /**
   * Clear the price data cache
   */
  static async clearCache(): Promise<void> {
    try {
      // Check if user is authenticated before accessing Firestore
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        console.warn('Cannot clear price data cache: user not authenticated');
        return;
      }

      const cacheRef = this.getCacheRef();

      await DatabaseMonitoringService.updateDoc(cacheRef, {
        priceData: {},
        metadata: {
          lastUpdated: new Date(),
          version: this.CACHE_VERSION,
          totalItems: 0
        }
      });
    } catch (err: any) {
      console.error('Failed to clear price data cache:', err);
      throw err;
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<{ size: number; lastUpdated?: Date }> {
    try {
      // Check if user is authenticated before accessing Firestore
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        console.warn('Cannot get cache stats: user not authenticated');
        return { size: 0 };
      }

      const cacheRef = this.getCacheRef();

      const cacheDoc = await DatabaseMonitoringService.getDoc(cacheRef);
      if (!cacheDoc.exists()) {
        return { size: 0 };
      }

      const data = cacheDoc.data();
      const metadata = data?.metadata as PriceDataCacheMetadata | undefined;

      return {
        size: metadata?.totalItems || 0,
        lastUpdated: metadata?.lastUpdated
      };
    } catch (err: any) {
      console.warn('Failed to get cache stats:', err);
      return { size: 0 };
    }
  }
}
