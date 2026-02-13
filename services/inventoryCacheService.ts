import DatabaseMonitoringService from './databaseMonitoringService';
import { PantryItem } from '../types';

export interface CachedInventoryData {
  // Item ID -> [category, imageUrl, name, quantity, location, recipeId?, recipeName?, ...other fields]
  [itemId: string]: string[];
}

// Metadata stored separately in the cache document
export interface CacheMetadata {
  lastUpdated: Date;
  version: number;
  itemCount: number;
}

/**
 * Service for caching inventory data in single documents for efficient bulk reads
 * Each item is stored as: itemId -> [category, imageUrl, name, quantity, location, ...]
 * Similar to how popular_recipes are cached, but for inventory items
 */
export class InventoryCacheService {
  private static readonly CACHE_VERSION = 1;

  // Define the order of fields in the item array - MATCHING actual PantryItem fields
  private static readonly ITEM_FIELD_ORDER = [
    'category',
    'image', // Note: actual field is 'image', not 'imageUrl'
    'item',  // Note: actual field is 'item', not 'name'
    'quantity_estimate', // Note: actual field is 'quantity_estimate', not 'quantity'
    'storageLocation', // Note: actual field is 'storageLocation', not 'location'
    'recipeId',
    'recipeName',
    'expirationDate',
    'expirationType',
    'dateAdded',
    'lastRestocked'
  ] as const;

  /**
   * Convert a PantryItem to an array for caching
   */
  private static pantryItemToArray(item: PantryItem): string[] {
    return [
      item.category || '',
      item.image || '', // image, not imageUrl
      item.item || '',  // item, not name
      item.quantity_estimate || '', // quantity_estimate, not quantity
      item.storageLocation || '', // storageLocation, not location
      item.recipeId || '',
      item.recipeName || '',
      item.expirationDate || '',
      item.expirationType || '',
      item.dateAdded || '',
      item.lastRestocked || ''
    ];
  }

  /**
   * Convert an array back to a PantryItem
   */
  private static arrayToPantryItem(itemId: string, itemArray: string[]): PantryItem {
    return {
      id: itemId,
      category: itemArray[0] || '',
      image: itemArray[1] || '', // image, not imageUrl
      item: itemArray[2] || '',  // item, not name
      quantity_estimate: itemArray[3] || '', // quantity_estimate, not quantity
      storageLocation: itemArray[4] ? itemArray[4] as any : undefined, // storageLocation, not location
      recipeId: itemArray[5] || '',
      recipeName: itemArray[6] || '',
      expirationDate: itemArray[7] || '',
      expirationType: itemArray[8] ? itemArray[8] as any : undefined,
      dateAdded: itemArray[9] || '',
      lastRestocked: itemArray[10] || ''
    };
  }

  /**
   * Get the cache document path for a household or user
   */
  private static getCachePath(householdId?: string, userId?: string): string {
    if (householdId) {
      return `households/${householdId}/cache/inventory`;
    } else if (userId) {
      return `users/${userId}/cache/inventory`;
    }
    throw new Error('Either householdId or userId must be provided');
  }

