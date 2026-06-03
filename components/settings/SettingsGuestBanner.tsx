import React from 'react';

interface SettingsGuestBannerProps {
  isGuest: boolean;
  onLogout?: () => void;
}

export const SettingsGuestBanner: React.FC<SettingsGuestBannerProps> = ({ isGuest, onLogout }) => {
  if (!isGuest || !onLogout) {
    return null;
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-amber-600 text-lg">👤</span>
        <h3 className="font-semibold text-amber-800">You're browsing as a Guest</h3>
      </div>
      <p className="text-sm text-amber-700">
        Your data is stored on this device only. Sign up for free to sync across devices, access AI features, and more.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onLogout}
          className="flex-1 bg-amber-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
        >
          Sign Up (Free)
        </button>
        <button
          onClick={onLogout}
          className="flex-1 border border-amber-600 text-amber-700 py-2 rounded-lg text-sm font-medium hover:bg-amber-50 transition-colors"
        >
          Log In
        </button>
      </div>
    </div>
  );
};
