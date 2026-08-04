import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useModalOpen } from '../../utils/useModalOpen';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import { Camera, Plus, ChefHat, FilePlus, CheckSquare } from 'lucide-react';
import { PantryItem, LoadingState, ExpirationAlert, CustomCategory, PantryFilter, User, ShoppingItem, StructuredRecipe, SavedRecipe, ConsumptionSuggestion, RecipeSuggestion } from '../../types';

import { Tab } from '../../types/app';
import AnalyticsService from '../../services/analyticsService';
import { log } from '../../services/logService';

import ItemDetailModal from './ItemDetailModal';
import { PantryItemSkeleton } from '../ui/SkeletonLoader';
import { generateIntelligentRecipeQuery, savePantryFilter, defaultPantryFilter, RecipeIngredientMatch, getMealPrepSuggestions } from '../../utils/searchUtils';
import { getQuantityAmount } from '../../utils/quantityUtils';
import { PantryService } from '../../services/pantryService';
import { useApp } from '../../contexts/AppContext';
import { useAppActions } from '../../contexts/AppActionsContext';
import { useConfirm } from '../ui/ConfirmDialog';
import RecipeModal from '../recipes-meals/RecipeModal';
import { AdMobBanner } from '../ui/AdMobBanner';
import { canShowAds } from '../../utils/appUtils';
import { SettingsGuestBanner } from '../settings/SettingsGuestBanner';
import FreezeTransitionModal from './FreezeTransitionModal';
import HapticService from '../../services/hapticService';

import { PantryHealthScore } from './PantryHealthScore';
import { BottomSheet } from '../ui';
import { BulkQuantityEditModal } from './BulkQuantityEditModal';
import { PantrySearchModal } from './PantrySearchModal';
import { ReceiptScanResult } from './usePantryScan';
import { AddItemsModal } from './AddItemsModal';
import { ScanReviewModal } from './ScanReviewModal';
import PantryImportModal from './PantryImportModal';

// New modular components & hook for PantryScanner
import { usePantryFilterSort, DisplayedPantryItem } from './usePantryFilterSort';
import { PantryItemRow } from './PantryItemRow';
import { PantryItemTile } from './PantryItemTile';
import { PantryBulkActionBar } from './PantryBulkActionBar';
import { PantrySearchBar } from './PantrySearchBar';
import StorageLocationIndicator from './StorageLocationIndicator';

interface PantryScannerProps {
  inventory: PantryItem[];
  isLoadingInventory?: boolean;
  addToShoppingList: (items: string[]) => void;
  addShoppingListItem?: (item: Omit<ShoppingItem, 'id'>) => void;
  onDeleteItem: (index: number) => Promise<void>;
  onAddItem: (item: PantryItem) => Promise<void>;
  onAddItems: (items: PantryItem[]) => Promise<void>;
  onUpdateItem: (index: number, updates: Partial<PantryItem>) => Promise<void>;
  consumptionSuggestions?: ConsumptionSuggestion[];
  expirationAlerts?: ExpirationAlert[];
  recipeSuggestions?: RecipeSuggestion[];
  customCategories?: CustomCategory[];
  setActiveTab?: (tab: Tab) => void;
  setInitialSearchQuery?: (query: string) => void;
  user?: User | null;
}

