import React from 'react';
import { Plus } from 'lucide-react';
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

  return (
    <div className="bg-theme-secondary rounded-xl p-6 border border-theme min-h-[400px]">
      <div className="space-y-6">
        {['Breakfast', 'Lunch', 'Dinner'].map((mealType) => {
          const mealTypeKey = mealType.toLowerCase() as 'breakfast' | 'lunch' | 'dinner';
          const effectiveIndex = mealPlan.findIndex(d => d.date === displayPlan[currentDayIndex].date);
          const mealsForType = effectiveIndex >= 0 ? (mealPlan[effectiveIndex]?.[mealTypeKey] || []) : [];

          return (
            <div key={mealType} className="space-y-3">
              <h3 className="text-lg font-semibold text-theme-primary flex items-center gap-2">
                {intl.formatMessage({ id: `mealPlanner.${mealTypeKey}` })}
                <span className="text-sm opacity-60">({mealsForType.length})</span>
              </h3>

              {mealsForType.length === 0 ? (
                <button
                  onClick={() => onOpenMealSearch(mealTypeKey)}
                  data-tutorial="add-recipe-button"
                  className="w-full border-2 border-dashed border-theme/50 rounded-lg p-6 text-center hover:border-[var(--accent-color)] hover:bg-[var(--accent-color)]/5 transition-all"
                >
                  <Plus className="w-8 h-8 mx-auto mb-2 text-theme-secondary opacity-50" />
                  <span className="text-theme-secondary opacity-70">{intl.formatMessage({ id: 'mealPlanner.addRecipe' })}</span>
                </button>
              ) : (
                <div className="space-y-3">
                  {mealsForType.map((meal, mealIndex) => (
                    <div
                      key={meal.id}
                      className="bg-theme-primary/70 border border-theme/40 rounded-xl p-5 hover:bg-theme-primary/85 transition-all shadow-sm"
                    >
                      <div className="mb-4 space-y-2">
                        <span
                          className="block text-[var(--accent-color)] font-semibold text-xl leading-snug cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => onOpenRecipe(meal.recipe)}
                        >
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
                      <div className="grid grid-cols-2 sm:flex gap-2">
                        <button
                          onClick={() => onOpenRecipe(meal.recipe)}
                          className="px-3 py-2 bg-theme-secondary border border-theme rounded-lg hover:bg-theme-primary transition-colors text-sm font-medium"
                          title="View recipe"
                        >
                          👁️ View
                        </button>
                        <button
                          onClick={() => onCooked(meal)}
                          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                          title="Mark as cooked"
                        >
                          ✓ Cooked
                        </button>
                        <button
                          onClick={() => effectiveIndex >= 0 && onSwap(effectiveIndex, mealTypeKey, mealIndex)}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                          title="Swap with leftover"
                        >
                          🍱 Swap
                        </button>
                        <button
                          onClick={() => effectiveIndex >= 0 && onRemove(effectiveIndex, mealTypeKey, mealIndex)}
                          className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                          title="Remove meal"
                        >
                          🗑️ Remove
                        </button>
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
