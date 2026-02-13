import { App } from '@capacitor/app';
import { Device } from '@capacitor/device';
import DatabaseMonitoringService from './databaseMonitoringService';
import { log } from './logService';

export interface AppVersion {
  version: string;
  buildNumber?: string;
  platform: 'ios' | 'android' | 'web';
  releaseNotes?: string;
  forceUpdate?: boolean;
  downloadUrl?: string;
}

export interface VersionCheckResult {
  isUpToDate: boolean;
  currentVersion: string;
  latestVersion: string;
  needsUpdate: boolean;
  forceUpdate: boolean;
  releaseNotes?: string;
  downloadUrl?: string;
}

class VersionService {
  private currentVersion: string | null = null;
  private platform: string | null = null;
  private lastCheckTime: number = 0;
  private checkCache: VersionCheckResult | null = null;
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour cache

  async initialize(): Promise<void> {
    try {
      const appInfo = await App.getInfo();
      const deviceInfo = await Device.getInfo();

      this.currentVersion = appInfo.version;
      this.platform = deviceInfo.platform;
    } catch (error) {
      log.warn('Failed to get app info', { error }, 'VersionService');
      // Fallback for web
      this.currentVersion = '1.0.0';
      this.platform = 'web';
    }
  }

  async getCurrentVersion(): Promise<string> {
    if (!this.currentVersion) {
      await this.initialize();
    }
    return this.currentVersion || '1.0.0';
  }

  async getPlatform(): Promise<string> {
    if (!this.platform) {
      await this.initialize();
    }
    return this.platform || 'web';
  }

  async checkForUpdates(): Promise<VersionCheckResult> {
    const now = Date.now();

    // Return cached result if it's still valid
    if (this.checkCache && (now - this.lastCheckTime) < this.CACHE_DURATION) {
      return this.checkCache;
    }

    try {
      const currentVersion = await this.getCurrentVersion();
      const platform = await this.getPlatform();

      // Get latest version info from Firebase
      const versionDocRef = DatabaseMonitoringService.doc('app_versions/' + platform);
      const versionDoc = await DatabaseMonitoringService.getDoc(versionDocRef);

      if (!versionDoc.exists()) {
        // No version info available, create initial data
        // console.log('No version data found, initializing...');
        await this.initializeVersionData(platform);
        // Return up-to-date since we just initialized
        const result = {
          isUpToDate: true,
          currentVersion,
          latestVersion: currentVersion,
          needsUpdate: false,
          forceUpdate: false
        };
        this.checkCache = result;
        this.lastCheckTime = now;
        return result;
      }

      const versionData = versionDoc.data() as AppVersion;
      const latestVersion = versionData.version;

      // Compare versions (simple string comparison for now)
      const needsUpdate = this.compareVersions(currentVersion, latestVersion) < 0;

      const result = {
        isUpToDate: !needsUpdate,
        currentVersion,
        latestVersion,
        needsUpdate,
        forceUpdate: versionData.forceUpdate || false,
        releaseNotes: versionData.releaseNotes,
        downloadUrl: versionData.downloadUrl
      };

      // Cache the result
      this.checkCache = result;
      this.lastCheckTime = now;

      return result;
    } catch (error) {
      log.error('Failed to check for updates', { error }, 'VersionService');
      // Return safe defaults
      const currentVersion = await this.getCurrentVersion();
      const result = {
        isUpToDate: true,
        currentVersion,
        latestVersion: currentVersion,
        needsUpdate: false,
        forceUpdate: false
      };
      this.checkCache = result;
      this.lastCheckTime = now;
      return result;
    }
  }

  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }

    return 0;
  }

  async updateVersionInfo(versionData: Partial<AppVersion>): Promise<void> {
    try {
      const platform = await this.getPlatform();
      const versionDocRef = doc(db, 'app_versions', platform);

      await updateDoc(versionDocRef, {
        ...versionData,
        updatedAt: new Date()
      });
    } catch (error) {
      log.error('Failed to update version info', { error }, 'VersionService');
      throw error;
    }
  }

  private async initializeVersionData(platform: string): Promise<void> {
    try {
      const versionDocRef = doc(db, 'app_versions', platform);
      const initialVersionData: AppVersion = {
        version: '1.0.0',
        buildNumber: '1',
        platform: platform as 'ios' | 'android' | 'web',
        releaseNotes: 'Initial release with pantry management features',
        forceUpdate: false,
        downloadUrl: platform === 'android'
          ? 'https://play.google.com/store/apps/details?id=com.smart.pantry'
          : platform === 'ios'
          ? 'https://apps.apple.com/app/smart-pantry/id1234567890'
          : null,
      };

      await setDoc(versionDocRef, {
        ...initialVersionData,
        updatedAt: new Date()
      });

      // console.log(`Initialized version data for ${platform}`);
    } catch (error) {
      log.error('Failed to initialize version data', { error }, 'VersionService');
      // Don't throw - this is a non-critical operation
    }
  }
}

export const versionService = new VersionService();