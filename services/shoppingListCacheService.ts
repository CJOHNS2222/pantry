import DatabaseMonitoringService from './databaseMonitoringService';
import { increment, deleteField } from 'firebase/firestore';
import { ShoppingItem } from '../types';
import { log } from './logService';
import { getHouseholdOrUserCachePath } from './cachePathUtils';

export interface CachedShoppingListData {
  [itemId: string]: {
    item: string;
    quantity?: string;
    category?: string;
    source?: string;
    addedAt?: string; // ISO string
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

export interface ShoppingListCacheMetadata {
    lastUpdated: Date;
    version: number;
    totalItems: number;
}

export interface ShoppingListCache {
  metadata: ShoppingListCacheMetadata;
  items: CachedShoppingListData;
}

const CACHE_VERSION = 3; // Version bump due to schema change (removed addedAt)

const getCachePath = (householdId?: string, userId?: string): string =>
  getHouseholdOrUserCachePath('shoppingList', householdId, userId);

const shoppingItemToObject = (item: ShoppingItem): CachedShoppingListData[string] => {
  const obj: any = {
    item: item.item,
    quantity: item.quantity,
    category: item.category,
    source: item.source,
  };
  if (item.amount !== undefined) obj.amount = item.amount;
  if (item.unit !== undefined) obj.unit = item.unit;
  if (item.estimatedPrice !== undefined) obj.estimatedPrice = item.estimatedPrice;
  if (item.priceData) {
    obj.priceData = {
      ...item.priceData,
      lastUpdated: item.priceData.lastUpdated instanceof Date ? item.priceData.lastUpdated.toISOString() : new Date().toISOString(),
    };
  }
  if (item.assignedTo) obj.assignedTo = item.assignedTo;
  if (item.notes) obj.notes = item.notes;
  if (item.addedAt) {
    obj.addedAt = item.addedAt instanceof Date ? item.addedAt.toISOString() : new Date(item.addedAt).toISOString();
  }
  return obj;
};

/**
 * Cache versions whose `items` map `objectToShoppingItem` can still read.
 *
 * The v2.1 → 3 bump only dropped the `addedAt` field from newly-written items;
 * it did not change the shape of anything else. `objectToShoppingItem` treats
 * every field it reads as optional (`addedAt` falls back to `new Date()`,
 * `unit`/`category` to `''`), so a v2.1 doc deserializes correctly today.
 *
 * Readers previously gated on `version === CACHE_VERSION` with no `else`, which
 * silently rendered an empty list for anyone still on 2.1 — no error, no log —
 * while `addItemToCache` kept appending to the doc via field-level `updateDoc`
 * (which never restamps `metadata.version`). Writes accumulated into a document
 * the reader would never accept. Accept the older version for reading and let
 * `migrateCacheVersion` restamp it.
 */
const READABLE_CACHE_VERSIONS: readonly (number | string)[] = [CACHE_VERSION, 2.1, '2.1'];

const isReadableCacheVersion = (version: unknown): boolean =>
  version !== undefined && version !== null && READABLE_CACHE_VERSIONS.includes(version as number | string);

/**
 * Restamps a legacy-but-readable cache doc to the current version. Metadata-only:
 * the items are already in a readable shape, so nothing is rewritten or dropped.
 * Best-effort — a failure here must never block rendering, since the caller has
 * already successfully deserialized the items it is about to display.
 */
const migrateCacheVersion = async (householdId?: string, userId?: string): Promise<void> => {
  try {
    const cacheRef = DatabaseMonitoringService.doc(getCachePath(householdId, userId));
    await DatabaseMonitoringService.updateDoc(cacheRef, {
      'metadata.version': CACHE_VERSION,
      'metadata.lastUpdated': new Date(),
    });
    log.info('Migrated shopping list cache to current version', { to: CACHE_VERSION });
  } catch (err: any) {
    log.warn('Failed to migrate shopping list cache version', { err });
  }
};

const objectToShoppingItem = (itemId: string, itemObject: CachedShoppingListData[string], _householdId?: string, _userId?: string): ShoppingItem => {
  const priceData = itemObject.priceData ? {
    ...itemObject.priceData,
    lastUpdated: new Date(itemObject.priceData.lastUpdated)
  } : undefined;

  return {
    id: itemId,
    item: itemObject.item,
    quantity: itemObject.quantity,
    amount: (itemObject as any).amount,
    unit: (itemObject as any).unit || '',
    category: itemObject.category || '',
    checked: false,
    source: itemObject.source,
    addedAt: itemObject.addedAt ? new Date(itemObject.addedAt) : new Date(),
    estimatedPrice: itemObject.estimatedPrice,
    completedAt: undefined,
    priceData,
    assignedTo: (itemObject as any).assignedTo,
    notes: (itemObject as any).notes,
  };
};

const getCachedShoppingList = async (householdId?: string, userId?: string): Promise<ShoppingItem[]> => {
  try {
    const cachePath = getCachePath(householdId, userId);
    const cacheRef = DatabaseMonitoringService.doc(cachePath);
    const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);

    if (docSnap && docSnap.exists && (typeof (docSnap as any).exists === 'function' ? (docSnap as any).exists() : (docSnap as any).exists)) {
      const data = (docSnap as any).data() as ShoppingListCache;
      if (data.metadata && isReadableCacheVersion(data.metadata.version)) {
        const items: ShoppingItem[] = Object.entries(data.items).map(([itemId, itemObject]) =>
          objectToShoppingItem(itemId, itemObject as CachedShoppingListData[string], householdId, userId)
        );
        if (data.metadata.version !== CACHE_VERSION) {
          void migrateCacheVersion(householdId, userId);
        }
        // Sort alphabetically as addedAt is no longer reliable
        return items.sort((a, b) => a.item.localeCompare(b.item));
      }
      // Unknown/newer version — surface it rather than silently returning empty.
      log.warn('Shopping list cache version not readable; returning empty list', {
        found: data.metadata?.version,
        expected: CACHE_VERSION,
      });
    }

    // No valid shopping list cache found
    return [];
  } catch (err: any) {
    if (!err.message.includes('Missing or insufficient permissions')) {
      log.error('Failed to load shopping list cache', { err });
    }
    return [];
  }
};

/**
 * Strict variant of getCachedShoppingList that rethrows on read failure instead of
 * swallowing it into `[]`. Used by the household-join migration path
 * (`householdMigrationService.ts`) so a transient read error isn't mistaken for
 * "user has no shopping list items", which would silently clear the migration
 * retry checkpoint while real data is left behind. Not intended for general UI
 * call sites; use `getCachedShoppingList` there.
 */
const getCachedShoppingListStrict = async (householdId?: string, userId?: string): Promise<ShoppingItem[]> => {
  const cachePath = getCachePath(householdId, userId);
  const cacheRef = DatabaseMonitoringService.doc(cachePath);
  const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);

