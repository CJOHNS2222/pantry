import * as Sentry from '@sentry/react';

// Initialize Sentry
export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development';

  if (!dsn || dsn === 'https://your-sentry-dsn-here@sentry.io/project-id') {
    console.warn('Sentry DSN not configured. Error reporting disabled.');
    return;
  }

  Sentry.init({
    dsn,
    environment,
    integrations: [
      // BrowserTracing is now built-in in v8+
      Sentry.browserTracingIntegration({
        tracePropagationTargets: [
          'localhost',
          /^https:\/\/.*\.firebaseapp\.com/,
          /^https:\/\/.*\.web\.app/,
        ],
      }),
    ],
    // Performance Monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,

    // Error filtering
    beforeSend(event, hint) {
      // Filter out common non-actionable errors
      const error = hint.originalException;
      if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as Error).message;

        // Filter out network errors that are expected (offline, CORS, etc.)
        if (message.includes('Failed to fetch') ||
            message.includes('NetworkError') ||
            message.includes('CORS') ||
            message.includes('Load failed')) {
          return null;
        }

        // Filter out Firebase auth errors that are user-facing
        if (message.includes('auth/') ||
            message.includes('Firebase: Error')) {
          return null;
        }
      }

      return event;
    },

    // Capture console errors in production
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'console' && breadcrumb.level === 'error') {
        return breadcrumb;
      }
      return breadcrumb;
    }
  });

  console.log(`Sentry initialized for ${environment} environment`);
};

// Enhanced error reporting for database operations
export const reportDatabaseError = (operation: string, collection: string, error: Error, context?: any) => {
  Sentry.withScope((scope) => {
    scope.setTag('operation', operation);
    scope.setTag('collection', collection);
    scope.setTag('component', 'database');

    if (context) {
      scope.setContext('operation_context', context);
    }

    Sentry.captureException(error);
  });
};

// Report performance issues
export const reportPerformanceIssue = (operation: string, duration: number, threshold: number, context?: any) => {
  Sentry.withScope((scope) => {
    scope.setTag('type', 'performance');
    scope.setTag('operation', operation);
    scope.setLevel('warning');

    scope.setContext('performance_data', {
      duration,
      threshold,
      exceeded_by: duration - threshold,
      ...context
    });

    Sentry.captureMessage(`Performance issue: ${operation} took ${duration}ms (threshold: ${threshold}ms)`, 'warning');
  });
};

// Report sync queue issues
export const reportSyncIssue = (operation: string, error: Error, retryCount: number, context?: any) => {
  Sentry.withScope((scope) => {
    scope.setTag('type', 'sync');
    scope.setTag('operation', operation);
    scope.setTag('retry_count', retryCount.toString());

    scope.setContext('sync_context', {
      retry_count: retryCount,
      ...context
    });

    Sentry.captureException(error);
  });
};

// Report heavy write patterns
export const reportHeavyWritePattern = (collection: string, writeCount: number, timeWindow: number, context?: any) => {
  Sentry.withScope((scope) => {
    scope.setTag('type', 'heavy_write');
    scope.setTag('collection', collection);
    scope.setLevel('warning');

    scope.setContext('write_pattern', {
      write_count: writeCount,
      time_window_seconds: timeWindow / 1000,
      writes_per_second: writeCount / (timeWindow / 1000),
      ...context
    });

    Sentry.captureMessage(
      `Heavy write pattern detected: ${writeCount} writes to ${collection} in ${timeWindow / 1000}s`,
      'warning'
    );
  });
};

export default Sentry;