import React, { useState, useEffect } from 'react';
import { X, TrendingUp, ShoppingBasket, Trash2, Edit3, Package, Minus, Plus, Zap, History } from 'lucide-react';
import { PantryItem } from '../types';
import PriceTrends from './PriceTrends';
import { getAllCategories, getExpirationColor, cleanItemNameForShopping, formatItemQuantity, parseQuantity } from '../utils/appUtils';
import { getNutritionFactsWithFallback, NutritionFacts, formatNutrition } from '../services/nutritionService';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import VisualQuantitySelector from './VisualQuantitySelector';
import QuantityUnitPicker from './QuantityUnitPicker';

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
  const [editQuantity, setEditQuantity] = useState(() => {
    if (item.quantity) {
      return item.quantity.amount;
    }
    return parseInt(item.quantity_estimate) || 1;
  });
  const [editUnit, setEditUnit] = useState(() => {
    if (item.quantity) {
      return item.quantity.unit;
    }
    return 'count';
  });
  const [nutrition, setNutrition] = useState<NutritionFacts | null>(null);
  const [loadingNutrition, setLoadingNutrition] = useState(true);
  const [isEditingExpiration, setIsEditingExpiration] = useState(false);
  const [editExpirationDate, setEditExpirationDate] = useState(() => item.expirationDate || '');
  const [editExpirationType, setEditExpirationType] = useState(() => item.expirationType || 'best-by');
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [batchQty, setBatchQty] = useState<number>(1);
  const [batchUnit, setBatchUnit] = useState<string>('count');
  const [batchExpires, setBatchExpires] = useState<string | undefined>(undefined);

  // Compute summed total from batches when present
  const batchTotal = (item.batches && item.batches.length > 0)
    ? item.batches.reduce((sum, b) => sum + (b.quantity || 0), 0)
    : 0;
  const batchUnitDisplay = (item.batches && item.batches.length > 0) ? item.batches[0].unit : undefined;

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

  // Keyboard navigation support
  useKeyboardNavigation({
    onEscape: onClose,
    enabled: true
  });

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity >= 0) {
      // Update both old and new quantity systems for compatibility
      const updates: Partial<PantryItem> = {
        quantity_estimate: newQuantity.toString()
      };

      if (item.quantity) {
        updates.quantity = {
          ...item.quantity,
          amount: newQuantity,
          unit: editUnit
        };
      } else {
        // Create new quantity object if it doesn't exist
        updates.quantity = {
          amount: newQuantity,
          unit: editUnit
        };
      }

      onUpdateItem(originalIndex, updates);
      setEditQuantity(newQuantity);
    }
  };

  const handleUnitChange = (newUnit: string) => {
    const updates: Partial<PantryItem> = {
      quantity: {
        amount: editQuantity,
        unit: newUnit
      }
    };

    onUpdateItem(originalIndex, updates);
    setEditUnit(newUnit);
  };

  const handleSaveExpiration = () => {
    const updates: Partial<PantryItem> = {
      expirationDate: editExpirationDate || undefined,
      expirationType: editExpirationType
    };
    onUpdateItem(originalIndex, updates);
    setIsEditingExpiration(false);
  };

  const handleCancelExpirationEdit = () => {
    setEditExpirationDate(item.expirationDate || '');
    setEditExpirationType(item.expirationType || 'best-by');
    setIsEditingExpiration(false);
  };

  const handleStorageChange = (storageLocation: string) => {
    onUpdateItem(originalIndex, { storageLocation });
  };

  const handleCategoryChange = (category: string) => {
    onUpdateItem(originalIndex, { category });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
        <div className="bg-theme-primary rounded-lg shadow-xl w-full max-w-md mx-auto max-h-[80vh] flex flex-col border border-theme">
          {/* Header - Fixed */}
          <div className="flex items-center justify-between pt-4 px-3 pb-3 border-b border-theme flex-shrink-0">
            <h3 className="text-lg font-semibold text-theme-primary">{item.item}</h3>
            <button
              onClick={onClose}
              className="text-theme-secondary opacity-70 hover:opacity-100 hover:text-theme-primary"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {/* Item Image */}
            <div className="pb-2 flex justify-center">
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
            <div className="px-3 space-y-2">
            {/* Quantity Section - Compact */}
            <div className="bg-theme-secondary p-1.5 rounded-lg border border-theme">
              <label className="block text-sm font-medium text-theme-primary mb-1.5">
                Quantity
              </label>
              {batchTotal > 0 && (
                <div className="mb-2 text-sm text-theme-primary flex items-center justify-between">
                  <div className="opacity-80">Total (batches)</div>
                  <div className="font-medium">{batchTotal} {batchUnitDisplay || ''}</div>
                </div>
              )}
              <QuantityUnitPicker
                quantity={editQuantity}
                unit={editUnit}
                onQuantityChange={handleQuantityChange}
                onUnitChange={handleUnitChange}
                itemName={item.item}
                showControls={true}
              />
            </div>

            {/* Original Quantity (from recipe/shopping list) */}
            {item.originalQuantity && (
              <div className="bg-theme-secondary p-2 rounded-lg border border-theme">
                <label className="block text-xs font-medium text-theme-primary mb-1 uppercase opacity-70">
                  Recipe Qty
                </label>
                <div className="text-sm text-theme-primary">
                  {item.originalQuantity}
                </div>
              </div>
            )}

            {/* Expiration Date */}
            {/* Batches Section */}
            <div className="bg-theme-secondary p-2 rounded-lg border border-theme">
              <label className="block text-xs font-medium text-theme-primary mb-1 uppercase opacity-70">
                Batches
              </label>
              {(item.batches && item.batches.length > 0) ? (
                <div className="space-y-2">
                  {item.batches.map((b) => (
                    <div key={b.batchId} className="flex items-center justify-between bg-theme-primary p-2 rounded">
                      <div>
                        <div className="text-sm font-medium text-theme-primary">{b.quantity} {b.unit || ''}</div>
                        <div className="text-xs text-theme-secondary">{b.expires ? `Expires ${new Date(b.expires).toLocaleDateString()}` : 'No expiry'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => {
                          setEditingBatchId(b.batchId);
                          setBatchQty(b.quantity);
                          setBatchUnit(b.unit || 'count');
                          setBatchExpires(b.expires);
                        }} className="p-2 text-theme-secondary hover:text-[var(--accent-color)]">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => {
                          if (confirm('Remove this batch?')) {
                            const updated = (item.batches || []).filter(x => x.batchId !== b.batchId);
                            onUpdateItem(originalIndex, { batches: updated });
                          }
                        }} className="p-2 text-theme-secondary hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-theme-secondary opacity-70">No purchase batches recorded for this item.</div>
              )}

              <div className="mt-3 flex gap-2">
                <button onClick={() => {
                  // Add a new empty batch with default qty 1
                  const now = new Date().toISOString();
                  const newBatch = { batchId: crypto.randomUUID(), quantity: 1, unit: 'count', expires: undefined, purchaseDate: now };
                  const updated = [...(item.batches || []), newBatch];
                  onUpdateItem(originalIndex, { batches: updated });
                }} className="px-3 py-1 bg-[var(--accent-color)] text-white rounded">Add Batch</button>
                {editingBatchId && (
                  <button onClick={() => { setEditingBatchId(null); }} className="px-3 py-1 bg-theme-secondary rounded">Close Edit</button>
                )}
              </div>
            </div>
            <div className="bg-theme-secondary p-2 rounded-lg border border-theme">
              <label className="block text-xs font-medium text-theme-primary mb-1 uppercase opacity-70">
                Expiration
              </label>
              {isEditingExpiration ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={editExpirationDate}
                      onChange={(e) => setEditExpirationDate(e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-theme rounded-md bg-theme-primary text-black focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                    />
                    <select
                      value={editExpirationType}
                      onChange={(e) => setEditExpirationType(e.target.value as 'use-by' | 'best-by')}
                      className="px-2 py-1 text-sm border border-theme rounded-md bg-theme-primary text-black focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                    >
                      <option value="best-by">Best By</option>
                      <option value="use-by">Use By</option>
                    </select>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={handleSaveExpiration}
                      className="px-3 py-1 text-sm bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-color)]/80 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelExpirationEdit}
                      className="px-3 py-1 text-sm bg-theme-primary text-theme-primary border border-theme rounded-lg hover:bg-theme-secondary transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  {item.expirationDate ? (
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
                  ) : (
                    <span className="text-sm text-theme-secondary opacity-70">No expiration set</span>
                  )}
                  <button
                    onClick={() => setIsEditingExpiration(true)}
                    className="text-[var(--accent-color)] hover:text-[var(--accent-color)]/80"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Batch Edit Inline Modal */}
            {editingBatchId && (
              <div className="bg-theme-secondary p-3 rounded-lg border border-theme mt-3">
                <label className="block text-xs font-medium text-theme-primary mb-1 uppercase opacity-70">Edit Batch</label>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-theme-secondary">Quantity</label>
                    <input type="number" min={0} step={0.01} value={batchQty} onChange={(e) => setBatchQty(parseFloat(e.target.value) || 0)} className="w-full mt-1 p-2 rounded border text-black" />
                  </div>
                  <div>
                    <label className="text-xs text-theme-secondary">Unit</label>
                    <input value={batchUnit} onChange={(e) => setBatchUnit(e.target.value)} className="w-full mt-1 p-2 rounded border" />
                  </div>
                  <div>
                    <label className="text-xs text-theme-secondary">Expiration</label>
                    <input type="date" value={batchExpires || ''} onChange={(e) => setBatchExpires(e.target.value || undefined)} className="w-full mt-1 p-2 rounded border text-black" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end mt-3">
                  <button onClick={() => setEditingBatchId(null)} className="px-3 py-1 rounded bg-theme-secondary">Cancel</button>
                  <button onClick={() => {
                    // Apply edits to the batch list
                    const updated = (item.batches || []).map(b => b.batchId === editingBatchId ? { ...b, quantity: batchQty, unit: batchUnit, expires: batchExpires } : b);
                    onUpdateItem(originalIndex, { batches: updated });
                    setEditingBatchId(null);
                  }} className="px-3 py-1 rounded bg-[var(--accent-color)] text-white">Save</button>
                </div>
              </div>
            )}

            {/* Storage Location & Category - Side by Side */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-theme-secondary p-2 rounded-lg border border-theme">
                <label className="block text-xs font-medium text-theme-primary mb-1 uppercase opacity-70">
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

              <div className="bg-theme-secondary p-2 rounded-lg border border-theme">
                <label className="block text-xs font-medium text-theme-primary mb-1 uppercase opacity-70">
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
              <div className="bg-theme-secondary p-3 rounded-lg border border-theme">
                <div className="flex items-center gap-2 text-sm text-theme-primary">
                  <Zap className="w-4 h-4 opacity-50 animate-pulse" />
                  <span className="opacity-70">Loading nutrition info...</span>
                </div>
              </div>
            ) : nutrition ? (
              <div className="bg-gradient-to-br from-theme-secondary to-theme-secondary/80 p-3 rounded-lg border border-theme">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-[var(--accent-color)]" />
                  <h4 className="font-semibold text-theme-primary text-sm">Nutrition Facts</h4>
                  <span className="text-xs text-theme-primary/70 ml-auto">{nutrition.servingSize}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {nutrition.calories && (
                    <div className="bg-theme-primary/30 p-1.5 rounded">
                      <div className="text-xs text-theme-primary/70">Calories</div>
                      <div className="text-sm font-bold text-theme-primary">{Math.round(nutrition.calories)}</div>
                    </div>
                  )}
                  {nutrition.protein && (
                    <div className="bg-theme-primary/30 p-1.5 rounded">
                      <div className="text-xs text-theme-primary/70">Protein</div>
                      <div className="text-sm font-bold text-theme-primary">{nutrition.protein.toFixed(1)}g</div>
                    </div>
                  )}
                  {nutrition.carbs && (
                    <div className="bg-theme-primary/30 p-1.5 rounded">
                      <div className="text-xs text-theme-primary/70">Carbs</div>
                      <div className="text-sm font-bold text-theme-primary">{nutrition.carbs.toFixed(1)}g</div>
                    </div>
                  )}
                  {nutrition.fat && (
                    <div className="bg-theme-primary/30 p-1.5 rounded">
                      <div className="text-xs text-theme-primary/70">Fat</div>
                      <div className="text-sm font-bold text-theme-primary">{nutrition.fat.toFixed(1)}g</div>
                    </div>
                  )}
                  {nutrition.fiber && (
                    <div className="bg-theme-primary/30 p-1.5 rounded">
                      <div className="text-xs text-theme-primary/70">Fiber</div>
                      <div className="text-sm font-bold text-theme-primary">{nutrition.fiber.toFixed(1)}g</div>
                    </div>
                  )}
                  {nutrition.sugar && (
                    <div className="bg-theme-primary/30 p-1.5 rounded">
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

            {/* Consumption History Section */}
            {item.consumptionHistory && item.consumptionHistory.length > 0 && (
              <div className="bg-theme-secondary p-3 rounded-lg border border-theme">
                <div className="flex items-center gap-2 mb-3">
                  <History className="w-4 h-4 text-[var(--accent-color)]" />
                  <h4 className="font-semibold text-theme-primary text-sm">Consumption History</h4>
                </div>
                <div className="space-y-2">
                  {item.consumptionHistory.slice(-5).reverse().map((date, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-theme-primary/70">Consumed</span>
                      <span className="text-theme-primary font-medium">
                        {new Date(date).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                  {item.consumptionHistory.length > 5 && (
                    <div className="text-xs text-theme-primary/60 text-center mt-2">
                      +{item.consumptionHistory.length - 5} more entries
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          </div>

          {/* Action Buttons - Fixed at bottom */}
          <div className="flex-shrink-0 border-t border-theme bg-theme-primary">
            <div className="p-3 space-y-2">
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
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete ${item.item}?`)) {
                      onDeleteItem(originalIndex);
                      onClose();
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Item
                </button>
                <button
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--bg-theme-secondary)] text-[var(--text-theme-primary)] border border-[var(--border-theme)] rounded-lg hover:bg-[var(--bg-theme-primary)] transition-colors"
                >
                  <X className="w-4 h-4" />
                  Close
                </button>
              </div>
            </div>
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