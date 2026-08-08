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
  deleteItem: (index: number, disposalReason?: 'thrown_away' | 'cooked' | 'remove') => Promise<void>;
  deleteItems: (indices: number[], disposalReason?: 'thrown_away' | 'cooked' | 'remove') => Promise<void>;
  addItem: (item: PantryItem) => Promise<void>;
  addItems: (items: PantryItem[]) => Promise<void>;
  setInventory: (inventory: PantryItem[]) => void;
  setShoppingList: (shoppingList: ShoppingItem[]) => void;
  setMealPlan: (mealPlan: DayPlan[]) => void;
  updateMealPlan: (mealPlan: DayPlan[]) => void;

  // Recipe operations
  onAddToPlan: (recipe: StructuredRecipe, dayIndex?: number, mealType?: 'breakfast' | 'lunch' | 'dinner') => void;
  onSaveRecipe: (recipe: StructuredRecipe) => void;
  onDeleteRecipe: (recipe: SavedRecipe) => void;
  onRateRecipe: (rating: RecipeRatingInput) => void;
  handleMarkAsMade: (recipe: StructuredRecipe, deductions?: { itemId: string; ingredient: string }[]) => void;

  // Shopping list operations
  onMoveToPantry: (items: ShoppingItem[]) => void;
  onAddToShoppingList: (items: (string | { item: string; source: string; notes?: string })[], defaultSource?: string) => Promise<void>;
  addShoppingListItem: (item: Omit<ShoppingItem, 'id'>) => void;

  // Settings operations
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  onAddCustomCategory?: (name: string, icon: string, color?: string) => void;
  onUpdateCustomCategory?: (categoryId: string, updates: Partial<Pick<CustomCategory, 'name' | 'icon' | 'color'>>) => void;
  onDeleteCustomCategory?: (categoryId: string) => void;
  setActiveSettingsCategory: React.Dispatch<React.SetStateAction<string | null>>;

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
  onReplayOnboarding?: () => void;
}

const AppActionsContext = createContext<AppActionsContextValue | undefined>(undefined);

interface AppActionsProviderProps {
  children: ReactNode;
  value?: AppActionsContextValue;
}

// Inert defaults used only before a real AppActionsProvider value is supplied (e.g. in
// tests/storybook-style rendering). Each stub is written against its real parameter/return
// type instead of casting a shared `noop` through `any` (F39) — TS structurally allows a
// zero-arg `() => {}` / `async () => {}` to satisfy a function type with more parameters,
// so no `any` is needed here at all.
const defaultAppActionsContextValue: AppActionsContextValue = {
  setActiveTab: () => {},
  updateItem: async () => {},
  deleteItem: async () => {},
  deleteItems: async () => {},
  addItem: async () => {},
  addItems: async () => {},
  setInventory: () => {},
  setShoppingList: () => {},
  setMealPlan: () => {},
  updateMealPlan: () => {},
  onAddToPlan: () => {},
  onSaveRecipe: () => {},
  onDeleteRecipe: () => {},
  onRateRecipe: () => {},
  handleMarkAsMade: () => {},
  onMoveToPantry: () => {},
  onAddToShoppingList: async () => {},
  addShoppingListItem: () => {},
  setSettings: () => {},
  onAddCustomCategory: () => {},
  onUpdateCustomCategory: () => {},
  onDeleteCustomCategory: () => {},
  setActiveSettingsCategory: () => {},
  addToast: () => {},
  setInitialSearchQuery: () => {},
  setPersistedRecipeResult: () => {},
  onLogout: () => {},
  onShowHousehold: () => {},
  checkRecipeSaveLimit: async () => false,
  checkMealPlanLimit: async () => false,
  refreshAllData: async () => {},
  onReplayOnboarding: () => {},
};

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