import React from 'react';
import { DayPlan, StructuredRecipe } from '../../types';

interface AddMealDialogProps {
  show: boolean;
  pendingRecipe: StructuredRecipe | null;
  displayPlan: DayPlan[];
  mealPlan: DayPlan[];
  selectedDayForDialog: number | null;
  onSelectDay: (dayIndex: number) => void;
  onConfirm: (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner') => void;
  onClose: () => void;
}

export const AddMealDialog: React.FC<AddMealDialogProps> = ({
  show,
  pendingRecipe,
  displayPlan,
  mealPlan,
  selectedDayForDialog,
  onSelectDay,
  onConfirm,
  onClose
}) => {
  if (!show || !pendingRecipe) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-theme-primary rounded-2xl p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-bold text-theme-text mb-4 text-center">
          Add "{pendingRecipe.title}" to Meal Plan
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-theme-text mb-2">Select Day:</label>
            <select
              className="w-full p-3 bg-theme-secondary border border-theme rounded-lg text-theme-text"
              onChange={(e) => onSelectDay(parseInt(e.target.value))}
              defaultValue=""
            >
              <option value="" disabled>Select a day...</option>
              {displayPlan.map((day) => {
                const valueIndex = mealPlan.findIndex(d => d.date === day.date);
                return (
                  <option key={day.date} value={valueIndex}>
                    {day.dayName} - {day.date}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text mb-2">Select Meal:</label>
            <div className="grid grid-cols-3 gap-2">
              {(['breakfast', 'lunch', 'dinner'] as const).map((mealType) => (
                <button
                  key={mealType}
                  onClick={() => selectedDayForDialog !== null && onConfirm(selectedDayForDialog, mealType)}
                  className="p-3 bg-theme-secondary hover:bg-[var(--accent-color)] hover:text-white border border-theme rounded-lg text-theme-text capitalize transition-colors"
                >
                  {mealType}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 font-medium bg-theme-secondary text-theme-text rounded-lg hover:bg-theme-primary transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
