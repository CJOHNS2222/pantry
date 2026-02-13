import React, { useState } from 'react';
import { CheckSquare, Package, Tag, Archive, Undo2 } from 'lucide-react';
import { ShoppingItem } from '../types';
import { inferCategoryFromItemName } from '../utils/appUtils';

interface BatchOperationsProps {
  items: ShoppingItem[];
  onBatchCheck: (itemIds: string[]) => void;
  onBatchUncheck: (itemIds: string[]) => void;
  onMoveToPantry?: (items: ShoppingItem[]) => void;
}

export const BatchOperations: React.FC<BatchOperationsProps> = ({
  items,
  onBatchCheck,
  onBatchUncheck,
  onMoveToPantry
}) => {
  const [showBatchMenu, setShowBatchMenu] = useState(false);
  const [recentlyMovedCategories, setRecentlyMovedCategories] = useState<Set<string>>(new Set());

  const categories = React.useMemo(() => {
    const categoryMap = new Map<string, ShoppingItem[]>();

    items.forEach(item => {
      const category = inferCategoryFromItemName(item.item);
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(item);
    });

    return Array.from(categoryMap.entries())
      .map(([category, items]) => ({
        name: category,
        items,
        uncheckedCount: items.filter(item => !item.checked).length,
        checkedCount: items.filter(item => item.checked).length
      }))
      .filter(cat => cat.uncheckedCount > 0 || cat.checkedCount > 0)
      .sort((a, b) => b.uncheckedCount - a.uncheckedCount);
  }, [items]);

  const handleBatchCheckCategory = (categoryName: string) => {
    const categoryItems = items.filter(item =>
      inferCategoryFromItemName(item.item) === categoryName && !item.checked
    );
    const itemIds = categoryItems.map(item => item.id);
    onBatchCheck(itemIds);
    setShowBatchMenu(false);
  };

  const handleBatchUncheckCategory = (categoryName: string) => {
    const categoryItems = items.filter(item =>
      inferCategoryFromItemName(item.item) === categoryName && item.checked
    );
    const itemIds = categoryItems.map(item => item.id);
    onBatchUncheck(itemIds);
    setShowBatchMenu(false);
  };

  const handleMoveCategoryToPantry = (categoryName: string) => {
    if (!onMoveToPantry) return;
    
    const categoryItems = items.filter(item =>
      inferCategoryFromItemName(item.item) === categoryName
    );
    
    onMoveToPantry(categoryItems);
    setRecentlyMovedCategories(prev => new Set([...prev, categoryName]));
    setShowBatchMenu(false);
  };

  const handleUndoMoveCategory = (categoryName: string) => {
    setRecentlyMovedCategories(prev => {
      const newSet = new Set(prev);
      newSet.delete(categoryName);
      return newSet;
    });
    // Note: The items remain in pantry - user would need to manually remove them if desired
  };

  const handleSelectAll = () => {
    const uncheckedItems = items.filter(item => !item.checked);
    onBatchCheck(uncheckedItems.map(item => item.id));
  };

  const handleDeselectAll = () => {
    const checkedItems = items.filter(item => item.checked);
    onBatchUncheck(checkedItems.map(item => item.id));
  };

  const uncheckedCount = items.filter(item => !item.checked).length;
  const checkedCount = items.filter(item => item.checked).length;

  if (items.length === 0) return null;

  return (
    <div className="bg-theme-secondary rounded-xl p-4 border border-theme">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-theme-primary flex items-center gap-2">
          <CheckSquare className="w-4 h-4" />
          Categories
        </h3>
        <button
          onClick={() => setShowBatchMenu(!showBatchMenu)}
          className="text-xs text-[var(--accent-color)] hover:underline"
        >
          {showBatchMenu ? 'Hide' : 'Show'} categories
        </button>
      </div>

      {/* Category Operations */}
      {showBatchMenu && (
        <div className="space-y-2 animate-fade-in">
          <div className="text-xs text-theme-secondary opacity-70 mb-2">
            Move entire categories to pantry:
          </div>

          {categories.map(category => {
            const recentlyMoved = recentlyMovedCategories.has(category.name);
            return (
              <div key={category.name} className="flex items-center justify-between p-2 bg-theme-primary rounded-lg">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-theme-secondary" />
                  <span className="text-sm font-medium text-theme-primary">{category.name}</span>
                  <span className="text-xs text-theme-secondary opacity-70">
                    ({category.uncheckedCount + category.checkedCount} items)
                  </span>
                </div>

                <div className="flex gap-1">
                  {recentlyMoved ? (
                    <button
                      onClick={() => handleUndoMoveCategory(category.name)}
                      className="px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
                      title={`Undo move of ${category.name} to pantry`}
                    >
                      <Undo2 className="w-3 h-3 inline mr-1" />
                      Undo
                    </button>
                  ) : (
                    <button
                      onClick={() => handleMoveCategoryToPantry(category.name)}
                      className="px-2 py-1 text-xs bg-[var(--accent-color)] text-white rounded hover:bg-[var(--accent-color)]/90 transition-colors"
                      title={`Move all ${category.name} items to pantry`}
                    >
                      <Archive className="w-3 h-3 inline mr-1" />
                      Move to Pantry
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BatchOperations;