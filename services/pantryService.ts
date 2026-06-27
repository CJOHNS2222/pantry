// services/pantryService.ts
import { PantryItem, User } from '../types';
import { analyzePantryImage, analyzeReceiptImage } from './geminiService';
import { getItemImage, inferCategoryFromItemName, inferStorageLocationFromItemName, getAutoExpirationDate, parseItemText, fetchExternalItemImage, combineQuantities, isImmortalItem, isCookedRiceItem } from '../utils/appUtils';
import { getQuantityAmount, getQuantityUnit } from '../utils/quantityUtils';
import { validatePantryItem } from '../utils/validationUtils';
import AnalyticsService from './analyticsService';
import { canUseGemini } from './featureFlags';
import { getFoodRiskLevel } from '../utils/foodRiskClassification';
import { log } from './logService';

export class PantryService {
  /**
   * Analyzes a pantry image and returns processed pantry items
   */
  static async analyzePantryImage(
    base64Data: string,
    mimeType: string,
    user?: Partial<User>
  ): Promise<PantryItem[]> {
    // Check if user has opted in to AI features
    log.debug('PantryService.analyzePantryImage: entry', {
      userId: user?.id ?? 'none',
      isGuest: user?.isGuest ?? false,
      imageSizeKB: Math.round(base64Data.length / 1024),
      mimeType,
      canUseGemini: canUseGemini(user?.id),
    }, 'PantryService');

    if (!canUseGemini(user?.id)) {
      throw new Error('Please enable AI features in Settings to use image analysis.');
    }

    const items = await analyzePantryImage(base64Data, mimeType, user as any);
    log.debug('PantryService.analyzePantryImage: Gemini returned items', { count: items.length }, 'PantryService');

    if (items.length === 0) {
      throw new Error('No items detected in the image.');
    }

    // Process items and fetch external images for placeholders
    const processedItems = await Promise.all(items.map(async (item) => {
      return this.processDetectedItem(item);
    }));

    // Track pantry scan results
    AnalyticsService.trackPantryScan(items.length, items.length);

    return processedItems as PantryItem[];
  }

  /**
   * Analyzes a receipt image and returns processed pantry items
   */
  static async analyzeReceiptImage(
    base64Data: string,
    mimeType: string,
    user?: Partial<User>
  ): Promise<PantryItem[]> {
    // Check if user has opted in to AI features
    if (!canUseGemini(user?.id)) {
      throw new Error('Please enable AI features in Settings to use receipt scanning.');
    }

    const items = await analyzeReceiptImage(base64Data, mimeType, user as any);
    if (items.length === 0) {
      throw new Error('No items detected in the receipt.');
    }

    // Process items and fetch external images for placeholders
    const processedItems = await Promise.all(items.map(async (item) => {
      return this.processDetectedItem(item);
    }));

    // Track receipt scan results
    AnalyticsService.trackPantryScan(items.length, items.length);

    return processedItems as PantryItem[];
  }

  /**
   * Processes a single detected item from image analysis
   */
  private static async processDetectedItem(item: any): Promise<Partial<PantryItem>> {
    // Parse the item text to extract quantity and clean description
    const { quantity, description } = parseItemText(item.item);
    const category = inferCategoryFromItemName(description);
    const now = new Date().toISOString();
    let image = getItemImage(description, category);

    // If it's a placeholder, try to fetch an external image
    if (image === '/images/placeholder.svg') {
      try {
        const externalImage = await fetchExternalItemImage(description);
        if (externalImage) {
          image = externalImage;
        }
      } catch (err: any) {
        log.warn('Failed to fetch external image for', { description, error: err }, 'PantryService');
      }
    }

    const storageLocation = item.storageLocation || inferStorageLocationFromItemName(description);
    const expirationDate = (() => {
      if (typeof item.estimatedExpiryDays === 'number' && item.estimatedExpiryDays >= 0) {
        const date = new Date();
        date.setDate(date.getDate() + item.estimatedExpiryDays);
        return date.toISOString().slice(0, 10);
      }
      return getAutoExpirationDate(description, category, storageLocation);
    })();

    return {
      ...item,
      item: description, // Use cleaned description
      quantity_estimate: quantity.toString(), // Use extracted quantity
      id: crypto.randomUUID(),
      image,
      storageLocation,
      expirationDate,
      expirationType: 'best-by', // Default to best-by for auto-detected items
      dateAdded: now,
      lastRestocked: now,
      consumptionHistory: [now] // Add current date to consumption history
      // Denormalized safety hints for item-level expiry logic
      ,tags: (() => {
        const t: string[] = [];
        if (isCookedRiceItem(description)) t.push('cooked-rice');
        return t.length ? t : undefined;
      })(),
      productRiskLevel: (() => {
        return getFoodRiskLevel(description, category);
      })(),
      cooked_rice: isCookedRiceItem(description) || undefined,
      is_immortal: isImmortalItem(description) || undefined
    };
  }

