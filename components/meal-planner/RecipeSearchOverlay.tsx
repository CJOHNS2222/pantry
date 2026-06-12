import React from 'react';
import { DayPlan, Household, PantryItem, SavedRecipe, StructuredRecipe, User } from '../../types';
import { RecipeSearchModal } from './RecipeSearchModal';
import { useAndroidBack } from '../../hooks/useAndroidBack';

interface RecipeSearchOverlayProps {
  show: boolean;
  searchMealType: 'breakfast' | 'lunch' | 'dinner' | null;
  mealPlan: DayPlan[];
  displayPlan: DayPlan[];
  currentDayIndex: number;
  onClose: () => void;
  onAddRecipe: (recipe: StructuredRecipe, dayIndex: number) => void;
  inventory: PantryItem[];
  user: User;
  savedRecipes: SavedRecipe[];
  household?: Household | null;
}

export const RecipeSearchOverlay: React.FC<RecipeSearchOverlayProps> = ({
  show,
  searchMealType,
  mealPlan,
  displayPlan: _displayPlan,
  currentDayIndex,
  onClose,
  onAddRecipe,
  inventory,
  user,
  savedRecipes,
  household
}) => {
  useAndroidBack(show, onClose);

  if (!show || !searchMealType) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 pt-[var(--safe-area-inset-top,0px)] pb-[var(--safe-area-inset-bottom,0px)]"
      onClick={onClose}
    >
      <div className="bg-theme-primary rounded-xl max-w-4xl w-full h-full flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-theme">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-theme-secondary">
                Add {searchMealType.charAt(0).toUpperCase() + searchMealType.slice(1)} Recipe
              </h2>
              <p className="text-theme-secondary opacity-60">
                {mealPlan[currentDayIndex].dayName} - {mealPlan[currentDayIndex].date}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-theme-secondary opacity-60 hover:opacity-100 p-2"
              aria-label="Close recipe search"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6">
          <RecipeSearchModal
            mealType={searchMealType}
            dayIndex={currentDayIndex}
            onAddRecipe={onAddRecipe}
            onClose={onClose}
            inventory={inventory}
            user={user}
            savedRecipes={savedRecipes}
            household={household}
          />
        </div>
      </div>
    </div>
  );
};
