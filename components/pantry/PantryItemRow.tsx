import React from 'react';
import { ChevronRight, Clock } from 'lucide-react';
import { DisplayedPantryItem } from './usePantryFilterSort';
import StorageLocationIndicator from './StorageLocationIndicator';
import { formatItemQuantity, getExpirationColor } from '../../utils/appUtils';

import HapticService from '../../services/hapticService';

interface PantryItemRowProps {
  item: DisplayedPantryItem;
  bulkMode: boolean;
  isSelected: boolean;
  onToggleSelect: (index: number) => void;
  onSelectItem: (index: number) => void;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  getRowActionHandlers: (item: DisplayedPantryItem) => any;
}

export const PantryItemRow: React.FC<PantryItemRowProps> = ({
  item,
  bulkMode,
  isSelected,
  onToggleSelect,
  onSelectItem,
  getRowActionHandlers,
}) => {
  return (
    <div
      {...getRowActionHandlers(item)}
      onClick={() => {
        HapticService.light();
        if (bulkMode) {
          onToggleSelect(item.originalIndex);
        } else {
          onSelectItem(item.originalIndex);
        }
      }}
      className={`group relative bg-theme-secondary rounded-xl p-3 border transition-all hover:shadow-md cursor-pointer select-none ${
        isSelected && bulkMode ? 'border-[var(--accent-color)] ring-2 ring-[var(--accent-color)]/30' : 'border-theme'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Bulk Selection Checkbox */}
        {bulkMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(item.originalIndex);
            }}
            className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors flex-shrink-0 ${
              isSelected
                ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white'
                : 'border-theme-secondary hover:border-[var(--accent-color)]'
            }`}
            aria-label={isSelected ? `Deselect ${item.item}` : `Select ${item.item}`}
          >
            {isSelected && (
              <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        )}

        {/* Storage Location Icon */}
        <StorageLocationIndicator location={(item.storageLocation || 'pantry') as 'pantry' | 'freezer' | 'fridge' | 'spices' | 'other' | 'leftovers'} className="flex-shrink-0" />

        {/* Item Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-theme-primary truncate text-sm">
              {item.item}
            </h3>
            {item.is_leftover && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 flex-shrink-0">
                Leftover
              </span>
            )}
          </div>
          {item.category && (
            <p className="text-xs text-theme-secondary opacity-70 truncate">
              {item.category}
            </p>
          )}
        </div>

        {/* Expiration Status / Badges */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {(() => {
            if (!item.expirationDate || item.is_immortal) return null;
            const daysRemaining = Math.ceil(
              (new Date(item.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            const color = getExpirationColor(daysRemaining, item.expirationType);
            const expiryLabel = `${daysRemaining} days remaining`;
            return (
              <div
                className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                  color === 'red' ? 'bg-red-100 text-red-800' :
                  color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}
                aria-label={expiryLabel}
              >
                {daysRemaining}d
              </div>
            );
          })()}
          {item.expiryAlertShown && (
            <Clock className="w-4 h-4 text-orange-500 flex-shrink-0" aria-label="Expires within 7 days" />
          )}
          {item.is_immortal && (
            <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-blue-100 text-blue-800 flex items-center gap-1 flex-shrink-0">
              <span aria-hidden>∞</span>
              <span className="opacity-90">Shelf Stable</span>
            </span>
          )}
        </div>

        {/* Quantity */}
        <div className="text-xs text-theme-secondary opacity-70 bg-theme-secondary px-2 py-0.5 rounded border border-theme flex-shrink-0">
          Qty: {formatItemQuantity(item)}
        </div>

        {/* Chevron */}
        {!bulkMode && (
          <div className="flex items-center gap-2 text-theme-secondary opacity-50 flex-shrink-0">
            <ChevronRight className="w-5 h-5 flex-shrink-0" />
          </div>
        )}
      </div>
    </div>
  );
};
