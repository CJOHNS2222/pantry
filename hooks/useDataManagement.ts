import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { collection, doc, serverTimestamp, query, where, Timestamp, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import DatabaseMonitoringService from '../services/databaseMonitoringService';
import AnalyticsService from '../services/analyticsService';
import { UsageService } from '../services/usageService';
import { User, PantryItem, DayPlan, Household, ShoppingItem, SavedRecipe, RecipeRating, RecipeRatingInput, CustomCategory, MealPlanItem, StructuredRecipe, ConsumptionSuggestion, ExpirationAlert, RecipeSuggestion } from '../types';
import { AppError } from '../utils/errorUtils';
import { hasPantryItemsChanged, hasArraysChanged, hasMealPlansChanged } from '../utils/comparisonUtils';
import { setRemoteInventoryUpdate, isRemoteInventoryUpdate, setRemoteShoppingListUpdate, isRemoteShoppingListUpdate, setRemoteMealPlanUpdate, isRemoteMealPlanUpdate } from '../services/syncStateService';
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
  setIsLoadingShoppingList: (loading: boolean) => void
) {
  if (inHousehold) {
    // First try to load from cache for faster initial load
    ShoppingListCacheService.getCachedShoppingList(household.id).then(cachedItems => {
      if (cachedItems.length > 0) {
        setShoppingList(cachedItems);
        setIsLoadingShoppingList(false);
      }
    }).catch(err => {
      log.error('Failed to load cached shopping list', err, 'DataManagement');
    });

    // Listen to the cache document instead of the collection
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
          setShoppingList(items.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime()));
        }
      } else {
        // Cache document doesn't exist, set empty
        setShoppingList([]);
      }
      setIsLoadingShoppingList(false);
    }, err => {
      // Don't log permission-denied errors as they are expected when user doesn't have access
      if (err.code !== 'permission-denied') {
        log.error('Household shopping list cache listener failed', err, 'DataManagement');
      }
      setIsLoadingShoppingList(false);
    });
  } else {
    // First try to load from cache for faster initial load
    ShoppingListCacheService.getCachedShoppingList(undefined, user.id).then(cachedItems => {
      if (cachedItems.length > 0) {
        setShoppingList(cachedItems);
        setIsLoadingShoppingList(false);
      }
    }).catch(err => {
      log.error('Failed to load cached shopping list', err, 'DataManagement');
    });

    // Listen to the cache document instead of the collection
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
          setShoppingList(items.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime()));
        }
      } else {
        // Cache document doesn't exist, set empty
        setShoppingList([]);
      }
      setIsLoadingShoppingList(false);
    }, err => {
      // Don't log permission-denied errors as they are expected when user doesn't have access
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
  setIsLoadingSavedRecipes: (loading: boolean) => void
) {
  if (inHousehold) {
    // First try to load from cache for faster initial load
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
          setSavedRecipes(recipes.sort((a, b) => b.dateSaved.localeCompare(a.dateSaved)));
        }
      } else {
        // Cache document doesn't exist, set empty
        setSavedRecipes([]);
      }
      setIsLoadingSavedRecipes(false);
    }, err => {
      // Don't log permission-denied errors as they are expected when user doesn't have access
      if (err.code !== 'permission-denied') {
        log.error('Household saved recipes cache listener failed', err, 'DataManagement');
      }
      setIsLoadingSavedRecipes(false);
    });
  } else {
    // First try to load from cache for faster initial load
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
          setSavedRecipes(recipes.sort((a, b) => b.dateSaved.localeCompare(a.dateSaved)));
        }
      } else {
        // Cache document doesn't exist, set empty
        setSavedRecipes([]);
      }
      setIsLoadingSavedRecipes(false);
    }, err => {
      // Don't log permission-denied errors as they are expected when user doesn't have access
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

        // Convert cached data back to DayPlan format
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

        // Check if meal plan has actually changed to prevent infinite loops
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
      // No cache document exists yet, create a default plan
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
    // Don't log permission-denied errors as they are expected when user doesn't have access
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
  const [ratings, setRatings] = useState<RecipeRating[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);

  // Usage limit states
  const [recipeSaveLimitExceeded, setRecipeSaveLimitExceeded] = useState(false);
  const [mealPlanLimitExceeded, setMealPlanLimitExceeded] = useState(false);

  // Loading states
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);
  const [isLoadingShoppingList, setIsLoadingShoppingList] = useState(true);
  const [isLoadingMealPlan, setIsLoadingMealPlan] = useState(true);
  const [isLoadingSavedRecipes, setIsLoadingSavedRecipes] = useState(true);
  const [isLoadingRatings, setIsLoadingRatings] = useState(true);
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

  // Helper function to clean objects by removing undefined fields (Firestore requirement)
  const cleanObject = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return undefined;
    }

    if (typeof obj === 'object') {
      if (Array.isArray(obj)) {
        // Clean arrays by filtering out null/undefined and cleaning each item
        return obj
          .filter(item => item !== null && item !== undefined)
          .map(item => cleanObject(item))
          .filter(item => item !== undefined);
      } else {
        // Clean objects by removing undefined properties and cleaning nested objects
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

    // Return primitive values as-is
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
      
      // Invalidate cache for the affected collection
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
        // Handle migration from old structure (meals array) to new structure (breakfast/lunch/dinner arrays)
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

  // Wrapper for setMealPlan that validates data
  const setMealPlan = (newPlan: DayPlan[] | ((prev: DayPlan[]) => DayPlan[])) => {
    const planToSet = typeof newPlan === 'function' ? newPlan(mealPlan) : newPlan;
    const validatedPlan = validateMealPlan(planToSet);
    setMealPlanState(validatedPlan);
  };

  // Getter for mealPlan that returns validated data
  const mealPlan = useMemo(() => validateMealPlan(mealPlanState), [mealPlanState]);

  // refs to household subcollection unsubscribe functions
  const householdUnsubsRef = useRef<{ inventory?: (() => void) | null; shopping?: (() => void) | null; recipes?: (() => void) | null; mealPlan?: (() => void) | null }>({});

  // Flag to track if listeners have been set up
  const listenersReadyRef = useRef(false);

  // Flag to track if initial data has been loaded
  const initialDataLoadedRef = useRef(false);

  // Counter for total Firestore reads
  const totalReadsRef = useRef(0);

  // Previous household data for comparison
  const prevHouseholdRef = useRef<Household | null>(null);

  // Last time we checked for expiration notifications (to avoid spam)
  const lastExpirationCheckRef = useRef<number>(0);

  // Last time we checked for allergy alerts (to avoid excessive reads)
  const lastAllergyCheckRef = useRef<number>(0);

  // Per-session client id used to mark writes
  const clientId = useMemo(() => {
    let id = localStorage.getItem('clientId');
    if (!id) {
      id = `client-${Math.random().toString(36).substr(2,9)}`;
      localStorage.setItem('clientId', id);
    }
    return id;
  }, []);

  // Firestore synchronization effects
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    // Prevent multiple listener setups, but allow re-setup when householdId changes
    // Removed sessionStorage check to allow re-setup on hot reload

    const unsubs: (()=>void)[] = [];

    // Household document listener - always listen if user has a household
    if (user?.householdId) {
      unsubs.push(DatabaseMonitoringService.onSnapshot(doc(db, 'households', user.householdId), snap => {
        if (snap.exists()) {
          let householdData = { id: snap.id, ...snap.data() } as Household;
          
          // If members array doesn't exist, is empty, or is in wrong format (map instead of array), populate members from user documents
          const membersIsArray = Array.isArray(householdData.members);
          const membersIsEmpty = membersIsArray && householdData.members.length === 0;
          const membersIsMap = householdData.members && typeof householdData.members === 'object' && !membersIsArray;
          const needsPopulation = !householdData.members || !membersIsArray || membersIsEmpty || membersIsMap;
          
          if (needsPopulation && householdData.memberIds && householdData.memberIds.length > 0) {
            // Don't fetch user data from Firestore due to security rules
            // Instead, rely on data already in household document or use current user data
            const uniqueMemberIds = [...new Set(householdData.memberIds)];
              console.log('Processing memberIds:', uniqueMemberIds);

              // If members exists as a map/object, convert it to array format first
              if (membersIsMap && householdData.members) {
                const mapMembers = householdData.members as Record<string, any>;
                const convertedMembers: Member[] = [];

                for (const memberId of uniqueMemberIds) {
                  if (mapMembers[memberId]) {
                    let memberName = mapMembers[memberId].name || mapMembers[memberId].email || 'Unknown';

                    // Fix corrupted names that are actually member IDs
                    if (memberName === memberId || (memberName.length > 20 && memberName.match(/^[a-zA-Z0-9_-]+$/))) {
                      memberName = mapMembers[memberId].email?.split('@')[0] || `Member ${memberId.slice(0, 8)}`;
                    }

                    convertedMembers.push(cleanObject({
                      id: memberId,
                      name: memberName,
                      email: mapMembers[memberId].email || '',
                      avatar: mapMembers[memberId].avatar,
                      role: mapMembers[memberId].role || (memberId === user?.id ? 'admin' : 'member'), // Preserve existing role, default to admin for current user
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
                  // Don't update the household document here - let the population logic handle it
                  console.log('Converted household members from map to array format');
                }
              }

              // Only create basic member entries if there are NO members at all
              // Trust that the household document has correct member data from join operations
              if (!Array.isArray(householdData.members) || householdData.members.length === 0) {
                console.log('Creating basic member entries for household with no members array');

                const basicMembers = uniqueMemberIds.map(memberId => {
                  // For current user, use their actual data
                  if (memberId === user?.id) {
                    return {
                      id: memberId,
                      name: user?.name || user?.email?.split('@')[0] || 'You',
                      email: user?.email || '',
                      avatar: user?.avatar,
                      role: 'admin', // Current user is typically admin
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

                  // For other members, use minimal placeholder - they should have real data from join operations
                  return {
                    id: memberId,
                    name: `Member ${memberId.slice(0, 8)}`, // Placeholder - should be replaced by real data
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

              // Ensure current user is always admin in their household
              if (Array.isArray(householdData.members) && householdData.members.length > 0 && user?.id) {
                const currentUserMember = householdData.members.find(m => m.id === user.id);
                if (currentUserMember && currentUserMember.role !== 'admin') {
                  console.log('Updating current user role to admin');
                  currentUserMember.role = 'admin';
                }
              }
            }
          
          // Only update if the household data has actually changed (excluding timestamps)
          const hasChanged = !prevHouseholdRef.current ||
            householdData.id !== prevHouseholdRef.current.id ||
            householdData.name !== prevHouseholdRef.current.name ||
            householdData.ownerId !== prevHouseholdRef.current.ownerId ||
            JSON.stringify(householdData.memberIds || []) !== JSON.stringify(prevHouseholdRef.current.memberIds || []) ||
            JSON.stringify(householdData.members || []) !== JSON.stringify(prevHouseholdRef.current.members || []);
          if (hasChanged) {
            // Clean up duplicate memberIds if any exist
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
        // Reset retry counter on successful load
        if (householdListenerRetry > 0) {
          setHouseholdListenerRetry(0);
        }
      }, err => {
        // Don't log permission-denied errors as they are expected when user doesn't have access
        if (err.code !== 'permission-denied') {
          console.error("Household document listener failed:", err);
        }
        
        // If it's a permissions error, the user has likely been removed from the household
        if (err.code === 'permission-denied' && !householdClearedDueToPermissionsRef.current) {
          console.log('Permission denied on household listener - clearing household state');
          householdClearedDueToPermissionsRef.current = true;
          setHousehold(null);
          setIsLoadingHousehold(false);
          // Reset retry counter
          if (householdListenerRetry > 0) {
            setHouseholdListenerRetry(0);
          }
        } else if (user?.householdId && householdListenerRetry < 3) {
          // Only retry for other errors if user still has householdId
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

    // Determine if we are in a valid household (any household with membership)
    const inHousehold = !!user?.householdId;

    // Inventory listener - use household inventory if user has householdId (migrated at creation)
    // Skip inventory listeners when disabled (e.g., for cache testing)
    if (!options?.disableInventoryListeners) {
      if (user?.householdId) {
        // First try to load from cache for faster initial load
        InventoryCacheService.getCachedInventory(user.householdId).then(cachedInventory => {
          if (cachedInventory.length > 0) {
            setInventory(cachedInventory);
            setIsLoadingInventory(false);
          }
        }).catch(err => {
          log.error('Failed to load cached inventory', err, 'DataManagement');
        });

        // Listen to household inventory cache
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
              // Only update if different to prevent infinite loops
              if (hasPantryItemsChanged(items, inventory)) {
                setRemoteInventoryUpdate(true);
                setInventory(items);
              }
            }
          } else {
            // Cache document doesn't exist, set empty
            setInventory([]);
          }
          setIsLoadingInventory(false);
          initialDataLoadedRef.current = true;
        }, err => {
          // Don't log permission-denied errors as they are expected when user doesn't have access
          if (err.code !== 'permission-denied') {
            console.error("Household inventory listener failed:", err);
          }
          setIsLoadingInventory(false);
        }));
      } else {
        // First try to load from cache for faster initial load
        InventoryCacheService.getCachedInventory(user.id).then(cachedInventory => {
          if (cachedInventory.length > 0) {
            setInventory(cachedInventory);
            setIsLoadingInventory(false);
          }
        }).catch(err => {
          log.error('Failed to load cached inventory', err, 'DataManagement');
        });

        // Listen to user inventory cache
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
              // Only update if different to prevent infinite loops
              if (hasPantryItemsChanged(items, inventory)) {
                setRemoteInventoryUpdate(true);
                setInventory(items);
              }
            }
          } else {
            // Cache document doesn't exist, set empty
            setInventory([]);
          }
          setIsLoadingInventory(false);
          initialDataLoadedRef.current = true;
        }, err => {
            log.error('Failed to update inventory cache', err, 'DataManagement');
          }));
      }
    } else {
      // When inventory listeners are disabled, mark as loaded immediately
      setIsLoadingInventory(false);
      initialDataLoadedRef.current = true;
    }

    // Scoped listeners for shopping list, saved recipes, and meal plans
    // These automatically choose between user and household collections
    unsubs.push(createShoppingListListener(user, household, inHousehold, setShoppingList, setIsLoadingShoppingList));
    unsubs.push(createSavedRecipesListener(user, household, inHousehold, setSavedRecipes, setIsLoadingSavedRecipes));
    unsubs.push(createMealPlanListener(user, household, inHousehold, setMealPlan, setIsLoadingMealPlan, prevMealPlanRef));

    sessionStorage.setItem('listenersSetUp', 'true');

    return () => {
      unsubs.forEach(unsub => unsub());
      sessionStorage.removeItem('listenersSetUp');
    };
  }, [user?.id, user?.householdId, householdListenerRetry]);

  // Set flag when listeners are ready
  useEffect(() => {
    listenersReadyRef.current = true;
    initialDataLoadedRef.current = false; // Reset when listeners change
    return () => {
      listenersReadyRef.current = false;
      initialDataLoadedRef.current = false;
    };
  }, [user?.id, user?.householdId, householdListenerRetry]);

  // Check for expired items and handle them
  useEffect(() => {
    if (!inventory.length || !user?.id) return;

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format
    const expiredItems = inventory.filter(item => 
      item.expirationDate && item.expirationDate <= today
    );

    if (expiredItems.length > 0) {
      // Create notifications for expired items
      expiredItems.forEach(async (item) => {
        const daysUntilExpiry = Math.ceil((new Date(item.expirationDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        await NotificationService.createExpirationAlert(user.id, item.item, daysUntilExpiry, item.id);
      });

      // Add expired items to shopping list
      const itemNames = expiredItems.map(item => item.item);

      // Add to shopping list
      addToShoppingList(itemNames);

      // Show notification
      addToast(
        `${expiredItems.length} item${expiredItems.length > 1 ? 's' : ''} expired and ${expiredItems.length > 1 ? 'were' : 'was'} added to your shopping list: ${expiredItems.map(item => item.item).join(', ')}`,
        'info',
        8000
      );

      // Remove expired items from inventory
      setInventory(prev => prev.filter(item => 
        !expiredItems.some(expired => expired.id === item.id)
      ));
    }

    // Check for items expiring soon (but not expired)
    const itemsExpiringSoon = inventory.filter(item => {
      if (!item.expirationDate) return false;
      const daysUntilExpiry = Math.ceil((new Date(item.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry > 0 && daysUntilExpiry <= 7; // Expiring within 7 days
    });

    // Create notifications for items expiring soon (limit to avoid spam)
    // Only check every 5 minutes to avoid excessive notifications
    const now = Date.now();
    if (now - lastExpirationCheckRef.current > 5 * 60 * 1000) { // 5 minutes
      itemsExpiringSoon.slice(0, 3).forEach(async (item) => {
        const daysUntilExpiry = Math.ceil((new Date(item.expirationDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        await NotificationService.createExpirationAlert(user.id, item.item, daysUntilExpiry, item.id);
      });
      lastExpirationCheckRef.current = now;
    }

  }, [inventory, user?.id, addToShoppingList, addToast]);

  // Check for allergy alerts when inventory changes
  useEffect(() => {
    if (!inventory.length || !user?.id || !household?.id) return;

    // Only check for allergies every 5 minutes to avoid excessive reads
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

  // Daily combined notification (meals + shopping)
  useEffect(() => {
    if (!user?.id || !mealPlan.length || !shoppingList.length) return;

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const lastDailyNotification = localStorage.getItem('lastDailyNotification');

    // Only send once per day
    if (lastDailyNotification === today) return;

    // Get today's meals
    const todayPlan = mealPlan.find(day => day.date === today);
    const todaysMeals = todayPlan ? [
      ...(todayPlan.breakfast || []),
      ...(todayPlan.lunch || []),
      ...(todayPlan.dinner || [])
    ] : [];

    // Get shopping list info
    const shoppingCount = shoppingList.length;
    const urgentItems = shoppingList
      .filter(item => item.priority === 'urgent' || item.priority === 'high')
      .map(item => item.item)
      .slice(0, 3);

    // Only send if there's something to notify about
    if (todaysMeals.length > 0 || shoppingCount > 0) {
      NotificationService.createDailyCombinedNotification(
        user.id,
        todaysMeals,
        shoppingCount,
        urgentItems
      ).catch(error => {
        console.error('Failed to create daily combined notification:', error);
      });

      // Mark as sent for today
      localStorage.setItem('lastDailyNotification', today);
    }
  }, [user?.id, mealPlan, shoppingList]);

  // Write changes to Firestore
  useEffect(() => {
    if (!user?.id || !listenersReadyRef.current || !initialDataLoadedRef.current) return;
    if (isRemoteMealPlanUpdate() || isRemoteInventoryUpdate()) {
      return;
    }

    // Skip sync on hot reload in dev mode to prevent excessive activity
    if (import.meta.hot) return;

    // Debounce the sync to avoid running on every state change
    const timeoutId = setTimeout(async () => {
      if (mealPlanSyncInProgress) return;
      mealPlanSyncInProgress = true;
      // Determine if we are in a valid household (any household with membership)
      const inHousehold = user?.householdId && (!household?.id || isHouseholdMember(household, user));

      writingMealPlanRef.current = true;
      try {
        // If offline, enqueue the inventory sync to IndexedDB for later processing - DISABLED
        // try {
        //   if (typeof window !== 'undefined' && !navigator.onLine) {
        //     const { enqueueInventorySync } = await import('../services/writeQueueService');
        //     await enqueueInventorySync({ userId: user.id, householdId: household?.id || null, inHousehold, inventory });
        //     addToast('Offline — changes queued and will sync when you are back online.', 'info');
        //     return;
        //   }
        // } catch (err) {
        //   console.warn('Failed to enqueue offline sync, continuing without queue:', err);
        // }
        
        if (inHousehold) {
          // When in household, sync inventory to household collection
          const householdInventoryPath = `households/${user.householdId}/inventory`;

          // Use batch operations to minimize round trips
          // Note: This approach writes all current items but doesn't delete removed items
          // to avoid reading all documents. Removed items will be cleaned up by the
          // periodic cleanup mechanism or when the collection is next fully synced.
          const batch = writeBatch(db);

          inventory.forEach(item => {
            batch.set(doc(db, householdInventoryPath, item.id), cleanObject(item));
          });

          // Periodic cleanup of orphaned items (disabled - was causing unnecessary queries)
          // if (Math.random() < 0.1) { // 10% chance to run cleanup
          //   try {
          //     const allDocs = await DatabaseMonitoringService.getDocs(DatabaseMonitoringService.collection(householdInventoryPath));
          //     const currentIds = new Set(inventory.map(item => item.id));
          //     const orphanedDocs = allDocs.docs.filter(doc => !currentIds.has(doc.id));
          //
          //     if (orphanedDocs.length > 0) {
          //       console.log(`Cleaning up ${orphanedDocs.length} orphaned household inventory items`);
          //       const cleanupBatch = writeBatch(db);
          //       orphanedDocs.forEach(doc => {
          //         cleanupBatch.delete(doc.ref);
          //       });
          //       await cleanupBatch.commit();
          //     }
          //   } catch (err) {
          //     console.warn('Failed to cleanup orphaned household inventory items:', err);
          //   }
          // }
          
          // Sync other household data (saved recipes, meal plan)
          const householdWrites: Promise<any>[] = [];
          // Skip writing savedRecipes in sync effect since they are already persisted when saved
          // All saved recipes are now persisted only in the cache document via RecipesCacheService
          // No writes to per-item documents or collections
          if (mealPlan) {
            // Update the meal plan cache
            await MealPlanCacheService.updateCache(mealPlan, user.householdId, undefined);
          }

          const householdResults = await Promise.allSettled(householdWrites);
          householdResults.forEach((res, idx) => {
            if (res.status === 'rejected' || (res.status === 'fulfilled' && (res.value as any)?.err)) {
              console.error('Household write failed:', res);
              
              // If it's a permission denied error, the user has likely been removed from the household
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
          // When not in household, sync inventory to user's cache collection (single doc)
          try {
            await InventoryCacheService.addItemsToCache(inventory, undefined, user.id);
          } catch (err) {
            log.error('Failed to update user inventory cache', err, 'useDataManagement');
            addToast(ERROR_MESSAGES.SAVE_FAILED, 'error');
          }

          if (mealPlan) {
            // Update the meal plan cache
            await MealPlanCacheService.updateCache(mealPlan, undefined, user.id);
          }
        }
      } finally {
        writingMealPlanRef.current = false;
        mealPlanSyncInProgress = false;
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(timeoutId);
    }, [user?.id, user?.householdId, inventory, savedRecipes, mealPlan]);

  // Manual sync function for shopping list
  const syncShoppingListToDatabase = async () => {
    if (!user?.id || !shoppingList) return;

    const inHousehold = !!user?.householdId;

    try {
      if (inHousehold) {
        // Existing batch sync logic for household (not shown here)
        // ...existing code...
      } else {
        // For non-household users, update the shopping list cache document
        for (const item of shoppingList) {
          await ShoppingListCacheService.addItemToCache(item, undefined, user.id);
        }
        // Optionally, remove items from cache that are no longer in the shopping list
        // (not implemented here for brevity)
        prevShoppingListRef.current = shoppingList.map(item => ({ ...item }));
        log.debug('Shopping list cache synced successfully', { count: shoppingList.length }, 'useDataManagement');
      }
    } catch (err: any) {
      console.error('Error syncing shopping list:', error);
      log.error('Failed to sync shopping list', { error }, 'useDataManagement');
    }
  };

  // Shopping list sync
  useEffect(() => {
    if (!user?.id) return;

    // Only use cache for shopping list sync
    if (!user?.id || !shoppingList) return;

    if (!hasArraysChanged(shoppingList, prevShoppingListRef.current)) {
      return;
    }

    const timeoutId = setTimeout(async () => {
      setRemoteShoppingListUpdate(false);
      try {
        if (user.householdId) {
          await ShoppingListCacheService.setCache(shoppingList, user.householdId, undefined);
        } else {
          await ShoppingListCacheService.setCache(shoppingList, undefined, user.id);
        }
        prevShoppingListRef.current = shoppingList.map(item => ({ ...item }));
      } catch (err: any) {
        console.error('Error syncing shopping list:', error);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [user?.id, user?.householdId, shoppingList]);


  // Ratings listener
  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.collection('ratings'), (snapshot) => {
      const allRatings: RecipeRating[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Convert Firestore timestamp to readable date string
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
      setRatings(allRatings);
      setIsLoadingRatings(false);
    }, (error) => {
      console.error('Error loading ratings from Firestore:', error);
      if ((error as any)?.code === 'permission-denied') {
        addToast('Unable to read community ratings (permission denied).', 'error');
      }
      const saved = localStorage.getItem('ratings');
      if (saved) setRatings(JSON.parse(saved));
      setIsLoadingRatings(false);
    });
    return () => unsubscribe();
  }, [user?.id]);

  // Persistence
  useEffect(() => { localStorage.setItem('mealPlan', JSON.stringify(mealPlan)); }, [mealPlan]);
  useEffect(() => { localStorage.setItem('household', JSON.stringify(household)); }, [household]);

  // Set household loading to false when household data is available
  useEffect(() => {
    if (household !== null) {
      setIsLoadingHousehold(false);
    }
  }, [household]);

  // Online/offline handling - DISABLED
  // useEffect(() => {
  //   const handleOnline = async () => {
  //     setIsOnline(true);
  //     // Process queued operations when coming back online
  //     try {
  //       await offlineQueue.processQueue();
  //       addToast('Changes synced successfully!', 'info');
  //     } catch (err: any) {
  //       console.error('Failed to process offline queue:', error);
  //       addToast('Some changes failed to sync. Please check your connection.', 'error');
  //     }
  //   };

  //   const handleOffline = () => {
  //     setIsOnline(false);
  //     addToast('You are offline. Changes will be synced when connection is restored.', 'info');
  //   };

  //   window.addEventListener('online', handleOnline);
  //   window.addEventListener('offline', handleOffline);

  //   // Process queue on app start if online
  //   if (navigator.onLine) {
  //     offlineQueue.processQueue().catch(console.error);
  //   }

  //   return () => {
  //     window.removeEventListener('online', handleOnline);
  //     window.removeEventListener('offline', handleOffline);
  //   };
  // }, []);

  // Load undo actions
  const prevUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentUserId = user?.id || null;
    const prevUserId = prevUserIdRef.current;

    // Clear actions from previous user if user changed
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

    // Check if we've already determined the limit is exceeded
    if (mealPlanLimitExceeded) {
      addToast(ERROR_MESSAGES.PLANNING_LIMIT_REACHED, 'error');
      return;
    }

    // Check meal planning limits for free users
    if (user) {
      try {
        // Use the checkMealPlanLimit function to update state
        const canAdd = await checkMealPlanLimit();
        if (!canAdd) {
          addToast(ERROR_MESSAGES.PLANNING_LIMIT_REACHED, 'error');
          return;
        }
      } catch (err: any) {
        console.error('Error checking meal planning limits:', error);
        // Continue if limit check fails
      }
    }

    let updatedPlan = [...mealPlan];
    let dayIndex = targetDayIndex;
    let mealType = targetMealType || 'breakfast';

    // If no target specified, default to today
    if (dayIndex === undefined) {
      const today = new Date().toISOString().slice(0, 10);
      dayIndex = updatedPlan.findIndex(day => day.date === today);
      
      if (dayIndex === -1) {
        // Add today to the plan
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayDate = new Date();
        updatedPlan.push({
          date: today,
          dayName: days[todayDate.getDay()],
          breakfast: [],
          lunch: [],
          dinner: []
        });
        // Sort by date
        updatedPlan.sort((a, b) => a.date.localeCompare(b.date));
        dayIndex = updatedPlan.findIndex(day => day.date === today);
      }
    }

    // Ensure the target day exists
    if (dayIndex === undefined || dayIndex < 0 || dayIndex >= updatedPlan.length) {
      addToast(ERROR_MESSAGES.INVALID_DAY, 'error');
      return;
    }

    // Add the recipe to the specified day and meal type
    updatedPlan = updatedPlan.map((day, index) => {
      if (index === dayIndex) {
        const newMeal = {
          id: `meal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          recipe: recipe,
          mealType: mealType
        };
        
        const updatedDay = { ...day };
        if (!updatedDay[mealType]) updatedDay[mealType] = [];
        updatedDay[mealType] = [...updatedDay[mealType], newMeal];
        
        return updatedDay;
      }
      return day;
    });

    setMealPlan(updatedPlan);
    const dayName = updatedPlan[dayIndex].dayName;
    addToast(`Added ${recipe.title} to ${dayName}'s ${mealType}!`);

    // Track analytics
    AnalyticsService.trackMealPlanAdd(recipe.id || recipe.title, recipe.title, mealType, dayIndex);

    // Record the meal planning usage
    if (user) {
      try {
        await UsageService.recordMealPlanAddition(user);
      } catch (err: any) {
        console.error('Error recording meal planning usage:', error);
        // Don't fail the operation if recording fails
      }
    }
  };

  // Usage limit checking functions
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
      // Count recipes added to meal plan this week
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
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

    // Check if we've already determined the limit is exceeded
    if (recipeSaveLimitExceeded) {
      addToast('You have reached the maximum number of saved recipes for your plan. Please upgrade to save more recipes.', 'error');
      return;
    }

    try {
      const inHousehold = isHouseholdMember(household, user) && household?.id;
      const householdId = inHousehold ? household.id : undefined;
      const userId = inHousehold ? undefined : user.id;
      console.log('🔍 Saving recipe to cache:', { householdId, userId });

      // Check for duplicate recipes by getting current cached recipes
      const currentRecipes = await RecipesCacheService.getCachedRecipes(householdId, userId);
      const existingRecipe = currentRecipes.find(r => r.title === recipe.title);

      // Also check for very similar recipes (same title and similar ingredients count)
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

      // Check recipe save limit (and update state)
      const canSave = await checkRecipeSaveLimit();
      if (!canSave) {
        addToast('You have reached the maximum number of saved recipes for your plan. Please upgrade to save more recipes.', 'error');
        return;
      }

      // Generate an ID for the recipe
      const recipeId = Math.random().toString(36).substr(2, 9);

      const savedRecipe: SavedRecipe = {
        id: recipeId,
        ...recipe,
        dateSaved: new Date().toISOString()
      };

      // Save to cache instead of individual document
      await RecipesCacheService.addRecipeToCache(savedRecipe, householdId, userId);
      console.log('✅ Recipe saved to cache with ID:', recipeId);

      // Record recipe save usage
      try {
        await UsageService.recordRecipeSave(user);
      } catch (err: any) {
        console.error('Error recording recipe save usage:', error);
        // Don't fail the operation if recording fails
      }

      addToast(`Saved ${recipe.title} to your recipes!`);
    } catch (err: any) {
      console.error('Error saving recipe:', error);

      // Provide user-friendly error messages based on error type
      let errorMessage = 'Failed to save recipe. Please try again.';

      if (error instanceof AppError) {
        errorMessage = error.userMessage;
      } else if (error instanceof Error) {
        // Handle common Firebase errors
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

  const handleRateRecipe = async (ratingData: RecipeRatingInput) => {
    if (!user?.id) return;
    try {
      // Remove the client-generated date and let serverTimestamp handle it
      const { date, ...dataToSave } = ratingData;
      const ratingDoc = {
        ...dataToSave,
        userId: user.id,
        userName: user.name,
        timestamp: serverTimestamp()
      };
      
      // Only include userAvatar if it exists
      if (user.avatar) {
        ratingDoc.userAvatar = user.avatar;
      }
      
      const docRef = await DatabaseMonitoringService.addDoc(DatabaseMonitoringService.collection('ratings'), ratingDoc);

      // Immediately update local state with the new rating
      const newRating: RecipeRating = {
        id: docRef.id,
        recipeTitle: dataToSave.recipeTitle,
        rating: dataToSave.rating,
        comment: dataToSave.comment,
        userName: dataToSave.userName,
        date: new Date().toLocaleDateString(), // Temporary date until Firestore timestamp is processed
        userAvatar: user.avatar, // This can be undefined, which is fine for local state
        recipe: dataToSave.recipe
      };
      setRatings(prev => [...prev, newRating]);

      addToast('Thank you for your rating!');
    } catch (err: any) {
      console.error('Error submitting rating:', error);
      addToast('Failed to submit rating. Please try again.', 'error');
    }
  };

  // Helper function to determine if an item should show expiry alert
  const shouldShowExpiryAlert = (item: PantryItem): boolean => {
    if (!item.expirationDate) return false;
    
    const expirationDate = new Date(item.expirationDate);
    const today = new Date();
    const daysRemaining = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Show alert for items expiring within 7 days (including already expired)
    return daysRemaining <= 7;
  };

  // Computed consumption suggestions and expiration alerts
  const consumptionSuggestions = useMemo(() => 
    generateConsumptionSuggestions(inventory), [inventory]
  );

  const expirationAlerts = useMemo(() => 
    generateExpirationAlerts(inventory), [inventory]
  );

  const recipeSuggestions = useMemo(() => 
    [], [] // Disabled automatic recipe suggestions to reduce database queries
  );

  // Custom Category Management Functions
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
      
      // Save to Firestore
      const docRef = await DatabaseMonitoringService.addDoc(DatabaseMonitoringService.collection(`users/${user.id}/customCategories`), {
        name: newCategory.name,
        icon: newCategory.icon,
        color: newCategory.color,
        createdAt: serverTimestamp(),
        userId: newCategory.userId
      });

      // Update local state with the Firestore-generated ID and proper createdAt
      const categoryWithId = {
        ...newCategory,
        id: docRef.id,
        createdAt: new Date().toISOString() // Use current time for immediate display
      };
      setCustomCategories(prev => [...prev, categoryWithId]);
      
      addToast(`Created category "${name}"!`);
    } catch (err: any) {
      console.error('Error adding custom category:', error);
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

      // Update in Firestore
      await DatabaseMonitoringService.setDoc(DatabaseMonitoringService.doc('users', user.id, 'customCategories', categoryId), {
        ...updatedCategory,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Update local state
      setCustomCategories(prev => prev.map(cat => 
        cat.id === categoryId ? updatedCategory : cat
      ));

      addToast(`Updated category "${updatedCategory.name}"!`);
    } catch (err: any) {
      console.error('Error updating custom category:', error);
      addToast('Failed to update category. Please try again.', 'error');
    }
  };

  const deleteCustomCategory = async (categoryId: string) => {
    if (!user?.id) return;
    try {
      const category = customCategories.find(cat => cat.id === categoryId);
      if (!category) return;

      // Check if category is being used by any items
      const itemsUsingCategory = inventory.filter(item => item.category === category.name);
      if (itemsUsingCategory.length > 0) {
        addToast(`Cannot delete category "${category.name}" - it's being used by ${itemsUsingCategory.length} item(s). Please reassign items first.`, 'error');
        return;
      }

      // Delete from Firestore
      await DatabaseMonitoringService.deleteDoc(DatabaseMonitoringService.doc('users', user.id, 'customCategories', categoryId));

      // Update local state
      setCustomCategories(prev => prev.filter(cat => cat.id !== categoryId));

      addToast(`Deleted category "${category.name}"!`);
    } catch (err: any) {
      console.error('Error deleting custom category:', error);
      addToast('Failed to delete category. Please try again.', 'error');
    }
  };

  // Manual recipe suggestions generation (disabled automatic to reduce queries)
  const generateRecipeSuggestionsOnDemand = useCallback(() => {
    return generateRecipeSuggestions(inventory);
  }, [inventory]);

  const handleMarkAsMade = async (recipe: StructuredRecipe) => {
    try {
      // Parse recipe ingredients and subtract from inventory
      const ingredientsToConsume = recipe.ingredients.map(ing => {
        const parsed = parseIngredientForShoppingList(ing);
        return {
          item: parsed.itemName,
          quantity: parsed.quantity,
          unit: 'count'
        };
      });

      // Update inventory by subtracting consumed ingredients and clearing reservations
      setInventory(prev => {
        return prev.map(item => {
          const consumedIngredient = ingredientsToConsume.find(ing => 
            ing.item.toLowerCase() === item.item.toLowerCase()
          );
          
          if (consumedIngredient) {
            // Clear reservations for this recipe
            const updatedReservations = item.reservations?.filter(res => 
              res.recipeName !== recipe.title
            ) || [];
            
            // Subtract consumed quantity
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

  // Undo functions
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
          // Ensure the restored item is valid
          if (undoOp.data && typeof undoOp.data === 'object' && undoOp.data.id) {
            // Ensure the item has required properties
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
          // Revert the item to its previous state
          const { itemId, previousState } = undoOp.data;
          const currentIndex = inventory.findIndex(item => item.id === itemId);
          if (currentIndex !== -1 && previousState && typeof previousState === 'object' && previousState.id) {
            // Ensure the item has required properties
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

  // Update item with undo recording
  const updateItem = async (index: number, updates: Partial<PantryItem>) => {
    const currentItem = inventory[index];
    if (!currentItem) return;

    // Record the undo action
    await recordUndo('update_item', {
      itemId: currentItem.id,
      previousState: currentItem,
      updates
    });

    // Update the item in local state
    let updatedItemForDB: PantryItem;
    setInventory(prev => {
      const updated = [...prev];
      const updatedItem = { ...updated[index], ...updates };
      // Recalculate expiry alert flag if expiration date was updated
      if (updates.expirationDate !== undefined || updates.expirationType !== undefined) {
        updatedItem.expiryAlertShown = shouldShowExpiryAlert(updatedItem);
      }
      updated[index] = updatedItem;
      updatedItemForDB = updatedItem;
      return updated;
    });

    // Update the cache
    await InventoryCacheService.updateItemInCache(currentItem.id, updates, user?.householdId, user?.id);
  };

  // Delete item with undo recording
  const deleteItem = async (index: number) => {
    const itemToDelete = inventory[index];
    if (!itemToDelete) return;

    // Log activity if in household
    if (loggingOptions?.logItemRemoved && household?.id && isHouseholdMember(household, user) &&
        (Array.isArray(household.memberIds) ? household.memberIds.length > 1 : false)) {
      loggingOptions.logItemRemoved(itemToDelete.item, itemToDelete.id);
    }

    // Record the undo action
    await recordUndo('delete_item', itemToDelete);

    // Remove the item from local state
    setInventory(prev => prev.filter((_, i) => i !== index));

    // Update the cache
    await InventoryCacheService.removeItemFromCache(itemToDelete.id, user?.householdId, user?.id);
  };

  // Add item to inventory
  const addItem = async (item: PantryItem) => {
    // Set expiry alert flag based on expiration date
    const itemWithAlert = {
      ...item,
      expiryAlertShown: shouldShowExpiryAlert(item)
    };

    // Add to local state
    setInventory(prev => [...prev, itemWithAlert]);

    // Log activity if in household
    if (loggingOptions?.logItemAdded && household?.id && isHouseholdMember(household, user) &&
        (Array.isArray(household.memberIds) ? household.memberIds.length > 1 : false)) {
      loggingOptions.logItemAdded(item.item, item.id);
    }

    // Update the cache
    await InventoryCacheService.addItemToCache(itemWithAlert, user?.householdId, user?.id);

    // Provide haptic feedback
    HapticService.itemAdded();
  };

  // Add multiple items to inventory
  const addItems = async (items: PantryItem[]) => {

    // Process items: merge with existing items by name
    const itemsToAdd: PantryItem[] = [];
    const itemsToUpdate: { index: number, updates: Partial<PantryItem> }[] = [];

    items.forEach(item => {
      // More robust item matching - normalize item names
      const normalizeItemName = (name: string) => {
        return name.toLowerCase()
          .trim()
          .replace(/\s+/g, ' ') // normalize spaces
          .replace(/[^\w\s]/g, '') // remove punctuation
          .replace(/\b\d+\s*(?:%|percent|oz|lb|g|kg|ml|l|cup|cups|tbsp|tsp|qt|gal|pint|pints)\b/g, '') // remove common units
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
        // Update existing item
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
        // Add as new item
        itemsToAdd.push(item);
      }
    });

    console.log('Items to update:', itemsToUpdate.length, 'Items to add:', itemsToAdd.length);

    // Always use cache for both household and non-household users
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

  // Direct add shopping list item (to avoid sync read)
  const addShoppingListItem = async (item: Omit<ShoppingItem, 'id'>) => {
    if (!user?.id) return;
    try {
      const inHousehold = isHouseholdMember(household, user) && household?.id;
      
      // Generate local ID
      const id = Math.random().toString(36).substr(2, 9);
      
      // Add to cache
      const fullItem: ShoppingItem = { ...item, id, addedAt: new Date() };
      await ShoppingListCacheService.addItemToCache(fullItem, inHousehold ? household.id : undefined, inHousehold ? undefined : user.id);
      
      console.log('✅ Shopping list item added with ID:', id);
    } catch (err: any) {
      console.error('Error adding shopping list item:', error);
      addToast('Failed to add item to shopping list.', 'error');
    }
  };

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
    handleSaveRecipe,
    handleDeleteRecipe,
    handleRateRecipe,
    handleMarkAsMade,
    // Item management with undo
    updateItem,
    deleteItem,
    addItem,
    addItems,
    // Undo
    recentActions,
    recordUndo,
    performUndo,
    // Usage limit states
    recipeSaveLimitExceeded,
    mealPlanLimitExceeded,
    // Usage limit checking functions
    checkRecipeSaveLimit,
    checkMealPlanLimit,
    // Manual sync functions
    syncShoppingListToDatabase,
    addShoppingListItem,
    // Loading states
    isLoadingInventory,
    isLoadingShoppingList,
    isLoadingMealPlan,
    isLoadingSavedRecipes,
    isLoadingRatings,
    isLoadingHousehold,
    // Offline queue
    addToQueue: offlineQueue.enqueue.bind(offlineQueue),
    processQueue: offlineQueue.processQueue.bind(offlineQueue),
  };
}
