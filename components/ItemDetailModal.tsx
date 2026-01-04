import React, { useState } from 'react';
import { X, TrendingUp, ShoppingBasket, Trash2, Edit3, Package, Minus, Plus } from 'lucide-react';
import { PantryItem } from '../types';
import PriceTrends from './PriceTrends';
import { getAllCategories, getExpirationColor } from '../utils/appUtils';

interface ItemDetailModalProps {
  item: PantryItem;
  onClose: () => void;
  onUpdateItem: (index: number, updates: Partial<PantryItem>) => void;
  onDeleteItem: (index: number) => void;
  onAddToShoppingList: (items: string[]) => void;
  customCategories: any[];
  originalIndex: number;
}

const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  onClose,
  onUpdateItem,
  onDeleteItem,
  onAddToShoppingList,
  customCategories,
  originalIndex
}) => {
  const [showPriceTrends, setShowPriceTrends] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editQuantity, setEditQuantity] = useState(item.quantity_estimate || 1);
  const [hasQuantityChanged, setHasQuantityChanged] = useState(false);

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity >= 0) {
      onUpdateItem(originalIndex, { quantity_estimate: newQuantity });
      setEditQuantity(newQuantity);
      setHasQuantityChanged(false);
      setIsEditing(false);
    }
  };

  const handleQuantityIncrement = () => {
    const newQuantity = editQuantity + 1;
    setEditQuantity(newQuantity);
    setHasQuantityChanged(newQuantity !== (item.quantity_estimate || 1));
  };

  const handleQuantityDecrement = () => {
    const newQuantity = Math.max(0, editQuantity - 1);
    setEditQuantity(newQuantity);
    setHasQuantityChanged(newQuantity !== (item.quantity_estimate || 1));
  };

  const handleSaveQuantity = () => {
    handleQuantityChange(editQuantity);
  };

  const handleCancelEdit = () => {
    setEditQuantity(item.quantity_estimate || 1);
    setHasQuantityChanged(false);
    setIsEditing(false);
  };

  const handleStorageChange = (storageLocation: string) => {
    onUpdateItem(originalIndex, { storageLocation });
  };

  const handleCategoryChange = (category: string) => {
    onUpdateItem(originalIndex, { category });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-theme-primary rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-theme">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-theme">
            <h3 className="text-lg font-semibold text-theme-primary">{item.item}</h3>
            <button
              onClick={onClose}
              className="text-theme-secondary opacity-70 hover:opacity-100 hover:text-theme-primary"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Item Image */}
          <div className="p-4 flex justify-center">
            <img
              src={item.image}
              alt={item.item}
              className="w-24 h-24 rounded-lg object-cover border-2 border-theme"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/images/placeholder.svg';
              }}
            />
          </div>

          {/* Item Details */}
          <div className="px-4 space-y-4">
            {/* Quantity Section */}
            <div className="bg-theme-secondary p-3 rounded-lg border border-theme">
              <label className="block text-sm font-medium text-theme-primary mb-2">
                Quantity
              </label>
              {isEditing ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={handleQuantityDecrement}
                      className="w-10 h-10 rounded-full bg-theme-primary border border-theme flex items-center justify-center text-theme-primary hover:bg-theme-secondary transition-colors"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <span className="text-2xl font-bold text-theme-primary min-w-[3rem] text-center">
                      {editQuantity}
                    </span>
                    <button
                      onClick={handleQuantityIncrement}
                      className="w-10 h-10 rounded-full bg-theme-primary border border-theme flex items-center justify-center text-theme-primary hover:bg-theme-secondary transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  {hasQuantityChanged && (
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={handleSaveQuantity}
                        className="px-4 py-2 bg-[var(--accent-color)] text-white rounded-lg text-sm hover:bg-[var(--accent-color)]/80 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-4 py-2 bg-theme-primary text-theme-primary border border-theme rounded-lg text-sm hover:bg-theme-secondary transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-theme-primary">{item.quantity_estimate || 1}</span>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-[var(--accent-color)] hover:text-[var(--accent-color)]/80"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Original Quantity (from recipe/shopping list) */}
            {item.originalQuantity && (
              <div className="bg-theme-secondary p-3 rounded-lg border border-theme">
                <label className="block text-sm font-medium text-theme-primary mb-1">
                  Recipe Quantity
                </label>
                <div className="text-theme-primary">
                  {item.originalQuantity}
                </div>
                <p className="text-xs text-theme-primary/70 mt-1">
                  Original amount needed from recipe
                </p>
              </div>
            )}

            {/* Expiration Date */}
            {item.expirationDate && (
              <div className="bg-theme-secondary p-3 rounded-lg border border-theme">
                <label className="block text-sm font-medium text-theme-primary mb-2">
                  Expiration
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-theme-primary">
                    {new Date(item.expirationDate).toLocaleDateString()}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    getExpirationColor(item.expirationDate, item.expirationType) === 'red'
                      ? 'bg-red-100 text-red-800'
                      : getExpirationColor(item.expirationDate, item.expirationType) === 'yellow'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {Math.ceil((new Date(item.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
                  </span>
                </div>
              </div>
            )}

            {/* Storage Location */}
            <div className="bg-theme-secondary p-3 rounded-lg border border-theme">
              <label className="block text-sm font-medium text-theme-primary mb-2">
                Storage Location
              </label>
              <select
                value={item.storageLocation || 'pantry'}
                onChange={(e) => handleStorageChange(e.target.value)}
                className="w-full px-3 py-2 border border-theme rounded-md bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
              >
                <option value="pantry">Pantry</option>
                <option value="fridge">Refrigerator</option>
                <option value="freezer">Freezer</option>
                <option value="spices">Spice Rack</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Category */}
            <div className="bg-theme-secondary p-3 rounded-lg border border-theme">
              <label className="block text-sm font-medium text-theme-primary mb-2">
                Category
              </label>
              <select
                value={item.category || 'Manual'}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2 border border-theme rounded-md bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
              >
                {getAllCategories(customCategories).map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="px-4 py-4 border-t border-theme space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onAddToShoppingList([item.item])}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--accent-color)] text-[var(--text-theme-primary)] rounded-lg hover:bg-[var(--accent-color)]/80 transition-colors"
              >
                <ShoppingBasket className="w-4 h-4" />
                Buy More
              </button>
              <button
                onClick={() => setShowPriceTrends(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--bg-theme-secondary)] text-[var(--text-theme-primary)] border border-[var(--border-theme)] rounded-lg hover:bg-[var(--bg-theme-primary)] transition-colors"
              >
                <TrendingUp className="w-4 h-4" />
                Price Trends
              </button>
            </div>
            <button
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete ${item.item}?`)) {
                  onDeleteItem(originalIndex);
                  onClose();
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Item
            </button>
          </div>
        </div>
      </div>

      {/* Price Trends Modal */}
      {showPriceTrends && (
        <PriceTrends
          ingredient={item.item}
          onClose={() => setShowPriceTrends(false)}
        />
      )}
    </>
  );
};

export default ItemDetailModal;