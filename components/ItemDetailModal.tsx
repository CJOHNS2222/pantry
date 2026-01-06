import React, { useState, useEffect } from 'react';
import { X, TrendingUp, ShoppingBasket, Trash2, Edit3, Package, Minus, Plus, Zap } from 'lucide-react';
import { PantryItem } from '../types';
import PriceTrends from './PriceTrends';
import { getAllCategories, getExpirationColor, cleanItemNameForShopping } from '../utils/appUtils';
import { getNutritionFactsWithFallback, NutritionFacts, formatNutrition } from '../services/nutritionService';

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
  const [nutrition, setNutrition] = useState<NutritionFacts | null>(null);
  const [loadingNutrition, setLoadingNutrition] = useState(true);

  // Fetch nutrition facts on component mount
  useEffect(() => {
    const fetchNutrition = async () => {
      setLoadingNutrition(true);
      try {
        const nutritionData = await getNutritionFactsWithFallback(item.item, item.category || 'Manual');
        setNutrition(nutritionData);
      } catch (error) {
        console.warn('Failed to fetch nutrition:', error);
        setNutrition(null);
      } finally {
        setLoadingNutrition(false);
      }
    };
    fetchNutrition();
  }, [item.item, item.category]);

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
                console.log('Image failed to load:', e.target.src);
                const target = e.target as HTMLImageElement;
                target.src = '/images/placeholder.svg';
              }}
            />
          </div>

          {/* Item Details */}
          <div className="px-4 space-y-4">
            {/* Quantity Section - Compact */}
            <div className="bg-theme-secondary p-3 rounded-lg border border-theme">
              <label className="block text-sm font-medium text-theme-primary mb-2">
                Quantity
              </label>
              {isEditing ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={handleQuantityDecrement}
                      className="w-8 h-8 rounded-full bg-theme-primary border border-theme flex items-center justify-center text-theme-primary hover:bg-theme-secondary transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-xl font-bold text-theme-primary min-w-[2rem] text-center">
                      {editQuantity}
                    </span>
                    <button
                      onClick={handleQuantityIncrement}
                      className="w-8 h-8 rounded-full bg-theme-primary border border-theme flex items-center justify-center text-theme-primary hover:bg-theme-secondary transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {hasQuantityChanged && (
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={handleSaveQuantity}
                        className="px-3 py-1 text-sm bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-color)]/80 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-3 py-1 text-sm bg-theme-primary text-theme-primary border border-theme rounded-lg hover:bg-theme-secondary transition-colors"
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
                <label className="block text-xs font-medium text-theme-primary mb-1 uppercase opacity-70">
                  Recipe Qty
                </label>
                <div className="text-sm text-theme-primary">
                  {item.originalQuantity}
                </div>
              </div>
            )}

            {/* Expiration Date */}
            {item.expirationDate && (
              <div className="bg-theme-secondary p-3 rounded-lg border border-theme">
                <label className="block text-xs font-medium text-theme-primary mb-1 uppercase opacity-70">
                  Expiration
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-theme-primary">
                    {new Date(item.expirationDate).toLocaleDateString()}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
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

            {/* Storage Location & Category - Side by Side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-theme-secondary p-3 rounded-lg border border-theme">
                <label className="block text-xs font-medium text-theme-primary mb-2 uppercase opacity-70">
                  Storage
                </label>
                <select
                  value={item.storageLocation || 'pantry'}
                  onChange={(e) => handleStorageChange(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-theme rounded-md bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                >
                  <option value="pantry">Pantry</option>
                  <option value="fridge">Fridge</option>
                  <option value="freezer">Freezer</option>
                  <option value="spices">Spices</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="bg-theme-secondary p-3 rounded-lg border border-theme">
                <label className="block text-xs font-medium text-theme-primary mb-2 uppercase opacity-70">
                  Category
                </label>
                <select
                  value={item.category || 'Manual'}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-theme rounded-md bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                >
                  {getAllCategories(customCategories).map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Nutrition Facts Section */}
            {loadingNutrition ? (
              <div className="bg-theme-secondary p-4 rounded-lg border border-theme">
                <div className="flex items-center gap-2 text-sm text-theme-primary">
                  <Zap className="w-4 h-4 opacity-50 animate-pulse" />
                  <span className="opacity-70">Loading nutrition info...</span>
                </div>
              </div>
            ) : nutrition ? (
              <div className="bg-gradient-to-br from-theme-secondary to-theme-secondary/80 p-4 rounded-lg border border-theme">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-[var(--accent-color)]" />
                  <h4 className="font-semibold text-theme-primary text-sm">Nutrition Facts</h4>
                  <span className="text-xs text-theme-primary/70 ml-auto">{nutrition.servingSize}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {nutrition.calories && (
                    <div className="bg-theme-primary/30 p-2 rounded">
                      <div className="text-xs text-theme-primary/70">Calories</div>
                      <div className="text-sm font-bold text-theme-primary">{Math.round(nutrition.calories)}</div>
                    </div>
                  )}
                  {nutrition.protein && (
                    <div className="bg-theme-primary/30 p-2 rounded">
                      <div className="text-xs text-theme-primary/70">Protein</div>
                      <div className="text-sm font-bold text-theme-primary">{nutrition.protein.toFixed(1)}g</div>
                    </div>
                  )}
                  {nutrition.carbs && (
                    <div className="bg-theme-primary/30 p-2 rounded">
                      <div className="text-xs text-theme-primary/70">Carbs</div>
                      <div className="text-sm font-bold text-theme-primary">{nutrition.carbs.toFixed(1)}g</div>
                    </div>
                  )}
                  {nutrition.fat && (
                    <div className="bg-theme-primary/30 p-2 rounded">
                      <div className="text-xs text-theme-primary/70">Fat</div>
                      <div className="text-sm font-bold text-theme-primary">{nutrition.fat.toFixed(1)}g</div>
                    </div>
                  )}
                  {nutrition.fiber && (
                    <div className="bg-theme-primary/30 p-2 rounded">
                      <div className="text-xs text-theme-primary/70">Fiber</div>
                      <div className="text-sm font-bold text-theme-primary">{nutrition.fiber.toFixed(1)}g</div>
                    </div>
                  )}
                  {nutrition.sugar && (
                    <div className="bg-theme-primary/30 p-2 rounded">
                      <div className="text-xs text-theme-primary/70">Sugar</div>
                      <div className="text-sm font-bold text-theme-primary">{nutrition.sugar.toFixed(1)}g</div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-theme-primary/60 mt-3">
                  Source: USDA FoodData Central • Per {nutrition.servingSize}
                </p>
              </div>
            ) : null}
          </div>

          {/* Action Buttons */}
          <div className="px-4 py-4 border-t border-theme space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onAddToShoppingList([cleanItemNameForShopping(item.item)])}
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