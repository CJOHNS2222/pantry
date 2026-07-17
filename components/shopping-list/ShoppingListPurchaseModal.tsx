import React from 'react';
import { useIntl } from 'react-intl';
import { Calendar } from 'lucide-react';
import { ShoppingItem } from '../../types';
import VisualQuantitySelector from '../pantry/VisualQuantitySelector';
import { Input, Select } from '../ui';

interface ShoppingListPurchaseModalProps {
  purchaseModalOpen: boolean;
  purchaseTargetItem: ShoppingItem | null;
  purchaseQty: number;
  setPurchaseQty: React.Dispatch<React.SetStateAction<number>>;
  purchaseUnit: string;
  setPurchaseUnit: React.Dispatch<React.SetStateAction<string>>;
  purchaseExpires?: string;
  setPurchaseExpires: React.Dispatch<React.SetStateAction<string | undefined>>;
  closePurchaseModal: () => void;
  onConfirmPurchase: (itemId: string) => void;
}

export const ShoppingListPurchaseModal: React.FC<ShoppingListPurchaseModalProps> = ({
  purchaseModalOpen,
  purchaseTargetItem,
  purchaseQty,
  setPurchaseQty,
  purchaseUnit,
  setPurchaseUnit,
  purchaseExpires,
  setPurchaseExpires,
  closePurchaseModal,
  onConfirmPurchase,
}) => {
  const intl = useIntl();

  if (!purchaseModalOpen || !purchaseTargetItem) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-theme-primary rounded-lg p-6 max-w-md w-full shadow-xl">
        <h3 className="text-lg font-bold mb-3">Add purchase for "{purchaseTargetItem.item}"</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-theme-secondary">{intl.formatMessage({ id: 'shoppingList.quantityPurchased' })}</label>
            <div className="mt-2">
              <VisualQuantitySelector
                value={purchaseQty}
                onChange={(v) => setPurchaseQty(v)}
                itemName={purchaseTargetItem.item}
                unit={purchaseUnit}
                step={0.25}
                minValue={0.25}
                showTypicalAmounts={false}
                className="w-full"
              />
            </div>
          </div>
          <div>
            <Select
              value={purchaseUnit}
              onChange={(val) => setPurchaseUnit(val || 'count')}
              options={[
                { value: 'count', label: 'count' },
                { value: 'lb', label: 'lb' },
                { value: 'oz', label: 'oz' },
                { value: 'kg', label: 'kg' },
                { value: 'g', label: 'g' },
                { value: 'pack', label: 'pack' },
                { value: 'bag', label: 'bag' },
                { value: 'bunch', label: 'bunch' },
                { value: 'dozen', label: 'dozen' },
                { value: 'can', label: 'can' },
                { value: 'piece', label: 'piece' },
              ]}
              label={intl.formatMessage({ id: 'shoppingList.unit' })}
            />
          </div>
          <div>
            <label className="text-sm text-theme-secondary">Expiration date (optional)</label>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={() => document.getElementById('purchase-expires')?.click()}
                className="p-2 bg-theme-secondary rounded-md hover:bg-theme-primary transition-colors"
                aria-label="Pick expiration date"
              >
                <Calendar className="w-5 h-5 text-theme-primary" />
              </button>
              <Input
                id="purchase-expires"
                type="date"
                value={purchaseExpires || ''}
                onChange={(e) => setPurchaseExpires(e.target.value || undefined)}
                className="w-36"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-6">
          <button onClick={closePurchaseModal} className="px-4 py-2 rounded bg-theme-secondary">Cancel</button>
          <button onClick={() => onConfirmPurchase(purchaseTargetItem.id)} className="px-4 py-2 rounded bg-[var(--accent-color)] text-white">Confirm</button>
        </div>
      </div>
    </div>
  );
};

