import React, { useState, useEffect, useCallback } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { versionService, VersionCheckResult } from '../../services/versionService';
import { AppUpdateService } from '../../services/appUpdateService';
import { Download, AlertTriangle } from 'lucide-react';
import { log } from '../../services/logService';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.smart.pantry';
const DISMISS_COOLDOWN = 7 * 24 * 60 * 60 * 1000; // 7 days

interface GlobalUpdatePromptProps {
  onDismiss?: () => void;
}

export const GlobalUpdatePrompt: React.FC<GlobalUpdatePromptProps> = ({ onDismiss }) => {
  const [versionCheck, setVersionCheck] = useState<VersionCheckResult | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  const checkForUpdates = useCallback(async () => {
    try {
      const result = await versionService.checkForUpdates();

      if (result.needsUpdate) {
        if (result.forceUpdate) {
          // Force update — always show, no dismiss
          setVersionCheck(result);
          setShowPrompt(true);
          return;
        }
        // Regular update — show once per day per version
        const dismissedKey = `global_update_dismissed_${result.latestVersion}`;
        const dismissedTime = localStorage.getItem(dismissedKey);
        const now = Date.now();
        if (!dismissedTime || now - parseInt(dismissedTime) > DISMISS_COOLDOWN) {
          setVersionCheck(result);
          setShowPrompt(true);
        }
      }
    } catch (error) {
      log.error('Failed to check for global updates', { error }, 'GlobalUpdatePrompt');
    }
  }, []);

  useEffect(() => {
    checkForUpdates();

    // Re-check every time the app comes back to the foreground
    let removeListener: (() => void) | undefined;
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) checkForUpdates();
    }).then((handle) => {
      removeListener = () => handle.remove();
    });

    return () => { removeListener?.(); };
  }, [checkForUpdates]);

  const handleUpdate = async () => {
    if (Capacitor.isNativePlatform()) {
      const success = await AppUpdateService.performUpdate(versionCheck?.forceUpdate);
      if (success) return;
    }

    const url = versionCheck?.downloadUrl || PLAY_STORE_URL;
    window.open(url, '_blank');

    // Terminate the app so it does a clean launch after the update
    setTimeout(() => {
      CapacitorApp.exitApp().catch((err) => {
        log.error('Failed to exit app on update redirect', { err }, 'GlobalUpdatePrompt');
      });
    }, 1000);
  };

  const dismissPrompt = () => {
    if (versionCheck?.forceUpdate) return; // can't dismiss force updates
    setShowPrompt(false);
    if (versionCheck) {
      const dismissedKey = `global_update_dismissed_${versionCheck.latestVersion}`;
      localStorage.setItem(dismissedKey, Date.now().toString());
    }
    onDismiss?.();
  };

  if (!showPrompt || !versionCheck) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl max-w-md w-full p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-orange-600" />
          </div>

          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Update Available
          </h3>

          <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
            Version {versionCheck.latestVersion} is available! Update now for the latest features and improvements.
          </p>

          {versionCheck.releaseNotes && (
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 mb-6 text-left">
              <p className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-1">
                What's new:
              </p>
              <p className="text-sm text-orange-800 dark:text-orange-200">
                {versionCheck.releaseNotes}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            {!versionCheck.forceUpdate && (
              <button
                onClick={dismissPrompt}
                className="flex-1 py-3 px-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Later
              </button>
            )}
            <button
              onClick={handleUpdate}
              className="flex-1 py-3 px-4 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Update Now
            </button>
          </div>

          {!versionCheck.forceUpdate && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              You can update later from Settings → App Updates
            </p>
          )}
        </div>
      </div>
    </div>
  );
};