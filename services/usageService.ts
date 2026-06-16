import DatabaseMonitoringService from './databaseMonitoringService';
import { increment, Timestamp } from 'firebase/firestore';
import { User } from '../types';
import { log } from './logService';
import remoteConfig from './remoteConfigService';

export interface UsageLimits {
  searches: {
    weekly: number;
    used: number;
    resetDate: Date;
  };
  recipes: {
    max: number;
    used: number;
  };
  mealPlanning: {
    weeklyRecipes: number;
    weeklyUsed: number;
    twoWeekPlanning: boolean;
    resetDate: Date;
  };
  gemini: {
    weekly: number;
    used: number;
    resetDate: Date;
  };
  /** Effective subscription tier after household inheritance is applied. */
  resolvedTier: 'free' | 'premium' | 'family';
}

export interface PlanLimits {
  free: {
    searches: { weekly: number };
    recipes: { max: number };
    mealPlanning: { weeklyRecipes: number; twoWeekPlanning: boolean };
    gemini: { weekly: number };
  };
  premium: {
    searches: { weekly: number };
    recipes: { max: number };
    mealPlanning: { weeklyRecipes: number; twoWeekPlanning: boolean };
    gemini: { weekly: number };
  };
  family: {
    searches: { weekly: number };
    recipes: { max: number };
    mealPlanning: { weeklyRecipes: number; twoWeekPlanning: boolean };
    gemini: { weekly: number };
  };
}

class UsageService {
  // Helper function to safely convert Firestore timestamps or Date objects to Date
  private static toDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (value && typeof (value as { toDate?: unknown }).toDate === 'function') return (value as { toDate(): Date }).toDate();
    if (value instanceof Timestamp) return value.toDate();
    // If it's a number (timestamp), convert it
    if (typeof value === 'number') return new Date(value);
    // If it's a string, try to parse it
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  // Short-lived in-memory cache to avoid redundant Firestore reads within the same
  // search flow (RecipeFinder canPerformSearch → searchRecipes canUseGemini all read
  // the same 'users/{uid}/usage/limits' doc). 30s TTL is negligible for limit enforcement.
  private static readonly LIMITS_CACHE_TTL_MS = 30_000;
  private static limitsCache = new Map<string, { limits: UsageLimits; fetchedAt: number }>();

  private static buildPlanLimits(): PlanLimits {
    return {
      free: {
        searches: { weekly: remoteConfig.getNumber('limit_free_searches_weekly') },
        recipes: { max: remoteConfig.getNumber('limit_free_recipes_max') },
        mealPlanning: {
          weeklyRecipes: remoteConfig.getNumber('limit_free_mealplanning_weekly'),
          twoWeekPlanning: false
        },
        gemini: { weekly: remoteConfig.getNumber('limit_free_gemini_weekly') }
      },
      premium: {
        searches: { weekly: remoteConfig.getNumber('limit_premium_searches_weekly') },
        recipes: { max: remoteConfig.getNumber('limit_premium_recipes_max') },
        mealPlanning: {
          weeklyRecipes: remoteConfig.getNumber('limit_premium_mealplanning_weekly'),
          twoWeekPlanning: true
        },
        gemini: { weekly: remoteConfig.getNumber('limit_premium_gemini_weekly') }
      },
      family: {
        searches: { weekly: -1 }, // unlimited
        recipes: { max: -1 }, // unlimited
        mealPlanning: { weeklyRecipes: -1, twoWeekPlanning: true },
        gemini: { weekly: -1 } // unlimited
      }
    };
  }

