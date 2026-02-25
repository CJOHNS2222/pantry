import React, { useState, useEffect } from 'react';
import { Sun, Moon, Undo2, Bell } from 'lucide-react';
import { User, Household } from '../../types';
import { UsageIndicator } from '../UsageIndicator';
import { HouseholdStatusIndicator } from '../HouseholdStatusIndicator';
import { SyncIndicator } from '../SyncIndicator';
import { OnlineIndicator } from '../OnlineIndicator';
import { SyncStatus } from '../../hooks/useOfflineStatus';
import { NotificationService } from '../../services/notificationService';

interface AppHeaderProps {
  user: User;
  household: Household | null;
  settings: any;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
  onShowHousehold: () => void;
  recentActions?: any[];
  onUndo?: (action: any) => void;
  syncStatus: SyncStatus;
  onSyncClick?: () => void;
  onNavigateToSettings?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  user,
  household,
  settings,
  setSettings,
  onShowHousehold,
  recentActions = [],
  onUndo,
  syncStatus,
  onSyncClick,
  onNavigateToSettings
}) => {
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  useEffect(() => {
    const loadUnreadCount = async () => {
      // Only load notifications if user is authenticated
      if (!user?.id) return;
      
      try {
        const unreadNotifications = await NotificationService.getUnreadNotifications(user.id, user.email);
        setUnreadNotificationsCount(unreadNotifications.length);
      } catch (error) {
        console.error('Error loading unread notifications count:', error);
        // Don't show error to user, just set count to 0
        setUnreadNotificationsCount(0);
      }
    };

    loadUnreadCount();

    // Refresh count every 5 minutes (reduced from 30 seconds to minimize queries)
    const interval = setInterval(loadUnreadCount, 300000);
    return () => clearInterval(interval);
  }, [user?.id, user?.email]);
  return (
    <header 
      className="bg-theme-secondary p-3 pt-[20px] pb-0 fixed top-0 left-0 right-0 max-w-md mx-auto z-20 shadow-md border-b border-theme transition-colors duration-300"
      role="banner"
    >
      <div className="flex justify-between items-center">
        <div className="flex flex-col items-center min-w-0 flex-shrink">
          <div className="flex items-center gap-1 mb-1">
            <div className="text-sm font-medium text-theme-primary opacity-80 truncate" id="user-email">
              {user.name || user.email.split('@')[0]}
            </div>
            {unreadNotificationsCount > 0 && user?.id && onNavigateToSettings && (
              <button
                onClick={onNavigateToSettings}
                className="relative p-1 text-amber-500 hover:text-amber-400 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 rounded"
                aria-label={`${unreadNotificationsCount} unread notifications`}
                title="View pending notifications"
              >
                <Bell className="w-3 h-3" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium text-[10px]">
                  {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                </span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              data-tutorial="household-button"
              onClick={onShowHousehold}
              className="flex items-center px-1 py-1 rounded-full hover:bg-black/5 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2"
              aria-label={`Switch household or account. Current user: ${user.name}`}
              aria-describedby="user-email"
            >
              {user.avatar ? (
                <img 
                  src={user.avatar} 
                  className="w-7 h-7 rounded-full border border-theme" 
                  alt={`${user.name}'s profile picture`}
                />
              ) : (
                <div 
                  className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white" 
                  style={{backgroundColor: 'var(--accent-color)'}}
                  aria-hidden="true"
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
            </button>
            <SyncIndicator
              syncStatus={syncStatus}
              compact={true}
              onSyncClick={onSyncClick}
            />
          </div>
        </div>
        <div className="flex flex-col items-center flex-1 min-w-0">
          <h1 
            className="text-xl font-serif font-bold text-theme-primary whitespace-nowrap" 
            style={{color: 'var(--accent-color)'}}
            id="app-title"
          >
            Smart Pantry Chef
          </h1>
          <span 
            className="text-[10px] uppercase tracking-widest text-theme-secondary opacity-60"
            aria-describedby="app-title"
          >
            AI Kitchen Assistant
          </span>
          <UsageIndicator user={user} compact={true} onUpgrade={() => {}} />
          {household && household.members.length > 1 && (
            <div className="mt-1">
              <HouseholdStatusIndicator
                household={household}
                currentUserId={user.id}
              />
            </div>
          )}
        </div>
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className="flex items-center gap-2">
            {recentActions.length > 0 && onUndo && (
              <button
                onClick={() => onUndo(recentActions[0])}
                className="p-2 text-theme-secondary opacity-70 hover:opacity-100 relative focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2"
                aria-label={`Undo last action (${recentActions.length} available)`}
                title="Undo last action"
              >
                <Undo2 className="w-5 h-5" aria-hidden="true" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {recentActions.length}
                </span>
              </button>
            )}
            <button
              data-tutorial="theme-toggle"
              onClick={() => setSettings((prev: any) => ({
                ...prev,
                theme: {
                  ...prev.theme,
                  mode: prev.theme.mode === 'dark' ? 'light' : 'dark'
                }
              }))}
              className="p-2 text-theme-secondary opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2"
              aria-label={`Switch to ${settings.theme.mode === 'dark' ? 'light' : 'dark'} theme`}
            >
              {settings.theme.mode === 'dark' ? <Sun className="w-5 h-5" aria-hidden="true" /> : <Moon className="w-5 h-5" aria-hidden="true" />}
            </button>
          </div>
          <OnlineIndicator isOnline={syncStatus.isOnline} />
        </div>
      </div>
    </header>
  );
};