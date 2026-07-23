import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import SpoonacularRecipeClient from '../../../services/spoonacularRecipeClient';

describe('SpoonacularRecipeClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.resetAllMocks();
  });

  it('extractRecipeFromUrl should return parsed JSON when API responds', async () => {
    const sample = { title: 'Test Recipe', extendedIngredients: [], analyzedInstructions: [], servings: 2, readyInMinutes: 10 };
    (global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => sample });

    // Ensure API key is set for test path
    process.env.SPOONACULAR_API_KEY = 'test-key';

    const res = await SpoonacularRecipeClient.extractRecipeFromUrl('https://example.com/recipe');
    expect(res).toBeDefined();
    expect(res.title).toBe('Test Recipe');
  });
});