  /**
   * Creates a new pantry item manually
   */
  static createManualItem(
    itemName: string,
    quantity: number,
    existingInventory: PantryItem[],
    unit: string = 'count'
  ): PantryItem {
    // Validate input using centralized validation
    const validation = validatePantryItem(itemName, quantity);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // Check for duplicate items
    const existingItem = existingInventory.find(p =>
      p.item.toLowerCase() === itemName.toLowerCase()
    );

    if (existingItem) {
      throw new Error(`"${itemName}" already exists in your pantry.`);
    }

    // Prepare the new item data
    const category = inferCategoryFromItemName(itemName);
    const now = new Date().toISOString();

    // Try to get local image first
    let image = getItemImage(itemName, category);

    // If it's a placeholder, try to fetch an external image asynchronously
    if (image === '/images/placeholder.svg') {
      try {
        // fetchExternalItemImage returns a Promise; use then to avoid making this function async
        fetchExternalItemImage(itemName)
          .then(ext => {
            if (ext) image = ext;
          })
          .catch(e => log.debug('Failed to fetch external image for', itemName, e));
      } catch (err: any) {
        log.debug('Failed to fetch external image for', itemName, err);
      }
    }

    // Track pantry item addition
    AnalyticsService.trackPantryItemAdd(itemName, 'Manual', quantity, 'manual');

    // Create initial batch for this manual purchase
    const initialBatch = {
      batchId: crypto.randomUUID(),
      quantity,
      unit,
      expires: getAutoExpirationDate(itemName, category, inferStorageLocationFromItemName(itemName)),
      purchaseDate: now,
      note: ''
    };

    return {
      id: crypto.randomUUID(),
      item: itemName.trim(),
      category: category,
      quantity_estimate: quantity.toString(), // Keep for backward compatibility
      quantity: { amount: quantity, unit: unit }, // New quantity system
      batches: [initialBatch],
      image,
      storageLocation: inferStorageLocationFromItemName(itemName),
      expirationDate: getAutoExpirationDate(itemName, category, inferStorageLocationFromItemName(itemName)),
      expirationType: 'best-by', // Default to best-by for manual additions
      dateAdded: now,
      lastRestocked: now,
      consumptionHistory: [now], // Add current date to consumption history
      // Denormalized safety hints for item-level expiry logic
      tags: (() => {
        const t: string[] = [];
        if (isCookedRiceItem(itemName)) t.push('cooked-rice');
        if (isImmortalItem(itemName)) t.push('shelf-stable');
        return t.length ? t : undefined;
      })(),
      productRiskLevel: (() => {
        if (isCookedRiceItem(itemName)) return 4;
        return undefined;
      })(),
      is_immortal: isImmortalItem(itemName) || undefined,
      cooked_rice: isCookedRiceItem(itemName) || undefined
    };
  }

  /**
   * Merges a new item with existing inventory (handles duplicates)
   */
  static mergeItemWithInventory(
    newItem: PantryItem,
    existingInventory: PantryItem[]
  ): PantryItem[] {
    const idx = existingInventory.findIndex(p =>
      p.item.toLowerCase() === newItem.item.toLowerCase()
    );

    if (idx !== -1) {
      // Merge by appending purchase batch(s) to existing item (preserve separate expirations)
      const updated = [...existingInventory];
      const existingItem = { ...updated[idx] };
      const now = new Date().toISOString();

      // Ensure batches exist on the existing item
      if (!existingItem.batches) existingItem.batches = [];

      // Normalize incoming batches or create from newItem quantity/expiration
      const incomingBatches = newItem.batches && newItem.batches.length > 0
        ? newItem.batches
        : [{
            batchId: crypto.randomUUID(),
            quantity: getQuantityAmount(newItem.quantity ?? newItem.quantity_estimate),
            unit: getQuantityUnit(newItem.quantity ?? newItem.quantity_estimate),
            expires: newItem.expirationDate,
            purchaseDate: newItem.dateAdded || now,
            note: ''
          }];

      existingItem.batches = [...existingItem.batches, ...incomingBatches];

      // Update aggregate quantity where possible using combineQuantities helper
      if (existingItem.quantity && newItem.quantity) {
        try {
          // Cast to any to satisfy combineQuantities parameter expectations
          existingItem.quantity = combineQuantities(existingItem.quantity as any, newItem.quantity as any) as any;
        } catch (_err) {
          // If combineQuantities fails due to unit mismatch, leave quantity as-is
        }
      } else if (!existingItem.quantity) {
        // Try to compute a simple aggregate if all batches share the same unit
        const allUnits = new Set(existingItem.batches.map(b => b.unit || 'count'));
        if (allUnits.size === 1) {
          const unit = existingItem.batches[0].unit || 'count';
          const total = existingItem.batches.reduce((s, b) => s + (b.quantity || 0), 0);
          existingItem.quantity = { amount: total, unit };
        } else {
          // Fallback: preserve legacy estimate if present
          existingItem.quantity_estimate = (parseInt(existingItem.quantity_estimate || '0') + (parseInt(newItem.quantity_estimate || '0') || 0)).toString();
        }
      }

      existingItem.lastRestocked = now;
      updated[idx] = existingItem;
      return updated;
    } else {
      // Add as new item
      return [...existingInventory, newItem];
    }
  }

