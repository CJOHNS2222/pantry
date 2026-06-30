import React, { useState, useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { versionService, VersionCheckResult } from '../../services/versionService';
import { RefreshCw, Download, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { log } from '../../services/logService';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.smart.pantry';

interface VersionUpdateProps {
  onUpdateAvailable?: (result: VersionCheckResult) => void;
  autoCheck?: boolean;
}

export const VersionUpdate: React.FC<VersionUpdateProps> = ({ onUpdateAvailable, autoCheck = false }) => {
  const [currentVersion, setCurrentVersion] = useState<string>('Loading...');
  const [platform, setPlatform] = useState<string>('Loading...');
  const [checking, setChecking] = useState(false);
  const [versionCheck, setVersionCheck] = useState<VersionCheckResult | null>(null);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);

  useEffect(() => {
    loadVersionInfo();
    if (autoCheck) {
      // Auto-check for updates after a short delay to avoid blocking initial render
      const timer = setTimeout(() => {
        checkForUpdates(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [autoCheck]);

  const loadVersionInfo = async () => {
    try {
      const [version, platform] = await Promise.all([
        versionService.getCurrentVersion(),
        versionService.getPlatform()
      ]);

      setCurrentVersion(version);
      setPlatform(platform.charAt(0).toUpperCase() + platform.slice(1));
    } catch (error) {
      log.error('Failed to load version info', { error }, 'VersionUpdate');
      setCurrentVersion('Unknown');
      setPlatform('Unknown');
    }
  };

  const checkForUpdates = async (isAutoCheck = false) => {
    // Prevent multiple simultaneous checks
    if (checking) return;

    setChecking(true);
    try {
      const result = await versionService.checkForUpdates();
      setVersionCheck(result);

      if (result.needsUpdate) {
        if (isAutoCheck) {
          // For auto-checks, only show prompt if it's not been dismissed recently
          const dismissedKey = `update_dismissed_${result.latestVersion}`;
          const dismissedTime = localStorage.getItem(dismissedKey);
          const now = Date.now();
          const oneDay = 24 * 60 * 60 * 1000; // 24 hours

          if (!dismissedTime || (now - parseInt(dismissedTime)) > oneDay) {
            setShowUpdatePrompt(true);
          }
        } else {
          setShowUpdatePrompt(true);
        }
        onUpdateAvailable?.(result);
      }
    } catch (error) {
      log.error('Failed to check for updates', { error }, 'VersionUpdate');
    } finally {
      setChecking(false);
    }
  };

  const handleUpdate = () => {
    if (!versionCheck?.downloadUrl) return;

    // Open download URL in new tab/window
    window.open(versionCheck.downloadUrl, '_blank');

    // Terminate the app so it does a clean launch after the update
    setTimeout(() => {
      CapacitorApp.exitApp().catch((err) => {
        log.error('Failed to exit app on update redirect', { err }, 'VersionUpdate');
      });
    }, 1000);
  };

  const dismissUpdate = () => {
    setShowUpdatePrompt(false);
    // Store dismissal time to prevent re-showing for 24 hours
    if (versionCheck) {
      const dismissedKey = `update_dismissed_${versionCheck.latestVersion}`;
      localStorage.setItem(dismissedKey, Date.now().toString());
    }
  };

  return (
    <div className="space-y-4">
      {/* Current Version Info */}
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
          App Version
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Version:</span>
            <span className="font-mono text-gray-900 dark:text-white">{currentVersion}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Platform:</span>
            <span className="text-gray-900 dark:text-white">{platform}</span>
          </div>
        </div>
      </div>

      {/* Update Check Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => checkForUpdates()}
          disabled={checking}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Checking...' : 'Check for Updates'}
        </button>

        {versionCheck && (
          <div className="flex items-center gap-2">
            {versionCheck.isUpToDate ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-green-600 text-sm">Up to date</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <span className="text-orange-600 text-sm">Update available</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Play Store link — always visible after a check */}
      {versionCheck && (
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          <ExternalLink className="w-4 h-4" />
          View on Google Play Store
        </a>
      )}

      {/* Update Available Prompt */}
      {showUpdatePrompt && versionCheck && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-orange-900 dark:text-orange-100 mb-1">
                Update Available
              </h4>
              <p className="text-sm text-orange-800 dark:text-orange-200 mb-3">
                Version {versionCheck.latestVersion} is available (current: {versionCheck.currentVersion})
              </p>

              {versionCheck.releaseNotes && (
                <div className="mb-3">
                  <p className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-1">
                    What's new:
                  </p>
                  <p className="text-sm text-orange-800 dark:text-orange-200">
                    {versionCheck.releaseNotes}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                {versionCheck.downloadUrl && (
                  <button
                    onClick={handleUpdate}
                    className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 text-white text-sm rounded hover:bg-orange-700"
                  >
                    <Download className="w-4 h-4" />
                    Update Now
                  </button>
                )}
                {!versionCheck.forceUpdate && (
                  <button
                    onClick={dismissUpdate}
                    className="px-3 py-1.5 text-sm text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-800 rounded"
                  >
                    Later
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Version Check Results */}
      {versionCheck && !showUpdatePrompt && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Last checked: {new Date().toLocaleString()}
        </div>
      )}
    </div>
  );
};