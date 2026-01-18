import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Heart, Trash2, Minus, Users, CheckCircle2, Play, Pause, RotateCcw, AlertCircle } from 'lucide-react';
import { StructuredRecipe, RecipeRating, SavedRecipe, PantryItem } from '../types';
import { RecipeRatingUI } from './RecipeRating';

interface RecipeModalProps {
  recipe: StructuredRecipe | SavedRecipe;
  isOpen: boolean;
  onClose: () => void;
  onAddToPlan?: (recipe: StructuredRecipe) => void;
  onSaveRecipe?: (recipe: StructuredRecipe) => void;
  onDeleteRecipe?: (recipe: SavedRecipe) => void;
  onRate?: (rating: any) => void;
  onMarkAsMade?: (recipe: StructuredRecipe, inventory?: PantryItem[]) => void;
  onRemoveFromMealPlan?: (recipe: StructuredRecipe) => void;
  showSaveButton?: boolean;
  showDeleteButton?: boolean;
  showMarkAsMade?: boolean;
  showAddToPlan?: boolean;
  inventory?: PantryItem[];
  isFromMealPlan?: boolean;
  recipeSaveLimitExceeded?: boolean;
  mealPlanLimitExceeded?: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

export const RecipeModal: React.FC<RecipeModalProps> = ({
  recipe,
  isOpen,
  onClose,
  onAddToPlan,
  onSaveRecipe,
  onDeleteRecipe,
  onRate,
  onMarkAsMade,
  onRemoveFromMealPlan,
  showSaveButton = true,
  showDeleteButton = false,
  showMarkAsMade = false,
  showAddToPlan = true,
  inventory = [],
  isFromMealPlan = false,
  recipeSaveLimitExceeded = false,
  mealPlanLimitExceeded = false,
  user
}) => {
  const [servings, setServings] = useState(4); // Default to 4 servings
  const originalServings = 4; // Assume recipes are for 4 servings
  const ratingRef = useRef<HTMLDivElement>(null);
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  
  // Cooking Timer State
  const [timerActive, setTimerActive] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [customTime, setCustomTime] = useState(0); // User-set custom time in minutes
  const [showCustomTimer, setShowCustomTimer] = useState(false);
  const [timerLabel, setTimerLabel] = useState('Cooking Timer');
  
  // Smart Substitutions State
  const [showSubstitutions, setShowSubstitutions] = useState(false);
  const [missingIngredients, setMissingIngredients] = useState<{ingredient: string, suggestions: string[]}[]>([]);

  // Parse cook time to seconds
  const parseTimeToSeconds = (timeStr: string): number => {
    if (!timeStr) return 0;
    const match = timeStr.match(/(\d+)\s*(min|hour|hr|sec)/i);
    if (!match) return 0;
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    if (unit.includes('h')) return value * 3600;
    if (unit.includes('m')) return value * 60;
    return value;
  };

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setTimerActive(false);
            // Play alert sound
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj==');
            audio.play().catch(() => {});
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeRemaining]);

  // Start timer with recipe time or custom time
  const startTimer = (useCustomTime = false) => {
    let seconds = 0;
    if (useCustomTime && customTime > 0) {
      seconds = customTime * 60; // Convert minutes to seconds
    } else {
      seconds = parseTimeToSeconds((recipe as StructuredRecipe).cookTime);
    }
    if (seconds > 0) {
      setTotalTime(seconds);
      setTimeRemaining(seconds);
      setTimerActive(true);
      setTimerLabel(useCustomTime ? `Custom Timer (${customTime} min)` : 'Cooking Timer');
    }
  };

  // Quick timer presets
  const startQuickTimer = (minutes: number) => {
    setCustomTime(minutes);
    setTimerLabel(`${minutes} Minute Timer`);
    setTotalTime(minutes * 60);
    setTimeRemaining(minutes * 60);
    setTimerActive(true);
    setShowCustomTimer(false);
  };

  // Format seconds to MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Find missing ingredients and suggest substitutions
  const findSubstitutions = () => {
    const recipeIngredients = (recipe as StructuredRecipe).ingredients || [];
    const inventoryLower = inventory.map(item => item.item.toLowerCase());
    
    const missing = recipeIngredients.filter(ing => {
      const ingLower = ing.toLowerCase();
      return !inventoryLower.some(inv => 
        inv.includes(ingLower.split(/\s+/)[0]) || ingLower.split(/\s+/)[0].includes(inv)
      );
    });

    if (missing.length === 0) {
      alert('All ingredients are in your pantry! 🎉');
      return;
    }

    // Generate substitution suggestions
    const substitutions = missing.map(ing => ({
      ingredient: ing,
      suggestions: inventory
        .filter(inv => {
          const invLower = inv.item.toLowerCase();
          const ingLower = ing.toLowerCase();
          // Basic category matching for substitutions
          const categories = {
            'butter': ['oil', 'margarine', 'ghee'],
            'milk': ['almond milk', 'coconut milk', 'cream'],
            'egg': ['applesauce', 'banana', 'flax'],
            'flour': ['almond flour', 'coconut flour', 'cornstarch'],
            'sugar': ['honey', 'maple syrup', 'agave']
          };
          return Object.entries(categories).some(([key, subs]) => 
            ingLower.includes(key) && subs.some(sub => invLower.includes(sub))
          );
        })
        .slice(0, 2)
        .map(inv => inv.item)
    }));

    setMissingIngredients(substitutions);
    setShowSubstitutions(true);
  };

  const handleMarkAsMadeClick = async () => {
    // Step 1: Confirm deletion of used inventory
    const confirmDelete = window.confirm(
      `Are you sure you want to mark this recipe as made? This will remove the used ingredients from your pantry inventory.`
    );

    if (!confirmDelete) return;

    // Step 2: Call the onMarkAsMade handler with inventory info
    if (onMarkAsMade) {
      onMarkAsMade(recipe as StructuredRecipe, inventory);
    }

    // Step 3: If from meal plan, remove it from the meal plan
    if (isFromMealPlan && onRemoveFromMealPlan) {
      onRemoveFromMealPlan(recipe as StructuredRecipe);
    }

    // Step 4: Ask if user wants to submit a review
    setTimeout(() => {
      const submitReview = window.confirm(
        `Would you like to rate this recipe? This helps other users find great recipes!`
      );
      
      if (submitReview) {
        // Show rating modal
        setShowRatingModal(true);
      } else {
        // Close modal if no review
        onClose();
      }
    }, 100);
  };

  // Enhanced nutritional analysis with dietary goals
  const nutritionalInfo = useMemo(() => {
    if (!recipe.ingredients) return null;

    // Simple nutritional estimation based on common ingredients
    const estimates = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sodium: 0,
      sugar: 0
    };

    const ingredientText = recipe.ingredients.join(' ').toLowerCase();

    // Enhanced estimation with more ingredients
    const nutritionMap = {
      'chicken': { calories: 165, protein: 31, fat: 3.6, carbs: 0 },
      'beef': { calories: 250, protein: 26, fat: 17, carbs: 0 },
      'pork': { calories: 143, protein: 21, fat: 5, carbs: 0 },
      'fish': { calories: 120, protein: 25, fat: 2, carbs: 0 },
      'rice': { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
      'pasta': { calories: 157, protein: 5.8, carbs: 31, fat: 0.9 },
      'bread': { calories: 79, protein: 3, carbs: 15, fat: 1 },
      'flour': { calories: 361, protein: 10, carbs: 76, fat: 1 },
      'butter': { calories: 100, protein: 0, carbs: 0, fat: 11 },
      'oil': { calories: 120, protein: 0, carbs: 0, fat: 14 },
      'cheese': { calories: 113, protein: 7, carbs: 1, fat: 9 },
      'milk': { calories: 61, protein: 3.3, carbs: 5, fat: 3.3 },
      'egg': { calories: 70, protein: 6, carbs: 0.6, fat: 5 },
      'potato': { calories: 77, protein: 2, carbs: 17, fat: 0.1 },
      'tomato': { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
      'onion': { calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1 },
      'garlic': { calories: 4, protein: 0.2, carbs: 1, fat: 0 },
      'lettuce': { calories: 5, protein: 0.5, carbs: 1, fat: 0 },
      'broccoli': { calories: 34, protein: 2.8, carbs: 7, fat: 0.4 },
      'carrot': { calories: 25, protein: 0.6, carbs: 6, fat: 0.1 },
      'apple': { calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
      'banana': { calories: 89, protein: 1.1, carbs: 23, fat: 0.3 },
      'sugar': { calories: 387, protein: 0, carbs: 100, fat: 0 },
      'salt': { calories: 0, protein: 0, carbs: 0, fat: 0, sodium: 1000 }
    };

    // Calculate nutrition based on ingredients found
    Object.entries(nutritionMap).forEach(([ingredient, nutrition]) => {
      if (ingredientText.includes(ingredient)) {
        estimates.calories += nutrition.calories;
        estimates.protein += nutrition.protein || 0;
        estimates.carbs += nutrition.carbs || 0;
        estimates.fat += nutrition.fat || 0;
        estimates.sodium += nutrition.sodium || 0;
      }
    });

    // Add some fiber for vegetables
    if (ingredientText.includes('vegetable') || ingredientText.includes('lettuce') ||
        ingredientText.includes('broccoli') || ingredientText.includes('carrot')) {
      estimates.fiber += 2;
    }

    // Determine dietary compatibility
    const isKeto = estimates.carbs < 20;
    const isLowCarb = estimates.carbs < 50;
    const isHighProtein = estimates.protein > 20;
    const isLowFat = estimates.fat < 10;

    return {
      calories: Math.round(estimates.calories),
      protein: Math.round(estimates.protein * 10) / 10,
      carbs: Math.round(estimates.carbs * 10) / 10,
      fat: Math.round(estimates.fat * 10) / 10,
      fiber: Math.round(estimates.fiber * 10) / 10,
      sodium: Math.round(estimates.sodium),
      sugar: Math.round(estimates.sugar),
      dietaryGoals: {
        keto: isKeto,
        lowCarb: isLowCarb,
        highProtein: isHighProtein,
        lowFat: isLowFat
      }
    };
  }, [recipe.ingredients]);

  // Scale ingredients based on servings
  const scaledIngredients = useMemo(() => {
    if (!recipe.ingredients || !Array.isArray(recipe.ingredients)) return [];
    
    const scaleFactor = servings / originalServings;
    
    return recipe.ingredients.map(ingredient => {
      // Simple regex to find numbers at the beginning of ingredient strings
      const numberMatch = ingredient.match(/^(\d+(?:\.\d+)?)/);
      
      if (numberMatch && scaleFactor !== 1) {
        const originalNumber = parseFloat(numberMatch[1]);
        const scaledNumber = originalNumber * scaleFactor;
        
        // Format the scaled number nicely (avoid decimals for whole numbers, round to 2 decimals for fractions)
        const formattedNumber = scaledNumber % 1 === 0 ? scaledNumber.toString() : scaledNumber.toFixed(2).replace(/\.?0+$/, '');
        
        return ingredient.replace(/^(\d+(?:\.\d+)?)/, formattedNumber);
      }
      
      return ingredient;
    });
  }, [recipe.ingredients, servings]);

  if (!isOpen || !recipe) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-theme-primary rounded-2xl shadow-2xl max-w-lg w-full relative flex flex-col max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <button className="absolute top-3 right-3 text-theme-secondary opacity-50 hover:opacity-100 z-20" onClick={onClose}>
          &times;
        </button>
        <div className="sticky top-0 z-10 w-full py-4 text-3xl font-bold text-white bg-[var(--accent-color)] rounded-t-2xl flex items-center justify-center">
          <span className="sr-only">Recipe Details</span>
        </div>
        <div className="overflow-y-auto p-6 flex-1">
          <h2 className="text-2xl font-serif font-bold mb-2 text-[var(--accent-color)]">{recipe.title || 'Untitled'}</h2>
          {recipe.description && <p className="mb-4 text-theme-secondary opacity-70">{recipe.description}</p>}

          {/* Enhanced Cooking Timer Section */}
          {(recipe as StructuredRecipe).cookTime && (
            <div className="mb-6 p-4 bg-theme-secondary/10 rounded-lg border border-[var(--accent-color)]/20">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-[var(--accent-color)] uppercase">{timerLabel}</h4>
                <span className="text-xs text-theme-secondary opacity-70">
                  {timerActive ? formatTime(timeRemaining) : (recipe as StructuredRecipe).cookTime}
                </span>
              </div>

              {showCustomTimer ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      max="180"
                      value={customTime}
                      onChange={(e) => setCustomTime(parseInt(e.target.value) || 0)}
                      placeholder="Minutes"
                      className="flex-1 px-3 py-2 bg-theme-secondary/20 border border-[var(--accent-color)]/20 rounded-lg text-theme-primary text-sm"
                    />
                    <button
                      onClick={() => startTimer(true)}
                      disabled={customTime <= 0}
                      className="px-4 py-2 bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 disabled:bg-theme-secondary/50 text-white rounded-lg text-sm font-medium"
                    >
                      Start
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startQuickTimer(5)} className="flex-1 py-1 px-2 bg-theme-secondary/20 hover:bg-theme-secondary/30 rounded text-xs">5 min</button>
                    <button onClick={() => startQuickTimer(10)} className="flex-1 py-1 px-2 bg-theme-secondary/20 hover:bg-theme-secondary/30 rounded text-xs">10 min</button>
                    <button onClick={() => startQuickTimer(15)} className="flex-1 py-1 px-2 bg-theme-secondary/20 hover:bg-theme-secondary/30 rounded text-xs">15 min</button>
                    <button onClick={() => startQuickTimer(30)} className="flex-1 py-1 px-2 bg-theme-secondary/20 hover:bg-theme-secondary/30 rounded text-xs">30 min</button>
                  </div>
                  <button
                    onClick={() => setShowCustomTimer(false)}
                    className="w-full py-1 px-2 bg-theme-secondary/10 hover:bg-theme-secondary/20 rounded text-xs text-theme-secondary"
                  >
                    Cancel
                  </button>
                </div>
              ) : timerActive ? (
                <div className="text-center">
                  <div className="text-5xl font-bold font-mono text-[var(--accent-color)] mb-3 tracking-wider">
                    {formatTime(timeRemaining)}
                  </div>
                  <div className="w-full bg-theme-secondary/20 rounded-full h-2 mb-4 overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent-color)] transition-all duration-300"
                      style={{width: totalTime > 0 ? `${(timeRemaining / totalTime) * 100}%` : '0%'}}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTimerActive(!timerActive)}
                      className="flex-1 py-2 px-3 bg-theme-secondary hover:bg-theme-secondary/80 text-theme-primary rounded-lg flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      {timerActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {timerActive ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      onClick={() => { setTimerActive(false); setTimeRemaining(0); setTotalTime(0); }}
                      className="flex-1 py-2 px-3 bg-theme-secondary hover:bg-theme-secondary/80 text-theme-primary rounded-lg flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <RotateCcw className="w-4 h-4" /> Reset
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => startTimer(false)}
                    className="w-full py-2 px-4 bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 text-white rounded-lg flex items-center justify-center gap-2 font-medium"
                  >
                    <Play className="w-4 h-4" /> Start Recipe Timer
                  </button>
                  <button
                    onClick={() => setShowCustomTimer(true)}
                    className="w-full py-2 px-4 bg-theme-secondary/20 hover:bg-theme-secondary/30 border border-[var(--accent-color)]/20 rounded-lg flex items-center justify-center gap-2 text-sm font-medium text-theme-primary"
                  >
                    ⏱️ Custom Timer
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Smart Substitutions Button */}
          {inventory.length > 0 && (
            <div className="mb-4">
              <button
                onClick={findSubstitutions}
                className="w-full py-2 px-4 bg-theme-secondary/20 hover:bg-theme-secondary/30 border border-[var(--accent-color)]/20 rounded-lg flex items-center justify-center gap-2 text-sm font-medium text-theme-primary transition-colors"
              >
                <AlertCircle className="w-4 h-4" /> Check Substitutions
              </button>
            </div>
          )}

          {/* Substitutions Modal */}
          {showSubstitutions && missingIngredients.length > 0 && (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setShowSubstitutions(false)}>
              <div className="bg-theme-primary rounded-xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-[var(--accent-color)]">Missing Ingredients</h3>
                  <button
                    onClick={() => setShowSubstitutions(false)}
                    className="text-theme-secondary opacity-50 hover:opacity-100"
                  >
                    &times;
                  </button>
                </div>
                
                <div className="space-y-4">
                  {missingIngredients.map((item, idx) => (
                    <div key={idx} className="border-l-4 border-red-500 pl-3">
                      <p className="text-sm font-medium text-red-500 mb-2">{item.ingredient}</p>
                      {item.suggestions.length > 0 ? (
                        <div className="space-y-1">
                          <p className="text-xs text-theme-secondary opacity-70 mb-1">Available substitutes:</p>
                          {item.suggestions.map((sugg, sidx) => (
                            <span key={sidx} className="block text-xs bg-green-500/20 text-green-600 px-2 py-1 rounded">
                              ✓ {sugg}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-theme-secondary opacity-70">No substitutes available in pantry</p>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setShowSubstitutions(false)}
                  className="w-full mt-6 py-2 px-4 bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 text-white rounded-lg font-medium"
                >
                  Got it
                </button>
              </div>
            </div>
          )}

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-[var(--accent-color)] uppercase">Ingredients</h4>
              <div className="flex items-center gap-2">
                <Users className="w-3 h-3 text-theme-secondary opacity-50" />
                <button
                  onClick={() => setServings(Math.max(1, servings - 1))}
                  className="w-6 h-6 rounded-full bg-theme-secondary hover:bg-theme-primary flex items-center justify-center text-theme-primary text-sm"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-sm font-medium text-theme-primary min-w-[2rem] text-center">
                  {servings}
                </span>
                <button
                  onClick={() => setServings(servings + 1)}
                  className="w-6 h-6 rounded-full bg-theme-secondary hover:bg-theme-primary flex items-center justify-center text-theme-primary text-sm"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <span className="text-xs text-theme-secondary opacity-70 ml-1">servings</span>
              </div>
            </div>
            <ul className="list-disc list-inside text-theme-secondary opacity-80">
              {Array.isArray(scaledIngredients) && scaledIngredients.length > 0 ? (
                scaledIngredients.map((ing, i) => <li key={i}>{ing}</li>)
              ) : (
                <li>No ingredients available</li>
              )}
            </ul>
          </div>

          {nutritionalInfo && (
            <div className="mb-4">
              <h4 className="text-xs font-bold text-[var(--accent-color)] uppercase mb-2">Nutrition (per serving)</h4>
              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div className="bg-theme-secondary/20 p-2 rounded">
                  <span className="font-medium text-theme-primary">{nutritionalInfo.calories}</span>
                  <span className="text-theme-secondary opacity-70 ml-1">calories</span>
                </div>
                <div className="bg-theme-secondary/20 p-2 rounded">
                  <span className="font-medium text-theme-primary">{nutritionalInfo.protein}g</span>
                  <span className="text-theme-secondary opacity-70 ml-1">protein</span>
                </div>
                <div className="bg-theme-secondary/20 p-2 rounded">
                  <span className="font-medium text-theme-primary">{nutritionalInfo.carbs}g</span>
                  <span className="text-theme-secondary opacity-70 ml-1">carbs</span>
                </div>
                <div className="bg-theme-secondary/20 p-2 rounded">
                  <span className="font-medium text-theme-primary">{nutritionalInfo.fat}g</span>
                  <span className="text-theme-secondary opacity-70 ml-1">fat</span>
                </div>
                {nutritionalInfo.fiber > 0 && (
                  <div className="bg-theme-secondary/20 p-2 rounded">
                    <span className="font-medium text-theme-primary">{nutritionalInfo.fiber}g</span>
                    <span className="text-theme-secondary opacity-70 ml-1">fiber</span>
                  </div>
                )}
              </div>

              {/* Dietary Goal Compatibility */}
              <div className="mb-2">
                <h5 className="text-xs font-semibold text-theme-primary mb-1">Dietary Goals:</h5>
                <div className="flex flex-wrap gap-1">
                  {nutritionalInfo.dietaryGoals.keto && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Keto</span>
                  )}
                  {nutritionalInfo.dietaryGoals.lowCarb && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Low Carb</span>
                  )}
                  {nutritionalInfo.dietaryGoals.highProtein && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">High Protein</span>
                  )}
                  {nutritionalInfo.dietaryGoals.lowFat && (
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">Low Fat</span>
                  )}
                  {!nutritionalInfo.dietaryGoals.keto && !nutritionalInfo.dietaryGoals.lowCarb &&
                   !nutritionalInfo.dietaryGoals.highProtein && !nutritionalInfo.dietaryGoals.lowFat && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">Balanced</span>
                  )}
                </div>
              </div>

              <p className="text-xs text-theme-secondary opacity-50">
                * Estimates based on common ingredients. Actual values may vary.
              </p>
            </div>
          )}

          <div>
            <h4 className="text-xs font-bold text-[var(--accent-color)] uppercase mb-2">Instructions</h4>
            <ol className="list-decimal list-inside text-theme-secondary opacity-80 space-y-1">
              {Array.isArray(recipe.instructions) && recipe.instructions.length > 0 ? (
                recipe.instructions.map((step, i) => <li key={i}>{step}</li>)
              ) : (
                <li>No instructions available</li>
              )}
            </ol>
          </div>
          {onRate && (
            <div className={`mt-6 pt-4 border-t border-theme ${showReviewPrompt ? 'bg-[var(--accent-color)]/10 p-4 rounded-lg' : ''}`} ref={ratingRef}>
             <RecipeRatingUI
             recipeTitle={recipe.title}
             recipe={recipe}
             onRate={(rating) => {
              if (onRate) onRate(rating);
              setShowReviewPrompt(false);
              setTimeout(() => onClose(), 300); // Close modal after submitting a rating
            }}
            user={user}
          />
        </div>
      )}
        </div>
        <div className="sticky bottom-0 z-20 w-full py-4 bg-theme-primary rounded-b-2xl flex items-center gap-2 p-4 pb-12">
          <button className="flex-1 py-3 font-bold border border-[var(--accent-color)] rounded-lg flex items-center justify-center gap-2" onClick={onClose}>CLOSE</button>
          {showDeleteButton && onDeleteRecipe && (
            <button onClick={() => { onDeleteRecipe(recipe as SavedRecipe); onClose(); }} className="flex-1 py-3 font-bold bg-red-500 text-white rounded-lg flex items-center justify-center gap-2">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
          {showAddToPlan && onAddToPlan && (
            <button 
              onClick={() => { onAddToPlan(recipe as StructuredRecipe); onClose(); }} 
              disabled={mealPlanLimitExceeded}
              className={`flex-1 py-3 font-bold rounded-lg flex items-center justify-center gap-2 ${
                mealPlanLimitExceeded 
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-50' 
                  : 'bg-[var(--accent-color)] text-white'
              }`}
            >
              <Plus className="w-4 h-4" /> {mealPlanLimitExceeded ? 'Limit Reached' : 'Add to Schedule'}
            </button>
          )}
          {showSaveButton && onSaveRecipe && (
            <button 
              onClick={() => { onSaveRecipe(recipe as StructuredRecipe); onClose(); }} 
              disabled={recipeSaveLimitExceeded}
              className={`flex-1 py-3 font-bold border rounded-lg flex items-center justify-center gap-2 ${
                recipeSaveLimitExceeded 
                  ? 'border-gray-400 text-gray-400 cursor-not-allowed opacity-50' 
                  : 'border-[var(--accent-color)] hover:bg-[var(--accent-color)] hover:text-white'
              }`}
            >
              <Heart className="w-4 h-4" /> {recipeSaveLimitExceeded ? 'Limit Reached' : 'Save'}
            </button>
          )}
          {showMarkAsMade && onMarkAsMade && (
            <button onClick={handleMarkAsMadeClick} className="flex-1 py-3 font-bold bg-[var(--accent-color)] text-white rounded-lg flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" /> Mark as Made</button>
          )}
        </div>
      </div>

      {/* Rating Modal */}
      {showRatingModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowRatingModal(false)}
        >
          <div
            className="bg-theme-primary rounded-2xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-theme-text mb-4 text-center">
              Rate "{recipe.title}"
            </h3>
            <div className="mb-6">
              <RecipeRatingUI
                recipeTitle={recipe.title}
                recipe={recipe}
                onRate={(rating) => {
                  if (onRate) onRate(rating);
                  setShowRatingModal(false);
                  setTimeout(() => onClose(), 300); // Close main modal after submitting a rating
                }}
                user={user}
              />
            </div>
            <div className="flex justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRatingModal(false);
                }}
                className="py-3 px-6 font-bold border border-theme rounded-lg hover:bg-theme-secondary transition-colors"
              >
                Skip for Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecipeModal;
