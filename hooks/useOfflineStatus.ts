// Wires up the offline status hook to use the custom offlineQueue service
// to track pending counts, conflicts, and trigger manual synchronization.
import { useState, useEffect } from 'react';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';
import { offlineQueue } from '../services/offlineQueueService';
import { log } from '../services/logService';

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

  // Poll IndexedDB offline queue status and conflicts
  useEffect(() => {
    let active = true;

    const checkQueue = async () => {
      try {
        const count = await offlineQueue.getPendingCount();
        const conflicts = await offlineQueue.getConflicts();
        const isSyncing = offlineQueue.getProcessingStatus();

        if (active) {
          setSyncStatus(prev => ({
            ...prev,
            pendingOperations: count,
            hasConflicts: conflicts.length > 0,
            isSyncing,
            lastSyncTime: count === 0 && prev.pendingOperations > 0 ? new Date() : prev.lastSyncTime
          }));
        }
      } catch (err) {
        log.error('Failed to query offline queue status', { err }, 'useOfflineStatus');
      }
    };

    // Run immediately and then on interval
    checkQueue();
    const interval = setInterval(checkQueue, 4000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const updateSyncStatus = (updates: Partial<SyncStatus>) =>
    setSyncStatus(prev => ({ ...prev, ...updates }));

  const startSync = () => setSyncStatus(prev => ({ ...prev, isSyncing: true }));
  const endSync = (success = true, error: string | null = null) => 
    setSyncStatus(prev => ({ 
      ...prev, 
      isSyncing: false, 
      syncError: error,
      lastSyncTime: success ? new Date() : prev.lastSyncTime
    }));

  const setPendingOperations = (count: number) =>
    setSyncStatus(prev => ({ ...prev, pendingOperations: count }));

  const syncNow = async () => {
    try {
      startSync();
      await offlineQueue.processQueue();
      const count = await offlineQueue.getPendingCount();
      const conflicts = await offlineQueue.getConflicts();
      setSyncStatus(prev => ({
        ...prev,
        pendingOperations: count,
        hasConflicts: conflicts.length > 0,
        isSyncing: false,
        syncError: null,
        lastSyncTime: count === 0 ? new Date() : prev.lastSyncTime
      }));
    } catch (err) {
      log.error('Manual queue sync failed', { err }, 'useOfflineStatus');
      endSync(false, err instanceof Error ? err.message : String(err));
    }
  };

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

