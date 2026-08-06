/**
 * subscriptionNotifications.ts — Firebase Cloud Function
 *
 * Handles Google Play Real-time Developer Notifications (RTDN) for subscriptions,
 * so renewals, cancellations, payment failures, and revocations update Firestore
 * immediately instead of waiting for the user to reopen the app.
 *
 * Without this, `verifyPurchase` only ever runs at purchase time — a lapsed or
 * canceled subscription stays `status: 'active'` in Firestore indefinitely (and
 * keeps its usage limits) until the user happens to trigger a re-verify.
 *
 * ── Setup required (one-time, in Google Cloud + Play Console) ──────────────────
 *  1. Cloud Console → Pub/Sub → create topic `play-store-notifications` in this
 *     project.
 *  2. Grant the Play publisher service account `google-play-developer-notifications@
 *     system.gserviceaccount.com` the "Pub/Sub Publisher" role on that topic.
 *  3. Play Console → Monetization setup → Real-time developer notifications →
 *     set topic name to `projects/{project-id}/topics/play-store-notifications`.
 *  4. Deploy this function (`firebase deploy --only functions`) — it subscribes
 *     to that topic automatically once deployed.
 * ────────────────────────────────────────────────────────────────────────────
 */

import {onMessagePublished} from 'firebase-functions/v2/pubsub';
import {logger} from 'firebase-functions/v2';
import {getApps, initializeApp} from 'firebase-admin/app';
import {getFirestore, Timestamp} from 'firebase-admin/firestore';
import {PACKAGE_NAME, PRODUCT_TIER_MAP, repairSubscriptionDoc, resolveSubscriptionState, syncOwnerSubscriptionTier} from './googlePlayHelpers';

if (!getApps().length) {
  initializeApp();
}

// https://developer.android.com/google/play/billing/rtdn-reference#sub
const enum NotificationType {
  SUBSCRIPTION_RECOVERED = 1,
  SUBSCRIPTION_RENEWED = 2,
  SUBSCRIPTION_CANCELED = 3,
  SUBSCRIPTION_PURCHASED = 4,
  SUBSCRIPTION_ON_HOLD = 5,
  SUBSCRIPTION_IN_GRACE_PERIOD = 6,
  SUBSCRIPTION_RESTARTED = 7,
  SUBSCRIPTION_PRICE_CHANGE_CONFIRMED = 8,
  SUBSCRIPTION_DEFERRED = 9,
  SUBSCRIPTION_PAUSED = 10,
  SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED = 11,
  SUBSCRIPTION_REVOKED = 12,
  SUBSCRIPTION_EXPIRED = 13,
}

// Terminal states where we downgrade to free immediately without re-verifying with
// Play — a revoked (refunded) or expired (lapsed, unrenewed) subscription has no
// access left to re-check.
const IMMEDIATE_DOWNGRADE_TYPES = new Set([
  NotificationType.SUBSCRIPTION_REVOKED,
  NotificationType.SUBSCRIPTION_EXPIRED,
]);

// Notification types worth acting on. PAUSE_SCHEDULE_CHANGED and
// PRICE_CHANGE_CONFIRMED don't change current access — log and skip.
const ACTIONABLE_TYPES = new Set([
  NotificationType.SUBSCRIPTION_RECOVERED,
  NotificationType.SUBSCRIPTION_RENEWED,
  NotificationType.SUBSCRIPTION_CANCELED,
  NotificationType.SUBSCRIPTION_PURCHASED,
  NotificationType.SUBSCRIPTION_ON_HOLD,
  NotificationType.SUBSCRIPTION_IN_GRACE_PERIOD,
  NotificationType.SUBSCRIPTION_RESTARTED,
  NotificationType.SUBSCRIPTION_DEFERRED,
  NotificationType.SUBSCRIPTION_PAUSED,
  NotificationType.SUBSCRIPTION_REVOKED,
  NotificationType.SUBSCRIPTION_EXPIRED,
]);

// Stop retrying a failed re-verify after this long — see catch block below.
const MAX_RETRY_AGE_MS = 24 * 60 * 60 * 1000;

interface PlayRtdnPayload {
  packageName?: string;
  eventTimeMillis?: string;
  subscriptionNotification?: {
    version: string;
    notificationType: number;
    purchaseToken: string;
    subscriptionId: string;
  };
  voidedPurchaseNotification?: {
    purchaseToken: string;
    orderId: string;
    productType: number;
    refundType: number;
  };
}

// productType 2 = subscription (1 = one-time product) — see
// https://developer.android.com/google/play/billing/rtdn-reference#voided-purchase
const VOIDED_SUBSCRIPTION_PRODUCT_TYPE = 2;

