import React from 'react';
import { Store } from 'lucide-react';

interface ShoppingListViewModeToggleProps {
  show: boolean;
  viewMode: 'list' | 'organized';
  setViewMode: React.Dispatch<React.SetStateAction<'list' | 'organized'>>;
  storeProfileNames: string[];
  activeStoreProfile: string;
  setActiveStoreProfile: (name: string) => void;
}

export const ShoppingListViewModeToggle: React.FC<ShoppingListViewModeToggleProps> = ({
  show,
  viewMode,
  setViewMode,
  storeProfileNames,
  activeStoreProfile,
  setActiveStoreProfile,
}) => {
  if (!show) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
      <button
        onClick={() => setViewMode('list')}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          viewMode === 'list'
            ? 'bg-[var(--accent-color)] text-white'
            : 'bg-theme-secondary text-theme-primary hover:bg-theme-primary'
        }`}
      >
        List View
      </button>
      <button
        onClick={() => setViewMode('organized')}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          viewMode === 'organized'
            ? 'bg-[var(--accent-color)] text-white'
            : 'bg-theme-secondary text-theme-primary hover:bg-theme-primary'
        }`}
      >
        Store Order
      </button>
      {storeProfileNames.length > 0 && (
        <div className="relative">
          <select
            value={activeStoreProfile}
            onChange={(e) => setActiveStoreProfile(e.target.value)}
            className="flex items-center gap-1 pl-8 pr-3 py-2 rounded-lg text-sm font-medium bg-theme-secondary text-theme-primary border border-theme hover:border-[var(--accent-color)] transition-colors appearance-none cursor-pointer"
            title="Switch store profile"
          >
            <option value="__default__">Default layout</option>
            {storeProfileNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <Store className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-secondary pointer-events-none" />
        </div>
      )}
    </div>
  );
};
