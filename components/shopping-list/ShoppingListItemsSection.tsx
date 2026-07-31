import React from 'react';
import { useIntl } from 'react-intl';
import { Plus } from 'lucide-react';
import { ShoppingItem, SavedRecipe, DayPlan } from '../../types';
import { ShoppingListItemSkeleton } from '../ui/SkeletonLoader';
import { SmartShoppingListOrganizer } from './SmartShoppingListOrganizer';
import { EnhancedShoppingListItem } from './EnhancedShoppingListItem';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';

interface ShoppingListItemsSectionProps {
  isLoadingShoppingList: boolean;
  viewMode: 'list' | 'organized';
  items: ShoppingItem[];
  activeStoreLayout: string[] | undefined;
  householdMembers: Array<{ id: string; name: string; avatar?: string }>;
  isOffline: boolean;
  showPriceData: boolean;
  savedRecipes?: SavedRecipe[];
  mealPlan?: DayPlan[];
  measurementSystem?: 'Standard' | 'Metric';
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
  savedRecipes,
  mealPlan,
  measurementSystem,
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
          savedRecipes={savedRecipes}
          mealPlan={mealPlan}
          measurementSystem={measurementSystem}
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
            savedRecipes={savedRecipes}
            mealPlan={mealPlan}
            measurementSystem={measurementSystem}
          />
        ))
      )}

      {items.length === 0 && !isLoadingShoppingList && (
        <EmptyState
          preset="shopping"
          title={intl.formatMessage({ id: 'shoppingList.empty' })}
          description={intl.formatMessage({ id: 'shoppingList.addItems' })}
          action={
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="primary" onClick={onOpenAddItems} leadingIcon={<Plus className="w-4 h-4" />}>
                Add Items
              </Button>
              <Button variant="secondary" onClick={onBrowseRecipes}>
                Browse Recipes
              </Button>
            </div>
          }
        />
      )}
    </div>
  );
};

