import React, { useState, useEffect } from 'react';
import { Crown, AlertTriangle, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { UsageService, UsageLimits } from '../services/usageService';
import { User } from '../types';
import { log } from '../services/logService';

interface UsageIndicatorProps {
  user: User | null;
  savedRecipesCount?: number;
  compact?: boolean;
  showUpgradeCTA?: boolean;
  onUpgrade?: () => void;
}

export const UsageIndicator: React.FC<UsageIndicatorProps> = ({
  user,
  savedRecipesCount,
  compact = false,
  showUpgradeCTA = true,
  onUpgrade
}) => {
  const { isPremium, isFamily, subscription } = useSubscription(user);
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchUsageLimits = async () => {
      if (user) {
        try {
          const limits = await UsageService.getUsageLimits(user);
          setUsageLimits(limits);
        } catch (error) {
          log.error('Error fetching usage limits', { error }, 'UsageIndicator');
        }
      }
      setLoading(false);
    };

    fetchUsageLimits();
  }, [user, savedRecipesCount]);

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

  // Prefer the real-time prop count (passed from context) over the Firestore counter
  // which never decrements on recipe deletion and can drift out of sync.
  const recipesUsed = savedRecipesCount ?? usageLimits.recipes.used;

  const recipesPercentage = getUsagePercentage(recipesUsed, usageLimits.recipes.max);
  const searchesPercentage = getUsagePercentage(usageLimits.searches.used, usageLimits.searches.weekly);
  const mealPlanPercentage = getUsagePercentage(usageLimits.mealPlanning.weeklyUsed, usageLimits.mealPlanning.weeklyRecipes);

  const recipesStatus = getUsageStatus(recipesUsed, usageLimits.recipes.max);
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
          Recipes: {recipesUsed}/{usageLimits.recipes.max === -1 ? '∞' : usageLimits.recipes.max}
        </span>
        <span className="text-theme-secondary">•</span>
        <span className="text-theme-secondary">
          Searches: {usageLimits.searches.used}/{usageLimits.searches.weekly === -1 ? '∞' : usageLimits.searches.weekly}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-300 dark:border-blue-700 overflow-hidden mb-3">
      {/* Collapsed header — always visible */}
      <div
        role="button"
        onClick={() => setIsExpanded(prev => !prev)}
        className="flex items-center justify-between px-4 py-2.5 bg-blue-500 dark:bg-blue-600 text-white cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          {isExpanded
            ? <ChevronDown className="w-4 h-4 flex-shrink-0" />
            : <ChevronRight className="w-4 h-4 flex-shrink-0" />
          }
          <TrendingUp className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-semibold">Free Plan</span>
          {hasWarnings && <AlertTriangle className="w-3.5 h-3.5 text-yellow-300 flex-shrink-0" />}
          {subscription?.status === 'trialing' && (
            <span className="text-xs bg-green-400/30 text-green-100 px-1.5 py-0.5 rounded-full">Trial</span>
          )}
        </div>
        {showUpgradeCTA && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onUpgrade?.(); }}
            className="flex items-center gap-1 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-gray-900 text-xs font-bold px-3 py-1 rounded-lg transition-colors"
          >
            <Crown className="w-3.5 h-3.5" />
            Upgrade
          </button>
        )}
      </div>

      {/* Expanded detail panel */}
      {isExpanded && (
        <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-3 space-y-3 border-t border-blue-200 dark:border-blue-700">
          {/* Recipes Usage */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-gray-600 dark:text-gray-400">Saved Recipes</span>
              <span className="text-xs font-medium text-gray-900 dark:text-white">
                {recipesUsed} / {usageLimits.recipes.max === -1 ? '∞' : usageLimits.recipes.max}
              </span>
            </div>
            {usageLimits.recipes.max !== -1 && (
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(recipesPercentage)}`}
                  style={{ width: `${recipesPercentage}%` }}
                />
              </div>
            )}
            {recipesStatus === 'exceeded' && (
              <p className="text-xs text-red-500 mt-1">⚠️ Recipe limit reached — upgrade to save more</p>
            )}
          </div>

          {/* Weekly Searches */}
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
                />
              </div>
            )}
            {searchesStatus === 'exceeded' && (
              <p className="text-xs text-red-500 mt-1">⚠️ Weekly search limit reached — upgrade for more</p>
            )}
          </div>

          {/* Meal Plans */}
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
                />
              </div>
            )}
            {mealPlanStatus === 'exceeded' && (
              <p className="text-xs text-red-500 mt-1">⚠️ Meal plan limit reached — upgrade to add more</p>
            )}
          </div>

          {/* Upgrade note */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-2.5 text-xs">
            <p className="text-amber-800 dark:text-amber-200 font-medium mb-1">🔓 Unlock more with Premium or Family</p>
            <ul className="text-amber-700 dark:text-amber-300 space-y-0.5">
              <li>• Unlimited searches, recipe saves &amp; meal plans</li>
              <li>• Unlimited AI scans &amp; custom categories</li>
              <li>• Full grocery cost estimates + 2-week planner</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};