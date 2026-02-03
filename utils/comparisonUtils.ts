/**
 * Efficient comparison utilities to replace expensive JSON.stringify() operations
 * These functions provide fast equality checks with early exit conditions
 */

/**
 * Performs a shallow comparison of two arrays by reference
 * Much faster than JSON.stringify() for most use cases
 */
export function hasShallowChanged<T>(arr1: T[] | null, arr2: T[] | null): boolean {
  if (!arr1 || !arr2) return arr1 !== arr2;
  if (arr1.length !== arr2.length) return true;
  // Check by reference first (fastest)
  return arr1.some((item, idx) => item !== arr2[idx]);
}

/**
 * Performs a deep comparison of two arrays of objects
 * Only use when shallow comparison isn't sufficient
 */
export function hasDeepChanged<T extends Record<string, any>>(arr1: T[] | null, arr2: T[] | null): boolean {
  if (!arr1 || !arr2) return arr1 !== arr2;
  if (arr1.length !== arr2.length) return true;

  // Deep comparison only if lengths match
  return !arr1.every((item, idx) => {
    const item2 = arr2[idx];
    if (item === item2) return true; // Same reference

    // Compare primitive fields and nested objects
    const keys1 = Object.keys(item);
    const keys2 = Object.keys(item2);

    if (keys1.length !== keys2.length) return false;

    return keys1.every(key => {
      const val1 = item[key];
      const val2 = item2[key];

      // Handle arrays specially
      if (Array.isArray(val1) && Array.isArray(val2)) {
        return hasShallowChanged(val1, val2);
      }

      // Handle objects recursively (but limit depth to prevent stack overflow)
      if (typeof val1 === 'object' && val1 !== null &&
          typeof val2 === 'object' && val2 !== null) {
        return JSON.stringify(val1) === JSON.stringify(val2); // Fallback for nested objects
      }

      return val1 === val2;
    });
  });
}

/**
 * Optimized comparison for ShoppingItem arrays
 */
export function hasShoppingItemsChanged(items1: any[] | null, items2: any[] | null): boolean {
  if (!items1 || !items2) return items1 !== items2;
  if (items1.length !== items2.length) return true;

  return items1.some((item, idx) => {
    const item2 = items2[idx];
    if (!item || !item2) return item !== item2;

    return item.id !== item2.id ||
           item.item !== item2.item ||
           item.category !== item2.category ||
           item.checked !== item2.checked ||
           item.quantity !== item2.quantity ||
           item.source !== item2.source;
  });
}

/**
 * Optimized comparison for SavedRecipe arrays
 */
export function hasSavedRecipesChanged(recipes1: any[] | null, recipes2: any[] | null): boolean {
  if (!recipes1 || !recipes2) return recipes1 !== recipes2;
  if (recipes1.length !== recipes2.length) return true;

  return recipes1.some((recipe, idx) => {
    const recipe2 = recipes2[idx];
    if (!recipe || !recipe2) return recipe !== recipe2;

    return recipe.id !== recipe2.id ||
           recipe.title !== recipe2.title ||
           recipe.description !== recipe2.description ||
           JSON.stringify(recipe.ingredients || []) !== JSON.stringify(recipe2.ingredients || []) ||
           JSON.stringify(recipe.instructions || []) !== JSON.stringify(recipe2.instructions || []);
  });
}

/**
 * Optimized comparison for arrays of primitives (like consumptionHistory)
 */
export function hasArraysChanged(arr1: any[] | null, arr2: any[] | null): boolean {
  if (!arr1 || !arr2) return arr1 !== arr2;
  if (arr1.length !== arr2.length) return true;
  return arr1.some((item, idx) => item !== arr2[idx]);
}

/**
 * Optimized comparison for PantryItem arrays
 */
export function hasPantryItemsChanged(items1: any[] | null, items2: any[] | null): boolean {
  if (!items1 || !items2) return items1 !== items2;
  if (items1.length !== items2.length) return true;

  return items1.some((item, idx) => {
    const item2 = items2[idx];
    if (!item || !item2) return item !== item2;

    return item.id !== item2.id ||
           item.item !== item2.item ||
           item.category !== item2.category ||
           item.quantity_estimate !== item2.quantity_estimate ||
           item.image !== item2.image ||
           item.storageLocation !== item2.storageLocation ||
           item.expirationDate !== item2.expirationDate ||
           item.expirationType !== item2.expirationType ||
           item.dateAdded !== item2.dateAdded ||
           item.lastRestocked !== item2.lastRestocked ||
           item.visualLevel !== item2.visualLevel ||
           JSON.stringify(item.quantity || {}) !== JSON.stringify(item2.quantity || {}) ||
           JSON.stringify(item.consumptionHistory || []) !== JSON.stringify(item2.consumptionHistory || []) ||
           JSON.stringify(item.reservations || []) !== JSON.stringify(item2.reservations || []);
  });
}

/**
 * Optimized comparison for DayPlan arrays (meal plans)
 */
export function hasMealPlansChanged(plans1: any[] | null, plans2: any[] | null): boolean {
  if (!plans1 || !plans2) return plans1 !== plans2;
  if (plans1.length !== plans2.length) return true;

  return plans1.some((plan, idx) => {
    const plan2 = plans2[idx];
    if (!plan || !plan2) return plan !== plan2;

    return plan.date !== plan2.date ||
           plan.dayName !== plan2.dayName ||
           JSON.stringify(plan.breakfast || []) !== JSON.stringify(plan2.breakfast || []) ||
           JSON.stringify(plan.lunch || []) !== JSON.stringify(plan2.lunch || []) ||
           JSON.stringify(plan.dinner || []) !== JSON.stringify(plan2.dinner || []) ||
           JSON.stringify(plan.meals || []) !== JSON.stringify(plan2.meals || []);
  });
}