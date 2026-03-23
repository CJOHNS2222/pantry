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
import { User, PantryItem, DayPlan, StructuredRecipe, Household, ShoppingItem, SavedRecipe, RecipeRating, RecipeSearchResult } from './types';
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
import featureFlags from './services/featureFlags';
import { isHouseholdMember, inferCategoryFromItemName, inferStorageLocationFromItemName, parseIngredientForShoppingList, getItemImage, fetchExternalItemImage } from './utils/appUtils';
import { getQuantityAmount } from './utils/quantityUtils';
import { NotificationBanner } from './components/NotificationBanner';
import { NotificationService, NotificationItem, NotificationSettings } from './services/notificationService';
import { markNotificationRead, deleteNotification, snoozeNotificationInCache } from './services/notificationsService';
import { log } from './services/logService';
import { pushNotificationService } from './services/pushNotificationService';
import { HouseholdActivityService } from './services/householdActivityService';
import { App as CapacitorApp, BackButtonListenerEvent } from '@capacitor/app';
import { AppProvider, useApp } from './contexts/AppContext';
import { AppActionsProvider, useAppActions } from './contexts/AppActionsContext';
import SafeAreaService from './services/safeAreaService';
import { GlobalUpdatePrompt } from './components/GlobalUpdatePrompt';
import { joinHousehold } from './services/householdService';
import { setAppContext, trackNavigation, trackShoppingListAction } from './services/sentryService';
import PerformanceMonitoringService from './services/performanceMonitoringService';
import HapticService from './services/hapticService';
import { ShoppingListCacheService } from './services/shoppingListCacheService';
import { MealPlanCacheService } from './services/MealPlanCacheService';
import { RecipesCacheService } from './services/recipesCacheService';
import { groceryPriceService } from './services/groceryPriceService';
import { PriceDataCacheService } from './services/priceDataCacheService'; // Import the service
import ExpiredItemsModal from './components/ExpiredItemsModal';
import { InventoryCacheService } from './services/inventoryCacheService';
import { useIntl } from 'react-intl';

// Lazy load monitoring components
const DatabaseAnalytics = React.lazy(() => import('./components/DatabaseAnalytics').then(module => ({ default: module.default })));

// Loading component for lazy-loaded components
const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center py-4">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--accent-color)]"></div>
  </div>
);

type Theme = 'dark' | 'light';

