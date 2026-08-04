import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import DatabaseMonitoringService from './services/databaseMonitoringService';
import { Login } from './components/auth-onboarding/Login';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { AppLoadingScreen } from './components/ui/AppLoadingScreen';
import { AppHeader } from './components/layout/AppHeader';
import { AppNavigation } from './components/layout/AppNavigation';
import { MainContent } from './components/layout/MainContent';
import { AppGlobalModals } from './components/layout/AppGlobalModals';
import { User, Household, RecipeSearchResult, UserProfile } from './types';
import { Tab } from './types/app';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { useSettings } from './hooks/useSettings';
import { useToast } from './components/ui/Toast';
import { useDataManagement } from './hooks/useDataManagement';
import { useHouseholdActivity } from './hooks/useHouseholdActivity';
import { HouseholdActivityService } from './services/householdActivityService';
import { useOfflineStatus } from './hooks/useOfflineStatus';
import AnalyticsService from './services/analyticsService';
import { SubscriptionProvider } from './hooks/useSubscription';
import { NotificationBanner } from './components/ui/NotificationBanner';
import { NotificationSettings } from './services/notificationService';
import { setAppContext } from './services/sentryService';
import { AppProvider } from './contexts/AppContext';
import { AppActionsProvider } from './contexts/AppActionsContext';
import { useStableCallback } from './hooks/useStableCallback';
import { GlobalUpdatePrompt } from './components/ui/GlobalUpdatePrompt';
import remoteConfig from './services/remoteConfigService';
import { useIsAdmin } from './hooks/useIsAdmin';
import { useKeyboard } from './hooks/useKeyboard';
import { useNotificationPolling } from './hooks/useNotificationPolling';
import { useHouseholdMigrationRetry } from './hooks/useHouseholdMigrationRetry';

// Modular hooks for App orchestrator
import { useNavigationState } from './hooks/useNavigationState';
import { useAppLifecycle } from './hooks/useAppLifecycle';
import { useAppModals } from './hooks/useAppModals';
import { useNotificationHandlers } from './hooks/useNotificationHandlers';
import { useFeatureMilestones } from './hooks/useFeatureMilestones';
import { usePantryShoppingActions } from './hooks/usePantryShoppingActions';

