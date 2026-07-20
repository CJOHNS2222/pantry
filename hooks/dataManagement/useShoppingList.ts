import { useState, useEffect, useRef } from 'react';
import DatabaseMonitoringService from '../../services/databaseMonitoringService';
import { User, Household, ShoppingItem } from '../../types';
import { hasArraysChanged } from '../../utils/comparisonUtils';
import { setRemoteShoppingListUpdate } from '../../services/syncStateService';
import { log } from '../../services/logService';
import { ShoppingListCacheService, CachedShoppingListData, ShoppingListCache } from '../../services/shoppingListCacheService';
import { GUEST_SHOPPING_KEY, GUEST_SHOPPING_CAP } from './shared';

type AddToast = (message: string, type: 'success' | 'error' | 'info' | 'warning', duration?: number, actionLabel?: string, action?: () => void) => void;

type LoggingOptions = {
  updateActivityStatus?: (activity: string) => void;
};

// Helper function for creating scoped listeners
function createShoppingListListener(
  user: User,
  household: Household | null,
  inHousehold: boolean,
  setShoppingList: (items: ShoppingItem[]) => void,
  setIsLoadingShoppingList: (loading: boolean) => void,
  prevShoppingListRef: React.MutableRefObject<ShoppingItem[]>
) {
  // Use user.householdId as fallback — household state may not be loaded yet when this runs
  const resolvedHouseholdId = inHousehold ? (household?.id || user.householdId) : undefined;
  if (inHousehold && resolvedHouseholdId) {
    const householdId = resolvedHouseholdId;
    const cachePath = `households/${householdId}/cache/shoppingList`;
    return DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.doc(cachePath), snap => {
      if (snap.exists()) {
        const data = snap.data() as ShoppingListCache;
        if (data.metadata && data.metadata.version === ShoppingListCacheService.CACHE_VERSION) {
          const items: ShoppingItem[] = [];
          for (const [itemId, itemArray] of Object.entries(data.items)) {
            items.push(ShoppingListCacheService.objectToShoppingItem(itemId, itemArray as CachedShoppingListData[string], householdId));
          }
          const sortedItems = items.sort((a, b) => a.item.localeCompare(b.item));
          if (hasArraysChanged(sortedItems, prevShoppingListRef.current)) {
            setRemoteShoppingListUpdate(true);
            setShoppingList(sortedItems);
            prevShoppingListRef.current = structuredClone(sortedItems);
          }
        }
      } else {
        setShoppingList([]);
      }
      setIsLoadingShoppingList(false);
    }, err => {
      if (err.code !== 'permission-denied') {
        log.error('Household shopping list cache listener failed', err, 'DataManagement');
      }
      setIsLoadingShoppingList(false);
    });
  } else {
    const userId = user.id;
    const cachePath = `users/${userId}/cache/shoppingList`;
    return DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.doc(cachePath), snap => {
      if (snap.exists()) {
        const data = snap.data() as ShoppingListCache;
        if (data.metadata && data.metadata.version === ShoppingListCacheService.CACHE_VERSION) {
          const items: ShoppingItem[] = [];
          for (const [itemId, itemArray] of Object.entries(data.items)) {
            items.push(ShoppingListCacheService.objectToShoppingItem(itemId, itemArray as CachedShoppingListData[string], undefined, userId));
          }
          const sortedItems = items.sort((a, b) => a.item.localeCompare(b.item));
          if (hasArraysChanged(sortedItems, prevShoppingListRef.current)) {
            setRemoteShoppingListUpdate(true);
            setShoppingList(sortedItems);
            prevShoppingListRef.current = structuredClone(sortedItems);
          }
        }
      } else {
        setShoppingList([]);
      }
      setIsLoadingShoppingList(false);
    }, err => {
      if (err.code !== 'permission-denied') {
        log.error('User shopping list cache listener failed', err, 'DataManagement');
      }
      setIsLoadingShoppingList(false);
    });
  }
}

/**
 * Shopping-list domain: list items + Firestore/guest sync.
 */
