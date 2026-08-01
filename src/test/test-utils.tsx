import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import { I18nProvider } from '../components/I18nProvider';
import { AppProvider } from '../../contexts/AppContext';
import { AppActionsProvider } from '../../contexts/AppActionsContext';

// Minimal providers wrapper that mirrors the app root. Add more providers/mocks here as needed.
// Note: the app has no router (see CLAUDE.md — App.tsx uses tab-based navigation,
// not react-router-dom), so tests don't need a Router wrapper either.
function Providers({ children }: { children?: React.ReactNode }) {
  return (
    <I18nProvider>
      <AppProvider>
        <AppActionsProvider>
          {children}
        </AppActionsProvider>
      </AppProvider>
    </I18nProvider>
  );
}

export function render(ui: React.ReactElement, options = {}) {
  return rtlRender(ui, { wrapper: Providers, ...options });
}

export * from '@testing-library/react';
