import React from 'react';
import { DayPlan, StructuredRecipe } from '../../types';
import { Select } from '../ui';
import { Modal } from '../ui/Modal';

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
  if (!pendingRecipe) return null;

  return (
    <Modal isOpen={show} onClose={onClose} title={`Add "${pendingRecipe.title}" to Meal Plan`}>
      <Modal.Body>
        <div className="space-y-4">
          <div>
            <Select
              value={selectedDayForDialog !== null ? selectedDayForDialog.toString() : ''}
              onChange={(val) => val && onSelectDay(parseInt(val))}
              options={displayPlan.map((day) => {
                const valueIndex = mealPlan.findIndex(d => d.date === day.date);
                return {
                  value: valueIndex.toString(),
                  label: `${day.dayName} - ${day.date}`
                };
              })}
              placeholder="Select a day..."
              label="Select Day:"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text mb-2">Select Meal:</label>
            <div className="grid grid-cols-3 gap-2">
              {(['breakfast', 'lunch', 'dinner'] as const).map((mealType) => (
                <button
                  key={mealType}
                  onClick={() => selectedDayForDialog !== null && onConfirm(selectedDayForDialog, mealType)}
                  className="p-3 bg-theme-secondary hover:bg-[var(--accent-color)] hover:text-[var(--accent-text,white)] border border-theme rounded-lg text-theme-text capitalize transition-colors"
                >
                  {mealType}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer align="center">
        <button
          onClick={onClose}
          className="flex-1 py-3 font-medium bg-theme-secondary text-theme-text rounded-lg hover:bg-theme-primary transition-colors"
        >
          Cancel
        </button>
      </Modal.Footer>
    </Modal>
  );
};
