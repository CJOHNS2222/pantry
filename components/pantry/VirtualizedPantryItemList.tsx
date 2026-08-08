import React from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import { DisplayedPantryItem } from './usePantryFilterSort';
import { PantryItemRow } from './PantryItemRow';
import { PantryRowActionHandlers } from './usePantryQuickConsume';

const ROW_HEIGHT = 76;
const MAX_VISIBLE_HEIGHT = 640;
export const VIRTUALIZE_THRESHOLD = 50;

interface VirtualizedPantryItemListProps {
  items: DisplayedPantryItem[];
  bulkMode: boolean;
  isSelected: (index: number) => boolean;
  onToggleSelect: (index: number) => void;
  onSelectItem: (index: number) => void;
  getRowActionHandlers: (item: DisplayedPantryItem) => PantryRowActionHandlers;
  consumeGestureSuppression?: () => boolean;
}

export const VirtualizedPantryItemList: React.FC<VirtualizedPantryItemListProps> = ({
  items,
  bulkMode,
  isSelected,
  onToggleSelect,
  onSelectItem,
  getRowActionHandlers,
  consumeGestureSuppression,
}) => {
  const Row = ({ index, style }: ListChildComponentProps) => {
    const item = items[index];
    return (
      <div style={style} className="pb-2">
        <PantryItemRow
          item={item}
          bulkMode={bulkMode}
          isSelected={isSelected(item.originalIndex)}
          onToggleSelect={onToggleSelect}
          onSelectItem={onSelectItem}
          getRowActionHandlers={getRowActionHandlers}
          consumeGestureSuppression={consumeGestureSuppression}
        />
      </div>
    );
  };

  const height = Math.min(items.length * ROW_HEIGHT, MAX_VISIBLE_HEIGHT);

  return (
    <FixedSizeList
      height={height}
      width="100%"
      itemCount={items.length}
      itemSize={ROW_HEIGHT}
      itemKey={(index) => items[index].id}
    >
      {Row}
    </FixedSizeList>
  );
};
