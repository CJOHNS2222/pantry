// Note: The custom offline queue is intentionally not used here — Firebase SDK
// handles offline persistence and write queuing natively. This hook's sole job
// is to track real network connectivity so the UI can reflect offline state.
import { useState, useEffect } from 'react';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingOperations: number;
  syncError: string | null;
  syncProgress: {
    total: number;
    completed: number;
    failed: number;
    conflicts: number;
  } | null;
  hasConflicts: boolean;
}

export const useOfflineStatus = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncTime: null,
    pendingOperations: 0,
    syncError: null,
    syncProgress: null,
    hasConflicts: false,
  });

  useEffect(() => {
    const setOnline = (online: boolean) =>
      setSyncStatus(prev => ({ ...prev, isOnline: online }));

    if (Capacitor.isNativePlatform()) {
      // Use hardware-level network detection on iOS/Android
      let removeListener: (() => void) | null = null;
      Network.addListener('networkStatusChange', status => {
        setOnline(status.connected);
      }).then(handle => {
        removeListener = () => handle.remove();
      });
      Network.getStatus().then(status => setOnline(status.connected)).catch(() => {
        setOnline(navigator.onLine);
      });
      return () => { removeListener?.(); };
    } else {
      // Web: use browser online/offline events
      const handleOnline = () => setOnline(true);
      const handleOffline = () => setOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // These are kept for API compatibility but are no-ops. Firebase SDK manages
  // its own write queue — no manual sync needed.
  const updateSyncStatus = (updates: Partial<SyncStatus>) =>
    setSyncStatus(prev => ({ ...prev, ...updates }));
  const startSync = () => {};
  const endSync = (_success?: boolean, _error?: string) => {};
  const setPendingOperations = (_count: number) => {};
  const syncNow = async () => {};

  return {
    syncStatus,
    isOnline: syncStatus.isOnline,
    updateSyncStatus,
    startSync,
    endSync,
    setPendingOperations,
    syncNow,
  };
};

