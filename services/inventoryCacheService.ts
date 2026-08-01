import { runTransaction, increment } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import DatabaseMonitoringService from './databaseMonitoringService';
import { PantryItem } from '../types';
import { log } from './logService';
import { getHouseholdOrUserCachePath } from './cachePathUtils';

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

// Keys in the cache document that are metadata, not itemId -> array entries.
const INVENTORY_META_KEYS = new Set(['lastUpdated', 'version', 'itemCount', '_foodWaste']);

/**
 * Service for caching inventory data in single documents for efficient bulk reads
 * Each item is stored as: itemId -> [category, imageUrl, name, quantity, location, ...]
 * Similar to how popular_recipes are cached, but for inventory items
 *
 * This cache document is the SOLE persistence layer for inventory (no per-item
 * documents exist anymore). Two invariants follow from that:
 *   1. A CACHE_VERSION bump must NEVER cause a reader to treat the document as
 *      "no data" - see the versioned migration path below (F06).
 *   2. Bulk rewrites must never blindly overwrite the whole document from one
 *      client's local state - see the field-scoped transactional writes below (F07).
 */
export class InventoryCacheService {
  // CACHE_VERSION 2 (F05): added consumptionHistory, tags, cooked_rice, leftoverMeta,
  // estimatedPrice, expiryDate, freezerZone, freezerLabelPhotoUrl, freezerPortionCount,
  // originalQuantity, and a full (non-collapsed) reservations array. This bump is safe
  // ONLY because the versioned migration path below (F06) was built first - see
  // parseCacheDocument/migrateCacheDocumentIfNeeded and VERSION_PARSERS.
  public static readonly CACHE_VERSION = 2;

  // Define the order of fields in the item array - MATCHING actual PantryItem fields.
  // IMPORTANT: only ever APPEND new fields to this list. Every existing index must
  // keep its meaning forever, because:
  //   - old documents may still contain shorter arrays (missing trailing indices),
  //     which arrayToPantryItem()/arrayToPantryItemV1() must keep tolerating, and
  //   - functions/src/dailyReminders.ts independently re-implements a read-only
  //     parser (parseInventoryItem) keyed to these same fixed indices; reordering
  //     anything here silently breaks that Cloud Function.
  private static readonly ITEM_FIELD_ORDER = [
    'category',
    'image', // Note: actual field is 'image', not 'imageUrl'
    'containerImage', // Optional secondary image (container photo)
    'item',  // Note: actual field is 'item', not 'name'
    'quantity_estimate', // Note: actual field is 'quantity_estimate', not 'quantity'
    'storageLocation', // Note: actual field is 'storageLocation', not 'location'
    'recipeId',
    'recipeName',
    'expirationDate',
    'expirationType',
    'dateAdded',
    'lastRestocked',
    'batches',
    'quantity',
    'notes',
    'isStaple',
    'isOpened',
    'openedAt',
    'openedExpiry',
    'visualLevel',
    'is_frozen',
    'frozenAt',
    'freezerExpiry',
    'is_immortal',
    'is_leftover',
    'productRiskLevel',
    'expiryAlertShown',
    // --- CACHE_VERSION 2 additions (F05) - appended, never inserted ---
    'reservationsJson', // full reservations array, JSON-encoded (supersedes the recipeId/recipeName singleton above)
    'consumptionHistory', // JSON-encoded string[]
    'tags', // JSON-encoded string[]
    'cooked_rice',
    'leftoverMeta', // JSON-encoded object
    'estimatedPrice',
    'expiryDate',
    'freezerZone',
    'freezerLabelPhotoUrl',
    'freezerPortionCount',
    'originalQuantity',
  ] as const;

