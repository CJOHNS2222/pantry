import React from 'react';
import { Palette } from 'lucide-react';
import type { Settings as AppSettings } from '../../types';
import { LanguageSelector } from '../../src/components/LanguageSelector';

interface SettingsThemeSectionProps {
  title: string;
  settings: AppSettings;
  onResetTheme: () => void;
  onThemeModeChange: (mode: string) => void;
  onAccentColorChange: (accentColor: string) => void;
  onBackgroundColorChange: (backgroundColor: string) => void;
  onTextColorChange: (textColor: string) => void;
  labels: {
    theme: string;
    accent: string;
    background: string;
    textColor: string;
    language: string;
    dark: string;
    light: string;
  };
}

export const SettingsThemeSection: React.FC<SettingsThemeSectionProps> = ({
  title, settings, onResetTheme, onThemeModeChange, onAccentColorChange, onBackgroundColorChange, onTextColorChange, labels, }) => {
  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
      <div className="w-full flex items-center justify-between p-4 border-b border-theme bg-theme-primary/20">
        <div className="flex items-center gap-3">
          
          <Palette className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">{title}</h3>
        </div>
      </div>

      <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={onResetTheme}
              className="text-xs px-3 py-1 bg-theme-primary border border-theme rounded hover:bg-theme-secondary transition-colors text-theme-primary"
            >
              Reset to Default
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-primary">{labels.theme}</span>
              <select
                id="themeMode"
                name="themeMode"
                value={settings.theme.mode}
                onChange={(event) => onThemeModeChange(event.target.value)}
                className="border rounded px-2 py-1 text-black bg-white text-sm"
              >
                <option value="dark">{labels.dark}</option>
                <option value="light">{labels.light}</option>
              </select>
              <span className="text-sm text-theme-primary ml-4">{labels.accent}</span>
              <input
                id="accentColor"
                name="accentColor"
                type="color"
                list="accentColorPresets"
                value={settings.theme.accentColor}
                onChange={(event) => onAccentColorChange(event.target.value)}
                className="border rounded w-8 h-8 ml-2"
              />
              <datalist id="accentColorPresets">
                <option value="#0078d4" label="Blue" />
                <option value="#4CAF50" label="Green" />
                <option value="#e05c00" label="Orange" />
                <option value="#c2185b" label="Pink" />
                <option value="#7b1fa2" label="Purple" />
                <option value="#00796b" label="Teal" />
                <option value="#c62828" label="Red" />
                <option value="#37474f" label="Slate" />
              </datalist>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-primary">{labels.background}</span>
              <input
                id="backgroundColor"
                name="backgroundColor"
                type="color"
                value={settings.theme.backgroundColor || '#ffffff'}
                onChange={(event) => onBackgroundColorChange(event.target.value)}
                className="border rounded w-8 h-8"
              />
              <span className="text-sm text-theme-primary ml-4">{labels.textColor}</span>
              <input
                id="textColor"
                name="textColor"
                type="color"
                value={settings.theme.textColor || '#000000'}
                onChange={(event) => onTextColorChange(event.target.value)}
                className="border rounded w-8 h-8 ml-2"
              />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-theme">
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-primary">{labels.language}</span>
              <LanguageSelector />
            </div>
          </div>
        </div>
    </div>
  );
};
