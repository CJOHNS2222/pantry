import React from 'react';
import { ChefHat, ShoppingBasket, CalendarDays, UtensilsCrossed, Users, Sun } from 'lucide-react';
import { Tab } from '../../types/app';

interface AppNavigationProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  hiddenTabs?: string[];
}

export const AppNavigation: React.FC<AppNavigationProps> = ({ activeTab, setActiveTab, hiddenTabs }) => {
  const allTabs = [
    { id: Tab.PANTRY, icon: ChefHat, label: 'Pantry' },
    { id: Tab.SHOPPING, icon: ShoppingBasket, label: 'Shop' },
    { id: Tab.MEALS, icon: CalendarDays, label: 'Plan' },
    { id: Tab.RECIPES, icon: UtensilsCrossed, label: 'Chef' },
    { id: Tab.COMMUNITY, icon: Users, label: 'Social' },
    { id: Tab.SETTINGS, icon: Sun, label: 'Settings' },
  ];

  // PANTRY and SETTINGS are always visible regardless of the user's preference
  const alwaysVisible = new Set([Tab.PANTRY, Tab.SETTINGS]);
  const tabs = hiddenTabs?.length
    ? allTabs.filter(t => alwaysVisible.has(t.id) || !hiddenTabs.includes(t.id))
    : allTabs;

  return (
    <nav 
      className="bg-theme-secondary border-t border-theme fixed bottom-0 w-full max-w-md pb-safe z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] transition-colors duration-300"
      role="navigation"
      aria-label="Main application navigation"
    >
      <div className="flex justify-around items-end pb-1">
        {tabs.map((tab, index) => {
          const tutorialIds = ['nav-pantry', 'nav-shopping', 'nav-meals', 'nav-recipes', 'nav-community', 'nav-settings'];
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-tutorial={tutorialIds[index]}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-2 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2 focus:ring-offset-theme-secondary ${
                isActive ? '-translate-y-1' : 'opacity-60 hover:opacity-100'
              }`}
              aria-label={`${tab.label} ${isActive ? '(current page)' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className={`p-1.5 rounded-full mb-0.5 transition-all ${
                isActive ? 'bg-theme-primary shadow-lg border border-theme' : ''
              }`}>
                <tab.icon 
                  className="w-5 h-5" 
                  style={{color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)'}}
                  aria-hidden="true"
                />
              </div>
              <span className="text-[9px] uppercase font-bold tracking-wider text-theme-secondary">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};