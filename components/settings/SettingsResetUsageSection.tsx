import React from 'react';
import { RotateCcw } from 'lucide-react';

interface SettingsResetUsageSectionProps {
  isAdmin: boolean;
  onReset: () => Promise<void>;
}

export const SettingsResetUsageSection: React.FC<SettingsResetUsageSectionProps> = ({ isAdmin, onReset}) => {
  if (!isAdmin) return null;

  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
      <div className="w-full flex items-center justify-between p-4 border-b border-theme bg-theme-primary/20">
        <div className="flex items-center gap-3">
          
          <RotateCcw className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">Reset Usage Counters</h3>
        </div>
      </div>

      <div className="p-4 space-y-3">
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
    </div>
  );
};