export function useShoppingList(
  user?: User | null,
  household?: Household | null,
  addToast?: AddToast,
  loggingOptions?: LoggingOptions,
) {
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [isLoadingShoppingList, setIsLoadingShoppingList] = useState(true);
  const prevShoppingListRef = useRef<ShoppingItem[]>([]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    // Guest users: hydrate state from localStorage instead of Firestore
    if (user.isGuest) {
      try {
        const shop = JSON.parse(localStorage.getItem(GUEST_SHOPPING_KEY) || '[]') as ShoppingItem[];
        setShoppingList(shop.sort((a, b) => a.item.localeCompare(b.item)));
      } catch {
        setShoppingList([]);
      }
      setIsLoadingShoppingList(false);
      return;
    }

    const inHousehold = !!user?.householdId;
    const unsub = createShoppingListListener(user, household ?? null, inHousehold, setShoppingList, setIsLoadingShoppingList, prevShoppingListRef);

    return () => {
      unsub();
    };
  }, [user?.id, user?.householdId]);

  const addShoppingListItem = async (item: Omit<ShoppingItem, 'id'>) => {
    if (!user?.id) return;
    const fullItem: ShoppingItem = { ...item, id: `shop-${Date.now()}`, addedAt: new Date() };
    if (user.isGuest) {
      let atCap = false;
      setShoppingList(prev => {
        if (prev.length >= GUEST_SHOPPING_CAP) { atCap = true; return prev; }
        const updated = [...prev, fullItem].sort((a, b) => a.item.localeCompare(b.item));
        try { localStorage.setItem(GUEST_SHOPPING_KEY, JSON.stringify(updated)); } catch { /* storage full */ }
        return updated;
      });
      if (atCap) {
        addToast?.(`Guest shopping list is full (${GUEST_SHOPPING_CAP} items). Sign in for unlimited items.`, 'warning');
      }
      return;
    }
    await ShoppingListCacheService.addItemToCache(fullItem, user?.householdId, user?.id);
    if (loggingOptions?.updateActivityStatus) {
      loggingOptions.updateActivityStatus('managing shopping list');
    }
  };

  const addShoppingListItems = async (items: Omit<ShoppingItem, 'id' | 'addedAt'>[]) => {
    if (!user?.id || !items.length) return;
    const itemsWithIds = items.map(item => ({ ...item, id: `shop-${Date.now()}-${Math.random()}`, addedAt: new Date() }));
    if (user.isGuest) {
      setShoppingList(prev => {
        const remaining = GUEST_SHOPPING_CAP - prev.length;
        if (remaining <= 0) return prev;
        const toAdd = itemsWithIds.slice(0, remaining);
        const updated = [...prev, ...toAdd].sort((a, b) => a.item.localeCompare(b.item));
        try { localStorage.setItem(GUEST_SHOPPING_KEY, JSON.stringify(updated)); } catch { /* storage full */ }
        return updated;
      });
      return;
    }
    await ShoppingListCacheService.addItemsToCache(itemsWithIds, user?.householdId, user?.id);
    if (loggingOptions?.updateActivityStatus) {
      loggingOptions.updateActivityStatus('managing shopping list');
    }
  };

  const updateShoppingListItem = async (itemId: string, updates: Partial<ShoppingItem>) => {
    if (!user?.id) return;
    if (user.isGuest) {
      setShoppingList(prev => {
        const updated = prev.map(item => item.id === itemId ? Object.assign({}, item, updates) : item).sort((a, b) => a.item.localeCompare(b.item));
        try { localStorage.setItem(GUEST_SHOPPING_KEY, JSON.stringify(updated)); } catch { /* storage full */ }
        return updated;
      });
      return;
    }
    await ShoppingListCacheService.updateItemsInCache([{ id: itemId, updates }], user?.householdId, user?.id);
  };

  const updateShoppingListItems = async (itemsToUpdate: { id: string, updates: Partial<ShoppingItem> }[]) => {
    if (!user?.id || !itemsToUpdate.length) return;
    if (user.isGuest) {
      setShoppingList(prev => {
        const updated = prev.map(item => {
          const change = itemsToUpdate.find(u => u.id === item.id);
          return change ? Object.assign({}, item, change.updates) : item;
        }).sort((a, b) => a.item.localeCompare(b.item));
        try { localStorage.setItem(GUEST_SHOPPING_KEY, JSON.stringify(updated)); } catch { /* storage full */ }
        return updated;
      });
      return;
    }
    await ShoppingListCacheService.updateItemsInCache(itemsToUpdate, user?.householdId, user?.id);
  };

  const removeShoppingListItem = async (itemId: string) => {
    if (!user?.id) return;
    if (user.isGuest) {
      setShoppingList(prev => {
        const updated = prev.filter(item => item.id !== itemId);
        try { localStorage.setItem(GUEST_SHOPPING_KEY, JSON.stringify(updated)); } catch { /* storage full */ }
        return updated;
      });
      return;
    }
    await ShoppingListCacheService.removeItemsFromCache([itemId], user?.householdId, user?.id);
  };

  const removeShoppingListItems = async (itemIds: string[]) => {
    if (!user?.id || !itemIds.length) return;
    if (user.isGuest) {
      setShoppingList(prev => {
        const updated = prev.filter(item => !itemIds.includes(item.id));
        try { localStorage.setItem(GUEST_SHOPPING_KEY, JSON.stringify(updated)); } catch { /* storage full */ }
        return updated;
      });
      return;
    }
    await ShoppingListCacheService.removeItemsFromCache(itemIds, user?.householdId, user?.id);
  };

  return {
    shoppingList,
    setShoppingList,
    isLoadingShoppingList,
    setIsLoadingShoppingList,
    addShoppingListItem,
    addShoppingListItems,
    updateShoppingListItem,
    updateShoppingListItems,
    removeShoppingListItem,
    removeShoppingListItems,
  };
}
