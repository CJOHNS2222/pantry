import React, { useState, useMemo } from 'react';
import { Clock, Users, ChefHat, CheckCircle, Zap } from 'lucide-react';
import { StructuredRecipe, SavedRecipe, PantryItem } from '../types';

interface MealPrepPlannerProps {
  savedRecipes: SavedRecipe[];
  inventory: PantryItem[];
  onAddToPlan: (recipe: StructuredRecipe) => void;
  onClose: () => void;
}

interface MealPrepPlan {
  recipes: SavedRecipe[];
  sharedIngredients: string[];
  totalCookTime: number;
  totalPrepTime: number;
  servings: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export const MealPrepPlanner: React.FC<MealPrepPlannerProps> = ({
  savedRecipes,
  inventory: _inventory,
  onAddToPlan,
  onClose
}) => {
  const [selectedRecipes, setSelectedRecipes] = useState<SavedRecipe[]>([]);
  const [planDuration, setPlanDuration] = useState<3 | 5 | 7>(5); // days

  const parseTimeToMinutes = (time: string | number): number => {
    if (typeof time === 'number') return time;
    const timeStr = (time || '').toString();
    if (!timeStr) return 30;
    const match = timeStr.match(/(\d+)\s*(min|minute|minutes|hour|hr|h)/i);
    if (!match) return 30;
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    return unit.includes('h') ? value * 60 : value;
  };

  // Calculate ingredient overlap between recipes
  const calculateIngredientOverlap = (recipe1: SavedRecipe, recipe2: SavedRecipe): string[] => {
    const ingredients1 = (recipe1.ingredients || []).map(ing => (ing || '').toLowerCase());
    const ingredients2 = (recipe2.ingredients || []).map(ing => (ing || '').toLowerCase());

    return ingredients1.filter(ing1 =>
      ingredients2.some(ing2 =>
        ing1.includes(ing2.split(' ')[0]) || ing2.includes(ing1.split(' ')[0])
      )
    );
  };

  // Calculate cross-recipe shared ingredients for a custom selection
  const calculateMultiRecipeOverlap = (recipes: SavedRecipe[]): string[] => {
    if (recipes.length < 2) return [];
    const allIngredients = recipes.map(r =>
      (r.ingredients || []).map(ing => (ing || '').toLowerCase())
    );
    const base = allIngredients[0];
    return base.filter(ing =>
      allIngredients.slice(1).some(recipeIngs =>
        recipeIngs.some(other =>
          ing.includes(other.split(' ')[0]) || other.includes(ing.split(' ')[0])
        )
      )
    );
  };

  // Generate meal prep suggestions; cap count by planDuration
  const mealPrepSuggestions = useMemo(() => {
    const suggestions: MealPrepPlan[] = [];
    const maxSuggestions = planDuration === 3 ? 3 : planDuration === 5 ? 5 : 7;

    for (let i = 0; i < savedRecipes.length; i++) {
      for (let j = i + 1; j < savedRecipes.length; j++) {
        const recipe1 = savedRecipes[i];
        const recipe2 = savedRecipes[j];
        const sharedIngredients = calculateIngredientOverlap(recipe1, recipe2);

        if (sharedIngredients.length >= 2) {
          const totalCookTime = parseTimeToMinutes(recipe1.cookTime) + parseTimeToMinutes(recipe2.cookTime);
          const difficulty = totalCookTime > 120 ? 'Hard' : totalCookTime > 60 ? 'Medium' : 'Easy';
          const servings = (recipe1.servings || 4) + (recipe2.servings || 4);

          suggestions.push({
            recipes: [recipe1, recipe2],
            sharedIngredients,
            totalCookTime,
            totalPrepTime: Math.round(totalCookTime * 0.3),
            servings,
            difficulty
          });
        }
      }
    }

    return suggestions
      .sort((a, b) => b.sharedIngredients.length - a.sharedIngredients.length)
      .slice(0, maxSuggestions);
  }, [savedRecipes, planDuration]);

  const toggleRecipeSelection = (recipe: SavedRecipe) => {
    setSelectedRecipes(prev =>
      prev.find(r => r.id === recipe.id)
        ? prev.filter(r => r.id !== recipe.id)
        : [...prev, recipe]
    );
  };

  const customPlanShared = useMemo(
    () => calculateMultiRecipeOverlap(selectedRecipes),
    [selectedRecipes]
  );

  const customPlanTotalTime = selectedRecipes.reduce(
    (sum, r) => sum + parseTimeToMinutes(r.cookTime),
    0
  );

  const addPlanToMealPlan = (plan: MealPrepPlan) => {
    plan.recipes.forEach(recipe => {
      onAddToPlan(recipe as StructuredRecipe);
    });
    onClose();
  };

  const addCustomPlanToMealPlan = () => {
    if (selectedRecipes.length === 0) return;
    const plan: MealPrepPlan = {
      recipes: selectedRecipes,
      sharedIngredients: customPlanShared,
      totalCookTime: customPlanTotalTime,
      totalPrepTime: Math.round(customPlanTotalTime * 0.3),
      servings: selectedRecipes.reduce((sum, r) => sum + (r.servings || 4), 0),
      difficulty: selectedRecipes.length > 3 ? 'Hard' : selectedRecipes.length > 2 ? 'Medium' : 'Easy'
    };
    addPlanToMealPlan(plan);
  };

  return (
    // Fixed overlay — z-[9999] ensures it renders above AppHeader (z-20)
    // items-start + pt prevents the modal card from being obscured by the fixed header
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-start justify-center overflow-y-auto p-3 pt-[calc(var(--safe-area-top,0px)+72px)]">
      <div className="bg-theme-primary rounded-xl border border-theme p-5 w-full max-w-2xl mb-6">

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-theme-primary flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-[var(--accent-color)]" />
              Meal Prep Planner
            </h2>
            <p className="text-xs text-theme-secondary mt-0.5">
              Cook multiple meals in one session by sharing ingredient prep
            </p>
          </div>
          <button
            onClick={onClose}
            data-testid="mealprep-close"
            aria-label="Close"
            className="text-theme-secondary hover:text-theme-primary text-xl leading-none ml-3"
          >
            ✕
          </button>
        </div>

        {/* Explainer banner */}
        <div className="bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 rounded-lg p-3 mb-5">
          <p className="text-xs text-theme-primary">
            <span className="font-semibold">How it works:</span> Select recipes that share
            ingredients (onion, garlic, oil…) and cook them together in one session.
            You chop once, wash up once, and fill your fridge for the week.
          </p>
        </div>

        {/* Plan Duration */}
        <div className="mb-5">
          <p className="text-sm font-medium text-theme-primary mb-2">
            How many days are you planning for?
          </p>
          <div className="flex gap-2">
            {([3, 5, 7] as const).map(days => (
              <button
                key={days}
                data-testid={`mealprep-duration-${days}`}
                onClick={() => setPlanDuration(days)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  planDuration === days
                    ? 'bg-[var(--accent-color)] text-white'
                    : 'bg-theme-secondary/20 text-theme-primary hover:bg-theme-secondary/30'
                }`}
              >
                {days} days
              </button>
            ))}
          </div>
          <p className="text-xs text-theme-secondary mt-1.5">
            Showing the best {mealPrepSuggestions.length} batch-cooking{' '}
            {mealPrepSuggestions.length === 1 ? 'session' : 'sessions'} for {planDuration} days
          </p>
        </div>

        {/* Suggested batch sessions */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-theme-primary mb-3 uppercase tracking-wide">
            Suggested Batch Sessions
          </h3>

          {mealPrepSuggestions.length === 0 ? (
            <p className="text-theme-secondary text-sm text-center py-6">
              No matching pairs found — add more recipes to your collection to get suggestions.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {mealPrepSuggestions.map((plan, index) => {
                const savedMins = Math.max(5, Math.round(plan.sharedIngredients.length * 4));
                return (
                  <div key={index} className="border border-theme-secondary/20 rounded-lg p-4">
                    {/* Recipe names */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[var(--accent-color)] uppercase tracking-wide mb-0.5">
                          Cook together
                        </p>
                        <p className="text-sm font-semibold text-theme-primary leading-snug">
                          {plan.recipes[0].title}
                        </p>
                        <p className="text-sm text-theme-secondary leading-snug">
                          + {plan.recipes[1].title}
                        </p>
                      </div>
                      <button
                        onClick={() => addPlanToMealPlan(plan)}
                        data-testid={`mealprep-add-${index}`}
                        className="flex-shrink-0 bg-[var(--accent-color)] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90"
                      >
                        Add to Plan
                      </button>
                    </div>

                    {/* Stats row */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-theme-secondary mb-3">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {plan.totalCookTime} min total
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        ~{plan.servings} servings
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        plan.difficulty === 'Easy'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : plan.difficulty === 'Medium'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {plan.difficulty}
                      </span>
                    </div>

                    {/* Batch prep highlight */}
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200/50 dark:border-green-700/30 rounded-lg p-2.5">
                      <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1 flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5" />
                        Prep once, use in both:
                      </p>
                      <p className="text-xs text-theme-secondary leading-relaxed">
                        {plan.sharedIngredients.slice(0, 5).join(' · ')}
                        {plan.sharedIngredients.length > 5 && ` · +${plan.sharedIngredients.length - 5} more`}
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1.5 font-medium">
                        ✨ Saves ~{savedMins} min of repeated prep
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Custom Plan Builder */}
        <div>
          <h3 className="text-sm font-semibold text-theme-primary mb-1 uppercase tracking-wide">
            Build Your Own Session
          </h3>
          <p className="text-xs text-theme-secondary mb-3">
            Tap the recipes you want to cook together this week
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {savedRecipes.map(recipe => {
              const selected = !!selectedRecipes.find(r => r.id === recipe.id);
              return (
                <button
                  key={recipe.id}
                  data-testid={`mealprep-select-${recipe.id}`}
                  onClick={() => toggleRecipeSelection(recipe)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    selected
                      ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)]'
                      : 'bg-theme-secondary/20 text-theme-primary border-theme-secondary/30 hover:bg-theme-secondary/30'
                  }`}
                >
                  {selected && <CheckCircle className="w-3 h-3" />}
                  {recipe.title}
                </button>
              );
            })}
          </div>

