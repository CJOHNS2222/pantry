import { useState, useEffect, useRef, useMemo } from 'react';
import { collection, doc, onSnapshot, getDocs, setDoc, serverTimestamp, query, where, Timestamp, deleteDoc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import DatabaseMonitoringService from '../services/databaseMonitoringService';
import AnalyticsService from '../services/analyticsService';
import { UsageService } from '../services/usageService';
import { User, PantryItem, DayPlan, Household, ShoppingItem, SavedRecipe, RecipeRating, RecipeRatingInput, CustomCategory, MealPlanItem, StructuredRecipe, ConsumptionSuggestion, ExpirationAlert, RecipeSuggestion } from '../types';
import { AppError } from '../utils/errorUtils';
import { hasPantryItemsChanged, hasArraysChanged } from '../utils/comparisonUtils';
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
import HapticService from '../services/hapticService';

// Global flag to prevent multiple listener setups
const globalListenersSetUp = { current: false };

// Helper functions for creating scoped listeners
function createShoppingListListener(
  user: User,
  household: Household | null,
  inHousehold: boolean,
  setShoppingList: (items: ShoppingItem[]) => void,
  setIsLoadingShoppingList: (loading: boolean) => void
) {
  if (inHousehold) {
    return onSnapshot(collection(db, 'households', user.householdId, 'shoppingList'), snap => {
      const serverData = snap.docs.map(d => ({ id: d.id, ...d.data() } as ShoppingItem));
      setRemoteShoppingListUpdate(true);
      setShoppingList(serverData);
      setIsLoadingShoppingList(false);
    }, err => {
      // Don't log permission-denied errors as they are expected when user doesn't have access
      if (err.code !== 'permission-denied') {
        log.error('Household shopping list listener failed', err, 'DataManagement');
      }
      setIsLoadingShoppingList(false);
    });
  } else {
    return onSnapshot(collection(db, 'users', user.id, 'shoppingList'), snap => {
      const serverData = snap.docs.map(d => ({ id: d.id, ...d.data() } as ShoppingItem));
      setRemoteShoppingListUpdate(true);
      setShoppingList(serverData);
      setIsLoadingShoppingList(false);
    }, err => {
      // Don't log permission-denied errors as they are expected when user doesn't have access
      if (err.code !== 'permission-denied') {
        log.error('User shopping list listener failed', err, 'DataManagement');
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
    return onSnapshot(collection(db, 'households', user.householdId, 'savedRecipes'), snap => {
      const serverData = snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedRecipe));
      setSavedRecipes(serverData);
      setIsLoadingSavedRecipes(false);
    }, err => {
      // Don't log permission-denied errors as they are expected when user doesn't have access
      if (err.code !== 'permission-denied') {
        log.error('Household saved recipes listener failed', err, 'DataManagement');
      }
      setIsLoadingSavedRecipes(false);
    });
  } else {
    return onSnapshot(collection(db, 'users', user.id, 'savedRecipes'), snap => {
      const serverData = snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedRecipe));
      setSavedRecipes(serverData);
      setIsLoadingSavedRecipes(false);
    }, err => {
      // Don't log permission-denied errors as they are expected when user doesn't have access
      if (err.code !== 'permission-denied') {
        log.error('User saved recipes listener failed', err, 'DataManagement');
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
  setIsLoadingMealPlan: (loading: boolean) => void
) {
  if (inHousehold) {
    return onSnapshot(collection(db, 'households', user.householdId, 'mealPlan'), snap => {
      // Create a 7-day (free) or 14-day (premium) template starting from today
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const today = new Date();

      // Check usage limits to determine planning horizon
      let daysToShow = 7; // Default to 7 days
      if (user?.subscription?.tier === 'family') {
        daysToShow = 14; // Family users always get 2 weeks
      } else if (user?.subscription?.tier === 'premium') {
        daysToShow = 14; // Premium users get 2 weeks
      } else {
        daysToShow = 7; // Free users get 1 week
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

      // Merge Firestore data into the template
      snap.docs.forEach(doc => {
        const data = doc.data();
        const dateStr = data.date && typeof data.date.toDate === 'function'
          ? data.date.toDate().toISOString().slice(0, 10)
          : data.date;
        const existingDay = fullWeekPlan.find(day => day.date === dateStr);
        if (existingDay) {
          // Handle migration from old meals array to new structure
          if (data.meals && Array.isArray(data.meals)) {
            // Migrate old meals array to new structure
            const validMeals = data.meals.filter((meal: any) => meal && meal.id && meal.recipe);
            validMeals.forEach((meal: any) => {
              const mealType = meal.type || 'dinner'; // Default to dinner if no type specified
              switch (mealType) {
                case 'breakfast':
                  existingDay.breakfast.push(meal);
                  break;
                case 'lunch':
                  existingDay.lunch.push(meal);
                  break;
                case 'dinner':
                default:
                  existingDay.dinner.push(meal);
                  break;
              }
            });
          } else {
            // Handle new structure directly
            existingDay.breakfast = data.breakfast || [];
            existingDay.lunch = data.lunch || [];
            existingDay.dinner = data.dinner || [];
          }
        }
      });

      setRemoteMealPlanUpdate(true);
      setMealPlan(fullWeekPlan);
      setIsLoadingMealPlan(false);
    }, err => {
      // Don't log permission-denied errors as they are expected when user doesn't have access
      if (err.code !== 'permission-denied') {
        console.error("Household meal plan listener failed:", err);
      }
      setIsLoadingMealPlan(false);
    });
  } else {
    return onSnapshot(collection(db, 'users', user.id, 'mealPlan'), snap => {
      // Create a 7-day (free) or 14-day (premium) template starting from today
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const today = new Date();

      // Check usage limits to determine planning horizon
      let daysToShow = 7; // Default to 7 days
      if (user?.subscription?.tier === 'family') {
        daysToShow = 14; // Family users always get 2 weeks
      } else if (user?.subscription?.tier === 'premium') {
        daysToShow = 14; // Premium users get 2 weeks
      } else {
        daysToShow = 7; // Free users get 1 week
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

      // Merge Firestore data into the template
      snap.docs.forEach(doc => {
        const data = doc.data();
        const dateStr = data.date && typeof data.date.toDate === 'function'
          ? data.date.toDate().toISOString().slice(0, 10)
          : data.date;
        const existingDay = fullWeekPlan.find(day => day.date === dateStr);
        if (existingDay) {
          // Handle migration from old meals array to new structure
          if (data.meals && Array.isArray(data.meals)) {
            // Migrate old meals array to new structure
            const validMeals = data.meals.filter((meal: any) => meal && meal.id && meal.recipe);
            validMeals.forEach((meal: any) => {
              const mealType = meal.type || 'dinner'; // Default to dinner if no type specified
              switch (mealType) {
                case 'breakfast':
                  existingDay.breakfast.push(meal);
                  break;
                case 'lunch':
                  existingDay.lunch.push(meal);
                  break;
                case 'dinner':
                default:
                  existingDay.dinner.push(meal);
                  break;
              }
            });
          } else {
            // Handle new structure directly
            existingDay.breakfast = data.breakfast || [];
            existingDay.lunch = data.lunch || [];
            existingDay.dinner = data.dinner || [];
          }
        }
      });

      setRemoteMealPlanUpdate(true);
      setMealPlan(fullWeekPlan);
      setIsLoadingMealPlan(false);
    }, err => {
      // Don't log permission-denied errors as they are expected when user doesn't have access
      if (err.code !== 'permission-denied') {
        console.error("User meal plan listener failed:", err);
      }
      setIsLoadingMealPlan(false);
    });
  }
}

export function useDataManagement(user: User | null, addToast: (message: string, type?: 'error' | 'info', ttl?: number, actionLabel?: string, action?: () => void) => void, addToShoppingList?: (items: string[]) => void, updateSyncStatus?: (updates: any) => void, activityLogger?: { logItemAdded?: (itemName: string, itemId?: string) => void; logItemRemoved?: (itemName: string, itemId?: string) => void; logShoppingAdded?: (itemName: string, itemId?: string) => void; logRecipeSaved?: (recipeName: string, recipeId?: string) => void; logMealCompleted?: (mealName: string) => void }, options?: { disableInventoryListeners?: boolean }) {
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
        await addDoc(collection(db, operation.collection), operation.data);
      } else if (operation.type === 'update' && operation.docId) {
        await setDoc(doc(db, operation.collection, operation.docId), operation.data);
      } else if (operation.type === 'delete' && operation.docId) {
        await deleteDoc(doc(db, operation.collection, operation.docId));
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
        } else if (day.meals && Array.isArray(day.meals)) {
          // Migrate old meals array to new structure - distribute meals based on type
          const validMeals = day.meals.filter(meal => {
            if (!meal || !meal.id || !meal.recipe || !meal.recipe.title) {
              console.warn('Meal plan validation: invalid meal object', meal);
              return false;
            }
            return true;
          });
          
          // Distribute meals to appropriate arrays based on meal type
          validMeals.forEach(meal => {
            const mealType = meal.mealType || 'dinner'; // Default to dinner if no type specified
            switch (mealType) {
              case 'breakfast':
                breakfast.push(meal);
                break;
              case 'lunch':
                lunch.push(meal);
                break;
              case 'dinner':
              default:
                dinner.push(meal);
                break;
            }
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
    if (globalListenersSetUp.current && !user?.householdId) {
      return;
    }

    const unsubs: (()=>void)[] = [];

    // Household document listener - always listen if user has a household
    if (user?.householdId) {
      unsubs.push(onSnapshot(doc(db, 'households', user.householdId), snap => {
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
        // Listen to household inventory when user has a household
        unsubs.push(onSnapshot(collection(db, 'households', user.householdId, 'inventory'), snap => {
          const serverData = snap.docs.map(d => ({ id: d.id, ...d.data() } as PantryItem));
          // Filter out invalid items
          const validServerData = serverData.filter(item => item && typeof item === 'object' && item.id);
          // Only update if different to prevent infinite loops
          if (hasPantryItemsChanged(validServerData, inventory)) {
            setRemoteInventoryUpdate(true);
            setInventory(validServerData);
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
        // Listen to user inventory when not in household
        unsubs.push(onSnapshot(collection(db, 'users', user.id, 'inventory'), snap => {
          const serverData = snap.docs.map(d => ({ id: d.id, ...d.data() } as PantryItem));
          // Filter out invalid items
          const validServerData = serverData.filter(item => item && typeof item === 'object' && item.id);
          // Only update if different to prevent infinite loops
          if (hasPantryItemsChanged(validServerData, inventory)) {
            setRemoteInventoryUpdate(true);
            setInventory(validServerData);
          }
          setIsLoadingInventory(false);
          initialDataLoadedRef.current = true;
        }, err => {
          // Don't log permission-denied errors as they are expected when user doesn't have access
          if (err.code !== 'permission-denied') {
            console.error("User inventory listener failed:", err);
          }
          setIsLoadingInventory(false);
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
    unsubs.push(createMealPlanListener(user, household, inHousehold, setMealPlan, setIsLoadingMealPlan));

    globalListenersSetUp.current = true;

    return () => {
      unsubs.forEach(unsub => unsub());
      globalListenersSetUp.current = false;
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

    const checkAllergies = async () => {
      try {
        await HouseholdPreferenceService.checkHouseholdInventoryForAllergies(
          household.id,
          inventory,
          user.id
        );
      } catch (error) {
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

    // Debounce the sync to avoid running on every state change
    const timeoutId = setTimeout(async () => {
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

          // Periodic cleanup of orphaned items (run occasionally)
          if (Math.random() < 0.1) { // 10% chance to run cleanup
            try {
              const allDocs = await getDocs(collection(db, householdInventoryPath));
              const currentIds = new Set(inventory.map(item => item.id));
              const orphanedDocs = allDocs.docs.filter(doc => !currentIds.has(doc.id));

              if (orphanedDocs.length > 0) {
                console.log(`Cleaning up ${orphanedDocs.length} orphaned household inventory items`);
                const cleanupBatch = writeBatch(db);
                orphanedDocs.forEach(doc => {
                  cleanupBatch.delete(doc.ref);
                });
                await cleanupBatch.commit();
              }
            } catch (err) {
              console.warn('Failed to cleanup orphaned household inventory items:', err);
            }
          }
          
          // Sync other household data (saved recipes, meal plan)
          const householdWrites: Promise<any>[] = [];
          // Skip writing savedRecipes in sync effect since they are already persisted when saved
          // savedRecipes.filter(item => item && item.id).forEach(item => {
          //   householdWrites.push(
          //     setDoc(doc(db, 'households', household.id, 'savedRecipes', item.id), cleanObject(item)).catch(err => ({ err, path: `households/${household.id}/savedRecipes/${item.id}` }))
          //   );
          // });
          if (mealPlan) {
            // Clean up old meal plan entries (older than today)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = today.toISOString().slice(0, 10);
            
            try {
              const oldMealPlanDocs = await getDocs(query(
                collection(db, 'households', user.householdId, 'mealPlan'),
                where('date', '<', Timestamp.fromDate(today))
              ));
              
              oldMealPlanDocs.docs.forEach(doc => {
                householdWrites.push(
                  deleteDoc(doc.ref).catch(err => ({ err, path: doc.ref.path }))
                );
              });
              
              if (oldMealPlanDocs.docs.length > 0) {
                console.log(`Cleaning up ${oldMealPlanDocs.docs.length} old meal plan entries`);
              }
            } catch (err) {
              console.error('Failed to query old meal plan entries:', err);
            }
            
            mealPlan.filter(item => item != null && item.date).forEach(item => {
              // Save all days to keep database current (even empty days overwrite old data)
              const docId = item.date; // expected 'YYYY-MM-DD'
              if (!docId || typeof docId !== 'string') {
                console.warn('Skipping invalid meal plan item:', item);
                return;
              }
              
              // Validate that the date is a valid date string
              const dateObj = new Date(item.date);
              if (isNaN(dateObj.getTime())) {
                console.warn('Skipping meal plan item with invalid date:', item);
                return;
              }
              
              const payload: any = {
                date: Timestamp.fromDate(dateObj),
                breakfast: Array.isArray(item.breakfast) ? item.breakfast.filter(meal => meal && meal.id && meal.recipe) : [],
                lunch: Array.isArray(item.lunch) ? item.lunch.filter(meal => meal && meal.id && meal.recipe) : [],
                dinner: Array.isArray(item.dinner) ? item.dinner.filter(meal => meal && meal.id && meal.recipe) : [],
                lastModifiedBy: clientId,
                lastModifiedAt: serverTimestamp()
              };
              householdWrites.push(
                setDoc(doc(db, 'households', user.householdId, 'mealPlan', docId), payload).catch(err => ({ err, path: `households/${user.householdId}/mealPlan/${docId}` }))
              );
            });
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
          // When not in household, sync inventory to user's collection
          const userInventoryPath = `users/${user.id}/inventory`;

          // Use batch operations to minimize round trips
          // Note: This approach writes all current items but doesn't delete removed items
          // to avoid reading all documents. Removed items will be cleaned up by the
          // periodic cleanup mechanism or when the collection is next fully synced.
          const batch = writeBatch(db);

          inventory.forEach(item => {
            batch.set(doc(db, userInventoryPath, item.id), cleanObject(item));
          });

          // Periodic cleanup of orphaned items (run occasionally)
          if (Math.random() < 0.1) { // 10% chance to run cleanup
            try {
              const allDocs = await getDocs(collection(db, userInventoryPath));
              const currentIds = new Set(inventory.map(item => item.id));
              const orphanedDocs = allDocs.docs.filter(doc => !currentIds.has(doc.id));

              if (orphanedDocs.length > 0) {
                console.log(`Cleaning up ${orphanedDocs.length} orphaned user inventory items`);
                const cleanupBatch = writeBatch(db);
                orphanedDocs.forEach(doc => {
                  cleanupBatch.delete(doc.ref);
                });
                await cleanupBatch.commit();
              }
            } catch (err) {
              console.warn('Failed to cleanup orphaned user inventory items:', err);
            }
          }
          
          // Individual user collections (when not in household)
          const userWrites: Promise<any>[] = [];
          
          // Skip writing savedRecipes in sync effect since they are already persisted when saved
          // savedRecipes.filter(item => item && item.id).forEach(item => {
          //   userWrites.push(
          //     setDoc(doc(db, 'users', user.id, 'savedRecipes', item.id), cleanObject(item)).catch(err => ({ err, path: `users/${user.id}/savedRecipes/${item.id}` }))
          //   );
          // });
          if (mealPlan) {
            // Clean up old meal plan entries (older than today)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            try {
              const oldMealPlanDocs = await getDocs(query(
                collection(db, 'users', user.id, 'mealPlan'),
                where('date', '<', Timestamp.fromDate(today))
              ));
              
              oldMealPlanDocs.docs.forEach(doc => {
                userWrites.push(
                  deleteDoc(doc.ref).catch(err => ({ err, path: doc.ref.path }))
                );
              });
              
              if (oldMealPlanDocs.docs.length > 0) {
                console.log(`Cleaning up ${oldMealPlanDocs.docs.length} old user meal plan entries`);
              }
            } catch (err) {
              console.error('Failed to query old user meal plan entries:', err);
            }
            
            mealPlan.filter(item => item != null && item.date).forEach(item => {
              // Save all days to keep database current (even empty days overwrite old data)
              const docId = item.date; // expected 'YYYY-MM-DD'
              if (!docId || typeof docId !== 'string') {
                console.warn('Skipping invalid meal plan item:', item);
                return;
              }
              
              // Validate that the date is a valid date string
              const dateObj = new Date(item.date);
              if (isNaN(dateObj.getTime())) {
                console.warn('Skipping meal plan item with invalid date:', item);
                return;
              }
              
              const payload: any = {
                date: Timestamp.fromDate(dateObj),
                breakfast: Array.isArray(item.breakfast) ? item.breakfast.filter(meal => meal && meal.id && meal.recipe) : [],
                lunch: Array.isArray(item.lunch) ? item.lunch.filter(meal => meal && meal.id && meal.recipe) : [],
                dinner: Array.isArray(item.dinner) ? item.dinner.filter(meal => meal && meal.id && meal.recipe) : [],
                lastModifiedBy: clientId,
                lastModifiedAt: serverTimestamp()
              };
              userWrites.push(
                setDoc(doc(db, 'users', user.id, 'mealPlan', docId), payload).catch(err => ({ err, path: `users/${user.id}/mealPlan/${docId}` }))
              );
            });
          }

          const userResults = await Promise.allSettled(userWrites);
          userResults.forEach((res, idx) => {
            if (res.status === 'rejected' || (res.status === 'fulfilled' && (res.value as any)?.err)) {
              log.error('User write failed', { result: res, index: idx }, 'useDataManagement');
              addToast(ERROR_MESSAGES.SAVE_FAILED, 'error');
            }
          });
        }
      } finally {
        writingMealPlanRef.current = false;
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
    }, [user?.id, user?.householdId, inventory, savedRecipes, mealPlan]);

  // Shopping list sync
  useEffect(() => {
    if (!user?.id) return;

    const collectionPath = user?.householdId
      ? `households/${user.householdId}/shoppingList`
      : `users/${user.id}/shoppingList`;

    const collectionPathChanged = lastShoppingListCollectionPathRef.current !== collectionPath;
    lastShoppingListCollectionPathRef.current = collectionPath;

    if (isLoadingShoppingList || !shoppingList || (isRemoteShoppingListUpdate() && !collectionPathChanged)) {
      return;
    }

    // Debounce the sync to avoid running on every state change
    const timeoutId = setTimeout(async () => {
      setRemoteShoppingListUpdate(false); // Reset the flag so sync can run
      try {
        // Calculate changes using batch operations to minimize Firestore reads/writes
        const calculateShoppingListChanges = async () => {
          // Get existing documents to determine what changed
          const shoppingListRef = collection(db, collectionPath);
          const existingDocs = await getDocs(query(shoppingListRef));
          const existingItems = existingDocs.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShoppingItem));

          // Create change sets
          const currentIds = new Set(shoppingList.map(item => item.id));
          const existingIds = new Set(existingItems.map(item => item.id));

          const toDelete = existingItems.filter(item => !currentIds.has(item.id));
          const toAdd = shoppingList.filter(item => !existingIds.has(item.id));
          const potentiallyModified = shoppingList.filter(item => existingIds.has(item.id));

          // Check which existing items have actually changed
          const toUpdate: ShoppingItem[] = [];
          for (const current of potentiallyModified) {
            const existing = existingItems.find(item => item.id === current.id);
            if (existing &&
                (existing.item !== current.item ||
                 existing.category !== current.category ||
                 existing.checked !== current.checked ||
                 existing.quantity !== current.quantity ||
                 existing.source !== current.source)) {
              toUpdate.push(current);
            }
          }

          return { toDelete, toAdd, toUpdate };
        };

        const changeSet = await calculateShoppingListChanges();

        // Use batch operations for all changes
        const batch = writeBatch(db);

        // Delete removed items
        changeSet.toDelete.forEach(item => {
          batch.delete(doc(db, collectionPath, item.id));
        });

        // Add new items
        changeSet.toAdd.forEach(item => {
          batch.set(doc(db, collectionPath, item.id), cleanObject({
            item: item.item,
            category: item.category,
            checked: item.checked,
            quantity: item.quantity,
            source: item.source,
            purchasedQuantity: item.purchasedQuantity,
            lastModifiedAt: serverTimestamp()
          }));
        });

        // Update modified items
        changeSet.toUpdate.forEach(item => {
          batch.set(doc(db, collectionPath, item.id), cleanObject({
            item: item.item,
            category: item.category,
            checked: item.checked,
            quantity: item.quantity,
            source: item.source,
            purchasedQuantity: item.purchasedQuantity,
            lastModifiedAt: serverTimestamp()
          }), { merge: true });
        });

        // Commit all changes in one batch
        await batch.commit();

      } catch (error) {
        console.error('Error syncing shopping list:', error);
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [user?.id, user?.householdId, shoppingList]);

  // Meal plan sync
  useEffect(() => {
    // Cleanup old meal plan entries (older than 7 days) on app load
    if (!user?.id) return;

    const cleanupOldMealPlans = async () => {
      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const cutoffDate = Timestamp.fromDate(sevenDaysAgo);

        const collectionPath = user?.householdId
          ? `households/${user.householdId}/mealPlan`
          : `users/${user.id}/mealPlan`;

        const oldDocsQuery = query(
          collection(db, collectionPath),
          where('date', '<', cutoffDate)
        );

        const oldDocs = await getDocs(oldDocsQuery);
        const deletePromises = oldDocs.docs.map(doc => deleteDoc(doc.ref));

        if (deletePromises.length > 0) {
          await Promise.allSettled(deletePromises);
        }
      } catch (error) {
        // Don't log permission-denied errors as they are expected when user doesn't have access
        if ((error as any)?.code !== 'permission-denied') {
          console.error('Error cleaning up old meal plans:', error);
        }
      }
    };

    // Only run cleanup once per session
    if (!mealPlanCleanupDoneRef.current) {
      mealPlanCleanupDoneRef.current = true;
      cleanupOldMealPlans();
    }
  }, [user?.id, user?.householdId]);

  // Ratings listener
  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = onSnapshot(collection(db, 'ratings'), (snapshot) => {
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
  //     } catch (error) {
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
      } catch (error) {
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
      } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
      const collectionPath = inHousehold ? `households/${household.id}/savedRecipes` : `users/${user.id}/savedRecipes`;

      // Check for duplicate recipes by querying Firestore directly (more reliable than local state)
      const existingRecipesQuery = query(
        collection(db, collectionPath),
        where('title', '==', recipe.title)
      );
      const existingRecipesSnap = await getDocs(existingRecipesQuery);

      // Also check for very similar recipes (same title and similar ingredients count)
      let isDuplicate = false;
      if (existingRecipesSnap.size > 0) {
        for (const doc of existingRecipesSnap.docs) {
          const existing = doc.data() as SavedRecipe;
          const ingredientsMatch = existing.ingredients?.length === recipe.ingredients?.length;
          const instructionsMatch = existing.instructions?.length === recipe.instructions?.length;
          if (ingredientsMatch && instructionsMatch) {
            console.log('⚠️ Found very similar recipe:', existing.title, 'with same structure');
            isDuplicate = true;
            break;
          }
        }
      }

      if (isDuplicate || existingRecipesSnap.size > 0) {
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

      const docRef = await addDoc(collection(db, collectionPath), {
        ...recipe,
        savedAt: serverTimestamp(),
        savedBy: user.name,
        userId: user.id
      });

      // Record recipe save usage
      try {
        await UsageService.recordRecipeSave(user);
      } catch (error) {
        console.error('Error recording recipe save usage:', error);
        // Don't fail the operation if recording fails
      }

      addToast(`Saved ${recipe.title} to your recipes!`);
    } catch (error) {
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
      const collectionPath = inHousehold ? `households/${household.id}/savedRecipes` : `users/${user.id}/savedRecipes`;
      
      await deleteDoc(doc(db, collectionPath, recipe.id));
      
      addToast(`Removed ${recipe.title} from your saved recipes.`);
    } catch (error) {
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
      
      const docRef = await addDoc(collection(db, 'ratings'), ratingDoc);

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
    } catch (error) {
      console.error('Error submitting rating:', error);
      addToast('Failed to submit rating. Please try again.', 'error');
    }
  };

  // Computed consumption suggestions and expiration alerts
  const consumptionSuggestions = useMemo(() => 
    generateConsumptionSuggestions(inventory), [inventory]
  );

  const expirationAlerts = useMemo(() => 
    generateExpirationAlerts(inventory), [inventory]
  );

  const recipeSuggestions = useMemo(() => 
    generateRecipeSuggestions(inventory), [inventory]
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
      const docRef = await addDoc(collection(db, 'users', user.id, 'customCategories'), {
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
    } catch (error) {
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
      await setDoc(doc(db, 'users', user.id, 'customCategories', categoryId), {
        ...updatedCategory,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Update local state
      setCustomCategories(prev => prev.map(cat => 
        cat.id === categoryId ? updatedCategory : cat
      ));

      addToast(`Updated category "${updatedCategory.name}"!`);
    } catch (error) {
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
      await deleteDoc(doc(db, 'users', user.id, 'customCategories', categoryId));

      // Update local state
      setCustomCategories(prev => prev.filter(cat => cat.id !== categoryId));

      addToast(`Deleted category "${category.name}"!`);
    } catch (error) {
      console.error('Error deleting custom category:', error);
      addToast('Failed to delete category. Please try again.', 'error');
    }
  };

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
      
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    setInventory(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });

    // Save to database
    const collectionPath = user?.householdId
      ? `households/${user.householdId}/inventory`
      : `users/${user.id}/inventory`;

    await performWrite({
      type: 'update',
      collection: collectionPath,
      docId: currentItem.id,
      data: cleanObject({ ...currentItem, ...updates })
    });

    // Update the cache
    await InventoryCacheService.updateItemInCache(currentItem.id, updates, user?.householdId, user?.id);
  };

  // Delete item with undo recording
  const deleteItem = async (index: number) => {
    const itemToDelete = inventory[index];
    if (!itemToDelete) return;

    // Log activity if in household
    if (activityLogger?.logItemRemoved && household?.id && isHouseholdMember(household, user) &&
        (Array.isArray(household.memberIds) ? household.memberIds.length > 1 : false)) {
      activityLogger.logItemRemoved(itemToDelete.item, itemToDelete.id);
    }

    // Record the undo action
    await recordUndo('delete_item', itemToDelete);

    // Remove the item from local state
    setInventory(prev => prev.filter((_, i) => i !== index));

    // Delete from database
    const collectionPath = user?.householdId
      ? `households/${user.householdId}/inventory`
      : `users/${user.id}/inventory`;

    await performWrite({
      type: 'delete',
      collection: collectionPath,
      docId: itemToDelete.id
    });

    // Update the cache
    await InventoryCacheService.removeItemFromCache(itemToDelete.id, user?.householdId, user?.id);
  };

  // Add item to inventory
  const addItem = async (item: PantryItem) => {
    // Add to local state
    setInventory(prev => [...prev, item]);

    // Log activity if in household
    if (activityLogger?.logItemAdded && household?.id && isHouseholdMember(household, user) &&
        (Array.isArray(household.memberIds) ? household.memberIds.length > 1 : false)) {
      activityLogger.logItemAdded(item.item, item.id);
    }

    // Save to database
    const collectionPath = user?.householdId
      ? `households/${user.householdId}/inventory`
      : `users/${user.id}/inventory`;

    await performWrite({
      type: 'add',
      collection: collectionPath,
      data: cleanObject(item)
    });

    // Update the cache
    await InventoryCacheService.addItemToCache(item, user?.householdId, user?.id);

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

    // Update database only - let Firestore listener handle local state updates
    const collectionPath = user?.householdId
      ? `households/${user.householdId}/inventory`
      : `users/${user.id}/inventory`;

    // Update existing items
    const updatePromises = itemsToUpdate.map(async ({ index, updates }) => {
      const currentItem = inventory[index];
      await performWrite({
        type: 'update',
        collection: collectionPath,
        docId: currentItem.id,
        data: cleanObject({ ...currentItem, ...updates })
      });
    });

    // Add new items
    const addPromises = itemsToAdd.map(item => performWrite({
      type: 'add',
      collection: collectionPath,
      data: cleanObject(item)
    }));

    await Promise.all([...updatePromises, ...addPromises]);

    // Update the cache with the new inventory state
    // Note: This will be updated again by the real-time listener, but we want to ensure cache consistency
    setTimeout(async () => {
      await InventoryCacheService.updateCache(inventory, user?.householdId, user?.id);
    }, 100); // Small delay to let real-time updates settle
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
    // Loading states
    isLoadingInventory,
    isLoadingShoppingList,
    isLoadingMealPlan,
    isLoadingSavedRecipes,
    isLoadingRatings,
    isLoadingHousehold,
  };
}