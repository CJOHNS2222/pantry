import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Minimal providers wrapper. Add more providers/mocks here as needed.
function Providers({ children }: { children?: React.ReactNode }) {
  return (
    <MemoryRouter>
      {children}
    </MemoryRouter>
  );
}

export function render(ui: React.ReactElement, options = {}) {
  return rtlRender(ui, { wrapper: Providers, ...options });
}

export * from '@testing-library/react';
