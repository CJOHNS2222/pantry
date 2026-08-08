import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculatePantryScore, getUnlockedBadges } from '../../../utils/achievementUtils';
import { PantryItem, SavedRecipe, DayPlan } from '../../../types';

vi.mock('../../../services/cookingStreakService', () => ({
  getCookingStreak: vi.fn().mockReturnValue(3)
}));

describe('achievementUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculatePantryScore', () => {
    it('returns 0 for empty item list', () => {
      expect(calculatePantryScore([])).toBe(0);
    });

    it('calculates score between 0 and 100 for items', () => {
      const futureDate = new Date(Date.now() + 10 * 86400000).toISOString();
      const items: PantryItem[] = [
        { id: '1', item: 'Milk', category: 'Dairy', expirationDate: futureDate, quantity: 1 },
        { id: '2', item: 'Apple', category: 'Fruit', expirationDate: futureDate, quantity: 2 },
        { id: '3', item: 'Bread', category: 'Bakery', expirationDate: futureDate, quantity: 1 },
        { id: '4', item: 'Rice', category: 'Grains', expirationDate: futureDate, quantity: 3 }
      ];

      const score = calculatePantryScore(items);
      expect(score).toBeGreaterThan(50);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('getUnlockedBadges', () => {
    const futureDate = new Date(Date.now() + 10 * 86400000).toISOString();
    const mockInventory: PantryItem[] = [
      { id: '1', item: 'Milk', category: 'Dairy', expirationDate: futureDate, quantity: 1 },
      { id: '2', item: 'Apple', category: 'Fruit', expirationDate: futureDate, quantity: 1 },
      { id: '3', item: 'Bread', category: 'Bakery', expirationDate: futureDate, quantity: 1 },
      { id: '4', item: 'Rice', category: 'Grains', expirationDate: futureDate, quantity: 1 },
      { id: '5', item: 'Pasta', category: 'Grains', expirationDate: futureDate, quantity: 1 }
    ];

    const mockSavedRecipes: SavedRecipe[] = [
      { id: 'r1', title: 'R1', ingredients: [], instructions: [], servings: 2 },
      { id: 'r2', title: 'R2', ingredients: [], instructions: [], servings: 2 },
      { id: 'r3', title: 'R3', ingredients: [], instructions: [], servings: 2 },
      { id: 'r4', title: 'R4', ingredients: [], instructions: [], servings: 2 },
      { id: 'r5', title: 'R5', ingredients: [], instructions: [], servings: 2 }
    ];

    const mockMealPlan: DayPlan[] = [
      { date: '2026-08-08', dinner: [{ recipeId: 'r1', name: 'R1', servings: 2 }] }
    ];

    it('returns unlocked badges based on user data thresholds', () => {
      const badges = getUnlockedBadges(mockInventory, mockSavedRecipes, mockMealPlan, null);

      expect(badges.length).toBeGreaterThan(0);
      expect(badges.some(b => b.id === 'waste_warrior')).toBe(true);
      expect(badges.some(b => b.id === 'master_chef')).toBe(true);
      expect(badges.some(b => b.id === 'pantry_architect')).toBe(true);
      expect(badges.some(b => b.id === 'streak_builder')).toBe(true);
      expect(badges.some(b => b.id === 'meal_planner')).toBe(true);
    });

    it('unlocks Eco Collaborator badge when household is present', () => {
      const household = { id: 'h1', name: 'Home', code: 'C1', created_at: new Date(), members: [] };
      const badges = getUnlockedBadges(mockInventory, [], [], household);

      expect(badges.some(b => b.id === 'eco_collaborator')).toBe(true);
    });
  });
});
