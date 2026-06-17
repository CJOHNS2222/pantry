import React from 'react';
import { useIntl } from 'react-intl';
import { ShoppingBasket, Plus } from 'lucide-react';
import { ShoppingItem } from '../../types';
import { ShoppingListItemSkeleton } from '../ui/SkeletonLoader';
import { SmartShoppingListOrganizer } from './SmartShoppingListOrganizer';
import { EnhancedShoppingListItem } from './EnhancedShoppingListItem';

interface ShoppingListItemsSectionProps {
  isLoadingShoppingList: boolean;
  viewMode: 'list' | 'organized';
  items: ShoppingItem[];
  activeStoreLayout: string[] | undefined;
  householdMembers: Array<{ id: string; name: string; avatar?: string }>;
  isOffline: boolean;
  showPriceData: boolean;
  onToggleCheck: (id: string) => void;
  onRemove: (id: string) => void;
  onQuantityChange: (id: string, quantity: string) => void;
  onUpdateItem: (id: string, updates: Partial<ShoppingItem>) => void;
  onOpenAddItems: () => void;
  onBrowseRecipes: () => void;
}

export const ShoppingListItemsSection: React.FC<ShoppingListItemsSectionProps> = ({
  isLoadingShoppingList,
  viewMode,
  items,
  activeStoreLayout,
  householdMembers,
  isOffline,
  showPriceData,
  onToggleCheck,
  onRemove,
  onQuantityChange,
  onUpdateItem,
  onOpenAddItems,
  onBrowseRecipes,
}) => {
  const intl = useIntl();

  return (
    <div className="space-y-2">
      {isLoadingShoppingList ? (
        Array.from({ length: 5 }).map((_, index) => <ShoppingListItemSkeleton key={`loading-${index}`} />)
      ) : viewMode === 'organized' ? (
        <SmartShoppingListOrganizer
          items={items}
          onToggleCheck={onToggleCheck}
          onRemove={onRemove}
          onQuantityChange={onQuantityChange}
          onUpdateItem={onUpdateItem}
          householdMembers={householdMembers}
          isSelected={(id) => items.some(it => it.id === id && it.checked)}
          onLongPress={undefined}
          storeLayout={activeStoreLayout}
        />
      ) : (
        items.map((item) => (
          <EnhancedShoppingListItem
            key={item.id}
            item={item}
            onToggleCheck={onToggleCheck}
            onRemove={onRemove}
            onQuantityChange={onQuantityChange}
            onUpdateItem={onUpdateItem}
            householdMembers={householdMembers}
            isOffline={isOffline}
            isSelected={item.checked}
            onLongPress={undefined}
            showPriceData={showPriceData}
          />
        ))
      )}

      {items.length === 0 && !isLoadingShoppingList && (
        <div className="text-center py-12 opacity-60 flex flex-col items-center">
          <ShoppingBasket className="w-12 h-12 mb-4 text-theme-secondary/50" />
          <h3 className="text-lg font-semibold text-theme-primary mb-2">{intl.formatMessage({ id: 'shoppingList.empty' })}</h3>
          <p className="text-theme-secondary opacity-70 mb-4">{intl.formatMessage({ id: 'shoppingList.addItems' })}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onOpenAddItems}
              className="px-4 py-2 bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-color)]/90 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Items
            </button>
            <button onClick={onBrowseRecipes} className="px-4 py-2 border border-theme rounded-lg hover:bg-theme-secondary/50 transition-colors">
              Browse Recipes
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

