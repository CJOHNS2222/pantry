import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions/v2';
import admin from 'firebase-admin';

if (!admin.apps?.length) {
  admin.initializeApp();
}

const db = getFirestore();

type Priority = 'low' | 'medium' | 'high' | 'urgent';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  priority: Priority;
  type: string;
  actionData?: Record<string, unknown>;
  read?: boolean;
}

/**
 * Firestore-triggered Cloud Function.
 * Fires when the per-user notification cache document is written.
 * Detects new high/urgent/medium-priority notifications and delivers
 * a real FCM push notification to every device token the user has registered.
 */
export const sendPushNotificationOnWrite = onDocumentWritten(
  'users/{userId}/cache/notifications',
  async (event) => {
    const userId = event.params.userId;

    const beforeData = event.data?.before?.data() as { items?: NotificationItem[] } | undefined;
    const afterData = event.data?.after?.data() as { items?: NotificationItem[] } | undefined;

    if (!afterData?.items) {
      logger.info(`[sendPushNotification] No items in after-snapshot for user ${userId}`);
      return;
    }

    const beforeIds = new Set<string>((beforeData?.items ?? []).map((n) => n.id));
    const newNotifications = afterData.items.filter((n) => !beforeIds.has(n.id));

    if (newNotifications.length === 0) {
      return;
    }

    // Filter to actionable priorities only (skip 'low' — these are in-app only)
    const pushCandidates = newNotifications.filter(
      (n) => n.priority === 'urgent' || n.priority === 'high' || n.priority === 'medium'
    );

    if (pushCandidates.length === 0) {
      logger.info(`[sendPushNotification] New notifications for ${userId} are all low-priority, skipping push.`);
      return;
    }

    // Fetch FCM tokens from the user document
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      logger.warn(`[sendPushNotification] User document not found for ${userId}`);
      return;
    }

    const userData = userDoc.data();
    const fcmTokens: string[] = Array.isArray(userData?.fcmTokens) ? (userData?.fcmTokens as string[]) : [];

    if (fcmTokens.length === 0) {
      logger.info(`[sendPushNotification] No FCM tokens for user ${userId} — cannot send push.`);
      return;
    }

    // Pick the single most important notification to push
    const priorityOrder: Priority[] = ['urgent', 'high', 'medium'];
    let topNotification: NotificationItem | undefined;
    for (const p of priorityOrder) {
      topNotification = pushCandidates.find((n) => n.priority === p);
      if (topNotification) break;
    }

    if (!topNotification) return;
    const notification = topNotification; // narrowed — guaranteed non-null past this point

    const messaging = getMessaging();
    const staleTokens: string[] = [];

    // Send to each registered device token
    await Promise.all(
      fcmTokens.map(async (token) => {
        try {
          await messaging.send({
            token,
            notification: {
              title: notification.title,
              body: notification.message,
            },
            android: {
              priority: notification.priority === 'urgent' ? 'high' : 'normal',
              notification: {
                sound: 'default',
                channelId: 'pantry_notifications',
              },
            },
            apns: {
              payload: {
                aps: {
                  sound: 'default',
                  badge: 1,
                },
              },
            },
            data: {
              notificationId: notification.id,
              type: notification.type,
              priority: notification.priority,
            },
          });
          logger.info(`[sendPushNotification] Sent push to token for user ${userId}`);
        } catch (err: unknown) {
          const code = (err as { code?: string })?.code;
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            staleTokens.push(token);
            logger.warn(`[sendPushNotification] Stale token removed for user ${userId}`);
          } else {
            logger.error(`[sendPushNotification] Failed to send push for user ${userId}:`, err);
          }
        }
      })
    );

    // Clean up stale tokens
    if (staleTokens.length > 0) {
      const remaining = fcmTokens.filter((t) => !staleTokens.includes(t));
      await db.collection('users').doc(userId).update({ fcmTokens: remaining });
    }
  }
);
