import { useState, useEffect } from 'react';

export function useSettings() {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('settings');
    if (saved) {
      return JSON.parse(saved);
    }
    // Detect OS dark mode preference on first load
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return {
      notifications: {
        enabled: true,
        time: '09:00',
        types: { shoppingList: true, mealPlan: true },
      },
      theme: { mode: prefersDark ? 'dark' : 'light', accentColor: '#4CAF50' },
      shopping: {
        includeStaples: false, // Whether to include staple items in shopping lists
      },
    };
  });

  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem('settings', JSON.stringify(settings));
  }, [settings]);

  return { settings, setSettings };
}
