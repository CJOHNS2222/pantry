import DatabaseMonitoringService from './databaseMonitoringService';
import { increment, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { User } from '../types';
import { log } from './logService';

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
  private static toDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (value && typeof value.toDate === 'function') return value.toDate();
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

  private static readonly PLAN_LIMITS: PlanLimits = {
    free: {
      searches: { weekly: 5 },
      recipes: { max: 10 },
      mealPlanning: { weeklyRecipes: 3, twoWeekPlanning: false },
      gemini: { weekly: 5 }
    },
    premium: {
      searches: { weekly: 15 },
      recipes: { max: 20 },
      mealPlanning: { weeklyRecipes: -1, twoWeekPlanning: false }, // 7-day planning with unlimited entries
      gemini: { weekly: 15 }
    },
    family: {
      searches: { weekly: -1 }, // unlimited searches
      recipes: { max: -1 }, // unlimited saved recipes
      mealPlanning: { weeklyRecipes: -1, twoWeekPlanning: true }, // 2-week planning with unlimited entries
      gemini: { weekly: -1 } // unlimited Gemini usage
    }
  };

  static async getUsageLimits(user: User): Promise<UsageLimits> {
    if (!user?.id) {
      throw new Error('User required for usage tracking');
    }

    // Determine user's plan tier
    const planTier = user.subscription?.tier || 'free';
    const planLimits = this.PLAN_LIMITS[planTier];

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
        }
      };

      await DatabaseMonitoringService.setDoc(usageRef, {
        ...initialUsage,
        searches: { ...initialUsage.searches, resetDate: weekStart },
        mealPlanning: { ...initialUsage.mealPlanning, resetDate: weekStart },
        lastUpdated: now
      });

      return initialUsage;
    }

    const data = usageDoc.data() as any;

    // Get the earliest reset date from all weekly limits, or use weekStart if none exist
    const searchResetDate = this.toDate(data.searches?.resetDate);
    const mealPlanningResetDate = this.toDate(data.mealPlanning?.resetDate);
    const geminiResetDate = this.toDate(data.gemini?.resetDate);

    const earliestResetDate = [searchResetDate, mealPlanningResetDate, geminiResetDate]
      .filter(date => date instanceof Date)
      .sort((a, b) => a.getTime() - b.getTime())[0] || weekStart;

    // Reset weekly counters if the earliest reset date is in the past
    if (now > earliestResetDate) {
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

    return {
      searches: {
        weekly: planLimits.searches.weekly,
        used: data.searches?.used || 0,
        resetDate: this.toDate(data.searches?.resetDate) || weekStart
      },
      recipes: {
        max: planLimits.recipes.max,
        used: data.recipes?.used || 0
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
      }
    };
  }

  static async canPerformSearch(user: User): Promise<boolean> {
    const limits = await this.getUsageLimits(user);
    return limits.searches.weekly === -1 || limits.searches.used < limits.searches.weekly;
  }

  static async recordSearch(user: User): Promise<void> {
    if (!user?.id) return;

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

  static async recordRecipeSave(user: User): Promise<void> {
    if (!user?.id) return;

    const usageRef = DatabaseMonitoringService.doc('users/' + user.id + '/usage/limits');
    await DatabaseMonitoringService.updateDoc(usageRef, {
      'recipes.used': increment(1),
      lastUpdated: new Date()
    });
  }

  static async recordMealPlanAddition(user: User): Promise<void> {
    if (!user?.id) return;

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

    // For free users: max 1 member (themselves)
    // For premium: max 3 members
    // For family: max 5 members (user + 4 family members)
    const maxMembers = user.subscription?.tier === 'family' ? 5 :
                      user.subscription?.tier === 'premium' ? 3 : 1;

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

    const limits = this.PLAN_LIMITS[plan];
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
    return this.PLAN_LIMITS;
  }
}

export { UsageService };