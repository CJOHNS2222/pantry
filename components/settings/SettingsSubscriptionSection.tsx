import React from 'react';
import { ChevronDown, ChevronRight, Star } from 'lucide-react';
import { SubscriptionManager } from '../SubscriptionManager';
import { User } from '../../types';

interface SettingsSubscriptionSectionProps {
  user?: User;
  expanded: boolean;
  onToggle: () => void;
  title: string;
}

export const SettingsSubscriptionSection: React.FC<SettingsSubscriptionSectionProps> = ({ user, expanded, onToggle, title }) => {
  if (!user) return null;

  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
      <div onClick={onToggle} className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors">
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-5 h-5 text-theme-primary" /> : <ChevronRight className="w-5 h-5 text-theme-primary" />}
          <Star className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">{title}</h3>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-theme p-4">
          <SubscriptionManager user={user} />
        </div>
      )}
    </div>
  );
};
