import DatabaseMonitoringService from './databaseMonitoringService';
import { SavedRecipe } from '../types';
import { log } from './logService';

// The 10th element (structuredIngredients JSON) is optional so arrays cached
// before PERF-028 (length 9) keep reading correctly — recipeArray[9] is
// `undefined` for them at runtime, matching the type.
type CachedRecipeArray = [string, string, string, string, string, string, string, string, string, string?];

export interface CachedRecipesData {
  // Recipe ID -> [title, description, ingredients(JSON), instructions(JSON), cookTime, type, image, dateSaved, imagePlaceholder, structuredIngredients(JSON)?]
  [recipeId: string]: CachedRecipeArray;
}

// Metadata stored separately in the cache document
export interface RecipesCacheMetadata {
  lastUpdated: Date;
  version: number;
  totalRecipes: number;
}

/**
 * Service for caching saved recipes data in single documents for efficient bulk reads
 * Each recipe is stored as: recipeId -> [title, description, ingredients[], instructions[], cookTime, type, image, dateSaved, imagePlaceholder]
 */
export class RecipesCacheService {
  public static readonly CACHE_VERSION = 2;

  /**
   * Convert a SavedRecipe to a cached array format
   */
  private static savedRecipeToArray(recipe: SavedRecipe): CachedRecipeArray {
    return [
      recipe.title,
      recipe.description,
      JSON.stringify(recipe.ingredients),
      JSON.stringify(recipe.instructions),
      String(recipe.cookTime || ''),
      recipe.type || '',
      recipe.image || '',
      recipe.dateSaved,
      recipe.imagePlaceholder || '',
      recipe.structuredIngredients?.length ? JSON.stringify(recipe.structuredIngredients) : undefined
    ];
  }

  /**
   * Convert cached array back to SavedRecipe
   */
  static arrayToSavedRecipe(recipeId: string, recipeArray: CachedRecipeArray): SavedRecipe {
    return {
      id: recipeId,
      title: recipeArray[0],
      description: recipeArray[1],
      ingredients: JSON.parse(recipeArray[2]),
      instructions: JSON.parse(recipeArray[3]),
      cookTime: recipeArray[4],
      type: recipeArray[5] || undefined,
      image: recipeArray[6] || undefined,
      dateSaved: recipeArray[7],
      imagePlaceholder: recipeArray[8] || undefined,
      // Absent on recipes cached before PERF-028 — consumers fall back to
      // parsing `ingredients` on demand when this is undefined.
      structuredIngredients: recipeArray[9] ? JSON.parse(recipeArray[9]) : undefined
    };
  }

  /**
   * Get the cache document path for a household or user
   */
  private static getCachePath(householdId?: string, userId?: string): string {
    if (householdId) {
      return `households/${householdId}/cache/savedRecipes`;
    } else if (userId) {
      return `users/${userId}/cache/savedRecipes`;
    }
    throw new Error('Either householdId or userId must be provided');
  }