const PantryScannerComponent: React.FC<PantryScannerProps> = ({
  inventory,
  isLoadingInventory = false,
  addToShoppingList,
  addShoppingListItem: _addShoppingListItem,
  onDeleteItem,
  onAddItem: _onAddItem,
  onAddItems: _onAddItems,
  onUpdateItem,
  consumptionSuggestions: _consumptionSuggestions = [],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  expirationAlerts = [],
  recipeSuggestions: _recipeSuggestions = [],
  customCategories = [],
  setActiveTab,
  setInitialSearchQuery,
  user
}) => {
  const appState = useApp();
  const appActions = useAppActions();
  const confirm = useConfirm();
  const { household, savedRecipes, recipeSaveLimitExceeded, settings, mealPlan } = appState;
  const { onSaveRecipe, onRateRecipe } = appActions;

  const [canShowAdBanner, setCanShowAdBanner] = React.useState<boolean>(false);

  // Modular filter, sort, search, section grouping hook
  const {
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery: _debouncedSearchQuery,
    showFilters,
    setShowFilters,
    pantryFilter,
    setPantryFilter,
    viewMode,
    setViewMode,
    sortBy,
    setSortBy,
    displayLayout,
    toggleDisplayLayout,
    expandedCategories: _expandedCategories,
    categoryOrder,
    storageSectionOrder,
    processedInventory: _processedInventory,
    sortedInventory,
    toggleCategory: _toggleCategory,
    toggleStorageLocation: _toggleStorageLocation,
    collapseAllCategories: _collapseAllCategories,
  } = usePantryFilterSort(inventory);

  useEffect(() => {
    let mounted = true;
    if (!user) {
      setCanShowAdBanner(false);
      return;
    }
    canShowAds(user).then(result => {
      if (mounted) setCanShowAdBanner(result);
    }).catch(() => {
      if (mounted) setCanShowAdBanner(false);
    });
    return () => { mounted = false; };
  }, [user]);

  const importedTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (importedTimerRef.current) {
        window.clearTimeout(importedTimerRef.current);
      }
      clearLongPressTimer();
    };
  }, []);

  const [_gridExpandedSections, setGridExpandedSections] = useState<Set<string>>(new Set());
  const _expandGridSection = useCallback((key: string) => {
    setGridExpandedSections(prev => new Set(prev).add(key));
  }, []);

  const updateItem = async (index: number, updates: Partial<PantryItem>) => {
    const item = inventory[index];
    if (!item) return;
    try {
      await onUpdateItem(index, updates);
    } catch (error) {
      log.error('Failed to update item', { error });
    }
  };

  const _handleWhatCanICookTonight = async () => {
    try {
      setLoadingState(LoadingState.LOADING);
      const query = generateIntelligentRecipeQuery(inventory, user?.profile?.dietaryRestrictions);
      if (!query) {
        appActions.addToast('No pantry items found. Add some items first!', 'info');
        return;
      }
      setInitialSearchQuery?.(query);
      setActiveTab?.(Tab.RECIPES);
      appActions.addToast('Found some meal ideas!', 'success');
    } catch (error) {
      log.error('Failed to get meal suggestions', { error });
      appActions.addToast('Failed to get meal suggestions. Try again.', 'error');
    } finally {
      setLoadingState(LoadingState.IDLE);
    }
  };

  const [_scanResults, _setScanResults] = useState<ReceiptScanResult[] | null>(null);
  const [_showScanReviewModal, _setShowScanReviewModal] = useState(false);
  const [_receiptDestination, _setReceiptDestination] = useState<'pantry' | 'shopping'>('pantry');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [_addModalInitialAction, setAddModalInitialAction] = useState<'photo' | 'barcode' | 'receipt' | 'nutrition' | null>(null);

  const [hasTappedAddButton, _setHasTappedAddButton] = useState(() => {
    try { return sessionStorage.getItem('clicked-pantry-add-button') === 'true'; } catch { return false; }
  });

  const _shouldGlowAddButton = useMemo(() => {
    if (hasTappedAddButton || isAddModalOpen) return false;
    try {
      const dismissed = localStorage.getItem('dismissed-tutorial-tips');
      if (!dismissed) return false;
      const parsed = JSON.parse(dismissed);
      return Array.isArray(parsed) ? parsed.includes('tip-pantry-scan') : false;
    } catch {
      return false;
    }
  }, [hasTappedAddButton, isAddModalOpen]);

  const [_loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [_showImportModal, setShowImportModal] = useState(false);
  const [_lastImportedBatch, _setLastImportedBatch] = useState<import('../../types').PantryItem[] | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [bulkLocationValue, setBulkLocationValue] = useState<string>('');
  const [_bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [_showBulkTip, setShowBulkTip] = useState(false);
  const [_storageOrder] = useState<string[]>(['pantry', 'fridge', 'freezer', 'spices', 'other']);
  const [_showPriceTrends, _setShowPriceTrends] = useState<string | null>(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [bulkQuantityEditItems, setBulkQuantityEditItems] = useState<PantryItem[]>([]);
  const [showBulkQuantityEdit, setShowBulkQuantityEdit] = useState(false);

  const { showDinnerCard: _showDinnerCard, showLeftoverChip: _showLeftoverChip } = useMemo(() => {
    let dinnerCard = false;
    const currentHour = new Date().getHours();
    const isDinnerTime = currentHour >= 16 && currentHour < 20;
    if (isDinnerTime) {
      const todayStr = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })();
      const todayPlan = mealPlan?.find(day => day.date === todayStr);
      dinnerCard = !todayPlan || !Array.isArray(todayPlan.dinner) || todayPlan.dinner.length === 0;
    }

    let leftoverChip = false;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const yesterdayPlan = mealPlan?.find(day => day.date === yesterdayStr);
    const hadMealYesterday = yesterdayPlan && ((yesterdayPlan.dinner?.length ?? 0) > 0 || (yesterdayPlan.lunch?.length ?? 0) > 0);

    if (hadMealYesterday) {
      const mostRecentUpdate = inventory.reduce((latest, item) => {
        const t = item.lastRestocked ? new Date(item.lastRestocked).getTime()
                : item.dateAdded ? new Date(item.dateAdded).getTime() : 0;
        return t > latest ? t : latest;
      }, 0);
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
      leftoverChip = mostRecentUpdate < twentyFourHoursAgo;
    }

    return { showDinnerCard: dinnerCard, showLeftoverChip: leftoverChip };
  }, [mealPlan, inventory]);

  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [showHealthDetail, setShowHealthDetail] = useState(false);

  useModalOpen(isAddModalOpen || _showScanReviewModal || showBulkQuantityEdit || isSearchModalOpen);

  const [_mealPrepSuggestions, setMealPrepSuggestions] = useState<RecipeIngredientMatch[]>([]);

  const _chipRowRef = useRef<HTMLDivElement>(null);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [modalRecipe, _setModalRecipe] = useState<StructuredRecipe | SavedRecipe | null>(null);
  const [modalContext, _setModalContext] = useState<'search' | 'scheduled'>('search');
  const [freezeTargetIndex, setFreezeTargetIndex] = useState<number | null>(null);

  useAndroidBack(showRecipeModal, () => setShowRecipeModal(false));
  useAndroidBack(showFilters, () => setShowFilters(false));
  useAndroidBack(searchQuery.length > 0, () => setSearchQuery(''));
  useAndroidBack(showHealthDetail, () => setShowHealthDetail(false));
  useAndroidBack(isSearchModalOpen, () => setIsSearchModalOpen(false));

  useEffect(() => {
    try {
      if (sessionStorage.getItem('open-pantry-add-modal') === 'true') {
        setIsAddModalOpen(true);
        sessionStorage.removeItem('open-pantry-add-modal');
      }
    } catch (e) {
      log.error('Failed to check open-pantry-add-modal from sessionStorage', { error: e }, 'PantryScanner');
    }
  }, []);

  useEffect(() => {
    const handleApplyFilter = () => {
      setPantryFilter(prev => {
        const next = { ...prev, expirationStatus: 'attention' as PantryFilter['expirationStatus'] };
        savePantryFilter(next);
        return next;
      });
      setTimeout(() => {
        document.getElementById('pantry-items-list')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    };

    try {
      if (sessionStorage.getItem('pantry-filter-attention') === 'true') {
        sessionStorage.removeItem('pantry-filter-attention');
        handleApplyFilter();
      }
    } catch (e) {
      log.error('Failed to apply attention filter from sessionStorage', { error: e }, 'PantryScanner');
    }

    window.addEventListener('apply-attention-filter', handleApplyFilter);
    return () => window.removeEventListener('apply-attention-filter', handleApplyFilter);
  }, [setPantryFilter]);

  useEffect(() => {
    if (bulkMode) {
      if (localStorage.getItem('tip-bulk-select') !== 'seen') {
        setShowBulkTip(true);
        const timer = setTimeout(() => {
          setShowBulkTip(false);
          localStorage.setItem('tip-bulk-select', 'seen');
        }, 6000);
        return () => clearTimeout(timer);
      }
    } else {
      setShowBulkTip(false);
    }
    return undefined;
  }, [bulkMode]);

  const gestureStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const gestureActionTriggeredRef = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const applyQuickConsume = useCallback(async (item: DisplayedPantryItem) => {
    const original = inventory[item.originalIndex];
    if (!original) return;

    const previous = {
      quantity: original.quantity,
      quantity_estimate: original.quantity_estimate,
      batches: original.batches,
      consumptionHistory: original.consumptionHistory,
    };

    const { updatedItem } = PantryService.consumeFromItem(original, 1, 'FEFO');
    const updates: Partial<PantryItem> = {
      quantity: updatedItem.quantity,
      batches: updatedItem.batches,
      quantity_estimate: String(Math.max(0, Number(original.quantity_estimate || 0) - 1)),
      consumptionHistory: [...(original.consumptionHistory || []), new Date().toISOString()],
    };

    await onUpdateItem(item.originalIndex, updates);
    appActions.addToast('Consumed 1 unit', 'success', 5000, 'Undo', async () => {
      await onUpdateItem(item.originalIndex, previous);
    });

    const newQuantity = getQuantityAmount(updatedItem.quantity ?? updatedItem.quantity_estimate);
    if (original.isStaple && newQuantity <= 0 && (settings.shopping?.autoReaddStaples !== false)) {
      addToShoppingList([original.item]);
      appActions.addToast(`${original.item} auto-added to shopping list (staple)`, 'info');
    }
  }, [inventory, onUpdateItem, appActions, addToShoppingList, settings.shopping?.autoReaddStaples]);

  const applyQuickAddToShopping = useCallback((item: DisplayedPantryItem) => {
    addToShoppingList([item.item]);
    appActions.addToast(`Added ${item.item} to shopping list`, 'info');
  }, [addToShoppingList, appActions]);

  const getRowActionHandlers = useCallback((item: DisplayedPantryItem) => {
    return {
      tabIndex: 0,
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault();
        setSelectedItemIndex(item.originalIndex);
      },
      onKeyDown: (e: React.KeyboardEvent) => {
        if (bulkMode) return;
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          void applyQuickConsume(item);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          applyQuickAddToShopping(item);
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setSelectedItemIndex(item.originalIndex);
        }
      },
      onPointerDown: (e: React.PointerEvent) => {
        if (bulkMode) return;
        gestureStartRef.current = { x: e.clientX, y: e.clientY };
        clearLongPressTimer();
        longPressTimerRef.current = window.setTimeout(() => {
          setSelectedItemIndex(item.originalIndex);
        }, 550);
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (!gestureStartRef.current) return;
        const dx = Math.abs(e.clientX - gestureStartRef.current.x);
        const dy = Math.abs(e.clientY - gestureStartRef.current.y);
        if (dx > 10 || dy > 10) {
          clearLongPressTimer();
        }
      },
      onPointerUp: async (e: React.PointerEvent) => {
        clearLongPressTimer();
        if (bulkMode || !gestureStartRef.current) return;
        const dx = e.clientX - gestureStartRef.current.x;
        const dy = e.clientY - gestureStartRef.current.y;
        gestureStartRef.current = null;
        if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy)) return;
        try {
          if (dx > 0) {
            gestureActionTriggeredRef.current = true;
            await applyQuickConsume(item);
          } else {
            gestureActionTriggeredRef.current = true;
            applyQuickAddToShopping(item);
          }
        } catch (err) {
          console.error('Failed to execute swipe gesture action:', err);
        }
      },
      onPointerLeave: () => {
        clearLongPressTimer();
      },
    };
  }, [bulkMode, applyQuickConsume, applyQuickAddToShopping]);

  useEffect(() => {
    if (savedRecipes.length > 0 && inventory.length > 0) {
      const suggestions = getMealPrepSuggestions(savedRecipes, inventory, 60);
      setMealPrepSuggestions(suggestions);
    } else {
      setMealPrepSuggestions([]);
    }
  }, [savedRecipes, inventory]);

  useEffect(() => {
    const pendingEdits = localStorage.getItem('pendingQuantityEdits');
    if (pendingEdits) {
      localStorage.removeItem('pendingQuantityEdits');
      try {
        const itemsToEdit = JSON.parse(pendingEdits);
        if (itemsToEdit.length > 0) {
          setBulkQuantityEditItems(itemsToEdit);
          setShowBulkQuantityEdit(true);
        }
      } catch (error) {
        log.error('Failed to parse pending quantity edits', { error });
      }
    }
  }, []);

  const toggleBulkMode = useCallback(() => {
    setBulkMode(!bulkMode);
    setSelectedItems(new Set());
    setBulkLocationValue('');
  }, [bulkMode]);

  const toggleItemSelection = useCallback((index: number) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const selectAllItems = useCallback(() => {
    if (selectedItems.size === inventory.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(inventory.map((_, idx) => idx)));
    }
  }, [selectedItems.size, inventory]);

  const bulkDelete = useCallback(async () => {
    if (selectedItems.size === 0) return;
    const indicesToDelete = Array.from(selectedItems);
    setBulkProgress({ current: 0, total: indicesToDelete.length });
    await appActions.deleteItems(indicesToDelete);
    setBulkProgress(null);
    setSelectedItems(new Set());
    setBulkMode(false);
  }, [selectedItems, appActions]);

  const bulkChangeLocation = useCallback(async (newLocation: 'pantry' | 'fridge' | 'freezer' | 'spices' | 'other') => {
    if (selectedItems.size === 0) return;
    const idsToUpdate = Array.from(selectedItems).map(idx => inventory[idx]?.id).filter((id): id is string => !!id);
    for (const id of idsToUpdate) {
      const currentIndex = inventory.findIndex(item => item.id === id);
      if (currentIndex === -1) continue;
      await onUpdateItem(currentIndex, { storageLocation: newLocation });
    }
    setSelectedItems(new Set());
    setBulkMode(false);
  }, [selectedItems, inventory, onUpdateItem]);

  const bulkMoveToShoppingList = useCallback(async () => {
    if (selectedItems.size === 0) return;
    const indicesToMove = Array.from(selectedItems);

    const ok = await confirm({
      title: 'Add to Shopping List?',
      description: `Do you want to add these ${indicesToMove.length} items to your shopping list for your next trip to the store? This will make a copy and keep them in your pantry.`,
      confirmLabel: 'Add Copy',
      cancelLabel: 'Cancel',
      variant: 'default',
    });
    if (!ok) return;

    const itemsToMove = PantryService.bulkMoveToShoppingList(inventory, indicesToMove);
    addToShoppingList(itemsToMove);
    setSelectedItems(new Set());
    setBulkMode(false);
    appActions.addToast(`Copied ${itemsToMove.length} item${itemsToMove.length > 1 ? 's' : ''} to shopping list`, 'success');
  }, [selectedItems, inventory, addToShoppingList, appActions, confirm]);

  // Group items by storage location
  const storageItemsArrays = useMemo(() => {
    const map: Record<string, DisplayedPantryItem[]> = {
      leftovers: [],
      pantry: [],
      fridge: [],
      freezer: [],
      spices: [],
      other: [],
    };
    sortedInventory.forEach(item => {
      if (item.is_leftover) {
        map.leftovers.push(item);
      } else {
        const loc = item.storageLocation || 'pantry';
        if (!map[loc]) map[loc] = [];
        map[loc].push(item);
      }
    });
    return map;
  }, [sortedInventory]);

  // Group items by category
  const categoryItemsArrays = useMemo(() => {
    const map: Record<string, DisplayedPantryItem[]> = {};
    sortedInventory.forEach(item => {
      const cat = item.category || 'Other';
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    });
    return map;
  }, [sortedInventory]);

  const sortedCategories = useMemo(() => {
    const cats = Object.keys(categoryItemsArrays);
    if (categoryOrder.length === 0) return cats.sort();
    return [...categoryOrder, ...cats.filter(c => !categoryOrder.includes(c))];
  }, [categoryItemsArrays, categoryOrder]);

  const storageLabels: Record<string, string> = {
    leftovers: '🍱 Leftovers',
    pantry: '📦 Pantry',
    fridge: '🧊 Fridge',
    freezer: '❄️ Freezer',
    spices: '🌿 Spices',
    other: '📦 Other',
  };

  return (
    <div className="space-y-6 pb-24 max-w-2xl mx-auto animate-fade-in relative">
      {/* Pantry health score strip */}
      {user?.isGuest && (
        <SettingsGuestBanner
          isGuest={true}
          onLogout={() => setActiveTab?.(Tab.SETTINGS)}
        />
      )}

      {inventory.length >= 3 && (
        <PantryHealthScore
          inventory={inventory}
          variant="compact"
          className="mb-2"
          onExpand={() => setShowHealthDetail(true)}
        />
      )}

      {/* Toolbar & Filter Controls */}
      <PantrySearchBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        viewMode={viewMode}
        setViewMode={setViewMode}
        sortBy={sortBy}
        setSortBy={setSortBy}
        displayLayout={displayLayout}
        toggleDisplayLayout={toggleDisplayLayout}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        pantryFilter={pantryFilter}
        onOpenSearchModal={() => setIsSearchModalOpen(true)}
      />

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-theme-secondary p-4 rounded-xl border border-theme shadow-md mt-2 space-y-4">
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-2">Categories</label>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set(inventory.map(item => item.category).filter(Boolean))).map(category => (
                <button
                  key={category}
                  onClick={() => {
                    const newFilter = { ...pantryFilter };
                    if (newFilter.categories.includes(category!)) {
                      newFilter.categories = newFilter.categories.filter(c => c !== category);
                    } else {
                      newFilter.categories.push(category!);
                    }
                    setPantryFilter(newFilter);
                    savePantryFilter(newFilter);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    pantryFilter.categories.includes(category!)
                      ? 'bg-[var(--accent-color)] text-[var(--accent-text,white)]'
                      : 'bg-theme-primary text-theme-secondary border border-theme hover:bg-theme-secondary'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-primary mb-2">Locations</label>
            <div className="flex flex-wrap gap-2">
              {['leftovers', 'pantry', 'fridge', 'freezer', 'spices', 'other'].map(location => (
                <button
                  key={location}
                  onClick={() => {
                    const newFilter = { ...pantryFilter };
                    if (newFilter.locations.includes(location)) {
                      newFilter.locations = newFilter.locations.filter(l => l !== location);
                    } else {
                      newFilter.locations.push(location);
                    }
                    setPantryFilter(newFilter);
                    savePantryFilter(newFilter);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    pantryFilter.locations.includes(location)
                      ? 'bg-[var(--accent-color)] text-[var(--accent-text,white)]'
                      : 'bg-theme-primary text-theme-secondary border border-theme hover:bg-theme-secondary'
                  }`}
                >
                  {location.charAt(0).toUpperCase() + location.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => {
                setPantryFilter(defaultPantryFilter);
                savePantryFilter(defaultPantryFilter);
              }}
              className="px-4 py-2 bg-theme-primary border border-theme rounded-lg text-theme-secondary hover:bg-theme-secondary transition-colors text-xs font-semibold"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Main List / Grid View */}
      {isLoadingInventory ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <PantryItemSkeleton key={index} />
          ))}
        </div>
      ) : inventory.length === 0 ? (
        <div className="text-center py-8 px-4 max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="w-20 h-20 bg-gradient-to-tr from-[var(--accent-color)]/20 to-[var(--accent-color)]/5 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <ChefHat className="w-10 h-10 text-[var(--accent-color)]" />
            </div>
            <h3 className="text-2xl font-extrabold text-theme-primary mb-3">Let's Stock Your Kitchen</h3>
            <p className="text-theme-secondary opacity-80 max-w-lg mx-auto text-sm leading-relaxed">
              Unlock smart recipe matching, expiration alerts, and automated shopping lists by adding your first ingredients.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <button
              onClick={() => {
                setAddModalInitialAction('photo');
                setIsAddModalOpen(true);
              }}
              className="flex flex-col items-center p-5 bg-theme-secondary rounded-2xl border border-theme hover:border-[var(--accent-color)]/50 hover:shadow-md hover:scale-[1.02] transition-all text-center group"
            >
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-3 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all">
                <Camera className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-theme-primary text-sm mb-1">Smart AI Scanner</h4>
              <p className="text-xs text-theme-secondary opacity-70 leading-relaxed">
                Snap a photo of your shelves or receipt.
              </p>
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex flex-col items-center p-5 bg-theme-secondary rounded-2xl border border-theme hover:border-[var(--accent-color)]/50 hover:shadow-md hover:scale-[1.02] transition-all text-center group"
            >
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-3 text-green-500 group-hover:bg-green-500 group-hover:text-white transition-all">
                <Plus className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-theme-primary text-sm mb-1">Quick Add Staples</h4>
              <p className="text-xs text-theme-secondary opacity-70 leading-relaxed">
                Type items or select popular staples.
              </p>
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="flex flex-col items-center p-5 bg-theme-secondary rounded-2xl border border-theme hover:border-[var(--accent-color)]/50 hover:shadow-md hover:scale-[1.02] transition-all text-center group"
            >
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-3 text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-all">
                <FilePlus className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-theme-primary text-sm mb-1">Import CSV or URL</h4>
              <p className="text-xs text-theme-secondary opacity-70 leading-relaxed">
                Upload a spreadsheet or scrape ingredients.
              </p>
            </button>
          </div>
        </div>
      ) : (
        <div id="pantry-items-list" className="space-y-6">
          {viewMode === 'storage' && (
            <div
              ref={_chipRowRef}
              className="sticky z-20 flex gap-2 overflow-x-auto py-2 mb-4 -mx-1 px-1 bg-theme-primary border-b border-theme scrollbar-hide"
              style={{ top: 'calc(var(--app-header-h, 56px) - 100px)' }}
            >
              {_storageOrder.map(location => {
                const items = storageItemsArrays[location] || [];
                const locationLabel = (storageLabels as Record<string, string>)[location] || location;
                const isActive = storageSectionOrder[0] === location;
                return (
                  <button
                    key={location}
                    onClick={() => _toggleStorageLocation(location)}
                    aria-label={`Jump to ${locationLabel}`}
                    aria-pressed={isActive}
                    className={`shrink-0 flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors ${
                      isActive
                        ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-[var(--accent-text,white)]'
                        : 'bg-theme-secondary border-theme text-theme-primary hover:border-[var(--accent-color)]/50'
                    }`}
                  >
                    <StorageLocationIndicator
                      location={location as 'pantry' | 'freezer' | 'fridge' | 'spices' | 'other'}
                      size="sm"
                    />
                    <span className="text-xs font-bold whitespace-nowrap">{locationLabel}</span>
                    <span className={`text-[10px] font-semibold ${isActive ? 'text-white/80' : 'text-theme-secondary opacity-70'}`}>
                      {items.length}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {viewMode === 'storage' ? (
            storageSectionOrder.map((loc) => {
              const items = storageItemsArrays[loc] || [];
              if (items.length === 0) return null;
              const label = storageLabels[loc] || loc;
              return (
                <div key={loc} id={`storage-section-${loc}`} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-theme pb-1.5">
                    <h3 className="font-bold text-base text-theme-primary flex items-center gap-2">
                      <StorageLocationIndicator location={loc as 'pantry' | 'freezer' | 'fridge' | 'spices' | 'other' | 'leftovers'} size="sm" />
                      <span>{label}</span>
                      <span className="text-xs font-normal text-theme-secondary opacity-70">({items.length})</span>
                    </h3>
                    <button
                      onClick={toggleBulkMode}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        bulkMode
                          ? 'bg-[var(--accent-color)] text-[var(--accent-text,white)] border-[var(--accent-color)] shadow-sm'
                          : 'bg-theme-secondary border-theme text-theme-secondary hover:text-theme-primary'
                      }`}
                      aria-label="Bulk select mode"
                      title="Bulk select mode"
                    >
                      <CheckSquare className="w-4 h-4" />
                    </button>
                  </div>

                  {displayLayout === 'list' ? (
                    <div className="space-y-2">
                      {items.map((item) => (
                        <PantryItemRow
                          key={item.id}
                          item={item}
                          bulkMode={bulkMode}
                          isSelected={selectedItems.has(item.originalIndex)}
                          onToggleSelect={toggleItemSelection}
                          onSelectItem={setSelectedItemIndex}
                          getRowActionHandlers={getRowActionHandlers}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {items.map((item) => (
                        <PantryItemTile
                          key={item.id}
                          item={item}
                          bulkMode={bulkMode}
                          isSelected={selectedItems.has(item.originalIndex)}
                          onToggleSelect={toggleItemSelection}
                          onSelectItem={setSelectedItemIndex}
                          onDeleteItem={onDeleteItem}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            sortedCategories.map((category) => {
              const items = categoryItemsArrays[category] || [];
              if (items.length === 0) return null;
              return (
                <div key={category} id={`category-section-${category}`} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-theme pb-1.5">
                    <h3 className="font-bold text-base text-theme-primary flex items-center gap-2">
                      <span>{category}</span>
                      <span className="text-xs font-normal text-theme-secondary opacity-70">({items.length})</span>
                    </h3>
                    <button
                      onClick={toggleBulkMode}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        bulkMode
                          ? 'bg-[var(--accent-color)] text-[var(--accent-text,white)] border-[var(--accent-color)] shadow-sm'
                          : 'bg-theme-secondary border-theme text-theme-secondary hover:text-theme-primary'
                      }`}
                      aria-label="Bulk select mode"
                      title="Bulk select mode"
                    >
                      <CheckSquare className="w-4 h-4" />
                    </button>
                  </div>

                  {displayLayout === 'list' ? (
                    <div className="space-y-2">
                      {items.map((item) => (
                        <PantryItemRow
                          key={item.id}
                          item={item}
                          bulkMode={bulkMode}
                          isSelected={selectedItems.has(item.originalIndex)}
                          onToggleSelect={toggleItemSelection}
                          onSelectItem={setSelectedItemIndex}
                          getRowActionHandlers={getRowActionHandlers}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {items.map((item) => (
                        <PantryItemTile
                          key={item.id}
                          item={item}
                          bulkMode={bulkMode}
                          isSelected={selectedItems.has(item.originalIndex)}
                          onToggleSelect={toggleItemSelection}
                          onSelectItem={setSelectedItemIndex}
                          onDeleteItem={onDeleteItem}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {bulkMode && (
        <PantryBulkActionBar
          selectedCount={selectedItems.size}
          totalCount={inventory.length}
          bulkLocationValue={bulkLocationValue}
          setBulkLocationValue={setBulkLocationValue}
          onSelectAll={selectAllItems}
          onBulkDelete={bulkDelete}
          onBulkMoveToShoppingList={bulkMoveToShoppingList}
          onBulkChangeLocation={bulkChangeLocation}
          onOpenBulkQuantityEdit={() => {
            const items = Array.from(selectedItems).map(idx => inventory[idx]).filter(Boolean);
            setBulkQuantityEditItems(items);
            setShowBulkQuantityEdit(true);
          }}
          onExitBulkMode={toggleBulkMode}
        />
      )}

      {/* Item Detail Modal */}
      {selectedItemIndex !== null && (
        <ItemDetailModal
          item={inventory[selectedItemIndex]}
          onClose={() => setSelectedItemIndex(null)}
          onUpdateItem={async (index, updates) => {
            await updateItem(index, updates);
          }}
          onDeleteItem={async (index) => {
            await onDeleteItem(index);
            setSelectedItemIndex(null);
          }}
          onAddToShoppingList={addToShoppingList}
          customCategories={customCategories}
          originalIndex={selectedItemIndex}
        />
      )}

      {/* Bulk Quantity Edit Modal */}
      <BulkQuantityEditModal
        isOpen={showBulkQuantityEdit}
        onClose={() => {
          setShowBulkQuantityEdit(false);
          setBulkQuantityEditItems([]);
        }}
        items={bulkQuantityEditItems}
        onSave={async (updatedItems) => {
          const updatePromises = updatedItems.map(async (item) => {
            const inventoryIndex = inventory.findIndex(i => i.id === item.id);
            if (inventoryIndex !== -1) {
              await updateItem(inventoryIndex, { quantity_estimate: item.quantity_estimate });
            }
          });
          await Promise.all(updatePromises);
          setBulkQuantityEditItems([]);
        }}
      />

      {/* Pantry Search Modal */}
      <PantrySearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        inventory={inventory}
      />

      {/* Add Items Modal */}
      <AddItemsModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setAddModalInitialAction(null);
        }}
        onAddItem={_onAddItem}
        inventory={inventory}
        user={user}
        initialAction={_addModalInitialAction}
        onOpenImport={() => {
          setIsAddModalOpen(false);
          setShowImportModal(true);
        }}
        onScanResultsReady={(results) => {
          setIsAddModalOpen(false);
          _setScanResults(results);
          _setShowScanReviewModal(true);
        }}
      />

      {/* Scan Review Modal */}
      <ScanReviewModal
        isOpen={_showScanReviewModal}
        onClose={() => {
          _setShowScanReviewModal(false);
          _setScanResults([]);
        }}
        scanResults={_scanResults || []}
        setScanResults={_setScanResults}
        receiptDestination={_receiptDestination}
        setReceiptDestination={_setReceiptDestination}
        customCategories={customCategories}
        onAddItems={_onAddItems}
        addShoppingListItem={_addShoppingListItem}
        user={user}
      />

      {/* Pantry Import Modal */}
      <PantryImportModal
        open={_showImportModal}
        onClose={() => setShowImportModal(false)}
        onImported={(items) => {
          _setLastImportedBatch(items);
        }}
      />

      {/* Floating Add Button */}
      {inventory.length > 0 && !bulkMode && (
        <button
          onClick={() => {
            HapticService.light();
            setIsAddModalOpen(true);
          }}
          className="fixed right-6 z-20 bg-[var(--accent-color)] text-[var(--accent-text,white)] p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center theme-transition"
          style={{ bottom: 'calc(5.5rem + 15px)' }}
          aria-label="Add items to pantry"
          title="Add items"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Pantry Health Detail Sheet */}
      <BottomSheet
        isOpen={showHealthDetail}
        onClose={() => setShowHealthDetail(false)}
        title="Pantry Health"
        subtitle="Full breakdown of your score"
        snap="auto"
      >
        <BottomSheet.Body className="p-4">
          <PantryHealthScore inventory={inventory} variant="full" />
        </BottomSheet.Body>
      </BottomSheet>

      {/* Freeze Transition Modal */}
      {freezeTargetIndex !== null && household && household.id && inventory[freezeTargetIndex]?.id && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] px-4 pt-[var(--safe-area-inset-top,0px)] pb-[var(--safe-area-inset-bottom,0px)]">
          <div className="bg-theme-primary rounded-lg shadow-xl w-full max-w-md mx-auto border border-theme">
            <FreezeTransitionModal
              householdId={household.id}
              inventoryId={inventory[freezeTargetIndex].id}
              itemName={inventory[freezeTargetIndex].item}
              onClose={() => setFreezeTargetIndex(null)}
              onDone={async (res?: unknown) => {
                type FreezeResult = { newExpiry?: string; updates?: { freezerZone?: string; freezerLabelPhotoUrl?: string; freezerPortionCount?: number } };
                const freezeResult = res as FreezeResult | undefined;
                const current = inventory[freezeTargetIndex];
                if (!current) {
                  setFreezeTargetIndex(null);
                  return;
                }
                const previous = {
                  storageLocation: current.storageLocation,
                  is_frozen: current.is_frozen,
                  expirationDate: current.expirationDate,
                  freezerZone: current.freezerZone,
                  freezerLabelPhotoUrl: current.freezerLabelPhotoUrl,
                  freezerPortionCount: current.freezerPortionCount,
                };

                const updates: Partial<PantryItem> = {
                  storageLocation: 'freezer',
                  is_frozen: true,
                  expirationDate: freezeResult?.newExpiry,
                  freezerZone: freezeResult?.updates?.freezerZone,
                  freezerLabelPhotoUrl: freezeResult?.updates?.freezerLabelPhotoUrl,
                  freezerPortionCount: freezeResult?.updates?.freezerPortionCount,
                };

                await onUpdateItem(freezeTargetIndex, updates);
                AnalyticsService.trackMoveToFreezer(household.id, current.id);
                appActions.addToast('Moved to freezer', 'success', 5000, 'Undo', async () => {
                  try {
                    await onUpdateItem(freezeTargetIndex, previous);
                  } catch (err) {
                    console.error('Failed to undo freeze action:', err);
                  }
                });
                setFreezeTargetIndex(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Recipe Modal */}
      {showRecipeModal && modalRecipe && (
        <RecipeModal
          recipe={modalRecipe}
          isOpen={showRecipeModal}
          onClose={() => setShowRecipeModal(false)}
          onAddToPlan={appActions.onAddToPlan}
          onSaveRecipe={onSaveRecipe}
          recipeSaveLimitExceeded={recipeSaveLimitExceeded}
          recipeSavedCount={savedRecipes.length}
          onRate={onRateRecipe}
          showSaveButton={true}
          showAddToPlan={modalContext === 'search'}
          inventory={inventory}
          household={household}
          user={user ? { id: user.id, name: user.name, email: user.email, avatar: user.avatar } : undefined}
        />
      )}

      {canShowAdBanner && <AdMobBanner />}
    </div>
  );
};

export const PantryScanner = React.memo(PantryScannerComponent);
