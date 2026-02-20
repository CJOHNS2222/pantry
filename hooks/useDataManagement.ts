import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { collection, doc, serverTimestamp, query, where, Timestamp, deleteDoc, writeBatch, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import DatabaseMonitoringService from '../services/databaseMonitoringService';
import AnalyticsService from '../services/analyticsService';
import { UsageService } from '../services/usageService';
import { User, PantryItem, DayPlan, Household, ShoppingItem, SavedRecipe, RecipeRating, RecipeRatingInput, CustomCategory, MealPlanItem, StructuredRecipe, ConsumptionSuggestion, ExpirationAlert, RecipeSuggestion } from '../types';
import { AppError } from '../utils/errorUtils';
import { hasPantryItemsChanged, hasArraysChanged, hasMealPlansChanged } from '../utils/comparisonUtils';
import { setRemoteInventoryUpdate, isRemoteInventoryUpdate, setRemoteShoppingListUpdate, isRemoteShoppingListUpdate, setRemoteMealPlanUpdate, isRemoteMealPlanUpdate, setRemoteSavedRecipesUpdate } from '../services/syncStateService';
import { log } from '../services/logService';
import { generateConsumptionSuggestions, generateExpirationAlerts, generateRecipeSuggestions, isHouseholdMember } from '../utils/appUtils';
import { offlineQueue } from '../services/offlineQueueService';
import { undoService } from '../services/undoService';
import { NotificationService } from '../services/notificationService';
import { ERROR_MESSAGES } from '../constants/errorMessages';
import { useScopedDataListener } from './useDataListener';
import { firestoreCache } from '../services/cacheService';
import { HouseholdPreferenceService } from '../services/householdPreferenceService';
import { InventoryCacheService } from '../services/inventoryCacheService';
import { MealPlanCacheService } from '../services/mealPlanCacheService';
import { RecipesCacheService, CachedRecipesData, RecipesCacheMetadata } from '../services/recipesCacheService';
import { ShoppingListCacheService, CachedShoppingListData, ShoppingListCacheMetadata } from '../services/shoppingListCacheService';
import HapticService from '../services/hapticService';

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
  if (inHousehold) {
    ShoppingListCacheService.getCachedShoppingList(household.id).then(cachedItems => {
      if (cachedItems.length > 0) {
        setShoppingList(cachedItems);
        setIsLoadingShoppingList(false);
      }
    }).catch(err => {
      log.error('Failed to load cached shopping list', err, 'DataManagement');
    });

    const cachePath = `households/${household.id}/cache/shoppingList`;
    return DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.doc(cachePath), snap => {
      if (snap.exists()) {
        const data = snap.data() as CachedShoppingListData & ShoppingListCacheMetadata;
        if (data.version === ShoppingListCacheService.CACHE_VERSION) {
          const items: ShoppingItem[] = [];
          for (const [itemId, itemArray] of Object.entries(data)) {
            if (itemId !== 'lastUpdated' && itemId !== 'version' && itemId !== 'totalItems') {
              items.push(ShoppingListCacheService.objectToShoppingItem(itemId, itemArray as CachedShoppingListData[string]));
            }
          }
          const sortedItems = items.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
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
    ShoppingListCacheService.getCachedShoppingList(undefined, user.id).then(cachedItems => {
      if (cachedItems.length > 0) {
        setShoppingList(cachedItems);
        setIsLoadingShoppingList(false);
      }
    }).catch(err => {
      log.error('Failed to load cached shopping list', err, 'DataManagement');
    });

    const cachePath = `users/${user.id}/cache/shoppingList`;
    return DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.doc(cachePath), snap => {
      if (snap.exists()) {
        const data = snap.data() as CachedShoppingListData & ShoppingListCacheMetadata;
        if (data.version === ShoppingListCacheService.CACHE_VERSION) {
          const items: ShoppingItem[] = [];
          for (const [itemId, itemArray] of Object.entries(data)) {
            if (itemId !== 'lastUpdated' && itemId !== 'version' && itemId !== 'totalItems') {
              items.push(ShoppingListCacheService.objectToShoppingItem(itemId, itemArray as CachedShoppingListData[string]));
            }
          }
          const sortedItems = items.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
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
  if (inHousehold) {
    RecipesCacheService.getCachedRecipes(user.householdId).then(cachedRecipes => {
      if (cachedRecipes.length > 0) {
        setSavedRecipes(cachedRecipes);
        setIsLoadingSavedRecipes(false);
      }
    }).catch(err => {
      log.error('Failed to load cached recipes', err, 'DataManagement');
    });

    return DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.doc(`households/${user.householdId}/cache/savedRecipes`), snap => {
      if (snap.exists()) {
        const data = snap.data() as CachedRecipesData & RecipesCacheMetadata;
        if (data.version === RecipesCacheService.CACHE_VERSION) {
          const recipes: SavedRecipe[] = [];
          for (const [recipeId, recipeArray] of Object.entries(data)) {
            if (recipeId !== 'lastUpdated' && recipeId !== 'version' && recipeId !== 'totalRecipes') {
              recipes.push(RecipesCacheService.arrayToSavedRecipe(recipeId, recipeArray));
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
        log.error('Household saved recipes cache listener failed', err, 'DataManagement');
      }
      setIsLoadingSavedRecipes(false);
    });
  } else {
    RecipesCacheService.getCachedRecipes(user.id).then(cachedRecipes => {
      if (cachedRecipes.length > 0) {
        setSavedRecipes(cachedRecipes);
        setIsLoadingSavedRecipes(false);
      }
    }).catch(err => {
      log.error('Failed to load cached recipes', err, 'DataManagement');
    });

    return DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.doc(`users/${user.id}/cache/savedRecipes`), snap => {
      if (snap.exists()) {
        const data = snap.data() as CachedRecipesData & RecipesCacheMetadata;
        if (data.version === RecipesCacheService.CACHE_VERSION) {
          const recipes: SavedRecipe[] = [];
          for (const [recipeId, recipeArray] of Object.entries(data)) {
            if (recipeId !== 'lastUpdated' && recipeId !== 'version' && recipeId !== 'totalRecipes') {
              recipes.push(RecipesCacheService.arrayToSavedRecipe(recipeId, recipeArray));
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
        log.error('User saved recipes cache listener failed', err, 'DataManagement');
      }
      setIsLoadingSavedRecipes(false);
    });
  }
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
    if (snap.exists()) {
      const data = snap.data();
      if (data && data.version === '1.0') {
        const mealPlans: DayPlan[] = [];

        for (const [date, dayData] of Object.entries(data.days || {})) {
          if (dayData && typeof dayData === 'object') {
            const day = dayData as any;
            mealPlans.push({
              date,
              dayName: day.dayName || '',
              breakfast: Array.isArray(day.breakfast) ? day.breakfast : [],
              lunch: Array.isArray(day.lunch) ? day.lunch : [],
              dinner: Array.isArray(day.dinner) ? day.dinner : []
            });
          }
        }

        const sortedPlans = mealPlans.sort((a, b) => a.date.localeCompare(b.date));

        if (!hasMealPlansChanged(sortedPlans, prevMealPlanRef.current)) {
          setIsLoadingMealPlan(false);
          return;
        }

        setRemoteMealPlanUpdate(true);
        setMealPlan(sortedPlans);
        prevMealPlanRef.current = sortedPlans.map(day => ({
          ...day,
          breakfast: [...day.breakfast],
          lunch: [...day.lunch],
          dinner: [...day.dinner]
        }));

        setIsLoadingMealPlan(false);
      } else {
        console.warn('Meal plan cache version mismatch, ignoring');
        setIsLoadingMealPlan(false);
      }
    } else {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const today = new Date();

      let daysToShow = 7;
      if (user?.subscription?.tier === 'family') {
        daysToShow = 14;
      } else if (user?.subscription?.tier === 'premium') {
        daysToShow = 14;
      } else {
        daysToShow = 7;
      }

      const fullWeekPlan: DayPlan[] = [];
      for (let i = 0; i < daysToShow; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const iso = d.toISOString().slice(0, 10);
        fullWeekPlan.push({
          date: iso,
          dayName: days[d.getDay()],
          breakfast: [],
          lunch: [],
          dinner: []
        });
      }

      setMealPlan(fullWeekPlan);
      prevMealPlanRef.current = fullWeekPlan.map(day => ({
        ...day,
        breakfast: [...day.breakfast],
        lunch: [...day.lunch],
        dinner: [...day.dinner]
      }));

      setIsLoadingMealPlan(false);
    }
  }, err => {
    if (err.code !== 'permission-denied') {
      console.error("Meal plan cache listener failed:", err);
    }
    setIsLoadingMealPlan(false);
  });
}

export function useDataManagement(
  user: User | null,
  addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning', duration?: number) => void,
  addToShoppingList: (items: string[]) => void,
  updateSyncStatus: (status: string) => void,
  loggingOptions?: {
    logItemAdded?: (item: string) => void;
    logItemRemoved?: (item: string) => void;
    logShoppingAdded?: (item: string) => void;
    logRecipeSaved?: (recipe: string) => void;
    logMealCompleted?: (meal: string) => void;
  },
  options?: {
    disableInventoryListeners?: boolean;
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

  // Undo actions
  const [recentActions, setRecentActions] = useState<any[]>([]);

  // Online status
  const [isOnline, setIsOnline] = useState(true);

  // Retry counter for household listener permissions issues
  const [householdListenerRetry, setHouseholdListenerRetry] = useState(0);

  // Writing state refs to prevent concurrent operations
  const writingMealPlanRef = useRef(false);
  const mealPlanCleanupDoneRef = useRef(false);

  // Ref to track last shopping list collection path for sync
  const lastShoppingListCollectionPathRef = useRef<string>();

  // Ref to prevent repeated household clearing on permission errors
  const householdClearedDueToPermissionsRef = useRef(false);

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
    if (!isOnline) {
      await offlineQueue.enqueue(operation);
      if (updateSyncStatus) {
        updateSyncStatus((prev: any) => ({
          ...prev,
          pendingOperations: prev.pendingOperations + 1
        }));
      }
      addToast('Change queued for when you\'re back online.', 'info');
    } else {
      if (operation.type === 'add') {
        await DatabaseMonitoringService.addDoc(DatabaseMonitoringService.collection(operation.collection), operation.data);
      } else if (operation.type === 'update' && operation.docId) {
        await DatabaseMonitoringService.setDoc(DatabaseMonitoringService.doc(operation.collection, operation.docId), operation.data);
      } else if (operation.type === 'delete' && operation.docId) {
        await DatabaseMonitoringService.deleteDoc(DatabaseMonitoringService.doc(operation.collection, operation.docId));
      }
      
      firestoreCache.invalidateCollection(operation.collection);
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
        let breakfast: MealPlanItem[] = [];
        let lunch: MealPlanItem[] = [];
        let dinner: MealPlanItem[] = [];
        
        if (day.breakfast && Array.isArray(day.breakfast)) {
          breakfast = day.breakfast.filter(meal => {
            if (!meal || !meal.id || !meal.recipe || !meal.recipe.title) {
              console.warn('Meal plan validation: invalid breakfast meal object', meal);
              return false;
            }
            return true;
          });
        }
        
        if (day.lunch && Array.isArray(day.lunch)) {
          lunch = day.lunch.filter(meal => {
            if (!meal || !meal.id || !meal.recipe || !meal.recipe.title) {
              console.warn('Meal plan validation: invalid lunch meal object', meal);
              return false;
            }
            return true;
          });
        }
        
        if (day.dinner && Array.isArray(day.dinner)) {
          dinner = day.dinner.filter(meal => {
            if (!meal || !meal.id || !meal.recipe || !meal.recipe.title) {
              console.warn('Meal plan validation: invalid dinner meal object', meal);
              return false;
            }
            return true;
          });
        }
        
        return {
          date: day.date,
          dayName: day.dayName || 'Unknown',
          breakfast,
          lunch,
          dinner
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    
    if (validDays.length !== plan.length) {
      console.warn(`Meal plan validation: filtered out ${plan.length - validDays.length} invalid days`);
    }
    
    return validDays;
  };

  const setMealPlan = (newPlan: DayPlan[] | ((prev: DayPlan[]) => DayPlan[])) => {
    const planToSet = typeof newPlan === 'function' ? newPlan(mealPlan) : newPlan;
    const validatedPlan = validateMealPlan(planToSet);
    setMealPlanState(validatedPlan);
  };

  const mealPlan = useMemo(() => validateMealPlan(mealPlanState), [mealPlanState]);

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
      unsubs.push(DatabaseMonitoringService.onSnapshot(doc(db, 'households', user.householdId), snap => {
        if (snap.exists()) {
          let householdData = { id: snap.id, ...snap.data() } as Household;
          
          const membersIsArray = Array.isArray(householdData.members);
          const membersIsEmpty = membersIsArray && householdData.members.length === 0;
          const membersIsMap = householdData.members && typeof householdData.members === 'object' && !membersIsArray;
          const needsPopulation = !householdData.members || !membersIsArray || membersIsEmpty || membersIsMap;
          
          if (needsPopulation && householdData.memberIds && householdData.memberIds.length > 0) {
            const uniqueMemberIds = [...new Set(householdData.memberIds)];
              console.log('Processing memberIds:', uniqueMemberIds);

              if (membersIsMap && householdData.members) {
                const mapMembers = householdData.members as Record<string, any>;
                const convertedMembers: Member[] = [];

                for (const memberId of uniqueMemberIds) {
                  if (mapMembers[memberId]) {
                    let memberName = mapMembers[memberId].name || mapMembers[memberId].email || 'Unknown';

                    if (memberName === memberId || (memberName.length > 20 && memberName.match(/^[a-zA-Z0-9_-]+$/))) {
                      memberName = mapMembers[memberId].email?.split('@')[0] || `Member ${memberId.slice(0, 8)}`;
                    }

                    convertedMembers.push(cleanObject({
                      id: memberId,
                      name: memberName,
                      email: mapMembers[memberId].email || '',
                      avatar: mapMembers[memberId].avatar,
                      role: mapMembers[memberId].role || (memberId === user?.id ? 'admin' : 'member'),
                      status: mapMembers[memberId].status || 'active',
                      joinedAt: mapMembers[memberId].joinedAt || new Date().toISOString(),
                      lastSeen: mapMembers[memberId].lastSeen,
                      currentActivity: mapMembers[memberId].currentActivity,
                      isOnline: mapMembers[memberId].isOnline,
                      dietaryRestrictions: mapMembers[memberId].dietaryRestrictions,
                      allergies: mapMembers[memberId].allergies,
                      specialNeeds: mapMembers[memberId].specialNeeds
                    }));
                  }
                }

                if (convertedMembers.length > 0) {
                  householdData.members = convertedMembers;
                  console.log('Converted household members from map to array format');
                }
              }

              if (!Array.isArray(householdData.members) || householdData.members.length === 0) {
                console.log('Creating basic member entries for household with no members array');

                const basicMembers = uniqueMemberIds.map(memberId => {
                  if (memberId === user?.id) {
                    return {
                      id: memberId,
                      name: user?.name || user?.email?.split('@')[0] || 'You',
                      email: user?.email || '',
                      avatar: user?.avatar,
                      role: 'admin',
                      status: 'active',
                      joinedAt: new Date().toISOString(),
                      lastSeen: new Date().toISOString(),
                      currentActivity: undefined,
                      isOnline: true,
                      dietaryRestrictions: user?.profile?.dietaryRestrictions || [],
                      allergies: user?.profile?.allergies || [],
                      specialNeeds: user?.profile?.specialNeeds
                    } as Member;
                  }

                  return {
                    id: memberId,
                    name: `Member ${memberId.slice(0, 8)}`,
                    email: '',
                    avatar: undefined,
                    role: 'member',
                    status: 'active',
                    joinedAt: new Date().toISOString(),
                    lastSeen: undefined,
                    currentActivity: undefined,
                    isOnline: false,
                    dietaryRestrictions: [],
                    allergies: [],
                    specialNeeds: undefined
                  } as Member;
                });

                householdData.members = basicMembers;
              }

              if (Array.isArray(householdData.members) && householdData.members.length > 0 && user?.id) {
                const currentUserMember = householdData.members.find(m => m.id === user.id);
                if (currentUserMember && currentUserMember.role !== 'admin') {
                  console.log('Updating current user role to admin');
                  currentUserMember.role = 'admin';
                }
              }
            }
          
          const hasChanged = !prevHouseholdRef.current ||
            householdData.id !== prevHouseholdRef.current.id ||
            householdData.name !== prevHouseholdRef.current.name ||
            householdData.ownerId !== prevHouseholdRef.current.ownerId ||
            JSON.stringify(householdData.memberIds || []) !== JSON.stringify(prevHouseholdRef.current.memberIds || []) ||
            JSON.stringify(householdData.members || []) !== JSON.stringify(prevHouseholdRef.current.members || []);
          if (hasChanged) {
            if (householdData.memberIds && Array.isArray(householdData.memberIds)) {
              const uniqueMemberIds = Array.from(new Set(householdData.memberIds));
              if (uniqueMemberIds.length !== householdData.memberIds.length) {
                console.warn('Found duplicate memberIds, cleaning up:', householdData.memberIds, '->', uniqueMemberIds);
                householdData.memberIds = uniqueMemberIds;
              }
            }
            
            prevHouseholdRef.current = householdData;
            console.log('Setting household state:', householdData);
            setHousehold(householdData);
          }
        }
        setIsLoadingHousehold(false);
        if (householdListenerRetry > 0) {
          setHouseholdListenerRetry(0);
        }
      }, err => {
        if (err.code !== 'permission-denied') {
          console.error("Household document listener failed:", err);
        }
        
        if (err.code === 'permission-denied' && !householdClearedDueToPermissionsRef.current) {
          console.log('Permission denied on household listener - clearing household state');
          householdClearedDueToPermissionsRef.current = true;
          setHousehold(null);
          setIsLoadingHousehold(false);
          if (householdListenerRetry > 0) {
            setHouseholdListenerRetry(0);
          }
        } else if (user?.householdId && householdListenerRetry < 3) {
          console.log(`Retrying household listener due to error (attempt ${householdListenerRetry + 1}/3)`);
          setTimeout(() => {
            setHouseholdListenerRetry(prev => prev + 1);
          }, 1000);
        } else {
          setIsLoadingHousehold(false);
        }
      }));
    } else {
      setHousehold(null);
      setIsLoadingHousehold(false);
    }

    const inHousehold = !!user?.householdId;

    if (!options?.disableInventoryListeners) {
      if (user?.householdId) {
        InventoryCacheService.getCachedInventory(user.householdId).then(cachedInventory => {
          if (cachedInventory.length > 0) {
            setInventory(cachedInventory);
            setIsLoadingInventory(false);
          }
        }).catch(err => {
          log.error('Failed to load cached inventory', err, 'DataManagement');
        });

        unsubs.push(DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.doc(`households/${user.householdId}/cache/inventory`), snap => {
          if (snap.exists()) {
            const data = snap.data() as CachedInventoryData & CacheMetadata;
            if (data.version === InventoryCacheService.CACHE_VERSION) {
              const items: PantryItem[] = [];
              for (const [itemId, itemArray] of Object.entries(data)) {
                if (itemId !== 'lastUpdated' && itemId !== 'version' && itemId !== 'itemCount') {
                  items.push(InventoryCacheService.arrayToPantryItem(itemId, itemArray as string[]));
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
            console.error("Household inventory listener failed:", err);
          }
          setIsLoadingInventory(false);
        }));
      } else {
        InventoryCacheService.getCachedInventory(user.id).then(cachedInventory => {
          if (cachedInventory.length > 0) {
            setInventory(cachedInventory);
            setIsLoadingInventory(false);
          }
        }).catch(err => {
          log.error('Failed to load cached inventory', err, 'DataManagement');
        });

        unsubs.push(DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.doc(`users/${user.id}/cache/inventory`), snap => {
          if (snap.exists()) {
            const data = snap.data() as CachedInventoryData & CacheMetadata;
            if (data.version === InventoryCacheService.CACHE_VERSION) {
              const items: PantryItem[] = [];
              for (const [itemId, itemArray] of Object.entries(data)) {
                if (itemId !== 'lastUpdated' && itemId !== 'version' && itemId !== 'itemCount') {
                  items.push(InventoryCacheService.arrayToPantryItem(itemId, itemArray as string[]));
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
            log.error('Failed to update inventory cache', err, 'useDataManagement');
          }));
      }
    } else {
      setIsLoadingInventory(false);
      initialDataLoadedRef.current = true;
    }

    unsubs.push(createShoppingListListener(user, household, inHousehold, setShoppingList, setIsLoadingShoppingList, prevShoppingListRef));
    unsubs.push(createSavedRecipesListener(user, household, inHousehold, setSavedRecipes, setIsLoadingSavedRecipes, prevSavedRecipesRef));
    unsubs.push(createMealPlanListener(user, household, inHousehold, setMealPlan, setIsLoadingMealPlan, prevMealPlanRef));
    
    unsubs.push(DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.doc(`users/${user.id}/cache/customCategories`), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setCustomCategories(data.categories || []);
      } else {
        setCustomCategories([]);
      }
    }, err => {
      log.error('Custom categories listener failed', err, 'DataManagement');
    }));


    sessionStorage.setItem('listenersSetUp', 'true');

    return () => {
      unsubs.forEach(unsub => unsub());
      sessionStorage.removeItem('listenersSetUp');
    };
  }, [user?.id, user?.householdId, householdListenerRetry]);

  useEffect(() => {
    listenersReadyRef.current = true;
    initialDataLoadedRef.current = false;
    return () => {
      listenersReadyRef.current = false;
      initialDataLoadedRef.current = false;
    };
  }, [user?.id, user?.householdId, householdListenerRetry]);

  useEffect(() => {
    if (!inventory.length || !user?.id) return;

    const today = new Date().toISOString().slice(0, 10);
    const expiredItems = inventory.filter(item => 
      item.expirationDate && item.expirationDate <= today
    );

    if (expiredItems.length > 0) {
      expiredItems.forEach(async (item) => {
        const daysUntilExpiry = Math.ceil((new Date(item.expirationDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        await NotificationService.createExpirationAlert(user.id, item.item, daysUntilExpiry, item.id);
      });

      const itemNames = expiredItems.map(item => item.item);

      addToShoppingList(itemNames);

      addToast(
        `${expiredItems.length} item${expiredItems.length > 1 ? 's' : ''} expired and ${expiredItems.length > 1 ? 'were' : 'was'} added to your shopping list: ${expiredItems.map(item => item.item).join(', ')}`,'info',
        8000
      );

      setInventory(prev => prev.filter(item => 
        !expiredItems.some(expired => expired.id === item.id)
      ));
    }

    const itemsExpiringSoon = inventory.filter(item => {
      if (!item.expirationDate) return false;
      const daysUntilExpiry = Math.ceil((new Date(item.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry > 0 && daysUntilExpiry <= 7;
    });

    const now = Date.now();
    if (now - lastExpirationCheckRef.current > 5 * 60 * 1000) { // 5 minutes
      itemsExpiringSoon.slice(0, 3).forEach(async (item) => {
        const daysUntilExpiry = Math.ceil((new Date(item.expirationDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        await NotificationService.createExpirationAlert(user.id, item.item, daysUntilExpiry, item.id);
      });
      lastExpirationCheckRef.current = now;
    }

  }, [inventory, user?.id, addToShoppingList, addToast]);

  useEffect(() => {
    if (!inventory.length || !user?.id || !household?.id) return;

    const now = Date.now();
    if (now - lastAllergyCheckRef.current < 5 * 60 * 1000) { // 5 minutes
      return;
    }

    const checkAllergies = async () => {
      try {
        await HouseholdPreferenceService.checkHouseholdInventoryForAllergies(
          household.id,
          inventory,
          user.id
        );
        lastAllergyCheckRef.current = now;
      } catch (err: any) {
        console.error('Failed to check household inventory for allergies:', error);
      }
    };

    checkAllergies();
  }, [inventory, user?.id, household?.id]);

  useEffect(() => {
    if (!user?.id || !mealPlan.length || !shoppingList.length) return;

    const today = new Date().toISOString().slice(0, 10);
    const lastDailyNotification = localStorage.getItem('lastDailyNotification');

    if (lastDailyNotification === today) return;

    const todayPlan = mealPlan.find(day => day.date === today);
    const todaysMeals = todayPlan ? [
      ...(todayPlan.breakfast || []),
      ...(todayPlan.lunch || []),
      ...(todayPlan.dinner || [])
    ] : [];

    const shoppingCount = shoppingList.length;
    const urgentItems = shoppingList
      .filter(item => item.priority === 'urgent' || item.priority === 'high')
      .map(item => item.item)
      .slice(0, 3);

    if (todaysMeals.length > 0 || shoppingCount > 0) {
      NotificationService.createDailyCombinedNotification(
        user.id,
        todaysMeals,
        shoppingCount,
        urgentItems
      ).catch(error => {
        console.error('Failed to create daily combined notification:', error);
      });

      localStorage.setItem('lastDailyNotification', today);
    }
  }, [user?.id, mealPlan, shoppingList]);

  useEffect(() => {
    if (!user?.id || !listenersReadyRef.current || !initialDataLoadedRef.current) return;
    if (isRemoteMealPlanUpdate() || isRemoteInventoryUpdate()) {
      return;
    }

    if (import.meta.hot) return;

    const timeoutId = setTimeout(async () => {
      if (mealPlanSyncInProgress) return;
      mealPlanSyncInProgress = true;
      const inHousehold = user?.householdId && (!household?.id || isHouseholdMember(household, user));

      writingMealPlanRef.current = true;
      try {
        if (inHousehold) {
          const householdWrites: Promise<any>[] = [];
          const householdResults = await Promise.allSettled(householdWrites);
          householdResults.forEach((res, idx) => {
            if (res.status === 'rejected' || (res.status === 'fulfilled' && (res.value as any)?.err)) {
              console.error('Household write failed:', res);
              
              const error = res.status === 'rejected' ? res.reason : (res.value as any)?.err;
              if (error?.code === 'permission-denied') {
                log.warn('Permission denied on household write - clearing household state', { userId: user.id }, 'useDataManagement');
                setHousehold(null);
              } else {
                addToast(ERROR_MESSAGES.SAVE_FAILED, 'error');
              }
            }
          });
        } else {
          try {
            await InventoryCacheService.addItemsToCache(inventory, undefined, user.id);
          } catch (err) {
            log.error('Failed to update user inventory cache', err, 'useDataManagement');
            addToast(ERROR_MESSAGES.SAVE_FAILED, 'error');
          }
        }
      } finally {
        writingMealPlanRef.current = false;
        mealPlanSyncInProgress = false;
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
    }, [user?.id, user?.householdId, inventory, savedRecipes]);

  const syncShoppingListToDatabase = async () => {
    if (!user?.id || !shoppingList) return;

    const inHousehold = !!user?.householdId;

    try {
      if (inHousehold) {

      } else {
        for (const item of shoppingList) {
          await ShoppingListCacheService.addItemToCache(item, undefined, user.id);
        }
        prevShoppingListRef.current = shoppingList.map(item => ({ ...item }));
        log.debug('Shopping list cache synced successfully', { count: shoppingList.length }, 'useDataManagement');
      }
    } catch (err: any) {
      console.error('Error syncing shopping list:', err);
      log.error('Failed to sync shopping list', { error }, 'useDataManagement');
    }
  };

  useEffect(() => { localStorage.setItem('mealPlan', JSON.stringify(mealPlan)); }, [mealPlan]);
  useEffect(() => { localStorage.setItem('household', JSON.stringify(household)); }, [household]);

  useEffect(() => {
    if (household !== null) {
      setIsLoadingHousehold(false);
    }
  }, [household]);

  const prevUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentUserId = user?.id || null;
    const prevUserId = prevUserIdRef.current;

    if (prevUserId && prevUserId !== currentUserId) {
      undoService.clearUserActions(prevUserId).catch(console.error);
    }

    if (currentUserId) {
      undoService.getRecentActions(currentUserId).then(actions => setRecentActions(actions)).catch(console.error);
    } else {
      setRecentActions([]);
    }

    prevUserIdRef.current = currentUserId;
  }, [user?.id]);

  // Handlers
  const handleAddToPlan = async (recipe: any, targetDayIndex?: number, targetMealType?: 'breakfast' | 'lunch' | 'dinner') => {
    if (!mealPlan) return;

    const canAdd = await checkMealPlanLimit();
    if (!canAdd) {
      addToast(ERROR_MESSAGES.PLANNING_LIMIT_REACHED, 'error');
      return;
    }

    let dayIndex = targetDayIndex;
    let mealType = targetMealType || 'breakfast';

    if (dayIndex === undefined) {
      const today = new Date().toISOString().slice(0, 10);
      dayIndex = mealPlan.findIndex(day => day.date === today);
      // If today is not found, default to the first available day
      if (dayIndex === -1 && mealPlan.length > 0) {
        dayIndex = 0;
      }
    }
    
    if (dayIndex === undefined || dayIndex < 0 || dayIndex >= mealPlan.length) {
      // If mealPlan is empty, create a new day for tomorrow and add the meal there
      if (!mealPlan.length) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().slice(0, 10);
        const newDay = {
          date: dateStr,
          dayName: tomorrow.toLocaleDateString(undefined, { weekday: 'long' }),
          breakfast: [],
          lunch: [],
          dinner: []
        };
        const mealTypeToUse = targetMealType || 'breakfast';
        const newMeal = {
          id: `meal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          recipe: recipe,
          mealType: mealTypeToUse
        };
        newDay[mealTypeToUse] = [newMeal];
        await addMealToPlan(dateStr, mealTypeToUse, newMeal);
        AnalyticsService.trackMealPlanAdd(recipe.id || recipe.title, recipe.title, mealTypeToUse, 0);
        if (user) await UsageService.recordMealPlanAddition(user);
        return;
      }
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
    } catch (err: any) {
      console.error('Error checking recipe save limit:', error);
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
    } catch (err: any) {
      console.error('Error checking meal plan limit:', error);
      return false;
    }
  };

  const handleSaveRecipe = async (recipe: StructuredRecipe) => {
    if (!user?.id) {
      return;
    }

    if (recipeSaveLimitExceeded) {
      addToast('You have reached the maximum number of saved recipes for your plan. Please upgrade to save more recipes.', 'error');
      return;
    }

    try {
      const inHousehold = isHouseholdMember(household, user) && household?.id;
      const householdId = inHousehold ? household.id : undefined;
      const userId = inHousehold ? undefined : user.id;
      console.log('🔍 Saving recipe to cache:', { householdId, userId });

      const currentRecipes = await RecipesCacheService.getCachedRecipes(householdId, userId);
      const existingRecipe = currentRecipes.find(r => r.title === recipe.title);

      let isDuplicate = false;
      if (existingRecipe) {
        const ingredientsMatch = existingRecipe.ingredients?.length === recipe.ingredients?.length;
        const instructionsMatch = existingRecipe.instructions?.length === recipe.instructions?.length;
        if (ingredientsMatch && instructionsMatch) {
          console.log('⚠️ Found very similar recipe:', existingRecipe.title, 'with same structure');
          isDuplicate = true;
        }
      }

      if (isDuplicate || existingRecipe) {
        addToast(`"${recipe.title}" is already saved in your recipes!`, 'info');
        return;
      }

      console.log('✅ No duplicate found, proceeding with save...');

      const canSave = await checkRecipeSaveLimit();
      if (!canSave) {
        addToast('You have reached the maximum number of saved recipes for your plan. Please upgrade to save more recipes.', 'error');
        return;
      }

      const recipeId = Math.random().toString(36).substr(2, 9);

      const savedRecipe: SavedRecipe = {
        id: recipeId,
        ...recipe,
        dateSaved: new Date().toISOString()
      };

      await RecipesCacheService.addRecipeToCache(savedRecipe, householdId, userId);
      console.log('✅ Recipe saved to cache with ID:', recipeId);

      try {
        await UsageService.recordRecipeSave(user);
      } catch (err: any) {
        console.error('Error recording recipe save usage:', error);
      }

      addToast(`Saved ${recipe.title} to your recipes!`);
    } catch (err: any) {
      console.error('Error saving recipe:', error);

      let errorMessage = 'Failed to save recipe. Please try again.';

      if (error instanceof AppError) {
        errorMessage = error.userMessage;
      } else if (error instanceof Error) {
        if (error.message.includes('permission-denied')) {
          errorMessage = 'You don\'t have permission to save recipes. Please check your account.';
        } else if (error.message.includes('quota-exceeded')) {
          errorMessage = 'Storage quota exceeded. Please free up some space and try again.';
        }
      }

      addToast(errorMessage, 'error');
    }
  };

  const handleDeleteRecipe = async (recipe: SavedRecipe) => {
    if (!user?.id) return;
    try {
      const inHousehold = isHouseholdMember(household, user) && household?.id;
      const householdId = inHousehold ? household.id : undefined;
      const userId = inHousehold ? undefined : user.id;
      
      await RecipesCacheService.removeRecipeFromCache(recipe.id, householdId, userId);
      
      addToast(`Removed ${recipe.title} from your saved recipes.`);
    } catch (err: any) {
      console.error('Error deleting recipe:', error);
      addToast('Failed to delete recipe. Please try again.', 'error');
    }
  };

const addCustomCategory = async (name: string, icon: string, color?: string) => {
  if (!user?.id) return;
  try {
    const { createCustomCategory, validateCustomCategory } = await import('../utils/appUtils');
    
    const validation = validateCustomCategory(name, icon, customCategories);
    if (!validation.valid) {
      addToast(validation.error!, 'error');
      return;
    }

    const newCategory = createCustomCategory(name, icon, color, user.id);
    
    const cachePath = `users/${user.id}/cache/customCategories`;
    const cacheRef = DatabaseMonitoringService.doc(cachePath);
    const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);
    
    const currentCategories = docSnap.exists() ? (docSnap.data().categories || []) : [];
    const updatedCategories = [...currentCategories, newCategory];
    
    await DatabaseMonitoringService.setDoc(cacheRef, { categories: updatedCategories }, { merge: true });

    addToast(`Created category "${name}"!`);
  } catch (err: any) {
    console.error('Error adding custom category:', err);
    addToast('Failed to create category. Please try again.', 'error');
  }
};

const updateCustomCategory = async (categoryId: string, updates: Partial<Pick<CustomCategory, 'name' | 'icon' | 'color'>>) => {
  if (!user?.id) return;
  try {
    const { validateCustomCategory } = await import('../utils/appUtils');
    
    const category = customCategories.find(cat => cat.id === categoryId);
    if (!category) return;

    const updatedCategory = { ...category, ...updates };
    const validation = validateCustomCategory(updatedCategory.name, updatedCategory.icon, 
      customCategories.filter(cat => cat.id !== categoryId));
    
    if (!validation.valid) {
      addToast(validation.error!, 'error');
      return;
    }

    const cachePath = `users/${user.id}/cache/customCategories`;
    const cacheRef = DatabaseMonitoringService.doc(cachePath);
    const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);

    const currentCategories = docSnap.exists() ? (docSnap.data().categories || []) : [];
    const updatedCategories = currentCategories.map(cat => 
      cat.id === categoryId ? updatedCategory : cat
    );

    await DatabaseMonitoringService.setDoc(cacheRef, { categories: updatedCategories }, { merge: true });

    addToast(`Updated category "${updatedCategory.name}"!`);
  } catch (err: any) {
    console.error('Error updating custom category:', err);
    addToast('Failed to update category. Please try again.', 'error');
  }
};

const deleteCustomCategory = async (categoryId: string) => {
  if (!user?.id) return;
  try {
    const category = customCategories.find(cat => cat.id === categoryId);
    if (!category) return;

    const itemsUsingCategory = inventory.filter(item => item.category === category.name);
    if (itemsUsingCategory.length > 0) {
      addToast(`Cannot delete category "${category.name}" - it's being used by ${itemsUsingCategory.length} item(s). Please reassign items first.`, 'error');
      return;
    }

    const cachePath = `users/${user.id}/cache/customCategories`;
    const cacheRef = DatabaseMonitoringService.doc(cachePath);
    const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);

    const currentCategories = docSnap.exists() ? (docSnap.data().categories || []) : [];
    const updatedCategories = currentCategories.filter(cat => cat.id !== categoryId);

    await DatabaseMonitoringService.setDoc(cacheRef, { categories: updatedCategories }, { merge: true });

    addToast(`Deleted category "${category.name}"!`);
  } catch (err: any) {
    console.error('Error deleting custom category:', err);
    addToast('Failed to delete category. Please try again.', 'error');
  }
};

  const generateRecipeSuggestionsOnDemand = useCallback(() => {
    return generateRecipeSuggestions(inventory);
  }, [inventory]);

  const handleMarkAsMade = async (recipe: StructuredRecipe) => {
    try {
      const ingredientsToConsume = recipe.ingredients.map(ing => {
        const parsed = parseIngredientForShoppingList(ing);
        return {
          item: parsed.itemName,
          quantity: parsed.quantity,
          unit: 'count'
        };
      });

      setInventory(prev => {
        return prev.map(item => {
          const consumedIngredient = ingredientsToConsume.find(ing => 
            ing.item.toLowerCase() === item.item.toLowerCase()
          );
          
          if (consumedIngredient) {
            const updatedReservations = item.reservations?.filter(res => 
              res.recipeName !== recipe.title
            ) || [];
            
            const currentAmount = item.quantity ? item.quantity.amount : parseInt(item.quantity_estimate) || 1;
            const consumedAmount = parseFloat(consumedIngredient.quantity) || 0;
            const newAmount = Math.max(0, currentAmount - consumedAmount);
            
            if (item.quantity) {
              return {
                ...item,
                quantity: {
                  ...item.quantity,
                  amount: newAmount
                },
                reservations: updatedReservations.length > 0 ? updatedReservations : undefined
              };
            } else {
              return {
                ...item,
                quantity_estimate: newAmount.toString(),
                reservations: updatedReservations.length > 0 ? updatedReservations : undefined
              };
            }
          }
          
          return item;
        });
      });

      addToast(`Marked "${recipe.title}" as made! Ingredients have been subtracted from your pantry.`);
      
    } catch (err: any) {
      console.error('Error marking recipe as made:', error);
      addToast('Failed to mark recipe as made. Please try again.', 'error');
    }
  };

  const recordUndo = async (type: string, data: any) => {
    if (!user?.id) return;
    try {
      await undoService.recordAction({ type, data }, user.id);
      const actions = await undoService.getRecentActions(user.id);
      setRecentActions(actions);
    } catch (err: any) {
      console.error('Failed to record undo action:', error);
    }
  };

  const performUndo = async (action: any) => {
    try {
      const undoOp = await undoService.undoAction(action);
      if (undoOp) {
        if (undoOp.type === 'restore_item') {
          if (undoOp.data && typeof undoOp.data === 'object' && undoOp.data.id) {
            const restoredItem = {
              ...undoOp.data,
              consumptionHistory: undoOp.data.consumptionHistory || []
            };
            setInventory(prev => [...prev, restoredItem]);
          } else {
            console.warn('Invalid item data in undo operation:', undoOp.data);
            addToast('Unable to restore item - invalid data', 'error');
            return;
          }
        } else if (undoOp.type === 'revert_edit') {
          const { itemId, previousState } = undoOp.data;
          const currentIndex = inventory.findIndex(item => item.id === itemId);
          if (currentIndex !== -1 && previousState && typeof previousState === 'object' && previousState.id) {
            const revertedItem = {
              ...previousState,
              consumptionHistory: previousState.consumptionHistory || []
            };
            setInventory(prev => {
              const updated = [...prev];
              updated[currentIndex] = revertedItem;
              return updated;
            });
          } else {
            console.warn('Invalid revert data or item not found:', undoOp.data);
            addToast('Unable to revert edit - item not found or invalid data', 'error');
            return;
          }
        }
        await undoService.removeAction(action.id);
        const actions = await undoService.getRecentActions(user?.id || '');
        setRecentActions(actions);
        addToast('Action undone', 'info');
      } else {
        console.warn('No undo operation returned for action:', action);
      }
    } catch (err: any) {
      console.error('Failed to undo action:', error);
      addToast('Failed to undo action', 'error');
    }
  };

  const updateItem = async (index: number, updates: Partial<PantryItem>) => {
    const currentItem = inventory[index];
    if (!currentItem) return;

    await recordUndo('update_item', {
      itemId: currentItem.id,
      previousState: currentItem,
      updates
    });

    let updatedItemForDB: PantryItem;
    setInventory(prev => {
      const updated = [...prev];
      const updatedItem = { ...updated[index], ...updates };
      if (updates.expirationDate !== undefined || updates.expirationType !== undefined) {
        updatedItem.expiryAlertShown = shouldShowExpiryAlert(updatedItem);
      }
      updated[index] = updatedItem;
      updatedItemForDB = updatedItem;
      return updated;
    });

    await InventoryCacheService.updateItemInCache(currentItem.id, updates, user?.householdId, user?.id);
  };

  const deleteItem = async (index: number) => {
    const itemToDelete = inventory[index];
    if (!itemToDelete) return;

    if (loggingOptions?.logItemRemoved && household?.id && isHouseholdMember(household, user) &&
        (Array.isArray(household.memberIds) ? household.memberIds.length > 1 : false)) {
      loggingOptions.logItemRemoved(itemToDelete.item, itemToDelete.id);
    }

    await recordUndo('delete_item', itemToDelete);

    setInventory(prev => prev.filter((_, i) => i !== index));

    await InventoryCacheService.removeItemFromCache(itemToDelete.id, user?.householdId, user?.id);
  };

  const addItem = async (item: PantryItem) => {
    const itemWithAlert = {
      ...item,
      expiryAlertShown: shouldShowExpiryAlert(item)
    };

    setInventory(prev => [...prev, itemWithAlert]);

    if (loggingOptions?.logItemAdded && household?.id && isHouseholdMember(household, user) &&
        (Array.isArray(household.memberIds) ? household.memberIds.length > 1 : false)) {
      loggingOptions.logItemAdded(item.item, item.id);
    }

    await InventoryCacheService.addItemToCache(itemWithAlert, user?.householdId, user?.id);

    HapticService.itemAdded();
  };

  const addItems = async (items: PantryItem[]) => {

    const itemsToAdd: PantryItem[] = [];
    const itemsToUpdate: { index: number, updates: Partial<PantryItem> }[] = [];

    items.forEach(item => {
      const normalizeItemName = (name: string) => {
        return name.toLowerCase()
          .trim()
          .replace(/\s+/g, ' ')
          .replace(/[^\w\s]/g, '')
          .replace(/\b\d+\s*(?:%|percent|oz|lb|g|kg|ml|l|cup|cups|tbsp|tsp|qt|gal|pint|pints)\b/g, '')
          .trim();
      };

      const normalizedNewItem = normalizeItemName(item.item);
      const existingIndex = inventory.findIndex(i => {
        const normalizedExisting = normalizeItemName(i.item);
        return normalizedExisting === normalizedNewItem ||
               normalizedExisting.includes(normalizedNewItem) ||
               normalizedNewItem.includes(normalizedExisting);
      });

      if (existingIndex !== -1) {
        const existing = inventory[existingIndex];
        const newQty = (parseInt(existing.quantity_estimate) || 1) + (parseInt(item.quantity_estimate) || 1);
        const newReservations = [...(existing.reservations || []), ...(item.reservations || [])];

        itemsToUpdate.push({
          index: existingIndex,
          updates: {
            quantity_estimate: newQty.toString(),
            reservations: newReservations.length > 0 ? newReservations : undefined
          }
        });
      } else {
        itemsToAdd.push(item);
      }
    });

    console.log('Items to update:', itemsToUpdate.length, 'Items to add:', itemsToAdd.length);

    let mergedInventory = [...inventory];
    itemsToUpdate.forEach(({ index, updates }) => {
      mergedInventory[index] = { ...mergedInventory[index], ...updates };
    });
    mergedInventory = [...mergedInventory, ...itemsToAdd];
    if (user?.householdId) {
      await InventoryCacheService.addItemsToCache(mergedInventory, user.householdId, undefined);
    } else {
      await InventoryCacheService.addItemsToCache(mergedInventory, undefined, user.id);
    }
  };

  const addShoppingListItem = async (item: Omit<ShoppingItem, 'id'>) => {
    if (!user?.id) return;
    try {
      const inHousehold = isHouseholdMember(household, user) && household?.id;
      
      const id = Math.random().toString(36).substr(2, 9);
      
      const fullItem: ShoppingItem = { ...item, id, addedAt: new Date() };
      await ShoppingListCacheService.addItemToCache(fullItem, inHousehold ? household.id : undefined, inHousehold ? undefined : user.id);
      
      console.log('✅ Shopping list item added with ID:', id);
    } catch (err: any) {
      console.error('Error adding shopping list item:', err);
      addToast('Failed to add item to shopping list.', 'error');
    }
  };

  const addShoppingListItems = async (items: Omit<ShoppingItem, 'id' | 'addedAt'>[]) => {
    if (!user?.id || !items.length) return;
    try {
      const inHousehold = isHouseholdMember(household, user) && household?.id;
      const householdId = inHousehold ? household.id : undefined;
      const userId = inHousehold ? undefined : user.id;

      const itemsWithIds = items.map(item => ({
        ...item,
        id: Math.random().toString(36).substr(2, 9),
        addedAt: new Date(),
      }));

      await ShoppingListCacheService.addItemsToCache(itemsWithIds, householdId, userId);
    } catch (error) {
      console.error('Error adding shopping list items:', error);
      addToast('Failed to add items to shopping list.', 'error');
    }
  };

  const updateShoppingListItem = async (itemId: string, updates: Partial<ShoppingItem>) => {
    if (!user?.id) return;
    try {
      const inHousehold = isHouseholdMember(household, user) && household?.id;
      await ShoppingListCacheService.updateItemInCache(
        itemId,
        updates,
        inHousehold ? household.id : undefined,
        inHousehold ? undefined : user.id
      );
    } catch (error) {
      console.error('Error updating shopping list item:', error);
      addToast('Failed to update item in shopping list.', 'error');
    }
  };

  const updateShoppingListItems = async (itemsToUpdate: { id: string, updates: Partial<ShoppingItem> }[]) => {
    if (!user?.id || !itemsToUpdate.length) return;
    try {
        const inHousehold = isHouseholdMember(household, user) && household?.id;
        const householdId = inHousehold ? household.id : undefined;
        const userId = inHousehold ? undefined : user.id;
        
        await ShoppingListCacheService.updateItemsInCache(itemsToUpdate, householdId, userId);
    } catch (error) {
        console.error('Error updating shopping list items:', error);
        addToast('Failed to update items in shopping list.', 'error');
    }
  };


  const removeShoppingListItem = async (itemId: string) => {
    if (!user?.id) return;
    try {
      const inHousehold = isHouseholdMember(household, user) && household?.id;
      await ShoppingListCacheService.removeItemFromCache(
        itemId,
        inHousehold ? household.id : undefined,
        inHousehold ? undefined : user.id
      );
    } catch (error) {
      console.error('Error removing shopping list item:', error);
      addToast('Failed to remove item from shopping list.', 'error');
    }
  };

  const removeShoppingListItems = async (itemIds: string[]) => {
    if (!user?.id || !itemIds.length) return;
    try {
      const inHousehold = isHouseholdMember(household, user) && household?.id;
      const householdId = inHousehold ? household.id : undefined;
      const userId = inHousehold ? undefined : user.id;

      await ShoppingListCacheService.removeItemsFromCache(itemIds, householdId, userId);
    } catch (error) {
      console.error('Error removing shopping list items:', error);
      addToast('Failed to remove items from shopping list.', 'error');
    }
  };
  
  const getRatingsForRecipe = async (recipeTitle: string): Promise<RecipeRating[]> => {
    try {
      const q = query(collection(db, 'ratings'), where('recipeTitle', '==', recipeTitle));
      const querySnapshot = await getDocs(q);
      const allRatings: RecipeRating[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const dateString = data.timestamp?.toDate?.()?.toLocaleDateString() || data.date || 'Unknown date';
        allRatings.push({
          id: doc.id,
          recipeTitle: data.recipeTitle,
          rating: data.rating,
          comment: data.comment,
          userName: data.userName,
          date: dateString,
          userAvatar: data.userAvatar,
          ingredients: data.ingredients || data.recipe?.ingredients || [],
          instructions: data.instructions || data.recipe?.instructions || [],
          recipe: data.recipe || undefined
        } as RecipeRating);
      });
      return allRatings;
    } catch (error) {
      console.error('Error fetching ratings:', error);
      addToast('Could not load ratings for this recipe.', 'error');
      return [];
    }
  };

  const getCommunityRatings = async (): Promise<RecipeRating[]> => {
    try {
      const q = query(
        collection(db, 'ratings'),
        where('rating', '>=', 4),
        orderBy('rating', 'desc'),
        orderBy('timestamp', 'desc'),
        limit(100)
      );
      const querySnapshot = await getDocs(q);
      const communityRatings: RecipeRating[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const dateString = data.timestamp?.toDate?.()?.toLocaleDateString() || data.date || 'Unknown date';
        communityRatings.push({
          id: doc.id,
          recipeTitle: data.recipeTitle,
          rating: data.rating,
          comment: data.comment,
          userName: data.userName,
          date: dateString,
          userAvatar: data.userAvatar,
          ingredients: data.ingredients || data.recipe?.ingredients || [],
          instructions: data.instructions || data.recipe?.instructions || [],
          recipe: data.recipe || undefined
        } as RecipeRating);
      });
      return communityRatings;
    } catch (error) {
      console.error('Error fetching community ratings:', error);
      addToast('Could not load community ratings.', 'error');
      return [];
    }
  };

  const submitRating = async (ratingData: RecipeRatingInput) => {
    if (!user?.id) return;
    try {
      const { date, ...dataToSave } = ratingData;
      const ratingDoc: any = {
        ...dataToSave,
        userId: user.id,
        userName: user.name,
        timestamp: serverTimestamp()
      };
      
      if (user.avatar) {
        ratingDoc.userAvatar = user.avatar;
      }
      
      await DatabaseMonitoringService.addDoc(collection(db, 'ratings'), ratingDoc);
      addToast('Thank you for your rating!');
    } catch (error: any) {
      console.error('Error submitting rating:', error);
      addToast('Failed to submit rating. Please try again.', 'error');
    }
  };
  
  const addMealToPlan = async (date: string, mealType: 'breakfast' | 'lunch' | 'dinner', meal: MealPlanItem) => {
    if (!user?.id) return;
    try {
      const inHousehold = isHouseholdMember(household, user) && household?.id;
      await MealPlanCacheService.addMeal(date, mealType, meal, inHousehold ? household.id : undefined, inHousehold ? undefined : user.id);
      addToast(`Added ${meal.recipe.title} to your meal plan!`);
    } catch (error) {
      console.error('Error adding meal to plan:', error);
      addToast('Failed to add meal to plan.', 'error');
    }
  };

  const updateMealOnPlan = async (date: string, mealType: 'breakfast' | 'lunch' | 'dinner', meal: MealPlanItem) => {
    if (!user?.id) return;
    try {
      const inHousehold = isHouseholdMember(household, user) && household?.id;
      await MealPlanCacheService.updateMeal(date, mealType, meal, inHousehold ? household.id : undefined, inHousehold ? undefined : user.id);
      addToast(`Updated ${meal.recipe.title} on your meal plan!`);
    } catch (error) {
      console.error('Error updating meal on plan:', error);
      addToast('Failed to update meal on plan.', 'error');
    }
  };

  const removeMealFromPlan = async (date: string, mealType: 'breakfast' | 'lunch' | 'dinner', mealId: string) => {
    if (!user?.id) return;
    try {
      const inHousehold = isHouseholdMember(household, user) && household?.id;
      await MealPlanCacheService.removeMeal(date, mealType, mealId, inHousehold ? household.id : undefined, inHousehold ? undefined : user.id);
      addToast('Removed meal from your plan!');
    } catch (error) {
      console.error('Error removing meal from plan:', error);
      addToast('Failed to remove meal from plan.', 'error');
    }
  };

  // Memoized suggestions and alerts
  const consumptionSuggestions = useMemo(() => generateConsumptionSuggestions(inventory), [inventory]);
  const expirationAlerts = useMemo(() => generateExpirationAlerts(inventory), [inventory]);
  const recipeSuggestions = useMemo(() => generateRecipeSuggestions(inventory), [inventory]);

  return {
    inventory,
    setInventory,
    shoppingList,
    setShoppingList,
    savedRecipes,
    setSavedRecipes,
    mealPlan,
    setMealPlan,
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
    addShoppingListItem,
    addShoppingListItems,
    updateShoppingListItem,
    updateShoppingListItems,
    removeShoppingListItem,
    removeShoppingListItems,
    syncShoppingListToDatabase,
    isLoadingInventory,
    isLoadingShoppingList,
    isLoadingMealPlan,
    isLoadingSavedRecipes,
    isLoadingHousehold,
    addToQueue: offlineQueue.enqueue.bind(offlineQueue),
    processQueue: offlineQueue.processQueue.bind(offlineQueue),
  };
}
