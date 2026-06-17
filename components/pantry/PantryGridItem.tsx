import React from 'react';
import { ChefHat, Trash2, Plus, Clock } from 'lucide-react';
import { formatItemQuantity, getExpirationColor, getPreferredItemDisplayImage } from '../../utils/appUtils';
import { DisplayedPantryItem } from '../../hooks/usePantryFilters';

interface PantryGridItemProps {
  item: DisplayedPantryItem;
  bulkMode: boolean;
  selectedItems: Set<number>;
  toggleItemSelection: (index: number) => void;
  setSelectedItems: (items: Set<number>) => void;
  setSelectedItemIndex: (index: number) => void;
  onDeleteItem: (index: number) => void;
}

export const PantryGridItem: React.FC<PantryGridItemProps> = ({
  item,
  bulkMode,
  selectedItems,
  toggleItemSelection,
  setSelectedItems,
  setSelectedItemIndex,
  onDeleteItem
}) => {
  const daysRemaining = item.expirationDate
    ? Math.ceil((new Date(item.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : undefined;
    
  const primaryIndex = item.originalIndices ? item.originalIndices[0] : item.originalIndex;
  
  const isSelected = item.originalIndices
    ? item.originalIndices.some((idx: number) => selectedItems.has(idx))
    : selectedItems.has(primaryIndex);
    
  const expiryColor = typeof daysRemaining === 'number' ? getExpirationColor(daysRemaining, item.expirationType) : null;

  const toggleSelect = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (item.originalIndices) {
      const allSelected = item.originalIndices.every((idx: number) => selectedItems.has(idx));
      const newSelected = new Set(selectedItems);
      if (allSelected) {
        item.originalIndices.forEach((idx: number) => newSelected.delete(idx));
      } else {
        item.originalIndices.forEach((idx: number) => newSelected.add(idx));
      }
      setSelectedItems(newSelected);
    } else {
      toggleItemSelection(primaryIndex);
    }
  };

  return (
    <div
      className={`bg-theme-secondary rounded-xl border overflow-hidden flex flex-col transition-all cursor-pointer ${
        isSelected && bulkMode ? 'border-[var(--accent-color)] ring-2 ring-[var(--accent-color)]/30' : 'border-theme'
      }`}
      onClick={() => {
        if (bulkMode) { toggleSelect(); } else { setSelectedItemIndex(primaryIndex); }
      }}
    >
      {/* Image area */}
      <div className="relative aspect-square bg-theme-primary">
        <img
          src={getPreferredItemDisplayImage(item.item, item.category, item.image)}
          alt={item.item}
          className="w-full h-full object-contain p-1"
          onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder.svg'; }}
        />

        {/* Expiry badge — top left */}
        {typeof daysRemaining === 'number' && (
          <div className={`absolute top-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            expiryColor === 'red' ? 'bg-red-600/90 text-white' :
            expiryColor === 'yellow' ? 'bg-yellow-500/90 text-white' :
            'bg-green-600/90 text-white'
          }`}>
            <Clock className="w-2.5 h-2.5" />
            {Math.abs(daysRemaining)}d
          </div>
        )}

        {/* Checkbox — top right */}
        {bulkMode && (
          <button
            onClick={(e) => toggleSelect(e)}
            className={`absolute top-1.5 right-1.5 w-6 h-6 rounded flex items-center justify-center border-2 transition-colors ${
              isSelected
                ? 'bg-[var(--accent-color)] border-[var(--accent-color)]'
                : 'bg-black/30 border-white/60'
            }`}
            aria-label={isSelected ? `Deselect ${item.item}` : `Select ${item.item}`}
          >
            {isSelected && (
              <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        )}

        {/* Detail shortcut — bottom right */}
        {!bulkMode && (
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedItemIndex(primaryIndex); }}
            className="absolute bottom-1.5 right-1.5 w-8 h-8 rounded-full bg-white/90 dark:bg-gray-800/90 flex items-center justify-center shadow-md hover:scale-105 transition-transform"
            aria-label={`View details for ${item.item}`}
          >
            <ChefHat className="w-4 h-4 text-theme-primary" />
          </button>
        )}
      </div>

      {/* Item name */}
      <div className="px-2 pt-1.5 pb-0.5">
        <p className="text-xs font-medium text-theme-primary truncate leading-tight">{item.item}</p>
      </div>

      {/* Actions row */}
      <div className="flex items-center justify-between px-2 pb-2 mt-auto">
        <button
          onClick={(e) => { e.stopPropagation(); onDeleteItem(primaryIndex); }}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          aria-label={`Delete ${item.item}`}
        >
          <Trash2 className="w-3.5 h-3.5 text-theme-secondary" />
        </button>
        <span className="text-[11px] text-theme-secondary text-center leading-none">{formatItemQuantity(item) || '—'}</span>
        <button
          onClick={(e) => { e.stopPropagation(); setSelectedItemIndex(primaryIndex); }}
          className="w-7 h-7 flex items-center justify-center rounded-full border border-theme hover:bg-theme-primary transition-colors"
          aria-label={`Edit quantity for ${item.item}`}
        >
          <Plus className="w-3.5 h-3.5 text-theme-secondary" />
        </button>
      </div>
    </div>
  );
};

