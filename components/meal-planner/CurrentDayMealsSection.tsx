import React, { useState } from 'react';
import { Plus, MoreVertical, RefreshCw, Trash2 } from 'lucide-react';
import { useIntl } from 'react-intl';
import { DayPlan, MealPlanItem, StructuredRecipe } from '../../types';

interface CurrentDayMealsSectionProps {
  mealPlan: DayPlan[];
  displayPlan: DayPlan[];
  currentDayIndex: number;
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
  onOpenMealSearch,
  onOpenRecipe,
  onCooked,
  onSwap,
  onRemove
}) => {
  const intl = useIntl();
  const [activeMealMenuId, setActiveMealMenuId] = useState<string | null>(null);

  const effectiveIndex = mealPlan.findIndex(d => d.date === displayPlan[currentDayIndex].date);
  const dayPlanItem = effectiveIndex >= 0 ? mealPlan[effectiveIndex] : null;
  const totalMealsCount = dayPlanItem
    ? (dayPlanItem.breakfast?.length || 0) + (dayPlanItem.lunch?.length || 0) + (dayPlanItem.dinner?.length || 0)
    : 0;

  if (totalMealsCount === 0) {
    return (
      <div className="bg-theme-secondary rounded-xl p-6 border border-theme min-h-[400px] flex items-center justify-center">
        <div className="w-full max-w-md border-2 border-dashed border-theme/50 rounded-2xl p-8 text-center flex flex-col items-center justify-center space-y-4">
          <div className="p-3 bg-[var(--accent-color)]/10 rounded-full text-[var(--accent-color)]">
            <Plus className="w-8 h-8" />
          </div>
          <div>
            <h4 className="font-semibold text-theme-primary text-base">Plan Your Day's Meals</h4>
            <p className="text-sm text-theme-secondary opacity-70 mt-1">No meals planned yet. Choose a meal type to get started:</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            <button
              onClick={() => onOpenMealSearch('breakfast')}
              className="px-4 py-2 bg-theme-secondary hover:bg-theme-primary border border-theme text-theme-primary text-sm font-semibold rounded-xl transition-all hover:border-[var(--accent-color)]"
            >
              🍳 Breakfast
            </button>
            <button
              onClick={() => onOpenMealSearch('lunch')}
              className="px-4 py-2 bg-theme-secondary hover:bg-theme-primary border border-theme text-theme-primary text-sm font-semibold rounded-xl transition-all hover:border-[var(--accent-color)]"
            >
              🥪 Lunch
            </button>
            <button
              onClick={() => onOpenMealSearch('dinner')}
              className="px-4 py-2 bg-theme-secondary hover:bg-theme-primary border border-theme text-theme-primary text-sm font-semibold rounded-xl transition-all hover:border-[var(--accent-color)]"
            >
              🥩 Dinner
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-theme-secondary rounded-xl p-6 border border-theme min-h-[400px]">
      <div className="space-y-6">
        {['Breakfast', 'Lunch', 'Dinner'].map((mealType) => {
          const mealTypeKey = mealType.toLowerCase() as 'breakfast' | 'lunch' | 'dinner';
          const mealsForType = dayPlanItem ? (dayPlanItem[mealTypeKey] || []) : [];

          return (
            <div key={mealType} className="space-y-3">
              <h3 className="text-lg font-semibold text-theme-primary flex items-center gap-2">
                {intl.formatMessage({ id: `mealPlanner.${mealTypeKey}` })}
                <span className="text-sm opacity-60">({mealsForType.length})</span>
              </h3>

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
                  {mealsForType.map((meal, mealIndex) => (
                    <div
                      key={meal.id}
                      onClick={() => onOpenRecipe(meal.recipe)}
                      className="bg-theme-primary/70 border border-theme/40 hover:border-[var(--accent-color)]/30 rounded-xl p-5 hover:bg-theme-primary/85 transition-all shadow-sm cursor-pointer"
                    >
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCooked(meal);
                          }}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold shadow-sm"
                          title="Mark as cooked"
                        >
                          ✓ Mark Cooked
                        </button>

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
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
