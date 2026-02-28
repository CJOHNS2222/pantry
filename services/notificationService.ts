/**
 * Notification Service
 * Manages contextual notifications, timing, and user preferences
 */

import DatabaseMonitoringService from './databaseMonitoringService';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { User } from '../types';
import { pushNotificationService } from './pushNotificationService';
import { appendNotificationToUser, getNotificationsOnce, markNotificationRead, snoozeNotificationInCache } from './notificationsService';
import { formatDangerSummary, DangerItem } from './notificationHelpers';

export interface NotificationItem {
  id: string;
  userId: string;
  type: 'expiration' | 'recipe_suggestion' | 'household_activity' | 'shopping_reminder' | 'system' | 'allergy_alert' | 'household_invite';
  title: string;
  message: string;
  actionLabel?: string;
  actionType?: 'add_to_shopping' | 'view_recipe' | 'view_item' | 'dismiss' | 'join_household';
  actionData?: any;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  read: boolean;
  createdAt: Timestamp;
  expiresAt?: Timestamp;
  snoozedUntil?: Timestamp;
}

export interface NotificationSettings {
  enabled: boolean;
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string;   // HH:MM format
  };
  types: {
    expiration: 'never' | 'urgent' | 'day_before' | 'week_before';
    recipe_suggestion: boolean;
    household_activity: boolean;
    shopping_reminder: boolean;
    system: boolean;
    allergy_alert: boolean;
    household_invite: boolean;
  };
}

export class NotificationService {
  private static readonly COLLECTION = 'notifications';

  /**
   * Create a contextual notification
   */
  static async createNotification(
    userId: string,
    notification: Omit<NotificationItem, 'id' | 'userId' | 'read' | 'createdAt'>
  ): Promise<string> {
    // Use per-user cached notifications to reduce reads/writes
    const id = crypto.randomUUID();
    const item: any = {
      id,
      userId,
      read: false,
      // Use client-side ISO timestamp for cached array entries (serverTimestamp
      // is not supported inside arrays).
      createdAt: new Date().toISOString(),
      ...notification
    };

    try {
      await appendNotificationToUser(userId, item as any);
    } catch (err) {
      console.error('Failed to append notification to user cache:', err);
      // fallback to writing to collection if cache fails
      const docRef = await DatabaseMonitoringService.addDoc(DatabaseMonitoringService.collection(this.COLLECTION), {
        userId,
        read: false,
        createdAt: serverTimestamp(),
        ...notification
      });
      return docRef.id;
    }

    // Send push notification for urgent notifications only (expired items)
    if (notification.priority === 'urgent') {
      try {
        await this.sendPushNotification(userId, notification);
      } catch (err: any) {
        console.error('Failed to send push notification:', err);
      }
    }

    return id;
  }

