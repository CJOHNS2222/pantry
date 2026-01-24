import React, { useState, useEffect } from 'react';
import { Crown, AlertTriangle, TrendingUp } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { UsageService, UsageLimits } from '../services/usageService';
import { User } from '../types';

interface UsageIndicatorProps {
  user: User | null;
  compact?: boolean;
  showUpgradeCTA?: boolean;
  onUpgrade?: () => void;
}

export const UsageIndicator: React.FC<UsageIndicatorProps> = ({
  user,
  compact = false,
  showUpgradeCTA = true,
  onUpgrade
}) => {
  const { isPremium, isFamily, subscription } = useSubscription(user);
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsageLimits = async () => {
      if (user) {
        try {
          const limits = await UsageService.getUsageLimits(user);
          setUsageLimits(limits);
        } catch (error) {
          console.error('Error fetching usage limits:', error);
        }
      }
      setLoading(false);
    };

    fetchUsageLimits();
  }, [user]);

  if (loading || !user || !usageLimits) {
    return null;
  }

  // Don't show for premium/family users unless they have usage data
  if ((isPremium || isFamily) && !compact) {
    return null;
  }

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getUsageStatus = (used: number, limit: number) => {
    if (limit === -1) return 'unlimited';
    if (used >= limit) return 'exceeded';
    if (used >= limit * 0.9) return 'critical';
    if (used >= limit * 0.75) return 'warning';
    return 'normal';
  };

  const recipesPercentage = getUsagePercentage(usageLimits.recipes.used, usageLimits.recipes.max);
  const searchesPercentage = getUsagePercentage(usageLimits.searches.used, usageLimits.searches.weekly);
  const mealPlanPercentage = getUsagePercentage(usageLimits.mealPlanning.weeklyUsed, usageLimits.mealPlanning.weeklyRecipes);

  const recipesStatus = getUsageStatus(usageLimits.recipes.used, usageLimits.recipes.max);
  const searchesStatus = getUsageStatus(usageLimits.searches.used, usageLimits.searches.weekly);
  const mealPlanStatus = getUsageStatus(usageLimits.mealPlanning.weeklyUsed, usageLimits.mealPlanning.weeklyRecipes);

  const hasWarnings = [recipesStatus, searchesStatus, mealPlanStatus].some(status =>
    status === 'warning' || status === 'critical' || status === 'exceeded'
  );

  if (compact) {
    // Compact version for header/status bar
    return (
      <div className="flex items-center gap-2 text-xs">
        {hasWarnings && <AlertTriangle className="w-3 h-3 text-yellow-500" />}
        <span className="text-theme-secondary">
          Recipes: {usageLimits.recipes.used}/{usageLimits.recipes.max === -1 ? '∞' : usageLimits.recipes.max}
        </span>
        <span className="text-theme-secondary">•</span>
        <span className="text-theme-secondary">
          Searches: {usageLimits.searches.used}/{usageLimits.searches.weekly === -1 ? '∞' : usageLimits.searches.weekly}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-blue-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Usage Overview</h3>
        {subscription?.status === 'trialing' && (
          <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs px-2 py-1 rounded-full font-medium">
            Trial Active
          </span>
        )}
      </div>

      <div className="space-y-3">
        {/* Recipes Usage */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-600 dark:text-gray-400">Saved Recipes</span>
            <span className="text-xs font-medium text-gray-900 dark:text-white">
              {usageLimits.recipes.used} / {usageLimits.recipes.max === -1 ? '∞' : usageLimits.recipes.max}
            </span>
          </div>
          {usageLimits.recipes.max !== -1 && (
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(recipesPercentage)}`}
                style={{ width: `${recipesPercentage}%` }}
              ></div>
            </div>
          )}
        </div>

        {/* Searches Usage */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-600 dark:text-gray-400">Weekly Searches</span>
            <span className="text-xs font-medium text-gray-900 dark:text-white">
              {usageLimits.searches.used} / {usageLimits.searches.weekly === -1 ? '∞' : usageLimits.searches.weekly}
            </span>
          </div>
          {usageLimits.searches.weekly !== -1 && (
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(searchesPercentage)}`}
                style={{ width: `${searchesPercentage}%` }}
              ></div>
            </div>
          )}
        </div>

        {/* Meal Planning Usage */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-600 dark:text-gray-400">Weekly Meal Plans</span>
            <span className="text-xs font-medium text-gray-900 dark:text-white">
              {usageLimits.mealPlanning.weeklyUsed} / {usageLimits.mealPlanning.weeklyRecipes === -1 ? '∞' : usageLimits.mealPlanning.weeklyRecipes}
            </span>
          </div>
          {usageLimits.mealPlanning.weeklyRecipes !== -1 && (
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(mealPlanPercentage)}`}
                style={{ width: `${mealPlanPercentage}%` }}
              ></div>
            </div>
          )}
        </div>
      </div>

      {/* Warning Messages */}
      {hasWarnings && (
        <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-yellow-800 dark:text-yellow-200">
              {recipesStatus === 'exceeded' && "You've reached your recipe limit. "}
              {searchesStatus === 'exceeded' && "You've used all weekly searches. "}
              {mealPlanStatus === 'exceeded' && "You've reached your meal planning limit. "}
              {(recipesStatus === 'critical' || searchesStatus === 'critical' || mealPlanStatus === 'critical') &&
                "You're approaching your limits. "}
              {(recipesStatus === 'warning' || searchesStatus === 'warning' || mealPlanStatus === 'warning') &&
                "Consider upgrading for more features. "}
              Upgrade to Premium for higher limits!
            </div>
          </div>
        </div>
      )}

      {/* Trial Status */}
      {subscription?.status === 'trialing' && (
        <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-green-800 dark:text-green-200">
            <Crown className="w-4 h-4" />
            <span>🎉 Enjoy unlimited access during your trial!</span>
          </div>
        </div>
      )}

      {/* Upgrade CTA */}
      {showUpgradeCTA && !isPremium && !isFamily && (
        <button
          onClick={onUpgrade}
          className="w-full mt-3 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
        >
          <Crown className="w-4 h-4" />
          Upgrade to Premium
        </button>
      )}
    </div>
  );
};