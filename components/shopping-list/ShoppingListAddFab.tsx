import React from 'react';
import { Plus } from 'lucide-react';

interface ShoppingListAddFabProps {
  onOpenAddModal: () => void;
}

export const ShoppingListAddFab: React.FC<ShoppingListAddFabProps> = ({ onOpenAddModal }) => {
  return (
    <button
      onClick={onOpenAddModal}
      className="fixed bottom-28 right-6 z-50 bg-[var(--accent-color)] text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
      style={{ bottom: 'calc(7rem + 15px)' }}
      aria-label="Add items to shopping list"
    >
      <Plus className="w-6 h-6" />
    </button>
  );
};
