import { describe, it, expect } from 'vitest';
import { fetchRecipeFromUrl } from '../../../services/importService';

const key = process.env.SPOONACULAR_API_KEY || process.env.VITE_SPOONACULAR_API_KEY;

// Gated integration test: only run if key is present
if (!key) {
  describe.skip('Spoonacular integration (skipped - no API key)', () => {
    it('skipped', () => {});
  });
} else {
  describe('Spoonacular integration', () => {
    it('fetches and parses a live recipe URL', async () => {
      // Use a simple known recipe URL that Spoonacular supports
      const url = 'https://www.allrecipes.com/recipe/24074/alysias-basic-meat-lasagna/';
      const recipe = await fetchRecipeFromUrl(url);
      expect(recipe).not.toBeNull();
      if (recipe) {
        expect(typeof recipe.title).toBe('string');
        // Ingredients/instructions may be omitted depending on API account; ensure at least title is present
      }
    }, 20000);
  });
}
