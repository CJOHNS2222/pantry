import React, { useState } from 'react';
import { CheckSquare, Package, Tag } from 'lucide-react';
import { ShoppingItem } from '../types';
import { inferCategoryFromItemName } from '../utils/appUtils';

interface BatchOperationsProps {
  items: ShoppingItem[];
  onBatchCheck: (itemIds: string[]) => void;
  onBatchUncheck: (itemIds: string[]) => void;
}

export const BatchOperations: React.FC<BatchOperationsProps> = ({
  items,
  onBatchCheck,
  onBatchUncheck
}) => {
  const [showBatchMenu, setShowBatchMenu] = useState(false);

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
          Quick Actions
        </h3>
        <button
          onClick={() => setShowBatchMenu(!showBatchMenu)}
          className="text-xs text-[var(--accent-color)] hover:underline"
        >
          {showBatchMenu ? 'Hide' : 'Show'} options
        </button>
      </div>

      {/* Basic Actions */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={handleSelectAll}
          disabled={uncheckedCount === 0}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
            uncheckedCount > 0
              ? 'bg-[var(--accent-color)] text-white shadow-lg'
              : 'bg-theme-primary text-theme-secondary opacity-50 cursor-not-allowed'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          Check All ({uncheckedCount})
        </button>

        <button
          onClick={handleDeselectAll}
          disabled={checkedCount === 0}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
            checkedCount > 0
              ? 'bg-theme-primary text-theme-secondary hover:bg-red-50 hover:text-red-600 border border-red-200'
              : 'bg-theme-primary text-theme-secondary opacity-50 cursor-not-allowed'
          }`}
        >
          <Package className="w-4 h-4" />
          Uncheck All ({checkedCount})
        </button>
      </div>

      {/* Advanced Batch Operations */}
      {showBatchMenu && (
        <div className="space-y-2 animate-fade-in">
          <div className="text-xs text-theme-secondary opacity-70 mb-2">
            Mark entire categories as done:
          </div>

          {categories.map(category => (
            <div key={category.name} className="flex items-center justify-between p-2 bg-theme-primary rounded-lg">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-theme-secondary" />
                <span className="text-sm font-medium text-theme-primary">{category.name}</span>
                <span className="text-xs text-theme-secondary opacity-70">
                  ({category.uncheckedCount} left, {category.checkedCount} done)
                </span>
              </div>

              <div className="flex gap-1">
                {category.uncheckedCount > 0 && (
                  <button
                    onClick={() => handleBatchCheckCategory(category.name)}
                    className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors"
                    title={`Mark all ${category.name} items as done`}
                  >
                    ✓ All
                  </button>
                )}

                {category.checkedCount > 0 && (
                  <button
                    onClick={() => handleBatchUncheckCategory(category.name)}
                    className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded hover:bg-orange-200 transition-colors"
                    title={`Uncheck all ${category.name} items`}
                  >
                    ↺ Undo
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BatchOperations;