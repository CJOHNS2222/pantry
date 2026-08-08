// contexts/ShoppingContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { ShoppingItem } from '../types';

interface ShoppingContextValue {
  shoppingList: ShoppingItem[];
  setShoppingList: React.Dispatch<React.SetStateAction<ShoppingItem[]>>;
  isLoadingShoppingList: boolean;
}

const ShoppingContext = createContext<ShoppingContextValue | undefined>(undefined);

interface ShoppingProviderProps {
  children: ReactNode;
  value?: ShoppingContextValue;
}

const defaultShoppingContextValue: ShoppingContextValue = {
  shoppingList: [],
  setShoppingList: (() => {}) as React.Dispatch<React.SetStateAction<ShoppingItem[]>>,
  isLoadingShoppingList: false,
};

export const ShoppingProvider: React.FC<ShoppingProviderProps> = ({ children, value }) => {
  const providerValue = value ?? defaultShoppingContextValue;
  return (
    <ShoppingContext.Provider value={providerValue}>
      {children}
    </ShoppingContext.Provider>
  );
};

export const useShoppingContext = (): ShoppingContextValue => {
  const context = useContext(ShoppingContext);
  if (context === undefined) {
    throw new Error('useShoppingContext must be used within a ShoppingProvider');
  }
  return context;
};

export default ShoppingContext;
