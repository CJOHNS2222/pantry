/**
 * Handles data migration when users join or leave a household.
 *
 * JOIN:  Merge the user's personal caches into the household caches,
 *        deduplicating by item name / recipe title / meal id so the household
 *        doesn't end up with doubled data.  Personal caches are then cleared.
 *
 * LEAVE: Copy the household caches into the user's personal caches so they
 *        keep their pantry/shopping/meal-plan/recipes after departing.
 *        The household caches are left intact for remaining members.
 */

import { InventoryCacheService } from './inventoryCacheService';
import { ShoppingListCacheService } from './shoppingListCacheService';
import { MealPlanCacheService } from './MealPlanCacheService';
import { RecipesCacheService } from './recipesCacheService';
import DatabaseMonitoringService from './databaseMonitoringService';
import { User, PantryItem, ShoppingItem, DayPlan, MealPlanItem, SavedRecipe } from '../types';
import { log } from './logService';

// ─── Deduplication helpers ───────────────────────────────────────────────────

const normalizeName = (name: string) => name.toLowerCase().trim();

/**
 * Merge inventory arrays.  Household items take precedence; user-unique items
 * (by normalized item name) are appended.
 */
function mergeInventory(householdItems: PantryItem[], userItems: PantryItem[]): PantryItem[] {
  const seen = new Set(householdItems.map(i => normalizeName(i.item)));
  const toAdd = userItems.filter(i => !seen.has(normalizeName(i.item)));
  return [...householdItems, ...toAdd];
}

/**
 * Merge shopping lists.  Household items take precedence; user-unique items
 * (by normalized item name) are appended.
 */
function mergeShoppingList(householdItems: ShoppingItem[], userItems: ShoppingItem[]): ShoppingItem[] {
  const seen = new Set(householdItems.map(i => normalizeName(i.item)));
  const toAdd = userItems.filter(i => !seen.has(normalizeName(i.item)));
  return [...householdItems, ...toAdd];
}

/**
 * Merge meal plans.  Per date, combine all three meal slots and deduplicate
 * meals by their unique id.
 */
function mergeMealPlans(householdDays: DayPlan[], userDays: DayPlan[]): DayPlan[] {
  const dayMap = new Map<string, DayPlan>();

  for (const day of householdDays) {
    dayMap.set(day.date, {
      ...day,
      breakfast: [...day.breakfast],
      lunch: [...day.lunch],
      dinner: [...day.dinner],
    });
  }

  for (const day of userDays) {
    if (!dayMap.has(day.date)) {
      dayMap.set(day.date, { ...day });
    } else {
      const existing = dayMap.get(day.date)!;
      (['breakfast', 'lunch', 'dinner'] as const).forEach(slot => {
        const existingIds = new Set(existing[slot].map((m: MealPlanItem) => m.id));
        const toAdd = (day[slot] || []).filter((m: MealPlanItem) => !existingIds.has(m.id));
        existing[slot] = [...existing[slot], ...toAdd];
      });
    }
  }

  return Array.from(dayMap.values());
}

/**
 * Merge saved recipes.  Deduplicate first by id, then by normalized title.
 */
function mergeRecipes(householdRecipes: SavedRecipe[], userRecipes: SavedRecipe[]): SavedRecipe[] {
  const seenIds = new Set(householdRecipes.map(r => r.id));
  const seenTitles = new Set(householdRecipes.map(r => normalizeName(r.title)));
  const toAdd = userRecipes.filter(
    r => !seenIds.has(r.id) && !seenTitles.has(normalizeName(r.title))
  );
  return [...householdRecipes, ...toAdd];
}

