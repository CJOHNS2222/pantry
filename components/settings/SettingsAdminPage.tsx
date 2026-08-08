import React, { Suspense, lazy, useState } from 'react';
import { Bug, RotateCcw } from 'lucide-react';
import { User } from '../../types';

const MonitoringDashboard = lazy(() => import('../admin-analytics/MonitoringDashboard').then(m => ({ default: m.MonitoringDashboard })));
const PerformanceMonitoringDashboard = lazy(() => import('../admin-analytics/PerformanceMonitoringDashboard'));
const UserBehaviorAnalytics = lazy(() => import('../admin-analytics/UserBehaviorAnalytics'));
const RemoteConfigDebugPanel = lazy(() => import('../admin-analytics/RemoteConfigDebugPanel').then(m => ({ default: m.RemoteConfigDebugPanel })));

type AdminDashboardTab = 'monitoring' | 'performance' | 'behavior';
type ToastFn = (message: string, type: 'error' | 'success' | 'info' | 'warning', duration?: number) => void;

interface SettingsAdminPageProps {
  user: User | null | undefined;
  onResetUsage: () => Promise<void>;
  addToast?: ToastFn;
}

export const SettingsAdminPage: React.FC<SettingsAdminPageProps> = ({ user, onResetUsage, addToast }) => {
  const [adminDashboardTab, setAdminDashboardTab] = useState<AdminDashboardTab>('monitoring');

  return (
    <div className="space-y-4">
      <div className="flex gap-2 bg-theme-secondary border border-theme rounded-xl p-1">
        <button
          onClick={() => setAdminDashboardTab('monitoring')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${adminDashboardTab === 'monitoring' ? 'bg-[var(--accent-color)] text-[var(--accent-text,white)]' : 'text-theme-secondary hover:text-theme-primary'}`}
        >
          Monitoring
        </button>
        <button
          onClick={() => setAdminDashboardTab('performance')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${adminDashboardTab === 'performance' ? 'bg-[var(--accent-color)] text-[var(--accent-text,white)]' : 'text-theme-secondary hover:text-theme-primary'}`}
        >
          Performance
        </button>
        <button
          onClick={() => setAdminDashboardTab('behavior')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${adminDashboardTab === 'behavior' ? 'bg-[var(--accent-color)] text-[var(--accent-text,white)]' : 'text-theme-secondary hover:text-theme-primary'}`}
        >
          User Behavior
        </button>
      </div>

      <Suspense fallback={null}>
        {adminDashboardTab === 'monitoring' && <MonitoringDashboard user={user ?? null} />}
        {adminDashboardTab === 'performance' && <PerformanceMonitoringDashboard inline={true} />}
        {adminDashboardTab === 'behavior' && <UserBehaviorAnalytics />}
      </Suspense>

      <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
        <div className="w-full flex items-center justify-between p-4 border-b border-theme bg-theme-primary/20">
          <div className="flex items-center gap-3">
            <Bug className="w-5 h-5 text-[var(--accent-color)]" />
            <h3 className="font-semibold text-theme-primary">Remote Config Debug</h3>
          </div>
        </div>
        <div className="p-4">
          <Suspense fallback={null}>
            <RemoteConfigDebugPanel addToast={addToast} />
          </Suspense>
        </div>
      </div>

      <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
        <div className="w-full flex items-center justify-between p-4 border-b border-theme bg-theme-primary/20">
          <div className="flex items-center gap-3">
            <RotateCcw className="w-5 h-5 text-[var(--accent-color)]" />
            <h3 className="font-semibold text-theme-primary">Reset Usage Counters</h3>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-theme-secondary">
            Resets all usage counters (searches, AI scans, meal plan, saved recipes) to 0 for the current user. Use after fixing the reset bug so counts start fresh.
          </p>
          <button
            onClick={onResetUsage}
            className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
          >
            Reset My Usage Counters
          </button>
        </div>
      </div>
    </div>
  );
};
