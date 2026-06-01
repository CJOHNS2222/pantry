import React from 'react';
import { Archive, X } from 'lucide-react';

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

        <div className="flex gap-2">
          <button
            onClick={onCheckout}
            disabled={!hasCheckedItems}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              hasCheckedItems
                ? 'bg-[var(--accent-color)] text-white shadow-lg'
                : 'bg-theme-secondary text-theme-secondary opacity-50 cursor-not-allowed'
            }`}
          >
            <Archive className="w-4 h-4" /> Move Checked to Pantry
          </button>
        </div>
      </div>

      {!isLoadingShoppingList && (
        <div className="flex items-center justify-between gap-2 mb-1">
          {hasUncheckedItems ? (
            <button
              onClick={onSelectAll}
              className="text-xs font-medium text-[var(--accent-color)] hover:opacity-80 transition-opacity py-1 px-2 rounded-md hover:bg-[var(--accent-color)]/10"
            >
              Mark all purchased
            </button>
          ) : (
            <button
              onClick={onDeselectAll}
              className="text-xs font-medium text-theme-secondary hover:opacity-80 transition-opacity py-1 px-2 rounded-md hover:bg-theme-secondary/50"
            >
              Unmark all
            </button>
          )}

          {hasCheckedItems && (
            <button
              onClick={onDeleteCheckedItems}
              className="text-xs font-medium text-red-500 hover:opacity-80 transition-opacity py-1 px-2 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Clear purchased ({checkedItemsCount})
            </button>
          )}
        </div>
      )}
    </>
  );
};
