// services/pantryService.ts
import { PantryItem } from '../types';
import { analyzePantryImage } from './geminiService';
import { getItemImage, inferCategoryFromItemName, inferStorageLocationFromItemName, getAutoExpirationDate, parseItemText, fetchExternalItemImage, combineQuantities } from '../utils/appUtils';
import { validatePantryItem } from '../utils/validationUtils';
import AnalyticsService from './analyticsService';
import { canUseGemini } from './featureFlags';

export class PantryService {
  /**
   * Analyzes a pantry image and returns processed pantry items
   */
  static async analyzePantryImage(
    base64Data: string,
    mimeType: string,
    user?: { id: string; name: string; email: string; avatar?: string }
  ): Promise<PantryItem[]> {
    // Check if user has opted in to AI features
    if (!canUseGemini(user?.id)) {
      throw new Error('Please enable AI features in Settings to use image analysis.');
    }

    const items = await analyzePantryImage(base64Data, mimeType, user);
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
      } catch (error) {
        console.log('Failed to fetch external image for', description, error);
      }
    }

    return {
      ...item,
      item: description, // Use cleaned description
      quantity_estimate: quantity.toString(), // Use extracted quantity
      id: crypto.randomUUID(),
      image,
      storageLocation: inferStorageLocationFromItemName(description),
      expirationDate: getAutoExpirationDate(description, category),
      expirationType: 'best-by', // Default to best-by for auto-detected items
      dateAdded: now,
      lastRestocked: now,
      consumptionHistory: [now] // Add current date to consumption history
    };
  }

  /**
   * Creates a new pantry item manually
   */
  static createManualItem(
    itemName: string,
    quantity: number,
    existingInventory: PantryItem[]
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

    // If it's a placeholder, try to fetch an external image
    if (image === '/images/placeholder.svg') {
      try {
        const externalImage = fetchExternalItemImage(itemName);
        if (externalImage) {
          image = externalImage;
        }
      } catch (error) {
        console.log('Failed to fetch external image for', itemName, error);
      }
    }

    // Track pantry item addition
    AnalyticsService.trackPantryItemAdd(itemName, 'Manual', quantity, 'manual');

    return {
      id: crypto.randomUUID(),
      item: itemName.trim(),
      category: category,
      quantity_estimate: quantity.toString(), // Keep for backward compatibility
      quantity: { amount: quantity, unit: 'count' }, // New quantity system
      image,
      storageLocation: inferStorageLocationFromItemName(itemName),
      expirationDate: getAutoExpirationDate(itemName, category),
      expirationType: 'best-by', // Default to best-by for manual additions
      dateAdded: now,
      lastRestocked: now,
      consumptionHistory: [now] // Add current date to consumption history
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
      // Merge quantity with existing item
      const updated = [...existingInventory];
      const existingItem = updated[idx];
      const now = new Date().toISOString();

      if (existingItem.quantity) {
        // Use new quantity system - combine quantities
        const newQuantity = { amount: newItem.quantity.amount, unit: newItem.quantity.unit };
        const combined = combineQuantities(existingItem.quantity, newQuantity);
        updated[idx] = {
          ...existingItem,
          quantity: combined,
          lastRestocked: now
        };
      } else {
        // Fallback to old system for backward compatibility
        const prevQty = parseInt(existingItem.quantity_estimate) || 1;
        const newQty = newItem.quantity?.amount || 1;
        updated[idx].quantity_estimate = (prevQty + newQty).toString();
      }

      return updated;
    } else {
      // Add as new item
      return [...existingInventory, newItem];
    }
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
        return sorted.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
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
        return sorted.sort((a, b) => a.storageLocation.localeCompare(b.storageLocation));
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
      const key = groupBy === 'category' ? item.category : item.storageLocation;
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
    return indicesToMove.map(index => items[index]?.item).filter(Boolean);
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
    expirationType: string
  ): PantryItem[] {
    return inventory.map((item, index) => {
      if (indicesToUpdate.includes(index)) {
        return { ...item, expirationDate, expirationType };
      }
      return item;
    });
  }
}