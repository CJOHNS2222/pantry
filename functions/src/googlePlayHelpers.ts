/**
 * googlePlayHelpers.ts — shared Android Publisher API access for verifyPurchase
 * (client-triggered) and subscriptionNotifications (Play RTDN, server-triggered).
 */

import {google} from 'googleapis';
import {logger} from 'firebase-functions/v2';
import {Timestamp} from 'firebase-admin/firestore';
import type {Firestore} from 'firebase-admin/firestore';
import {PRODUCT_TIER_MAP} from './generated/productTierMap';

export const PACKAGE_NAME = 'com.smart.pantry';

export {PRODUCT_TIER_MAP};

// Cloud Functions gives this handler 60s total (verifyPurchase's configured timeout).
// The googleapis client has no default request timeout, so a hung auth-token mint or
// API call can silently eat the whole budget and get killed with no log/error at all —
// this bounds each call well under that so a hang surfaces as a normal caught error.
const GOOGLE_API_TIMEOUT_MS = 15_000;

export async function getAndroidPublisher() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  // auth.getClient() has no built-in timeout — a hung metadata-server/token-mint call
  // here silently eats the whole function timeout with no log or error (see
  // GOOGLE_API_TIMEOUT_MS above). Race it against a manual timeout so it surfaces.
  const authClient = await Promise.race([
    auth.getClient(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timed out getting Google Auth client')), GOOGLE_API_TIMEOUT_MS)
    ),
  ]);
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
  const {data} = await androidPublisher.purchases.subscriptions.get(
    {
      packageName: PACKAGE_NAME,
      subscriptionId: productId,
      token: purchaseToken,
    },
    {timeout: GOOGLE_API_TIMEOUT_MS}
  );

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

/** Shape of the `subscription` map on users/{uid}. All fields optional — the
 * whole point of the repair below is that real docs may be missing or have
 * contradictory combinations of these. */
export interface StoredSubscription {
  tier?: string;
  status?: string;
  cancel_at_period_end?: boolean;
  current_period_end?: FirebaseFirestore.Timestamp;
  product_id?: string;
  purchase_token?: string;
  updated_at?: FirebaseFirestore.Timestamp;
}

/**
 * True when a stored subscription map is internally contradictory.
 *
 * These states are not reachable from any single write — they accrete when
 * partial field-level updates land on top of an older doc (e.g. useAuth's
 * creation default `{tier:'free', status:'active'}` later stamped with
 * `cancel_at_period_end:true` by a downgrade that only wrote three fields).
 * Such a doc renders as a self-contradiction in the UI: a "free" plan that
 * simultaneously claims to be an active subscription cancelling at period end.
 */
export function isInconsistentSubscription(sub: StoredSubscription | undefined): boolean {
  if (!sub) return false;
  const {tier, cancel_at_period_end: cancelAtEnd, purchase_token: token} = sub;

  // NOTE: `tier:'free'` + `status:'cancelled'` + `cancel_at_period_end:false` is
  // a LEGITIMATE terminal state (a lapsed subscription, written by
  // checkExpiredSubscriptions.ts) — it must not be flagged, or the nightly job
  // and this repair would overwrite each other forever.

  // `cancel_at_period_end` means "a live subscription will not renew". It is
  // meaningless on the free tier, which has no period to cancel at.
  if (tier === 'free' && cancelAtEnd === true) return true;
  // A paid tier with no token on file can't be re-verified against Play and is
  // almost certainly a stale client-side write.
  if ((tier === 'premium' || tier === 'family') && !token) return true;

  return false;
}

/**
 * Repairs one user's `subscription` map, using Play as the source of truth.
 *
 * Play — never the local doc — decides the outcome, so this can neither revoke a
 * real subscriber nor grant access to someone who never paid:
 *  - Has a purchase_token → re-verify against Play and rewrite from that answer.
 *  - No token → the user never completed a verified purchase; normalize to a
 *    coherent free state (clearing the paid-lifecycle flags, not inventing one).
 *
 * Fails soft: a Play API error leaves the doc untouched rather than guessing.
 * Returns the repair outcome for logging; no-ops (returning 'ok') on any doc
 * that is already self-consistent, so it is safe to call on every read.
 */
export async function repairSubscriptionDoc(
  db: Firestore,
  uid: string
): Promise<'ok' | 'repaired' | 'skipped' | 'failed'> {
  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) return 'skipped';

  const sub = snap.data()?.subscription as StoredSubscription | undefined;
  if (!isInconsistentSubscription(sub)) return 'ok';

  const token = sub?.purchase_token;
  const productId = sub?.product_id;

  // No token (or no product id to verify it against) — nothing to ask Play about.
  // Normalize to a clean free state, preserving nothing that implies a purchase.
  if (!token || !productId) {
    await userRef.update({
      subscription: {
        tier: 'free',
        status: 'active',
        current_period_end: Timestamp.now(),
        cancel_at_period_end: false,
        updated_at: Timestamp.now(),
      },
    });
    await syncOwnerSubscriptionTier(db, uid, 'free').catch(() => undefined);
    logger.info('Repaired inconsistent subscription (no purchase token — reset to free)', {
      uid,
      previousTier: sub?.tier,
      previousStatus: sub?.status,
    });
    return 'repaired';
  }

  // Has a token — Play is authoritative. Never downgrade on an API failure.
  try {
    const {expiryMs, status} = await resolveSubscriptionState(productId, token);
    const tier = PRODUCT_TIER_MAP[productId];
    if (!tier) {
      logger.warn('Skipping subscription repair — product_id not in PRODUCT_TIER_MAP', {
        uid,
        productId,
      });
      return 'skipped';
    }

    // Play reporting a lapsed subscription is a legitimate downgrade to free.
    const expired = expiryMs < Date.now();
    const resolvedTier = expired ? 'free' : tier;

    await userRef.update({
      subscription: {
        tier: resolvedTier,
        status,
        current_period_end: Timestamp.fromMillis(expiryMs),
        // Guard on `expired` as well: a lapsed subscription has no pending
        // future cancellation, and writing `true` next to `tier:'free'` would
        // trip isInconsistentSubscription() and make this repair re-trigger
        // itself forever (one Play API call per iteration).
        cancel_at_period_end: !expired && status === 'cancelled',
        product_id: productId,
        purchase_token: token,
        updated_at: Timestamp.now(),
      },
    });
    await syncOwnerSubscriptionTier(db, uid, resolvedTier).catch(() => undefined);
    logger.info('Repaired inconsistent subscription from Play', {
      uid,
      previousTier: sub?.tier,
      previousStatus: sub?.status,
      resolvedTier,
      resolvedStatus: status,
    });
    return 'repaired';
  } catch (err: any) {
    // Leave the doc exactly as-is — a transient Play/API failure must never
    // cost a paying user their access.
    logger.error('Subscription repair failed — leaving doc unchanged', {
      uid,
      productId,
      message: err?.message,
    });
    return 'failed';
  }
}
