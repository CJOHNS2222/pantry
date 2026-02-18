import DatabaseMonitoringService from './databaseMonitoringService';
import { ShoppingItem } from '../types';
import { priceCacheService } from './priceCacheService';

export interface CachedShoppingListData {
  // Item ID -> ShoppingItem data as object
  [itemId: string]: {
    item: string;
    quantity?: string;
    category?: string;
    source?: string;
    addedAt: string; // ISO string
    estimatedPrice?: number;
    priceData?: {
      averagePrice: number;
      minPrice: number;
      maxPrice: number;
      sampleSize: number;
      lastUpdated: string; // ISO string
      unit: string;
    };
  };
}

// Metadata stored separately in the cache document
export interface ShoppingListCacheMetadata {
  lastUpdated: Date;
  version: number;
  totalItems: number;
}

/**
 * Service for caching shopping list data in single documents for efficient bulk reads
 * Each item is stored as: itemId -> [item, quantity, category, checked, source, addedAt, estimatedPrice]
 */
export class ShoppingListCacheService {
    /**
     * Set the entire shopping list cache (overwrite all items)
     */
    static async setCache(items: ShoppingItem[], householdId?: string, userId?: string): Promise<void> {
      try {
        const cachePath = this.getCachePath(householdId, userId);
        const cacheRef = DatabaseMonitoringService.doc(cachePath);
        const cachedData: CachedShoppingListData & ShoppingListCacheMetadata = {
          lastUpdated: new Date(),
          version: this.CACHE_VERSION,
          totalItems: items.length
        };
        items.forEach(item => {
          cachedData[item.id] = this.shoppingItemToObject(item);
        });
        await DatabaseMonitoringService.setDoc(cacheRef, cachedData);
        console.log(`📝 Set shopping list cache with ${items.length} items`);
      } catch (err: any) {
        console.error('Failed to set shopping list cache:', error);
      }
    }
  private static readonly CACHE_VERSION = 1;

  /**
   * Convert a ShoppingItem to a cached object format
   */
  private static shoppingItemToObject(item: ShoppingItem): CachedShoppingListData[string] {
    let addedAtDate: Date;
    if (item.addedAt instanceof Date && !isNaN(item.addedAt.getTime())) {
      addedAtDate = item.addedAt;
    } else if (typeof item.addedAt === 'string') {
      const parsed = new Date(item.addedAt);
      addedAtDate = isNaN(parsed.getTime()) ? new Date() : parsed;
    } else {
      addedAtDate = new Date();
    }
    const obj: any = {
      item: item.item,
      quantity: item.quantity,
      category: item.category,
      source: item.source,
      addedAt: addedAtDate.toISOString()
    };
    if (item.estimatedPrice !== undefined) obj.estimatedPrice = item.estimatedPrice;
    if (item.priceData) {
      obj.priceData = {
        averagePrice: item.priceData.averagePrice,
        minPrice: item.priceData.minPrice,
        maxPrice: item.priceData.maxPrice,
        sampleSize: item.priceData.sampleSize,
        lastUpdated: item.priceData.lastUpdated instanceof Date && !isNaN(item.priceData.lastUpdated.getTime()) ? item.priceData.lastUpdated.toISOString() : new Date().toISOString(),
        unit: item.priceData.unit
      };
    }
    return obj;
  }

  /**
   * Convert cached object back to ShoppingItem
   */
  static objectToShoppingItem(itemId: string, itemObject: CachedShoppingListData[string]): ShoppingItem {
    const priceData = itemObject.priceData ? {
      ...itemObject.priceData,
      lastUpdated: new Date(itemObject.priceData.lastUpdated)
    } : undefined;

    // Populate global price cache if we have price data
    if (priceData) {
      priceCacheService.setPriceData(itemObject.item, priceData);
    }

    return {
      id: itemId,
      item: itemObject.item,
      quantity: itemObject.quantity,
      category: itemObject.category,
      checked: false,
      source: itemObject.source,
      addedAt: new Date(itemObject.addedAt),
      estimatedPrice: itemObject.estimatedPrice,
      completedAt: undefined,
      priceData
    };
  }

