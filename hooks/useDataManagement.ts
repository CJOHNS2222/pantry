import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import DatabaseMonitoringService from '../services/databaseMonitoringService';
import AnalyticsService from '../services/analyticsService';
import { UsageService } from '../services/usageService';

import { User, PantryItem, DayPlan, Household, ShoppingItem, SavedRecipe, RecipeRating, CustomCategory, MealPlanItem, StructuredRecipe, Settings } from '../types';

import { hasPantryItemsChanged, hasArraysChanged, hasMealPlansChanged } from '../utils/comparisonUtils';
import { setRemoteInventoryUpdate, setRemoteShoppingListUpdate, setRemoteMealPlanUpdate, setRemoteSavedRecipesUpdate } from '../services/syncStateService';
import { log } from '../services/logService';
import { generateConsumptionSuggestions, generateExpirationAlerts, generateRecipeSuggestions, isHouseholdMember, shouldShowExpiryAlert, deductIngredientAmount } from '../utils/appUtils';
import { offlineQueue } from '../services/offlineQueueService';
import { undoService, UndoAction } from '../services/undoService';
import { NotificationService } from '../services/notificationService';
import { pruneNotificationsForDeletedItems } from '../services/notificationsService';
import { LeftoverNotificationService } from '../services/leftoverNotificationService';
import { auth } from '../firebaseConfig';
import RiskProfileService from '../services/riskProfileService';
import { ERROR_MESSAGES } from '../constants/errorMessages';

import { firestoreCache } from '../services/cacheService';
import { HouseholdPreferenceService } from '../services/householdPreferenceService';
import { InventoryCacheService, CachedInventoryData, CacheMetadata } from '../services/inventoryCacheService';
import { MealPlanCacheService } from '../services/mealPlanCacheService';
import { RecipesCacheService, CachedRecipesData, RecipesCacheMetadata } from '../services/recipesCacheService';
import { ShoppingListCacheService, CachedShoppingListData, ShoppingListCache } from '../services/shoppingListCacheService';
import HapticService from '../services/hapticService';
import FoodWasteAnalyticsService from '../services/foodWasteAnalyticsService';

// Helper to normalize quantity from PantryItem
const getQuantityValue = (item: PantryItem): number => {
  if (typeof item.quantity === 'number') return item.quantity;
  if (item.quantity && typeof item.quantity === 'object') return (
     
    (item.quantity as { amount: number }).amount || 0
  );
  // Fallback to legacy estimate string
  const est = parseFloat(item.quantity_estimate || '0');
  return isNaN(est) ? 0 : est;
};

// Guest user local-storage keys and limits (no Firestore for guests)
const GUEST_INVENTORY_KEY = 'guest_inventory';
const GUEST_SHOPPING_KEY = 'guest_shopping';
const GUEST_ITEM_CAP = 20;
const GUEST_SHOPPING_CAP = 30;

// Global flag to prevent multiple meal plan syncs
let mealPlanSyncInProgress = false;

// Helper functions for creating scoped listeners
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
            prevShoppingListRef.current = JSON.parse(JSON.stringify(sortedItems));
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
            prevShoppingListRef.current = JSON.parse(JSON.stringify(sortedItems));
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

function createSavedRecipesListener(
  user: User,
  household: Household | null,
  inHousehold: boolean,
  setSavedRecipes: (recipes: SavedRecipe[]) => void,
  setIsLoadingSavedRecipes: (loading: boolean) => void,
  prevSavedRecipesRef: React.MutableRefObject<SavedRecipe[]>
) {
  // Use user.householdId as fallback — household state may not be loaded yet when this runs
  const householdId = inHousehold ? (household?.id || user.householdId) : undefined;
  const cachePath = householdId 
    ? `households/${householdId}/cache/savedRecipes` 
    : `users/${user.id}/cache/savedRecipes`;

  return DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.doc(cachePath), snap => {
    if (snap.exists()) {
      const data = snap.data() as CachedRecipesData & RecipesCacheMetadata;
      if (data.version === RecipesCacheService.CACHE_VERSION) {
        const recipes: SavedRecipe[] = [];
        for (const recipeId in data) {
          if (recipeId !== 'lastUpdated' && recipeId !== 'version' && recipeId !== 'totalRecipes') {
            recipes.push(RecipesCacheService.arrayToSavedRecipe(recipeId, data[recipeId]));
          }
        }
        const sortedRecipes = recipes.sort((a, b) => b.dateSaved.localeCompare(a.dateSaved));
        if (hasArraysChanged(sortedRecipes, prevSavedRecipesRef.current)) {
          setRemoteSavedRecipesUpdate(true);
          setSavedRecipes(sortedRecipes);
          prevSavedRecipesRef.current = JSON.parse(JSON.stringify(sortedRecipes));
        }
      }
    } else {
      setSavedRecipes([]);
    }
    setIsLoadingSavedRecipes(false);
  }, err => {
    if (err.code !== 'permission-denied') {
      log.error(`Saved recipes cache listener failed for ${cachePath}`, err, 'DataManagement');
    }
    setIsLoadingSavedRecipes(false);
  });
}

// Module-level cache for the rolling-window skeleton to avoid rebuilding on every Firestore snapshot.
// Only regenerated when the calendar date crosses midnight (todayKey changes).
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
let _mealPlanTemplateCacheKey = '';
let _mealPlanTemplate: Array<{ date: string; dayName: string }> = [];

function getMealPlanTemplate(todayISO: string): Array<{ date: string; dayName: string }> {
  if (_mealPlanTemplateCacheKey === todayISO) return _mealPlanTemplate;
  const today = new Date(todayISO + 'T12:00:00');
  _mealPlanTemplate = [];
  for (let i = -60; i < 60; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    _mealPlanTemplate.push({ date: iso, dayName: DAYS_OF_WEEK[d.getDay()] });
  }
  _mealPlanTemplateCacheKey = todayISO;
  return _mealPlanTemplate;
}

