import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { versionService } from '../../../services/versionService';
import DatabaseMonitoringService from '../../../services/databaseMonitoringService';
import { App } from '@capacitor/app';
import { Device } from '@capacitor/device';

vi.mock('@capacitor/app', () => ({
  App: {
    getInfo: vi.fn()
  }
}));

vi.mock('@capacitor/device', () => ({
  Device: {
    getInfo: vi.fn()
  }
}));

vi.mock('../../../services/databaseMonitoringService', () => ({
  default: {
    doc: vi.fn().mockReturnValue('mock-doc-ref'),
    getDoc: vi.fn(),
    setDoc: vi.fn().mockResolvedValue(undefined),
    updateDoc: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('versionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset private fields if needed by initializing with mock values
    vi.mocked(App.getInfo).mockResolvedValue({ version: '1.4.0', build: '10', name: 'Pantry', id: 'com.smart.pantry' });
    vi.mocked(Device.getInfo).mockResolvedValue({ platform: 'android', model: 'Pixel', osVersion: '14', manufacturer: 'Google', isVirtual: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCurrentVersion & getPlatform', () => {
    it('returns app version and platform from Capacitor plugins', async () => {
      // Force re-initialize
      await versionService.initialize();

      const version = await versionService.getCurrentVersion();
      const platform = await versionService.getPlatform();

      expect(version).toBe('1.4.0');
      expect(platform).toBe('android');
    });

    it('falls back to web platform when Capacitor plugins throw', async () => {
      vi.mocked(App.getInfo).mockRejectedValueOnce(new Error('Capacitor unavailable'));

      await versionService.initialize();

      const platform = await versionService.getPlatform();
      expect(platform).toBe('web');
    });
  });

  describe('checkForUpdates', () => {
    it('returns needsUpdate = true when latest version is higher', async () => {
      vi.mocked(App.getInfo).mockResolvedValue({ version: '1.4.0', build: '10', name: 'Pantry', id: 'com.smart.pantry' });
      vi.mocked(Device.getInfo).mockResolvedValue({ platform: 'android', model: 'Pixel', osVersion: '14', manufacturer: 'Google', isVirtual: false });

      await versionService.initialize();

      vi.mocked(DatabaseMonitoringService.getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          version: '1.5.0',
          forceUpdate: true,
          releaseNotes: 'Major new features',
          downloadUrl: 'https://play.google.com/store/apps/details?id=com.smart.pantry'
        })
      } as any);

      // Force cache expiry by resetting
      (versionService as any).lastCheckTime = 0;

      const result = await versionService.checkForUpdates();

      expect(result.needsUpdate).toBe(true);
      expect(result.isUpToDate).toBe(false);
      expect(result.forceUpdate).toBe(true);
      expect(result.latestVersion).toBe('1.5.0');
      expect(result.releaseNotes).toBe('Major new features');
    });

    it('returns needsUpdate = false when app is up to date', async () => {
      vi.mocked(App.getInfo).mockResolvedValue({ version: '1.5.0', build: '10', name: 'Pantry', id: 'com.smart.pantry' });
      vi.mocked(Device.getInfo).mockResolvedValue({ platform: 'android', model: 'Pixel', osVersion: '14', manufacturer: 'Google', isVirtual: false });

      await versionService.initialize();

      vi.mocked(DatabaseMonitoringService.getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          version: '1.5.0',
          forceUpdate: false
        })
      } as any);

      (versionService as any).lastCheckTime = 0;

      const result = await versionService.checkForUpdates();

      expect(result.needsUpdate).toBe(false);
      expect(result.isUpToDate).toBe(true);
    });

    it('initializes version doc if document does not exist in Firestore', async () => {
      vi.mocked(DatabaseMonitoringService.getDoc).mockResolvedValueOnce({
        exists: () => false
      } as any);

      (versionService as any).lastCheckTime = 0;

      const result = await versionService.checkForUpdates();

      expect(result.isUpToDate).toBe(true);
      expect(DatabaseMonitoringService.setDoc).toHaveBeenCalled();
    });
  });

  describe('updateVersionInfo', () => {
    it('updates version doc in Firestore', async () => {
      await versionService.updateVersionInfo({ version: '1.5.0', forceUpdate: false });

      expect(DatabaseMonitoringService.updateDoc).toHaveBeenCalled();
    });
  });
});
