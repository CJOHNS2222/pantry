import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../components/I18nProvider';
import { AppProvider } from '../../contexts/AppContext';
import { AppActionsProvider } from '../../contexts/AppActionsContext';

// Minimal providers wrapper that mirrors the app root. Add more providers/mocks here as needed.
function Providers({ children }: { children?: React.ReactNode }) {
  return (
    <MemoryRouter>
      <I18nProvider>
        <AppProvider>
          <AppActionsProvider>
            {children}
          </AppActionsProvider>
        </AppProvider>
      </I18nProvider>
    </MemoryRouter>
  );
}

export function render(ui: React.ReactElement, options = {}) {
  return rtlRender(ui, { wrapper: Providers, ...options });
}

export * from '@testing-library/react';
