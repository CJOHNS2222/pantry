import { InventoryCacheService } from './inventoryCacheService';
import { ShoppingListCacheService } from './shoppingListCacheService';
import { MealPlanCacheService } from './MealPlanCacheService';
import { RecipesCacheService } from './recipesCacheService';
import { log } from './logService';

export function getMigrationCheckpointKey(userId: string): string {
  return `pending_migration_${userId}`;
}

/**
 * Merges a user's personal data (inventory, shopping list, meal plan, saved recipes)
 * into the household they just joined, then clears the personal copies.
 *
 * A localStorage checkpoint is written before migration begins and cleared only on
 * full success. If the app is closed mid-migration or a step fails, the checkpoint
 * persists so the caller can retry on next load (see useHouseholdMigrationRetry).
 */
export async function migrateUserDataToHousehold(householdId: string, userId: string): Promise<boolean> {
  const CHECKPOINT_KEY = getMigrationCheckpointKey(userId);

  // Write checkpoint so we can retry if the app crashes mid-migration
  localStorage.setItem(CHECKPOINT_KEY, JSON.stringify({ householdId, timestamp: Date.now() }));

  let allSucceeded = true;

  try {
    const [userInventory, userShoppingList, userMealPlan, userRecipes] = await Promise.all([
      InventoryCacheService.getCachedInventory(undefined, userId),
      ShoppingListCacheService.getCachedShoppingList(undefined, userId),
      MealPlanCacheService.getCachedMealPlan(undefined, userId),
      RecipesCacheService.getCachedRecipes(undefined, userId),
    ]);

    // Run each step sequentially so a failure in one doesn't cancel the others
    // and the user cache is only cleared when that step is confirmed written

    if (userInventory.length > 0) {
      try {
        await InventoryCacheService.addItemsToCache(userInventory, householdId, undefined);
        await InventoryCacheService.updateCache([], undefined, userId);
      } catch (e) {
        allSucceeded = false;
        log.error('Migration: inventory step failed', { userId, householdId, error: e }, 'App');
      }
    }

    if (userShoppingList.length > 0) {
      try {
        await ShoppingListCacheService.addItemsToCache(userShoppingList, householdId, undefined);
        await ShoppingListCacheService.setCache([], undefined, userId);
      } catch (e) {
        allSucceeded = false;
        log.error('Migration: shopping list step failed', { userId, householdId, error: e }, 'App');
      }
    }

    if (userMealPlan.length > 0) {
      try {
        const householdMealPlan = await MealPlanCacheService.getCachedMealPlan(householdId, undefined);
        const householdDates = new Set(householdMealPlan.map(d => d.date));
        const newDays = userMealPlan.filter(d => !householdDates.has(d.date));
        await MealPlanCacheService.updateCache([...householdMealPlan, ...newDays], householdId, undefined);
        await MealPlanCacheService.updateCache([], undefined, userId);
      } catch (e) {
        allSucceeded = false;
        log.error('Migration: meal plan step failed', { userId, householdId, error: e }, 'App');
      }
    }

    if (userRecipes.length > 0) {
      try {
        const householdRecipes = await RecipesCacheService.getCachedRecipes(householdId, undefined);
        const existingIds = new Set(householdRecipes.map(r => r.id));
        const newRecipes = userRecipes.filter(r => !existingIds.has(r.id));
        const merged = newRecipes.length > 0 ? [...householdRecipes, ...newRecipes] : householdRecipes;
        if (newRecipes.length > 0) await RecipesCacheService.updateCache(merged, householdId, undefined);
        await RecipesCacheService.updateCache([], undefined, userId);
      } catch (e) {
        allSucceeded = false;
        log.error('Migration: recipes step failed', { userId, householdId, error: e }, 'App');
      }
    }

    if (allSucceeded) {
      localStorage.removeItem(CHECKPOINT_KEY);
      log.info('Personal data migrated to household on join', { householdId, userId }, 'App');
    } else {
      log.warn('Migration completed with some failures — checkpoint kept for retry', { householdId, userId }, 'App');
    }
  } catch (error) {
    allSucceeded = false;
    log.error('Failed to migrate personal data to household', { userId, householdId, error }, 'App');
  }

  return allSucceeded;
}
