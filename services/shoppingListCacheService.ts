import DatabaseMonitoringService from './databaseMonitoringService';
import { ShoppingItem } from '../types';
import { priceCacheService } from './priceCacheService';

interface CachedShoppingListData {
  [itemId: string]: {
    item: string;
    quantity?: string;
    category?: string;
    source?: string;
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

interface ShoppingListCache {
  metadata: {
    lastUpdated: Date;
    version: number;
    totalItems: number;
  },
  items: CachedShoppingListData;
}

const CACHE_VERSION = 2.1; // Version bump due to schema change (removed addedAt)

const getCachePath = (householdId?: string, userId?: string): string => {
  if (householdId) {
    return `households/${householdId}/cache/shoppingList`;
  } else if (userId) {
    return `users/${userId}/cache/shoppingList`;
  }
  throw new Error('Either householdId or userId must be provided');
};

const shoppingItemToObject = (item: ShoppingItem): CachedShoppingListData[string] => {
  const obj: any = {
    item: item.item,
    quantity: item.quantity,
    category: item.category,
    source: item.source,
  };
  if (item.estimatedPrice !== undefined) obj.estimatedPrice = item.estimatedPrice;
  if (item.priceData) {
    obj.priceData = {
      ...item.priceData,
      lastUpdated: item.priceData.lastUpdated instanceof Date ? item.priceData.lastUpdated.toISOString() : new Date().toISOString(),
    };
  }
  return obj;
};

const objectToShoppingItem = (itemId: string, itemObject: CachedShoppingListData[string]): ShoppingItem => {
  const priceData = itemObject.priceData ? {
    ...itemObject.priceData,
    lastUpdated: new Date(itemObject.priceData.lastUpdated)
  } : undefined;

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
    addedAt: new Date(0), // Using a static date as it's no longer persisted
    estimatedPrice: itemObject.estimatedPrice,
    completedAt: undefined,
    priceData
  };
};

const getCachedShoppingList = async (householdId?: string, userId?: string): Promise<ShoppingItem[]> => {
  try {
    const cachePath = getCachePath(householdId, userId);
    const cacheRef = DatabaseMonitoringService.doc(cachePath);
    const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as ShoppingListCache;
      // V2.1 cache structure
      if (data.metadata && data.metadata.version >= CACHE_VERSION) {
        const items: ShoppingItem[] = Object.entries(data.items).map(([itemId, itemObject]) => 
          objectToShoppingItem(itemId, itemObject as CachedShoppingListData[string])
        );
        console.log(`✅ Loaded ${items.length} cached shopping list items from v2.1 cache (1 database read)`);
        // Sort alphabetically as addedAt is no longer reliable
        return items.sort((a, b) => a.item.localeCompare(b.item));
      }

      // V1/V2 cache structure (for migration)
      if (!data.metadata || data.metadata.version < CACHE_VERSION) {
          const items: ShoppingItem[] = [];
          // Handle both old structures
          const itemsSource = data.items || data;
          for (const [itemId, itemObject] of Object.entries(itemsSource)) {
            if (itemId !== 'lastUpdated' && itemId !== 'version' && itemId !== 'totalItems' && itemId !== 'metadata') {
              // Adapt to old object structure for migration
              const oldItemObject = itemObject as any;
              items.push({
                id: itemId,
                item: oldItemObject.item,
                quantity: oldItemObject.quantity,
                category: oldItemObject.category,
                checked: false,
                source: oldItemObject.source,
                addedAt: new Date(0),
                estimatedPrice: oldItemObject.estimatedPrice,
                completedAt: undefined,
                priceData: undefined // Price data not in old versions
              });
            }
          }
          console.log(`Migrating ${items.length} shopping list items to v2.1 cache...`);
          await setCache(items, householdId, userId); // This will convert to new structure
          return items.sort((a, b) => a.item.localeCompare(b.item));
      }
    }

    console.log('📭 No valid shopping list cache found.');
    return [];
  } catch (error: any) {
    if (!error.message.includes('Missing or insufficient permissions')) {
      console.warn('Failed to load shopping list cache:', error);
    }
    return [];
  }
};

