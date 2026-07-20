import { useState, useEffect, useRef, useCallback } from 'react';
import DatabaseMonitoringService from '../../services/databaseMonitoringService';
import { User, PantryItem, Settings } from '../../types';
import { hasPantryItemsChanged } from '../../utils/comparisonUtils';
import { setRemoteInventoryUpdate } from '../../services/syncStateService';
import { log } from '../../services/logService';
import { generateRecipeSuggestions, shouldShowExpiryAlert } from '../../utils/appUtils';
import { offlineQueue } from '../../services/offlineQueueService';
import { undoService, UndoAction } from '../../services/undoService';
import { NotificationService } from '../../services/notificationService';
import { pruneNotificationsForDeletedItems } from '../../services/notificationsService';
import { auth } from '../../firebaseConfig';
import { InventoryCacheService, CachedInventoryData, CacheMetadata } from '../../services/inventoryCacheService';
import HapticService from '../../services/hapticService';
import FoodWasteAnalyticsService from '../../services/foodWasteAnalyticsService';
import { GUEST_INVENTORY_KEY, GUEST_ITEM_CAP, getQuantityValue } from './shared';
import { useExpirationAlerts } from './useExpirationAlerts';
import { useFoodWaste } from './useFoodWaste';

type AddToast = (message: string, type: 'success' | 'error' | 'info' | 'warning', duration?: number, actionLabel?: string, action?: () => void) => void;

type LoggingOptions = {
  logItemAdded?: (item: string, itemId: string) => void;
  logItemRemoved?: (item: string, itemId: string) => void;
  updateActivityStatus?: (activity: string) => void;
};

type InventoryOptions = {
  disableInventoryListeners?: boolean;
  settings?: Settings;
};

/**
 * Inventory domain: pantry items, undo/redo, offline-queue flush, and the
 * memoized expiration/food-waste derived data.
 */