  /**
   * Get cached path for shopping list
   */
  private static getCachePath(householdId?: string, userId?: string): string {
    if (householdId) {
      return `households/${householdId}/cache/shoppingList`;
    } else if (userId) {
      return `users/${userId}/cache/shoppingList`;
    }
    throw new Error('Either householdId or userId must be provided');
  }

  /**
   * Get cached shopping list data (1 read instead of N reads)
   */
  static async getCachedShoppingList(householdId?: string, userId?: string): Promise<ShoppingItem[]> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);
      const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as CachedShoppingListData & ShoppingListCacheMetadata;

        if (data.version === this.CACHE_VERSION) {
          const items: ShoppingItem[] = [];
          for (const [itemId, itemObject] of Object.entries(data)) {
            if (itemId !== 'lastUpdated' && itemId !== 'version' && itemId !== 'totalItems') {
              items.push(this.objectToShoppingItem(itemId, itemObject as CachedShoppingListData[string]));
            }
          }

          console.log(`✅ Loaded ${items.length} cached shopping list items (1 database read)`);
          return items.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime()); // Most recent first
        }
      }

      console.log('📭 No valid shopping list cache found, will load from individual documents');
      return [];
    } catch (err: any) {
      // Don't log permission errors as they may be expected
      if (!error.message.includes('Missing or insufficient permissions')) {
        console.warn('Failed to load shopping list cache:', error);
      }
      return [];
    }
  }

  /**
   * Add a single item to the shopping list cache
   */
  static async addItemToCache(item: ShoppingItem, householdId?: string, userId?: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);

      const updateData: Partial<CachedShoppingListData & ShoppingListCacheMetadata> = {
        lastUpdated: new Date(),
        [item.id]: this.shoppingItemToObject(item)
      };

      // First try to update existing cache
      try {
        await DatabaseMonitoringService.updateDoc(cacheRef, updateData);
      } catch (err: any) {
        // If cache doesn't exist, create it
        const cachedData: CachedShoppingListData & ShoppingListCacheMetadata = {
          lastUpdated: new Date(),
          version: this.CACHE_VERSION,
          totalItems: 1,
          [item.id]: this.shoppingItemToObject(item)
        };
        await DatabaseMonitoringService.setDoc(cacheRef, cachedData);
      }

      console.log(`➕ Added shopping list item to cache: ${item.item}`);
    } catch (err: any) {
      console.error('Failed to add shopping list item to cache:', error);
    }
  }

  /**
   * Update a single item in the cache
   */
  static async updateItemInCache(itemId: string, updates: Partial<ShoppingItem>, householdId?: string, userId?: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);

      // Build update object for specific fields
      const updateData: any = {
        lastUpdated: new Date(),
      };

      if (updates.item !== undefined) updateData[`${itemId}.item`] = updates.item;
      if (updates.quantity !== undefined) updateData[`${itemId}.quantity`] = updates.quantity;
      if (updates.category !== undefined) updateData[`${itemId}.category`] = updates.category;
      if (updates.source !== undefined) updateData[`${itemId}.source`] = updates.source;
      if (updates.addedAt !== undefined) updateData[`${itemId}.addedAt`] = updates.addedAt.toISOString();
      if (updates.estimatedPrice !== undefined) updateData[`${itemId}.estimatedPrice`] = updates.estimatedPrice;

      await DatabaseMonitoringService.updateDoc(cacheRef, updateData);
      console.log(`🔄 Updated shopping list item in cache: ${itemId}`);
    } catch (err: any) {
      console.error('Failed to update shopping list item in cache:', error);
    }
  }

  /**
   * Remove an item from the cache
   */
  static async removeItemFromCache(itemId: string, householdId?: string, userId?: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);

      const updateData = {
        lastUpdated: new Date(),
        [itemId]: DatabaseMonitoringService.deleteField()
      };

      await DatabaseMonitoringService.updateDoc(cacheRef, updateData);
      console.log(`🗑️ Removed shopping list item from cache: ${itemId}`);
    } catch (err: any) {
      console.error('Failed to remove shopping list item from cache:', error);
    }
  }

  /**
   * Clear the entire shopping list cache
   */
  static async clearCache(householdId?: string, userId?: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);
      await DatabaseMonitoringService.deleteDoc(cacheRef);
      console.log('🧹 Cleared shopping list cache');
    } catch (err: any) {
      console.error('Failed to clear shopping list cache:', error);
    }
  }
}
