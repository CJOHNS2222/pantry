// contexts/AppContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
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

export const AppProvider: React.FC<AppProviderProps> = ({ children, value }) => {
  const providerValue = value ?? defaultAppContextValue;
  return (
    <AppContext.Provider value={providerValue}>
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