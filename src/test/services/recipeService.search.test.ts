import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as RecipeService from '../../../services/recipeService';
import RecipeClient from '../../../services/spoonacularRecipeClient';

describe('recipeService -> fetchRecipesFromSpoonacular', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('uses SpoonacularRecipeClient.searchRecipes when available', async () => {
    const mockResults = [{ id: 1, title: 'Mocked' }];
    // Spy on the adapter
    vi.spyOn(RecipeClient as any, 'searchRecipes').mockResolvedValue(mockResults);

    const res = await RecipeService.fetchRecipesFromSpoonacular('chicken', 5, 0);
    expect(res).toBeDefined();
    expect(Array.isArray(res)).toBe(true);
    expect((res as any)[0].title).toBe('Mocked');
  });
});
