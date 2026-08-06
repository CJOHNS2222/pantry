import { describe, it, expect } from 'vitest';
import { isInconsistentSubscription } from '../../../functions/src/googlePlayHelpers';

/**
 * Convergence guard for the subscription self-repair.
 *
 * `repairSubscriptionDoc` rewrites any doc that `isInconsistentSubscription`
 * flags. Several other functions also write `users/{uid}.subscription`:
 *   - checkExpiredSubscriptions.ts (nightly, both branches)
 *   - subscriptionNotifications.ts `downgradeToFree` (per RTDN)
 *   - verifyPurchase.ts (per purchase)
 *
 * If ANY of those writes produces a doc the predicate flags, the repair rewrites
 * it, that writer re-dirties it, and the two loop forever — burning a paid Play
 * API call per iteration. Every write below must therefore be a FIXED POINT.
 *
 * These cases mirror the exact field combinations those functions write. If you
 * change a write site or the predicate, update both together.
 */
describe('isInconsistentSubscription — write-site fixed points', () => {
  it('accepts a lapsed subscription (checkExpiredSubscriptions, no-token branch)', () => {
    expect(isInconsistentSubscription({
      tier: 'free',
      status: 'cancelled',
      cancel_at_period_end: false,
    })).toBe(false);
  });

  it('accepts an RTDN downgrade (downgradeToFree)', () => {
    expect(isInconsistentSubscription({
      tier: 'free',
      status: 'cancelled',
      cancel_at_period_end: false,
    })).toBe(false);
  });

  it('accepts a fresh free account (useAuth creation default)', () => {
    expect(isInconsistentSubscription({
      tier: 'free',
      status: 'active',
      cancel_at_period_end: false,
    })).toBe(false);
  });

  it('accepts an active paid subscription with a token (verifyPurchase)', () => {
    expect(isInconsistentSubscription({
      tier: 'premium',
      status: 'active',
      cancel_at_period_end: false,
      product_id: 'premium_monthly',
      purchase_token: 'token-abc',
    })).toBe(false);
  });

  it('accepts a paid subscription cancelling at period end (still entitled)', () => {
    expect(isInconsistentSubscription({
      tier: 'premium',
      status: 'cancelled',
      cancel_at_period_end: true,
      product_id: 'premium_monthly',
      purchase_token: 'token-abc',
    })).toBe(false);
  });

  it('accepts the free state written by the repair itself (idempotent)', () => {
    expect(isInconsistentSubscription({
      tier: 'free',
      status: 'active',
      cancel_at_period_end: false,
    })).toBe(false);
  });
});

describe('isInconsistentSubscription — genuinely broken docs', () => {
  it('flags free tier carrying a pending cancellation', () => {
    // The real-world corruption: useAuth's `{tier:'free', status:'active'}`
    // default later stamped with cancel_at_period_end:true by a partial write.
    expect(isInconsistentSubscription({
      tier: 'free',
      status: 'active',
      cancel_at_period_end: true,
    })).toBe(true);
  });

  it('flags a paid tier with no purchase token to verify against', () => {
    expect(isInconsistentSubscription({
      tier: 'premium',
      status: 'active',
      cancel_at_period_end: false,
    })).toBe(true);
  });

  it('flags a family tier with no purchase token', () => {
    expect(isInconsistentSubscription({
      tier: 'family',
      status: 'active',
      cancel_at_period_end: false,
    })).toBe(true);
  });

  it('ignores a missing subscription map entirely', () => {
    expect(isInconsistentSubscription(undefined)).toBe(false);
  });
});
