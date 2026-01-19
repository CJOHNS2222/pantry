import React, { useState, useRef } from 'react';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Camera, Upload, Loader2, Plus, Trash2, CheckCircle2, ShoppingBasket, X, Barcode, ChevronDown, ChevronRight, ChevronUp, Image, ChefHat, TrendingUp } from 'lucide-react';
import { FixedSizeList as List } from 'react-window';
import { analyzePantryImage } from '../services/geminiService';
import { getItemImage, inferCategoryFromItemName, inferStorageLocationFromItemName, getStorageLocationImage, getAutoExpirationDate, getExpirationColor, getAllCategories, getCategoryIcon, parseItemText, fetchExternalItemImage, combineQuantities, formatItemQuantity } from '../utils/appUtils';
import { PantryItem, LoadingState, ConsumptionSuggestion, ExpirationAlert, CustomCategory, RecipeSuggestion } from '../types';
import { Tab } from '../types/app';
import AnalyticsService from '../services/analyticsService';
import { BrowserMultiFormatReader } from '@zxing/library';
import PriceTrends from './PriceTrends';
import ItemDetailModal from './ItemDetailModal';

interface PantryScannerProps {
  inventory: PantryItem[];
  setInventory: React.Dispatch<React.SetStateAction<PantryItem[]>>;
  addToShoppingList: (items: string[]) => void;
  consumptionSuggestions?: ConsumptionSuggestion[];
  expirationAlerts?: ExpirationAlert[];
  recipeSuggestions?: RecipeSuggestion[];
  customCategories?: CustomCategory[];
  setActiveTab?: (tab: Tab) => void;
  setInitialSearchQuery?: (query: string) => void;
}

