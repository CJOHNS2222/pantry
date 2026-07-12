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

const TIER_ORDER: Record<string, number> = {
  free: 0,
  premium: 1,
  family: 2,
};

const getPlanProductId = (planId: string, period: 'monthly' | 'yearly'): ProductId | null => {
  if (planId === 'premium') {
    return period === 'monthly' ? PRODUCT_IDS.PREMIUM_MONTHLY : PRODUCT_IDS.PREMIUM_YEARLY;
  }
  if (planId === 'family') {
    return period === 'monthly' ? PRODUCT_IDS.FAMILY_MONTHLY : PRODUCT_IDS.FAMILY_YEARLY;
  }
  return null;
};

export const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ user }) => {
  const { subscription, isPremium, isActive, updateSubscription } = useSubscription(user);
  const { addToast } = useAppActions();
  const [showPlans, setShowPlans] = useState(false);
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [livePrices, setLivePrices] = useState<Record<string, string>>({});
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);

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
            [PRODUCT_IDS.PREMIUM_YEARLY]: getProductPrice(PRODUCT_IDS.PREMIUM_YEARLY) ?? '',
            [PRODUCT_IDS.FAMILY_MONTHLY]: getProductPrice(PRODUCT_IDS.FAMILY_MONTHLY) ?? '',
            [PRODUCT_IDS.FAMILY_YEARLY]: getProductPrice(PRODUCT_IDS.FAMILY_YEARLY) ?? '',
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
    const planTierIndex = TIER_ORDER[plan.id] || 0;
    const currentTierIndex = TIER_ORDER[subscription?.tier || 'free'] || 0;

    // Any downgrade (including to the Free plan or to a lower paid tier)
    // is redirected to Google Play Store subscriptions settings for safety.
    if (planTierIndex < currentTierIndex) {
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

    const productId = getPlanProductId(plan.id, billingPeriod);
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
        
        // Optimistic UI update: instantly update the user's Firestore subscription document
        // so all listeners and settings page panels refresh in 0ms without waiting.
        const tier = plan.id as 'premium' | 'family';
        await updateSubscription({
          tier,
          status: 'active',
          product_id: productId,
          cancel_at_period_end: false,
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // fallback 30 days
        }).catch((err: unknown) => {
          log.error('Optimistic subscription update failed', { error: err instanceof Error ? err.message : String(err) }, 'SubscriptionManager');
        });

        addToast(`Success! You have upgraded to the ${plan.name} plan.`, 'success');
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
      price: billingPeriod === 'monthly' ? '$4.99' : '$29.99',
      period: billingPeriod === 'monthly' ? 'per month' : 'per year',
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
      price: billingPeriod === 'monthly' ? '$9.99' : '$59.99',
      period: billingPeriod === 'monthly' ? 'per month' : 'per year',
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
              {currentPlan.name} {subscription?.product_id?.includes('yearly') ? '(Annual)' : subscription?.product_id?.includes('monthly') ? '(Monthly)' : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {subscription?.product_id
                ? (livePrices[subscription.product_id] || (subscription.product_id.includes('yearly') ? (subscription.product_id.includes('premium') ? '$29.99' : '$59.99') : (subscription.product_id.includes('premium') ? '$4.99' : '$9.99')))
                : (subscription?.tier === 'family' ? '$9.99' : subscription?.tier === 'premium' ? '$4.99' : '$0')}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {subscription?.product_id
                ? (subscription.product_id.includes('yearly') ? 'per year' : 'per month')
                : (subscription?.tier === 'premium' || subscription?.tier === 'family' ? 'per month' : 'forever')}
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Choose Your Plan
          </h3>

          {/* Billing Period Toggle */}
          <div className="flex justify-center mb-6">
            <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg inline-flex items-center gap-1 border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  billingPeriod === 'monthly'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('yearly')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                  billingPeriod === 'yearly'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Yearly
                <span className="bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  Save ~50%
                </span>
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const targetProductId = getPlanProductId(plan.id, billingPeriod);
              const isCurrentProduct = targetProductId 
                ? subscription?.product_id === targetProductId
                : subscription?.tier === plan.id;

              const planTierIndex = TIER_ORDER[plan.id] || 0;
              const currentTierIndex = TIER_ORDER[subscription?.tier || 'free'] || 0;
              const isDowngrade = planTierIndex < currentTierIndex;

              return (
                <div
                  key={plan.id}
                  className={`relative bg-white dark:bg-gray-800 rounded-xl border-2 p-6 transition-all ${
                    plan.popular
                      ? 'border-blue-500 shadow-lg scale-105'
                      : 'border-gray-200 dark:border-gray-700'
                  } ${isCurrentProduct ? 'ring-2 ring-green-500' : ''}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                        Most Popular
                      </span>
                    </div>
                  )}

                  {isCurrentProduct && (
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
                      isCurrentProduct
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed'
                        : isDowngrade
                        ? 'border border-blue-500 text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                        : 'bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-60'
                    }`}
                    disabled={
                      isCurrentProduct ||
                      purchaseLoading !== null ||
                      (!isDowngrade && plan.id !== 'free' && !Capacitor.isNativePlatform())
                    }
                  >
                    {isCurrentProduct
                      ? 'Current Plan'
                      : isDowngrade
                      ? 'Downgrade'
                      : purchaseLoading === targetProductId
                      ? 'Processing…'
                      : targetProductId && livePrices[targetProductId]
                      ? `Subscribe — ${livePrices[targetProductId]}/${billingPeriod === 'monthly' ? 'mo' : 'yr'}`
                      : 'Subscribe'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Need help choosing?
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              All plans include a 7-day free trial. Cancel anytime.
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsCompareOpen(true)}
                className="text-blue-500 hover:text-blue-600 text-sm font-medium"
              >
                Compare Plans
              </button>
              <button 
                onClick={() => setIsContactOpen(true)}
                className="text-blue-500 hover:text-blue-600 text-sm font-medium"
              >
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
          className="flex-1 text-sm text-blue-500 hover:text-blue-600 disabled:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed font-medium py-2 border border-blue-200 dark:border-blue-700 disabled:border-gray-200 rounded-lg transition-colors"
        >
          Restore Purchases
        </button>
      </div>

      {!Capacitor.isNativePlatform() && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          In-app purchases are available on the Android app.
        </p>
      )}

      <PlanComparisonModal 
        isOpen={isCompareOpen} 
        onClose={() => setIsCompareOpen(false)} 
        billingPeriod={billingPeriod} 
      />

      <ContactUsModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
        user={user}
      />
    </div>
  );
};

