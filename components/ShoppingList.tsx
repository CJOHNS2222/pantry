import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { ShoppingBasket, Check, Trash2, Archive, Plus, X, Share2, Copy, Download, MessageSquare } from 'lucide-react';
import { ShoppingItem } from '../types';
import { inferCategoryFromItemName, getItemImage } from '../utils/appUtils';
import { log } from '../services/logService';
import { validateItemName, validateQuantity } from '../src/utils/validation';
import { ShoppingListItemSkeleton } from './SkeletonLoader';

// Import new enhancement components
import { EnhancedShoppingListItem } from './EnhancedShoppingListItem';
import { SmartShoppingListOrganizer } from './SmartShoppingListOrganizer';
import { BatchOperations } from './BatchOperations';
import { OfflineShoppingIndicator } from './OfflineShoppingIndicator';
import { HouseholdShoppingShare } from './HouseholdShoppingShare';
import { QuickAdd } from './QuickAdd';
import { ShoppingListAnalytics } from './ShoppingListAnalytics';
import QuantityUnitPicker from './QuantityUnitPicker';

// Import hooks and services
import { useOfflineStatus } from '../hooks/useOfflineStatus';
import { useDataManagement } from '../hooks/useDataManagement';
import { offlineQueueService } from '../services/offlineQueueService';
import { offlineDataCache } from '../services/offlineDataCache';
import { groceryPriceService } from '../services/groceryPriceService';

interface ShoppingListProps {
  items: ShoppingItem[];
  setItems: React.Dispatch<React.SetStateAction<ShoppingItem[]>>;
  onMoveToPantry: (items: ShoppingItem[]) => void;
  isLoadingShoppingList?: boolean;
  pantryItems?: Array<{
    id: string;
    name: string;
    quantity: number;
    unit: string;
    category?: string;
    lastUpdated: Date;
    expirationDate?: Date;
  }>;
  recentPurchases?: Array<{
    itemName: string;
    quantity: number;
    unit: string;
    category?: string;
    purchasedAt: Date;
  }>;
  householdMembers?: Array<{
    id: string;
    name: string;
    avatar?: string;
    lastActive: Date;
    currentActivity?: string;
  }>;
  onHouseholdMessage?: (message: string) => void;
}

