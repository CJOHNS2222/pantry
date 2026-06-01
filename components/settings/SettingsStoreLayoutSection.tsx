import React from 'react';
import { ChevronDown, ChevronRight, ShoppingCart } from 'lucide-react';
import { StoreLayoutEditor } from '../StoreLayoutEditor';

interface SettingsStoreLayoutSectionProps {
  userExists: boolean;
  expanded: boolean;
  onToggle: () => void;
  title: string;
  storeLayout: string[];
  onStoreLayoutChange: (newLayout: string[]) => void;
  storeProfiles: Record<string, string[]>;
  activeStoreProfile?: string;
  onStoreProfilesChange: (profiles: Record<string, string[]>, active?: string) => void;
}

export const SettingsStoreLayoutSection: React.FC<SettingsStoreLayoutSectionProps> = ({
  userExists,
  expanded,
  onToggle,
  title,
  storeLayout,
  onStoreLayoutChange,
  storeProfiles,
  activeStoreProfile,
  onStoreProfilesChange,
}) => {
  if (!userExists) {
    return null;
  }

  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
      <div onClick={onToggle} className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors">
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-5 h-5 text-theme-primary" /> : <ChevronRight className="w-5 h-5 text-theme-primary" />}
          <ShoppingCart className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">{title}</h3>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-theme p-4">
          <StoreLayoutEditor
            storeLayout={storeLayout}
            onStoreLayoutChange={onStoreLayoutChange}
            storeProfiles={storeProfiles}
            activeStoreProfile={activeStoreProfile}
            onStoreProfilesChange={onStoreProfilesChange}
          />
        </div>
      )}
    </div>
  );
};
