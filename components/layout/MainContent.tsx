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

// Loading component for lazy-loaded components
const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-color)]"></div>
    <span className="ml-3 text-theme-secondary">Loading...</span>
  </div>
);

interface MainContentProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  user: User;
  inventory: PantryItem[];
  setInventory: (inventory: PantryItem[]) => void;
  shoppingList: ShoppingItem[];
  setShoppingList: (shoppingList: ShoppingItem[]) => void;
  mealPlan: DayPlan[];
  setMealPlan: (mealPlan: DayPlan[]) => void;
  savedRecipes: SavedRecipe[];
  ratings: RecipeRating[];
  settings: any;
  setSettings: (settings: any) => void;
  persistedRecipeResult: RecipeSearchResult | null;
  setPersistedRecipeResult: (result: RecipeSearchResult | null) => void;
  initialSearchQuery: string;
  setInitialSearchQuery: (query: string) => void;
  onAddToPlan: (recipe: StructuredRecipe) => void;
  onSaveRecipe: (recipe: StructuredRecipe) => void;
  onDeleteRecipe: (recipe: SavedRecipe) => void;
  onRateRecipe: (rating: any) => void;
  onMoveToPantry: (items: ShoppingItem[]) => void;
  onAddToShoppingList: (items: string[]) => void;
  consumptionSuggestions: any[];
  expirationAlerts: any[];
  recipeSuggestions: any[];
  customCategories?: CustomCategory[];
  onAddCustomCategory?: (name: string, icon: string, color?: string) => void;
  onUpdateCustomCategory?: (categoryId: string, updates: Partial<Pick<CustomCategory, 'name' | 'icon' | 'color'>>) => void;
  onDeleteCustomCategory?: (categoryId: string) => void;
  onLogout: () => void;
}

export const MainContent: React.FC<MainContentProps> = ({
  activeTab,
  setActiveTab,
  user,
  inventory,
  setInventory,
  shoppingList,
  setShoppingList,
  mealPlan,
  setMealPlan,
  savedRecipes,
  ratings,
  settings,
  setSettings,
  persistedRecipeResult,
  setPersistedRecipeResult,
  initialSearchQuery,
  setInitialSearchQuery,
  onAddToPlan,
  onSaveRecipe,
  onDeleteRecipe,
  onRateRecipe,
  onMoveToPantry,
  onAddToShoppingList,
  consumptionSuggestions,
  expirationAlerts,
  recipeSuggestions,
  customCategories,
  onAddCustomCategory,
  onUpdateCustomCategory,
  onDeleteCustomCategory,
  onLogout,
}) => {
  // Handler for marking a recipe as made
  const handleMarkAsMade = (recipe: StructuredRecipe, recipeInventory?: PantryItem[]) => {
    // Calculate which inventory items to remove based on recipe ingredients
    const ingredientsNeeded = recipe.ingredients || [];
    const inventoryToRemove = inventoryNeeded(ingredientsNeeded, recipeInventory || inventory);
    
    // Remove used ingredients from inventory
    const updatedInventory = inventory.filter(item => 
      !inventoryToRemove.some(remove => remove.id === item.id)
    );
    
    setInventory(updatedInventory);
    alert(`Recipe marked as made! Removed used ingredients from your pantry.`);
  };

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
    <main className="flex-1 overflow-y-auto p-4 pt-32 pb-24 scrollbar-hide bg-theme-primary relative">
      {activeTab === Tab.PANTRY && (
        <Suspense fallback={<LoadingSpinner />}>
          <PantryScanner
            inventory={inventory}
            setInventory={setInventory}
            addToShoppingList={onAddToShoppingList}
            consumptionSuggestions={consumptionSuggestions}
            expirationAlerts={expirationAlerts}
            recipeSuggestions={recipeSuggestions}
            customCategories={customCategories}
            setActiveTab={setActiveTab}
            setInitialSearchQuery={setInitialSearchQuery}
          />
        </Suspense>
      )}
      {activeTab === Tab.MEALS && (
        <Suspense fallback={<LoadingSpinner />}>
          <MealPlanner
            mealPlan={mealPlan}
            setMealPlan={setMealPlan}
            inventory={inventory}
            addToShoppingList={onAddToShoppingList}
            onAddToPlan={onAddToPlan}
            onSaveRecipe={onSaveRecipe}
            onMarkAsMade={handleMarkAsMade}
            onRate={onRateRecipe}
            user={user}
            setActiveTab={setActiveTab}
          />
        </Suspense>
      )}
      {activeTab === Tab.SHOPPING && (
        <Suspense fallback={<LoadingSpinner />}>
          <ShoppingList
            items={shoppingList}
            setItems={setShoppingList}
            onMoveToPantry={onMoveToPantry}
          />
        </Suspense>
      )}
      {activeTab === Tab.RECIPES && (
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
            onShareRecipe={(recipe) => {
              alert(`Recipe shared: ${recipe.title}`);
            }}
            persistedResult={persistedRecipeResult}
            setPersistedResult={setPersistedRecipeResult}
            initialSearchQuery={initialSearchQuery}
          />
        </Suspense>
      )}
      {activeTab === Tab.COMMUNITY && (
        <Suspense fallback={<LoadingSpinner />}>
          <Community
            ratings={ratings}
            onAddToPlan={onAddToPlan}
            onSaveRecipe={onSaveRecipe}
          />
        </Suspense>
      )}
      {activeTab === Tab.SETTINGS && (
        <Suspense fallback={<LoadingSpinner />}>
          <Settings 
            settings={settings} 
            setSettings={setSettings} 
            user={user || undefined} 
            onLogout={onLogout}
            customCategories={customCategories}
            onAddCustomCategory={onAddCustomCategory}
            onUpdateCustomCategory={onUpdateCustomCategory}
            onDeleteCustomCategory={onDeleteCustomCategory}
            mealPlan={mealPlan}
            inventory={inventory}
          />
        </Suspense>
      )}
    </main>
  );
};