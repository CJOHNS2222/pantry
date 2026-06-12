import React from 'react';
import { Bell } from 'lucide-react';
import { NotificationSettingsComponent } from '../NotificationSettings';
import { User } from '../../types';
import { NotificationSettings } from '../../services/notificationService';

interface SettingsNotificationsSectionProps {
  title: string;
  user?: User;
  notificationSettings: NotificationSettings;
  setNotificationSettings: React.Dispatch<React.SetStateAction<NotificationSettings>>;
}

export const SettingsNotificationsSection: React.FC<SettingsNotificationsSectionProps> = ({
  title, user, notificationSettings, setNotificationSettings, }) => {
  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden" data-section="notifications">
      <div className="w-full flex items-center justify-between p-4 border-b border-theme bg-theme-primary/20">
        <div className="flex items-center gap-3">
          
          <Bell className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">{title}</h3>
        </div>
      </div>

      <div className="p-4">
          {user && (
            <NotificationSettingsComponent
              user={user}
              currentSettings={notificationSettings}
              onSettingsChange={setNotificationSettings}
            />
          )}
        </div>
    </div>
  );
};
