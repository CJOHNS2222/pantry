import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import DatabaseMonitoringService from '../services/databaseMonitoringService';
import AnalyticsService from '../services/analyticsService';
import { UsageService } from '../services/usageService';
import { RecipeRatingService } from '../services/recipeRatingService';
import { User, PantryItem, DayPlan, Household, ShoppingItem, SavedRecipe, RecipeRating, RecipeRatingInput, CustomCategory, MealPlanItem, StructuredRecipe, ConsumptionSuggestion, ExpirationAlert, RecipeSuggestion, Member } from '../types';
import { AppError } from '../utils/errorUtils';
import { hasPantryItemsChanged, hasArraysChanged, hasMealPlansChanged } from '../utils/comparisonUtils';
import { setRemoteInventoryUpdate, isRemoteInventoryUpdate, setRemoteShoppingListUpdate, isRemoteShoppingListUpdate, setRemoteMealPlanUpdate, isRemoteMealPlanUpdate, setRemoteSavedRecipesUpdate } from '../services/syncStateService';
import { log } from '../services/logService';
import { generateConsumptionSuggestions, generateExpirationAlerts, generateRecipeSuggestions, isHouseholdMember, parseIngredientForShoppingList, shouldShowExpiryAlert } from '../utils/appUtils';
import { offlineQueue } from '../services/offlineQueueService';
import { undoService } from '../services/undoService';
import { NotificationService } from '../services/notificationService';
import { LeftoverNotificationService } from '../services/leftoverNotificationService';
import { auth } from '../firebaseConfig';
import RiskProfileService from '../services/riskProfileService';
import { ERROR_MESSAGES } from '../constants/errorMessages';
import { useScopedDataListener } from './useDataListener';
import { firestoreCache } from '../services/cacheService';
import { HouseholdPreferenceService } from '../services/householdPreferenceService';
import { InventoryCacheService, CachedInventoryData, CacheMetadata } from '../services/inventoryCacheService';
import { MealPlanCacheService } from '../services/MealPlanCacheService';
import { RecipesCacheService, CachedRecipesData, RecipesCacheMetadata } from '../services/recipesCacheService';
import { ShoppingListCacheService, CachedShoppingListData, ShoppingListCacheMetadata, ShoppingListCache } from '../services/shoppingListCacheService';
import HapticService from '../services/hapticService';

