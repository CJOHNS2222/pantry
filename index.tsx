import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './src/index.css';
import { initSentry } from './services/sentryService';
import { I18nProvider } from './src/components/I18nProvider';
import { AppProvider } from './contexts/AppContext';
import { AppActionsProvider } from './contexts/AppActionsContext';

// Initialize Sentry for error reporting
// initSentry(); // DISABLED for testing

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