  /**
   * Append a batch to a single PantryItem and return the updated item
   */
  static addBatchToItem(item: PantryItem, batch: { quantity: number; unit?: string; expires?: string; purchaseDate?: string; note?: string }): PantryItem {
    const now = new Date().toISOString();
    const b = {
      batchId: crypto.randomUUID(),
      quantity: batch.quantity,
      unit: batch.unit || (typeof item.quantity === 'number' ? 'count' : (item.quantity as any)?.unit) || 'count',
      expires: batch.expires,
      purchaseDate: batch.purchaseDate || now,
      note: batch.note || ''
    };
    const updated = { ...item, batches: [...(item.batches || []), b], lastRestocked: now } as PantryItem;

    // Update aggregate quantity if applicable
    if (updated.quantity) {
      try {
        updated.quantity = combineQuantities(updated.quantity as any, { amount: b.quantity, unit: b.unit } as any) as any;
      } catch (_err) {
        // ignore unit mismatch
      }
    } else {
      // Try to compute aggregate if all batches share unit
      const allUnits = new Set((updated.batches || []).map(x => x.unit || 'count'));
      if (allUnits.size === 1) {
        const unit = (updated.batches && updated.batches[0]?.unit) || 'count';
        const total = updated.batches!.reduce((s, x) => s + (x.quantity || 0), 0);
        updated.quantity = { amount: total, unit };
      }
    }

    return updated;
  }

  static updateBatchOnItem(item: PantryItem, batchId: string, changes: Partial<{ quantity: number; expires?: string; note?: string }>): PantryItem {
    const updated = { ...item } as PantryItem;
    if (!updated.batches) return updated;
    updated.batches = updated.batches.map(b => b.batchId === batchId ? { ...b, ...changes } : b);

    // Recompute aggregate where possible
    const allUnits = new Set((updated.batches || []).map(x => x.unit || 'count'));
    if (allUnits.size === 1) {
      const unit = (updated.batches && updated.batches[0]?.unit) || 'count';
      const total = updated.batches!.reduce((s, x) => s + (x.quantity || 0), 0);
      updated.quantity = { amount: total, unit };
    }

    return updated;
  }

  static removeBatchFromItem(item: PantryItem, batchId: string): PantryItem {
    const updated = { ...item } as PantryItem;
    if (!updated.batches) return updated;
    updated.batches = updated.batches.filter(b => b.batchId !== batchId);

    // Recompute aggregate where possible
    if ((updated.batches || []).length === 0) {
      // Clear quantity or leave legacy estimate
      delete (updated as any).quantity;
    } else {
      const allUnits = new Set((updated.batches || []).map(x => x.unit || 'count'));
      if (allUnits.size === 1) {
        const unit = (updated.batches && updated.batches[0]?.unit) || 'count';
        const total = updated.batches!.reduce((s, x) => s + (x.quantity || 0), 0);
        updated.quantity = { amount: total, unit };
      }
    }

    return updated;
  }