interface PlanComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  billingPeriod: 'monthly' | 'yearly';
}

const PlanComparisonModal: React.FC<PlanComparisonModalProps> = ({ isOpen, onClose, billingPeriod }) => {
  if (!isOpen) return null;

  const rows = [
    { feature: 'Price', free: '$0', premium: billingPeriod === 'monthly' ? '$4.99/mo' : '$29.99/yr', family: billingPeriod === 'monthly' ? '$9.99/mo' : '$59.99/yr' },
    { feature: 'Saved Recipes', free: '10 recipes', premium: '20 recipes', family: 'Unlimited' },
    { feature: 'Meal Planning', free: '3 entries / wk', premium: 'Unlimited (7-day)', family: 'Unlimited (2-week)' },
    { feature: 'AI Pantry Scans', free: '5 scans / wk', premium: '15 scans / wk', family: 'Unlimited' },
    { feature: 'Custom Categories', free: '1 category', premium: 'Unlimited', family: 'Unlimited' },
    { feature: 'Cost Estimation', free: 'First 5 items', premium: 'Full details', family: 'Full details' },
    { feature: 'Household Members', free: 'You + 1 member', premium: 'You + 3 members', family: 'You + 5 members' },
    { feature: 'Shared Lists & Sync', free: '❌', premium: '✅', family: '✅' },
    { feature: 'Support Level', free: 'Standard', premium: 'Priority', family: '24/7 Priority' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Compare Subscription Plans</h3>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                    <th className="p-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Feature</th>
                    <th className="p-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Free</th>
                    <th className="p-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center text-blue-600 dark:text-blue-400">Premium</th>
                    <th className="p-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center text-purple-600 dark:text-purple-400">Family</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                      <td className="p-3 text-sm font-medium text-gray-900 dark:text-gray-100">{row.feature}</td>
                      <td className="p-3 text-sm text-gray-600 dark:text-gray-400 text-center">{row.free}</td>
                      <td className="p-3 text-sm text-gray-900 dark:text-white font-medium text-center">{row.premium}</td>
                      <td className="p-3 text-sm text-gray-900 dark:text-white font-medium text-center">{row.family}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg text-sm transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

interface ContactUsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

const ContactUsModal: React.FC<ContactUsModalProps> = ({ isOpen, onClose, user }) => {
  const { addToast } = useAppActions();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(user?.name || '');
      setEmail(user?.email || '');
      setMessage('');
      setSuccess(false);
      setSending(false);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    try {
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: 'service_ekbmsjj',
          template_id: 'template_ek5lu2r',
          user_id: 'u_wtW48BWFmZnstig',
          template_params: {
            from_name: name,
            from_email: email,
            message: message,
            to_email: 'chrisj221986@gmail.com, cjohns22@duck.com'
          }
        }),
      });

      if (response.ok) {
        setSuccess(true);
        addToast('Message sent successfully!', 'success');
      } else {
        const errText = await response.text();
        throw new Error(errText || 'Failed to send message');
      }
    } catch (error: unknown) {
      log.error('Failed to send contact email via EmailJS API', { error: error instanceof Error ? error.message : String(error) }, 'ContactUsModal');
      addToast('Failed to send message. Please email us at smartpantry40@gmail.com', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Contact Support</h3>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-200 dark:border-green-800">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Message Sent!</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Thank you for reaching out. The Stock & Spoon team will get back to you shortly.
              </p>
              <button
                onClick={onClose}
                className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg text-sm transition-colors shadow-sm"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Your Name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="name@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                  Message
                </label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                  placeholder="Describe your issue or request..."
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg text-sm transition-colors shadow-sm disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