  static async getUsageLimits(user: User): Promise<UsageLimits> {
    if (!user?.id) {
      throw new Error('User required for usage tracking');
    }

    // Deduplicate reads — RecipeFinder + canPerformSearch + canUseGemini all read
    // the same doc; one Firestore read per 30s window is enough
    const cached = UsageService.limitsCache.get(user.id);
    if (cached && Date.now() - cached.fetchedAt < UsageService.LIMITS_CACHE_TTL_MS) {
      return cached.limits;
    }

    // Determine effective plan tier.
    // Free members of a family-plan household inherit the family tier for limits.
    let planTier = user.subscription?.tier || 'free';
    if (planTier === 'free' && user.householdId) {
      try {
        const householdDoc = await DatabaseMonitoringService.getDoc(
          DatabaseMonitoringService.doc('households/' + user.householdId)
        );
        if (householdDoc.exists()) {
          const hData = householdDoc.data();
          const members: Array<{ id: string; role: string }> = hData.members || [];
          const member = members.find(m => m.id === user.id);
          if (member && member.role !== 'admin' &&
              (hData.ownerSubscriptionTier === 'family' || hData.ownerSubscriptionTier === 'premium')) {
            planTier = hData.ownerSubscriptionTier as 'premium' | 'family';
          }
        }
      } catch {
        // Access revoked or network error — fall back to own tier
      }
    }

    const planLimits = this.buildPlanLimits()[planTier as keyof PlanLimits] ?? this.buildPlanLimits().free;

    const usageRef = DatabaseMonitoringService.doc('users/' + user.id + '/usage/limits');
    const usageDoc = await DatabaseMonitoringService.getDoc(usageRef);

    const now = new Date();
    const weekStart = this.getWeekStart(now);

    if (!usageDoc.exists()) {
      // Initialize usage tracking for new user
      const initialUsage: UsageLimits = {
        searches: {
          weekly: planLimits.searches.weekly,
          used: 0,
          resetDate: weekStart
        },
        recipes: {
          max: planLimits.recipes.max,
          used: 0
        },
        mealPlanning: {
          weeklyRecipes: planLimits.mealPlanning.weeklyRecipes,
          weeklyUsed: 0,
          twoWeekPlanning: planLimits.mealPlanning.twoWeekPlanning,
          resetDate: weekStart
        },
        gemini: {
          weekly: planLimits.gemini.weekly,
          used: 0,
          resetDate: weekStart
        },
        resolvedTier: planTier as 'free' | 'premium' | 'family'
      };

      await DatabaseMonitoringService.setDoc(usageRef, {
        ...initialUsage,
        searches: { ...initialUsage.searches, resetDate: weekStart },
        mealPlanning: { ...initialUsage.mealPlanning, resetDate: weekStart },
        lastUpdated: now
      });

      UsageService.limitsCache.set(user.id, { limits: initialUsage, fetchedAt: Date.now() });
      return initialUsage;
    }

    type UsageData = {
      searches?: { used?: number; resetDate?: unknown };
      mealPlanning?: { weeklyUsed?: number; resetDate?: unknown };
      gemini?: { used?: number; resetDate?: unknown };
      recipes?: { used?: number };
    };
    const data = usageDoc.data() as UsageData;

    // Get the earliest reset date from all weekly limits, or use weekStart if none exist
    const searchResetDate = this.toDate(data.searches?.resetDate);
    const mealPlanningResetDate = this.toDate(data.mealPlanning?.resetDate);
    const geminiResetDate = this.toDate(data.gemini?.resetDate);

    const earliestResetDate = [searchResetDate, mealPlanningResetDate, geminiResetDate]
      .filter(date => date instanceof Date)
      .sort((a, b) => a.getTime() - b.getTime())[0] || weekStart;

    // Reset weekly counters only when we've crossed into a new week
    // (weekStart is the start of the current week; earliestResetDate is the start
    // of the week when counters were last reset — if they differ, we're in a new week)
    if (weekStart > earliestResetDate) {
      await DatabaseMonitoringService.updateDoc(usageRef, {
        'searches.used': 0,
        'searches.resetDate': weekStart,
        'mealPlanning.weeklyUsed': 0,
        'mealPlanning.resetDate': weekStart,
        'gemini.used': 0,
        'gemini.resetDate': weekStart,
        lastUpdated: now
      });

      // Update local data for return
      data.searches = data.searches || {};
      data.searches.used = 0;
      data.searches.resetDate = weekStart;
      data.mealPlanning = data.mealPlanning || {};
      data.mealPlanning.weeklyUsed = 0;
      data.mealPlanning.resetDate = weekStart;
      data.gemini = data.gemini || {};
      data.gemini.used = 0;
      data.gemini.resetDate = weekStart;
    }

    const result: UsageLimits = {
      searches: {
        weekly: planLimits.searches.weekly,
        used: Math.max(0, data.searches?.used || 0),
        resetDate: this.toDate(data.searches?.resetDate) || weekStart
      },
      recipes: {
        max: planLimits.recipes.max,
        used: Math.max(0, data.recipes?.used || 0)
      },
      mealPlanning: {
        weeklyRecipes: planLimits.mealPlanning.weeklyRecipes,
        weeklyUsed: data.mealPlanning?.weeklyUsed || 0,
        twoWeekPlanning: planLimits.mealPlanning.twoWeekPlanning,
        resetDate: this.toDate(data.mealPlanning?.resetDate) || weekStart
      },
      gemini: {
        weekly: planLimits.gemini.weekly,
        used: data.gemini?.used || 0,
        resetDate: this.toDate(data.gemini?.resetDate) || weekStart
      },
      resolvedTier: planTier as 'free' | 'premium' | 'family'
    };
    UsageService.limitsCache.set(user.id, { limits: result, fetchedAt: Date.now() });
    return result;
  }

