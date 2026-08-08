import { useCallback } from 'react';
import { User, Household, ShoppingItem, PantryItem, Batch } from '../types';
import { Tab } from '../types/app';
import PerformanceMonitoringService from '../services/performanceMonitoringService';
import { trackShoppingListAction } from '../services/sentryService';
import HapticService from '../services/hapticService';
import { getUserMeasurementSystem, convertIngredientString } from '../utils/measurementUtils';
import { parseIngredientForShoppingList, inferCategoryFromItemName, parseQuantityAndUnit, isHouseholdMember, getItemImage, inferStorageLocationFromItemName } from '../utils/appUtils';
import { groceryPriceService } from '../services/groceryPriceService';
import { ShoppingListCacheService } from '../services/shoppingListCacheService';
import { getQuantityAmount } from '../utils/quantityUtils';
import { log } from '../services/logService';

interface UsePantryShoppingActionsProps {
  user: User | null;
  household: Household | null;
  setShoppingList: React.Dispatch<React.SetStateAction<ShoppingItem[]>>;
  setActiveTab: (tab: Tab) => void;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  addItems: (items: PantryItem[]) => Promise<any>;
  removeShoppingListItems: (ids: string[]) => Promise<void>;
  syncNow: () => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', ttl?: number, actionLabel?: string, action?: () => void) => void;
}

