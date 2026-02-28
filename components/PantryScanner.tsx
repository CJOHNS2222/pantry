import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Camera, Upload, Loader2, Plus, Trash2, CheckCircle2, ShoppingBasket, X, Barcode, ChevronDown, ChevronRight, ChevronUp, Image, ChefHat, TrendingUp, Search, Filter, Settings2, Clock, Tag } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { FixedSizeList as List } from 'react-window';
import { analyzePantryImage } from '../services/geminiService';
import StorageLocationIndicator from './StorageLocationIndicator';
import { PantryItem, LoadingState, ConsumptionSuggestion, ExpirationAlert, CustomCategory, RecipeSuggestion, PantryFilter, User } from '../types';
import { Tab } from '../types/app';
import AnalyticsService from '../services/analyticsService';
import { BrowserMultiFormatReader } from '@zxing/library';
import VisualQuantitySelector from './VisualQuantitySelector';
import QuantityUnitPicker from './QuantityUnitPicker';
import PriceTrends from './PriceTrends';
import ItemDetailModal from './ItemDetailModal';
import { ProgressiveImage } from './ProgressiveImage';
import { PantryItemSkeleton } from './SkeletonLoader';
import { searchPantryItems, getEnhancedAutocompleteSuggestions, filterPantryItems, savePantryFilter, loadPantryFilter, defaultPantryFilter, saveSearchToHistory, getRecentSearchSuggestions, AutocompleteSuggestion } from '../utils/searchUtils';
import { getMealPrepSuggestions, RecipeIngredientMatch } from '../utils/searchUtils';
import { debounce } from '../utils/debounceUtils';
import { formatItemQuantity, getExpirationColor, getAllCategories, getItemImage } from '../utils/appUtils';
import { PantryService } from '../services/pantryService';
import { useApp } from '../contexts/AppContext';
import { useAppActions } from '../contexts/AppActionsContext';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import RecipeModal from './RecipeModal';
import { AdMobBanner } from './AdMobBanner';
import { canShowAds } from '../utils/appUtils';

import { InventoryCacheService } from '../services/inventoryCacheService';
import ImportModal from './ImportModal';

// Constants for virtualization threshold

