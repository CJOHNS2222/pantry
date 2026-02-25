import React, { useState, useEffect, useRef, Suspense } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import DatabaseMonitoringService from './services/databaseMonitoringService';
import { Login } from './components/Login';
import { HouseholdManager } from './components/Household';
import { Tutorial } from './components/Tutorial';
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
import { useHouseholdActivity } from './hooks/useHouseholdActivity';
import { useOfflineStatus } from './hooks/useOfflineStatus';
import AnalyticsService from './services/analyticsService';
import featureFlags from './services/featureFlags';
import { isHouseholdMember, inferCategoryFromItemName, inferStorageLocationFromItemName, parseIngredientForShoppingList, getItemImage, fetchExternalItemImage } from './utils/appUtils';
import { getQuantityAmount } from './utils/quantityUtils';
import { NotificationBanner } from './components/NotificationBanner';
import { NotificationService, NotificationItem, NotificationSettings } from './services/notificationService';
import { pushNotificationService } from './services/pushNotificationService';
import { log } from './services/logService';
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
import { groceryPriceService } from './services/groceryPriceService';
import { PriceDataCacheService } from './services/priceDataCacheService'; // Import the service

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
  const [showTutorial, setShowTutorial] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
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
      household_invite: true
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
      console.log("Auth is ready and user is logged in, loading price data...");
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
    
    const newItems: ShoppingItem[] = [];
    for (const item of items) {
      const parsed = parseIngredientForShoppingList(item);
      const estimatedPrice = await groceryPriceService.getIngredientPrice(parsed.itemName).then(priceData => priceData?.averagePrice || 0).catch(() => 0);
      
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
    
    setShoppingList(prev => [...prev, ...newItems]);
    
    const batch = [];
    for (const item of newItems) {
      batch.push(ShoppingListCacheService.addItemToCache(item, householdId, userId));
    }
    await Promise.all(batch);
    
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
    refreshCommunityRatings,
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
  } = useDataManagement(user, addToast, addToShoppingList, updateSyncStatus, {
    logItemAdded,
    logItemRemoved,
    logShoppingAdded,
    logRecipeSaved,
    logMealCompleted
  }, {
    disableInventoryListeners: activeTab === Tab.PANTRY_CACHE_TEST
  });

  useEffect(() => {
    // Refresh community ratings only when the tab transitions to COMMUNITY
    if (activeTab === Tab.COMMUNITY && prevActiveTabRef.current !== Tab.COMMUNITY && typeof refreshCommunityRatings === 'function') {
      refreshCommunityRatings().catch(error => log.error('Failed to refresh community ratings on tab activate', { error }, 'App'));
    }
    prevActiveTabRef.current = activeTab;
  }, [activeTab, refreshCommunityRatings]);

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
    await NotificationService.markAsRead(notificationId);
    setNotifications([]);
  };

  const handleNotificationAction = async (notification: NotificationItem) => {
    setNotifications([]);
    
    try {
      await NotificationService.markAsRead(notification.id);

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
    await NotificationService.snoozeNotification(notificationId, minutes);
    setNotifications([]);
  };

  const handleLogin = async (loggedInUser: User) => {
    const userRef = DatabaseMonitoringService.doc('users', loggedInUser.id);
    const userDoc = await DatabaseMonitoringService.getDoc(userRef);

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
    }

    setUser(loggedInUser);
    AnalyticsService.trackLogin(loggedInUser.provider || 'email');
    AnalyticsService.setUser(loggedInUser.id, {
      email: loggedInUser.email,
      provider: loggedInUser.provider,
      has_seen_tutorial: loggedInUser.hasSeenTutorial
    });

    // Determine whether to show the tutorial on first login.
    // Use Firestore flag first; support a localStorage fallback for offline/new-device scenarios.
    try {
      const seenFlag = !!loggedInUser.hasSeenTutorial;
      const localSeen = localStorage.getItem('tutorialSeen:v2') === 'true';
      const rolloutEnabled = typeof featureFlags?.isEnabled === 'function'
        ? featureFlags.isEnabled('newTutorial', loggedInUser.id)
        : false;

      if (!seenFlag) {
        // If the new tutorial rollout is enabled, respect localStorage fallback.
        if (rolloutEnabled) {
          if (!localSeen) setShowTutorial(true);
        } else {
          // Fallback to legacy behavior (show by default if user hasn't seen it)
          setShowTutorial(true);
        }
      }
    } catch (err) {
      // On any error, fall back to legacy behavior to avoid blocking users.
      if (!loggedInUser.hasSeenTutorial) setShowTutorial(true);
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

      if (showTutorial) {
        setShowTutorial(false);
        return;
      }

      if (showHousehold) {
        setShowHousehold(false);
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

    return () => {
      if (backButtonListenerRef.current && backButtonListenerRef.current.remove) {
        backButtonListenerRef.current.remove();
        backButtonListenerRef.current = null;
      }
    };
  }, [showNotificationsModal, showTutorial, showHousehold, activeTab, lastBackPress, addToast]);

  const [previousTab, setPreviousTab] = useState<Tab>(Tab.PANTRY);
  useEffect(() => {
    if (activeTab !== previousTab) {
      AnalyticsService.trackTabSwitch(previousTab, activeTab);
      setPreviousTab(activeTab);
    }
  }, [activeTab, previousTab]);

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
      const notificationsSection = document.querySelector('[data-section="notifications"]');
      if (notificationsSection) {
        notificationsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
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

        {showTutorial && (
          <Tutorial
            onClose={async () => {
              setShowTutorial(false);
              try {
                // Always set a local fallback so users on this device don't repeatedly see the tutorial
                localStorage.setItem('tutorialSeen:v2', 'true');
              } catch (e) {
                // ignore localStorage errors
              }

              if (user) {
                try {
                  await DatabaseMonitoringService.updateDoc(DatabaseMonitoringService.doc('users', user.id), { hasSeenTutorial: true });
                  setUser({ ...user, hasSeenTutorial: true });
                } catch (err) {
                  // If Firestore update fails, we've at least persisted locally
                  console.warn('Failed to persist tutorial seen flag to Firestore', err);
                }
              }
            }}
            onSwitchTab={setActiveTab}
            onOpenHousehold={() => setShowHousehold(true)}
            isHouseholdOpen={showHousehold}
            onCloseHousehold={() => setShowHousehold(false)}
            onToggleTheme={() => setSettings((prev: any) => ({
              ...prev,
              theme: {
                ...prev.theme,
                mode: prev.theme.mode === 'dark' ? 'light' : 'dark'
              }
            }))}
            onOpenRecipeSearch={() => { setActiveTab(Tab.MEALS); }}
            onOpenAnalytics={() => setActiveTab(Tab.SETTINGS)}
            currentTab={activeTab}
          />
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
        />
        
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
              onShowTutorial: () => setShowTutorial(true),
              onShowHousehold: () => setShowHousehold(true),
              checkRecipeSaveLimit,
              checkMealPlanLimit,
              addShoppingListItem
            }}
          >
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
