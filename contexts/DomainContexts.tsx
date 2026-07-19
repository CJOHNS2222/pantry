import { createContext, useContext } from 'react';
import { PantryItem, ShoppingItem, StructuredRecipe, SavedRecipe, DayPlan } from '../types';

// ─── Inventory Domain Context ──────────────────────────────────────────────

export interface InventoryContextType {
  inventory: PantryItem[];
  isLoadingInventory: boolean;
  onAddItem: (item: PantryItem) => Promise<void>;
  onAddItems: (items: PantryItem[]) => Promise<void>;
  onUpdateItem: (index: number, updates: Partial<PantryItem>) => Promise<void>;
  onDeleteItem: (index: number) => Promise<void>;
  deletePantryItems: (indices: number[]) => Promise<void>;
  handleMarkAsMade?: (recipe: StructuredRecipe) => Promise<void>;
}

export const InventoryContext = createContext<InventoryContextType | null>(null);

export const useInventoryContext = () => {
  const ctx = useContext(InventoryContext);
  if (!ctx) {
    throw new Error('useInventoryContext must be used within an InventoryProvider');
  }
  return ctx;
};

// ─── Shopping List Domain Context ──────────────────────────────────────────

export interface ShoppingListContextType {
  shoppingList: ShoppingItem[];
  isLoadingShoppingList: boolean;
  addShoppingListItem: (item: Omit<ShoppingItem, 'id'>) => Promise<void>;
  addShoppingListItems: (items: Omit<ShoppingItem, 'id'>[]) => Promise<void>;
  updateShoppingListItem: (id: string, updates: Partial<ShoppingItem>) => Promise<void>;
  removeShoppingListItem: (id: string) => Promise<void>;
  clearShoppingList: () => Promise<void>;
  toggleShoppingItemPurchased: (id: string) => Promise<void>;
}

export const ShoppingListContext = createContext<ShoppingListContextType | null>(null);

export const useShoppingListContext = () => {
  const ctx = useContext(ShoppingListContext);
  if (!ctx) {
    throw new Error('useShoppingListContext must be used within a ShoppingListProvider');
  }
  return ctx;
};

// ─── Meal Plan Domain Context ───────────────────────────────────────────────

export interface MealPlanContextType {
  mealPlan: DayPlan[];
  isLoadingMealPlan: boolean;
  addMealToPlan: (recipe: StructuredRecipe, dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => Promise<void>;
  updateMealOnPlan: (recipe: StructuredRecipe, dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => Promise<void>;
  removeMealFromPlan: (recipeId: string, dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => Promise<void>;
  updateMealPlan: (newPlan: DayPlan[]) => Promise<void>;
}

export const MealPlanContext = createContext<MealPlanContextType | null>(null);

export const useMealPlanContext = () => {
  const ctx = useContext(MealPlanContext);
  if (!ctx) {
    throw new Error('useMealPlanContext must be used within a MealPlanProvider');
  }
  return ctx;
};

// ─── Saved Recipes Domain Context ──────────────────────────────────────────

export interface RecipesContextType {
  savedRecipes: SavedRecipe[];
  isLoadingSavedRecipes: boolean;
  onSaveRecipe: (recipe: StructuredRecipe) => Promise<void>;
  onDeleteRecipe: (recipe: SavedRecipe) => Promise<void>;
  recipeSaveLimitExceeded: boolean;
}

export const RecipesContext = createContext<RecipesContextType | null>(null);

export const useRecipesContext = () => {
  const ctx = useContext(RecipesContext);
  if (!ctx) {
    throw new Error('useRecipesContext must be used within a RecipesProvider');
  }
  return ctx;
};