  /**
   * Get cached saved recipes data (1 read instead of N reads)
   */
  static async getCachedRecipes(householdId?: string, userId?: string): Promise<SavedRecipe[]> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);
      const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as CachedRecipesData & RecipesCacheMetadata;

        if (data.version === this.CACHE_VERSION) {
          const recipes: SavedRecipe[] = [];
          for (const [recipeId, recipeArray] of Object.entries(data)) {
            if (recipeId !== 'lastUpdated' && recipeId !== 'version' && recipeId !== 'totalRecipes') {
              recipes.push(this.arrayToSavedRecipe(recipeId, recipeArray));
            }
          }

          log.debug('Loaded cached saved recipes', { count: recipes.length }, 'RecipesCacheService');
          return recipes.sort((a, b) => b.dateSaved.localeCompare(a.dateSaved)); // Most recent first
        }
      }

      log.debug('No valid recipes cache found, will load from individual documents', undefined, 'RecipesCacheService');
      return [];
    } catch (err: any) {
      // Don't log permission errors as they may be expected
      if (!err.message.includes('Missing or insufficient permissions')) {
        log.warn('Failed to load recipes cache', { error: err }, 'RecipesCacheService');
      }
      return [];
    }
  }

  /**
   * Update the entire saved recipes cache
   */
  static async updateCache(recipes: SavedRecipe[], householdId?: string, userId?: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);

      const cachedData: CachedRecipesData & RecipesCacheMetadata = {
        lastUpdated: new Date(),
        version: this.CACHE_VERSION,
        totalRecipes: recipes.length,
      } as any;

      // Convert each recipe to cached format
      recipes.forEach(recipe => {
        (cachedData as any)[recipe.id] = this.savedRecipeToArray(recipe);
      });

      await DatabaseMonitoringService.setDoc(cacheRef, cachedData);
      log.debug('Updated saved recipes cache', { count: recipes.length }, 'RecipesCacheService');
    } catch (err: any) {
      log.error('Failed to update saved recipes cache', { error: err }, 'RecipesCacheService');
    }
  }

  /**
   * Add a single recipe to the cache
   */
  static async addRecipeToCache(recipe: SavedRecipe, householdId?: string, userId?: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);

      const updateData: any = {
        lastUpdated: new Date(),
      };
      (updateData as any)[recipe.id] = this.savedRecipeToArray(recipe);

      // First try to update existing cache
      try {
        await DatabaseMonitoringService.updateDoc(cacheRef, updateData);
      } catch {
        // If cache doesn't exist, create it
        const cachedData: CachedRecipesData & RecipesCacheMetadata = {
          lastUpdated: new Date(),
          version: this.CACHE_VERSION,
          totalRecipes: 1,
        } as any;
        (cachedData as any)[recipe.id] = this.savedRecipeToArray(recipe);
        await DatabaseMonitoringService.setDoc(cacheRef, cachedData);
      }

      log.debug('Added recipe to cache', { title: recipe.title }, 'RecipesCacheService');
    } catch (err: any) {
      log.error('Failed to add recipe to cache', { error: err, title: recipe.title }, 'RecipesCacheService');
    }
  }

  /**
   * Update a single recipe in the cache
   */
  static async updateRecipeInCache(recipeId: string, updates: Partial<SavedRecipe>, householdId?: string, userId?: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);
      const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as CachedRecipesData & RecipesCacheMetadata;
        const recipeArray = data[recipeId];
        if (recipeArray) {
          const currentRecipe = this.arrayToSavedRecipe(recipeId, recipeArray);
          const updatedRecipe = { ...currentRecipe, ...updates };

          const updateData: any = {
            lastUpdated: new Date(),
          };
          updateData[recipeId] = this.savedRecipeToArray(updatedRecipe);

          await DatabaseMonitoringService.updateDoc(cacheRef, updateData);
          log.debug('Updated recipe in cache', { title: updatedRecipe.title }, 'RecipesCacheService');
        }
      }
    } catch (err: any) {
      log.error('Failed to update recipe in cache', { error: err, recipeId }, 'RecipesCacheService');
    }
  }

  /**
   * Remove a recipe from the cache
   */
  static async removeRecipeFromCache(recipeId: string, householdId?: string, userId?: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);

      const updateData = {
        lastUpdated: new Date(),
      };
      (updateData as any)[recipeId] = DatabaseMonitoringService.deleteField();

      await DatabaseMonitoringService.updateDoc(cacheRef, updateData);
      log.debug('Removed recipe from cache', { recipeId }, 'RecipesCacheService');
    } catch (err: any) {
      log.error('Failed to remove recipe from cache', { error: err, recipeId }, 'RecipesCacheService');
    }
  }

  /**
   * Clear the entire saved recipes cache
   */
  static async clearCache(householdId?: string, userId?: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);
      await DatabaseMonitoringService.deleteDoc(cacheRef);
      log.debug('Cleared saved recipes cache', undefined, 'RecipesCacheService');
    } catch (err: any) {
      log.error('Failed to clear saved recipes cache', { error: err }, 'RecipesCacheService');
    }
  }
}
