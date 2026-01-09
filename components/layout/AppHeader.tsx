import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { User } from '../../types';

interface AppHeaderProps {
  user: User;
  settings: any;
  setSettings: (settings: any) => void;
  onShowHousehold: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  user,
  settings,
  setSettings,
  onShowHousehold
}) => {
  return (
    <header className="bg-theme-secondary p-3 pt-5 pb-0 fixed top-0 left-0 right-0 max-w-md mx-auto z-20 shadow-md border-b border-theme transition-colors duration-300">
      <div className="flex justify-between items-center">
        <div className="flex flex-col items-start">
          <div className="text-sm font-medium text-theme-primary opacity-80">
            {user.email}
          </div>
          <button
            data-tutorial="household-button"
            onClick={onShowHousehold}
            className="flex items-center space-x-2 px-2 py-1 rounded-full hover:bg-black/5 transition-colors mt-1"
          >
            {user.avatar ? (
              <img src={user.avatar} className="w-6 h-6 rounded-full border border-theme" alt="profile" />
            ) : (
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{backgroundColor: 'var(--accent-color)'}}>
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </button>
        </div>
        <div className="flex flex-col items-center">
          <h1 className="text-xl font-serif font-bold text-theme-primary" style={{color: 'var(--accent-color)'}}>
            Smart Pantry Chef
          </h1>
          <span className="text-[10px] uppercase tracking-widest text-theme-secondary opacity-60">AI Kitchen Assistant</span>
        </div>
        <button
          data-tutorial="theme-toggle"
          onClick={() => setSettings(prev => ({
            ...prev,
            theme: {
              ...prev.theme,
              mode: prev.theme.mode === 'dark' ? 'light' : 'dark'
            }
          }))}
          className="p-2 text-theme-secondary opacity-70 hover:opacity-100"
        >
          {settings.theme.mode === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
    </header>
  );
};