  if (docSnap && docSnap.exists && (typeof (docSnap as any).exists === 'function' ? (docSnap as any).exists() : (docSnap as any).exists)) {
    const data = (docSnap as any).data() as ShoppingListCache;
    if (data.metadata && data.metadata.version === CACHE_VERSION) {
      const items: ShoppingItem[] = Object.entries(data.items).map(([itemId, itemObject]) =>
        objectToShoppingItem(itemId, itemObject as CachedShoppingListData[string], householdId, userId)
      );
      return items.sort((a, b) => a.item.localeCompare(b.item));
    }
  }

  return [];
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
    // Set shopping list cache with items using v2.1 format
  } catch (err: any) {
    log.error('Failed to set shopping list cache', { err });
  }
};

const addItemToCache = async (item: ShoppingItem, householdId?: string, userId?: string): Promise<void> => {
  const cachePath = getCachePath(householdId, userId);
  const cacheRef = DatabaseMonitoringService.doc(cachePath);
  try {
    await DatabaseMonitoringService.updateDoc(cacheRef, {
      [`items.${item.id}`]: shoppingItemToObject(item),
      'metadata.lastUpdated': new Date(),
      'metadata.totalItems': increment(1)
    });
    // Added shopping list item to cache
  } catch(e: any) {
      if (e.code === 'not-found' || e.message.includes('No document to update')) {
          // Cache document not found. Creating a new one.
          await setCache([item], householdId, userId);
      } else {
          log.error('Failed to add shopping list item', { e });
          throw e;
      }
  }
};

