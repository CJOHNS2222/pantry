import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { User } from '../types';

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
}

export interface PlanLimits {
  free: {
    searches: { weekly: number };
    recipes: { max: number };
    mealPlanning: { weeklyRecipes: number; twoWeekPlanning: boolean };
  };
  premium: {
    searches: { weekly: number };
    recipes: { max: number };
    mealPlanning: { weeklyRecipes: number; twoWeekPlanning: boolean };
  };
  family: {
    searches: { weekly: number };
    recipes: { max: number };
    mealPlanning: { weeklyRecipes: number; twoWeekPlanning: boolean };
  };
}

class UsageService {
  private static readonly PLAN_LIMITS: PlanLimits = {
    free: {
      searches: { weekly: 5 },
      recipes: { max: 10 },
      mealPlanning: { weeklyRecipes: 3, twoWeekPlanning: false }
    },
    premium: {
      searches: { weekly: 15 },
      recipes: { max: 20 },
      mealPlanning: { weeklyRecipes: -1, twoWeekPlanning: false } // 7-day planning with unlimited entries
    },
    family: {
      searches: { weekly: -1 }, // unlimited searches
      recipes: { max: -1 }, // unlimited saved recipes
      mealPlanning: { weeklyRecipes: -1, twoWeekPlanning: true } // 2-week planning with unlimited entries
    }
  };

  static async getUsageLimits(user: User): Promise<UsageLimits> {
    if (!user?.id) {
      throw new Error('User required for usage tracking');
    }

    // Determine user's plan tier
    const planTier = user.subscription?.tier || 'free';
    const planLimits = this.PLAN_LIMITS[planTier];

    const usageRef = doc(db, 'users', user.id, 'usage', 'limits');
    const usageDoc = await getDoc(usageRef);

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
        }
      };

      await setDoc(usageRef, {
        ...initialUsage,
        searches: { ...initialUsage.searches, resetDate: weekStart },
        mealPlanning: { ...initialUsage.mealPlanning, resetDate: weekStart },
        lastUpdated: now
      });

      return initialUsage;
    }

    const data = usageDoc.data() as any;
    const resetDate = data.searches?.resetDate?.toDate() || weekStart;

    // Reset weekly counters if week has changed
    if (now > resetDate) {
      await updateDoc(usageRef, {
        'searches.used': 0,
        'searches.resetDate': weekStart,
        'mealPlanning.weeklyUsed': 0,
        'mealPlanning.resetDate': weekStart,
        lastUpdated: now
      });

      data.searches.used = 0;
      data.searches.resetDate = weekStart;
      data.mealPlanning.weeklyUsed = 0;
      data.mealPlanning.resetDate = weekStart;
    }

    return {
      searches: {
        weekly: planLimits.searches.weekly,
        used: data.searches?.used || 0,
        resetDate: resetDate
      },
      recipes: {
        max: planLimits.recipes.max,
        used: data.recipes?.used || 0
      },
      mealPlanning: {
        weeklyRecipes: planLimits.mealPlanning.weeklyRecipes,
        weeklyUsed: data.mealPlanning?.weeklyUsed || 0,
        twoWeekPlanning: planLimits.mealPlanning.twoWeekPlanning,
        resetDate: resetDate
      }
    };
  }

  static async canPerformSearch(user: User): Promise<boolean> {
    const limits = await this.getUsageLimits(user);
    return limits.searches.weekly === -1 || limits.searches.used < limits.searches.weekly;
  }

  static async recordSearch(user: User): Promise<void> {
    if (!user?.id) return;

    const usageRef = doc(db, 'users', user.id, 'usage', 'limits');
    await updateDoc(usageRef, {
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

    const usageRef = doc(db, 'users', user.id, 'usage', 'limits');
    await updateDoc(usageRef, {
      'recipes.used': increment(1),
      lastUpdated: new Date()
    });
  }

  static async recordMealPlanAddition(user: User): Promise<void> {
    if (!user?.id) return;

    const usageRef = doc(db, 'users', user.id, 'usage', 'limits');
    await updateDoc(usageRef, {
      'mealPlanning.weeklyUsed': increment(1),
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
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) return false;
    
    const user = userDoc.data() as User;
    
    // Get current household member count
    const householdRef = doc(db, 'households', user.householdId || '');
    const householdDoc = await getDoc(householdRef);
    const currentMemberCount = householdDoc.exists() ? householdDoc.data().members?.length || 0 : 0;
    
    // For free users: max 1 member (themselves)
    // For premium: max 3 members
    // For family: max 5 members (user + 4 family members)
    const maxMembers = user.subscription?.tier === 'family' ? 5 : 
                      user.subscription?.tier === 'premium' ? 3 : 1;
    return currentMemberCount < maxMembers;
  }

  static async updatePlanLimits(user: User, plan: 'free' | 'premium' | 'family'): Promise<void> {
    if (!user?.id) return;

    const limits = this.PLAN_LIMITS[plan];
    const usageRef = doc(db, 'users', user.id, 'usage', 'limits');

    await updateDoc(usageRef, {
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
}

export { UsageService };