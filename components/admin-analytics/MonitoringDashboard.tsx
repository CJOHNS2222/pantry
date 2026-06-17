import React, { useState, useEffect } from 'react';
import { AlertTriangle, Database, TrendingUp, Clock, Activity } from 'lucide-react';
import DatabaseMonitoringService from '../../services/databaseMonitoringService';
import { User } from '../../types';

interface MonitoringDashboardProps {
  user: User | null;
  compact?: boolean;
}

export const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({ user: _user, compact = false }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [metrics, setMetrics] = useState<any>(null);
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    const updateMetrics = () => {
      const currentMetrics = DatabaseMonitoringService.getMetrics();
      // compute per-minute derived metrics to match UI expectations
      const sessionDuration = currentMetrics.sessionDuration || 1;
      const readsPerMinute = Math.round((currentMetrics.reads / sessionDuration) * 60000);
      const writesPerMinute = Math.round((currentMetrics.writes / sessionDuration) * 60000);
      setMetrics({ ...currentMetrics, readsPerMinute, writesPerMinute });

      // Check for potential issues
      const newAlerts: string[] = [];

      if (writesPerMinute > 100) {
        newAlerts.push('High write activity detected');
      }

      if (readsPerMinute > 500) {
        newAlerts.push('High read activity detected');
      }

      if (currentMetrics.sessionDuration > 3600000 && currentMetrics.writes < 10) {
        newAlerts.push('Low activity session - possible user engagement issue');
      }

      setAlerts(newAlerts);
    };

    // Update immediately and then every 30 seconds
    updateMetrics();
    const interval = setInterval(updateMetrics, 30000);

    return () => clearInterval(interval);
  }, []);

  if (!metrics) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-theme-secondary">
        <Activity className="w-3 h-3" />
        <span>DB: {metrics.writesPerMinute}w/min</span>
        {alerts.length > 0 && <AlertTriangle className="w-3 h-3 text-yellow-500" />}
      </div>
    );
  }

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/20 dark:to-gray-900/20 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-2 mb-3">
        <Database className="w-4 h-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Database Monitoring</h3>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          {formatDuration(metrics.sessionDuration)}
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-yellow-800 dark:text-yellow-200">
              <div className="font-medium mb-1">Active Alerts:</div>
              <ul className="space-y-1">
                {alerts.map((alert, index) => (
                  <li key={index}>• {alert}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-3 h-3 text-green-500" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Writes</span>
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {metrics.writes}
          </div>
          <div className="text-xs text-gray-500">
            {metrics.writesPerMinute}/min
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-3 h-3 text-blue-500" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Reads</span>
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {metrics.reads}
          </div>
          <div className="text-xs text-gray-500">
            {metrics.readsPerMinute}/min
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-3 h-3 text-purple-500" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Queries</span>
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {metrics.queries}
          </div>
          <div className="text-xs text-gray-500">
            Total
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-3 h-3 text-orange-500" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Batches</span>
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {metrics.batchOperations}
          </div>
          <div className="text-xs text-gray-500">
            Operations
          </div>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-600 dark:text-gray-400">
          <div className="flex justify-between">
            <span>Session Start:</span>
            <span>{new Date(Date.now() - metrics.sessionDuration).toLocaleTimeString()}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span>Active Subscriptions:</span>
            <span>{metrics.realtimeSubscriptions}</span>
          </div>
        </div>
      </div>
    </div>
  );
};