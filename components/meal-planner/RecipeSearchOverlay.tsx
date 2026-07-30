import React from 'react';
import { DayPlan, Household, PantryItem, SavedRecipe, StructuredRecipe, User } from '../../types';
import { RecipeSearchModal } from './RecipeSearchModal';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import { Modal } from '../ui/Modal';

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

  if (!searchMealType) return null;

  return (
    <Modal
      isOpen={show}
      onClose={onClose}
      size="xl"
      panelClassName="h-full"
      title={`Add ${searchMealType.charAt(0).toUpperCase() + searchMealType.slice(1)} Recipe`}
      subtitle={`${mealPlan[currentDayIndex].dayName} - ${mealPlan[currentDayIndex].date}`}
    >
      <Modal.Body noScroll className="flex flex-col min-h-0" padding="none">
        <div className="p-6 flex-1 min-h-0 overflow-y-auto">
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
      </Modal.Body>
    </Modal>
  );
};
