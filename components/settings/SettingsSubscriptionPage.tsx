import React from 'react';
import { SettingsAccountHeroCard } from './SettingsAccountHeroCard';
import { SettingsUsageLimitsSection } from './SettingsUsageLimitsSection';
import { SettingsSubscriptionSection } from './SettingsSubscriptionSection';
import type { UsageLimits } from '../../services/usageService';
import { Household, User } from '../../types';

interface SettingsSubscriptionPageProps {
  user: User | null | undefined;
  pantryItemCount: number;
  isPremium: boolean;
  isFamily: boolean;
  household: Household | null | undefined;
  onUpgrade: () => void;
  onShowHousehold?: () => void;

  usageLimitsTitle: string;
  usageLimits: UsageLimits | null;

  subscriptionTitle: string;
}

export const SettingsSubscriptionPage: React.FC<SettingsSubscriptionPageProps> = ({
  user,
  pantryItemCount,
  isPremium,
  isFamily,
  household,
  onUpgrade,
  onShowHousehold,
  usageLimitsTitle,
  usageLimits,
  subscriptionTitle,
}) => {
  return (
    <>
      {user && !user.isGuest && (
        <SettingsAccountHeroCard
          pantryItemCount={pantryItemCount}
          isPremium={isPremium}
          isFamily={isFamily}
          household={household}
          onUpgrade={onUpgrade}
          onShowHousehold={onShowHousehold}
        />
      )}

      <SettingsUsageLimitsSection
        userExists={!!user}
        title={usageLimitsTitle}
        isPremium={isPremium}
        isFamily={isFamily}
        usageLimits={usageLimits}
        onOpenUpgrade={onUpgrade}
      />

      <SettingsSubscriptionSection
        user={user ?? undefined}
        title={subscriptionTitle}
      />
    </>
  );
};