const App: React.FC = () => {
  const { user, setUser, handleLogout, isAuthReady } = useAuth();
  const { settings, setSettings } = useSettings();
  useTheme(settings.theme);
  const toast = useToast();

  const {
    activeTab,
    setActiveTab,
    switchTab,
    applyTabChange,
    tabHistoryRef,
    activeSettingsCategory,
    setActiveSettingsCategory,
  } = useNavigationState(settings.navigation?.hiddenTabs);

  const [persistedRecipeResult, setPersistedRecipeResult] = useState<RecipeSearchResult | null>(null);
  const [initialSearchQuery, setInitialSearchQuery] = useState<string>('');
  const isKeyboardVisible = useKeyboard();

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    enabled: true,
    quietHours: { enabled: false, start: '22:00', end: '08:00' },
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

  const { notifications, setNotifications } = useNotificationPolling(user, notificationSettings);

  const addToast = useCallback((
    message: string,
    type: 'success' | 'error' | 'info' | 'warning' = 'info',
    ttl?: number,
    actionLabel?: string,
    action?: () => void,
  ) => {
    const opts = {
      duration: ttl,
      action: actionLabel && action ? { label: actionLabel, onClick: action } : undefined,
    };
    switch (type) {
      case 'success': toast.success(message, opts); break;
      case 'error':   toast.error(message, opts);   break;
      case 'warning': toast.warning(message, opts); break;
      default:        toast.info(message, opts);    break;
    }
  }, [toast]);

  const { syncStatus, syncNow, updateSyncStatus } = useOfflineStatus();
  const { isAdmin } = useIsAdmin(user?.id);

  // App lifecycle listeners (camera restore, back button, push, admob, currency)
  useAppLifecycle({
    user,
    activeTab,
    applyTabChange,
    tabHistoryRef,
    addToast,
    isAuthReady,
  });

  // Household activity stream
  const [activityHousehold, setActivityHousehold] = useState<Household | null>(null);
  const {
    recentActivities,
    isLoadingActivities,
    logItemAdded,
    logItemRemoved,
    logShoppingAdded,
    logRecipeSaved,
    logMealCompleted,
    updateActivityStatus
  } = useHouseholdActivity(user, activityHousehold);

  // Forward ref for addToShoppingList so useDataManagement can invoke it safely
  const addToShoppingListRef = useRef<(items: (string | { item: string; source: string; notes?: string })[], defaultSource?: string) => Promise<void>>(() => Promise.resolve());
  const handleAddToShoppingListWrapper = useCallback((items: (string | { item: string; source: string; notes?: string })[], defaultSource?: string) => {
    return addToShoppingListRef.current(items, defaultSource);
  }, []);

  // Core data management hook
  const {
    inventory,
    setInventory,
    shoppingList,
    setShoppingList,
    savedRecipes,
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
    handleAddToPlan,
    handleSaveRecipe,
    handleDeleteRecipe,
    submitRating,
    handleMarkAsMade,
    updateItem,
    deleteItem,
    deleteItems,
    addItem,
    addItems,
    recentActions,
    performUndo,
    recipeSaveLimitExceeded,
    mealPlanLimitExceeded,
    checkRecipeSaveLimit,
    checkMealPlanLimit,
    addShoppingListItem,
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
  } = useDataManagement(user, addToast, handleAddToShoppingListWrapper, updateSyncStatus, {
    logItemAdded,
    logItemRemoved,
    logShoppingAdded,
    logRecipeSaved,
    logMealCompleted,
    updateActivityStatus
  }, {
    onShowAddToPlanDialog: (recipe) => {
      modals.setPendingRecipeForPlan(recipe);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);
      const tomorrowIndex = mealPlan?.findIndex(day => day.date?.slice(0, 10) === tomorrowStr) ?? -1;
      modals.setSelectedDayForPlan(tomorrowIndex >= 0 ? tomorrowIndex : 0);
      modals.setSelectedMealForPlan('dinner');
      modals.setShowAddToPlanDialog(true);
    },
    settings
  });

  // Pantry & Shopping List action helpers
  const { addToShoppingList, handleMoveToPantry } = usePantryShoppingActions({
    user,
    household,
    setShoppingList,
    setActiveTab,
    addItems,
    removeShoppingListItems,
    syncNow,
    addToast,
  });

  useEffect(() => {
    addToShoppingListRef.current = addToShoppingList;
  }, [addToShoppingList]);

  // App Modals manager
  const modals = useAppModals({
    user,
    inventory,
    savedRecipes,
    mealPlan,
    household,
    isLoadingInventory,
    isLoadingSavedRecipes,
    isLoadingMealPlan,
    isLoadingHousehold,
  });

  // Notification handlers
  const notificationHandlers = useNotificationHandlers({
    user,
    setUser,
    setHousehold,
    inventory,
    addToShoppingList,
    setActiveTab,
    addToast,
    setNotifications,
    setShowHouseholdInviteModal: modals.setShowHouseholdInviteModal,
    householdInvites: modals.householdInvites,
    setHouseholdInvites: modals.setHouseholdInvites,
    setExpiredItemsModalSpecificItems: modals.setExpiredItemsModalSpecificItems,
    setShowExpiredItemsModal: modals.setShowExpiredItemsModal,
    setNotificationViewItem: modals.setNotificationViewItem,
  });

  // Progressive feature disclosure & contextual tips
  const featureMilestones = useFeatureMilestones({
    user,
    activeTab,
    inventory,
    shoppingList,
    mealPlan,
    savedRecipes,
    household,
    setActiveTab,
    setShowHousehold: modals.setShowHousehold,
  });

  // Sync household to activity stream
  useEffect(() => {
    setActivityHousehold(household ?? null);
  }, [household]);

  // Sync notification settings from profile
  useEffect(() => {
    const ns = (user as User & { profile?: UserProfile & { notificationSettings?: NotificationSettings } })?.profile?.notificationSettings;
    if (ns) setNotificationSettings(ns as NotificationSettings);
  }, [user]);

  // Toast activity stream updates from household members
  const lastSeenActivityIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!recentActivities.length) return;
    const lastSeenId = lastSeenActivityIdRef.current;
    if (lastSeenId === null) {
      lastSeenActivityIdRef.current = recentActivities[0].id;
      return;
    }
    const lastSeenIndex = recentActivities.findIndex(a => a.id === lastSeenId);
    const newActivities = lastSeenIndex === -1 ? [] : recentActivities.slice(0, lastSeenIndex);
    for (let i = newActivities.length - 1; i >= 0; i--) {
      const activity = newActivities[i];
      if (activity.userId !== user?.id) {
        addToast(HouseholdActivityService.getActivityMessage(activity), 'info', 4000);
      }
    }
    lastSeenActivityIdRef.current = recentActivities[0].id;
  }, [recentActivities, user?.id, addToast]);

  useEffect(() => {
    lastSeenActivityIdRef.current = null;
  }, [activityHousehold?.id]);

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
      updateActivityStatus(currentActivity);
    }
  }, [user?.id, household?.id, activeTab, updateActivityStatus]);

  const handleLogin = async (loggedInUser: User) => {
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
        hasSeenTutorial: false,
        discoveredFeatures: [],
        dismissedTutorialTips: []
      });
    } else {
      const userData = userDoc.data();
      if (!userData?.name || userData.name !== loggedInUser.name) {
        await DatabaseMonitoringService.updateDoc(userRef, {
          name: loggedInUser.name,
          updatedAt: serverTimestamp()
        });
      }
      finalUser = {
        ...loggedInUser,
        hasSeenTutorial: userData?.hasSeenTutorial ?? false,
        discoveredFeatures: userData?.discoveredFeatures || [],
        dismissedTutorialTips: userData?.dismissedTutorialTips || []
      };
    }

    setUser(finalUser);
    AnalyticsService.trackLogin(finalUser.provider || 'email');
    AnalyticsService.setUser(finalUser.id, {
      email: finalUser.email,
      provider: finalUser.provider,
      has_seen_tutorial: finalUser.hasSeenTutorial
    });

    if (!finalUser.hasSeenTutorial && localStorage.getItem('onboarding-completed') !== 'true') {
      modals.setShowOnboarding(true);
    }
  };

  useHouseholdMigrationRetry(user, addToast);

  useEffect(() => {
    if (settings?.theme?.mode) {
      setAppContext(
        process.env.npm_package_version || '1.0.0',
        'web',
        settings.theme.mode
      );
    }
  }, [settings?.theme?.mode]);

  const stableSwitchTab = useStableCallback(switchTab);
  const stableSetActiveTab = useStableCallback(setActiveTab);
  const stableSetInventory = useStableCallback(setInventory);
  const stableSetShoppingList = useStableCallback(setShoppingList);
  const stableSetMealPlan = useStableCallback(setMealPlan);
  const stableSetPersistedRecipeResult = useStableCallback(setPersistedRecipeResult);
  const stableSetInitialSearchQuery = useStableCallback(setInitialSearchQuery);
  const stableSetSettings = useStableCallback(setSettings);
  const stableSetActiveSettingsCategory = useStableCallback(setActiveSettingsCategory);
  const stableSetLoadingRatingsComplete = useStableCallback(setLoadingRatingsComplete);
  const stableUpdateItem = useStableCallback(updateItem);
  const stableDeleteItem = useStableCallback(deleteItem);
  const stableDeleteItems = useStableCallback(deleteItems);
  const stableAddItem = useStableCallback(addItem);
  const stableAddItems = useStableCallback(addItems);
  const stableUpdateMealPlan = useStableCallback(updateMealPlan);
  const stableHandleAddToPlan = useStableCallback(handleAddToPlan);
  const stableHandleSaveRecipe = useStableCallback(handleSaveRecipe);
  const stableHandleDeleteRecipe = useStableCallback(handleDeleteRecipe);
  const stableSubmitRating = useStableCallback(submitRating);
  const stableHandleMarkAsMade = useStableCallback(handleMarkAsMade);
  const stableAddToShoppingList = useStableCallback(addToShoppingList);
  const stableAddShoppingListItem = useStableCallback(addShoppingListItem);
  const stableAddCustomCategory = useStableCallback(addCustomCategory);
  const stableUpdateCustomCategory = useStableCallback(updateCustomCategory);
  const stableDeleteCustomCategory = useStableCallback(deleteCustomCategory);
  const stableAddToast = useStableCallback(addToast);
  const stableHandleLogout = useStableCallback(handleLogout);
  const stableCheckRecipeSaveLimit = useStableCallback(checkRecipeSaveLimit);
  const stableCheckMealPlanLimit = useStableCallback(checkMealPlanLimit);
  const stableRefreshAllData = useStableCallback(refreshAllData);

  const handleShowHousehold = useStableCallback(() => modals.setShowHousehold(true));
  const handleReplayOnboarding = useStableCallback(() => {
    localStorage.removeItem('onboarding-completed');
    localStorage.removeItem('onboarding-checklist-dismissed');
    modals.setShowOnboarding(true);
  });

  const appContextValue = useMemo(() => ({
    activeTab,
    setActiveTab: stableSwitchTab,
    user: user as User,
    household: household ?? undefined,
    inventory,
    setInventory: stableSetInventory,
    shoppingList,
    setShoppingList: stableSetShoppingList,
    mealPlan,
    setMealPlan: stableSetMealPlan,
    savedRecipes,
    ratings,
    persistedRecipeResult,
    setPersistedRecipeResult: stableSetPersistedRecipeResult,
    initialSearchQuery,
    setInitialSearchQuery: stableSetInitialSearchQuery,
    settings,
    setSettings: stableSetSettings,
    customCategories,
    activeSettingsCategory,
    recipeSaveLimitExceeded,
    mealPlanLimitExceeded,
    isLoadingInventory,
    isLoadingShoppingList,
    isLoadingMealPlan,
    isLoadingSavedRecipes,
    isLoadingHousehold,
    isLoadingRatings,
    setLoadingRatingsComplete: stableSetLoadingRatingsComplete,
    consumptionSuggestions,
    expirationAlerts,
    recipeSuggestions,
    recentActivities,
    isLoadingActivities
  }), [activeTab, user, household, inventory, shoppingList, mealPlan, savedRecipes, ratings,
    persistedRecipeResult, initialSearchQuery, settings, customCategories, activeSettingsCategory,
    recipeSaveLimitExceeded, mealPlanLimitExceeded, isLoadingInventory, isLoadingShoppingList,
    isLoadingMealPlan, isLoadingSavedRecipes, isLoadingHousehold, isLoadingRatings,
    consumptionSuggestions, expirationAlerts, recipeSuggestions, recentActivities, isLoadingActivities]);

  const appActionsValue = useMemo(() => ({
    setActiveTab: stableSetActiveTab,
    updateItem: stableUpdateItem,
    deleteItem: stableDeleteItem,
    deleteItems: stableDeleteItems,
    addItem: stableAddItem,
    addItems: stableAddItems,
    setInventory: stableSetInventory,
    setShoppingList: stableSetShoppingList,
    setMealPlan: stableSetMealPlan,
    updateMealPlan: stableUpdateMealPlan,
    onAddToPlan: stableHandleAddToPlan,
    onSaveRecipe: stableHandleSaveRecipe,
    onDeleteRecipe: stableHandleDeleteRecipe,
    onRateRecipe: stableSubmitRating,
    handleMarkAsMade: stableHandleMarkAsMade,
    onMoveToPantry: handleMoveToPantry,
    onAddToShoppingList: stableAddToShoppingList,
    addShoppingListItem: stableAddShoppingListItem,
    setSettings: stableSetSettings,
    onAddCustomCategory: stableAddCustomCategory,
    onUpdateCustomCategory: stableUpdateCustomCategory,
    onDeleteCustomCategory: stableDeleteCustomCategory,
    setActiveSettingsCategory: stableSetActiveSettingsCategory,
    addToast: stableAddToast,
    setInitialSearchQuery: stableSetInitialSearchQuery,
    setPersistedRecipeResult: stableSetPersistedRecipeResult,
    onLogout: stableHandleLogout,
    onShowHousehold: handleShowHousehold,
    checkRecipeSaveLimit: stableCheckRecipeSaveLimit,
    checkMealPlanLimit: stableCheckMealPlanLimit,
    refreshAllData: stableRefreshAllData,
    onReplayOnboarding: handleReplayOnboarding,
  }), [stableSetActiveTab, stableUpdateItem, stableDeleteItem, stableDeleteItems, stableAddItem,
    stableAddItems, stableSetInventory, stableSetShoppingList, stableSetMealPlan, stableUpdateMealPlan,
    stableHandleAddToPlan, stableHandleSaveRecipe, stableHandleDeleteRecipe, stableSubmitRating,
    stableHandleMarkAsMade, handleMoveToPantry, stableAddToShoppingList, stableAddShoppingListItem,
    stableSetSettings, stableAddCustomCategory, stableUpdateCustomCategory, stableDeleteCustomCategory,
    stableSetActiveSettingsCategory, stableAddToast, stableSetInitialSearchQuery,
    stableSetPersistedRecipeResult, stableHandleLogout, handleShowHousehold, stableCheckRecipeSaveLimit,
    stableCheckMealPlanLimit, stableRefreshAllData, handleReplayOnboarding]);

  if (!isAuthReady) {
    return <AppLoadingScreen />;
  }

  if (!user) return <Login onLogin={handleLogin} />;

  const navigateToNotifications = () => {
    sessionStorage.setItem('settings_redirect_tab', 'notifications');
    setActiveTab(Tab.SETTINGS);
  };

  const maintenanceInfo = remoteConfig.getMaintenanceInfo();
  const announcementInfo = remoteConfig.getAnnouncementInfo();

  return (
    <SubscriptionProvider user={user}>
      <ErrorBoundary>
        <div className="h-screen flex flex-col max-w-md md:max-w-lg lg:max-w-2xl mx-auto shadow-2xl relative border-x border-theme transition-colors duration-300 overflow-x-hidden">
          <AppHeader
            user={user}
            household={household}
            settings={settings}
            setSettings={setSettings}
            onShowHousehold={() => modals.setShowHousehold(true)}
            recentActions={recentActions}
            onUndo={performUndo}
            syncStatus={syncStatus}
            onSyncClick={syncNow}
            onNavigateToSettings={navigateToNotifications}
            onNotificationAction={n => notificationHandlers.handleNotificationAction(n as Parameters<typeof notificationHandlers.handleNotificationAction>[0])}
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

          {modals.householdInvites.length > 0 && !modals.showHouseholdInviteModal && (
            <div className="sticky top-[calc(var(--safe-area-top,0px)+56px)] z-10 mx-auto max-w-md md:max-w-lg lg:max-w-2xl px-3 pt-1">
              <button
                onClick={() => modals.setShowHouseholdInviteModal(true)}
                className="w-full flex items-center justify-between gap-2 bg-[var(--accent-color)] text-[var(--accent-text,white)] px-4 py-2 rounded-lg shadow-md text-sm font-medium animate-pulse-subtle"
              >
                <span>🏠 You have {modals.householdInvites.length === 1 ? 'a pending household invitation' : `${modals.householdInvites.length} household invitations`}</span>
                <span className="underline whitespace-nowrap">View →</span>
              </button>
            </div>
          )}

          <AppProvider value={appContextValue}>
            <AppActionsProvider value={appActionsValue}>
              <MainContent />
            </AppActionsProvider>
          </AppProvider>

          <AppNavigation activeTab={activeTab} setActiveTab={switchTab} hiddenTabs={settings.navigation?.hiddenTabs} isKeyboardVisible={isKeyboardVisible} />

          {notifications.length > 0 && (
            <div className="fixed top-4 left-0 right-0 z-50 flex flex-col items-center gap-2 pointer-events-none pb-4 px-4 overflow-y-auto max-h-[50vh]">
              {notifications.map((notification) => (
                <div key={notification.id} className="pointer-events-auto w-full">
                  <NotificationBanner
                    notification={notification}
                    onDismiss={notificationHandlers.handleNotificationDismiss}
                    onAction={notificationHandlers.handleNotificationAction}
                    onSnooze={notificationHandlers.handleNotificationSnooze}
                  />
                </div>
              ))}
            </div>
          )}

          <AppGlobalModals
            user={user}
            setUser={setUser}
            household={household}
            setHousehold={setHousehold}
            inventory={inventory}
            mealPlan={mealPlan}
            savedRecipesCount={savedRecipes.length}
            customCategories={customCategories}
            isAdmin={isAdmin}
            recipeSaveLimitExceeded={recipeSaveLimitExceeded}
            mealPlanLimitExceeded={mealPlanLimitExceeded}
            showRiskQuestionnaire={showRiskQuestionnaire}
            handleRiskQuestionnaireComplete={handleRiskQuestionnaireComplete}
            updateItem={updateItem}
            deleteItem={deleteItem}
            deleteItems={deleteItems}
            handleAddToPlan={handleAddToPlan}
            handleSaveRecipe={handleSaveRecipe}
            handleDeleteRecipe={handleDeleteRecipe}
            submitRating={submitRating}
            handleMarkAsMade={handleMarkAsMade}
            addToShoppingList={addToShoppingList}
            setActiveTab={setActiveTab}
            addToast={addToast}
            modals={modals}
            notificationHandlers={notificationHandlers}
            featureMilestones={featureMilestones}
          />
        </div>
      </ErrorBoundary>

      <GlobalUpdatePrompt />
    </SubscriptionProvider>
  );
};

export default App;
