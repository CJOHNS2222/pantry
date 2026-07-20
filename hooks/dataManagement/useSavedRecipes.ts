import { useState, useEffect, useRef } from 'react';
import { UsageService } from '../../services/usageService';
import { User, Household, SavedRecipe, StructuredRecipe } from '../../types';
import { log } from '../../services/logService';
import { isHouseholdMember, parseStructuredIngredient } from '../../utils/appUtils';
import { ERROR_MESSAGES } from '../../constants/errorMessages';
import DatabaseMonitoringService from '../../services/databaseMonitoringService';
import { hasArraysChanged } from '../../utils/comparisonUtils';
import { setRemoteSavedRecipesUpdate } from '../../services/syncStateService';
import { RecipesCacheService, CachedRecipesData, RecipesCacheMetadata } from '../../services/recipesCacheService';
import HapticService from '../../services/hapticService';
import { resolveHouseholdId } from './shared';

type AddToast = (message: string, type: 'success' | 'error' | 'info' | 'warning', duration?: number, actionLabel?: string, action?: () => void) => void;

function createSavedRecipesListener(
  user: User,
  household: Household | null,
  inHousehold: boolean,
  setSavedRecipes: (recipes: SavedRecipe[]) => void,
  setIsLoadingSavedRecipes: (loading: boolean) => void,
  prevSavedRecipesRef: React.MutableRefObject<SavedRecipe[]>
) {
  // Use user.householdId as fallback — household state may not be loaded yet when this runs
  const householdId = inHousehold ? (household?.id || user.householdId) : undefined;
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
          prevSavedRecipesRef.current = structuredClone(sortedRecipes);
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

/**
 * Saved-recipes domain: personal + household saved recipe list, save-limit
 * enforcement, and Firestore/guest sync.
 */
export function useSavedRecipes(
  user?: User | null,
  household?: Household | null,
  addToast?: AddToast,
) {
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [isLoadingSavedRecipes, setIsLoadingSavedRecipes] = useState(true);
  // Count of recipes the current user has personally saved. Used for usage limits/sync so
  // other household members' recipes don't inflate the user's own quota.
  const [personalRecipeCount, setPersonalRecipeCount] = useState(0);
  const [recipeSaveLimitExceeded, setRecipeSaveLimitExceeded] = useState(false);
  const prevSavedRecipesRef = useRef<SavedRecipe[]>([]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    // Guest users: no Firestore-backed saved recipes
    if (user.isGuest) {
      setIsLoadingSavedRecipes(false);
      return;
    }

    const inHousehold = !!user?.householdId;
    const unsub = createSavedRecipesListener(user, household ?? null, inHousehold, setSavedRecipes, setIsLoadingSavedRecipes, prevSavedRecipesRef);

    // Derive personal recipe count directly without registering a 5th WebSocket listener
    const count = savedRecipes.filter(r => r.userId === user?.id || !r.userId).length;
    setPersonalRecipeCount(count);

    return () => {
      unsub();
    };
  }, [user?.id, user?.householdId]);

  // Keep recipes.used Firestore counter in sync with the actual saved-recipe count.
  // When in a household the displayed list contains all members' recipes, so we sync
  // against the personal count only — other members' recipes must not inflate the quota.
  useEffect(() => {
    if (!user || isLoadingSavedRecipes) return;
    const inHousehold = !!(user.householdId);
    const countToSync = inHousehold ? personalRecipeCount : savedRecipes.length;
    UsageService.syncRecipeCount(user, countToSync).catch(err => {
      log.warn('Failed to sync recipe count', { error: err }, 'DataManagement');
    });
  }, [savedRecipes.length, personalRecipeCount, user?.id, user?.householdId, isLoadingSavedRecipes]);

  const checkRecipeSaveLimit = async () => {
    if (!user) return false;
    try {
      // Use personal count when in a household so members don't share quota.
      const inHousehold = !!(user.householdId);
      const countForLimit = inHousehold ? personalRecipeCount : savedRecipes.length;
      const canSave = await UsageService.canSaveRecipe(user, countForLimit);
      setRecipeSaveLimitExceeded(!canSave);
      return canSave;
    } catch (err) {
      log.error('Error checking recipe save limit:', err, 'DataManagement');
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
      const inHousehold = !!(isHouseholdMember(household ?? null, user) && household?.id);
      const householdId = resolveHouseholdId(user, household ?? null, inHousehold);

      const savedRecipe: SavedRecipe = {
        id: `recipe-${Date.now()}`,
        ...recipe,
        // Persist parsed {name, quantity, unit, preparation} at save time so
        // consumers (shopping-list consolidation, meal-plan missing-ingredient
        // scans, cost estimation) don't re-parse the raw string on every read (PERF-028).
        structuredIngredients: recipe.structuredIngredients?.length
          ? recipe.structuredIngredients
          : recipe.ingredients.map(parseStructuredIngredient),
        dateSaved: new Date().toISOString()
      };

      // Always write to the user's personal cache so their own recipe list is
      // maintained independently of any household they join or leave.
      await RecipesCacheService.addRecipeToCache(savedRecipe, undefined, user.id);

      // When in a household also write to the household cache so all members
      // see the combined list in a single Firestore read.
      if (inHousehold && householdId) {
        await RecipesCacheService.addRecipeToCache(savedRecipe, householdId, undefined);
      }

      // Sync personal count only
      await UsageService.syncRecipeCount(user, personalRecipeCount + 1);

      HapticService.success();
      addToast?.(`Saved ${recipe.title} to your recipes!`, 'success');
    } catch (err) {
      log.error('Error saving recipe:', err, 'DataManagement');
      addToast?.(ERROR_MESSAGES.SAVE_FAILED, 'error');
    }
  };

  const handleDeleteRecipe = async (recipe: SavedRecipe) => {
    if (!user?.id) return;
    try {
      const inHousehold = !!(isHouseholdMember(household ?? null, user) && household?.id);
      const householdId = resolveHouseholdId(user, household ?? null, inHousehold);

      // Remove from user's personal cache (may be a no-op if it was saved by another member).
      await RecipesCacheService.removeRecipeFromCache(recipe.id, undefined, user.id);

      // Remove from household shared cache so all members see it gone.
      if (inHousehold && householdId) {
        await RecipesCacheService.removeRecipeFromCache(recipe.id, householdId, undefined);
      }

      // Sync personal count only
      await UsageService.syncRecipeCount(user, Math.max(0, personalRecipeCount - 1));

      HapticService.light();
      addToast?.(`Removed ${recipe.title} from your saved recipes.`, 'success');
    } catch (err) {
      log.error('Error deleting recipe:', err, 'DataManagement');
      addToast?.(ERROR_MESSAGES.DELETE_FAILED, 'error');
    }
  };

  return {
    savedRecipes,
    setSavedRecipes,
    isLoadingSavedRecipes,
    setIsLoadingSavedRecipes,
    recipeSaveLimitExceeded,
    checkRecipeSaveLimit,
    handleSaveRecipe,
    handleDeleteRecipe,
  };
}
