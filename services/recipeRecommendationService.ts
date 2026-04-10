import { SavedRecipe, StructuredRecipe } from '../types';
import { getCachedRecipesCache } from './recipeService';
import { log } from './logService';

export interface RecipeRecommendation {
  recipe: StructuredRecipe;
  reason: string;
  confidence: number; // 0-1
  type: 'household-loved' | 'similar-ingredients' | 'trending' | 'seasonal' | 'personal-preference';
  basedOn?: string[]; // What influenced this recommendation
}

// Module-level cache — load once, reuse for 30 minutes (0 additional Firestore reads)
let _recipeCache: SavedRecipe[] | null = null;
let _recipeCacheTimestamp = 0;
const CACHE_TTL_MS = 30 * 60 * 1000;

async function loadRecipeCache(): Promise<SavedRecipe[]> {
  if (_recipeCache && Date.now() - _recipeCacheTimestamp < CACHE_TTL_MS) {
    return _recipeCache;
  }
  const recipes = await getCachedRecipesCache('recipe_caches/recipes_cache_1');
  _recipeCache = recipes;
  _recipeCacheTimestamp = Date.now();
  return recipes;
}

// Season keyword sets used for matching titles/descriptions in the recipe cache
const SEASONAL_KEYWORDS: Record<number, string[]> = {
  0:  ['soup', 'stew', 'roast', 'chili', 'bake', 'hearty', 'casserole', 'braise', 'hot'],
  1:  ['soup', 'stew', 'roast', 'chili', 'bake', 'hearty', 'casserole', 'braise', 'hot'],
  11: ['soup', 'stew', 'roast', 'chili', 'bake', 'hearty', 'casserole', 'braise', 'hot'],
  2:  ['salad', 'fresh', 'spring', 'asparagus', 'pea', 'lemon', 'light', 'green'],
  3:  ['salad', 'fresh', 'spring', 'asparagus', 'pea', 'lemon', 'light', 'green'],
  4:  ['salad', 'fresh', 'spring', 'asparagus', 'pea', 'lemon', 'light', 'green'],
  5:  ['grill', 'bbq', 'cold', 'salad', 'pasta', 'summer', 'smoothie', 'ice', 'fresh'],
  6:  ['grill', 'bbq', 'cold', 'salad', 'pasta', 'summer', 'smoothie', 'ice', 'fresh'],
  7:  ['grill', 'bbq', 'cold', 'salad', 'pasta', 'summer', 'smoothie', 'ice', 'fresh'],
  8:  ['pumpkin', 'apple', 'squash', 'harvest', 'soup', 'stew', 'chili', 'cider'],
  9:  ['pumpkin', 'apple', 'squash', 'harvest', 'soup', 'stew', 'chili', 'cider'],
  10: ['pumpkin', 'apple', 'squash', 'harvest', 'soup', 'stew', 'chili', 'cider'],
};

export class RecipeRecommendationService {

