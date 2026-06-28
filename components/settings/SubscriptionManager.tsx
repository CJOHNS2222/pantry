import React, { useState, useEffect } from 'react';
import { Crown, Check, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useSubscription } from '../../hooks/useSubscription';
import { User } from '../../types';
import { UsageService, UsageLimits } from '../../services/usageService';
import { log } from '../../services/logService';
import AnalyticsService from '../../services/analyticsService';
import { useAppActions } from '../../contexts/AppActionsContext';
import {
  initializePurchaseStore,
  purchaseProduct,
  restorePurchases,
  getProductPrice,
  PRODUCT_IDS,
  ProductId,
} from '../../services/purchaseService';

interface SubscriptionManagerProps {
  user: User | null;
}

const PLAN_PRODUCT_MAP: Record<string, ProductId> = {
  premium: PRODUCT_IDS.PREMIUM_MONTHLY,
  family: PRODUCT_IDS.FAMILY_MONTHLY,
};

export const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ user }) => {
  const { subscription, isPremium, isActive } = useSubscription(user);
  const { addToast } = useAppActions();
  const [showPlans, setShowPlans] = useState(false);
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [livePrices, setLivePrices] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchUsageLimits = async () => {
      if (user) {
        try {
          const limits = await UsageService.getUsageLimits(user);
          setUsageLimits(limits);
        } catch (error) {
          log.error('Error fetching usage limits', { error }, 'SubscriptionManager');
        }
      }
    };

    fetchUsageLimits();

    // Initialize IAP store on Android and fetch live prices
    if (user?.id && Capacitor.isNativePlatform()) {
      initializePurchaseStore(user.id)
        .then(() => {
          setLivePrices({
            [PRODUCT_IDS.PREMIUM_MONTHLY]: getProductPrice(PRODUCT_IDS.PREMIUM_MONTHLY) ?? '',
            [PRODUCT_IDS.FAMILY_MONTHLY]: getProductPrice(PRODUCT_IDS.FAMILY_MONTHLY) ?? '',
          });
        })
        .catch((err: unknown) =>
          log.error('IAP store init error', { error: err instanceof Error ? err.message : String(err) }, 'SubscriptionManager')
        );
    }

    // Track subscription funnel - viewing pricing
    AnalyticsService.trackSubscriptionFunnel('view_pricing', {
      current_tier: subscription?.tier || 'free',
      is_active: isActive
    });
  }, [user, subscription?.tier, isActive]);

  const handleUpgrade = async (plan: { id: string; name?: string; price?: string }) => {
    if (plan.id === 'free') {
      addToast('Redirecting to Google Play Store to manage your subscription.', 'info');
      setTimeout(() => {
        if (Capacitor.isNativePlatform()) {
          window.open('https://play.google.com/store/account/subscriptions', '_system');
        } else {
          window.open('https://play.google.com/store/account/subscriptions', '_blank');
        }
      }, 1000);
      return;
    }
    const productId = PLAN_PRODUCT_MAP[plan.id];
    if (!productId) return;

    AnalyticsService.trackSubscriptionFunnel('upgrade_intent', {
      plan_name: plan.name,
      plan_price: plan.price,
      current_tier: subscription?.tier || 'free',
    });

    setPurchaseError(null);
    setPurchaseLoading(productId);
    try {
      AnalyticsService.trackSubscriptionFunnel('payment_attempt', { plan_name: plan.name });
      const result = await purchaseProduct(productId);
      if (result.success) {
        AnalyticsService.trackSubscriptionFunnel('payment_success', { plan_name: plan.name });
        // Subscription update is written to Firestore by verifyPurchase CF;
        // useSubscription will pick it up automatically via the live listener.
      } else {
        setPurchaseError(result.error ?? 'Purchase failed. Please try again.');
        AnalyticsService.trackSubscriptionFunnel('payment_failed', {
          plan_name: plan.name,
          error: result.error,
        });
      }
    } finally {
      setPurchaseLoading(null);
    }
  };

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for getting started',
      features: [
        'Up to 10 saved recipes',
        '3 meal plan entries per week',
        '5 AI scans per week',
        '1 custom pantry category',
        'Grocery cost estimator (first 5 items)',
        'Current week meal plan view',
        'Invite 1 household member',
        'Community access'
      ],
      limitations: [
        'No monthly calendar view',
        'Limited grocery cost details',
        'Limited custom categories'
      ],
      popular: false
    },
    {
      id: 'premium',
      name: 'Premium',
      price: '$4.99',
      period: 'per month',
      description: 'Everything you need for meal planning',
      features: [
        'Up to 20 saved recipes',
        'Unlimited meal plan entries',
        '15 AI scans per week',
        'Unlimited custom categories',
        'Full grocery cost estimator',
        '7-day + monthly calendar view',
        'Up to 3 household members',
        'Priority support',
        'Offline access'
      ],
      limitations: [],
      popular: true
    },
    {
      id: 'family',
      name: 'Family',
      price: '$9.99',
      period: 'per month',
      description: 'Perfect for families and groups',
      features: [
        'Unlimited saved recipes',
        '2 weeks meal planning (unlimited entries)',
        'Unlimited AI scans',
        'Unlimited recipe searches',
        'Unlimited custom categories',
        'Full grocery cost estimator',
        'Monthly calendar view',
        'Up to 5 household members (you + 4 family)',
        'Shared shopping lists',
        'Family meal planning',
        'Advanced analytics',
        'Recipe sharing',
        'And more!'
      ],
      limitations: [],
      popular: false
    }
  ];

  const currentPlan = plans.find(p => p.id === subscription?.tier) || plans[0];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-3 mb-4">
          <Crown className="w-6 h-6 text-yellow-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Subscription</h2>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Current Plan</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {currentPlan.name}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {currentPlan.price}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {currentPlan.period}
            </p>
          </div>
        </div>

        {subscription?.status === 'trialing' && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-300 dark:border-green-700 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <Crown className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-green-800 dark:text-green-200">
                  🎉 Free Trial Active!
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Enjoy unlimited access to all premium features
                </p>
              </div>
            </div>
            <div className="bg-white/50 dark:bg-black/20 rounded p-2">
              <p className="text-xs text-green-800 dark:text-green-200">
                Trial ends soon! Keep your premium access by upgrading today.
              </p>
            </div>
          </div>
        )}

        {usageLimits && (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Current Usage</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Saved Recipes</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {usageLimits.recipes.used} / {usageLimits.recipes.max === -1 ? '∞' : usageLimits.recipes.max}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Weekly Searches</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {usageLimits.searches.used} / {usageLimits.searches.weekly === -1 ? '∞' : usageLimits.searches.weekly}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Weekly Meal Plans</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {usageLimits.mealPlanning.weeklyUsed} / {usageLimits.mealPlanning.weeklyRecipes === -1 ? '∞' : usageLimits.mealPlanning.weeklyRecipes}
                </span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => setShowPlans(!showPlans)}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
        >
          {isPremium ? 'Manage Subscription' : 'View Plans'}
        </button>
      </div>

      {showPlans && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Choose Your Plan
          </h3>

          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative bg-white dark:bg-gray-800 rounded-xl border-2 p-6 transition-all ${
                  plan.popular
                    ? 'border-blue-500 shadow-lg scale-105'
                    : 'border-gray-200 dark:border-gray-700'
                } ${subscription?.tier === plan.id ? 'ring-2 ring-green-500' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                {subscription?.tier === plan.id && (
                  <div className="absolute -top-3 right-4">
                    <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                      Current
                    </span>
                  </div>
                )}

                <div className="text-center mb-4">
                  <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                    {plan.name}
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                    {plan.description}
                  </p>
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">
                      {plan.price}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      /{plan.period}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {feature}
                      </span>
                    </div>
                  ))}
                  {plan.limitations.map((limitation, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span className="text-sm text-gray-500 dark:text-gray-500">
                        {limitation}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleUpgrade(plan)}
                  className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                    subscription?.tier === plan.id
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed'
                      : plan.id === 'free'
                      ? 'border border-blue-500 text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                      : 'bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-60'
                  }`}
                  disabled={
                    subscription?.tier === plan.id ||
                    purchaseLoading !== null ||
                    (plan.id !== 'free' && !Capacitor.isNativePlatform())
                  }
                >
                  {subscription?.tier === plan.id
                    ? 'Current Plan'
                    : plan.id === 'free'
                    ? 'Downgrade'
                    : purchaseLoading === PLAN_PRODUCT_MAP[plan.id]
                    ? 'Processing…'
                    : livePrices[PLAN_PRODUCT_MAP[plan.id]]
                    ? `Subscribe — ${livePrices[PLAN_PRODUCT_MAP[plan.id]]}/mo`
                    : 'Subscribe'}
                </button>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Need help choosing?
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              All plans include a 7-day free trial. Cancel anytime.
            </p>
            <div className="flex gap-2">
              <button className="text-blue-500 hover:text-blue-600 text-sm font-medium">
                Compare Plans
              </button>
              <button className="text-blue-500 hover:text-blue-600 text-sm font-medium">
                Contact Support
              </button>
            </div>
          </div>
        </div>
      )}

      {purchaseError && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-4">
          <p className="text-sm text-red-700 dark:text-red-300">{purchaseError}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={async () => {
            setPurchaseError(null);
            await restorePurchases();
          }}
          disabled={!Capacitor.isNativePlatform()}
          className="flex-1 text-sm text-blue-500 hover:text-blue-600 disabled:text-gray-400 font-medium py-2 border border-blue-200 dark:border-blue-700 disabled:border-gray-200 rounded-lg transition-colors"
        >
          Restore Purchases
        </button>
      </div>

      {!Capacitor.isNativePlatform() && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          In-app purchases are available on the Android app.
        </p>
      )}
    </div>
  );
};
