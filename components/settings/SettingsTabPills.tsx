import React from 'react';

type SettingsTab = 'account' | 'preferences' | 'organization' | 'more';

interface SettingsTabPillsProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

const LABELS: Record<SettingsTab, string> = {
  account: 'Account',
  preferences: 'Prefs',
  organization: 'Organize',
  more: 'More',
};

const TABS: SettingsTab[] = ['account', 'preferences', 'organization', 'more'];

export const SettingsTabPills: React.FC<SettingsTabPillsProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="sticky top-0 z-10 bg-theme-primary border-b border-theme px-4 py-3">
      <div className="flex gap-1 bg-theme-secondary rounded-xl p-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            data-settings-tab={tab}
            onClick={() => onTabChange(tab)}
            className={`flex-1 py-2 px-1 rounded-lg text-sm font-medium text-center transition-colors ${
              activeTab === tab ? 'bg-[var(--accent-color)] text-white shadow-sm' : 'text-theme-secondary hover:text-theme-primary'
            }`}
          >
            {LABELS[tab]}
          </button>
        ))}
      </div>
    </div>
  );
};