  /**
   * Get personalized recipe recommendations.
   * All matching is done against the pre-built recipe cache (recipe_caches/recipes_cache_1)
   * so no per-call Firestore reads are needed after the first load.
   */
  static async getPersonalizedRecommendations(
    userId: string,
    householdId?: string,
    pantryItems: string[] = [],
    dietaryRestrictions: string[] = [],
    limitCount: number = 5
  ): Promise<RecipeRecommendation[]> {
    try {
      const allRecipes = await loadRecipeCache();
      if (allRecipes.length === 0) return [];

      const recommendations: RecipeRecommendation[] = [];

      // 1. Pantry-based: recipes whose ingredients overlap with what the user has
      const pantryBased = this.getPantryBasedFromCache(allRecipes, pantryItems, dietaryRestrictions);
      recommendations.push(...pantryBased);

      // 2. Seasonal: pick real recipes from the cache that match season keywords
      const usedAfterPantry = new Set(recommendations.map(r => r.recipe.title));
      const seasonal = this.getSeasonalFromCache(allRecipes, usedAfterPantry);
      recommendations.push(...seasonal);

      // 3. Fill remaining slots with a diverse selection from the cache
      const usedAfterSeasonal = new Set(recommendations.map(r => r.recipe.title));
      const filler = this.getTrendingFromCache(allRecipes, usedAfterSeasonal);
      recommendations.push(...filler);

      return recommendations
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, limitCount);

    } catch (err: unknown) {
      log.error('Failed to get personalized recommendations', { error: err, userId });
      return [];
    }
  }

  /**
   * Score recipes by how many pantry items appear in their ingredient list.
   */
  private static getPantryBasedFromCache(
    allRecipes: SavedRecipe[],
    pantryItems: string[],
    dietaryRestrictions: string[]
  ): RecipeRecommendation[] {
    if (pantryItems.length === 0) return [];

    const pantryTokens = pantryItems.map(item => item.toLowerCase().trim());
    const restrictionTokens = dietaryRestrictions.map(r => r.toLowerCase().trim());

    const scored = allRecipes
      .filter(recipe => {
        if (restrictionTokens.length === 0) return true;
        const searchText = `${recipe.title} ${recipe.ingredients.join(' ')}`.toLowerCase();
        return !restrictionTokens.some(r => searchText.includes(r));
      })
      .map(recipe => {
        const ingText = recipe.ingredients.join(' ').toLowerCase();
        const matchCount = pantryTokens.filter(token => ingText.includes(token)).length;
        return { recipe, matchCount };
      })
      .filter(({ matchCount }) => matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount)
      .slice(0, 5);

    return scored.map(({ recipe, matchCount }) => ({
      recipe,
      reason: `Uses ${matchCount} item${matchCount === 1 ? '' : 's'} from your pantry`,
      confidence: Math.min(0.95, 0.4 + matchCount / Math.max(pantryTokens.length, 1)),
      type: 'similar-ingredients',
      basedOn: ['pantry-items'],
    }));
  }

  /**
   * Pick recipes from the cache whose title/description/tags match current-season keywords.
   */
  private static getSeasonalFromCache(
    allRecipes: SavedRecipe[],
    usedTitles: Set<string>
  ): RecipeRecommendation[] {
    const month = new Date().getMonth();
    const keywords = SEASONAL_KEYWORDS[month as keyof typeof SEASONAL_KEYWORDS] ?? [];
    if (keywords.length === 0) return [];

    const seasonal = allRecipes
      .filter(recipe => {
        if (usedTitles.has(recipe.title)) return false;
        const text = `${recipe.title} ${recipe.description} ${(recipe.tags ?? []).join(' ')}`.toLowerCase();
        return keywords.some(kw => text.includes(kw));
      })
      .slice(0, 3);

    return seasonal.map(recipe => ({
      recipe,
      reason: 'Perfect for this season',
      confidence: 0.6,
      type: 'seasonal',
      basedOn: ['seasonal-trends'],
    }));
  }

  /**
   * Return a diverse selection from the cache as filler / "popular" picks.
   * Uses a deterministic pseudo-shuffle (title char-code hash) so results are
   * consistent per session without any extra reads.
   */
  private static getTrendingFromCache(
    allRecipes: SavedRecipe[],
    usedTitles: Set<string>
  ): RecipeRecommendation[] {
    const unused = allRecipes
      .filter(r => !usedTitles.has(r.title))
      .sort((a, b) => {
        const hashA = a.title.split('').reduce((n, c) => n + c.charCodeAt(0), 0);
        const hashB = b.title.split('').reduce((n, c) => n + c.charCodeAt(0), 0);
        return (hashA % 97) - (hashB % 97);
      })
      .slice(0, 3);

    return unused.map(recipe => ({
      recipe,
      reason: 'Popular in the community',
      confidence: 0.55,
      type: 'trending',
      basedOn: ['community-trends'],
    }));
  }

  /**
   * Find recipes from the cache similar to a given recipe by ingredient overlap.
   */
  static async getSimilarRecipes(
    userId: string,
    baseRecipe: StructuredRecipe,
    limitCount: number = 3
  ): Promise<RecipeRecommendation[]> {
    try {
      const allRecipes = await loadRecipeCache();
      if (allRecipes.length === 0) return [];

      const baseIngredients = new Set(
        (Array.isArray(baseRecipe.ingredients) ? baseRecipe.ingredients as string[] : [])
          .map((i: string) => i.toLowerCase().trim())
      );

      const scored = allRecipes
        .filter(r => r.title !== baseRecipe.title)
        .map(recipe => {
          const ingText = recipe.ingredients.join(' ').toLowerCase();
          const matchCount = [...baseIngredients].filter(ing => ingText.includes(ing)).length;
          return { recipe, matchCount };
        })
        .filter(({ matchCount }) => matchCount > 0)
        .sort((a, b) => b.matchCount - a.matchCount)
        .slice(0, limitCount);

      return scored.map(({ recipe, matchCount }) => ({
        recipe,
        reason: `Shares ${matchCount} ingredient${matchCount === 1 ? '' : 's'} with ${baseRecipe.title}`,
        confidence: Math.min(0.9, 0.3 + matchCount / Math.max(baseIngredients.size, 1)),
        type: 'similar-ingredients',
        basedOn: ['ingredient-similarity'],
      }));
    } catch (err: unknown) {
      const baseRecipeId = (baseRecipe as { id?: string }).id ?? baseRecipe.title ?? 'unknown';
      log.error('Failed to get similar recipes', { error: err, userId, baseRecipeId });
      return [];
    }
  }
}
