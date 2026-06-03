import React from 'react';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';

interface SettingsResetUsageSectionProps {
  isAdmin: boolean;
  expanded: boolean;
  onToggle: () => void;
  onReset: () => Promise<void>;
}

export const SettingsResetUsageSection: React.FC<SettingsResetUsageSectionProps> = ({ isAdmin, expanded, onToggle, onReset }) => {
  if (!isAdmin) return null;

  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
      <div onClick={onToggle} className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors">
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-5 h-5 text-theme-primary" /> : <ChevronRight className="w-5 h-5 text-theme-primary" />}
          <RotateCcw className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">Reset Usage Counters</h3>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-theme p-4 space-y-3">
          <p className="text-sm text-theme-secondary">
            Resets all usage counters (searches, AI scans, meal plan, saved recipes) to 0 for the current user. Use after fixing the reset bug so counts start fresh.
          </p>
          <button
            onClick={onReset}
            className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
          >
            Reset My Usage Counters
          </button>
        </div>
      )}
    </div>
  );
};
