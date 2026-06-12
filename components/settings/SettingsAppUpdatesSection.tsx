import React from 'react';
import { RefreshCw } from 'lucide-react';
import { VersionUpdate } from '../VersionUpdate';

interface SettingsAppUpdatesSectionProps {
  title: string;
}

export const SettingsAppUpdatesSection: React.FC<SettingsAppUpdatesSectionProps> = ({ title}) => {
  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
      <div className="w-full flex items-center justify-between p-4 border-b border-theme bg-theme-primary/20">
        <div className="flex items-center gap-3">
          
          <RefreshCw className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">{title}</h3>
        </div>
      </div>

      <div className="p-4">
          <VersionUpdate autoCheck={true} />
        </div>
    </div>
  );
};
