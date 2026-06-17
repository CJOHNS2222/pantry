import React from 'react';
import { BellRing } from 'lucide-react';
import { User } from '../../types';
import { PendingNotifications } from '../ui/PendingNotifications';

interface SettingsPendingNotificationsSectionProps {
  user: User | null | undefined;
  title: string;
}

export const SettingsPendingNotificationsSection: React.FC<SettingsPendingNotificationsSectionProps> = ({
  user, title, }) => {
  if (!user) {
    return null;
  }

  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden" data-section="pending-notifications">
      <div className="w-full flex items-center justify-between p-4 border-b border-theme bg-theme-primary/20"
      >
        <div className="flex items-center gap-3">
          
          <BellRing className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">{title}</h3>
        </div>
      </div>
      <div className="p-4">
          <PendingNotifications user={user} />
        </div>
    </div>
  );
};
