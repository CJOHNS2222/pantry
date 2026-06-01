import React from 'react';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { VersionUpdate } from '../VersionUpdate';

interface SettingsAppUpdatesSectionProps {
  expanded: boolean;
  onToggle: () => void;
  title: string;
}

export const SettingsAppUpdatesSection: React.FC<SettingsAppUpdatesSectionProps> = ({ expanded, onToggle, title }) => {
  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
      <div onClick={onToggle} className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors">
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-5 h-5 text-theme-primary" /> : <ChevronRight className="w-5 h-5 text-theme-primary" />}
          <RefreshCw className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">{title}</h3>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-theme p-4">
          <VersionUpdate autoCheck={true} />
        </div>
      )}
    </div>
  );
};
