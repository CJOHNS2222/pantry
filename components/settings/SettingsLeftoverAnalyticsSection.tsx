import React from 'react';
import { BarChart2 } from 'lucide-react';
import { LeftoverAnalytics } from '../leftovers/LeftoverAnalytics';

interface SettingsLeftoverAnalyticsSectionProps {
  userId?: string;
  householdId?: string;
  title: string;
}

export const SettingsLeftoverAnalyticsSection: React.FC<SettingsLeftoverAnalyticsSectionProps> = ({
  userId, householdId, title, }) => {
  if (!userId) {
    return null;
  }

  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
      <div className="w-full flex items-center justify-between p-4 border-b border-theme bg-theme-primary/20">
        <div className="flex items-center gap-3">
          
          <BarChart2 className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">{title}</h3>
        </div>
      </div>

      <div className="p-4">
          <LeftoverAnalytics householdId={householdId} userId={userId} />
        </div>
    </div>
  );
};
