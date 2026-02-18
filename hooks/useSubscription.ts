import { useState, useEffect } from 'react';
import DatabaseMonitoringService from '../services/databaseMonitoringService';
import { User, Subscription } from '../types';
import { UsageService } from '../services/usageService';

export function useSubscription(user: User | null) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const unsubscribe = DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.doc('users', user.id), (doc) => {
      const data = doc.data();
      if (data?.subscription) {
        setSubscription(data.subscription);
      } else {
        // Default to premium tier for development/testing
        setSubscription({
          tier: 'premium',
          status: 'active',
          current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
          cancel_at_period_end: false
        });
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [user?.id]);

  const updateSubscription = async (updates: Partial<Subscription>) => {
    if (!user?.id) return;

    try {
      const newSubscription = { ...subscription, ...updates };
      await DatabaseMonitoringService.updateDoc(DatabaseMonitoringService.doc('users', user.id), {
        subscription: newSubscription
      });

      // Update usage limits if tier changed
      if (updates.tier && updates.tier !== subscription?.tier) {
        await UsageService.updatePlanLimits(user, updates.tier);
      }
    } catch (err: any) {
      console.error('Error updating subscription:', error);
      throw error;
    }
  };

  const isPremium = subscription?.tier === 'premium' || subscription?.tier === 'family';
  const isFamily = subscription?.tier === 'family';
  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing';

  return {
    subscription,
    loading,
    updateSubscription,
    isPremium,
    isFamily,
    isActive
  };
}
