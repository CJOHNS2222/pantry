import React, { useState, useEffect } from 'react';
import { X, TrendingUp, ShoppingBasket, Trash2, Edit3, Zap, History } from 'lucide-react';
import { PantryItem } from '../types';
import PriceTrends from './PriceTrends';
import { getAllCategories, getExpirationColor, cleanItemNameForShopping, formatItemQuantity, parseQuantity } from '../utils/appUtils';
import { getQuantityAmount, getQuantityUnit } from '../utils/quantityUtils';
import { getNutritionFactsWithFallback, NutritionFacts, formatNutrition } from '../services/nutritionService';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { useFocusTrap } from '../hooks/useFocusTrap';
import QuantityUnitPicker from './QuantityUnitPicker';
import { COMMON_UNITS, getSmartUnits } from './QuantityUnitPicker';
import { useApp } from '../contexts/AppContext';
import { useAppActions } from '../contexts/AppActionsContext';
import { useIntl } from 'react-intl';
import { uploadItemImage } from '../services/imageService';
import { log } from '../services/logService';

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
  // Local-only state while modal is open; persist on close
  const [localQuantity, setLocalQuantity] = useState<number>(getQuantityAmount(item.quantity ?? item.quantity_estimate));
  const [localUnit, setLocalUnit] = useState<string>(getQuantityUnit(item.quantity ?? item.quantity_estimate));
  const [localStorageLocation, setLocalStorageLocation] = useState<PantryItem['storageLocation']>(item.storageLocation || 'pantry');
  const [localCategory, setLocalCategory] = useState<string>(item.category || 'Manual');
  const [localExpirationDate, setLocalExpirationDate] = useState<string>(item.expirationDate || '');
  const [localExpirationType, setLocalExpirationType] = useState<'use-by' | 'best-by'>(item.expirationType || 'best-by');
  const [localNotes, setLocalNotes] = useState<string>(item.notes || '');
  const [localIsStaple, setLocalIsStaple] = useState<boolean>(item.isStaple || false);
  const [localIsOpened, setLocalIsOpened] = useState<boolean>(item.isOpened || false);
  const [localVisualLevel, setLocalVisualLevel] = useState<PantryItem['visualLevel']>(item.visualLevel);
  // Image upload state
  const intl = useIntl();
  const { household, user, settings } = useApp();
  const { addToast } = useAppActions();
  const showNutrition = settings?.shopping?.showNutrition ?? false;
  const showPriceData = settings?.shopping?.showPriceData ?? false;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Focus trap for accessibility
  const modalRef = useFocusTrap({ isActive: true });

  useEffect(() => {
    // Reset local state when item prop changes
    setLocalQuantity(getQuantityAmount(item.quantity ?? item.quantity_estimate));
    setLocalUnit(getQuantityUnit(item.quantity ?? item.quantity_estimate));
    setLocalStorageLocation(item.storageLocation || 'pantry');
    setLocalCategory(item.category || 'Manual');
    setLocalExpirationDate(item.expirationDate || '');
    setLocalExpirationType(item.expirationType || 'best-by');
    setLocalNotes(item.notes || '');
    setLocalIsStaple(item.isStaple || false);
    setLocalIsOpened(item.isOpened || false);
    setLocalVisualLevel(item.visualLevel);
  }, [item]);

  // Fetch nutrition facts on component mount (only when showNutrition is enabled)
  useEffect(() => {
    if (!showNutrition) {
      setLoadingNutrition(false);
      return;
    }
    const fetchNutrition = async () => {
      setLoadingNutrition(true);
      try {
        const nutritionData = await getNutritionFactsWithFallback(item.item, item.category || 'Manual');
        setNutrition(nutritionData);
      } catch (error) {
        log.warn('Failed to fetch nutrition', { item: item.item }, 'ItemDetailModal');
        setNutrition(null);
      } finally {
        setLoadingNutrition(false);
      }
    };
    fetchNutrition();
  }, [item.item, item.category, showNutrition]);

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

  // Image handlers
  const handleFileInput = (file?: File) => {
    if (!file) return;
    setSelectedFile(file);
    try {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } catch (err) {
      setPreviewUrl(null);
    }
  };

  const handleUploadImage = async () => {
    if (!selectedFile) return;
    setUploadingImage(true);
    try {
      // Choose upload target and scope automatically: household if available, otherwise user
      const targetId = household?.id || user?.id || 'user';
      const scopeToUse: 'household' | 'user' = household?.id ? 'household' : 'user';
      const downloadUrl = await uploadItemImage(selectedFile, targetId, item.item, scopeToUse, user?.id);
      // Persist image URL via provided update callback
      onUpdateItem(originalIndex, { image: downloadUrl });
      // clear local selection after success
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (err: any) {
      log.error('Failed to upload image', { item: item.item, error: err?.message }, 'ItemDetailModal');
      addToast('Failed to upload image. Please try again.', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCloseAndPersist = () => {
    const updates: Partial<PantryItem> = {};

    // Quantity
    if (localQuantity !== getQuantityAmount(item.quantity ?? item.quantity_estimate) || localUnit !== getQuantityUnit(item.quantity ?? item.quantity_estimate)) {
      updates.quantity = { amount: localQuantity, unit: localUnit } as any;
      updates.quantity_estimate = String(localQuantity);
    }

    // Storage & Category
    if (localStorageLocation !== (item.storageLocation || 'pantry')) updates.storageLocation = localStorageLocation;
    if (localCategory !== (item.category || 'Manual')) updates.category = localCategory;

    // Expiration
    if (localExpirationDate !== (item.expirationDate || '') || localExpirationType !== (item.expirationType || 'best-by')) {
      updates.expirationDate = localExpirationDate || undefined;
      updates.expirationType = localExpirationType;
    }

    // Notes
    if (localNotes !== (item.notes || '')) {
      updates.notes = localNotes || undefined;
    }

    // Staple
    if (localIsStaple !== (item.isStaple || false)) {
      updates.isStaple = localIsStaple;
    }

    // Visual fill level
    if (localVisualLevel !== item.visualLevel) {
      updates.visualLevel = localVisualLevel;
    }

    // Opened tracking
    if (localIsOpened !== (item.isOpened || false)) {
      updates.isOpened = localIsOpened;
      if (localIsOpened && !item.openedAt) {
        // Item is being marked as opened for the first time
        updates.openedAt = new Date().toISOString();
        // Calculate opened expiry based on category (simplified logic)
        const category = localCategory || item.category;
        if (category === 'Canned Goods' || category === 'Condiments & Sauces') {
          // These typically last 6-12 months after opening
          const openedExpiry = new Date();
          openedExpiry.setMonth(openedExpiry.getMonth() + 6);
          updates.openedExpiry = openedExpiry.toISOString().split('T')[0];
        }
      } else if (!localIsOpened) {
        // Item is being unmarked as opened
        updates.openedAt = undefined;
        updates.openedExpiry = undefined;
      }
    }

    if (Object.keys(updates).length > 0) {
      onUpdateItem(originalIndex, updates);
    }

    onClose();
  };

  // Keyboard navigation support — defined here because handleCloseAndPersist must be initialized first
  useKeyboardNavigation({
    onEscape: handleCloseAndPersist,
    enabled: true
  });

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-[9999] px-4 pt-[var(--app-header-h)] pb-[var(--app-nav-h)]">
        <div ref={modalRef} className="bg-theme-primary rounded-lg shadow-xl w-full max-w-md mx-auto max-h-full flex flex-col border border-theme">
          {/* Header - Fixed */}
          <div className="flex items-center justify-between p-4 pb-3 border-b border-theme flex-shrink-0 rounded-t-lg">
            <h3 className="text-lg font-semibold text-theme-primary">{item.item}</h3>
            <div className="flex items-center gap-2">
              <div className="text-sm text-theme-secondary">
                {intl.formatMessage({ id: 'common.addedOn' }, { date: item.dateAdded ? new Date(item.dateAdded).toLocaleDateString() : intl.formatMessage({ id: 'common.unknown' }) })}
              </div>
              <button
                onClick={handleCloseAndPersist}
                className="p-1 hover:bg-theme-secondary rounded-full transition-colors"
                aria-label={intl.formatMessage({ id: 'common.closeModal' })}
              >
                <X className="w-5 h-5 text-theme-secondary" />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Item Image + upload */}
            <div className="pb-2 flex items-center gap-4">
              {/* Change picture button - left side */}
              <label className="cursor-pointer px-2 py-1 bg-theme-secondary text-theme-primary rounded text-xs hover:bg-theme-primary hover:text-theme-secondary border border-theme flex-shrink-0">
                Change Photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileInput(e.target.files?.[0])}
                  className="hidden"
                />
              </label>

              {/* Image in center */}
              <div className="flex-1 flex justify-center">
                <img
                  src={previewUrl || item.image || '/images/placeholder.svg'}
                  alt={item.item}
                  className="w-24 h-24 rounded-lg object-cover border-2 border-theme"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement | null;
                    if (target) target.src = '/images/placeholder.svg';
                  }}
                />
              </div>

              {/* Upload button - right side */}
              <button
                onClick={handleUploadImage}
                disabled={!selectedFile || uploadingImage}
                className="px-2 py-1 bg-[var(--accent-color)] text-white rounded text-xs flex-shrink-0 disabled:opacity-50"
              >
                {uploadingImage ? 'Uploading...' : 'Save Photo'}
              </button>
            </div>

            {/* Item Details */}
            <div className="px-3 space-y-2">
            {/* Quantity Section - Compact */}
            <div className="bg-theme-secondary p-1.5 rounded-lg border border-theme">
              <label className="block text-sm font-medium text-theme-primary mb-1.5">
                Quantity
              </label>
              <QuantityUnitPicker
                quantity={editQuantity}
                unit={editUnit}
                onQuantityChange={handleQuantityChange}
                onUnitChange={handleUnitChange}
                itemName={item.item}
                showControls={true}
              />
              {/* Visual fill level selector */}
              <div className="mt-2">
                <div className="text-xs font-medium text-theme-primary opacity-70 uppercase mb-1">Fill Level</div>
                <div className="flex gap-1.5">
                  {([
                    { value: 'quarter',      label: '¼',  icon: '◔', color: '#f59e0b' },
                    { value: 'half',         label: '½',  icon: '◑', color: '#f97316' },
                    { value: 'threeQuarter', label: '¾',  icon: '◕', color: '#22c55e' },
                    { value: 'full',         label: 'Full', icon: '●', color: '#16a34a' },
                  ] as { value: NonNullable<PantryItem['visualLevel']>; label: string; icon: string; color: string }[]).map(({ value, label, icon, color }) => {
                    const selected = localVisualLevel === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setLocalVisualLevel(selected ? undefined : value)}
                        className={`flex-1 flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg border transition-all duration-150 ${
                          selected
                            ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/10 scale-105'
                            : 'border-theme bg-theme-primary hover:bg-theme-secondary hover:scale-105'
                        }`}
                        aria-pressed={selected}
                        title={`${label} full`}
                      >
                        <span
                          className="text-xl leading-none transition-all"
                          style={{ color: selected ? color : 'rgb(156 163 175)', filter: selected ? `drop-shadow(0 0 4px ${color}80)` : undefined }}
                        >
                          {icon}
                        </span>
                        <span className={`text-[10px] font-medium leading-none ${
                          selected ? 'text-[var(--accent-color)]' : 'text-theme-secondary'
                        }`}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Original Quantity (from recipe/shopping list) */}
            {(item as any).originalQuantity && (
              <div className="bg-theme-secondary p-2 rounded-lg border border-theme">
                <label className="block text-xs font-medium text-theme-primary mb-1 uppercase opacity-70">
                  {intl.formatMessage({ id: 'pantry.recipeQty' })}
                </label>
                <div className="text-sm text-theme-primary">
                  {(item as any).originalQuantity}
                </div>
              </div>
            )}

            {/* Expiration Date */}
            <div className="bg-theme-secondary p-2 rounded-lg border border-theme">
              <label className="block text-xs font-medium text-theme-primary mb-1 uppercase opacity-70">
                {intl.formatMessage({ id: 'pantry.expiration' })}
              </label>
              {isEditingExpiration ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={editExpirationDate}
                      onChange={(e) => setEditExpirationDate(e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-theme rounded-md bg-white text-black focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                    />
                    <select
                      value={editExpirationType}
                      onChange={(e) => setEditExpirationType(e.target.value as 'use-by' | 'best-by')}
                      className="px-2 py-1 text-sm border border-theme rounded-md bg-white text-black focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                    >
                      <option value="best-by">{intl.formatMessage({ id: 'pantry.bestBy' })}</option>
                      <option value="use-by">{intl.formatMessage({ id: 'pantry.useBy' })}</option>
                    </select>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={handleSaveExpiration}
                      className="px-3 py-1 text-sm bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-color)]/80 transition-colors"
                    >
                      {intl.formatMessage({ id: 'common.save' })}
                    </button>
                    <button
                      onClick={handleCancelExpirationEdit}
                      className="px-3 py-1 text-sm bg-theme-primary text-theme-primary border border-theme rounded-lg hover:bg-theme-secondary transition-colors"
                    >
                      {intl.formatMessage({ id: 'common.cancel' })}
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
                    <span className="text-sm text-theme-secondary opacity-70">{intl.formatMessage({ id: 'pantry.noExpirationSet' })}</span>
                  )}
                  <button
                    onClick={() => {
                      setEditExpirationDate((localExpirationDate || '').split('T')[0]);
                      setEditExpirationType(localExpirationType);
                      setIsEditingExpiration(true);
                    }}
                    className="text-[var(--accent-color)] hover:text-[var(--accent-color)]/80"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

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
                  <option value="pantry">{intl.formatMessage({ id: 'pantry.storageLocations.pantry' })}</option>
                  <option value="fridge">{intl.formatMessage({ id: 'pantry.storageLocations.fridge' })}</option>
                  <option value="freezer">{intl.formatMessage({ id: 'pantry.storageLocations.freezer' })}</option>
                  <option value="spices">{intl.formatMessage({ id: 'pantry.storageLocations.spices' })}</option>
                  <option value="other">{intl.formatMessage({ id: 'pantry.storageLocations.other' })}</option>
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

            {/* Staple Checkbox */}
            <div className="bg-theme-secondary p-2 rounded-lg border border-theme">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localIsStaple}
                  onChange={(e) => setLocalIsStaple(e.target.checked)}
                  className="flex-shrink-0"
                />
                <span className="text-sm text-theme-primary">Mark as staple (auto-readds to shopping list when depleted)</span>
              </label>
            </div>

            {/* Opened Tracking Checkbox - Only show for certain categories */}
            {['Canned Goods', 'Condiments & Sauces', 'Spices & Herbs', 'Baking Supplies', 'Snacks', 'Beverages'].includes(localCategory) && (
              <div className="bg-theme-secondary p-2 rounded-lg border border-theme">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localIsOpened}
                    onChange={(e) => setLocalIsOpened(e.target.checked)}
                    className="flex-shrink-0"
                  />
                  <span className="text-sm text-theme-primary">
                    Mark as opened {localIsOpened && item.openedAt && `(opened ${new Date(item.openedAt).toLocaleDateString()})`}
                  </span>
                </label>
                {localIsOpened && item.openedExpiry && (
                  <p className="text-xs text-theme-secondary mt-1">
                    Opened expiry: {new Date(item.openedExpiry).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}

            {/* User Notes Section */}
            <div className="bg-theme-secondary p-2 rounded-lg border border-theme">
              <label className="block text-xs font-medium text-theme-primary mb-1 uppercase opacity-70">
                Notes
              </label>
              <textarea
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
                placeholder="Add any notes about this item..."
                className="w-full px-2 py-1.5 text-sm border border-theme rounded-md bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] resize-none"
                rows={3}
              />
            </div>

            {/* Nutrition Facts Section */}
            {showNutrition && loadingNutrition ? (
              <div className="bg-theme-secondary p-3 rounded-lg border border-theme">
                <div className="flex items-center gap-2 text-sm text-theme-primary">
                  <Zap className="w-4 h-4 opacity-50 animate-pulse" />
                  <span className="opacity-70">Loading nutrition info...</span>
                </div>
              </div>
            ) : showNutrition && nutrition ? (
              <div className="bg-gradient-to-br from-theme-secondary to-theme-secondary/80 p-3 rounded-lg border border-theme">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-[var(--accent-color)]" />
                  <h4 className="font-semibold text-theme-primary text-sm">{intl.formatMessage({ id: 'pantry.nutritionFacts' })}</h4>
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
                  <h4 className="font-semibold text-theme-primary text-sm">{intl.formatMessage({ id: 'pantry.consumptionHistory' })}</h4>
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


          {/* Action Buttons - Fixed at bottom */}
          <div className="flex-shrink-0 border-t border-theme bg-theme-primary p-4 rounded-b-lg space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onAddToShoppingList([cleanItemNameForShopping(item.item)])}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--accent-color)] text-[var(--text-theme-primary)] rounded-lg hover:bg-[var(--accent-color)]/80 transition-colors"
              >
                <ShoppingBasket className="w-4 h-4" />
                {intl.formatMessage({ id: 'pantry.buyMore' })}
              </button>
              {showPriceData && (
                <button
                  onClick={() => setShowPriceTrends(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--bg-theme-secondary)] text-[var(--text-theme-primary)] border border-[var(--border-theme)] rounded-lg hover:bg-[var(--bg-theme-primary)] transition-colors"
                >
                  <TrendingUp className="w-4 h-4" />
                  {intl.formatMessage({ id: 'pantry.priceTrends' })}
                </button>
              )}
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
                {intl.formatMessage({ id: 'pantry.deleteItem' })}
              </button>
              <button
                onClick={handleCloseAndPersist}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--bg-theme-secondary)] text-[var(--text-theme-primary)] border border-[var(--border-theme)] rounded-lg hover:bg-[var(--bg-theme-primary)] transition-colors"
              >
                <X className="w-4 h-4" />
                {intl.formatMessage({ id: 'common.close' })}
              </button>
            </div>
          </div>

          {/* Price Trends Modal */}
          {showPriceTrends && (
            <PriceTrends
              ingredient={item.item}
              onClose={() => setShowPriceTrends(false)}
            />
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default ItemDetailModal;