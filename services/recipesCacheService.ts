import DatabaseMonitoringService from './databaseMonitoringService';
import { SavedRecipe } from '../types';

export interface CachedRecipesData {
  // Recipe ID -> [title, description, ingredients(JSON), instructions(JSON), cookTime, type, image, dateSaved, imagePlaceholder]
  [recipeId: string]: [string, string, string, string, string, string, string, string, string];
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
  private static readonly CACHE_VERSION = 2;

  /**
   * Convert a SavedRecipe to a cached array format
   */
  private static savedRecipeToArray(recipe: SavedRecipe): [string, string, string, string, string, string, string, string, string] {
    return [
      recipe.title,
      recipe.description,
      JSON.stringify(recipe.ingredients),
      JSON.stringify(recipe.instructions),
      recipe.cookTime,
      recipe.type || '',
      recipe.image || '',
      recipe.dateSaved,
      recipe.imagePlaceholder || ''
    ];
  }

  /**
   * Convert cached array back to SavedRecipe
   */
  static arrayToSavedRecipe(recipeId: string, recipeArray: [string, string, string, string, string, string, string, string, string]): SavedRecipe {
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
      imagePlaceholder: recipeArray[8] || undefined
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

          console.log(`✅ Loaded ${recipes.length} cached saved recipes (1 database read)`);
          return recipes.sort((a, b) => b.dateSaved.localeCompare(a.dateSaved)); // Most recent first
        }
      }

      console.log('📭 No valid recipes cache found, will load from individual documents');
      return [];
    } catch (err: any) {
      // Don't log permission errors as they may be expected
      if (!error.message.includes('Missing or insufficient permissions')) {
        console.warn('Failed to load recipes cache:', error);
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
        totalRecipes: recipes.length
      };

      // Convert each recipe to cached format
      recipes.forEach(recipe => {
        cachedData[recipe.id] = this.savedRecipeToArray(recipe);
      });

      await DatabaseMonitoringService.setDoc(cacheRef, cachedData);
      console.log(`💾 Updated saved recipes cache with ${recipes.length} recipes`);
    } catch (err: any) {
      console.error('Failed to update saved recipes cache:', error);
    }
  }

  /**
   * Add a single recipe to the cache
   */
  static async addRecipeToCache(recipe: SavedRecipe, householdId?: string, userId?: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);

      const updateData: Partial<CachedRecipesData & RecipesCacheMetadata> = {
        lastUpdated: new Date(),
        [recipe.id]: this.savedRecipeToArray(recipe)
      };

      // First try to update existing cache
      try {
        await DatabaseMonitoringService.updateDoc(cacheRef, updateData);
      } catch (err: any) {
        // If cache doesn't exist, create it
        const cachedData: CachedRecipesData & RecipesCacheMetadata = {
          lastUpdated: new Date(),
          version: this.CACHE_VERSION,
          totalRecipes: 1,
          [recipe.id]: this.savedRecipeToArray(recipe)
        };
        await DatabaseMonitoringService.setDoc(cacheRef, cachedData);
      }

      console.log(`➕ Added recipe to cache: ${recipe.title}`);
    } catch (err: any) {
      console.error('Failed to add recipe to cache:', error);
    }
  }

  /**
   * Update a single recipe in the cache
   */
  static async updateRecipeInCache(recipeId: string, updates: Partial<SavedRecipe>, householdId?: string, userId?: string): Promise<void> {
    try {
      // For updates, we need to get the current recipe first, then update it
      const currentRecipes = await this.getCachedRecipes(householdId, userId);
      const currentRecipe = currentRecipes.find(r => r.id === recipeId);

      if (currentRecipe) {
        const updatedRecipe = { ...currentRecipe, ...updates };
        await this.addRecipeToCache(updatedRecipe, householdId, userId);
        console.log(`🔄 Updated recipe in cache: ${updatedRecipe.title}`);
      }
    } catch (err: any) {
      console.error('Failed to update recipe in cache:', error);
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
        [recipeId]: DatabaseMonitoringService.deleteField()
      };

      await DatabaseMonitoringService.updateDoc(cacheRef, updateData);
      console.log(`🗑️ Removed recipe from cache: ${recipeId}`);
    } catch (err: any) {
      console.error('Failed to remove recipe from cache:', error);
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
      console.log('🧹 Cleared saved recipes cache');
    } catch (err: any) {
      console.error('Failed to clear saved recipes cache:', error);
    }
  }
}