function createMealPlanListener(
  user: User,
  household: Household | null,
  inHousehold: boolean,
  setMealPlan: (plans: DayPlan[]) => void,
  setIsLoadingMealPlan: (loading: boolean) => void,
  prevMealPlanRef: React.MutableRefObject<DayPlan[]>
) {
  // Use user.householdId as fallback — household state may not be loaded yet when this runs
  const effectiveHouseholdId = inHousehold ? (household?.id || user.householdId) : undefined;
  const cachePath = effectiveHouseholdId
    ? `households/${effectiveHouseholdId}/cache/mealPlan`
    : `users/${user.id}/cache/mealPlan`;

  return DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.doc(cachePath), snap => {
    // 1. Build the base plan using the module-level cached template (rebuilt only when date changes).
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const template = getMealPlanTemplate(todayISO);

    const basePlan = new Map<string, DayPlan>();
    for (const { date, dayName } of template) {
      basePlan.set(date, { date, dayName, breakfast: [], lunch: [], dinner: [] });
    }

    // 2. If data exists in Firestore, merge it into the base plan.
    if (snap.exists()) {
      const data = snap.data();
      if (data && data.version === MealPlanCacheService.CACHE_VERSION) {
        const firestoreDays = data.days || {};

        for (const date in firestoreDays) {
          if (Object.prototype.hasOwnProperty.call(firestoreDays, date)) {
            const dayData = firestoreDays[date];
            basePlan.set(date, {
              date,
              dayName: DAYS_OF_WEEK[new Date(date + 'T12:00:00').getDay()],
              breakfast: Array.isArray(dayData.breakfast) ? dayData.breakfast : [],
              lunch: Array.isArray(dayData.lunch) ? dayData.lunch : [],
              dinner: Array.isArray(dayData.dinner) ? dayData.dinner : []
            });
          }
        }
      } else if (data) {
        log.warn('Meal plan cache version mismatch, ignoring remote data.', {}, 'useDataManagement');
      }
    }

    const finalPlan = Array.from(basePlan.values()).sort((a, b) => a.date.localeCompare(b.date));

    if (!hasMealPlansChanged(finalPlan, prevMealPlanRef.current)) {
      setIsLoadingMealPlan(false);
      return;
    }

    setRemoteMealPlanUpdate(true);
    setMealPlan(finalPlan);
    prevMealPlanRef.current = finalPlan.map(day => ({
      ...day,
      breakfast: [...(day.breakfast || [])],
      lunch: [...(day.lunch || [])],
      dinner: [...(day.dinner || [])]
    }));

    setIsLoadingMealPlan(false);
  }, err => {
    if (err.code !== 'permission-denied') {
      log.error('Meal plan cache listener failed:', { code: err?.code, message: err?.message }, 'useDataManagement');
    }
    setIsLoadingMealPlan(false);
  });
}

