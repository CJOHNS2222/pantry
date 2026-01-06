import React from 'react';
import { ShoppingBasket, Check, Trash2, Archive, Plus, X } from 'lucide-react';
import { ShoppingItem } from '../types';
import { inferCategoryFromItemName } from '../utils/appUtils';

interface ShoppingListProps {
  items: ShoppingItem[];
  setItems: React.Dispatch<React.SetStateAction<ShoppingItem[]>>;
  onMoveToPantry: (items: ShoppingItem[]) => void;
}

export const ShoppingList: React.FC<ShoppingListProps> = ({ items, setItems, onMoveToPantry }) => {
  const [newItem, setNewItem] = React.useState('');
  const [newQty, setNewQty] = React.useState<string>('1');
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);

  const toggleCheck = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  };

  const selectAll = () => {
    setItems(prev => prev.map(i => ({ ...i, checked: true })));
  };

  const deselectAll = () => {
    setItems(prev => prev.map(i => ({ ...i, checked: false })));
  };

  const remove = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim() || !newQty.trim()) return;
    setItems(prev => [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        item: newItem,
        category: inferCategoryFromItemName(newItem),
        checked: false,
        quantity: newQty
    }]);
    setNewItem('');
    setNewQty('1');
    setIsAddModalOpen(false); // Close modal after adding
  };

  const closeModal = () => {
    setIsAddModalOpen(false);
    setNewItem('');
    setNewQty('1');
  };

  const handleCheckout = () => {
    const purchased = items.filter(i => i.checked);
    if (purchased.length === 0) return;
    
    if (confirm(`Move ${purchased.length} items to pantry?`)) {
        onMoveToPantry(purchased);
        setItems(prev => prev.filter(i => !i.checked));
    }
  };

  return (
    <div className="space-y-6 pb-24 max-w-2xl mx-auto animate-fade-in relative">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-serif font-bold text-theme-secondary">Shopping List</h2>
        <p className="text-theme-secondary opacity-60 text-sm mt-1">Items to purchase</p>
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setIsAddModalOpen(true)}
        className="fixed bottom-28 right-6 z-50 bg-[var(--accent-color)] text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
        style={{ bottom: 'calc(7rem + 15px)' }}
        aria-label="Add items to shopping list"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Add Items Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
          <div className="bg-theme-primary rounded-t-3xl max-w-md w-full max-h-[80vh] overflow-y-auto shadow-xl animate-slide-up">
            <div className="p-6 pb-2.5">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-theme-secondary">Add to Shopping List</h3>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-theme-secondary rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-theme-secondary" />
                </button>
              </div>

              <form onSubmit={addItem} className="space-y-4">
                <div className="space-y-4">
                  <input 
                    type="text"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder="Enter item name..."
                    className="w-full bg-theme-secondary border border-theme rounded-lg px-4 py-3 text-theme-primary shadow-sm outline-none focus:border-[var(--accent-color)]"
                    autoFocus
                  />
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newQty}
                      onChange={e => setNewQty(e.target.value)}
                      className="flex-1 bg-theme-secondary border border-theme rounded-lg px-3 py-3 text-theme-primary shadow-sm focus:border-[var(--accent-color)] outline-none"
                      placeholder="Quantity (e.g. 2, 1 cup, 2 tbsp)"
                    />
                  </div>
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
      )}

      {items.length > 0 && (
          <div className="flex gap-2 justify-between">
              <button
                onClick={items.every(i => i.checked) ? deselectAll : selectAll}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all bg-theme-secondary text-theme-secondary hover:bg-[var(--accent-color)] hover:text-white"
              >
                  <Check className="w-4 h-4" /> 
                  {items.every(i => i.checked) ? 'Deselect All' : 'Select All'}
              </button>
              <button 
                onClick={handleCheckout}
                disabled={!items.some(i => i.checked)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    items.some(i => i.checked) 
                    ? 'bg-[var(--accent-color)] text-white shadow-lg' 
                    : 'bg-theme-secondary text-theme-secondary opacity-50 cursor-not-allowed'
                }`}
              >
                  <Archive className="w-4 h-4" /> Move Checked to Pantry
              </button>
          </div>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div 
            key={item.id} 
            onClick={() => toggleCheck(item.id)}
            className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group ${
              item.checked 
              ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)]/30' 
              : 'bg-theme-secondary border-theme hover:border-[var(--accent-color)]/50'
            }`}
          >
            <div className="flex items-center gap-3 flex-1">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                item.checked ? 'bg-[var(--accent-color)] border-[var(--accent-color)]' : 'border-theme'
              }`}>
                {item.checked && <Check className="w-3 h-3 text-white" />}
              </div>
              <div>
                <span className={`font-medium ${item.checked ? 'line-through opacity-50' : 'text-theme-primary'}`}>
                  {item.item}
                </span>
                {item.quantity && item.quantity !== '1' && (
                  <div className="text-xs text-theme-secondary opacity-70">Qty: {item.quantity}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {item.quantity && item.quantity !== '1' && (
                <div className="text-xs font-medium text-theme-secondary opacity-70 bg-theme-primary px-2 py-1 rounded">
                  {item.quantity}
                </div>
              )}
              <button 
                onClick={(e) => { e.stopPropagation(); remove(item.id); }}
                className="p-2 text-theme-secondary opacity-30 hover:opacity-100 hover:text-red-500 transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
             <div className="text-center py-12 opacity-30 flex flex-col items-center">
                <ShoppingBasket className="w-12 h-12 mb-2" />
                <p>List is empty</p>
             </div>
        )}
      </div>
    </div>
  );
};