// contexts/RecipeContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { SavedRecipe, RecipeRating, RecipeSearchResult } from '../types';

interface RecipeContextValue {
  savedRecipes: SavedRecipe[];
  ratings: RecipeRating[];
  persistedRecipeResult: RecipeSearchResult | null;
  setPersistedRecipeResult: (result: RecipeSearchResult | null) => void;
  initialSearchQuery: string;
  setInitialSearchQuery: (query: string) => void;
  isLoadingSavedRecipes: boolean;
  isLoadingRatings: boolean;
  setLoadingRatingsComplete: () => void;
  recipeSaveLimitExceeded: boolean;
  mealPlanLimitExceeded: boolean;
}

const RecipeContext = createContext<RecipeContextValue | undefined>(undefined);

interface RecipeProviderProps {
  children: ReactNode;
  value?: RecipeContextValue;
}

const defaultRecipeContextValue: RecipeContextValue = {
  savedRecipes: [],
  ratings: [],
  persistedRecipeResult: null,
  setPersistedRecipeResult: () => {},
  initialSearchQuery: '',
  setInitialSearchQuery: () => {},
  isLoadingSavedRecipes: false,
  isLoadingRatings: false,
  setLoadingRatingsComplete: () => {},
  recipeSaveLimitExceeded: false,
  mealPlanLimitExceeded: false,
};

export const RecipeProvider: React.FC<RecipeProviderProps> = ({ children, value }) => {
  const providerValue = value ?? defaultRecipeContextValue;
  return (
    <RecipeContext.Provider value={providerValue}>
      {children}
    </RecipeContext.Provider>
  );
};

export const useRecipeContext = (): RecipeContextValue => {
  const context = useContext(RecipeContext);
  if (context === undefined) {
    throw new Error('useRecipeContext must be used within a RecipeProvider');
  }
  return context;
};

export default RecipeContext;
