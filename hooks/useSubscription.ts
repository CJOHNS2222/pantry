import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import DatabaseMonitoringService from '../services/databaseMonitoringService';
import { User, Subscription } from '../types';
import { UsageService } from '../services/usageService';
import { log } from '../services/logService';

interface SubscriptionContextType {
  subscription: Subscription | null;
  loading: boolean;
  updateSubscription: (updates: Partial<Subscription>) => Promise<void>;
  isPremium: boolean;
  isFamily: boolean;
  isActive: boolean;
  effectiveTier: 'free' | 'premium' | 'family';
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

function useSubscriptionInternal(user: User | null, enabled: boolean) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  // Tier inherited from the household owner (non-null only when member is in a family household)
  const [householdOwnerTier, setHouseholdOwnerTier] = useState<'free' | 'premium' | 'family' | null>(null);
  // Track the last synced owner tier to avoid redundant Firestore writes
  const lastSyncedOwnerTier = useRef<string | null>(null);

  // ── Own subscription listener ──────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !user?.id) {
      if (!user?.id) {
        setLoading(false);
      }
      return;
    }

    const unsubscribe = DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.doc('users', user.id), (doc) => {
      const data = doc.data();
      if (data?.subscription) {
        setSubscription(data.subscription);
      } else {
        // Default to free tier for users without a stored subscription
        setSubscription({
          tier: 'free',
          status: 'active',
          current_period_end: new Date(),
          cancel_at_period_end: false
        });
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [user?.id, enabled]);

  // ── Household subscription listener ───────────────────────────────────────
  // Two responsibilities:
  //   1. If user is a non-admin member in a household whose owner has 'family', elevate.
  //   2. If user is the household admin, keep ownerSubscriptionTier in sync with their tier.
  useEffect(() => {
    const householdId = user?.householdId;
    if (!enabled || !householdId || !user?.id || !subscription) {
      setHouseholdOwnerTier(null);
      return;
    }

    const unsubscribe = DatabaseMonitoringService.onSnapshot(
      DatabaseMonitoringService.doc('households', householdId),
      (doc) => {
        if (!doc.exists()) {
          setHouseholdOwnerTier(null);
          return;
        }

        const data = doc.data();
        const members: Array<{ id: string; role: string }> = data.members || [];
        const currentMember = members.find(m => m.id === user.id);
        const isAdmin = currentMember?.role === 'admin';

        if (isAdmin) {
          // Owner: keep ownerSubscriptionTier on the household doc in sync with own tier
          const ownTier = subscription.tier ?? 'free';
          if (ownTier !== lastSyncedOwnerTier.current) {
            lastSyncedOwnerTier.current = ownTier;
            DatabaseMonitoringService.updateDoc(
              DatabaseMonitoringService.doc('households', householdId),
              { ownerSubscriptionTier: ownTier }
            ).catch((err: any) =>
              log.error('Failed to sync ownerSubscriptionTier', { error: err?.message }, 'useSubscription')
            );
          }
          // Admin always uses their own subscription — no elevation needed
          setHouseholdOwnerTier(null);
        } else {
          // Non-admin member: inherit the owner's tier (premium or family) if it beats their own
          const ownerTier = data.ownerSubscriptionTier as 'free' | 'premium' | 'family' | undefined;
          const elevated = (ownerTier === 'family' || ownerTier === 'premium') ? ownerTier : null;
          setHouseholdOwnerTier(elevated);
        }
      },
      (err: any) => {
        // Access denied (e.g. removed from household) — clear elevation
        log.debug('Household listener error (access likely revoked)', { error: err?.message }, 'useSubscription');
        setHouseholdOwnerTier(null);
      }
    );

    return unsubscribe;
  }, [user?.id, user?.householdId, enabled, subscription]);

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
      log.error('Error updating subscription:', { error: err?.message }, 'useSubscription');
      throw err;
    }
  };

  // Effective tier: own tier, elevated to 'family' if in a family household as non-admin
  const effectiveTier = householdOwnerTier ?? subscription?.tier ?? 'free';
  const isPremium = effectiveTier === 'premium' || effectiveTier === 'family';
  const isFamily = effectiveTier === 'family';
  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing' || householdOwnerTier === 'family';

  return {
    subscription,
    loading,
    updateSubscription,
    isPremium,
    isFamily,
    isActive,
    effectiveTier,
  };
}

export const SubscriptionProvider: React.FC<{ user: User | null; children: React.ReactNode }> = ({ user, children }) => {
  const value = useSubscriptionInternal(user, true);
  return React.createElement(SubscriptionContext.Provider, { value }, children);
};

export function useSubscription(user: User | null = null) {
  const context = useContext(SubscriptionContext);

  // Call the internal hook, but disable the listeners if context is present
  const localVal = useSubscriptionInternal(user, !context);

  if (context) {
    return context;
  }
  return localVal;
}

