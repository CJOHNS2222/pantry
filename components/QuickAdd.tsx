import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { getItemImage, inferCategoryFromItemName } from '../utils/appUtils';
import { QuickAddModal } from './QuickAddModal';

interface QuickAddItem {
  name: string;
  category?: string;
  quantity?: string;
  unit?: string;
}

interface QuickAddProps {
  onAddItem: (item: QuickAddItem) => void;
  onScanBarcode?: () => Promise<QuickAddItem | null>;
  onVoiceInput?: () => Promise<string | null>;
  isOnline: boolean;
  recentItems?: string[];
  suggestedItems?: string[];
  onAddSuggestedItem?: (itemName: string) => void;
}

export const QuickAdd: React.FC<QuickAddProps> = ({
  onAddItem,
  onScanBarcode,
  onVoiceInput,
  isOnline,
  recentItems = [],
  suggestedItems = [],
  onAddSuggestedItem
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddSuggestedItem = (itemName: string) => {
    if (onAddSuggestedItem) {
      onAddSuggestedItem(itemName);
    } else {
      // Fallback: parse and add the item directly
      const quantityMatch = itemName.match(/^(\d+(?:\.\d+)?)\s*(\w+)\s+(.+)$/);
      let parsedItem: QuickAddItem;

      if (quantityMatch) {
        const [, quantity, unit, name] = quantityMatch;
        parsedItem = {
          name: name.trim(),
          quantity,
          unit
        };
      } else {
        parsedItem = {
          name: itemName
        };
      }

      onAddItem(parsedItem);
    }
  };

  return (
    <>
      <div className="bg-theme-secondary rounded-xl p-4 border border-theme">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-[var(--accent-color)]" />
            <span className="text-sm font-semibold text-theme-primary">Quick Add</span>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="p-2 bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-color)]/90 transition-colors"
            aria-label="Add new item"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Add Suggestions */}
        {suggestedItems.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-theme-primary mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Quick Add Suggestions
            </h4>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide flex-nowrap">
              {suggestedItems.map((itemName) => (
                <button
                  key={itemName}
                  onClick={() => handleAddSuggestedItem(itemName)}
                  className="flex-shrink-0 flex flex-col items-center gap-2 p-3 bg-theme-primary rounded-lg border border-theme hover:border-[var(--accent-color)] hover:bg-[var(--accent-color)]/5 transition-all group min-w-[80px]"
                >
                  <img
                    src={getItemImage(itemName, inferCategoryFromItemName(itemName))}
                    alt={itemName}
                    className="w-10 h-10 rounded-lg object-cover bg-theme-secondary border border-theme"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/images/placeholder.svg';
                    }}
                  />
                  <span className="text-xs font-medium text-theme-primary text-center leading-tight group-hover:text-[var(--accent-color)] transition-colors">
                    {itemName}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <QuickAddModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddItem={onAddItem}
        onScanBarcode={onScanBarcode}
        onVoiceInput={onVoiceInput}
        isOnline={isOnline}
        recentItems={recentItems}
      />
    </>
  );
};

export default QuickAdd;