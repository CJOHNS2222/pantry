import React from 'react';
import { RecipeRating, SavedRecipe, StructuredRecipe, User } from '../../types';
import RecipeModal from '../RecipeModal';

interface RecipeFinderModalSectionProps {
  showRecipeModal: boolean;
  modalRecipe: StructuredRecipe | null;
  setShowRecipeModal: React.Dispatch<React.SetStateAction<boolean>>;
  onAddToPlan: (recipe: StructuredRecipe) => void;
  handleModalSaveRecipe: (recipe: StructuredRecipe & { __imageFile?: File; __submitForInclusion?: boolean }) => Promise<void>;
  onDeleteRecipe: (recipe: SavedRecipe) => void;
  onRate: (rating: RecipeRating) => void;
  onMarkAsMade?: (recipe: StructuredRecipe) => void;
  modalIsSavedView: boolean;
  recipeSaveLimitExceeded: boolean;
  mealPlanLimitExceeded: boolean;
  savedRecipesCount: number;
  user: User;
}

export const RecipeFinderModalSection: React.FC<RecipeFinderModalSectionProps> = ({
  showRecipeModal,
  modalRecipe,
  setShowRecipeModal,
  onAddToPlan,
  handleModalSaveRecipe,
  onDeleteRecipe,
  onRate,
  onMarkAsMade,
  modalIsSavedView,
  recipeSaveLimitExceeded,
  mealPlanLimitExceeded,
  savedRecipesCount,
  user,
}) => {
  if (!showRecipeModal || !modalRecipe) return null;

  return (
    <RecipeModal
      recipe={modalRecipe}
      isOpen={showRecipeModal}
      onClose={() => setShowRecipeModal(false)}
      onAddToPlan={(recipe) => {
        onAddToPlan(recipe);
      }}
      onSaveRecipe={handleModalSaveRecipe}
      editable={Boolean((modalRecipe as (StructuredRecipe & { __editing?: boolean }) | null)?.__editing)}
      onDeleteRecipe={(recipe) => {
        onDeleteRecipe(recipe);
      }}
      onRate={onRate}
      onMarkAsMade={(recipe) => {
        if (onMarkAsMade) onMarkAsMade(recipe);
      }}
      showSaveButton={!modalIsSavedView}
      showDeleteButton={modalIsSavedView}
      showMarkAsMade={true}
      showAddToPlan={true}
      recipeSaveLimitExceeded={recipeSaveLimitExceeded}
      mealPlanLimitExceeded={mealPlanLimitExceeded}
      recipeSavedCount={savedRecipesCount}
      user={user}
    />
  );
};
