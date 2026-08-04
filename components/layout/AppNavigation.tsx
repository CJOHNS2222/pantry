import React, { useMemo } from 'react';
import { ChefHat, ShoppingBasket, CalendarDays, UtensilsCrossed, Users, Settings } from 'lucide-react';
import { Tab } from '../../types/app';
import { useApp } from '../../contexts/AppContext';
import HapticService from '../../services/hapticService';

interface AppNavigationProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  hiddenTabs?: string[];
  isKeyboardVisible?: boolean;
}

export const AppNavigation: React.FC<AppNavigationProps> = ({ activeTab, setActiveTab, hiddenTabs, isKeyboardVisible }) => {
  if (isKeyboardVisible) return null;

  const { inventory, shoppingList, mealPlan } = useApp();

  // Compute badge indicators
  const expiredPantryCount = useMemo(() => {
    if (!inventory) return 0;
    const now = Date.now();
    return inventory.filter(item => {
      if (!item.expirationDate || item.is_immortal) return false;
      return new Date(item.expirationDate).getTime() < now;
    }).length;
  }, [inventory]);

  const uncheckedShoppingCount = useMemo(() => {
    if (!shoppingList) return 0;
    return shoppingList.filter(item => !item.checked).length;
  }, [shoppingList]);

  const hasTodayMealPlan = useMemo(() => {
    if (!mealPlan) return false;
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayPlan = mealPlan.find(day => day.date === todayStr);
    if (!todayPlan) return false;
    return (
      (todayPlan.breakfast?.length ?? 0) > 0 ||
      (todayPlan.lunch?.length ?? 0) > 0 ||
      (todayPlan.dinner?.length ?? 0) > 0
    );
  }, [mealPlan]);

  const allTabs = [
    { id: Tab.PANTRY, icon: ChefHat, label: 'Pantry', badge: expiredPantryCount > 0 ? { type: 'dot', color: 'bg-red-500' } : null },
    { id: Tab.SHOPPING, icon: ShoppingBasket, label: 'Shop', badge: uncheckedShoppingCount > 0 ? { type: 'count', count: uncheckedShoppingCount } : null },
    { id: Tab.MEALS, icon: CalendarDays, label: 'Plan', badge: hasTodayMealPlan ? { type: 'dot', color: 'bg-green-500' } : null },
    { id: Tab.RECIPES, icon: UtensilsCrossed, label: 'Chef', badge: null },
    { id: Tab.COMMUNITY, icon: Users, label: 'Social', badge: null },
    { id: Tab.SETTINGS, icon: Settings, label: 'Settings', badge: null },
  ];

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
              onClick={() => {
                HapticService.light();
                setActiveTab(tab.id);
              }}
              className={`flex flex-col items-center justify-center flex-1 py-2 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2 focus:ring-offset-theme-secondary relative ${
                isActive ? '-translate-y-1' : 'opacity-60 hover:opacity-100'
              }`}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className={`p-1.5 rounded-full mb-0.5 transition-all relative ${
                isActive ? 'bg-theme-primary shadow-lg border border-theme' : ''
              }`}>
                <tab.icon
                  className="w-5 h-5"
                  style={{ color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)' }}
                  aria-hidden="true"
                />
                {/* Badge indicator */}
                {tab.badge && (
                  tab.badge.type === 'count' && typeof tab.badge.count === 'number' ? (
                    <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--accent-color)] text-white text-[10px] font-bold flex items-center justify-center border border-theme shadow-sm">
                      {tab.badge.count > 99 ? '99+' : tab.badge.count}
                    </span>
                  ) : tab.badge.type === 'dot' ? (
                    <span className={`absolute top-0 right-0 w-2.5 h-2.5 rounded-full ${tab.badge.color} border border-theme shadow-sm animate-pulse`} />
                  ) : null
                )}
              </div>
              <span className="text-[11px] uppercase font-bold tracking-wider text-theme-secondary">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};