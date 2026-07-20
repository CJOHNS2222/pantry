import React, { useState, useMemo } from 'react';
import { Clock, Users, ChefHat, CheckCircle, Zap, ShoppingCart, AlertTriangle, Plus, X } from 'lucide-react';
import { StructuredRecipe, SavedRecipe, PantryItem } from '../../types';

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
  inventory,
  onAddToPlan,
  onClose
}) => {
  const [selectedRecipes, setSelectedRecipes] = useState<SavedRecipe[]>([]);
  const [planDuration, setPlanDuration] = useState<3 | 5 | 7>(5);
  const [householdSize, setHouseholdSize] = useState(2);
  const [maxCookTime, setMaxCookTime] = useState<number | null>(null); // null = any
  const [onlyMakeable, setOnlyMakeable] = useState(false);
  const [expiringFirst, setExpiringFirst] = useState(false);
  const [customEntries, setCustomEntries] = useState<SavedRecipe[]>([]);
  const [customTitle, setCustomTitle] = useState('');
  const [customIngredients, setCustomIngredients] = useState('');

  /** How many times a recipe needs to be made to feed householdSize people for planDuration days (1 dinner/day). */
  const batchesNeeded = (recipeServings: number) =>
    Math.max(1, Math.ceil((planDuration * householdSize) / Math.max(1, recipeServings)));

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

  // --- Pantry helpers ---
  const pantryNames = useMemo(
    () => inventory.map(i => i.item.toLowerCase()),
    [inventory]
  );

  const expiringNames = useMemo(() => {
    const weekFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;
    return inventory
      .filter(i => i.expirationDate && new Date(i.expirationDate).getTime() <= weekFromNow)
      .map(i => i.item.toLowerCase());
  }, [inventory]);

  const recipeMatchesPantry = (recipe: SavedRecipe): number => {
    const ings = (recipe.ingredients || []).map(i => i.toLowerCase());
    if (ings.length === 0) return 0;
    const matched = ings.filter(ing =>
      pantryNames.some(p => ing.includes(p.split(' ')[0]) || p.includes(ing.split(' ')[0]))
    );
    return matched.length / ings.length;
  };

  const recipeUsesExpiring = (recipe: SavedRecipe): boolean => {
    const ings = (recipe.ingredients || []).map(i => i.toLowerCase());
    return ings.some(ing =>
      expiringNames.some(exp => ing.includes(exp.split(' ')[0]) || exp.includes(ing.split(' ')[0]))
    );
  };

  const planUsesExpiring = (plan: { recipes: SavedRecipe[] }): boolean =>
    plan.recipes.some(r => recipeUsesExpiring(r));

  const planMatchPercentage = (plan: { recipes: SavedRecipe[] }): number => {
    if (plan.recipes.length === 0) return 0;
    return plan.recipes.reduce((sum, r) => sum + recipeMatchesPantry(r), 0) / plan.recipes.length;
  };

  // --- Cross-recipe shared ingredients for a custom selection
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

    let filtered = suggestions.sort((a, b) => b.sharedIngredients.length - a.sharedIngredients.length);

    // Apply user filters
    if (maxCookTime !== null) {
      filtered = filtered.filter(p => p.totalCookTime <= maxCookTime);
    }
    if (onlyMakeable) {
      filtered = filtered.filter(p => planMatchPercentage(p) >= 0.7);
    }
    if (expiringFirst) {
      filtered = filtered.sort((a, b) =>
        (planUsesExpiring(b) ? 1 : 0) - (planUsesExpiring(a) ? 1 : 0)
      );
    }

    return filtered.slice(0, maxSuggestions);
  }, [savedRecipes, planDuration, maxCookTime, onlyMakeable, expiringFirst, pantryNames, expiringNames]);

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

  const handleAddCustom = () => {
    const title = customTitle.trim();
    if (!title) return;
    const ingredients = customIngredients
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
    const entry: SavedRecipe = {
      id: `custom-${Date.now()}`,
      title,
      ingredients,
      description: 'Custom recipe',
      instructions: [],
      cookTime: 30,
      dateSaved: new Date().toISOString()
    };
    setCustomEntries(prev => [...prev, entry]);
    setSelectedRecipes(prev => [...prev, entry]);
    setCustomTitle('');
    setCustomIngredients('');
  };

  const removeCustomEntry = (id: string) => {
    setCustomEntries(prev => prev.filter(e => e.id !== id));
    setSelectedRecipes(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="bg-theme-primary rounded-xl border border-theme p-5 w-full max-w-2xl mx-auto animate-fade-in">

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

        {/* Plan Duration + Household Size */}
        <div className="mb-4 flex gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-theme-primary mb-2">
              Planning for how many days?
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
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-theme-primary mb-2">
              Household size
            </p>
            <div className="flex gap-2">
              {([1, 2, 4, 6] as const).map(n => (
                <button
                  key={n}
                  data-testid={`mealprep-people-${n}`}
                  onClick={() => setHouseholdSize(n)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    householdSize === n
                      ? 'bg-[var(--accent-color)] text-white'
                      : 'bg-theme-secondary/20 text-theme-primary hover:bg-theme-secondary/30'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-5">
          <p className="text-sm font-medium text-theme-primary mb-2">Filters</p>

          {/* Max cook time */}
          <div className="mb-2.5">
            <p className="text-xs text-theme-secondary mb-1.5">Max cook time</p>
            <div className="flex gap-2">
              {([null, 60, 90, 120] as const).map(t => (
                <button
                  key={t ?? 'any'}
                  onClick={() => setMaxCookTime(t)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    maxCookTime === t
                      ? 'bg-[var(--accent-color)] text-white'
                      : 'bg-theme-secondary/20 text-theme-primary hover:bg-theme-secondary/30'
                  }`}
                >
                  {t === null ? 'Any' : t === 60 ? '1 hr' : t === 90 ? '1.5 hr' : '2 hr'}
                </button>
              ))}
            </div>
          </div>

          {/* Quick filter toggles */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setOnlyMakeable(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                onlyMakeable
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-theme-secondary/20 text-theme-primary border-theme-secondary/30 hover:bg-theme-secondary/30'
              }`}
            >
              <ShoppingCart className="w-3 h-3" />
              Can make now
            </button>
            {expiringNames.length > 0 && (
              <button
                onClick={() => setExpiringFirst(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                  expiringFirst
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-theme-secondary/20 text-theme-primary border-theme-secondary/30 hover:bg-theme-secondary/30'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                Use expiring items first
              </button>
            )}
          </div>
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
                const planServings = plan.recipes.reduce((s, r) => s + (r.servings || 4), 0);
                const batches = batchesNeeded(planServings);
                const scaledServings = planServings * batches;
                return (
                  <div key={index} className="border border-theme-secondary/20 rounded-lg p-4">
                    {/* Recipe names */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-xs font-semibold text-[var(--accent-color)] uppercase tracking-wide">
                            Cook together
                          </p>
                          {batches > 1 && (
                            <span className="text-xs font-bold text-white bg-[var(--accent-color)] px-1.5 py-0.5 rounded-full">
                              ×{batches}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-theme-primary leading-snug">
                          {plan.recipes[0].title}
                        </p>
                        <p className="text-sm text-theme-secondary leading-snug">
                          + {plan.recipes[1].title}
                        </p>
                        {batches > 1 && (
                          <p className="text-xs text-theme-secondary/70 mt-1">
                            Make each recipe ×{batches} — yields ~{scaledServings} servings for {planDuration} days
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => addPlanToMealPlan(plan)}
                        data-testid={`mealprep-add-${index}`}
                        className="flex-shrink-0 bg-[var(--accent-color)] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90"
                      >
                        Add to Plan
                      </button>
                    </div>

                    {/* Pantry badges */}
                    {(() => {
                      const pct = planMatchPercentage(plan);
                      const expiring = planUsesExpiring(plan);
                      return (pct >= 0.7 || expiring) ? (
                        <div className="flex gap-2 mb-2">
                          {pct >= 0.7 && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs font-medium">
                              <ShoppingCart className="w-3 h-3" />
                              {Math.round(pct * 100)}% in pantry
                            </span>
                          )}
                          {expiring && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 text-xs font-medium">
                              <AlertTriangle className="w-3 h-3" />
                              Uses expiring items
                            </span>
                          )}
                        </div>
                      ) : null;
                    })()}

                    {/* Stats row */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-theme-secondary mb-3">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {plan.totalCookTime} min total
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        ~{scaledServings} servings
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
            Pick from your saved recipes, or type in any dish you want to make
          </p>

          {/* Custom recipe input */}
          <div className="border border-dashed border-theme-secondary/40 rounded-lg p-3 mb-4">
            <p className="text-xs font-medium text-theme-primary mb-2">Add a recipe by name</p>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={customTitle}
                onChange={e => setCustomTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
                placeholder="e.g. Chicken and rice"
                className="flex-1 bg-theme-secondary/10 border border-theme-secondary/20 rounded-lg px-3 py-2 text-sm text-theme-primary placeholder-theme-secondary/50 focus:outline-none focus:border-[var(--accent-color)]/50"
              />
              <button
                onClick={handleAddCustom}
                disabled={!customTitle.trim()}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[var(--accent-color)] text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
            <input
              type="text"
              value={customIngredients}
              onChange={e => setCustomIngredients(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
              placeholder="Key ingredients (optional): chicken, garlic, onion, rice"
              className="w-full bg-theme-secondary/10 border border-theme-secondary/20 rounded-lg px-3 py-2 text-xs text-theme-primary placeholder-theme-secondary/50 focus:outline-none focus:border-[var(--accent-color)]/50"
            />
            <p className="text-xs text-theme-secondary/60 mt-1.5">
              Listing ingredients helps detect what's shared across your dishes
            </p>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {savedRecipes.map(recipe => {
              const selected = !!selectedRecipes.find(r => r.id === recipe.id);
              const pct = recipeMatchesPantry(recipe);
              const expiring = recipeUsesExpiring(recipe);
              return (
                <button
                  key={recipe.id}
                  data-testid={`mealprep-select-${recipe.id}`}
                  onClick={() => toggleRecipeSelection(recipe)}
                  title={pct >= 0.7 ? `~${Math.round(pct * 100)}% ingredients in pantry` : undefined}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    selected
                      ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)]'
                      : 'bg-theme-secondary/20 text-theme-primary border-theme-secondary/30 hover:bg-theme-secondary/30'
                  }`}
                >
                  {selected && <CheckCircle className="w-3 h-3" />}
                  {expiring && !selected && <AlertTriangle className="w-3 h-3 text-orange-500" />}
                  {pct >= 0.7 && !selected && !expiring && <ShoppingCart className="w-3 h-3 text-green-500" />}
                  {recipe.title}
                </button>
              );
            })}
            {customEntries.map(entry => {
              const selected = !!selectedRecipes.find(r => r.id === entry.id);
              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border border-dashed transition-colors ${
                    selected
                      ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)]'
                      : 'bg-theme-secondary/10 text-theme-primary border-theme-secondary/40'
                  }`}
                >
                  <button
                    onClick={() => toggleRecipeSelection(entry)}
                    className="flex items-center gap-1"
                    data-testid={`mealprep-select-${entry.id}`}
                  >
                    {selected && <CheckCircle className="w-3 h-3" />}
                    {entry.title}
                  </button>
                  <button
                    onClick={() => removeCustomEntry(entry.id)}
                    className="ml-1 opacity-60 hover:opacity-100"
                    aria-label={`Remove ${entry.title}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
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
  );
};