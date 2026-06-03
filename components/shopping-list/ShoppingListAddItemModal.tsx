import React from 'react';
import { useIntl } from 'react-intl';
import { Plus, X } from 'lucide-react';
import QuantityUnitPicker from '../QuantityUnitPicker';

interface ShoppingListAddItemModalProps {
  isOpen: boolean;
  closeModal: () => void;
  addItem: (event: React.FormEvent) => void;
  newItem: string;
  setNewItem: React.Dispatch<React.SetStateAction<string>>;
  newQty: string;
  setNewQty: React.Dispatch<React.SetStateAction<string>>;
  newUnit: string;
  setNewUnit: React.Dispatch<React.SetStateAction<string>>;
  validationErrors: { item?: string; quantity?: string };
}

export const ShoppingListAddItemModal: React.FC<ShoppingListAddItemModalProps> = ({
  isOpen,
  closeModal,
  addItem,
  newItem,
  setNewItem,
  newQty,
  setNewQty,
  newUnit,
  setNewUnit,
  validationErrors,
}) => {
  const intl = useIntl();

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-theme-primary rounded-t-3xl max-w-md w-full modal-safe-h overflow-y-auto shadow-xl animate-slide-up">
        <div className="p-6 pb-2.5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-theme-secondary">{intl.formatMessage({ id: 'shoppingList.addToList' })}</h3>
            <button onClick={closeModal} className="p-2 hover:bg-theme-secondary rounded-full transition-colors">
              <X className="w-5 h-5 text-theme-secondary" />
            </button>
          </div>

          <form onSubmit={addItem} className="space-y-4">
            <div className="space-y-4">
              <div>
                <input
                  id="newItem"
                  name="newItem"
                  type="text"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder="Enter item name..."
                  className={`w-full bg-theme-secondary border rounded-lg px-4 py-3 text-theme-primary shadow-sm outline-none focus:border-[var(--accent-color)] ${validationErrors.item ? 'border-red-500' : 'border-theme'}`}
                  autoFocus
                />
                {validationErrors.item && (
                  <p className="text-red-500 text-xs mt-1" aria-live="polite">
                    {validationErrors.item}
                  </p>
                )}
              </div>
              <QuantityUnitPicker
                quantity={parseFloat(newQty) || 1}
                unit={newUnit}
                onQuantityChange={(qty) => setNewQty(qty.toString())}
                onUnitChange={setNewUnit}
                itemName={newItem}
                showControls={true}
                maxQuantity={999}
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 bg-[var(--accent-color)] text-white shadow-lg hover:bg-[var(--accent-color)]/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
