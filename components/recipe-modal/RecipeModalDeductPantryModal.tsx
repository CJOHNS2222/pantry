import React, { useState, useEffect } from 'react';
import { PantryItem, StructuredRecipe, SavedRecipe } from '../../types';
import { parseIngredientForShoppingList } from '../../utils/appUtils';
import { Modal } from '../ui/Modal';

interface RecipeModalDeductPantryModalProps {
  isOpen: boolean;
  recipe: StructuredRecipe | SavedRecipe;
  inventory: PantryItem[];
  onClose: () => void;
  onConfirm: (deductions: { itemId: string; ingredient: string }[]) => void;
}

export const RecipeModalDeductPantryModal: React.FC<RecipeModalDeductPantryModalProps> = ({
  isOpen,
  recipe,
  inventory,
  onClose,
  onConfirm,
}) => {
  const [itemsToDeduct, setItemsToDeduct] = useState<{
    ingredient: string;
    pantryItem: PantryItem;
    checked: boolean;
  }[]>([]);

  useEffect(() => {
    if (isOpen && recipe.ingredients && inventory.length > 0) {
      const matches: typeof itemsToDeduct = [];
      recipe.ingredients.forEach((ing, idx) => {
        const structuredName = recipe.structuredIngredients?.[idx]?.name;
        const name = (structuredName ?? parseIngredientForShoppingList(ing).itemName).toLowerCase().trim();

        const match = inventory.find(pi => {
          const piName = pi.item.toLowerCase();
          return piName.includes(name) || name.includes(piName);
        });

        if (match) {
          matches.push({
            ingredient: ing,
            pantryItem: match,
            checked: true
          });
        }
      });
      setItemsToDeduct(matches);
    }
  }, [isOpen, recipe.ingredients, inventory]);

  const handleToggle = (index: number) => {
    setItemsToDeduct(prev => prev.map((item, i) => i === index ? { ...item, checked: !item.checked } : item));
  };

  const handleConfirm = () => {
    const deductions = itemsToDeduct
      .filter(item => item.checked)
      .map(item => {
        return {
          itemId: item.pantryItem.id,
          ingredient: item.ingredient
        };
      });

    onConfirm(deductions);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Deduct from Pantry?">
      <Modal.Body>
        <p className="text-sm text-theme-secondary mb-4 leading-relaxed">
          We found matching items in your pantry. Select the ones you used for this recipe to automatically update your inventory:
        </p>

        <div className="space-y-2.5 pr-1">
          {itemsToDeduct.map((item, index) => {
            const parsed = parseIngredientForShoppingList(item.ingredient);
            const qtyObj = item.pantryItem.quantity;
            const currentQty = qtyObj && typeof qtyObj === 'object'
              ? `${qtyObj.amount} ${qtyObj.unit}`
              : typeof qtyObj === 'number'
                ? `${qtyObj} count`
                : `${item.pantryItem.quantity_estimate || '0'} count`;

            return (
              <label 
                key={item.pantryItem.id} 
                className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer border transition-all duration-150 ${
                  item.checked 
                    ? 'bg-[var(--accent-color)]/5 border-[var(--accent-color)]' 
                    : 'bg-theme-secondary border-theme hover:bg-theme-secondary/80'
                }`}
              >
                <input 
                  type="checkbox" 
                  checked={item.checked} 
                  onChange={() => handleToggle(index)} 
                  className="mt-1 flex-shrink-0 w-4 h-4 accent-[var(--accent-color)]"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-theme-primary truncate">
                    {item.pantryItem.item}
                  </div>
                  <div className="text-xs text-theme-secondary mt-0.5">
                    Recipe needs: <span className="font-medium text-theme-primary">{parsed.quantity} {parsed.itemName}</span>
                  </div>
                  <div className="text-xs text-theme-secondary">
                    Current pantry: <span className="font-medium text-theme-primary">{currentQty}</span>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          onClick={onClose}
          className="flex-1 py-2.5 bg-theme-primary text-theme-primary border border-theme rounded-xl font-bold text-sm hover:bg-theme-secondary active:scale-95 transition-all"
        >
          Skip / Keep All
        </button>
        <button
          onClick={handleConfirm}
          className="flex-1 py-2.5 bg-[var(--accent-color)] text-[var(--accent-text,white)] rounded-xl font-bold text-sm hover:opacity-90 active:scale-95 transition-all shadow-md shadow-[var(--accent-color)]/25"
        >
          Deduct Selected
        </button>
      </Modal.Footer>
    </Modal>
  );
};