interface PantryScannerProps {
  inventory: PantryItem[];
  isLoadingInventory?: boolean;
  addToShoppingList: (items: string[]) => void;
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

export const PantryScanner: React.FC<PantryScannerProps> = ({ 
  inventory,
  isLoadingInventory = false,
  addToShoppingList,
  onDeleteItem,
  onAddItem,
  onAddItems,
  onUpdateItem,
  consumptionSuggestions = [],
  expirationAlerts = [],
  recipeSuggestions = [],
  customCategories = [],
  setActiveTab,
  setInitialSearchQuery,
  user
}) => {
  // Use context hooks
  const appState = useApp();
  const appActions = useAppActions();

  // Destructure needed values
  const { household, savedRecipes } = appState;
  const { onSaveRecipe, onRateRecipe, checkRecipeSaveLimit, checkMealPlanLimit } = appActions;

  const [canShowAdBanner, setCanShowAdBanner] = React.useState<boolean>(false);

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

  // Cleanup imported timer on unmount
  useEffect(() => {
    return () => {
      if (importedTimerRef.current) {
        window.clearTimeout(importedTimerRef.current);
      }
    };
  }, []);

  // Constants for virtualization threshold
  const CATEGORY_VIRTUALIZE_THRESHOLD = 20;

  // Inventory management functions using cache service
  const updateItem = async (index: number, updates: Partial<PantryItem>) => {
    const item = inventory[index];
    if (!item) return;
    
    try {
      await onUpdateItem(index, updates);
    } catch (error) {
      console.error('Failed to update item:', error);
    }
  };

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [rawBase64, setRawBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [newItemText, setNewItemText] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [newUnit, setNewUnit] = useState('count');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [lastImportedBatch, setLastImportedBatch] = useState<import('../types').PantryItem[] | null>(null);
  const importedTimerRef = useRef<number | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'category' | 'storage'>('storage');
  const [sortBy, setSortBy] = useState<'name' | 'lastAdded' | 'expiration' | 'category' | 'location'>('location');
  const [storageOrder, setStorageOrder] = useState<string[]>(['pantry', 'fridge', 'freezer', 'spices', 'other']);
  const [storageSectionOrder, setStorageSectionOrder] = useState<string[]>(['pantry', 'fridge', 'freezer', 'spices', 'other']);
  const [showPriceTrends, setShowPriceTrends] = useState<string | null>(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [scanResults, setScanResults] = useState<PantryItem[] | null>(null);
  const [showScanReviewModal, setShowScanReviewModal] = useState(false);
  const [bulkQuantityEditItems, setBulkQuantityEditItems] = useState<PantryItem[]>([]);
  const [showBulkQuantityEdit, setShowBulkQuantityEdit] = useState(false);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [pantryFilter, setPantryFilter] = useState<PantryFilter>(loadPantryFilter());
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Meal prep suggestions state
  const [mealPrepSuggestions, setMealPrepSuggestions] = useState<RecipeIngredientMatch[]>([]);

  // Recipe modal state
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [modalRecipe, setModalRecipe] = useState<any>(null);
  const [modalContext, setModalContext] = useState<'search' | 'scheduled'>('search');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate meal prep suggestions when recipes or inventory change
  React.useEffect(() => {
    if (savedRecipes.length > 0 && inventory.length > 0) {
      const suggestions = getMealPrepSuggestions(savedRecipes, inventory, 60); // 60% match minimum
      setMealPrepSuggestions(suggestions);
    } else {
      setMealPrepSuggestions([]);
    }
  }, [savedRecipes, inventory]); // Re-calculate when recipes or inventory change

  // Check for pending quantity edits
  React.useEffect(() => {
    const pendingEdits = localStorage.getItem('pendingQuantityEdits');
    if (pendingEdits) {
      // Clear the pending edits
      localStorage.removeItem('pendingQuantityEdits');
      
      try {
        const itemsToEdit = JSON.parse(pendingEdits);
        if (itemsToEdit.length > 0) {
          setBulkQuantityEditItems(itemsToEdit);
          setShowBulkQuantityEdit(true);
        }
      } catch (error) {
        console.error('Failed to parse pending quantity edits:', error);
      }
    }
  }, []);

  // Update autocomplete suggestions when search query changes
  React.useEffect(() => {
    if (searchQuery.length >= 1) {
      const suggestions = getEnhancedAutocompleteSuggestions(inventory, searchQuery, 8);
      setAutocompleteSuggestions(suggestions);
      setShowAutocomplete(suggestions.length > 0);
    } else {
      // Load recent searches but don't show dropdown automatically
      const recent = getRecentSearchSuggestions('pantry', 5);
      setRecentSearches(recent);
      setShowAutocomplete(false); // Don't show dropdown on initial load
      setAutocompleteSuggestions([]);
    }
  }, [searchQuery, inventory]);

  // Save search to history when user performs a meaningful search
  React.useEffect(() => {
    if (searchQuery.length >= 2) {
      saveSearchToHistory(searchQuery, 'pantry');
    }
  }, [searchQuery]);

  // Debounced search for pantry items
  const debouncedPantrySearch = React.useMemo(
    () => debounce(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300), // 300ms delay for pantry search
    [searchQuery]
  );

  // Effect to trigger debounced search when query changes
  React.useEffect(() => {
    if (searchQuery.trim()) {
      debouncedPantrySearch();
    } else {
      setDebouncedSearchQuery('');
    }
  }, [searchQuery, debouncedPantrySearch]);

  // Handle recipe modal opening from meal prep suggestions
  React.useEffect(() => {
    const handleOpenRecipeModal = (event: CustomEvent) => {
      const { recipe, isSavedView } = event.detail;
      setModalRecipe(recipe);
      setModalContext('search');
      setShowRecipeModal(true);
    };

    window.addEventListener('openRecipeModal', handleOpenRecipeModal as EventListener);

    return () => {
      window.removeEventListener('openRecipeModal', handleOpenRecipeModal as EventListener);
    };
  }, []);

  // Keyboard navigation support for modals
  useKeyboardNavigation({
    onEscape: () => {
      if (showScanReviewModal) {
        setShowScanReviewModal(false);
        setScanResults(null);
      } else if (isAddModalOpen) {
        closeModal();
      } else if (selectedItemIndex !== null) {
        setSelectedItemIndex(null);
      }
    },
    enabled: showScanReviewModal || isAddModalOpen || selectedItemIndex !== null
  });

  // Process inventory with search and filters
  const processedInventory = React.useMemo(() => {
    let filtered = [...inventory];

    // Apply search (use debounced query for performance)
    if (debouncedSearchQuery.trim()) {
      filtered = searchPantryItems(filtered, debouncedSearchQuery);
    }

    // Apply filters
    filtered = filterPantryItems(filtered, pantryFilter);

    // Add original index for bulk operations
    return filtered.map((item, idx) => ({ ...item, originalIndex: inventory.indexOf(item) }));
  }, [inventory, debouncedSearchQuery, pantryFilter]);

  // Use Capacitor Camera for mobile
  const handleTakePhoto = useCallback(async () => {
    try {
      // Track feature adoption
      setLoadingState(LoadingState.LOADING);
      AnalyticsService.trackFeatureUsage('pantry_scanner', { success: true, itemsScanned: 0, itemsAdded: 0 });
      
      const photo = await CapacitorCamera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        quality: 80,
      });
      setImagePreview(photo.dataUrl || null);
      if (photo.dataUrl) {
        const base64Data = photo.dataUrl.split(',')[1];
        setRawBase64(base64Data);
        setMimeType(photo.format ? `image/${photo.format}` : 'image/jpeg');
      }
    } catch (err) {
      // User cancelled or error
    }
  }, []);

  // Select photo from gallery
  const handleSelectFromGallery = useCallback(async () => {
    try {
      const photo = await CapacitorCamera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        quality: 80,
      });
      setImagePreview(photo.dataUrl || null);
      if (photo.dataUrl) {
        const base64Data = photo.dataUrl.split(',')[1];
        setRawBase64(base64Data);
        setMimeType(photo.format ? `image/${photo.format}` : 'image/jpeg');
      }
    } catch (err) {
      // User cancelled or error
    }
  }, []);

  // Barcode scanning with camera
  const handleScanBarcode = useCallback(async () => {
    try {
      // Track feature adoption
      AnalyticsService.trackFeatureFirstUse('pantry_scanner_barcode', { method: 'barcode' });
      
      const photo = await CapacitorCamera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        quality: 90, // Higher quality for barcode detection
      });
      
      if (photo.dataUrl) {
        setLoadingState(LoadingState.LOADING);
        setImagePreview(photo.dataUrl);
        
        // Convert data URL to ImageData for barcode detection
        const img = new window.Image();
        img.onload = async () => {
          try {
            const codeReader = new BrowserMultiFormatReader();
            const result = await codeReader.decodeFromImage(img);
            
            if (result) {
              // Try to identify the product from barcode
              // For now, we'll use a simple approach - could integrate with barcode lookup APIs
              const barcode = result.getText();
              setNewItemText(`Scanned Item (${barcode})`);
              setIsAddModalOpen(true);
              
              // Track barcode scan
              AnalyticsService.trackPantryScan(1, 1);
            } else {
              alert('No barcode detected. Try taking a clearer photo or use manual entry.');
            }
          } catch (error) {
            console.error('Barcode detection error:', error);
            alert('Barcode detection failed. Try taking a clearer photo or use manual entry.');
          } finally {
            setLoadingState(LoadingState.IDLE);
          }
        };
        img.src = photo.dataUrl;
      }
    } catch (err) {
      console.error('Camera error:', err);
      setLoadingState(LoadingState.IDLE);
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingState(LoadingState.IDLE);
    setMimeType(file.type);

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setImagePreview(result);
      const base64Data = result.split(',')[1];
      setRawBase64(base64Data);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!rawBase64) return;

    setLoadingState(LoadingState.LOADING);

    try {
      const processedItems = await PantryService.analyzePantryImage(rawBase64, mimeType, user ?? undefined);

      // Instead of immediately saving, open a review modal so user can edit/confirm items
      setScanResults(processedItems);
      setShowScanReviewModal(true);
      setLoadingState(LoadingState.SUCCESS);

      // Auto-close the modal after showing success message
      setTimeout(() => {
        setImagePreview(null);
        setRawBase64(null);
        setLoadingState(LoadingState.IDLE);
      }, 3000);
    } catch (err) {
      console.error('Image analysis failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to analyze image. Please try again.');
      setLoadingState(LoadingState.ERROR);
    }
  }, [rawBase64, mimeType, user]);

  const removeItem = useCallback(async (index: number) => {
    await onDeleteItem(index);
  }, [onDeleteItem]);

  const handleManualAdd = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const newItem = PantryService.createManualItem(newItemText, newQty, inventory, newUnit);
      await onAddItem(newItem);
      setNewItemText('');
      setNewQty(1);
      setNewUnit('count');
      setIsAddModalOpen(false); // Close modal after adding
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add item. Please try again.');
    }
  }, [newItemText, newQty, newUnit, inventory, onAddItem, setIsAddModalOpen]);

  const closeModal = useCallback(() => {
    setIsAddModalOpen(false);
    setImagePreview(null);
    setRawBase64(null);
    setMimeType("");
    setLoadingState(LoadingState.IDLE);
    setNewItemText('');
    setNewQty(1);
    setNewUnit('count');
  }, []);

  const incrementQty = useCallback(() => {
    setNewQty(prev => prev + 1);
  }, [setNewQty]);

  const decrementQty = useCallback(() => {
    setNewQty(prev => Math.max(1, prev - 1));
  }, [setNewQty]);

  // Bulk operations
  const toggleBulkMode = useCallback(() => {
    setBulkMode(!bulkMode);
    setSelectedItems(new Set());
  }, [bulkMode, setBulkMode, setSelectedItems]);

  const toggleItemSelection = useCallback((index: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedItems(newSelected);
  }, [selectedItems, setSelectedItems]);

  const selectAllItems = useCallback(() => {
    if (selectedItems.size === inventory.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(inventory.map((_, idx) => idx)));
    }
  }, [selectedItems.size, inventory.length, setSelectedItems]);

  const bulkDelete = useCallback(async () => {
    if (selectedItems.size === 0) return;

    if (confirm(`Delete ${selectedItems.size} selected item(s)?`)) {
      const indicesToDelete = Array.from(selectedItems).sort((a, b) => b - a); // Delete from highest index first
      for (const index of indicesToDelete) {
        await onDeleteItem(index);
      }
      setSelectedItems(new Set());
      setBulkMode(false);
    }
  }, [selectedItems, onDeleteItem, setSelectedItems, setBulkMode]);

  const bulkMoveToShoppingList = useCallback(async () => {
    if (selectedItems.size === 0) return;

    const indicesToMove = Array.from(selectedItems).sort((a, b) => b - a); // Delete from highest index first
    const itemsToMove = PantryService.bulkMoveToShoppingList(inventory, indicesToMove);
    addToShoppingList(itemsToMove);
    for (const index of indicesToMove) {
      await onDeleteItem(index);
    }
    setSelectedItems(new Set());
    setBulkMode(false);
    alert(`Moved ${selectedItems.size} items to shopping list.`);
  }, [selectedItems, inventory, addToShoppingList, onDeleteItem, setSelectedItems, setBulkMode]);

  const toggleCategory = useCallback((category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);

    // Bring clicked category to the top
    setCategoryOrder(prev => {
      const filtered = prev.filter(c => c !== category);
      return [category, ...filtered];
    });
  }, [expandedCategories, setExpandedCategories, setCategoryOrder]);

  // Bulk actions
  const bulkChangeLocation = useCallback(async (newLocation: 'pantry' | 'fridge' | 'freezer' | 'spices' | 'other') => {
    if (selectedItems.size === 0) return;
    const indicesToUpdate = Array.from(selectedItems);
    for (const index of indicesToUpdate) {
      await onUpdateItem(index, { storageLocation: newLocation });
    }
    setSelectedItems(new Set());
    setBulkMode(false);
  }, [selectedItems, onUpdateItem, setSelectedItems, setBulkMode]);

  const bulkSetExpiration = useCallback(async (isoDate: string) => {
    if (selectedItems.size === 0) return;
    const indicesToUpdate = Array.from(selectedItems);
    for (const index of indicesToUpdate) {
      await onUpdateItem(index, { expirationDate: isoDate, expirationType: 'best-by' });
    }
    setSelectedItems(new Set());
    setBulkMode(false);
  }, [selectedItems, onUpdateItem, setSelectedItems, setBulkMode]);

  const bulkAddToShoppingListWithRemove = useCallback(async () => {
    if (selectedItems.size === 0) return;
    const indicesToMove = Array.from(selectedItems).sort((a, b) => b - a); // Delete from highest index first
    const itemsToMove = PantryService.bulkMoveToShoppingList(inventory, indicesToMove);
    addToShoppingList(itemsToMove);
    for (const index of indicesToMove) {
      await onDeleteItem(index);
    }
    setSelectedItems(new Set());
    setBulkMode(false);
    alert(`Moved ${itemsToMove.length} items to shopping list.`);
  }, [selectedItems, inventory, addToShoppingList, onDeleteItem, setSelectedItems, setBulkMode]);

  const toggleStorageLocation = useCallback((location: string) => {
    // Bring clicked storage location section to the top
    setStorageSectionOrder(prev => {
      const filtered = prev.filter(l => l !== location);
      return [location, ...filtered];
    });
  }, [setStorageSectionOrder]);

  const collapseAllCategories = useCallback(() => {
    setExpandedCategories(new Set());
  }, [setExpandedCategories]);

  // Sort inventory based on selected criteria
  const sortedInventory = processedInventory.sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.item.localeCompare(b.item);
      case 'lastAdded': {
        const aDate = a.lastRestocked || a.dateAdded || '';
        const bDate = b.lastRestocked || b.dateAdded || '';
        return new Date(bDate).getTime() - new Date(aDate).getTime(); // Most recent first
      }
      case 'expiration': {
        const aExp = a.expirationDate || '9999-12-31';
        const bExp = b.expirationDate || '9999-12-31';
        return new Date(aExp).getTime() - new Date(bExp).getTime(); // Soonest first
      }
      case 'category':
        return (a.category || '').localeCompare(b.category || '');
      case 'location': {
        const locationOrder: Record<string, number> = { pantry: 1, fridge: 2, freezer: 3, spices: 4, other: 5 };
        const aLoc = a.storageLocation || 'pantry';
        const bLoc = b.storageLocation || 'pantry';
        return locationOrder[aLoc] - locationOrder[bLoc];
      }
      default:
        return 0;
    }
  });

  // Group inventory by category
  const groupedItems = sortedInventory.reduce((acc, item) => {
    const category = item.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, (PantryItem & { originalIndex: number })[]>);

  // Group inventory by storage location
  const groupedByStorage = sortedInventory.reduce((acc, item) => {
    const location = item.storageLocation || 'pantry'; // Default to pantry if not set
    if (!acc[location]) {
      acc[location] = [];
    }
    acc[location].push(item);
    return acc;
  }, {} as Record<string, (PantryItem & { originalIndex: number })[]>);

  const storageLocations = ['pantry', 'fridge', 'freezer', 'spices', 'other'] as const;
  const storageLabels = {
    pantry: 'Pantry',
    fridge: 'Refrigerator', 
    freezer: 'Freezer',
    spices: 'Spices & Herbs',
    other: 'Other'
  };

  const updateStorageLocation = async (itemIndex: number, newLocation: 'pantry' | 'freezer' | 'fridge' | 'spices' | 'other') => {
    await onUpdateItem(itemIndex, { storageLocation: newLocation });
  };

  const updateCategory = async (itemIndex: number, newCategory: string) => {
    await onUpdateItem(itemIndex, { category: newCategory });
  };

  // Sort categories by categoryOrder, then alphabetically
  const sortedCategories = Object.keys(groupedItems).sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a);
    const bIndex = categoryOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  // Prepare view content
  const categoryViewContent = sortedCategories.map(category => {
    const items = groupedItems[category];
    return (
      <div key={category} className="bg-theme-secondary rounded-lg border border-theme overflow-hidden">
        <div
          onClick={() => toggleCategory(category)}
          className="w-full flex items-center justify-between p-4 hover:bg-theme-primary transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div
              className="p-1 rounded hover:bg-theme-primary/50 transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                toggleCategory(category);
              }}
            >
              {expandedCategories.has(category) ? (
                <ChevronDown className="w-5 h-5 text-theme-primary" />
              ) : (
                <ChevronRight className="w-5 h-5 text-theme-primary" />
              )}
            </div>
            <h4 className="font-semibold text-theme-primary">{category}</h4>
            <span className="text-sm text-theme-secondary opacity-70">
              ({items.length} item{items.length !== 1 ? 's' : ''})
            </span>
          </div>
        </div>

        {expandedCategories.has(category) && (
          <div className="border-t border-theme">
            {items.length > CATEGORY_VIRTUALIZE_THRESHOLD ? (
              <List
                height={Math.min(400, items.length * 64)}
                itemCount={items.length}
                itemSize={64}
                width={'100%'}
              >
                {(props: { index: number; style: React.CSSProperties }) => renderCategoryItem({ index: props.index, style: props.style, category })}
              </List>
            ) : (
              items.map(renderListItem)
            )}
          </div>
        )}
      </div>
    );
  });

  const storageViewContent = storageSectionOrder.map(location => {
    const items = groupedByStorage[location] || [];
    const locationLabel = (storageLabels as any)[location] || location;

    return (
      <div key={location} className="bg-theme-secondary rounded-lg border border-theme overflow-hidden">
        <div className="w-full flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <StorageLocationIndicator
              location={location as 'pantry' | 'freezer' | 'fridge' | 'spices' | 'other'}
              size="md"
            />
            <h4 className="font-semibold text-theme-primary">{locationLabel}</h4>
            <span className="text-sm text-theme-secondary opacity-70">
              ({items.length} item{items.length !== 1 ? 's' : ''})
            </span>
          </div>
        </div>

        <div className="border-t border-theme">
          {items.length === 0 ? (
            <div className="p-4 text-center text-theme-secondary opacity-50 text-sm">
              No items in {locationLabel.toLowerCase()}
            </div>
          ) : items.length > CATEGORY_VIRTUALIZE_THRESHOLD ? (
            <List
              height={Math.min(400, items.length * 64)}
              itemCount={items.length}
              itemSize={64}
              width={'100%'}
            >
              {(props: { index: number; style: React.CSSProperties }) => renderStorageItem({ index: props.index, style: props.style, location })}
            </List>
          ) : (
            items.map(renderListItem)
          )}
        </div>
      </div>
    );
  });

  // Virtualized flat list renderer for large inventories
  const VIRTUALIZE_THRESHOLD = 50;

  // Virtualized category item renderer
  const renderCategoryItem = ({ index, style, category }: { index: number; style: React.CSSProperties; category: string }) => {
    const items = groupedItems[category];
    const item = items[index];
    if (!item) return null;
    return (
      <div style={style} key={item.originalIndex} className={`flex items-center justify-between px-2 py-1 border-b border-theme last:border-b-0 transition-all cursor-pointer ${
        bulkMode && selectedItems.has(item.originalIndex)
          ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)]/30'
          : 'hover:bg-theme-primary/50'
      }`}
      onClick={() => !bulkMode && setSelectedItemIndex(item.originalIndex)}
      >
        {bulkMode && (
          <input
            type="checkbox"
            checked={selectedItems.has(item.originalIndex)}
            onChange={() => toggleItemSelection(item.originalIndex)}
            className="mr-3 w-4 h-4 text-[var(--accent-color)] bg-theme-primary border-theme rounded focus:ring-[var(--accent-color)]"
          />
        )}

        <div className="flex items-center gap-1 flex-1">
          <ProgressiveImage
            src={item.image || '/images/placeholder.svg'}
            alt={item.item}
            className="w-10 h-10 rounded-lg object-cover bg-theme-primary border border-theme"
            placeholderSrc="/images/placeholder.svg"
            lazy={true}
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="font-medium text-theme-primary">{item.item}</div>
              <div className="text-xs text-theme-secondary opacity-70 bg-theme-secondary px-1 py-0.5 rounded">Qty: {formatItemQuantity(item)}</div>
              {item.expirationDate && (() => {
                const daysRemaining = Math.ceil((new Date(item.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const color = getExpirationColor(daysRemaining, item.expirationType);
                return (
                  <div className={`text-xs px-1 py-0.5 rounded font-medium ${
                    color === 'red' ? 'bg-red-100 text-red-800' :
                    color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {daysRemaining}d
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {!bulkMode && (
          <div className="text-theme-secondary opacity-50">
            <ChevronRight className="w-5 h-5" />
          </div>
        )}
      </div>
    );
  };
                  
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex-1 py-2 px-3 rounded-lg border border-theme text-theme-secondary hover:bg-theme-primary transition-colors flex items-center justify-center gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2"
                    aria-label="Import items or recipes"
                  >
                    Import
                  </button>

  // Virtualized storage item renderer
  const renderStorageItem = ({ index, style, location }: { index: number; style: React.CSSProperties; location: string }) => {
    const items = groupedByStorage[location] || [];
    const item = items[index];
    if (!item) return null;
    return (
      <div style={style} key={item.originalIndex} className={`flex items-center justify-between px-2 py-1 border-b border-theme last:border-b-0 transition-all cursor-pointer ${
        bulkMode && selectedItems.has(item.originalIndex)
          ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)]/30'
          : 'hover:bg-theme-primary/50'
      }`}
      onClick={() => !bulkMode && setSelectedItemIndex(item.originalIndex)}
      >
        {bulkMode && (
          <input
            type="checkbox"
            checked={selectedItems.has(item.originalIndex)}
            onChange={() => toggleItemSelection(item.originalIndex)}
            className="mr-3 w-4 h-4 text-[var(--accent-color)] bg-theme-primary border-theme rounded focus:ring-[var(--accent-color)]"
          />
        )}

        <div className="flex items-center gap-1 flex-1">
          <ProgressiveImage
            src={item.image || '/images/placeholder.svg'}
            alt={item.item}
            className="w-10 h-10 rounded-lg object-cover bg-theme-primary border border-theme"
            placeholderSrc="/images/placeholder.svg"
            lazy={true}
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="font-medium text-theme-primary">{item.item}</div>
              <div className="text-xs text-theme-secondary opacity-70 bg-theme-secondary px-1 py-0.5 rounded">Qty: {formatItemQuantity(item)}</div>
              {item.expirationDate && (() => {
                const daysRemaining = Math.ceil((new Date(item.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const color = getExpirationColor(daysRemaining, item.expirationType);
                return (
                  <div className={`text-xs px-1 py-0.5 rounded font-medium ${
                    color === 'red' ? 'bg-red-100 text-red-800' :
                    color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {daysRemaining}d
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {!bulkMode && (
          <div className="text-theme-secondary opacity-50">
            <ChevronRight className="w-5 h-5" />
          </div>
        )}
      </div>
    );
  };

  // Simple list item renderer used for non-virtualized lists
  function renderListItem(item: any) {
    const daysRemaining = item.expirationDate ? Math.ceil((new Date(item.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : undefined;
    return (
      <div
        key={item.originalIndex}
        className={`flex items-center justify-between px-2 py-1 border-b border-theme last:border-b-0 transition-all cursor-pointer ${
          bulkMode && selectedItems.has(item.originalIndex)
            ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)]/30'
            : 'hover:bg-theme-primary/50'
        }`}
        onClick={() => !bulkMode && setSelectedItemIndex(item.originalIndex)}
      >
        {bulkMode && (
          <input
            type="checkbox"
            checked={selectedItems.has(item.originalIndex)}
            onChange={() => toggleItemSelection(item.originalIndex)}
            className="mr-3 w-4 h-4 text-[var(--accent-color)] bg-theme-primary border-theme rounded focus:ring-[var(--accent-color)]"
          />
        )}

        <div className="flex items-center gap-1 flex-1">
          <img
            src={item.image || '/images/placeholder.svg'}
            alt={item.item}
            className="w-10 h-10 rounded-lg object-cover bg-theme-primary border border-theme"
            onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder.svg'; }}
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="font-medium text-theme-primary">{item.item}</div>
              <div className="text-xs text-theme-secondary opacity-70 bg-theme-secondary px-1 py-0.5 rounded">Qty: {formatItemQuantity(item)}</div>
              {typeof daysRemaining === 'number' && (
                <div className={`text-xs px-1 py-0.5 rounded font-medium ${
                  getExpirationColor(daysRemaining, item.expirationType) === 'red' ? 'bg-red-100 text-red-800' :
                  getExpirationColor(daysRemaining, item.expirationType) === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {daysRemaining}d
                </div>
              )}
              {item.expiryAlertShown && (
                <Clock className="w-4 h-4 text-orange-500" aria-label="Expires within 7 days" />
              )}
            </div>
          </div>
        </div>

        {!bulkMode && (
          <div className="text-theme-secondary opacity-50">
            <ChevronRight className="w-5 h-5" />
          </div>
        )}
      </div>
    );
  }

  const renderRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = sortedInventory[index];
    if (!item) return null;
    return (
      <div style={style} key={item.originalIndex} className={`flex items-center justify-between px-2 py-1 border-b border-theme last:border-b-0 transition-all cursor-pointer ${
        bulkMode && selectedItems.has(item.originalIndex)
          ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)]/30'
          : 'hover:bg-theme-primary/50'
      }`} onClick={() => !bulkMode && setSelectedItemIndex(item.originalIndex)}>
        {bulkMode && (
          <input
            type="checkbox"
            checked={selectedItems.has(item.originalIndex)}
            onChange={() => toggleItemSelection(item.originalIndex)}
            className="mr-3 w-4 h-4 text-[var(--accent-color)] bg-theme-primary border-theme rounded focus:ring-[var(--accent-color)]"
          />
        )}

        <div className="flex items-center gap-1 flex-1">
          <img src={item.image || '/images/placeholder.svg'} alt={item.item} className="w-10 h-10 rounded-lg object-cover bg-theme-primary border border-theme" onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder.svg'; }} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="font-medium text-theme-primary">{item.item}</div>
              <div className="text-xs text-theme-secondary opacity-70 bg-theme-secondary px-1 py-0.5 rounded">Qty: {formatItemQuantity(item)}</div>
              {item.expirationDate && (() => {
                const daysRemaining = Math.ceil((new Date(item.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const color = getExpirationColor(daysRemaining, item.expirationType);
                return (
                  <div className={`text-xs px-1 py-0.5 rounded font-medium ${
                    color === 'red' ? 'bg-red-100 text-red-800' :
                    color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {daysRemaining}d
                  </div>
                );
              })()}
              {item.expiryAlertShown && (
                <Clock className="w-4 h-4 text-orange-500" aria-label="Expires within 7 days" />
              )}
            </div>
          </div>
        </div>

        {!bulkMode && (
          <div className="text-theme-secondary opacity-50">
            <ChevronRight className="w-5 h-5" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-24 max-w-2xl mx-auto animate-fade-in relative">
      <div className="flex items-center justify-between mb-6">
        <div className="text-center flex-1">
          <h2 className="text-3xl font-serif font-bold text-theme-secondary">My Pantry</h2>
          <p className="text-theme-secondary opacity-60 text-sm mt-1">Items currently in stock</p>
        </div>
        {/* Sort Dropdown */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => {
              const value = e.target.value as typeof sortBy;
              setSortBy(value);
              // Also change view mode for category/location sorts
              if (value === 'category') {
                setViewMode('category');
              } else if (value === 'location') {
                setViewMode('storage');
              }
            }}
            className="appearance-none bg-theme-secondary border-2 border-[var(--accent-color)] rounded-lg px-3 py-2 pr-8 text-sm font-medium text-theme-primary shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50"
          >
            <option value="name">Sort by Name</option>
            <option value="lastAdded">Sort by Last Added</option>
            <option value="expiration">Sort by Expiration</option>
            <option value="category">Sort by Category</option>
            <option value="location">Sort by Location</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-theme-primary pointer-events-none" />
          <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-theme-primary pointer-events-none" />
        </div>
      </div>

      {lastImportedBatch && (
        <div className="w-full bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 flex items-center justify-between">
          <div className="text-sm text-yellow-900">Imported {lastImportedBatch.length} items</div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                try {
                  // Remove imported items from the cache
                  for (const it of lastImportedBatch) {
                    try {
                      await InventoryCacheService.removeItemFromCache(it.id, household?.id, user?.id);
                    } catch (err) {
                      console.error('Failed to remove imported item from cache', err);
                    }
                  }
                } finally {
                  setLastImportedBatch(null);
                  if (importedTimerRef.current) {
                    window.clearTimeout(importedTimerRef.current);
                    importedTimerRef.current = null;
                  }
                }
              }}
              className="px-3 py-1 bg-theme-primary text-white rounded"
            >
              Undo
            </button>
            <button
              onClick={() => {
                setLastImportedBatch(null);
                if (importedTimerRef.current) {
                  window.clearTimeout(importedTimerRef.current);
                  importedTimerRef.current = null;
                }
              }}
              className="px-3 py-1 bg-theme-secondary rounded border border-theme"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Meal Prep Suggestions - Recipes You Can Make Immediately */}
      {mealPrepSuggestions.length > 0 && (
        <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <ChefHat className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-theme-primary">Recipes You Can Make Now</h3>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
              {mealPrepSuggestions.filter(s => s.canMake).length} ready
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mealPrepSuggestions.slice(0, 4).map((suggestion, index) => (
              <div
                key={index}
                className="bg-theme-secondary/80 backdrop-blur-sm border border-green-500/30 rounded-lg p-3 cursor-pointer hover:bg-theme-secondary transition-all hover:shadow-md"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-semibold text-theme-primary truncate flex-1">
                    {suggestion.recipe.title}
                  </h4>
                  {suggestion.canMake && (
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full ml-2 flex-shrink-0">
                      Ready!
                    </span>
                  )}
                </div>

                <div className="text-xs text-theme-secondary mb-2">
                  {suggestion.availableIngredients}/{suggestion.totalIngredients} ingredients available
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setModalRecipe(suggestion.recipe);
                      setModalContext('search');
                      setShowRecipeModal(true);
                      AnalyticsService.trackEvent('meal_prep_view_recipe', {
                        recipe_title: suggestion.recipe.title,
                        match_percentage: suggestion.matchPercentage,
                        available_ingredients: suggestion.availableIngredients,
                        total_ingredients: suggestion.totalIngredients,
                        can_make: suggestion.canMake
                      });
                    }}
                    className="flex-1 text-xs bg-[var(--accent-color)] text-white px-2 py-1 rounded hover:bg-[var(--accent-color)]/90 transition-colors"
                  >
                    View Recipe
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (setActiveTab) setActiveTab(Tab.MEALS);
                      // Could add logic to open the specific recipe in meal planner
                    }}
                    className="flex-1 text-xs bg-theme-secondary border border-theme px-2 py-1 rounded hover:bg-theme-primary transition-colors"
                  >
                    Plan Meal
                  </button>
                  {suggestion.missingIngredients.length > 0 && (
                    <button
                      onClick={(e) => {
                        const missingItems = suggestion.missingIngredients
                          .filter(match => !match.available)
                          .map(match => match.ingredient);
                        if (missingItems.length > 0) {
                          addToShoppingList(missingItems);
                        }
                      }}
                      className="text-xs bg-theme-secondary border border-theme px-2 py-1 rounded hover:bg-theme-primary transition-colors"
                      title={`Add ${suggestion.missingIngredients.length} missing ingredients to shopping list`}
                    >
                      +{suggestion.missingIngredients.length}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {mealPrepSuggestions.length > 4 && (
            <div className="text-center mt-3">
              <button
                onClick={() => {
                  if (setActiveTab) setActiveTab(Tab.MEALS);
                }}
                className="text-sm text-[var(--accent-color)] hover:underline"
              >
                View all {mealPrepSuggestions.length} suggestions →
              </button>
            </div>
          )}
        </div>
      )}

      {showImportModal && (
        <ImportModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          defaultTab="pantry"
          onImported={async (items) => {
            try {
              // Add to current session via provided prop
              await onAddItems(items);
            } catch (err) {
              console.error('Failed to add imported items to session', err);
            }
          }}
        />
      )}

      {/* Search and Filter Bar */}
      <div className="bg-theme-secondary p-4 rounded-2xl border border-theme shadow-lg mb-6">
        <div className="flex gap-3 items-center">
          {/* Search Input */}
          <div className="flex-1 relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-theme-secondary opacity-50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  // Show recent searches if available, or autocomplete suggestions if there's a query
                  if (searchQuery.length >= 1 && autocompleteSuggestions.length > 0) {
                    setShowAutocomplete(true);
                  } else if (searchQuery.length === 0 && recentSearches.length > 0) {
                    setShowAutocomplete(true);
                  }
                }}
                onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
                placeholder="Search pantry items..."
                className="w-full pl-10 pr-4 py-2 bg-theme-primary border border-theme rounded-lg text-theme-primary placeholder-theme-primary/50 focus:border-[var(--accent-color)] focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-theme-secondary opacity-50 hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* Autocomplete Suggestions */}
            {showAutocomplete && (
              <div className="absolute top-full left-0 right-0 bg-theme-primary border border-theme rounded-lg shadow-lg mt-1 z-10 max-h-60 overflow-y-auto">
                {/* Recent Searches */}
                {searchQuery.length === 0 && recentSearches.length > 0 && (
                  <>
                    <div className="px-4 py-2 text-xs font-semibold text-theme-secondary opacity-70 uppercase tracking-wider border-b border-theme">
                      Recent Searches
                    </div>
                    {recentSearches.map((recentQuery, index) => (
                      <button
                        key={`recent-${index}`}
                        onClick={() => {
                          setSearchQuery(recentQuery);
                          setShowAutocomplete(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-theme-secondary text-theme-primary flex items-center gap-2"
                      >
                        <Clock className="w-3 h-3 text-theme-secondary opacity-50" />
                        <span>{recentQuery}</span>
                      </button>
                    ))}
                    {autocompleteSuggestions.length > 0 && (
                      <div className="px-4 py-2 text-xs font-semibold text-theme-secondary opacity-70 uppercase tracking-wider border-b border-theme">
                        Suggestions
                      </div>
                    )}
                  </>
                )}

                {/* Enhanced Suggestions */}
                {autocompleteSuggestions.map((suggestion, index) => (
                  <button
                    key={`suggestion-${index}`}
                    onClick={() => {
                      setSearchQuery(suggestion.text);
                      saveSearchToHistory(suggestion.text, 'pantry');
                      setShowAutocomplete(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-theme-secondary text-theme-primary flex items-center gap-2"
                  >
                    {/* Type indicator */}
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      {suggestion.type === 'recent' && (
                        <Clock className="w-3 h-3 text-blue-500 flex-shrink-0" />
                      )}
                      {suggestion.type === 'popular' && (
                        <TrendingUp className="w-3 h-3 text-green-500 flex-shrink-0" />
                      )}
                      {suggestion.type === 'category' && (
                        <Tag className="w-3 h-3 text-purple-500 flex-shrink-0" />
                      )}
                      {suggestion.type === 'match' && (
                        <Search className="w-3 h-3 text-theme-secondary opacity-50 flex-shrink-0" />
                      )}

                      <span className="truncate">{suggestion.text}</span>
                    </div>

                    {/* Additional info */}
                    <div className="flex items-center gap-1 text-xs text-theme-secondary opacity-60">
                      {suggestion.category && suggestion.type !== 'category' && (
                        <span className="bg-theme-secondary px-1.5 py-0.5 rounded text-[10px]">
                          {suggestion.category}
                        </span>
                      )}
                      {suggestion.count && suggestion.count > 1 && (
                        <span className="text-[10px]">
                          ×{suggestion.count}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg border transition-colors ${
              showFilters || Object.values(pantryFilter).some(v => 
                Array.isArray(v) ? v.length > 0 : v !== defaultPantryFilter[v as keyof PantryFilter]
              )
                ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)]'
                : 'bg-theme-primary border-theme text-theme-secondary hover:bg-theme-secondary'
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-theme space-y-4">
            {/* Categories Filter */}
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
                        ? 'bg-[var(--accent-color)] text-white'
                        : 'bg-theme-primary text-theme-secondary border border-theme hover:bg-theme-secondary'
                    }`}
                    aria-label={`${pantryFilter.categories.includes(category!) ? 'Remove' : 'Add'} ${category} filter`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {/* Locations Filter */}
            <div>
              <label className="block text-sm font-medium text-theme-primary mb-2">Locations</label>
              <div className="flex flex-wrap gap-2">
                {['pantry', 'fridge', 'freezer', 'spices', 'other'].map(location => (
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
                        ? 'bg-[var(--accent-color)] text-white'
                        : 'bg-theme-primary text-theme-secondary border border-theme hover:bg-theme-secondary'
                    }`}
                    aria-label={`${pantryFilter.locations.includes(location) ? 'Remove' : 'Add'} ${location.charAt(0).toUpperCase() + location.slice(1)} location filter`}
                  >
                    {location.charAt(0).toUpperCase() + location.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Expiration Status Filter */}
            <div>
              <label className="block text-sm font-medium text-theme-primary mb-2">Expiration Status</label>
              <select
                value={pantryFilter.expirationStatus}
                onChange={(e) => {
                  const newFilter = { ...pantryFilter, expirationStatus: e.target.value as PantryFilter['expirationStatus'] };
                  setPantryFilter(newFilter);
                  savePantryFilter(newFilter);
                }}
                className="w-full px-3 py-2 bg-theme-primary border border-theme rounded-lg text-theme-primary focus:border-[var(--accent-color)] focus:outline-none"
              >
                <option value="all">All Items</option>
                <option value="expiring-soon">Expiring Soon (7 days)</option>
                <option value="expired">Expired</option>
                <option value="fresh">Fresh</option>
              </select>
            </div>

            {/* Quantity Status Filter */}
            <div>
              <label className="block text-sm font-medium text-theme-primary mb-2">Stock Status</label>
              <select
                value={pantryFilter.quantityStatus}
                onChange={(e) => {
                  const newFilter = { ...pantryFilter, quantityStatus: e.target.value as PantryFilter['quantityStatus'] };
                  setPantryFilter(newFilter);
                  savePantryFilter(newFilter);
                }}
                className="w-full px-3 py-2 bg-theme-primary border border-theme rounded-lg text-theme-primary focus:border-[var(--accent-color)] focus:outline-none"
              >
                <option value="all">All Items</option>
                <option value="low-stock">Low Stock (&lt;1)</option>
                <option value="out-of-stock">Out of Stock</option>
                <option value="in-stock">In Stock (≥1)</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setPantryFilter(defaultPantryFilter);
                  savePantryFilter(defaultPantryFilter);
                }}
                className="px-4 py-2 bg-theme-primary border border-theme rounded-lg text-theme-secondary hover:bg-theme-secondary transition-colors"
                aria-label="Clear all applied filters"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Action Toolbar */}
      {bulkMode && (
        <div className="bg-theme-secondary p-3 rounded-lg border border-theme mb-4 flex items-center gap-3">
          <div className="text-sm text-theme-primary font-medium">Bulk Mode: {selectedItems.size} selected</div>
          <select onChange={(e) => bulkChangeLocation(e.target.value as any)} className="px-2 py-1 rounded bg-theme-primary border border-theme text-black">
            <option value="pantry">Move to Pantry</option>
            <option value="fridge">Move to Fridge</option>
            <option value="freezer">Move to Freezer</option>
            <option value="spices">Move to Spices</option>
            <option value="other">Move to Other</option>
          </select>
          <input type="date" onChange={(e) => bulkSetExpiration(e.target.value)} className="px-2 py-1 rounded bg-theme-primary border border-theme text-black" />
          <button onClick={bulkAddToShoppingListWithRemove} className="px-3 py-1 bg-[var(--accent-color)] text-white rounded" aria-label="Move selected items to shopping list">Move to Shopping</button>
          <button onClick={selectAllItems} className="px-3 py-1 bg-theme-primary border border-theme rounded" aria-label="Toggle select all items">Toggle Select All</button>
          <button onClick={bulkDelete} className="ml-auto px-3 py-1 bg-red-600 text-white rounded" aria-label="Delete selected items">Delete</button>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => setIsAddModalOpen(true)}
        className="fixed bottom-28 right-6 z-50 bg-[var(--accent-color)] text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2"
        style={{ bottom: 'calc(7rem + 15px)' }}
        aria-label="Add items to pantry"
        data-tutorial="add-item-button"
      >
        <Plus className="w-6 h-6" aria-hidden="true" />
      </button>

      {/* Add Items Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
          <div className="bg-theme-primary rounded-t-3xl max-w-md w-full max-h-[80vh] overflow-y-auto shadow-xl animate-slide-up">
            <div className="p-6 pb-[75px]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-theme-secondary">Add Items</h3>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-theme-secondary rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-theme-secondary" />
                </button>
              </div>

              {/* Camera/File Upload Section */}
              <div className="bg-theme-secondary p-4 rounded-2xl border border-theme shadow-lg mb-6">
                <div 
                  className="relative group cursor-pointer transition-all duration-300"
                  onClick={async () => {
                    // Use Capacitor Camera if available, else fallback to file input
                    if ((window as any).Capacitor) {
                      await handleTakePhoto();
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  {imagePreview ? (
                    <div className="relative rounded-xl overflow-hidden aspect-[4/3] ring-2 ring-[var(--accent-color)]">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover opacity-80" />
                      {loadingState === LoadingState.LOADING && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 flex flex-col items-center gap-2">
                            <Loader2 className="animate-spin w-6 h-6 text-[var(--accent-color)]" />
                            <p className="text-sm font-medium text-theme-secondary">AI is analyzing your image...</p>
                            <p className="text-xs text-theme-secondary/70">This may take a few seconds</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-theme rounded-xl bg-theme-primary hover:bg-[var(--accent-color)]/5 transition-all aspect-[4/3] flex flex-col items-center justify-center gap-3">
                      <div className="p-3 bg-theme-secondary rounded-full shadow-lg group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 text-[var(--accent-color)]" />
                      </div>
                      <div className="text-center">
                        <p className="text-theme-secondary opacity-70 text-sm font-medium">Scan receipt or pantry</p>
                        <p className="text-theme-secondary opacity-50 text-xs mt-1">Tap to take photo, choose from gallery, or upload image</p>
                      </div>
                    </div>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={async () => {
                      if ((window as any).Capacitor) {
                        await handleTakePhoto();
                      } else {
                        fileInputRef.current?.click();
                      }
                    }}
                    className="flex-1 py-2 px-3 rounded-lg border border-theme text-theme-secondary hover:bg-theme-primary transition-colors flex items-center justify-center gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2"
                    aria-label="Take photo with camera to scan pantry items"
                  >
                    <Camera className="w-4 h-4" aria-hidden="true" />
                    Photo
                  </button>
                  
                  <button
                    onClick={async () => {
                      if ((window as any).Capacitor) {
                        await handleSelectFromGallery();
                      } else {
                        fileInputRef.current?.click();
                      }
                    }}
                    className="flex-1 py-2 px-3 rounded-lg border border-theme text-theme-secondary hover:bg-theme-primary transition-colors flex items-center justify-center gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2"
                    aria-label="Select photo from gallery to scan pantry items"
                  >
                    <Image className="w-4 h-4" aria-hidden="true" />
                    Gallery
                  </button>
                  
                  <button
                    onClick={handleScanBarcode}
                    disabled={loadingState === LoadingState.LOADING}
                    className="flex-1 py-2 px-3 rounded-lg border border-theme text-theme-secondary hover:bg-theme-primary transition-colors flex items-center justify-center gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Scan barcode to identify product"
                    aria-disabled={loadingState === LoadingState.LOADING}
                  >
                    <Barcode className="w-4 h-4" aria-hidden="true" />
                    Barcode
                  </button>
                </div>

                {imagePreview && loadingState !== LoadingState.SUCCESS && (
                  <button
                    onClick={handleAnalyze}
                    disabled={loadingState === LoadingState.LOADING}
                    className="w-full mt-4 py-3 rounded-lg font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 bg-[var(--accent-color)] text-white shadow-lg hover:bg-[var(--accent-color)]/90 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Process image with AI to identify pantry items"
                    aria-disabled={loadingState === LoadingState.LOADING}
                  >
                    {loadingState === LoadingState.LOADING ? (
                      <>
                        <Loader2 className="animate-spin w-4 h-4" aria-hidden="true" />
                        <span>Analyzing Image...</span>
                      </>
                    ) : (
                      <>
                        <Image className="w-4 h-4" aria-hidden="true" />
                        <span>Process Image</span>
                      </>
                    )}
                  </button>
                )}

                {/* Success State */}
                {loadingState === LoadingState.SUCCESS && (
                  <div className="w-full mt-4 py-4 rounded-lg bg-green-50 border border-green-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                      <div>
                        <p className="text-green-800 font-semibold">Items Added Successfully!</p>
                        <p className="text-green-600 text-sm">Closing automatically...</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setImagePreview(null);
                        setRawBase64(null);
                        setLoadingState(LoadingState.IDLE);
                      }}
                      className="text-green-600 hover:text-green-800 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Error State */}
                {loadingState === LoadingState.ERROR && (
                  <div className="w-full mt-4 py-3 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center gap-2">
                    <X className="w-5 h-5 text-red-600" />
                    <span className="text-red-800 text-sm">Failed to analyze image. Please try again.</span>
                  </div>
                )}
              </div>

              {/* Manual Add Section */}
              <div className="bg-theme-secondary p-4 rounded-2xl border border-theme shadow-lg">
                <h4 className="text-lg font-semibold text-theme-secondary mb-4">Quick Add</h4>
                <form onSubmit={handleManualAdd} className="space-y-4" role="form" aria-label="Add item manually">
                  <div className="space-y-3">
                    <input 
                      type="text"
                      value={newItemText}
                      onChange={(e) => setNewItemText(e.target.value)}
                      placeholder="Enter item name..."
                      className="w-full bg-theme-primary border border-theme rounded-lg px-4 py-3 text-theme-secondary shadow-sm outline-none focus:border-[var(--accent-color)] focus:ring-2 focus:ring-[var(--accent-color)]/20"
                      aria-label="Item name"
                      aria-required="true"
                      minLength={2}
                      maxLength={50}
                    />
                    <QuantityUnitPicker
                      quantity={newQty}
                      unit={newUnit}
                      onQuantityChange={setNewQty}
                      onUnitChange={setNewUnit}
                      itemName={newItemText}
                      showControls={true}
                      maxQuantity={999}
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 bg-[var(--accent-color)] text-white shadow-lg hover:bg-[var(--accent-color)]/90 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2"
                    aria-label="Add item to pantry"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Add Item
                  </button>
                </form>
              </div>
            </div>

            {/* Scan Review Modal (appears after analyze) */}
            {showScanReviewModal && scanResults && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-2 pt-24 pb-24">
                <div className="bg-theme-primary rounded-lg max-w-sm sm:max-w-2xl w-full max-h-[calc(100vh-160px)] overflow-y-auto border border-theme p-3 sm:p-4 pb-24">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm sm:text-lg font-bold text-theme-secondary">Review Scanned Items ({scanResults.length})</h3>
                    <button onClick={() => { setShowScanReviewModal(false); setScanResults(null); }} className="p-2 rounded hover:bg-theme-secondary">
                      <X className="w-5 h-5 text-theme-secondary" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {scanResults.map((sItem, idx) => (
                      <div key={sItem.id} className="bg-theme-secondary p-3 rounded-lg border border-theme">
                        <div className="flex items-start gap-3">
                            <img src={sItem.image || '/images/placeholder.svg'} alt={sItem.item} className="w-12 h-12 rounded object-cover flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder.svg'; }} />
                          <div className="flex-1 min-w-0">
                            <input value={sItem.item} onChange={(e) => {
                              const updated = [...scanResults];
                              updated[idx] = { ...updated[idx], item: e.target.value };
                              setScanResults(updated);
                            }} className="w-full px-2 py-1 rounded bg-theme-primary border border-theme text-theme-primary text-sm" />
                            <div className="flex flex-wrap gap-2 mt-2">
                              <input type="number" value={parseInt(sItem.quantity_estimate || '1')} onChange={(e) => {
                                const updated = [...scanResults];
                                updated[idx] = { ...updated[idx], quantity_estimate: e.target.value };
                                setScanResults(updated);
                              }} className="w-20 px-2 py-1 text-sm rounded bg-theme-primary border border-theme text-theme-primary" placeholder="Qty" />
                              <select value={sItem.category || 'Uncategorized'} onChange={(e) => {
                                const updated = [...scanResults];
                                updated[idx] = { ...updated[idx], category: e.target.value };
                                setScanResults(updated);
                              }} className="px-2 py-1 text-sm rounded bg-theme-primary border border-theme text-theme-primary">
                                {getAllCategories(customCategories).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                              </select>
                              {('confidence' in sItem) && (
                                <div className="text-sm text-theme-secondary opacity-80">Conf: {(sItem as any).confidence}</div>
                              )}
                            </div>
                          </div>
                        </div>
                          <div className="flex justify-end mt-2">
                          <button onClick={() => {
                            const updated = scanResults.filter((_, i) => i !== idx);
                            setScanResults(updated.length ? updated : null);
                            if (updated.length === 0) setShowScanReviewModal(false);
                          }} className="px-3 py-1 text-sm rounded bg-red-600 text-white hover:bg-red-700" aria-label={`Remove ${sItem.item} from scan results`}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button onClick={async () => {
                      // Confirm: add scanResults to inventory
                      if (scanResults) {
                        await onAddItems(scanResults);
                      }
                      setShowScanReviewModal(false);
                      setScanResults(null);
                      setImagePreview(null);
                      setRawBase64(null);
                      setLoadingState(LoadingState.IDLE);
                    }} className="px-4 py-2 bg-[var(--accent-color)] text-white rounded" aria-label="Add all scanned items to pantry">Add All</button>
                    <button onClick={() => { setShowScanReviewModal(false); setScanResults(null); }} className="px-4 py-2 bg-theme-primary border border-theme rounded" aria-label="Cancel and discard scan results">Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Consumption Suggestions */}
      {consumptionSuggestions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <ShoppingBasket className="w-4 h-4" />
            Smart Shopping Suggestions
          </h3>
          <div className="space-y-2">
            {consumptionSuggestions.slice(0, 3).map((suggestion, index) => (
              <div key={index} className="flex items-center justify-between bg-white rounded p-3 border border-blue-100">
                <div className="flex-1">
                  <p className="text-sm text-blue-800 font-medium">{suggestion.item}</p>
                  <p className="text-xs text-blue-600">{suggestion.reason}</p>
                </div>
                <button
                  onClick={() => addToShoppingList([suggestion.item])}
                  className="ml-3 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                  aria-label={`Add ${suggestion.item} to shopping list`}
                >
                  Add to List
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expiration Alerts */}
      {expirationAlerts.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-orange-800 mb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Expiration Alerts
          </h3>
          <div className="space-y-2">
            {expirationAlerts.slice(0, 3).map((alert) => (
              <div key={alert.itemId} className={`p-3 rounded border ${getExpirationColor(alert.daysRemaining)}`}>
                <p className="text-sm font-medium">{alert.message}</p>
                <p className="text-xs opacity-75 mt-1">
                  {alert.expirationType === 'use-by' ? 'Use by' : 'Best by'} date
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recipe Suggestions - Use Soon */}
      {recipeSuggestions.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-2">
            <ChefHat className="w-4 h-4" />
            Use Soon - Recipe Ideas
          </h3>
          <div className="space-y-3">
            {recipeSuggestions.slice(0, 3).map((suggestion) => (
              <div key={suggestion.itemId} className="bg-white rounded border border-green-100 p-3">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-medium text-gray-900">{suggestion.itemName}</p>
                  <span className={`text-xs px-2 py-1 rounded ${
                    suggestion.daysRemaining <= 1 ? 'bg-red-100 text-red-800' :
                    suggestion.daysRemaining <= 3 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {suggestion.daysRemaining}d left
                  </span>
                </div>
                <p className="text-xs text-gray-600 mb-2">{suggestion.reason}</p>
                <div className="flex flex-wrap gap-1">
                  {suggestion.suggestedRecipes.map((recipe, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        if (setActiveTab && setInitialSearchQuery) {
                          setInitialSearchQuery(recipe);
                          setActiveTab(Tab.RECIPES);
                        }
                      }}
                      className="text-xs bg-green-100 hover:bg-green-200 text-green-800 px-2 py-1 rounded transition-colors"
                    >
                      {recipe}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1">
        <div className="text-center text-theme-secondary opacity-60 text-sm mb-4">
          <span className="font-medium">{inventory.length}</span> items{' '}
          {viewMode === 'category'
            ? `in ${Object.keys(groupedItems).length} categories`
            : 'across 5 storage locations'
          }
        </div>

        {/* Categories Grid - Only show in category view */}
        {viewMode === 'category' && (
          <div className="grid grid-cols-4 gap-4">
            {sortedCategories.map(category => {
              const items = groupedItems[category];
              const representativeImage = items[0]?.image || getItemImage('', category);
              return (
                <div
                  key={category}
                  onClick={() => toggleCategory(category)}
                  className="bg-theme-secondary rounded-lg shadow-md border border-theme overflow-hidden group hover:shadow-lg transition-all cursor-pointer"
                >
                  <div className="h-16 relative bg-gray-200 overflow-hidden">
                    <img
                      src={representativeImage}
                      alt={category}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                    <div className="absolute bottom-2 left-2 right-2 text-white">
                      <h4 className="text-sm font-bold leading-tight">{category}</h4>
                      <div className="text-xs opacity-90 mt-1">
                        {items.length} items
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Storage Location Buttons - Only show in storage view */}
        {viewMode === 'storage' && (
          <div className="flex justify-center mb-4">
            <div className="flex gap-3">
              {storageOrder.map(location => {
                const items = groupedByStorage[location] || [];
                const locationLabel = (storageLabels as Record<string, string>)[location] || location;
                return (
                  <div
                    key={location}
                    onClick={() => toggleStorageLocation(location)}
                    className="bg-theme-secondary rounded-lg shadow-md border-2 border-[var(--accent-color)] overflow-hidden group hover:shadow-lg transition-all cursor-pointer w-20 h-20"
                  >
                    <div className="h-10 relative bg-gradient-to-br from-[var(--accent-color)]/20 to-[var(--accent-color)]/5 overflow-hidden flex items-center justify-center">
                      <StorageLocationIndicator
                        location={location as 'pantry' | 'freezer' | 'fridge' | 'spices' | 'other'}
                        size="md"
                      />
                    </div>
                    <div className="px-1 py-0.5 text-center">
                      <h4 className="text-xs font-bold leading-tight text-theme-primary">{locationLabel}</h4>
                      <div className="text-xs opacity-70 text-theme-secondary">
                        {items.length}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Items List */}
        <div className="mt-8 space-y-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-theme-primary">
              {viewMode === 'category' ? 'Pantry Items' : 'Storage Items'}
            </h3>
            <div className="flex gap-2">
              {viewMode === 'category' && (
                <button
                  onClick={collapseAllCategories}
                  className="px-3 py-1 rounded-lg text-sm font-medium bg-theme-secondary text-theme-primary hover:bg-theme-primary transition-colors"
                  aria-label="Collapse all category sections"
                >
                  Collapse All
                </button>
              )}
              <button
                onClick={toggleBulkMode}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  bulkMode
                    ? 'bg-[var(--accent-color)] text-white'
                    : 'bg-theme-secondary text-theme-primary hover:bg-theme-primary'
                }`}
                aria-label={bulkMode ? 'Exit bulk selection mode' : 'Enter bulk selection mode'}
              >
                {bulkMode ? 'Cancel' : 'Select Multiple'}
              </button>
            </div>
          </div>

          {bulkMode && (
            <div className="flex items-center justify-between p-3 bg-theme-secondary rounded-lg mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={selectAllItems}
                  className="text-sm text-[var(--accent-color)] hover:underline"
                  aria-label={selectedItems.size === inventory.length ? 'Deselect all items' : 'Select all items'}
                >
                  {selectedItems.size === inventory.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-sm text-theme-secondary">
                  {selectedItems.size} selected
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={bulkMoveToShoppingList}
                  disabled={selectedItems.size === 0}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                  aria-label="Move selected items to shopping list"
                >
                  Move to Shopping
                </button>
                <button
                  onClick={bulkDelete}
                  disabled={selectedItems.size === 0}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                  aria-label="Delete selected items from pantry"
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          {/* Render the appropriate view */}
          {isLoadingInventory ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <PantryItemSkeleton key={index} />
              ))}
            </div>
          ) : inventory.length === 0 ? (
            <div className="text-center py-12 px-6">
              <div className="bg-theme-secondary rounded-2xl p-8 border border-theme shadow-lg max-w-md mx-auto">
                <div className="w-16 h-16 bg-gradient-to-br from-[var(--accent-color)]/20 to-[var(--accent-color)]/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-[var(--accent-color)]" />
                </div>
                <h3 className="text-xl font-bold text-theme-secondary mb-2">Your pantry is empty</h3>
                <p className="text-theme-secondary opacity-70 mb-6 text-sm">
                  Start building your pantry by scanning receipts, taking photos, or manually adding items.
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="w-full py-3 px-4 bg-[var(--accent-color)] text-white rounded-xl font-semibold shadow-lg hover:bg-[var(--accent-color)]/90 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2"
                    aria-label="Open add items modal to start building your pantry"
                  >
                    <Plus className="w-4 h-4 inline mr-2" aria-hidden="true" />
                    Add Your First Items
                  </button>
                  <button
                    onClick={() => {
                      if (setActiveTab) setActiveTab(Tab.RECIPES);
                    }}
                    className="w-full py-3 px-4 bg-theme-secondary text-theme-primary rounded-xl font-medium border border-theme hover:bg-theme-primary transition-colors focus:outline-none focus:ring-2 focus:ring-theme-secondary focus:ring-offset-2"
                    aria-label="Browse available recipes to get cooking inspiration"
                  >
                    <ChefHat className="w-4 h-4 inline mr-2" aria-hidden="true" />
                    Browse Recipes
                  </button>
                </div>
              </div>
            </div>
          ) : inventory.length > VIRTUALIZE_THRESHOLD ? (
            <div className="bg-theme-secondary rounded-lg border border-theme overflow-hidden">
              <List
                height={Math.min(600, window.innerHeight - 300)}
                itemCount={sortedInventory.length}
                itemSize={64}
                width={'100%'}
              >
                {renderRow}
              </List>
            </div>
          ) : (
            (viewMode === 'category' ? categoryViewContent : storageViewContent)
          )}

        </div>
      </div>

      {/* Price Trends Modal */}
      {showPriceTrends && (
        <PriceTrends
          ingredient={showPriceTrends}
          onClose={() => setShowPriceTrends(null)}
        />
      )}

      {/* Bulk Quantity Edit Modal */}
      {showBulkQuantityEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-theme-primary rounded-lg shadow-xl w-full max-w-md mx-auto max-h-[80vh] overflow-y-auto border border-theme pb-20 pt-20">
            <div className="p-6 pb-2.5">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-theme-secondary">Edit Quantities</h3>
                <button
                  onClick={() => {
                    setShowBulkQuantityEdit(false);
                    setBulkQuantityEditItems([]);
                  }}
                  className="p-2 hover:bg-theme-secondary rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-theme-secondary" />
                </button>
              </div>

              <p className="text-sm text-theme-secondary opacity-70 mb-4">
                Update quantities for the items you just added:
              </p>

              <div className="space-y-4">
                {bulkQuantityEditItems.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-theme-secondary rounded-lg">
                    <img
                      src={item.image}
                      alt={item.item}
                      className="w-10 h-10 rounded-lg object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/images/placeholder.svg';
                      }}
                    />
                    <div className="flex-1">
                      <span className="font-medium text-theme-primary">{item.item}</span>
                      <div className="mt-2">
                        <VisualQuantitySelector
                          value={parseInt(item.quantity_estimate) || 1}
                          onChange={(newQty) => {
                            const updatedItems = [...bulkQuantityEditItems];
                            updatedItems[index] = {
                              ...updatedItems[index],
                              quantity_estimate: newQty.toString()
                            };
                            setBulkQuantityEditItems(updatedItems);
                          }}
                          itemName={item.item}
                          unit="items"
                          maxValue={20}
                          showTypicalAmounts={false}
                          showVisualLevels={false}
                          className="scale-90"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowBulkQuantityEdit(false);
                    setBulkQuantityEditItems([]);
                  }}
                  className="flex-1 py-3 rounded-lg font-bold text-sm uppercase tracking-wider bg-theme-secondary text-theme-secondary hover:bg-theme-primary transition-colors"
                  aria-label="Skip quantity editing and keep current quantities"
                >
                  Skip
                </button>
                <button
                  onClick={async () => {
                    // Update all items with their new quantities
                    const updatePromises = bulkQuantityEditItems.map(async (item) => {
                      const inventoryIndex = inventory.findIndex(i => i.id === item.id);
                      if (inventoryIndex !== -1) {
                        await updateItem(inventoryIndex, { quantity_estimate: item.quantity_estimate });
                      }
                    });
                    
                    await Promise.all(updatePromises);
                    setShowBulkQuantityEdit(false);
                    setBulkQuantityEditItems([]);
                  }}
                  className="flex-1 py-3 rounded-lg font-bold text-sm uppercase tracking-wider bg-[var(--accent-color)] text-white shadow-lg hover:bg-[var(--accent-color)]/90 transition-colors"
                  aria-label="Save all updated quantities"
                >
                  Save All
                </button>
              </div>
            </div>
          </div>
        </div>
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

      {/* Recipe Modal */}
      {showRecipeModal && modalRecipe && (
        <RecipeModal
          recipe={modalRecipe}
          isOpen={showRecipeModal}
          onClose={() => setShowRecipeModal(false)}
          onAddToPlan={appActions.onAddToPlan}
          onSaveRecipe={onSaveRecipe}
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
