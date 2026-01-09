import { useState, useEffect, useRef, useMemo } from 'react';
import { doc, onSnapshot, collection, addDoc, getDocs, setDoc, serverTimestamp, query, where, orderBy, Timestamp, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { User, PantryItem, DayPlan, Household, ShoppingItem, SavedRecipe, RecipeRating, RecipeSearchResult, CustomCategory, RecipeSuggestion } from '../types';
import { next7DateKeys, isHouseholdMember, generateConsumptionSuggestions, generateExpirationAlerts, generateRecipeSuggestions } from '../utils/appUtils';
import { UsageService } from '../services/usageService';
import AnalyticsService from '../services/analyticsService';

export function useDataManagement(user: User | null, addToast: (message: string, type?: 'error' | 'info') => void, addToShoppingList?: (items: string[]) => void) {
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

  // Helper function to clean objects by removing undefined fields (Firestore requirement)
  const cleanObject = (obj: any): any => {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        cleaned[key] = obj[key];
      }
    }
    return cleaned;
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
            const mealType = meal.type || 'dinner'; // Default to dinner if no type specified
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
    if (!user?.id) return;

    const unsubs: (()=>void)[] = [];

    // Determine if we are in a valid household (multi-member household)
    const inHousehold = isHouseholdMember(household, user) && household?.id && 
                       (Array.isArray(household.memberIds) ? household.memberIds.length > 1 : false);

    // Inventory listener - conditional based on household status
    if (inHousehold) {
      // Listen to household inventory when in household
      unsubs.push(onSnapshot(collection(db, 'households', household.id, 'inventory'), snap => {
        const serverData = snap.docs.map(d => ({ id: d.id, ...d.data() } as PantryItem));
        // Only update if different to prevent infinite loops
        if (JSON.stringify(serverData) !== JSON.stringify(inventory)) {
          setInventory(serverData);
        }
        initialDataLoadedRef.current = true;
      }, err => {
        console.error("Household inventory listener failed:", err);
      }));
    } else {
      // Listen to user inventory when not in household
      unsubs.push(onSnapshot(collection(db, 'users', user.id, 'inventory'), snap => {
        const serverData = snap.docs.map(d => ({ id: d.id, ...d.data() } as PantryItem));
        // Only update if different to prevent infinite loops
        if (JSON.stringify(serverData) !== JSON.stringify(inventory)) {
          setInventory(serverData);
        }
        initialDataLoadedRef.current = true;
      }, err => {
        console.error("User inventory listener failed:", err);
      }));

      // User listeners when not in multi-member household
      unsubs.push(onSnapshot(collection(db, 'users', user.id, 'shoppingList'), snap => {
        const data = snap.docs.map(d => {
          const docData = d.data();
          return {
            id: d.id,
            item: docData.item || '',
            category: docData.category || 'Manual',
            checked: docData.checked || false,
            quantity: docData.quantity
          } as ShoppingItem;
        });
        // Only update if different to prevent infinite loops
        if (JSON.stringify(data) !== JSON.stringify(shoppingList)) {
          (window as any).__remoteShoppingListUpdate = true;
          setShoppingList(data);
          setTimeout(() => { (window as any).__remoteShoppingListUpdate = false; }, 100);
        }
      }, err => {
        console.error("User shoppingList listener failed:", err);
      }));

      unsubs.push(onSnapshot(collection(db, 'users', user.id, 'savedRecipes'), snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedRecipe));
        // Remove duplicates based on title
        const uniqueData = data.filter((recipe, index, self) => 
          index === self.findIndex(r => r.title?.toLowerCase() === recipe.title?.toLowerCase())
        );
        // Only update if different to prevent infinite loops
        if (JSON.stringify(uniqueData) !== JSON.stringify(savedRecipes)) {
          setSavedRecipes(uniqueData);
        }
      }, err => {
        console.error("User savedRecipes listener failed:", err);
      }));

      unsubs.push(onSnapshot(collection(db, 'users', user.id, 'mealPlan'), snap => {
        // Create a 7-day (free) or 14-day (premium) template starting from today
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = new Date();
        const isPremium = user && (user.subscription?.tier === 'premium' || user.subscription?.tier === 'family');
        const daysToShow = isPremium ? 14 : 7;
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
          const dateStr = data.date.toDate().toISOString().slice(0, 10);
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

        // Only update if different from current
        if (JSON.stringify(fullWeekPlan) !== JSON.stringify(mealPlan)) {
          (window as any).__remoteMealPlanUpdateRef = { current: true };
          setMealPlan(fullWeekPlan);
          setTimeout(() => { (window as any).__remoteMealPlanUpdateRef = { current: false }; }, 100);
        }
      }, err => {
        console.error("User mealPlan listener failed:", err);
      }));
    }

    // Household query listener (always set up)
    if (user?.id) {
      const householdQuery = query(collection(db, 'households'), where('memberIds', 'array-contains', user.id));
      unsubs.push(
        onSnapshot(
          householdQuery,
          (snap) => {
            if (!snap.empty) {
              const doc = snap.docs[0];
              setHousehold({ id: doc.id, ...doc.data() } as Household);
            } else {
              setHousehold(null);
            }
          },
          (err) => console.error("Household query listener failed:", err)
        )
      );
    }

    if (inHousehold) {
      // Household listeners
      unsubs.push(onSnapshot(collection(db, 'households', household.id, 'shoppingList'), snap => {
        const data = snap.docs.map(d => {
          const docData = d.data();
          return {
            id: d.id,
            item: docData.item || '',
            category: docData.category || 'Manual',
            checked: docData.checked || false,
            quantity: docData.quantity
          } as ShoppingItem;
        });
        // Only update if different to prevent infinite loops
        if (JSON.stringify(data) !== JSON.stringify(shoppingList)) {
          (window as any).__remoteShoppingListUpdate = true;
          setShoppingList(data);
          setTimeout(() => { (window as any).__remoteShoppingListUpdate = false; }, 100);
        }
      }, err => {
        console.error("Household shoppingList listener failed:", err);

      }));

      unsubs.push(onSnapshot(collection(db, 'households', household.id, 'savedRecipes'), snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedRecipe));
        // Remove duplicates based on title
        const uniqueData = data.filter((recipe, index, self) => 
          index === self.findIndex(r => r.title?.toLowerCase() === recipe.title?.toLowerCase())
        );
        // Only update if different to prevent infinite loops
        if (JSON.stringify(uniqueData) !== JSON.stringify(savedRecipes)) {
          setSavedRecipes(uniqueData);
        }
      }, err => {
        console.error("Household savedRecipes listener failed:", err);

      }));

      unsubs.push(onSnapshot(collection(db, 'households', household.id, 'mealPlan'), snap => {
        // Create a 7-day (free) or 14-day (premium) template starting from today
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = new Date();
        const isPremium = user && (user.subscription?.tier === 'premium' || user.subscription?.tier === 'family');
        const daysToShow = isPremium ? 14 : 7;
        const fullWeekPlan: DayPlan[] = [];

        for (let i = 0; i < daysToShow; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() + i);
          const iso = d.toISOString().slice(0, 10);
          fullWeekPlan.push({
            date: iso,
            dayName: days[d.getDay()],
            meals: []
          });
        }

        // Merge Firestore data into the template
        snap.docs.forEach(doc => {
          const data = doc.data();
          const dateStr = data.date.toDate().toISOString().slice(0, 10);
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

        // Only update if different from current
        if (JSON.stringify(fullWeekPlan) !== JSON.stringify(mealPlan)) {
          (window as any).__remoteMealPlanUpdateRef = { current: true };
          setMealPlan(fullWeekPlan);
          setTimeout(() => { (window as any).__remoteMealPlanUpdateRef = { current: false }; }, 100);
        }
      }, err => {
        console.error("Household mealPlan listener failed:", err);

      }));
    } else {
      // Individual user listeners
      unsubs.push(onSnapshot(collection(db, 'users', user.id, 'shoppingList'), snap => {
        const data = snap.docs.map(d => {
          const docData = d.data();
          return {
            id: d.id,
            item: docData.item || '',
            category: docData.category || 'Manual',
            checked: docData.checked || false,
            quantity: docData.quantity
          } as ShoppingItem;
        });
        // Only update if different to prevent infinite loops
        if (JSON.stringify(data) !== JSON.stringify(shoppingList)) {
          (window as any).__remoteShoppingListUpdate = true;
          setShoppingList(data);
          setTimeout(() => { (window as any).__remoteShoppingListUpdate = false; }, 100);
        }
      }, err => {
        console.error("User shoppingList listener failed:", err);

      }));

      unsubs.push(onSnapshot(collection(db, 'users', user.id, 'savedRecipes'), snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedRecipe));
        // Remove duplicates based on title
        const uniqueData = data.filter((recipe, index, self) => 
          index === self.findIndex(r => r.title?.toLowerCase() === recipe.title?.toLowerCase())
        );
        // Only update if different to prevent infinite loops
        if (JSON.stringify(uniqueData) !== JSON.stringify(savedRecipes)) {
          setSavedRecipes(uniqueData);
        }
      }, err => {
        console.error("User savedRecipes listener failed:", err);

      }));

      unsubs.push(onSnapshot(collection(db, 'users', user.id, 'mealPlan'), snap => {
        // Create a 7-day (free) or 14-day (premium) template starting from today
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = new Date();
        const isPremium = user && (user.subscription?.tier === 'premium' || user.subscription?.tier === 'family');
        const daysToShow = isPremium ? 14 : 7;
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
          const dateStr = data.date.toDate().toISOString().slice(0, 10);
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

        // Only update if different from current
        if (JSON.stringify(fullWeekPlan) !== JSON.stringify(mealPlan)) {
          (window as any).__remoteMealPlanUpdateRef = { current: true };
          setMealPlan(fullWeekPlan);
          setTimeout(() => { (window as any).__remoteMealPlanUpdateRef = { current: false }; }, 100);
        }
      }, err => {
        console.error("User mealPlan listener failed:", err);

      }));

      // Custom Categories listener
      unsubs.push(onSnapshot(collection(db, 'users', user.id, 'customCategories'), snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomCategory));
        setCustomCategories(data);
      }, err => {
        console.error("User customCategories listener failed:", err);
      }));
    }

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [user?.id, household?.id]);

  // Set flag when listeners are ready
  useEffect(() => {
    listenersReadyRef.current = true;
    initialDataLoadedRef.current = false; // Reset when listeners change
    return () => {
      listenersReadyRef.current = false;
      initialDataLoadedRef.current = false;
    };
  }, [user?.id, household?.id]);

  // Check for expired items and handle them
  useEffect(() => {
    if (!inventory.length || !user?.id) return;

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format
    const expiredItems = inventory.filter(item => 
      item.expirationDate && item.expirationDate <= today
    );

    if (expiredItems.length > 0) {
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
  }, [inventory, user?.id, addToShoppingList, addToast]);

  // Write changes to Firestore
  useEffect(() => {
    if (!user?.id || !listenersReadyRef.current || !initialDataLoadedRef.current) return;
    if ((window as any).__remoteMealPlanUpdateRef?.current) {
      return;
    }

    // Determine if we are in a valid household (multi-member household)
    const inHousehold = household?.id && isHouseholdMember(household, user) && 
                       (Array.isArray(household.memberIds) ? household.memberIds.length > 1 : false);

    console.log('Inventory sync triggered - user:', user?.id, 'household:', household?.id, 'inventory length:', inventory.length, 'inHousehold:', inHousehold);

    (async () => {
      (window as any).__writingMealPlan = true;
      try {
        
        if (inHousehold) {
          // When in household, sync inventory to household collection
          const householdInventoryPath = `households/${household.id}/inventory`;
          const existingHouseholdInventoryDocs = await getDocs(collection(db, householdInventoryPath));
          const existingHouseholdInventory = existingHouseholdInventoryDocs.docs.map(doc => ({ id: doc.id, ...doc.data() } as PantryItem));

          // Find items to delete (in DB but not in current state)
          const householdInventoryToDelete = existingHouseholdInventory.filter(existing =>
            !inventory.some(current => current.id === existing.id)
          );

          // Find items to add/update (in current state but not in DB, or different)
          const householdInventoryToSave = inventory.filter(current => {
            const existing = existingHouseholdInventory.find(item => item.id === current.id);
            return !existing ||
                   existing.item !== current.item ||
                   existing.category !== current.category ||
                   existing.quantity_estimate !== current.quantity_estimate ||
                   existing.storageLocation !== current.storageLocation ||
                   existing.expirationDate !== current.expirationDate ||
                   existing.expirationType !== current.expirationType ||
                   existing.dateAdded !== current.dateAdded ||
                   existing.lastRestocked !== current.lastRestocked ||
                   JSON.stringify(existing.consumptionHistory || []) !== JSON.stringify(current.consumptionHistory || []);
          });

          // Delete removed items
          const householdDeletePromises = householdInventoryToDelete.map(item =>
            deleteDoc(doc(db, householdInventoryPath, item.id)).catch(err => ({ err, path: `${householdInventoryPath}/${item.id}` }))
          );

          // Save new/modified items
          const householdSavePromises = householdInventoryToSave.map(item => {
            console.log('Saving household item:', cleanObject(item));
            return setDoc(doc(db, householdInventoryPath, item.id), cleanObject(item)).catch(err => ({ err, path: `${householdInventoryPath}/${item.id}` }));
          });

          const householdInventoryPromises = [...householdDeletePromises, ...householdSavePromises];
          console.log('Household inventory sync - toDelete:', householdInventoryToDelete.length, 'toSave:', householdInventoryToSave.length);
          if (householdInventoryPromises.length > 0) {
            const results: any[] = await Promise.allSettled(householdInventoryPromises);
            results.forEach((res, idx) => {
              if (res.status === 'rejected' || (res.status === 'fulfilled' && (res.value as any)?.err)) {
                console.error('Household inventory sync failed:', res);
                addToast(`Failed to sync inventory item`, 'error');
              }
            });
          }
          
          // Sync other household data (saved recipes, meal plan)
          const householdWrites: Promise<any>[] = [];
          savedRecipes.filter(item => item && item.id).forEach(item => {
            householdWrites.push(
              setDoc(doc(db, 'households', household.id, 'savedRecipes', item.id), cleanObject(item)).catch(err => ({ err, path: `households/${household.id}/savedRecipes/${item.id}` }))
            );
          });
          if (mealPlan) {
            // Clean up old meal plan entries (older than today)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = today.toISOString().slice(0, 10);
            
            try {
              const oldMealPlanDocs = await getDocs(query(
                collection(db, 'households', household.id, 'mealPlan'),
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
                setDoc(doc(db, 'households', household.id, 'mealPlan', docId), payload).catch(err => ({ err, path: `households/${household.id}/mealPlan/${docId}` }))
              );
            });
          }

          const householdResults = await Promise.allSettled(householdWrites);
          householdResults.forEach((res, idx) => {
            if (res.status === 'rejected' || (res.status === 'fulfilled' && (res.value as any)?.err)) {
              console.error('Household write failed:', res);
              addToast('Failed to save some household data', 'error');
            }
          });
        } else {
          // When not in household, sync inventory to user's collection
          const userInventoryPath = `users/${user.id}/inventory`;
          const existingUserInventoryDocs = await getDocs(collection(db, userInventoryPath));
          const existingUserInventory = existingUserInventoryDocs.docs.map(doc => ({ id: doc.id, ...doc.data() } as PantryItem));

          // Find items to delete (in DB but not in current state)
          const userInventoryToDelete = existingUserInventory.filter(existing =>
            !inventory.some(current => current.id === existing.id)
          );

          // Find items to add/update (in current state but not in DB, or different)
          const userInventoryToSave = inventory.filter(current => {
            const existing = existingUserInventory.find(item => item.id === current.id);
            return !existing ||
                   existing.item !== current.item ||
                   existing.category !== current.category ||
                   existing.quantity_estimate !== current.quantity_estimate ||
                   existing.storageLocation !== current.storageLocation ||
                   existing.expirationDate !== current.expirationDate ||
                   existing.expirationType !== current.expirationType ||
                   existing.dateAdded !== current.dateAdded ||
                   existing.lastRestocked !== current.lastRestocked ||
                   JSON.stringify(existing.consumptionHistory || []) !== JSON.stringify(current.consumptionHistory || []);
          });

          // Delete removed items
          const userDeletePromises = userInventoryToDelete.map(item =>
            deleteDoc(doc(db, userInventoryPath, item.id)).catch(err => ({ err, path: `${userInventoryPath}/${item.id}` }))
          );

          // Save new/modified items
          const userSavePromises = userInventoryToSave.map(item => {
            console.log('Saving user item:', cleanObject(item));
            return setDoc(doc(db, userInventoryPath, item.id), cleanObject(item)).catch(err => ({ err, path: `${userInventoryPath}/${item.id}` }));
          });

          const userInventoryPromises = [...userDeletePromises, ...userSavePromises];
          console.log('User inventory sync - toDelete:', userInventoryToDelete.length, 'toSave:', userInventoryToSave.length);
          if (userInventoryPromises.length > 0) {
            const results: any[] = await Promise.allSettled(userInventoryPromises);
            results.forEach((res, idx) => {
              if (res.status === 'rejected' || (res.status === 'fulfilled' && (res.value as any)?.err)) {
                console.error('User inventory sync failed:', res);
                addToast(`Failed to sync inventory item`, 'error');
              }
            });
          }
          
          // Individual user collections (when not in household)
          const userWrites: Promise<any>[] = [];
          
          savedRecipes.filter(item => item && item.id).forEach(item => {
            userWrites.push(
              setDoc(doc(db, 'users', user.id, 'savedRecipes', item.id), cleanObject(item)).catch(err => ({ err, path: `users/${user.id}/savedRecipes/${item.id}` }))
            );
          });
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
              console.error('User write failed:', res);
              addToast('Failed to save some user data', 'error');
            }
          });
        }
      } finally {
        (window as any).__writingMealPlan = false;
      }
    })();
    }, [user?.id, household?.id, inventory, savedRecipes, mealPlan]);

  // Shopping list sync
  useEffect(() => {
    if (!user?.id || !listenersReadyRef.current || !shoppingList || (window as any).__remoteShoppingListUpdate) {
      return;
    }

    // Debounce the sync to avoid running on every state change
    const timeoutId = setTimeout(async () => {
      try {
        const collectionPath = household?.id && isHouseholdMember(household, user) && 
                           (Array.isArray(household.memberIds) ? household.memberIds.length > 1 : false)
          ? `households/${household.id}/shoppingList`
          : `users/${user.id}/shoppingList`;

        // Get existing documents
        const existingDocs = await getDocs(collection(db, collectionPath));
        const existingItems = existingDocs.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShoppingItem));

        // Find items to delete (in DB but not in current state)
        const toDelete = existingItems.filter(existing =>
          !shoppingList.some(current => current.id === existing.id)
        );

        // Find items to add/update (in current state but not in DB, or different)
        const toSave = shoppingList.filter(current => {
          const existing = existingItems.find(item => item.id === current.id);
          return !existing || existing.item !== current.item || existing.category !== current.category || existing.checked !== current.checked || existing.quantity !== current.quantity;
        });

        console.log('Shopping list sync - collection:', collectionPath, 'toDelete:', toDelete.length, 'toSave:', toSave.length);

        // Delete removed items
        const deletePromises = toDelete.map(item =>
          deleteDoc(doc(db, collectionPath, item.id)).catch(err => ({ err, path: `${collectionPath}/${item.id}` }))
        );

        // Save new/modified items
        const savePromises = toSave.map(item =>
          setDoc(doc(db, collectionPath, item.id), {
            item: item.item,
            category: item.category,
            checked: item.checked,
            quantity: item.quantity,
            lastModifiedAt: serverTimestamp()
          }).catch(err => ({ err, path: `${collectionPath}/${item.id}` }))
        );

        const allPromises = [...deletePromises, ...savePromises];
        if (allPromises.length > 0) {
          const results = await Promise.allSettled(allPromises);
          const failures = results.filter((res, idx) => res.status === 'rejected' || (res.status === 'fulfilled' && (res.value as any)?.err));
        }
      } catch (error) {
        console.error('Error syncing shopping list:', error);
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [user?.id, household?.id, shoppingList]);

  // Meal plan sync
  useEffect(() => {
    // Cleanup old meal plan entries (older than 7 days) on app load
    if (!user?.id) return;

    const cleanupOldMealPlans = async () => {
      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const cutoffDate = Timestamp.fromDate(sevenDaysAgo);

        const collectionPath = household?.id && isHouseholdMember(household, user) && 
                           (Array.isArray(household.memberIds) ? household.memberIds.length > 1 : false)
          ? `households/${household.id}/mealPlan`
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
        console.error('Error cleaning up old meal plans:', error);
      }
    };

    // Only run cleanup once per session
    if (!(window as any).__mealPlanCleanupDone) {
      (window as any).__mealPlanCleanupDone = true;
      cleanupOldMealPlans();
    }
  }, [user?.id, household?.id]);

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
    }, (error) => {
      console.error('Error loading ratings from Firestore:', error);
      if ((error as any)?.code === 'permission-denied') {
        addToast('Unable to read community ratings (permission denied).', 'error');
      }
      const saved = localStorage.getItem('ratings');
      if (saved) setRatings(JSON.parse(saved));
    });
    return () => unsubscribe();
  }, [user?.id]);

  // Persistence
  useEffect(() => { localStorage.setItem('mealPlan', JSON.stringify(mealPlan)); }, [mealPlan]);
  useEffect(() => { localStorage.setItem('household', JSON.stringify(household)); }, [household]);

  // Handlers
  const handleAddToPlan = async (recipe: any) => {
    if (!mealPlan) return;

    // Check if we've already determined the limit is exceeded
    if (mealPlanLimitExceeded) {
      addToast('You\'ve reached your weekly meal planning limit. Upgrade to Premium for unlimited meal planning!', 'error');
      return;
    }

    // Check meal planning limits for free users
    if (user) {
      try {
        // Use the checkMealPlanLimit function to update state
        const canAdd = await checkMealPlanLimit();
        if (!canAdd) {
          addToast('You\'ve reached your weekly meal planning limit. Upgrade to Premium for unlimited meal planning!', 'error');
          return;
        }
      } catch (error) {
        console.error('Error checking meal planning limits:', error);
        // Continue if limit check fails
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    let updatedPlan = [...mealPlan];

    // Check if today exists in the plan
    const todayIndex = updatedPlan.findIndex(day => day.date === today);
    if (todayIndex === -1) {
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
    }

    // Now add the recipe to today as a meal object
    updatedPlan = updatedPlan.map(day => {
      if (day.date === today) {
        const newMeal = {
          id: `meal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          recipe: recipe,
          mealType: 'breakfast' as const
        };
        return { ...day, breakfast: [...day.breakfast, newMeal] };
      }
      return day;
    });

    setMealPlan(updatedPlan);
    addToast(`Added ${recipe.title} to today's meal plan!`);

    // Track analytics
    AnalyticsService.trackMealPlanAdd(recipe.id || recipe.title, recipe.title, 'breakfast', 0);

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

  const handleSaveRecipe = async (recipe: any) => {
    if (!user?.id) return;
    
    // Check if we've already determined the limit is exceeded
    if (recipeSaveLimitExceeded) {
      addToast('You have reached the maximum number of saved recipes for your plan. Please upgrade to save more recipes.', 'error');
      return;
    }
    
    try {
      const inHousehold = isHouseholdMember(household, user) && household?.id && 
                         (Array.isArray(household.memberIds) ? household.memberIds.length > 1 : false);
      const collectionPath = inHousehold ? `households/${household.id}/savedRecipes` : `users/${user.id}/savedRecipes`;
      
      // Check for duplicate recipes
      const existingRecipe = savedRecipes.find(saved => 
        saved.title?.toLowerCase() === recipe.title?.toLowerCase()
      );
      
      if (existingRecipe) {
        addToast(`"${recipe.title}" is already saved in your recipes!`, 'info');
        return;
      }

      // Check recipe save limit (and update state)
      const canSave = await checkRecipeSaveLimit();
      if (!canSave) {
        addToast('You have reached the maximum number of saved recipes for your plan. Please upgrade to save more recipes.', 'error');
        return;
      }
      
      await addDoc(collection(db, collectionPath), {
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
      addToast('Failed to save recipe. Please try again.', 'error');
    }
  };

  const handleDeleteRecipe = async (recipe: SavedRecipe) => {
    if (!user?.id) return;
    try {
      const inHousehold = isHouseholdMember(household, user) && household?.id && 
                         (Array.isArray(household.memberIds) ? household.memberIds.length > 1 : false);
      const collectionPath = inHousehold ? `households/${household.id}/savedRecipes` : `users/${user.id}/savedRecipes`;
      
      await deleteDoc(doc(db, collectionPath, recipe.id));
      
      addToast(`Removed ${recipe.title} from your saved recipes.`);
    } catch (error) {
      console.error('Error deleting recipe:', error);
      addToast('Failed to delete recipe. Please try again.', 'error');
    }
  };

  const handleRateRecipe = async (ratingData: any) => {
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
        ...newCategory,
        createdAt: serverTimestamp()
      });

      // Update local state
      const categoryWithId = { ...newCategory, id: docRef.id };
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
    // Usage limit states
    recipeSaveLimitExceeded,
    mealPlanLimitExceeded,
    // Usage limit checking functions
    checkRecipeSaveLimit,
    checkMealPlanLimit,
  };
}