const setCache = async (items: ShoppingItem[], householdId?: string, userId?: string): Promise<void> => {
  try {
    const cachePath = getCachePath(householdId, userId);
    const cacheRef = DatabaseMonitoringService.doc(cachePath);
    const newCache: ShoppingListCache = {
      metadata: {
        lastUpdated: new Date(),
        version: CACHE_VERSION,
        totalItems: items.length,
      },
      items: items.reduce((acc, item) => {
        acc[item.id] = shoppingItemToObject(item);
        return acc;
      }, {} as CachedShoppingListData)
    };
    await DatabaseMonitoringService.setDoc(cacheRef, newCache);
    console.log(`📝 Set shopping list cache with ${items.length} items using v2.1 format.`);
  } catch (err: any) {
    console.error('Failed to set shopping list cache:', err);
  }
};

const addItem = async (item: ShoppingItem, householdId?: string, userId?: string): Promise<void> => {
  const cachePath = getCachePath(householdId, userId);
  const cacheRef = DatabaseMonitoringService.doc(cachePath);
  try {
    await DatabaseMonitoringService.updateDoc(cacheRef, {
      [`items.${item.id}`]: shoppingItemToObject(item),
      'metadata.lastUpdated': new Date(),
      'metadata.totalItems': DatabaseMonitoringService.increment(1)
    });
    console.log(`➕ Added shopping list item to cache: ${item.item}`);
  } catch(e: any) {
      if (e.code === 'not-found' || e.message.includes('No document to update')) {
          console.log('Cache document not found. Creating a new one.');
          await setCache([item], householdId, userId);
      } else {
          console.error('Failed to add shopping list item:', e);
      }
  }
};

const updateItem = async (itemId: string, updates: Partial<ShoppingItem>, householdId?: string, userId?: string): Promise<void> => {
  const cachePath = getCachePath(householdId, userId);
  const cacheRef = DatabaseMonitoringService.doc(cachePath);
  const updateData: { [key: string]: any } = {
    'metadata.lastUpdated': new Date(),
  };
  for (const [key, value] of Object.entries(updates)) {
    // Can't update addedAt anymore, so we prevent it.
    if (key === 'addedAt') continue;

    if (value instanceof Date) {
        updateData[`items.${itemId}.${key}`] = value.toISOString();
    } else {
        updateData[`items.${itemId}.${key}`] = value;
    }
  }
  try {
    await DatabaseMonitoringService.updateDoc(cacheRef, updateData);
    console.log(`🔄 Updated shopping list item in cache: ${itemId}`);
  } catch (err: any) {
    console.error('Failed to update shopping list item in cache:', err);
  }
};

const removeItem = async (itemId: string, householdId?: string, userId?: string): Promise<void> => {
  const cachePath = getCachePath(householdId, userId);
  const cacheRef = DatabaseMonitoringService.doc(cachePath);
  try {
    await DatabaseMonitoringService.updateDoc(cacheRef, {
      [`items.${itemId}`]: DatabaseMonitoringService.deleteField(),
      'metadata.lastUpdated': new Date(),
      'metadata.totalItems': DatabaseMonitoringService.increment(-1)
    });
    console.log(`🗑️ Removed shopping list item from cache: ${itemId}`);
  } catch (err: any) {
    console.error('Failed to remove shopping list item from cache:', err);
  }
};

const clearCache = async (householdId?: string, userId?: string): Promise<void> => {
  try {
    const cachePath = getCachePath(householdId, userId);
    const cacheRef = DatabaseMonitoringService.doc(cachePath);
    await DatabaseMonitoringService.deleteDoc(cacheRef);
    console.log('🧹 Cleared shopping list cache');
  } catch (err: any) {
    console.error('Failed to clear shopping list cache:', err);
  }
};

export const ShoppingListCacheService = {
  getCachedShoppingList,
  setCache,
  addItem,
  updateItem,
  removeItem,
  clearCache,
};