  static async canPerformSearch(user: User): Promise<boolean> {
    const limits = await this.getUsageLimits(user);
    return limits.searches.weekly === -1 || limits.searches.used < limits.searches.weekly;
  }

  static async recordSearch(user: User): Promise<void> {
    if (!user?.id) return;
    UsageService.limitsCache.delete(user.id);
    const usageRef = DatabaseMonitoringService.doc('users/' + user.id + '/usage/limits');
    await DatabaseMonitoringService.updateDoc(usageRef, {
      'searches.used': increment(1),
      lastUpdated: new Date()
    });
  }

  static async canSaveRecipe(user: User, currentRecipeCount: number): Promise<boolean> {
    const limits = await this.getUsageLimits(user);
    return limits.recipes.max === -1 || currentRecipeCount < limits.recipes.max;
  }

  static async canAddMealPlanRecipe(user: User, currentWeeklyCount: number): Promise<boolean> {
    const limits = await this.getUsageLimits(user);
    return limits.mealPlanning.weeklyRecipes === -1 || currentWeeklyCount < limits.mealPlanning.weeklyRecipes;
  }

  static async recordRecipeSave(_user: User): Promise<void> {
    // Deprecated — use syncRecipeCount instead
  }

  static async recordRecipeDelete(_user: User): Promise<void> {
    // Deprecated — use syncRecipeCount instead
  }

  /**
   * Sync the recipes.used counter to match the actual number of saved recipes.
   * This is the source-of-truth approach — avoids drift from increment/decrement.
   */
  static async syncRecipeCount(user: User, actualCount: number): Promise<void> {
    if (!user?.id) return;
    UsageService.limitsCache.delete(user.id);
    const usageRef = DatabaseMonitoringService.doc('users/' + user.id + '/usage/limits');
    await DatabaseMonitoringService.updateDoc(usageRef, {
      'recipes.used': Math.max(0, actualCount),
      lastUpdated: new Date()
    });
  }

  /**
   * Sync the mealPlanning.weeklyUsed counter to the actual number of meal plan
   * entries in the current week and future weeks. Past entries are excluded so they
   * never count against the user's quota.
   */
  static async syncMealPlanCount(user: User, actualCurrentFutureCount: number): Promise<void> {
    if (!user?.id) return;
    UsageService.limitsCache.delete(user.id);
    const usageRef = DatabaseMonitoringService.doc('users/' + user.id + '/usage/limits');
    await DatabaseMonitoringService.updateDoc(usageRef, {
      'mealPlanning.weeklyUsed': Math.max(0, actualCurrentFutureCount),
      lastUpdated: new Date()
    });
  }

  static async recordMealPlanAddition(user: User): Promise<void> {
    if (!user?.id) return;
    UsageService.limitsCache.delete(user.id);
    const usageRef = DatabaseMonitoringService.doc('users/' + user.id + '/usage/limits');
    await DatabaseMonitoringService.updateDoc(usageRef, {
      'mealPlanning.weeklyUsed': increment(1),
      lastUpdated: new Date()
    });
  }

  static async canUseGemini(user: User): Promise<boolean> {
    const limits = await this.getUsageLimits(user);
    return limits.gemini.weekly === -1 || limits.gemini.used < limits.gemini.weekly;
  }

