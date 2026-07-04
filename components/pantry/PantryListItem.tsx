import React from 'react';
import { ChevronRight, Clock } from 'lucide-react';
import { ProgressiveImage } from '../ui/ProgressiveImage';
import { formatItemQuantity, getExpirationColor, getPreferredItemDisplayImage } from '../../utils/appUtils';
import { DisplayedPantryItem } from '../../hooks/usePantryFilters';
import { PantryItem } from '../../types';

interface PantryListItemProps {
  item: DisplayedPantryItem;
  bulkMode: boolean;
  selectedItems: Set<number>;
  toggleItemSelection: (index: number) => void;
  setSelectedItems: (items: Set<number>) => void;
  setSelectedItemIndex: (index: number) => void;
  setFreezeTargetIndex: (index: number) => void;
  householdId?: string;
  onUpdateItem: (index: number, updates: Partial<PantryItem>) => Promise<void>;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  getRowActionHandlers: (item: DisplayedPantryItem) => any;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  appActions: any;
  style?: React.CSSProperties;
}

export const PantryListItem: React.FC<PantryListItemProps> = ({
  item,
  bulkMode,
  selectedItems,
  toggleItemSelection,
  setSelectedItems,
  setSelectedItemIndex,
  setFreezeTargetIndex,
  householdId,
  onUpdateItem,
  getRowActionHandlers,
  appActions,
  style
}) => {
  const daysRemaining = item.expirationDate ? Math.ceil((new Date(item.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : undefined;
  
  const expirationHeatClass = (d?: number) => {
    if (d == null || item.is_immortal) return '';
    if (d <= 0) return 'bg-red-500/10 dark:bg-red-500/15 border-l-4 border-l-red-500';
    if (d <= 3) return 'bg-yellow-500/10 dark:bg-yellow-500/15 border-l-4 border-l-yellow-500';
    return '';
  };
  
  const expirationBorderClass = (d?: number) => {
    if (d == null || item.is_immortal) return '';
    const c = getExpirationColor(d, item.expirationType);
    return c === 'red' ? 'ring-2 ring-red-300/40' : c === 'yellow' ? 'ring-2 ring-yellow-300/30' : '';
  };

  const primaryIndex = item.originalIndices ? item.originalIndices[0] : item.originalIndex;
  
  const isSelected = item.originalIndices 
    ? item.originalIndices.some((idx: number) => selectedItems.has(idx)) 
    : selectedItems.has(primaryIndex);

  return (
    <div 
      style={style} 
      className={`flex items-center justify-between px-2 py-1 border-b border-theme last:border-b-0 transition-all cursor-pointer ${expirationBorderClass(daysRemaining)} ${expirationHeatClass(daysRemaining)} ${
        isSelected && bulkMode
          ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)]/30'
          : 'hover:bg-theme-primary/50'
      }`}
      {...getRowActionHandlers(item)}
      onClick={() => {
        if (!bulkMode) setSelectedItemIndex(primaryIndex);
      }}
    >
      {/* Left section: Checkbox, Image, Item Name */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {bulkMode && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {
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
            }}
            className="w-4 h-4 text-[var(--accent-color)] bg-theme-primary border-theme rounded focus:ring-[var(--accent-color)] flex-shrink-0"
          />
        )}

        <ProgressiveImage
          src={getPreferredItemDisplayImage(item.item, item.category, item.image)}
          alt={item.item}
          className="w-10 h-10 rounded-lg object-cover bg-theme-primary border border-theme flex-shrink-0"
          placeholderSrc="/images/placeholder.svg"
          lazy={true}
        />

        <div className="font-medium text-theme-primary truncate">{item.item}</div>
      </div>

      {/* Right section: Expiration, Quantity, Actions, Chevron */}
      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
        {/* Expiration date */}
        <div className="flex items-center gap-1.5">
          {item.expirationDate && (() => {
            const color = getExpirationColor(daysRemaining as number, item.expirationType);
            const expiryLabel = (daysRemaining as number) <= 0
              ? `${item.item} has expired`
              : `${item.item} expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} — ${color === 'red' ? 'critical' : color === 'yellow' ? 'warning' : 'ok'}`;
            return (
              <div
                className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  color === 'red' ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300' :
                  color === 'yellow' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300' :
                  'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300'
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
            <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 flex items-center gap-1 flex-shrink-0">
              <span aria-hidden>∞</span>
              <span className="opacity-90">Shelf Stable</span>
            </span>
          )}
        </div>

        {/* Quantity */}
        <div className="text-xs text-theme-secondary opacity-70 bg-theme-secondary px-2 py-0.5 rounded border border-theme flex-shrink-0">
          Qty: {formatItemQuantity(item)}
        </div>

        {/* Action Buttons & Chevron */}
        {!bulkMode && (
          <div className="flex items-center gap-2 text-theme-secondary opacity-50 flex-shrink-0">
            {householdId && item.id && item.storageLocation !== 'freezer' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFreezeTargetIndex(primaryIndex);
                }}
                className="px-2 py-1 rounded bg-theme-secondary hover:bg-theme-primary text-xs cursor-pointer"
                title="Move to freezer"
              >
                ❄️ Freeze
              </button>
            )}
            {householdId && item.id && (item.storageLocation === 'freezer' || item.is_frozen) && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const previous = { storageLocation: item.storageLocation, is_frozen: item.is_frozen, expirationDate: item.expirationDate };
                    await onUpdateItem(primaryIndex, { storageLocation: 'fridge', is_frozen: false });
                    appActions.addToast(
                      'Defrosted to fridge',
                      'success',
                      5000,
                      'Undo',
                      async () => {
                        try {
                          await onUpdateItem(primaryIndex, previous);
                        } catch {
                          // ignore
                        }
                      }
                    );
                  } catch {
                    appActions.addToast('Failed to defrost item', 'error');
                  }
                }}
                className="px-2 py-1 rounded bg-theme-secondary hover:bg-theme-primary text-xs cursor-pointer"
                title="Move to fridge (defrost)"
              >
                🌡️ Defrost
              </button>
            )}
            <ChevronRight className="w-5 h-5 flex-shrink-0" />
          </div>
        )}
      </div>
    </div>
  );
};


