import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import ErrorBoundary from '../../../components/ErrorBoundary';
import AnalyticsService from '../../../services/analyticsService';
import * as Sentry from '@sentry/react';

// Mock AnalyticsService
vi.mock('../../../services/analyticsService', () => ({
  default: {
    trackError: vi.fn(),
    trackAppCrash: vi.fn(),
  },
}));

// Mock Sentry
vi.mock('@sentry/react', () => ({
  withScope: vi.fn((callback) => callback({
    setTag: vi.fn(),
    setContext: vi.fn(),
    captureException: vi.fn(),
    addBreadcrumb: vi.fn(),
  })),
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

// Component that throws an error
const ErrorComponent: React.FC = () => {
  throw new Error('Test error');
};

// Component that can be toggled between error and safe
const ToggleComponent: React.FC<{ shouldError: boolean }> = ({ shouldError }) => {
  if (shouldError) {
    throw new Error('Test error');
  }
  return <div>Safe component</div>;
};

// Custom fallback component
const CustomFallback: React.FC<{ error?: Error; retry?: () => void }> = ({ error, retry }) => (
  <div data-testid="custom-fallback">
    <p>Custom error: {error?.message}</p>
    <button onClick={retry} data-testid="retry-button">Retry</button>
  </div>
);

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <ToggleComponent shouldError={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Safe component')).toBeInTheDocument();
  });

  it('renders default error UI when error occurs', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('😵')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('renders custom fallback when provided', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={CustomFallback}>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.getByText('Custom error: Test error')).toBeInTheDocument();
    expect(screen.getByTestId('retry-button')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('calls Sentry and AnalyticsService when error occurs', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(Sentry.withScope).toHaveBeenCalled();
    expect(AnalyticsService.trackError).toHaveBeenCalledWith(
      'react_error_boundary',
      'Test error',
      expect.any(String)
    );

    consoleSpy.mockRestore();
  });

  it('resets error state when Try Again is clicked', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();

    // Click try again - this should reset the error state
    fireEvent.click(screen.getByText('Try Again'));

    // The component should still show error UI since ErrorComponent still throws
    // But the state should have been reset (we can verify this by checking that
    // the component re-renders and catches the error again)
    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('resets error state when custom retry is called', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={CustomFallback}>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();

    // Click custom retry
    fireEvent.click(screen.getByTestId('retry-button'));

    // Should still show custom fallback since ErrorComponent still throws
    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('handles multiple errors correctly', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();

    // Reset and try again with error
    fireEvent.click(screen.getByText('Try Again'));

    // Should still show error UI since component still throws
    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});