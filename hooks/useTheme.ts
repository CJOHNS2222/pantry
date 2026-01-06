import { useEffect } from 'react';

interface ThemeSettings {
  mode: 'light' | 'dark';
  accentColor: string;
  backgroundColor?: string;
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
  }, [themeSettings]);

  return { theme: themeSettings };
}