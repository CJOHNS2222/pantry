/**
 * checkExpiredSubscriptions.ts — Firebase Cloud Function
 *
 * Daily fallback safety net for `subscriptionNotifications.ts` (Play RTDN). RTDN
 * delivery isn't guaranteed (misconfigured topic, IAM drift, transient Pub/Sub
 * outage) — if a cancellation/expiry event is ever missed, a user's tier stays
 * granted in Firestore indefinitely. This walks `users` for anyone whose
 * subscription claims to still be active/trialing but whose `current_period_end`
 * has already passed, re-verifies with Play if a token is on file, and downgrades
 * otherwise. Closes the gap regardless of RTDN reliability (see FIXES.md F61).
 */

import {onSchedule} from 'firebase-functions/v2/scheduler';
import {logger} from 'firebase-functions/v2';
import {getApps, initializeApp} from 'firebase-admin/app';
import {getFirestore, Timestamp} from 'firebase-admin/firestore';
import {resolveSubscriptionState, syncOwnerSubscriptionTier} from './googlePlayHelpers';

if (!getApps().length) {
  initializeApp();
}

const PAGE_SIZE = 500;

async function performExpiredSubscriptionCheck(): Promise<void> {
  const db = getFirestore();
  logger.info('Starting daily expired-subscription check');

  let checkedCount = 0;
  let downgradedCount = 0;
  const errors: string[] = [];
  let lastDocId: string | undefined;

  for (;;) {
    let pageQuery = db
      .collection('users')
      .where('subscription.status', 'in', ['active', 'trialing'])
      .where('subscription.current_period_end', '<', Timestamp.now())
      .orderBy('subscription.current_period_end')
      .orderBy('__name__')
      .limit(PAGE_SIZE);
    if (lastDocId) {
      pageQuery = pageQuery.startAfter(lastDocId);
    }

    const pageSnapshot = await pageQuery.get();
    if (pageSnapshot.empty) break;

    for (const userDoc of pageSnapshot.docs) {
      const uid = userDoc.id;
      checkedCount++;
      try {
        const sub = userDoc.data().subscription as {
          product_id?: string;
          purchase_token?: string;
        } | undefined;

        if (sub?.product_id && sub?.purchase_token) {
          // Re-verify with Play rather than trusting Firestore alone — same
          // pattern as the RTDN re-verify branch in subscriptionNotifications.ts.
          const {expiryMs, status} = await resolveSubscriptionState(
            sub.product_id,
            sub.purchase_token
          );
          await userDoc.ref.update({
            'subscription.status': status,
            'subscription.current_period_end': Timestamp.fromMillis(expiryMs),
            'subscription.cancel_at_period_end': status === 'cancelled',
            'subscription.updated_at': Timestamp.now(),
          });
          if (status === 'cancelled' || status === 'past_due') {
            downgradedCount++;
          }
          logger.info('Re-synced stale subscription from Play', {uid, status, expiryMs});
        } else {
          // No token on file to re-verify against — access has genuinely lapsed.
          await userDoc.ref.update({
            'subscription.tier': 'free',
            'subscription.status': 'cancelled',
            'subscription.cancel_at_period_end': true,
            'subscription.updated_at': Timestamp.now(),
          });
          await syncOwnerSubscriptionTier(db, uid, 'free');
          downgradedCount++;
          logger.info('Downgraded stale subscription with no purchase token on file', {uid});
        }
      } catch (err: any) {
        const errorMsg = `Failed to re-check subscription for user ${uid}: ${err.message ?? err}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    lastDocId = pageSnapshot.docs[pageSnapshot.docs.length - 1].id;
    if (pageSnapshot.docs.length < PAGE_SIZE) break;
  }

  logger.info(
    `Expired-subscription check complete. Checked ${checkedCount}, downgraded ${downgradedCount}. Errors: ${errors.length}`
  );
  if (errors.length > 0) {
    logger.warn('Errors during expired-subscription check:', errors);
  }
}

export const checkExpiredSubscriptions = onSchedule(
  {
    schedule: '0 3 * * *', // Daily at 03:00 UTC
    timeZone: 'UTC',
    retryCount: 3,
    maxRetrySeconds: 60,
  },
  performExpiredSubscriptionCheck
);
