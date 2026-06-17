import React from 'react';
import { Star } from 'lucide-react';
import { SubscriptionManager } from './SubscriptionManager';
import { User } from '../../types';

interface SettingsSubscriptionSectionProps {
  user?: User;
  title: string;
}

export const SettingsSubscriptionSection: React.FC<SettingsSubscriptionSectionProps> = ({ user, title}) => {
  if (!user) return null;

  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
      <div className="w-full flex items-center justify-between p-4 border-b border-theme bg-theme-primary/20">
        <div className="flex items-center gap-3">
          
          <Star className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">{title}</h3>
        </div>
      </div>

      <div className="p-4">
          <SubscriptionManager user={user} />
        </div>
    </div>
  );
};
