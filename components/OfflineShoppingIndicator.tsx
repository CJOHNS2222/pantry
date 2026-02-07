import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Clock } from 'lucide-react';

interface OfflineShoppingIndicatorProps {
  isOffline: boolean;
  lastSynced?: Date;
  pendingChanges?: number;
  onSyncNow?: () => void;
  isSyncing?: boolean;
}

export const OfflineShoppingIndicator: React.FC<OfflineShoppingIndicatorProps> = ({
  isOffline,
  lastSynced,
  pendingChanges = 0,
  onSyncNow,
  isSyncing = false
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const getSyncStatusText = () => {
    if (isOffline) {
      return 'Offline - Changes saved locally';
    }
    if (isSyncing) {
      return 'Syncing...';
    }
    if (lastSynced) {
      const minutesAgo = Math.floor((Date.now() - lastSynced.getTime()) / (1000 * 60));
      if (minutesAgo < 1) return 'Synced just now';
      if (minutesAgo < 60) return `Synced ${minutesAgo}m ago`;
      const hoursAgo = Math.floor(minutesAgo / 60);
      if (hoursAgo < 24) return `Synced ${hoursAgo}h ago`;
      return `Synced ${Math.floor(hoursAgo / 24)}d ago`;
    }
    return 'Not synced yet';
  };

  const getStatusColor = () => {
    if (isOffline) return 'text-orange-600 bg-orange-50 border-orange-200';
    if (isSyncing) return 'text-blue-600 bg-blue-50 border-blue-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  return (
    <div className={`rounded-lg border p-3 ${getStatusColor()}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isOffline ? (
            <WifiOff className="w-4 h-4" />
          ) : isSyncing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Wifi className="w-4 h-4" />
          )}

          <div className="text-sm font-medium">
            {isOffline ? 'Offline Mode' : 'Online'}
          </div>

          {pendingChanges > 0 && (
            <div className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">
              {pendingChanges} pending
            </div>
          )}
        </div>

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs hover:underline opacity-70 hover:opacity-100"
        >
          {showDetails ? 'Hide' : 'Details'}
        </button>
      </div>

      {showDetails && (
        <div className="mt-2 pt-2 border-t border-current border-opacity-20">
          <div className="text-xs opacity-80 space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3" />
              <span>{getSyncStatusText()}</span>
            </div>

            {isOffline && (
              <div className="text-xs mt-1">
                Your shopping list is saved locally and will sync when you're back online.
              </div>
            )}

            {pendingChanges > 0 && !isOffline && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs">
                  {pendingChanges} change{pendingChanges !== 1 ? 's' : ''} waiting to sync
                </span>
                {onSyncNow && (
                  <button
                    onClick={onSyncNow}
                    disabled={isSyncing}
                    className="text-xs bg-white/50 hover:bg-white/70 px-2 py-1 rounded transition-colors disabled:opacity-50"
                  >
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OfflineShoppingIndicator;