export const PantryScanner: React.FC<PantryScannerProps> = ({ 
  inventory, 
  setInventory, 
  addToShoppingList,
  consumptionSuggestions = [],
  expirationAlerts = [],
  recipeSuggestions = [],
  customCategories = [],
  setActiveTab,
  setInitialSearchQuery
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [rawBase64, setRawBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [newItemText, setNewItemText] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
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
  

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use Capacitor Camera for mobile
  const handleTakePhoto = async () => {
    try {
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
  };

  // Select photo from gallery
  const handleSelectFromGallery = async () => {
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
  };

  // Barcode scanning with camera
  const handleScanBarcode = async () => {
    try {
      const photo = await CapacitorCamera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        quality: 90, // Higher quality for barcode detection
      });
      
      if (photo.dataUrl) {
        setLoadingState(LoadingState.LOADING);
        setImagePreview(photo.dataUrl);
        
        // Convert data URL to ImageData for barcode detection
        const img = new Image();
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
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  const handleAnalyze = async () => {
    if (!rawBase64) return;
    setLoadingState(LoadingState.LOADING);

    try {
      const items = await analyzePantryImage(rawBase64, mimeType);
      if (items.length > 0) {
        // Process items and fetch external images for placeholders
        const processedItems = await Promise.all(items.map(async (item) => {
          // Parse the item text to extract quantity and clean description
          const { quantity, description } = parseItemText(item.item);
          const category = inferCategoryFromItemName(description);
          const now = new Date().toISOString();
          let image = getItemImage(description, category);

          // If it's a placeholder, try to fetch an external image
          if (image === '/images/placeholder.svg') {
            try {
              const externalImage = await fetchExternalItemImage(description);
              if (externalImage) {
                image = externalImage;
              }
            } catch (error) {
              console.log('Failed to fetch external image for', description, error);
            }
          }

          return {
            ...item,
            item: description, // Use cleaned description
            quantity_estimate: quantity.toString(), // Use extracted quantity
            id: crypto.randomUUID(),
            image,
            storageLocation: inferStorageLocationFromItemName(description), // Use cleaned description for storage
            expirationDate: getAutoExpirationDate(description, category), // Use cleaned description for expiration
            expirationType: 'best-by', // Default to best-by for auto-detected items
            dateAdded: now,
            lastRestocked: now,
            consumptionHistory: [now] // Add current date to consumption history
          };
        }));

        // Instead of immediately saving, open a review modal so user can edit/confirm items
        setScanResults(processedItems as PantryItem[]);
        setShowScanReviewModal(true);
        // Track pantry scan results
        AnalyticsService.trackPantryScan(items.length, items.length);
        setLoadingState(LoadingState.SUCCESS);
        // Track pantry scan results
        AnalyticsService.trackPantryScan(items.length, items.length);
        setLoadingState(LoadingState.SUCCESS);
        
        // Auto-close the modal after showing success message
        setTimeout(() => {
          setImagePreview(null);
          setRawBase64(null);
          setLoadingState(LoadingState.IDLE);
        }, 3000);
      } else {
          setLoadingState(LoadingState.ERROR);
      }
    } catch (err) {
      console.error(err);
      setLoadingState(LoadingState.ERROR);
    }
  };

  const removeItem = (index: number) => {
    setInventory(prev => prev.filter((_, i) => i !== index));
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const itemName = newItemText.trim();
    if (!itemName) {
      alert('Please enter an item name.');
      return;
    }
    
    if (itemName.length < 2) {
      alert('Item name must be at least 2 characters long.');
      return;
    }
    
    if (itemName.length > 50) {
      alert('Item name must be less than 50 characters.');
      return;
    }
    
    if (newQty < 1) {
      alert('Quantity must be at least 1.');
      return;
    }
    
    if (newQty > 999) {
      alert('Quantity cannot exceed 999.');
      return;
    }
    
    // Check for duplicate items
    const existingItem = inventory.find(p => p.item.toLowerCase() === itemName.toLowerCase());
    if (existingItem && !confirm(`"${itemName}" already exists in your pantry. Add ${newQty} more?`)) {
      return;
    }
    
    // Prepare the new item data
    const category = inferCategoryFromItemName(newItemText.trim());
    const now = new Date().toISOString();
    
    // Try to get local image first
    let image = getItemImage(newItemText.trim(), category);
    
    // If it's a placeholder, try to fetch an external image
    if (image === '/images/placeholder.svg') {
      try {
        const externalImage = await fetchExternalItemImage(newItemText.trim());
        if (externalImage) {
          image = externalImage;
        }
      } catch (error) {
        console.log('Failed to fetch external image for', newItemText.trim(), error);
      }
    }
    
    setInventory(prev => {
      const idx = prev.findIndex(p => p.item.toLowerCase() === itemName.toLowerCase());
      if (idx !== -1) {
        // Merge quantity with existing item
        const updated = [...prev];
        const existingItem = updated[idx];
        
        if (existingItem.quantity) {
          // Use new quantity system - combine quantities
          const newQuantity = { amount: newQty, unit: 'count' }; // Default to count for manual additions
          const combined = combineQuantities(existingItem.quantity, newQuantity);
          updated[idx] = {
            ...existingItem,
            quantity: combined,
            lastRestocked: now
          };
        } else {
          // Fallback to old system for backward compatibility
          const prevQty = parseInt(existingItem.quantity_estimate) || 1;
          updated[idx].quantity_estimate = (prevQty + newQty).toString();
        }
        
        // Track pantry item addition (update existing)
        AnalyticsService.trackPantryItemAdd(itemName, 'Manual', newQty, 'manual');
        return updated;
      } else {
        // Track pantry item addition (new item)
        AnalyticsService.trackPantryItemAdd(itemName, 'Manual', newQty, 'manual');
        return [...prev, {
          id: crypto.randomUUID(),
          item: newItemText.trim(),
          category: category,
          quantity_estimate: newQty.toString(), // Keep for backward compatibility
          quantity: { amount: newQty, unit: 'count' }, // New quantity system
          image,
          storageLocation: inferStorageLocationFromItemName(newItemText.trim()),
          expirationDate: getAutoExpirationDate(newItemText.trim(), category),
          expirationType: 'best-by', // Default to best-by for manual additions
          dateAdded: now,
          lastRestocked: now,
          consumptionHistory: [now] // Add current date to consumption history
        }];
      }
    });
    setNewItemText('');
    setNewQty(1);
    setIsAddModalOpen(false); // Close modal after adding
  };

  const closeModal = () => {
    setIsAddModalOpen(false);
    setImagePreview(null);
    setRawBase64(null);
    setMimeType("");
    setLoadingState(LoadingState.IDLE);
    setNewItemText('');
    setNewQty(1);
  };

  const incrementQty = () => {
    setNewQty(prev => prev + 1);
  };

  const decrementQty = () => {
    setNewQty(prev => Math.max(1, prev - 1));
  };

  // Bulk operations
  const toggleBulkMode = () => {
    setBulkMode(!bulkMode);
    setSelectedItems(new Set());
  };

  const toggleItemSelection = (index: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedItems(newSelected);
  };

  const selectAllItems = () => {
    if (selectedItems.size === inventory.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(inventory.map((_, idx) => idx)));
    }
  };

  const bulkDelete = () => {
    if (selectedItems.size === 0) return;
    
    if (confirm(`Delete ${selectedItems.size} selected item(s)?`)) {
      setInventory(prev => prev.filter((_, idx) => !selectedItems.has(idx)));
      setSelectedItems(new Set());
      setBulkMode(false);
    }
  };

  const bulkMoveToShoppingList = () => {
    if (selectedItems.size === 0) return;
    
    const itemsToMove = Array.from(selectedItems).map((idx: number) => inventory[idx].item);
    addToShoppingList(itemsToMove, 'pantry scanner');
    setInventory(prev => prev.filter((_, idx) => !selectedItems.has(idx)));
    setSelectedItems(new Set());
    setBulkMode(false);
    alert(`Moved ${selectedItems.size} items to shopping list.`);
  };

  const toggleCategory = (category: string) => {
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
  };

  // Bulk actions
  const bulkChangeLocation = (newLocation: 'pantry' | 'fridge' | 'freezer' | 'spices' | 'other') => {
    if (selectedItems.size === 0) return;
    setInventory(prev => prev.map((item, idx) => selectedItems.has(idx) ? { ...item, storageLocation: newLocation } : item));
    setSelectedItems(new Set());
    setBulkMode(false);
  };

  const bulkSetExpiration = (isoDate: string) => {
    if (selectedItems.size === 0) return;
    setInventory(prev => prev.map((item, idx) => selectedItems.has(idx) ? { ...item, expirationDate: isoDate } : item));
    setSelectedItems(new Set());
    setBulkMode(false);
  };

  const bulkAddToShoppingListWithRemove = () => {
    if (selectedItems.size === 0) return;
    const itemsToMove = Array.from(selectedItems).map(idx => inventory[idx].item);
    addToShoppingList(itemsToMove);
    setInventory(prev => prev.filter((_, idx) => !selectedItems.has(idx)));
    setSelectedItems(new Set());
    setBulkMode(false);
    alert(`Moved ${itemsToMove.length} items to shopping list.`);
  };

  const toggleStorageLocation = (location: string) => {
    // Bring clicked storage location section to the top
    setStorageSectionOrder(prev => {
      const filtered = prev.filter(l => l !== location);
      return [location, ...filtered];
    });
  };

  const collapseAllCategories = () => {
    setExpandedCategories(new Set());
  };

  // Sort inventory based on selected criteria
  const sortedInventory = inventory.map((item, idx) => ({ ...item, originalIndex: idx })).sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.item.localeCompare(b.item);
      case 'lastAdded':
        const aDate = a.lastRestocked || a.dateAdded || '';
        const bDate = b.lastRestocked || b.dateAdded || '';
        return new Date(bDate).getTime() - new Date(aDate).getTime(); // Most recent first
      case 'expiration':
        const aExp = a.expirationDate || '9999-12-31';
        const bExp = b.expirationDate || '9999-12-31';
        return new Date(aExp).getTime() - new Date(bExp).getTime(); // Soonest first
      case 'category':
        return (a.category || '').localeCompare(b.category || '');
      case 'location':
        const locationOrder = { pantry: 1, fridge: 2, freezer: 3, spices: 4, other: 5 };
        const aLoc = a.storageLocation || 'pantry';
        const bLoc = b.storageLocation || 'pantry';
        return locationOrder[aLoc] - locationOrder[bLoc];
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

  const updateStorageLocation = (itemIndex: number, newLocation: 'pantry' | 'freezer' | 'fridge' | 'spices' | 'other') => {
    setInventory(prev => {
      const updated = [...prev];
      updated[itemIndex] = { ...updated[itemIndex], storageLocation: newLocation };
      return updated;
    });
  };

  const updateCategory = (itemIndex: number, newCategory: string) => {
    setInventory(prev => {
      const updated = [...prev];
      updated[itemIndex] = { ...updated[itemIndex], category: newCategory };
      return updated;
    });
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
            {items.map((item) => (
              <div key={item.originalIndex} className={`flex items-center justify-between px-2 py-1 border-b border-theme last:border-b-0 transition-all cursor-pointer ${
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
                    src={item.image}
                    alt={item.item}
                    className="w-10 h-10 rounded-lg object-cover bg-theme-primary border border-theme"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/images/placeholder.svg';
                    }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-theme-primary">{item.item}</div>
                      <div className="text-xs text-theme-secondary opacity-70 bg-theme-secondary px-1 py-0.5 rounded">Qty: {formatItemQuantity(item)}</div>
                      {item.expirationDate && (
                        <div className={`text-xs px-1 py-0.5 rounded font-medium ${
                          getExpirationColor(item.expirationDate, item.expirationType) === 'red' ? 'bg-red-100 text-red-800' :
                          getExpirationColor(item.expirationDate, item.expirationType) === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {Math.ceil((new Date(item.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}d
                        </div>
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
            ))}
          </div>
        )}
      </div>
    );
  });

  const storageViewContent = storageSectionOrder.map(location => {
    const items = groupedByStorage[location] || [];
    const locationLabel = storageLabels[location];
    
    return (
      <div key={location} className="bg-theme-secondary rounded-lg border border-theme overflow-hidden">
        <div className="w-full flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
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
          ) : (
            items.map((item) => (
              <div key={item.originalIndex} className={`flex items-center justify-between px-2 py-1 border-b border-theme last:border-b-0 transition-all cursor-pointer ${
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
                    src={item.image}
                    alt={item.item}
                    className="w-10 h-10 rounded-lg object-cover bg-theme-primary border border-theme"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/images/placeholder.svg';
                    }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-theme-primary">{item.item}</div>
                      <div className="text-xs text-theme-secondary opacity-70 bg-theme-secondary px-1 py-0.5 rounded">Qty: {formatItemQuantity(item)}</div>
                      {item.expirationDate && (
                        <div className={`text-xs px-1 py-0.5 rounded font-medium ${
                          getExpirationColor(item.expirationDate, item.expirationType) === 'red' ? 'bg-red-100 text-red-800' :
                          getExpirationColor(item.expirationDate, item.expirationType) === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {Math.ceil((new Date(item.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}d
                        </div>
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
            ))
          )}
        </div>
      </div>
    );
  });

  // Virtualized flat list renderer for large inventories
  const VIRTUALIZE_THRESHOLD = 80;
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
          <img src={item.image} alt={item.item} className="w-10 h-10 rounded-lg object-cover bg-theme-primary border border-theme" onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder.svg'; }} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="font-medium text-theme-primary">{item.item}</div>
              <div className="text-xs text-theme-secondary opacity-70 bg-theme-secondary px-1 py-0.5 rounded">Qty: {formatItemQuantity(item)}</div>
              {item.expirationDate && (
                <div className={`text-xs px-1 py-0.5 rounded font-medium ${
                  getExpirationColor(item.expirationDate, item.expirationType) === 'red' ? 'bg-red-100 text-red-800' :
                  getExpirationColor(item.expirationDate, item.expirationType) === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {Math.ceil((new Date(item.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}d
                </div>
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
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {bulkMode && (
        <div className="bg-theme-secondary p-3 rounded-lg border border-theme mb-4 flex items-center gap-3">
          <div className="text-sm text-theme-primary font-medium">Bulk Mode: {selectedItems.size} selected</div>
          <select onChange={(e) => bulkChangeLocation(e.target.value as any)} className="px-2 py-1 rounded bg-theme-primary border border-theme text-theme-primary">
            <option value="pantry">Move to Pantry</option>
            <option value="fridge">Move to Fridge</option>
            <option value="freezer">Move to Freezer</option>
            <option value="spices">Move to Spices</option>
            <option value="other">Move to Other</option>
          </select>
          <input type="date" onChange={(e) => bulkSetExpiration(e.target.value)} className="px-2 py-1 rounded bg-theme-primary border border-theme text-theme-primary" />
          <button onClick={bulkAddToShoppingListWithRemove} className="px-3 py-1 bg-[var(--accent-color)] text-white rounded">Move to Shopping</button>
          <button onClick={selectAllItems} className="px-3 py-1 bg-theme-primary border border-theme rounded">Toggle Select All</button>
          <button onClick={bulkDelete} className="ml-auto px-3 py-1 bg-red-600 text-white rounded">Delete</button>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => setIsAddModalOpen(true)}
        className="fixed bottom-28 right-6 z-50 bg-[var(--accent-color)] text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
        style={{ bottom: 'calc(7rem + 15px)' }}
        aria-label="Add items to pantry"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Add Items Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
          <div className="bg-theme-primary rounded-t-3xl max-w-md w-full max-h-[80vh] overflow-y-auto shadow-xl animate-slide-up">
            <div className="p-6 pb-[45px]">
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
                    className="flex-1 py-2 px-3 rounded-lg border border-theme text-theme-secondary hover:bg-theme-primary transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Camera className="w-4 h-4" />
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
                    className="flex-1 py-2 px-3 rounded-lg border border-theme text-theme-secondary hover:bg-theme-primary transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Image className="w-4 h-4" />
                    Gallery
                  </button>
                  
                  <button
                    onClick={handleScanBarcode}
                    disabled={loadingState === LoadingState.LOADING}
                    className="flex-1 py-2 px-3 rounded-lg border border-theme text-theme-secondary hover:bg-theme-primary transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Barcode className="w-4 h-4" />
                    Barcode
                  </button>
                </div>

                {imagePreview && loadingState !== LoadingState.SUCCESS && (
                  <button
                    onClick={handleAnalyze}
                    disabled={loadingState === LoadingState.LOADING}
                    className="w-full mt-4 py-3 rounded-lg font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 bg-[var(--accent-color)] text-white shadow-lg"
                  >
                    {loadingState === LoadingState.LOADING ? (
                      <>
                        <Loader2 className="animate-spin w-4 h-4" />
                        <span>Analyzing Image...</span>
                      </>
                    ) : (
                      <>
                        <Image className="w-4 h-4" />
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
                <form onSubmit={handleManualAdd} className="space-y-4">
                  <div className="flex gap-3">
                    <input 
                      type="text"
                      value={newItemText}
                      onChange={(e) => setNewItemText(e.target.value)}
                      placeholder="Enter item name..."
                      className="flex-1 max-w-[calc(100%-120px)] bg-theme-primary border border-theme rounded-lg px-4 py-3 text-theme-secondary shadow-sm outline-none focus:border-[var(--accent-color)]"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        value={newQty}
                        onChange={e => setNewQty(Number(e.target.value))}
                        className="w-12 bg-theme-primary border border-theme rounded-lg px-2 py-3 text-theme-secondary shadow-sm focus:border-[var(--accent-color)] outline-none text-center"
                        placeholder="Qty"
                      />
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={incrementQty}
                          className="p-1 bg-theme-secondary hover:bg-theme-primary border border-theme rounded text-theme-secondary hover:text-[var(--accent-color)] transition-colors"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={decrementQty}
                          className="p-1 bg-theme-secondary hover:bg-theme-primary border border-theme rounded text-theme-secondary hover:text-[var(--accent-color)] transition-colors"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
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

            {/* Scan Review Modal (appears after analyze) */}
            {showScanReviewModal && scanResults && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-theme-primary rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-theme p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-theme-secondary">Review Scanned Items</h3>
                    <button onClick={() => { setShowScanReviewModal(false); setScanResults(null); }} className="p-2 rounded hover:bg-theme-secondary">
                      <X className="w-5 h-5 text-theme-secondary" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {scanResults.map((sItem, idx) => (
                      <div key={sItem.id} className="bg-theme-secondary p-3 rounded-lg border border-theme flex items-center gap-3">
                        <img src={sItem.image} alt={sItem.item} className="w-12 h-12 rounded object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder.svg'; }} />
                        <div className="flex-1">
                          <input value={sItem.item} onChange={(e) => {
                            const updated = [...scanResults];
                            updated[idx] = { ...updated[idx], item: e.target.value };
                            setScanResults(updated);
                          }} className="w-full px-2 py-1 rounded bg-theme-primary border border-theme text-theme-primary" />
                          <div className="flex gap-2 mt-2">
                            <input type="number" value={parseInt(sItem.quantity_estimate || '1')} onChange={(e) => {
                              const updated = [...scanResults];
                              updated[idx] = { ...updated[idx], quantity_estimate: e.target.value };
                              setScanResults(updated);
                            }} className="w-24 px-2 py-1 rounded bg-theme-primary border border-theme text-theme-primary" />
                            <select value={sItem.category || 'Uncategorized'} onChange={(e) => {
                              const updated = [...scanResults];
                              updated[idx] = { ...updated[idx], category: e.target.value };
                              setScanResults(updated);
                            }} className="px-2 py-1 rounded bg-theme-primary border border-theme text-theme-primary">
                              {getAllCategories(customCategories).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            {('confidence' in sItem) && (
                              <div className="text-sm text-theme-secondary opacity-80 ml-auto">Conf: {(sItem as any).confidence}</div>
                            )}
                          </div>
                        </div>
                        <button onClick={() => {
                          const updated = scanResults.filter((_, i) => i !== idx);
                          setScanResults(updated.length ? updated : null);
                          if (updated.length === 0) setShowScanReviewModal(false);
                        }} className="p-2 rounded bg-red-600 text-white">Remove</button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button onClick={() => {
                      // Confirm: add scanResults to inventory
                      if (scanResults) {
                        setInventory(prev => [...prev, ...scanResults]);
                      }
                      setShowScanReviewModal(false);
                      setScanResults(null);
                      setImagePreview(null);
                      setRawBase64(null);
                      setLoadingState(LoadingState.IDLE);
                    }} className="px-4 py-2 bg-[var(--accent-color)] text-white rounded">Add All</button>
                    <button onClick={() => { setShowScanReviewModal(false); setScanResults(null); }} className="px-4 py-2 bg-theme-primary border border-theme rounded">Cancel</button>
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
                  onClick={() => addToShoppingList([suggestion.item], 'scanner suggestion')}
                  className="ml-3 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
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
                const locationImage = getStorageLocationImage(location);
                const locationLabel = storageLabels[location];
                return (
                  <div
                    key={location}
                    onClick={() => toggleStorageLocation(location)}
                    className="bg-theme-secondary rounded-lg shadow-md border-2 border-[var(--accent-color)] overflow-hidden group hover:shadow-lg transition-all cursor-pointer w-20 h-20"
                  >
                    <div className="h-10 relative bg-gradient-to-br from-[var(--accent-color)]/20 to-[var(--accent-color)]/5 overflow-hidden flex items-center justify-center">
                      <img
                        src={locationImage}
                        alt={locationLabel}
                        className="w-6 h-6 object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/images/placeholder.svg';
                        }}
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
                >
                  Move to Shopping
                </button>
                <button
                  onClick={bulkDelete}
                  disabled={selectedItems.size === 0}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          {/* Render the appropriate view */}
          {inventory.length > VIRTUALIZE_THRESHOLD ? (
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

      {/* Item Detail Modal */}
      {selectedItemIndex !== null && (
        <ItemDetailModal
          item={inventory[selectedItemIndex]}
          onClose={() => setSelectedItemIndex(null)}
          onUpdateItem={(index, updates) => {
            setInventory(prev => {
              const updated = [...prev];
              updated[index] = { ...updated[index], ...updates };
              return updated;
            });
          }}
          onDeleteItem={(index) => {
            setInventory(prev => prev.filter((_, i) => i !== index));
          }}
          onAddToShoppingList={addToShoppingList}
          customCategories={customCategories}
          originalIndex={selectedItemIndex}
        />
      )}
    </div>
  );
};
