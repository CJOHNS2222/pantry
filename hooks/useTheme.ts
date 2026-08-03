import { useEffect } from 'react';
import NavigationBarService from '../services/navigationBarService';

interface ThemeSettings {
  mode: 'light' | 'dark';
  accentColor: string;
  backgroundColor?: string;
  textColor?: string;
}

function getContrastColor(hexColor: string): string {
  if (!hexColor || !hexColor.startsWith('#')) return '#ffffff';
  try {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return '#ffffff';
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? '#111827' : '#ffffff';
  } catch {
    return '#ffffff';
  }
}

export function useTheme(themeSettings: ThemeSettings) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeSettings.mode);
    document.documentElement.style.setProperty('--accent-color', themeSettings.accentColor);
    document.documentElement.style.setProperty('--accent-text', getContrastColor(themeSettings.accentColor));

    if (themeSettings.backgroundColor) {
      // Apply custom background color to body and override theme defaults
      document.body.style.backgroundColor = themeSettings.backgroundColor;
      document.documentElement.style.setProperty('--bg-primary', themeSettings.backgroundColor);
      document.documentElement.style.setProperty('--theme-background', themeSettings.backgroundColor);
    } else {
      // Reset to default theme colors
      document.body.style.backgroundColor = '';
      document.documentElement.style.removeProperty('--bg-primary');
      document.documentElement.style.removeProperty('--theme-background');
    }

    if (themeSettings.textColor) {
      // Apply custom text color to document and override theme defaults
      document.documentElement.style.setProperty('--text-primary', themeSettings.textColor);
      document.documentElement.style.setProperty('--text-secondary', themeSettings.textColor);
      document.documentElement.style.color = themeSettings.textColor;
    } else {
      // Reset to default text colors
      document.documentElement.style.removeProperty('--text-primary');
      document.documentElement.style.removeProperty('--text-secondary');
      document.documentElement.style.removeProperty('color');
    }

    // Sync Android native bottom navigation bar with current theme
    NavigationBarService.setTheme(themeSettings.mode, themeSettings.backgroundColor);
  }, [themeSettings]);

  return { theme: themeSettings };
}
