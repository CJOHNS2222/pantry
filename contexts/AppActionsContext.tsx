// contexts/AppActionsContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { Tab } from '../types/app';
import { PantryItem, DayPlan, ShoppingItem, SavedRecipe, RecipeSearchResult, CustomCategory, StructuredRecipe } from '../types';

// Action handlers that are stable references (memoized in parent)
interface AppActionsContextValue {
  // Navigation
  setActiveTab: (tab: Tab) => void;

  // Data operations
  updateItem: (index: number, updates: Partial<PantryItem>) => Promise<void>;
  deleteItem: (index: number) => Promise<void>;
  addItem: (item: PantryItem) => Promise<void>;
  addItems: (items: PantryItem[]) => Promise<void>;
  setInventory: (inventory: PantryItem[]) => void;
  setShoppingList: (shoppingList: ShoppingItem[]) => void;
  setMealPlan: (mealPlan: DayPlan[]) => void;

  // Recipe operations
  onAddToPlan: (recipe: StructuredRecipe) => void;
  onSaveRecipe: (recipe: StructuredRecipe) => void;
  onDeleteRecipe: (recipe: SavedRecipe) => void;
  onRateRecipe: (rating: any) => void;
  handleMarkAsMade: (recipe: StructuredRecipe) => void;

  // Shopping list operations
  onMoveToPantry: (items: ShoppingItem[]) => void;
  onAddToShoppingList: (items: string[]) => void;

  // Settings operations
  setSettings: (settings: any) => void;
  onAddCustomCategory?: (name: string, icon: string, color?: string) => void;
  onUpdateCustomCategory?: (categoryId: string, updates: Partial<Pick<CustomCategory, 'name' | 'icon' | 'color'>>) => void;
  onDeleteCustomCategory?: (categoryId: string) => void;

  // UI operations
  addToast: (message: string, type?: 'error' | 'info', ttl?: number, actionLabel?: string, action?: () => void) => void;
  setInitialSearchQuery: (query: string) => void;
  setPersistedRecipeResult: (result: RecipeSearchResult | null) => void;

  // Auth operations
  onLogout: () => void;
  onShowTutorial: () => void;

  // Usage limit checking
  checkRecipeSaveLimit: () => Promise<boolean>;
  checkMealPlanLimit: () => Promise<boolean>;
}

const AppActionsContext = createContext<AppActionsContextValue | undefined>(undefined);

interface AppActionsProviderProps {
  children: ReactNode;
  value: AppActionsContextValue;
}

export const AppActionsProvider: React.FC<AppActionsProviderProps> = ({ children, value }) => {
  return (
    <AppActionsContext.Provider value={value}>
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