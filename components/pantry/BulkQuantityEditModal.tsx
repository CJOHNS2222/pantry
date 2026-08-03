import React, { useState, useEffect } from 'react';
import { PantryItem } from '../../types';
import { getPreferredItemDisplayImage } from '../../utils/appUtils';
import VisualQuantitySelector from './VisualQuantitySelector';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import { Modal } from '../ui/Modal';
import { useIntl } from 'react-intl';

interface BulkQuantityEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: PantryItem[];
  onSave: (updatedItems: PantryItem[]) => Promise<void>;
}

export const BulkQuantityEditModal: React.FC<BulkQuantityEditModalProps> = ({
  isOpen,
  onClose,
  items,
  onSave,
}) => {
  const intl = useIntl();
  const [localItems, setLocalItems] = useState<PantryItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      setLocalItems([...items]);
    }
  }, [isOpen, items]);

  useAndroidBack(isOpen, onClose);

  if (!isOpen || localItems.length === 0) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={intl.formatMessage({ id: 'pantry.editQuantities', defaultMessage: 'Edit Quantities' })}
      subtitle={intl.formatMessage({ id: 'pantry.updateQuantitiesSubtitle', defaultMessage: 'Update quantities for the items you just added:' })}
      size="md"
    >
      <Modal.Body className="bg-theme-primary" padding="sm">

          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            {localItems.map((item, index) => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-theme-secondary rounded-lg border border-theme">
                <img
                  src={getPreferredItemDisplayImage(item.item, item.category, item.image)}
                  alt={item.item}
                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/images/placeholder.svg';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-theme-primary text-sm truncate block">{item.item}</span>
                  <div className="mt-2 scale-90 origin-left">
                    <VisualQuantitySelector
                      value={parseInt(item.quantity_estimate) || 1}
                      onChange={(newQty) => {
                        const updated = [...localItems];
                        updated[index] = {
                          ...updated[index],
                          quantity_estimate: newQty.toString()
                        };
                        setLocalItems(updated);
                      }}
                      itemName={item.item}
                      unit="items"
                      maxValue={20}
                      showTypicalAmounts={false}
                      showVisualLevels={false}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Modal.Body>

        <Modal.Footer className="bg-theme-primary flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider bg-theme-secondary text-theme-secondary hover:bg-theme-primary transition-colors border border-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]"
            aria-label={intl.formatMessage({ id: 'pantry.skipQuantityEditing', defaultMessage: 'Skip quantity editing and keep current quantities' })}
          >
            {intl.formatMessage({ id: 'common.skip', defaultMessage: 'Skip' })}
          </button>
          <button
            onClick={async () => {
              await onSave(localItems);
              onClose();
            }}
            className="flex-1 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider bg-[var(--accent-color)] text-[var(--accent-text,white)] shadow-lg hover:bg-[var(--accent-color)]/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]"
            aria-label={intl.formatMessage({ id: 'pantry.saveAllUpdatedQuantities', defaultMessage: 'Save all updated quantities' })}
          >
            {intl.formatMessage({ id: 'common.saveAll', defaultMessage: 'Save All' })}
          </button>
        </Modal.Footer>
      </Modal>
  );
};
