import { Capacitor } from '@capacitor/core';
import { User } from '../types';
import { UsageService } from '../services/usageService';
import remoteConfig from '../services/remoteConfigService';

/**
 * Decide whether ads should be shown to a given user.
 * Current policy: only show ads on native platforms for users on the `free` tier
 * and only while they remain under at least one of their free-tier usage limits
 * (saved recipes, weekly meal-plan recipe additions, or weekly recipe searches).
 * Returns a Promise<boolean>.
 */
export async function canShowAds(user?: User | null): Promise<boolean> {
  try {
    if (!user) return false;
    if (!remoteConfig.getBoolean('ads_enabled')) return false;
    if (remoteConfig.getBoolean('kill_ads')) return false;
    // Don't show ads on web
    if (Capacitor.getPlatform() === 'web') return false;

    const limits = await UsageService.getUsageLimits(user);

    // Don't show ads to paid users (includes household-elevated members)
    if (limits.resolvedTier !== 'free') return false;

    const underRecipeLimit = limits.recipes.max === -1 || (limits.recipes.used < limits.recipes.max);
    const underMealPlanLimit = limits.mealPlanning.weeklyRecipes === -1 || (limits.mealPlanning.weeklyUsed < limits.mealPlanning.weeklyRecipes);
    const underSearchLimit = limits.searches.weekly === -1 || (limits.searches.used < limits.searches.weekly);

    // Show ads when user is within at least one of the usage limits
    return underRecipeLimit || underMealPlanLimit || underSearchLimit;
  } catch {
    // Conservative fallback: show ads for free users if limit check fails
    try {
      if (!user) return false;
      if (!remoteConfig.getBoolean('ads_enabled')) return false;
      if (remoteConfig.getBoolean('kill_ads')) return false;
      return user.subscription?.tier === 'free';
    } catch {
      return false;
    }
  }
}
