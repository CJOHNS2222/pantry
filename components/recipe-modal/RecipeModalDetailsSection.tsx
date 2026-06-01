import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { Household, RecipeRating, SavedRecipe, StructuredRecipe } from '../../types';
import { RecipeRatingUI } from '../RecipeRating';

interface RecipeModalDetailsSectionProps {
  editable: boolean;
  servings: number;
  setServings: React.Dispatch<React.SetStateAction<number>>;
  editIngredientsText: string;
  setEditIngredientsText: React.Dispatch<React.SetStateAction<string>>;
  editInstructionsText: string;
  setEditInstructionsText: React.Dispatch<React.SetStateAction<string>>;
  scaledIngredients: string[];
  recipe: StructuredRecipe | SavedRecipe;
  onRate?: (rating: RecipeRating) => void;
  showReviewPrompt: boolean;
  setShowReviewPrompt: React.Dispatch<React.SetStateAction<boolean>>;
  onRatingSubmitted: (rating: RecipeRating) => void;
  household?: Household | null;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  ratingRef: React.RefObject<HTMLDivElement | null>;
}

export const RecipeModalDetailsSection: React.FC<RecipeModalDetailsSectionProps> = ({
  editable,
  servings,
  setServings,
  editIngredientsText,
  setEditIngredientsText,
  editInstructionsText,
  setEditInstructionsText,
  scaledIngredients,
  recipe,
  onRate,
  showReviewPrompt,
  setShowReviewPrompt,
  onRatingSubmitted,
  household,
  user,
  ratingRef,
}) => {
  return (
    <>
      {!editable && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold text-[var(--accent-color)] uppercase">Servings</h4>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setServings(Math.max(1, servings - 1))}
                className="w-8 h-8 rounded-full bg-theme-secondary/20 hover:bg-theme-secondary/30 flex items-center justify-center text-theme-primary font-bold"
                aria-label="Decrease servings"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-lg font-semibold text-theme-primary min-w-[2rem] text-center">{servings}</span>
              <button
                onClick={() => setServings(servings + 1)}
                className="w-8 h-8 rounded-full bg-theme-secondary/20 hover:bg-theme-secondary/30 flex items-center justify-center text-theme-primary font-bold"
                aria-label="Increase servings"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-xs text-theme-secondary opacity-70">Adjust servings to scale ingredients proportionally (recipes assume 4 servings)</p>
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-[var(--accent-color)] uppercase">Ingredients</h4>
        </div>

        {editable ? (
          <div className="space-y-2">
            {editIngredientsText
              .split('\n')
              .concat(['', '', '', ''])
              .slice(0, Math.max(4, editIngredientsText.split('\n').length))
              .map((ingredient, index) => (
                <input
                  key={index}
                  value={ingredient}
                  onChange={(e) => {
                    const lines = editIngredientsText.split('\n');
                    if (index < lines.length) {
                      lines[index] = e.target.value;
                    } else {
                      lines.push(e.target.value);
                    }
                    setEditIngredientsText(lines.join('\n'));
                  }}
                  placeholder={`Ingredient ${index + 1}`}
                  className="w-full px-3 py-2 border border-theme rounded-lg bg-theme-primary text-theme-primary focus:border-[var(--accent-color)] focus:outline-none"
                />
              ))}
          </div>
        ) : (
          <ul className="list-disc list-inside text-theme-secondary opacity-80">
            {Array.isArray(scaledIngredients) && scaledIngredients.length > 0 ? (
              scaledIngredients.map((ingredient, index) => <li key={index}>{ingredient}</li>)
            ) : (
              <li>No ingredients available</li>
            )}
          </ul>
        )}
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-[var(--accent-color)] uppercase">Instructions</h4>
        </div>

        {editable ? (
          <div className="space-y-2">
            {editInstructionsText
              .split('\n')
              .concat(['', '', '', ''])
              .slice(0, Math.max(4, editInstructionsText.split('\n').length))
              .map((instruction, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="text-sm font-medium text-theme-secondary mt-2 min-w-[20px]">{index + 1}.</span>
                  <input
                    value={instruction}
                    onChange={(e) => {
                      const lines = editInstructionsText.split('\n');
                      if (index < lines.length) {
                        lines[index] = e.target.value;
                      } else {
                        lines.push(e.target.value);
                      }
                      setEditInstructionsText(lines.join('\n'));
                    }}
                    placeholder={`Step ${index + 1}`}
                    className="flex-1 px-3 py-2 border border-theme rounded-lg bg-theme-primary text-theme-primary focus:border-[var(--accent-color)] focus:outline-none"
                  />
                </div>
              ))}
          </div>
        ) : (
          <ol className="list-decimal list-inside text-theme-secondary opacity-80 space-y-1">
            {(() => {
              const processedSteps: string[] = [];

              if (Array.isArray(recipe.instructions) && recipe.instructions.length > 0) {
                recipe.instructions.forEach((instruction) => {
                  const steps = instruction.split(/(?=step \d+|STEP \d+|\d+\.)/i).filter((step) => step.trim());
                  processedSteps.push(...steps);
                });
              }

              return processedSteps.length > 0 ? (
                processedSteps.map((step, index) => {
                  const cleanStep = step
                    .replace(/^step\s+\d+\s*[-.]?\s*/i, '')
                    .replace(/^STEP\s+\d+\s*[-.]?\s*/i, '')
                    .replace(/^\d+\.\s*/, '')
                    .trim();
                  return <li key={index}>{cleanStep}</li>;
                })
              ) : (
                <li>No instructions available</li>
              );
            })()}
          </ol>
        )}
      </div>

      {onRate && (
        <div className={`mt-6 pt-4 border-t border-theme ${showReviewPrompt ? 'bg-[var(--accent-color)]/10 p-4 rounded-lg' : ''}`} ref={ratingRef}>
          <RecipeRatingUI
            recipeTitle={recipe.title}
            recipe={recipe}
            onRatingSubmitted={(rating) => {
              onRatingSubmitted(rating);
              setShowReviewPrompt(false);
            }}
            householdId={household?.id || user?.id}
          />
        </div>
      )}
    </>
  );
};
