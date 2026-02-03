import { log } from './logService';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  hits: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
}

class ReadThroughCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private stats: CacheStats = { hits: 0, misses: 0, evictions: 0, size: 0 };
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize: number = 1000, defaultTTL: number = 5 * 60 * 1000) { // 5 minutes default TTL
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;

    // Periodic cleanup
    setInterval(() => this.cleanup(), 60000); // Clean up every minute
  }

  // Get data from cache or fetch from source
  async get(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const now = Date.now();
    const entry = this.cache.get(key);

    // Check if we have a valid cached entry
    if (entry && (now - entry.timestamp) < entry.ttl) {
      entry.hits++;
      this.stats.hits++;
      log.debug(`Cache hit for key: ${key}`, { hits: entry.hits }, 'Cache');
      return entry.data;
    }

    // Cache miss or expired - fetch from source
    this.stats.misses++;
    if (entry) {
      log.debug(`Cache expired for key: ${key}`, { age: now - entry.timestamp }, 'Cache');
    } else {
      log.debug(`Cache miss for key: ${key}`, {}, 'Cache');
    }

    try {
      const data = await fetcher();
      this.set(key, data, ttl);
      return data;
    } catch (error) {
      log.error(`Failed to fetch data for key: ${key}`, error, 'Cache');
      throw error;
    }
  }

  // Set data in cache
  set(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const effectiveTTL = ttl || this.defaultTTL;

    // Evict if at max size
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      ttl: effectiveTTL,
      hits: 0
    });

    this.stats.size = this.cache.size;
  }

  // Invalidate specific key
  invalidate(key: string): void {
    if (this.cache.delete(key)) {
      this.stats.size = this.cache.size;
      log.debug(`Invalidated cache key: ${key}`, {}, 'Cache');
    }
  }

  // Invalidate keys matching pattern
  invalidatePattern(pattern: RegExp): void {
    let invalidated = 0;
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        invalidated++;
      }
    }
    this.stats.size = this.cache.size;
    if (invalidated > 0) {
      log.debug(`Invalidated ${invalidated} cache keys matching pattern`, { pattern: pattern.toString() }, 'Cache');
    }
  }

  // Clear all cache
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.size = 0;
    log.info(`Cleared cache (${size} entries)`, {}, 'Cache');
  }

  // Get cache statistics
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0
    };
  }

  // Cleanup expired entries
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if ((now - entry.timestamp) >= entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.stats.size = this.cache.size;
      log.debug(`Cleaned up ${cleaned} expired cache entries`, {}, 'Cache');
    }
  }

  // Evict least recently used (simple implementation)
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      log.debug(`Evicted LRU cache entry: ${oldestKey}`, {}, 'Cache');
    }
  }
}

// Specialized cache for Firestore queries
class FirestoreCache {
  private queryCache = new ReadThroughCache<any[]>(100, 2 * 60 * 1000); // 2 minutes for queries
  private documentCache = new ReadThroughCache<any>(500, 5 * 60 * 1000); // 5 minutes for documents

  // Cache query results
  async getQuery(
    collection: string,
    queryKey: string,
    fetcher: () => Promise<any[]>
  ): Promise<any[]> {
    const cacheKey = `query:${collection}:${queryKey}`;
    return this.queryCache.get(cacheKey, fetcher);
  }

  // Cache document results
  async getDocument(
    collection: string,
    docId: string,
    fetcher: () => Promise<any>
  ): Promise<any> {
    const cacheKey = `doc:${collection}:${docId}`;
    return this.documentCache.get(cacheKey, fetcher);
  }

  // Invalidate collection cache
  invalidateCollection(collection: string): void {
    this.queryCache.invalidatePattern(new RegExp(`^query:${collection}:`));
    this.documentCache.invalidatePattern(new RegExp(`^doc:${collection}:`));
    log.info(`Invalidated cache for collection: ${collection}`, {}, 'FirestoreCache');
  }

  // Invalidate specific document
  invalidateDocument(collection: string, docId: string): void {
    this.documentCache.invalidate(`doc:${collection}:${docId}`);
    log.debug(`Invalidated document cache: ${collection}/${docId}`, {}, 'FirestoreCache');
  }

  // Get combined statistics
  getStats() {
    return {
      queries: this.queryCache.getStats(),
      documents: this.documentCache.getStats()
    };
  }

  // Clear all caches
  clear(): void {
    this.queryCache.clear();
    this.documentCache.clear();
  }
}

// Create singleton instances
export const firestoreCache = new FirestoreCache();
export const generalCache = new ReadThroughCache(1000, 10 * 60 * 1000); // 10 minutes general cache

// Utility functions for common caching patterns
export const cacheUtils = {
  // Cache with composite key
  createCompositeKey: (...parts: (string | number | undefined)[]): string => {
    return parts.filter(p => p !== undefined).join(':');
  },

  // Cache user-specific data
  getUserKey: (userId: string | undefined, key: string): string => {
    return userId ? `user:${userId}:${key}` : `global:${key}`;
  },

  // Cache household-specific data
  getHouseholdKey: (householdId: string | undefined, key: string): string => {
    return householdId ? `household:${householdId}:${key}` : `global:${key}`;
  }
};

export default firestoreCache;