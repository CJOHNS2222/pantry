import React from 'react';
import { Household } from '../../types';

interface SettingsAccountHeroCardProps {
  pantryItemCount: number;
  isPremium: boolean;
  isFamily: boolean;
  household: Household | null | undefined;
  onUpgrade: () => void;
  onShowHousehold?: () => void;
}

export const SettingsAccountHeroCard: React.FC<SettingsAccountHeroCardProps> = ({
  pantryItemCount,
  isPremium,
  isFamily,
  household,
  onUpgrade,
  onShowHousehold,
}) => {
  const tierLabel = isFamily ? 'Family' : isPremium ? 'Premium' : 'Free';
  const tierColor = isFamily ? 'text-purple-500' : isPremium ? 'text-[var(--accent-color)]' : 'text-theme-secondary';
  const householdCount = household?.members?.length ?? 0;

  const ctaContent = !isPremium && !isFamily
    ? { icon: '⭐', text: 'Upgrade to Premium for AI recipes, unlimited saves & more', accent: true }
    : !household
    ? { icon: '👥', text: 'Invite family or roommates to share your pantry & shopping list', accent: false }
    : null;

  return (
    <div className="rounded-2xl border overflow-hidden bg-theme-secondary border-theme shadow-sm">
      {/* Stat strip */}
      <div className="grid grid-cols-3 divide-x divide-theme">
        {[
          { value: pantryItemCount, label: 'Pantry Items', icon: '🥫' },
          { value: tierLabel, label: 'Plan', icon: '🏅', valueClass: tierColor },
          { value: householdCount || '—', label: 'Household', icon: '👥' },
        ].map(stat => (
          <div key={stat.label} className="flex flex-col items-center py-4 px-2 gap-0.5">
            <span className="text-lg">{stat.icon}</span>
            <span className={`text-xl font-black text-theme-primary ${stat.valueClass ?? ''}`}>{stat.value}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-theme-secondary opacity-60">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Contextual CTA */}
      {ctaContent && (
        <div className={`flex items-center gap-3 px-4 py-3 border-t ${
          ctaContent.accent
            ? 'border-[var(--accent-color)]/20 bg-[var(--accent-color)]/5'
            : 'border-theme bg-theme-primary'
        }`}>
          <span className="text-base shrink-0">{ctaContent.icon}</span>
          <p className="flex-1 text-xs text-theme-secondary leading-snug">{ctaContent.text}</p>
          <button
            onClick={ctaContent.accent ? onUpgrade : onShowHousehold}
            className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
              ctaContent.accent
                ? 'bg-[var(--accent-color)] text-[var(--accent-text,white)] hover:bg-[var(--accent-color)]/80'
                : 'bg-theme-secondary text-theme-primary border border-theme hover:bg-theme-primary'
            }`}
          >
            {ctaContent.accent ? 'Upgrade' : 'Invite'}
          </button>
        </div>
      )}
    </div>
  );
};
