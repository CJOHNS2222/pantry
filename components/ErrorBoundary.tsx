import React from 'react';
import AnalyticsService from '../services/analyticsService';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; retry?: () => void }>;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    (this as React.Component<ErrorBoundaryProps, ErrorBoundaryState>).state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Track error in analytics
    AnalyticsService.trackError(
      'react_error_boundary',
      error.message,
      errorInfo.componentStack?.split('\n')[1]?.trim() || 'unknown'
    );
  }

  render() {
    const component = this as React.Component<ErrorBoundaryProps, ErrorBoundaryState>;
    if (component.state.hasError) {
      if (component.props.fallback) {
        const FallbackComponent = component.props.fallback;
        return (
          <FallbackComponent
            error={component.state.error}
            retry={() => component.setState({ hasError: false, error: undefined })}
          />
        );
      }

      return (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="text-center">
            <div className="text-6xl mb-4">😵</div>
            <h2 className="text-xl font-bold text-theme-secondary mb-2">Oops! Something went wrong</h2>
            <p className="text-theme-secondary opacity-70 mb-6 max-w-md">
              We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.
            </p>
            <button
              onClick={() => component.setState({ hasError: false, error: undefined })}
              className="bg-[var(--accent-color)] text-white px-6 py-3 rounded-lg font-medium hover:bg-[var(--accent-color)]/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return component.props.children;
  }
}

export default ErrorBoundary;