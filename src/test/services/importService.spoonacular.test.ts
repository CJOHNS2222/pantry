import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchRecipeFromUrl } from '../../../services/importService';

describe('ImportService Spoonacular integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses Spoonacular extract response into StructuredRecipe', async () => {
    // Mock process.env API key and global fetch
    process.env.SPOONACULAR_API_KEY = 'test-key';

    const mockResponse = {
      title: 'Mocked Spoonacular Recipe',
      summary: '<p>A tasty test</p>',
      extendedIngredients: [{ originalString: '1 cup sugar' }, { originalString: '2 eggs' }],
      analyzedInstructions: [{ steps: [{ step: 'Mix ingredients' }, { step: 'Bake' }] }],
      servings: 4,
      readyInMinutes: 45,
      image: 'https://example.com/image.jpg'
    };

    vi.stubGlobal('fetch', vi.fn(async (input: any) => {
      return {
        ok: true,
        json: async () => mockResponse
      } as any;
    }));

    const recipe = await fetchRecipeFromUrl('https://example.com/some-recipe');
    expect(recipe).not.toBeNull();
    expect(recipe?.title).toBe('Mocked Spoonacular Recipe');
    expect(recipe?.ingredients.length).toBe(2);
    expect(recipe?.instructions.length).toBe(2);
    expect(recipe?.servings).toBe(4);
  });
});
