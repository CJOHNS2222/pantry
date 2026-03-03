import { LeftoverService } from './leftoverService'
import { NotificationService } from './notificationService'
import { PantryItem } from '../types'
import AnalyticsService from './analyticsService'

export class LeftoverNotificationService {
  /**
   * Check all leftovers for a household and create notifications for items needing attention
   */
  static async checkAndNotifyLeftovers(householdId: string, userId: string): Promise<void> {
    try {
      const leftovers = await LeftoverService.getLeftovers(householdId)

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

        // Create individual notification for urgent items
        if (attentionLevel === 'urgent') {
          await NotificationService.createLeftoverExpirationAlert(
            userId,
            leftover.item,
            daysUntilExpiry,
            leftover.id,
            isCookedRice
          )
          AnalyticsService.trackLeftoverNotificationSent(userId, 'expiration', 1)
        }

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

      // Create aggregated notification if multiple items need attention
      if (urgentLeftovers.length > 1) {
        await NotificationService.createLeftoverAttentionAlert(userId, urgentLeftovers)
        AnalyticsService.trackLeftoverNotificationSent(userId, 'attention', urgentLeftovers.length)
      }

    } catch (error) {
      console.error('Failed to check leftovers for notifications:', error)
    }
  }

  /**
   * Schedule periodic checks for leftover notifications
   * This should be called when the app starts or when entering a household
   */
  static startPeriodicChecks(householdId: string, userId: string): () => void {
    // Check immediately
    this.checkAndNotifyLeftovers(householdId, userId)

    // Set up periodic checks every 6 hours
    const intervalId = setInterval(() => {
      this.checkAndNotifyLeftovers(householdId, userId)
    }, 6 * 60 * 60 * 1000) // 6 hours

    // Return cleanup function
    return () => clearInterval(intervalId)
  }
}