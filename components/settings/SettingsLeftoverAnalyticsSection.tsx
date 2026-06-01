import React from 'react';
import { BarChart2, ChevronDown, ChevronRight } from 'lucide-react';
import { LeftoverAnalytics } from '../LeftoverAnalytics';

interface SettingsLeftoverAnalyticsSectionProps {
  userId?: string;
  householdId?: string;
  expanded: boolean;
  onToggle: () => void;
  title: string;
}

export const SettingsLeftoverAnalyticsSection: React.FC<SettingsLeftoverAnalyticsSectionProps> = ({
  userId,
  householdId,
  expanded,
  onToggle,
  title,
}) => {
  if (!userId) {
    return null;
  }

  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
      <div onClick={onToggle} className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors">
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-5 h-5 text-theme-primary" /> : <ChevronRight className="w-5 h-5 text-theme-primary" />}
          <BarChart2 className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">{title}</h3>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-theme p-4">
          <LeftoverAnalytics householdId={householdId} userId={userId} />
        </div>
      )}
    </div>
  );
};