  static async recordGeminiUsage(user: User): Promise<void> {
    if (!user?.id) return;
    UsageService.limitsCache.delete(user.id);
    const usageRef = DatabaseMonitoringService.doc('users/' + user.id + '/usage/limits');
    await DatabaseMonitoringService.updateDoc(usageRef, {
      'gemini.used': increment(1),
      lastUpdated: new Date()
    });
  }

  static async recordHouseholdMemberAdd(userId: string): Promise<void> {
    if (!userId) return;

    // Household member additions don't need usage tracking beyond the limit check
    // The limit is enforced by canAddHouseholdMember based on subscription tier
    // This method exists for consistency and potential future usage tracking
  }

  static async canAddHouseholdMember(userId: string): Promise<boolean> {
    if (!userId) return false;

    // Get user data to check subscription tier
    const userRef = DatabaseMonitoringService.doc('users/' + userId);
    const userDoc = await DatabaseMonitoringService.getDoc(userRef);
    if (!userDoc.exists()) return false;

    const user = userDoc.data() as User;
    log.debug('canAddHouseholdMember - User data', { userId, householdId: user.householdId, subscription: user.subscription }, 'UsageService');

    // Get current household member count
    if (!user.householdId) {
      log.debug('canAddHouseholdMember - No householdId, allowing creation', { userId }, 'UsageService');
      // User doesn't have a household yet, so they can create one
      return true;
    }

    const householdRef = DatabaseMonitoringService.doc('households/' + user.householdId);
    const householdDoc = await DatabaseMonitoringService.getDoc(householdRef);
    const currentMemberCount = householdDoc.exists() ? householdDoc.data().members?.length || 0 : 0;

    // For free users: max 2 members (themselves + 1 family member)
    // For premium: max 3 members
    // For family: max 5 members (user + 4 family members)
    const maxMembers = user.subscription?.tier === 'family' ? 5 :
                      user.subscription?.tier === 'premium' ? 3 : 2;

    const canAdd = currentMemberCount < maxMembers;
    log.debug('canAddHouseholdMember - Result', {
      currentMemberCount,
      maxMembers,
      subscriptionTier: user.subscription?.tier,
      canAdd
    }, 'UsageService');

    return canAdd;
  }

  static async updatePlanLimits(user: User, plan: 'free' | 'premium' | 'family'): Promise<void> {
    if (!user?.id) return;

    const limits = this.buildPlanLimits()[plan];
    const usageRef = DatabaseMonitoringService.doc('users/' + user.id + '/usage/limits');

    await DatabaseMonitoringService.updateDoc(usageRef, {
      'searches.weekly': limits.searches.weekly,
      'recipes.max': limits.recipes.max,
      'mealPlanning.weeklyRecipes': limits.mealPlanning.weeklyRecipes,
      'mealPlanning.twoWeekPlanning': limits.mealPlanning.twoWeekPlanning,
      lastUpdated: new Date()
    });
  }

  private static getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Adjust to Sunday (start of week)
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  static getPlanLimits(): PlanLimits {
    return this.buildPlanLimits();
  }

  static async resetUsage(user: User): Promise<void> {
    if (!user?.id) return;
    UsageService.limitsCache.delete(user.id);
    const planLimits = this.buildPlanLimits()[user.subscription?.tier || 'free'];
    const weekStart = this.getWeekStart(new Date());
    const usageRef = DatabaseMonitoringService.doc('users/' + user.id + '/usage/limits');
    await DatabaseMonitoringService.setDoc(usageRef, {
      searches: { weekly: planLimits.searches.weekly, used: 0, resetDate: weekStart },
      recipes: { max: planLimits.recipes.max, used: 0 },
      mealPlanning: { weeklyRecipes: planLimits.mealPlanning.weeklyRecipes, weeklyUsed: 0, twoWeekPlanning: planLimits.mealPlanning.twoWeekPlanning, resetDate: weekStart },
      gemini: { weekly: planLimits.gemini.weekly, used: 0, resetDate: weekStart },
      lastUpdated: new Date()
    });
  }
}

export { UsageService };
