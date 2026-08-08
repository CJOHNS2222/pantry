// contexts/InventoryContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { PantryItem, ConsumptionSuggestion, ExpirationAlert, RecipeSuggestion } from '../types';

interface InventoryContextValue {
  inventory: PantryItem[];
  setInventory: (inventory: PantryItem[]) => void;
  isLoadingInventory: boolean;
  consumptionSuggestions: ConsumptionSuggestion[];
  expirationAlerts: ExpirationAlert[];
  recipeSuggestions: RecipeSuggestion[];
}

const InventoryContext = createContext<InventoryContextValue | undefined>(undefined);

interface InventoryProviderProps {
  children: ReactNode;
  value?: InventoryContextValue;
}

const defaultInventoryContextValue: InventoryContextValue = {
  inventory: [],
  setInventory: () => {},
  isLoadingInventory: false,
  consumptionSuggestions: [],
  expirationAlerts: [],
  recipeSuggestions: [],
};

export const InventoryProvider: React.FC<InventoryProviderProps> = ({ children, value }) => {
  const providerValue = value ?? defaultInventoryContextValue;
  return (
    <InventoryContext.Provider value={providerValue}>
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventoryContext = (): InventoryContextValue => {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventoryContext must be used within an InventoryProvider');
  }
  return context;
};

export default InventoryContext;