export function usePantryShoppingActions({
  user,
  household,
  setShoppingList,
  setActiveTab,
  addItems,
  removeShoppingListItems,
  syncNow,
  addToast,
}: UsePantryShoppingActionsProps) {

  const addToShoppingList = useCallback(async (
    items: (string | { item: string; source: string; notes?: string })[],
    defaultSource: string = 'manual'
  ) => {
    PerformanceMonitoringService.mark('shopping_list_add_start');
    trackShoppingListAction('add_item', { count: items.length, source: defaultSource });
    HapticService.itemAdded();
    
    const inHousehold = household?.id && isHouseholdMember(household, user);
    const householdId = inHousehold ? household?.id : undefined;
    const userId = inHousehold ? undefined : user?.id;
    const measurementSystem = getUserMeasurementSystem(user?.profile);

    const pricePromises = items.map(async (inputItem) => {
      const itemStr = typeof inputItem === 'string' ? inputItem : inputItem.item;
      const itemSource = typeof inputItem === 'string' ? defaultSource : inputItem.source;
      const itemNotes = typeof inputItem === 'string' ? undefined : inputItem.notes;
      
      const convertedItemStr = convertIngredientString(itemStr, measurementSystem);
      const parsed = parseIngredientForShoppingList(convertedItemStr);
      const priceData = await groceryPriceService.getIngredientPrice(parsed.itemName).catch((error) => {
        log.warn('Failed to fetch ingredient price', { itemName: parsed.itemName, error }, 'App');
        return null;
      });
      
      let finalNotes = itemNotes || '';
      if (parsed.prepNotes) {
        finalNotes = finalNotes ? `${finalNotes} (${parsed.prepNotes})` : parsed.prepNotes;
      }

      return {
        parsed,
        source: itemSource,
        notes: finalNotes || undefined,
        estimatedPrice: priceData?.averagePrice || 0
      };
    });
    
    const priceResults = await Promise.all(pricePromises);
    const newItems: ShoppingItem[] = [];
    for (const { parsed, estimatedPrice, source: itemSource, notes: itemNotes } of priceResults) {
      const { amount, unit } = parseQuantityAndUnit(parsed.quantity, parsed.itemName);
      newItems.push({
        id: Math.random().toString(36).substr(2, 9),
        item: parsed.itemName,
        quantity: amount === 1 && (unit === 'pcs' || unit === 'pieces') ? '1' : `${amount} ${unit}`,
        amount,
        unit,
        category: inferCategoryFromItemName(parsed.itemName),
        checked: false,
        source: itemSource,
        notes: itemNotes,
        addedAt: new Date(),
        estimatedPrice
      });
    }
    
    setShoppingList((prev: ShoppingItem[]) => [...prev, ...newItems]);
    await ShoppingListCacheService.addItemsToCache(newItems, householdId, userId);
    setActiveTab(Tab.SHOPPING);
    
    PerformanceMonitoringService.mark('shopping_list_add_end');
    PerformanceMonitoringService.measure('shopping_list_add', 'shopping_list_add_start', 'shopping_list_add_end');
  }, [household, user, setShoppingList, setActiveTab]);

  const handleMoveToPantry = useCallback(async (items: ShoppingItem[]) => {
    const processedItems = await Promise.all(items.map(async (i) => {
      const category = inferCategoryFromItemName(i.item);
      const image = getItemImage(i.item, category);

      let addQty = getQuantityAmount(i.purchasedQuantity ?? i.quantity ?? i.purchasedBatch ?? 1);
      if (addQty < 1) addQty = 1;

      const reservations: { recipeId: string; recipeName: string; quantity: number; unit: string }[] = [];
      if (i.source && i.source.startsWith('recipe: need ')) {
        const match = i.source.match(/recipe: need (.+?) for "(.+?)"/);
        if (match) {
          const qtyStr = match[1];
          const recipeName = match[2];
          const qtyMatch = qtyStr.match(/(\d+(?:\.\d+)?)\s*(.+)/);
          if (qtyMatch) {
            const quantity = parseFloat(qtyMatch[1]);
            const unit = qtyMatch[2];
            reservations.push({
              recipeId: `recipe_${recipeName.replace(/\s+/g, '_').toLowerCase()}`,
              recipeName,
              quantity,
              unit
            });
          }
        }
      }

      const batches: Batch[] = [];
      const nowIso = new Date().toISOString();

      if (i.purchasedBatch) {
        batches.push({
          batchId: Math.random().toString(36).substr(2, 9),
          quantity: Math.abs(i.purchasedBatch.amount) || Math.abs(addQty),
          unit: i.purchasedBatch.unit || (i.purchasedQuantity?.unit ?? undefined),
          expires: i.purchasedBatch.expires,
          purchaseDate: nowIso,
          note: i.purchasedBatch.note || i.notes || (i.source && i.source.startsWith('recipe:') ? i.source : undefined)
        });
      } else if (i.purchasedQuantity) {
        batches.push({
          batchId: Math.random().toString(36).substr(2, 9),
          quantity: Math.abs(i.purchasedQuantity.amount) || Math.abs(addQty),
          unit: i.purchasedQuantity.unit || undefined,
          purchaseDate: nowIso,
          note: i.notes || (i.source && i.source.startsWith('recipe:') ? i.source : undefined)
        });
      } else {
        const qStr = typeof i.quantity === 'string' ? i.quantity.trim() : '';
        const unitMatch = qStr.match(/^\d+(?:[./]\d+)?(?:\.\d+)?\s+(\S+)/);
        const fallbackUnit = unitMatch?.[1] ?? undefined;
        batches.push({
          batchId: Math.random().toString(36).substr(2, 9),
          quantity: Math.abs(addQty),
          unit: fallbackUnit,
          purchaseDate: nowIso,
          note: i.notes || (i.source && i.source.startsWith('recipe:') ? i.source : undefined)
        });
      }

      return {
        id: Math.random().toString(36).substr(2, 9),
        item: i.item,
        category,
        quantity_estimate: Math.abs(addQty).toString(),
        storageLocation: inferStorageLocationFromItemName(i.item),
        image,
        originalQuantity: i.purchasedQuantity ? `${i.purchasedQuantity.amount} ${i.purchasedQuantity.unit}` : (typeof i.quantity === 'string' ? i.quantity : undefined),
        reservations,
        batches,
        dateAdded: nowIso,
        lastRestocked: nowIso,
        notes: i.notes || (i.source && i.source.startsWith('recipe:') ? i.source : undefined)
      };
    }));

    const addedItems = await addItems(processedItems);

    setShoppingList(prev => prev.filter(item => !items.find(moved => moved.id === item.id)));
    await removeShoppingListItems(items.map(i => i.id));

    setTimeout(() => {
      syncNow();
    }, 100);

    addToast(
      `Added ${items.length} item${items.length > 1 ? 's' : ''} to pantry. Edit quantities?`,
      'info',
      8000,
      'Edit Quantities',
      () => {
        localStorage.setItem('pendingQuantityEdits', JSON.stringify(addedItems));
        setActiveTab(Tab.PANTRY);
      }
    );
  }, [addItems, setShoppingList, removeShoppingListItems, syncNow, addToast, setActiveTab]);

  return {
    addToShoppingList,
    handleMoveToPantry,
  };
}
