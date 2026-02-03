// contexts/AppContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { Tab } from '../types/app';
import { User, PantryItem, DayPlan, ShoppingItem, SavedRecipe, RecipeRating, RecipeSearchResult, CustomCategory, StructuredRecipe, Household } from '../types';

// Core app state that should be available globally
interface AppContextValue {
  // Navigation
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;

  // User
  user: User | null;
  household: Household | null;

  // Core data
  inventory: PantryItem[];
  setInventory: (inventory: PantryItem[]) => void;
  shoppingList: ShoppingItem[];
  setShoppingList: (shoppingList: ShoppingItem[]) => void;
  mealPlan: DayPlan[];
  setMealPlan: (mealPlan: DayPlan[]) => void;
  savedRecipes: SavedRecipe[];
  ratings: RecipeRating[];

  // Recipe search state
  persistedRecipeResult: RecipeSearchResult | null;
  setPersistedRecipeResult: (result: RecipeSearchResult | null) => void;
  initialSearchQuery: string;
  setInitialSearchQuery: (query: string) => void;

  // Settings
  settings: any;
  setSettings: (settings: any) => void;
  customCategories?: CustomCategory[];

  // Usage limits
  recipeSaveLimitExceeded: boolean;
  mealPlanLimitExceeded: boolean;

  // Loading states
  isLoadingInventory: boolean;
  isLoadingShoppingList: boolean;
  isLoadingMealPlan: boolean;
  isLoadingSavedRecipes: boolean;
  isLoadingRatings: boolean;
  isLoadingHousehold: boolean;

  // UI state
  consumptionSuggestions: any[];
  expirationAlerts: any[];
  recipeSuggestions: any[];

  // Household activity
  recentActivities: any[];
  isLoadingActivities: boolean;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
  value: AppContextValue;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children, value }) => {
  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextValue => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export default AppContext;