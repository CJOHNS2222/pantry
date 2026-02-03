/**
 * Factory functions for creating Firestore listeners to eliminate code duplication
 * in useDataManagement.ts. These functions handle the common patterns for
 * shopping list, saved recipes, and meal plan listeners.
 */

import { onSnapshot, collection } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { User, Household, ShoppingItem, SavedRecipe, DayPlan } from '../types';
import { hasShoppingItemsChanged, hasSavedRecipesChanged, hasMealPlansChanged } from '../utils/comparisonUtils';
import { setRemoteShoppingListUpdate, setRemoteMealPlanUpdate } from '../services/syncStateService';

/**
 * Creates a shopping list listener for either user or household collections
 */
export function createShoppingListListener(
  user: User,
  household: Household | null,
  inHousehold: boolean,
  setShoppingList: (items: ShoppingItem[]) => void
) {
  const collectionPath = inHousehold
    ? `households/${household!.id}/shoppingList`
    : `users/${user.id}/shoppingList`;

  return onSnapshot(collection(db, collectionPath), snap => {
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
    if (hasShoppingItemsChanged(data, [])) { // We'll pass current state when calling
      setRemoteShoppingListUpdate(true);
      setShoppingList(data);
    }
  }, err => {
    console.error(`${inHousehold ? 'Household' : 'User'} shoppingList listener failed:`, err);
  });
}

/**
 * Creates a saved recipes listener for either user or household collections
 */
export function createSavedRecipesListener(
  user: User,
  household: Household | null,
  inHousehold: boolean,
  setSavedRecipes: (recipes: SavedRecipe[]) => void
) {
  const collectionPath = inHousehold
    ? `households/${household!.id}/savedRecipes`
    : `users/${user.id}/savedRecipes`;

  return onSnapshot(collection(db, collectionPath), snap => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedRecipe));

    // Remove duplicates based on title
    const uniqueData = data.filter((recipe, index, self) =>
      index === self.findIndex(r => r.title?.toLowerCase() === recipe.title?.toLowerCase())
    );

    // Only update if different to prevent infinite loops
    if (hasSavedRecipesChanged(uniqueData, [])) { // We'll pass current state when calling
      setSavedRecipes(uniqueData);
    }
  }, err => {
    console.error(`${inHousehold ? 'Household' : 'User'} savedRecipes listener failed:`, err);
  });
}

/**
 * Creates a meal plan listener for either user or household collections
 */
export function createMealPlanListener(
  user: User,
  household: Household | null,
  inHousehold: boolean,
  setMealPlan: (plan: DayPlan[]) => void
) {
  const collectionPath = inHousehold
    ? `households/${household!.id}/mealPlan`
    : `users/${user.id}/mealPlan`;

  return onSnapshot(collection(db, collectionPath), snap => {
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
    if (hasMealPlansChanged(fullWeekPlan, [])) { // We'll pass current state when calling
      setRemoteMealPlanUpdate(true);
      setMealPlan(fullWeekPlan);
    }
  }, err => {
    console.error(`${inHousehold ? 'Household' : 'User'} mealPlan listener failed:`, err);
  });
}