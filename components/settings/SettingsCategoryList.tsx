import React from 'react';
import { Bell, ChevronRight, HelpCircle, RefreshCw, Shield, Sliders, Star, TrendingDown, User as UserIcon } from 'lucide-react';
import { SettingsGuestBanner } from './SettingsGuestBanner';
import HapticService from '../../services/hapticService';

interface SettingsCategoryListProps {
  isGuest: boolean;
  onLogout?: () => void;
  isAdmin: boolean;
  setActiveCategory: (category: string) => void;
}

export const SettingsCategoryList: React.FC<SettingsCategoryListProps> = ({
  isGuest,
  onLogout,
  isAdmin,
  setActiveCategory,
}) => {
  return (
    <div className="pt-4 px-6 space-y-6">
      <div className="text-center pb-4">
        <h2 className="text-3xl font-serif font-bold text-theme-primary">Settings</h2>
        <p className="text-xs text-theme-secondary mt-1">Configure your app and manage your kitchen data</p>
      </div>

      <SettingsGuestBanner
        isGuest={isGuest}
        onLogout={onLogout}
      />

      <div className="bg-theme-secondary border border-theme rounded-2xl overflow-hidden divide-y divide-theme shadow-sm">
        {/* Account Info */}
        <button
          onClick={() => { HapticService.light(); setActiveCategory('account_info'); }}
          className="w-full flex items-center justify-between p-4 hover:bg-theme-primary/5 transition-colors text-left focus:outline-none"
          data-category="account-info"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)]">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <span className="font-semibold text-theme-primary block text-sm">Account Info</span>
              <span className="text-[11px] text-theme-secondary opacity-70">Profile, dietary & food safety preferences, household sharing</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-theme-secondary" />
        </button>

        {/* Subscription */}
        <button
          onClick={() => { HapticService.light(); setActiveCategory('subscription'); }}
          className="w-full flex items-center justify-between p-4 hover:bg-theme-primary/5 transition-colors text-left focus:outline-none"
          data-category="subscription"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)]">
              <Star className="w-5 h-5" />
            </div>
            <div>
              <span className="font-semibold text-theme-primary block text-sm">Subscription</span>
              <span className="text-[11px] text-theme-secondary opacity-70">Plan, usage limits, billing, upgrade or manage premium</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-theme-secondary" />
        </button>

        {/* Preferences */}
        <button
          onClick={() => { HapticService.light(); setActiveCategory('preferences'); }}
          className="w-full flex items-center justify-between p-4 hover:bg-theme-primary/5 transition-colors text-left focus:outline-none"
          data-category="preferences"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <span className="font-semibold text-theme-primary block text-sm">Preferences & Theme</span>
              <span className="text-[11px] text-theme-secondary opacity-70">App theme, currency, units, tab visibility, store layout, categories, pantry images</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-theme-secondary" />
        </button>

        {/* Notifications */}
        <button
          onClick={() => { HapticService.light(); setActiveCategory('notifications'); }}
          className="w-full flex items-center justify-between p-4 hover:bg-theme-primary/5 transition-colors text-left focus:outline-none"
          data-category="notifications"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)]">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <span className="font-semibold text-theme-primary block text-sm">Notifications & Reminders</span>
              <span className="text-[11px] text-theme-secondary opacity-70">Push notifications, expiration alerts, meal plan reminders</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-theme-secondary" />
        </button>

        {/* Food Waste & Expiration Settings */}
        <button
          onClick={() => { HapticService.light(); setActiveCategory('food_waste'); }}
          className="w-full flex items-center justify-between p-4 hover:bg-theme-primary/5 transition-colors text-left focus:outline-none"
          data-category="food-waste"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)]">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <span className="font-semibold text-theme-primary block text-sm">Food Waste & Expiration Rules</span>
              <span className="text-[11px] text-theme-secondary opacity-70">Leftover analytics and waste tracking</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-theme-secondary" />
        </button>

        {/* Help & Support (merged Contact Us + Help/FAQ) */}
        <button
          onClick={() => { HapticService.light(); setActiveCategory('help_and_support'); }}
          className="w-full flex items-center justify-between p-4 hover:bg-theme-primary/5 transition-colors text-left focus:outline-none"
          data-category="help-and-support"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)]">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="font-semibold text-theme-primary block text-sm">Help & Support</span>
              <span className="text-[11px] text-theme-secondary opacity-70">FAQ, contact us, privacy & legal, feedback</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-theme-secondary" />
        </button>

        {/* Update */}
        <button
          onClick={() => { HapticService.light(); setActiveCategory('update'); }}
          className="w-full flex items-center justify-between p-4 hover:bg-theme-primary/5 transition-colors text-left focus:outline-none"
          data-category="update"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)]">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <span className="font-semibold text-theme-primary block text-sm">Update</span>
              <span className="text-[11px] text-theme-secondary opacity-70">App updates and version details</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-theme-secondary" />
        </button>

        {/* Admin Analytics (admin-only) */}
        {isAdmin && (
          <button
            onClick={() => setActiveCategory('admin_analytics')}
            className="w-full flex items-center justify-between p-4 hover:bg-theme-primary/5 transition-colors text-left focus:outline-none"
            data-category="admin"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)]">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <span className="font-semibold text-theme-primary block text-sm">Admin</span>
                <span className="text-[11px] text-theme-secondary opacity-70">Monitoring, performance, and user behavior dashboards; remote config debug; usage reset</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-theme-secondary" />
          </button>
        )}
      </div>
    </div>
  );
};
