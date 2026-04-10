import React from 'react';
import { ShoppingItem } from '../types';
import { useAppActions } from '../contexts/AppActionsContext';

interface BatchOperationsProps {
  items: ShoppingItem[];
  onBatchCheck: (itemIds: string[]) => void;
  onBatchUncheck: (itemIds: string[]) => void;
  onDeleteSelected?: (itemIds: string[]) => void;
}

export const BatchOperations: React.FC<BatchOperationsProps> = ({
  items,
  onBatchCheck,
  onBatchUncheck,
  onDeleteSelected
}) => {
  const { addToast } = useAppActions();

  const handleSelectAll = () => {
    const uncheckedItems = items.filter(item => !item.checked);
    onBatchCheck(uncheckedItems.map(item => item.id));
  };

  const handleDeleteSelected = () => {
    if (!onDeleteSelected) return;
    const checkedItems = items.filter(item => item.checked);
    if (checkedItems.length === 0) return;
    const itemIds = checkedItems.map(item => item.id);
    onDeleteSelected(itemIds);
    addToast(`Deleted ${checkedItems.length} item${checkedItems.length > 1 ? 's' : ''}`, 'success');
  };

  const checkedCount = items.filter(item => item.checked).length;

  if (items.length === 0) return null;

  return (
    <div className="bg-theme-secondary rounded-xl p-4 border border-theme">
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleSelectAll}
          className="px-3 py-1 rounded-lg text-sm font-medium bg-theme-secondary text-theme-primary hover:bg-theme-primary border border-theme transition-colors"
          aria-label={checkedCount === items.length ? 'Deselect all items' : 'Select all items'}
          data-testid="batch-select-all"
        >
          {checkedCount === items.length ? 'Deselect All' : 'Select All'}
        </button>
        
        {checkedCount > 0 && onDeleteSelected && (
          <button
            onClick={handleDeleteSelected}
            className="px-3 py-1 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
            aria-label={`Delete ${checkedCount} selected items`}
            data-testid="batch-delete-selected"
          >
            Delete Selected ({checkedCount})
          </button>
        )}
      </div>
    </div>
  );
};

export default BatchOperations;