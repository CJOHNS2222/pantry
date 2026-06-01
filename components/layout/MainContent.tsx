import React, { Suspense } from 'react';
import { Tab } from '../../types/app';
import { User, PantryItem, DayPlan, StructuredRecipe } from '../../types';

// Lazy load all major components for better performance
const PantryScanner = React.lazy(() => import('../PantryScanner').then(module => ({ default: module.PantryScanner })));
const MealPlanner = React.lazy(() => import('../MealPlanner').then(module => ({ default: module.MealPlanner })));
const ShoppingList = React.lazy(() => import('../ShoppingList').then(module => ({ default: module.ShoppingList })));
const RecipeFinder = React.lazy(() => import('../RecipeFinder').then(module => ({ default: module.RecipeFinder })));
const Community = React.lazy(() => import('../Community').then(module => ({ default: module.Community })));
const Settings = React.lazy(() => import('../Settings').then(module => ({ default: module.Settings })));

import SmartRecommendations from '../SmartRecommendations';
import { UsageIndicator } from '../UsageIndicator';
import ComponentErrorBoundary from '../ComponentErrorBoundary';
import { useApp } from '../../contexts/AppContext';
import { useAppActions } from '../../contexts/AppActionsContext';

// Loading component for lazy-loaded components
const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-color)]"></div>
    <span className="ml-3 text-theme-secondary">Loading...</span>
  </div>
);

