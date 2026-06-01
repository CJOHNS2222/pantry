import React from 'react';
import LeftoverQuickCapture from '../LeftoverQuickCapture';

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
    <div onClick={(e) => e.stopPropagation()} style={{ zIndex: 99999 }} className="fixed inset-0 flex items-center justify-center bg-black/40 p-4">
      <div onClick={(e) => e.stopPropagation()} className="bg-theme-secondary rounded-lg p-4">
        <LeftoverQuickCapture
          createdBy={user.id}
          initialServings={servings}
          recipeImageUrl={recipeImageUrl}
          initialNotes={`Leftovers from ${recipeTitle}`}
          onSaved={(id) => onSaved(id)}
          onClose={onClose}
        />
      </div>
    </div>
  );
};
