import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import DatabaseMonitoringService from './services/databaseMonitoringService';
import { Login } from './components/Login';
import { HouseholdManager } from './components/Household';
import { HouseholdInviteModal } from './components/HouseholdInviteModal';
import { ModernOnboardingFlow } from './components/ModernOnboardingFlow';
import ErrorBoundary from './components/ErrorBoundary';
import { AppHeader } from './components/layout/AppHeader';
import { AppNavigation } from './components/layout/AppNavigation';
import { MainContent } from './components/layout/MainContent';
import { User, PantryItem, StructuredRecipe, Household, ShoppingItem, RecipeSearchResult, UserProfile, Batch } from './types';
import { Tab } from './types/app';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { useSettings } from './hooks/useSettings';
import { useToasts } from './hooks/useToasts';
import { useDataManagement } from './hooks/useDataManagement';
import RiskAssessmentQuestionnaire from './components/RiskAssessmentQuestionnaire';
import LeftoversHotZone from './components/LeftoversHotZone';
import { useHouseholdActivity } from './hooks/useHouseholdActivity';
import { useOfflineStatus } from './hooks/useOfflineStatus';
import AnalyticsService from './services/analyticsService';

import { isHouseholdMember, inferCategoryFromItemName, inferStorageLocationFromItemName, parseIngredientForShoppingList, getItemImage, fetchExternalItemImage } from './utils/appUtils';
import { getQuantityAmount } from './utils/quantityUtils';
import { NotificationBanner } from './components/NotificationBanner';
import { NotificationService, NotificationItem, NotificationSettings } from './services/notificationService';
import { markNotificationRead, deleteNotification, snoozeNotificationInCache, updateNotificationInCache } from './services/notificationsService';
import { log } from './services/logService';
import { pushNotificationService } from './services/pushNotificationService';
import { HouseholdActivityService } from './services/householdActivityService';
import { App as CapacitorApp } from '@capacitor/app';
import { PluginListenerHandle } from '@capacitor/core';
import { AppProvider } from './contexts/AppContext';
import { AppActionsProvider } from './contexts/AppActionsContext';
import SafeAreaService from './services/safeAreaService';
import { GlobalUpdatePrompt } from './components/GlobalUpdatePrompt';
import { WhatsNewModal } from './components/WhatsNewModal';
import { FeatureDiscoveryManager } from './components/FeatureDiscovery';
import { ContextualTutorial, useContextualTips } from './components/ContextualTutorial';
import { joinHousehold } from './services/householdService';
import { setAppContext, trackNavigation, trackShoppingListAction } from './services/sentryService';
import remoteConfig from './services/remoteConfigService';
import { useIsAdmin } from './hooks/useIsAdmin';
import PerformanceMonitoringService from './services/performanceMonitoringService';
import HapticService from './services/hapticService';
import { ShoppingListCacheService } from './services/shoppingListCacheService';
import { MealPlanCacheService } from './services/mealPlanCacheService';
import { RecipesCacheService } from './services/recipesCacheService';
import { groceryPriceService } from './services/groceryPriceService';
import { PriceDataCacheService } from './services/priceDataCacheService'; // Import the service
import ExpiredItemsModal from './components/ExpiredItemsModal';
import ExpiredItemsLaunchSheet, { getExpiredLaunchEnabled } from './components/ExpiredItemsLaunchSheet';
import ItemDetailModal from './components/ItemDetailModal';
import { InventoryCacheService } from './services/inventoryCacheService';
import { recordMilestone } from './services/onboardingMilestoneService';
import { useIntl } from 'react-intl';
import { useAndroidBack, closeTopAndroidModal } from './hooks/useAndroidBack';
import { useKeyboard } from './hooks/useKeyboard';

// Lazy load monitoring components
const DatabaseAnalytics = React.lazy(() => import('./components/DatabaseAnalytics').then(module => ({ default: module.default })));

// Loading component for lazy-loaded components
const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center py-4">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--accent-color)]"></div>
  </div>
);



