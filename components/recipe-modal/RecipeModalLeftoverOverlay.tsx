import React from 'react';
import LeftoverQuickCapture from '../leftovers/LeftoverQuickCapture';

interface RecipeModalLeftoverOverlayProps {
  showLeftoverCapture: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  servings: number;
  recipeImageUrl?: string;
  recipeTitle: string;
  onSaved: (id?: string) => void;
  onClose: () => void;
}

export const RecipeModalLeftoverOverlay: React.FC<RecipeModalLeftoverOverlayProps> = ({
  showLeftoverCapture,
  user,
  servings,
  recipeImageUrl,
  recipeTitle,
  onSaved,
  onClose,
}) => {
  if (!showLeftoverCapture || !user) return null;

  return (
    <LeftoverQuickCapture
      createdBy={user.id}
      initialServings={servings}
      recipeImageUrl={recipeImageUrl}
      initialNotes={`Leftovers from ${recipeTitle}`}
      onSaved={(id) => onSaved(id)}
      onClose={onClose}
    />
  );
};