  /**
   * Get cached inventory data (1 read instead of N reads)
   */
  static async getCachedInventory(householdId?: string, userId?: string): Promise<PantryItem[]> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);
      const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as CachedInventoryData & CacheMetadata;

        // Convert the cached data back to PantryItem objects
        const items: PantryItem[] = [];
        for (const [itemId, itemArray] of Object.entries(data)) {
          // Skip metadata fields
          if (typeof itemArray === 'object' && Array.isArray(itemArray)) {
            const item = this.arrayToPantryItem(itemId, itemArray);
            items.push(item);
          }
        }

        console.log(`✅ Loaded ${items.length} cached inventory items (1 database read)`);
        return items;
      }

      // Cache doesn't exist or is invalid, fall back to loading individual items
      console.log("📥 No cached inventory found, falling back to individual item loading...");
      return await this.loadAndCacheInventory(householdId, userId);
    } catch (error) {
      console.error("❌ Error fetching cached inventory:", error);
      // Fall back to individual loading if caching fails
      console.log("🔄 Falling back to direct inventory loading...");
      return await this.loadAndCacheInventory(householdId, userId);
    }
  }

  /**
   * Load inventory from individual documents and cache it
   */
  private static async loadAndCacheInventory(householdId?: string, userId?: string): Promise<PantryItem[]> {
    let items: PantryItem[] = [];

    try {
      if (householdId) {
        // Load household inventory
        const inventoryRef = DatabaseMonitoringService.collection('households', householdId, 'inventory');
        const snapshot = await DatabaseMonitoringService.getDocs(DatabaseMonitoringService.query(inventoryRef));
        items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PantryItem));
      } else if (userId) {
        // Load user inventory
        const inventoryRef = DatabaseMonitoringService.collection('users', userId, 'inventory');
        const snapshot = await DatabaseMonitoringService.getDocs(DatabaseMonitoringService.query(inventoryRef));
        items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PantryItem));
      }

      // Cache the loaded items
      await this.updateCache(items, householdId, userId);

      console.log(`📦 Cached ${items.length} inventory items for future reads`);
      return items;
    } catch (error) {
      console.error("❌ Error loading inventory for caching:", error);
      return items; // Return empty array or partial results
    }
  }

  /**
   * Update the cached inventory document
   */
  static async updateCache(items: PantryItem[], householdId?: string, userId?: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);

      // Convert items to the cached format
      const cachedData: CachedInventoryData & CacheMetadata = {
        lastUpdated: new Date(),
        version: this.CACHE_VERSION,
        itemCount: items.length
      };

      // Add each item as itemId -> itemArray
      items.forEach(item => {
        cachedData[item.id] = this.pantryItemToArray(item);
      });

      await DatabaseMonitoringService.setDoc(cacheRef, cachedData);
    } catch (error) {
      console.error("❌ Error updating inventory cache:", error);
      // Don't throw - caching failures shouldn't break the app
    }
  }

  /**
   * Add a single item to the cache
   */
  static async addItemToCache(item: PantryItem, householdId?: string, userId?: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);

      // Add the item to the cache document
      const updateData: Partial<CachedInventoryData & CacheMetadata> = {
        [item.id]: this.pantryItemToArray(item),
        lastUpdated: new Date()
      };

      // Increment item count (we need to read current count first)
      const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as CachedInventoryData & CacheMetadata;
        updateData.itemCount = (data.itemCount || 0) + 1;
        await DatabaseMonitoringService.updateDoc(cacheRef, updateData);
      } else {
        // Document doesn't exist, create it with setDoc
        updateData.itemCount = 1;
        updateData.version = this.CACHE_VERSION;
        await DatabaseMonitoringService.setDoc(cacheRef, updateData);
      }
    } catch (error) {
      console.error("❌ Error adding item to cache:", error);
    }
  }

  /**
   * Add multiple items to the cache in a single batch operation (1 read + 1 write for unlimited items)
   */
  static async addItemsToCache(items: PantryItem[], householdId?: string, userId?: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);

      // Read current cache state once
      const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);
      let currentItems: PantryItem[] = [];

      if (docSnap.exists()) {
        const data = docSnap.data() as CachedInventoryData & CacheMetadata;
        // Convert existing cached items back to PantryItem objects
        for (const [itemId, itemArray] of Object.entries(data)) {
          if (typeof itemArray === 'object' && Array.isArray(itemArray)) {
            const item = this.arrayToPantryItem(itemId, itemArray);
            currentItems.push(item);
          }
        }
      }

      // Add new items to existing items
      const allItems = [...currentItems, ...items];

      // Update cache with all items at once (1 write operation)
      await this.updateCache(allItems, householdId, userId);
      console.log(`📦 Added ${items.length} items to cache in 1 batch operation`);
    } catch (error) {
      console.error("❌ Error adding items to cache:", error);
    }
  }

  /**
   * Update a single item in the cache
   */
  static async updateItemInCache(itemId: string, updates: Partial<PantryItem>, householdId?: string, userId?: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);

      // First get the current item data
      const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);
      if (!docSnap.exists()) return;

      const data = docSnap.data() as CachedInventoryData & CacheMetadata;
      const currentItemArray = data[itemId];
      if (!currentItemArray) return;

      // Convert back to object, apply updates, convert back to array
      const currentItem = this.arrayToPantryItem(itemId, currentItemArray);
      const updatedItem = { ...currentItem, ...updates };
      const updatedItemArray = this.pantryItemToArray(updatedItem);

      // Update the cache document
      const updateData: Partial<CachedInventoryData & CacheMetadata> = {
        [itemId]: updatedItemArray,
        lastUpdated: new Date()
      };

      await DatabaseMonitoringService.updateDoc(cacheRef, updateData);
    } catch (error) {
      console.error("❌ Error updating item in cache:", error);
    }
  }

  /**
   * Remove a single item from the cache
   */
  static async removeItemFromCache(itemId: string, householdId?: string, userId?: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);

      // Remove the item from the cache document
      const updateData: Partial<CachedInventoryData & CacheMetadata> = {
        [itemId]: DatabaseMonitoringService.deleteField(), // Use Firestore delete field
        lastUpdated: new Date()
      };

      // Decrement item count
      const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as CachedInventoryData & CacheMetadata;
        updateData.itemCount = Math.max(0, (data.itemCount || 0) - 1);
      }

      await DatabaseMonitoringService.updateDoc(cacheRef, updateData);
    } catch (error) {
      console.error("❌ Error removing item from cache:", error);
    }
  }

  /**
   * Bulk operation: Move items from shopping list to pantry cache
   * This replaces the entire cache with new inventory data (1 read + 1 write)
   */
  static async bulkUpdateInventoryCache(newItems: PantryItem[], householdId?: string, userId?: string): Promise<void> {
    try {
      // This is essentially a cache refresh/replacement operation
      // It replaces the entire cached inventory with the new state
      await this.updateCache(newItems, householdId, userId);
      console.log(`🔄 Bulk updated inventory cache with ${newItems.length} items (1 write operation)`);
    } catch (error) {
      console.error("❌ Error bulk updating inventory cache:", error);
    }
  }

  /**
   * Force refresh the cache by reloading from individual documents
   */
  static async refreshCache(householdId?: string, userId?: string): Promise<PantryItem[]> {
    console.log('🔄 Force refreshing inventory cache...');
    return await this.loadAndCacheInventory(householdId, userId);
  }

  /**
   * Clear the cache (useful for debugging or forced refresh)
   */
  static async clearCache(householdId?: string, userId?: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);
      await DatabaseMonitoringService.setDoc(cacheRef, {
        lastUpdated: new Date(),
        version: this.CACHE_VERSION,
        itemCount: 0
      });
      console.log("🗑️ Cleared inventory cache");
    } catch (error) {
      console.error("❌ Error clearing inventory cache:", error);
    }
  }
}