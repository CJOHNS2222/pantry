// contexts/SettingsDataContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { Settings, CustomCategory } from '../types';

interface SettingsDataContextValue {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  customCategories?: CustomCategory[];
}

const SettingsDataContext = createContext<SettingsDataContextValue | undefined>(undefined);

interface SettingsDataProviderProps {
  children: ReactNode;
  value?: SettingsDataContextValue;
}

const defaultSettings: Settings = {
  notifications: {
    enabled: false,
    time: '09:00',
    types: { shoppingList: true, mealPlan: true, cookingReminders: true },
    cookingReminderTime: 60,
  },
  theme: { mode: 'light', accentColor: '#0078d4', backgroundColor: undefined, textColor: undefined },
  shopping: { includeStaples: true },
};

const defaultSettingsDataContextValue: SettingsDataContextValue = {
  settings: defaultSettings,
  setSettings: () => {},
  customCategories: [],
};

export const SettingsDataProvider: React.FC<SettingsDataProviderProps> = ({ children, value }) => {
  const providerValue = value ?? defaultSettingsDataContextValue;
  return (
    <SettingsDataContext.Provider value={providerValue}>
      {children}
    </SettingsDataContext.Provider>
  );
};

export const useSettingsDataContext = (): SettingsDataContextValue => {
  const context = useContext(SettingsDataContext);
  if (context === undefined) {
    throw new Error('useSettingsDataContext must be used within a SettingsDataProvider');
  }
  return context;
};

export default SettingsDataContext;
