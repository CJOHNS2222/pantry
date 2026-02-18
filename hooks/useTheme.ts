import { useEffect } from 'react';

interface ThemeSettings {
  mode: 'light' | 'dark';
  accentColor: string;
  backgroundColor?: string;
  textColor?: string;
}

export function useTheme(themeSettings: ThemeSettings) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeSettings.mode);
    document.documentElement.style.setProperty('--accent-color', themeSettings.accentColor);

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
  }, [themeSettings]);

  return { theme: themeSettings };
}
