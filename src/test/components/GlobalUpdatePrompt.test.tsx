import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GlobalUpdatePrompt } from '../../../components/GlobalUpdatePrompt';
import { versionService } from '../../../services/versionService';

// Mock versionService
vi.mock('../../../services/versionService', () => ({
  versionService: {
    getPlatform: vi.fn(),
    checkForUpdates: vi.fn(),
  },
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock window.open
Object.defineProperty(window, 'open', {
  value: vi.fn(),
});

describe('GlobalUpdatePrompt', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('does not render when no update is needed', async () => {
    const mockVersionService = vi.mocked(versionService);
    mockVersionService.getPlatform.mockResolvedValue('web');

    const { container } = render(<GlobalUpdatePrompt />);

    // Should not render anything on web platform
    expect(container.firstChild).toBeNull();
  });

  it('renders update prompt when update is available on mobile', async () => {
    const mockVersionService = vi.mocked(versionService);
    mockVersionService.getPlatform.mockResolvedValue('ios');
    mockVersionService.checkForUpdates.mockResolvedValue({
      needsUpdate: true,
      latestVersion: '2.0.0',
      downloadUrl: 'https://example.com/download',
      releaseNotes: 'New features added',
      forceUpdate: false,
    });
    localStorageMock.getItem.mockReturnValue(null); // Not dismissed

    render(<GlobalUpdatePrompt />);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(screen.getByText('Update Available')).toBeInTheDocument();
    expect(screen.getByText(/Version 2\.0\.0 is available/)).toBeInTheDocument();
    expect(screen.getByText(/Update now for the latest features/)).toBeInTheDocument();
    expect(screen.getByText("What's new:")).toBeInTheDocument();
    expect(screen.getByText('New features added')).toBeInTheDocument();
    expect(screen.getByText('Update Now')).toBeInTheDocument();
    expect(screen.getByText('Later')).toBeInTheDocument();
  });

  it('does not show prompt when update was recently dismissed', async () => {
    const mockVersionService = vi.mocked(versionService);
    mockVersionService.getPlatform.mockResolvedValue('android');
    mockVersionService.checkForUpdates.mockResolvedValue({
      needsUpdate: true,
      latestVersion: '2.0.0',
      downloadUrl: 'https://example.com/download',
      forceUpdate: false,
    });
    // Simulate dismissed less than 7 days ago
    const recentTime = Date.now() - (2 * 24 * 60 * 60 * 1000); // 2 days ago
    localStorageMock.getItem.mockReturnValue(recentTime.toString());

    const { container } = render(<GlobalUpdatePrompt />);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(container.firstChild).toBeNull();
  });

  it('shows prompt when dismissed more than 7 days ago', async () => {
    const mockVersionService = vi.mocked(versionService);
    mockVersionService.getPlatform.mockResolvedValue('android');
    mockVersionService.checkForUpdates.mockResolvedValue({
      needsUpdate: true,
      latestVersion: '2.0.0',
      downloadUrl: 'https://example.com/download',
      forceUpdate: false,
    });
    // Simulate dismissed more than 7 days ago
    const oldTime = Date.now() - (10 * 24 * 60 * 60 * 1000); // 10 days ago
    localStorageMock.getItem.mockReturnValue(oldTime.toString());

    render(<GlobalUpdatePrompt />);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(screen.getByText('Update Available')).toBeInTheDocument();
  });

  it('handles update button click', async () => {
    const mockVersionService = vi.mocked(versionService);
    mockVersionService.getPlatform.mockResolvedValue('ios');
    mockVersionService.checkForUpdates.mockResolvedValue({
      needsUpdate: true,
      latestVersion: '2.0.0',
      downloadUrl: 'https://example.com/download',
      forceUpdate: false,
    });
    localStorageMock.getItem.mockReturnValue(null);

    render(<GlobalUpdatePrompt />);

    await new Promise(resolve => setTimeout(resolve, 0));

    const updateButton = screen.getByText('Update Now');
    fireEvent.click(updateButton);

    expect(window.open).toHaveBeenCalledWith('https://example.com/download', '_blank');
  });

  it('handles dismiss button click', async () => {
    const mockVersionService = vi.mocked(versionService);
    mockVersionService.getPlatform.mockResolvedValue('ios');
    mockVersionService.checkForUpdates.mockResolvedValue({
      needsUpdate: true,
      latestVersion: '2.0.0',
      downloadUrl: 'https://example.com/download',
      forceUpdate: false,
    });
    localStorageMock.getItem.mockReturnValue(null);

    const onDismiss = vi.fn();
    render(<GlobalUpdatePrompt onDismiss={onDismiss} />);

    await new Promise(resolve => setTimeout(resolve, 0));

    const dismissButton = screen.getByText('Later');
    fireEvent.click(dismissButton);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'global_update_dismissed_2.0.0',
      expect.any(String)
    );
    expect(onDismiss).toHaveBeenCalled();
  });

  it('hides later button for force updates', async () => {
    const mockVersionService = vi.mocked(versionService);
    mockVersionService.getPlatform.mockResolvedValue('ios');
    mockVersionService.checkForUpdates.mockResolvedValue({
      needsUpdate: true,
      latestVersion: '2.0.0',
      downloadUrl: 'https://example.com/download',
      forceUpdate: true,
    });
    localStorageMock.getItem.mockReturnValue(null);

    render(<GlobalUpdatePrompt />);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(screen.getByText('Update Now')).toBeInTheDocument();
    expect(screen.queryByText('Later')).not.toBeInTheDocument();
  });

  it('handles version check errors gracefully', async () => {
    const mockVersionService = vi.mocked(versionService);
    mockVersionService.getPlatform.mockResolvedValue('ios');
    mockVersionService.checkForUpdates.mockRejectedValue(new Error('Network error'));

    const { container } = render(<GlobalUpdatePrompt />);

    await new Promise(resolve => setTimeout(resolve, 0));

    // Should not render anything on error
    expect(container.firstChild).toBeNull();
  });

  it('does not render release notes section when not provided', async () => {
    const mockVersionService = vi.mocked(versionService);
    mockVersionService.getPlatform.mockResolvedValue('ios');
    mockVersionService.checkForUpdates.mockResolvedValue({
      needsUpdate: true,
      latestVersion: '2.0.0',
      downloadUrl: 'https://example.com/download',
      forceUpdate: false,
    });
    localStorageMock.getItem.mockReturnValue(null);

    render(<GlobalUpdatePrompt />);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(screen.queryByText("What's new:")).not.toBeInTheDocument();
  });
});