import React, { Suspense } from 'react';
import { Tab } from '../../types/app';
import { User, PantryItem, DayPlan, StructuredRecipe, Household, ShoppingItem, SavedRecipe, RecipeRating, RecipeSearchResult, CustomCategory } from '../../types';

// Lazy load all major components for better performance
const PantryScanner = React.lazy(() => import('../PantryScanner').then(module => ({ default: module.PantryScanner })));
const MealPlanner = React.lazy(() => import('../MealPlanner').then(module => ({ default: module.MealPlanner })));
const ShoppingList = React.lazy(() => import('../ShoppingList').then(module => ({ default: module.ShoppingList })));
const RecipeFinder = React.lazy(() => import('../RecipeFinder').then(module => ({ default: module.RecipeFinder })));
const Community = React.lazy(() => import('../Community').then(module => ({ default: module.Community })));
const Settings = React.lazy(() => import('../Settings').then(module => ({ default: module.Settings })));

// Keep Login and Tutorial as regular imports since they're shown immediately
import { Login } from '../Login';
import { Tutorial } from '../Tutorial';
import { HouseholdManager } from '../Household';
import { UsageIndicator } from '../UsageIndicator';
import ComponentErrorBoundary from '../ComponentErrorBoundary';
import { useApp } from '../../contexts/AppContext';
import { useAppActions } from '../../contexts/AppActionsContext';
import { parseIngredientForShoppingList, parseQuantity, subtractQuantities } from '../../utils/appUtils';

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
    isLoadingRatings,
    isLoadingHousehold,
    consumptionSuggestions,
    expirationAlerts,
    recipeSuggestions
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
    handleMarkAsMade,
    addToast,
    onAddCustomCategory,
    onUpdateCustomCategory,
    onDeleteCustomCategory,
    onLogout,
    onShowTutorial
  } = appActions;
  // Helper function to match ingredients to inventory
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

  // Handler for removing a recipe from meal plan
  const handleRemoveFromMealPlan = (recipe: StructuredRecipe) => {
    const recipeTitle = recipe.title;
    const newMealPlan = mealPlan.map(day => ({
      breakfast: day.breakfast?.filter(meal => meal.recipe.title !== recipeTitle),
      lunch: day.lunch?.filter(meal => meal.recipe.title !== recipeTitle),
      dinner: day.dinner?.filter(meal => meal.recipe.title !== recipeTitle),
    }));
    
    setMealPlan(newMealPlan);
  };
  return (
    <main className="overflow-y-auto overflow-x-hidden pb-safe px-4 scrollbar-hide bg-theme-primary" style={{ paddingTop: '120px', height: 'calc(100vh - 5rem - max(0.5rem, var(--safe-area-inset-bottom, 0px)))', WebkitOverflowScrolling: 'touch', touchAction: 'auto' }}>
      {/* Usage Indicator - Show for free users */}
      <UsageIndicator
        user={user}
        showUpgradeCTA={true}
        onUpgrade={() => setActiveTab(Tab.SETTINGS)}
      />

      {activeTab === Tab.PANTRY && (
        <ComponentErrorBoundary componentName="PantryScanner">
          <Suspense fallback={<LoadingSpinner />}>
            <PantryScanner
              inventory={inventory}
              setInventory={appState.setInventory}
              updateItem={updateItem}
              deleteItem={deleteItem}
              addItem={addItem}
              addItems={addItems}
              addToShoppingList={onAddToShoppingList}
              consumptionSuggestions={consumptionSuggestions}
              expirationAlerts={expirationAlerts}
              recipeSuggestions={recipeSuggestions}
              customCategories={customCategories}
              setActiveTab={setActiveTab}
              setInitialSearchQuery={appActions.setInitialSearchQuery}
              user={user}
            />
          </Suspense>
        </ComponentErrorBoundary>
      )}
      {activeTab === Tab.MEALS && (
        <ComponentErrorBoundary componentName="MealPlanner">
          <Suspense fallback={<LoadingSpinner />}>
            <MealPlanner
              mealPlan={mealPlan}
              setMealPlan={appState.setMealPlan}
              inventory={inventory}
              addToShoppingList={onAddToShoppingList}
              onAddToPlan={onAddToPlan}
              onSaveRecipe={onSaveRecipe}
              onMarkAsMade={handleMarkAsMade}
              onRate={onRateRecipe}
              user={user}
              setActiveTab={setActiveTab}
              recipeSaveLimitExceeded={recipeSaveLimitExceeded}
              mealPlanLimitExceeded={mealPlanLimitExceeded}
              isLoadingMealPlan={isLoadingMealPlan}
              isLoadingSavedRecipes={isLoadingSavedRecipes}
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
              isLoadingShoppingList={isLoadingShoppingList}
            />
          </Suspense>
        </ComponentErrorBoundary>
      )}
      {activeTab === Tab.RECIPES && (
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
              user={user}
              setActiveTab={setActiveTab}
              addToast={addToast}
              onShareRecipe={(recipe) => {
                alert(`Recipe shared: ${recipe.title}`);
              }}
              persistedResult={persistedRecipeResult}
              setPersistedResult={appActions.setPersistedRecipeResult}
              initialSearchQuery={initialSearchQuery}
              recipeSaveLimitExceeded={recipeSaveLimitExceeded}
              mealPlanLimitExceeded={mealPlanLimitExceeded}
            />
          </Suspense>
        </ComponentErrorBoundary>
      )}
      {activeTab === Tab.COMMUNITY && (
        <ComponentErrorBoundary componentName="Community">
          <Suspense fallback={<LoadingSpinner />}>
            <Community
              ratings={ratings}
              onAddToPlan={onAddToPlan}
              onSaveRecipe={onSaveRecipe}
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
              inventory={inventory}
              onShowTutorial={onShowTutorial}
            />
          </Suspense>
        </ComponentErrorBoundary>
      )}
    </main>
  );
};