import React, { useState, useCallback } from 'react';
import { Plus, MoreVertical, RefreshCw, Shuffle, Trash2 } from 'lucide-react';
import { useIntl } from 'react-intl';
import { DayPlan, MealPlanItem, StructuredRecipe } from '../../types';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';
import { recordCookedToday } from '../../services/cookingStreakService';

interface CurrentDayMealsSectionProps {
  mealPlan: DayPlan[];
  displayPlan: DayPlan[];
  currentDayIndex: number;
  userId?: string;
  onOpenMealSearch: (mealType: 'breakfast' | 'lunch' | 'dinner') => void;
  onOpenRecipe: (recipe: StructuredRecipe) => void;
  onCooked: (meal: MealPlanItem) => void;
  onSwap: (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner', mealIndex: number) => void;
  onRemove: (dayIndex: number, mealType: string, mealIndex: number) => void;
}

export const CurrentDayMealsSection: React.FC<CurrentDayMealsSectionProps> = ({
  mealPlan,
  displayPlan,
  currentDayIndex,
  userId,
  onOpenMealSearch,
  onOpenRecipe,
  onCooked,
  onSwap,
  onRemove
}) => {
  const intl = useIntl();
  const [activeMealMenuId, setActiveMealMenuId] = useState<string | null>(null);
  const [celebratingId, setCelebratingId] = useState<string | null>(null);
  const [streak, setStreak] = useState<number | null>(null);

  const handleCooked = useCallback((meal: MealPlanItem) => {
    setCelebratingId(meal.id);
    onCooked(meal);
    // Sync (localStorage + Firestore) happens off the critical path; the celebration
    // UI doesn't need to wait on it.
    void recordCookedToday(userId).then(setStreak);
    // Reset celebration state after animation completes
    setTimeout(() => {
      setCelebratingId(null);
      setStreak(null);
    }, 1800);
  }, [onCooked, userId]);

  const effectiveIndex = mealPlan.findIndex(d => d.date === displayPlan[currentDayIndex].date);
  const dayPlanItem = effectiveIndex >= 0 ? mealPlan[effectiveIndex] : null;
  const totalMealsCount = dayPlanItem
    ? (dayPlanItem.breakfast?.length || 0) + (dayPlanItem.lunch?.length || 0) + (dayPlanItem.dinner?.length || 0)
    : 0;

  if (totalMealsCount === 0) {
    return (
      <div className="bg-theme-secondary rounded-xl border border-theme p-3">
        <EmptyState
          preset="mealplan"
          size="compact"
          bare
          action={
            <div className="flex flex-wrap gap-2 justify-center mt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onOpenMealSearch('breakfast')}
              >
                🍳 Breakfast
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onOpenMealSearch('lunch')}
              >
                🥪 Lunch
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onOpenMealSearch('dinner')}
              >
                🥩 Dinner
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const CONFETTI_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#f97316'];
  const CONFETTI_COUNT = 12;

  return (
    <>
      {/* CSS-only confetti + streak animations */}
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(80px) rotate(720deg); opacity: 0; }
        }
        @keyframes streak-pop {
          0%   { transform: scale(0.4) translateY(8px); opacity: 0; }
          60%  { transform: scale(1.15) translateY(-4px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .confetti-piece {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 2px;
          animation: confetti-fall 1.2s ease-in forwards;
          pointer-events: none;
        }
        .streak-pop {
          animation: streak-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>

      <div className="bg-theme-secondary rounded-xl p-6 border border-theme min-h-[400px]">
        <div className="space-y-6">
          {['Breakfast', 'Lunch', 'Dinner'].map((mealType) => {
            const mealTypeKey = mealType.toLowerCase() as 'breakfast' | 'lunch' | 'dinner';
            const mealsForType = dayPlanItem ? (dayPlanItem[mealTypeKey] || []) : [];

            return (
              <div key={mealType} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-theme-primary flex items-center gap-2">
                    {intl.formatMessage({ id: `mealPlanner.${mealTypeKey}` })}
                    <span className="text-sm opacity-60">({mealsForType.length})</span>
                  </h3>
                  {mealsForType.length > 0 && (
                    <button
                      onClick={() => onOpenMealSearch(mealTypeKey)}
                      className="p-1 rounded-full hover:bg-[var(--accent-color)]/10 text-[var(--accent-color)] transition-colors"
                      title={`Add another ${mealType}`}
                      aria-label={`Add another ${mealType}`}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {mealsForType.length === 0 ? (
                  <button
                    onClick={() => onOpenMealSearch(mealTypeKey)}
                    className="w-full flex items-center justify-between border border-dashed border-theme/60 rounded-xl p-3 hover:border-[var(--accent-color)] hover:bg-[var(--accent-color)]/5 transition-all text-sm font-medium text-theme-secondary"
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-[var(--accent-color)]" />
                      <span>Add {mealType}</span>
                    </div>
                  </button>
                ) : (
                  <div className="space-y-3">
                    {mealsForType.map((meal, mealIndex) => {
                      const isCelebrating = celebratingId === meal.id;
                      return (
                        <div
                          key={meal.id}
                          onClick={() => onOpenRecipe(meal.recipe)}
                          className="relative bg-theme-primary/70 border border-theme/40 hover:border-[var(--accent-color)]/30 rounded-xl p-5 hover:bg-theme-primary/85 transition-all shadow-sm cursor-pointer overflow-hidden"
                        >
                          {/* Confetti burst on Cooked! */}
                          {isCelebrating && Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
                            <span
                              key={i}
                              className="confetti-piece"
                              style={{
                                left: `${15 + (i / CONFETTI_COUNT) * 70}%`,
                                top: '10%',
                                background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                                animationDelay: `${(i % 4) * 0.07}s`,
                              }}
                            />
                          ))}

                          <div className="space-y-2">
                            <span className="block text-[var(--accent-color)] font-semibold text-xl leading-snug">
                              {meal.recipe.title}
                            </span>
                            <div className="flex flex-wrap gap-2 text-sm">
                              <span className="inline-flex items-center rounded-full bg-theme-secondary px-2.5 py-1 font-medium text-theme-secondary border border-theme/40">
                                {meal.recipe.cookTime}
                              </span>
                              {meal.recipe.servings && (
                                <span className="inline-flex items-center rounded-full bg-theme-secondary px-2.5 py-1 font-medium text-theme-secondary border border-theme/40">
                                  Serves {meal.recipe.servings}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-4 border-t border-theme/40 pt-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCooked(meal);
                                }}
                                disabled={isCelebrating}
                                className={`px-4 py-2 rounded-lg transition-all text-sm font-semibold shadow-sm ${
                                  isCelebrating
                                    ? 'bg-green-500 text-white scale-95 cursor-default'
                                    : 'bg-green-600 text-white hover:bg-green-700'
                                }`}
                                title="Mark as cooked"
                              >
                                {isCelebrating ? '🎉 Cooked!' : '✓ Mark Cooked'}
                              </button>

                              {/* Streak badge — shown when 2+ consecutive days */}
                              {isCelebrating && streak !== null && streak >= 2 && (
                                <span className="streak-pop inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-500 text-xs font-bold">
                                  🔥 {streak}-day streak!
                                </span>
                              )}
                            </div>

                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMealMenuId(activeMealMenuId === meal.id ? null : meal.id);
                                }}
                                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-theme-secondary text-theme-secondary hover:text-theme-primary transition-colors border border-theme/50"
                                title="More actions"
                                aria-label="More actions"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {activeMealMenuId === meal.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-20"
                                    onClick={() => setActiveMealMenuId(null)}
                                  />
                                  <div className="absolute right-0 bottom-full mb-2 w-48 bg-theme-primary border border-theme rounded-xl shadow-xl z-30 overflow-hidden py-1 animate-fade-in">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMealMenuId(null);
                                        if (effectiveIndex >= 0) onSwap(effectiveIndex, mealTypeKey, mealIndex);
                                      }}
                                      className="w-full text-left px-4 py-2.5 hover:bg-theme-secondary text-theme-primary text-sm flex items-center gap-2 transition-colors"
                                    >
                                      <RefreshCw className="w-4 h-4 text-blue-500" />
                                      <span>Swap with leftover</span>
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMealMenuId(null);
                                        if (effectiveIndex >= 0) onRemove(effectiveIndex, mealTypeKey, mealIndex);
                                        onOpenMealSearch(mealTypeKey);
                                      }}
                                      className="w-full text-left px-4 py-2.5 hover:bg-theme-secondary text-theme-primary text-sm flex items-center gap-2 transition-colors"
                                    >
                                      <Shuffle className="w-4 h-4 text-purple-500" />
                                      <span>Swap for another recipe</span>
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMealMenuId(null);
                                        if (effectiveIndex >= 0) onRemove(effectiveIndex, mealTypeKey, mealIndex);
                                      }}
                                      className="w-full text-left px-4 py-2.5 hover:bg-theme-secondary text-red-500 text-sm flex items-center gap-2 transition-colors border-t border-theme/40"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      <span>Remove meal</span>
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};
