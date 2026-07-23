import { LeftoverService } from './leftoverService'
import { NotificationService, NotificationItem } from './notificationService'
import { pruneNotificationsForDeletedItems } from './notificationsService'
import AnalyticsService from './analyticsService'
import { log } from './logService'
import DatabaseMonitoringService from './databaseMonitoringService'

export class LeftoverNotificationService {
  /**
   * Check all leftovers for a household and create notifications for items needing attention
   */
  static async checkAndNotifyLeftovers(householdId: string, userId: string): Promise<void> {
    try {
      // 1. Fetch user's notifications cache and clean up any pre-existing duplicates
      const cacheRef = DatabaseMonitoringService.doc(`users/${userId}/cache/notifications`);
      const cacheSnap = await DatabaseMonitoringService.getDoc(cacheRef);
      let allNotifications: any[] = [];
      if (cacheSnap.exists()) {
        const data = cacheSnap.data() as any;
        allNotifications = Array.isArray(data.items) ? data.items : [];
      }

      const uniqueNotifications: any[] = [];
      const seenKeys = new Set<string>();
      let hasDuplicates = false;

      for (const n of allNotifications) {
        const isLeftoverAlert = n.type === 'expiration' && (
          n.actionData?.leftoverId || 
          n.actionData?.leftovers || 
          n.title?.includes('Leftover') || 
          n.dedupeKey?.startsWith('leftover_')
        );

        if (isLeftoverAlert) {
          const key = n.dedupeKey || `${n.title}_${n.message}_${n.actionData?.leftoverId || ''}`;
          if (seenKeys.has(key)) {
            hasDuplicates = true;
            continue;
          }
          seenKeys.add(key);
        }
        uniqueNotifications.push(n);
      }

      if (hasDuplicates) {
        await DatabaseMonitoringService.setDoc(cacheRef, { items: uniqueNotifications }, { merge: true });
        allNotifications = uniqueNotifications;
      }

      // Filter unread notifications from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cachedNotifications: NotificationItem[] = allNotifications.filter((n: any) => {
        if (n.read) return false;
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

      const leftovers = await LeftoverService.getLeftovers(householdId)

      // Clean up stale leftover notifications for items no longer in inventory
      const currentLeftoverIds = new Set(leftovers.map(l => l.id));
      const staleLeftoverIds: string[] = [];
      for (const n of cachedNotifications) {
        const isLeftoverNotif = n.type === 'expiration' && (
          n.actionData?.leftoverId ||
          n.actionData?.leftovers ||
          n.dedupeKey?.startsWith('leftover_')
        );
        if (!isLeftoverNotif) continue;

        // Single leftover notification
        if (n.actionData?.leftoverId && !currentLeftoverIds.has(n.actionData.leftoverId)) {
          staleLeftoverIds.push(n.actionData.leftoverId);
        }
        // Aggregated leftover notification — collect IDs of leftovers that no longer exist
        if (Array.isArray(n.actionData?.leftovers)) {
          for (const l of n.actionData.leftovers) {
            if (l.id && !currentLeftoverIds.has(l.id)) {
              staleLeftoverIds.push(l.id);
            }
          }
        }
      }
      if (staleLeftoverIds.length > 0) {
        pruneNotificationsForDeletedItems(userId, staleLeftoverIds).catch((err) =>
          log.info('Failed to prune stale leftover notifications', { error: err })
        );
      }

      if (leftovers.length === 0) return

      const urgentLeftovers: Array<{
        id: string
        name: string
        daysUntilExpiry: number
        isCookedRice: boolean
      }> = []

      // Check each leftover for attention needed
      for (const leftover of leftovers) {
        const attentionLevel = LeftoverService.needsAttention(leftover)

        if (attentionLevel === 'none') continue

        const bestBefore = leftover.expirationDate ? new Date(leftover.expirationDate) : null
        if (!bestBefore) continue

        const daysUntilExpiry = Math.ceil((bestBefore.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        const isCookedRice = leftover.leftoverMeta?.notes?.toLowerCase().includes('rice') ||
                             leftover.tags?.includes('cooked-rice') ||
                             leftover.item.toLowerCase().includes('rice')

        // Collect for aggregated notification
        if (attentionLevel === 'urgent' || attentionLevel === 'warning') {
          urgentLeftovers.push({
            id: leftover.id,
            name: leftover.item,
            daysUntilExpiry,
            isCookedRice
          })
        }
      }

      // Create aggregated notification if multiple items need attention,
      // otherwise fallback to individual notification if only one item is urgent.
      if (urgentLeftovers.length > 1) {
        await NotificationService.createLeftoverAttentionAlert(userId, urgentLeftovers, cachedNotifications)
        AnalyticsService.trackLeftoverNotificationSent(userId, 'attention', urgentLeftovers.length)
      } else if (urgentLeftovers.length === 1) {
        const item = urgentLeftovers[0]
        const leftover = leftovers.find(l => l.id === item.id)
        if (leftover && LeftoverService.needsAttention(leftover) === 'urgent') {
          await NotificationService.createLeftoverExpirationAlert(
            userId,
            item.name,
            item.daysUntilExpiry,
            item.id,
            item.isCookedRice,
            cachedNotifications
          )
          AnalyticsService.trackLeftoverNotificationSent(userId, 'expiration', 1)
        }
      }

    } catch (error) {
      log.error('Failed to check leftovers for notifications:', { error }, 'LeftoverNotificationService')
    }
  }

  /**
   * Schedule periodic checks for leftover notifications
   * This should be called when the app starts or when entering a household
   */
  static startPeriodicChecks(householdId: string, userId: string): () => void {
    // Check immediately
    this.checkAndNotifyLeftovers(householdId, userId)

    // Set up periodic checks every 24 hours
    const intervalId = setInterval(() => {
      this.checkAndNotifyLeftovers(householdId, userId)
    }, 24 * 60 * 60 * 1000) // 24 hours

    // Return cleanup function
    return () => clearInterval(intervalId)
  }
}