          {selectedRecipes.length >= 2 && (
            <div className="border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/5 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-theme-primary mb-2">
                Your batch session ({selectedRecipes.length} recipes)
              </h4>

              <div className="flex flex-wrap gap-3 text-xs text-theme-secondary mb-3">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {customPlanTotalTime} min total
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  ~{selectedRecipes.reduce((s, r) => s + (r.servings || 4), 0)} servings
                </span>
              </div>

              {customPlanShared.length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200/50 dark:border-green-700/30 rounded p-2.5 mb-3">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" />
                    Shared ingredients to prep together:
                  </p>
                  <p className="text-xs text-theme-secondary">
                    {customPlanShared.slice(0, 8).join(' · ')}
                    {customPlanShared.length > 8 && ` · +${customPlanShared.length - 8} more`}
                  </p>
                </div>
              )}

              <button
                onClick={addCustomPlanToMealPlan}
                data-testid="mealprep-add-to-plan"
                className="w-full bg-[var(--accent-color)] text-white py-2 rounded-lg text-sm font-medium hover:opacity-90"
              >
                Add All to Meal Plan
              </button>
            </div>
          )}

          {selectedRecipes.length === 1 && (
            <p className="text-xs text-theme-secondary text-center py-2">
              Select at least one more recipe to build a batch session
            </p>
          )}
        </div>
      </div>
    </div>
  );
};