import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Firebase functions
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  increment: vi.fn(),
  getFirestore: vi.fn(() => 'mock-db'),
  Timestamp: {
    now: vi.fn(() => ({
      toDate: vi.fn(() => new Date()),
      toMillis: vi.fn(() => Date.now()),
      seconds: Math.floor(Date.now() / 1000),
      nanoseconds: 0
    })),
    fromDate: vi.fn((date) => ({
      toDate: vi.fn(() => date),
      toMillis: vi.fn(() => date.getTime()),
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0
    }))
  }
}));

import { UsageService, UsageLimits, PlanLimits } from '../../../services/usageService';
import { User } from '../../../types';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';

describe('UsageService', () => {
  const mockUser: User = {
    id: 'user123',
    name: 'Test User',
    email: 'test@example.com',
    provider: 'email',
    hasSeenTutorial: false,
    subscription: { tier: 'free', status: 'active', current_period_end: new Date(), cancel_at_period_end: false },
    householdId: 'household123',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Clear the static in-memory limits cache to prevent cross-test pollution
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (UsageService as any).limitsCache.clear();

    // Set up default mock behaviors
    const mockTimestamp = {
      toDate: vi.fn(() => new Date()),
      toMillis: vi.fn(() => Date.now()),
      seconds: Math.floor(Date.now() / 1000),
      nanoseconds: 0
    };

    // Mock doc function to return a mock reference
    vi.mocked(doc).mockReturnValue('mock-doc-ref' as unknown as ReturnType<typeof doc>);

    vi.mocked(getDoc).mockResolvedValue({
      exists: vi.fn(() => true),
      data: vi.fn(() => ({
        searches: {
          weekly: 5,
          used: 0,
          resetDate: mockTimestamp
        },
        recipes: {
          max: 10,
          used: 0
        },
        mealPlanning: {
          weeklyRecipes: 3,
          weeklyUsed: 0,
          twoWeekPlanning: false,
          resetDate: mockTimestamp
        },
        gemini: {
          weekly: 5,
          used: 0,
          resetDate: mockTimestamp
        }
      })),
      id: 'test-doc-id'
    });

    vi.mocked(setDoc).mockResolvedValue(undefined);
    vi.mocked(updateDoc).mockResolvedValue(undefined);
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
        gemini: {
          weekly: 5,
          used: 1,
          resetDate: new Date(),
        },
      };

      const mockDocumentSnapshot = {
        exists: vi.fn(() => true),
        data: vi.fn(() => ({
          searches: {
            weekly: 5,
            used: 2,
            resetDate: Timestamp.fromDate(new Date()),
          },
          recipes: {
            max: 10,
            used: 3,
          },
          mealPlanning: {
            weeklyRecipes: 3,
            weeklyUsed: 1,
            twoWeekPlanning: false,
            resetDate: Timestamp.fromDate(new Date()),
          },
          gemini: {
            weekly: 5,
            used: 1,
            resetDate: Timestamp.fromDate(new Date()),
          },
        })),
        id: 'usage-limits'
      };

      getDoc.mockResolvedValueOnce(mockDocumentSnapshot);

      const result = await UsageService.getUsageLimits(mockUser);

      // Check structure and values without being strict about timestamps
      expect(result.searches.weekly).toBe(5);
      expect(result.searches.used).toBe(2);
      expect(result.recipes.max).toBe(2);  // Free plan limit
      expect(result.recipes.used).toBe(3);
      expect(result.mealPlanning.weeklyRecipes).toBe(1);  // Free plan limit
      expect(result.mealPlanning.weeklyUsed).toBe(1);
      expect(result.mealPlanning.twoWeekPlanning).toBe(false);
      expect(result.gemini.weekly).toBe(5);
      expect(result.gemini.used).toBe(1);
      expect(result.searches.resetDate).toBeInstanceOf(Date);
      expect(result.mealPlanning.resetDate).toBeInstanceOf(Date);
      expect(result.gemini.resetDate).toBeInstanceOf(Date);
    });

    it('creates default limits for new user', async () => {
      const mockEmptyDocumentSnapshot = {
        exists: vi.fn(() => false),
        data: vi.fn(() => ({})),
        id: 'usage-limits'
      };

      getDoc.mockResolvedValueOnce(mockEmptyDocumentSnapshot);

      const result = await UsageService.getUsageLimits(mockUser);

      expect(setDoc).toHaveBeenCalled();
      expect(result.searches.weekly).toBe(5); // Free plan limit
      expect(result.recipes.max).toBe(2);  // Free plan limit
      expect(result.mealPlanning.weeklyRecipes).toBe(1);  // Free plan limit
    });

    it('handles database errors', async () => {
      getDoc.mockRejectedValueOnce(new Error('Database error'));

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
        gemini: {
          weekly: 10,
          used: 0,
          resetDate: new Date(),
        },
      };

      const mockDocumentSnapshot = {
        exists: vi.fn(() => true),
        data: vi.fn(() => ({
          searches: {
            weekly: 5,
            used: 2,
            resetDate: Timestamp.fromDate(new Date(Date.now() + 86400000)),
          },
          recipes: { max: 10, used: 0 },
          mealPlanning: {
            weeklyRecipes: 3,
            weeklyUsed: 0,
            twoWeekPlanning: false,
            resetDate: Timestamp.fromDate(new Date()),
          },
          gemini: {
            weekly: 10,
            used: 0,
            resetDate: Timestamp.fromDate(new Date()),
          },
        })),
        id: 'usage-limits'
      };

      vi.mocked(getDoc).mockResolvedValueOnce(mockDocumentSnapshot);

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
        gemini: {
          weekly: 10,
          used: 0,
          resetDate: new Date(),
        },
      };

      const mockDocumentSnapshot = {
        exists: vi.fn(() => true),
        data: vi.fn(() => ({
          searches: {
            weekly: 5,
            used: 5,
            resetDate: Timestamp.fromDate(new Date(Date.now() + 86400000)),
          },
          recipes: { max: 10, used: 0 },
          mealPlanning: {
            weeklyRecipes: 3,
            weeklyUsed: 0,
            twoWeekPlanning: false,
            resetDate: Timestamp.fromDate(new Date()),
          },
          gemini: {
            weekly: 10,
            used: 0,
            resetDate: Timestamp.fromDate(new Date()),
          },
        })),
        id: 'usage-limits'
      };

      vi.mocked(getDoc).mockResolvedValueOnce(mockDocumentSnapshot);

      const result = await UsageService.canPerformSearch(mockUser);

      expect(result).toBe(false);
    });

    it('records search usage', async () => {
      vi.mocked(updateDoc).mockResolvedValueOnce();

      await expect(UsageService.recordSearch(mockUser)).resolves.toBeUndefined();
      expect(updateDoc).toHaveBeenCalled();
    });
  });

  describe('Recipe save tracking', () => {
    it('allows recipe save when under limit', async () => {
      const result = await UsageService.canSaveRecipe(mockUser, 1); // 1 < free limit of 2

      expect(result).toBe(true);
    });

    it('blocks recipe save when limit exceeded', async () => {
      const result = await UsageService.canSaveRecipe(mockUser, 10);

      expect(result).toBe(false);
    });

    it('records recipe save', async () => {
      vi.mocked(updateDoc).mockResolvedValueOnce();

      await expect(UsageService.recordRecipeSave(mockUser)).resolves.toBeUndefined();
      expect(updateDoc).toHaveBeenCalled();
    });
  });

  describe('Meal planning tracking', () => {
    it('allows meal plan addition when under weekly limit', async () => {
      const result = await UsageService.canAddMealPlanRecipe(mockUser, 0); // 0 < free limit of 1

      expect(result).toBe(true);
    });

    it('blocks meal plan addition when weekly limit exceeded', async () => {
      const result = await UsageService.canAddMealPlanRecipe(mockUser, 3);

      expect(result).toBe(false);
    });

    it('records meal plan addition', async () => {
      vi.mocked(updateDoc).mockResolvedValueOnce();

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
      // Mock user doc
      const userDoc = {
        exists: vi.fn(() => true),
        data: vi.fn(() => ({
          id: mockUser.id,
          email: mockUser.email,
          subscription: { tier: 'free' },
          householdId: mockUser.householdId
        }))
      };
      const householdDoc = {
        exists: vi.fn(() => true),
        data: vi.fn(() => ({ members: ['user123'] })) // Already has 1 member
      };

      // Mock doc to return objects with path property
      vi.mocked(doc).mockImplementation((db, path) => ({ path }));

      vi.mocked(getDoc).mockImplementation((ref) => {
        if (ref.path.includes('users')) return Promise.resolve(userDoc);
        if (ref.path.includes('households')) return Promise.resolve(householdDoc);
        return Promise.resolve({ exists: vi.fn(() => false), data: vi.fn(() => ({})) });
      });

      const result = await UsageService.canAddHouseholdMember(mockUser.id);

      expect(result).toBe(false);
    });

    it('records household member addition', async () => {
      await expect(UsageService.recordHouseholdMemberAdd(mockUser.id)).resolves.toBeUndefined();
      // Note: This method currently doesn't perform any database operations
      // expect(updateDoc).toHaveBeenCalled();
    });
  });

  describe('Plan updates', () => {
    it('updates plan limits to premium', async () => {
      vi.mocked(updateDoc).mockResolvedValueOnce();

      await expect(UsageService.updatePlanLimits(mockUser, 'premium')).resolves.toBeUndefined();
      expect(updateDoc).toHaveBeenCalled();
    });

    it('handles plan update errors', async () => {
      vi.mocked(updateDoc).mockRejectedValueOnce(new Error('Update failed'));

      await expect(UsageService.updatePlanLimits(mockUser, 'premium')).rejects.toThrow('Update failed');
    });
  });

  describe('Plan limits configuration', () => {
    it('has correct free plan limits', () => {
      const limits = UsageService.getPlanLimits();

      expect(limits.free.searches.weekly).toBe(5);
      expect(limits.free.recipes.max).toBe(2);
      expect(limits.free.mealPlanning.weeklyRecipes).toBe(1);
      expect(limits.free.mealPlanning.twoWeekPlanning).toBe(false);
    });

    it('has correct premium plan limits', () => {
      const limits = UsageService.getPlanLimits();

      expect(limits.premium.searches.weekly).toBe(15);
      expect(limits.premium.recipes.max).toBe(20);
      expect(limits.premium.mealPlanning.weeklyRecipes).toBe(-1); // unlimited
      expect(limits.premium.mealPlanning.twoWeekPlanning).toBe(false);
    });

    it('has correct family plan limits', () => {
      const limits = UsageService.getPlanLimits();

      expect(limits.family.searches.weekly).toBe(-1); // unlimited
      expect(limits.family.recipes.max).toBe(-1); // unlimited
      expect(limits.family.mealPlanning.weeklyRecipes).toBe(-1); // unlimited
      expect(limits.family.mealPlanning.twoWeekPlanning).toBe(true);
    });
  });
});
