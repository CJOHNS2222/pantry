import React from 'react';
import { Household, RecipeRating, SavedRecipe, StructuredRecipe } from '../../types';
import { RecipeRatingUI } from '../recipes-meals/RecipeRating';

interface RecipeModalRatingModalProps {
  showRatingModal: boolean;
  setShowRatingModal: React.Dispatch<React.SetStateAction<boolean>>;
  recipe: StructuredRecipe | SavedRecipe;
  onRate?: (rating: RecipeRating) => void;
  onClose: () => void;
  household?: Household | null;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

export const RecipeModalRatingModal: React.FC<RecipeModalRatingModalProps> = ({
  showRatingModal,
  setShowRatingModal,
  recipe,
  onRate,
  onClose,
  household,
  user,
}) => {
  if (!showRatingModal) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={() => setShowRatingModal(false)}
    >
      <div className="bg-theme-primary rounded-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-theme-text mb-4 text-center">Rate "{recipe.title}"</h3>
        <div className="mb-6">
          <RecipeRatingUI
            recipeTitle={recipe.title}
            recipe={recipe}
            onRatingSubmitted={(rating) => {
              if (onRate) onRate(rating);
              setShowRatingModal(false);
              setTimeout(() => onClose(), 300);
            }}
            householdId={household?.id || user?.id}
          />
        </div>
        <div className="flex justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowRatingModal(false);
            }}
            className="py-2 px-6 font-bold border border-theme rounded-lg hover:bg-theme-secondary transition-colors"
          >
            Skip for Now
          </button>
        </div>
      </div>
    </div>
  );
};
