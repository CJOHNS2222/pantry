import React, { useState, useEffect } from 'react';
import DatabaseMonitoringService from '../services/databaseMonitoringService';

interface DatabaseMetrics {
  reads: number;
  writes: number;
  deletes: number;
  queries: number;
  batchOperations: number;
  realtimeSubscriptions: number;
  sessionDuration: number;
}

const DatabaseAnalytics: React.FC = () => {
  const [metrics, setMetrics] = useState<DatabaseMetrics | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isVisible) {
      const interval = setInterval(() => {
        setMetrics(DatabaseMonitoringService.getMetrics());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isVisible]);

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const calculateRate = (count: number, durationMs: number): number => {
    const minutes = durationMs / 60000;
    return minutes > 0 ? Math.round(count / minutes) : 0;
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 transition-colors z-50"
      >
        📊 DB Analytics
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-xl p-4 max-w-sm z-50">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-800">Database Analytics</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700 text-xl"
        >
          ×
        </button>
      </div>

      {metrics ? (
        <div className="space-y-2 text-sm">
          <div className="text-gray-600">
            Session: {formatDuration(metrics.sessionDuration)}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-green-50 p-2 rounded">
              <div className="text-green-700 font-medium">Reads</div>
              <div className="text-xl font-bold text-green-800">{metrics.reads}</div>
              <div className="text-xs text-green-600">
                {calculateRate(metrics.reads, metrics.sessionDuration)}/min
              </div>
            </div>

            <div className="bg-blue-50 p-2 rounded">
              <div className="text-blue-700 font-medium">Writes</div>
              <div className="text-xl font-bold text-blue-800">{metrics.writes}</div>
              <div className="text-xs text-blue-600">
                {calculateRate(metrics.writes, metrics.sessionDuration)}/min
              </div>
            </div>

            <div className="bg-red-50 p-2 rounded">
              <div className="text-red-700 font-medium">Deletes</div>
              <div className="text-xl font-bold text-red-800">{metrics.deletes}</div>
            </div>

            <div className="bg-purple-50 p-2 rounded">
              <div className="text-purple-700 font-medium">Queries</div>
              <div className="text-xl font-bold text-purple-800">{metrics.queries}</div>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-200">
            <div className="flex justify-between text-xs text-gray-600">
              <span>Batch Ops: {metrics.batchOperations}</span>
              <span>Subscriptions: {metrics.realtimeSubscriptions}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => DatabaseMonitoringService.logCurrentMetrics()}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded text-xs"
            >
              Log to Console
            </button>
            <button
              onClick={() => DatabaseMonitoringService.resetMetrics()}
              className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-xs"
            >
              Reset
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-500 py-4">
          Loading metrics...
        </div>
      )}
    </div>
  );
};

export default DatabaseAnalytics;