  /**
   * Convert a PantryItem to an array for caching (current CACHE_VERSION layout).
   */
  private static pantryItemToArray(item: PantryItem): string[] {
    const computedExpirationDate = (() => {
      if (item.batches && item.batches.length > 0) {
        const batchExpiries = item.batches
          .map(b => b.expires)
          .filter((e): e is string => !!e)
          .sort();
        if (batchExpiries.length > 0) return batchExpiries[0];
      }
      return item.expirationDate || '';
    })();

    return [
      item.category || '',
      item.image || '', // image, not imageUrl
      item.containerImage || '',
      item.item || '',  // item, not name
      item.quantity_estimate || '', // quantity_estimate, not quantity
      item.storageLocation || '', // storageLocation, not location
      // Legacy singleton (kept for backward-compat readers); reservationsJson (index 27) is authoritative.
      (item.reservations && item.reservations.length > 0 ? item.reservations[0].recipeId : '') || '',
      (item.reservations && item.reservations.length > 0 ? item.reservations[0].recipeName : '') || '',
      computedExpirationDate,
      item.expirationType || '',
      item.dateAdded || '',
      item.lastRestocked || '',
      JSON.stringify(item.batches || []),
      JSON.stringify(item.quantity ?? null),
      item.notes || '',
      item.isStaple ? 'true' : 'false',
      item.isOpened ? 'true' : 'false',
      item.openedAt || '',
      item.openedExpiry || '',
      item.visualLevel || '',
      item.is_frozen ? 'true' : 'false',
      item.frozenAt || '',
      item.freezerExpiry || '',
      item.is_immortal ? 'true' : 'false',
      item.is_leftover ? 'true' : 'false',
      item.productRiskLevel !== undefined && item.productRiskLevel !== null ? String(item.productRiskLevel) : '',
      item.expiryAlertShown ? 'true' : 'false',
      // --- CACHE_VERSION 2 fields (F05) ---
      JSON.stringify(item.reservations ?? []), // 27: full reservations array - previously collapsed to one entry with quantity:0
      JSON.stringify(item.consumptionHistory ?? []), // 28
      JSON.stringify(item.tags ?? []), // 29
      item.cooked_rice ? 'true' : 'false', // 30
      item.leftoverMeta ? JSON.stringify(item.leftoverMeta) : '', // 31
      // No $2.50 fallback here - '' means "unknown", not "$2.50". Callers apply their own default when displaying.
      item.estimatedPrice !== undefined && item.estimatedPrice !== null ? String(item.estimatedPrice) : '', // 32
      item.expiryDate || '', // 33
      item.freezerZone || '', // 34
      item.freezerLabelPhotoUrl || '', // 35
      item.freezerPortionCount !== undefined && item.freezerPortionCount !== null ? String(item.freezerPortionCount) : '', // 36
      item.originalQuantity || '', // 37
    ];
  }

  /**
   * Convert an array back to a PantryItem, assuming the CURRENT (CACHE_VERSION 2)
   * array layout. Tolerant of shorter arrays (missing trailing indices parse as
   * undefined/false), which is what makes appending-only safe. Use
   * arrayToPantryItemV1() for arrays known to be CACHE_VERSION 1.
   */
  public static arrayToPantryItem(itemId: string, itemArray: string[]): PantryItem {
    // Reservations: v2 stores the FULL array in slot 27. Fall back to reconstructing
    // a single legacy reservation from slots 6/7 for defense-in-depth (normally a
    // version-1 doc is routed to arrayToPantryItemV1 instead, never here).
    let reservations: PantryItem['reservations'];
    const reservationsRaw = itemArray[27];
    if (reservationsRaw) {
      try {
        const parsed = JSON.parse(reservationsRaw);
        reservations = Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
      } catch {
        reservations = undefined;
      }
    }
    if (!reservations && (itemArray[6] || itemArray[7])) {
      reservations = [{ recipeId: itemArray[6] || '', recipeName: itemArray[7] || '', quantity: 0, unit: '' }];
    }

    let leftoverMeta: PantryItem['leftoverMeta'];
    if (itemArray[31]) {
      try {
        leftoverMeta = JSON.parse(itemArray[31]);
      } catch {
        leftoverMeta = undefined;
      }
    }

    const parseJsonStringArray = (raw: string | undefined): string[] | undefined => {
      if (!raw) return undefined;
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : undefined;
      } catch {
        return undefined;
      }
    };

