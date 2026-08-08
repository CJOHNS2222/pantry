// contexts/MealPlanContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { DayPlan } from '../types';

interface MealPlanContextValue {
  mealPlan: DayPlan[];
  setMealPlan: React.Dispatch<React.SetStateAction<DayPlan[]>>;
  isLoadingMealPlan: boolean;
}

const MealPlanContext = createContext<MealPlanContextValue | undefined>(undefined);

interface MealPlanProviderProps {
  children: ReactNode;
  value?: MealPlanContextValue;
}

const defaultMealPlanContextValue: MealPlanContextValue = {
  mealPlan: [],
  setMealPlan: (() => {}) as React.Dispatch<React.SetStateAction<DayPlan[]>>,
  isLoadingMealPlan: false,
};

export const MealPlanProvider: React.FC<MealPlanProviderProps> = ({ children, value }) => {
  const providerValue = value ?? defaultMealPlanContextValue;
  return (
    <MealPlanContext.Provider value={providerValue}>
      {children}
    </MealPlanContext.Provider>
  );
};

export const useMealPlanContext = (): MealPlanContextValue => {
  const context = useContext(MealPlanContext);
  if (context === undefined) {
    throw new Error('useMealPlanContext must be used within a MealPlanProvider');
  }
  return context;
};

export default MealPlanContext;
