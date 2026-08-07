import React from 'react';
import { useSubscription } from '../../hooks/useSubscription';
import { useApp } from '../../contexts/AppContext';
import { useAppActions } from '../../contexts/AppActionsContext';
import { Tab } from '../../types/app';
import { User } from '../../types';
import { PaywallPrompt } from '../ui/PaywallPrompt';

interface PremiumFeatureProps {
  children: React.ReactNode;
  feature: string;
  user: User | null;
  fallback?: React.ReactNode;
  showUpgrade?: boolean;
  limit?: number;
  currentCount?: number;
  fallbackMessage?: string;
  onUpgrade?: () => void;
}

export const PremiumFeature: React.FC<PremiumFeatureProps> = ({
  children,
  feature,
  user,
  fallback,
  showUpgrade = true,
  limit,
  currentCount,
  fallbackMessage,
  onUpgrade
}) => {
  const { isPremium, isActive, loading } = useSubscription(user);
  const { setActiveTab } = useApp();
  const { setActiveSettingsCategory } = useAppActions();

  if (loading) {
    return <div className="animate-pulse bg-gray-200 h-8 rounded"></div>;
  }

  // If no user is logged in, don't apply premium restrictions
  if (!user) {
    return <>{children}</>;
  }

  // Check if user has reached the limit for free tier. Compare against the actual
  // usage count (defaulting to 0) rather than the truthiness of currentCount — a
  // falsy-but-valid 0 must not be treated the same as "no limit info available".
  const hasReachedLimit = limit !== undefined && (currentCount ?? 0) >= limit;

  if (isPremium && isActive) {
    return <>{children}</>;
  }

  // A limit was specified and the free-tier user hasn't reached it yet — let them
  // use the feature normally instead of showing a premium block on their first use.
  if (limit !== undefined && !hasReachedLimit) {
    return <>{children}</>;
  }

  // If there's a limit and user has reached it, show limit message
  if (hasReachedLimit && !isPremium) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (!showUpgrade) {
      return null;
    }

    return (
      <PaywallPrompt
        variant="overlay"
        feature={feature}
        title="Ready to Unlock More?"
        message={fallbackMessage || `You've reached the ${limit} ${feature} limit. Join thousands of home chefs who upgraded for unlimited access!`}
        perks={['✨ Premium users save 2+ hours per week on meal planning']}
        ctaLabel="Upgrade Now - Starting at $4.99/mo"
        onUpgrade={onUpgrade || (() => { setActiveSettingsCategory('subscription'); setActiveTab(Tab.SETTINGS); })}
      >
        {children}
      </PaywallPrompt>
    );
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgrade) {
    return null;
  }

  return (
    <PaywallPrompt
      variant="overlay"
      feature={feature}
      title="Premium Feature"
      message={`Unlock ${feature} and discover recipes tailored to your pantry. Join 10,000+ home chefs who save time and reduce food waste!`}
      perks={['🎯 Find recipes using ingredients you already have']}
      ctaLabel="Try Premium Free for 7 Days"
      onUpgrade={onUpgrade || (() => { setActiveSettingsCategory('subscription'); setActiveTab(Tab.SETTINGS); })}
    >
      {children}
    </PaywallPrompt>
  );
};

interface FeatureLimitProps {
  current: number;
  limit: number;
  feature: string;
  user: User | null;
  children: React.ReactNode;
}

export const FeatureLimit: React.FC<FeatureLimitProps> = ({
  current,
  limit,
  feature,
  user,
  children
}) => {
  const { isPremium, isActive } = useSubscription(user);
  const { setActiveTab } = useApp();
  const { setActiveSettingsCategory } = useAppActions();

  if (isPremium && isActive) {
    return <>{children}</>;
  }

  if (current >= limit) {
    return (
      <PaywallPrompt
        feature={feature}
        limit={limit}
        currentCount={current}
        message={`You've reached the free limit of ${limit} ${feature}`}
        ctaLabel="Upgrade for Unlimited"
        onUpgrade={() => { setActiveSettingsCategory('subscription'); setActiveTab(Tab.SETTINGS); }}
      />
    );
  }

  return <>{children}</>;
};