const addItemsToCache = async (items: ShoppingItem[], householdId?: string, userId?: string): Promise<void> => {
  const cachePath = getCachePath(householdId, userId);
  const cacheRef = DatabaseMonitoringService.doc(cachePath);
  const newItemsObject = items.reduce((acc, item) => {
    acc[item.id] = shoppingItemToObject(item);
    return acc;
  }, {} as CachedShoppingListData);

  try {
    await DatabaseMonitoringService.updateDoc(cacheRef, {
      ...Object.keys(newItemsObject).reduce((acc, key) => ({ ...acc, [`items.${key}`]: newItemsObject[key] }), {}),
      'metadata.lastUpdated': new Date(),
      'metadata.totalItems': increment(items.length),
    });
    // Added shopping list items to cache
  } catch(e: any) {
    if (e.code === 'not-found' || e.message.includes('No document to update')) {
        // Cache document not found. Creating a new one.
        await setCache(items, householdId, userId);
    } else {
        log.error('Failed to add shopping list items', { e });
        throw e;
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
    // Updated shopping list item in cache
  } catch (err: any) {
    log.error('Failed to update shopping list item in cache', { err });
  }
};

const updateItemsInCache = async (itemsToUpdate: { id: string, updates: Partial<ShoppingItem> }[], householdId?: string, userId?: string): Promise<void> => {
  const cachePath = getCachePath(householdId, userId);
  const cacheRef = DatabaseMonitoringService.doc(cachePath);
  const updateData: { [key: string]: any } = {
    'metadata.lastUpdated': new Date(),
  };
  
  itemsToUpdate.forEach(({ id, updates }) => {
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'addedAt') continue;
      if (value instanceof Date) {
        updateData[`items.${id}.${key}`] = value.toISOString();
      } else {
        updateData[`items.${id}.${key}`] = value;
      }
    }
  });

  try {
    await DatabaseMonitoringService.updateDoc(cacheRef, updateData);
    // Updated shopping list items in cache
  } catch(e: any) {
    log.error('Failed to update shopping list items', { e });
  }
};

const removeItem = async (itemId: string, householdId?: string, userId?: string): Promise<void> => {
  const cachePath = getCachePath(householdId, userId);
  const cacheRef = DatabaseMonitoringService.doc(cachePath);
  try {
    await DatabaseMonitoringService.updateDoc(cacheRef, {
      [`items.${itemId}`]: deleteField(),
      'metadata.lastUpdated': new Date(),
      'metadata.totalItems': increment(-1)
    });
    // Removed shopping list item from cache
  } catch (err: any) {
    log.error('Failed to remove shopping list item from cache', { err });
  }
};

const removeItemsFromCache = async (itemIds: string[], householdId?: string, userId?: string): Promise<void> => {
  const cachePath = getCachePath(householdId, userId);
  const cacheRef = DatabaseMonitoringService.doc(cachePath);
  const updateData: { [key: string]: any } = {
    'metadata.lastUpdated': new Date(),
    'metadata.totalItems': increment(-itemIds.length),
  };
  itemIds.forEach(id => {
    updateData[`items.${id}`] = deleteField();
  });

  try {
    await DatabaseMonitoringService.updateDoc(cacheRef, updateData);
    // Removed shopping list items from cache
  } catch(e: any) {
    log.error('Failed to remove shopping list items', { e });
  }
};

const clearCache = async (householdId?: string, userId?: string): Promise<void> => {
  try {
    const cachePath = getCachePath(householdId, userId);
    const cacheRef = DatabaseMonitoringService.doc(cachePath);
    await DatabaseMonitoringService.deleteDoc(cacheRef);
    // Cleared shopping list cache
  } catch (err: any) {
    log.error('Failed to clear shopping list cache', { err });
  }
};

export const ShoppingListCacheService = {
  CACHE_VERSION,
  isReadableCacheVersion,
  migrateCacheVersion,
  objectToShoppingItem,
  getCachedShoppingList,
  getCachedShoppingListStrict,
  setCache,
  addItemToCache,
  addItemsToCache,
  updateItem,
  updateItemsInCache,
  removeItem,
  removeItemsFromCache,
  clearCache,
};