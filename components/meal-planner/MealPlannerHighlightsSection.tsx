import React from 'react';
import { CalendarClock, ChevronDown, ChevronRight, ShoppingBasket } from 'lucide-react';
import { MealPlanItem, StructuredRecipe } from '../../types';

interface MealPrepSuggestion {
  recipe: StructuredRecipe;
  canMake: boolean;
  availableIngredients: number;
  totalIngredients: number;
  matchPercentage: number;
  missingIngredients: Array<{ ingredient: string; available: boolean }>;
}

interface MealPlannerHighlightsSectionProps {
  todaysMeals: MealPlanItem[];
  todaysMealsExpanded: boolean;
  onToggleTodaysMeals: () => void;
  onOpenScheduledMeal: (meal: MealPlanItem) => void;
  mealPrepSuggestions: MealPrepSuggestion[];
  onViewSuggestionRecipe: (suggestion: MealPrepSuggestion) => void;
  onAddSuggestionMissingIngredients: (suggestion: MealPrepSuggestion) => void;
  onViewAllSuggestions: () => void;
}

export const MealPlannerHighlightsSection: React.FC<MealPlannerHighlightsSectionProps> = ({
  todaysMeals,
  todaysMealsExpanded,
  onToggleTodaysMeals,
  onOpenScheduledMeal,
  mealPrepSuggestions,
  onViewSuggestionRecipe,
  onAddSuggestionMissingIngredients,
  onViewAllSuggestions
}) => {
  return (
    <>
      {todaysMeals.length > 0 && (
        <div className="bg-gradient-to-r from-[var(--accent-color)]/10 to-[var(--accent-color)]/5 border border-[var(--accent-color)]/20 rounded-xl p-4 mb-4">
          <div
            onClick={() => todaysMeals.length > 1 && onToggleTodaysMeals()}
            className={`flex items-center gap-2 mb-3 ${todaysMeals.length > 1 ? 'cursor-pointer' : ''}`}
          >
            <CalendarClock className="w-5 h-5 text-[var(--accent-color)]" />
            <h3 className="font-semibold text-theme-primary">Today's Meals</h3>
            {todaysMeals.length > 1 && (
              <span className="text-xs bg-[var(--accent-color)]/20 text-[var(--accent-color)] px-2 py-1 rounded-full ml-auto">
                {todaysMeals.length} meals
              </span>
            )}
            {todaysMeals.length > 1 && (
              todaysMealsExpanded ? (
                <ChevronDown className="w-4 h-4 text-theme-secondary ml-2" />
              ) : (
                <ChevronRight className="w-4 h-4 text-theme-secondary ml-2" />
              )
            )}
          </div>
          {todaysMealsExpanded && (
            <div className="space-y-2">
              {todaysMeals.map((meal) => (
                <div
                  key={meal.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenScheduledMeal(meal);
                  }}
                  className="bg-theme-secondary/80 backdrop-blur-sm border border-[var(--accent-color)]/30 rounded-lg p-4 cursor-pointer hover:bg-theme-secondary transition-all hover:shadow-md w-full"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-[var(--accent-color)] mb-1 uppercase">
                        {meal.mealType ? (meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1)) : 'Meal'}
                      </div>
                      <div className="text-sm font-medium text-theme-primary">
                        {meal.recipe.title}
                      </div>
                    </div>
                    <div className="text-xs text-theme-secondary opacity-60 ml-4 flex-shrink-0">
                      Click to view recipe
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {mealPrepSuggestions.length > 0 && (
        <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingBasket className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-theme-primary">Meal Prep Suggestions</h3>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
              {mealPrepSuggestions.length} recipes
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {mealPrepSuggestions.slice(0, 6).map((suggestion, index) => (
              <div
                key={index}
                className="bg-theme-secondary/80 backdrop-blur-sm border border-green-500/30 rounded-lg p-3 cursor-pointer hover:bg-theme-secondary transition-all hover:shadow-md"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-semibold text-theme-primary truncate flex-1">
                    {suggestion.recipe.title}
                  </h4>
                  {suggestion.canMake && (
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full ml-2 flex-shrink-0">
                      Ready!
                    </span>
                  )}
                </div>

                <div className="text-xs text-theme-secondary mb-2">
                  {suggestion.availableIngredients}/{suggestion.totalIngredients} ingredients available
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewSuggestionRecipe(suggestion);
                    }}
                    className="flex-1 text-xs bg-[var(--accent-color)] text-white px-2 py-1 rounded hover:bg-[var(--accent-color)]/90 transition-colors"
                  >
                    View Recipe
                  </button>
                  {suggestion.missingIngredients.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddSuggestionMissingIngredients(suggestion);
                      }}
                      className="text-xs bg-theme-secondary border border-theme px-2 py-1 rounded hover:bg-theme-primary transition-colors"
                      title={`Add ${suggestion.missingIngredients.length} missing ingredients to shopping list`}
                    >
                      +{suggestion.missingIngredients.length}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {mealPrepSuggestions.length > 6 && (
            <div className="text-center mt-3">
              <button
                onClick={onViewAllSuggestions}
                className="text-sm text-[var(--accent-color)] hover:underline"
              >
                View all {mealPrepSuggestions.length} suggestions →
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};
