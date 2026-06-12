import React from 'react';
import { Gauge } from 'lucide-react';
import type { UsageLimits } from '../../services/usageService';

interface SettingsUsageLimitsSectionProps {
  userExists: boolean;
  title: string;
  isPremium: boolean;
  isFamily: boolean;
  usageLimits: UsageLimits | null;
  onOpenUpgrade: () => void;
}

export const SettingsUsageLimitsSection: React.FC<SettingsUsageLimitsSectionProps> = ({
  userExists, title, isPremium, isFamily, usageLimits, onOpenUpgrade, }) => {
  if (!userExists) {
    return null;
  }

  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden" data-section="usage-limits">
      <div className="w-full flex items-center justify-between p-4 border-b border-theme bg-theme-primary/20">
        <div className="flex items-center gap-3">
          
          <Gauge className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">{title}</h3>
        </div>
        {!isPremium && !isFamily && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Free Plan</span>}
      </div>
      <div className="p-4 space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-theme-primary border border-theme">
            <span className="text-lg" aria-hidden="true">
              {isFamily ? '👨‍👩‍👧‍👦' : isPremium ? '⭐' : '🆓'}
            </span>
            <div>
              <p className="text-xs text-theme-secondary uppercase tracking-wide font-semibold">Current Plan</p>
              <p className="text-sm font-bold text-theme-primary">{isFamily ? 'Family' : isPremium ? 'Premium' : 'Free'}</p>
            </div>
            {!isPremium && !isFamily && (
              <button onClick={onOpenUpgrade} className="ml-auto text-xs text-[var(--accent-color)] font-semibold hover:underline">
                Upgrade →
              </button>
            )}
          </div>
          {usageLimits ? (
            <>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-theme-secondary">AI Scans (weekly)</span>
                    <span
                      className={`text-sm font-semibold ${
                        usageLimits.gemini.weekly !== -1 && usageLimits.gemini.used >= usageLimits.gemini.weekly ? 'text-red-500' : 'text-theme-primary'
                      }`}
                    >
                      {usageLimits.gemini.used} / {usageLimits.gemini.weekly === -1 ? '∞' : usageLimits.gemini.weekly}
                    </span>
                  </div>
                  {usageLimits.gemini.weekly !== -1 && (
                    <div className="w-full bg-theme-primary/20 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${
                          usageLimits.gemini.used >= usageLimits.gemini.weekly ? 'bg-red-500' : 'bg-[var(--accent-color)]'
                        }`}
                        style={{ width: `${Math.min(100, (usageLimits.gemini.used / usageLimits.gemini.weekly) * 100)}%` }}
                      />
                    </div>
                  )}
                  {usageLimits.gemini.weekly !== -1 && usageLimits.gemini.used >= usageLimits.gemini.weekly && (
                    <p className="text-xs text-red-500 mt-1">⚠️ Weekly limit reached — upgrade to continue scanning</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-theme-secondary">Saved Recipes</span>
                    <span
                      className={`text-sm font-semibold ${
                        usageLimits.recipes.max !== -1 && usageLimits.recipes.used >= usageLimits.recipes.max ? 'text-red-500' : 'text-theme-primary'
                      }`}
                    >
                      {usageLimits.recipes.used} / {usageLimits.recipes.max === -1 ? '∞' : usageLimits.recipes.max}
                    </span>
                  </div>
                  {usageLimits.recipes.max !== -1 && (
                    <div className="w-full bg-theme-primary/20 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${
                          usageLimits.recipes.used >= usageLimits.recipes.max ? 'bg-red-500' : 'bg-[var(--accent-color)]'
                        }`}
                        style={{ width: `${Math.min(100, (usageLimits.recipes.used / usageLimits.recipes.max) * 100)}%` }}
                      />
                    </div>
                  )}
                  {usageLimits.recipes.max !== -1 && usageLimits.recipes.used >= usageLimits.recipes.max && (
                    <p className="text-xs text-red-500 mt-1">⚠️ Recipe limit reached — upgrade to save more</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-theme-secondary">Meal Plan Additions (weekly)</span>
                    <span
                      className={`text-sm font-semibold ${
                        usageLimits.mealPlanning.weeklyRecipes !== -1 && usageLimits.mealPlanning.weeklyUsed >= usageLimits.mealPlanning.weeklyRecipes
                          ? 'text-red-500'
                          : 'text-theme-primary'
                      }`}
                    >
                      {usageLimits.mealPlanning.weeklyUsed} / {usageLimits.mealPlanning.weeklyRecipes === -1 ? '∞' : usageLimits.mealPlanning.weeklyRecipes}
                    </span>
                  </div>
                  {usageLimits.mealPlanning.weeklyRecipes !== -1 && (
                    <div className="w-full bg-theme-primary/20 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${
                          usageLimits.mealPlanning.weeklyUsed >= usageLimits.mealPlanning.weeklyRecipes ? 'bg-red-500' : 'bg-[var(--accent-color)]'
                        }`}
                        style={{ width: `${Math.min(100, (usageLimits.mealPlanning.weeklyUsed / usageLimits.mealPlanning.weeklyRecipes) * 100)}%` }}
                      />
                    </div>
                  )}
                  {usageLimits.mealPlanning.weeklyRecipes !== -1 && usageLimits.mealPlanning.weeklyUsed >= usageLimits.mealPlanning.weeklyRecipes && (
                    <p className="text-xs text-red-500 mt-1">⚠️ Weekly meal plan limit reached — upgrade to add more</p>
                  )}
                </div>

                {!isPremium && !isFamily && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-theme-secondary">Custom Categories</span>
                    <span className="text-sm font-semibold text-theme-primary">Free: 1 category max</span>
                  </div>
                )}

                {!isPremium && !isFamily && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-theme-secondary">Grocery Cost Estimator</span>
                    <span className="text-sm font-semibold text-theme-primary">Free: 5 ingredients shown</span>
                  </div>
                )}

                {!isPremium && !isFamily && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-theme-secondary">Meal Plan View</span>
                    <span className="text-sm font-semibold text-theme-primary">Free: current week only</span>
                  </div>
                )}
              </div>

              {!isPremium && !isFamily && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                  <p className="text-amber-800 font-medium mb-1">🔓 Unlock more with Premium or Family</p>
                  <ul className="text-amber-700 text-xs space-y-0.5">
                    <li>• Unlimited AI scans, recipe saves &amp; meal plan entries</li>
                    <li>• Unlimited custom categories</li>
                    <li>• Full grocery cost estimates</li>
                    <li>• Monthly meal plan view</li>
                  </ul>
                  <p className="text-amber-600 text-xs mt-2">Upgrade via Settings → More → Subscription</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-theme-secondary opacity-60">Loading usage data…</p>
          )}
        </div>
    </div>
  );
};
