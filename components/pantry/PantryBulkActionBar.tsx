import React from 'react';
import { Trash2, ShoppingBasket, Edit3 } from 'lucide-react';

interface PantryBulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  bulkLocationValue: string;
  setBulkLocationValue: (val: string) => void;
  onSelectAll: () => void;
  onBulkDelete: () => Promise<void>;
  onBulkMoveToShoppingList: () => Promise<void>;
  onBulkChangeLocation: (loc: 'pantry' | 'fridge' | 'freezer' | 'spices' | 'other') => Promise<void>;
  onOpenBulkQuantityEdit: () => void;
  onExitBulkMode: () => void;
}

export const PantryBulkActionBar: React.FC<PantryBulkActionBarProps> = ({
  selectedCount,
  totalCount,
  bulkLocationValue,
  setBulkLocationValue,
  onSelectAll,
  onBulkDelete,
  onBulkMoveToShoppingList,
  onBulkChangeLocation,
  onOpenBulkQuantityEdit,
  onExitBulkMode,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto z-40 bg-theme-secondary border border-theme rounded-2xl p-3 shadow-2xl backdrop-blur-lg animate-slide-up flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-theme-primary">
          {selectedCount} item{selectedCount > 1 ? 's' : ''} selected
        </span>
        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            className="text-xs text-[var(--accent-color)] font-medium hover:underline"
          >
            {selectedCount === totalCount ? 'Deselect All' : 'Select All'}
          </button>
          <button
            onClick={onExitBulkMode}
            className="text-xs text-theme-secondary opacity-70 hover:opacity-100"
          >
            Done
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-theme">
        {/* Change Storage Location Dropdown */}
        <div className="relative col-span-1">
          <select
            value={bulkLocationValue}
            onChange={(e) => {
              const val = e.target.value as 'pantry' | 'fridge' | 'freezer' | 'spices' | 'other';
              if (val) {
                setBulkLocationValue(val);
                void onBulkChangeLocation(val);
              }
            }}
            className="w-full flex items-center justify-center gap-1 py-2 px-1 rounded-xl bg-theme-primary border border-theme text-xs font-semibold text-theme-primary appearance-none cursor-pointer text-center"
          >
            <option value="" disabled>Location</option>
            <option value="pantry">Pantry</option>
            <option value="fridge">Fridge</option>
            <option value="freezer">Freezer</option>
            <option value="spices">Spices</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Move to Shopping List */}
        <button
          onClick={onBulkMoveToShoppingList}
          className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-600/20 hover:bg-blue-600/20 text-xs font-bold transition-colors"
        >
          <ShoppingBasket className="w-3.5 h-3.5" />
          <span>Shopping</span>
        </button>

        {/* Bulk Edit Quantities */}
        <button
          onClick={onOpenBulkQuantityEdit}
          className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-theme-primary text-theme-primary border border-theme hover:bg-theme-secondary text-xs font-bold transition-colors"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Edit Qty</span>
        </button>

        {/* Delete Selected */}
        <button
          onClick={onBulkDelete}
          className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 text-xs font-bold transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
};
