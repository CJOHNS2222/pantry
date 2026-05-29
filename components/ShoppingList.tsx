import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { ShoppingBasket, Archive, Plus, X, Share2, Copy, Download, MessageSquare, Calendar, Undo2, Store } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { ShoppingItem, User, Household, Settings } from '../types';
import { inferCategoryFromItemName, isHouseholdMember } from '../utils/appUtils';
import { log } from '../services/logService';
import { validateItemName, validateQuantity } from '@/src/utils/validation';
import { ShoppingListItemSkeleton } from './SkeletonLoader';
import HapticService from '../services/hapticService';
import { ShoppingListCacheService } from '../services/shoppingListCacheService';

// Import new enhancement components
import { EnhancedShoppingListItem } from './EnhancedShoppingListItem';
import { SmartShoppingListOrganizer } from './SmartShoppingListOrganizer';
import { BatchOperations } from './BatchOperations';
import { HouseholdShoppingShare } from './HouseholdShoppingShare';
import { QuickAdd } from './QuickAdd';
import { ShoppingListAnalytics } from './ShoppingListAnalytics';
import QuantityUnitPicker from './QuantityUnitPicker';
import VisualQuantitySelector from './VisualQuantitySelector';
import { AdMobBanner } from './AdMobBanner';
import { canShowAds } from '../utils/appUtils';

// Import hooks and services
import { useOfflineStatus } from '../hooks/useOfflineStatus';
import { useAuth } from '../hooks/useAuth';
import { offlineQueue } from '../services/offlineQueueService';
import { useAppActions } from '../contexts/AppActionsContext';
import { useAndroidBack } from '../hooks/useAndroidBack';
import { groceryPriceService } from '../services/groceryPriceService';
import AnalyticsService from '../services/analyticsService';

// Firestore access is instrumented via DatabaseMonitoringService when needed

interface ShoppingListProps {
  items: ShoppingItem[];
  setItems: React.Dispatch<React.SetStateAction<ShoppingItem[]>>;
  onMoveToPantry: (items: ShoppingItem[]) => void;
  addShoppingListItem: (item: Omit<ShoppingItem, 'id'>) => void;
  user?: User;
  household?: Household | null;
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
  settings?: Settings; // Settings object
}

