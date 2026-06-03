import React from 'react';
import { Plus, Heart, Trash2, RotateCcw, CheckCircle2, UtensilsCrossed } from 'lucide-react';
import { SavedRecipe, StructuredRecipe } from '../../types';

interface RecipeModalActionSectionProps {
  editable: boolean;
  submitForInclusion: boolean;
  setSubmitForInclusion: React.Dispatch<React.SetStateAction<boolean>>;
  recipeSavedCount?: number;
  recipeSaveLimitExceeded: boolean;
  isSaving: boolean;
  onSaveEditable: () => Promise<void>;
  showMarkAsMade: boolean;
  onMarkAsMade?: (recipe: StructuredRecipe) => void;
  onMarkAsMadeClick: () => void;
  showAddToPlan: boolean;
  onAddToPlan?: (recipe: StructuredRecipe) => void;
  recipe: StructuredRecipe | SavedRecipe;
  onClose: () => void;
  mealPlanLimitExceeded: boolean;
  canStartCooking: boolean;
  onStartCooking: () => void;
  isFromMealPlan: boolean;
  onShowLeftovers: () => void;
  showDeleteButton: boolean;
  onDeleteRecipe?: (recipe: SavedRecipe) => void;
  showSaveButton: boolean;
  onSaveRecipe?: (recipe: StructuredRecipe) => void;
  onSaveNonEditable: () => Promise<void>;
}

export const RecipeModalActionSection: React.FC<RecipeModalActionSectionProps> = ({
  editable,
  submitForInclusion,
  setSubmitForInclusion,
  recipeSavedCount,
  recipeSaveLimitExceeded,
  isSaving,
  onSaveEditable,
  showMarkAsMade,
  onMarkAsMade,
  onMarkAsMadeClick,
  showAddToPlan,
  onAddToPlan,
  recipe,
  onClose,
  mealPlanLimitExceeded,
  canStartCooking,
  onStartCooking,
  isFromMealPlan,
  onShowLeftovers,
  showDeleteButton,
  onDeleteRecipe,
  showSaveButton,
  onSaveRecipe,
  onSaveNonEditable,
}) => {
  return (
    <>
      <div className="sticky bottom-0 z-20 w-full bg-theme-primary rounded-b-2xl px-4 pt-2 pb-2">
        {editable ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="submitForInclusion"
                checked={submitForInclusion}
                onChange={(e) => setSubmitForInclusion(e.target.checked)}
                className="rounded border-theme"
              />
              <label htmlFor="submitForInclusion" className="text-sm text-theme-primary">
                Submit recipe for public sharing (makes it available to other users)
              </label>
            </div>

            {recipeSavedCount !== undefined && (
              <p className="text-xs text-theme-secondary text-center mb-1">
                {recipeSaveLimitExceeded ? 'Recipe limit reached - upgrade to save more' : `${recipeSavedCount} saved`}
              </p>
            )}
            <button
              onClick={onSaveEditable}
              disabled={recipeSaveLimitExceeded || isSaving}
              className={`w-full py-2 font-bold border rounded-lg flex items-center justify-center gap-2 ${
                recipeSaveLimitExceeded || isSaving
                  ? 'border-gray-400 text-gray-400 cursor-not-allowed opacity-50'
                  : 'border-[var(--accent-color)] hover:bg-[var(--accent-color)] hover:text-white'
              }`}
            >
              <Heart className="w-4 h-4" /> {isSaving ? 'Saving...' : recipeSaveLimitExceeded ? 'Limit Reached' : 'Save Recipe'}
            </button>
          </div>
        ) : (
          <>
            {/* Content for non-editable mode */}
          </>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-theme bg-theme-primary px-4 pt-2 pb-3 rounded-b-2xl space-y-2">
        {(showMarkAsMade && onMarkAsMade) || (showAddToPlan && onAddToPlan) ? (
          <div className="grid grid-cols-2 gap-2">
            {showMarkAsMade && onMarkAsMade && (
              <button onClick={onMarkAsMadeClick} className="py-2 font-bold bg-[var(--accent-color)] text-white rounded-lg flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Mark as Made
              </button>
            )}
            {showAddToPlan && onAddToPlan && (
              <button
                onClick={() => {
                  onAddToPlan(recipe);
                  onClose();
                }}
                disabled={mealPlanLimitExceeded}
                className={`py-2 font-bold rounded-lg flex items-center justify-center gap-2 ${
                  mealPlanLimitExceeded ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-50' : 'bg-[var(--accent-color)] text-white'
                }`}
              >
                <Plus className="w-4 h-4" /> {mealPlanLimitExceeded ? 'Limit Reached' : 'Add to Schedule'}
              </button>
            )}
          </div>
        ) : null}

        {canStartCooking && (
          <button
            onClick={onStartCooking}
            className="w-full py-2.5 font-bold bg-[var(--accent-color)] text-white rounded-lg flex items-center justify-center gap-2 mb-1"
          >
            <UtensilsCrossed className="w-4 h-4" /> Start Cooking
          </button>
        )}

        <div className="flex flex-col gap-1">
          <div className="flex items-stretch gap-2">
            <button className="flex-1 py-2 font-bold border border-[var(--accent-color)] rounded-lg flex items-center justify-center gap-2" onClick={onClose}>
              CLOSE
            </button>
            {isFromMealPlan && (
              <button onClick={onShowLeftovers} className="flex-1 py-2 font-bold bg-yellow-500 text-black rounded-lg flex items-center justify-center gap-2">
                <RotateCcw className="w-4 h-4" /> Save Leftovers
              </button>
            )}
            {showDeleteButton && onDeleteRecipe && (
              <button
                onClick={() => {
                  onDeleteRecipe(recipe as SavedRecipe);
                  onClose();
                }}
                className="flex-1 py-2 font-bold bg-red-500 text-white rounded-lg flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )}
            {showSaveButton && onSaveRecipe && (
              <button
                onClick={onSaveNonEditable}
                disabled={recipeSaveLimitExceeded || isSaving}
                className={`flex-1 py-2 font-bold border rounded-lg flex items-center justify-center gap-2 ${
                  recipeSaveLimitExceeded || isSaving
                    ? 'border-gray-400 text-gray-400 cursor-not-allowed opacity-50'
                    : 'border-[var(--accent-color)] hover:bg-[var(--accent-color)] hover:text-white'
                }`}
              >
                <Heart className="w-4 h-4" /> {isSaving ? 'Saving...' : recipeSaveLimitExceeded ? 'Limit Reached' : 'Save Recipe'}
              </button>
            )}
          </div>
          {showSaveButton && onSaveRecipe && recipeSavedCount !== undefined && (
            <p className="text-xs text-theme-secondary text-center">
              {recipeSaveLimitExceeded ? 'Limit reached - upgrade to save more' : `${recipeSavedCount} saved`}
            </p>
          )}
        </div>
      </div>
    </>
  );
};
