import React, { useState, useEffect } from 'react';
import { Bell, Clock, Settings as SettingsIcon } from 'lucide-react';
import { NotificationService, NotificationSettings } from '../services/notificationService';
import { User } from '../types';

interface NotificationSettingsProps {
  user: User;
  currentSettings: NotificationSettings;
  onSettingsChange: (settings: NotificationSettings) => void;
}

export const NotificationSettingsComponent: React.FC<NotificationSettingsProps> = ({
  user: _user,
  currentSettings,
  onSettingsChange
}) => {
  const [settings, setSettings] = useState<NotificationSettings>(currentSettings);

  useEffect(() => {
    setSettings(currentSettings);
  }, [currentSettings]);

  const updateSettings = (updates: Partial<NotificationSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const updateTypeSetting = (type: keyof NotificationSettings['types'], value: unknown) => {
    updateSettings({
      types: {
        ...settings.types,
        [type]: value
      }
    });
  };

  const updateQuietHours = (field: 'enabled' | 'start' | 'end', value: unknown) => {
    updateSettings({
      quietHours: {
        ...settings.quietHours,
        [field]: value
      }
    });
  };

  const PRESETS: Record<string, NotificationSettings> = {
    Relaxed: {
      enabled: true,
      quietHours: { enabled: true, start: '21:00', end: '09:00' },
      types: {
        expiration: 'week_before',
        recipe_suggestion: false,
        household_activity: false,
        shopping_reminder: false,
        system: true,
        allergy_alert: true,
        household_invite: true,
        expired_items_check: false
      }
    },
    Normal: NotificationService.getDefaultSettings(),
    Strict: {
      enabled: true,
      quietHours: { enabled: false, start: '22:00', end: '08:00' },
      types: {
        expiration: 'urgent',
        recipe_suggestion: true,
        household_activity: true,
        shopping_reminder: true,
        system: true,
        allergy_alert: true,
        household_invite: true,
        expired_items_check: true
      }
    }
  };

  return (
    <div className="bg-[#2A0A10]/50 p-6 rounded-xl border border-red-900/30">
      <div className="flex items-center gap-2 mb-6">
        <Bell className="w-5 h-5 text-amber-500" />
        <h3 className="text-lg font-bold text-white">Notifications</h3>
      </div>

      {/* Presets */}
      <div className="mb-6">
        <p className="text-xs text-red-200/60 mb-2">Quick presets</p>
        <div className="flex gap-2">
          {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((preset) => (
            <button
              key={preset}
              onClick={() => { setSettings(PRESETS[preset]); onSettingsChange(PRESETS[preset]); }}
              className="flex-1 px-3 py-1.5 rounded-lg text-sm font-semibold bg-[#1A0508]/70 border border-red-900/30 text-red-200/80 hover:border-amber-500/60 hover:text-amber-400 transition-colors"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Master toggle */}
      <div className="mb-6">
        <label className="flex items-center justify-between">
          <span className="text-white font-medium">Enable Notifications</span>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => updateSettings({ enabled: e.target.checked })}
            className="w-4 h-4 text-amber-600 bg-gray-100 border-gray-300 rounded focus:ring-amber-500"
          />
        </label>
        <p className="text-xs text-red-200/60 mt-1">
          Receive alerts about expiring items, recipe suggestions, and household activity
        </p>
      </div>

      {/* Quiet hours */}
      <div className="mb-6 p-4 bg-[#1A0508]/50 rounded-lg border border-red-900/20">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-amber-500" />
          <span className="text-white font-medium">Quiet Hours</span>
        </div>

        <label className="flex items-center justify-between mb-3">
          <span className="text-red-200/80">Enable quiet hours</span>
          <input
            type="checkbox"
            checked={settings.quietHours.enabled}
            onChange={(e) => updateQuietHours('enabled', e.target.checked)}
            className="w-4 h-4 text-amber-600 bg-gray-100 border-gray-300 rounded focus:ring-amber-500"
          />
        </label>

        {settings.quietHours.enabled && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-red-200/60 mb-1">Start Time</label>
              <input
                type="time"
                value={settings.quietHours.start}
                onChange={(e) => updateQuietHours('start', e.target.value)}
                className="w-full bg-[#2A0A10] border border-red-900/50 rounded px-3 py-2 text-white text-sm focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-red-200/60 mb-1">End Time</label>
              <input
                type="time"
                value={settings.quietHours.end}
                onChange={(e) => updateQuietHours('end', e.target.value)}
                className="w-full bg-[#2A0A10] border border-red-900/50 rounded px-3 py-2 text-white text-sm focus:border-amber-500 outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Notification types */}
      <div className="space-y-4">
        <h4 className="text-white font-medium flex items-center gap-2">
          <SettingsIcon className="w-4 h-4" />
          Notification Types
        </h4>

        {/* Expiration alerts */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-white text-sm font-medium">Expiration Alerts</span>
            <p className="text-xs text-red-200/60">Get notified when items are about to expire</p>
          </div>
          <select
            value={settings.types.expiration}
            onChange={(e) => updateTypeSetting('expiration', e.target.value)}
            className="bg-[#2A0A10] border border-red-900/50 rounded px-3 py-1 text-white text-sm focus:border-amber-500 outline-none"
          >
            <option value="never">Never</option>
            <option value="urgent">Only urgent (expired/expiring today)</option>
            <option value="day_before">Day before expiry</option>
            <option value="week_before">Week before expiry</option>
          </select>
        </div>

        {/* Allergy alerts */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-white text-sm font-medium">Allergy Alerts</span>
            <p className="text-xs text-red-200/60">High-priority alerts for potential allergen exposure</p>
          </div>
          <input
            type="checkbox"
            checked={settings.types.allergy_alert}
            onChange={(e) => updateTypeSetting('allergy_alert', e.target.checked)}
            className="w-4 h-4 text-amber-600 bg-gray-100 border-gray-300 rounded focus:ring-amber-500"
          />
        </div>

        {/* Recipe suggestions */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-white text-sm font-medium">Recipe Suggestions</span>
            <p className="text-xs text-red-200/60">Suggestions based on your pantry items</p>
          </div>
          <input
            type="checkbox"
            checked={settings.types.recipe_suggestion}
            onChange={(e) => updateTypeSetting('recipe_suggestion', e.target.checked)}
            className="w-4 h-4 text-amber-600 bg-gray-100 border-gray-300 rounded focus:ring-amber-500"
          />
        </div>

        {/* Household activity */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-white text-sm font-medium">Household Activity</span>
            <p className="text-xs text-red-200/60">When family members add/remove items</p>
          </div>
          <input
            type="checkbox"
            checked={settings.types.household_activity}
            onChange={(e) => updateTypeSetting('household_activity', e.target.checked)}
            className="w-4 h-4 text-amber-600 bg-gray-100 border-gray-300 rounded focus:ring-amber-500"
          />
        </div>

        {/* Expired items modal */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-white text-sm font-medium">Expired Items Check</span>
            <p className="text-xs text-red-200/60">Show expired items list on app load</p>
          </div>
          <input
            type="checkbox"
            checked={settings.types.expired_items_check}
            onChange={(e) => updateTypeSetting('expired_items_check', e.target.checked)}
            className="w-4 h-4 text-amber-600 bg-gray-100 border-gray-300 rounded focus:ring-amber-500"
          />
        </div>

        {/* Shopping reminders */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-white text-sm font-medium">Shopping Reminders</span>
            <p className="text-xs text-red-200/60">Weekly reminders to check your shopping list</p>
          </div>
          <input
            type="checkbox"
            checked={settings.types.shopping_reminder}
            onChange={(e) => updateTypeSetting('shopping_reminder', e.target.checked)}
            className="w-4 h-4 text-amber-600 bg-gray-100 border-gray-300 rounded focus:ring-amber-500"
          />
        </div>

        {/* System notifications */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-white text-sm font-medium">System Updates</span>
            <p className="text-xs text-red-200/60">App updates, new features, and maintenance</p>
          </div>
          <input
            type="checkbox"
            checked={settings.types.system}
            onChange={(e) => updateTypeSetting('system', e.target.checked)}
            className="w-4 h-4 text-amber-600 bg-gray-100 border-gray-300 rounded focus:ring-amber-500"
          />
        </div>
      </div>
    </div>
  );
};