// contexts/AppActionsContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { Tab } from '../types/app';
import { PantryItem, DayPlan, ShoppingItem, SavedRecipe, RecipeSearchResult, CustomCategory, StructuredRecipe, Settings, RecipeRatingInput } from '../types';

// Action handlers that are stable references (memoized in parent)
interface AppActionsContextValue {
  // Navigation
  setActiveTab: (tab: Tab) => void;

  // Data operations
  updateItem: (index: number, updates: Partial<PantryItem>) => Promise<void>;
  deleteItem: (index: number) => Promise<void>;
  deleteItems: (indices: number[]) => Promise<void>;
  addItem: (item: PantryItem) => Promise<void>;
  addItems: (items: PantryItem[]) => Promise<void>;
  setInventory: (inventory: PantryItem[]) => void;
  setShoppingList: (shoppingList: ShoppingItem[]) => void;
  setMealPlan: (mealPlan: DayPlan[]) => void;
  updateMealPlan: (mealPlan: DayPlan[]) => void;

  // Recipe operations
  onAddToPlan: (recipe: StructuredRecipe) => void;
  onSaveRecipe: (recipe: StructuredRecipe) => void;
  onDeleteRecipe: (recipe: SavedRecipe) => void;
  onRateRecipe: (rating: RecipeRatingInput) => void;
  handleMarkAsMade: (recipe: StructuredRecipe) => void;

  // Shopping list operations
  onMoveToPantry: (items: ShoppingItem[]) => void;
  onAddToShoppingList: (items: (string | { item: string; source: string; notes?: string })[]) => Promise<void>;
  addShoppingListItem: (item: Omit<ShoppingItem, 'id'>) => void;

  // Settings operations
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  onAddCustomCategory?: (name: string, icon: string, color?: string) => void;
  onUpdateCustomCategory?: (categoryId: string, updates: Partial<Pick<CustomCategory, 'name' | 'icon' | 'color'>>) => void;
  onDeleteCustomCategory?: (categoryId: string) => void;

  // UI operations
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', ttl?: number, actionLabel?: string, action?: () => void) => void;
  setInitialSearchQuery: (query: string) => void;
  setPersistedRecipeResult: (result: RecipeSearchResult | null) => void;

  // Auth operations
  onLogout: () => void;
  onShowHousehold?: () => void;

  // Usage limit checking
  checkRecipeSaveLimit: () => Promise<boolean>;
  checkMealPlanLimit: () => Promise<boolean>;
  refreshAllData: () => Promise<void>;
}

const AppActionsContext = createContext<AppActionsContextValue | undefined>(undefined);

interface AppActionsProviderProps {
  children: ReactNode;
  value?: AppActionsContextValue;
}

const noop = () => {};

/* eslint-disable @typescript-eslint/no-explicit-any */
const defaultAppActionsContextValue: AppActionsContextValue = {
  setActiveTab: noop as any,
  updateItem: async () => {},
  deleteItem: async () => {},
  deleteItems: async () => {},
  addItem: async () => {},
  addItems: async () => {},
  setInventory: noop as any,
  setShoppingList: noop as any,
  setMealPlan: noop as any,
  updateMealPlan: noop as any,
  onAddToPlan: noop as any,
  onSaveRecipe: noop as any,
  onDeleteRecipe: noop as any,
  onRateRecipe: noop as any,
  handleMarkAsMade: noop as any,
  onMoveToPantry: noop as any,
  onAddToShoppingList: noop as any,
  addShoppingListItem: noop as any,
  setSettings: noop as any,
  onAddCustomCategory: noop as any,
  onUpdateCustomCategory: noop as any,
  onDeleteCustomCategory: noop as any,
  addToast: noop as any,
  setInitialSearchQuery: noop as any,
  setPersistedRecipeResult: noop as any,
  onLogout: noop as any,
  onShowHousehold: noop as any,
  checkRecipeSaveLimit: async () => false,
  checkMealPlanLimit: async () => false,
  refreshAllData: async () => {},
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export const AppActionsProvider: React.FC<AppActionsProviderProps> = ({ children, value }) => {
  const providerValue = value ?? defaultAppActionsContextValue;
  return (
    <AppActionsContext.Provider value={providerValue}>
      {children}
    </AppActionsContext.Provider>
  );
};

export const useAppActions = (): AppActionsContextValue => {
  const context = useContext(AppActionsContext);
  if (context === undefined) {
    throw new Error('useAppActions must be used within an AppActionsProvider');
  }
  return context;
};

export default AppActionsContext;