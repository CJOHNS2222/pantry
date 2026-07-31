import React from 'react';
import { Household, RecipeCommunityStats, RecipeRating, SavedRecipe, StructuredRecipe } from '../../types';
import { RecipeRatingUI } from '../recipes-meals/RecipeRating';
import { Modal } from '../ui/Modal';

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
  communityStats?: RecipeCommunityStats | null;
}

export const RecipeModalRatingModal: React.FC<RecipeModalRatingModalProps> = ({
  showRatingModal,
  setShowRatingModal,
  recipe,
  onRate,
  onClose,
  household,
  user,
  communityStats,
}) => {
  return (
    <Modal isOpen={showRatingModal} onClose={() => setShowRatingModal(false)} title={`Rate "${recipe.title}"`}>
      <Modal.Body>
        <RecipeRatingUI
          recipeTitle={recipe.title}
          recipe={recipe}
          onRatingSubmitted={(rating) => {
            if (onRate) onRate(rating);
            setShowRatingModal(false);
            setTimeout(() => onClose(), 300);
          }}
          householdId={household?.id || user?.id}
          communityStats={communityStats ?? undefined}
        />
      </Modal.Body>
      <Modal.Footer align="center">
        <button
          onClick={() => setShowRatingModal(false)}
          className="py-2 px-6 font-bold border border-theme rounded-lg hover:bg-theme-secondary transition-colors"
        >
          Skip for Now
        </button>
      </Modal.Footer>
    </Modal>
  );
};
