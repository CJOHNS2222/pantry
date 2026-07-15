import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { ShoppingCart } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { ShoppingItem, User, Household, Settings, PantryItem } from '../../types';
import HapticService from '../../services/hapticService';
import { ShoppingListCacheService } from '../../services/shoppingListCacheService';
import { log } from '../../services/logService';
import { inferCategoryFromItemName, isHouseholdMember, cleanItemNameForShopping, parseQuantityAndUnit, consolidateShoppingList } from '../../utils/appUtils';
import { validateItemName, validateQuantity } from '../../src/utils/validation';

// Import new enhancement components
import { HouseholdShoppingShare } from '../household/HouseholdShoppingShare';
import { QuickAdd } from '../pantry/QuickAdd';
import { ShoppingListAnalytics } from './ShoppingListAnalytics';
import { AdMobBanner } from '../ui/AdMobBanner';
import { canShowAds } from '../../utils/appUtils';
import { ShoppingListViewModeToggle } from './ShoppingListViewModeToggle';
import { ShoppingListPurchaseModal } from './ShoppingListPurchaseModal';
import { ShoppingListAddItemModal } from './ShoppingListAddItemModal';
import { CheckoutExpiryModal } from './CheckoutExpiryModal';
import { ShoppingListItemsSection } from './ShoppingListItemsSection';
import { ShoppingListFooterActions } from './ShoppingListFooterActions';
import { ShoppingListActionBars } from './ShoppingListActionBars';
import { ShoppingListAddFab } from './ShoppingListAddFab';
import { RetailCheckoutModal } from './RetailCheckoutModal';
import { ShoppingListUndoBanners } from './ShoppingListUndoBanners';
import { getSmartUnits } from '../pantry/QuantityUnitPicker';

// Import hooks and services
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import { offlineQueue } from '../../services/offlineQueueService';
import { useAppActions } from '../../contexts/AppActionsContext';
import { useApp } from '../../contexts/AppContext';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import { groceryPriceService } from '../../services/groceryPriceService';
import AnalyticsService from '../../services/analyticsService';

// Firestore access is instrumented via DatabaseMonitoringService when needed

interface ShoppingListProps {
  items: ShoppingItem[];
  setItems: React.Dispatch<React.SetStateAction<ShoppingItem[]>>;
  onMoveToPantry: (items: ShoppingItem[]) => void;
  addShoppingListItem: (item: Omit<ShoppingItem, 'id'>) => void;
  user?: User;
  household?: Household | null;
  isLoadingShoppingList?: boolean;
  pantryItems?: PantryItem[];
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
  const { mealPlan } = useApp();

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

  // Auto-suggest unit based on item name
  useEffect(() => {
    if (newItem) {
      const smartUnits = getSmartUnits(newItem);
      if (smartUnits && smartUnits.length > 0) {
        setNewUnit(smartUnits[0]);
      }
    }
  }, [newItem]);

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
  const [consolidateList, setConsolidateList] = useState(true);

  const displayedItems = useMemo(() => {
    return consolidateList ? consolidateShoppingList(items) : items;
  }, [items, consolidateList]);

