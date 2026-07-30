import React from 'react';
import { PantryItem } from '../../../types';
import VisualQuantitySelector from '../VisualQuantitySelector';
import { getPreferredItemDisplayImage } from '../../../utils/appUtils';
import { Modal } from '../../ui/Modal';

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
  const handleClose = () => {
    setShowBulkQuantityEdit(false);
    setBulkQuantityEditItems([]);
  };

  return (
    <Modal isOpen={true} onClose={handleClose} title="Edit Quantities">
      <Modal.Body>
        <div>
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
        </div>
      </Modal.Body>
      <Modal.Footer align="between">
        <button
          onClick={handleClose}
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
            handleClose();
          }}
          className="flex-1 py-3 rounded-lg font-bold text-sm uppercase tracking-wider bg-[var(--accent-color)] text-white shadow-lg hover:bg-[var(--accent-color)]/90 transition-colors"
          aria-label="Save all updated quantities"
        >
          Save All
        </button>
      </Modal.Footer>
    </Modal>
  );
};


