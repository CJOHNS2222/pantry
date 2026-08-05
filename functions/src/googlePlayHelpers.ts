/**
 * googlePlayHelpers.ts — shared Android Publisher API access for verifyPurchase
 * (client-triggered) and subscriptionNotifications (Play RTDN, server-triggered).
 */

import {google} from 'googleapis';
import type {Firestore} from 'firebase-admin/firestore';
import {PRODUCT_TIER_MAP} from './generated/productTierMap';

export const PACKAGE_NAME = 'com.smart.pantry';

export {PRODUCT_TIER_MAP};

export async function getAndroidPublisher() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const authClient = await auth.getClient();
  return google.androidpublisher({version: 'v3', auth: authClient as any});
}

export interface ResolvedSubscriptionState {
  expiryMs: number;
  status: 'active' | 'trialing' | 'cancelled' | 'past_due';
}

/** Fetch current subscription state from Play and reduce it to our internal status model. */
export async function resolveSubscriptionState(
  productId: string,
  purchaseToken: string
): Promise<ResolvedSubscriptionState> {
  const androidPublisher = await getAndroidPublisher();
  const {data} = await androidPublisher.purchases.subscriptions.get({
    packageName: PACKAGE_NAME,
    subscriptionId: productId,
    token: purchaseToken,
  });

  const expiryMs = parseInt(data.expiryTimeMillis ?? '0', 10);

  // paymentState: 0=pending, 1=received, 2=free trial, 3=deferred
  const paymentState = data.paymentState ?? 1;
  const isTrial = paymentState === 2;
  const isCancelled = data.cancelReason !== undefined && data.cancelReason !== null;
  // A grace-period/on-hold purchase (payment failed, Play still retrying) still reports
  // paymentState 0 with expiryTimeMillis in the future — treat as past_due so limits
  // clamp to free tier immediately rather than waiting for hard expiry.
  const isPastDue = paymentState === 0 || expiryMs < Date.now();

  const status: ResolvedSubscriptionState['status'] = isPastDue ?
    'past_due' :
    isCancelled ?
      'cancelled' :
      isTrial ?
        'trialing' :
        'active';

  return {expiryMs, status};
}

/**
 * Pushes a verified subscription tier onto households/{id}.ownerSubscriptionTier —
 * the field household members' premium/family access is derived from
 * (hooks/useSubscription.ts, services/usageService.ts). firestore.rules locks this
 * field to Admin-SDK-only writes (mirrors users/{uid}.subscription), so this is the
 * only legitimate place it gets set. No-op if the uid isn't a household owner, or
 * the tier is already in sync.
 */
export async function syncOwnerSubscriptionTier(
  db: Firestore,
  uid: string,
  tier: string
): Promise<void> {
  const userSnap = await db.collection('users').doc(uid).get();
  const householdId = userSnap.data()?.householdId;
  if (!householdId) return;

  const householdRef = db.collection('households').doc(householdId);
  const householdSnap = await householdRef.get();
  if (!householdSnap.exists) return;

  const household = householdSnap.data();
  if (household?.ownerId !== uid) return; // only the owner's tier is authoritative
  if (household.ownerSubscriptionTier === tier) return;

  await householdRef.update({ownerSubscriptionTier: tier});
}
