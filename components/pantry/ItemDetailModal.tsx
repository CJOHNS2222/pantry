import React, { useState, useEffect } from 'react';
import { X, Trash2, Edit3, ChevronDown, ChevronRight, Minus, Plus, CalendarClock, TrendingUp } from 'lucide-react';
import { PantryItem, CustomCategory } from '../../types';
import { Tab } from '../../types/app';
import PriceTrends from './PriceTrends';
import { getAllCategories, cleanItemNameForShopping, getFreezerShelfLifeDays, getOpenedShelfLifeDays, getItemImageCdnUrl, getPreferredItemDisplayImage } from '../../utils/appUtils';
import { getQuantityAmount, getQuantityUnit } from '../../utils/quantityUtils';
import { getNutritionFactsWithFallback, NutritionFacts } from '../../services/nutritionService';
import { getItemTips } from '../../data/itemTips';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import QuantityUnitPicker from './QuantityUnitPicker';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useModalOpen } from '../../utils/useModalOpen';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import { useApp } from '../../contexts/AppContext';
import { useAppActions } from '../../contexts/AppActionsContext';
import { useIntl } from 'react-intl';
import { uploadItemImage } from '../../services/imageService';
import { log } from '../../services/logService';

interface ItemDetailModalProps {
  item: PantryItem;
  onClose: () => void;
  onUpdateItem: (index: number, updates: Partial<PantryItem>) => void;
  onDeleteItem: (index: number) => void;
  onAddToShoppingList: (items: string[]) => void;
  customCategories: CustomCategory[];
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
  const [localVisualLevel, setLocalVisualLevel] = useState<PantryItem['visualLevel']>(() => {
    if (item.visualLevel) return item.visualLevel;
    const qty = getQuantityAmount(item.quantity ?? item.quantity_estimate);
    if (qty === 0) return 'empty';
    if (qty === 0.25) return 'quarter';
    if (qty === 0.5) return 'half';
    if (qty === 0.75) return 'threeQuarter';
    if (qty === 1) return 'full';
    return undefined;
  });
  // Image upload state
  const intl = useIntl();
  const { household, user, settings } = useApp();
  const { addToast, setActiveTab } = useAppActions();
  const showNutrition = settings?.shopping?.showNutrition ?? false;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Focus trap for accessibility
  const modalRef = useFocusTrap({ isActive: true });
  useModalOpen();

  useEffect(() => {
    // Reset local state when item prop changes
    const qty = getQuantityAmount(item.quantity ?? item.quantity_estimate);
    setLocalQuantity(qty);
    setLocalUnit(getQuantityUnit(item.quantity ?? item.quantity_estimate));
    setLocalStorageLocation(item.storageLocation || 'pantry');
    setLocalCategory(item.category || 'Manual');
    setLocalExpirationDate(item.expirationDate || '');
    setLocalExpirationType(item.expirationType || 'best-by');
    setLocalNotes(item.notes || '');
    setLocalIsStaple(item.isStaple || false);
    setLocalIsOpened(item.isOpened || false);
    setLocalVisualLevel(item.visualLevel || (
      qty === 0 ? 'empty' :
      qty === 0.25 ? 'quarter' :
      qty === 0.5 ? 'half' :
      qty === 0.75 ? 'threeQuarter' :
      qty === 1 ? 'full' : undefined
    ));
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
      } catch {
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

      // Sync visual level based on quantity
      if (newQuantity === 0) {
        setLocalVisualLevel('empty');
      } else if (newQuantity === 0.25) {
        setLocalVisualLevel('quarter');
      } else if (newQuantity === 0.5) {
        setLocalVisualLevel('half');
      } else if (newQuantity === 0.75) {
        setLocalVisualLevel('threeQuarter');
      } else if (newQuantity === 1) {
        setLocalVisualLevel('full');
      } else {
        setLocalVisualLevel(undefined);
      }
    }
  };

