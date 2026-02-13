import React, { useState, useEffect } from 'react';
import { Crown, Check, X, CreditCard, Users, ChefHat, Heart } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { User } from '../types';
import { StripeCheckout } from './StripeCheckout';
import { PayPalCheckout } from './PayPalCheckout';
import { UsageService, UsageLimits } from '../services/usageService';
import { log } from '../services/logService';
import AnalyticsService from '../services/analyticsService';

interface SubscriptionManagerProps {
  user: User | null;
}

interface SubscriptionManagerProps {
  user: User | null;
}

export const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ user }) => {
  const { subscription, isPremium, isFamily, isActive } = useSubscription(user);
  const [showPlans, setShowPlans] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'paypal'>('stripe');
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);

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
    
    // Track subscription funnel - viewing pricing
    AnalyticsService.trackSubscriptionFunnel('view_pricing', {
      current_tier: subscription?.tier || 'free',
      is_active: isActive
    });
  }, [user, subscription?.tier, isActive]);

  const handleUpgrade = (plan: any) => {
    // Track subscription funnel
    AnalyticsService.trackSubscriptionFunnel('upgrade_intent', {
      plan_name: plan.name,
      plan_price: plan.price,
      current_tier: subscription?.tier || 'free'
    });
    
    // Temporarily disabled until Stripe payments are fully functional
    alert('Premium subscriptions coming soon! We\'re working on implementing payment processing. Stay tuned for updates.');
    // setSelectedPlan(plan);
  };

  const handleCheckoutSuccess = (subscriptionId: string) => {
    alert(`Subscription created successfully! ID: ${subscriptionId}`);
    setSelectedPlan(null);
    setShowPlans(false);
    // In a real app, you'd refresh the subscription data here
  };

  const handleCheckoutCancel = () => {
    setSelectedPlan(null);
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
        '3 recipes per week meal planning',
        '5 recipe searches per week',
        '1 household member',
        'Community access'
      ],
      limitations: [
        'Limited recipe storage',
        'Limited searches',
        'Basic meal planning only'
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
        '7 days meal planning (unlimited entries)',
        '15 recipe searches per week',
        'Up to 3 household members',
        'Priority support',
        'Offline access',
        'Nutrition tracking'
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
        'Unlimited recipe searches',
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
          {isPremium ? 'Manage Subscription' : 'View Plans (Coming Soon)'}
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
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                  disabled={subscription?.tier === plan.id}
                >
                  {subscription?.tier === plan.id
                    ? 'Current Plan'
                    : plan.id === 'free'
                    ? 'Downgrade'
                    : 'Coming Soon'}
                </button>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Need help choosing?
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              All plans include a 14-day free trial. Cancel anytime.
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

      {selectedPlan && (
        <div className="mt-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Choose Payment Method
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setPaymentMethod('stripe')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  paymentMethod === 'stripe'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-6 h-6 text-blue-500" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900 dark:text-white">Credit Card</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Powered by Stripe</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setPaymentMethod('paypal')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  paymentMethod === 'paypal'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-blue-600 rounded text-white flex items-center justify-center font-bold text-sm">P</div>
                  <div className="text-left">
                    <div className="font-medium text-gray-900 dark:text-white">PayPal</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">PayPal Account</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {paymentMethod === 'stripe' ? (
            <StripeCheckout
              planId={selectedPlan.id}
              planName={selectedPlan.name}
              planPrice={selectedPlan.price}
              onSuccess={handleCheckoutSuccess}
              onCancel={handleCheckoutCancel}
            />
          ) : (
            <PayPalCheckout
              planId={selectedPlan.id}
              planName={selectedPlan.name}
              planPrice={selectedPlan.price}
              onSuccess={handleCheckoutSuccess}
              onCancel={handleCheckoutCancel}
            />
          )}
        </div>
      )}
    </div>
  );
};