import { PriceData } from './groceryPriceService';
import { PriceDataCacheService } from './priceDataCacheService';
import { log } from './logService';
import { getAuth } from 'firebase/auth';

interface CachedPriceData {
  data: PriceData;
  timestamp: number;
  ttl: number; // 24 hours
}

/**
 * Service for caching price data globally across the app
 * Uses Firestore for persistence and in-memory cache for performance
 */
class PriceCacheService {
  private cache = new Map<string, CachedPriceData>();
  private loaded = false;

  constructor() {
    // Don't load from Firestore immediately - wait for authentication
    // Loading will happen lazily when data is first requested
  }

  /**
   * Load cached price data from Firestore
   */
  private async loadFromFirestore() {
    if (this.loaded) return;

    // Check if user is authenticated
    const auth = getAuth();
    if (!auth.currentUser) {
      log.debug('User not authenticated, skipping Firestore load', {}, 'PriceCache');
      return;
    }

    try {
      const firestoreData = await PriceDataCacheService.loadPriceData();
      const now = Date.now();

      // Load data into memory cache
      for (const [key, data] of firestoreData.entries()) {
        this.cache.set(key, {
          data,
          timestamp: now, // Use current time since we don't store TTL in Firestore
          ttl: 24 * 60 * 60 * 1000 // 24 hours
        });
      }

      this.loaded = true;
      log.debug(`Loaded ${firestoreData.size} price entries from Firestore`, {}, 'PriceCache');
    } catch (err: any) {
      log.warn('Failed to load price cache from Firestore', { error }, 'PriceCache');
    }
  }

  /**
   * Get cached price data for an ingredient
   */
  getPriceData(ingredient: string): PriceData | null {
    const key = ingredient.toLowerCase();
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      log.debug(`Price cache hit for: ${ingredient}`, {}, 'PriceCache');
      return cached.data;
    }

    // Remove expired entry
    if (cached) {
      this.cache.delete(key);
    }

    // Try to load from Firestore if not loaded yet
    if (!this.loaded) {
      this.loadFromFirestore().catch(error => {
        log.warn('Failed to load price cache on demand', { error }, 'PriceCache');
      });
    }

    return null;
  }

  /**
   * Store price data in cache
   */
  setPriceData(ingredient: string, data: PriceData): void {
    const key = ingredient.toLowerCase();
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Persist to Firestore
    this.persistToFirestore();

    log.debug(`Price cached for: ${ingredient}`, {}, 'PriceCache');
  }

  /**
   * Persist current cache to Firestore (debounced batch write)
   */
  private persistTimeout?: NodeJS.Timeout;
  private async persistToFirestore() {
    // Debounce saves to avoid too many writes
    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
    }

    this.persistTimeout = setTimeout(async () => {
      try {
        const priceData = new Map<string, PriceData>();
        for (const [key, cached] of this.cache.entries()) {
          priceData.set(key, cached.data);
        }

        await PriceDataCacheService.savePriceData(priceData);
        log.debug('Price cache persisted to Firestore', {}, 'PriceCache');
      } catch (err: any) {
        log.warn('Failed to persist price cache to Firestore', { error }, 'PriceCache');
      }
    }, 2000); // 2 second debounce
  }

  /**
   * Clear all cached price data
   */
  clearCache(): void {
    this.cache.clear();
    this.loaded = false;

    // Clear from Firestore
    PriceDataCacheService.clearCache().catch(error => {
      log.warn('Failed to clear price cache from Firestore', { error }, 'PriceCache');
    });

    log.debug('Price cache cleared', {}, 'PriceCache');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export const priceCacheService = new PriceCacheService();
