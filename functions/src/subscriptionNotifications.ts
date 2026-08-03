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
import {PACKAGE_NAME, PRODUCT_TIER_MAP, resolveSubscriptionState} from './googlePlayHelpers';

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

interface PlayRtdnPayload {
  packageName?: string;
  eventTimeMillis?: string;
  subscriptionNotification?: {
    version: string;
    notificationType: number;
    purchaseToken: string;
    subscriptionId: string;
  };
}

export const handlePlaySubscriptionNotification = onMessagePublished(
  // Explicit region to match every other function in this project (us-central1).
  // It first deployed to us-east1 without this set — next deploy will delete that
  // stray us-east1 instance and recreate it here (safe: stateless webhook, no data).
  {topic: 'play-store-notifications', region: 'us-central1'},
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

    const tokenDoc = await db.collection('purchaseTokens').doc(purchaseToken).get();
    if (!tokenDoc.exists) {
      logger.warn('No uid mapping for purchaseToken — was verifyPurchase ever called for it?', {
        purchaseToken,
        subscriptionId,
      });
      return;
    }
    const {uid} = tokenDoc.data() as {uid: string};

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const currentSub = userSnap.data()?.subscription;
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
      await userRef.update({
        'subscription.tier': 'free',
        'subscription.status': 'cancelled',
        'subscription.cancel_at_period_end': true,
        'subscription.updated_at': Timestamp.now(),
      });
      logger.info('Subscription revoked/expired — downgraded', {
        uid,
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
    } catch (err: any) {
      logger.error('Failed to re-verify subscription after RTDN', {
        uid,
        notificationType,
        message: err.message,
      });
    }
  }
);
