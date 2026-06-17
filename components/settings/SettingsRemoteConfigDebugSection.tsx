import React from 'react';
import { Bug } from 'lucide-react';
import { RemoteConfigDebugPanel } from '../admin-analytics/RemoteConfigDebugPanel';

interface SettingsRemoteConfigDebugSectionProps {
  isAdmin: boolean;
  addToast?: (message: string, type: 'error' | 'success' | 'info' | 'warning', duration?: number) => void;
}

export const SettingsRemoteConfigDebugSection: React.FC<SettingsRemoteConfigDebugSectionProps> = ({
  isAdmin, addToast, }) => {
  if (!isAdmin) return null;

  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
      <div className="w-full flex items-center justify-between p-4 border-b border-theme bg-theme-primary/20">
        <div className="flex items-center gap-3">
          
          <Bug className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">Remote Config Debug</h3>
        </div>
      </div>

      <div className="p-4">
          <RemoteConfigDebugPanel addToast={addToast} />
        </div>
    </div>
  );
};