// Helper to normalize quantity from PantryItem
const getQuantityValue = (item: PantryItem): number => {
  if (typeof item.quantity === 'number') return item.quantity;
  if (item.quantity && typeof item.quantity === 'object') return (item.quantity as any).amount || 0;
  // Fallback to legacy estimate string
  const est = parseFloat(item.quantity_estimate || '0');
  return isNaN(est) ? 0 : est;
};

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
  if (inHousehold && household?.id) {
    const householdId = household.id;
    ShoppingListCacheService.getCachedShoppingList(householdId).then(cachedItems => {
      if (cachedItems.length > 0) {
        setShoppingList(cachedItems);
        setIsLoadingShoppingList(false);
      }
    }).catch(err => {
      log.error('Failed to load cached shopping list', err, 'DataManagement');
    });

    const cachePath = `households/${householdId}/cache/shoppingList`;
    return DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.doc(cachePath), snap => {
      if (snap.exists()) {
        const data = snap.data() as ShoppingListCache;
        if (data.metadata && data.metadata.version === ShoppingListCacheService.CACHE_VERSION) {
          const items: ShoppingItem[] = [];
          for (const [itemId, itemArray] of Object.entries(data.items)) {
            items.push(ShoppingListCacheService.objectToShoppingItem(itemId, itemArray as CachedShoppingListData[string], householdId));
          }
          const sortedItems = items.sort((a, b) => (b.addedAt?.getTime() || 0) - (a.addedAt?.getTime() || 0));
          if (hasArraysChanged(sortedItems, prevShoppingListRef.current)) {
            setRemoteShoppingListUpdate(true);
            setShoppingList(sortedItems);
            prevShoppingListRef.current = sortedItems.map(item => ({...item}));
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
    ShoppingListCacheService.getCachedShoppingList(undefined, userId).then(cachedItems => {
      if (cachedItems.length > 0) {
        setShoppingList(cachedItems);
        setIsLoadingShoppingList(false);
      }
    }).catch(err => {
      log.error('Failed to load cached shopping list', err, 'DataManagement');
    });

    const cachePath = `users/${userId}/cache/shoppingList`;
    return DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.doc(cachePath), snap => {
      if (snap.exists()) {
        const data = snap.data() as ShoppingListCache;
        if (data.metadata && data.metadata.version === ShoppingListCacheService.CACHE_VERSION) {
          const items: ShoppingItem[] = [];
          for (const [itemId, itemArray] of Object.entries(data.items)) {
            items.push(ShoppingListCacheService.objectToShoppingItem(itemId, itemArray as CachedShoppingListData[string], undefined, userId));
          }
          const sortedItems = items.sort((a, b) => (b.addedAt?.getTime() || 0) - (a.addedAt?.getTime() || 0));
          if (hasArraysChanged(sortedItems, prevShoppingListRef.current)) {
            setRemoteShoppingListUpdate(true);
            setShoppingList(sortedItems);
            prevShoppingListRef.current = sortedItems.map(item => ({...item}));
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
  const householdId = inHousehold && household?.id ? household.id : undefined;
  const userId = inHousehold ? undefined : user.id;

  RecipesCacheService.getCachedRecipes(householdId, userId).then(cachedRecipes => {
    if (cachedRecipes.length > 0) {
      setSavedRecipes(cachedRecipes);
      setIsLoadingSavedRecipes(false);
    }
  }).catch(err => {
    log.error('Failed to load cached recipes', err, 'DataManagement');
  });

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
          prevSavedRecipesRef.current = sortedRecipes.map(recipe => ({...recipe}));
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

function createMealPlanListener(
  user: User,
  household: Household | null,
  inHousehold: boolean,
  setMealPlan: (plans: DayPlan[]) => void,
  setIsLoadingMealPlan: (loading: boolean) => void,
  prevMealPlanRef: React.MutableRefObject<DayPlan[]>
) {
  const cachePath = inHousehold && household?.id
    ? `households/${household.id}/cache/mealPlan`
    : `users/${user.id}/cache/mealPlan`;

  return DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.doc(cachePath), snap => {
    // 1. Always generate the base plan structure first.
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = new Date();
    
    // Generate a full year of meal plan data (6 months past + 6 months future)
    // This allows users to view history and plan far ahead
    const monthsBack = 6;
    const monthsForward = 6;
    const totalDays = (monthsBack + monthsForward) * 31; // Rough estimate
    
    const basePlan = new Map<string, DayPlan>();
    
    // Generate dates from 6 months ago to 6 months in the future
    for (let i = -monthsBack * 30; i < monthsForward * 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      basePlan.set(iso, {
        date: iso,
        dayName: days[d.getDay()],
        breakfast: [],
        lunch: [],
        dinner: []
      });
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
              dayName: dayData.dayName || days[new Date(`${date}T00:00:00`).getUTCDay()],
              breakfast: Array.isArray(dayData.breakfast) ? dayData.breakfast : [],
              lunch: Array.isArray(dayData.lunch) ? dayData.lunch : [],
              dinner: Array.isArray(dayData.dinner) ? dayData.dinner : []
            });
          }
        }
      } else if (data) {
        console.warn('Meal plan cache version mismatch, ignoring remote data.');
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
      console.error("Meal plan cache listener failed:", err);
    }
    setIsLoadingMealPlan(false);
  });
}

export function useDataManagement(
  user?: User | null,
  addToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning', duration?: number) => void,
  addToShoppingList?: (items: string[]) => void,
  updateSyncStatus?: (status: any) => void,
  loggingOptions?: {
    logItemAdded?: (item: string, itemId: string) => void;
    logItemRemoved?: (item: string, itemId: string) => void;
    logShoppingAdded?: (item: string) => void;
    logRecipeSaved?: (recipe: string) => void;
    logMealCompleted?: (meal: string) => void;
  },
  options?: {
    disableInventoryListeners?: boolean;
    onShowAddToPlanDialog?: (recipe: StructuredRecipe) => void;
  }
) {

  // Data States
  const [mealPlanState, setMealPlanState] = useState<DayPlan[]>([]);

  const [household, setHousehold] = useState<Household | null>(null);
  const [inventory, setInventory] = useState<PantryItem[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
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
  const [recentActions, setRecentActions] = useState<any[]>([]);

  // Online status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Retry counter for household listener permissions issues
  const [householdListenerRetry, setHouseholdListenerRetry] = useState(0);

  // Writing state refs to prevent concurrent operations
  const writingMealPlanRef = useRef(false);
  const mealPlanCleanupDoneRef = useRef(false);

  // Ref to track last shopping list collection path for sync
  const lastShoppingListCollectionPathRef = useRef<string | undefined>(undefined);

  // Ref to prevent repeated household clearing on permission errors
  const householdClearedDueToPermissionsRef = useRef(false);

  // Ref to store leftover notification cleanup function
  const leftoverNotificationCleanupRef = useRef<(() => void) | null>(null);

  // Refs to track previous states to prevent unnecessary updates
  const prevMealPlanRef = useRef<DayPlan[]>([]);
  const prevShoppingListRef = useRef<ShoppingItem[]>([]);
  const prevSavedRecipesRef = useRef<SavedRecipe[]>([]);

  // Helper function to clean objects by removing undefined fields (Firestore requirement)
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
  const performWrite = async (operation: { type: 'add' | 'update' | 'delete'; collection: string; docId?: string; data?: any }) => {
    // Ensure operation has a data field to satisfy queue typing
    if (operation.data === undefined) {
      operation.data = {};
    }

    if (!isOnline) {
      await offlineQueue.enqueue(operation as any);
      if (typeof updateSyncStatus === 'function') {
        // This needs to be a function to correctly update state
        // updateSyncStatus((prev: any) => ({
        //   ...prev,
        //   pendingOperations: prev.pendingOperations + 1
        // }));
      }
      addToast?.('Change queued for when you\'re back online.', 'info');
    } else {
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
        log.error('Online write operation failed', err, 'DataManagement');
        addToast?.(ERROR_MESSAGES.SAVE_FAILED, 'error');
      }
    }
  };

  // Helper function to validate and sanitize meal plan data
  const validateMealPlan = (plan: DayPlan[]): DayPlan[] => {
    if (!Array.isArray(plan)) {
      console.warn('Meal plan validation: plan is not an array', plan);
      return [];
    }
    
    const validDays = plan
      .filter(day => {
        if (!day || typeof day !== 'object') {
          console.warn('Meal plan validation: invalid day object', day);
          return false;
        }
        if (typeof day.date !== 'string' || !day.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          console.warn('Meal plan validation: invalid date format', day.date);
          return false;
        }
        return true;
      })
      .map(day => {
        const cleanMeal = (meal: any) => meal && meal.id && meal.recipe && meal.recipe.title;

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
      console.warn(`Meal plan validation: filtered out ${plan.length - validDays.length} invalid days`);
    }
    
    return validDays;
  };

  const setMealPlan = (newPlan: DayPlan[] | ((prev: DayPlan[]) => DayPlan[])) => {
    const planToSet = typeof newPlan === 'function' ? newPlan(mealPlanState) : newPlan;
    const validatedPlan = validateMealPlan(planToSet);
    setMealPlanState(validatedPlan);
  };

  const mealPlan = useMemo(() => mealPlanState, [mealPlanState]);

  const householdUnsubsRef = useRef<{ inventory?: (() => void) | null; shopping?: (() => void) | null; recipes?: (() => void) | null; mealPlan?: (() => void) | null }>({});

  const listenersReadyRef = useRef(false);

  const initialDataLoadedRef = useRef(false);

  const totalReadsRef = useRef(0);

  const prevHouseholdRef = useRef<Household | null>(null);

  const lastExpirationCheckRef = useRef<number>(0);

  const lastAllergyCheckRef = useRef<number>(0);

  const clientId = useMemo(() => {
    let id = localStorage.getItem('clientId');
    if (!id) {
      id = `client-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('clientId', id);
    }
    return id;
  }, []);

  // Firestore synchronization effects
  useEffect(() => {
    if (!user?.id) {
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
      
      InventoryCacheService.getCachedInventory(inHousehold ? user.householdId : undefined, inHousehold ? undefined : user.id)
        .then(cachedInventory => {
          if (cachedInventory.length > 0) {
            setInventory(cachedInventory);
            setIsLoadingInventory(false);
          }
      }).catch(err => log.error('Failed to load cached inventory', err, 'DataManagement'));

      unsubs.push(DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.doc(inventoryPath), snap => {
        if (snap.exists()) {
          const data = snap.data() as CachedInventoryData & CacheMetadata;
          if (data.version === InventoryCacheService.CACHE_VERSION) {
            const items: PantryItem[] = [];
            for (const itemId in data) {
              if (itemId !== 'lastUpdated' && itemId !== 'version' && itemId !== 'itemCount') {
                items.push(InventoryCacheService.arrayToPantryItem(itemId, data[itemId] as any));
              }
            }
            if (hasPantryItemsChanged(items, inventory)) {
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
    // Do not attach continuous community ratings listener here; refresh on demand when tab is activated
    
    unsubs.push(DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.doc(`users/${user.id}/cache/customCategories`), snap => {
      setCustomCategories(snap.exists() ? (snap.data()?.categories || []) : []);
    }, err => {
      log.error('Custom categories listener failed', err, 'DataManagement');
    }));

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
    if (!inventory.length || !user?.id) return;

    const today = new Date().toISOString().slice(0, 10);
    const expiredItems = inventory.filter(item => 
      item.expirationDate && item.expirationDate <= today
    );

    if (expiredItems.length > 0) {
      // This logic should probably be moved to a service
    }

    const now = Date.now();
    if (now - lastExpirationCheckRef.current > 5 * 60 * 1000) { // 5 minutes
      const runExpirationChecks = async () => {
        const itemsExpiringSoon = inventory.filter(item => {
          // Never notify or create alerts for immortal items
          if (item.is_immortal) return false;
          if (!item.expirationDate) return false;
          const daysUntilExpiry = Math.ceil((new Date(item.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          return daysUntilExpiry > 0 && daysUntilExpiry <= 7;
        });

        // Build danger-list for aggregation: prioritize items expiring within 3 days
        const dangerCandidates = itemsExpiringSoon.map(item => {
          const daysUntilExpiry = Math.ceil((new Date(item.expirationDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          return { itemId: item.id, itemName: item.item, daysUntilExpiry, risk_level: item.productRiskLevel };
        }).filter(x => x.daysUntilExpiry <= 3).slice(0, 6);

        try {
          // Ensure the currently authenticated user matches the `user` passed
          // into this hook. If they don't match (or auth not ready), skip
          // creating notifications to avoid Firestore permission-denied errors.
          if (!auth?.currentUser || auth.currentUser.uid !== user.id) {
            log.warn('Skipping expiration notifications: auth user mismatch', { expectedUid: user.id, actualUid: auth?.currentUser?.uid }, 'DataManagement');
          } else {
            if (dangerCandidates.length >= 2) {
              // Create a single aggregated Danger Zone notification
              await NotificationService.createDangerZoneAlert(user.id, dangerCandidates as any);
            } else {
              // Fallback to individual notifications for up to 3 items
              for (const item of itemsExpiringSoon.slice(0, 3)) {
                const daysUntilExpiry = Math.ceil((new Date(item.expirationDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                // pass user risk level to tailor priority
                // eslint-disable-next-line no-await-in-loop
                await NotificationService.createExpirationAlert(user.id, item.item, daysUntilExpiry, item.id, user?.profile?.riskLevel, item.category);
              }
            }
          }
        } catch (err) {
          log.error('Failed to create expiration notifications', err, 'DataManagement');
        } finally {
          lastExpirationCheckRef.current = Date.now();
        }
      };

      // Trigger the async checks without making the effect callback async
      void runExpirationChecks();
    }

  }, [inventory, user?.id, addToShoppingList, addToast]);

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

  useEffect(() => {
    if(isOnline) {
      offlineQueue.processQueue().then((processedCount: any) => {
          if (typeof processedCount === 'number' && processedCount > 0) {
            addToast?.(`Synced ${processedCount} offline changes.`, 'success');
          }
        });
    }
  }, [isOnline]);

  // Show risk questionnaire to new users shortly after first login
  useEffect(() => {
    if (!user) return;
    if (questionnaireShownRef.current) return;
    // Show when user hasn't set a riskLevel and hasn't seen tutorial yet
    if (!user.profile?.riskLevel && user.hasSeenTutorial === false) {
      setShowRiskQuestionnaire(true);
      questionnaireShownRef.current = true;
    }
  }, [user]);


  // Handlers
  const handleAddToPlan = async (recipe: any, targetDayIndex?: number, targetMealType?: 'breakfast' | 'lunch' | 'dinner') => {
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

    let dayIndex = targetDayIndex;
    let mealType = targetMealType || 'breakfast';

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
        if (user) await UsageService.recordMealPlanAddition(user);
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
    if (user) await UsageService.recordMealPlanAddition(user);
  };

  const checkRecipeSaveLimit = async () => {
    if (!user) return false;
    try {
      const canSave = await UsageService.canSaveRecipe(user, savedRecipes.length);
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
      const userId = inHousehold ? undefined : user.id;

      const savedRecipe: SavedRecipe = {
        id: `recipe-${Date.now()}`,
        ...recipe,
        dateSaved: new Date().toISOString()
      };

      await RecipesCacheService.addRecipeToCache(savedRecipe, householdId, userId);
      // Persist structured recipe into any existing rating documents for this recipe title
      // No-op: rating docs include recipe data at submit time, no client-side attachment needed.
      await UsageService.recordRecipeSave(user);

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
      const userId = inHousehold ? undefined : user.id;
      
      await RecipesCacheService.removeRecipeFromCache(recipe.id, householdId, userId);
      
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
      await RiskProfileService.setUserRiskLevel(user.id, level, sensitive);
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
          
      await DatabaseMonitoringService.updateDoc(DatabaseMonitoringService.doc(`users/${user.id}/cache/customCategories`), { categories: updatedCategories });

      addToast?.(`Created category "${name}"!`, 'success');
    } catch (err) {
      log.error('Error adding custom category:', err, 'DataManagement');
      addToast?.('Failed to create category. Please try again.', 'error');
    }
  };

  const updateCustomCategory = async (categoryId: string, updates: Partial<Pick<CustomCategory, 'name' | 'icon' | 'color'>>) => {
    if (!user?.id) return;
    // Omitted for brevity
  };

  const deleteCustomCategory = async (categoryId: string) => {
    if (!user?.id) return;
    // Omitted for brevity
  };

  const generateRecipeSuggestionsOnDemand = useCallback(() => {
    return generateRecipeSuggestions(inventory);
  }, [inventory]);

  const handleMarkAsMade = async (recipe: StructuredRecipe) => {
    // Omitted for brevity
  };

  const recordUndo = async (type: string, data: any) => {
    if (!user?.id) return;
    try {
      await undoService.recordAction({ type: type as any, data }, user.id);
      const actions = await undoService.getRecentActions(user.id);
      setRecentActions(actions);
    } catch (err) {
      log.error('Failed to record undo action:', err, 'DataManagement');
    }
  };

  const performUndo = async (action: any) => {
    // Omitted for brevity
  };

  const updateItem = async (index: number, updates: Partial<PantryItem>) => {
    const currentItem = inventory[index];
    if (!currentItem) return;

    await recordUndo('update_item', {
      itemId: currentItem.id,
      previousState: currentItem,
      updates
    });

    const updatedItem = { ...currentItem, ...updates, expiryAlertShown: shouldShowExpiryAlert({ ...currentItem, ...updates }) };

    setInventory(prev => prev.map((item, i) => i === index ? updatedItem : item));

    await InventoryCacheService.updateItemInCache(currentItem.id, updates, user?.householdId, user?.id);

    // Check if this is a staple item that needs to be re-added to shopping list
    if (updatedItem.isStaple && addToShoppingList) {
      const currentQuantity = getQuantityValue(updatedItem);
      const previousQuantity = getQuantityValue(currentItem);

      // If quantity dropped to zero or very low (and wasn't already zero), add to shopping list
      if (currentQuantity <= 0 && previousQuantity > 0) {
        addToShoppingList([updatedItem.item]);
      }
    }
  };

  const deleteItem = async (index: number) => {
    const itemToDelete = inventory[index];
    if (!itemToDelete) return;

    if (loggingOptions?.logItemRemoved) {
      loggingOptions.logItemRemoved(itemToDelete.item, itemToDelete.id);
    }

    await recordUndo('delete_item', itemToDelete);

    setInventory(prev => prev.filter((_, i) => i !== index));

    await InventoryCacheService.removeItemFromCache(itemToDelete.id, user?.householdId, user?.id);
  };

  const addItem = async (item: PantryItem) => {
    const itemWithAlert = { ...item, expiryAlertShown: shouldShowExpiryAlert(item) };

    setInventory(prev => [...prev, itemWithAlert]);

    if (loggingOptions?.logItemAdded) {
      loggingOptions.logItemAdded(item.item, item.id);
    }

    await InventoryCacheService.addItemToCache(itemWithAlert, user?.householdId, user?.id);
    HapticService.itemAdded();
  };

  const addItems = async (items: PantryItem[]) => {
    await InventoryCacheService.addItemsToCache(items, user?.householdId, user?.id);
  };

  const addShoppingListItem = async (item: Omit<ShoppingItem, 'id'>) => {
    if (!user?.id) return;
    const fullItem: ShoppingItem = { ...item, id: `shop-${Date.now()}`, addedAt: new Date() };
    await ShoppingListCacheService.addItemToCache(fullItem, user?.householdId, user?.id);
  };

  const addShoppingListItems = async (items: Omit<ShoppingItem, 'id' | 'addedAt'>[]) => {
    if (!user?.id || !items.length) return;
    const itemsWithIds = items.map(item => ({ ...item, id: `shop-${Date.now()}-${Math.random()}`, addedAt: new Date() }));
    await ShoppingListCacheService.addItemsToCache(itemsWithIds, user?.householdId, user?.id);
  };

  const updateShoppingListItem = async (itemId: string, updates: Partial<ShoppingItem>) => {
    if (!user?.id) return;
    await ShoppingListCacheService.updateItemsInCache([{ id: itemId, updates }], user?.householdId, user?.id);
  };

  const updateShoppingListItems = async (itemsToUpdate: { id: string, updates: Partial<ShoppingItem> }[]) => {
    if (!user?.id || !itemsToUpdate.length) return;
    await ShoppingListCacheService.updateItemsInCache(itemsToUpdate, user?.householdId, user?.id);
  };

  const removeShoppingListItem = async (itemId: string) => {
    if (!user?.id) return;
    await ShoppingListCacheService.removeItemsFromCache([itemId], user?.householdId, user?.id);
  };

  const removeShoppingListItems = async (itemIds: string[]) => {
    if (!user?.id || !itemIds.length) return;
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
      return snap.docs.map((d: any) => {
        const data = d.data() as any;
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
        return { ...data, id: d.id, date: dateStr } as RecipeRating;
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

      const mapped: RecipeRating[] = snap.docs.map((d: any) => {
        const data = d.data() as any;
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
        return { ...data, id: d.id, date: dateStr } as RecipeRating;
      });

      setRatings(mapped);
    } catch (err) {
      log.error('Failed to refresh community ratings', { err }, 'DataManagement');
    }
    setIsLoadingRatings(false);
  }, [user?.id]);

  const submitRating = async (ratingData: RecipeRatingInput) => {
    if (!user?.id) return;
    // Omitted for brevity
  };
  
  const addMealToPlan = async (date: string, mealType: 'breakfast' | 'lunch' | 'dinner', meal: MealPlanItem) => {
    if (!user?.id) return;
    try {
      await MealPlanCacheService.addMeal(date, mealType, meal, user?.householdId, user?.id);
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
      addToast?.('Removed meal from your plan!', 'success');
    } catch (err) {
      log.error('Error removing meal from plan:', err, 'DataManagement');
      addToast?.(ERROR_MESSAGES.DELETE_FAILED, 'error');
    }
  };

  const updateMealPlan = async (newPlan: DayPlan[]) => {
    if (!user?.id) return;
    try {
      // Set the meal plan locally for immediate UI update
      setMealPlan(newPlan);
      // Save the entire new meal plan to the cache
      await MealPlanCacheService.setCache(newPlan, user?.householdId, user?.id);
      addToast?.('Meal plan updated successfully!', 'success');
    } catch (err) {
      log.error('Error updating meal plan:', err, 'DataManagement');
      addToast?.(ERROR_MESSAGES.UPDATE_FAILED, 'error');
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
