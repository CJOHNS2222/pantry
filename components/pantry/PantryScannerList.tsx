import React from 'react';
import { PantryItem } from '../../types';
import { PantryListItem } from './PantryListItem';
import { PantryGridItem } from './PantryGridItem';
import { PantryItemSkeleton } from '../ui/SkeletonLoader';
import { ShoppingBasket } from 'lucide-react';

export type DisplayedPantryItem = PantryItem & {
  originalIndex: number;
  originalIndices?: number[];
  combinedItems?: PantryItem[];
  totalQuantity?: number;
};

interface PantryScannerListProps {
  items: DisplayedPantryItem[];
  displayLayout: 'list' | 'grid';
  isLoading?: boolean;
  bulkMode: boolean;
  selectedItems: Set<number>;
  toggleItemSelection: (index: number) => void;
  setSelectedItems: (items: Set<number>) => void;
  setSelectedItemIndex: (index: number) => void;
  setFreezeTargetIndex?: (index: number) => void;
  householdId?: string;
  onUpdateItem: (index: number, updates: Partial<PantryItem>) => Promise<void>;
  onDeleteItem: (index: number) => void;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  getRowActionHandlers?: (item: DisplayedPantryItem) => any;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  appActions?: any;
}

export const PantryScannerList: React.FC<PantryScannerListProps> = React.memo(({
  items,
  displayLayout,
  isLoading = false,
  bulkMode,
  selectedItems,
  toggleItemSelection,
  setSelectedItems,
  setSelectedItemIndex,
  setFreezeTargetIndex,
  householdId,
  onUpdateItem,
  onDeleteItem,
  getRowActionHandlers,
  appActions
}) => {
  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <PantryItemSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-[var(--bg-primary)] flex items-center justify-center text-[var(--text-secondary)]">
          <ShoppingBasket className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">No pantry items found</h3>
        <p className="text-xs text-[var(--text-secondary)] max-w-xs">
          Try adjusting your search query or filters, or add your first item to get started.
        </p>
      </div>
    );
  }

  if (displayLayout === 'grid') {
    return (
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {items.map((item, index) => (
          <PantryGridItem
            key={item.id || index}
            item={item}
            bulkMode={bulkMode}
            selectedItems={selectedItems}
            toggleItemSelection={toggleItemSelection}
            setSelectedItems={setSelectedItems}
            setSelectedItemIndex={setSelectedItemIndex}
            onDeleteItem={onDeleteItem}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      {items.map((item, index) => (
        <PantryListItem
          key={item.id || index}
          item={item}
          bulkMode={bulkMode}
          selectedItems={selectedItems}
          toggleItemSelection={toggleItemSelection}
          setSelectedItems={setSelectedItems}
          setSelectedItemIndex={setSelectedItemIndex}
          setFreezeTargetIndex={setFreezeTargetIndex || (() => {})}
          householdId={householdId}
          onUpdateItem={onUpdateItem}
          getRowActionHandlers={getRowActionHandlers || (() => ({}))}
          appActions={appActions}
        />
      ))}
    </div>
  );
});

PantryScannerList.displayName = 'PantryScannerList';
