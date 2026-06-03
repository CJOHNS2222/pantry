import React from 'react';
import { BellRing, ChevronDown, ChevronRight } from 'lucide-react';
import { User } from '../../types';
import { PendingNotifications } from '../PendingNotifications';

interface SettingsPendingNotificationsSectionProps {
  user: User | null | undefined;
  expanded: boolean;
  onToggle: () => void;
  title: string;
}

export const SettingsPendingNotificationsSection: React.FC<SettingsPendingNotificationsSectionProps> = ({
  user,
  expanded,
  onToggle,
  title,
}) => {
  if (!user) {
    return null;
  }

  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden" data-section="pending-notifications">
      <div
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors"
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-5 h-5 text-theme-primary" /> : <ChevronRight className="w-5 h-5 text-theme-primary" />}
          <BellRing className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">{title}</h3>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-theme p-4">
          <PendingNotifications user={user} />
        </div>
      )}
    </div>
  );
};
