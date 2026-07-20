// contexts/AppContext.tsx
import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { Tab } from '../types/app';
import { User, PantryItem, DayPlan, ShoppingItem, SavedRecipe, RecipeRating, RecipeSearchResult, CustomCategory, Household, Settings, ConsumptionSuggestion, ExpirationAlert, RecipeSuggestion, HouseholdActivity } from '../types';

// Core app state that should be available globally
interface AppContextValue {
  // Navigation
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;

  // User
  user: User;
  household?: Household | undefined;

  // Core data
  inventory: PantryItem[];
  setInventory: (inventory: PantryItem[]) => void;
  shoppingList: ShoppingItem[];
  setShoppingList: React.Dispatch<React.SetStateAction<ShoppingItem[]>>;
  mealPlan: DayPlan[];
  setMealPlan: React.Dispatch<React.SetStateAction<DayPlan[]>>;
  savedRecipes: SavedRecipe[];
  ratings: RecipeRating[];

  // Recipe search state
  persistedRecipeResult: RecipeSearchResult | null;
  setPersistedRecipeResult: (result: RecipeSearchResult | null) => void;
  initialSearchQuery: string;
  setInitialSearchQuery: (query: string) => void;

  // Settings
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  customCategories?: CustomCategory[];
  activeSettingsCategory: string | null;

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

  // Loading state setters
  setLoadingRatingsComplete: () => void;

  // UI state
  consumptionSuggestions: ConsumptionSuggestion[];
  expirationAlerts: ExpirationAlert[];
  recipeSuggestions: RecipeSuggestion[];

  // Household activity
  recentActivities: HouseholdActivity[];
  isLoadingActivities: boolean;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
  value?: AppContextValue;
  /**
   * Real, individually-memoized domain context values built in App.tsx from
   * useDataManagement's mutators (PERF-029). When omitted (tests, storybook
   * mounts), read-only stubs derived from `value` are provided instead.
   */
  domains?: {
    inventory: InventoryContextType;
    shoppingList: ShoppingListContextType;
    mealPlan: MealPlanContextType;
    recipes: RecipesContextType;
  };
}

const defaultSettings: Settings = {
  notifications: {
    enabled: false,
    time: '09:00',
    types: { shoppingList: true, mealPlan: true, cookingReminders: true },
    cookingReminderTime: 60,
  },
  theme: { mode: 'light', accentColor: '#0078d4', backgroundColor: undefined, textColor: undefined },
  shopping: { includeStaples: true },
};

const defaultUser: User = {
  id: '',
  name: 'Guest',
  email: '',
  provider: 'email',
  hasSeenTutorial: false,
};

const defaultAppContextValue: AppContextValue = {
  activeTab: Tab.PANTRY,
  setActiveTab: () => {},
  user: defaultUser,
  household: undefined,
  inventory: [],
  setInventory: () => {},
  shoppingList: [],
  setShoppingList: (() => {}) as React.Dispatch<React.SetStateAction<ShoppingItem[]>>,
  mealPlan: [],
  setMealPlan: (() => {}) as React.Dispatch<React.SetStateAction<DayPlan[]>>,
  savedRecipes: [],
  ratings: [],
  persistedRecipeResult: null,
  setPersistedRecipeResult: () => {},
  initialSearchQuery: '',
  setInitialSearchQuery: () => {},
  settings: defaultSettings,
  setSettings: () => {},
  customCategories: [],
  activeSettingsCategory: null,
  recipeSaveLimitExceeded: false,
  mealPlanLimitExceeded: false,
  isLoadingInventory: false,
  isLoadingShoppingList: false,
  isLoadingMealPlan: false,
  isLoadingSavedRecipes: false,
  isLoadingRatings: false,
  isLoadingHousehold: false,
  setLoadingRatingsComplete: () => {},
  consumptionSuggestions: [],
  expirationAlerts: [],
  recipeSuggestions: [],
  recentActivities: [],
  isLoadingActivities: false,
};

import {
  InventoryContext, ShoppingListContext, MealPlanContext, RecipesContext,
  InventoryContextType, ShoppingListContextType, MealPlanContextType, RecipesContextType,
} from './DomainContexts';

// Shared no-op mutator for stub domain values — module-level so its identity
// never invalidates the memoized fallbacks below.
const noopAsync = async () => {};

export const AppProvider: React.FC<AppProviderProps> = ({ children, value, domains }) => {
  const providerValue = value ?? defaultAppContextValue;

  // Real domain values come from App.tsx via `domains`; the stubs only serve
  // mounts that don't supply them. Each is memoized on its own domain's data
  // so one domain changing doesn't re-render the other domains' consumers.
  const inventoryContextValue = useMemo<InventoryContextType>(() => domains?.inventory ?? {
    inventory: providerValue.inventory,
    isLoadingInventory: providerValue.isLoadingInventory,
    onAddItem: noopAsync,
    onAddItems: noopAsync,
    onUpdateItem: noopAsync,
    onDeleteItem: noopAsync,
    deletePantryItems: noopAsync,
  }, [domains?.inventory, providerValue.inventory, providerValue.isLoadingInventory]);

  const shoppingListContextValue = useMemo<ShoppingListContextType>(() => domains?.shoppingList ?? {
    shoppingList: providerValue.shoppingList,
    isLoadingShoppingList: providerValue.isLoadingShoppingList,
    addShoppingListItem: noopAsync,
    addShoppingListItems: noopAsync,
    updateShoppingListItem: noopAsync,
    removeShoppingListItem: noopAsync,
  }, [domains?.shoppingList, providerValue.shoppingList, providerValue.isLoadingShoppingList]);

  const mealPlanContextValue = useMemo<MealPlanContextType>(() => domains?.mealPlan ?? {
    mealPlan: providerValue.mealPlan,
    isLoadingMealPlan: providerValue.isLoadingMealPlan,
    addMealToPlan: noopAsync,
    updateMealOnPlan: noopAsync,
    removeMealFromPlan: noopAsync,
    updateMealPlan: noopAsync,
  }, [domains?.mealPlan, providerValue.mealPlan, providerValue.isLoadingMealPlan]);

  const recipesContextValue = useMemo<RecipesContextType>(() => domains?.recipes ?? {
    savedRecipes: providerValue.savedRecipes,
    isLoadingSavedRecipes: providerValue.isLoadingSavedRecipes,
    onSaveRecipe: noopAsync,
    onDeleteRecipe: noopAsync,
    recipeSaveLimitExceeded: providerValue.recipeSaveLimitExceeded,
  }, [domains?.recipes, providerValue.savedRecipes, providerValue.isLoadingSavedRecipes, providerValue.recipeSaveLimitExceeded]);

  return (
    <AppContext.Provider value={providerValue}>
      <InventoryContext.Provider value={inventoryContextValue}>
        <ShoppingListContext.Provider value={shoppingListContextValue}>
          <MealPlanContext.Provider value={mealPlanContextValue}>
            <RecipesContext.Provider value={recipesContextValue}>
              {children}
            </RecipesContext.Provider>
          </MealPlanContext.Provider>
        </ShoppingListContext.Provider>
      </InventoryContext.Provider>
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