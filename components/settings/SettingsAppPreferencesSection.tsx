import React from 'react';
import { ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-react';
import type { Settings as AppSettings, UserProfile } from '../../types';

interface SettingsAppPreferencesSectionProps {
  expanded: boolean;
  onToggle: () => void;
  title: string;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  userProfile: UserProfile | null | undefined;
  onMeasurementSystemChange: (value: 'Standard' | 'Metric') => void;
  geminiOptedIn: boolean;
  onGeminiOptInChange: (enabled: boolean) => void;
  labels: {
    enableNotifications: string;
    measurementSystem: string;
    enableAiFeatures: string;
    includeStaples: string;
    autoRestockStaples: string;
    showNutrition: string;
    showPriceData: string;
  };
}

export const SettingsAppPreferencesSection: React.FC<SettingsAppPreferencesSectionProps> = ({
  expanded,
  onToggle,
  title,
  settings,
  setSettings,
  userProfile,
  onMeasurementSystemChange,
  geminiOptedIn,
  onGeminiOptInChange,
  labels,
}) => {
  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
      <div onClick={onToggle} className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors">
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-5 h-5 text-theme-primary" /> : <ChevronRight className="w-5 h-5 text-theme-primary" />}
          <SlidersHorizontal className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">{title}</h3>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-theme px-4 divide-y divide-theme">
          <div className="flex items-center justify-between py-3">
            <div className="flex-1 pr-4">
              <p className="text-sm font-medium text-theme-primary">{labels.enableNotifications}</p>
              <p className="text-xs text-theme-secondary mt-0.5">Receive alerts for expiring items, meal plans, and shopping reminders</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={settings.notifications.enabled}
                onChange={(event) =>
                  setSettings((previous) => ({
                    ...previous,
                    notifications: { ...previous.notifications, enabled: event.target.checked },
                  }))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-400 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-color)]"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex-1 pr-4">
              <p className="text-sm font-medium text-theme-primary">{labels.measurementSystem}</p>
              <p className="text-xs text-theme-secondary mt-0.5">Choose between imperial and metric units throughout the app</p>
            </div>
            <div className="flex bg-theme-primary rounded-lg p-0.5 border border-theme flex-shrink-0">
              <button
                type="button"
                onClick={() => onMeasurementSystemChange('Standard')}
                className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                  userProfile?.measurementSystem !== 'Metric' ? 'bg-[var(--accent-color)] text-white shadow-sm' : 'text-theme-secondary'
                }`}
              >
                Imperial
              </button>
              <button
                type="button"
                onClick={() => onMeasurementSystemChange('Metric')}
                className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                  userProfile?.measurementSystem === 'Metric' ? 'bg-[var(--accent-color)] text-white shadow-sm' : 'text-theme-secondary'
                }`}
              >
                Metric
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex-1 pr-4">
              <p className="text-sm font-medium text-theme-primary">{labels.enableAiFeatures}</p>
              <p className="text-xs text-theme-secondary mt-0.5">Use AI for recipe suggestions, smart shopping tips, and meal planning assistance</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input type="checkbox" checked={geminiOptedIn} onChange={(event) => onGeminiOptInChange(event.target.checked)} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-400 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-color)]"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex-1 pr-4">
              <p className="text-sm font-medium text-theme-primary">{labels.includeStaples}</p>
              <p className="text-xs text-theme-secondary mt-0.5">Automatically suggest common pantry staples when building a shopping list</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={settings.shopping?.includeStaples || false}
                onChange={(event) =>
                  setSettings((previous) => ({
                    ...previous,
                    shopping: { ...previous.shopping, includeStaples: event.target.checked },
                  }))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-400 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-color)]"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex-1 pr-4">
              <p className="text-sm font-medium text-theme-primary">{labels.autoRestockStaples}</p>
              <p className="text-xs text-theme-secondary mt-0.5">Automatically add staple items back to your shopping list when they run low or run out</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={settings.shopping?.autoReaddStaples ?? true}
                onChange={(event) =>
                  setSettings((previous) => ({
                    ...previous,
                    shopping: { ...previous.shopping, autoReaddStaples: event.target.checked },
                  }))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-400 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-color)]"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex-1 pr-4">
              <p className="text-sm font-medium text-theme-primary">{labels.showNutrition}</p>
              <p className="text-xs text-theme-secondary mt-0.5">Display calories, protein, and macros on recipes and pantry items</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={settings.shopping?.showNutrition ?? true}
                onChange={(event) =>
                  setSettings((previous) => ({
                    ...previous,
                    shopping: { ...previous.shopping, showNutrition: event.target.checked },
                  }))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-400 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-color)]"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex-1 pr-4">
              <p className="text-sm font-medium text-theme-primary">{labels.showPriceData}</p>
              <p className="text-xs text-theme-secondary mt-0.5">Display estimated grocery prices on shopping list items and pantry ingredients</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={settings.shopping?.showPriceData ?? false}
                onChange={(event) =>
                  setSettings((previous) => ({
                    ...previous,
                    shopping: { ...previous.shopping, showPriceData: event.target.checked },
                  }))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-400 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-color)]"></div>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
