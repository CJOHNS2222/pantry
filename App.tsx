import React, { useState, useEffect, useRef, Suspense } from 'react';
import { doc, onSnapshot, collection, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
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
import { useOfflineStatus } from './hooks/useOfflineStatus';
import AnalyticsService from './services/analyticsService';
import { isHouseholdMember, inferCategoryFromItemName, inferStorageLocationFromItemName, parseIngredientForShoppingList, getItemImage, fetchExternalItemImage } from './utils/appUtils';
import { getOrCreateHousehold } from './services/householdService';
import { GlobalUpdatePrompt } from './components/GlobalUpdatePrompt';
import { App as CapacitorApp, BackButtonListenerEvent } from '@capacitor/app';
import SafeAreaService from './services/safeAreaService';

// Lazy load monitoring components
// const DatabaseAnalytics = React.lazy(() => import('./components/DatabaseAnalytics').then(module => ({ default: module.default })));

// Loading component for lazy-loaded components
const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center py-4">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--accent-color)]"></div>
  </div>
);

type Theme = 'dark' | 'light';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.PANTRY);
  const [persistedRecipeResult, setPersistedRecipeResult] = useState<RecipeSearchResult | null>(null);
  const [initialSearchQuery, setInitialSearchQuery] = useState<string>('');

  // UI States
  const [showTutorial, setShowTutorial] = useState(false);
  const [showHousehold, setShowHousehold] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  // Ref to store the back button listener
  const backButtonListenerRef = useRef<any>(null);

  // Custom hooks
  const { user, setUser, handleLogout } = useAuth();
  const { settings, setSettings } = useSettings();
  const { theme } = useTheme(settings.theme);
  const { toasts, setToasts, addToast } = useToasts();
  const { syncStatus, syncNow } = useOfflineStatus();

  // Function to add items to shopping list
  const addToShoppingList = (items: string[], source: string = 'manual') => {
    const newItems = items.map(i => {
      const parsed = parseIngredientForShoppingList(i);
      return { 
        id: Math.random().toString(36).substr(2,9), 
        item: parsed.itemName, 
        quantity: parsed.quantity,
        category: inferCategoryFromItemName(parsed.itemName), 
        checked: false,
        source: source
      };
    });
    setShoppingList(prev => [...prev, ...newItems]);
    setActiveTab(Tab.SHOPPING);
  };

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
    // Undo
    recentActions,
    recordUndo,
    performUndo,
    // Usage limit states
    recipeSaveLimitExceeded,
    mealPlanLimitExceeded,
    // Usage limit checking functions
    checkRecipeSaveLimit,
    checkMealPlanLimit,
  } = useDataManagement(user, addToast, addToShoppingList, syncStatus.updateSyncStatus);

  // Initialize safe area handling for mobile devices
  useEffect(() => {
    SafeAreaService.initialize().catch(console.error);
  }, []);

  // Listen for notifications while user is logged in
  useEffect(() => {
    if (!user?.email) return;

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("email", "==", user.email),
      where("read", "==", false)
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const unread: any[] = [];
      snapshot.forEach(doc => unread.push({ id: doc.id, ...doc.data() }));
      if (unread.length > 0 && !showNotificationsModal) {
        setNotifications(unread);
        setShowNotificationsModal(true);
      }
    });

    return unsubscribe;
  }, [user?.email]);




  const handleLogin = async (loggedInUser: User) => {
    setUser(loggedInUser);

    // Track login event
    AnalyticsService.trackLogin(loggedInUser.provider || 'email');

    // Set user properties for analytics
    AnalyticsService.setUser(loggedInUser.id, {
      email: loggedInUser.email,
      provider: loggedInUser.provider,
      has_seen_tutorial: loggedInUser.hasSeenTutorial
    });

    const userHousehold = await getOrCreateHousehold(loggedInUser);
    if (userHousehold) {
      setHousehold(userHousehold);
      // Track household membership
      AnalyticsService.trackHouseholdJoin(userHousehold.id, isHouseholdMember(userHousehold, loggedInUser.id) ? 'member' : 'owner');
    }

    if (!loggedInUser.hasSeenTutorial) setShowTutorial(true);
  };

  // Notifications are now handled by the real-time listener above

  // Load household when user is authenticated
  useEffect(() => {
    if (user?.id) {
      const loadHousehold = async () => {
        try {
          const userHousehold = await getOrCreateHousehold(user);
          if (userHousehold) {
            setHousehold(userHousehold);
          } else {
            setHousehold(null); // Clear if no household found
          }
        } catch (error) {
          console.error('Error loading household:', error);
          setHousehold(null);
        }
      };
      loadHousehold();
    }
  }, [user?.id]);

  // Track app lifecycle events
  useEffect(() => {
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
      console.error('Failed to add back button listener:', error);
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

  return (
    <>
      <ErrorBoundary>
        <div className="h-screen flex flex-col max-w-md mx-auto shadow-2xl relative border-x border-theme transition-colors duration-300 overflow-x-hidden">
        {showHousehold && (
          <HouseholdManager 
              user={user} 
              household={household} 
              setHousehold={setHousehold} 
              onClose={() => setShowHousehold(false)}
              setActiveTab={setActiveTab}
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
          settings={settings}
          setSettings={setSettings}
          onShowHousehold={() => setShowHousehold(true)}
          recentActions={recentActions}
          onUndo={performUndo}
          syncStatus={syncStatus}
          onSyncClick={syncNow}
        />
        
        <MainContent 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          user={user}
          inventory={inventory}
          setInventory={setInventory}
          updateItem={updateItem}
          deleteItem={deleteItem}
          shoppingList={shoppingList}
          setShoppingList={setShoppingList}
          mealPlan={mealPlan}
          setMealPlan={setMealPlan}
          savedRecipes={savedRecipes}
          ratings={ratings}
          settings={settings}
          setSettings={setSettings}
          persistedRecipeResult={persistedRecipeResult}
          setPersistedRecipeResult={setPersistedRecipeResult}
          initialSearchQuery={initialSearchQuery}
          setInitialSearchQuery={setInitialSearchQuery}
          onAddToPlan={handleAddToPlan}
          onSaveRecipe={handleSaveRecipe}
          onDeleteRecipe={handleDeleteRecipe}
          onRateRecipe={handleRateRecipe}
          onMoveToPantry={async (items) => {
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
                  console.log('Failed to fetch external image for', i.item, error);
                }
              }
              
              let addQty = i.purchasedQuantity ? i.purchasedQuantity.amount : (typeof i.quantity === 'number' ? i.quantity : 1);
              if (addQty < 1) addQty = 1;
              
              // Parse recipe reservations from source
              let reservations: { recipeId: string; recipeName: string; quantity: number; unit: string }[] = [];
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
            
            setInventory(prev => {
              const updated = [...prev];
              processedItems.forEach(i => {
                const idx = updated.findIndex(p => p.item.toLowerCase() === i.item.toLowerCase());
                if (idx !== -1) {
                  // Merge reservations
                  const existing = updated[idx];
                  const newReservations = [...(existing.reservations || []), ...(i.reservations || [])];
                  updated[idx] = {
                    ...existing,
                    reservations: newReservations.length > 0 ? newReservations : undefined
                  };
                  const prevQty = parseInt(updated[idx].quantity_estimate) || 1;
                  updated[idx].quantity_estimate = (prevQty + parseInt(i.quantity_estimate)).toString();
                } else {
                  updated.push(i);
                }
              });
              const merged: { [key: string]: PantryItem } = {};
              updated.forEach(p => {
                const key = p.item.toLowerCase();
                if (merged[key]) {
                  merged[key].quantity_estimate = (parseInt(merged[key].quantity_estimate) + parseInt(p.quantity_estimate)).toString();
                  // Merge reservations
                  if (p.reservations) {
                    merged[key].reservations = [...(merged[key].reservations || []), ...p.reservations];
                  }
                } else {
                  merged[key] = { ...p };
                }
              });
              return Object.values(merged);
            });

            // Show toast for bulk quantity editing if multiple items were added
            if (items.length > 1) {
              // Set a flag to indicate bulk quantity editing should be triggered
              localStorage.setItem('bulkQuantityEditPending', 'true');
              localStorage.setItem('bulkQuantityEditCount', items.length.toString());
              
              addToast(
                `Added ${items.length} items to pantry. Edit quantities?`,
                'info',
                8000,
                'Edit Quantities',
                () => {
                  // Switch to pantry tab and trigger bulk editing workflow
                  setActiveTab(Tab.PANTRY);
                  // The PantryScanner component will handle the bulk editing
                }
              );
            }
          }}
          onAddToShoppingList={addToShoppingList}
          handleMarkAsMade={handleMarkAsMade}
          consumptionSuggestions={consumptionSuggestions}
          expirationAlerts={expirationAlerts}
          recipeSuggestions={recipeSuggestions}
          customCategories={customCategories}
          onAddCustomCategory={addCustomCategory}
          onUpdateCustomCategory={updateCustomCategory}
          onDeleteCustomCategory={deleteCustomCategory}
          onLogout={handleLogout}
          onShowTutorial={() => setShowTutorial(true)}
          addToast={addToast}
          // Usage limit states
          recipeSaveLimitExceeded={recipeSaveLimitExceeded}
          mealPlanLimitExceeded={mealPlanLimitExceeded}
          // Usage limit checking functions
          checkRecipeSaveLimit={checkRecipeSaveLimit}
          checkMealPlanLimit={checkMealPlanLimit}
        />
        <AppNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
        
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
      {/* <Suspense fallback={<LoadingSpinner />}>
        <DatabaseAnalytics />
      </Suspense> */}
    </>
  );
}

export default App;



