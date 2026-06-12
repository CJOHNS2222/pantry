import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { StoreLayoutEditor } from '../StoreLayoutEditor';

interface SettingsStoreLayoutSectionProps {
  userExists: boolean;
  title: string;
  storeLayout: string[];
  onStoreLayoutChange: (newLayout: string[]) => void;
  storeProfiles: Record<string, string[]>;
  activeStoreProfile?: string;
  onStoreProfilesChange: (profiles: Record<string, string[]>, active?: string) => void;
}

export const SettingsStoreLayoutSection: React.FC<SettingsStoreLayoutSectionProps> = ({
  userExists, title, storeLayout, onStoreLayoutChange, storeProfiles, activeStoreProfile, onStoreProfilesChange, }) => {
  if (!userExists) {
    return null;
  }

  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
      <div className="w-full flex items-center justify-between p-4 border-b border-theme bg-theme-primary/20">
        <div className="flex items-center gap-3">
          
          <ShoppingCart className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">{title}</h3>
        </div>
      </div>

      <div className="p-4">
          <StoreLayoutEditor
            storeLayout={storeLayout}
            onStoreLayoutChange={onStoreLayoutChange}
            storeProfiles={storeProfiles}
            activeStoreProfile={activeStoreProfile}
            onStoreProfilesChange={onStoreProfilesChange}
          />
        </div>
    </div>
  );
};