async function downgradeToFree(
  db: FirebaseFirestore.Firestore,
  uid: string,
  reason: string,
  logContext: Record<string, unknown>
): Promise<void> {
  const userRef = db.collection('users').doc(uid);
  // `cancel_at_period_end: false` — access is already revoked/expired, so there
  // is no future cancellation still pending. Writing `true` alongside
  // `tier:'free'` is self-contradictory and is exactly what
  // isInconsistentSubscription() flags, which made every downgrade look broken
  // to repairSubscriptionDoc() and caused a repair/re-dirty loop.
  await userRef.update({
    'subscription.tier': 'free',
    'subscription.status': 'cancelled',
    'subscription.cancel_at_period_end': false,
    'subscription.updated_at': Timestamp.now(),
  });
  logger.info(reason, {uid, ...logContext});
  await syncOwnerSubscriptionTier(db, uid, 'free').catch((err: any) =>
    logger.error('Failed to sync ownerSubscriptionTier', {uid, message: err.message})
  );
}

export const handlePlaySubscriptionNotification = onMessagePublished(
  // Explicit region to match every other function in this project (us-east1).
  {topic: 'play-store-notifications', region: 'us-east1', retry: true},
  async (event) => {
    let payload: PlayRtdnPayload;
    try {
      payload = event.data.message.json as PlayRtdnPayload;
    } catch (err: any) {
      logger.error('Failed to parse Play RTDN payload', {message: err.message});
      return;
    }

    // Reject notifications for a different app — RTDN topics are per-project, but
    // guard against a misconfigured/shared topic delivering another app's payload
    // and mutating our users' subscriptions.
    if (payload.packageName !== PACKAGE_NAME) {
      logger.warn('Ignoring Play RTDN with mismatched packageName', {
        packageName: payload.packageName,
      });
      return;
    }

    const voided = payload.voidedPurchaseNotification;
    if (voided) {
      // Refund/chargeback — Play voids the purchase outright regardless of the
      // subscription's own lifecycle state. Skip one-time-product voids (productType
      // 1); only subscription purchases (productType 2) affect subscription.tier.
      if (voided.productType !== VOIDED_SUBSCRIPTION_PRODUCT_TYPE) {
        logger.info('Ignoring voided-purchase notification for non-subscription product', {
          orderId: voided.orderId,
          productType: voided.productType,
        });
        return;
      }
      const db = getFirestore();
      const tokenRef = db.collection('purchaseTokens').doc(voided.purchaseToken);
      const tokenDoc = await tokenRef.get();
      if (!tokenDoc.exists) {
        logger.warn('No uid mapping for voided purchaseToken', {
          purchaseToken: voided.purchaseToken,
          orderId: voided.orderId,
        });
        return;
      }
      const {uid, superseded} = tokenDoc.data() as {uid: string; superseded?: boolean};
      if (superseded) {
        logger.info('Ignoring voided-purchase notification for already-superseded purchaseToken', {
          uid,
          purchaseToken: voided.purchaseToken,
        });
        return;
      }
      await downgradeToFree(db, uid, 'Subscription purchase voided (refund/chargeback) — downgraded', {
        purchaseToken: voided.purchaseToken,
        orderId: voided.orderId,
        refundType: voided.refundType,
      });
      return;
    }

    const notification = payload.subscriptionNotification;
    if (!notification) {
      // Play also sends testNotification / oneTimeProductNotification payloads —
      // nothing subscription-related to act on.
      logger.info('Ignoring non-subscription Play notification', {payload});
      return;
    }

    const {notificationType, purchaseToken, subscriptionId} = notification;
    if (!ACTIONABLE_TYPES.has(notificationType)) {
      logger.info('Ignoring non-actionable notification type', {notificationType});
      return;
    }
    if (typeof purchaseToken !== 'string' || purchaseToken.trim().length === 0) {
      logger.warn('Ignoring Play RTDN with missing/non-string purchaseToken', {
        notificationType,
        subscriptionId,
      });
      return;
    }

    const db = getFirestore();

    const tokenRef = db.collection('purchaseTokens').doc(purchaseToken);
    const tokenDoc = await tokenRef.get();
    if (!tokenDoc.exists) {
      logger.warn('No uid mapping for purchaseToken — was verifyPurchase ever called for it?', {
        purchaseToken,
        subscriptionId,
      });
      return;
    }
    const tokenData = tokenDoc.data() as {uid: string; superseded?: boolean};
    const {uid} = tokenData;
    if (tokenData.superseded) {
      // A plan-change already superseded this token (see the guard below) — any
      // further redelivery for it (Pub/Sub retry, late terminal EXPIRED/REVOKED
      // months later) is a stale no-op.
      logger.info('Ignoring Play RTDN for already-superseded purchaseToken', {
        uid,
        purchaseToken,
        notificationType,
      });
      return;
    }

    const userRef = db.collection('users').doc(uid);

    // Self-heal a contradictory subscription map before reading it. The plan-change
    // guard and the tier fallback below both trust `currentSub`, so a doc left
    // inconsistent by older partial writes would otherwise steer this handler with
    // stale values. No-ops on healthy docs; Play remains the source of truth.
    await repairSubscriptionDoc(db, uid).catch((err: any) =>
      logger.error('Subscription repair threw — continuing with stored doc', {
        uid,
        message: err?.message,
      })
    );

    const userSnap = await userRef.get();
    const currentSub = userSnap.data()?.subscription;

    // Plan-change guard: on an upgrade/downgrade/crossgrade Play issues a NEW
    // purchaseToken and fires RTDN events for both the old and new token with no
    // ordering guarantee. If the user's on-file token has already moved on to a
    // different (newer) token, this notification is about a now-superseded
    // predecessor purchase — never let it clobber the current state with a stale
    // cancelled/expired write (last-write-wins would silently downgrade an
    // actively-paying user). Mark the stale token superseded so future
    // redeliveries also no-op via the check above.
    if (currentSub?.purchase_token && currentSub.purchase_token !== purchaseToken) {
      await tokenRef.set({superseded: true}, {merge: true});
      logger.info('Ignoring Play RTDN — purchaseToken superseded by a newer purchase on file', {
        uid,
        purchaseToken,
        currentToken: currentSub.purchase_token,
        notificationType,
      });
      return;
    }
    // Derive tier from the product catalog rather than defaulting to 'premium' —
    // an unrecognized subscriptionId (typo'd product id, new product not yet added
    // to PRODUCT_TIER_MAP, etc.) must never silently grant premium access. Fall
    // back to whatever tier the user already has on file (e.g. a renewal
    // notification for an existing subscriber); if neither resolves, skip.
    const tier = PRODUCT_TIER_MAP[subscriptionId] ?? currentSub?.tier;

    if (!tier) {
      logger.warn('Ignoring Play RTDN — unknown subscriptionId with no existing tier on file', {
        uid,
        subscriptionId,
        notificationType,
      });
      return;
    }

    if (IMMEDIATE_DOWNGRADE_TYPES.has(notificationType)) {
      // Set tier to 'free' too (not just status) — access is genuinely gone (refund
      // or lapsed renewal), and usageService/household-inheritance sync both key off
      // the tier field changing, not status alone.
      await downgradeToFree(db, uid, 'Subscription revoked/expired — downgraded', {
        notificationType,
        purchaseToken,
      });
      return;
    }

    // Everything else: re-verify the real current state with Play rather than
    // trusting the notification type alone (Play's own recommendation — the
    // notification is just a "something changed" signal).
    try {
      const {expiryMs, status} = await resolveSubscriptionState(subscriptionId, purchaseToken);
      await userRef.update({
        subscription: {
          tier,
          status,
          current_period_end: Timestamp.fromMillis(expiryMs),
          cancel_at_period_end: status === 'cancelled',
          product_id: subscriptionId,
          purchase_token: purchaseToken,
          updated_at: Timestamp.now(),
        },
      });
      logger.info('Subscription state synced from Play RTDN', {
        uid,
        notificationType,
        status,
        expiryMs,
      });
      await syncOwnerSubscriptionTier(db, uid, tier).catch((err: any) =>
        logger.error('Failed to sync ownerSubscriptionTier', {uid, message: err.message})
      );
    } catch (err: any) {
      const ageMs = Date.now() - Number(payload.eventTimeMillis ?? 0);
      // Cap redelivery window ourselves — retry:true otherwise lets Pub/Sub hammer
      // the Play API for up to 7 days on a persistent failure (billed per attempt).
      // Past MAX_RETRY_AGE_MS this is almost certainly not going to self-resolve;
      // stop retrying and leave a loud log for manual follow-up (verify/refund by
      // hand) instead of burning a week of retries.
      if (ageMs > MAX_RETRY_AGE_MS) {
        logger.error('Giving up on Play RTDN re-verify after max retry age — needs manual follow-up', {
          uid,
          notificationType,
          purchaseToken,
          ageMs,
          message: err.message,
        });
        return;
      }
      logger.error('Failed to re-verify subscription after RTDN', {
        uid,
        notificationType,
        message: err.message,
      });
      // Rethrow so Pub/Sub redelivers (retry: true above) — this is almost always a
      // transient Play Developer API failure (rate limit, expired auth token, 5xx).
      // A malformed/unrecoverable payload never reaches this catch: notificationType,
      // purchaseToken, and subscriptionId are all validated earlier, and
      // resolveSubscriptionState's own not-found cases are handled internally rather
      // than thrown here — so anything landing in this catch is worth retrying.
      throw err;
    }
  }
);