export function useInventory(
  user?: User | null,
  addToast?: AddToast,
  addToShoppingList?: (items: string[]) => void,
  loggingOptions?: LoggingOptions,
  options?: InventoryOptions,
) {
  const [inventory, setInventory] = useState<PantryItem[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);
  const [recentActions, setRecentActions] = useState<UndoAction[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Ref to hold latest inventory for closure-safe comparisons inside Firestore listeners
  const inventoryRef = useRef<PantryItem[]>([]);
  const initialDataLoadedRef = useRef(false);

  // Ref to hold latest addToast function to avoid useEffect dependency issues
  const addToastRef = useRef(addToast);
  useEffect(() => {
    addToastRef.current = addToast;
  }, [addToast]);

  // Keep inventoryRef current so Firestore listeners can do stale-closure-safe comparisons
  useEffect(() => {
    inventoryRef.current = inventory;
  }, [inventory]);

  // Load recent actions from IndexedDB on user change
  useEffect(() => {
    if (!user?.id || user.isGuest) {
      setRecentActions([]);
      return;
    }

    undoService.getRecentActions(user.id)
      .then(actions => {
        setRecentActions(actions);
      })
      .catch(err => {
        log.error('Failed to load recent actions:', err, 'DataManagement');
      });
  }, [user?.id, user?.isGuest]);

  // Firestore synchronization
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    // Guest users: hydrate state from localStorage instead of Firestore
    if (user.isGuest) {
      try {
        const inv = JSON.parse(localStorage.getItem(GUEST_INVENTORY_KEY) || '[]') as PantryItem[];
        setInventory(inv);
      } catch {
        setInventory([]);
      }
      setIsLoadingInventory(false);
      return;
    }

    const unsubs: (() => void)[] = [];
    const inHousehold = !!user?.householdId;

    if (!options?.disableInventoryListeners) {
      const inventoryPath = inHousehold ? `households/${user.householdId}/cache/inventory` : `users/${user.id}/cache/inventory`;

      unsubs.push(DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.doc(inventoryPath), snap => {
        if (snap.exists()) {
          const data = snap.data() as CachedInventoryData & CacheMetadata;
          if (data.version === InventoryCacheService.CACHE_VERSION) {
            const items: PantryItem[] = [];
            for (const itemId in data) {
              // Skip metadata and the embedded food waste counters field
              if (itemId === 'lastUpdated' || itemId === 'version' || itemId === 'itemCount' || itemId === '_foodWaste') {
                continue;
              }
              const item = InventoryCacheService.arrayToPantryItem(itemId, data[itemId] as string[]);
              items.push(item);
            }
            InventoryCacheService.setLocalInventoryCache(inventoryPath, items);
            if (hasPantryItemsChanged(items, inventoryRef.current)) {
              setRemoteInventoryUpdate(true);
              setInventory(items);
            }
          }
        } else {
          InventoryCacheService.setLocalInventoryCache(inventoryPath, []);
          setInventory([]);
        }
        setIsLoadingInventory(false);
        initialDataLoadedRef.current = true;
      }, err => {
        if (err.code !== 'permission-denied') {
            log.error('Failed to update inventory cache', err, 'useDataManagement');
        }
        setIsLoadingInventory(false);
      }));
    }

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [user?.id, user?.householdId]);

  useEffect(() => {
    if (!inventory.length || !user?.id || user.isGuest) return;

    const todayString = new Date().toISOString().slice(0, 10);
    const lastCheckDate = localStorage.getItem('lastExpirationCheckDate');

    // Only run expiration checks once per calendar day, or if it's never been checked
    if (lastCheckDate !== todayString) {
      const runExpirationChecks = async () => {
        // Ensure the currently authenticated user matches the `user` passed
        // into this hook. If they don't match (or auth not ready), bail WITHOUT
        // stamping the throttle timestamp — this allows the next render to retry
        // rather than silently losing the check for up to 5 minutes.
        if (!auth?.currentUser || auth.currentUser.uid !== user.id) {
          log.warn('Skipping expiration notifications: auth user mismatch', { expectedUid: user.id, actualUid: auth?.currentUser?.uid }, 'DataManagement');
          return;
        }

        const itemsExpiringSoon = inventory.filter(item => {
          // Never notify or create alerts for immortal items
          if (item.is_immortal) return false;
          if (!item.expirationDate) return false;
          const daysUntilExpiry = Math.ceil((new Date(item.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          // Include expired items (daysUntilExpiry <= 0) and items expiring within 7 days
          return daysUntilExpiry <= 7;
        });

        // Build danger-list for aggregation: prioritize items expiring within 3 days (including expired)
        const dangerCandidates = itemsExpiringSoon.map(item => {
          const daysUntilExpiry = Math.ceil((new Date(item.expirationDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          return { itemId: item.id, itemName: item.item, daysUntilExpiry, risk_level: item.productRiskLevel };
        }).filter(x => x.daysUntilExpiry <= 3).slice(0, 6);

        try {
          if (dangerCandidates.length >= 2) {
            // Create a single aggregated Danger Zone notification

            await NotificationService.createDangerZoneAlert(user.id, dangerCandidates as Parameters<typeof NotificationService.createDangerZoneAlert>[1]);
          } else {
            // Fetch once and reuse for all items to avoid redundant Firestore queries
            const cachedNotifications = await NotificationService.getUnreadNotifications(user.id);
            // Fallback to individual notifications for up to 3 items
            await Promise.all(itemsExpiringSoon.slice(0, 3).map(item => {
              const daysUntilExpiry = Math.ceil((new Date(item.expirationDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
              return NotificationService.createExpirationAlert(user.id, item.item, daysUntilExpiry, item.id, user?.profile?.riskLevel, item.category, cachedNotifications);
            }));
          }
        } catch (err) {
          log.error('Failed to create expiration notifications', err, 'DataManagement');
        } finally {
          // Only stamp the throttle after the check actually ran (auth matched)
          localStorage.setItem('lastExpirationCheckDate', todayString);
        }
      };

      // Trigger the async checks without making the effect callback async
      void runExpirationChecks();
    }

  }, [inventory, user?.id]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
  }, []);

  // When the app comes back online, ask the Firebase offline queue to flush any
  // pending writes that were held during the outage. addToastRef avoids the
  // stale-closure repeated-toast issue that originally caused this to be disabled.
  useEffect(() => {
    if (isOnline) {
      offlineQueue.processQueue().then(() => {
        addToastRef.current?.('Back online — changes synced.', 'success');
      }).catch(err => {
        log.error('Failed to process offline queue', err, 'DataManagement');
      });
    }
  }, [isOnline]);

  const recordUndo = async (type: string, data: unknown) => {
    if (!user?.id) return;
    try {
      await undoService.recordAction({ type: type as 'delete_item' | 'bulk_edit' | 'update_item', data }, user.id);
      const actions = await undoService.getRecentActions(user.id);
      setRecentActions(actions);
    } catch (err) {
      log.error('Failed to record undo action:', err, 'DataManagement');
    }
  };

  const addItem = async (item: PantryItem) => {
    const itemWithAlert = { ...item, expiryAlertShown: shouldShowExpiryAlert(item) };

    if (user?.isGuest) {
      let atCap = false;
      let alreadyExists = false;
      setInventory(prev => {
        const idx = prev.findIndex(p => p.id === itemWithAlert.id);
        if (idx !== -1) {
          alreadyExists = true;
          const updated = [...prev];
          updated[idx] = itemWithAlert;
          try { localStorage.setItem(GUEST_INVENTORY_KEY, JSON.stringify(updated)); } catch {}
          return updated;
        }
        if (prev.length >= GUEST_ITEM_CAP) {
          atCap = true;
          return prev;
        }
        const updated = [...prev, itemWithAlert];
        try { localStorage.setItem(GUEST_INVENTORY_KEY, JSON.stringify(updated)); } catch { /* storage full */ }
        return updated;
      });
      if (atCap) {
        addToast?.(`Guest pantry is full (${GUEST_ITEM_CAP} items). Sign in for unlimited items.`, 'warning');
        return;
      }
      if (!alreadyExists) {
        HapticService.itemAdded();
      }
      return;
    }

    let alreadyExists = false;
    setInventory(prev => {
      const idx = prev.findIndex(p => p.id === itemWithAlert.id);
      if (idx !== -1) {
        alreadyExists = true;
        const updated = [...prev];
        updated[idx] = itemWithAlert;
        return updated;
      }
      return [...prev, itemWithAlert];
    });

    if (loggingOptions?.logItemAdded) {
      loggingOptions.logItemAdded(item.item, item.id);
    }
    if (loggingOptions?.updateActivityStatus) {
      loggingOptions.updateActivityStatus('managing inventory');
    }

    await InventoryCacheService.addItemToCache(itemWithAlert, user?.householdId, user?.id);
    if (!alreadyExists) {
      HapticService.itemAdded();
    }
  };

  const performUndo = async (action?: UndoAction) => {
    if (!user?.id) return;
    try {
      const actionToUndo = action || (await undoService.getRecentActions(user.id, 1))[0];
      if (!actionToUndo) return;

      if (actionToUndo.type === 'delete_item') {
        const itemToRestore = actionToUndo.data as PantryItem;
        await addItem(itemToRestore);
      } else if (actionToUndo.type === 'update_item') {
        const { itemId, previousState } = actionToUndo.data as { itemId: string; previousState: PantryItem };

        // Find if the item still exists in inventory
        const exists = inventoryRef.current.some(item => item.id === itemId);
        if (exists) {
          // Update local state
          setInventory(prev => prev.map(item => item.id === itemId ? previousState : item));
          // Update cache
          await InventoryCacheService.updateItemInCache(itemId, previousState, user?.householdId, user?.id);
        } else {
          // If it was somehow deleted in the meantime, restore it entirely
          await addItem(previousState);
        }
      }

      await undoService.removeAction(actionToUndo.id);
      const actions = await undoService.getRecentActions(user.id);
      setRecentActions(actions);
      addToast?.('Last action undone', 'success');
    } catch (err) {
      log.error('Failed to perform undo:', err, 'DataManagement');
      addToast?.('Failed to undo last action', 'error');
    }
  };

  const updateItem = async (index: number, updates: Partial<PantryItem>) => {
    const currentItem = inventory[index];
    if (!currentItem) return;

    const updatedItem = { ...currentItem, ...updates, expiryAlertShown: shouldShowExpiryAlert({ ...currentItem, ...updates }) };

    if (user?.isGuest) {
      setInventory(prev => {
        const updated = prev.map((item, i) => i === index ? updatedItem : item);
        try { localStorage.setItem(GUEST_INVENTORY_KEY, JSON.stringify(updated)); } catch { /* storage full */ }
        return updated;
      });
      return;
    }

    await recordUndo('update_item', {
      itemId: currentItem.id,
      previousState: currentItem,
      updates
    });

    setInventory(prev => prev.map((item, i) => i === index ? updatedItem : item));

    await InventoryCacheService.updateItemInCache(currentItem.id, updates, user?.householdId, user?.id);

    // Check if this is a staple item that needs to be re-added to shopping list
    if (updatedItem.isStaple && addToShoppingList && (options?.settings?.shopping?.autoReaddStaples !== false)) {
      const currentQuantity = getQuantityValue(updatedItem);
      const previousQuantity = getQuantityValue(currentItem);

      // If quantity dropped to zero or very low (and wasn't already zero), add to shopping list
      if (currentQuantity <= 0 && previousQuantity > 0) {
        addToShoppingList([updatedItem.item]);
        addToast?.(`"${updatedItem.item}" auto-added to shopping list (staple)`, 'info');
      }
    }
  };

  const deleteItem = async (index: number, disposalReason?: 'thrown_away' | 'cooked' | 'remove') => {
    const itemToDelete = inventory[index];
    if (!itemToDelete) return;

    if (loggingOptions?.logItemRemoved) {
      loggingOptions.logItemRemoved(itemToDelete.item, itemToDelete.id);
    }
    if (loggingOptions?.updateActivityStatus) {
      loggingOptions.updateActivityStatus('managing inventory');
    }

    if (user?.isGuest) {
      // Record to food waste analytics for guest
      try {
        const today = new Date().toISOString().slice(0, 10);
        const isExpired = itemToDelete.expirationDate && !itemToDelete.is_immortal && itemToDelete.expirationDate <= today;
        const reason = disposalReason || (isExpired ? 'thrown_away' : 'remove');
        const daysExpired = itemToDelete.expirationDate
          ? Math.max(0, Math.ceil((new Date().getTime() - new Date(itemToDelete.expirationDate).getTime()) / (1000 * 60 * 60 * 24)))
          : 0;
        const estimatedValue = itemToDelete.estimatedPrice || 2.50;

        await FoodWasteAnalyticsService.recordDisposal({
          itemId: itemToDelete.id,
          itemName: itemToDelete.item,
          category: itemToDelete.category,
          disposalReason: reason,
          daysExpired,
          userId: 'guest',
          userName: 'Guest',
          estimatedValue
        });
      } catch (err) {
        log.warn('Failed to record guest waste disposal on item delete', { error: err }, 'DataManagement');
      }

      setInventory(prev => {
        const updated = prev.filter((_, i) => i !== index);
        try { localStorage.setItem(GUEST_INVENTORY_KEY, JSON.stringify(updated)); } catch { /* storage full */ }
        return updated;
      });
      return;
    }

    // Record food waste analytics if user is authenticated
    if (user?.id) {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const isExpired = itemToDelete.expirationDate && !itemToDelete.is_immortal && itemToDelete.expirationDate <= today;
        const reason = disposalReason || (isExpired ? 'thrown_away' : 'remove');
        const daysExpired = itemToDelete.expirationDate
          ? Math.max(0, Math.ceil((new Date().getTime() - new Date(itemToDelete.expirationDate).getTime()) / (1000 * 60 * 60 * 24)))
          : 0;
        const estimatedValue = itemToDelete.estimatedPrice || 2.50;

        await FoodWasteAnalyticsService.recordDisposal({
          itemId: itemToDelete.id,
          itemName: itemToDelete.item,
          category: itemToDelete.category,
          disposalReason: reason,
          daysExpired,
          userId: user.id,
          userName: user.name,
          estimatedValue
        }, user?.householdId);
      } catch (err) {
        log.warn('Failed to record waste disposal on item delete', { error: err }, 'DataManagement');
      }
    }

    await recordUndo('delete_item', itemToDelete);

    HapticService.medium();
    setInventory(prev => prev.filter((_, i) => i !== index));

    await InventoryCacheService.removeItemFromCache(itemToDelete.id, user?.householdId, user?.id);

    // Dismiss any notifications that only reference this item
    if (user?.id) {
      pruneNotificationsForDeletedItems(user.id, [itemToDelete.id]).catch((err: unknown) => log.info('Failed to prune notification on delete', { error: err }));
    }

    // Check if this is a staple item that needs to be re-added to shopping list on delete
    if (itemToDelete.isStaple && addToShoppingList && (options?.settings?.shopping?.autoReaddStaples !== false)) {
      addToShoppingList([itemToDelete.item]);
      addToast?.(`"${itemToDelete.item}" auto-added to shopping list (staple)`, 'info');
    }

    addToast?.(
      `"${itemToDelete.item}" removed from pantry.`,
      'info',
      6000,
      'Undo',
      () => { performUndo(); }
    );
  };

  /**
   * Bulk-delete multiple pantry items by index.
   * Uses a single state update and a single cache write instead of N individual operations.
   */
  const deleteItems = async (indices: number[], disposalReason?: 'thrown_away' | 'cooked' | 'remove') => {
    if (indices.length === 0) return;

    const indexSet = new Set(indices);
    const itemsToDelete = indices
      .map(i => inventory[i])
      .filter((item): item is PantryItem => !!item);
    if (itemsToDelete.length === 0) return;

    if (loggingOptions?.updateActivityStatus) {
      loggingOptions.updateActivityStatus('managing inventory');
    }

    if (loggingOptions?.logItemRemoved) {
      for (const itemToDelete of itemsToDelete) {
        loggingOptions.logItemRemoved(itemToDelete.item, itemToDelete.id);
      }
    }

    if (user?.isGuest) {
      // Record to food waste analytics for guest
      try {
        const today = new Date().toISOString().slice(0, 10);
        for (const itemToDelete of itemsToDelete) {
          const isExpired = itemToDelete.expirationDate && !itemToDelete.is_immortal && itemToDelete.expirationDate <= today;
          const reason = disposalReason || (isExpired ? 'thrown_away' : 'remove');
          const daysExpired = itemToDelete.expirationDate
            ? Math.max(0, Math.ceil((new Date().getTime() - new Date(itemToDelete.expirationDate).getTime()) / (1000 * 60 * 60 * 24)))
            : 0;
          const estimatedValue = itemToDelete.estimatedPrice || 2.50;

          await FoodWasteAnalyticsService.recordDisposal({
            itemId: itemToDelete.id,
            itemName: itemToDelete.item,
            category: itemToDelete.category,
            disposalReason: reason,
            daysExpired,
            userId: 'guest',
            userName: 'Guest',
            estimatedValue
          });
        }
      } catch (err) {
        log.warn('Failed to record guest waste disposal on bulk delete', { error: err }, 'DataManagement');
      }

      setInventory(prev => {
        const updated = prev.filter((_, i) => !indexSet.has(i));
        try { localStorage.setItem(GUEST_INVENTORY_KEY, JSON.stringify(updated)); } catch { /* storage full */ }
        return updated;
      });
      return;
    }

    // Record food waste analytics for all deleted items in a single atomic write
    if (user?.id) {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const disposalPayloads = itemsToDelete.map(itemToDelete => {
          const isExpired = itemToDelete.expirationDate && !itemToDelete.is_immortal && itemToDelete.expirationDate <= today;
          const reason = disposalReason || (isExpired ? 'thrown_away' : 'remove');
          const daysExpired = itemToDelete.expirationDate
            ? Math.max(0, Math.ceil((new Date().getTime() - new Date(itemToDelete.expirationDate).getTime()) / (1000 * 60 * 60 * 24)))
            : 0;
          return {
            itemId: itemToDelete.id,
            itemName: itemToDelete.item,
            category: itemToDelete.category,
            disposalReason: reason as 'thrown_away' | 'cooked' | 'remove',
            daysExpired,
            userId: user.id,
            userName: user.name,
            estimatedValue: itemToDelete.estimatedPrice || 2.50
          };
        });
        await FoodWasteAnalyticsService.recordBulkDisposals(disposalPayloads, user?.householdId);
      } catch (err) {
        log.warn('Failed to record waste disposal on bulk delete', { error: err }, 'DataManagement');
      }
    }

    HapticService.medium();
    const updatedInventory = inventory.filter((_, i) => !indexSet.has(i));
    setInventory(updatedInventory);

    // Single cache write instead of N individual removeItemFromCache calls
    await InventoryCacheService.bulkUpdateInventoryCache(updatedInventory, user?.householdId, user?.id);

    // Dismiss any notifications that only reference the deleted items
    if (user?.id) {
      pruneNotificationsForDeletedItems(user.id, itemsToDelete.map(i => i.id)).catch((err: unknown) => log.info('Failed to prune notifications on bulk delete', { error: err }));
    }

    // Check if any deleted items are staples to auto-readd
    const staples = itemsToDelete.filter(i => i.isStaple);
    if (staples.length > 0 && addToShoppingList && (options?.settings?.shopping?.autoReaddStaples !== false)) {
      addToShoppingList(staples.map(i => i.item));
      addToast?.(`${staples.length} staple item${staples.length > 1 ? 's' : ''} auto-added to shopping list`, 'info');
    }

    addToast?.(
      `${itemsToDelete.length} item${itemsToDelete.length > 1 ? 's' : ''} removed from pantry.`,
      'info',
      4000
    );
  };

  const addItems = async (items: PantryItem[]) => {
    if (user?.isGuest) {
      let cappedCount = 0;
      setInventory(prev => {
        const remaining = GUEST_ITEM_CAP - prev.length;
        if (remaining <= 0) { cappedCount = items.length; return prev; }
        const toAdd = items.slice(0, remaining);
        if (toAdd.length < items.length) cappedCount = items.length - toAdd.length;
        const updated = [...prev, ...toAdd];
        try { localStorage.setItem(GUEST_INVENTORY_KEY, JSON.stringify(updated)); } catch { /* storage full */ }
        return updated;
      });
      if (cappedCount > 0) {
        addToast?.(`Guest pantry limit reached (${GUEST_ITEM_CAP} items). Sign in for unlimited items.`, 'warning');
      }
      return;
    }
    await InventoryCacheService.addItemsToCache(items, user?.householdId, user?.id);
  };

  const generateRecipeSuggestionsOnDemand = useCallback(() => {
    return generateRecipeSuggestions(inventory);
  }, [inventory]);

  const expirationAlerts = useExpirationAlerts(inventory);
  const { consumptionSuggestions, recipeSuggestions } = useFoodWaste(inventory);

  return {
    inventory,
    setInventory,
    isLoadingInventory,
    setIsLoadingInventory,
    recentActions,
    recordUndo,
    performUndo,
    updateItem,
    deleteItem,
    deleteItems,
    addItem,
    addItems,
    consumptionSuggestions,
    expirationAlerts,
    recipeSuggestions,
    generateRecipeSuggestionsOnDemand,
    inventoryRef,
  };
}