export function useDataManagement(
  user?: User | null,
  addToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning', duration?: number, actionLabel?: string, action?: () => void) => void,
  addToShoppingList?: (items: string[]) => void,
  updateSyncStatus?: (status: Partial<{ isOnline: boolean; isSyncing: boolean; lastSyncTime: Date | null; pendingOperations: number; syncError: string | null }>) => void,
  loggingOptions?: {
    logItemAdded?: (item: string, itemId: string) => void;
    logItemRemoved?: (item: string, itemId: string) => void;
    logShoppingAdded?: (item: string) => void;
    logRecipeSaved?: (recipe: string) => void;
    logMealCompleted?: (meal: string) => void;
    updateActivityStatus?: (activity: string) => void;
  },
  options?: {
    disableInventoryListeners?: boolean;
    onShowAddToPlanDialog?: (recipe: StructuredRecipe) => void;
    settings?: Settings;
  }
) {

  // Data States
  const [mealPlanState, setMealPlanState] = useState<DayPlan[]>([]);

  const [household, setHousehold] = useState<Household | null>(null);
  const [inventory, setInventory] = useState<PantryItem[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  // Count of recipes the current user has personally saved. Used for usage limits/sync so
  // other household members' recipes don't inflate the user's own quota.
  const [personalRecipeCount, setPersonalRecipeCount] = useState(0);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);

  // Usage limit states
  const [recipeSaveLimitExceeded, setRecipeSaveLimitExceeded] = useState(false);
  const [mealPlanLimitExceeded, setMealPlanLimitExceeded] = useState(false);

  // Loading states
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);
  const [isLoadingShoppingList, setIsLoadingShoppingList] = useState(true);
  const [isLoadingMealPlan, setIsLoadingMealPlan] = useState(true);
  const [isLoadingSavedRecipes, setIsLoadingSavedRecipes] = useState(true);
  const [isLoadingHousehold, setIsLoadingHousehold] = useState(true);
  const [showRiskQuestionnaire, setShowRiskQuestionnaire] = useState(false);
  const questionnaireShownRef = useRef(false);
  const [isLoadingRatings, setIsLoadingRatings] = useState(true);

  // Community ratings (global) - keep a lightweight realtime listener to populate Community tab
  const [ratings, setRatings] = useState<RecipeRating[]>([]);

  // Undo actions
  const [recentActions, setRecentActions] = useState<UndoAction[]>([]);

  // Online status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Retry counter for household listener permissions issues
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [householdListenerRetry, setHouseholdListenerRetry] = useState(0);

  // Writing state refs to prevent concurrent operations
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const writingMealPlanRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mealPlanCleanupDoneRef = useRef(false);

  // Ref to track last shopping list collection path for sync
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const lastShoppingListCollectionPathRef = useRef<string | undefined>(undefined);

  // Ref to prevent repeated household clearing on permission errors
  const householdClearedDueToPermissionsRef = useRef(false);

  // Ref to store leftover notification cleanup function
  const leftoverNotificationCleanupRef = useRef<(() => void) | null>(null);

  // Refs to track previous states to prevent unnecessary updates
  const prevMealPlanRef = useRef<DayPlan[]>([]);
  const prevShoppingListRef = useRef<ShoppingItem[]>([]);
  const prevSavedRecipesRef = useRef<SavedRecipe[]>([]);
  // Ref to hold latest inventory for closure-safe comparisons inside Firestore listeners
  const inventoryRef = useRef<PantryItem[]>([]);

  // Ref to hold latest addToast function to avoid useEffect dependency issues
  const addToastRef = useRef(addToast);

  // Update the ref whenever addToast changes
  useEffect(() => {
    addToastRef.current = addToast;
  }, [addToast]);

  // Helper function to clean objects by removing undefined fields (Firestore requirement)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  const cleanObject = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return undefined;
    }

    if (typeof obj === 'object') {
      if (Array.isArray(obj)) {
        return obj
          .filter(item => item !== null && item !== undefined)
          .map(item => cleanObject(item))
          .filter(item => item !== undefined);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cleaned: any = {};
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const cleanedValue = cleanObject(obj[key]);
            if (cleanedValue !== undefined) {
              cleaned[key] = cleanedValue;
            }
          }
        }
        return cleaned;
      }
    }

    return obj;
  };

  // Helper function for offline-aware writes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const performWrite = async (operation: { type: 'add' | 'update' | 'delete'; collection: string; docId?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any }) => {
    // Ensure operation has a data field to satisfy queue typing
    if (operation.data === undefined) {
      operation.data = {};
    }

    // Firebase SDK queues writes natively when offline and syncs on reconnect.
    // No custom queue needed — write directly and let the SDK handle persistence.
    try {
      if (operation.type === 'add') {
        await DatabaseMonitoringService.addDoc(DatabaseMonitoringService.collection(operation.collection), operation.data);
      } else if (operation.type === 'update' && operation.docId) {
        await DatabaseMonitoringService.updateDoc(DatabaseMonitoringService.doc(operation.collection, operation.docId), operation.data);
      } else if (operation.type === 'delete' && operation.docId) {
        await DatabaseMonitoringService.deleteDoc(DatabaseMonitoringService.doc(operation.collection, operation.docId));
      }
      firestoreCache.invalidateCollection(operation.collection);
    } catch (err) {
      log.error('Write operation failed', err, 'DataManagement');
      addToast?.(ERROR_MESSAGES.SAVE_FAILED, 'error');
    }
  };

  // Helper function to validate and sanitize meal plan data
  const validateMealPlan = (plan: DayPlan[]): DayPlan[] => {
    if (!Array.isArray(plan)) {
      log.warn('Meal plan validation: plan is not an array', {}, 'useDataManagement');
      return [];
    }
    
    const validDays = plan
      .filter(day => {
        if (!day || typeof day !== 'object') {
          log.warn('Meal plan validation: invalid day object', {}, 'useDataManagement');
          return false;
        }
        if (typeof day.date !== 'string' || !day.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          log.warn('Meal plan validation: invalid date format', {}, 'useDataManagement');
          return false;
        }
        return true;
      })
      .map(day => {
        const cleanMeal = (meal: unknown) => {
           
          const m = meal as { id?: string; recipe?: { title?: string } } | null | undefined;
          return !!(m && m.id && m.recipe && m.recipe.title);
        };

        return {
          date: day.date,
          dayName: day.dayName || 'Unknown',
          breakfast: (day.breakfast || []).filter(cleanMeal),
          lunch: (day.lunch || []).filter(cleanMeal),
          dinner: (day.dinner || []).filter(cleanMeal),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    
    if (validDays.length !== plan.length) {
      log.warn(`Meal plan validation: filtered out ${plan.length - validDays.length} invalid days`, {}, 'useDataManagement');
    }
    
    return validDays;
  };

  const setMealPlan = (newPlan: DayPlan[] | ((prev: DayPlan[]) => DayPlan[])) => {
    const planToSet = typeof newPlan === 'function' ? newPlan(mealPlanState) : newPlan;
    const validatedPlan = validateMealPlan(planToSet);
    setMealPlanState(validatedPlan);
  };

  const mealPlan = useMemo(() => mealPlanState, [mealPlanState]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const householdUnsubsRef = useRef<{ inventory?: (() => void) | null; shopping?: (() => void) | null; recipes?: (() => void) | null; mealPlan?: (() => void) | null }>({});

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const listenersReadyRef = useRef(false);

  const initialDataLoadedRef = useRef(false);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const totalReadsRef = useRef(0);

  const prevHouseholdRef = useRef<Household | null>(null);


  const lastAllergyCheckRef = useRef<number>(0);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const clientId = useMemo(() => {
    let id = localStorage.getItem('clientId');
    if (!id) {
      id = `client-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('clientId', id);
    }
    return id;
  }, []);

  // Keep inventoryRef current so Firestore listeners can do stale-closure-safe comparisons
  useEffect(() => {
    inventoryRef.current = inventory;
  }, [inventory]);

  // Sync customCategories state from user doc (delivered via useAuth onSnapshot — no separate listener needed)
  useEffect(() => {
    setCustomCategories(user?.customCategories || []);
  }, [user?.customCategories]);

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

  // Firestore synchronization effects
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    // Guest users: hydrate state from localStorage instead of Firestore
    if (user.isGuest) {
      try {
        const inv = JSON.parse(localStorage.getItem(GUEST_INVENTORY_KEY) || '[]') as PantryItem[];
        const shop = JSON.parse(localStorage.getItem(GUEST_SHOPPING_KEY) || '[]') as ShoppingItem[];
        setInventory(inv);
        setShoppingList(shop.sort((a, b) => a.item.localeCompare(b.item)));
      } catch {
        setInventory([]);
        setShoppingList([]);
      }
      setIsLoadingInventory(false);
      setIsLoadingShoppingList(false);
      setIsLoadingMealPlan(false);
      setIsLoadingSavedRecipes(false);
      setIsLoadingHousehold(false);
      return;
    }

    const unsubs: (()=>void)[] = [];

    if (user?.householdId) {
      unsubs.push(DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.doc('households', user.householdId), snap => {
        if (snap.exists()) {
          const householdData = { id: snap.id, ...snap.data() } as Household;
          const hasChanged = JSON.stringify(householdData) !== JSON.stringify(prevHouseholdRef.current);

          if (hasChanged) {
            prevHouseholdRef.current = householdData;
            setHousehold(householdData);
            
            // Start leftover notification checks for the new household
            if (leftoverNotificationCleanupRef.current) {
              leftoverNotificationCleanupRef.current();
            }
            leftoverNotificationCleanupRef.current = LeftoverNotificationService.startPeriodicChecks(householdData.id, user.id);
          }
        }
        setIsLoadingHousehold(false);
        householdClearedDueToPermissionsRef.current = false; // Reset on success
      }, err => {
        if (err.code === 'permission-denied' && !householdClearedDueToPermissionsRef.current) {
          log.warn('Permission denied on household listener, clearing household state.', {userId: user.id}, 'DataManagement');
          householdClearedDueToPermissionsRef.current = true; // Prevent loop
          setHousehold(null);
          // Clean up leftover notification checks when household is cleared
          if (leftoverNotificationCleanupRef.current) {
            leftoverNotificationCleanupRef.current();
            leftoverNotificationCleanupRef.current = null;
          }
        }
        setIsLoadingHousehold(false);
      }));
    } else {
      setHousehold(null);
      setIsLoadingHousehold(false);
      // Clean up leftover notification checks when no household
      if (leftoverNotificationCleanupRef.current) {
        leftoverNotificationCleanupRef.current();
        leftoverNotificationCleanupRef.current = null;
      }
    }

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
              // W: Read-time FEFO normalisation — keep item.expirationDate in sync with
              // the soonest batch expiry so filters and alerts always use the correct date.
              if (item.batches && item.batches.length > 0) {
                const batchExpiries = item.batches
                  .map(b => b.expires)
                  .filter((e): e is string => !!e)
                  .sort();
                if (batchExpiries.length > 0) {
                  item.expirationDate = batchExpiries[0];
                }
              }
              items.push(item);
            }
            if (hasPantryItemsChanged(items, inventoryRef.current)) {
              setRemoteInventoryUpdate(true);
              setInventory(items);
            }
          }
        } else {
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
    
    unsubs.push(createShoppingListListener(user, household, inHousehold, setShoppingList, setIsLoadingShoppingList, prevShoppingListRef));
    unsubs.push(createSavedRecipesListener(user, household, inHousehold, setSavedRecipes, setIsLoadingSavedRecipes, prevSavedRecipesRef));
    unsubs.push(createMealPlanListener(user, household, inHousehold, setMealPlan, setIsLoadingMealPlan, prevMealPlanRef));

    // When in a household, also listen to the user's personal recipe cache so we have
    // an accurate personal count for usage limits (household view shows all members' recipes).
    if (inHousehold) {
      const personalRecipePath = `users/${user.id}/cache/savedRecipes`;
      unsubs.push(DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.doc(personalRecipePath), snap => {
        if (snap.exists()) {
          const data = snap.data() as CachedRecipesData & RecipesCacheMetadata;
          if (data.version === RecipesCacheService.CACHE_VERSION) {
            const count = Object.keys(data).filter(
              k => k !== 'lastUpdated' && k !== 'version' && k !== 'totalRecipes'
            ).length;
            setPersonalRecipeCount(count);
          } else {
            setPersonalRecipeCount(0);
          }
        } else {
          setPersonalRecipeCount(0);
        }
      }, err => { log.info('Personal recipe count snapshot permission error (non-fatal)', { error: err }); }));
    } else {
      // Solo user: personal count mirrors the main savedRecipes state
      setPersonalRecipeCount(0); // will be set via savedRecipes.length in the effect below
    }
    // Do not attach continuous community ratings listener here; refresh on demand when tab is activated
    
    // customCategories are now stored on the user doc and synced via useAuth's onSnapshot.
    // The useEffect below keeps local state in sync whenever user.customCategories changes.

    return () => {
      unsubs.forEach(unsub => unsub());
      // Clean up leftover notification checks
      if (leftoverNotificationCleanupRef.current) {
        leftoverNotificationCleanupRef.current();
        leftoverNotificationCleanupRef.current = null;
      }
    };
  }, [user?.id, user?.householdId]);

  useEffect(() => {
    if (!inventory.length || !user?.id || user.isGuest) return;

    const today = new Date().toISOString().slice(0, 10);
    const expiredItems = inventory.filter(item => 
      item.expirationDate && item.expirationDate <= today
    );

    if (expiredItems.length > 0) {
      // This logic should probably be moved to a service
    }

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
            for (const item of itemsExpiringSoon.slice(0, 3)) {
              const daysUntilExpiry = Math.ceil((new Date(item.expirationDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
              await NotificationService.createExpirationAlert(user.id, item.item, daysUntilExpiry, item.id, user?.profile?.riskLevel, item.category, cachedNotifications);
            }
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
    if (!inventory.length || !user?.id || !household?.id) return;

    const now = Date.now();
    if (now - lastAllergyCheckRef.current < 5 * 60 * 1000) { // 5 minutes
      return;
    }

    HouseholdPreferenceService.checkHouseholdInventoryForAllergies(household.id)
    .then(() => {
      lastAllergyCheckRef.current = now;
    }).catch(err => {
      log.error('Failed to check household inventory for allergies:', err, 'DataManagement');
    });

  }, [inventory, user?.id, household?.id]);

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

  // Show risk questionnaire once the user adds their first item
  useEffect(() => {
    if (!user) return;
    if (questionnaireShownRef.current) return;
    // Show when user hasn't set a riskLevel and has at least one inventory item
    if (!user.profile?.riskLevel && inventory.length > 0) {
      setShowRiskQuestionnaire(true);
      questionnaireShownRef.current = true;
    }
  }, [user, inventory.length]);

  // Keep recipes.used Firestore counter in sync with the actual saved-recipe count.
  // When in a household the displayed list contains all members' recipes, so we sync
  // against the personal count only — other members' recipes must not inflate the quota.
  useEffect(() => {
    if (!user || isLoadingSavedRecipes) return;
    const inHousehold = !!(user.householdId);
    const countToSync = inHousehold ? personalRecipeCount : savedRecipes.length;
    UsageService.syncRecipeCount(user, countToSync).catch(err => {
      log.warn('Failed to sync recipe count', { error: err }, 'DataManagement');
    });
  }, [savedRecipes.length, personalRecipeCount, user?.id, user?.householdId, isLoadingSavedRecipes]);

  // Keep mealPlanning.weeklyUsed Firestore counter in sync with actual current/future entries.
  // Past entries are excluded so they never count against the user's quota.
  useEffect(() => {
    if (!user || isLoadingMealPlan) return;
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const currentFutureCount = mealPlan
      .filter(day => new Date(day.date) >= weekStart)
      .reduce((count, day) => count + (day.breakfast?.length || 0) + (day.lunch?.length || 0) + (day.dinner?.length || 0), 0);
    UsageService.syncMealPlanCount(user, currentFutureCount).catch(err => {
      log.warn('Failed to sync meal plan count', { error: err }, 'DataManagement');
    });
  }, [mealPlan, user?.id, isLoadingMealPlan]);


  // Handlers
  const handleAddToPlan = async (recipe: StructuredRecipe | SavedRecipe, targetDayIndex?: number, targetMealType?: 'breakfast' | 'lunch' | 'dinner') => {
    if (!mealPlan) return;

    // If no target specified, show dialog
    if (targetDayIndex === undefined && targetMealType === undefined) {
      options?.onShowAddToPlanDialog?.(recipe);
      return;
    }

    const canAdd = await checkMealPlanLimit();
    if (!canAdd) {
      addToast?.(ERROR_MESSAGES.PLANNING_LIMIT_REACHED, 'error');
      return;
    }

    // Pre-calculate current+future count (before the add) for sync purposes.
    // The mealPlan sync effect will also re-sync once state settles, but we
    // call syncMealPlanCount here immediately so the counter is never stale.
    const _syncNow = (addedDateStr: string) => {
      if (!user) return;
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const isCurrentOrFuture = new Date(addedDateStr) >= weekStart;
      const currentFutureCount = mealPlan
        .filter(day => new Date(day.date) >= weekStart)
        .reduce((count, day) => count + (day.breakfast?.length || 0) + (day.lunch?.length || 0) + (day.dinner?.length || 0), 0);
      // +1 because mealPlan state hasn't updated yet (Firestore listener fires async)
      const syncCount = isCurrentOrFuture ? currentFutureCount + 1 : currentFutureCount;
      UsageService.syncMealPlanCount(user, syncCount).catch(err => {
        log.warn('Failed to sync meal plan count after add', { error: err }, 'DataManagement');
      });
    };

    let dayIndex = targetDayIndex;
    const mealType = targetMealType || 'breakfast';

    if (dayIndex === undefined) {
      const today = new Date().toISOString().slice(0, 10);
      dayIndex = mealPlan.findIndex(day => day.date === today);
      if (dayIndex === -1 && mealPlan.length > 0) {
        dayIndex = 0;
      }
    }
    
    if (dayIndex === undefined || dayIndex < 0 || dayIndex >= mealPlan.length) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().slice(0, 10);
        const mealTypeToUse = targetMealType || 'breakfast';
        const newMeal = {
          id: `meal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          recipe: recipe,
          mealType: mealTypeToUse
        };
        await addMealToPlan(dateStr, mealTypeToUse, newMeal);
        AnalyticsService.trackMealPlanAdd(recipe.id || recipe.title, recipe.title, mealTypeToUse, 0);
        _syncNow(dateStr);
        return;
    }

    const targetDate = mealPlan[dayIndex].date;
    const newMeal = {
      id: `meal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      recipe: recipe,
      mealType: mealType
    };

    await addMealToPlan(targetDate, mealType, newMeal);

    AnalyticsService.trackMealPlanAdd(recipe.id || recipe.title, recipe.title, mealType, dayIndex);
    _syncNow(targetDate);
  };

  const checkRecipeSaveLimit = async () => {
    if (!user) return false;
    try {
      // Use personal count when in a household so members don't share quota.
      const inHousehold = !!(user.householdId);
      const countForLimit = inHousehold ? personalRecipeCount : savedRecipes.length;
      const canSave = await UsageService.canSaveRecipe(user, countForLimit);
      setRecipeSaveLimitExceeded(!canSave);
      return canSave;
    } catch (err) {
      log.error('Error checking recipe save limit:', err, 'DataManagement');
      return false;
    }
  };

  const checkMealPlanLimit = async () => {
    if (!user) return false;
    try {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const weeklyRecipeCount = mealPlan
        .filter(day => new Date(day.date) >= weekStart)
        .reduce((count, day) => count + (day.breakfast?.length || 0) + (day.lunch?.length || 0) + (day.dinner?.length || 0), 0);

      const canAdd = await UsageService.canAddMealPlanRecipe(user, weeklyRecipeCount);
      setMealPlanLimitExceeded(!canAdd);
      return canAdd;
    } catch (err) {
      log.error('Error checking meal plan limit:', err, 'DataManagement');
      return false;
    }
  };

  const handleSaveRecipe = async (recipe: StructuredRecipe) => {
    if (!user?.id) {
      return;
    }

    const canSave = await checkRecipeSaveLimit();
    if (!canSave) {
      addToast?.(ERROR_MESSAGES.RECIPE_LIMIT_REACHED, 'error');
      return;
    }

    try {
      const inHousehold = isHouseholdMember(household, user) && household?.id;
      const householdId = inHousehold ? household.id : undefined;

      const savedRecipe: SavedRecipe = {
        id: `recipe-${Date.now()}`,
        ...recipe,
        dateSaved: new Date().toISOString()
      };

      // Always write to the user's personal cache so their own recipe list is
      // maintained independently of any household they join or leave.
      await RecipesCacheService.addRecipeToCache(savedRecipe, undefined, user.id);

      // When in a household also write to the household cache so all members
      // see the combined list in a single Firestore read.
      if (inHousehold && householdId) {
        await RecipesCacheService.addRecipeToCache(savedRecipe, householdId, undefined);
      }

      // Sync personal count only
      await UsageService.syncRecipeCount(user, personalRecipeCount + 1);

      HapticService.success();
      addToast?.(`Saved ${recipe.title} to your recipes!`, 'success');
    } catch (err) {
      log.error('Error saving recipe:', err, 'DataManagement');
      addToast?.(ERROR_MESSAGES.SAVE_FAILED, 'error');
    }
  };

  const handleDeleteRecipe = async (recipe: SavedRecipe) => {
    if (!user?.id) return;
    try {
      const inHousehold = isHouseholdMember(household, user) && household?.id;
      const householdId = inHousehold ? household.id : undefined;

      // Remove from user's personal cache (may be a no-op if it was saved by another member).
      await RecipesCacheService.removeRecipeFromCache(recipe.id, undefined, user.id);

      // Remove from household shared cache so all members see it gone.
      if (inHousehold && householdId) {
        await RecipesCacheService.removeRecipeFromCache(recipe.id, householdId, undefined);
      }

      // Sync personal count only
      await UsageService.syncRecipeCount(user, Math.max(0, personalRecipeCount - 1));

      HapticService.light();
      addToast?.(`Removed ${recipe.title} from your saved recipes.`, 'success');
    } catch (err) {
      log.error('Error deleting recipe:', err, 'DataManagement');
      addToast?.(ERROR_MESSAGES.DELETE_FAILED, 'error');
    }
  };

  // Handler called when user completes the risk questionnaire
  const handleRiskQuestionnaireComplete = async (level: number, sensitive?: boolean) => {
    if (!user?.id) return;
    try {
      if (!user.isGuest) {
        await RiskProfileService.setUserRiskLevel(user.id, level, sensitive);
      } else {
        // For guests, we can't save to Firestore. Save locally to bypass permission error.
        try {
          const profile = JSON.parse(localStorage.getItem('guestProfile') || '{}');
          profile.riskLevel = level;
          profile.sensitiveGroups = !!sensitive;
          localStorage.setItem('guestProfile', JSON.stringify(profile));
        } catch (_e) {
          log.warn('Could not save guest risk profile to local storage', {}, 'DataManagement');
        }
      }
      setShowRiskQuestionnaire(false);
      addToast?.('Saved safety preferences.', 'success');
    } catch (err) {
      log.error('Failed to save risk profile:', err, 'DataManagement');
      addToast?.(ERROR_MESSAGES.SAVE_FAILED, 'error');
    }
  };

  const addCustomCategory = async (name: string, icon: string, color?: string) => {
    if (!user?.id) return;
    try {
      const { createCustomCategory, validateCustomCategory } = await import('../utils/appUtils');
      
      const validation = validateCustomCategory(name, icon, customCategories);
      if (!validation.valid) {
        addToast?.(validation.error!, 'error');
        return;
      }

      const newCategory = createCustomCategory(name, icon, color, user.id);
      const updatedCategories = [...customCategories, newCategory];
          
      await DatabaseMonitoringService.updateDoc(DatabaseMonitoringService.doc(`users/${user.id}`), { customCategories: updatedCategories });

      addToast?.(`Created category "${name}"!`, 'success');
    } catch (err) {
      log.error('Error adding custom category:', err, 'DataManagement');
      addToast?.('Failed to create category. Please try again.', 'error');
    }
  };

  const updateCustomCategory = async () => {
    if (!user?.id) return;
    // Omitted for brevity
  };

  const deleteCustomCategory = async () => {
    if (!user?.id) return;
    // Omitted for brevity
  };

  const generateRecipeSuggestionsOnDemand = useCallback(() => {
    return generateRecipeSuggestions(inventory);
  }, [inventory]);

  const handleMarkAsMade = async (recipe: StructuredRecipe, deductions?: { itemId: string; ingredient: string }[]) => {
    if (!user?.id) return;
    try {
      if (deductions && deductions.length > 0) {
        let deductedCount = 0;
        const deletedItems: PantryItem[] = [];
        const updatedItems: { item: PantryItem; updates: Partial<PantryItem>; finalItem: PantryItem }[] = [];
        
        // Start with a snapshot of the current inventory
        const currentInventory = [...inventory];
        
        for (const deduction of deductions) {
          const index = currentInventory.findIndex(pi => pi.id === deduction.itemId);
          if (index !== -1) {
            const item = currentInventory[index];
            const remaining = deductIngredientAmount(item.quantity ?? item.quantity_estimate, deduction.ingredient);
            
            const currentAmount = getQuantityValue(item);
            const remainingAmount = remaining.amount;
            
            let newVisualLevel = item.visualLevel;
            if (remainingAmount <= 0) {
              newVisualLevel = 'empty';
            } else if (currentAmount > 0) {
              const ratio = remainingAmount / currentAmount;
              if (ratio <= 0.25) {
                newVisualLevel = 'quarter';
              } else if (ratio <= 0.5) {
                newVisualLevel = 'half';
              } else if (ratio <= 0.75) {
                newVisualLevel = 'threeQuarter';
              } else {
                newVisualLevel = 'full';
              }
            } else {
              newVisualLevel = 'full';
            }

            const updates: Partial<PantryItem> = {};
            if (item.quantity && typeof item.quantity === 'object') {
              updates.quantity = {
                ...item.quantity,
                amount: remainingAmount,
                unit: remaining.unit
              };
            } else if (typeof item.quantity === 'number') {
              updates.quantity = remainingAmount;
            } else {
              updates.quantity_estimate = `${remainingAmount} ${remaining.unit}`;
            }

            if (newVisualLevel !== item.visualLevel) {
              updates.visualLevel = newVisualLevel;
            }

            const finalItem = {
              ...item,
              ...updates,
              expiryAlertShown: shouldShowExpiryAlert({ ...item, ...updates })
            };

            // Replace in currentInventory so any subsequent deductions in the same recipe use the new quantity
            currentInventory[index] = finalItem;

            if (remainingAmount <= 0 || newVisualLevel === 'empty') {
              deletedItems.push(item);
            } else {
              updatedItems.push({ item, updates, finalItem });
            }
            
            deductedCount++;
          }
        }

        if (deductedCount > 0) {
          const deletedIds = new Set(deletedItems.map(i => i.id));
          const finalInventory = currentInventory.filter(item => !deletedIds.has(item.id));

          if (loggingOptions?.updateActivityStatus) {
            loggingOptions.updateActivityStatus('managing inventory');
          }

          if (user?.isGuest) {
            // Record to food waste analytics for guest
            for (const itemToDelete of deletedItems) {
              try {
                const daysExpired = itemToDelete.expirationDate
                  ? Math.max(0, Math.ceil((new Date().getTime() - new Date(itemToDelete.expirationDate).getTime()) / (1000 * 60 * 60 * 24)))
                  : 0;
                const estimatedValue = itemToDelete.estimatedPrice || 2.50;

                await FoodWasteAnalyticsService.recordDisposal({
                  itemId: itemToDelete.id,
                  itemName: itemToDelete.item,
                  category: itemToDelete.category,
                  disposalReason: 'cooked',
                  daysExpired,
                  userId: 'guest',
                  userName: 'Guest',
                  estimatedValue
                });
              } catch (err) {
                log.warn('Failed to record guest waste disposal on recipe deduction', { error: err }, 'DataManagement');
              }
            }

            setInventory(finalInventory);
            try {
              localStorage.setItem(GUEST_INVENTORY_KEY, JSON.stringify(finalInventory));
            } catch {
              /* storage full */
            }
          } else {
            // Process deletions
            for (const itemToDelete of deletedItems) {
              if (loggingOptions?.logItemRemoved) {
                loggingOptions.logItemRemoved(itemToDelete.item, itemToDelete.id);
              }

              // Record to food waste analytics
              try {
                const daysExpired = itemToDelete.expirationDate
                  ? Math.max(0, Math.ceil((new Date().getTime() - new Date(itemToDelete.expirationDate).getTime()) / (1000 * 60 * 60 * 24)))
                  : 0;
                const estimatedValue = itemToDelete.estimatedPrice || 2.50;

                await FoodWasteAnalyticsService.recordDisposal({
                  itemId: itemToDelete.id,
                  itemName: itemToDelete.item,
                  category: itemToDelete.category,
                  disposalReason: 'cooked',
                  daysExpired,
                  userId: user.id,
                  userName: user.name,
                  estimatedValue
                }, user.householdId);
              } catch (err) {
                log.warn('Failed to record waste disposal on recipe deduction delete', { error: err }, 'DataManagement');
              }

              // Remove from cache
              await InventoryCacheService.removeItemFromCache(itemToDelete.id, user.householdId, user.id);

              // Record delete undo action
              await recordUndo('delete_item', itemToDelete);
            }

            // Process updates
            for (const updated of updatedItems) {
              await InventoryCacheService.updateItemInCache(updated.item.id, updated.updates, user.householdId, user.id);
              
              // Record update undo action
              await recordUndo('update_item', {
                itemId: updated.item.id,
                previousState: updated.item,
                updates: updated.updates
              });
            }

            // Batch side effects for deleted items
            if (deletedItems.length > 0) {
              HapticService.medium();

              // Prune notifications
              pruneNotificationsForDeletedItems(user.id, Array.from(deletedIds)).catch((err: unknown) => log.info('Failed to prune notifications on recipe deduction', { error: err }));

              // Auto-readd staple items for deleted items
              const staplesToReadd = deletedItems.filter(i => i.isStaple);
              if (staplesToReadd.length > 0 && addToShoppingList && (options?.settings?.shopping?.autoReaddStaples !== false)) {
                addToShoppingList(staplesToReadd.map(i => i.item));
                addToast?.(`${staplesToReadd.length} staple item${staplesToReadd.length > 1 ? 's' : ''} auto-added to shopping list`, 'info');
              }
            }

            // Update local state once
            setInventory(finalInventory);
          }

          if (deletedItems.length > 0) {
            addToast?.(`Deducted ${deductedCount} item${deductedCount > 1 ? 's' : ''} from pantry (${deletedItems.length} finished).`, 'success');
          } else {
            addToast?.(`Deducted ${deductedCount} item${deductedCount > 1 ? 's' : ''} from pantry.`, 'success');
          }
        } else {
          addToast?.('Recipe marked as cooked.', 'success');
        }
      } else {
        addToast?.('Recipe marked as cooked.', 'success');
      }
    } catch (err) {
      log.error('Error in handleMarkAsMade:', err, 'DataManagement');
      addToast?.('Failed to deduct items from pantry.', 'error');
    }
  };

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

  const addItem = async (item: PantryItem) => {
    const itemWithAlert = { ...item, expiryAlertShown: shouldShowExpiryAlert(item) };

    if (user?.isGuest) {
      let atCap = false;
      setInventory(prev => {
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
      HapticService.itemAdded();
      return;
    }

    setInventory(prev => [...prev, itemWithAlert]);

    if (loggingOptions?.logItemAdded) {
      loggingOptions.logItemAdded(item.item, item.id);
    }
    if (loggingOptions?.updateActivityStatus) {
      loggingOptions.updateActivityStatus('managing inventory');
    }

    await InventoryCacheService.addItemToCache(itemWithAlert, user?.householdId, user?.id);
    HapticService.itemAdded();
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
  
  const getRatingsForRecipe = async (recipeTitle: string): Promise<RecipeRating[]> => {
    try {
      const q = DatabaseMonitoringService.query(
        DatabaseMonitoringService.collection('recipeRatings'),
        DatabaseMonitoringService.where('recipeTitle', '==', recipeTitle),
        DatabaseMonitoringService.orderBy('date', 'desc'),
        DatabaseMonitoringService.limit(50)
      );
      const snap = await DatabaseMonitoringService.getDocs(q);
      if (snap.empty) return [];
      return snap.docs.map((d: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = d as { id: string; data: () => Record<string, any> };
        const data = doc.data();
        const dateField = data.date;
        let dateStr: string | null = null;
        if (dateField) {
          if (typeof dateField.toDate === 'function') {
            try { dateStr = dateField.toDate().toISOString(); } catch { dateStr = null; }
          } else if (typeof dateField.seconds === 'number') {
            dateStr = new Date(dateField.seconds * 1000).toISOString();
          } else if (typeof dateField._seconds === 'number') {
            dateStr = new Date(dateField._seconds * 1000).toISOString();
          } else if (typeof dateField === 'string') {
            dateStr = dateField;
          }
        }
        return { ...data, id: doc.id, date: dateStr } as RecipeRating;
      });
    } catch (err) {
      log.error('Failed to get ratings for recipe', { err, recipeTitle }, 'DataManagement');
      return [];
    }
  };

  const getCommunityRatings = async (): Promise<RecipeRating[]> => {
    try {
      // Return currently cached ratings (listener keeps this fresh)
      return ratings;
    } catch (err) {
      log.error('Failed to get community ratings', { err }, 'DataManagement');
      return [];
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const refreshCommunityRatings = useCallback(async (): Promise<void> => {
    if (!user?.id) return;
    setIsLoadingRatings(true);
    try {
      const q = DatabaseMonitoringService.query(
        DatabaseMonitoringService.collection('recipeRatings'),
        DatabaseMonitoringService.orderBy('date', 'desc'),
        DatabaseMonitoringService.limit(50)
      );
      const snap = await DatabaseMonitoringService.getDocs(q);
      if (snap.empty) {
        setRatings([]);
        setIsLoadingRatings(false);
        return;
      }

      const mapped: RecipeRating[] = snap.docs.map((d: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = d as { id: string; data: () => Record<string, any> };
        const data = doc.data();
        const dateField = data.date;
        let dateStr: string | null = null;
        if (dateField) {
          if (typeof dateField.toDate === 'function') {
            try { dateStr = dateField.toDate().toISOString(); } catch { dateStr = null; }
          } else if (typeof dateField.seconds === 'number') {
            dateStr = new Date(dateField.seconds * 1000).toISOString();
          } else if (typeof dateField._seconds === 'number') {
            dateStr = new Date(dateField._seconds * 1000).toISOString();
          } else if (typeof dateField === 'string') {
            dateStr = dateField;
          }
        }
        return { ...data, id: doc.id, date: dateStr } as RecipeRating;
      });

      setRatings(mapped);
    } catch (err) {
      log.error('Failed to refresh community ratings', { err }, 'DataManagement');
    }
    setIsLoadingRatings(false);
  }, [user?.id]);

  const submitRating = async () => {
    if (!user?.id) return;
    // Omitted for brevity
  };
  
  const addMealToPlan = async (date: string, mealType: 'breakfast' | 'lunch' | 'dinner', meal: MealPlanItem) => {
    if (!user?.id) return;
    try {
      await MealPlanCacheService.addMeal(date, mealType, meal, user?.householdId, user?.id);
      if (loggingOptions?.updateActivityStatus) {
        loggingOptions.updateActivityStatus('planning meals');
      }
      addToast?.(`Added ${meal.recipe.title} to your meal plan!`, 'success');
    } catch (err) {
      log.error('Error adding meal to plan:', err, 'DataManagement');
      addToast?.(ERROR_MESSAGES.SAVE_FAILED, 'error');
    }
  };

  const updateMealOnPlan = async (date: string, mealType: 'breakfast' | 'lunch' | 'dinner', meal: MealPlanItem) => {
    if (!user?.id) return;
    try {
      await MealPlanCacheService.updateMeal(date, mealType, meal, user?.householdId, user?.id);
      if (loggingOptions?.updateActivityStatus) {
        loggingOptions.updateActivityStatus('planning meals');
      }
      addToast?.(`Updated ${meal.recipe.title} on your meal plan!`, 'success');
    } catch (err) {
      log.error('Error updating meal on plan:', err, 'DataManagement');
      addToast?.(ERROR_MESSAGES.UPDATE_FAILED, 'error');
    }
  };

  const removeMealFromPlan = async (date: string, mealType: 'breakfast' | 'lunch' | 'dinner', mealId: string) => {
    if (!user?.id) return;
    try {
      await MealPlanCacheService.removeMeal(date, mealType, mealId, user?.householdId, user?.id);
      if (loggingOptions?.updateActivityStatus) {
        loggingOptions.updateActivityStatus('planning meals');
      }
      addToast?.('Removed meal from your plan!', 'success');
    } catch (err) {
      log.error('Error removing meal from plan:', err, 'DataManagement');
      addToast?.(ERROR_MESSAGES.DELETE_FAILED, 'error');
    }
  };

  const updateMealPlan = async (newPlan: DayPlan[]) => {
    if (!user?.id) return;
    if (mealPlanSyncInProgress) return; // Prevent concurrent updates
    mealPlanSyncInProgress = true;
    try {
      // Set the meal plan locally for immediate UI update
      setMealPlan(newPlan);
      // Save the entire new meal plan to the cache
      await MealPlanCacheService.setCache(newPlan, user?.householdId, user?.id);
      addToast?.('Meal plan updated successfully!', 'success');
    } catch (err) {
      log.error('Error updating meal plan:', err, 'DataManagement');
      addToast?.(ERROR_MESSAGES.UPDATE_FAILED, 'error');
    } finally {
      mealPlanSyncInProgress = false;
    }
  };

  // Memoized suggestions and alerts
  const consumptionSuggestions = useMemo(() => generateConsumptionSuggestions(inventory), [inventory]);
  const expirationAlerts = useMemo(() => generateExpirationAlerts(inventory), [inventory]);
  const recipeSuggestions = useMemo(() => generateRecipeSuggestions(inventory), [inventory]);

  const refreshAllData = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Force refresh all caches by clearing and reloading
      setIsLoadingInventory(true);
      setIsLoadingShoppingList(true);
      setIsLoadingMealPlan(true);
      setIsLoadingSavedRecipes(true);

      // Clear cache flags to force reload
      setRemoteInventoryUpdate(true);
      setRemoteShoppingListUpdate(true);
      setRemoteMealPlanUpdate(true);
      setRemoteSavedRecipesUpdate(true);

      // The listeners will automatically reload the data
      addToast?.('Data refreshed!', 'success');
    } catch (err) {
      log.error('Failed to refresh data:', err, 'DataManagement');
      addToast?.('Failed to refresh data. Please try again.', 'error');
    }
  }, [user?.id, addToast]);

  const setLoadingRatingsComplete = useCallback(() => {
    setIsLoadingRatings(false);
  }, []);

  return {
    inventory,
    setInventory,
    shoppingList,
    setShoppingList,
    savedRecipes,
    setSavedRecipes,
    ratings,
    mealPlan,
    setMealPlan,
    updateMealPlan,
    household,
    setHousehold,
    consumptionSuggestions,
    expirationAlerts,
    recipeSuggestions,
    customCategories,
    addCustomCategory,
    updateCustomCategory,
    deleteCustomCategory,
    generateRecipeSuggestionsOnDemand,
    handleAddToPlan,
    addMealToPlan,
    updateMealOnPlan,
    removeMealFromPlan,
    handleSaveRecipe,
    handleDeleteRecipe,
    submitRating,
    getRatingsForRecipe,
    getCommunityRatings,
    handleMarkAsMade,
    updateItem,
    deleteItem,
    deleteItems,
    addItem,
    addItems,
    recentActions,
    recordUndo,
    performUndo,
    recipeSaveLimitExceeded,
    mealPlanLimitExceeded,
    checkRecipeSaveLimit,
    checkMealPlanLimit,
    // Risk questionnaire state & handler
    showRiskQuestionnaire,
    handleRiskQuestionnaireComplete,
    addShoppingListItem,
    addShoppingListItems,
    updateShoppingListItem,
    updateShoppingListItems,
    removeShoppingListItem,
    removeShoppingListItems,
    refreshAllData,
    setLoadingRatingsComplete,
    isLoadingInventory,
    isLoadingShoppingList,
    isLoadingMealPlan,
    isLoadingSavedRecipes,
    isLoadingRatings,
    isLoadingHousehold,
  };
}
