import React, { useState, useEffect, useRef, Suspense } from 'react';
import { doc, onSnapshot, collection, addDoc, serverTimestamp, query, where, updateDoc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from './firebaseConfig';
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
import { isHouseholdMember, inferCategoryFromItemName, inferStorageLocationFromItemName, parseIngredientForShoppingList, getItemImage, fetchExternalItemImage } from './utils/appUtils';
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
  const [persistedRecipeResult, setPersistedRecipeResult] = useState<RecipeSearchResult | null>(null);
  const [initialSearchQuery, setInitialSearchQuery] = useState<string>('');

  // Custom tab switching function that resets scroll position
  const switchTab = (tab: Tab) => {
    PerformanceMonitoringService.mark(`tab_switch_start_${tab}`);
    
    const tabNames = {
      [Tab.PANTRY]: 'pantry',
      [Tab.PANTRY_CACHE_TEST]: 'pantry_cache_test',
      [Tab.SHOPPING]: 'shopping',
      [Tab.MEALS]: 'meals',
      [Tab.RECIPES]: 'recipes',
      [Tab.SETTINGS]: 'settings',
      [Tab.COMMUNITY]: 'community'
    };
    
    trackNavigation(tabNames[activeTab] || 'unknown', tabNames[tab] || 'unknown');
    HapticService.tabSwitch();
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

  const { user, setUser, handleLogout } = useAuth();
  const { settings, setSettings } = useSettings();
  const { addToast, toasts, setToasts } = useToasts();
  // const { syncStatus, syncNow } = useOfflineStatus(); // DISABLED
  const { syncStatus, syncNow } = useOfflineStatus();

  // Apply theme to document
  useTheme(settings.theme);

  // Load notification settings from user profile
  useEffect(() => {
    if (user?.profile?.notificationSettings) {
      setNotificationSettings(user.profile.notificationSettings);
    }
  }, [user?.profile?.notificationSettings]);

  // Function to add items to shopping list
  const addToShoppingList = async (items: string[], source: string = 'manual') => {
    PerformanceMonitoringService.mark('shopping_list_add_start');
    
    trackShoppingListAction('add_item', { count: items.length, source });
    HapticService.itemAdded();
    
    const inHousehold = household?.id && isHouseholdMember(household, user);
    const householdId = inHousehold ? household.id : undefined;
    const userId = inHousehold ? undefined : user.id;
    
    // Create items with IDs and estimated prices
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
    
    // Update local state immediately for instant UI feedback
    setShoppingList(prev => [...prev, ...newItems]);
    
    // Batch write to cache
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
    household,
    setHousehold,
    consumptionSuggestions,
    expirationAlerts,
    recipeSuggestions,
    customCategories,
    addCustomCategory,
    updateCustomCategory,
    deleteCustomCategory,
    handleAddToPlan,
    handleSaveRecipe,
    handleDeleteRecipe,
    handleRateRecipe,
    handleMarkAsMade,
    // Item management with undo
    updateItem,
    deleteItem,
    addItem,
    addItems,
    // Undo
    recentActions,
    recordUndo,
    performUndo,
    // Usage limit states
    recipeSaveLimitExceeded,
    mealPlanLimitExceeded,
    // Limit checking functions
    checkRecipeSaveLimit,
    checkMealPlanLimit,
    // Manual sync functions
    syncShoppingListToDatabase,
    syncMealPlanToDatabase,
    syncSavedRecipesToDatabase,
    addShoppingListItem,
    // Loading states
    isLoadingInventory,
    isLoadingShoppingList,
    isLoadingMealPlan,
    isLoadingSavedRecipes,
    isLoadingRatings,
    isLoadingHousehold,
  } = useDataManagement(user, addToast, addToShoppingList, syncStatus.updateSyncStatus, {
    logItemAdded,
    logItemRemoved,
    logShoppingAdded,
    logRecipeSaved,
    logMealCompleted
  }, {
    disableInventoryListeners: activeTab === Tab.PANTRY_CACHE_TEST
  });

  // Update household activity tracking when household data becomes available
  useEffect(() => {
    if (user?.id && household?.id) {
      const activityMap = {
        [Tab.PANTRY]: 'viewing pantry',
        [Tab.PANTRY_CACHE_TEST]: 'testing cached pantry',
        [Tab.SHOPPING]: 'viewing shopping list',
        [Tab.MEALS]: 'viewing meal plan',
        [Tab.RECIPES]: 'viewing recipes',
        [Tab.SETTINGS]: 'viewing settings',
        [Tab.COMMUNITY]: 'viewing community'
      };

      const currentActivity = activityMap[activeTab] || 'using app';
      HouseholdActivityService.updateMemberActivity(user.id, household.id, currentActivity);
    }
  }, [user?.id, household?.id, activeTab]);

  // Initialize safe area handling for mobile devices
  useEffect(() => {
    SafeAreaService.initialize().catch(error => log.error('Failed to initialize safe area service', { error }, 'App'));
  }, []);

  // Initialize performance monitoring
  useEffect(() => {
    PerformanceMonitoringService.init();
    
    // Track app open
    PerformanceMonitoringService.mark('app_open');
    
    return () => {
      PerformanceMonitoringService.cleanup();
    };
  }, []);

  // Initialize push notifications for mobile devices
  useEffect(() => {
    if (user?.id) {
      pushNotificationService.initialize().catch(error => log.error('Failed to initialize push notifications', { error }, 'App'));
    }
  }, [user?.id]);

  // Initialize database monitoring
  useEffect(() => {
    if (user?.id) {
      // Database monitoring is now initialized in firebaseConfig.ts
    }
  }, [user?.id]);

  // Listen for notifications while user is logged in
  useEffect(() => {
    if (!user?.id) return;

    // Additional check to ensure Firebase auth is ready
    const auth = getAuth();
    if (!auth.currentUser) return;

    const checkAndShowNotifications = async () => {
      try {
        const unreadNotifications = await NotificationService.getUnreadNotifications(user.id, user.email);
        const filteredNotifications = unreadNotifications.filter(notification =>
          NotificationService.shouldShowNotification(notification, notificationSettings)
        );

        // Show the highest priority notification that hasn't been shown recently
        if (filteredNotifications.length > 0) {
          const highestPriority = filteredNotifications.reduce((prev, current) =>
            getPriorityWeight(current.priority) > getPriorityWeight(prev.priority) ? current : prev
          );

          // Only show if we haven't shown a notification in the last 5 minutes
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

    // Check immediately and then every 5 minutes
    checkAndShowNotifications();
    const interval = setInterval(checkAndShowNotifications, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user?.id, notificationSettings]);

  // Helper function to get priority weight for sorting
  const getPriorityWeight = (priority: string): number => {
    switch (priority) {
      case 'urgent': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  };

  // Notification handlers
  const handleNotificationDismiss = async (notificationId: string) => {
    await NotificationService.markAsRead(notificationId);
    setNotifications([]);
  };

  const handleNotificationAction = async (notification: NotificationItem) => {
    // Mark as read immediately to prevent multiple clicks
    setNotifications([]);
    
    try {
      // Mark as read in database
      await NotificationService.markAsRead(notification.id);

      // Handle the action
      switch (notification.actionType) {
        case 'add_to_shopping':
          if (notification.actionData?.itemName) {
            addToShoppingList([notification.actionData.itemName]);
          }
          break;
        case 'view_recipe':
          if (notification.actionData?.recipeId) {
            setActiveTab(Tab.RECIPES);
            // Could scroll to specific recipe or set search
          }
          break;
        case 'view_item':
          if (notification.actionData?.tab === 'shopping') {
            setActiveTab(Tab.SHOPPING);
          }
          break;
        case 'join_household':
          // Join household invitation
          if (notification.actionData?.householdId && user) {
            try {
              // Use the household service to join
              const updatedHousehold = await joinHousehold(notification.actionData.householdId, user);
              
              if (updatedHousehold) {
                // Update local user state with householdId
                setUser({ ...user, householdId: notification.actionData.householdId });
                
                // Update local household state
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
    // Update user document with login data
    const userRef = doc(db, 'users', loggedInUser.id);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      // Create user document if it doesn't exist
      await setDoc(userRef, {
        name: loggedInUser.name,
        email: loggedInUser.email,
        subscription: {
          tier: 'premium',
          status: 'active',
          current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
          cancel_at_period_end: false
        },
        createdAt: serverTimestamp(),
        hasSeenTutorial: false
      });
    } else {
      // Update existing user document with name if it's missing or different
      const userData = userDoc.data();
      if (!userData?.name || userData.name !== loggedInUser.name) {
        await updateDoc(userRef, {
          name: loggedInUser.name,
          updatedAt: serverTimestamp()
        });
      }
    }

    setUser(loggedInUser);

    // Track login event
    AnalyticsService.trackLogin(loggedInUser.provider || 'email');

    // Set user properties for analytics
    AnalyticsService.setUser(loggedInUser.id, {
      email: loggedInUser.email,
      provider: loggedInUser.provider,
      has_seen_tutorial: loggedInUser.hasSeenTutorial
    });

    if (!loggedInUser.hasSeenTutorial) setShowTutorial(true);
  };

  // Notifications are now handled by the real-time listener above

  // Track app lifecycle events
  useEffect(() => {
    // Initialize image cache system
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

  // Handle back button for mobile navigation
  const [lastBackPress, setLastBackPress] = useState<number>(0);
  useEffect(() => {
    const handleBackButton = (event: BackButtonListenerEvent) => {
      // Close modals in priority order
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

      // Navigate back to default tab if not already there
      if (activeTab !== Tab.PANTRY) {
        setActiveTab(Tab.PANTRY);
        return;
      }

      // Handle double-tap to exit on pantry tab
      const currentTime = Date.now();
      const timeDiff = currentTime - lastBackPress;

      if (timeDiff < 2000) { // 2 seconds window for double tap
        // Double tap detected - exit app
        CapacitorApp.exitApp();
      } else {
        // Single tap - show message and auto-dismiss after 2 seconds
        const toastId = 'exit-app';
        addToast('Press back again to exit', 'info', 2000);
        setLastBackPress(currentTime);
      }
    };

    // Add back button listener
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

  // Track tab switches
  const [previousTab, setPreviousTab] = useState<Tab>(Tab.PANTRY);
  useEffect(() => {
    if (activeTab !== previousTab) {
      AnalyticsService.trackTabSwitch(previousTab, activeTab);
      setPreviousTab(activeTab);
    }
  }, [activeTab, previousTab]);

  if (!user) return <Login onLogin={handleLogin} />;

  // Function to navigate to settings and scroll to notifications
  const navigateToNotifications = () => {
    setActiveTab(Tab.SETTINGS);
    // Scroll to notifications section after a short delay to allow settings to render
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
        // Set app context for Sentry
        if (settings?.theme) {
          setAppContext(
            process.env.npm_package_version || '1.0.0',
            'web', // Default to web, Capacitor will override if needed
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
              // Mark tutorial as seen
              if (user) {
                const { doc, updateDoc } = await import('firebase/firestore');
                await updateDoc(doc(db, 'users', user.id), { hasSeenTutorial: true });
                setUser({ ...user, hasSeenTutorial: true });
              }
            }}
            onSwitchTab={setActiveTab}
            onOpenHousehold={() => setShowHousehold(true)}
            onCloseHousehold={() => setShowHousehold(false)}
            onToggleTheme={() => setSettings(prev => ({
              ...prev,
              theme: {
                ...prev.theme,
                mode: prev.theme.mode === 'dark' ? 'light' : 'dark'
              }
            }))}
            onOpenRecipeSearch={() => {
              // Switch to meals tab and trigger recipe search modal
              setActiveTab(Tab.MEALS);
              // The tutorial will handle opening the modal after a delay
            }}
            onOpenAnalytics={() => setActiveTab(Tab.SETTINGS)}
            currentTab={activeTab}
          />
        )}

        {/* Notifications Modal */}
        {showNotificationsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6 pb-2.5">
                <h2 className="text-xl font-bold mb-4 text-gray-800">Notifications</h2>
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div key={notification.id} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      {notification.type === 'household_invite' ? (
                        <div>
                          <p className="text-gray-800 font-medium">{notification.message}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            You can now share pantry items, meal plans, and shopping lists with your household members.
                          </p>
                          <button
                            onClick={async () => {
                              // Load the household data
                              const { doc, getDoc, writeBatch } = await import('firebase/firestore');
                              const householdDoc = await getDoc(doc(db, 'households', notification.householdId));
                              if (householdDoc.exists()) {
                                const householdData = householdDoc.data();
                                setHousehold({
                                  id: notification.householdId,
                                  name: householdData.name,
                                  members: householdData.members || [],
                                  memberIds: householdData.memberIds || []
                                });
                              }
                              
                              // Mark this notification as read
                              const batch = writeBatch(db);
                              batch.update(doc(db, 'notifications', notification.id), { read: true });
                              await batch.commit();
                              
                              setActiveTab(Tab.PANTRY); // Go to pantry tab instead of household
                              setShowNotificationsModal(false);
                              
                              // Remove this notification from the local state
                              setNotifications(prev => prev.filter(n => n.id !== notification.id));
                            }}
                            className="mt-3 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
                          >
                            Join Household
                          </button>
                        </div>
                      ) : (
                        <p className="text-gray-800">{notification.message}</p>
                      )}
                      <p className="text-sm text-gray-500 mt-2">
                        {notification.timestamp?.toDate?.()?.toLocaleString() || 'Just now'}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      // Mark notifications as read
                      import('firebase/firestore').then(async ({ writeBatch, doc }) => {
                        const batch = writeBatch(db);
                        notifications.forEach(notification => {
                          batch.update(doc(db, 'notifications', notification.id), { read: true });
                        });
                        await batch.commit();
                        setNotifications([]);
                        setShowNotificationsModal(false);
                      });
                    }}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Mark as Read
                  </button>
                  <button
                    onClick={() => setShowNotificationsModal(false)}
                    className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                  >
                    Close
                  </button>
                </div>
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
        />
        
        <AppProvider
          value={{
            activeTab,
            setActiveTab: switchTab,
            user,
            household,
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
            isLoadingRatings,
            isLoadingHousehold,
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
              onAddToPlan: handleAddToPlan,
              onSaveRecipe: handleSaveRecipe,
              onDeleteRecipe: handleDeleteRecipe,
              onRateRecipe: handleRateRecipe,
              handleMarkAsMade,
              onMoveToPantry: async (items) => {
                // Process items and fetch external images for new items that don't have local images
                const processedItems = await Promise.all(items.map(async (i) => {
                  const category = inferCategoryFromItemName(i.item);
                  let image = getItemImage(i.item, category);
                  
                  // If it's a placeholder, try to fetch an external image
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
                  
                  let addQty = i.purchasedQuantity ? i.purchasedQuantity.amount : (i.quantity ? parseFloat(i.quantity.toString()) || 1 : 1);
                  if (addQty < 1) addQty = 1;
                  
                  // Parse recipe reservations from source
                  const reservations: { recipeId: string; recipeName: string; quantity: number; unit: string }[] = [];
                  if (i.source?.startsWith('recipe: need ')) {
                    // Format: "recipe: need 1.5 oz for "Recipe Name""
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
                  
                  return {
                    id: Math.random().toString(36).substr(2,9),
                    item: i.item,
                    category,
                    quantity_estimate: Math.abs(addQty).toString(),
                    storageLocation: inferStorageLocationFromItemName(i.item),
                    image,
                    originalQuantity: i.purchasedQuantity ? `${i.purchasedQuantity.amount} ${i.purchasedQuantity.unit}` : (typeof i.quantity === 'string' ? i.quantity : undefined),
                    reservations
                  };
                }));
                
                // Add all merged items immediately (addItems will handle merging with existing inventory)
                const addedItems = await addItems(Object.values(processedItems));

                // Remove items from shopping list
                setShoppingList(prev => prev.filter(item => !items.find(moved => moved.id === item.id)));
                
                // Sync shopping list to database after removing items
                setTimeout(() => {
                  syncShoppingListToDatabase();
                }, 100);

                // Show toast asking to edit quantities
                addToast(
                  `Added ${items.length} item${items.length > 1 ? 's' : ''} to pantry. Edit quantities?`,
                  'info',
                  8000,
                  'Edit Quantities',
                  () => {
                    // Store the added items for quantity editing
                    localStorage.setItem('pendingQuantityEdits', JSON.stringify(addedItems));
                    // Switch to pantry tab and trigger quantity editing workflow
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
        
        {/* Household Manager Modal */}
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

        {/* Notification Banner */}
        {notifications.length > 0 && (
          <NotificationBanner
            notification={notifications[0]}
            onDismiss={handleNotificationDismiss}
            onAction={handleNotificationAction}
            onSnooze={handleNotificationSnooze}
          />
        )}

        {/* Toast Notifications */}
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

      {/* Global Update Prompt */}
      <GlobalUpdatePrompt />

      {/* Database Analytics Dashboard - Lazy loaded */}
      <Suspense fallback={<LoadingSpinner />}>
        <DatabaseAnalytics />
      </Suspense>
    </>
  );
};

export default App;



