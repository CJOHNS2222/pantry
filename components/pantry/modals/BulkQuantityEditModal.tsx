import React from 'react';
import { X } from 'lucide-react';
import { PantryItem } from '../../../types';
import VisualQuantitySelector from '../VisualQuantitySelector';
import { getPreferredItemDisplayImage } from '../../../utils/appUtils';

interface BulkQuantityEditModalProps {
  bulkQuantityEditItems: PantryItem[];
  setBulkQuantityEditItems: (items: PantryItem[]) => void;
  setShowBulkQuantityEdit: (show: boolean) => void;
  inventory: PantryItem[];
  updateItem: (index: number, updates: Partial<PantryItem>) => Promise<void>;
}

export const BulkQuantityEditModal: React.FC<BulkQuantityEditModalProps> = ({
  bulkQuantityEditItems,
  setBulkQuantityEditItems,
  setShowBulkQuantityEdit,
  inventory,
  updateItem
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] px-4 pt-[var(--safe-area-inset-top,0px)] pb-[var(--safe-area-inset-bottom,0px)]">
      <div className="bg-theme-primary rounded-lg shadow-xl w-full max-w-md mx-auto h-full overflow-y-auto border border-theme">
        <div className="p-6 pb-2.5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-theme-secondary">Edit Quantities</h3>
            <button
              onClick={() => {
                setShowBulkQuantityEdit(false);
                setBulkQuantityEditItems([]);
              }}
              className="p-2 hover:bg-theme-secondary rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-theme-secondary" />
            </button>
          </div>

          <p className="text-sm text-theme-secondary opacity-70 mb-4">
            Update quantities for the items you just added:
          </p>

          <div className="space-y-4">
            {bulkQuantityEditItems.map((item, index) => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-theme-secondary rounded-lg">
                <img
                  src={getPreferredItemDisplayImage(item.item, item.category, item.image)}
                  alt={item.item}
                  className="w-10 h-10 rounded-lg object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/images/placeholder.svg';
                  }}
                />
                <div className="flex-1">
                  <span className="font-medium text-theme-primary">{item.item}</span>
                  <div className="mt-2">
                    <VisualQuantitySelector
                      value={parseInt(item.quantity_estimate) || 1}
                      onChange={(newQty) => {
                        const updatedItems = [...bulkQuantityEditItems];
                        updatedItems[index] = {
                          ...updatedItems[index],
                          quantity_estimate: newQty.toString()
                        };
                        setBulkQuantityEditItems(updatedItems);
                      }}
                      itemName={item.item}
                      unit="items"
                      maxValue={20}
                      showTypicalAmounts={false}
                      showVisualLevels={false}
                      className="scale-90"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                setShowBulkQuantityEdit(false);
                setBulkQuantityEditItems([]);
              }}
              className="flex-1 py-3 rounded-lg font-bold text-sm uppercase tracking-wider bg-theme-secondary text-theme-secondary hover:bg-theme-primary transition-colors"
              aria-label="Skip quantity editing and keep current quantities"
            >
              Skip
            </button>
            <button
              onClick={async () => {
                const updatePromises = bulkQuantityEditItems.map(async (item) => {
                  const inventoryIndex = inventory.findIndex(i => i.id === item.id);
                  if (inventoryIndex !== -1) {
                    await updateItem(inventoryIndex, { quantity_estimate: item.quantity_estimate });
                  }
                });
                
                await Promise.all(updatePromises);
                setShowBulkQuantityEdit(false);
                setBulkQuantityEditItems([]);
              }}
              className="flex-1 py-3 rounded-lg font-bold text-sm uppercase tracking-wider bg-[var(--accent-color)] text-white shadow-lg hover:bg-[var(--accent-color)]/90 transition-colors"
              aria-label="Save all updated quantities"
            >
              Save All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


