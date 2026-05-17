import React, { useState, useMemo } from 'react';
import { Clock, Users, ChefHat, CheckCircle } from 'lucide-react';
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

  // Calculate ingredient overlap between recipes
  const calculateIngredientOverlap = (recipe1: SavedRecipe, recipe2: SavedRecipe): string[] => {
    const ingredients1 = recipe1.ingredients.map(ing => ing.toLowerCase());
    const ingredients2 = recipe2.ingredients.map(ing => ing.toLowerCase());

    return ingredients1.filter(ing1 =>
      ingredients2.some(ing2 =>
        ing1.includes(ing2.split(' ')[0]) || ing2.includes(ing1.split(' ')[0])
      )
    );
  };

  // Generate meal prep suggestions
  const mealPrepSuggestions = useMemo(() => {
    const suggestions: MealPrepPlan[] = [];

    // Find recipes that share ingredients
    for (let i = 0; i < savedRecipes.length; i++) {
      for (let j = i + 1; j < savedRecipes.length; j++) {
        const recipe1 = savedRecipes[i];
        const recipe2 = savedRecipes[j];
        const sharedIngredients = calculateIngredientOverlap(recipe1, recipe2);

        if (sharedIngredients.length >= 2) { // At least 2 shared ingredients
          const totalCookTime = (parseTimeToMinutes(recipe1.cookTime) + parseTimeToMinutes(recipe2.cookTime));
          const difficulty = totalCookTime > 120 ? 'Hard' : totalCookTime > 60 ? 'Medium' : 'Easy';

          suggestions.push({
            recipes: [recipe1, recipe2],
            sharedIngredients,
            totalCookTime,
            totalPrepTime: Math.round(totalCookTime * 0.3), // Estimate prep time
            servings: 8, // Assume 4 servings per recipe
            difficulty
          });
        }
      }
    }

    return suggestions.sort((a, b) => b.sharedIngredients.length - a.sharedIngredients.length);
  }, [savedRecipes]);

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

  const toggleRecipeSelection = (recipe: SavedRecipe) => {
    setSelectedRecipes(prev =>
      prev.find(r => r.id === recipe.id)
        ? prev.filter(r => r.id !== recipe.id)
        : [...prev, recipe]
    );
  };

  const createCustomPlan = () => {
    if (selectedRecipes.length === 0) return;

    const plan: MealPrepPlan = {
      recipes: selectedRecipes,
      sharedIngredients: [], // Could calculate this
      totalCookTime: selectedRecipes.reduce((sum, r) => sum + parseTimeToMinutes(r.cookTime), 0),
      totalPrepTime: Math.round(selectedRecipes.reduce((sum, r) => sum + parseTimeToMinutes(r.cookTime), 0) * 0.3),
      servings: selectedRecipes.length * 4,
      difficulty: selectedRecipes.length > 3 ? 'Hard' : selectedRecipes.length > 2 ? 'Medium' : 'Easy'
    };

    return plan;
  };

  const addPlanToMealPlan = (plan: MealPrepPlan) => {
    // Add all recipes from the plan to the meal plan
    plan.recipes.forEach(recipe => {
      onAddToPlan(recipe as StructuredRecipe);
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-theme-primary rounded-xl border border-theme p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-theme-primary flex items-center gap-2">
              <ChefHat className="w-5 h-5" />
              Smart Meal Prep Planner
            </h2>
            <p className="text-sm text-theme-secondary mt-1">
              Plan efficient cooking sessions with shared ingredients
            </p>
          </div>
          <button
            onClick={onClose}
            data-testid="mealprep-close"
            className="text-theme-secondary hover:text-theme-primary text-xl"
          >
            ✕
          </button>
        </div>

        {/* Plan Duration Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-theme-primary mb-2">
            Plan Duration
          </label>
          <div className="flex gap-2">
            {[3, 5, 7].map(days => (
              <button
                key={days}
                data-testid={`mealprep-duration-${days}`}
                onClick={() => setPlanDuration(days as 3 | 5 | 7)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  planDuration === days
                    ? 'bg-[var(--accent-color)] text-white'
                    : 'bg-theme-secondary/20 text-theme-primary hover:bg-theme-secondary/30'
                }`}
              >
                {days} Days
              </button>
            ))}
          </div>
        </div>

        {/* Suggested Plans */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-theme-primary mb-4">
            Suggested Meal Prep Plans
          </h3>

          {mealPrepSuggestions.length === 0 ? (
            <p className="text-theme-secondary text-center py-8">
              No recipe combinations found. Try adding more recipes to your collection!
            </p>
          ) : (
            <div className="grid gap-4">
              {mealPrepSuggestions.slice(0, 6).map((plan, index) => (
                <div key={index} className="border border-theme-secondary/20 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-theme-primary">
                        {plan.recipes.map(r => r.title).join(' + ')}
                      </h4>
                      <div className="flex items-center gap-4 text-sm text-theme-secondary mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {plan.totalCookTime}min total
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {plan.servings} servings
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          plan.difficulty === 'Easy' ? 'bg-green-100 text-green-800' :
                          plan.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {plan.difficulty}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => addPlanToMealPlan(plan)}
                      data-testid={`mealprep-add-${index}`}
                      className="bg-[var(--accent-color)] text-white px-3 py-1 rounded text-sm hover:bg-opacity-90"
                    >
                      Add to Plan
                    </button>
                  </div>

                  <div className="text-sm">
                    <span className="font-medium text-theme-primary">Shared ingredients: </span>
                    <span className="text-theme-secondary">
                      {plan.sharedIngredients.join(', ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Custom Plan Builder */}
        <div>
          <h3 className="text-lg font-semibold text-theme-primary mb-4">
            Build Custom Meal Prep Plan
          </h3>

          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {savedRecipes.map(recipe => (
                <button
                  key={recipe.id}
                  data-testid={`mealprep-select-${recipe.id}`}
                  onClick={() => toggleRecipeSelection(recipe)}
                  className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                    selectedRecipes.find(r => r.id === recipe.id)
                      ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)]'
                      : 'bg-theme-secondary/20 text-theme-primary border-theme-secondary/20 hover:bg-theme-secondary/30'
                  }`}
                >
                  {selectedRecipes.find(r => r.id === recipe.id) && (
                    <CheckCircle className="w-4 h-4 inline mr-1" />
                  )}
                  {recipe.title}
                </button>
              ))}
            </div>
          </div>

          {selectedRecipes.length > 0 && (
            <div className="border border-theme-secondary/20 rounded-lg p-4">
              <h4 className="font-medium text-theme-primary mb-2">Your Custom Plan</h4>
              <div className="text-sm text-theme-secondary mb-3">
                {selectedRecipes.map(r => r.title).join(', ')}
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-theme-secondary">
                  {selectedRecipes.length} recipes • {selectedRecipes.reduce((sum, r) => sum + parseTimeToMinutes(r.cookTime), 0)}min total
                </div>
                <button
                  onClick={() => addPlanToMealPlan(createCustomPlan()!)}
                  data-testid="mealprep-add-to-plan"
                  className="bg-[var(--accent-color)] text-white px-4 py-2 rounded text-sm hover:bg-opacity-90"
                >
                  Add to Meal Plan
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};