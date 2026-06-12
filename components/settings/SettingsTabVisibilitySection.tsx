import React from 'react';
import { LayoutDashboard } from 'lucide-react';
import { Tab } from '../../types/app';

interface SettingsTabVisibilitySectionProps {
  hiddenTabs: string[] | undefined;
  onTabVisibilityChange: (tab: Tab, isVisible: boolean) => void;
}

const NAV_TABS: { tab: Tab; label: string; description: string }[] = [
  { tab: Tab.SHOPPING, label: 'Shopping', description: 'Shopping list and grocery management' },
  { tab: Tab.MEALS, label: 'Meal Planner', description: 'Plan your meals for the week' },
  { tab: Tab.RECIPES, label: 'Recipes', description: 'Browse and search recipes' },
  { tab: Tab.COMMUNITY, label: 'Community', description: 'Connect with other users' },
  { tab: Tab.ANALYTICS, label: 'Analytics', description: 'Pantry usage and waste stats' },
];

export const SettingsTabVisibilitySection: React.FC<SettingsTabVisibilitySectionProps> = ({
  hiddenTabs, onTabVisibilityChange, }) => {
  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
      <div className="w-full flex items-center justify-between p-4 border-b border-theme bg-theme-primary/20">
        <div className="flex items-center gap-3">
          
          <LayoutDashboard className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">Navigation Tabs</h3>
        </div>
      </div>

      <div className="px-4 divide-y divide-theme">
          <p className="text-xs text-theme-secondary py-3">
            Choose which tabs appear in the bottom navigation. Pantry and Settings are always visible.
          </p>
          {NAV_TABS.map(({ tab, label, description }) => {
            const isVisible = !(hiddenTabs?.includes(tab) ?? false);
            return (
              <div key={tab} className="flex items-center justify-between py-3">
                <div className="flex-1 pr-4">
                  <p className="text-sm font-medium text-theme-primary">{label}</p>
                  <p className="text-xs text-theme-secondary mt-0.5">{description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={(event) => onTabVisibilityChange(tab, event.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-400 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-color)]"></div>
                </label>
              </div>
            );
          })}
        </div>
    </div>
  );
};