    return {
      id: itemId,
      category: itemArray[0] || '',
      image: itemArray[1] || '', // image, not imageUrl
      containerImage: itemArray[2] || '',
      item: itemArray[3] || '',  // item, not name
      quantity_estimate: itemArray[4] || '', // quantity_estimate, not quantity
      storageLocation: itemArray[5] ? itemArray[5] as any : undefined, // storageLocation, not location
      reservations,
      expirationDate: itemArray[8] || '',
      expirationType: itemArray[9] ? itemArray[9] as any : undefined,
      dateAdded: itemArray[10] || '',
      lastRestocked: itemArray[11] || '',
      batches: (() => {
        if (!itemArray[12]) return [];
        try {
          return JSON.parse(itemArray[12]);
        } catch {
          return [];
        }
      })(),
      quantity: (() => {
        if (!itemArray[13]) return undefined;
        try {
          const parsed = JSON.parse(itemArray[13]);
          return parsed === null ? undefined : parsed;
        } catch {
          return undefined;
        }
      })(),
      notes: itemArray[14] || undefined,
      isStaple: itemArray[15] === 'true',
      isOpened: itemArray[16] === 'true',
      openedAt: itemArray[17] || undefined,
      openedExpiry: itemArray[18] || undefined,
      visualLevel: itemArray[19] ? itemArray[19] as any : undefined,
      is_frozen: itemArray[20] === 'true',
      frozenAt: itemArray[21] || undefined,
      freezerExpiry: itemArray[22] || undefined,
      is_immortal: itemArray[23] === 'true',
      is_leftover: itemArray[24] === 'true',
      productRiskLevel: itemArray[25] ? Number(itemArray[25]) : undefined,
      expiryAlertShown: itemArray[26] === 'true',
      // --- CACHE_VERSION 2 fields (F05) ---
      consumptionHistory: parseJsonStringArray(itemArray[28]),
      tags: parseJsonStringArray(itemArray[29]),
      cooked_rice: itemArray[30] === 'true',
      leftoverMeta,
      estimatedPrice: itemArray[32] ? Number(itemArray[32]) : undefined,
      expiryDate: itemArray[33] || undefined,
      freezerZone: itemArray[34] || undefined,
      freezerLabelPhotoUrl: itemArray[35] || undefined,
      freezerPortionCount: itemArray[36] ? Number(itemArray[36]) : undefined,
      originalQuantity: itemArray[37] || undefined,
    };
  }

  /**
   * Frozen historical parser for CACHE_VERSION 1 documents (pre-F05/F06). This must
   * NEVER be edited to match future changes to arrayToPantryItem() - its entire
   * purpose is to reproduce exactly what a v1 client would have read, so migration
   * from v1 is well-defined regardless of how the current parser evolves later.
   * Reservations legitimately collapse to a single quantity:0/unit:'' entry here -
   * that data was already lost before this document reaches migration; there is
   * nothing left to recover, only further loss to prevent going forward.
   */
  private static arrayToPantryItemV1(itemId: string, itemArray: string[]): PantryItem {
    return {
      id: itemId,
      category: itemArray[0] || '',
      image: itemArray[1] || '',
      containerImage: itemArray[2] || '',
      item: itemArray[3] || '',
      quantity_estimate: itemArray[4] || '',
      storageLocation: itemArray[5] ? itemArray[5] as any : undefined,
      reservations: itemArray[6] || itemArray[7] ? [{ recipeId: itemArray[6] || '', recipeName: itemArray[7] || '', quantity: 0, unit: '' }] : undefined,
      expirationDate: itemArray[8] || '',
      expirationType: itemArray[9] ? itemArray[9] as any : undefined,
      dateAdded: itemArray[10] || '',
      lastRestocked: itemArray[11] || '',
      batches: (() => {
        if (!itemArray[12]) return [];
        try {
          return JSON.parse(itemArray[12]);
        } catch {
          return [];
        }
      })(),
      quantity: (() => {
        if (!itemArray[13]) return undefined;
        try {
          const parsed = JSON.parse(itemArray[13]);
          return parsed === null ? undefined : parsed;
        } catch {
          return undefined;
        }
      })(),
      notes: itemArray[14] || undefined,
      isStaple: itemArray[15] === 'true',
      isOpened: itemArray[16] === 'true',
      openedAt: itemArray[17] || undefined,
      openedExpiry: itemArray[18] || undefined,
      visualLevel: itemArray[19] ? itemArray[19] as any : undefined,
      is_frozen: itemArray[20] === 'true',
      frozenAt: itemArray[21] || undefined,
      freezerExpiry: itemArray[22] || undefined,
      is_immortal: itemArray[23] === 'true',
      is_leftover: itemArray[24] === 'true',
      productRiskLevel: itemArray[25] ? Number(itemArray[25]) : undefined,
      expiryAlertShown: itemArray[26] === 'true'
    };
  }

  /**
   * Registry of per-version array parsers (F06). To add a future CACHE_VERSION N+1:
   *   1. Freeze the current arrayToPantryItem() body as arrayToPantryItemV{N}() (like
   *      arrayToPantryItemV1 above), matching what CACHE_VERSION N actually wrote.
   *   2. Route it from parseItemArrayForVersion below.
   *   3. Update arrayToPantryItem()/pantryItemToArray() to describe the new N+1 layout.
   *   4. Only then bump CACHE_VERSION.
   * Never skip step 1-2, or every document still at version N gets silently
   * misread (or dropped) the moment CACHE_VERSION moves past it.
   */
  private static parseItemArrayForVersion(storedVersion: number, itemId: string, itemArray: string[]): PantryItem {
    if (storedVersion <= 1) {
      return this.arrayToPantryItemV1(itemId, itemArray);
    }
    // storedVersion === CACHE_VERSION (or any other/newer value we don't
    // specifically recognize) - read with the current parser.
    return this.arrayToPantryItem(itemId, itemArray);
  }

  /**
   * Parse a raw cache document into PantryItems, honoring whatever CACHE_VERSION it
   * was actually written at (missing/non-numeric `version` defaults to 1, the
   * original unversioned layout - never treated as "no data").
   *
   * This is the single shared parsing path used by getCachedInventory(),
   * getCachedInventoryStrict(), and the useInventory.ts Firestore listener (F06),
   * so none of them can ever disagree about what a given document means.
   */
  public static parseCacheDocument(data: CachedInventoryData & CacheMetadata): { items: PantryItem[]; storedVersion: number } {
    const storedVersion = typeof data.version === 'number' ? data.version : 1;
    const items: PantryItem[] = [];
    for (const [itemId, itemArray] of Object.entries(data)) {
      if (INVENTORY_META_KEYS.has(itemId)) continue;
      if (Array.isArray(itemArray)) {
        items.push(this.parseItemArrayForVersion(storedVersion, itemId, itemArray as string[]));
      }
    }
    return { items, storedVersion };
  }

  /**
   * If a document was read at an older CACHE_VERSION than current, re-persist it at
   * the current version so it converges to the up-to-date layout and future reads
   * don't need to re-migrate. No-op when already current. Failure is logged but not
   * thrown - the caller already has correctly-parsed `items` in memory regardless
   * of whether the write-back succeeds.
   */
  public static async migrateCacheDocumentIfNeeded(items: PantryItem[], storedVersion: number, householdId?: string, userId?: string): Promise<void> {
    if (storedVersion >= this.CACHE_VERSION) return;
    try {
      await this.updateCache(items, householdId, userId);
    } catch (err) {
      log.warn('Failed to persist inventory cache migration', { err, storedVersion, targetVersion: this.CACHE_VERSION });
    }
  }

  /**
   * Get the cache document path for a household or user
   */
  private static getCachePath(householdId?: string, userId?: string): string {
    return getHouseholdOrUserCachePath('inventory', householdId, userId);
  }

  private static localInventoryCache: { path: string; items: PantryItem[] } | null = null;

  static setLocalInventoryCache(path: string, items: PantryItem[]) {
    this.localInventoryCache = { path, items };
  }

  /**
   * Get cached inventory data (1 read instead of N reads)
   */
  static async getCachedInventory(householdId?: string, userId?: string): Promise<PantryItem[]> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      if (this.localInventoryCache && this.localInventoryCache.path === cachePath) {
        return this.localInventoryCache.items;
      }
      const cacheRef = DatabaseMonitoringService.doc(cachePath);
      const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as CachedInventoryData & CacheMetadata;

        // F06: parse via the shared versioned reader - never discard a document just
        // because its version is stale. Migrate it in place instead.
        const { items, storedVersion } = this.parseCacheDocument(data);
        if (storedVersion < this.CACHE_VERSION) {
          await this.migrateCacheDocumentIfNeeded(items, storedVersion, householdId, userId);
        }

        return items;
      }

      // Cache doesn't exist - genuinely no data (distinct from a stale-version doc).
      return [];
    } catch (err: any) {
      // Don't log permission errors as they may be expected
      if (!err.message.includes('Missing or insufficient permissions')) {
        log.error("Error fetching cached inventory", { err });
      }
      return [];
    }
  }

  /**
   * Strict variant of getCachedInventory that rethrows on read failure instead of
   * swallowing it into `[]`. Used by the household-join migration path
   * (`householdMigrationService.ts`) where "read failed" must not be confused with
   * "user genuinely has zero items" - conflating the two strands the user's real
   * data and silently clears the migration retry checkpoint. Not intended for
   * general UI call sites; use `getCachedInventory` there.
   */
  static async getCachedInventoryStrict(householdId?: string, userId?: string): Promise<PantryItem[]> {
    const cachePath = this.getCachePath(householdId, userId);
    if (this.localInventoryCache && this.localInventoryCache.path === cachePath) {
      return this.localInventoryCache.items;
    }
    const cacheRef = DatabaseMonitoringService.doc(cachePath);
    const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as CachedInventoryData & CacheMetadata;

      // F06: same versioned parse-and-migrate path as getCachedInventory(), so the
      // "strict" and "lenient" readers can never disagree about what a stale-version
      // document contains.
      const { items, storedVersion } = this.parseCacheDocument(data);
      if (storedVersion < this.CACHE_VERSION) {
        await this.migrateCacheDocumentIfNeeded(items, storedVersion, householdId, userId);
      }
      return items;
    }

    return [];
  }

  /**
   * Load inventory from individual documents and cache it
   */
  private static async loadAndCacheInventory(_householdId?: string, _userId?: string): Promise<PantryItem[]> {
    // No longer loading from collections
    return [];
  }

  /**
   * Update the cached inventory document
   */
  static async updateCache(items: PantryItem[], householdId?: string, userId?: string, existingFoodWaste?: any): Promise<void> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);

      // Preserve the _foodWaste field if it exists to prevent setDoc from wiping it out
      let foodWaste = existingFoodWaste;
      if (foodWaste === undefined) {
        try {
          const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);
          if (docSnap.exists()) {
            foodWaste = docSnap.data()?._foodWaste;
          }
        } catch (readErr) {
          log.warn("Failed to read existing cache to preserve food waste analytics", { readErr });
        }
      }

      // Convert items to the cached format
      const cachedData: any = {
        lastUpdated: new Date(),
        version: this.CACHE_VERSION,
        itemCount: items.length,
      };

      if (foodWaste !== undefined) {
        cachedData._foodWaste = foodWaste;
      }

      // Add each item as itemId -> itemArray
      items.forEach(item => {
        cachedData[item.id] = this.pantryItemToArray(item);
      });

      await DatabaseMonitoringService.setDoc(cacheRef, cachedData);
    } catch (err: any) {
      log.error("Error updating inventory cache", { err });
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
      const updateData: any = {
          lastUpdated: new Date()
        };

      (updateData as any)[item.id] = this.pantryItemToArray(item);

      // Increment item count (we need to read current count first)
      const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as CachedInventoryData & CacheMetadata;
        (updateData as any).itemCount = (data.itemCount || 0) + 1;
        await DatabaseMonitoringService.updateDoc(cacheRef, updateData);
      } else {
        // Document doesn't exist, create it with setDoc
        (updateData as any).itemCount = 1;
        (updateData as any).version = this.CACHE_VERSION;
        await DatabaseMonitoringService.setDoc(cacheRef, updateData);
      }
    } catch (err: any) {
      log.error("Error adding item to cache", { err });
    }
  }

  /**
   * Add multiple items to the cache in a single field-scoped transaction
   * (1 transactional read+write for unlimited items).
   *
   * F07: previously read the whole doc, converted every entry back to a PantryItem,
   * appended the new items client-side, and setDoc'd the ENTIRE document back. Any
   * item a different household member added/edited in that window was silently
   * overwritten. This now only ever touches the fields for `items`' own ids, and
   * itemCount is derived with increment() inside the transaction rather than a
   * client-computed total, so concurrent writers can never clobber each other.
   */
  static async addItemsToCache(items: PantryItem[], householdId?: string, userId?: string): Promise<void> {
    if (items.length === 0) return;
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);

      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(cacheRef);
        const exists = snap.exists();
        const existingData = exists ? (snap.data() as CachedInventoryData & CacheMetadata) : undefined;

        const writeData: Record<string, any> = { lastUpdated: new Date() };
        let newCount = 0;
        items.forEach(item => {
          const alreadyPresent = !!existingData && Array.isArray((existingData as any)[item.id]);
          if (!alreadyPresent) newCount++;
          writeData[item.id] = this.pantryItemToArray(item);
        });

        if (exists) {
          writeData.itemCount = increment(newCount);
          transaction.update(cacheRef, writeData);
        } else {
          writeData.itemCount = newCount;
          writeData.version = this.CACHE_VERSION;
          transaction.set(cacheRef, writeData);
        }
      });
    } catch (err: any) {
      log.error("Error adding items to cache", { err });
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
      const updateData: any = {
        lastUpdated: new Date()
      };
      (updateData as any)[itemId] = updatedItemArray;

      await DatabaseMonitoringService.updateDoc(cacheRef, updateData);
    } catch (err: any) {
      log.error("Error updating item in cache", { err });
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
      const updateData: any = {
        lastUpdated: new Date()
      };
      (updateData as any)[itemId] = DatabaseMonitoringService.deleteField();

      // Decrement item count
      const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as CachedInventoryData & CacheMetadata;
        (updateData as any).itemCount = Math.max(0, (data.itemCount || 0) - 1);
      }

      await DatabaseMonitoringService.updateDoc(cacheRef, updateData);
    } catch (err: any) {
      log.error("Error removing item from cache", { err });
    }
  }

  /**
   * Bulk operation: apply a set of item updates/additions and/or deletions to the
   * cache in a single field-scoped transaction.
   *
   * F07: this used to take the caller's full "final inventory array" (the entire
   * local state after some operation) and setDoc the ENTIRE document with it -
   * silently discarding anything a concurrent household member had added or
   * changed in the meantime. It now only ever touches the fields for
   * `updatedItems` (items that were added/changed) and `deletedItemIds` (items
   * that were removed); any itemId this call doesn't mention is left completely
   * untouched, so a concurrent add/edit from another member survives.
   *
   * IMPORTANT: `updatedItems` must be the SUBSET of items that actually changed,
   * NOT the full post-operation inventory. Passing the full array would make it
   * impossible to distinguish "excluded because deleted" from "not present
   * because a different member added it after this client's last read" - see
   * callers in hooks/dataManagement/useInventory.ts (bulk delete) and
   * hooks/useDataManagement.ts (handleMarkAsMade recipe deduction).
   */
  static async bulkUpdateInventoryCache(
    updatedItems: PantryItem[],
    householdId?: string,
    userId?: string,
    deletedItemIds?: string[]
  ): Promise<void> {
    const idsToDelete = deletedItemIds || [];
    if (updatedItems.length === 0 && idsToDelete.length === 0) return;
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);

      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(cacheRef);
        const exists = snap.exists();
        const existingData = exists ? (snap.data() as CachedInventoryData & CacheMetadata) : undefined;

        const writeData: Record<string, any> = { lastUpdated: new Date() };
        let countDelta = 0;

        updatedItems.forEach(item => {
          const alreadyPresent = !!existingData && Array.isArray((existingData as any)[item.id]);
          if (!alreadyPresent) countDelta++;
          writeData[item.id] = this.pantryItemToArray(item);
        });

        idsToDelete.forEach(id => {
          const alreadyPresent = !!existingData && Array.isArray((existingData as any)[id]);
          if (alreadyPresent) countDelta--;
          writeData[id] = DatabaseMonitoringService.deleteField();
        });

        if (exists) {
          writeData.itemCount = increment(countDelta);
          transaction.update(cacheRef, writeData);
        } else {
          writeData.itemCount = Math.max(0, countDelta);
          writeData.version = this.CACHE_VERSION;
          transaction.set(cacheRef, writeData);
        }
      });
    } catch (err: any) {
      log.error("Error bulk updating inventory cache", { err });
    }
  }

  /**
   * Force refresh the cache by reloading from individual documents
   */
  static async refreshCache(householdId?: string, userId?: string): Promise<PantryItem[]> {
    // Force refreshing inventory cache
    return await this.loadAndCacheInventory(householdId, userId);
  }

  /**
   * Clear the cache (useful for debugging or forced refresh)
   */
  static async clearCache(householdId?: string, userId?: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);

      // Preserve the _foodWaste field if it exists to prevent setDoc from wiping it out
      let existingFoodWaste: any = undefined;
      try {
        const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);
        if (docSnap.exists()) {
          existingFoodWaste = docSnap.data()?._foodWaste;
        }
      } catch (readErr) {
        log.warn("Failed to read existing cache to preserve food waste analytics on clear", { readErr });
      }

      const cachedData: any = {
        lastUpdated: new Date(),
        version: this.CACHE_VERSION,
        itemCount: 0
      };

      if (existingFoodWaste !== undefined) {
        cachedData._foodWaste = existingFoodWaste;
      }

      await DatabaseMonitoringService.setDoc(cacheRef, cachedData);
      // Cleared inventory cache
    } catch (err: any) {
      log.error("Error clearing inventory cache", { err });
    }
  }
}
