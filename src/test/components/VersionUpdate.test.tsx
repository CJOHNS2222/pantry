import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { VersionUpdate } from '../../../components/VersionUpdate';
import { versionService } from '../../../services/versionService';

// Mock versionService
vi.mock('../../../services/versionService', () => ({
  versionService: {
    getCurrentVersion: vi.fn(),
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
const openMock = vi.fn();
Object.defineProperty(window, 'open', {
  value: openMock,
});

describe('VersionUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    openMock.mockClear();

    // Default mocks
    vi.mocked(versionService.getCurrentVersion).mockResolvedValue('1.0.0');
    vi.mocked(versionService.getPlatform).mockResolvedValue('web');
    vi.mocked(versionService.checkForUpdates).mockResolvedValue({
      isUpToDate: true,
      currentVersion: '1.0.0',
      latestVersion: '1.0.0',
      needsUpdate: false,
      forceUpdate: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('loads version info on mount', async () => {
    render(<VersionUpdate />);

    await waitFor(() => {
      expect(versionService.getCurrentVersion).toHaveBeenCalled();
      expect(versionService.getPlatform).toHaveBeenCalled();
    });

    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('Web')).toBeInTheDocument();
  });

  it('handles version info loading errors', async () => {
    vi.mocked(versionService.getCurrentVersion).mockRejectedValue(new Error('Failed'));
    vi.mocked(versionService.getPlatform).mockRejectedValue(new Error('Failed'));

    render(<VersionUpdate />);

    await waitFor(() => {
      expect(screen.getAllByText('Unknown')).toHaveLength(2);
    });
  });

  it('checks for updates manually when button is clicked', async () => {
    render(<VersionUpdate />);

    const checkButton = screen.getByRole('button', { name: 'Check for Updates' });
    fireEvent.click(checkButton);

    await waitFor(() => {
      expect(versionService.checkForUpdates).toHaveBeenCalled();
    });

    expect(screen.getByText('Up to date')).toBeInTheDocument();
  });

  it('shows loading state while checking', async () => {
    let resolveCheck: (value: any) => void = () => {};
    const checkPromise = new Promise(resolve => {
      resolveCheck = resolve;
    });

    vi.mocked(versionService.checkForUpdates).mockReturnValue(checkPromise as any);

    render(<VersionUpdate />);

    const checkButton = screen.getByRole('button', { name: 'Check for Updates' });
    fireEvent.click(checkButton);

    expect(screen.getByText('Checking...')).toBeInTheDocument();
    expect(checkButton).toBeDisabled();

    resolveCheck({
      isUpToDate: true,
      currentVersion: '1.0.0',
      latestVersion: '1.0.0',
      needsUpdate: false,
      forceUpdate: false,
    });

    await waitFor(() => {
      expect(screen.getByText('Check for Updates')).toBeInTheDocument();
    });
  });

  it('shows update available prompt when update is needed', async () => {
    vi.mocked(versionService.checkForUpdates).mockResolvedValue({
      isUpToDate: false,
      currentVersion: '1.0.0',
      latestVersion: '1.1.0',
      needsUpdate: true,
      downloadUrl: 'https://example.com/download',
      releaseNotes: 'Bug fixes and improvements',
      forceUpdate: false,
    });

    render(<VersionUpdate />);

    const checkButton = screen.getByRole('button', { name: 'Check for Updates' });
    fireEvent.click(checkButton);

    await waitFor(() => {
      expect(screen.getByText('Update Available')).toBeInTheDocument();
      expect(screen.getByText(/Version 1\.1\.0 is available/)).toBeInTheDocument();
      expect(screen.getByText('Bug fixes and improvements')).toBeInTheDocument();
    });
  });

  it('opens download URL when Update Now is clicked', async () => {
    vi.mocked(versionService.checkForUpdates).mockResolvedValue({
      isUpToDate: false,
      currentVersion: '1.0.0',
      latestVersion: '1.1.0',
      needsUpdate: true,
      downloadUrl: 'https://example.com/download',
      forceUpdate: false,
    });

    render(<VersionUpdate />);

    const checkButton = screen.getByRole('button', { name: 'Check for Updates' });
    fireEvent.click(checkButton);

    await waitFor(() => {
      const updateButton = screen.getByRole('button', { name: 'Update Now' });
      fireEvent.click(updateButton);
    });

    expect(openMock).toHaveBeenCalledWith('https://example.com/download', '_blank');
  });

  it('dismisses update prompt when Later is clicked', async () => {
    vi.mocked(versionService.checkForUpdates).mockResolvedValue({
      isUpToDate: false,
      currentVersion: '1.0.0',
      latestVersion: '1.1.0',
      needsUpdate: true,
      downloadUrl: 'https://example.com/download',
    });

    render(<VersionUpdate />);

    const checkButton = screen.getByRole('button', { name: 'Check for Updates' });
    fireEvent.click(checkButton);

    await waitFor(() => {
      expect(screen.getByText('Update Available')).toBeInTheDocument();
    });

    const laterButton = screen.getByRole('button', { name: 'Later' });
    fireEvent.click(laterButton);

    expect(screen.queryByText('Update Available')).not.toBeInTheDocument();
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'update_dismissed_1.1.0',
      expect.any(String)
    );
  });

  it('calls onUpdateAvailable callback when update is available', async () => {
    const mockCallback = vi.fn();
    const updateResult = {
      isUpToDate: false,
      currentVersion: '1.0.0',
      latestVersion: '1.1.0',
      needsUpdate: true,
      forceUpdate: false,
    };

    vi.mocked(versionService.checkForUpdates).mockResolvedValue(updateResult);

    render(<VersionUpdate onUpdateAvailable={mockCallback} />);

    const checkButton = screen.getByRole('button', { name: 'Check for Updates' });
    fireEvent.click(checkButton);

    await waitFor(() => {
      expect(mockCallback).toHaveBeenCalledWith(updateResult);
    });
  });

  it('prevents multiple simultaneous update checks', async () => {
    let resolveCheck: (value: any) => void = () => {};
    const checkPromise = new Promise(resolve => {
      resolveCheck = resolve;
    });

    vi.mocked(versionService.checkForUpdates).mockReturnValue(checkPromise as any);

    render(<VersionUpdate />);

    const checkButton = screen.getByRole('button', { name: 'Check for Updates' });

    // Click multiple times quickly
    fireEvent.click(checkButton);
    fireEvent.click(checkButton);
    fireEvent.click(checkButton);

    resolveCheck({
      isUpToDate: true,
      currentVersion: '1.0.0',
      latestVersion: '1.0.0',
      needsUpdate: false,
      forceUpdate: false,
    });

    await waitFor(() => {
      expect(versionService.checkForUpdates).toHaveBeenCalledTimes(1);
    });
  });
});