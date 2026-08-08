import { describe, it, expect } from 'vitest';
import {
  PORTION_PRESETS,
  calculatePortionScaling,
  scaleRecipeIngredients,
  scaleIngredient,
  getRecommendedServings,
  createScaledRecipe
} from '../../../utils/portionUtils';
import { Household, StructuredRecipe } from '../../../types';

describe('portionUtils', () => {
  describe('PORTION_PRESETS', () => {
    it('defines standard portion presets', () => {
      expect(PORTION_PRESETS.single.scalingFactor).toBe(0.25);
      expect(PORTION_PRESETS.smallFamily.scalingFactor).toBe(1.0);
      expect(PORTION_PRESETS.extendedFamily.scalingFactor).toBe(2.0);
    });
  });

  describe('calculatePortionScaling', () => {
    it('calculates scaling factor for target servings relative to base of 4', () => {
      const config = calculatePortionScaling(null, 2);
      expect(config.householdSize).toBe(1);
      expect(config.baseServingSize).toBe(4);
      expect(config.scalingFactor).toBe(0.5);
    });

    it('uses household member count for householdSize property', () => {
      const mockHousehold: Household = {
        id: 'hh123',
        name: 'Smith Household',
        code: 'CODE1',
        created_at: new Date(),
        members: [
          { id: 'u1', role: 'owner', joined_at: new Date() },
          { id: 'u2', role: 'member', joined_at: new Date() },
          { id: 'u3', role: 'member', joined_at: new Date() }
        ]
      };

      const config = calculatePortionScaling(mockHousehold, 6);
      expect(config.householdSize).toBe(3);
      expect(config.scalingFactor).toBe(1.5);
    });
  });

  describe('getRecommendedServings', () => {
    it('returns 2 servings for single person or couple (<=2 members)', () => {
      expect(getRecommendedServings(null)).toBe(2);

      const singleHousehold: Household = {
        id: 'hh1', name: 'Single', code: 'C1', created_at: new Date(),
        members: [{ id: 'u1', role: 'owner', joined_at: new Date() }]
      };
      expect(getRecommendedServings(singleHousehold)).toBe(2);
    });

    it('returns 4 servings for small family (3-4 members)', () => {
      const familyHousehold: Household = {
        id: 'hh2', name: 'Family', code: 'C2', created_at: new Date(),
        members: [
          { id: 'u1', role: 'owner', joined_at: new Date() },
          { id: 'u2', role: 'member', joined_at: new Date() },
          { id: 'u3', role: 'member', joined_at: new Date() },
          { id: 'u4', role: 'member', joined_at: new Date() }
        ]
      };
      expect(getRecommendedServings(familyHousehold)).toBe(4);
    });

    it('returns 8 servings for extended family (>6 members)', () => {
      const largeHousehold: Household = {
        id: 'hh3', name: 'Big', code: 'C3', created_at: new Date(),
        members: new Array(7).fill({ id: 'u', role: 'member', joined_at: new Date() })
      };
      expect(getRecommendedServings(largeHousehold)).toBe(8);
    });
  });

  describe('scaleIngredient', () => {
    it('scales simple quantitative ingredient string', () => {
      expect(scaleIngredient('2 cups flour', 0.5)).toBe('1 cups flour');
      expect(scaleIngredient('1 tbsp olive oil', 2)).toBe('2 tbsp olive oil');
    });

    it('formats fractional scaled quantities nicely', () => {
      expect(scaleIngredient('1 cup sugar', 0.5)).toBe('1/2 cup sugar');
      expect(scaleIngredient('1 tsp salt', 0.25)).toBe('1/4 tsp salt');
    });

    it('returns non-quantitative ingredients unchanged', () => {
      expect(scaleIngredient('salt to taste', 2)).toBe('salt to taste');
      expect(scaleIngredient('fresh black pepper', 0.5)).toBe('fresh black pepper');
    });
  });

  describe('scaleRecipeIngredients & createScaledRecipe', () => {
    const sampleRecipe: StructuredRecipe = {
      id: 'rec123',
      name: 'Pancakes',
      ingredients: ['2 cups flour', '1 tsp baking powder', '1 1/2 cups milk', 'pinch of salt'],
      instructions: ['Mix and cook'],
      servings: 4,
      prepTime: 10,
      cookTime: 15,
      caloriesPerServing: 250
    };

    it('scales all ingredients in a recipe array', () => {
      const portionConfig = { householdSize: 2, baseServingSize: 4, scalingFactor: 0.5 };
      const scaled = scaleRecipeIngredients(sampleRecipe, portionConfig, 'Standard');

      expect(scaled[0]).toBe('1 cups flour');
      expect(scaled[1]).toBe('1/2 tsp baking powder');
      expect(scaled[3]).toBe('pinch of salt');
    });

    it('creates complete scaled recipe object with updated servings and metadata', () => {
      const portionConfig = { householdSize: 2, baseServingSize: 4, scalingFactor: 0.5 };
      const scaledRecipe = createScaledRecipe(sampleRecipe, portionConfig, 'Standard');

      expect(scaledRecipe.servings).toBe(2);
      expect(scaledRecipe.ingredients[0]).toBe('1 cups flour');
      expect((scaledRecipe as any)._scalingFactor).toBe(0.5);
    });
  });
});
