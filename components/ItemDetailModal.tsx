import React, { useState, useEffect } from 'react';
import { X, TrendingUp, ShoppingBasket, Trash2, Edit3, Package, Minus, Plus, Zap, History } from 'lucide-react';
import { PantryItem } from '../types';
import PriceTrends from './PriceTrends';
import { getAllCategories, getExpirationColor, cleanItemNameForShopping, formatItemQuantity, parseQuantity } from '../utils/appUtils';
import { getQuantityAmount, getQuantityUnit } from '../utils/quantityUtils';
import { getNutritionFactsWithFallback, NutritionFacts, formatNutrition } from '../services/nutritionService';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import VisualQuantitySelector from './VisualQuantitySelector';
import QuantityUnitPicker from './QuantityUnitPicker';
import { COMMON_UNITS, getSmartUnits } from './QuantityUnitPicker';

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
  const [editQuantity, setEditQuantity] = useState(() => getQuantityAmount(item.quantity ?? item.quantity_estimate));
  const [editUnit, setEditUnit] = useState(() => getQuantityUnit(item.quantity ?? item.quantity_estimate));
  const [nutrition, setNutrition] = useState<NutritionFacts | null>(null);
  const [loadingNutrition, setLoadingNutrition] = useState(true);
  const [isEditingExpiration, setIsEditingExpiration] = useState(false);
  const [editExpirationDate, setEditExpirationDate] = useState(() => item.expirationDate || '');
  const [editExpirationType, setEditExpirationType] = useState(() => item.expirationType || 'best-by');
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [batchQty, setBatchQty] = useState<number>(1);
  const [batchUnit, setBatchUnit] = useState<string>('count');
  const [batchExpires, setBatchExpires] = useState<string | undefined>(undefined);
  const BATCH_MIN = 1;
  const BATCH_MAX = 100;
  // Local-only state while modal is open; persist on close
  const [localQuantity, setLocalQuantity] = useState<number>(getQuantityAmount(item.quantity ?? item.quantity_estimate));
  const [localUnit, setLocalUnit] = useState<string>(getQuantityUnit(item.quantity ?? item.quantity_estimate));
  const [localBatches, setLocalBatches] = useState(() => (item.batches ? JSON.parse(JSON.stringify(item.batches)) : []));
  const [localStorageLocation, setLocalStorageLocation] = useState<PantryItem['storageLocation']>(item.storageLocation || 'pantry');
  const [localCategory, setLocalCategory] = useState<string>(item.category || 'Manual');
  const [localExpirationDate, setLocalExpirationDate] = useState<string>(item.expirationDate || '');
  const [localExpirationType, setLocalExpirationType] = useState<'use-by' | 'best-by'>(item.expirationType || 'best-by');

  useEffect(() => {
    // Reset local state when item prop changes
    setLocalQuantity(getQuantityAmount(item.quantity ?? item.quantity_estimate));
    setLocalUnit(getQuantityUnit(item.quantity ?? item.quantity_estimate));
    setLocalBatches(item.batches ? JSON.parse(JSON.stringify(item.batches)) : []);
    setLocalStorageLocation(item.storageLocation || 'pantry');
    setLocalCategory(item.category || 'Manual');
    setLocalExpirationDate(item.expirationDate || '');
    setLocalExpirationType(item.expirationType || 'best-by');
  }, [item]);

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

  // Local-only change while modal is open; will persist on close
  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity >= 0) {
      setLocalQuantity(newQuantity);
      setEditQuantity(newQuantity);
    }
  };

  const handleUnitChange = (newUnit: string) => {
    setLocalUnit(newUnit);
    setEditUnit(newUnit);
  };

  const handleSaveExpiration = () => {
    setLocalExpirationDate(editExpirationDate || '');
    setLocalExpirationType(editExpirationType as 'use-by' | 'best-by');
    setIsEditingExpiration(false);
  };

  const handleCancelExpirationEdit = () => {
    setEditExpirationDate(localExpirationDate || item.expirationDate || '');
    setEditExpirationType(localExpirationType || (item.expirationType || 'best-by'));
    setIsEditingExpiration(false);
  };

  const handleStorageChange = (storageLocation: PantryItem['storageLocation']) => {
    setLocalStorageLocation(storageLocation);
  };

  const handleCategoryChange = (category: string) => {
    setLocalCategory(category);
  };

  const handleAddBatchLocal = () => {
    // Open inline purchase form for user to enter quantity + expiration
    const now = new Date().toISOString();
    const newBatchId = crypto.randomUUID();
    const newBatch = { batchId: newBatchId, quantity: 1, unit: 'count', expires: undefined, purchaseDate: now };
    setLocalBatches([...(localBatches || []), newBatch]);
    setEditingBatchId(newBatchId);
    setBatchQty(1);
    setBatchUnit('count');
    setBatchExpires(undefined);
  };

  const batchUnitOptions = React.useMemo(() => {
    const smart = getSmartUnits(item.item || '');
    const combined = [...smart, ...COMMON_UNITS.filter(u => !smart.includes(u))];
    if (!combined.includes('1/2 gallon')) {
      const idx = combined.indexOf('gallons');
      const insertAt = idx >= 0 ? idx + 1 : combined.length;
      combined.splice(insertAt, 0, '1/2 gallon');
    }
    return combined;
  }, [item.item]);

  const handleSaveBatchLocal = () => {
    // Ensure integer quantity and clamp
    const intQty = Math.max(BATCH_MIN, Math.min(BATCH_MAX, Math.floor(batchQty)));
    const exists = (localBatches || []).some((b: any) => b.batchId === editingBatchId);
    let updated;
    if (exists) {
      updated = (localBatches || []).map((b: any) => b.batchId === editingBatchId ? { ...b, quantity: intQty, unit: batchUnit, expires: batchExpires } : b);
    } else {
      // safety: add as new
      updated = [...(localBatches || []), { batchId: editingBatchId || crypto.randomUUID(), quantity: intQty, unit: batchUnit, expires: batchExpires, purchaseDate: new Date().toISOString() }];
    }
    setLocalBatches(updated);
    setEditingBatchId(null);
  };

  const handleDeleteBatchLocal = (batchId: string) => {
    setLocalBatches((localBatches || []).filter((x: any) => x.batchId !== batchId));
  };

  const handleCloseAndPersist = () => {
    const updates: Partial<PantryItem> = {};

    // Quantity
    if (localQuantity !== getQuantityAmount(item.quantity ?? item.quantity_estimate) || localUnit !== getQuantityUnit(item.quantity ?? item.quantity_estimate)) {
      updates.quantity = { amount: localQuantity, unit: localUnit } as any;
      updates.quantity_estimate = String(localQuantity);
    }

    // Batches
    // Compare JSON strings for simplicity
    if (JSON.stringify(localBatches || []) !== JSON.stringify(item.batches || [])) {
      updates.batches = localBatches;
    }

    // Storage & Category
    if (localStorageLocation !== (item.storageLocation || 'pantry')) updates.storageLocation = localStorageLocation;
    if (localCategory !== (item.category || 'Manual')) updates.category = localCategory;

    // Expiration
    if (localExpirationDate !== (item.expirationDate || '') || localExpirationType !== (item.expirationType || 'best-by')) {
      updates.expirationDate = localExpirationDate || undefined;
      updates.expirationType = localExpirationType;
    }

    if (Object.keys(updates).length > 0) {
      onUpdateItem(originalIndex, updates);
    }

    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
        <div className="bg-theme-primary rounded-lg shadow-xl w-full max-w-md mx-auto max-h-[80vh] flex flex-col border border-theme">
          {/* Header - Fixed */}
          <div className="flex items-center justify-between pt-4 px-3 pb-3 border-b border-theme flex-shrink-0">
            <h3 className="text-lg font-semibold text-theme-primary">{item.item}</h3>
            <button
              onClick={handleCloseAndPersist}
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
                  const target = e.target as HTMLImageElement | null;
                  console.log('Image failed to load:', target?.src);
                  if (target) target.src = '/images/placeholder.svg';
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
            {(item as any).originalQuantity && (
              <div className="bg-theme-secondary p-2 rounded-lg border border-theme">
                <label className="block text-xs font-medium text-theme-primary mb-1 uppercase opacity-70">
                  Recipe Qty
                </label>
                <div className="text-sm text-theme-primary">
                  {(item as any).originalQuantity}
                </div>
              </div>
            )}

            {/* Expiration Date */}
            {/* Batches Section */}
            <div className="bg-theme-secondary p-2 rounded-lg border border-theme">
              <label className="block text-xs font-medium text-theme-primary mb-1 uppercase opacity-70">
                Batches
              </label>
              {(localBatches && localBatches.length > 0) ? (
                <div className="space-y-2">
                  {localBatches.map((b: any) => (
                    <div key={b.batchId} className="bg-theme-primary p-2 rounded">
                      {editingBatchId === b.batchId ? (
                        // Inline editor for this batch
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-theme-primary">Edit Purchase</div>
                          <div>
                            <label className="text-xs text-theme-secondary">Quantity</label>
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="range"
                                min={BATCH_MIN}
                                max={BATCH_MAX}
                                step={1}
                                value={batchQty}
                                onChange={(e) => setBatchQty(parseInt(e.target.value || String(BATCH_MIN), 10))}
                                className="flex-1"
                              />
                              <input
                                type="number"
                                min={BATCH_MIN}
                                max={BATCH_MAX}
                                step={1}
                                value={batchQty}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value, 10);
                                  if (Number.isNaN(v)) {
                                    setBatchQty(BATCH_MIN);
                                  } else {
                                    setBatchQty(Math.max(BATCH_MIN, Math.min(BATCH_MAX, v)));
                                  }
                                }}
                                className="w-20 p-2 rounded border text-black"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-theme-secondary">Unit</label>
                            <select value={batchUnit} onChange={(e) => setBatchUnit(e.target.value)} className="w-full mt-1 p-2 rounded border bg-theme-primary text-theme-primary">
                              {batchUnitOptions.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-theme-secondary">Expiration</label>
                            <input type="date" value={batchExpires || ''} onChange={(e) => setBatchExpires(e.target.value || undefined)} className="w-full mt-1 p-2 rounded border text-black" />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-theme-primary/70">{b.expires ? `Originally: ${b.expires}` : ''}</div>
                            <div className="flex gap-2">
                              <button onClick={() => setEditingBatchId(null)} className="px-3 py-1 rounded bg-theme-secondary">Cancel</button>
                              <button onClick={() => { handleSaveBatchLocal(); }} className="px-3 py-1 rounded bg-[var(--accent-color)] text-white">Save</button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-theme-primary">{Math.round(b.quantity)} {b.unit || ''}</div>
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
                                handleDeleteBatchLocal(b.batchId);
                              }
                            }} className="p-2 text-theme-secondary hover:text-red-600">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-3 flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={handleAddBatchLocal}
                    title="Open inline purchase editor — purchases are saved when you close the modal"
                    className="px-3 py-1 bg-[var(--accent-color)] text-white rounded"
                  >
                    Add Purchase
                  </button>
                  {editingBatchId && (
                    <button onClick={() => { setEditingBatchId(null); }} className="px-3 py-1 bg-theme-secondary rounded">Close Edit</button>
                  )}
                </div>
                <div className="text-xs text-theme-primary/70">Purchase entries are saved when you close this dialog.</div>
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
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="range"
                          min={BATCH_MIN}
                          max={BATCH_MAX}
                          step={1}
                          value={batchQty}
                          onChange={(e) => setBatchQty(parseInt(e.target.value || String(BATCH_MIN), 10))}
                          className="flex-1"
                        />
                        <input
                          type="number"
                          min={BATCH_MIN}
                          max={BATCH_MAX}
                          step={1}
                          value={batchQty}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (Number.isNaN(v)) {
                              setBatchQty(BATCH_MIN);
                            } else {
                              setBatchQty(Math.max(BATCH_MIN, Math.min(BATCH_MAX, v)));
                            }
                          }}
                          className="w-20 p-2 rounded border text-black"
                        />
                      </div>
                      <div className="text-xs text-theme-secondary mt-1">Quantity must be a whole number between {BATCH_MIN} and {BATCH_MAX}.</div>
                    </div>
                    <div>
                      <label className="text-xs text-theme-secondary">Unit</label>
                      <select value={batchUnit} onChange={(e) => setBatchUnit(e.target.value)} className="w-full mt-1 p-2 rounded border bg-theme-primary text-theme-primary">
                        {batchUnitOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-theme-secondary">Expiration</label>
                      <input type="date" value={batchExpires || ''} onChange={(e) => setBatchExpires(e.target.value || undefined)} className="w-full mt-1 p-2 rounded border text-black" />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end mt-3">
                    <button onClick={() => setEditingBatchId(null)} className="px-3 py-1 rounded bg-theme-secondary">Cancel</button>
                    <button onClick={() => {
                      // Save to local batches (persist on modal close)
                      handleSaveBatchLocal();
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
                  onChange={(e) => handleStorageChange(e.target.value as PantryItem['storageLocation'])}
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