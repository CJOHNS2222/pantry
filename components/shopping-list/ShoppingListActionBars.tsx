import React from 'react';
import { Archive, X, CheckSquare, Square } from 'lucide-react';

interface ShoppingListActionBarsProps {
  hasItems: boolean;
  isLoadingShoppingList: boolean;
  undoHistoryCount: number;
  hasCheckedItems: boolean;
  hasUncheckedItems: boolean;
  checkedItemsCount: number;
  onUndoLastCheck: () => void;
  onCheckout: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDeleteCheckedItems: () => void;
}

export const ShoppingListActionBars: React.FC<ShoppingListActionBarsProps> = ({
  hasItems,
  isLoadingShoppingList,
  undoHistoryCount,
  hasCheckedItems,
  hasUncheckedItems,
  checkedItemsCount,
  onUndoLastCheck,
  onCheckout,
  onSelectAll,
  onDeselectAll,
  onDeleteCheckedItems,
}) => {
  if (!hasItems) return null;

  return (
    <>
      <div className="flex gap-2 justify-between items-center">
        {undoHistoryCount > 0 && (
          <button
            onClick={onUndoLastCheck}
            className="flex items-center gap-1 px-2 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600 transition-colors"
            title={`Undo last check (${undoHistoryCount} available)`}
          >
            <X className="w-3 h-3" />
            Undo ({undoHistoryCount})
          </button>
        )}

        {hasCheckedItems && (
          <button
            onClick={onCheckout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all bg-[var(--accent-color)] text-white shadow-lg"
          >
            <Archive className="w-3 h-3" /> Move Checked to Pantry
          </button>
        )}
      </div>

      {!isLoadingShoppingList && (
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            {/* Tiny select all / deselect all icon button */}
            <button
              onClick={hasUncheckedItems ? onSelectAll : onDeselectAll}
              className="p-1.5 rounded transition-colors hover:bg-theme-secondary"
              title={hasUncheckedItems ? 'Select all' : 'Deselect all'}
              aria-label={hasUncheckedItems ? 'Select all' : 'Deselect all'}
            >
              {hasUncheckedItems ? (
                <Square className="w-4 h-4 text-[var(--accent-color)]" />
              ) : (
                <CheckSquare className="w-4 h-4 text-theme-secondary" />
              )}
            </button>

            {hasCheckedItems && (
              <button
                onClick={onDeleteCheckedItems}
                className="text-xs font-medium text-red-500 hover:opacity-80 transition-opacity py-1 px-2 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Clear purchased ({checkedItemsCount})
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};