import { log } from './logService';

interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  version: number; // For cache invalidation
  metadata?: any; // Additional metadata
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
  storageUsed: number; // Estimated bytes
}

class IndexedDBCache {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'SmartPantryCache';
  private readonly dbVersion = 1;
  private readonly storeName = 'cache';
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    size: 0,
    storageUsed: 0
  };
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initDB();
    // Periodic cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        log.error('Failed to open IndexedDB cache', request.error, 'IndexedDBCache');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        log.info('IndexedDB cache initialized', {}, 'IndexedDBCache');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('ttl', 'ttl');
        }
      };
    });
  }

  private async ensureDB(): Promise<void> {
    if (!this.db) {
      await this.initDB();
    }
  }

  // Get data from cache
  async get<T>(key: string): Promise<T | null> {
    await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onerror = () => {
        log.error(`Failed to get cache entry: ${key}`, request.error, 'IndexedDBCache');
        reject(request.error);
      };

      request.onsuccess = () => {
        const entry: CacheEntry<T> = request.result;

        if (!entry) {
          this.stats.misses++;
          resolve(null);
          return;
        }

        // Check if expired
        if (Date.now() - entry.timestamp > entry.ttl) {
          // Remove expired entry
          this.delete(key).catch(err =>
            log.warn(`Failed to remove expired cache entry: ${key}`, err, 'IndexedDBCache')
          );
          this.stats.misses++;
          resolve(null);
          return;
        }

        this.stats.hits++;
        resolve(entry.data);
      };
    });
  }

  // Set data in cache
  async set<T>(
    key: string,
    data: T,
    ttl: number = 30 * 60 * 1000, // 30 minutes default
    metadata?: any
  ): Promise<void> {
    await this.ensureDB();

    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
      ttl,
      version: 1,
      metadata
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(entry);

      request.onerror = () => {
        log.error(`Failed to set cache entry: ${key}`, request.error, 'IndexedDBCache');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.stats.sets++;
        this.updateStats();
        resolve();
      };
    });
  }

  // Delete from cache
  async delete(key: string): Promise<void> {
    await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onerror = () => {
        log.error(`Failed to delete cache entry: ${key}`, request.error, 'IndexedDBCache');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.stats.deletes++;
        this.updateStats();
        resolve();
      };
    });
  }

  // Clear all cache
  async clear(): Promise<void> {
    await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => {
        log.error('Failed to clear cache', request.error, 'IndexedDBCache');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0, size: 0, storageUsed: 0 };
        log.info('Cache cleared', {}, 'IndexedDBCache');
        resolve();
      };
    });
  }

  // Get cache statistics
  getStats(): CacheStats {
    return { ...this.stats };
  }

  // Update size statistics
  private async updateStats(): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const countRequest = store.count();

      countRequest.onsuccess = () => {
        this.stats.size = countRequest.result;
        // Rough estimate of storage used (very approximate)
        this.stats.storageUsed = this.stats.size * 1024; // Assume ~1KB per entry
      };
    } catch (err: any) {
      log.warn('Failed to update cache stats', err, 'IndexedDBCache');
    }
  }

  // Cleanup expired entries
  private async cleanup(): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const now = Date.now();
      let cleaned = 0;

      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const entry: CacheEntry<any> = cursor.value;

          if (now - entry.timestamp > entry.ttl) {
            cursor.delete();
            cleaned++;
          }
          cursor.continue();
        } else {
          if (cleaned > 0) {
            log.info(`Cleaned up ${cleaned} expired cache entries`, {}, 'IndexedDBCache');
            this.updateStats();
          }
        }
      };

      request.onerror = () => {
        log.error('Failed to cleanup cache', request.error, 'IndexedDBCache');
      };
    } catch (err: any) {
      log.error('Cache cleanup failed', err, 'IndexedDBCache');
    }
  }

  // Get or set (cache-aside pattern)
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    await this.set(key, data, ttl);
    return data;
  }

  // Batch operations
  async setMultiple(entries: Array<{ key: string; data: any; ttl?: number; metadata?: any }>): Promise<void> {
    await this.ensureDB();

    const transaction = this.db!.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);

    const promises = entries.map(entry => {
      const cacheEntry: CacheEntry<any> = {
        key: entry.key,
        data: entry.data,
        timestamp: Date.now(),
        ttl: entry.ttl || 30 * 60 * 1000,
        version: 1,
        metadata: entry.metadata
      };

      return new Promise<void>((resolve, reject) => {
        const request = store.put(cacheEntry);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    });

    await Promise.all(promises);
    this.stats.sets += entries.length;
    await this.updateStats();
  }

  // Destroy the cache (cleanup)
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Specialized cache for different data types
export class OfflineDataCache {
  private cache = new IndexedDBCache();

  // Recipe metadata cache
  async getRecipeMetadata(recipeId: string) {
    const key = `recipe_metadata_${recipeId}`;
    return this.cache.get(key);
  }

  async setRecipeMetadata(recipeId: string, metadata: any, ttl?: number) {
    const key = `recipe_metadata_${recipeId}`;
    await this.cache.set(key, metadata, ttl);
  }

  // Category lists cache
  async getCategories(userId?: string) {
    const key = userId ? `categories_${userId}` : 'categories_global';
    return this.cache.get(key);
  }

  async setCategories(categories: any[], userId?: string, ttl?: number) {
    const key = userId ? `categories_${userId}` : 'categories_global';
    await this.cache.set(key, categories, ttl);
  }

  // User preferences cache
  async getUserPreferences(userId: string) {
    const key = `user_prefs_${userId}`;
    return this.cache.get(key);
  }

  async setUserPreferences(userId: string, preferences: any, ttl?: number) {
    const key = `user_prefs_${userId}`;
    await this.cache.set(key, preferences, ttl);
  }

  // Search indexes cache
  async getSearchIndex(collection: string, query?: string) {
    const key = query ? `search_index_${collection}_${query}` : `search_index_${collection}`;
    return this.cache.get(key);
  }

  async setSearchIndex(collection: string, index: any, query?: string, ttl?: number) {
    const key = query ? `search_index_${collection}_${query}` : `search_index_${collection}`;
    await this.cache.set(key, index, ttl);
  }

  // Popular recipes cache
  async getPopularRecipes(limit?: number) {
    const key = `popular_recipes_${limit || 50}`;
    return this.cache.get(key);
  }

  async setPopularRecipes(recipes: any[], limit?: number, ttl?: number) {
    const key = `popular_recipes_${limit || 50}`;
    await this.cache.set(key, recipes, ttl);
  }

  // Household data cache
  async getHouseholdData(householdId: string, dataType: string) {
    const key = `household_${householdId}_${dataType}`;
    return this.cache.get(key);
  }

  async setHouseholdData(householdId: string, dataType: string, data: any, ttl?: number) {
    const key = `household_${householdId}_${dataType}`;
    await this.cache.set(key, data, ttl);
  }

  // Cache statistics
  getStats() {
    return this.cache.getStats();
  }

  // Clear all cached data
  async clear() {
    await this.cache.clear();
    log.info('Offline data cache cleared', {}, 'OfflineDataCache');
  }

  // Invalidate user-specific data
  async invalidateUserData(userId: string) {
    // This would need to be implemented with pattern matching in a real scenario
    log.info(`Invalidating cache for user: ${userId}`, {}, 'OfflineDataCache');
  }

  // Invalidate household-specific data
  async invalidateHouseholdData(householdId: string) {
    // This would need to be implemented with pattern matching in a real scenario
    log.info(`Invalidating cache for household: ${householdId}`, {}, 'OfflineDataCache');
  }
}

// Create singleton instance
export const offlineDataCache = new OfflineDataCache();

// Export the base cache for advanced usage
export default offlineDataCache;
