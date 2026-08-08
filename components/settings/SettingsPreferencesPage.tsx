import React from 'react';
import { SettingsThemeSection } from './SettingsThemeSection';
import { SettingsAppPreferencesSection } from './SettingsAppPreferencesSection';
import { SettingsTabVisibilitySection } from './SettingsTabVisibilitySection';
import { SettingsStoreLayoutSection } from './SettingsStoreLayoutSection';
import { SettingsCategoriesSection } from './SettingsCategoriesSection';
import { SettingsPantryImagesSection } from './SettingsPantryImagesSection';
import { Settings as AppSettings, User, UserProfile } from '../../types';
import { Tab } from '../../types/app';

interface SettingsPreferencesPageProps {
  user: User | null | undefined;
  userProfile: UserProfile | undefined;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  themeSectionTitle: string;
  onResetTheme: () => void;
  onThemeModeChange: (mode: string) => void;
  onAccentColorChange: (color: string) => void;
  onBackgroundColorChange: (color: string) => void;
  onTextColorChange: (color: string) => void;
  themeLabels: {
    theme: string;
    accent: string;
    background: string;
    textColor: string;
    language: string;
    dark: string;
    light: string;
  };

  onMeasurementSystemChange: (value: 'Standard' | 'Metric') => void;
  onCurrencyChange: (value: string) => void;
  geminiOptedIn: boolean;
  onGeminiOptInChange: (optedIn: boolean) => void;
  appPreferencesSectionTitle: string;
  appPreferencesLabels: {
    enableNotifications: string;
    measurementSystem: string;
    currency: string;
    enableAiFeatures: string;
    includeStaples: string;
    autoRestockStaples: string;
    showNutrition: string;
    showPriceData: string;
  };

  onTabVisibilityChange: (tab: Tab, isVisible: boolean) => void;

  storeLayoutTitle: string;
  defaultStoreLayout: string[];
  onStoreLayoutChange: (layout: string[]) => void;
  onStoreProfilesChange: (profiles: Record<string, string[]>, active?: string) => void;

  categoriesTitle: string;
  customCategoryCount: number;
  onManageCategories: () => void;

  pantryImagesTitle: string;
  updatingBulkImages: boolean;
  onBulkUpdate: () => Promise<void>;
}

export const SettingsPreferencesPage: React.FC<SettingsPreferencesPageProps> = ({
  user,
  userProfile,
  settings,
  setSettings,
  themeSectionTitle,
  onResetTheme,
  onThemeModeChange,
  onAccentColorChange,
  onBackgroundColorChange,
  onTextColorChange,
  themeLabels,
  onMeasurementSystemChange,
  onCurrencyChange,
  geminiOptedIn,
  onGeminiOptInChange,
  appPreferencesSectionTitle,
  appPreferencesLabels,
  onTabVisibilityChange,
  storeLayoutTitle,
  defaultStoreLayout,
  onStoreLayoutChange,
  onStoreProfilesChange,
  categoriesTitle,
  customCategoryCount,
  onManageCategories,
  pantryImagesTitle,
  updatingBulkImages,
  onBulkUpdate,
}) => {
  return (
    <>
      <SettingsThemeSection
        title={themeSectionTitle}
        settings={settings}
        onResetTheme={onResetTheme}
        onThemeModeChange={onThemeModeChange}
        onAccentColorChange={onAccentColorChange}
        onBackgroundColorChange={onBackgroundColorChange}
        onTextColorChange={onTextColorChange}
        labels={themeLabels}
      />

      <SettingsAppPreferencesSection
        title={appPreferencesSectionTitle}
        settings={settings}
        setSettings={setSettings}
        userProfile={userProfile}
        onMeasurementSystemChange={onMeasurementSystemChange}
        onCurrencyChange={onCurrencyChange}
        geminiOptedIn={geminiOptedIn}
        onGeminiOptInChange={onGeminiOptInChange}
        labels={appPreferencesLabels}
      />

      <SettingsTabVisibilitySection
        hiddenTabs={settings.navigation?.hiddenTabs}
        onTabVisibilityChange={onTabVisibilityChange}
      />

      <SettingsStoreLayoutSection
        userExists={!!user}
        title={storeLayoutTitle}
        storeLayout={settings.shopping?.storeLayout || defaultStoreLayout}
        onStoreLayoutChange={onStoreLayoutChange}
        storeProfiles={settings.shopping?.storeProfiles ?? {}}
        activeStoreProfile={settings.shopping?.activeStoreProfile}
        onStoreProfilesChange={onStoreProfilesChange}
      />

      <SettingsCategoriesSection
        userExists={!!user}
        title={categoriesTitle}
        customCategoryCount={customCategoryCount}
        onManageCategories={onManageCategories}
      />

      <SettingsPantryImagesSection
        user={user ?? undefined}
        title={pantryImagesTitle}
        updatingBulkImages={updatingBulkImages}
        onBulkUpdate={onBulkUpdate}
      />
    </>
  );
};