const App: React.FC = () => {
  const intl = useIntl();
  const [activeTab, setActiveTab] = useState<Tab>(Tab.PANTRY); // Default to pantry
  const prevActiveTabRef = useRef<Tab>(activeTab);
  // Stack of previously-visited tabs used by the hardware back button to navigate backwards.
  const tabHistoryRef = useRef<Tab[]>([]);
  const { tips: contextualTips, addTip: addContextualTip, dismissTip: dismissContextualTip } = useContextualTips();
  // Track which tabs the user has already visited this session (for contextual tips)
  const visitedTabsRef = useRef<Set<Tab>>(new Set<Tab>());
  const [persistedRecipeResult, setPersistedRecipeResult] = useState<RecipeSearchResult | null>(null);
  const [initialSearchQuery, setInitialSearchQuery] = useState<string>('');
  const isKeyboardVisible = useKeyboard();

  // Custom tab switching function that resets scroll position
  const switchTab = (tab: Tab) => {
    PerformanceMonitoringService.mark(`tab_switch_start_${tab}`);
    
    const tabNames: Record<Tab, string> = {
      [Tab.PANTRY]: 'pantry',
      [Tab.PANTRY_CACHE_TEST]: 'pantry_cache_test',
      [Tab.SHOPPING]: 'shopping',
      [Tab.MEALS]: 'meals',
      [Tab.RECIPES]: 'recipes',
      [Tab.SETTINGS]: 'settings',
      [Tab.COMMUNITY]: 'community',
      [Tab.ANALYTICS]: 'analytics'
    } as Record<Tab, string>;
    
    trackNavigation(tabNames[activeTab] || 'unknown', tabNames[tab] || 'unknown');
    HapticService.light();
    // Record the current tab in the back-navigation history before switching.
    // Keep a cap of 20 entries so it never grows unbounded.
    tabHistoryRef.current = [...tabHistoryRef.current.slice(-19), activeTab];
    setActiveTab(tab);
    window.scrollTo(0, 0);
    
    PerformanceMonitoringService.mark(`tab_switch_end_${tab}`);
    PerformanceMonitoringService.measure(`tab_switch_${tab}`, `tab_switch_start_${tab}`, `tab_switch_end_${tab}`);
  };

  // Feature discovery cards — shown once per featureId via localStorage gate,
  // and only after the user has reached the associated behaviour milestone to
  // avoid cognitive overload right after sign-up (audit item #18).
  const featureDiscoveries = useMemo(() => [
    {
      featureId: 'ai-scan',
      title: 'AI-Powered Pantry Scan',
      description: 'Tap the camera button to instantly identify and add multiple items to your pantry — quantities and expiry dates included.',
      position: 'bottom-right' as const,
      actionLabel: 'Open Pantry',
      onAction: () => setActiveTab(Tab.PANTRY),
      autoHideDelay: 10000,
      // Show right after onboarding — no pantry items required yet
      requiredMilestone: 'onboarding-completed' as const,
    },
    {
      featureId: 'smart-recipe-search',
      title: 'Smart Recipe Search',
      description: 'Search by ingredient or cuisine — or let AI suggest meals based on what\'s already in your pantry.',
      position: 'bottom-right' as const,
      actionLabel: 'Find Recipes',
      onAction: () => setActiveTab(Tab.RECIPES),
      autoHideDelay: 10000,
      // Only relevant once the user has pantry items to search against
      requiredMilestone: 'first-pantry-item' as const,
    },
    {
      featureId: 'leftover-tracker',
      title: 'Track Your Leftovers',
      description: 'Log leftovers with a tap and get reminders before they expire — cut food waste without any effort.',
      position: 'bottom-right' as const,
      actionLabel: 'Add a Leftover',
      onAction: () => setActiveTab(Tab.PANTRY),
      autoHideDelay: 10000,
      // Surfaces naturally once the user is actively managing their pantry
      requiredMilestone: 'first-pantry-item' as const,
    },
    {
      featureId: 'meal-planner',
      title: 'Weekly Meal Planner',
      description: 'Plan meals for the whole week and auto-generate a shopping list for any missing ingredients.',
      position: 'bottom-right' as const,
      actionLabel: 'Plan Meals',
      onAction: () => setActiveTab(Tab.MEALS),
      autoHideDelay: 10000,
      // Most useful once the user is tracking their shopping
      requiredMilestone: 'first-shopping-item' as const,
    },
  ], [setActiveTab]);

  // UI States
  const [showHousehold, setShowHousehold] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showHouseholdInviteModal, setShowHouseholdInviteModal] = useState(false);
  const [showExpiredItemsModal, setShowExpiredItemsModal] = useState(false);
  const [expiredItemsModalSpecificItems, setExpiredItemsModalSpecificItems] = useState<PantryItem[] | undefined>(undefined);
  const [showExpiredLaunchSheet, setShowExpiredLaunchSheet] = useState(false);
  const [expiredLaunchItems, setExpiredLaunchItems] = useState<PantryItem[]>([]);
  const hasShownExpiredLaunchRef = useRef(false);
  const [notificationViewItem, setNotificationViewItem] = useState<{ item: PantryItem; index: number } | null>(null);
  const [showAddToPlanDialog, setShowAddToPlanDialog] = useState(false);
  const [pendingRecipeForPlan, setPendingRecipeForPlan] = useState<StructuredRecipe | null>(null);
  const [selectedDayForPlan, setSelectedDayForPlan] = useState<number | null>(null);
  const [selectedMealForPlan, setSelectedMealForPlan] = useState<'breakfast' | 'lunch' | 'dinner' | null>(null);
  const [householdInvites, setHouseholdInvites] = useState<NotificationItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    enabled: true,
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00'
    },
    types: {
      expiration: 'day_before',
      recipe_suggestion: true,
      household_activity: true,
      shopping_reminder: true,
      system: true,
      allergy_alert: true,
      household_invite: true,
      expired_items_check: true
    }
  });

  const backButtonListenerRef = useRef<PluginListenerHandle | null>(null);
  const appUrlOpenListenerRef = useRef<PluginListenerHandle | null>(null);

  const { user, setUser, handleLogout, isAuthReady } = useAuth(); // Use isAuthReady
  const { settings, setSettings } = useSettings();
  const { addToast, toasts, setToasts } = useToasts();
  const { syncStatus, syncNow, updateSyncStatus } = useOfflineStatus();
  const { isAdmin } = useIsAdmin(user?.id);

  // Register all App-level modals on the shared LIFO back-button stack so every
  // modal (App-level and sub-component) is handled through the same mechanism.
  useAndroidBack(showOnboarding, () => setShowOnboarding(false));
  useAndroidBack(showAddToPlanDialog, () => setShowAddToPlanDialog(false));
  useAndroidBack(notificationViewItem !== null, () => setNotificationViewItem(null));
  useAndroidBack(showNotificationsModal, () => setShowNotificationsModal(false));
  useAndroidBack(showHouseholdInviteModal, () => setShowHouseholdInviteModal(false));
  useAndroidBack(showExpiredItemsModal, () => setShowExpiredItemsModal(false));
  useAndroidBack(showExpiredLaunchSheet, () => setShowExpiredLaunchSheet(false));
  useAndroidBack(showHousehold, () => setShowHousehold(false));
  const maintenanceInfo = remoteConfig.getMaintenanceInfo();
  const announcementInfo = remoteConfig.getAnnouncementInfo();

  // Apply theme to document
  useTheme(settings.theme);

  // Load price data once auth is ready and we have a user
  useEffect(() => {
    if (isAuthReady && user) {
      log.debug("Auth is ready and user is logged in, loading price data...");
      PriceDataCacheService.loadPriceData();
    }
  }, [isAuthReady, user]);

  // Load notification settings from user profile
  useEffect(() => {
    // Some older user profile shapes may not include notificationSettings.
    const ns = (user as User & { profile?: UserProfile & { notificationSettings?: NotificationSettings } })?.profile?.notificationSettings;
    if (ns) setNotificationSettings(ns as NotificationSettings);
  }, [user]);

  // Contextual tutorial tips — shown once per tab on first visit (globally gated via localStorage)
  useEffect(() => {
    if (!user) return;
    if (visitedTabsRef.current.has(activeTab)) return;
    visitedTabsRef.current.add(activeTab);

    const tipsByTab: Partial<Record<Tab, Parameters<typeof addContextualTip>[0]>> = {
      [Tab.PANTRY]: {
        id: 'tip-pantry-scan',
        title: 'Scan Your Pantry',
        description: 'Tap the camera button in the top bar to AI-scan multiple items at once — no barcode needed.',
        position: 'bottom',
        autoHideDelay: 10000,
      },
      [Tab.SHOPPING]: {
        id: 'tip-shopping-recipe',
        title: 'Add from Recipes',
        description: 'Open any recipe and tap "Add to Shopping List" to automatically add missing ingredients.',
        position: 'bottom',
        autoHideDelay: 10000,
      },
      [Tab.RECIPES]: {
        id: 'tip-recipes-pantry',
        title: 'Recipes from Your Pantry',
        description: 'Look for the "Can Make" badge — these recipes use ingredients you already have at home.',
        position: 'bottom',
        autoHideDelay: 10000,
      },
      [Tab.MEALS]: {
        id: 'tip-meals-plan',
        title: 'Build Your Meal Plan',
        description: 'Save recipes you like, then tap any day on the calendar to assign them to your meal plan.',
        position: 'bottom',
        autoHideDelay: 10000,
      },
    };

    const tip = tipsByTab[activeTab];
    if (tip) addContextualTip(tip);
    // addContextualTip is stable within a render cycle; visitedTabsRef prevents repeat calls
  }, [activeTab, user]);

  // Function to add items to shopping list
  const addToShoppingList = async (items: (string | { item: string; source: string; notes?: string })[], defaultSource: string = 'manual') => {
    PerformanceMonitoringService.mark('shopping_list_add_start');
    
    trackShoppingListAction('add_item', { count: items.length, source: defaultSource });
    HapticService.itemAdded();
    
    const inHousehold = household?.id && isHouseholdMember(household, user);
    const householdId = inHousehold ? household.id : undefined;
    const userId = inHousehold ? undefined : user?.id;
    
    // Fetch prices in parallel
    const pricePromises = items.map(async (inputItem) => {
      const itemStr = typeof inputItem === 'string' ? inputItem : inputItem.item;
      const itemSource = typeof inputItem === 'string' ? defaultSource : inputItem.source;
      const itemNotes = typeof inputItem === 'string' ? undefined : inputItem.notes;
      
      const parsed = parseIngredientForShoppingList(itemStr);
      const priceData = await groceryPriceService.getIngredientPrice(parsed.itemName).catch(() => null);
      return {
        parsed,
        source: itemSource,
        notes: itemNotes,
        estimatedPrice: priceData?.averagePrice || 0
      };
    });
    
    const priceResults = await Promise.all(pricePromises);
    
    const newItems: ShoppingItem[] = [];
    for (const { parsed, estimatedPrice, source: itemSource, notes: itemNotes } of priceResults) {
      newItems.push({
        id: Math.random().toString(36).substr(2, 9),
        item: parsed.itemName,
        quantity: parsed.quantity,
        category: inferCategoryFromItemName(parsed.itemName),
        checked: false,
        source: itemSource,
        notes: itemNotes,
        addedAt: new Date(),
        estimatedPrice
      });
    }
    
    setShoppingList((prev: ShoppingItem[]) => [...prev, ...newItems]);
    
    await ShoppingListCacheService.addItemsToCache(newItems, householdId, userId);
    
    setActiveTab(Tab.SHOPPING);
    
    PerformanceMonitoringService.mark('shopping_list_add_end');
    PerformanceMonitoringService.measure('shopping_list_add', 'shopping_list_add_start', 'shopping_list_add_end');
  };

  // Household activity tracking — activityHousehold is synced from useDataManagement below
  // so the subscription only starts after the real household is loaded.
  const [activityHousehold, setActivityHousehold] = useState<Household | null>(null);
  const {
    recentActivities,
    isLoadingActivities,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    logActivity,
    logItemAdded,
    logItemRemoved,
    logShoppingAdded,
    logRecipeSaved,
    logMealCompleted,
    updateActivityStatus
  } = useHouseholdActivity(user, activityHousehold);

  const {
    inventory,
    setInventory,
    shoppingList,
    setShoppingList,
    savedRecipes,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setSavedRecipes,
    ratings,
    mealPlan,
    setMealPlan,
    updateMealPlan,
    household,
    setHousehold,
    consumptionSuggestions,
    expirationAlerts,
    recipeSuggestions,
    customCategories,
    addCustomCategory,
    updateCustomCategory,
    deleteCustomCategory,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    generateRecipeSuggestionsOnDemand,
    handleAddToPlan,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    addMealToPlan,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateMealOnPlan,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    removeMealFromPlan,
    handleSaveRecipe,
    handleDeleteRecipe,
    submitRating,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getRatingsForRecipe,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getCommunityRatings,
    handleMarkAsMade,
    updateItem,
    deleteItem,
    deleteItems,
    addItem,
    addItems,
    recentActions,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    recordUndo,
    performUndo,
    recipeSaveLimitExceeded,
    mealPlanLimitExceeded,
    checkRecipeSaveLimit,
    checkMealPlanLimit,
    addShoppingListItem,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    addShoppingListItems,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateShoppingListItem,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateShoppingListItems,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    removeShoppingListItem,
    removeShoppingListItems,
    isLoadingInventory,
    isLoadingShoppingList,
    isLoadingMealPlan,
    isLoadingSavedRecipes,
    isLoadingRatings,
    isLoadingHousehold,
    showRiskQuestionnaire,
    handleRiskQuestionnaireComplete,
    refreshAllData,
    setLoadingRatingsComplete,
  } = useDataManagement(user, addToast, addToShoppingList, updateSyncStatus, {
    logItemAdded,
    logItemRemoved,
    logShoppingAdded,
    logRecipeSaved,
    logMealCompleted,
    updateActivityStatus
  }, {
    onShowAddToPlanDialog: (recipe) => {
      setPendingRecipeForPlan(recipe);
      // Default to tomorrow's date if it exists in the plan, otherwise first day
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);
      const tomorrowIndex = mealPlan?.findIndex(day => day.date?.slice(0, 10) === tomorrowStr) ?? -1;
      setSelectedDayForPlan(tomorrowIndex >= 0 ? tomorrowIndex : 0);
      setSelectedMealForPlan('dinner');
      setShowAddToPlanDialog(true);
    }
  });

  // Sync household into activityHousehold so the activity subscription activates
  // once the household is loaded (avoids circular dependency at hook call site).
  useEffect(() => {
    setActivityHousehold(household ?? null);
  }, [household]);

  // Record behaviour milestones used to gate progressive feature-discovery tips
  // (audit item #18 — trigger by milestone rather than showing all tips at once).
  useEffect(() => {
    if (inventory.length > 0) recordMilestone('first-pantry-item');
  }, [inventory.length]);

  useEffect(() => {
    if (shoppingList.length > 0) recordMilestone('first-shopping-item');
  }, [shoppingList.length]);

  useEffect(() => {
    if (mealPlan && mealPlan.some(day => day.breakfast.length > 0 || day.lunch.length > 0 || day.dinner.length > 0)) {
      recordMilestone('first-meal-planned');
    }
  }, [mealPlan]);

  // Confirm add to plan from dialog
  const confirmAddToPlan = (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner') => {
    if (pendingRecipeForPlan && handleAddToPlan) {
      handleAddToPlan(pendingRecipeForPlan, dayIndex, mealType);
      setPendingRecipeForPlan(null);
      setShowAddToPlanDialog(false);
    }
  };

  useEffect(() => {
    // Community component handles its own data loading
    prevActiveTabRef.current = activeTab;
  }, [activeTab]);

  // If the user hides the currently-active tab, fall back to PANTRY
  useEffect(() => {
    const hidden = settings.navigation?.hiddenTabs ?? [];
    if (hidden.includes(activeTab)) {
      setActiveTab(Tab.PANTRY);
    }
  }, [settings.navigation?.hiddenTabs]);

  useEffect(() => {
    if (user?.id && household?.id) {
      const activityMap = {
        [Tab.PANTRY]: 'viewing pantry',
        [Tab.PANTRY_CACHE_TEST]: 'testing cached pantry',
        [Tab.SHOPPING]: 'viewing shopping list',
        [Tab.MEALS]: 'viewing meal plan',
        [Tab.RECIPES]: 'viewing recipes',
        [Tab.SETTINGS]: 'viewing settings',
        [Tab.COMMUNITY]: 'viewing community',
        [Tab.ANALYTICS]: 'viewing analytics'
      };

      const currentActivity = activityMap[activeTab] || 'using app';
      HouseholdActivityService.updateMemberActivity(user.id, household.id, currentActivity);
    }
  }, [user?.id, household?.id, activeTab]);

  useEffect(() => {
    SafeAreaService.initialize().catch(error => log.error('Failed to initialize safe area service', { error }, 'App'));
  }, []);

  useEffect(() => {
    PerformanceMonitoringService.init();
    PerformanceMonitoringService.mark('app_open');
    return () => {
      PerformanceMonitoringService.cleanup();
    };
  }, []);

  useEffect(() => {
    if (user?.id) {
      pushNotificationService.initialize().catch(error => log.error('Failed to initialize push notifications', { error }, 'App'));
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      // Database monitoring is now initialized in firebaseConfig.ts
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const auth = getAuth();
    if (!auth.currentUser) return;

    const checkAndShowNotifications = async () => {
      try {
        const unreadNotifications = await NotificationService.getUnreadNotifications(user.id, user.email);
        const filteredNotifications = unreadNotifications.filter(notification =>
          NotificationService.shouldShowNotification(notification, notificationSettings)
        );

        if (filteredNotifications.length > 0) {
          const highestPriority = filteredNotifications.reduce((prev, current) =>
            getPriorityWeight(current.priority) > getPriorityWeight(prev.priority) ? current : prev
          );

          const lastShown = localStorage.getItem('lastNotificationShown');
          const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

          if (!lastShown || parseInt(lastShown) < fiveMinutesAgo) {
            setNotifications([highestPriority]);
            localStorage.setItem('lastNotificationShown', Date.now().toString());
          }
        }
      } catch (error) {
        log.error('Error checking notifications', { error }, 'App');
      }
    };

    checkAndShowNotifications();
    const interval = setInterval(checkAndShowNotifications, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user?.id, notificationSettings]);

  const getPriorityWeight = (priority: string): number => {
    switch (priority) {
      case 'urgent': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  };

  const handleNotificationDismiss = async (notificationId: string) => {
    if (user?.id) {
      await markNotificationRead(user.id, notificationId);
    } else {
      await NotificationService.markAsRead('', notificationId);
    }
    setNotifications([]);
  };

  const handleNotificationAction = async (notification: NotificationItem) => {
    setNotifications([]);
    
    try {
      if (user?.id) {
        try {
          await markNotificationRead(user.id, notification.id);
        } catch {
          // Notification lives in per-user cache only (no top-level collection doc) — fall back
          await updateNotificationInCache(user.id, notification.id, { read: true });
        }
      } else {
        await NotificationService.markAsRead('', notification.id);
      }

      switch (notification.actionType) {
        case 'add_to_shopping':
          if (notification.actionData?.itemName) {
            addToShoppingList([notification.actionData.itemName]);
            addToast(`Added "${notification.actionData.itemName}" to shopping list`, 'success');
          } else if (notification.actionData?.items?.[0]?.itemName) {
            const names = notification.actionData.items.map((i: {itemName: string}) => i.itemName) as string[];
            addToShoppingList(names);
            addToast(`Added ${names.length} item${names.length > 1 ? 's' : ''} to shopping list`, 'success');
          }
          break;
        case 'view_recipe':
          setActiveTab(Tab.RECIPES);
          addToast('Viewing your saved recipes', 'info');
          break;
        case 'view_item': {
          // Check if this notification contains multiple items
          const notificationItems = notification.actionData?.items;
          if (notificationItems && notificationItems.length > 1) {
            // Show ExpiredItemsModal for multiple items
            const specificItems = notificationItems
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((item: any) => inventory.find(invItem => invItem.id === item.itemId))
              .filter((item: PantryItem | undefined): item is PantryItem => item !== undefined);
            
            if (specificItems.length > 0) {
              setExpiredItemsModalSpecificItems(specificItems);
              setShowExpiredItemsModal(true);
            } else {
              addToast('Items no longer found in pantry', 'info');
            }
          } else {
            // Single item - show ItemDetailModal
            const itemId = notification.actionData?.items?.[0]?.itemId
              ?? notification.actionData?.itemId;
            const found = itemId
              ? inventory.findIndex(i => i.id === itemId)
              : -1;
            if (found !== -1) {
              setActiveTab(Tab.PANTRY);
              setNotificationViewItem({ item: inventory[found], index: found });
            } else if (notification.actionData?.tab === 'shopping') {
              setActiveTab(Tab.SHOPPING);
            } else {
              setActiveTab(Tab.PANTRY);
              addToast('Item no longer found in pantry', 'info');
            }
          }
          break;
        }
        case 'join_household':
          if (notification.actionData?.householdId && user) {
            try {
              const updatedHousehold = await joinHousehold(notification.actionData.householdId, user);
              
              if (updatedHousehold) {
                setUser({ ...user, householdId: notification.actionData.householdId });
                setHousehold(updatedHousehold);
                addToast('Successfully joined household!', 'success');
              } else {
                addToast('Failed to join household - invitation not found', 'error');
              }
            } catch (error: unknown) {
              log.error('Error joining household', { error }, 'App');
              let message = 'Failed to join household';
              if (error instanceof Error && error.message?.includes('not invited')) {
                message = 'Unable to join 9: You are not invited to this household or have already joined';
              }
              addToast(message, 'error');
            }
          }
          break;
      }
    } catch (error) {
      log.error('Error handling notification action', { error }, 'App');
      addToast('Failed to process notification', 'error');
    }
  };

  const handleNotificationSnooze = async (notificationId: string, minutes: number) => {
    if (user?.id) {
      await snoozeNotificationInCache(user.id, notificationId, minutes);
    } else {
      await NotificationService.snoozeNotification('', notificationId, minutes);
    }
    setNotifications([]);
  };

  /**
   * Merges a user's personal data (inventory, shopping list, meal plan, saved recipes)
   * into the household they just joined, then clears the personal copies.
   *
   * A localStorage checkpoint is written before migration begins and cleared only on
   * full success. If the app is closed mid-migration or a step fails, the checkpoint
   * persists so the user can retry on next load (see the effect below).
   */
  const migrateUserDataToHousehold = async (householdId: string, userId: string): Promise<boolean> => {
    const CHECKPOINT_KEY = `pending_migration_${userId}`;

    // Write checkpoint so we can retry if the app crashes mid-migration
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify({ householdId, timestamp: Date.now() }));

    let allSucceeded = true;

    try {
      const [userInventory, userShoppingList, userMealPlan, userRecipes] = await Promise.all([
        InventoryCacheService.getCachedInventory(undefined, userId),
        ShoppingListCacheService.getCachedShoppingList(undefined, userId),
        MealPlanCacheService.getCachedMealPlan(undefined, userId),
        RecipesCacheService.getCachedRecipes(undefined, userId),
      ]);

      // Run each step sequentially so a failure in one doesn't cancel the others
      // and the user cache is only cleared when that step is confirmed written

      if (userInventory.length > 0) {
        try {
          await InventoryCacheService.addItemsToCache(userInventory, householdId, undefined);
          await InventoryCacheService.updateCache([], undefined, userId);
        } catch (e) {
          allSucceeded = false;
          log.error('Migration: inventory step failed', { userId, householdId, error: e }, 'App');
        }
      }

      if (userShoppingList.length > 0) {
        try {
          await ShoppingListCacheService.addItemsToCache(userShoppingList, householdId, undefined);
          await ShoppingListCacheService.setCache([], undefined, userId);
        } catch (e) {
          allSucceeded = false;
          log.error('Migration: shopping list step failed', { userId, householdId, error: e }, 'App');
        }
      }

      if (userMealPlan.length > 0) {
        try {
          const householdMealPlan = await MealPlanCacheService.getCachedMealPlan(householdId, undefined);
          const householdDates = new Set(householdMealPlan.map(d => d.date));
          const newDays = userMealPlan.filter(d => !householdDates.has(d.date));
          await MealPlanCacheService.updateCache([...householdMealPlan, ...newDays], householdId, undefined);
          await MealPlanCacheService.updateCache([], undefined, userId);
        } catch (e) {
          allSucceeded = false;
          log.error('Migration: meal plan step failed', { userId, householdId, error: e }, 'App');
        }
      }

      if (userRecipes.length > 0) {
        try {
          const householdRecipes = await RecipesCacheService.getCachedRecipes(householdId, undefined);
          const existingIds = new Set(householdRecipes.map(r => r.id));
          const newRecipes = userRecipes.filter(r => !existingIds.has(r.id));
          const merged = newRecipes.length > 0 ? [...householdRecipes, ...newRecipes] : householdRecipes;
          if (newRecipes.length > 0) await RecipesCacheService.updateCache(merged, householdId, undefined);
          await RecipesCacheService.updateCache([], undefined, userId);
        } catch (e) {
          allSucceeded = false;
          log.error('Migration: recipes step failed', { userId, householdId, error: e }, 'App');
        }
      }

      if (allSucceeded) {
        localStorage.removeItem(CHECKPOINT_KEY);
        log.info('Personal data migrated to household on join', { householdId, userId }, 'App');
      } else {
        log.warn('Migration completed with some failures — checkpoint kept for retry', { householdId, userId }, 'App');
      }
    } catch (error) {
      allSucceeded = false;
      log.error('Failed to migrate personal data to household', { userId, householdId, error }, 'App');
    }

    return allSucceeded;
  };

  const handleHouseholdInviteAccept = async (invite: NotificationItem) => {
    if (!user) return;

    try {
      // Mark notification as read first
      await markNotificationRead(user.id, invite.id);

      // Join the household
      const updatedHousehold = await joinHousehold(invite.actionData.householdId, user);
      
      if (updatedHousehold) {
        const joinedHouseholdId = invite.actionData.householdId;
        setUser({ ...user, householdId: joinedHouseholdId });
        setHousehold(updatedHousehold);
        setHouseholdInvites(prev => prev.filter(i => i.id !== invite.id));
        
        // Close modal if no more invites
        if (householdInvites.length <= 1) {
          setShowHouseholdInviteModal(false);
        }

        // Migrate personal inventory/lists/recipes into the household
        const migrationOk = await migrateUserDataToHousehold(joinedHouseholdId, user.id);
        
        addToast(
          migrationOk
            ? 'Successfully joined household! Your personal data has been merged in.'
            : 'Joined household, but some data could not be migrated. You can retry from Settings.',
          migrationOk ? 'success' : 'warning'
        );
      } else {
        addToast('Failed to join household - invitation not found', 'error');
      }
    } catch (error: unknown) {
      log.error('Error accepting household invite', { error }, 'App');
      let message = 'Failed to join household';
      if (error instanceof Error && error.message?.includes('not invited')) {
        message = 'Unable to join: You are not invited to this household or have already joined';
      }
      addToast(message, 'error');
    }
  };

  const handleHouseholdInviteDecline = async (invite: NotificationItem) => {
    if (!user) return;

    try {
      // Delete the notification (declined invites are removed)
      await deleteNotification(user.id, invite.id);
      
      // Remove from invites list
      setHouseholdInvites(prev => prev.filter(i => i.id !== invite.id));
      
      // Close modal if no more invites
      if (householdInvites.length <= 1) {
        setShowHouseholdInviteModal(false);
      }
      
      addToast('Household invitation declined and removed', 'info');
    } catch (error: unknown) {
      log.error('Error declining household invite', { error }, 'App');
      addToast('Failed to decline invitation', 'error');
    }
  };

  const handleRemoveExpiredItems = async (itemIds: string[]) => {
    try {
      // Find items to remove
      const itemsToRemove = inventory.filter(item => itemIds.includes(item.id));
      
      // Remove from inventory
      setInventory(prev => prev.filter(item => !itemIds.includes(item.id)));
      
      // Remove from cache
      const inHousehold = household?.id && isHouseholdMember(household, user);
      const householdId = inHousehold ? household.id : undefined;
      const userId = inHousehold ? undefined : user?.id;
      
      await Promise.all(
        itemIds.map(itemId => 
          InventoryCacheService.removeItemFromCache(itemId, householdId, userId)
        )
      );
      
      // Log activity for each removed item
      for (const item of itemsToRemove) {
        logItemRemoved(item.item, item.id);
      }
      
      addToast(`${itemIds.length} expired item${itemIds.length !== 1 ? 's' : ''} removed`, 'success');
    } catch (error) {
      log.error('Failed to remove expired items', { error }, 'App');
      addToast('Failed to remove expired items', 'error');
      throw error;
    }
  };

  const handleLogin = async (loggedInUser: User) => {
    // Guest users have no Firebase Auth UID — skip all Firestore ops and onboarding
    if (loggedInUser.isGuest) {
      setUser({ ...loggedInUser, hasSeenTutorial: true });
      AnalyticsService.trackLogin('guest');
      return;
    }

    const userRef = DatabaseMonitoringService.doc('users', loggedInUser.id);
    const userDoc = await DatabaseMonitoringService.getDoc(userRef);

    let finalUser = loggedInUser;

    if (!userDoc.exists()) {
      await DatabaseMonitoringService.setDoc(userRef, {
        name: loggedInUser.name,
        email: loggedInUser.email,
        subscription: {
          tier: 'premium',
          status: 'active',
          current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          cancel_at_period_end: false
        },
        createdAt: serverTimestamp(),
        hasSeenTutorial: false
      });
    } else {
      const userData = userDoc.data();
      if (!userData?.name || userData.name !== loggedInUser.name) {
        await DatabaseMonitoringService.updateDoc(userRef, {
          name: loggedInUser.name,
          updatedAt: serverTimestamp()
        });
      }
      // Merge Firestore data with the logged in user data
      finalUser = {
        ...loggedInUser,
        hasSeenTutorial: userData?.hasSeenTutorial ?? false
      };
    }

    setUser(finalUser);
    AnalyticsService.trackLogin(finalUser.provider || 'email');
    AnalyticsService.setUser(finalUser.id, {
      email: finalUser.email,
      provider: finalUser.provider,
      has_seen_tutorial: finalUser.hasSeenTutorial
    });

    // Show onboarding if not completed (check both Firestore flag and localStorage for cross-device support)
    if (!finalUser.hasSeenTutorial && localStorage.getItem('onboarding-completed') !== 'true') {
      setShowOnboarding(true);
    }
  };

  useEffect(() => {
    import('./services/imageCacheService').then(({ initializeImageCache }) => {
      initializeImageCache().catch(error => {
        log.error('Failed to initialize image cache', { error }, 'App');
      });
    });

    AnalyticsService.trackAppOpen();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        AnalyticsService.trackAppBackground();
      } else {
        AnalyticsService.trackAppForeground();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const [lastBackPress, setLastBackPress] = useState<number>(0);
  useEffect(() => {
    const handleBackButton = () => {
      // Delegate to the shared LIFO modal stack first.
      // All App-level and sub-component modals register themselves via
      // useAndroidBack, so this single call handles every open modal.
      if (closeTopAndroidModal()) return;

      // Navigate back through tab history
      if (tabHistoryRef.current.length > 0) {
        const prev = tabHistoryRef.current[tabHistoryRef.current.length - 1];
        tabHistoryRef.current = tabHistoryRef.current.slice(0, -1);
        setActiveTab(prev);
        return;
      }

      const currentTime = Date.now();
      const timeDiff = currentTime - lastBackPress;

      if (timeDiff < 2000) {
        CapacitorApp.exitApp();
      } else {
        addToast('Press back again to exit', 'info', 2000);
        setLastBackPress(currentTime);
      }
    };

    CapacitorApp.addListener('backButton', handleBackButton).then((listener) => {
      backButtonListenerRef.current = listener;
    }).catch((error) => {
      log.error('Failed to add back button listener', { error }, 'App');
    });

    // Handle app URL open for Firebase auth redirects
    CapacitorApp.addListener('appUrlOpen', (event) => {
      log.debug('App opened with URL:', event.url);
      // Check if this is a Firebase auth redirect
      if (event.url && event.url.startsWith('com.smart.pantry://')) {
        log.debug('Firebase auth redirect detected, URL:', event.url);
        // The redirect result will be handled by the Login component
        // when it mounts and calls getRedirectResult
      }
    }).then((listener) => {
      appUrlOpenListenerRef.current = listener;
    }).catch((error) => {
      log.error('Failed to add app URL open listener', { error }, 'App');
    });

    return () => {
      if (backButtonListenerRef.current && backButtonListenerRef.current.remove) {
        backButtonListenerRef.current.remove();
        backButtonListenerRef.current = null;
      }
      if (appUrlOpenListenerRef.current && appUrlOpenListenerRef.current.remove) {
        appUrlOpenListenerRef.current.remove();
        appUrlOpenListenerRef.current = null;
      }
    };
  }, [activeTab, lastBackPress, addToast]);

  const [previousTab, setPreviousTab] = useState<Tab>(Tab.PANTRY);
  useEffect(() => {
    if (activeTab !== previousTab) {
      AnalyticsService.trackTabSwitch(previousTab, activeTab);
      setPreviousTab(activeTab);
    }
  }, [activeTab, previousTab]);

  // Check for household invites when user logs in
  useEffect(() => {
    const checkHouseholdInvites = async () => {
      if (!user) return;

      log.debug('Checking household invites for user', { userId: user.id });

      // Always migrate any pre-registration email-addressed invites from the root
      // /notifications/ collection into the per-user cache, regardless of whether
      // the user already belongs to a household.
      if (user.email) {
        await NotificationService.migrateRootInviteNotifications(user.id, user.email);
      }

      // Only surface the invite modal when the user isn't yet in a household
      if (!user.householdId) {
        try {
          const unreadNotifications = await NotificationService.getUnreadNotifications(user.id, user.email);
          log.debug('Unread notifications count:', unreadNotifications.length);
          const invites = unreadNotifications.filter(n => n.type === 'household_invite' && n.actionType === 'join_household');
          log.debug('Household invites found:', invites.length);
          if (invites.length > 0) {
            setHouseholdInvites(invites);
            setShowHouseholdInviteModal(true);
            // Surface a toast with action so the user can't miss it
            addToast(
              `You have ${invites.length === 1 ? 'a household invitation' : `${invites.length} household invitations`}!`,
              'info',
              0, // persistent until dismissed
              'View',
              () => setShowHouseholdInviteModal(true)
            );
          }
        } catch (error) {
          log.error('Error checking household invites', { error }, 'App');
        }
      } else {
        log.debug('Skipping invite modal - user already has a household');
      }

      // Clear the 5-minute banner throttle so any cached notifications surface
      // immediately after login rather than being silently blocked.
      localStorage.removeItem('lastNotificationShown');
    };

    checkHouseholdInvites();
  }, [user]);

  // Retry any pending data migration that was interrupted (app crash / network failure)
  useEffect(() => {
    if (!user?.id || !user?.householdId) return;
    const CHECKPOINT_KEY = `pending_migration_${user.id}`;
    const raw = localStorage.getItem(CHECKPOINT_KEY);
    if (!raw) return;

    try {
      const { householdId } = JSON.parse(raw) as { householdId: string; timestamp: number };
      // Only retry if the checkpoint is for the household the user is currently in
      if (householdId !== user.householdId) {
        localStorage.removeItem(CHECKPOINT_KEY);
        return;
      }

      addToast(
        'A previous data migration was incomplete.',
        'warning',
        0, // persistent
        'Retry now',
        async () => {
          const ok = await migrateUserDataToHousehold(householdId, user.id);
          addToast(
            ok ? 'Data migration completed successfully!' : 'Migration still has errors. Please check your connection and try again.',
            ok ? 'success' : 'error'
          );
        }
      );
    } catch {
      localStorage.removeItem(CHECKPOINT_KEY);
    }
  }, [user?.id, user?.householdId]);

  // Show expired items launch sheet once per session when the user has opted in
  useEffect(() => {
    if (hasShownExpiredLaunchRef.current) return;
    if (!user || inventory.length === 0) return;
    if (!getExpiredLaunchEnabled()) return;

    const timer = setTimeout(() => {
      if (hasShownExpiredLaunchRef.current) return;
      const today = new Date().toISOString().slice(0, 10);
      const expired = inventory.filter(item => {
        if (!item.expirationDate || item.is_immortal) return false;
        if (item.is_frozen || item.storageLocation === 'freezer') {
          const ref = item.freezerExpiry || item.expirationDate;
          return ref <= today;
        }
        return item.expirationDate <= today;
      });
      if (expired.length > 0) {
        hasShownExpiredLaunchRef.current = true;
        setExpiredLaunchItems(expired);
        setShowExpiredLaunchSheet(true);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [user, inventory]);

  // Show a loading spinner while waiting for auth to be ready
  if (!isAuthReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-theme-primary">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) return <Login onLogin={handleLogin} />;

  const navigateToNotifications = () => {
    setActiveTab(Tab.SETTINGS);
    setTimeout(() => {
      // Switch to the Account tab (Pending Notifications is its own box there)
      const accountTab = document.querySelector('[data-settings-tab="account"]') as HTMLElement;
      if (accountTab) accountTab.click();

      setTimeout(() => {
        // Expand the Pending Notifications accordion if collapsed
        const pendingSection = document.querySelector('[data-section="pending-notifications"]') as HTMLElement;
        if (pendingSection) {
          const header = pendingSection.querySelector('.cursor-pointer') as HTMLElement;
          const isExpanded = pendingSection.querySelector('.border-t.border-theme.p-4') !== null;
          if (!isExpanded && header) header.click();

          setTimeout(() => {
            pendingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 150);
        }
      }, 100);
    }, 100);
  };

  return (
    <>
      {(() => {
        if (settings?.theme) {
          setAppContext(
            process.env.npm_package_version || '1.0.0',
            'web',
            settings.theme.mode
          );
        }
        return null;
      })()}

      <ErrorBoundary>
        <div className="h-screen flex flex-col max-w-md mx-auto shadow-2xl relative border-x border-theme transition-colors duration-300 overflow-x-hidden">
        {showHousehold && (
          <HouseholdManager 
              user={user} 
              household={household} 
              setHousehold={setHousehold} 
              onClose={() => setShowHousehold(false)}
              setActiveTab={setActiveTab}
              addToast={addToast}
          />
        )}

        {showOnboarding && user && (
          <ModernOnboardingFlow
            user={user}
            onComplete={async () => {
              setShowOnboarding(false);
              try {
                // Mark onboarding as completed in localStorage and Firestore
                localStorage.setItem('onboarding-completed', 'true');
                recordMilestone('onboarding-completed');
                if (user?.id) {
                  const userRef = DatabaseMonitoringService.doc('users', user.id);
                  await DatabaseMonitoringService.updateDoc(userRef, { hasSeenTutorial: true });
                  setUser(prev => prev ? { ...prev, hasSeenTutorial: true } : prev);
                }
              } catch (error) {
                log.error('Failed to mark onboarding complete', { error }, 'App');
              }
            }}
            onPersonaSelected={async (persona) => {
              try {
                if (user?.id) {
                  const userRef = DatabaseMonitoringService.doc('users', user.id);
                  await DatabaseMonitoringService.updateDoc(userRef, { 'profile.leftoverPersona': persona });
                }
              } catch (error) {
                log.error('Failed to save leftover persona from onboarding', { error }, 'App');
              }
            }}
            onOpenHousehold={() => { setShowOnboarding(false); setShowHousehold(true); }}
            onSkip={() => { recordMilestone('onboarding-completed'); setShowOnboarding(false); }}
          />
        )}

        {showRiskQuestionnaire && (
          <RiskAssessmentQuestionnaire
            userId={user.id}
            onComplete={async (level: number, sensitive?: boolean) => {
              try {
                await handleRiskQuestionnaireComplete(level, sensitive);
                // Optimistically update local user object if available
                setUser(prev => prev ? { ...prev, profile: { ...prev.profile, riskLevel: level, sensitiveHealthMode: !!sensitive } } : prev);
              } catch {
                // handler already logs; no-op here
              }
            }}
          />
        )}

        {showHouseholdInviteModal && user && (
          <HouseholdInviteModal
            invites={householdInvites}
            user={user}
            onClose={() => setShowHouseholdInviteModal(false)}
            onAccept={handleHouseholdInviteAccept}
            onDecline={handleHouseholdInviteDecline}
          />
        )}

        {notificationViewItem && (
          <ItemDetailModal
            item={notificationViewItem.item}
            originalIndex={notificationViewItem.index}
            onClose={() => setNotificationViewItem(null)}
            onUpdateItem={updateItem}
            onDeleteItem={deleteItem}
            onAddToShoppingList={addToShoppingList}
            customCategories={customCategories}
          />
        )}

        {showExpiredItemsModal && (
          <ExpiredItemsModal
            isOpen={showExpiredItemsModal}
            onClose={() => setShowExpiredItemsModal(false)}
            inventory={inventory}
            onRemoveItems={handleRemoveExpiredItems}
            householdId={household?.id}
            userId={user?.id}
            userName={user?.name}
          />
        )}

        {showAddToPlanDialog && pendingRecipeForPlan && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-theme-primary p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4 text-theme-text">{intl.formatMessage({ id: 'mealPlanner.addToMealPlan' })}</h3>
              <p className="mb-4 text-theme-text-secondary">Select a day and meal for "{pendingRecipeForPlan.title}"</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-theme-text">{intl.formatMessage({ id: 'mealPlanner.day' })}</label>
                  <select 
                    className="w-full p-2 border border-theme-border rounded bg-white text-black"
                    onChange={(e) => setSelectedDayForPlan(parseInt(e.target.value))}
                    value={selectedDayForPlan ?? 0}
                  >
                    {mealPlan?.map((day, index) => (
                      <option key={index} value={index}>
                        {day.dayName} ({new Date(day.date).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2 text-theme-text">{intl.formatMessage({ id: 'mealPlanner.meal' })}</label>
                  <select 
                    className="w-full p-2 border border-theme-border rounded bg-white text-black"
                    onChange={(e) => setSelectedMealForPlan(e.target.value as 'breakfast' | 'lunch' | 'dinner')}
                    value={selectedMealForPlan ?? 'dinner'}
                  >
                    <option value="breakfast">{intl.formatMessage({ id: 'mealPlanner.breakfast' })}</option>
                    <option value="lunch">{intl.formatMessage({ id: 'mealPlanner.lunch' })}</option>
                    <option value="dinner">{intl.formatMessage({ id: 'mealPlanner.dinner' })}</option>
                  </select>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddToPlanDialog(false);
                    setPendingRecipeForPlan(null);
                  }}
                  className="flex-1 px-4 py-2 border border-theme-border rounded text-theme-text hover:bg-theme-hover"
                >
                  {intl.formatMessage({ id: 'common.cancel' })}
                </button>
                <button
                  onClick={() => {
                    if (selectedDayForPlan !== null && selectedMealForPlan) {
                      confirmAddToPlan(selectedDayForPlan, selectedMealForPlan);
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-[var(--accent-color)] text-white rounded border border-[var(--accent-color)] hover:opacity-90"
                >
                  Add to Plan
                </button>
              </div>
            </div>
          </div>
        )}

        <AppHeader
          user={user}
          household={household}
          settings={settings}
          setSettings={setSettings}
          onShowHousehold={() => setShowHousehold(true)}
          recentActions={recentActions}
          onUndo={performUndo}
          syncStatus={syncStatus}
          onSyncClick={syncNow}
          onNavigateToSettings={navigateToNotifications}
          onNotificationAction={n => handleNotificationAction(n as Parameters<typeof handleNotificationAction>[0])}
          recentActivities={recentActivities}
          isLoadingActivities={isLoadingActivities}
        />

        {maintenanceInfo.active && maintenanceInfo.message && (
          <div className="sticky top-[calc(var(--safe-area-top,0px)+56px)] z-20 mx-auto max-w-3xl px-3 pt-2">
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-sm">
              <div className="font-semibold">Maintenance Mode</div>
              <div className="mt-1 opacity-90">{maintenanceInfo.message}</div>
            </div>
          </div>
        )}

        {announcementInfo.enabled && announcementInfo.message && !maintenanceInfo.active && (
          <div className="sticky top-[calc(var(--safe-area-top,0px)+56px)] z-20 mx-auto max-w-3xl px-3 pt-2">
            <div
              className={`rounded-xl border px-4 py-3 text-sm shadow-sm ${
                announcementInfo.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-900'
                  : announcementInfo.type === 'warning'
                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                    : 'border-blue-200 bg-blue-50 text-blue-900'
              }`}
            >
              <div className="font-semibold">Announcement</div>
              <div className="mt-1 opacity-90">{announcementInfo.message}</div>
            </div>
          </div>
        )}

        {/* Persistent household invite banner — stays visible until acted on */}
        {householdInvites.length > 0 && !showHouseholdInviteModal && (
          <div
            className="sticky top-[calc(var(--safe-area-top,0px)+56px)] z-10 mx-auto max-w-md px-3 pt-1"
          >
            <button
              onClick={() => setShowHouseholdInviteModal(true)}
              className="w-full flex items-center justify-between gap-2 bg-[var(--accent-color)] text-white px-4 py-2 rounded-lg shadow-md text-sm font-medium animate-pulse-subtle"
            >
              <span>🏠 You have {householdInvites.length === 1 ? 'a pending household invitation' : `${householdInvites.length} household invitations`}</span>
              <span className="underline whitespace-nowrap">View →</span>
            </button>
          </div>
        )}
        
        <AppProvider
          value={{
            activeTab,
            setActiveTab: switchTab,
            user,
            household: household ?? undefined,
            inventory,
            setInventory,
            shoppingList,
            setShoppingList,
            mealPlan,
            setMealPlan,
            
            savedRecipes,
            ratings,
            persistedRecipeResult,
            setPersistedRecipeResult,
            initialSearchQuery,
            setInitialSearchQuery,
            settings,
            setSettings,
            customCategories,
            recipeSaveLimitExceeded,
            mealPlanLimitExceeded,
            isLoadingInventory,
            isLoadingShoppingList,
            isLoadingMealPlan,
            isLoadingSavedRecipes,
            isLoadingHousehold,
            isLoadingRatings,
            setLoadingRatingsComplete,
            consumptionSuggestions,
            expirationAlerts,
            recipeSuggestions,
            recentActivities,
            isLoadingActivities
          }}
        >
          <AppActionsProvider
            value={{
              setActiveTab,
              updateItem,
              deleteItem,
              deleteItems,
              addItem,
              addItems,
              setInventory,
              setShoppingList,
              setMealPlan,
              updateMealPlan,
              onAddToPlan: handleAddToPlan,
              onSaveRecipe: handleSaveRecipe,
              onDeleteRecipe: handleDeleteRecipe,
              onRateRecipe: submitRating,
              handleMarkAsMade,
              onMoveToPantry: async (items) => {
                const processedItems = await Promise.all(items.map(async (i) => {
                  const category = inferCategoryFromItemName(i.item);
                  let image = getItemImage(i.item, category);
                  
                  if (image === '/images/placeholder.svg') {
                    try {
                      const externalImage = await fetchExternalItemImage(i.item);
                      if (externalImage) {
                        image = externalImage;
                      }
                    } catch (error) {
                      log.debug('Failed to fetch external image', { item: i.item, error }, 'App');
                    }
                  }
                  
                  let addQty = getQuantityAmount(i.purchasedQuantity ?? i.quantity ?? i.purchasedBatch ?? 1);
                  if (addQty < 1) addQty = 1;
                  
                  const reservations: { recipeId: string; recipeName: string; quantity: number; unit: string }[] = [];
                  if (i.source?.startsWith('recipe: need ')) {
                    const match = i.source.match(/recipe: need (.+?) for "(.+?)"/);
                    if (match) {
                      const qtyStr = match[1];
                      const recipeName = match[2];
                      const qtyMatch = qtyStr.match(/(\d+(?:\.\d+)?)\s*(.+)/);
                      if (qtyMatch) {
                        const quantity = parseFloat(qtyMatch[1]);
                        const unit = qtyMatch[2];
                        reservations.push({
                          recipeId: `recipe_${recipeName.replace(/\s+/g, '_').toLowerCase()}`,
                          recipeName,
                          quantity,
                          unit
                        });
                      }
                    }
                  }
                  
                  // Build pantry item and convert any purchased batch/quantity into batches[]
                  const batches: Batch[] = [];
                  const nowIso = new Date().toISOString();

                  if (i.purchasedBatch) {
                    batches.push({
                      batchId: Math.random().toString(36).substr(2,9),
                      quantity: Math.abs(i.purchasedBatch.amount) || Math.abs(addQty),
                      unit: i.purchasedBatch.unit || (i.purchasedQuantity?.unit ?? undefined),
                      expires: i.purchasedBatch.expires,
                      purchaseDate: nowIso,
                      note: i.purchasedBatch.note
                    });
                  } else if (i.purchasedQuantity) {
                    batches.push({
                      batchId: Math.random().toString(36).substr(2,9),
                      quantity: Math.abs(i.purchasedQuantity.amount) || Math.abs(addQty),
                      unit: i.purchasedQuantity.unit || undefined,
                      purchaseDate: nowIso
                    });
                  } else {
                    // Fallback: create a batch from the generic quantity field.
                    // Preserve the unit if quantity is a string like "225 g" or "800 ml".
                    const qStr = typeof i.quantity === 'string' ? i.quantity.trim() : '';
                    const unitMatch = qStr.match(/^\d+(?:[./]\d+)?(?:\.\d+)?\s+(\S+)/);
                    const fallbackUnit = unitMatch?.[1] ?? undefined;
                    batches.push({
                      batchId: Math.random().toString(36).substr(2,9),
                      quantity: Math.abs(addQty),
                      unit: fallbackUnit,
                      purchaseDate: nowIso
                    });
                  }

                  return {
                    id: Math.random().toString(36).substr(2,9),
                    item: i.item,
                    category,
                    quantity_estimate: Math.abs(addQty).toString(),
                    storageLocation: inferStorageLocationFromItemName(i.item),
                    image,
                    originalQuantity: i.purchasedQuantity ? `${i.purchasedQuantity.amount} ${i.purchasedQuantity.unit}` : (typeof i.quantity === 'string' ? i.quantity : undefined),
                    reservations,
                    batches,
                    dateAdded: nowIso,
                    lastRestocked: nowIso
                  };
                }));
                
                const addedItems = await addItems(Object.values(processedItems));

                setShoppingList(prev => prev.filter(item => !items.find(moved => moved.id === item.id)));
                await removeShoppingListItems(items.map(i => i.id));
                
                setTimeout(() => {
                  syncNow();
                }, 100);

                addToast(
                  `Added ${items.length} item${items.length > 1 ? 's' : ''} to pantry. Edit quantities?`,
                  'info',
                  8000,
                  'Edit Quantities',
                  () => {
                    localStorage.setItem('pendingQuantityEdits', JSON.stringify(addedItems));
                    setActiveTab(Tab.PANTRY);
                  }
                );
              },
              onAddToShoppingList: addToShoppingList,
              setSettings,
              onAddCustomCategory: addCustomCategory,
              onUpdateCustomCategory: updateCustomCategory,
              onDeleteCustomCategory: deleteCustomCategory,
              addToast,
              setInitialSearchQuery,
              setPersistedRecipeResult,
              onLogout: handleLogout,
              onShowHousehold: () => setShowHousehold(true),
              checkRecipeSaveLimit,
              checkMealPlanLimit,
              addShoppingListItem,
              refreshAllData
            }}
          >
            {household?.id && <LeftoversHotZone householdId={household.id} onNavigateToRecipes={(query) => { setActiveTab(Tab.RECIPES); setInitialSearchQuery(query); }} />}
            <MainContent />
          </AppActionsProvider>
        </AppProvider>
        <AppNavigation activeTab={activeTab} setActiveTab={switchTab} hiddenTabs={settings.navigation?.hiddenTabs} isKeyboardVisible={isKeyboardVisible} />
        
        {showHousehold && (
          <HouseholdManager
            user={user}
            household={household}
            setHousehold={setHousehold}
            onClose={() => setShowHousehold(false)}
            setActiveTab={switchTab}
            addToast={addToast}
          />
        )}

        {notifications.length > 0 && (
          <NotificationBanner
            notification={notifications[0]}
            onDismiss={handleNotificationDismiss}
            onAction={handleNotificationAction}
            onSnooze={handleNotificationSnooze}
          />
        )}

        <div className="fixed bottom-4 right-4 mb-safe z-50 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`max-w-sm rounded-lg shadow-lg border transition-all duration-300 ${
                toast.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800 p-4'
                  : toast.type === 'info'
                  ? 'bg-gray-800 border-gray-700 text-white p-2 text-xs opacity-80'
                  : 'bg-blue-50 border-blue-200 text-blue-800 p-4'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className={`font-medium ${toast.type === 'info' ? 'text-xs' : 'text-sm'}`}>{toast.message}</p>
                  {toast.actionLabel && toast.action && (
                    <button
                      onClick={toast.action}
                      className="mt-2 text-xs underline hover:no-underline"
                    >
                      {toast.actionLabel}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                  className={`hover:text-gray-600 ${toast.type === 'info' ? 'text-gray-300 text-xs' : 'text-gray-400'}`}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      </ErrorBoundary>

      <GlobalUpdatePrompt />
      <WhatsNewModal />

      {/* Feature Discovery — one-time "New Feature!" cards for logged-in users */}
      {user && !showOnboarding && (
        <FeatureDiscoveryManager discoveries={featureDiscoveries} />
      )}

      {/* Contextual Tutorial — per-tab hints shown once on first visit */}
      {user && contextualTips.length > 0 && (
        <ContextualTutorial tips={contextualTips} onTipDismiss={dismissContextualTip} />
      )}

      {showExpiredItemsModal && (
        <ExpiredItemsModal
          isOpen={showExpiredItemsModal}
          onClose={() => {
            setShowExpiredItemsModal(false);
            setExpiredItemsModalSpecificItems(undefined);
          }}
          inventory={inventory}
          onRemoveItems={handleRemoveExpiredItems}
          householdId={household?.id}
          userId={user?.id}
          userName={user?.name}
          specificItems={expiredItemsModalSpecificItems}
        />
      )}

      {/* Launch-time expired items bottom sheet */}
      {showExpiredLaunchSheet && (
        <ExpiredItemsLaunchSheet
          isOpen={showExpiredLaunchSheet}
          onClose={() => setShowExpiredLaunchSheet(false)}
          expiredItems={expiredLaunchItems}
          onRemoveItems={async (ids) => {
            await handleRemoveExpiredItems(ids);
          }}
        />
      )}

      {notificationViewItem && (
        <ItemDetailModal
          item={notificationViewItem.item}
          onClose={() => setNotificationViewItem(null)}
          onUpdateItem={updateItem}
          onDeleteItem={deleteItem}
          onAddToShoppingList={addToShoppingList}
          customCategories={customCategories}
          originalIndex={notificationViewItem.index}
        />
      )}

      {isAdmin && (
        <Suspense fallback={<LoadingSpinner />}>
          <DatabaseAnalytics />
        </Suspense>
      )}
    </>
  );
};

export default App;
