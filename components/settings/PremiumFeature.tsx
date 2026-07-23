import React from 'react';
import { Lock, Crown } from 'lucide-react';
import { useSubscription } from '../../hooks/useSubscription';
import { useApp } from '../../contexts/AppContext';
import { Tab } from '../../types/app';
import { User } from '../../types';

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
      <div className="premium-overlay-container">
        <div className="premium-overlay-backdrop">
          <div className="premium-upgrade-modal">
            <Crown className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <h3 className="font-bold text-gray-900 mb-1">Ready to Unlock More?</h3>
            <p className="text-sm text-gray-600 mb-3">
              {fallbackMessage || `You've reached the ${limit} ${feature} limit. Join thousands of home chefs who upgraded for unlimited access!`}
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-3">
              <p className="text-xs text-blue-800 dark:text-blue-200 font-medium">
                ✨ Premium users save 2+ hours per week on meal planning
              </p>
            </div>
              <button className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:from-yellow-500 hover:to-orange-600 transition-all" onClick={onUpgrade || (() => setActiveTab(Tab.SETTINGS))}>
              Upgrade Now - Starting at $4.99/mo
            </button>
          </div>
        </div>
        <div className="opacity-30 pointer-events-none">
          {children}
        </div>
      </div>
    );
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgrade) {
    return null;
  }

  return (
    <div className="premium-overlay-container">
      <div className="premium-overlay-backdrop">
        <div className="premium-upgrade-modal">
          <Crown className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
          <h3 className="font-bold text-gray-900 mb-1">Premium Feature</h3>
          <p className="text-sm text-gray-600 mb-3">
            Unlock {feature} and discover recipes tailored to your pantry. Join 10,000+ home chefs who save time and reduce food waste!
          </p>
          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg mb-3">
            <p className="text-xs text-green-800 dark:text-green-200 font-medium">
              🎯 Find recipes using ingredients you already have
            </p>
          </div>
          <button className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:from-yellow-500 hover:to-orange-600 transition-all" onClick={onUpgrade || (() => setActiveTab(Tab.SETTINGS))}>
            Try Premium Free for 7 Days
          </button>
        </div>
      </div>
      <div className="opacity-30 pointer-events-none">
        {children}
      </div>
    </div>
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

  if (isPremium && isActive) {
    return <>{children}</>;
  }

  if (current >= limit) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
        <Lock className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
        <p className="text-sm text-yellow-800 mb-2">
          You've reached the free limit of {limit} {feature}
        </p>
        <button className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600 transition-colors">
          Upgrade for Unlimited
        </button>
      </div>
    );
  }

  return <>{children}</>;
};