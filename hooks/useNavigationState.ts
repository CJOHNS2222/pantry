import { useState, useRef, useCallback, useEffect } from 'react';
import { Tab } from '../types/app';
import PerformanceMonitoringService from '../services/performanceMonitoringService';
import { trackNavigation } from '../services/sentryService';
import HapticService from '../services/hapticService';
import AnalyticsService from '../services/analyticsService';

const tabNames: Record<Tab, string> = {
  [Tab.PANTRY]: 'pantry',
  [Tab.PANTRY_CACHE_TEST]: 'pantry_cache_test',
  [Tab.SHOPPING]: 'shopping',
  [Tab.MEALS]: 'meals',
  [Tab.RECIPES]: 'recipes',
  [Tab.SETTINGS]: 'settings',
  [Tab.COMMUNITY]: 'community'
} as Record<Tab, string>;

const tabTitles: Record<Tab, string> = {
  [Tab.PANTRY]: 'Pantry',
  [Tab.PANTRY_CACHE_TEST]: 'Pantry',
  [Tab.SHOPPING]: 'Shopping List',
  [Tab.MEALS]: 'Meal Planner',
  [Tab.RECIPES]: 'Recipes',
  [Tab.SETTINGS]: 'Settings',
  [Tab.COMMUNITY]: 'Community'
} as Record<Tab, string>;

export function useNavigationState(hiddenTabs?: string[]) {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.PANTRY);
  const [activeSettingsCategory, setActiveSettingsCategory] = useState<string | null>(null);
  const tabHistoryRef = useRef<Tab[]>([]);
  const previousTabRef = useRef<Tab>(Tab.PANTRY);

  const applyTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    window.scrollTo(0, 0);
    if (tab === Tab.SETTINGS) {
      setActiveSettingsCategory(null);
    }
    const tabTitle = tabTitles[tab];
    document.title = tabTitle ? `${tabTitle} - Stock & Spoon` : 'Stock & Spoon';
    if (typeof window !== 'undefined') {
      const nextHash = `#${tabNames[tab] || ''}`;
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, '', nextHash);
      }
    }
  }, []);

  const switchTab = useCallback((tab: Tab) => {
    PerformanceMonitoringService.mark(`tab_switch_start_${tab}`);
    trackNavigation(tabNames[activeTab] || 'unknown', tabNames[tab] || 'unknown');
    HapticService.light();
    tabHistoryRef.current = [...tabHistoryRef.current.slice(-19), activeTab];
    applyTabChange(tab);
    PerformanceMonitoringService.mark(`tab_switch_end_${tab}`);
    PerformanceMonitoringService.measure(`tab_switch_${tab}`, `tab_switch_start_${tab}`, `tab_switch_end_${tab}`);
  }, [activeTab, applyTabChange]);

  // Analytics tracking on tab switch
  useEffect(() => {
    if (activeTab !== previousTabRef.current) {
      AnalyticsService.trackTabSwitch(previousTabRef.current, activeTab);
      previousTabRef.current = activeTab;
    }
  }, [activeTab]);

  // Fall back to PANTRY if activeTab is hidden by settings
  useEffect(() => {
    if (hiddenTabs && hiddenTabs.includes(activeTab)) {
      setActiveTab(Tab.PANTRY);
    }
  }, [hiddenTabs, activeTab]);

  return {
    activeTab,
    setActiveTab,
    switchTab,
    applyTabChange,
    tabHistoryRef,
    activeSettingsCategory,
    setActiveSettingsCategory,
  };
}