export const ShoppingList: React.FC<ShoppingListProps> = ({
  items,
  setItems,
  onMoveToPantry,
  addShoppingListItem,
  user,
  household,
  isLoadingShoppingList = false,
  pantryItems: _pantryItems = [],
  recentPurchases: _recentPurchases = [],
  householdMembers = [],
  onHouseholdMessage,
  settings
}) => {
  const intl = useIntl();
  const [newItem, setNewItem] = React.useState('');
  const [canShowAdBanner, setCanShowAdBanner] = React.useState<boolean>(false);
  const { addToast } = useAppActions();

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
  const [newQty, setNewQty] = React.useState<string>('1');
  const [newUnit, setNewUnit] = React.useState<string>('count');
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [validationErrors, setValidationErrors] = React.useState<{item?: string, quantity?: string}>({});

  // New state for enhanced features
  const [viewMode, setViewMode] = useState<'list' | 'organized'>('list');

  // Active store profile picker — seeded from settings, persisted to localStorage
  const [activeStoreProfile, setActiveStoreProfileState] = useState<string>(() => {
    try {
      return localStorage.getItem('activeStoreProfile') ?? settings?.shopping?.activeStoreProfile ?? '__default__';
    } catch (_e) {
      return settings?.shopping?.activeStoreProfile ?? '__default__';
    }
  });
  const setActiveStoreProfile = (name: string) => {
    setActiveStoreProfileState(name);
    try { localStorage.setItem('activeStoreProfile', name); } catch (_e) { /* ignore */ }
  };

  const storeProfiles = settings?.shopping?.storeProfiles ?? {};
  const storeProfileNames = Object.keys(storeProfiles);
  const activeStoreLayout =
    activeStoreProfile !== '__default__' && storeProfiles[activeStoreProfile]
      ? storeProfiles[activeStoreProfile]
      : settings?.shopping?.storeLayout;
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [undoHistory, setUndoHistory] = useState<Array<{item: ShoppingItem, timestamp: Date}>>([])
  // Pending deletes for undo-on-swipe: map of id -> { item, timerId }
  const pendingDeletes = React.useRef<Map<string, { item: ShoppingItem; timerId: ReturnType<typeof setTimeout> }>>(new Map());
  const [pendingDeleteCount, setPendingDeleteCount] = useState(0);;
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [purchaseTargetItem, setPurchaseTargetItem] = useState<ShoppingItem | null>(null);

  // Android back-button registration for ShoppingList modals
  useAndroidBack(isAddModalOpen, () => setIsAddModalOpen(false));
  useAndroidBack(showAnalytics, () => setShowAnalytics(false));
  useAndroidBack(purchaseModalOpen, () => setPurchaseModalOpen(false));
  const [purchaseQty, setPurchaseQty] = useState<number>(1);
  const [purchaseUnit, setPurchaseUnit] = useState<string>('count');
  const [purchaseExpires, setPurchaseExpires] = useState<string | undefined>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [householdActivity, setHouseholdActivity] = useState<Array<{
    id: string;
    memberId: string;
    memberName: string;
    action: string;
    itemName?: string;
    timestamp: Date;
  }>>([]);

  // (selection model simplified) — rely on `checked` on items instead of separate selected state

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
        setPreviousSessions(parsed.map((session: { startTime: string; endTime?: string; totalSpent: number; items: Array<{ addedAt?: string; completedAt?: string; [key: string]: unknown }> }) => ({
          ...session,
          startTime: new Date(session.startTime),
          endTime: session.endTime ? new Date(session.endTime) : undefined,
          items: session.items.map((item: { addedAt?: string; completedAt?: string; [key: string]: unknown }) => ({
            ...item,
            addedAt: item.addedAt ? new Date(item.addedAt) : undefined,
            completedAt: item.completedAt ? new Date(item.completedAt) : undefined,
          }))
        })));
      } catch (error) {
        log.warn('Failed to load previous shopping sessions:', error);
      }
    }
  }, []);

  // Helper function to estimate price for an item
  const estimateItemPrice = async (itemName: string, quantity?: number | string): Promise<{
    price: number;
    priceData?: {
      averagePrice: number;
      minPrice: number;
      maxPrice: number;
      sampleSize: number;
      lastUpdated: Date;
      unit: string;
    }
  }> => {
    try {
      const priceData = await groceryPriceService.getIngredientPrice(itemName);
      if (!priceData) return { price: 0 };

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

      return {
        price: priceData.averagePrice * qty,
        priceData
      };
    } catch (error) {
      log.warn(`Failed to estimate price for ${itemName}:`, error);
      return { price: 0 };
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
      log.warn('Failed to save shopping sessions to localStorage:', error);
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
  const { isOnline } = useOfflineStatus();
  const { user: authUser } = useAuth();
  const addToQueue = (op: { type: 'add' | 'update' | 'delete' | 'batch'; collection: string; docId?: string; data: unknown }) => offlineQueue.enqueue(op as Parameters<typeof offlineQueue.enqueue>[0]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const processQueue = () => offlineQueue.processQueue();

  // Suggested items for quick adding — filter out what's already in the list
  const suggestedItems = useMemo(() => {
    const inList = new Set(items.map(i => i.item.toLowerCase()));
    return [
      'Milk', 'Bread', 'Eggs', 'Cheese', 'Bananas', 'Apples', 'Chicken', 'Pasta',
      'Rice', 'Tomatoes', 'Lettuce', 'Onions', 'Potatoes', 'Carrots', 'Butter', 'Yogurt',
      'Orange Juice', 'Coffee', 'Cereal', 'Garlic', 'Ground Beef', 'Salmon', 'Broccoli', 'Spinach'
    ].filter(name => !inList.has(name.toLowerCase()));
  }, [items]);

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
      .join('\n')}\n\nGenerated by Stock & Spoon`,
    [items]
  );

  const smsMessageText = useMemo(() => 
    `Shopping List:\n${uncheckedItemsText}\n\nSent from Stock & Spoon`,
    [uncheckedItemsText]
  );

  const addSuggestedItem = async (itemName: string) => {
    try {
      // Check if item already exists
      const exists = items.some(item => item.item.toLowerCase() === itemName.toLowerCase());
      if (exists) {
        addToast(intl.formatMessage({ id: 'shoppingList.alreadyInList' }, { name: itemName }), 'info');
        return;
      }

      // Estimate price for the item
      const { price: estimatedPrice, priceData } = await estimateItemPrice(itemName, '1');

      // Add directly to database to avoid sync read
      await addShoppingListItem({
        item: itemName,
        category: inferCategoryFromItemName(itemName),
        checked: false,
        quantity: '1',
        source: 'suggested',
        addedAt: new Date(),
        estimatedPrice,
        priceData
      });
    } catch (error) {
      log.error('Failed to add suggested item', { itemName, error }, 'ShoppingList');
      addToast(`Failed to add ${itemName}. Please try again.`, 'error');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    const { price: estimatedPrice, priceData } = await estimateItemPrice(itemName, requiredQuantity);

    setItems(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      item: itemName,
      category: inferCategoryFromItemName(itemName),
      checked: false,
      quantity: requiredQuantity,
      source: `recipe: ${recipeName}`,
      addedAt: new Date(),
      estimatedPrice,
      priceData
    }]);
  };

  const handleItemToggle = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    // Track item completion/uncompletion
    if (!item.checked) {
      // Item is being checked (completed)
      AnalyticsService.trackShoppingListComplete(1, items.length);
      HapticService.light();
    }

    // Simply toggle the checked state without opening purchase modal
    const now = new Date();
    setItems(prev => prev.map(i => i.id === id ? {
      ...i,
      checked: !i.checked,
      completedAt: !i.checked ? now : undefined
    } : i));
  };

  const confirmPurchaseForItem = (itemId: string) => {
    const now = new Date();
    setItems(prev => prev.map(i => i.id === itemId ? {
      ...i,
      checked: true,
      completedAt: now,
      purchasedQuantity: { amount: purchaseQty, unit: purchaseUnit },
      purchasedBatch: { amount: purchaseQty, unit: purchaseUnit, expires: purchaseExpires }
    } : i));

    // Add to undo history
    const original = items.find(it => it.id === itemId);
    if (original) setUndoHistory(prev => [...prev.slice(-4), { item: { ...original, checked: true }, timestamp: now }]);

    setPurchaseModalOpen(false);
    setPurchaseTargetItem(null);
  };

  const closePurchaseModal = () => {
    setPurchaseModalOpen(false);
    setPurchaseTargetItem(null);
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
    const targetItem = items.find(i => i.id === id);
    if (!targetItem) return;

    // Optimistically remove from UI immediately
    setItems(prev => prev.filter(i => i.id !== id));

    // Delay the actual cache removal so the user can undo within 5 seconds
    const timerId = setTimeout(async () => {
      pendingDeletes.current.delete(id);
      setPendingDeleteCount(pendingDeletes.current.size);

      const inHousehold = household?.id && user ? isHouseholdMember(household, user) : false;
      const householdId = inHousehold ? household?.id : undefined;
      const userId = inHousehold ? undefined : user?.id;
      try {
        await ShoppingListCacheService.removeItem(id, householdId, userId);
      } catch (error) {
        log.error('Failed to remove item from cache:', error);
      }
    }, 5000);

    pendingDeletes.current.set(id, { item: targetItem, timerId });
    setPendingDeleteCount(pendingDeletes.current.size);
  };

  const undoDelete = () => {
    // Restore the most recently deleted item
    const entries = Array.from(pendingDeletes.current.entries());
    if (entries.length === 0) return;
    // Pick the one whose timer was started last (highest timerId value is unreliable; just take last entry)
    const [id, { item: restoredItem, timerId }] = entries[entries.length - 1];
    clearTimeout(timerId);
    pendingDeletes.current.delete(id);
    setPendingDeleteCount(pendingDeletes.current.size);
    setItems(prev => [...prev, restoredItem]);
  };

  // Multi-selection functions

  const handleQuantityChange = (id: string, quantity: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, quantity } : item
    ));
  };

  const handleUpdateItem = async (id: string, updates: Partial<ShoppingItem>) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ));
    const inHousehold = household?.id && user ? isHouseholdMember(household, user) : false;
    const householdId = inHousehold ? household?.id : undefined;
    const userId = inHousehold ? undefined : user?.id;
    try {
      await ShoppingListCacheService.updateItem(id, updates, householdId, userId);
    } catch (_e) {
      // best-effort; local state already updated
    }
  };

  const deleteCheckedItems = async () => {
    const checkedItems = items.filter(i => i.checked);
    if (checkedItems.length === 0) return;

    const inHousehold = household?.id && user ? isHouseholdMember(household, user) : false;
    const householdId = inHousehold ? household?.id : undefined;
    const userId = inHousehold ? undefined : user?.id;

    // Remove from cache
    try {
      await ShoppingListCacheService.removeItemsFromCache(checkedItems.map(i => i.id), householdId, userId);
      // Remove checked items from local state
      const checkedIds = new Set(checkedItems.map(i => i.id));
      setItems(prev => prev.filter(i => !checkedIds.has(i.id)));
    } catch (error) {
      log.error('Failed to delete checked items from cache:', error);
    }
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
    const { price: estimatedPrice, priceData } = await estimateItemPrice(newItem, newQty);

    const newShoppingItem: ShoppingItem = {
      id: Math.random().toString(36).substr(2, 9),
      item: newItem,
      category: inferCategoryFromItemName(newItem),
      checked: false,
      quantity: newUnit === 'count' ? newQty : `${newQty} ${newUnit}`,
      source: 'manual',
      addedAt: new Date(),
      estimatedPrice,
      priceData
    };

    setItems(prev => [...prev, newShoppingItem]);

    // Track shopping list item addition
    AnalyticsService.trackShoppingListAdd(newItem, newShoppingItem.category);

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
  // Batch operations
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    const itemsToMove = items.filter(i => i.checked);

    if (itemsToMove.length === 0) return;

    // Set default purchased quantities for items that don't have them
    const updatedItems = itemsToMove.map(item => {
      // Prefer purchasedBatch (from modal) if present, otherwise fall back to purchasedQuantity or estimate
      if (item.purchasedBatch) {
        return { ...item, purchasedQuantity: { amount: item.purchasedBatch.amount, unit: item.purchasedBatch.unit || 'count' } };
      }

      if (!item.purchasedQuantity) {
        const neededQty = item.quantity ? parseFloat(item.quantity as string) : 1;
        return { ...item, purchasedQuantity: { amount: neededQty, unit: 'count' } };
      }
      return item;
    });

    onMoveToPantry(updatedItems);
    addToast(`${itemsToMove.length} item${itemsToMove.length > 1 ? 's' : ''} moved to pantry ✓`, 'success');

    // Clear undo history for the moved items
    setUndoHistory(prev => prev.filter(action =>
      !itemsToMove.some(item => item.id === action.item.id)
    ));

    // Remove moved items from list
    const movedIds = new Set(itemsToMove.map(i => i.id));
    setItems(prev => prev.filter(i => !movedIds.has(i.id)));

    // Offline queue for sync
    if (!isOnline) {
      addToQueue({
        type: 'batch',
        collection: 'shoppingList',
        data: { action: 'checkout', items: updatedItems }
      });
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(uncheckedItemsText).then(() => {
      addToast(intl.formatMessage({ id: 'shoppingList.copiedToClipboard' }), 'success');
    }).catch(err => {
      log.error('Failed to copy shopping list', { error: err }, 'ShoppingList');
      addToast('Failed to copy to clipboard', 'error');
    });
  };

  const handleShare = async () => {
    const shareTitle = intl.formatMessage({ id: 'shoppingList.shareTitle' });
    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({ title: shareTitle, text: uncheckedItemsText });
      } catch (err) {
        log.debug('Share cancelled or failed', { error: err }, 'ShoppingList');
      }
    } else if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: uncheckedItemsText });
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
        addToast(intl.formatMessage({ id: 'shoppingList.smsFallback' }), 'info');
      }).catch((error) => {
        log.error('Failed to copy SMS message to clipboard', { error }, 'ShoppingList');
        addToast(intl.formatMessage({ id: 'shoppingList.smsUnavailable' }), 'error');
      });
    }, 1000);
  };

  return (
    <div className="space-y-6 pb-24 max-w-2xl mx-auto animate-fade-in relative">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-serif font-bold text-theme-secondary">{intl.formatMessage({ id: 'shoppingList.title' })}</h2>
      </div>

      {/* Household Sharing */}
      {householdMembers.length > 0 && (
          <HouseholdShoppingShare
            householdMembers={householdMembers}
            recentActivity={householdActivity}
            currentUserId={authUser?.id || user?.id || ''}
            onSendMessage={onHouseholdMessage}
          />
      )}

      {/* Quick Add Component */}
      <QuickAdd
        suggestedItems={suggestedItems}
        onAddItem={addSuggestedItem}
      />

      {/* View Mode Toggle */}
      {items.length > 0 && (
        <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
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
          {/* Store profile picker — only when multiple store profiles exist */}
          {storeProfileNames.length > 0 && (
            <div className="relative">
              <select
                value={activeStoreProfile}
                onChange={(e) => setActiveStoreProfile(e.target.value)}
                className="flex items-center gap-1 pl-8 pr-3 py-2 rounded-lg text-sm font-medium bg-theme-secondary text-theme-primary border border-theme hover:border-[var(--accent-color)] transition-colors appearance-none cursor-pointer"
                title="Switch store profile"
              >
                <option value="__default__">Default layout</option>
                {storeProfileNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <Store className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-secondary pointer-events-none" />
            </div>
          )}
        </div>
      )}

      {/* Purchase modal when checking an item */}
      {purchaseModalOpen && purchaseTargetItem && (
        <div className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-theme-primary rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold mb-3">Add purchase for "{purchaseTargetItem.item}"</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-theme-secondary">{intl.formatMessage({ id: 'shoppingList.quantityPurchased' })}</label>
                <div className="mt-2">
                  <VisualQuantitySelector
                    value={purchaseQty}
                    onChange={(v) => setPurchaseQty(v)}
                    itemName={purchaseTargetItem.item}
                    unit={purchaseUnit}
                    step={0.25}
                    minValue={0.25}
                    showTypicalAmounts={false}
                    className="w-full"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-theme-secondary">{intl.formatMessage({ id: 'shoppingList.unit' })}</label>
                <select value={purchaseUnit} onChange={(e) => setPurchaseUnit(e.target.value)} className="w-full mt-1 p-2 rounded border text-black">
                  <option value="count">count</option>
                  <option value="lb">lb</option>
                  <option value="oz">oz</option>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="pack">pack</option>
                  <option value="bag">bag</option>
                  <option value="bunch">bunch</option>
                  <option value="dozen">dozen</option>
                  <option value="can">can</option>
                  <option value="piece">piece</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-theme-secondary">Expiration date (optional)</label>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => document.getElementById('purchase-expires')?.click()}
                    className="p-2 bg-theme-secondary rounded-md hover:bg-theme-primary transition-colors"
                    aria-label="Pick expiration date"
                  >
                    <Calendar className="w-5 h-5 text-theme-primary" />
                  </button>
                  <input
                    id="purchase-expires"
                    type="date"
                    value={purchaseExpires || ''}
                    onChange={(e) => setPurchaseExpires(e.target.value || undefined)}
                    className="p-2 rounded border text-black w-36"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <button onClick={closePurchaseModal} className="px-4 py-2 rounded bg-theme-secondary">Cancel</button>
              <button onClick={() => confirmPurchaseForItem(purchaseTargetItem.id)} className="px-4 py-2 rounded bg-[var(--accent-color)] text-white">Confirm</button>
            </div>
          </div>
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-theme-primary rounded-t-3xl max-w-md w-full modal-safe-h overflow-y-auto shadow-xl animate-slide-up">
            <div className="p-6 pb-2.5">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-theme-secondary">{intl.formatMessage({ id: 'shoppingList.addToList' })}</h3>
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
                      <p className="text-red-500 text-xs mt-1" aria-live="polite">{validationErrors.item}</p>
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

      {/* Undo delete banner — shown for 5 seconds after any swipe-to-delete */}
      {pendingDeleteCount > 0 && (
        <div className="flex items-center justify-between bg-gray-800 text-white rounded-lg px-3 py-2 text-sm shadow-lg animate-fade-in">
          <span>Item deleted</span>
          <button
            onClick={undoDelete}
            className="flex items-center gap-1 ml-4 px-2 py-1 bg-white text-gray-800 rounded text-xs font-bold hover:bg-gray-100 transition-colors"
          >
            <Undo2 className="w-3 h-3" /> Undo
          </button>
        </div>
      )}

      {items.length > 0 && (
          <div className="flex gap-2 justify-between items-center">
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

              <div className="flex gap-2">
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
          </div>
      )}

      {/* Multi-selection controls removed — using checked state only */}

      {/* Batch Operations - Quick Actions Only */}
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
          onDeleteSelected={async (itemIds) => {
            const inHousehold = household?.id && user ? isHouseholdMember(household, user) : false;
            const householdId = inHousehold ? household?.id : undefined;
            const userId = inHousehold ? undefined : user?.id;

            try {
              await ShoppingListCacheService.removeItemsFromCache(itemIds, householdId, userId);
              setItems(prev => prev.filter(item => !itemIds.includes(item.id)));
            } catch (error) {
              log.error('Failed to delete selected items from cache:', error);
            }
          }}
        />
      )}

      {/* Screen reader announcement for loading state */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {isLoadingShoppingList ? 'Loading shopping list…' : `${items.length} shopping item${items.length === 1 ? '' : 's'} loaded`}
      </div>

      {/* Mark-all / Clear-purchased action bar */}
      {!isLoadingShoppingList && items.length > 0 && (
        <div className="flex items-center justify-between gap-2 mb-1">
          {items.some(i => !i.checked) ? (
            <button
              onClick={selectAll}
              className="text-xs font-medium text-[var(--accent-color)] hover:opacity-80 transition-opacity py-1 px-2 rounded-md hover:bg-[var(--accent-color)]/10"
            >
              Mark all purchased
            </button>
          ) : (
            <button
              onClick={deselectAll}
              className="text-xs font-medium text-theme-secondary hover:opacity-80 transition-opacity py-1 px-2 rounded-md hover:bg-theme-secondary/50"
            >
              Unmark all
            </button>
          )}
          {items.some(i => i.checked) && (
            <button
              onClick={deleteCheckedItems}
              className="text-xs font-medium text-red-500 hover:opacity-80 transition-opacity py-1 px-2 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Clear purchased ({items.filter(i => i.checked).length})
            </button>
          )}
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
            onToggleCheck={handleItemToggle}
            onRemove={remove}
            onQuantityChange={handleQuantityChange}
            onUpdateItem={handleUpdateItem}
            householdMembers={householdMembers.map(m => ({ id: m.id, name: m.name, avatar: m.avatar }))}
            isSelected={(id) => items.some(it => it.id === id && it.checked)}
            onLongPress={undefined}
            storeLayout={activeStoreLayout}
          />
        ) : (
          // Regular list view with enhanced items
          items.map((item) => (
            <EnhancedShoppingListItem
              key={item.id}
              item={item}
              onToggleCheck={handleItemToggle}
              onRemove={remove}
              onQuantityChange={handleQuantityChange}
              onUpdateItem={handleUpdateItem}
              householdMembers={householdMembers.map(m => ({ id: m.id, name: m.name, avatar: m.avatar }))}
              isOffline={!isOnline}
              isSelected={item.checked}
              onLongPress={undefined}
              showPriceData={settings?.shopping?.showPriceData ?? false}
            />
          ))
        )}
        {items.length === 0 && !isLoadingShoppingList && (
             <div className="text-center py-12 opacity-60 flex flex-col items-center">
                <ShoppingBasket className="w-12 h-12 mb-4 text-theme-secondary/50" />
                <h3 className="text-lg font-semibold text-theme-primary mb-2">{intl.formatMessage({ id: 'shoppingList.empty' })}</h3>
                <p className="text-theme-secondary opacity-70 mb-4">{intl.formatMessage({ id: 'shoppingList.addItems' })}</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="px-4 py-2 bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-color)]/90 transition-colors flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add Items
                    </button>
                    <button 
                      onClick={() => log.debug('Navigate to recipes')}
                      className="px-4 py-2 border border-theme rounded-lg hover:bg-theme-secondary/50 transition-colors"
                    >
                      Browse Recipes
                    </button>
                </div>
             </div>
        )}
      </div>

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

      {canShowAdBanner && <AdMobBanner />}

      {/* Undo banner for swipe-to-delete */}
      {pendingDeleteCount > 0 && (
        <div className="fixed bottom-20 left-0 right-0 flex justify-center px-4 z-50 pointer-events-none">
          <div className="bg-theme-secondary border border-theme shadow-lg rounded-xl px-4 py-3 flex items-center gap-3 pointer-events-auto">
            <span className="text-sm text-theme-primary">
              {pendingDeleteCount === 1 ? '1 item removed' : `${pendingDeleteCount} items removed`}
            </span>
            <button
              onClick={undoDelete}
              className="text-[var(--accent-color)] font-semibold text-sm flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              <Undo2 className="w-4 h-4" />
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};