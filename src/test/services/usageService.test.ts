import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import UsageService, { UsageLimits, PlanLimits } from '../../services/usageService';
import { User } from '../../types';

// Mock Firebase services
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  increment: vi.fn(),
}));

vi.mock('../firebaseConfig', () => ({
  db: {},
}));

describe('UsageService', () => {
  const mockUser: User = {
    id: 'user123',
    email: 'test@example.com',
    subscriptionPlan: 'free',
    householdId: 'household123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getUsageLimits', () => {
    it('returns usage limits for free plan user', async () => {
      const mockLimits: UsageLimits = {
        searches: {
          weekly: 5,
          used: 2,
          resetDate: new Date(),
        },
        recipes: {
          max: 10,
          used: 3,
        },
        mealPlanning: {
          weeklyRecipes: 3,
          weeklyUsed: 1,
          twoWeekPlanning: false,
          resetDate: new Date(),
        },
      };

      const { getDoc } = await import('firebase/firestore');
      (getDoc as any).mockResolvedValueOnce({
        exists: () => true,
        data: () => mockLimits,
      });

      const result = await UsageService.getUsageLimits(mockUser);

      expect(result).toEqual(mockLimits);
    });

    it('creates default limits for new user', async () => {
      const { getDoc, setDoc } = await import('firebase/firestore');
      (getDoc as any).mockResolvedValueOnce({
        exists: () => false,
      });
      (setDoc as any).mockResolvedValueOnce({});

      const result = await UsageService.getUsageLimits(mockUser);

      expect(setDoc).toHaveBeenCalled();
      expect(result.searches.weekly).toBe(5); // Free plan limit
      expect(result.recipes.max).toBe(10);
      expect(result.mealPlanning.weeklyRecipes).toBe(3);
    });

    it('handles database errors', async () => {
      const { getDoc } = await import('firebase/firestore');
      (getDoc as any).mockRejectedValueOnce(new Error('Database error'));

      await expect(UsageService.getUsageLimits(mockUser)).rejects.toThrow('Database error');
    });
  });

  describe('Search tracking', () => {
    it('allows search when under weekly limit', async () => {
      const mockLimits: UsageLimits = {
        searches: {
          weekly: 5,
          used: 2,
          resetDate: new Date(Date.now() + 86400000), // Future date
        },
        recipes: { max: 10, used: 0 },
        mealPlanning: {
          weeklyRecipes: 3,
          weeklyUsed: 0,
          twoWeekPlanning: false,
          resetDate: new Date(),
        },
      };

      const { getDoc } = await import('firebase/firestore');
      (getDoc as any).mockResolvedValueOnce({
        exists: () => true,
        data: () => mockLimits,
      });

      const result = await UsageService.canPerformSearch(mockUser);

      expect(result).toBe(true);
    });

    it('blocks search when weekly limit exceeded', async () => {
      const mockLimits: UsageLimits = {
        searches: {
          weekly: 5,
          used: 5,
          resetDate: new Date(Date.now() + 86400000),
        },
        recipes: { max: 10, used: 0 },
        mealPlanning: {
          weeklyRecipes: 3,
          weeklyUsed: 0,
          twoWeekPlanning: false,
          resetDate: new Date(),
        },
      };

      const { getDoc } = await import('firebase/firestore');
      (getDoc as any).mockResolvedValueOnce({
        exists: () => true,
        data: () => mockLimits,
      });

      const result = await UsageService.canPerformSearch(mockUser);

      expect(result).toBe(false);
    });

    it('records search usage', async () => {
      const { updateDoc, increment } = await import('firebase/firestore');
      (updateDoc as any).mockResolvedValueOnce({});
      (increment as any).mockReturnValue(1);

      await expect(UsageService.recordSearch(mockUser)).resolves.toBeUndefined();
      expect(updateDoc).toHaveBeenCalled();
    });
  });

  describe('Recipe save tracking', () => {
    it('allows recipe save when under limit', async () => {
      const result = await UsageService.canSaveRecipe(mockUser, 5);

      expect(result).toBe(true);
    });

    it('blocks recipe save when limit exceeded', async () => {
      const result = await UsageService.canSaveRecipe(mockUser, 10);

      expect(result).toBe(false);
    });

    it('records recipe save', async () => {
      const { updateDoc, increment } = await import('firebase/firestore');
      (updateDoc as any).mockResolvedValueOnce({});
      (increment as any).mockReturnValue(1);

      await expect(UsageService.recordRecipeSave(mockUser)).resolves.toBeUndefined();
      expect(updateDoc).toHaveBeenCalled();
    });
  });

  describe('Meal planning tracking', () => {
    it('allows meal plan addition when under weekly limit', async () => {
      const result = await UsageService.canAddMealPlanRecipe(mockUser, 2);

      expect(result).toBe(true);
    });

    it('blocks meal plan addition when weekly limit exceeded', async () => {
      const result = await UsageService.canAddMealPlanRecipe(mockUser, 3);

      expect(result).toBe(false);
    });

    it('records meal plan addition', async () => {
      const { updateDoc, increment } = await import('firebase/firestore');
      (updateDoc as any).mockResolvedValueOnce({});
      (increment as any).mockReturnValue(1);

      await expect(UsageService.recordMealPlanAddition(mockUser)).resolves.toBeUndefined();
      expect(updateDoc).toHaveBeenCalled();
    });
  });

  describe('Household member tracking', () => {
    it('allows adding household member for premium plan', async () => {
      const premiumUser = { ...mockUser, subscriptionPlan: 'premium' as const };

      const result = await UsageService.canAddHouseholdMember(premiumUser.id);

      expect(result).toBe(true);
    });

    it('blocks adding household member for free plan', async () => {
      const result = await UsageService.canAddHouseholdMember(mockUser.id);

      expect(result).toBe(false);
    });

    it('records household member addition', async () => {
      const { updateDoc } = await import('firebase/firestore');
      (updateDoc as any).mockResolvedValueOnce({});

      await expect(UsageService.recordHouseholdMemberAdd(mockUser.id)).resolves.toBeUndefined();
      expect(updateDoc).toHaveBeenCalled();
    });
  });

  describe('Plan updates', () => {
    it('updates plan limits to premium', async () => {
      const { updateDoc } = await import('firebase/firestore');
      (updateDoc as any).mockResolvedValueOnce({});

      await expect(UsageService.updatePlanLimits(mockUser, 'premium')).resolves.toBeUndefined();
      expect(updateDoc).toHaveBeenCalled();
    });

    it('handles plan update errors', async () => {
      const { updateDoc } = await import('firebase/firestore');
      (updateDoc as any).mockRejectedValueOnce(new Error('Update failed'));

      await expect(UsageService.updatePlanLimits(mockUser, 'premium')).rejects.toThrow('Update failed');
    });
  });

  describe('Plan limits configuration', () => {
    it('has correct free plan limits', () => {
      const limits = UsageService.getPlanLimits();

      expect(limits.free.searches.weekly).toBe(5);
      expect(limits.free.recipes.max).toBe(10);
      expect(limits.free.mealPlanning.weeklyRecipes).toBe(3);
      expect(limits.free.mealPlanning.twoWeekPlanning).toBe(false);
    });

    it('has correct premium plan limits', () => {
      const limits = UsageService.getPlanLimits();

      expect(limits.premium.searches.weekly).toBe(15);
      expect(limits.premium.recipes.max).toBe(20);
      expect(limits.premium.mealPlanning.weeklyRecipes).toBe(10);
      expect(limits.premium.mealPlanning.twoWeekPlanning).toBe(true);
    });

    it('has correct family plan limits', () => {
      const limits = UsageService.getPlanLimits();

      expect(limits.family.searches.weekly).toBe(25);
      expect(limits.family.recipes.max).toBe(50);
      expect(limits.family.mealPlanning.weeklyRecipes).toBe(20);
      expect(limits.family.mealPlanning.twoWeekPlanning).toBe(true);
    });
  });
});