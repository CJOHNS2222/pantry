import React from 'react';
import { ChevronDown, ChevronRight, Tag } from 'lucide-react';

interface SettingsCategoriesSectionProps {
  userExists: boolean;
  expanded: boolean;
  onToggle: () => void;
  title: string;
  customCategoryCount: number;
  onManageCategories: () => void;
}

export const SettingsCategoriesSection: React.FC<SettingsCategoriesSectionProps> = ({
  userExists,
  expanded,
  onToggle,
  title,
  customCategoryCount,
  onManageCategories,
}) => {
  if (!userExists) {
    return null;
  }

  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
      <div onClick={onToggle} className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors">
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-5 h-5 text-theme-primary" /> : <ChevronRight className="w-5 h-5 text-theme-primary" />}
          <Tag className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">{title}</h3>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-theme p-4">
          <div className="space-y-3">
            <p className="text-sm text-theme-secondary">Create custom categories to better organize your pantry items.</p>
            <button
              onClick={onManageCategories}
              className="bg-[var(--accent-color)] text-white px-4 py-2 rounded font-medium text-sm hover:bg-opacity-90 transition-colors"
            >
              Manage Categories
            </button>
            <div className="text-xs text-theme-secondary">
              {customCategoryCount} custom categor{customCategoryCount === 1 ? 'y' : 'ies'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