  /**
   * Consume a quantity from an item using FEFO (first-expire-first-out) by default.
   * Returns updated item and record of consumed amounts per batch.
   */
  static consumeFromItem(item: PantryItem, amount: number, strategy: 'FEFO' | 'MANUAL' = 'FEFO', targetBatchId?: string): { updatedItem: PantryItem; consumed: Array<{ batchId?: string; amount: number }> } {
    const updated = { ...item } as PantryItem;
    const consumed: Array<{ batchId?: string; amount: number }> = [];
    let remaining = amount;

    if (!updated.batches || updated.batches.length === 0) {
      // Fallback to legacy quantity
      if (updated.quantity && typeof updated.quantity !== 'number' && 'amount' in updated.quantity) {
        updated.quantity.amount = Math.max(0, (updated.quantity.amount || 0) - remaining);
        consumed.push({ amount });
      }
      return { updatedItem: updated, consumed };
    }

    if (strategy === 'MANUAL' && targetBatchId) {
      updated.batches = updated.batches.map(b => {
        if (b.batchId !== targetBatchId) return b;
        const take = Math.min(b.quantity, remaining);
        remaining -= take;
        consumed.push({ batchId: b.batchId, amount: take });
        return { ...b, quantity: Math.max(0, b.quantity - take) };
      }).filter(b => b.quantity > 0);
    } else {
      // FEFO: sort batches by expires (earliest first, missing last)
      const sorted = [...updated.batches].sort((a, b) => {
        if (!a.expires && !b.expires) return 0;
        if (!a.expires) return 1;
        if (!b.expires) return -1;
        return new Date(a.expires).getTime() - new Date(b.expires).getTime();
      });

      for (const b of sorted) {
        if (remaining <= 0) break;
        const take = Math.min(b.quantity, remaining);
        remaining -= take;
        consumed.push({ batchId: b.batchId, amount: take });
        b.quantity = Math.max(0, b.quantity - take);
      }

      updated.batches = sorted.filter(b => b.quantity > 0);
    }

    // Recompute aggregate if units align
    const allUnits = new Set((updated.batches || []).map(x => x.unit || 'count'));
    if ((updated.batches || []).length === 0) {
      updated.quantity = undefined;
    } else if (allUnits.size === 1) {
      const unit = updated.batches![0].unit || 'count';
      const total = updated.batches!.reduce((s, x) => s + (x.quantity || 0), 0);
      updated.quantity = { amount: total, unit };
    }

    return { updatedItem: updated, consumed };
  }

  /**
   * Filters pantry items by category
   */
  static filterByCategory(items: PantryItem[], category: string): PantryItem[] {
    if (category === 'all') return items;
    return items.filter(item => item.category === category);
  }

  /**
   * Filters pantry items by storage location
   */
  static filterByStorageLocation(items: PantryItem[], location: string): PantryItem[] {
    if (location === 'all') return items;
    return items.filter(item => item.storageLocation === location);
  }

  /**
   * Sorts pantry items by various criteria
   */
  static sortItems(
    items: PantryItem[],
    sortBy: 'name' | 'lastAdded' | 'expiration' | 'category' | 'location'
  ): PantryItem[] {
    const sorted = [...items];

    switch (sortBy) {
      case 'name':
        return sorted.sort((a, b) => a.item.localeCompare(b.item));
      case 'lastAdded':
        return sorted.sort((a, b) => (b.dateAdded ? new Date(b.dateAdded).getTime() : 0) - (a.dateAdded ? new Date(a.dateAdded).getTime() : 0));
      case 'expiration':
        return sorted.sort((a, b) => {
          if (!a.expirationDate && !b.expirationDate) return 0;
          if (!a.expirationDate) return 1;
          if (!b.expirationDate) return -1;
          return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
        });
      case 'category':
        return sorted.sort((a, b) => a.category.localeCompare(b.category));
      case 'location':
        return sorted.sort((a, b) => (a.storageLocation || '').localeCompare(b.storageLocation || ''));
      default:
        return sorted;
    }
  }

  /**
   * Groups items by category or storage location
   */
  static groupItems(
    items: PantryItem[],
    groupBy: 'category' | 'storage'
  ): Record<string, PantryItem[]> {
    return items.reduce((groups, item) => {
      const key = groupBy === 'category' ? item.category : (item.storageLocation ?? 'unknown');
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {} as Record<string, PantryItem[]>);
  }

  /**
   * Bulk operations for pantry items
   */
  static bulkDeleteItems(inventory: PantryItem[], indicesToDelete: number[]): PantryItem[] {
    return inventory.filter((_, index) => !indicesToDelete.includes(index));
  }

  static bulkMoveToShoppingList(items: PantryItem[], indicesToMove: number[]): string[] {
    const mapped = indicesToMove.map(index => items[index]?.item);
    return mapped.filter((x): x is string => typeof x === 'string');
  }

  static bulkChangeLocation(
    inventory: PantryItem[],
    indicesToUpdate: number[],
    newLocation: string
  ): PantryItem[] {
    return inventory.map((item, index) => {
      if (indicesToUpdate.includes(index)) {
        return { ...item, storageLocation: newLocation };
      }
      return item;
    });
  }

  static bulkSetExpiration(
    inventory: PantryItem[],
    indicesToUpdate: number[],
    expirationDate: string,
    expirationType: 'use-by' | 'best-by' | undefined
  ): PantryItem[] {
    return inventory.map((item, index) => {
      if (indicesToUpdate.includes(index)) {
        return { ...item, expirationDate, expirationType };
      }
      return item;
    });
  }
}