export const ShoppingList: React.FC<ShoppingListProps> = ({
  items,
  setItems,
  onMoveToPantry,
  isLoadingShoppingList = false,
  pantryItems = [],
  recentPurchases = [],
  householdMembers = [],
  onHouseholdMessage
}) => {
  const [newItem, setNewItem] = React.useState('');
  const [newQty, setNewQty] = React.useState<string>('1');
  const [newUnit, setNewUnit] = React.useState<string>('count');
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [validationErrors, setValidationErrors] = React.useState<{item?: string, quantity?: string}>({});

  // New state for enhanced features
  const [viewMode, setViewMode] = useState<'list' | 'organized'>('list');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [undoHistory, setUndoHistory] = useState<Array<{item: ShoppingItem, timestamp: Date}>>([]);
  const [householdActivity, setHouseholdActivity] = useState<Array<{
    id: string;
    memberId: string;
    memberName: string;
    action: string;
    itemName?: string;
    timestamp: Date;
  }>>([]);

  // Multi-selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Session tracking for analytics
  const [currentSessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [previousSessions, setPreviousSessions] = useState<Array<{
    sessionId: string;
    items: ShoppingItem[];
    startTime: Date;
    endTime?: Date;
    totalSpent: number;
  }>>([]);

  // Load previous sessions from localStorage on mount
  useEffect(() => {
    const savedSessions = localStorage.getItem('shoppingListSessions');
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        setPreviousSessions(parsed.map((session: any) => ({
          ...session,
          startTime: new Date(session.startTime),
          endTime: session.endTime ? new Date(session.endTime) : undefined,
          items: session.items.map((item: any) => ({
            ...item,
            addedAt: item.addedAt ? new Date(item.addedAt) : undefined,
            completedAt: item.completedAt ? new Date(item.completedAt) : undefined,
          }))
        })));
      } catch (error) {
        console.warn('Failed to load previous shopping sessions:', error);
      }
    }
  }, []);

  // Helper function to estimate price for an item
  const estimateItemPrice = async (itemName: string, quantity?: number | string): Promise<number> => {
    try {
      const priceData = await groceryPriceService.getIngredientPrice(itemName);
      if (!priceData) return 0;

      // Parse quantity - handle both numbers and strings like "2 cups"
      let qty = 1;
      if (typeof quantity === 'number') {
        qty = quantity;
      } else if (typeof quantity === 'string') {
        const parsed = parseFloat(quantity);
        if (!isNaN(parsed)) {
          qty = parsed;
        }
      }

      return priceData.averagePrice * qty;
    } catch (error) {
      console.warn(`Failed to estimate price for ${itemName}:`, error);
      return 0;
    }
  };

  // Save current session to localStorage when all items are completed
  const saveCurrentSession = useCallback(() => {
    const completedItems = items.filter(item => item.checked && item.completedAt);
    if (completedItems.length === 0) return;

    const totalSpent = completedItems.reduce((sum, item) => sum + (item.estimatedPrice || 0), 0);
    const sessionStartTime = items.reduce((earliest, item) =>
      item.addedAt && (!earliest || item.addedAt < earliest) ? item.addedAt : earliest,
      null as Date | null
    );

    if (!sessionStartTime) return;

    const newSession = {
      sessionId: currentSessionId,
      items: [...completedItems],
      startTime: sessionStartTime,
      endTime: new Date(),
      totalSpent
    };

    const updatedSessions = [...previousSessions, newSession];
    setPreviousSessions(updatedSessions);

    // Save to localStorage
    try {
      localStorage.setItem('shoppingListSessions', JSON.stringify(updatedSessions));
    } catch (error) {
      console.warn('Failed to save shopping sessions to localStorage:', error);
    }
  }, [items, currentSessionId, previousSessions]);

  // Save session when all items become completed
  useEffect(() => {
    const allItemsCompleted = items.length > 0 && items.every(item => item.checked);
    if (allItemsCompleted) {
      saveCurrentSession();
    }
  }, [items, saveCurrentSession]);

  // Hooks for offline functionality
  const isOnline = useOfflineStatus();
  const { addToQueue, processQueue } = useDataManagement();

  // Suggested items for quick adding
  const suggestedItems = [
    'Milk', 'Bread', 'Eggs', 'Cheese', 'Bananas', 'Apples', 'Chicken', 'Pasta', 
    'Rice', 'Tomatoes', 'Lettuce', 'Onions', 'Potatoes', 'Carrots', 'Butter', 'Yogurt'
  ];

  // Memoized expensive computations for sharing/exporting
  const uncheckedItemsText = useMemo(() => 
    items
      .filter(item => !item.checked)
      .map(item => `${item.item}${item.quantity && item.quantity !== '1' ? ` (${item.quantity})` : ''}`)
      .join('\n'),
    [items]
  );

  const shoppingListExportText = useMemo(() => 
    `Shopping List\n${'='.repeat(20)}\n\n${items
      .filter(item => !item.checked)
      .map(item => `□ ${item.item}${item.quantity && item.quantity !== '1' ? ` (${item.quantity})` : ''}`)
      .join('\n')}\n\nGenerated by Smart Pantry Chef`,
    [items]
  );

  const smsMessageText = useMemo(() => 
    `Shopping List:\n${uncheckedItemsText}\n\nSent from Smart Pantry Chef`,
    [uncheckedItemsText]
  );

  const addSuggestedItem = async (itemName: string) => {
    // Check if item already exists
    const exists = items.some(item => item.item.toLowerCase() === itemName.toLowerCase());
    if (exists) {
      alert(`${itemName} is already in your shopping list!`);
      return;
    }

    // Estimate price for the item
    const estimatedPrice = await estimateItemPrice(itemName, '1');

    setItems(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      item: itemName,
      category: inferCategoryFromItemName(itemName),
      checked: false,
      quantity: '1',
      source: 'suggested',
      addedAt: new Date(),
      estimatedPrice
    }]);
  };

  const addRecipeItem = async (itemName: string, requiredQuantity: string, recipeName: string) => {
    // Check if item already exists
    const existingItem = items.find(item => item.item.toLowerCase() === itemName.toLowerCase());
    if (existingItem) {
      // Update the existing item with recipe info if it doesn't already have it
      if (!existingItem.source || !existingItem.source.includes('recipe')) {
        setItems(prev => prev.map(item => 
          item.id === existingItem.id 
            ? { ...item, source: `recipe: ${recipeName} (${requiredQuantity})` }
            : item
        ));
      }
      return;
    }

    // Estimate price for the item
    const estimatedPrice = await estimateItemPrice(itemName, requiredQuantity);

    setItems(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      item: itemName,
      category: inferCategoryFromItemName(itemName),
      checked: false,
      quantity: requiredQuantity,
      source: `recipe: ${recipeName}`,
      addedAt: new Date(),
      estimatedPrice
    }]);
  };

  const toggleCheck = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const wasChecked = item.checked;
    const now = new Date();

    setItems(prev => prev.map(i => i.id === id ? {
      ...i,
      checked: !i.checked,
      completedAt: !i.checked ? now : undefined // Set completedAt when checking, clear when unchecking
    } : i));

    // Add to undo history if checking off
    if (!wasChecked) {
      setUndoHistory(prev => [...prev.slice(-4), { item: { ...item, checked: true }, timestamp: now }]);
    }

    // Offline queue for sync
    if (!isOnline) {
      addToQueue({
        type: 'update',
        collection: 'shoppingList',
        id,
        data: { checked: !wasChecked, completedAt: !wasChecked ? now : null }
      });
    }
  };

  const undoLastCheck = () => {
    if (undoHistory.length === 0) return;

    const lastAction = undoHistory[undoHistory.length - 1];
    setItems(prev => prev.map(i =>
      i.id === lastAction.item.id ? { ...i, checked: false } : i
    ));
    setUndoHistory(prev => prev.slice(0, -1));
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

  // Multi-selection functions
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedItems(new Set());
  };

  const toggleItemSelection = (id: string) => {
    if (!selectionMode) return;

    setSelectedItems(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return newSelected;
    });
  };

  const selectAllItems = () => {
    if (!selectionMode) return;
    setSelectedItems(new Set(items.map(item => item.id)));
  };

  const deselectAllItems = () => {
    setSelectedItems(new Set());
  };

  const deleteSelectedItems = () => {
    if (selectedItems.size === 0) return;
    setItems(prev => prev.filter(item => !selectedItems.has(item.id)));
    setSelectedItems(new Set());
    setSelectionMode(false);
  };

  const checkSelectedItems = () => {
    if (selectedItems.size === 0) return;
    const now = new Date();
    setItems(prev => prev.map(item =>
      selectedItems.has(item.id)
        ? { ...item, checked: true, completedAt: now }
        : item
    ));
    setSelectedItems(new Set());
    setSelectionMode(false);
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous validation errors
    setValidationErrors({});

    // Validate item name
    const itemValidation = validateItemName(newItem);
    if (!itemValidation.isValid) {
      setValidationErrors(prev => ({ ...prev, item: itemValidation.errors.join(', ') }));
      return;
    }

    // Validate quantity
    const quantityValidation = validateQuantity(newQty);
    if (!quantityValidation.isValid) {
      setValidationErrors(prev => ({ ...prev, quantity: quantityValidation.errors.join(', ') }));
      return;
    }

    // Estimate price for the item
    const estimatedPrice = await estimateItemPrice(newItem, newQty);

    const newShoppingItem: ShoppingItem = {
      id: Math.random().toString(36).substr(2, 9),
      item: newItem,
      category: inferCategoryFromItemName(newItem),
      checked: false,
      quantity: newUnit === 'count' ? newQty : `${newQty} ${newUnit}`,
      source: 'manual',
      addedAt: new Date(),
      estimatedPrice
    };

    setItems(prev => [...prev, newShoppingItem]);

    // Offline queue for sync
    if (!isOnline) {
      addToQueue({
        type: 'add',
        collection: 'shoppingList',
        data: newShoppingItem
      });
    }

    setNewItem('');
    setNewQty('1');
    setNewUnit('count');
    setIsAddModalOpen(false); // Close modal after adding
  };

  // Enhanced add item from QuickAdd component
  const handleQuickAdd = async (quickAddItem: { name: string; category?: string; quantity?: string; unit?: string }) => {
    const exists = items.some(item => item.item.toLowerCase() === quickAddItem.name.toLowerCase());
    if (exists) {
      alert(`${quickAddItem.name} is already in your shopping list!`);
      return;
    }

    // Estimate price for the item
    const estimatedPrice = await estimateItemPrice(quickAddItem.name, quickAddItem.quantity || '1');

    const newShoppingItem: ShoppingItem = {
      id: Math.random().toString(36).substr(2, 9),
      item: quickAddItem.name,
      category: quickAddItem.category || inferCategoryFromItemName(quickAddItem.name),
      checked: false,
      quantity: quickAddItem.quantity || '1',
      source: 'quick-add',
      addedAt: new Date(),
      estimatedPrice
    };

    setItems(prev => [...prev, newShoppingItem]);

    // Offline queue for sync
    if (!isOnline) {
      addToQueue({
        type: 'add',
        collection: 'shoppingList',
        data: newShoppingItem
      });
    }
  };

  // Handle smart suggestions
  const handleAddSuggestion = (suggestion: any) => {
    handleQuickAdd({
      name: suggestion.itemName,
      quantity: suggestion.estimatedQuantity,
      category: suggestion.category
    });
  };

  // Batch operations
  const handleBatchOperation = (category: string, operation: 'check' | 'uncheck') => {
    setItems(prev => prev.map(item =>
      item.category === category
        ? { ...item, checked: operation === 'check' }
        : item
    ));

    // Add to undo history for batch operations
    if (operation === 'check') {
      const checkedItems = items.filter(item => item.category === category && !item.checked);
      setUndoHistory(prev => [
        ...prev,
        ...checkedItems.map(item => ({ item: { ...item, checked: true }, timestamp: new Date() }))
      ].slice(-5)); // Keep last 5
    }
  };

  const closeModal = () => {
    setIsAddModalOpen(false);
    setNewItem('');
    setNewQty('1');
    setNewUnit('count');
    setValidationErrors({});
  };

  const handleCheckout = () => {
    const purchased = items.filter(i => i.checked);
    if (purchased.length === 0) return;

    // Set default purchased quantities for items that don't have them
    const updatedItems = purchased.map(item => {
      if (!item.purchasedQuantity) {
        // Try to parse the needed quantity, default to 1 count
        const neededQty = item.quantity ? parseFloat(item.quantity) : 1;
        return { ...item, purchasedQuantity: { amount: neededQty, unit: 'count' } };
      }
      return item;
    });

    if (confirm(`Move ${purchased.length} items to pantry?`)) {
        onMoveToPantry(updatedItems);

        // Clear undo history for checked items
        setUndoHistory(prev => prev.filter(action =>
          !purchased.some(item => item.id === action.item.id)
        ));

        setItems(prev => prev.filter(i => !i.checked));

        // Offline queue for sync
        if (!isOnline) {
          addToQueue({
            type: 'batch',
            collection: 'shoppingList',
            data: { action: 'checkout', items: updatedItems }
          });
        }
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(uncheckedItemsText).then(() => {
      alert('Shopping list copied to clipboard!');
    }).catch(err => {
      log.error('Failed to copy shopping list', { error: err }, 'ShoppingList');
      alert('Failed to copy to clipboard');
    });
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Shopping List',
          text: uncheckedItemsText
        });
      } catch (err) {
        log.debug('Share cancelled or failed', { error: err }, 'ShoppingList');
      }
    } else {
      // Fallback to clipboard
      handleCopyToClipboard();
    }
  };

  const handleExport = () => {
    const blob = new Blob([shoppingListExportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shopping-list.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShareViaSMS = () => {
    // Use sms: protocol to open default SMS app
    const smsUrl = `sms:?body=${encodeURIComponent(smsMessageText)}`;
    
    // Try to open SMS app
    window.open(smsUrl, '_blank');
    
    // Fallback: copy to clipboard if SMS app doesn't open
    setTimeout(() => {
      navigator.clipboard.writeText(smsMessageText).then(() => {
        alert('Shopping list copied to clipboard (SMS app may not be available)');
      }).catch(() => {
        alert('Unable to open SMS app. Shopping list has been copied to clipboard.');
      });
    }, 1000);
  };

  return (
    <div className="space-y-6 pb-24 max-w-2xl mx-auto animate-fade-in relative">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-serif font-bold text-theme-secondary">Shopping List</h2>
        <p className="text-theme-secondary opacity-60 text-sm mt-1">Items to purchase</p>
      </div>

      {/* Household Sharing */}
      {householdMembers.length > 0 && (
        <HouseholdShoppingShare
          householdMembers={householdMembers}
          recentActivity={householdActivity}
          currentUserId="current-user" // TODO: Get from auth
          onSendMessage={onHouseholdMessage}
        />
      )}

      {/* Quick Add Component */}
      <QuickAdd
        onAddItem={handleQuickAdd}
        onScanBarcode={async () => null} // TODO: Implement barcode scanning
        onVoiceInput={async () => null} // TODO: Implement voice input
        isOnline={isOnline}
        recentItems={items.map(i => i.item)}
        suggestedItems={suggestedItems}
        onAddSuggestedItem={addSuggestedItem}
        pantryItems={pantryItems}
        recentPurchases={recentPurchases}
        onAddSuggestion={handleAddSuggestion}
        onDismissSuggestion={(id) => {
          // TODO: Implement suggestion dismissal persistence
          log.debug('Dismiss suggestion:', { id }, 'ShoppingList');
        }}
      />

      {/* View Mode Toggle */}
      {items.length > 0 && (
        <div className="flex items-center justify-center gap-2 mb-4">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-[var(--accent-color)] text-white'
                : 'bg-theme-secondary text-theme-primary hover:bg-theme-primary'
            }`}
          >
            List View
          </button>
          <button
            onClick={() => setViewMode('organized')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'organized'
                ? 'bg-[var(--accent-color)] text-white'
                : 'bg-theme-secondary text-theme-primary hover:bg-theme-primary'
            }`}
          >
            Store Order
          </button>
        </div>
      )}

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
                  <div>
                    <input 
                      id="newItem"
                      name="newItem"
                      type="text"
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                      placeholder="Enter item name..."
                      className={`w-full bg-theme-secondary border rounded-lg px-4 py-3 text-theme-primary shadow-sm outline-none focus:border-[var(--accent-color)] ${validationErrors.item ? 'border-red-500' : 'border-theme'}`}
                      autoFocus
                    />
                    {validationErrors.item && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.item}</p>
                    )}
                  </div>
                  <QuantityUnitPicker
                    quantity={parseFloat(newQty) || 1}
                    unit={newUnit}
                    onQuantityChange={(qty) => setNewQty(qty.toString())}
                    onUnitChange={setNewUnit}
                    itemName={newItem}
                    showControls={true}
                    maxQuantity={999}
                  />
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
          <div className="flex gap-2 justify-between items-center">
              <button
                onClick={items.every(i => i.checked) ? deselectAll : selectAll}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all bg-theme-secondary text-theme-secondary hover:bg-[var(--accent-color)] hover:text-white"
              >
                  <Check className="w-4 h-4" /> 
                  {items.every(i => i.checked) ? 'Deselect All' : 'Select All'}
              </button>

              <button
                onClick={toggleSelectionMode}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  selectionMode
                    ? 'bg-blue-500 text-white'
                    : 'bg-theme-secondary text-theme-secondary hover:bg-blue-500 hover:text-white'
                }`}
              >
                  <Check className="w-4 h-4" />
                  {selectionMode ? 'Exit Selection' : 'Multi-Select'}
              </button>
              
              {undoHistory.length > 0 && (
                <button
                  onClick={undoLastCheck}
                  className="flex items-center gap-1 px-2 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600 transition-colors"
                  title={`Undo last check (${undoHistory.length} available)`}
                >
                  <X className="w-3 h-3" />
                  Undo ({undoHistory.length})
                </button>
              )}
              
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

      {/* Multi-selection controls */}
      {selectionMode && (
        <div className="flex gap-2 justify-between items-center bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-blue-700">
              {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={selectedItems.size === items.length ? deselectAllItems : selectAllItems}
              className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
            >
              {selectedItems.size === items.length ? 'Deselect All' : 'Select All'}
            </button>
            <button
              onClick={checkSelectedItems}
              disabled={selectedItems.size === 0}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                selectedItems.size > 0
                  ? 'text-green-600 hover:text-green-800 hover:bg-green-100'
                  : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              Check Selected
            </button>
            <button
              onClick={deleteSelectedItems}
              disabled={selectedItems.size === 0}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                selectedItems.size > 0
                  ? 'text-red-600 hover:text-red-800 hover:bg-red-100'
                  : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              Delete Selected
            </button>
            <button
              onClick={toggleSelectionMode}
              className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {isLoadingShoppingList ? (
          // Show skeleton loading items
          Array.from({ length: 5 }).map((_, index) => (
            <ShoppingListItemSkeleton key={`loading-${index}`} />
          ))
        ) : viewMode === 'organized' ? (
          // Organized by store layout
          <SmartShoppingListOrganizer
            items={items}
            onToggleCheck={selectionMode ? toggleItemSelection : toggleCheck}
            onRemove={remove}
            isSelected={selectionMode ? (id) => selectedItems.has(id) : undefined}
            onLongPress={selectionMode ? undefined : () => setSelectionMode(true)}
          />
        ) : (
          // Regular list view with enhanced items
          items.map((item) => (
            <EnhancedShoppingListItem
              key={item.id}
              item={item}
              onToggleCheck={selectionMode ? toggleItemSelection : toggleCheck}
              onRemove={remove}
              isOnline={isOnline}
              isSelected={selectionMode ? selectedItems.has(item.id) : undefined}
              onLongPress={selectionMode ? undefined : () => setSelectionMode(true)}
            />
          ))
        )}
        {items.length === 0 && !isLoadingShoppingList && (
             <div className="text-center py-12 opacity-60 flex flex-col items-center">
                <ShoppingBasket className="w-12 h-12 mb-4 text-theme-secondary/50" />
                <h3 className="text-lg font-semibold text-theme-primary mb-2">Shopping list is empty</h3>
                <p className="text-theme-secondary opacity-70 mb-4">Add items manually or get suggestions from recipes</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="px-4 py-2 bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-color)]/90 transition-colors flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add Items
                    </button>
                    <button 
                        onClick={() => setActiveTab(Tab.RECIPES)}
                        className="px-4 py-2 border border-theme rounded-lg hover:bg-theme-secondary/50 transition-colors"
                    >
                        Browse Recipes
                    </button>
                </div>
             </div>
        )}
      </div>

      {/* Batch Operations - Moved below the list */}
      {items.length > 0 && (
        <BatchOperations
          items={items}
          onBatchCheck={(itemIds) => {
            setItems(prev => prev.map(item =>
              itemIds.includes(item.id) ? { ...item, checked: true } : item
            ));
          }}
          onBatchUncheck={(itemIds) => {
            setItems(prev => prev.map(item =>
              itemIds.includes(item.id) ? { ...item, checked: false } : item
            ));
          }}
          onMoveToPantry={onMoveToPantry}
        />
      )}

      {/* Analytics Section */}
      {showAnalytics && items.length > 0 && (
        <ShoppingListAnalytics
          shoppingItems={items.map(item => ({
            id: item.id,
            name: item.item,
            quantity: parseFloat(item.quantity?.toString() || '1') || 1,
            unit: 'each', // Default unit, could be improved
            category: item.category,
            isCompleted: item.checked,
            estimatedPrice: item.estimatedPrice,
            addedAt: item.addedAt || new Date(),
            completedAt: item.completedAt
          }))}
          previousSessions={previousSessions.map(session => ({
            date: session.startTime,
            totalItems: session.items.length,
            completedItems: session.items.filter(item => item.checked).length,
            totalSpent: session.totalSpent,
            timeSpent: session.endTime
              ? Math.round((session.endTime.getTime() - session.startTime.getTime()) / (1000 * 60))
              : 0
          }))}
        />
      )}

      {/* Toggle Analytics Button */}
      {items.length > 0 && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="px-4 py-2 bg-theme-secondary text-theme-primary rounded-lg hover:bg-theme-primary transition-colors text-sm"
          >
            {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
          </button>
        </div>
      )}

      {/* Export/Share Buttons */}
      {items.length > 0 && (
        <div className="flex justify-center gap-2 mt-6 flex-wrap">
          <button
            onClick={handleCopyToClipboard}
            className="flex items-center gap-2 px-3 py-2 bg-theme-secondary text-theme-primary rounded-lg border border-theme hover:bg-theme-primary transition-colors text-sm"
            title="Copy to clipboard"
          >
            <Copy className="w-4 h-4" />
            Copy
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-3 py-2 bg-theme-secondary text-theme-primary rounded-lg border border-theme hover:bg-theme-primary transition-colors text-sm"
            title="Share shopping list"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
          <button
            onClick={handleShareViaSMS}
            className="flex items-center gap-2 px-3 py-2 bg-theme-secondary text-theme-primary rounded-lg border border-theme hover:bg-theme-primary transition-colors text-sm"
            title="Send via text message"
          >
            <MessageSquare className="w-4 h-4" />
            SMS
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 bg-theme-secondary text-theme-primary rounded-lg border border-theme hover:bg-theme-primary transition-colors text-sm"
            title="Download as text file"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      )}

    </div>
  );
};