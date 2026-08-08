// contexts/AppContext.tsx
//
// Back-compat facade over the domain-scoped contexts (Navigation, Inventory,
// Shopping, MealPlan, Recipe, User, SettingsData). `useApp()` composes all of
// them so existing call sites keep working unchanged, but every field access
// re-subscribes to ALL of them — components that only need one slice should
// migrate to the scoped hook (useInventoryContext, useShoppingContext, ...)
// to actually stop the cascade re-renders this split was meant to fix.
import React, { ReactNode } from 'react';
import { Tab } from '../types/app';
import { User, PantryItem, DayPlan, ShoppingItem, SavedRecipe, RecipeRating, RecipeSearchResult, CustomCategory, Household, Settings, ConsumptionSuggestion, ExpirationAlert, RecipeSuggestion, HouseholdActivity } from '../types';
import { NavigationProvider, useNavigation } from './NavigationContext';
import { InventoryProvider, useInventoryContext } from './InventoryContext';
import { ShoppingProvider, useShoppingContext } from './ShoppingContext';
import { MealPlanProvider, useMealPlanContext } from './MealPlanContext';
import { RecipeProvider, useRecipeContext } from './RecipeContext';
import { UserProvider, useUserContext } from './UserContext';
import { SettingsDataProvider, useSettingsDataContext } from './SettingsDataContext';

// Full app state shape — same public contract as before the context split.
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

interface AppProviderProps {
  children: ReactNode;
  value?: AppContextValue;
}

/**
 * Fans a single combined AppContextValue out into the domain-scoped
 * providers. When `value` is omitted, each scoped provider falls back to
 * its own inert default (used only in tests/storybook-style rendering).
 */
export const AppProvider: React.FC<AppProviderProps> = ({ children, value }) => {
  if (!value) {
    return (
      <NavigationProvider>
        <UserProvider>
          <InventoryProvider>
            <ShoppingProvider>
              <MealPlanProvider>
                <RecipeProvider>
                  <SettingsDataProvider>
                    {children}
                  </SettingsDataProvider>
                </RecipeProvider>
              </MealPlanProvider>
            </ShoppingProvider>
          </InventoryProvider>
        </UserProvider>
      </NavigationProvider>
    );
  }

  return (
    <NavigationProvider value={{
      activeTab: value.activeTab,
      setActiveTab: value.setActiveTab,
      activeSettingsCategory: value.activeSettingsCategory,
    }}>
      <UserProvider value={{
        user: value.user,
        household: value.household,
        isLoadingHousehold: value.isLoadingHousehold,
        recentActivities: value.recentActivities,
        isLoadingActivities: value.isLoadingActivities,
      }}>
        <InventoryProvider value={{
          inventory: value.inventory,
          setInventory: value.setInventory,
          isLoadingInventory: value.isLoadingInventory,
          consumptionSuggestions: value.consumptionSuggestions,
          expirationAlerts: value.expirationAlerts,
          recipeSuggestions: value.recipeSuggestions,
        }}>
          <ShoppingProvider value={{
            shoppingList: value.shoppingList,
            setShoppingList: value.setShoppingList,
            isLoadingShoppingList: value.isLoadingShoppingList,
          }}>
            <MealPlanProvider value={{
              mealPlan: value.mealPlan,
              setMealPlan: value.setMealPlan,
              isLoadingMealPlan: value.isLoadingMealPlan,
            }}>
              <RecipeProvider value={{
                savedRecipes: value.savedRecipes,
                ratings: value.ratings,
                persistedRecipeResult: value.persistedRecipeResult,
                setPersistedRecipeResult: value.setPersistedRecipeResult,
                initialSearchQuery: value.initialSearchQuery,
                setInitialSearchQuery: value.setInitialSearchQuery,
                isLoadingSavedRecipes: value.isLoadingSavedRecipes,
                isLoadingRatings: value.isLoadingRatings,
                setLoadingRatingsComplete: value.setLoadingRatingsComplete,
                recipeSaveLimitExceeded: value.recipeSaveLimitExceeded,
                mealPlanLimitExceeded: value.mealPlanLimitExceeded,
              }}>
                <SettingsDataProvider value={{
                  settings: value.settings,
                  setSettings: value.setSettings,
                  customCategories: value.customCategories,
                }}>
                  {children}
                </SettingsDataProvider>
              </RecipeProvider>
            </MealPlanProvider>
          </ShoppingProvider>
        </InventoryProvider>
      </UserProvider>
    </NavigationProvider>
  );
};

/**
 * Back-compat hook — recombines all domain-scoped contexts into the old
 * monolithic shape. Subscribes to every domain context, so a component using
 * this still re-renders on any field change, same as before the split.
 * Prefer the scoped hooks (useInventoryContext, useShoppingContext,
 * useMealPlanContext, useRecipeContext, useUserContext,
 * useSettingsDataContext, useNavigation) in new/updated code.
 */
export const useApp = (): AppContextValue => {
  const navigation = useNavigation();
  const user = useUserContext();
  const inventoryCtx = useInventoryContext();
  const shopping = useShoppingContext();
  const mealPlanCtx = useMealPlanContext();
  const recipe = useRecipeContext();
  const settingsData = useSettingsDataContext();

  return {
    ...navigation,
    ...user,
    ...inventoryCtx,
    ...shopping,
    ...mealPlanCtx,
    ...recipe,
    ...settingsData,
  };
};

