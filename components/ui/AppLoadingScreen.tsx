import React from 'react';

// Fixed brand background/accent (not theme-dependent) so this screen matches the
// native splash screen instead of flashing to the default light theme before the
// user's saved theme preference has loaded.
export const AppLoadingScreen: React.FC<{ message?: string }> = ({ message = 'Loading your kitchen...' }) => (
  <div
    className="h-screen w-screen flex flex-col items-center justify-center gap-5"
    style={{ backgroundColor: '#2A0A10' }}
  >
    <div
      className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)' }}
    >
      <img src="/icons/icon.png" alt="Stock & Spoon" className="w-14 h-14 object-contain" />
    </div>
    <div className="text-center">
      <h1 className="text-2xl font-bold mb-2" style={{ color: '#F3F4F6', fontFamily: "'Playfair Display', serif" }}>
        Stock &amp; Spoon
      </h1>
      <div className="flex items-center justify-center gap-2">
        <div
          className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent"
          style={{ borderColor: '#F59E0B', borderTopColor: 'transparent' }}
        />
        <p className="text-sm" style={{ color: '#FECACA' }}>{message}</p>
      </div>
    </div>
  </div>
);
