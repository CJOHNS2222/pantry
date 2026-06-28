import React from 'react';
import { Archive, X, Square } from 'lucide-react';

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
    <div className="space-y-3">
      {/* Undo row */}
      {undoHistoryCount > 0 && (
        <div className="flex justify-start">
          <button
            onClick={onUndoLastCheck}
            className="flex items-center gap-1 px-2 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600 transition-colors"
            title={`Undo last check (${undoHistoryCount} available)`}
          >
            <X className="w-3 h-3" />
            Undo ({undoHistoryCount})
          </button>
        </div>
      )}

      {/* Action Bar Box */}
      {hasCheckedItems ? (
        <div className="bg-theme-secondary border border-theme rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-fade-in">
          {/* Left side: Selection status and Deselect All */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-theme-primary">
              {checkedItemsCount} selected
            </span>
            <button
              onClick={onDeselectAll}
              className="text-xs font-medium text-[var(--accent-color)] hover:underline focus:outline-none"
            >
              Deselect All
            </button>
            {hasUncheckedItems && (
              <>
                <span className="text-theme-secondary opacity-30 text-xs">|</span>
                <button
                  onClick={onSelectAll}
                  className="text-xs font-medium text-[var(--accent-color)] hover:underline focus:outline-none"
                >
                  Select All
                </button>
              </>
            )}
          </div>

          {/* Right side: Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onDeleteCheckedItems}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400 transition-colors"
            >
              Delete Selected
            </button>
            <button
              onClick={onCheckout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-[var(--accent-color)] text-white hover:bg-[var(--accent-color)]/95 shadow transition-all"
            >
              <Archive className="w-3.5 h-3.5" /> Move Checked to Pantry
            </button>
          </div>
        </div>
      ) : (
        /* If no items checked, show a simple Select All button */
        !isLoadingShoppingList && hasUncheckedItems && (
          <div className="flex justify-start">
            <button
              onClick={onSelectAll}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-theme bg-theme-secondary hover:bg-theme-primary transition-colors text-xs font-medium text-theme-secondary"
            >
              <Square className="w-3.5 h-3.5 text-[var(--accent-color)]" />
              Select All Items
            </button>
          </div>
        )
      )}
    </div>
  );
};