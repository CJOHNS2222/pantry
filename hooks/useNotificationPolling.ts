import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { User } from '../types';
import { NotificationService, NotificationItem, NotificationSettings } from '../services/notificationService';
import { log } from '../services/logService';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

function getPriorityWeight(priority: string): number {
  switch (priority) {
    case 'urgent': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}

/**
 * Polls for unread notifications every 5 minutes while a user is signed in and
 * surfaces the top 3 by priority/recency. Owns the `notifications` state so
 * dismiss/snooze/mark-read handlers elsewhere can mutate it via the returned setter.
 */
export function useNotificationPolling(user: User | null | undefined, notificationSettings: NotificationSettings) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!user?.id) return;

    const auth = getAuth();
    if (!auth.currentUser) return;

    const checkAndShowNotifications = async () => {
      try {
        const unreadNotifications = await NotificationService.getUnreadNotifications(user.id, user.email);
        const filteredNotifications = unreadNotifications.filter(notification =>
          NotificationService.shouldShowNotification(notification, notificationSettings)
        );

        if (filteredNotifications.length > 0) {
          // Sort by priority first (urgent > high > medium > low), then by newest
          const sorted = [...filteredNotifications].sort((a, b) => {
            const weightDiff = getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
            if (weightDiff !== 0) return weightDiff;

            const getTime = (val: unknown) => {
              if (!val) return 0;
              if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') return (val as { toDate: () => Date }).toDate().getTime();
              return new Date(val as string | number | Date).getTime();
            };

            const timeA = getTime(a.createdAt);
            const timeB = getTime(b.createdAt);
            return timeB - timeA;
          });

          // Show top 3 notifications
          setNotifications(sorted.slice(0, 3));
          localStorage.removeItem('lastNotificationShown'); // Clear legacy throttle
        } else {
          setNotifications([]);
        }
      } catch (error) {
        log.error('Error checking notifications', { error }, 'App');
      }
    };

    checkAndShowNotifications();
    const interval = setInterval(checkAndShowNotifications, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [user?.id, notificationSettings]);

  return { notifications, setNotifications };
}