  /**
   * Create an aggregated Danger Zone notification for multiple high-risk items
   */
  static async createDangerZoneAlert(userId: string, items: DangerItem[]) {
    if (!items || items.length === 0) return ''
    const { title, message, priority } = formatDangerSummary(items)

    const actionData = { items: items.map(i => ({ itemId: i.itemId, itemName: i.itemName })) }

    return this.createNotification(userId, {
      type: 'expiration',
      title,
      message,
      actionLabel: 'View Items',
      actionType: 'view_item',
      actionData,
      priority: priority,
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))
    })
  }

  /**
   * Create expiration alert notification
   */
  static async createExpirationAlert(
    userId: string,
    itemName: string,
    daysUntilExpiry: number,
    itemId: string,
    userRiskLevel?: number
  ): Promise<string> {
    // Check if notification already exists for this item
    const existingNotifications = await this.getUnreadNotifications(userId);
    const existingNotification = existingNotifications.find(n =>
      n.type === 'expiration' &&
      n.actionData?.itemId === itemId &&
      !n.read
    );

    if (existingNotification) {
      // Update existing notification if priority changed or days changed
      const currentPriority = existingNotification.priority;
      const newPriority = daysUntilExpiry <= 0 ? 'urgent' :
                         daysUntilExpiry === 1 ? 'high' :
                         daysUntilExpiry <= 3 ? 'medium' : 'low';

      if (currentPriority !== newPriority) {
        await DatabaseMonitoringService.updateDoc(DatabaseMonitoringService.doc(this.COLLECTION + '/' + existingNotification.id), {
          priority: newPriority,
          title: daysUntilExpiry <= 0 ? 'Item Expired!' :
                 daysUntilExpiry === 1 ? 'Expires Tomorrow!' :
                 daysUntilExpiry <= 3 ? 'Expires Soon' : 'Expires This Week',
          message: daysUntilExpiry <= 0 ? `${itemName} has expired and was moved to shopping list` :
                  `${itemName} expires in ${daysUntilExpiry} days`
        });
      }
      return existingNotification.id;
    }

    let priority: 'low' | 'medium' | 'high' | 'urgent' = 'low';
    let title = '';
    let message = '';
    let actionLabel = '';

    if (daysUntilExpiry <= 0) {
      priority = 'urgent';
      title = 'Item Expired!';
      message = `${itemName} has expired and was moved to shopping list`;
      actionLabel = 'View Shopping List';
    } else if (daysUntilExpiry === 1) {
      priority = 'high';
      title = 'Expires Tomorrow!';
      message = `${itemName} expires tomorrow`;
      actionLabel = 'Add to Shopping List';
    } else if (daysUntilExpiry <= 3) {
      priority = 'medium';
      title = 'Expires Soon';
      message = `${itemName} expires in ${daysUntilExpiry} days`;
      actionLabel = 'Add to Shopping List';
    } else if (daysUntilExpiry <= 7) {
      priority = 'low';
      title = 'Expires This Week';
      message = `${itemName} expires in ${daysUntilExpiry} days`;
      actionLabel = 'View Item';
    }

    // Adjust priority for high-risk users (userRiskLevel >=4)
    if (userRiskLevel && userRiskLevel >= 4) {
      // bump priority one level for items within 3 days
      if (daysUntilExpiry <= 3) {
        if (priority === 'low') priority = 'medium'
        else if (priority === 'medium') priority = 'high'
        else if (priority === 'high') priority = 'urgent'
      }
    }

    return this.createNotification(userId, {
      type: 'expiration',
      title,
      message,
      actionLabel,
      actionType: daysUntilExpiry <= 1 ? 'add_to_shopping' : 'view_item',
      actionData: { itemId, itemName },
      priority,
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) // Expire in 7 days
    });
  }

  /**
   * Create allergy alert notification for inventory items
   */
  static async createAllergyAlert(
    userId: string,
    itemName: string,
    memberName: string,
    allergens: string[],
    itemId: string
  ): Promise<string> {
    const title = 'Allergy Alert!';
    const message = `${itemName} in your pantry may contain allergens for ${memberName}: ${allergens.join(', ')}`;
    const actionLabel = 'View Item';

    return this.createNotification(userId, {
      type: 'allergy_alert',
      title,
      message,
      actionLabel,
      actionType: 'view_item',
      actionData: { itemId, itemName, memberName, allergens },
      priority: 'high', // High priority for safety
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) // Expire in 30 days
    });
  }

  /**
   * Create recipe suggestion notification
   */
  static async createRecipeSuggestion(
    userId: string,
    recipeTitle: string,
    reason: string,
    recipeId: string
  ): Promise<string> {
    return this.createNotification(userId, {
      type: 'recipe_suggestion',
      title: 'Recipe Suggestion',
      message: `Try "${recipeTitle}" - ${reason}`,
      actionLabel: 'View Recipe',
      actionType: 'view_recipe',
      actionData: { recipeId },
      priority: 'low'
    });
  }

  /**
   * Create household activity notification
   */
  static async createHouseholdActivity(
    userId: string,
    activityMessage: string,
    actionData?: any
  ): Promise<string> {
    return this.createNotification(userId, {
      type: 'household_activity',
      title: 'Household Activity',
      message: activityMessage,
      priority: 'low',
      actionData
    });
  }

  /**
   * Create shopping reminder notification
   */
  static async createShoppingReminder(
    userId: string,
    itemCount: number,
    urgentItems: string[]
  ): Promise<string> {
    const title = 'Shopping Reminder';
    const message = urgentItems.length > 0
      ? `${itemCount} items needed, including ${urgentItems.slice(0, 2).join(', ')}`
      : `${itemCount} items on your shopping list`;

    return this.createNotification(userId, {
      type: 'shopping_reminder',
      title,
      message,
      actionLabel: 'View Shopping List',
      actionType: 'view_item',
      actionData: { tab: 'shopping' },
      priority: urgentItems.length > 0 ? 'medium' : 'low'
    });
  }

  /**
   * Create daily combined notification (meals + shopping)
   * This creates both an in-app notification and sends a push notification
   */
  static async createDailyCombinedNotification(
    userId: string,
    mealPlan: any[], // Array of meals for the day
    shoppingListCount: number,
    urgentShoppingItems: string[]
  ): Promise<string> {
    // Delete any existing daily pantry check notifications first
    await this.deleteExistingDailyNotifications(userId);

    // Build message parts
    const messageParts: string[] = [];

    // Add meal prep reminders
    if (mealPlan && mealPlan.length > 0) {
      const mealNames = mealPlan.map((meal: any) => meal.name || meal.title).slice(0, 3);
      messageParts.push(`Meals to prepare: ${mealNames.join(', ')}`);
    }

    // Add shopping list reminder
    if (shoppingListCount > 0) {
      if (urgentShoppingItems.length > 0) {
        messageParts.push(`${shoppingListCount} items needed, including ${urgentShoppingItems.slice(0, 2).join(', ')}`);
      } else {
        messageParts.push(`${shoppingListCount} items on shopping list`);
      }
    }

    const message = messageParts.join('. ');

    // Create in-app notification
    const notificationId = await this.createNotification(userId, {
      type: 'system',
      title: 'Daily Pantry Check',
      message,
      actionLabel: mealPlan.length > 0 ? 'View Meals' : 'View Shopping List',
      actionType: mealPlan.length > 0 ? 'view_item' : 'view_item',
      actionData: { tab: mealPlan.length > 0 ? 'meals' : 'shopping' },
      priority: 'medium' // This will NOT trigger push notification
    });

    // Send push notification separately (bypassing the priority filter)
    try {
      await this.sendPushNotification(userId, {
        type: 'system',
        title: 'Daily Pantry Check',
        message,
        actionType: mealPlan.length > 0 ? 'view_item' : 'view_item',
        actionData: { tab: mealPlan.length > 0 ? 'meals' : 'shopping' },
        priority: 'medium'
      });
    } catch (err: any) {
      console.error('Failed to send daily push notification:', err);
    }

    return notificationId;
  }

  /**
   * Get unread notifications for user
   */
  static async getUnreadNotifications(userId: string, userEmail?: string): Promise<NotificationItem[]> {
    try {
      // Read from per-user notifications cache to avoid expensive collection queries
      const items = await getNotificationsOnce(userId);
      const unreadNotifications = (items || []).filter((notification: any) => {
        const isRead = Boolean(notification.read);
        const snoozed = notification.snoozedUntil;
        const isSnoozed = snoozed ? (new Date(snoozed) > new Date()) : false;
        return !isRead && !isSnoozed;
      });

      // Sort by createdAt desc (createdAt may be serverTimestamp placeholder)
      const sorted = unreadNotifications.slice().sort((a: any, b: any) => {
        const aTime = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const bTime = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return bTime - aTime;
      }).slice(0, 20);

      return sorted as NotificationItem[];
    } catch (err: any) {
      console.error('Error getting unread notifications:', err);
      // Return empty array instead of throwing to prevent UI crashes
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string): Promise<void> {
    // Try to mark read in per-user cache; fall back to collection update if needed
    try {
      // We don't know the uid here; the callers usually have it. As a fallback,
      // update by scanning user's cache is not feasible without uid. Keep collection fallback here.
      await DatabaseMonitoringService.updateDoc(DatabaseMonitoringService.doc(this.COLLECTION + '/' + notificationId), {
        read: true
      });
    } catch (err) {
      console.error('Failed to mark notification read in collection fallback:', err);
    }
  }

  /**
   * Snooze notification
   */
  static async snoozeNotification(notificationId: string, minutes: number): Promise<void> {
    // Snooze in cache is per-user; here we fallback to collection update as we don't have uid
    const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000);
    try {
      await DatabaseMonitoringService.updateDoc(DatabaseMonitoringService.doc(this.COLLECTION + '/' + notificationId), {
        snoozedUntil: Timestamp.fromDate(snoozedUntil)
      });
    } catch (err) {
      console.error('Failed to snooze notification in collection fallback:', err);
    }
  }

  /**
   * Check if notification should be shown based on user settings and timing
   */
  static shouldShowNotification(
    notification: NotificationItem,
    settings: NotificationSettings
  ): boolean {
    // Check if notifications are enabled
    if (!settings.enabled) return false;

    // Check if notification type is enabled
    if (notification.type === 'expiration') {
      const expirySetting = settings.types.expiration;
      if (expirySetting === 'never') return false;

      // Check if this notification matches the user's preference
      const daysUntilExpiry = notification.actionData?.daysUntilExpiry;
      if (daysUntilExpiry !== undefined) {
        if (expirySetting === 'urgent' && daysUntilExpiry > 1) return false;
        if (expirySetting === 'day_before' && daysUntilExpiry > 1) return false;
        if (expirySetting === 'week_before' && daysUntilExpiry > 7) return false;
      }
    } else if (!settings.types[notification.type]) {
      return false;
    }

    // Check quiet hours
    if (settings.quietHours.enabled) {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const [startHour, startMin] = settings.quietHours.start.split(':').map(Number);
      const [endHour, endMin] = settings.quietHours.end.split(':').map(Number);
      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;

      if (startTime < endTime) {
        // Same day quiet hours
        if (currentTime >= startTime && currentTime <= endTime) return false;
      } else {
        // Overnight quiet hours
        if (currentTime >= startTime || currentTime <= endTime) return false;
      }
    }

    // Check if snoozed
    if (notification.snoozedUntil && notification.snoozedUntil.toDate() > new Date()) {
      return false;
    }

    return true;
  }

  /**
   * Get default notification settings
   */
  static getDefaultSettings(): NotificationSettings {
    return {
      enabled: true,
      quietHours: {
        enabled: true,
        start: '22:00',
        end: '08:00'
      },
      types: {
        expiration: 'day_before',
        recipe_suggestion: true,
        household_activity: true,
        shopping_reminder: true,
        system: true,
        allergy_alert: true,
        household_invite: true
      }
    };
  }

  /**
   * Clean up old notifications (older than 30 days)
   */
  static async cleanupOldNotifications(userId: string): Promise<void> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const q = DatabaseMonitoringService.query(
      DatabaseMonitoringService.collection(this.COLLECTION),
      DatabaseMonitoringService.where('userId', '==', userId),
      DatabaseMonitoringService.where('createdAt', '<', Timestamp.fromDate(thirtyDaysAgo))
    );

    const snapshot = await DatabaseMonitoringService.getDocs(q);
    const batch = [];
    for (const doc of snapshot.docs) {
      batch.push(DatabaseMonitoringService.deleteDoc(DatabaseMonitoringService.doc(this.COLLECTION + '/' + doc.id)));
    }
    await Promise.all(batch);
  }

  /**
   * Delete existing daily pantry check notifications for a user
   * This prevents duplicate notifications from accumulating
   */
  static async deleteExistingDailyNotifications(userId: string): Promise<void> {
    const q = DatabaseMonitoringService.query(
      DatabaseMonitoringService.collection(this.COLLECTION),
      DatabaseMonitoringService.where('userId', '==', userId),
      DatabaseMonitoringService.where('type', '==', 'system'),
      DatabaseMonitoringService.where('title', '==', 'Daily Pantry Check')
    );

    const snapshot = await DatabaseMonitoringService.getDocs(q);
    const batch = [];
    for (const doc of snapshot.docs) {
      batch.push(DatabaseMonitoringService.deleteDoc(DatabaseMonitoringService.doc(this.COLLECTION + '/' + doc.id)));
    }
    await Promise.all(batch);
  }

  /**
   * Send push notification for high-priority notifications
   * Note: In production, this should be done server-side via Firebase Admin SDK
   */
  private static async sendPushNotification(
    userId: string,
    notification: Omit<NotificationItem, 'id' | 'userId' | 'read' | 'createdAt'>
  ): Promise<void> {
    // For now, we'll use local notifications on the device
    // In production, you'd send to FCM server which would then push to device

    if (!pushNotificationService.isSupported()) {
      return; // Only send push notifications on native platforms
    }

    try {
      // Get the user's FCM token (stored locally for this demo)
      const token = pushNotificationService.getToken();
      if (!token) {
        console.log('No FCM token available for push notification');
        return;
      }

      // Prepare notification data for FCM
      const fcmPayload = {
        to: token,
        notification: {
          title: notification.title,
          body: notification.message,
          sound: 'default',
          badge: 1,
          click_action: 'FLUTTER_NOTIFICATION_CLICK' // For Android
        },
        data: {
          type: notification.type,
          actionType: notification.actionType,
          actionData: JSON.stringify(notification.actionData || {}),
          priority: notification.priority
        },
        priority: notification.priority === 'urgent' ? 'high' : 'normal'
      };

      // In a real app, you'd send this to your server, which would use Firebase Admin SDK
      // For this demo, we'll log it (server-side implementation would be needed for production)
      console.log('FCM Payload (send to server):', JSON.stringify(fcmPayload, null, 2));

      // For development/testing, you could implement a server endpoint that receives this payload
      // and sends it to FCM. Here's how you would do it server-side with Firebase Admin SDK:
      /*
      const admin = require('firebase-admin');
      await admin.messaging().send(fcmPayload);
      */

    } catch (err: any) {
      console.error('Failed to prepare push notification:', err);
    }
  }
}
