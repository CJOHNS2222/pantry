import React from 'react';
import * as Sentry from '@sentry/react';
import AnalyticsService from '../services/analyticsService';

interface ComponentErrorBoundaryProps {
  children: React.ReactNode;
  componentName: string;
  fallback?: React.ComponentType<{ error?: Error; retry?: () => void }>;
  showErrorDetails?: boolean;
}

interface ComponentErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorId?: string;
}

class ComponentErrorBoundary extends React.Component<ComponentErrorBoundaryProps, ComponentErrorBoundaryState> {
  constructor(props: ComponentErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ComponentErrorBoundaryState {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`Error in ${this.props.componentName}:`, error, errorInfo);

    // Report to Sentry with component context
    Sentry.withScope((scope) => {
      scope.setTag('component', this.props.componentName);
      scope.setTag('error_type', 'component_error');
      scope.setTag('error_id', this.state.errorId);
      scope.setContext('component_error_info', {
        componentName: this.props.componentName,
        componentStack: errorInfo.componentStack,
        errorBoundary: 'ComponentErrorBoundary'
      });
      Sentry.captureException(error);
    });

    // Track error in analytics
    AnalyticsService.trackError(
      `component_error_${this.props.componentName}`,
      error.message,
      errorInfo.componentStack?.split('\n')[1]?.trim() || 'unknown'
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorId: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={this.state.error}
            retry={this.handleRetry}
          />
        );
      }

      return (
        <div className="flex flex-col items-center justify-center py-8 px-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div className="text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
              {this.props.componentName} Error
            </h3>
            <p className="text-red-600 dark:text-red-300 text-sm mb-4 max-w-sm">
              Something went wrong in the {this.props.componentName.toLowerCase()} component.
              This error has been reported and we're working to fix it.
            </p>
            {this.props.showErrorDetails && this.state.error && (
              <details className="mb-4 text-left">
                <summary className="cursor-pointer text-xs text-red-500 hover:text-red-600 mb-2">
                  Error Details (for debugging)
                </summary>
                <pre className="text-xs bg-red-100 dark:bg-red-900/50 p-2 rounded overflow-auto max-h-32">
                  {this.state.error.message}
                  {this.state.errorId && `\nError ID: ${this.state.errorId}`}
                </pre>
              </details>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={this.handleRetry}
                className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="bg-gray-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ComponentErrorBoundary;