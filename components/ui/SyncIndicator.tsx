import React from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle, AlertTriangle } from 'lucide-react';
import { SyncStatus } from '../../hooks/useOfflineStatus';

interface SyncIndicatorProps {
  syncStatus: SyncStatus;
  compact?: boolean;
  className?: string;
  onSyncClick?: () => void;
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({
  syncStatus,
  compact = false,
  className = '',
  onSyncClick
}) => {
  const {
    isOnline = navigator.onLine,
    isSyncing = false,
    lastSyncTime = null,
    pendingOperations = 0,
    syncError = null,
    syncProgress = null,
    hasConflicts = false
  } = syncStatus || {};

  const getStatusColor = () => {
    if (syncError) return 'text-red-500';
    if (hasConflicts) return 'text-orange-500';
    if (isSyncing) return 'text-blue-500';
    if (!isOnline) return 'text-orange-500';
    if (pendingOperations > 0) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getStatusIcon = () => {
    if (syncError) return <AlertCircle className="w-4 h-4" />;
    if (hasConflicts) return <AlertTriangle className="w-4 h-4" />;
    if (isSyncing) return <RefreshCw className="w-4 h-4 animate-spin" />;
    if (!isOnline) return <CloudOff className="w-4 h-4" />;
    if (pendingOperations > 0) return <Cloud className="w-4 h-4" />;
    return <Cloud className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (syncError) return 'Sync Error';
    if (hasConflicts) return 'Conflicts Found';
    if (isSyncing) return 'Syncing...';
    if (!isOnline) return 'Offline';
    if (pendingOperations > 0) return `${pendingOperations} pending`;
    return 'Synced';
  };

  const getStatusDescription = () => {
    if (syncError) return 'Failed to sync data - tap to retry';
    if (hasConflicts) return 'Data conflicts need resolution';
    if (isSyncing && syncProgress) {
      const { completed, total, failed, conflicts } = syncProgress;
      return `Syncing ${completed}/${total} (${failed} failed, ${conflicts} conflicts)`;
    }
    if (isSyncing) return 'Synchronizing with server';
    if (!isOnline) return 'Working offline - changes will sync when online';
    if (pendingOperations > 0) return `Changes will sync when online`;
    if (lastSyncTime) {
      const timeAgo = Math.floor((Date.now() - lastSyncTime.getTime()) / 1000 / 60);
      if (timeAgo < 1) return 'Just synced';
      if (timeAgo < 60) return `Synced ${timeAgo}m ago`;
      const hoursAgo = Math.floor(timeAgo / 60);
      return `Synced ${hoursAgo}h ago`;
    }
    return 'All changes saved';
  };

  const handleClick = () => {
    if (onSyncClick && (syncError || hasConflicts || (!isOnline && pendingOperations > 0))) {
      onSyncClick();
    }
  };

  const isClickable = onSyncClick && (syncError || hasConflicts || (!isOnline && pendingOperations > 0));

  if (compact) {
    return (
      <div
        className={`flex items-center gap-1 ${getStatusColor()} ${isClickable ? 'cursor-pointer hover:opacity-80' : ''} ${className}`}
        onClick={handleClick}
      >
        {getStatusIcon()}
        <span className="text-xs font-medium">{getStatusText()}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg bg-theme-secondary border border-theme ${className}`}>
      <div
        className={`flex items-center gap-1 ${getStatusColor()} ${isClickable ? 'cursor-pointer hover:opacity-80' : ''}`}
        onClick={handleClick}
      >
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusText()}</span>
      </div>
      <span className="text-xs text-theme-secondary opacity-70">
        {getStatusDescription()}
      </span>
      {isSyncing && syncProgress && (
        <div className="flex-1 ml-2">
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${syncProgress.total > 0 ? (syncProgress.completed / syncProgress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};