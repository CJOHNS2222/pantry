/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Notification Service
 * Manages contextual notifications, timing, and user preferences
 */

import DatabaseMonitoringService from './databaseMonitoringService';
import { Timestamp } from 'firebase/firestore';
import { appendNotificationToUser, snoozeNotificationInCache, updateNotificationInCache } from './notificationsService';
import { formatDangerSummary, DangerItem } from './notificationHelpers';
import { getFoodRiskLevel, generateExpirationMessage, getNotificationTone, generateNotificationStackMessage, generateWasteNotificationMessage } from '../utils/foodRiskClassification';

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
  dedupeKey?: string;
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
    expired_items_check: boolean;
  };
}

export class NotificationService {
  static readonly COLLECTION = 'notifications';

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
    } catch (err: any) {
      // Log the error but don't fallback to inefficient root collection
      console.error('Failed to append notification to user cache:', {
        error: err?.message || err
      });
      throw err; // Re-throw to prevent silent failures
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
      dedupeKey: 'expiration_danger_zone',
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))
    })
  }

  /**
   * Create notification stack for multiple expiring items (prevents notification fatigue)
   */
  static async createNotificationStack(
    userId: string,
    items: Array<{ itemName: string; daysUntilExpiry: number; riskLevel: number; itemId: string }>
  ): Promise<string> {
    if (!items || items.length <= 1) return '';

    // Only create stack notification if there are multiple items expiring today or high-risk items
    const urgentItems = items.filter(item => item.daysUntilExpiry <= 0 || item.riskLevel >= 5);
    const highRiskItems = items.filter(item => item.riskLevel >= 4);

    if (urgentItems.length <= 1 && highRiskItems.length <= 1) return '';

    // Check if stack notification already exists
    const existingNotifications = await NotificationService.getUnreadNotifications(userId);
    const existingStack = existingNotifications.find(n =>
      n.type === 'expiration' &&
      n.actionData?.isStack === true &&
      !n.read
    );

    if (existingStack) {
      // Update existing stack notification
      const { title, message } = generateNotificationStackMessage(items);

      const updateData = {
        title,
        message,
        actionData: { isStack: true, items: items.map(i => ({ itemId: i.itemId, itemName: i.itemName, daysUntilExpiry: i.daysUntilExpiry, riskLevel: i.riskLevel })) }
      };

      try {
        await updateNotificationInCache(userId, existingStack.id, updateData as any);
      } catch (err: any) {
        console.error('Failed to update stack notification:', err);
      }

      return existingStack.id;
    }

      // Create new stack notification
    const { title, message } = generateNotificationStackMessage(items);

    return this.createNotification(userId, {
      type: 'expiration',
      title,
      message,
      actionLabel: 'View Items',
      actionType: 'view_item',
      actionData: {
        isStack: true,
        items: items.map(i => ({ itemId: i.itemId, itemName: i.itemName, daysUntilExpiry: i.daysUntilExpiry, riskLevel: i.riskLevel }))
      },
      priority: urgentItems.length > 0 ? 'urgent' : highRiskItems.length > 0 ? 'high' : 'medium',
      dedupeKey: 'expiration_stack',
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))
    });
  }

  /**
   * Create waste notification when user tosses an item
   */
  static async createWasteNotification(
    userId: string,
    itemName: string,
    itemId: string
  ): Promise<string> {
    const { title, message, actionLabel, actionType } = generateWasteNotificationMessage(itemName);

    return this.createNotification(userId, {
      type: 'system',
      title,
      message,
      actionLabel,
      actionType,
      actionData: { itemId, itemName, wasteNotification: true },
      priority: 'low',
      dedupeKey: `waste_${itemId}`,
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
    });
  }

  /**
   * Create expiration alert notification
   */
  static async createExpirationAlert(
    userId: string,
    itemName: string,
    daysUntilExpiry: number,
    itemId: string,
    userRiskLevel?: number,
    itemCategory?: string,
    cachedNotifications?: NotificationItem[]
  ): Promise<string> {
    // Check if notification already exists for this item
    const existingNotifications = cachedNotifications ?? await NotificationService.getUnreadNotifications(userId);
    const existingNotification = existingNotifications.find(n =>
      n.type === 'expiration' &&
      n.actionData?.itemId === itemId &&
      !n.read
    );

    // Determine risk level for this item
    const itemRiskLevel = getFoodRiskLevel(itemName, itemCategory);

    // Skip low-value notifications:
    // - Staples (1): don't meaningfully expire, "Inventory Check" is noise
    // - Hardy Fridge (2): "Checking In" adds no value if everything is fine
    if (itemRiskLevel <= 2) {
      return '';
    }

    // Produce (3) only warrants a notification when truly imminent — skip generic "Expires Soon" spam
    if (itemRiskLevel === 3 && daysUntilExpiry > 3) {
      return '';
    }

    const { priority: basePriority } = getNotificationTone(itemRiskLevel);

    // Adjust priority based on user risk level and time sensitivity
    let finalPriority = basePriority;
    if (userRiskLevel && userRiskLevel >= 4) {
      // Bump priority for high-risk users
      if (daysUntilExpiry <= 3) {
        if (finalPriority === 'low') finalPriority = 'medium';
        else if (finalPriority === 'medium') finalPriority = 'high';
        else if (finalPriority === 'high') finalPriority = 'urgent';
      }
    }

    // Override for expired items
    if (daysUntilExpiry <= 0) {
      finalPriority = 'urgent';
    }

    if (existingNotification) {
      // Update existing notification if priority changed or days changed
      const currentPriority = existingNotification.priority;

      if (currentPriority !== finalPriority) {
        const { title, message } = generateExpirationMessage(itemName, daysUntilExpiry, itemRiskLevel);

        const updateData = {
          priority: finalPriority,
          title,
          message
        };

        // Try to update the top-level notification document; if that fails
        // (e.g., the notification only exists in the per-user cache or the
        // client is not authorized to write to the collection), fall back
        // to updating the per-user cache document.
        try {
          const docRef = DatabaseMonitoringService.doc(this.COLLECTION + '/' + existingNotification.id);
          // Check existence first to avoid permission-denied when doc is missing
          const topSnap = await DatabaseMonitoringService.getDoc(docRef);
          if (topSnap && topSnap.exists()) {
            await DatabaseMonitoringService.updateDoc(docRef, updateData as any);
          } else {
            // No top-level doc — update the per-user cache instead
            await updateNotificationInCache(userId, existingNotification.id, updateData as any);
          }
        } catch (err: any) {
          console.warn('Failed updating top-level notification; falling back to cache update', { error: err?.message || err, userId });
          try {
            await updateNotificationInCache(userId, existingNotification.id, updateData as any);
          } catch (cacheErr: any) {
            console.error('Failed to update notification in user cache fallback:', { error: cacheErr?.message || cacheErr, userId, notificationId: existingNotification.id });
          }
        }
      }
      return existingNotification.id;
    }

    // Generate contextual message based on risk level
    const { title, message } = generateExpirationMessage(itemName, daysUntilExpiry, itemRiskLevel);

    // Determine action type based on context
    let actionType: 'add_to_shopping' | 'view_item' = 'view_item';
    let actionLabel = 'View Item';
    const actionData: any = { itemId, itemName, daysUntilExpiry };

    if (daysUntilExpiry <= 1 || itemRiskLevel >= 4) {
      actionType = 'add_to_shopping';
      actionLabel = 'Add to Shopping List';
    }

    return this.createNotification(userId, {
      type: 'expiration',
      title,
      message,
      actionLabel,
      actionType,
      actionData,
      priority: finalPriority,
      dedupeKey: `expiration_${itemId}`,
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
  static async getUnreadNotifications(userId: string, _userEmail?: string): Promise<NotificationItem[]> {
    try {
      // Read from per-user cache document instead of querying root collection
      const cacheRef = DatabaseMonitoringService.doc(`users/${userId}/cache/notifications`);
      const cacheSnap = await DatabaseMonitoringService.getDoc(cacheRef);

      if (!cacheSnap.exists()) {
        return [];
      }

      const data = cacheSnap.data() as any;
      const allNotifications = Array.isArray(data.items) ? data.items : [];

      // Filter for unread notifications from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const unreadNotifications = allNotifications.filter((n: NotificationItem) => {
        if (n.read) return false;

        // Check if notification is within 30 days
        let createdAt: Date | null = null;
        if (n.createdAt) {
          if (typeof n.createdAt === 'string') {
            createdAt = new Date(n.createdAt);
          } else if (n.createdAt && typeof n.createdAt.toDate === 'function') {
            createdAt = n.createdAt.toDate();
          }
        }
        if (!createdAt || createdAt < thirtyDaysAgo) return false;

        return true;
      });

      // Sort by createdAt desc and limit to 20
      const sorted = unreadNotifications.slice().sort((a: NotificationItem, b: NotificationItem) => {
        const getTime = (n: NotificationItem): number => {
          if (!n.createdAt) return 0;
          if (typeof n.createdAt === 'string') {
            return new Date(n.createdAt).getTime();
          } else if (n.createdAt && typeof n.createdAt.toDate === 'function') {
            return n.createdAt.toDate().getTime();
          }
          return 0;
        };
        const aTime = getTime(a);
        const bTime = getTime(b);
        return bTime - aTime;
      }).slice(0, 20);

      return sorted;
    } catch (err: any) {
      console.error('Error getting unread notifications:', err);
      // Return empty array instead of throwing to prevent UI crashes
      return [];
    }
  }

  /**
   * Migrate pre-registration invite notifications from the root /notifications/ collection
   * into the per-user cache. The Cloud Function writes there when the invitee has no UID yet,
   * storing userId as the email address. On login we move them to the user's own cache doc
   * so they surface through the normal notification flow.
   */
  static async migrateRootInviteNotifications(userId: string, userEmail: string): Promise<void> {
    if (!userId || !userEmail) return;
    try {
      const q = DatabaseMonitoringService.query(
        DatabaseMonitoringService.collection('notifications'),
        DatabaseMonitoringService.where('userId', '==', userEmail)
      );
      const snap = await DatabaseMonitoringService.getDocs(q);
      if (snap.empty) return;

      for (const d of snap.docs) {
        const raw = d.data() as any;
        // Normalise createdAt – server timestamps arrive as Timestamp objects
        let createdAt: string = new Date().toISOString();
        if (raw.createdAt) {
          if (typeof raw.createdAt === 'string') {
            createdAt = raw.createdAt;
          } else if (typeof raw.createdAt.toDate === 'function') {
            createdAt = raw.createdAt.toDate().toISOString();
          }
        }
        const migrated: NotificationItem = {
          ...raw,
          id: d.id,
          userId, // rewrite to actual UID
          createdAt,
        } as NotificationItem;

        await appendNotificationToUser(userId, migrated);
        // Delete the root doc so it isn't processed again
        const docRef = DatabaseMonitoringService.doc(`notifications/${d.id}`);
        await DatabaseMonitoringService.deleteDoc(docRef);
      }
    } catch (err: any) {
      // Non-fatal – log and continue so the rest of login flow is unaffected
      console.warn('migrateRootInviteNotifications failed silently:', err?.message);
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(userId: string, notificationId: string): Promise<void> {
    try {
      await updateNotificationInCache(userId, notificationId, { read: true });
    } catch (err) {
      console.error('Failed to mark notification read in cache:', err);
    }
  }

  /**
   * Snooze notification
   */
  static async snoozeNotification(userId: string, notificationId: string, minutes: number): Promise<void> {
    try {
      await snoozeNotificationInCache(userId, notificationId, minutes);
    } catch (err) {
      console.error('Failed to snooze notification in cache:', err);
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
    if (notification.snoozedUntil) {
      let snoozedDate: Date | null = null;
      if (typeof notification.snoozedUntil === 'string') {
        snoozedDate = new Date(notification.snoozedUntil);
      } else if (notification.snoozedUntil && typeof notification.snoozedUntil.toDate === 'function') {
        snoozedDate = notification.snoozedUntil.toDate();
      }
      if (snoozedDate && snoozedDate > new Date()) {
        return false;
      }
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
        household_invite: true,
        expired_items_check: false
      }
    };
  }

  /**
   * Clean up old notifications (older than 30 days)
   */
  static async cleanupOldNotifications(userId: string): Promise<void> {
    try {
      const cacheRef = DatabaseMonitoringService.doc(`users/${userId}/cache/notifications`);
      const cacheSnap = await DatabaseMonitoringService.getDoc(cacheRef);

      if (!cacheSnap.exists()) {
        return;
      }

      const data = cacheSnap.data() as any;
      const allNotifications = Array.isArray(data.items) ? data.items : [];

      // Filter out notifications older than 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentNotifications = allNotifications.filter((n: NotificationItem) => {
        let createdAt: Date | null = null;
        if (n.createdAt) {
          if (typeof n.createdAt === 'string') {
            createdAt = new Date(n.createdAt);
          } else if (n.createdAt && typeof n.createdAt.toDate === 'function') {
            createdAt = n.createdAt.toDate();
          }
        }
        return createdAt && createdAt >= thirtyDaysAgo;
      });

      // Update the cache with only recent notifications
      if (recentNotifications.length !== allNotifications.length) {
        await DatabaseMonitoringService.setDoc(cacheRef, { items: recentNotifications }, { merge: true });
      }
    } catch (err: any) {
      console.error('Error cleaning up old notifications:', err);
    }
  }

  /**
   * Delete existing daily pantry check notifications for a user
   * This prevents duplicate notifications from accumulating
   */
  static async deleteExistingDailyNotifications(userId: string): Promise<void> {
    try {
      const cacheRef = DatabaseMonitoringService.doc(`users/${userId}/cache/notifications`);
      const cacheSnap = await DatabaseMonitoringService.getDoc(cacheRef);

      if (!cacheSnap.exists()) {
        return;
      }

      const data = cacheSnap.data() as any;
      const allNotifications = Array.isArray(data.items) ? data.items : [];

      // Filter out daily pantry check notifications
      const filteredNotifications = allNotifications.filter((n: NotificationItem) => {
        return !(n.type === 'system' && n.title === 'Daily Pantry Check');
      });

      // Update the cache if any notifications were removed
      if (filteredNotifications.length !== allNotifications.length) {
        await DatabaseMonitoringService.setDoc(cacheRef, { items: filteredNotifications }, { merge: true });
      }
    } catch (err: any) {
      console.error('Error deleting existing daily notifications:', err);
    }
  }

  /**
   * Create leftover expiration alert notification
   */
  static async createLeftoverExpirationAlert(
    userId: string,
    leftoverName: string,
    daysUntilExpiry: number,
    leftoverId: string,
    isCookedRice: boolean = false,
    cachedNotifications?: NotificationItem[]
  ): Promise<string> {
    const existingNotifications = cachedNotifications ?? await NotificationService.getUnreadNotifications(userId);
    const existingNotification = existingNotifications.find(n =>
      n.type === 'expiration' &&
      n.actionData?.leftoverId === leftoverId
    );

    let priority: 'low' | 'medium' | 'high' | 'urgent' = 'low'
    let title = ''
    let message = ''
    let actionLabel = ''

    if (daysUntilExpiry <= 0) {
      priority = 'urgent'
      title = isCookedRice ? 'Cooked Rice Alert!' : 'Leftover Expired!'
      message = isCookedRice
        ? `🍚 ${leftoverName} has been in fridge for 4+ days. Even if it looks fine, Bacillus cereus isn't worth the risk. Time to toss!`
        : `${leftoverName} has expired. Please discard immediately.`
      actionLabel = 'View Leftovers'
    } else if (daysUntilExpiry === 1) {
      priority = 'high'
      title = 'Leftover Expires Tomorrow!'
      message = `${leftoverName} expires tomorrow. Consider eating or freezing today.`
      actionLabel = 'View Leftovers'
    } else if (daysUntilExpiry <= 3) {
      priority = 'medium'
      title = 'Leftover Expires Soon'
      message = `${leftoverName} expires in ${daysUntilExpiry} days.`
      actionLabel = 'View Leftovers'
    } else if (daysUntilExpiry <= 5) {
      priority = 'low'
      title = 'Consider Freezing Leftover'
      message = `${leftoverName} expires in ${daysUntilExpiry} days. Move to freezer for longer storage?`
      actionLabel = 'View Leftovers'
    }

    if (existingNotification) {
      // Update existing notification if priority or content changed
      if (existingNotification.priority !== priority || existingNotification.title !== title || existingNotification.message !== message) {
        const updateData = { priority, title, message, read: false };
        try {
          const docRef = DatabaseMonitoringService.doc(this.COLLECTION + '/' + existingNotification.id);
          const topSnap = await DatabaseMonitoringService.getDoc(docRef);
          if (topSnap && topSnap.exists()) {
            await DatabaseMonitoringService.updateDoc(docRef, updateData as any);
          } else {
            await updateNotificationInCache(userId, existingNotification.id, updateData as any);
          }
        } catch (err: any) {
          console.warn('Failed updating top-level leftover notification; falling back to cache update', { error: err?.message || err, userId });
          try {
            await updateNotificationInCache(userId, existingNotification.id, updateData as any);
          } catch (cacheErr: any) {
            console.error('Failed to update leftover notification in cache fallback:', cacheErr);
          }
        }
      }
      return existingNotification.id;
    }

    return this.createNotification(userId, {
      type: 'expiration',
      title,
      message,
      actionLabel,
      actionType: 'view_item',
      actionData: { leftoverId, itemName: leftoverName, tab: 'pantry' },
      priority,
      dedupeKey: `leftover_expiry_${leftoverId}`,
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) // Expire in 7 days
    })
  }

  /**
   * Create aggregated leftover attention notification
   */
  static async createLeftoverAttentionAlert(
    userId: string,
    urgentLeftovers: Array<{ id: string; name: string; daysUntilExpiry: number; isCookedRice: boolean }>,
    cachedNotifications?: NotificationItem[]
  ): Promise<string> {
    if (!urgentLeftovers || urgentLeftovers.length === 0) return ''

    const existingNotifications = cachedNotifications ?? await NotificationService.getUnreadNotifications(userId);
    const existingNotification = existingNotifications.find(n =>
      n.type === 'expiration' &&
      n.dedupeKey === 'leftover_attention_aggregated'
    );

    const urgentCount = urgentLeftovers.filter(l => l.daysUntilExpiry <= 0).length
    const expiringSoonCount = urgentLeftovers.filter(l => l.daysUntilExpiry > 0 && l.daysUntilExpiry <= 3).length

    let title = 'Leftovers Need Attention'
    let message = ''
    let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'

    if (urgentCount > 0) {
      title = `${urgentCount} Leftover${urgentCount > 1 ? 's' : ''} Expired!`
      message = urgentLeftovers
        .filter(l => l.daysUntilExpiry <= 0)
        .slice(0, 3)
        .map(l => l.name)
        .join(', ')
      if (urgentLeftovers.length > 3) message += ` and ${urgentLeftovers.length - 3} more`
      message += ' have expired. Please discard immediately.'
      priority = 'urgent'
    } else if (expiringSoonCount > 0) {
      title = 'Leftovers Expiring Soon'
      message = `${expiringSoonCount} leftover${expiringSoonCount > 1 ? 's' : ''} expiring within 3 days: `
      message += urgentLeftovers
        .filter(l => l.daysUntilExpiry > 0 && l.daysUntilExpiry <= 3)
        .slice(0, 2)
        .map(l => l.name)
        .join(', ')
      priority = 'high'
    }

    if (existingNotification) {
      // If priority, title, or message changed, update it and reset read status.
      // Also update the leftovers list in actionData.
      if (existingNotification.priority !== priority || existingNotification.title !== title || existingNotification.message !== message) {
        const updateData = {
          priority,
          title,
          message,
          read: false,
          actionData: {
            tab: 'pantry',
            leftovers: urgentLeftovers.map(l => ({ id: l.id, name: l.name }))
          }
        };
        try {
          const docRef = DatabaseMonitoringService.doc(this.COLLECTION + '/' + existingNotification.id);
          const topSnap = await DatabaseMonitoringService.getDoc(docRef);
          if (topSnap && topSnap.exists()) {
            await DatabaseMonitoringService.updateDoc(docRef, updateData as any);
          } else {
            await updateNotificationInCache(userId, existingNotification.id, updateData as any);
          }
        } catch (err: any) {
          console.warn('Failed updating top-level leftover attention notification; falling back to cache update', { error: err?.message || err, userId });
          try {
            await updateNotificationInCache(userId, existingNotification.id, updateData as any);
          } catch (cacheErr: any) {
            console.error('Failed to update leftover attention notification in cache fallback:', cacheErr);
          }
        }
      }
      return existingNotification.id;
    }

    return this.createNotification(userId, {
      type: 'expiration',
      title,
      message,
      actionLabel: 'View Leftovers',
      actionType: 'view_item',
      actionData: {
        tab: 'pantry',
        leftovers: urgentLeftovers.map(l => ({ id: l.id, name: l.name }))
      },
      priority,
      dedupeKey: 'leftover_attention_aggregated',
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)) // Expire in 3 days
    })
  }

  /**
   * Send a push notification (placeholder - push notifications are typically sent server-side)
   */
  private static async sendPushNotification(userId: string, notification: any): Promise<void> {
    // Push notifications are sent server-side via Firebase Cloud Messaging
    // Fallback for urgent alerts locally via Capacitor LocalNotifications
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 1000000),
            title: notification.title,
            body: notification.message,
            schedule: { at: new Date() }, // show immediately
            extra: notification.actionData
          }
        ]
      });
    } catch (err) {
      console.warn('Failed to schedule local notification for push fallback', err);
    }
  }
}
