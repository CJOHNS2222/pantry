import DatabaseMonitoringService from './databaseMonitoringService';
import { RecipeRating, StructuredRecipe } from '../types';
import { log } from './logService';

export interface RecipeRecommendation {
  recipe: StructuredRecipe;
  reason: string;
  confidence: number; // 0-1
  type: 'household-loved' | 'similar-ingredients' | 'trending' | 'seasonal' | 'personal-preference';
  basedOn?: string[]; // What influenced this recommendation
}

export class RecipeRecommendationService {
  private static readonly RATINGS_COLLECTION = 'recipeRatings';
  private static readonly RECIPES_COLLECTION = 'recipes';

  /**
   * Get personalized recipe recommendations
   */
  static async getPersonalizedRecommendations(
    userId: string,
    householdId?: string,
    pantryItems: string[] = [],
    dietaryRestrictions: string[] = [],
    limitCount: number = 5
  ): Promise<RecipeRecommendation[]> {
    try {
      const recommendations: RecipeRecommendation[] = [];

      // Get user's rating history
      const userRatings = await this.getUserRatings(userId, 20);

      // Get household preferences
      const householdRatings = householdId ? await this.getHouseholdRatings(householdId, 50) : [];

      // 1. Household-loved recipes that user hasn't rated
      const householdLoved = await this.getHouseholdLovedRecipes(userRatings, householdRatings);
      recommendations.push(...householdLoved);

      // 2. Recipes with similar ingredients to pantry
      const pantryBased = await this.getPantryBasedRecommendations(pantryItems, userRatings, dietaryRestrictions);
      recommendations.push(...pantryBased);

      // 3. Trending recipes in community
      const trending = await this.getTrendingRecommendations(userRatings);
      recommendations.push(...trending);

      // 4. Seasonal recommendations (simplified)
      const seasonal = await this.getSeasonalRecommendations();
      recommendations.push(...seasonal);

      // Sort by confidence and limit results
      return recommendations
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, limitCount);

    } catch (err: any) {
      log.error('Failed to get personalized recommendations', { error: err, userId });
      return [];
    }
  }

  /**
   * Get recipes loved by household but not rated by user
   */
  private static async getHouseholdLovedRecipes(
    userRatings: RecipeRating[],
    householdRatings: RecipeRating[]
  ): Promise<RecipeRecommendation[]> {
    if (householdRatings.length === 0) return [];

    const userRatedTitles = new Set(userRatings.map(r => r.recipeTitle));

    // Find recipes loved by household
    const householdLoved = householdRatings
      .filter(r => r.wouldMakeAgain && !userRatedTitles.has(r.recipeTitle))
      .reduce((acc, rating) => {
        acc[rating.recipeTitle] = (acc[rating.recipeTitle] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const recommendations: RecipeRecommendation[] = [];

    for (const [recipeTitle, count] of Object.entries(householdLoved)) {
      if (count >= 2) { // At least 2 household members loved it
        // TODO: Get actual recipe data from recipes collection
        const mockRecipe: StructuredRecipe = {
          title: recipeTitle,
          description: recipeTitle,
          ingredients: [],
          instructions: [],
          cookTime: '0 mins'
        };

        recommendations.push({
          recipe: mockRecipe,
          reason: `${count} household members loved this recipe`,
          confidence: Math.min(0.9, count / 5),
          type: 'household-loved',
          basedOn: ['household-preferences']
        });
      }
    }

    return recommendations;
  }

  /**
   * Get recommendations based on pantry ingredients
   */
  private static async getPantryBasedRecommendations(
    pantryItems: string[],
    userRatings: RecipeRating[],
    dietaryRestrictions: string[]
  ): Promise<RecipeRecommendation[]> {
    if (pantryItems.length === 0) return [];

    const recommendations: RecipeRecommendation[] = [];

    // Get recipes that use pantry ingredients
    // TODO: Implement actual recipe search based on ingredients
    // For now, return mock recommendations

    const pantryKeywords = pantryItems.map(item => item.toLowerCase());

    // Mock logic: recommend recipes that might use common pantry items
    const mockRecommendations = [
      {
        title: 'Quick Pasta with Pantry Staples',
        ingredients: ['pasta', 'tomato sauce', 'olive oil'],
        reason: 'Uses your pasta and tomato sauce',
        confidence: 0.8
      },
      {
        title: 'Simple Stir Fry',
        ingredients: ['rice', 'vegetables', 'soy sauce'],
        reason: 'Perfect for your vegetables and rice',
        confidence: 0.7
      }
    ];

    for (const rec of mockRecommendations) {
      const hasIngredients = rec.ingredients.some(ing =>
        pantryKeywords.some(keyword => ing.includes(keyword))
      );

      if (hasIngredients) {
        const mockRecipe: StructuredRecipe = {
          title: rec.title,
          description: rec.title,
          ingredients: rec.ingredients,
          instructions: [],
          cookTime: '20 mins'
        };

        recommendations.push({
          recipe: mockRecipe,
          reason: rec.reason,
          confidence: rec.confidence,
          type: 'similar-ingredients',
          basedOn: ['pantry-items']
        });
      }
    }

    return recommendations;
  }

  /**
   * Get trending recipes in the community
   */
  private static async getTrendingRecommendations(userRatings: RecipeRating[]): Promise<RecipeRecommendation[]> {
    try {
      // Get recent highly-rated recipes
      const recentRatingsQuery = DatabaseMonitoringService.query(
        DatabaseMonitoringService.collection(this.RATINGS_COLLECTION),
        DatabaseMonitoringService.where('wouldMakeAgain', '==', true),
        DatabaseMonitoringService.orderBy('date', 'desc'),
        DatabaseMonitoringService.limit(50)
      );

      const recentRatings = await DatabaseMonitoringService.getDocs(recentRatingsQuery);
      const ratingData = recentRatings.docs.map(doc => doc.data());

      // Count ratings per recipe in the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const trendingRecipes = ratingData
        .filter(r => r.date.toDate() > thirtyDaysAgo)
        .reduce((acc, rating) => {
          acc[rating.recipeTitle] = (acc[rating.recipeTitle] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

      const userRatedTitles = new Set(userRatings.map(r => r.recipeTitle));

      const recommendations: RecipeRecommendation[] = [];

      for (const [recipeTitle, count] of Object.entries(trendingRecipes)) {
        if (count >= 3 && !userRatedTitles.has(recipeTitle)) {
          const mockRecipe: StructuredRecipe = {
            title: recipeTitle,
            description: recipeTitle,
            ingredients: [],
            instructions: [],
            cookTime: '0 mins'
          };

          recommendations.push({
            recipe: mockRecipe,
            reason: `Trending in the community (${count} recent ratings)`,
            confidence: Math.min(0.8, count / 10),
            type: 'trending',
            basedOn: ['community-trends']
          });
        }
      }

      return recommendations;
    } catch (err: any) {
      log.error('Failed to get trending recommendations', { error: err });
      return [];
    }
  }

  /**
   * Get seasonal recommendations (simplified)
   */
  private static async getSeasonalRecommendations(): Promise<RecipeRecommendation[]> {
    const month = new Date().getMonth();
    const seasonalRecipes = {
      // Winter (Dec-Feb)
      [11]: ['Hearty Soup', 'Roast Chicken', 'Hot Chocolate'],
      [0]: ['Hearty Soup', 'Roast Chicken', 'Hot Chocolate'],
      [1]: ['Hearty Soup', 'Roast Chicken', 'Hot Chocolate'],
      // Spring (Mar-May)
      [2]: ['Fresh Salad', 'Grilled Fish', 'Berry Smoothie'],
      [3]: ['Fresh Salad', 'Grilled Fish', 'Berry Smoothie'],
      [4]: ['Fresh Salad', 'Grilled Fish', 'Berry Smoothie'],
      // Summer (Jun-Aug)
      [5]: ['Cold Pasta', 'BBQ', 'Ice Cream'],
      [6]: ['Cold Pasta', 'BBQ', 'Ice Cream'],
      [7]: ['Cold Pasta', 'BBQ', 'Ice Cream'],
      // Fall (Sep-Nov)
      [8]: ['Pumpkin Soup', 'Apple Pie', 'Chili'],
      [9]: ['Pumpkin Soup', 'Apple Pie', 'Chili'],
      [10]: ['Pumpkin Soup', 'Apple Pie', 'Chili']
    };

    const currentSeasonRecipes = seasonalRecipes[month as keyof typeof seasonalRecipes] || [];

    return currentSeasonRecipes.slice(0, 2).map(recipeTitle => ({
      recipe: {
        title: recipeTitle,
        description: recipeTitle,
        ingredients: [],
        instructions: [],
        cookTime: '0 mins'
      },
      reason: 'Perfect for this season',
      confidence: 0.6,
      type: 'seasonal',
      basedOn: ['seasonal-trends']
    }));
  }

  /**
   * Get user's rating history
   */
  private static async getUserRatings(userId: string, limitCount: number): Promise<RecipeRating[]> {
    try {
      const ratingsQuery = DatabaseMonitoringService.query(
          DatabaseMonitoringService.collection(this.RATINGS_COLLECTION),
          DatabaseMonitoringService.where('userId', '==', userId),
          DatabaseMonitoringService.orderBy('date', 'desc'),
          DatabaseMonitoringService.limit(limitCount)
        );

        const ratingsSnapshot = await DatabaseMonitoringService.getDocs(ratingsQuery);
      return ratingsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          date: data.date.toDate().toISOString()
        } as RecipeRating;
      });
    } catch (err: any) {
      log.error('Failed to get user ratings', { error: err, userId });
      return [];
    }
  }

  /**
   * Get household ratings
   */
  private static async getHouseholdRatings(householdId: string, limitCount: number): Promise<RecipeRating[]> {
    try {
      const ratingsQuery = DatabaseMonitoringService.query(
          DatabaseMonitoringService.collection(this.RATINGS_COLLECTION),
          DatabaseMonitoringService.where('householdId', '==', householdId),
          DatabaseMonitoringService.orderBy('date', 'desc'),
          DatabaseMonitoringService.limit(limitCount)
        );

        const ratingsSnapshot = await DatabaseMonitoringService.getDocs(ratingsQuery);
      return ratingsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          date: data.date.toDate().toISOString()
        } as RecipeRating;
      });
    } catch (err: any) {
      log.error('Failed to get household ratings', { error: err, householdId });
      return [];
    }
  }

  /**
   * Get recipes similar to user's preferences
   */
  static async getSimilarRecipes(userId: string, baseRecipe: StructuredRecipe, limitCount: number = 3): Promise<RecipeRecommendation[]> {
    try {
      // Get user's positive ratings
      const positiveRatings = await this.getUserRatings(userId, 10);
      const lovedRecipes = positiveRatings.filter(r => r.wouldMakeAgain);

      // Find recipes with similar ingredients or tags
      // TODO: Implement actual similarity algorithm
      // For now, return mock similar recipes

      const similarRecipe: StructuredRecipe = {
        title: `Similar to ${baseRecipe.title}`,
        description: baseRecipe.description || `Similar to ${baseRecipe.title}`,
        ingredients: Array.isArray(baseRecipe.ingredients) ? (baseRecipe.ingredients as string[]) : [],
        instructions: Array.isArray(baseRecipe.instructions) ? (baseRecipe.instructions as string[]) : [],
        cookTime: typeof baseRecipe.cookTime === 'string' ? baseRecipe.cookTime : `${(baseRecipe as any).cookTime || 0} mins`,
        type: (baseRecipe as any).type,
        image: (baseRecipe as any).image
      };

      const similarRecipes: RecipeRecommendation[] = [
        {
          recipe: similarRecipe,
          reason: 'Similar ingredients and cooking method',
          confidence: 0.7,
          type: 'personal-preference',
          basedOn: ['ingredient-similarity']
        }
      ];

      return similarRecipes.slice(0, limitCount);
    } catch (err: any) {
      log.error('Failed to get similar recipes', { error: err, userId, baseRecipeId: baseRecipe.id });
      return [];
    }
  }
}
