import React, { useState, useMemo } from 'react';
import { Plus, Heart, Trash2, Minus, Users } from 'lucide-react';
import { StructuredRecipe, RecipeRating, SavedRecipe } from '../types';
import { RecipeRatingUI } from './RecipeRating';

interface RecipeModalProps {
  recipe: StructuredRecipe | SavedRecipe;
  isOpen: boolean;
  onClose: () => void;
  onAddToPlan?: (recipe: StructuredRecipe) => void;
  onSaveRecipe?: (recipe: StructuredRecipe) => void;
  onDeleteRecipe?: (recipe: SavedRecipe) => void;
  onRate?: (rating: any) => void;
  onMarkAsMade?: (recipe: StructuredRecipe) => void;
  showSaveButton?: boolean;
  showDeleteButton?: boolean;
  showMarkAsMade?: boolean;
  showAddToPlan?: boolean;
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
  showSaveButton = true,
  showDeleteButton = false,
  showMarkAsMade = false,
  showAddToPlan = true,
  user
}) => {
  const [servings, setServings] = useState(4); // Default to 4 servings
  const originalServings = 4; // Assume recipes are for 4 servings

  // Basic nutritional data per serving (estimates)
  const nutritionalInfo = useMemo(() => {
    if (!recipe.ingredients) return null;
    
    // Simple nutritional estimation based on common ingredients
    const estimates = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0
    };
    
    const ingredientText = recipe.ingredients.join(' ').toLowerCase();
    
    // Very basic estimation - could be enhanced with a proper nutrition database
    if (ingredientText.includes('chicken')) {
      estimates.calories += 165;
      estimates.protein += 31;
      estimates.fat += 3.6;
    }
    if (ingredientText.includes('beef')) {
      estimates.calories += 250;
      estimates.protein += 26;
      estimates.fat += 17;
    }
    if (ingredientText.includes('rice')) {
      estimates.calories += 130;
      estimates.carbs += 28;
      estimates.protein += 2.7;
    }
    if (ingredientText.includes('pasta')) {
      estimates.calories += 157;
      estimates.carbs += 31;
      estimates.protein += 5.8;
    }
    if (ingredientText.includes('flour')) {
      estimates.calories += 361;
      estimates.carbs += 76;
      estimates.protein += 10;
    }
    if (ingredientText.includes('butter') || ingredientText.includes('oil')) {
      estimates.calories += 100;
      estimates.fat += 11;
    }
    if (ingredientText.includes('cheese')) {
      estimates.calories += 113;
      estimates.protein += 7;
      estimates.fat += 9;
      estimates.carbs += 1;
    }
    if (ingredientText.includes('vegetable') || ingredientText.includes('lettuce') || ingredientText.includes('tomato')) {
      estimates.calories += 25;
      estimates.carbs += 5;
      estimates.fiber += 2;
    }
    
    // Nutrition is always per serving, not scaled by servings
    return {
      calories: Math.round(estimates.calories),
      protein: Math.round(estimates.protein * 10) / 10,
      carbs: Math.round(estimates.carbs * 10) / 10,
      fat: Math.round(estimates.fat * 10) / 10,
      fiber: Math.round(estimates.fiber * 10) / 10
    };
  }, [recipe.ingredients, servings]);

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
              <div className="grid grid-cols-2 gap-2 text-sm">
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
              </div>
              <p className="text-xs text-theme-secondary opacity-50 mt-2">
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
            <div className="mt-6 pt-4 border-t border-theme">
             <RecipeRatingUI
             recipeTitle={recipe.title}
             recipe={recipe}
             onRate={(rating) => {
              if (onRate) onRate(rating);
              onClose(); // This will close the modal after submitting a rating
            }}
            user={user}
          />
        </div>
      )}
        </div>
        <div className="sticky bottom-0 z-20 w-full py-4 bg-theme-primary rounded-b-2xl flex items-center gap-2 p-4 pb-2.5">
          <button className="flex-1 py-3 font-bold border border-[var(--accent-color)] rounded-lg flex items-center justify-center gap-2" onClick={onClose}>CLOSE</button>
          {showDeleteButton && onDeleteRecipe && (
            <button onClick={() => { onDeleteRecipe(recipe as SavedRecipe); onClose(); }} className="flex-1 py-3 font-bold bg-red-500 text-white rounded-lg flex items-center justify-center gap-2">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
          {showAddToPlan && onAddToPlan && (
            <button onClick={() => { onAddToPlan(recipe as StructuredRecipe); onClose(); }} className="flex-1 py-3 font-bold bg-[var(--accent-color)] text-white rounded-lg flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Add to Schedule
            </button>
          )}
          {showSaveButton && onSaveRecipe && (
            <button onClick={() => { onSaveRecipe(recipe as StructuredRecipe); onClose(); }} className="flex-1 py-3 font-bold border border-[var(--accent-color)] rounded-lg flex items-center justify-center gap-2">
              <Heart className="w-4 h-4" /> Save
            </button>
          )}
          {showMarkAsMade && onMarkAsMade && (
            <button onClick={() => { onMarkAsMade(recipe as StructuredRecipe); onClose(); }} className="flex-1 py-3 font-bold bg-[var(--accent-color)] text-white rounded-lg">Mark as Made</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecipeModal;
