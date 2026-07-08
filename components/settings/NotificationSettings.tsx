import React, { useState, useEffect } from 'react';
import { Bell, Clock, Settings as SettingsIcon } from 'lucide-react';
import { NotificationService, NotificationSettings } from '../../services/notificationService';
import { User } from '../../types';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { pushNotificationService } from '../../services/pushNotificationService';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import { log } from '../../services/logService';

interface NotificationSettingsProps {
  user: User;
  currentSettings: NotificationSettings;
  onSettingsChange: (settings: NotificationSettings) => void;
}

export const NotificationSettingsComponent: React.FC<NotificationSettingsProps> = ({
  user,
  currentSettings,
  onSettingsChange
}) => {
  const [settings, setSettings] = useState<NotificationSettings>(currentSettings);
  const [showSettingsFallback, setShowSettingsFallback] = useState(false);

  // Register fallback modal with the LIFO Android hardware back button stack
  useAndroidBack(showSettingsFallback, () => setShowSettingsFallback(false));

  useEffect(() => {
    setSettings(currentSettings);
  }, [currentSettings]);

  const applySettingsWithPermissionCheck = async (newSettings: NotificationSettings) => {
    if (!newSettings.enabled) {
      // If disabling notifications, apply immediately
      setSettings(newSettings);
      onSettingsChange(newSettings);
      return;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const status = await PushNotifications.checkPermissions();
        if (status.receive === 'granted') {
          // Already granted: initialize service context and save
          await pushNotificationService.initialize(user.id);
          setSettings(newSettings);
          onSettingsChange(newSettings);
        } else if (status.receive === 'prompt') {
          // First-time prompt from within the settings page
          await pushNotificationService.initialize(user.id);
          const postStatus = await PushNotifications.checkPermissions();
          if (postStatus.receive === 'granted') {
            setSettings(newSettings);
            onSettingsChange(newSettings);
          } else {
            // Decined during prompt: force toggle back to false
            const disabledSettings = { ...newSettings, enabled: false };
            setSettings(disabledSettings);
            onSettingsChange(disabledSettings);
            if (postStatus.receive === 'denied') {
              setShowSettingsFallback(true);
            }
          }
        } else if (status.receive === 'denied') {
          // Permanently blocked: force toggle back to false and show system guide
          const disabledSettings = { ...newSettings, enabled: false };
          setSettings(disabledSettings);
          onSettingsChange(disabledSettings);
          setShowSettingsFallback(true);
        }
      } catch (error) {
        log.error('Failed to check notification permissions in settings', { error }, 'NotificationSettings');
        const disabledSettings = { ...newSettings, enabled: false };
        setSettings(disabledSettings);
        onSettingsChange(disabledSettings);
      }
    } else {
      // Web or non-native platform: apply immediately
      setSettings(newSettings);
      onSettingsChange(newSettings);
    }
  };

  const updateSettings = (updates: Partial<NotificationSettings>) => {
    const newSettings = { ...settings, ...updates };
    
    // Intercept if they are attempting to enable notifications from a disabled state
    if (updates.enabled === true && !settings.enabled) {
      applySettingsWithPermissionCheck(newSettings);
    } else {
      setSettings(newSettings);
      onSettingsChange(newSettings);
    }
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
    <>
      <div className="space-y-6">
        {/* Presets */}
        <div>
          <p className="text-xs text-theme-secondary mb-2">Quick presets</p>
          <div className="flex gap-2">
            {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((preset) => (
              <button
                key={preset}
                onClick={() => applySettingsWithPermissionCheck(PRESETS[preset])}
                className="flex-1 px-3 py-1.5 rounded-lg text-sm font-semibold bg-theme-primary/10 border border-theme text-theme-secondary hover:bg-[var(--accent-color)]/20 hover:text-theme-primary transition-colors cursor-pointer"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Master toggle */}
        <div>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-theme-primary font-medium">Enable Notifications</span>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => updateSettings({ enabled: e.target.checked })}
              className="w-4 h-4 text-[var(--accent-color)] border-theme rounded focus:ring-[var(--accent-color)] bg-theme-secondary"
            />
          </label>
          <p className="text-xs text-theme-secondary mt-1">
            Receive alerts about expiring items, recipe suggestions, and household activity
          </p>
        </div>

        {/* Quiet hours */}
        <div className="p-4 bg-theme-primary/5 rounded-xl border border-theme">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-[var(--accent-color)]" />
            <span className="text-theme-primary font-medium">Quiet Hours</span>
          </div>

          <label className="flex items-center justify-between mb-3 cursor-pointer">
            <span className="text-theme-secondary text-sm">Enable quiet hours</span>
            <input
              type="checkbox"
              checked={settings.quietHours.enabled}
              onChange={(e) => updateQuietHours('enabled', e.target.checked)}
              className="w-4 h-4 text-[var(--accent-color)] border-theme rounded focus:ring-[var(--accent-color)] bg-theme-secondary"
            />
          </label>

          {settings.quietHours.enabled && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-theme-secondary mb-1">Start Time</label>
                <input
                  type="time"
                  value={settings.quietHours.start}
                  onChange={(e) => updateQuietHours('start', e.target.value)}
                  className="w-full bg-theme-secondary border border-theme rounded-lg px-3 py-2 text-theme-primary text-sm focus:border-theme-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-theme-secondary mb-1">End Time</label>
                <input
                  type="time"
                  value={settings.quietHours.end}
                  onChange={(e) => updateQuietHours('end', e.target.value)}
                  className="w-full bg-theme-secondary border border-theme rounded-lg px-3 py-2 text-theme-primary text-sm focus:border-theme-primary outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Notification types */}
        <div className="space-y-4 border-t border-theme pt-4">
          <h4 className="text-theme-primary font-medium flex items-center gap-2 text-sm">
            <SettingsIcon className="w-4 h-4 text-[var(--accent-color)]" />
            Notification Types
          </h4>

          {/* Expiration alerts */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-theme-primary text-sm font-medium">Expiration Alerts</span>
              <p className="text-xs text-theme-secondary">Get notified when items are about to expire</p>
            </div>
            <select
              value={settings.types.expiration}
              onChange={(e) => updateTypeSetting('expiration', e.target.value)}
              className="bg-theme-secondary border border-theme rounded-lg px-3 py-1.5 text-theme-primary text-sm focus:border-theme-primary outline-none"
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
              <span className="text-theme-primary text-sm font-medium">Allergy Alerts</span>
              <p className="text-xs text-theme-secondary">High-priority alerts for potential allergen exposure</p>
            </div>
            <input
              type="checkbox"
              checked={settings.types.allergy_alert}
              onChange={(e) => updateTypeSetting('allergy_alert', e.target.checked)}
              className="w-4 h-4 text-[var(--accent-color)] border-theme rounded focus:ring-[var(--accent-color)] bg-theme-secondary cursor-pointer"
            />
          </div>

          {/* Recipe suggestions */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-theme-primary text-sm font-medium">Recipe Suggestions</span>
              <p className="text-xs text-theme-secondary">Suggestions based on your pantry items</p>
            </div>
            <input
              type="checkbox"
              checked={settings.types.recipe_suggestion}
              onChange={(e) => updateTypeSetting('recipe_suggestion', e.target.checked)}
              className="w-4 h-4 text-[var(--accent-color)] border-theme rounded focus:ring-[var(--accent-color)] bg-theme-secondary cursor-pointer"
            />
          </div>

          {/* Household activity */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-theme-primary text-sm font-medium">Household Activity</span>
              <p className="text-xs text-theme-secondary">When family members add/remove items</p>
            </div>
            <input
              type="checkbox"
              checked={settings.types.household_activity}
              onChange={(e) => updateTypeSetting('household_activity', e.target.checked)}
              className="w-4 h-4 text-[var(--accent-color)] border-theme rounded focus:ring-[var(--accent-color)] bg-theme-secondary cursor-pointer"
            />
          </div>

          {/* Expired items check */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-theme-primary text-sm font-medium">Expired Items Check</span>
              <p className="text-xs text-theme-secondary">Show expired items list on app load</p>
            </div>
            <input
              type="checkbox"
              checked={settings.types.expired_items_check}
              onChange={(e) => updateTypeSetting('expired_items_check', e.target.checked)}
              className="w-4 h-4 text-[var(--accent-color)] border-theme rounded focus:ring-[var(--accent-color)] bg-theme-secondary cursor-pointer"
            />
          </div>

          {/* Shopping reminders */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-theme-primary text-sm font-medium">Shopping Reminders</span>
              <p className="text-xs text-theme-secondary">Weekly reminders to check your shopping list</p>
            </div>
            <input
              type="checkbox"
              checked={settings.types.shopping_reminder}
              onChange={(e) => updateTypeSetting('shopping_reminder', e.target.checked)}
              className="w-4 h-4 text-[var(--accent-color)] border-theme rounded focus:ring-[var(--accent-color)] bg-theme-secondary cursor-pointer"
            />
          </div>

          {/* System updates */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-theme-primary text-sm font-medium">System Updates</span>
              <p className="text-xs text-theme-secondary">App updates, new features, and maintenance</p>
            </div>
            <input
              type="checkbox"
              checked={settings.types.system}
              onChange={(e) => updateTypeSetting('system', e.target.checked)}
              className="w-4 h-4 text-[var(--accent-color)] border-theme rounded focus:ring-[var(--accent-color)] bg-theme-secondary cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Settings Denied Fallback Dialog */}
      {showSettingsFallback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-theme-secondary rounded-2xl shadow-2xl max-w-sm w-full relative overflow-hidden border border-theme">
            {/* Header banner with purple/pink gradient to match notifications */}
            <div className="h-20 bg-gradient-to-r from-purple-500 to-pink-500 relative flex items-center justify-center">
              <Bell className="w-8 h-8 text-white animate-[pulse_2s_infinite]" />
            </div>
            {/* Content */}
            <div className="p-6">
              <h2 className="text-xl font-bold text-theme-primary text-center mb-2">
                Alerts Permission Required
              </h2>
              <p className="text-theme-secondary text-sm text-center mb-6 leading-relaxed">
                Notification permissions are permanently disabled at the system level. Please enable alerts in your system settings to receive expiration and meal prep updates.
              </p>
              
              <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/30 rounded-xl p-4 mb-6">
                <h3 className="font-semibold text-purple-800 dark:text-purple-300 text-xs mb-1">
                  How to enable:
                </h3>
                <ol className="text-xs text-purple-700 dark:text-purple-400 list-decimal pl-4 space-y-1">
                  {Capacitor.getPlatform() === 'ios' ? (
                    <>
                      <li>Open iOS Settings</li>
                      <li>Scroll down to Stock & Spoon</li>
                      <li>Tap Notifications</li>
                      <li>Toggle "Allow Notifications" ON</li>
                    </>
                  ) : (
                    <>
                      <li>Open Android Settings</li>
                      <li>Go to Apps & Notifications (or Apps)</li>
                      <li>Select Stock & Spoon</li>
                      <li>Tap Notifications and enable all alerts</li>
                    </>
                  )}
                </ol>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setShowSettingsFallback(false)}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};