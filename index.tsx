import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './src/index.css';
import { initSentry, captureError } from './services/sentryService';
import { log } from './services/logService';
import crashlytics from './services/crashlyticsService';
import { I18nProvider } from './src/components/I18nProvider';
import { AppProvider } from './contexts/AppContext';
import { AppActionsProvider } from './contexts/AppActionsContext';
import { cleanupCacheService } from './services/cacheService';
import DatabaseMonitoringService from './services/databaseMonitoringService';
import { offlineDataCache } from './services/offlineDataCache';
import remoteConfig from './services/remoteConfigService';
import { applyRemoteConfigToFlags } from './services/featureFlags';

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
  const msg: string = event.error?.message ?? String(event.message);
  crashlytics.log(`Global error: ${msg}`);
  crashlytics.recordException(msg, [{ key: 'handler', value: 'global_error' }]);
});

window.addEventListener('unhandledrejection', (event) => {
  log.error('Unhandled promise rejection:', { reason: String(event.reason) }, 'GlobalError');
  const err = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
  captureError(err);
  crashlytics.log(`Unhandled rejection: ${err.message}`);
  crashlytics.recordException(err.message, [{ key: 'handler', value: 'unhandled_rejection' }]);
});

// Cleanup service intervals on page unload to prevent memory leaks
window.addEventListener('pagehide', () => {
  cleanupCacheService();
  DatabaseMonitoringService.cleanupMonitoring();
  offlineDataCache.destroy();
});

// Initialise Remote Config early (fire-and-forget — app renders immediately
// from in-app defaults; RC values apply on next getBoolean/getNumber call once
// the fetch resolves, which is nearly instant from cache on repeat launches).
remoteConfig.init().then(() => {
  applyRemoteConfigToFlags();
}).catch(() => { /* non-fatal — in-app defaults remain active */ });

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