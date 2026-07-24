/**
 * googlePlayHelpers.ts — shared Android Publisher API access for verifyPurchase
 * (client-triggered) and subscriptionNotifications (Play RTDN, server-triggered).
 */

import {google} from 'googleapis';

export const PACKAGE_NAME = 'com.smart.pantry';

export const PRODUCT_TIER_MAP: Record<string, 'premium' | 'family'> = {
  premium_monthly: 'premium',
  premium_yearly: 'premium',
  family_monthly: 'family',
  family_yearly: 'family',
};

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