/** Delete all four personal cache documents for a user. */
async function clearUserCaches(userId: string): Promise<void> {
  const mealPlanRef = DatabaseMonitoringService.doc(`users/${userId}/cache/mealPlan`);
  await Promise.all([
    InventoryCacheService.clearCache(undefined, userId),
    ShoppingListCacheService.clearCache(undefined, userId),
    DatabaseMonitoringService.deleteDoc(mealPlanRef),
    RecipesCacheService.clearCache(undefined, userId),
  ]);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Called when a user accepts a household invite.
 *
 * 1. Reads both the user's personal caches and the household caches in parallel.
 * 2. Merges personal data into household data (deduplicating).
 * 3. Writes merged data back to the household cache.
 * 4. Clears the user's personal caches.
 *
 * Non-fatal: if anything fails the user is still joined; data can be retried.
 */
export const migrateUserCacheToHousehold = async (user: User, householdId: string): Promise<void> => {
  const userId = user.id;
  try {
    const [
      userInventory, householdInventory,
      userShopping,  householdShopping,
      userMealPlan,  householdMealPlan,
      userRecipes,   householdRecipes,
    ] = await Promise.all([
      InventoryCacheService.getCachedInventory(undefined, userId),
      InventoryCacheService.getCachedInventory(householdId),
      ShoppingListCacheService.getCachedShoppingList(undefined, userId),
      ShoppingListCacheService.getCachedShoppingList(householdId),
      MealPlanCacheService.getCachedMealPlan(undefined, userId),
      MealPlanCacheService.getCachedMealPlan(householdId),
      RecipesCacheService.getCachedRecipes(undefined, userId),
      RecipesCacheService.getCachedRecipes(householdId),
    ]);

    // Only write caches where the user actually contributed new data
    const writes: Promise<void>[] = [];

    if (userInventory.length > 0) {
      writes.push(
        InventoryCacheService.updateCache(mergeInventory(householdInventory, userInventory), householdId)
      );
    }
    if (userShopping.length > 0) {
      writes.push(
        ShoppingListCacheService.setCache(mergeShoppingList(householdShopping, userShopping), householdId)
      );
    }
    if (userMealPlan.length > 0) {
      writes.push(
        MealPlanCacheService.updateCache(mergeMealPlans(householdMealPlan, userMealPlan), householdId)
      );
    }
    if (userRecipes.length > 0) {
      writes.push(
        RecipesCacheService.updateCache(mergeRecipes(householdRecipes, userRecipes), householdId)
      );
    }

    await Promise.all(writes);

    // Clear personal caches — all future reads/writes go to the household path
    await clearUserCaches(userId);

    log.info('Migrated user cache to household', {
      userId,
      householdId,
      inventory: userInventory.length,
      shopping: userShopping.length,
      mealPlan: userMealPlan.length,
      recipes: userRecipes.length,
    }, 'HouseholdMigration');
  } catch (err) {
    log.error('Failed to migrate user cache to household', { err, userId, householdId }, 'HouseholdMigration');
  }
};

/**
 * Called when a user leaves or is removed from a household.
 *
 * Copies the household inventory, shopping list and meal plan into the user's
 * personal caches so they retain that data after leaving.
 *
 * Recipes are intentionally NOT copied here: every save/delete already writes to
 * the user's personal recipe cache, so it is always up to date and contains only
 * their own recipes — not other members' recipes.
 *
 * Non-fatal: the user still leaves even if the copy fails.
 */
export const copyHouseholdCacheToUser = async (user: User, householdId: string): Promise<void> => {
  const userId = user.id;
  try {
    const [inventory, shopping, mealPlan] = await Promise.all([
      InventoryCacheService.getCachedInventory(householdId),
      ShoppingListCacheService.getCachedShoppingList(householdId),
      MealPlanCacheService.getCachedMealPlan(householdId),
    ]);

    await Promise.all([
      InventoryCacheService.updateCache(inventory, undefined, userId),
      ShoppingListCacheService.setCache(shopping, undefined, userId),
      MealPlanCacheService.updateCache(mealPlan, undefined, userId),
    ]);

    log.info('Copied household cache to user', {
      userId,
      householdId,
      inventory: inventory.length,
      shopping: shopping.length,
      mealPlan: mealPlan.length,
    }, 'HouseholdMigration');
  } catch (err) {
    log.error('Failed to copy household cache to user', { err, userId, householdId }, 'HouseholdMigration');
  }
};