export const MainContent: React.FC = () => {
  // Use context hooks to access global state and actions
  const appState = useApp();
  const appActions = useAppActions();

  // Destructure commonly used values for easier access
  const {
    activeTab,
    user,
    inventory,
    shoppingList,
    mealPlan,
    savedRecipes,
    ratings,
    settings,
    persistedRecipeResult,
    initialSearchQuery,
    customCategories,
    recipeSaveLimitExceeded,
    mealPlanLimitExceeded,
    isLoadingInventory,
    isLoadingShoppingList,
    isLoadingMealPlan,
    isLoadingSavedRecipes,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isLoadingRatings,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isLoadingHousehold,
    consumptionSuggestions,
    expirationAlerts,
    recipeSuggestions,
    household,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    recentActivities,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isLoadingActivities
  } = appState;

  const {
    setActiveTab,
    updateItem,
    deleteItem,
    addItem,
    addItems,
    onAddToPlan,
    onSaveRecipe,
    onDeleteRecipe,
    onRateRecipe,
    onMoveToPantry,
    onAddToShoppingList,
    addShoppingListItem,
    handleMarkAsMade,
    addToast,
    onAddCustomCategory,
    onUpdateCustomCategory,
    onDeleteCustomCategory,
    onLogout,
    onShowHousehold,
    updateMealPlan,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    refreshAllData
  } = appActions;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const inventoryNeeded = (ingredients: string[], pantryInventory: PantryItem[]): PantryItem[] => {
    const toRemove: PantryItem[] = [];
    
    ingredients.forEach(ingredient => {
      const ingredientLower = ingredient.toLowerCase();
      const match = pantryInventory.find(item => 
        ingredientLower.includes(item.item.toLowerCase()) || 
        item.item.toLowerCase().includes(ingredientLower.split(' ')[0])
      );
      
      if (match && !toRemove.find(r => r.id === match.id)) {
        toRemove.push(match);
      }
    });
    
    return toRemove;
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleRemoveFromMealPlan = (recipe: StructuredRecipe) => {
    const recipeTitle = recipe.title;
    const newMealPlan = mealPlan.map(day => ({
      ...day,
      breakfast: day.breakfast?.filter(meal => meal.recipe.title !== recipeTitle) || [],
      lunch: day.lunch?.filter(meal => meal.recipe.title !== recipeTitle) || [],
      dinner: day.dinner?.filter(meal => meal.recipe.title !== recipeTitle) || [],
    } as DayPlan));

    updateMealPlan(newMealPlan);
  };
  return (
    <main className="overflow-y-auto overflow-x-hidden pb-safe px-4 scrollbar-hide bg-theme-primary" style={{ paddingTop: 'var(--app-header-h)', height: 'calc(100dvh - 5rem - max(0.5rem, var(--safe-area-inset-bottom, 0px)))', WebkitOverflowScrolling: 'touch', touchAction: 'auto' }}>
      {/* Usage Indicator - Show for free users */}
      <UsageIndicator
        user={user || undefined}
        savedRecipesCount={savedRecipes.length}
        showUpgradeCTA={true}
        onUpgrade={() => setActiveTab(Tab.SETTINGS)}
      />


      {/* Main pantry tab */}
      {activeTab === Tab.PANTRY && (
        <ComponentErrorBoundary componentName="PantryScanner">
          <Suspense fallback={<LoadingSpinner />}>
            <PantryScanner
              inventory={inventory}
              isLoadingInventory={isLoadingInventory}
              addToShoppingList={onAddToShoppingList}
              addShoppingListItem={addShoppingListItem}
              onDeleteItem={deleteItem}
              onAddItem={addItem}
                onAddItems={addItems}
                onUpdateItem={updateItem}
                consumptionSuggestions={consumptionSuggestions}
                expirationAlerts={expirationAlerts}
                recipeSuggestions={recipeSuggestions}
                customCategories={customCategories}
                setActiveTab={setActiveTab}
                setInitialSearchQuery={appActions.setInitialSearchQuery}
                user={user as User}
              />
            </Suspense>
        </ComponentErrorBoundary>
      )}

      {activeTab === Tab.MEALS && (
        <ComponentErrorBoundary componentName="MealPlanner">
          <Suspense fallback={<LoadingSpinner />}>
            <MealPlanner
              mealPlan={mealPlan}
              updateMealPlan={updateMealPlan}
                inventory={inventory}
                shoppingList={shoppingList}
                addToShoppingList={onAddToShoppingList}
                onAddToPlan={onAddToPlan}
                onSaveRecipe={onSaveRecipe}
                onMarkAsMade={handleMarkAsMade}
                onRate={onRateRecipe}
                user={user || undefined}
                setActiveTab={setActiveTab}
                recipeSaveLimitExceeded={recipeSaveLimitExceeded}
                mealPlanLimitExceeded={mealPlanLimitExceeded}
                isLoadingMealPlan={isLoadingMealPlan}
                isLoadingSavedRecipes={isLoadingSavedRecipes}
                savedRecipes={savedRecipes}
                settings={settings}
                onOpenRecipeSearch={() => {
                  // This will be called by the tutorial to open recipe search modal
                  // The MealPlanner component handles this internally
                }}
              />
            </Suspense>
        </ComponentErrorBoundary>
      )}
      {activeTab === Tab.SHOPPING && (
        <ComponentErrorBoundary componentName="ShoppingList">
          <Suspense fallback={<LoadingSpinner />}>
            <ShoppingList
              items={shoppingList}
              setItems={appState.setShoppingList}
              onMoveToPantry={onMoveToPantry}
                addShoppingListItem={addShoppingListItem}
                user={user || undefined}
                household={appState.household}
                isLoadingShoppingList={isLoadingShoppingList}
                settings={settings}
              />
            </Suspense>
        </ComponentErrorBoundary>
      )}
      {activeTab === Tab.RECIPES && (
        <>
          <SmartRecommendations
            inventory={inventory}
            savedRecipes={savedRecipes}
            user={user}
            setActiveTab={setActiveTab}
          />
          <ComponentErrorBoundary componentName="RecipeFinder">
          <Suspense fallback={<LoadingSpinner />}>
            <RecipeFinder
              onAddToPlan={onAddToPlan}
              onSaveRecipe={onSaveRecipe}
              onDeleteRecipe={onDeleteRecipe}
              onMarkAsMade={handleMarkAsMade}
              inventory={inventory}
              ratings={ratings}
              onRate={onRateRecipe}
              savedRecipes={savedRecipes}
              user={user || undefined}
              setActiveTab={setActiveTab}
              addToast={addToast}
              persistedResult={persistedRecipeResult}
              setPersistedResult={appActions.setPersistedRecipeResult}
              initialSearchQuery={initialSearchQuery}
              recipeSaveLimitExceeded={recipeSaveLimitExceeded}
              mealPlanLimitExceeded={mealPlanLimitExceeded}
              isLoadingSavedRecipes={isLoadingSavedRecipes}
              household={household ?? undefined}
              />
            </Suspense>
          </ComponentErrorBoundary>
        </>
      )}
      {activeTab === Tab.COMMUNITY && (
        <ComponentErrorBoundary componentName="Community">
          <Suspense fallback={<LoadingSpinner />}>
            <Community
              onAddToPlan={onAddToPlan}
              onSaveRecipe={onSaveRecipe}
              user={user || undefined}
            />
          </Suspense>
        </ComponentErrorBoundary>
      )}
      {activeTab === Tab.SETTINGS && (
        <ComponentErrorBoundary componentName="Settings">
          <Suspense fallback={<LoadingSpinner />}>
            <Settings 
              settings={settings} 
              setSettings={appActions.setSettings} 
              user={user || undefined} 
              onLogout={onLogout}
              customCategories={customCategories}
              onAddCustomCategory={onAddCustomCategory}
              onUpdateCustomCategory={onUpdateCustomCategory}
              onDeleteCustomCategory={onDeleteCustomCategory}
              mealPlan={mealPlan}
              household={household ?? undefined}
              onShowHousehold={onShowHousehold}
              addToast={addToast}
            />
          </Suspense>
        </ComponentErrorBoundary>
      )}
    </main>
  );
};