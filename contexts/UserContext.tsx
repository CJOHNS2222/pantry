// contexts/UserContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { User, Household, HouseholdActivity } from '../types';

interface UserContextValue {
  user: User;
  household?: Household | undefined;
  isLoadingHousehold: boolean;
  recentActivities: HouseholdActivity[];
  isLoadingActivities: boolean;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
  value?: UserContextValue;
}

const defaultUser: User = {
  id: '',
  name: 'Guest',
  email: '',
  provider: 'email',
  hasSeenTutorial: false,
};

const defaultUserContextValue: UserContextValue = {
  user: defaultUser,
  household: undefined,
  isLoadingHousehold: false,
  recentActivities: [],
  isLoadingActivities: false,
};

export const UserProvider: React.FC<UserProviderProps> = ({ children, value }) => {
  const providerValue = value ?? defaultUserContextValue;
  return (
    <UserContext.Provider value={providerValue}>
      {children}
    </UserContext.Provider>
  );
};

export const useUserContext = (): UserContextValue => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUserContext must be used within a UserProvider');
  }
  return context;
};

export default UserContext;