  const handleVisualLevelChange = (level: PantryItem['visualLevel']) => {
    setLocalVisualLevel(level);
    if (level === 'empty') {
      handleQuantityChange(0);
    } else if (level === 'quarter') {
      handleQuantityChange(0.25);
    } else if (level === 'half') {
      handleQuantityChange(0.5);
    } else if (level === 'threeQuarter') {
      handleQuantityChange(0.75);
    } else if (level === 'full') {
      handleQuantityChange(1);
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
    if (!file.type.startsWith('image/')) {
      addToast('Please select a valid image file.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      addToast('Image must be smaller than 10MB.', 'error');
      return;
    }
    setSelectedFile(file);
    try {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } catch {
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
    } catch (err: unknown) {
      log.error('Failed to upload image', { item: item.item, error: (err as Error)?.message }, 'ItemDetailModal');
      addToast('Failed to upload image. Please try again.', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCloseAndPersist = () => {
    const updates: Partial<PantryItem> = {};

    // Quantity
    if (localQuantity !== getQuantityAmount(item.quantity ?? item.quantity_estimate) || localUnit !== getQuantityUnit(item.quantity ?? item.quantity_estimate)) {
      updates.quantity = { amount: localQuantity, unit: localUnit } as unknown as PantryItem['quantity'];
      updates.quantity_estimate = String(localQuantity);
    }

    // Storage & Category
    if (localStorageLocation !== (item.storageLocation || 'pantry')) updates.storageLocation = localStorageLocation;
    if (localCategory !== (item.category || 'Manual')) updates.category = localCategory;

    // When moving to freezer, auto-extend expiry to USDA freezer shelf life
    if (localStorageLocation === 'freezer' && item.storageLocation !== 'freezer') {
      const freezerDays = getFreezerShelfLifeDays(item.item);
      const freezerDate = new Date();
      freezerDate.setDate(freezerDate.getDate() + freezerDays);
      const freezerDateStr = freezerDate.toISOString().split('T')[0];
      updates.is_frozen = true;
      updates.frozenAt = new Date().toISOString();
      updates.freezerExpiry = freezerDateStr;
      updates.expirationDate = freezerDateStr;
      updates.expirationType = 'best-by';
    } else if (localStorageLocation !== 'freezer' && item.storageLocation === 'freezer') {
      // Moving out of freezer — clear frozen state
      updates.is_frozen = false;
      updates.frozenAt = undefined;
      updates.freezerExpiry = undefined;
    }

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
        // Calculate opened expiry based on item name and category
        const category = localCategory || item.category;
        const openedDays = getOpenedShelfLifeDays(item.item, category);
        if (openedDays !== undefined) {
          const openedExpiry = new Date();
          openedExpiry.setDate(openedExpiry.getDate() + openedDays);
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

  // Android hardware-back support (nested modal closes first, then detail modal)
  useAndroidBack(showPriceTrends, () => setShowPriceTrends(false));
  useAndroidBack(true, handleCloseAndPersist);

  // Keyboard navigation support — defined here because handleCloseAndPersist must be initialized first
  useKeyboardNavigation({
    onEscape: handleCloseAndPersist,
    enabled: true
  });

  // Collapsible section state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-[9999] px-4 pt-[var(--safe-area-inset-top,0px)] pb-[var(--safe-area-inset-bottom,0px)]" onClick={handleCloseAndPersist}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label={item.item} className="bg-theme-primary rounded-lg shadow-xl w-full max-w-md mx-auto h-full flex flex-col border border-theme" onClick={e => e.stopPropagation()}>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Hero section ── */}
          <div className="relative px-4 pt-4 pb-2">
            {/* Close button */}
            <button
              onClick={handleCloseAndPersist}
              className="absolute top-4 left-4 p-1.5 hover:bg-theme-secondary rounded-full transition-colors z-10"
              aria-label={intl.formatMessage({ id: 'common.closeModal' })}
              data-testid="item-close"
            >
              <X className="w-5 h-5 text-theme-secondary" />
            </button>

            {/* Item image */}
            <div className="flex justify-center pt-2 pb-4">
              <label className="cursor-pointer group relative">
                <img
                  src={previewUrl || getPreferredItemDisplayImage(item.item, item.category, item.image)}
                  alt={item.item}
                  className="w-28 h-28 rounded-xl object-cover border-2 border-theme group-hover:opacity-80 transition-opacity"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement | null;
                    if (!target) return;
                    const cdn = getItemImageCdnUrl(item.item);
                    if (cdn && target.src !== cdn) {
                      target.src = cdn;
                    } else {
                      target.src = '/images/placeholder.svg';
                    }
                  }}
                />
                {uploadingImage && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileInput(file);
                      if (file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024) {
                        setSelectedFile(file);
                        setTimeout(() => handleUploadImage(), 100);
                      }
                    }
                  }}
                  className="hidden"
                  data-testid="item-file-input"
                />
              </label>
            </div>

            {/* Item name + weight + edit icon */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-theme-primary">{item.item}</h2>
                <p className="text-sm text-theme-secondary">
                  {`${localQuantity} ${localUnit}`}
                </p>
              </div>
              <button
                onClick={() => toggleSection('productDetails')}
                className="p-1.5 hover:bg-theme-secondary rounded-full transition-colors"
                aria-label="Edit item details"
              >
                <Edit3 className="w-4 h-4 text-theme-secondary" />
              </button>
            </div>

            {/* Quantity +/- controls */}
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={() => handleQuantityChange(Math.max(0, localQuantity - 1))}
                className="w-9 h-9 flex items-center justify-center rounded-full border border-theme text-theme-secondary hover:bg-theme-secondary transition-colors"
                aria-label="Decrease quantity"
                data-testid="item-qty-minus"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-lg font-semibold text-theme-primary min-w-[2rem] text-center">{localQuantity}</span>
              <button
                onClick={() => handleQuantityChange(localQuantity + 1)}
                className="w-9 h-9 flex items-center justify-center rounded-full border border-theme text-theme-secondary hover:bg-theme-secondary transition-colors"
                aria-label="Increase quantity"
                data-testid="item-qty-plus"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Fill Level - Portion Selector */}
            <div className="mt-4">
              <div className="text-xs font-medium text-theme-secondary mb-2">Select Amount Left</div>
              <div className="flex gap-1.5">
                {([
                  { value: 'empty',        label: 'Empty', icon: '○', color: '#ef4444' },
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
                      onClick={() => handleVisualLevelChange(selected ? undefined : value)}
                      className={`flex-1 flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg border transition-all duration-150 ${
                        selected
                          ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/10 scale-105'
                          : 'border-theme bg-theme-primary hover:bg-theme-secondary hover:scale-105'
                      }`}
                      data-testid={`item-visual-${value}`}
                      aria-pressed={selected}
                      title={value === 'empty' ? 'Empty' : `${label} full`}
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

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={() => onAddToShoppingList([cleanItemNameForShopping(item.item)])}
                className="px-3 py-1.5 text-sm font-medium border border-[var(--accent-color)] text-[var(--accent-color)] rounded-lg hover:bg-[var(--accent-color)]/10 transition-colors"
                data-testid="item-add-to-shopping"
              >
                ADD TO SHOPPING LIST
              </button>
              <button
                onClick={() => {
                  onDeleteItem(originalIndex);
                  onClose();
                  addToast(`${item.item} deleted`, 'success');
                }}
                className="p-1.5 text-theme-secondary hover:text-red-500 transition-colors ml-auto"
                data-testid="item-delete"
                aria-label="Delete item"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="border-t border-theme mt-2" />

          {/* ── Collapsible Sections ── */}

          {/* Product Details Section */}
          <div className="border-b border-theme">
            <button
              onClick={() => toggleSection('productDetails')}
              className="w-full flex items-center justify-between px-4 py-4 text-left"
            >
              <span className="text-base font-semibold text-theme-primary">Product Details</span>
              {openSections.productDetails ? <ChevronDown className="w-5 h-5 text-theme-secondary" /> : <ChevronRight className="w-5 h-5 text-theme-secondary" />}
            </button>
            {openSections.productDetails && (
              <div className="px-4 pb-4 space-y-3">
                {/* Category */}
                <div className="bg-theme-secondary rounded-lg p-3">
                  <div className="text-xs text-theme-secondary mb-1">Category</div>
                  <select
                    value={localCategory}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-theme rounded-lg bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                    data-testid="item-category-select"
                  >
                    {getAllCategories(customCategories).map(category => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>



                {/* Quantity / Unit Picker */}
                <div className="bg-theme-secondary rounded-lg p-3">
                  <div className="text-xs text-theme-secondary mb-1">Weight / Volume</div>
                  <QuantityUnitPicker
                    quantity={editQuantity}
                    unit={editUnit}
                    onQuantityChange={handleQuantityChange}
                    onUnitChange={handleUnitChange}
                    itemName={item.item}
                    showControls={false}
                  />
                </div>

                {/* Staple toggle */}
                <label className="flex items-center gap-3 bg-theme-secondary rounded-lg p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localIsStaple}
                    onChange={(e) => setLocalIsStaple(e.target.checked)}
                    className="flex-shrink-0 w-4 h-4 accent-[var(--accent-color)]"
                    data-testid="item-staple-checkbox"
                  />
                  <span className="text-sm text-theme-primary">Mark as staple (auto-readds when depleted)</span>
                </label>

                {/* Opened Tracking */}
                {['Canned Goods', 'Condiments & Sauces', 'Spices & Herbs', 'Baking Supplies', 'Snacks', 'Beverages'].includes(localCategory) && (
                  <label className="flex items-center gap-3 bg-theme-secondary rounded-lg p-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localIsOpened}
                      onChange={(e) => setLocalIsOpened(e.target.checked)}
                      className="flex-shrink-0 w-4 h-4 accent-[var(--accent-color)]"
                      data-testid="item-opened-checkbox"
                    />
                    <div>
                      <span className="text-sm text-theme-primary">
                        Mark as opened {localIsOpened && item.openedAt && `(opened ${new Date(item.openedAt).toLocaleDateString()})`}
                      </span>
                      {localIsOpened && item.openedExpiry && (
                        <p className="text-xs text-theme-secondary mt-0.5">
                          Opened expiry: {new Date(item.openedExpiry).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </label>
                )}

                {/* Save Button */}
                <button
                  onClick={handleCloseAndPersist}
                  className="w-full py-2 bg-[var(--accent-color)] text-white rounded-lg font-medium text-sm hover:bg-[var(--accent-color)]/80 transition-colors"
                  data-testid="item-save-details"
                >
                  SAVE
                </button>
              </div>
            )}
          </div>

          {/* Storage Section */}
          <div className="border-b border-theme">
            <button
              onClick={() => toggleSection('storage')}
              className="w-full flex items-center justify-between px-4 py-4 text-left"
            >
              <span className="text-base font-semibold text-theme-primary">Storage</span>
              {openSections.storage ? <ChevronDown className="w-5 h-5 text-theme-secondary" /> : <ChevronRight className="w-5 h-5 text-theme-secondary" />}
            </button>
            {openSections.storage && (
              <div className="px-4 pb-4 space-y-3">
                {/* Storage location chips */}
                <div>
                  <div className="text-xs font-medium text-theme-secondary mb-2">Choose Storage Space</div>
                  <div className="flex flex-wrap gap-2">
                    {(['fridge', 'pantry', 'freezer', 'spices', 'other'] as PantryItem['storageLocation'][]).map(loc => (
                      <button
                        key={loc}
                        onClick={() => handleStorageChange(loc!)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                          localStorageLocation === loc
                            ? 'bg-[var(--accent-color)] text-white'
                            : 'bg-theme-secondary text-theme-primary hover:bg-theme-primary'
                        }`}
                        data-testid={`item-storage-${loc}`}
                      >
                        {loc ? loc.charAt(0).toUpperCase() + loc.slice(1) : ''}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Expiry Date */}
                <div className="bg-theme-secondary rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-theme-secondary">Expiry Date</div>
                      <div className="text-sm font-medium text-theme-primary">
                        {localExpirationDate
                          ? new Date(localExpirationDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                          : 'Not set'}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEditExpirationDate((localExpirationDate || '').split('T')[0]);
                        setEditExpirationType(localExpirationType);
                        setIsEditingExpiration(!isEditingExpiration);
                      }}
                      className="p-1.5 hover:bg-theme-primary rounded-full transition-colors"
                    >
                      <CalendarClock className="w-4 h-4 text-theme-secondary" />
                    </button>
                  </div>
                  {isEditingExpiration && (
                    <div className="mt-2 space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={editExpirationDate}
                          onChange={(e) => setEditExpirationDate(e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-theme rounded-lg bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                        />
                        <select
                          value={editExpirationType}
                          onChange={(e) => setEditExpirationType(e.target.value as 'use-by' | 'best-by')}
                          className="px-2 py-1.5 text-sm border border-theme rounded-lg bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                        >
                          <option value="best-by">{intl.formatMessage({ id: 'pantry.bestBy' })}</option>
                          <option value="use-by">{intl.formatMessage({ id: 'pantry.useBy' })}</option>
                        </select>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={handleSaveExpiration}
                          className="px-3 py-1 text-sm bg-[var(--accent-color)] text-white rounded-lg"
                          data-testid="item-save-expiration"
                        >
                          {intl.formatMessage({ id: 'common.save' })}
                        </button>
                        <button
                          onClick={handleCancelExpirationEdit}
                          className="px-3 py-1 text-sm bg-theme-primary text-theme-primary border border-theme rounded-lg"
                          data-testid="item-cancel-expiration"
                        >
                          {intl.formatMessage({ id: 'common.cancel' })}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Nutritional Information Section */}
          <div className="border-b border-theme">
              <button
                onClick={() => toggleSection('nutrition')}
                className="w-full flex items-center justify-between px-4 py-4 text-left"
              >
                <span className="text-base font-semibold text-theme-primary">Nutritional Information</span>
                {openSections.nutrition ? <ChevronDown className="w-5 h-5 text-theme-secondary" /> : <ChevronRight className="w-5 h-5 text-theme-secondary" />}
              </button>
              {openSections.nutrition && (
                <div className="px-4 pb-4">
                  {!showNutrition ? (
                    <div className="py-3 flex flex-col items-start gap-2">
                      <p className="text-sm text-theme-secondary">Nutrition data is disabled. Enable it in Settings to see calories, protein, carbs, and more for this item.</p>
                      <button
                        onClick={() => { onClose(); setActiveTab(Tab.SETTINGS); }}
                        className="text-xs font-semibold text-[var(--accent-color)] hover:opacity-80 transition-opacity underline-offset-2 hover:underline"
                      >
                        Go to Settings → Shopping Preferences
                      </button>
                    </div>
                  ) : loadingNutrition ? (
                    <div className="flex items-center gap-2 text-sm text-theme-secondary py-2">
                      <div className="w-4 h-4 border-2 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin" />
                      Loading nutrition info...
                    </div>
                  ) : nutrition ? (
                    <div className="space-y-3">
                      {/* Serving Size */}
                      <div className="bg-theme-secondary rounded-lg p-3">
                        <div className="text-xs text-theme-secondary">Serving Size</div>
                        <div className="flex items-baseline justify-between">
                          <div className="text-lg font-semibold text-theme-primary">{nutrition.servingSize || '100.0'}</div>
                          <div className="text-sm text-theme-secondary">g/ml</div>
                        </div>
                      </div>

                      {/* Nutrition grid - 2 columns */}
                      <div className="grid grid-cols-2 gap-2">
                        {nutrition.calories != null && (
                          <div className="bg-theme-secondary rounded-lg p-3">
                            <div className="text-xs text-theme-secondary">Calories</div>
                            <div className="flex items-baseline justify-between">
                              <div className="text-lg font-semibold text-theme-primary">{Math.round(nutrition.calories)}</div>
                              <div className="text-xs text-theme-secondary">Cal</div>
                            </div>
                          </div>
                        )}
                        {nutrition.sugar != null && (
                          <div className="bg-theme-secondary rounded-lg p-3">
                            <div className="text-xs text-theme-secondary">Sugar</div>
                            <div className="flex items-baseline justify-between">
                              <div className="text-lg font-semibold text-theme-primary">{nutrition.sugar.toFixed(1)}</div>
                              <div className="text-xs text-theme-secondary">g</div>
                            </div>
                          </div>
                        )}
                        {nutrition.fat != null && (
                          <div className="bg-theme-secondary rounded-lg p-3">
                            <div className="text-xs text-theme-secondary">Fat</div>
                            <div className="flex items-baseline justify-between">
                              <div className="text-lg font-semibold text-theme-primary">{nutrition.fat.toFixed(1)}</div>
                              <div className="text-xs text-theme-secondary">g</div>
                            </div>
                          </div>
                        )}
                        {nutrition.fiber != null && (
                          <div className="bg-theme-secondary rounded-lg p-3">
                            <div className="text-xs text-theme-secondary">Fiber</div>
                            <div className="flex items-baseline justify-between">
                              <div className="text-lg font-semibold text-theme-primary">{nutrition.fiber.toFixed(1)}</div>
                              <div className="text-xs text-theme-secondary">g</div>
                            </div>
                          </div>
                        )}
                        {nutrition.carbs != null && (
                          <div className="bg-theme-secondary rounded-lg p-3">
                            <div className="text-xs text-theme-secondary">Carbs</div>
                            <div className="flex items-baseline justify-between">
                              <div className="text-lg font-semibold text-theme-primary">{nutrition.carbs.toFixed(1)}</div>
                              <div className="text-xs text-theme-secondary">g</div>
                            </div>
                          </div>
                        )}
                        {nutrition.protein != null && (
                          <div className="bg-theme-secondary rounded-lg p-3">
                            <div className="text-xs text-theme-secondary">Protein</div>
                            <div className="flex items-baseline justify-between">
                              <div className="text-lg font-semibold text-theme-primary">{nutrition.protein.toFixed(1)}</div>
                              <div className="text-xs text-theme-secondary">g</div>
                            </div>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-theme-secondary opacity-60 mt-2">
                        Source: USDA FoodData Central • Per {nutrition.servingSize}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-theme-secondary py-2">Nutrition N/A</p>
                  )}
                </div>
              )}
            </div>

          {/* Tips Section */}
          {(() => {
            const itemTips = getItemTips(item.item);
            if (!itemTips) return null;
            return (
              <div className="border-b border-theme">
                <button
                  onClick={() => toggleSection('tips')}
                  className="w-full flex items-center justify-between px-4 py-4 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-theme-primary">Tips</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--accent-color)]/15 text-[var(--accent-color)]">Did you know?</span>
                  </div>
                  {openSections.tips ? <ChevronDown className="w-5 h-5 text-theme-secondary" /> : <ChevronRight className="w-5 h-5 text-theme-secondary" />}
                </button>
                {openSections.tips && (
                  <div className="px-4 pb-5 space-y-4">
                    {itemTips.sections.map((section) => (
                      <div key={section.title}>
                        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-color)] mb-1.5">
                          {section.title}
                        </div>
                        <p className="text-sm text-theme-primary leading-relaxed">
                          {section.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* History Section */}
          <div className="border-b border-theme">
              <button
                onClick={() => toggleSection('history')}
                className="w-full flex items-center justify-between px-4 py-4 text-left"
              >
                <span className="text-base font-semibold text-theme-primary">History</span>
                {openSections.history ? <ChevronDown className="w-5 h-5 text-theme-secondary" /> : <ChevronRight className="w-5 h-5 text-theme-secondary" />}
              </button>
              {openSections.history && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Date added */}
                  {item.dateAdded && (
                    <div>
                      <div className="text-sm font-medium text-[var(--accent-color)]">
                        {new Date(item.dateAdded).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                      <div className="text-sm text-theme-secondary">
                        Product added · {`${getQuantityAmount(item.quantity ?? item.quantity_estimate)} ${getQuantityUnit(item.quantity ?? item.quantity_estimate)}`}
                      </div>
                    </div>
                  )}
                  {/* Consumption history entries */}
                  {item.consumptionHistory && item.consumptionHistory.length > 0 ? (
                    <>
                      {item.consumptionHistory.slice(-5).reverse().map((date, index) => (
                        <div key={index}>
                          <div className="text-sm font-medium text-[var(--accent-color)]">
                            {new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                          </div>
                          <div className="text-sm text-theme-secondary">Consumed</div>
                        </div>
                      ))}
                      {item.consumptionHistory.length > 5 && (
                        <div className="text-xs text-theme-secondary opacity-60">
                          +{item.consumptionHistory.length - 5} more entries
                        </div>
                      )}
                    </>
                  ) : !item.dateAdded ? (
                    <p className="text-sm text-theme-secondary py-2">No history available yet.</p>
                  ) : null}
                </div>
              )}
            </div>

          {/* Notes Section */}
          <div className="px-4 py-4 border-b border-theme">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-color)] mb-2">
              Notes (Private)
            </div>
            <textarea
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              placeholder="Add any notes about this item..."
              className="w-full px-3 py-2 text-sm border border-theme rounded-xl bg-theme-secondary text-theme-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] resize-none transition-all"
              rows={2}
              data-testid="item-notes"
            />
          </div>

          {/* Bottom padding for safe scrolling */}
          <div className="h-4" />

          {/* Price Trends entry point */}
          <div className="px-4 pb-4">
            <button
              onClick={() => setShowPriceTrends(true)}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-theme text-sm font-medium text-theme-secondary hover:bg-theme-secondary transition-colors"
            >
              <TrendingUp className="w-4 h-4" aria-hidden="true" />
              View Price Trends
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
    </>
  );
};

export default ItemDetailModal;