const App: React.FC = () => {
  const intl = useIntl();
  const [activeTab, setActiveTab] = useState<Tab>(Tab.PANTRY); // Default to pantry
  const prevActiveTabRef = useRef<Tab>(activeTab);
  const [persistedRecipeResult, setPersistedRecipeResult] = useState<RecipeSearchResult | null>(null);
  const [initialSearchQuery, setInitialSearchQuery] = useState<string>('');

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
    setActiveTab(tab);
    window.scrollTo(0, 0);
    
    PerformanceMonitoringService.mark(`tab_switch_end_${tab}`);
    PerformanceMonitoringService.measure(`tab_switch_${tab}`, `tab_switch_start_${tab}`, `tab_switch_end_${tab}`);
  };

  // UI States
  const [showHousehold, setShowHousehold] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showHouseholdInviteModal, setShowHouseholdInviteModal] = useState(false);
  const [showExpiredItemsModal, setShowExpiredItemsModal] = useState(false);
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
      expired_items_check: false
    }
  });

  const backButtonListenerRef = useRef<any>(null);

  const { user, setUser, handleLogout, isAuthReady } = useAuth(); // Use isAuthReady
  const { settings, setSettings } = useSettings();
  const { addToast, toasts, setToasts } = useToasts();
  const { syncStatus, syncNow, updateSyncStatus } = useOfflineStatus();

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
    const ns = (user as any)?.profile?.notificationSettings;
    if (ns) setNotificationSettings(ns as NotificationSettings);
  }, [user]);

  // Function to add items to shopping list
  const addToShoppingList = async (items: string[], source: string = 'manual') => {
    PerformanceMonitoringService.mark('shopping_list_add_start');
    
    trackShoppingListAction('add_item', { count: items.length, source });
    HapticService.itemAdded();
    
    const inHousehold = household?.id && isHouseholdMember(household, user);
    const householdId = inHousehold ? household.id : undefined;
    const userId = inHousehold ? undefined : user?.id;
    
    // Fetch prices in parallel
    const pricePromises = items.map(async (item) => {
      const parsed = parseIngredientForShoppingList(item);
      const priceData = await groceryPriceService.getIngredientPrice(parsed.itemName).catch(() => null);
      return {
        parsed,
        estimatedPrice: priceData?.averagePrice || 0
      };
    });
    
    const priceResults = await Promise.all(pricePromises);
    
    const newItems: ShoppingItem[] = [];
    for (const { parsed, estimatedPrice } of priceResults) {
      newItems.push({
        id: Math.random().toString(36).substr(2, 9),
        item: parsed.itemName,
        quantity: parsed.quantity,
        category: inferCategoryFromItemName(parsed.itemName),
        checked: false,
        source: source,
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

  // Household activity tracking
  const {
    recentActivities,
    isLoadingActivities,
    logActivity,
    logItemAdded,
    logItemRemoved,
    logShoppingAdded,
    logRecipeSaved,
    logMealCompleted
  } = useHouseholdActivity(user, null, activeTab); // Pass null for household initially

  const {
    inventory,
    setInventory,
    shoppingList,
    setShoppingList,
    savedRecipes,
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
    generateRecipeSuggestionsOnDemand,
    handleAddToPlan,
    addMealToPlan,
    updateMealOnPlan,
    removeMealFromPlan,
    handleSaveRecipe,
    handleDeleteRecipe,
    submitRating,
    getRatingsForRecipe,
    getCommunityRatings,
    handleMarkAsMade,
    updateItem,
    deleteItem,
    addItem,
    addItems,
    recentActions,
    recordUndo,
    performUndo,
    recipeSaveLimitExceeded,
    mealPlanLimitExceeded,
    checkRecipeSaveLimit,
    checkMealPlanLimit,
    addShoppingListItem,
    addShoppingListItems,
    updateShoppingListItem,
    updateShoppingListItems,
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
    logMealCompleted
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
      await NotificationService.markAsRead(notificationId);
    }
    setNotifications([]);
  };

  const handleNotificationAction = async (notification: NotificationItem) => {
    setNotifications([]);
    
    try {
      if (user?.id) {
        await markNotificationRead(user.id, notification.id);
      } else {
        await NotificationService.markAsRead(notification.id);
      }

      switch (notification.actionType) {
        case 'add_to_shopping':
          if (notification.actionData?.itemName) {
            addToShoppingList([notification.actionData.itemName]);
          }
          break;
        case 'view_recipe':
          if (notification.actionData?.recipeId) {
            setActiveTab(Tab.RECIPES);
          }
          break;
        case 'view_item':
          if (notification.actionData?.tab === 'shopping') {
            setActiveTab(Tab.SHOPPING);
          } else {
            setActiveTab(Tab.PANTRY);
          }
          break;
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
            } catch (error: any) {
              log.error('Error joining household', { error }, 'App');
              let message = 'Failed to join household';
              if (error.message?.includes('not invited')) {
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
      await NotificationService.snoozeNotification(notificationId, minutes);
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
    } catch (error: any) {
      log.error('Error accepting household invite', { error }, 'App');
      let message = 'Failed to join household';
      if (error.message?.includes('not invited')) {
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
    } catch (error: any) {
      log.error('Error declining household invite', { error }, 'App');
      addToast('Failed to decline invitation', 'error');
    }
  };

  const handleRemoveExpiredItems = async (itemIds: string[], disposalReason: string) => {
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
    const handleBackButton = (event: BackButtonListenerEvent) => {
      if (showNotificationsModal) {
        setShowNotificationsModal(false);
        return;
      }

      if (showHousehold) {
        setShowHousehold(false);
        return;
      }

      if (showHouseholdInviteModal) {
        setShowHouseholdInviteModal(false);
        return;
      }

      if (showExpiredItemsModal) {
        setShowExpiredItemsModal(false);
        return;
      }

      if (activeTab !== Tab.PANTRY) {
        setActiveTab(Tab.PANTRY);
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
    }).catch((error) => {
      log.error('Failed to add app URL open listener', { error }, 'App');
    });

    return () => {
      if (backButtonListenerRef.current && backButtonListenerRef.current.remove) {
        backButtonListenerRef.current.remove();
        backButtonListenerRef.current = null;
      }
    };
  }, [showNotificationsModal, showHousehold, showHouseholdInviteModal, showExpiredItemsModal, showOnboarding, activeTab, lastBackPress, addToast]);

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
      if (user && !user.householdId) {
        log.debug('Checking household invites for user', { userId: user.id });
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
        log.debug('Skipping household invite check - user has householdId or no user');
      }
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

  // Check for expired items when user logs in and has opted in
  useEffect(() => {
    const checkExpiredItems = async () => {
      if (user && notificationSettings.types.expired_items_check && inventory.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        const expiredItems = inventory.filter(item =>
          item.expirationDate && item.expirationDate <= today && !item.is_immortal
        );

        if (expiredItems.length > 0) {
          setShowExpiredItemsModal(true);
        }
      }
    };

    // Delay check to allow inventory to load
    const timer = setTimeout(checkExpiredItems, 2000);
    return () => clearTimeout(timer);
  }, [user, notificationSettings.types.expired_items_check, inventory]);

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
                if (user?.id) {
                  const userRef = DatabaseMonitoringService.doc('users', user.id);
                  await DatabaseMonitoringService.updateDoc(userRef, { hasSeenTutorial: true });
                  setUser(prev => prev ? { ...prev, hasSeenTutorial: true } : prev);
                }
              } catch (error) {
                log.error('Failed to mark onboarding complete', { error }, 'App');
              }
            }}
            onSkip={() => setShowOnboarding(false)}
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
              } catch (err) {
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
        />

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
                  const batches: any[] = [];
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
                    // Fallback: create a batch from the generic quantity field
                    batches.push({
                      batchId: Math.random().toString(36).substr(2,9),
                      quantity: Math.abs(addQty),
                      unit: undefined,
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
        <AppNavigation activeTab={activeTab} setActiveTab={switchTab} />
        
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

      <Suspense fallback={<LoadingSpinner />}>
        <DatabaseAnalytics />
      </Suspense>
    </>
  );
};

export default App;
