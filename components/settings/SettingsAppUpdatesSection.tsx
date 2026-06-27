import React, { useState } from 'react';
import { RefreshCw, FileText } from 'lucide-react';
import { VersionUpdate } from '../ui/VersionUpdate';
import { ChangelogPage } from './ChangelogPage';
import { useIntl } from 'react-intl';

interface SettingsAppUpdatesSectionProps {
  title: string;
}

export const SettingsAppUpdatesSection: React.FC<SettingsAppUpdatesSectionProps> = ({ title }) => {
  const intl = useIntl();
  const [showChangelog, setShowChangelog] = useState(false);

  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
      <div className="w-full flex items-center justify-between p-4 border-b border-theme bg-theme-primary/20">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">{title}</h3>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <VersionUpdate autoCheck={true} />
        
        <div className="border-t border-theme pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="text-sm text-theme-secondary">
            {intl.formatMessage({
              id: 'settings.changelogDescription',
              defaultMessage: 'Want to see what changed in previous versions?'
            })}
          </div>
          <button
            onClick={() => setShowChangelog(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-theme-primary border border-theme hover:border-[var(--accent-color)] text-theme-primary text-sm font-medium rounded-lg hover:bg-theme-secondary transition-colors"
          >
            <FileText className="w-4 h-4 text-[var(--accent-color)]" />
            {intl.formatMessage({
              id: 'settings.viewChangelog',
              defaultMessage: 'View Changelog'
            })}
          </button>
        </div>
      </div>

      {showChangelog && (
        <ChangelogPage onBack={() => setShowChangelog(false)} />
      )}
    </div>
  );
};
