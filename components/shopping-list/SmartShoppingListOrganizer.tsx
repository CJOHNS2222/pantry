import React, { useMemo } from 'react';
import { ShoppingItem } from '../../types';
import { inferCategoryFromItemName } from '../../utils/appUtils';
import EnhancedShoppingListItem from './EnhancedShoppingListItem';

interface StoreAisleGroup {
  aisle: string;
  items: ShoppingItem[];
  icon: string;
  color: string;
}

interface SmartShoppingListOrganizerProps {
  items: ShoppingItem[];
  onToggleCheck: (id: string) => void;
  onRemove: (id: string) => void;
  onQuantityChange?: (id: string, quantity: string) => void;
  onUpdateItem?: (id: string, updates: Partial<ShoppingItem>) => void;
  householdMembers?: Array<{ id: string; name: string; avatar?: string }>;
  isOffline?: boolean;
  lastSynced?: Date;
  isSelected?: (id: string) => boolean;
  onLongPress?: (id: string) => void;
  storeLayout?: string[]; // Custom order of store aisles
}

export const SmartShoppingListOrganizer: React.FC<SmartShoppingListOrganizerProps> = ({
  items,
  onToggleCheck,
  onRemove,
  onQuantityChange,
  onUpdateItem,
  householdMembers,
  isOffline = false,
  lastSynced,
  isSelected,
  onLongPress,
  storeLayout
}) => {
  const aisleGroups = useMemo(() => {
    const defaultGroups: StoreAisleGroup[] = [
      { aisle: 'Produce', items: [], icon: '🥕', color: 'bg-green-100 text-green-800 border-green-200' },
      { aisle: 'Dairy', items: [], icon: '🥛', color: 'bg-blue-100 text-blue-800 border-blue-200' },
      { aisle: 'Meat & Seafood', items: [], icon: '🥩', color: 'bg-red-100 text-red-800 border-red-200' },
      { aisle: 'Bakery', items: [], icon: '🍞', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      { aisle: 'Frozen', items: [], icon: '🧊', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
      { aisle: 'Pantry Staples', items: [], icon: '🥫', color: 'bg-orange-100 text-orange-800 border-orange-200' },
      { aisle: 'Snacks', items: [], icon: '🍿', color: 'bg-purple-100 text-purple-800 border-purple-200' },
      { aisle: 'Beverages', items: [], icon: '🥤', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
      { aisle: 'Household', items: [], icon: '🧹', color: 'bg-gray-100 text-gray-800 border-gray-200' },
      { aisle: 'Other', items: [], icon: '📦', color: 'bg-stone-100 text-stone-800 border-stone-200' }
    ];

    // Use custom layout if provided, otherwise use default
    const layoutOrder = storeLayout || defaultGroups.map(g => g.aisle);
    const groups: StoreAisleGroup[] = layoutOrder.map(aisleName => {
      const defaultGroup = defaultGroups.find(g => g.aisle === aisleName);
      return defaultGroup ? { ...defaultGroup, items: [] } : {
        aisle: aisleName,
        items: [],
        icon: '📦',
        color: 'bg-stone-100 text-stone-800 border-stone-200'
      };
    });

    // Group items by aisle based on category
    items.forEach(item => {
      // First try to use the item's explicitly set category if it perfectly matches an aisle
      let targetGroup = groups.find(g => g.aisle.toLowerCase() === (item.category || '').toLowerCase());
      
      if (!targetGroup) {
        const category = inferCategoryFromItemName(item.item);
        
        // Map categories to aisles with fuzzy matching for custom store layouts
        if (category === 'Fruits & Vegetables') {
          targetGroup = groups.find(g => g.aisle === 'Produce' || /produce|fruit|veg/i.test(g.aisle));
        } else if (category === 'Dairy & Eggs') {
          targetGroup = groups.find(g => g.aisle === 'Dairy' || /dairy|milk|egg/i.test(g.aisle));
        } else if (category === 'Meat & Poultry' || category === 'Seafood') {
          targetGroup = groups.find(g => g.aisle === 'Meat & Seafood' || /meat|beef|chicken|poultry|seafood|fish/i.test(g.aisle));
        } else if (category === 'Grains & Bread' || category === 'Baking Supplies') {
          targetGroup = groups.find(g => g.aisle === 'Bakery' || /bakery|bread|grain|baking/i.test(g.aisle));
        } else if (category === 'Frozen Foods') {
          targetGroup = groups.find(g => g.aisle === 'Frozen' || /frozen|freezer/i.test(g.aisle));
        } else if (category === 'Canned Goods' || category === 'Condiments & Sauces' || category === 'Spices & Herbs') {
          targetGroup = groups.find(g => g.aisle === 'Pantry Staples' || /pantry|canned|spice|condiment|sauce/i.test(g.aisle));
        } else if (category === 'Snacks') {
          targetGroup = groups.find(g => g.aisle === 'Snacks' || /snack|chip|candy/i.test(g.aisle));
        } else if (category === 'Beverages') {
          targetGroup = groups.find(g => g.aisle === 'Beverages' || /beverage|drink|soda|water/i.test(g.aisle));
        } else if (category === 'Household' || category === 'Personal Care') {
          targetGroup = groups.find(g => g.aisle === 'Household' || /household|cleaning|paper|personal|health/i.test(g.aisle));
        }
      }

      // Fallback
      if (!targetGroup) {
        targetGroup = groups.find(g => g.aisle === 'Other' || /other|misc/i.test(g.aisle));
      }
      
      // If "Other" doesn't exist in custom layout, create it dynamically
      if (!targetGroup && groups.length > 0) {
         targetGroup = { aisle: 'Other', items: [], icon: '📦', color: 'bg-stone-100 text-stone-800 border-stone-200' };
         groups.push(targetGroup);
      }

      if (targetGroup) {
        targetGroup.items.push(item);
      }
    });

    // Sort items within each group by checked status (unchecked first) then by name
    groups.forEach(group => {
      group.items.sort((a, b) => {
        if (a.checked !== b.checked) {
          return a.checked ? 1 : -1; // Unchecked items first
        }
        return (a.item || '').localeCompare(b.item || '');
      });
    });

    // Return only groups that have items
    return groups.filter(group => group.items.length > 0);
  }, [items, storeLayout]);

  const uncheckedCount = items.filter(item => !item.checked).length;
  const checkedCount = items.filter(item => item.checked).length;

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="bg-theme-secondary rounded-xl p-4 border border-theme">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-theme-primary">Smart Store Order</h3>
          <div className="text-sm text-theme-secondary">
            {uncheckedCount} remaining • {checkedCount} checked
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-theme-primary rounded-full h-2 mb-2">
          <div
            className="bg-[var(--accent-color)] h-2 rounded-full transition-all duration-300"
            style={{ width: `${items.length > 0 ? (checkedCount / items.length) * 100 : 0}%` }}
          />
        </div>

        <div className="text-xs text-theme-secondary opacity-70">
          Suggested order: Start at produce, end at checkout
        </div>
      </div>

      {/* Aisle Groups */}
      {aisleGroups.map((group, groupIndex) => (
        <div key={group.aisle} className="space-y-3">
          {/* Aisle Header */}
          <div className="flex items-center gap-3">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${group.color}`}>
              <span className="text-base">{group.icon}</span>
              <span>{group.aisle}</span>
              <span className="bg-white/50 px-1.5 py-0.5 rounded-full text-xs">
                {group.items.filter(item => !item.checked).length}
              </span>
            </div>
            {groupIndex === 0 && (
              <div className="text-xs text-theme-secondary opacity-60">
                ← Start here
              </div>
            )}
            {groupIndex === aisleGroups.length - 1 && (
              <div className="text-xs text-theme-secondary opacity-60">
                Checkout →
              </div>
            )}
          </div>

          {/* Items in this aisle */}
          <div className="space-y-2 ml-4">
            {group.items.map((item) => (
              <EnhancedShoppingListItem
                key={item.id}
                item={item}
                onToggleCheck={onToggleCheck}
                onRemove={onRemove}
                onQuantityChange={onQuantityChange}
                onUpdateItem={onUpdateItem}
                householdMembers={householdMembers}
                isOffline={isOffline}
                lastSynced={lastSynced}
                isSelected={isSelected ? isSelected(item.id) : false}
                onLongPress={onLongPress}
              />
            ))}
          </div>
        </div>
      ))}

      {aisleGroups.length === 0 && (
        <div className="text-center py-12 opacity-60">
          <div className="text-4xl mb-4">🛒</div>
          <h3 className="text-lg font-semibold text-theme-primary mb-2">Shopping list is empty</h3>
          <p className="text-theme-secondary opacity-70">Add items to see them organized by store aisle</p>
        </div>
      )}
    </div>
  );
};

export default SmartShoppingListOrganizer;
