import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineQueue } from '../services/offlineQueueService';
import DatabaseMonitoringService from '../services/databaseMonitoringService';
import { log } from '../services/logService';
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
    hasConflicts: false
  });
  const connectivityTestInProgress = useRef(false);
  // Ref-based guards prevent stale closure race conditions
  const isSyncingRef = useRef(false);
  const isOnlineRef = useRef(navigator.onLine);
  // Function to test actual internet connectivity
  const testConnectivity = useCallback(async (): Promise<boolean> => {
    try {
      // Try to fetch a small resource from a reliable endpoint
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      return true;
    } catch (error) {
      // If we can't reach the internet, try Firebase connectivity
      try {
        // Test Firebase connectivity by checking if we can reach Firestore
        const testDoc = await DatabaseMonitoringService.getDoc(DatabaseMonitoringService.doc('test-connectivity'));
        return true;
      } catch (firebaseError) {
        return false;
      }
    }
  }, []);

  // Update online status with actual connectivity test
  const updateOnlineStatus = useCallback(async () => {
    // Prevent concurrent connectivity tests
    if (connectivityTestInProgress.current) {
      return;
    }

    connectivityTestInProgress.current = true;
    try {
      const isActuallyOnline = await testConnectivity();
      isOnlineRef.current = isActuallyOnline;
      setSyncStatus(prev => ({
        ...prev,
        isOnline: isActuallyOnline
      }));
    } finally {
      connectivityTestInProgress.current = false;
    }
  }, [testConnectivity]);

  // Initialize offline queue and load initial state
  useEffect(() => {
    const initOfflineQueue = async () => {
      try {
        await offlineQueue.init();
        const pendingCount = await offlineQueue.getPendingCount();
        const conflicts = await offlineQueue.getConflicts();

        setSyncStatus(prev => ({
          ...prev,
          pendingOperations: pendingCount,
          hasConflicts: conflicts.length > 0
        }));
      } catch (err: any) {
        log.error('Failed to initialize offline queue:', { error: err?.message }, 'useOfflineStatus');
      }
    };

    initOfflineQueue();
    return undefined;
  }, []);

  useEffect(() => {
    let networkListener: (() => void) | null = null;

    const handleNetworkChange = (isOnline: boolean) => {
      isOnlineRef.current = isOnline;
      setSyncStatus(prev => ({
        ...prev,
        isOnline,
        syncError: isOnline ? null : prev.syncError
      }));
    };

    if (Capacitor.isNativePlatform()) {
      // Use hardware-level network detection on iOS/Android
      Network.addListener('networkStatusChange', (status) => {
        handleNetworkChange(status.connected);
      }).then(handle => {
        networkListener = () => handle.remove();
      });

      // Check initial state
      Network.getStatus().then(status => {
        handleNetworkChange(status.connected);
      }).catch(() => {
        // Fall back to navigator.onLine on error
        handleNetworkChange(navigator.onLine);
      });
    } else {
      // Web: test actual connectivity (not just navigator.onLine)
      const handleOnline = async () => {
        const isActuallyOnline = await testConnectivity();
        handleNetworkChange(isActuallyOnline);
      };
      const handleOffline = () => handleNetworkChange(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      updateOnlineStatus();

      // Periodic check every 30 s on web
      const connectivityInterval = setInterval(updateOnlineStatus, 30000);
      networkListener = () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        clearInterval(connectivityInterval);
      };
    }

    return () => {
      networkListener?.();
    };
  }, [testConnectivity, updateOnlineStatus]);

  const updateSyncStatus = (updates: Partial<SyncStatus>) => {
    setSyncStatus(prev => ({
      ...prev,
      ...updates
    }));
  };

  const startSync = () => {
    isSyncingRef.current = true;
    setSyncStatus(prev => ({
      ...prev,
      isSyncing: true,
      syncError: null,
      syncProgress: { total: 0, completed: 0, failed: 0, conflicts: 0 }
    }));
  };

  const endSync = (success: boolean = true, error?: string) => {
    isSyncingRef.current = false;
    setSyncStatus(prev => ({
      ...prev,
      isSyncing: false,
      lastSyncTime: success ? new Date() : prev.lastSyncTime,
      syncError: error || null,
      syncProgress: null
    }));
  };

  const setPendingOperations = (count: number) => {
    setSyncStatus(prev => ({
      ...prev,
      pendingOperations: count
    }));
  };

  // Enhanced sync method with progress tracking
  const syncNow = useCallback(async () => {
    // Use refs to avoid stale closure race conditions
    if (!isOnlineRef.current || isSyncingRef.current) {
      return;
    }

    startSync();

    try {
      const progress = await offlineQueue.processQueueWithSync((progress) => {
        setSyncStatus(prev => ({
          ...prev,
          syncProgress: progress
        }));
      });

      // Update pending operations and conflicts after sync
      const pendingCount = await offlineQueue.getPendingCount();
      const conflicts = await offlineQueue.getConflicts();

      setSyncStatus(prev => ({
        ...prev,
        pendingOperations: pendingCount,
        hasConflicts: conflicts.length > 0,
        syncProgress: progress
      }));

      endSync(true);
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Sync failed';
      endSync(false, errorMessage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (syncStatus.isOnline && !syncStatus.isSyncing && syncStatus.pendingOperations > 0) {
      // Debounce auto-sync to avoid immediate sync on every online event
      const timeoutId = setTimeout(() => {
        syncNow();
      }, 2000);

      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [syncStatus.isOnline, syncStatus.pendingOperations, syncStatus.isSyncing, syncNow]);

  return {
    syncStatus,
    isOnline: syncStatus.isOnline,
    updateSyncStatus,
    startSync,
    endSync,
    setPendingOperations,
    syncNow
  };
};

