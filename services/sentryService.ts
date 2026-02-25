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
    // Keep initialization minimal to avoid type mismatches across Sentry packages
    // Advanced integrations (replay, feedback, browser tracing) are optional and
    // can be added back with the correct package imports and typings.
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

    // Enhanced breadcrumb capture
    beforeBreadcrumb(breadcrumb, hint) {
      // Capture console errors in production
      if (breadcrumb.category === 'console' && breadcrumb.level === 'error') {
        return breadcrumb;
      }

      // Capture navigation breadcrumbs
      if (breadcrumb.category === 'navigation') {
        return breadcrumb;
      }

      // Capture user interaction breadcrumbs
      if (breadcrumb.category === 'ui.click' || breadcrumb.category === 'ui.input') {
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

// User action tracking for breadcrumbs
export const trackUserAction = (action: string, category: string, details?: any) => {
  Sentry.addBreadcrumb({
    category: 'user_action',
    message: action,
    level: 'info',
    data: {
      category,
      ...details,
      timestamp: new Date().toISOString(),
    },
  });
};

// Track navigation events
export const trackNavigation = (from: string, to: string, context?: any) => {
  Sentry.addBreadcrumb({
    category: 'navigation',
    message: `Navigation: ${from} → ${to}`,
    level: 'info',
    data: {
      from,
      to,
      ...context,
    },
  });
};

// Track feature usage
export const trackFeatureUsage = (feature: string, action: string, details?: any) => {
  Sentry.addBreadcrumb({
    category: 'feature_usage',
    message: `Feature: ${feature} - ${action}`,
    level: 'info',
    data: {
      feature,
      action,
      ...details,
    },
  });
};

// Track user authentication events
export const trackAuthEvent = (event: 'login' | 'logout' | 'signup' | 'password_reset', details?: any) => {
  Sentry.addBreadcrumb({
    category: 'auth',
    message: `Auth: ${event}`,
    level: 'info',
    data: {
      event,
      ...details,
    },
  });
};

// Track shopping list operations
export const trackShoppingListAction = (action: 'add_item' | 'remove_item' | 'check_item' | 'uncheck_item' | 'clear_list', details?: any) => {
  Sentry.addBreadcrumb({
    category: 'shopping_list',
    message: `Shopping: ${action}`,
    level: 'info',
    data: {
      action,
      ...details,
    },
  });
};

// Track recipe operations
export const trackRecipeAction = (action: 'search' | 'save' | 'unsave' | 'rate' | 'generate_meal_plan', details?: any) => {
  Sentry.addBreadcrumb({
    category: 'recipe',
    message: `Recipe: ${action}`,
    level: 'info',
    data: {
      action,
      ...details,
    },
  });
};

// Track pantry operations
export const trackPantryAction = (action: 'add_item' | 'edit_item' | 'delete_item' | 'scan_item' | 'search_items', details?: any) => {
  Sentry.addBreadcrumb({
    category: 'pantry',
    message: `Pantry: ${action}`,
    level: 'info',
    data: {
      action,
      ...details,
    },
  });
};

// Track household operations
export const trackHouseholdAction = (action: 'create' | 'join' | 'leave' | 'invite_member' | 'remove_member', details?: any) => {
  Sentry.addBreadcrumb({
    category: 'household',
    message: `Household: ${action}`,
    level: 'info',
    data: {
      action,
      ...details,
    },
  });
};

// Track performance metrics
export const trackPerformanceMetric = (metric: string, value: number, unit: string, context?: any) => {
  Sentry.addBreadcrumb({
    category: 'performance',
    message: `Performance: ${metric} = ${value}${unit}`,
    level: 'info',
    data: {
      metric,
      value,
      unit,
      ...context,
    },
  });
};

// Track error boundaries
export const trackErrorBoundary = (component: string, error: Error, errorInfo?: any) => {
  Sentry.addBreadcrumb({
    category: 'error_boundary',
    message: `Error boundary caught error in ${component}`,
    level: 'error',
    data: {
      component,
      error_message: error.message,
      error_stack: error.stack,
      ...errorInfo,
    },
  });
};

// Set user context for better error tracking
export const setUserContext = (userId: string, email?: string, householdId?: string) => {
  Sentry.setUser({
    id: userId,
    email: email,
    household_id: householdId,
  });

  Sentry.setTag('user_id', userId);
  if (householdId) {
    Sentry.setTag('household_id', householdId);
  }
};

// Clear user context on logout
export const clearUserContext = () => {
  Sentry.setUser(null);
  Sentry.setTag('user_id', undefined);
  Sentry.setTag('household_id', undefined);
};

// Set app context
export const setAppContext = (version: string, platform: 'web' | 'android' | 'ios', theme: 'light' | 'dark') => {
  Sentry.setTag('app_version', version);
  Sentry.setTag('platform', platform);
  Sentry.setTag('theme', theme);

  Sentry.setContext('app_info', {
    version,
    platform,
    theme,
    user_agent: navigator.userAgent,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
};

export default Sentry;
