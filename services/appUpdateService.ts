import { Capacitor } from '@capacitor/core';
import { log } from './logService';

export interface NativeAppUpdateInfo {
  currentVersion: string;
  availableVersion: string;
  updateAvailable: boolean;
  immediateAllowed: boolean;
  flexibleAllowed: boolean;
}

export class AppUpdateService {
  /**
   * Check native App Store / Play Store for available app updates
   */
  static async getAppUpdateInfo(): Promise<NativeAppUpdateInfo | null> {
    if (!Capacitor.isNativePlatform()) return null;

    try {
      const { AppUpdate, AppUpdateAvailability } = await import('@capawesome/capacitor-app-update');
      const info = await AppUpdate.getAppUpdateInfo();

      const updateAvailable = info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE;

      return {
        currentVersion: info.currentVersionName,
        availableVersion: info.availableVersionName || info.currentVersionName,
        updateAvailable,
        immediateAllowed: !!info.immediateUpdateAllowed,
        flexibleAllowed: !!info.flexibleUpdateAllowed,
      };
    } catch (err: unknown) {
      log.warn('Failed to check native app update info', { error: err }, 'AppUpdateService');
      return null;
    }
  }

  /**
   * Perform an in-app update (Immediate or Flexible) or redirect to App Store
   */
  static async performUpdate(force: boolean = false): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;

    try {
      const { AppUpdate, AppUpdateAvailability } = await import('@capawesome/capacitor-app-update');
      const info = await AppUpdate.getAppUpdateInfo();

      if (info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE) {
        if (force && info.immediateUpdateAllowed) {
          await AppUpdate.performImmediateUpdate();
          return true;
        } else if (info.flexibleUpdateAllowed) {
          await AppUpdate.startFlexibleUpdate();
          return true;
        }
      }

      // Fallback: Open store listing directly
      await AppUpdate.openAppStore();
      return true;
    } catch (err: unknown) {
      log.error('Failed to execute native app update', { error: err }, 'AppUpdateService');
      return false;
    }
  }
}

export default AppUpdateService;
