import React from 'react';
import { Sun, Moon, Undo2 } from 'lucide-react';
import { User } from '../../types';
import { UsageIndicator } from '../UsageIndicator';
import { SyncIndicator } from '../SyncIndicator';
import { SyncStatus } from '../../hooks/useOfflineStatus';

interface AppHeaderProps {
  user: User;
  settings: any;
  setSettings: (settings: any) => void;
  onShowHousehold: () => void;
  recentActions?: any[];
  onUndo?: (action: any) => void;
  syncStatus: SyncStatus;
  onSyncClick?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  user,
  settings,
  setSettings,
  onShowHousehold,
  recentActions = [],
  onUndo,
  syncStatus,
  onSyncClick
}) => {
  return (
    <header 
      className="bg-theme-secondary p-3 pt-5 pb-0 fixed top-0 left-0 right-0 max-w-md mx-auto z-20 shadow-md border-b border-theme transition-colors duration-300"
      role="banner"
    >
      <div className="flex justify-between items-center">
        <div className="flex flex-col items-start">
          <div className="text-sm font-medium text-theme-primary opacity-80" id="user-email">
            {user.email}
          </div>
          <button
            data-tutorial="household-button"
            onClick={onShowHousehold}
            className="flex items-center space-x-2 px-2 py-1 rounded-full hover:bg-black/5 transition-colors mt-1 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2"
            aria-label={`Switch household or account. Current user: ${user.name}`}
            aria-describedby="user-email"
          >
            {user.avatar ? (
              <img 
                src={user.avatar} 
                className="w-6 h-6 rounded-full border border-theme" 
                alt={`${user.name}'s profile picture`}
              />
            ) : (
              <div 
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" 
                style={{backgroundColor: 'var(--accent-color)'}}
                aria-hidden="true"
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </button>
        </div>
        <div className="flex flex-col items-center">
          <h1 
            className="text-xl font-serif font-bold text-theme-primary" 
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
          <div className="mt-1">
            <SyncIndicator
              syncStatus={syncStatus}
              compact={true}
              onSyncClick={onSyncClick}
            />
          </div>
        </div>
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
            onClick={() => setSettings(prev => ({
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
      </div>
    </header>
  );
};