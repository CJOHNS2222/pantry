import React from 'react';
import { ChevronDown, ChevronRight, Bell } from 'lucide-react';
import { NotificationSettingsComponent } from '../NotificationSettings';
import { User } from '../../types';
import { NotificationSettings } from '../../services/notificationService';

interface SettingsNotificationsSectionProps {
  expanded: boolean;
  onToggle: () => void;
  title: string;
  user?: User;
  notificationSettings: NotificationSettings;
  setNotificationSettings: React.Dispatch<React.SetStateAction<NotificationSettings>>;
}

export const SettingsNotificationsSection: React.FC<SettingsNotificationsSectionProps> = ({
  expanded,
  onToggle,
  title,
  user,
  notificationSettings,
  setNotificationSettings,
}) => {
  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden" data-section="notifications">
      <div onClick={onToggle} className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors">
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-5 h-5 text-theme-primary" /> : <ChevronRight className="w-5 h-5 text-theme-primary" />}
          <Bell className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">{title}</h3>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-theme p-4">
          {user && (
            <NotificationSettingsComponent
              user={user}
              currentSettings={notificationSettings}
              onSettingsChange={setNotificationSettings}
            />
          )}
        </div>
      )}
    </div>
  );
};
