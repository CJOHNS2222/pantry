import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { List } from 'react-window';
const ReactWindowList = List as any;
import StorageLocationIndicator from './StorageLocationIndicator';
import { PantryGridItem } from './PantryGridItem';
import { PantryListItem } from './PantryListItem';
import { DisplayedPantryItem } from '../../hooks/usePantryFilters';
import { PantryItem } from '../../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const VirtualizedRow = ({ index, style, data }: { index: number; style: React.CSSProperties; data: any }) => {
  return data.renderRow(index, style);
};

interface PantryListViewProps {
  viewMode: 'category' | 'storage';
  displayLayout: 'list' | 'grid';
  sortedCategories: string[];
  expandedCategories: Set<string>;
  toggleCategory: (category: string) => void;
  categoryItemsArrays: Record<string, DisplayedPantryItem[]>;
  storageSectionOrder: string[];
  storageItemsArrays: Record<string, DisplayedPantryItem[]>;
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
  onDeleteItem: (index: number) => void;
}

export const PantryListView: React.FC<PantryListViewProps> = ({
  viewMode,
  displayLayout,
  sortedCategories,
  expandedCategories,
  toggleCategory,
  categoryItemsArrays,
  storageSectionOrder,
  storageItemsArrays,
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
  onDeleteItem
}) => {
  const storageLabels: Record<string, string> = {
    leftovers: 'Leftovers',
    pantry: 'Pantry',
    fridge: 'Refrigerator', 
    freezer: 'Freezer',
    spices: 'Spices & Herbs',
    other: 'Other'
  };

  const CATEGORY_VIRTUALIZE_THRESHOLD = 20;


  // Virtualized row for category view
  const renderCategoryItem = ({ index, style, category }: { index: number; style: React.CSSProperties; category: string }) => {
    const items = categoryItemsArrays[category] || [];
    const item = items[index];
    if (!item) return null;
    return (
      <PantryListItem
        item={item}
        style={style}
        bulkMode={bulkMode}
        selectedItems={selectedItems}
        toggleItemSelection={toggleItemSelection}
        setSelectedItems={setSelectedItems}
        setSelectedItemIndex={setSelectedItemIndex}
        setFreezeTargetIndex={setFreezeTargetIndex}
        householdId={householdId}
        onUpdateItem={onUpdateItem}
        getRowActionHandlers={getRowActionHandlers}
        appActions={appActions}
      />
    );
  };

  // Virtualized row for storage view
  const renderStorageItem = ({ index, style, location }: { index: number; style: React.CSSProperties; location: string }) => {
    const items = storageItemsArrays[location] || [];
    const item = items[index];
    if (!item) return null;
    return (
      <PantryListItem
        item={item}
        style={style}
        bulkMode={bulkMode}
        selectedItems={selectedItems}
        toggleItemSelection={toggleItemSelection}
        setSelectedItems={setSelectedItems}
        setSelectedItemIndex={setSelectedItemIndex}
        setFreezeTargetIndex={setFreezeTargetIndex}
        householdId={householdId}
        onUpdateItem={onUpdateItem}
        getRowActionHandlers={getRowActionHandlers}
        appActions={appActions}
      />
    );
  };

  const categoryViewContent = sortedCategories.map(category => {
    const items = categoryItemsArrays[category] || [];
    return (
      <div key={category} className="bg-theme-secondary rounded-lg border border-theme overflow-hidden">
        <div
          onClick={() => toggleCategory(category)}
          className="w-full flex items-center p-4 bg-[var(--accent-color)]/10 hover:bg-[var(--accent-color)]/20 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div
              className="p-1 rounded hover:bg-theme-primary/50 transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                toggleCategory(category);
              }}
            >
              {expandedCategories.has(category) ? (
                <ChevronDown className="w-5 h-5 text-theme-primary" />
              ) : (
                <ChevronRight className="w-5 h-5 text-theme-primary" />
              )}
            </div>
            <h4 className="font-semibold text-theme-primary">{category}</h4>
            <span className="text-sm text-theme-secondary opacity-70">
              ({items.length} item{items.length !== 1 ? 's' : ''})
            </span>
          </div>
        </div>

        {expandedCategories.has(category) && (
          <div className="border-t border-theme">
            {displayLayout === 'grid' ? (
              <div className="grid grid-cols-3 gap-2 p-2">
                {items.map(item => (
                  <PantryGridItem
                    key={item.originalIndices ? item.originalIndices[0] : item.originalIndex}
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
            ) : items.length > CATEGORY_VIRTUALIZE_THRESHOLD ? (
              <ReactWindowList
                height={Math.min(400, items.length * 64)}
                itemCount={items.length}
                itemSize={64}
                width={'100%'}
                itemData={{
                  selectedItems,
                  bulkMode,
                  items,
                  renderRow: (index: number, style: React.CSSProperties) => renderCategoryItem({ index, style, category })
                }}
              >
                {VirtualizedRow as any}
              </ReactWindowList>
            ) : (
              items.map(item => (
                <PantryListItem
                  key={item.originalIndices ? item.originalIndices[0] : item.originalIndex}
                  item={item}
                  bulkMode={bulkMode}
                  selectedItems={selectedItems}
                  toggleItemSelection={toggleItemSelection}
                  setSelectedItems={setSelectedItems}
                  setSelectedItemIndex={setSelectedItemIndex}
                  setFreezeTargetIndex={setFreezeTargetIndex}
                  householdId={householdId}
                  onUpdateItem={onUpdateItem}
                  getRowActionHandlers={getRowActionHandlers}
                  appActions={appActions}
                />
              ))
            )}
          </div>
        )}
      </div>
    );
  });

  const storageViewContent = storageSectionOrder.map(location => {
    const items = storageItemsArrays[location] || [];
    const locationLabel = storageLabels[location] || location;

    return (
      <div key={location} className="bg-theme-secondary rounded-lg border border-theme overflow-hidden">
        <div className="w-full flex items-center px-4 py-2 bg-theme-primary">
          <div className="flex items-center gap-3">
            <StorageLocationIndicator
              location={location as 'pantry' | 'freezer' | 'fridge' | 'spices' | 'other' | 'leftovers'}
              size="md"
            />
            <h4 className="font-semibold text-theme-primary">{locationLabel}</h4>
            <span className="text-sm text-theme-secondary">
              ({items.length} item{items.length !== 1 ? 's' : ''})
            </span>
          </div>
        </div>

        <div className="border-t border-theme">
          {items.length === 0 ? (
            <div className="p-4 text-center text-theme-secondary opacity-50 text-sm">
              No items in {locationLabel.toLowerCase()}
            </div>
          ) : displayLayout === 'grid' ? (
            <div className="grid grid-cols-3 gap-2 p-2">
              {items.map(item => (
                <PantryGridItem
                  key={item.originalIndices ? item.originalIndices[0] : item.originalIndex}
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
          ) : items.length > CATEGORY_VIRTUALIZE_THRESHOLD ? (
            <ReactWindowList
              height={Math.min(400, items.length * 64)}
              itemCount={items.length}
              itemSize={64}
              width={'100%'}
              itemData={{
                selectedItems,
                bulkMode,
                items,
                renderRow: (index: number, style: React.CSSProperties) => renderStorageItem({ index, style, location })
              }}
            >
              {VirtualizedRow as any}
            </ReactWindowList>
          ) : (
            items.map(item => (
              <PantryListItem
                key={item.originalIndices ? item.originalIndices[0] : item.originalIndex}
                item={item}
                bulkMode={bulkMode}
                selectedItems={selectedItems}
                toggleItemSelection={toggleItemSelection}
                setSelectedItems={setSelectedItems}
                setSelectedItemIndex={setSelectedItemIndex}
                setFreezeTargetIndex={setFreezeTargetIndex}
                householdId={householdId}
                onUpdateItem={onUpdateItem}
                getRowActionHandlers={getRowActionHandlers}
                appActions={appActions}
              />
            ))
          )}
        </div>
      </div>
    );
  });

  return (
    <div className="space-y-4">
      {viewMode === 'category' ? categoryViewContent : storageViewContent}
    </div>
  );
};


