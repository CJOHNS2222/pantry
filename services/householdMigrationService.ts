/**
 * Primary, checkpointed JOIN-household migration path — invoked from the household-join UI flow
 * (`App.tsx`) and its interrupted-migration retry hook (`useHouseholdMigrationRetry.ts`). Writes a
 * `pending_migration_{userId}` localStorage checkpoint before starting and clears it only on full
 * success, so a crash/close mid-migration can be detected and retried on next app load. No dedup
 * logic - just moves personal cache contents into the household cache and clears the personal copy.
 *
 * Distinct from `householdDataMigrationService.ts`, which additionally supports the LEAVE direction
 * (copying household data back to a departing member) and does name-based dedup merging; that service
 * is invoked as a fire-and-forget best-effort pass from `householdService.ts`'s join flow, not this
 * checkpointed path.
 */
import { InventoryCacheService } from './inventoryCacheService';
import { ShoppingListCacheService } from './shoppingListCacheService';
import { MealPlanCacheService } from './MealPlanCacheService';
import { RecipesCacheService } from './recipesCacheService';
import { log } from './logService';

export function getMigrationCheckpointKey(userId: string): string {
  return `pending_migration_${userId}`;
}

// Module-level in-flight guard: prevents the join flow and a concurrent
// "Retry now" toast action (see useHouseholdMigrationRetry) from both running
// a migration for the same user at once, which could interleave meal-plan
// read-merge-write cycles and resurrect/drop days (bug-audit L6).
const inFlightMigrations = new Map<string, Promise<boolean>>();

/**
 * Merges a user's personal data (inventory, shopping list, meal plan, saved recipes)
 * into the household they just joined, then clears the personal copies.
 *
 * A localStorage checkpoint is written before migration begins and cleared only
 * after all four personal-data reads have verifiably succeeded (not merely
 * returned an empty array - a read failure is distinguished from "no data" via
 * the cache services' `*Strict` getters, which rethrow instead of swallowing
 * errors into `[]`). If the app is closed mid-migration, a read fails, or a
 * write step fails, the checkpoint persists so the caller can retry on next
 * load (see useHouseholdMigrationRetry).
 */
export async function migrateUserDataToHousehold(householdId: string, userId: string): Promise<boolean> {
  const existing = inFlightMigrations.get(userId);
  if (existing) {
    return existing;
  }

  const promise = migrateUserDataToHouseholdInternal(householdId, userId).finally(() => {
    inFlightMigrations.delete(userId);
  });
  inFlightMigrations.set(userId, promise);
  return promise;
}

async function migrateUserDataToHouseholdInternal(householdId: string, userId: string): Promise<boolean> {
  const CHECKPOINT_KEY = getMigrationCheckpointKey(userId);

  // Write checkpoint so we can retry if the app crashes mid-migration
  localStorage.setItem(CHECKPOINT_KEY, JSON.stringify({ householdId, timestamp: Date.now() }));

  let allSucceeded = true;
  let userInventory: Awaited<ReturnType<typeof InventoryCacheService.getCachedInventoryStrict>> = [];
  let userShoppingList: Awaited<ReturnType<typeof ShoppingListCacheService.getCachedShoppingListStrict>> = [];
  let userMealPlan: Awaited<ReturnType<typeof MealPlanCacheService.getCachedMealPlanStrict>> = [];
  let userRecipes: Awaited<ReturnType<typeof RecipesCacheService.getCachedRecipesStrict>> = [];

  try {
    // Use the *Strict getters here (not the plain getCached* ones used elsewhere
    // in the app) so a transient read failure surfaces as a rejected promise
    // instead of silently resolving to `[]`, which would be indistinguishable
    // from "user genuinely has no data" and would let the checkpoint below get
    // cleared while real personal data is stranded.
    const [invRes, shopRes, mealRes, recRes] = await Promise.allSettled([
      InventoryCacheService.getCachedInventoryStrict(undefined, userId),
      ShoppingListCacheService.getCachedShoppingListStrict(undefined, userId),
      MealPlanCacheService.getCachedMealPlanStrict(undefined, userId),
      RecipesCacheService.getCachedRecipesStrict(undefined, userId),
    ]);

    if (invRes.status === 'fulfilled') {
      userInventory = invRes.value;
    } else {
      allSucceeded = false;
      log.error('Migration: inventory read failed - skipping to avoid data loss', { userId, householdId, error: invRes.reason }, 'App');
    }

    if (shopRes.status === 'fulfilled') {
      userShoppingList = shopRes.value;
    } else {
      allSucceeded = false;
      log.error('Migration: shopping list read failed - skipping to avoid data loss', { userId, householdId, error: shopRes.reason }, 'App');
    }

    if (mealRes.status === 'fulfilled') {
      userMealPlan = mealRes.value;
    } else {
      allSucceeded = false;
      log.error('Migration: meal plan read failed - skipping to avoid data loss', { userId, householdId, error: mealRes.reason }, 'App');
    }

    if (recRes.status === 'fulfilled') {
      userRecipes = recRes.value;
    } else {
      allSucceeded = false;
      log.error('Migration: recipes read failed - skipping to avoid data loss', { userId, householdId, error: recRes.reason }, 'App');
    }

    // Run each step sequentially so a failure in one doesn't cancel the others
    // and the user cache is only cleared when that step is confirmed written.
    // Note: if a domain's initial read (above) failed, its list here is `[]`,
    // so its migration/clear block below is skipped entirely rather than
    // mistakenly treating the failed read as "nothing to migrate" - and
    // `allSucceeded` is already false so the checkpoint is preserved either way.

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
