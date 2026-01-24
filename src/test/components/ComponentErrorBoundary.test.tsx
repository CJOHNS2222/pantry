import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ComponentErrorBoundary from '../../../components/ComponentErrorBoundary';

// Mock Sentry
vi.mock('@sentry/react', () => ({
  withScope: vi.fn((callback) => callback({
    setTag: vi.fn(),
    setContext: vi.fn(),
    captureException: vi.fn(),
  })),
  captureException: vi.fn(),
}));

// Mock AnalyticsService
vi.mock('../../../services/analyticsService', () => ({
  default: {
    trackError: vi.fn(),
  },
}));

// Component that throws an error
const ErrorComponent: React.FC = () => {
  throw new Error('Test error');
};

// Component that doesn't throw an error
const NormalComponent: React.FC = () => <div>Normal component</div>;

describe('ComponentErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders children when no error occurs', () => {
    render(
      <ComponentErrorBoundary componentName="TestComponent">
        <NormalComponent />
      </ComponentErrorBoundary>
    );

    expect(screen.getByText('Normal component')).toBeInTheDocument();
  });

  it('renders error UI when child component throws', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ComponentErrorBoundary componentName="TestComponent">
        <ErrorComponent />
      </ComponentErrorBoundary>
    );

    expect(screen.getByText('TestComponent Error')).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong in the testcomponent component/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload Page' })).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('shows error details when showErrorDetails is true', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ComponentErrorBoundary componentName="TestComponent" showErrorDetails={true}>
        <ErrorComponent />
      </ComponentErrorBoundary>
    );

    expect(screen.getByText('Error Details (for debugging)')).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('Test error'))).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('does not show error details when showErrorDetails is false', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ComponentErrorBoundary componentName="TestComponent" showErrorDetails={false}>
        <ErrorComponent />
      </ComponentErrorBoundary>
    );

    expect(screen.queryByText('Error Details (for debugging)')).not.toBeInTheDocument();
    expect(screen.queryByText('Test error')).not.toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('retries when Try Again button is clicked', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ComponentErrorBoundary componentName="TestComponent">
        <ErrorComponent />
      </ComponentErrorBoundary>
    );

    // Initially shows error
    expect(screen.getByText('TestComponent Error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();

    // Click retry - this should reset the error boundary state
    // The component will throw again, but the boundary should handle it
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    // After retry, the boundary should still be in error state because
    // the same ErrorComponent is rendered again and throws
    // But the retry mechanism should have worked (state was reset and set again)
    expect(screen.getByText('TestComponent Error')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('reloads page when Reload Page button is clicked', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reloadSpy = vi.fn();
    vi.stubGlobal('location', { reload: reloadSpy });

    render(
      <ComponentErrorBoundary componentName="TestComponent">
        <ErrorComponent />
      </ComponentErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reload Page' }));

    expect(reloadSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('uses custom fallback component when provided', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const CustomFallback = ({ error, retry }: { error?: Error; retry?: () => void }) => (
      <div data-testid="custom-fallback">
        Custom Error: {error?.message}
        <button onClick={retry} data-testid="custom-retry">Custom Retry</button>
      </div>
    );

    render(
      <ComponentErrorBoundary componentName="TestComponent" fallback={CustomFallback}>
        <ErrorComponent />
      </ComponentErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.getByText('Custom Error: Test error')).toBeInTheDocument();
    expect(screen.getByTestId('custom-retry')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('generates unique error IDs for different errors', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;

    const ConditionalErrorComponent = () => {
      if (shouldThrow) {
        throw new Error('Test error');
      }
      return <div>Normal component</div>;
    };

    // First error
    const { rerender } = render(
      <ComponentErrorBoundary componentName="TestComponent" showErrorDetails={true}>
        <ConditionalErrorComponent />
      </ComponentErrorBoundary>
    );

    // Get first error ID from the details
    const errorDetails1 = screen.getByText((content) => content.includes('Error ID:'));
    const errorId1 = errorDetails1.textContent?.match(/Error ID: (.*)/)?.[1];

    // Retry and trigger another error
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    shouldThrow = true; // Make it throw again
    rerender(
      <ComponentErrorBoundary componentName="TestComponent" showErrorDetails={true}>
        <ConditionalErrorComponent />
      </ComponentErrorBoundary>
    );

    const errorDetails2 = screen.getByText((content) => content.includes('Error ID:'));
    const errorId2 = errorDetails2.textContent?.match(/Error ID: (.*)/)?.[1];

    // Error IDs should be different
    expect(errorId1).not.toBe(errorId2);
    expect(errorId1).toMatch(/^error_\d+_[a-z0-9]+$/);
    expect(errorId2).toMatch(/^error_\d+_[a-z0-9]+$/);

    consoleSpy.mockRestore();
  });
});