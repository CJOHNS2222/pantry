// contexts/NavigationContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { Tab } from '../types/app';

interface NavigationContextValue {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  activeSettingsCategory: string | null;
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined);

interface NavigationProviderProps {
  children: ReactNode;
  value?: NavigationContextValue;
}

const defaultNavigationContextValue: NavigationContextValue = {
  activeTab: Tab.PANTRY,
  setActiveTab: () => {},
  activeSettingsCategory: null,
};

export const NavigationProvider: React.FC<NavigationProviderProps> = ({ children, value }) => {
  const providerValue = value ?? defaultNavigationContextValue;
  return (
    <NavigationContext.Provider value={providerValue}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextValue => {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

export default NavigationContext;
