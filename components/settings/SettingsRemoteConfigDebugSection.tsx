import React from 'react';
import { Bug, ChevronDown, ChevronRight } from 'lucide-react';
import { RemoteConfigDebugPanel } from '../RemoteConfigDebugPanel';

interface SettingsRemoteConfigDebugSectionProps {
  isAdmin: boolean;
  expanded: boolean;
  onToggle: () => void;
  addToast?: (message: string, type: 'error' | 'success' | 'info' | 'warning', duration?: number) => void;
}

export const SettingsRemoteConfigDebugSection: React.FC<SettingsRemoteConfigDebugSectionProps> = ({
  isAdmin,
  expanded,
  onToggle,
  addToast,
}) => {
  if (!isAdmin) return null;

  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
      <div onClick={onToggle} className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors">
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-5 h-5 text-theme-primary" /> : <ChevronRight className="w-5 h-5 text-theme-primary" />}
          <Bug className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">Remote Config Debug</h3>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-theme p-4">
          <RemoteConfigDebugPanel addToast={addToast} />
        </div>
      )}
    </div>
  );
};