  // Pending deletes for undo-on-swipe: map of id -> { item, timerId }
  const pendingDeletes = React.useRef<Map<string, { item: ShoppingItem; timerId: ReturnType<typeof setTimeout> }>>(new Map());
  const [pendingDeleteCount, setPendingDeleteCount] = useState(0);;
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [purchaseTargetItem, setPurchaseTargetItem] = useState<ShoppingItem | null>(null);
  const [checkoutExpiryOpen, setCheckoutExpiryOpen] = useState(false);
  const [checkoutItems, setCheckoutItems] = useState<ShoppingItem[]>([]);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);

  const uncheckedItemsCount = useMemo(() => {
    return items.filter(item => !item.checked).length;
  }, [items]);

  // Android back-button registration for ShoppingList modals
  useAndroidBack(isAddModalOpen, () => setIsAddModalOpen(false));
  useAndroidBack(showAnalytics, () => setShowAnalytics(false));
  useAndroidBack(purchaseModalOpen, () => setPurchaseModalOpen(false));
  useAndroidBack(checkoutExpiryOpen, () => setCheckoutExpiryOpen(false));
  useAndroidBack(isCheckoutModalOpen, () => setIsCheckoutModalOpen(false));
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
  const [currentSessionId] = useState(() => `session_${crypto.randomUUID()}`);
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
        const slicedSessions = Array.isArray(parsed) ? parsed.slice(-20) : [];
        setPreviousSessions(slicedSessions.map((session: { sessionId: string; startTime: string; endTime?: string; totalSpent: number; items: Array<Record<string, unknown>> }) => ({
          ...session,
          startTime: new Date(session.startTime),
          endTime: session.endTime ? new Date(session.endTime) : undefined,
          items: session.items.map((item: Record<string, unknown>) => ({
            ...item,
            addedAt: item.addedAt ? new Date(item.addedAt as string) : undefined,
            completedAt: item.completedAt ? new Date(item.completedAt as string) : undefined,
          })) as unknown as ShoppingItem[]
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
    const completionTimes = completedItems
      .map(item => item.completedAt ? new Date(item.completedAt).getTime() : 0)
      .filter(t => t > 0)
      .sort((a, b) => a - b);

    const sessionStartTime = completionTimes.length > 0
      ? new Date(completionTimes[0])
      : new Date();

    const newSession = {
      sessionId: currentSessionId,
      items: [...completedItems],
      startTime: sessionStartTime,
      endTime: new Date(),
      totalSpent
    };

    const updatedSessions = [...previousSessions, newSession].slice(-20);
    setPreviousSessions(updatedSessions);

    // Save to localStorage (already pruned to 20)
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
  const addToQueue = (op: { type: 'add' | 'update' | 'delete' | 'batch'; collection: string; docId?: string; data: unknown }) => offlineQueue.enqueue(op as Parameters<typeof offlineQueue.enqueue>[0]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const processQueue = () => offlineQueue.processQueue();

  // Suggested items for quick adding — filter out what's already in the list
  const suggestedItems = useMemo(() => {
    const inShoppingList = new Set(items.map(i => i.item.toLowerCase()));
    const suggestionsSet = new Set<string>();

    const addSuggestion = (name: string) => {
      const trimmed = name.trim();
      if (trimmed && !inShoppingList.has(trimmed.toLowerCase())) {
        let found = false;
        for (const existing of suggestionsSet) {
          if (existing.toLowerCase() === trimmed.toLowerCase()) {
            found = true;
            break;
          }
        }
        if (!found) {
          suggestionsSet.add(trimmed);
        }
      }
    };

    // 1. Items consumed in the past 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    _pantryItems.forEach(pi => {
      if (pi.consumptionHistory && Array.isArray(pi.consumptionHistory)) {
        const consumedRecently = pi.consumptionHistory.some(dateStr => {
          try {
            return new Date(dateStr).getTime() > thirtyDaysAgo;
          } catch {
            return false;
          }
        });
        if (consumedRecently) {
          addSuggestion(pi.item);
        }
      }
    });

    // 2. Ingredients in weekly meal plan but missing from pantry
    const isIngredientInPantry = (ing: string) => {
      const name = ing
        .replace(/^[\d\/\s\.\-]+(cups?|tbsps?|tsps?|g|oz|lbs?|ml|pack(et)?s?|cans?|pieces?|cloves?|slices?|jars?|bottles?)?\s+/i, '')
        .toLowerCase()
        .trim();
      return _pantryItems.some(pi => {
        const piName = pi.item.toLowerCase();
        return piName.includes(name) || name.includes(piName);
      });
    };

    const getCleanIngredientName = (ing: string) => {
      const name = ing
        .replace(/^[\d\/\s\.\-]+(cups?|tbsps?|tsps?|g|oz|lbs?|ml|pack(et)?s?|cans?|pieces?|cloves?|slices?|jars?|bottles?)?\s+/i, '')
        .trim();
      if (!name) return '';
      return cleanItemNameForShopping(name);
    };

    if (Array.isArray(mealPlan)) {
      mealPlan.forEach(day => {
        const meals = [
          ...(day.breakfast || []),
          ...(day.lunch || []),
          ...(day.dinner || []),
          ...(day.meals || [])
        ];
        meals.forEach(meal => {
          if (meal.recipe && Array.isArray(meal.recipe.ingredients)) {
            meal.recipe.ingredients.forEach(ing => {
              if (!isIngredientInPantry(ing)) {
                const cleanName = getCleanIngredientName(ing);
                if (cleanName) {
                  addSuggestion(cleanName);
                }
              }
            });
          }
        });
      });
    }

    // 3. Previous shopping sessions
    if (Array.isArray(previousSessions)) {
      previousSessions.forEach(session => {
        if (Array.isArray(session.items)) {
          session.items.forEach(si => {
            addSuggestion(si.item);
          });
        }
      });
    }

    // 4. Static fallbacks
    const staticFallbacks = [
      'Milk', 'Bread', 'Eggs', 'Cheese', 'Bananas', 'Apples', 'Chicken', 'Pasta',
      'Rice', 'Tomatoes', 'Lettuce', 'Onions', 'Potatoes', 'Carrots', 'Butter', 'Yogurt',
      'Orange Juice', 'Coffee', 'Cereal', 'Garlic', 'Ground Beef', 'Salmon', 'Broccoli', 'Spinach'
    ];

    for (const item of staticFallbacks) {
      if (suggestionsSet.size >= 15) break;
      addSuggestion(item);
    }

    return Array.from(suggestionsSet);
  }, [items, _pantryItems, mealPlan, previousSessions]);

  // Memoized expensive computations for sharing/exporting
  const uncheckedItemsText = useMemo(() => {
    const formatCopyQuantity = (quantityStrOrNum: string | number | undefined, itemName: string): string => {
      const { amount, unit } = parseQuantityAndUnit(quantityStrOrNum, itemName);
      if (!amount || amount <= 0) return '';

      const cleanUnit = unit.toLowerCase();
      if (cleanUnit === 'pcs' || cleanUnit === 'pieces' || cleanUnit === 'count' || cleanUnit === 'each' || cleanUnit === 'units' || cleanUnit === 'unit') {
        const displayUnit = amount === 1 ? 'unit' : 'units';
        return `${amount} ${displayUnit}`;
      }

      return `${amount} ${unit}`;
    };

    return displayedItems
      .filter(item => !item.checked)
      .map(item => {
        const qtyStr = formatCopyQuantity(item.quantity, item.item);
        return qtyStr ? `• ${item.item} (${qtyStr})` : `• ${item.item}`;
      })
      .join('\n');
  }, [displayedItems]);

  const shoppingListExportText = useMemo(() => {
    const formatCopyQuantity = (quantityStrOrNum: string | number | undefined, itemName: string): string => {
      const { amount, unit } = parseQuantityAndUnit(quantityStrOrNum, itemName);
      if (!amount || amount <= 0) return '';

      const cleanUnit = unit.toLowerCase();
      if (cleanUnit === 'pcs' || cleanUnit === 'pieces' || cleanUnit === 'count' || cleanUnit === 'each' || cleanUnit === 'units' || cleanUnit === 'unit') {
        const displayUnit = amount === 1 ? 'unit' : 'units';
        return `${amount} ${displayUnit}`;
      }

      return `${amount} ${unit}`;
    };

    return `Shopping List\n${'='.repeat(20)}\n\n${displayedItems
      .filter(item => !item.checked)
      .map(item => {
        const qtyStr = formatCopyQuantity(item.quantity, item.item);
        return qtyStr ? `□ ${item.item} (${qtyStr})` : `□ ${item.item}`;
      })
      .join('\n')}\n\nGenerated by Stock & Spoon`;
  }, [displayedItems]);

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
      id: crypto.randomUUID(),
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
    const targetItem = displayedItems.find(i => i.id === id);
    if (!targetItem) return;

    // Track item completion/uncompletion
    if (!targetItem.checked) {
      // Item is being checked (completed)
      AnalyticsService.trackShoppingListComplete(1, items.length);
      HapticService.light();
    }

    // Simply toggle the checked state without opening purchase modal
    const now = new Date();
    if (consolidateList) {
      const name = targetItem.item.toLowerCase();
      const targetChecked = targetItem.checked;
      setItems(prev => prev.map(i => i.item.toLowerCase() === name && i.checked === targetChecked ? {
        ...i,
        checked: !targetChecked,
        completedAt: !targetChecked ? now : undefined
      } : i));
    } else {
      setItems(prev => prev.map(i => i.id === id ? {
        ...i,
        checked: !i.checked,
        completedAt: !i.checked ? now : undefined
      } : i));
    }
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
    const targetItem = displayedItems.find(i => i.id === id);
    if (!targetItem) return;

    if (consolidateList) {
      const name = targetItem.item.toLowerCase();
      const targetChecked = targetItem.checked;
      const matchingItems = items.filter(i => i.item.toLowerCase() === name && i.checked === targetChecked);

      matchingItems.forEach(matchingItem => {
        // Optimistically remove from UI immediately
        setItems(prev => prev.filter(i => i.id !== matchingItem.id));

        // Delay the actual cache removal so the user can undo within 5 seconds
        const timerId = setTimeout(async () => {
          pendingDeletes.current.delete(matchingItem.id);
          setPendingDeleteCount(pendingDeletes.current.size);

          const inHousehold = household?.id && user ? isHouseholdMember(household, user) : false;
          const householdId = inHousehold ? household?.id : undefined;
          const userId = inHousehold ? undefined : user?.id;
          try {
            await ShoppingListCacheService.removeItem(matchingItem.id, householdId, userId);
          } catch (error) {
            log.error('Failed to remove item from cache:', error);
          }
        }, 5000);

        pendingDeletes.current.set(matchingItem.id, { item: matchingItem, timerId });
      });
      setPendingDeleteCount(pendingDeletes.current.size);
    } else {
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
    }
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
    const targetItem = displayedItems.find(i => i.id === id);
    if (!targetItem) return;
    const targetId = targetItem.id;

    setItems(prev => prev.map(item => 
      item.id === targetId ? { ...item, quantity } : item
    ));
  };

  const handleUpdateItem = async (id: string, updates: Partial<ShoppingItem>) => {
    const targetItem = displayedItems.find(i => i.id === id);
    if (!targetItem) return;
    const targetId = targetItem.id;

    setItems(prev => prev.map(item =>
      item.id === targetId ? { ...item, ...updates } : item
    ));
    const inHousehold = household?.id && user ? isHouseholdMember(household, user) : false;
    const householdId = inHousehold ? household?.id : undefined;
    const userId = inHousehold ? undefined : user?.id;
    try {
      await ShoppingListCacheService.updateItem(targetId, updates, householdId, userId);
    } catch (_e) {
      // best-effort; local state already updated
    }
  };

  const deleteCheckedItems = async () => {
    const checkedItems = items.filter(i => i.checked);
    if (checkedItems.length === 0) return;

    HapticService.success();
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
      id: crypto.randomUUID(),
      item: newItem,
      category: inferCategoryFromItemName(newItem),
      checked: false,
      quantity: newUnit === 'count' || newUnit === 'pcs' || newUnit === 'pieces' || newUnit === 'each' ? newQty : `${newQty} ${newUnit}`,
      unit: newUnit,
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

    setCheckoutItems(itemsToMove);
    setCheckoutExpiryOpen(true);
  };

  const confirmCheckout = (updatedItems: ShoppingItem[]) => {
    HapticService.success();
    onMoveToPantry(updatedItems);

    // Clear undo history for the moved items
    setUndoHistory(prev => prev.filter(action =>
      !updatedItems.some(item => item.id === action.item.id)
    ));

    // Remove moved items from list
    const movedIds = new Set(updatedItems.map(i => i.id));
    setItems(prev => prev.filter(i => !movedIds.has(i.id)));

    // Offline queue for sync
    if (!isOnline) {
      addToQueue({
        type: 'batch',
        collection: 'shoppingList',
        data: { action: 'checkout', items: updatedItems }
      });
    }

    // Show toast with 8-second undo window
    const restoredItems = updatedItems.map(i => ({ ...i, checked: false, completedAt: undefined }));
    addToast(
      `${updatedItems.length} item${updatedItems.length > 1 ? 's' : ''} moved to pantry ✓`,
      'success',
      8000,
      'Undo',
      () => {
        setItems(prev => [...prev, ...restoredItems]);
      }
    );

    setCheckoutExpiryOpen(false);
    setCheckoutItems([]);
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

  const handleExport = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
        const filename = 'shopping-list.txt';
        const writeResult = await Filesystem.writeFile({
          path: filename,
          data: shoppingListExportText,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        });
        
        await Share.share({
          title: 'Export Shopping List',
          url: writeResult.uri,
          dialogTitle: 'Export Shopping List'
        });
      } catch (err) {
        log.error('Failed to export shopping list natively', { error: err }, 'ShoppingList');
        // Fallback to text share
        try {
          await Share.share({
            title: 'Export Shopping List',
            text: shoppingListExportText
          });
        } catch (shareErr) {
          log.error('Fallback native share failed', { error: shareErr }, 'ShoppingList');
        }
      }
    } else {
      // Standard browser download
      const blob = new Blob([shoppingListExportText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'shopping-list.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
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
      {/* Floating Shopping Cart Button (Repositioned to Bottom Right above Add FAB) */}
      {uncheckedItemsCount > 0 && (
        <button
          onClick={() => setIsCheckoutModalOpen(true)}
          className="fixed right-6 z-50 bg-[var(--accent-color)] text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center theme-transition"
          style={{ bottom: 'calc(7rem + 15px + 70px)' }}
          aria-label="Order ingredients online"
          title="Order online"
        >
          <ShoppingCart className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center shadow-md animate-pulse border-2 border-theme-primary">
            {uncheckedItemsCount}
          </span>
        </button>
      )}

      <div className="text-center mb-6">
        <h2 className="text-3xl font-serif font-bold text-theme-secondary">{intl.formatMessage({ id: 'shoppingList.title' })}</h2>
      </div>

      {/* Household Sharing */}
      {householdMembers.length > 0 && (
          <HouseholdShoppingShare
            householdMembers={householdMembers}
            recentActivity={householdActivity}
            currentUserId={user?.id || ''}
            onSendMessage={onHouseholdMessage}
          />
      )}

      {/* Live presence strip — "Sarah is shopping now 🛒" */}
      {(() => {
        const currentUserId = user?.id || '';
        const shoppingNow = householdMembers.filter(
          m => m.id !== currentUserId && m.currentActivity === 'shopping'
        );
        if (shoppingNow.length === 0) return null;
        return (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--accent-color)]/8 border border-[var(--accent-color)]/20 text-sm">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-theme-primary">
              {shoppingNow.map(m => m.name.split(' ')[0]).join(' & ')}{' '}
              {shoppingNow.length === 1 ? 'is' : 'are'} shopping now 🛒
            </span>
          </div>
        );
      })()}

      {/* Quick Add Component */}
      <QuickAdd
        suggestedItems={suggestedItems}
        onAddItem={addSuggestedItem}
      />

      <ShoppingListViewModeToggle
        show={items.length > 0}
        viewMode={viewMode}
        setViewMode={setViewMode}
        storeProfileNames={storeProfileNames}
        activeStoreProfile={activeStoreProfile}
        setActiveStoreProfile={setActiveStoreProfile}
        consolidateList={consolidateList}
        setConsolidateList={setConsolidateList}
      />

      <ShoppingListPurchaseModal
        purchaseModalOpen={purchaseModalOpen}
        purchaseTargetItem={purchaseTargetItem}
        purchaseQty={purchaseQty}
        setPurchaseQty={setPurchaseQty}
        purchaseUnit={purchaseUnit}
        setPurchaseUnit={setPurchaseUnit}
        purchaseExpires={purchaseExpires}
        setPurchaseExpires={setPurchaseExpires}
        closePurchaseModal={closePurchaseModal}
        onConfirmPurchase={confirmPurchaseForItem}
      />

      <ShoppingListAddFab onOpenAddModal={() => setIsAddModalOpen(true)} />

      <ShoppingListAddItemModal
        isOpen={isAddModalOpen}
        closeModal={closeModal}
        addItem={addItem}
        newItem={newItem}
        setNewItem={setNewItem}
        newQty={newQty}
        setNewQty={setNewQty}
        newUnit={newUnit}
        setNewUnit={setNewUnit}
        validationErrors={validationErrors}
      />

      <CheckoutExpiryModal
        isOpen={checkoutExpiryOpen}
        onClose={() => setCheckoutExpiryOpen(false)}
        items={checkoutItems}
        onConfirm={confirmCheckout}
      />

      <ShoppingListUndoBanners pendingDeleteCount={pendingDeleteCount} onUndoDelete={undoDelete} />

      <ShoppingListActionBars
        hasItems={items.length > 0}
        isLoadingShoppingList={isLoadingShoppingList}
        undoHistoryCount={undoHistory.length}
        hasCheckedItems={items.some(i => i.checked)}
        hasUncheckedItems={items.some(i => !i.checked)}
        checkedItemsCount={items.filter(i => i.checked).length}
        onUndoLastCheck={undoLastCheck}
        onCheckout={handleCheckout}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
        onDeleteCheckedItems={deleteCheckedItems}
      />

      {/* Multi-selection controls removed — using checked state only */}

      {/* Screen reader announcement for loading state */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {isLoadingShoppingList ? 'Loading shopping list…' : `${items.length} shopping item${items.length === 1 ? '' : 's'} loaded`}
      </div>

      <ShoppingListItemsSection
        isLoadingShoppingList={isLoadingShoppingList}
        viewMode={viewMode}
        items={displayedItems}
        activeStoreLayout={activeStoreLayout}
        householdMembers={householdMembers.map(m => ({ id: m.id, name: m.name, avatar: m.avatar }))}
        isOffline={!isOnline}
        showPriceData={settings?.shopping?.showPriceData ?? false}
        onToggleCheck={handleItemToggle}
        onRemove={remove}
        onQuantityChange={handleQuantityChange}
        onUpdateItem={handleUpdateItem}
        onOpenAddItems={() => setIsAddModalOpen(true)}
        onBrowseRecipes={() => log.debug('Navigate to recipes')}
      />

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

      <ShoppingListFooterActions
        hasItems={items.length > 0}
        showAnalytics={showAnalytics}
        onToggleAnalytics={() => setShowAnalytics(!showAnalytics)}
        onCopyToClipboard={handleCopyToClipboard}
        onShare={handleShare}
        onShareViaSMS={handleShareViaSMS}
        onExport={handleExport}
        onCheckoutOnline={() => setIsCheckoutModalOpen(true)}
      />

      <RetailCheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        items={items}
        onUpdateItem={(updatedItem) => {
          setItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
        }}
      />

      {canShowAdBanner && <AdMobBanner />}

    </div>
  );
};
