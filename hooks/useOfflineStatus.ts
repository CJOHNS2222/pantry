import { useState, useEffect, useCallback } from 'react';
import { offlineQueue } from '../services/offlineQueueService';

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
        console.error('Failed to initialize offline queue:', err);
      }
    };

    initOfflineQueue();
    return undefined;
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus(prev => ({
        ...prev,
        isOnline: true,
        syncError: null
      }));
    };

    const handleOffline = () => {
      setSyncStatus(prev => ({
        ...prev,
        isOnline: false
      }));
    };

    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    setSyncStatus(prev => ({
      ...prev,
      isOnline: navigator.onLine
    }));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updateSyncStatus = (updates: Partial<SyncStatus>) => {
    setSyncStatus(prev => ({
      ...prev,
      ...updates
    }));
  };

  const startSync = () => {
    setSyncStatus(prev => ({
      ...prev,
      isSyncing: true,
      syncError: null,
      syncProgress: { total: 0, completed: 0, failed: 0, conflicts: 0 }
    }));
  };

  const endSync = (success: boolean = true, error?: string) => {
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
    if (!syncStatus.isOnline || syncStatus.isSyncing) {
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
  }, [syncStatus.isOnline, syncStatus.isSyncing]);

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

