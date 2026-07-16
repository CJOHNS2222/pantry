import React, { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { Plus, X } from 'lucide-react';
import QuantityUnitPicker, { getSmartUnits } from '../pantry/QuantityUnitPicker';
import { itemImages } from '../../data/item-images';

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
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const query = newItem.toLowerCase().trim();
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    const keys = Object.keys(itemImages);
    const matches = keys.filter(key => key.toLowerCase().includes(query));
    
    // Sort: prefix matches first, then alphabetical
    matches.sort((a, b) => {
      const aStarts = a.toLowerCase().startsWith(query);
      const bStarts = b.toLowerCase().startsWith(query);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.localeCompare(b);
    });

    setSuggestions(matches.slice(0, 30));
  }, [newItem]);

  const capitalizeWords = (str: string) => {
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setNewItem(capitalizeWords(suggestion));
    setSuggestions([]);
    const smartUnits = getSmartUnits(suggestion);
    if (smartUnits && smartUnits.length > 0) {
      setNewUnit(smartUnits[0]);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-theme-primary w-full h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl flex flex-col overflow-hidden shadow-xl animate-slide-up">
        {/* Header */}
        <div className="p-6 pb-3 border-b border-theme flex items-center justify-between flex-shrink-0">
          <h3 className="text-xl font-bold text-theme-primary">
            {intl.formatMessage({ id: 'shoppingList.addToList' })}
          </h3>
          <button onClick={closeModal} className="p-2 hover:bg-theme-secondary rounded-full transition-colors">
            <X className="w-5 h-5 text-theme-secondary" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={addItem} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-4">
              <div className="relative">
                <label htmlFor="newItem" className="block text-sm font-semibold text-theme-secondary mb-1.5">
                  Item Name
                </label>
                <input
                  id="newItem"
                  name="newItem"
                  type="text"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder="Enter item name..."
                  className={`w-full bg-theme-secondary border rounded-lg px-4 py-3 text-theme-primary shadow-sm outline-none focus:border-[var(--accent-color)] ${validationErrors.item ? 'border-red-500' : 'border-theme'}`}
                  autoFocus
                  autoComplete="off"
                />
                {validationErrors.item && (
                  <p className="text-red-500 text-xs mt-1" aria-live="polite">
                    {validationErrors.item}
                  </p>
                )}

                {suggestions.length > 0 && (
                  <div className="mt-2 bg-theme-secondary border border-theme rounded-lg divide-y divide-theme max-h-[50vh] overflow-y-auto shadow-sm">
                    {suggestions.map((suggestion) => {
                      const filename = itemImages[suggestion];
                      const imageUrl = filename ? `/images/items/${filename}` : null;
                      return (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => handleSelectSuggestion(suggestion)}
                          className="w-full text-left px-4 py-3 text-sm text-theme-primary hover:bg-[var(--accent-color)] hover:text-white transition-colors duration-150 flex items-center justify-between font-semibold"
                        >
                          <div className="flex items-center gap-3">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={suggestion}
                                className="w-8 h-8 rounded-full object-cover border border-theme bg-white"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-theme-secondary flex items-center justify-center text-xs text-theme-secondary border border-theme">
                                📦
                              </div>
                            )}
                            <span>{capitalizeWords(suggestion)}</span>
                          </div>
                          <span className="text-[10px] opacity-65 bg-theme-secondary/20 px-2 py-0.5 rounded uppercase font-bold tracking-wider">Select</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-2">
                <label className="block text-sm font-semibold text-theme-secondary mb-2">
                  Quantity &amp; Unit
                </label>
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
            </div>
          </div>

          {/* Footer - Fixed at the bottom */}
          <div className="p-6 border-t border-theme bg-theme-secondary/30 flex-shrink-0">
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 bg-[var(--accent-color)] text-white shadow-lg hover:bg-[var(--accent-color)]/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

