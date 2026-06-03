import React from 'react';
import { Camera, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { User } from '../../types';

interface SettingsPantryImagesSectionProps {
  user?: User;
  expanded: boolean;
  onToggle: () => void;
  title: string;
  updatingBulkImages: boolean;
  onBulkUpdate: () => Promise<void>;
}

export const SettingsPantryImagesSection: React.FC<SettingsPantryImagesSectionProps> = ({
  user,
  expanded,
  onToggle,
  title,
  updatingBulkImages,
  onBulkUpdate,
}) => {
  if (!user) return null;

  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
      <div onClick={onToggle} className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors">
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-5 h-5 text-theme-primary" /> : <ChevronRight className="w-5 h-5 text-theme-primary" />}
          <Camera className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">{title}</h3>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-theme p-4">
          <div className="space-y-3">
            <p className="text-sm text-theme-secondary">
              Automatically fetch better images for pantry items that currently have placeholder images.
              This will scan your inventory and update items with images from food databases and stock photos.
              Images are cached locally for faster loading and offline access.
            </p>
            <button
              onClick={onBulkUpdate}
              disabled={updatingBulkImages}
              className="bg-blue-500 text-white px-4 py-2 rounded font-medium text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {updatingBulkImages && <Loader2 className="w-4 h-4 animate-spin" />}
              {updatingBulkImages ? 'Updating Images...' : 'Update Pantry Images'}
            </button>
            <div className="text-xs text-theme-secondary">This feature uses external APIs and may take time for large inventories.</div>
          </div>
        </div>
      )}
    </div>
  );
};
