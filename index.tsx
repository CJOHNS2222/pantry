import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './src/index.css';
import { initSentry, captureError } from './services/sentryService';
import { log } from './services/logService';
import { I18nProvider } from './src/components/I18nProvider';
import { AppProvider } from './contexts/AppContext';
import { AppActionsProvider } from './contexts/AppActionsContext';

// Initialize Sentry for error reporting only when a real DSN is configured
// and running in production. This avoids noisy reports during local testing.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (import.meta.env.PROD && sentryDsn && sentryDsn !== 'https://your-sentry-dsn-here@sentry.io/project-id') {
  initSentry();
}

// Add global error handlers for debugging
window.addEventListener('error', (event) => {
  log.error('Global error caught:', { message: event.error?.message }, 'GlobalError');
  captureError(event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  log.error('Unhandled promise rejection:', { reason: String(event.reason) }, 'GlobalError');
  captureError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)));
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <I18nProvider>
    <AppProvider>
      <AppActionsProvider>
        <App />
      </AppActionsProvider>
    </AppProvider>
  </I18nProvider>
);