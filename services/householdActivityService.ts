/**
 * Household Activity Service
 * Tracks member activity and provides real-time collaboration features
 */

import DatabaseMonitoringService from './databaseMonitoringService';
import { serverTimestamp } from 'firebase/firestore';
import { log } from './logService';

export class HouseholdActivityService {
  // Throttle logActivity writes: at most one write per user per household per 30 seconds
  private static lastWriteTime: Record<string, number> = {};
  private static lastMemberActivityWrite: Record<string, { time: number; activity: string }> = {};

  /**
   * Update member's current activity and last seen
   */
  static async updateMemberActivity(userId: string, householdId: string, activity: string) {
    const key = `${householdId}:${userId}`;
    const now = Date.now();
    const lastWrite = HouseholdActivityService.lastMemberActivityWrite[key];

    // Throttle: 
    // 1. If it's the exact same activity, throttle to once every 30 seconds (to update lastSeen/online status).
    // 2. If it's a different activity, throttle to once every 10 seconds to prevent rapid tab-switching writes.
    if (lastWrite) {
      const timeDiff = now - lastWrite.time;
      const isSameActivity = lastWrite.activity === activity;
      if (isSameActivity && timeDiff < 30_000) {
        return;
      }
      if (!isSameActivity && timeDiff < 10_000) {
        return;
      }
    }

    // Update the cache before the async write to prevent concurrent calls from bypassing the check
    HouseholdActivityService.lastMemberActivityWrite[key] = { time: now, activity };

    try {
      const householdRef = DatabaseMonitoringService.doc('households', householdId);
      const memberPath = `memberActivity.${userId}`;

      await DatabaseMonitoringService.updateDoc(householdRef, {
        [memberPath + '.lastSeen']: serverTimestamp(),
        [memberPath + '.currentActivity']: activity,
        [memberPath + '.isOnline']: true
      });
    } catch (err: any) {
      log.error('Error updating member activity:', { err }, 'HouseholdActivityService');
    }
  }

  /**
   * Mark member as offline
   */
  static async markMemberOffline(userId: string, householdId: string) {
    try {
      const householdRef = DatabaseMonitoringService.doc('households', householdId);
      const memberPath = `memberActivity.${userId}`;

      await DatabaseMonitoringService.updateDoc(householdRef, {
        [memberPath + '.isOnline']: false
      });
    } catch (err: any) {
      log.error('Error marking member offline:', { err }, 'HouseholdActivityService');
    }
  }

  /**
   * Log an activity event for the household activity feed
   */
  static async logActivity(
    householdId: string,
    userId: string,
    userName: string,
    action: string,
    details?: string,
    itemId?: string,
    itemName?: string
  ) {
    // Throttle: at most one activity write per user per household every 30 seconds
    const throttleKey = `${householdId}:${userId}`;
    const now = Date.now();
    if (now - (HouseholdActivityService.lastWriteTime[throttleKey] ?? 0) < 30_000) {
      return;
    }
    HouseholdActivityService.lastWriteTime[throttleKey] = now;
    try {
      const activityData = {
        userId,
        userName,
        action, // 'added_item', 'removed_item', 'completed_meal', 'created_meal_plan', etc.
        details,
        itemId,
        itemName,
        timestamp: serverTimestamp(),
        householdId
      };

      const activityCollection = DatabaseMonitoringService.collection(`households/${householdId}/activity`);
      await DatabaseMonitoringService.addDoc(activityCollection, activityData);
    } catch (err: any) {
      log.error('Error logging activity:', { err }, 'HouseholdActivityService');
    }
  }

  /**
   * Get recent household activities
   */
  static async getRecentActivities(householdId: string, limitCount: number = 10) {
    try {
      const activityCollection = DatabaseMonitoringService.collection(`households/${householdId}/activity`);
      const activitiesQuery = DatabaseMonitoringService.query(
        activityCollection,
        DatabaseMonitoringService.orderBy('timestamp', 'desc'),
        DatabaseMonitoringService.limit(limitCount)
      );

      const snapshot = await DatabaseMonitoringService.getDocs(activitiesQuery);
      return (snapshot.docs || []).map((doc: any) => {
        const d = doc.data() as any;
        return {
          id: doc.id,
          ...d
        };
      });
    } catch (err: any) {
      log.error('Error getting recent activities:', { err }, 'HouseholdActivityService');
      return [];
    }
  }

  /**
   * Subscribe to household activities (real-time)
   */
  static subscribeToActivities(householdId: string, callback: (activities: any[]) => void) {
    const activityCollection = DatabaseMonitoringService.collection(`households/${householdId}/activity`);
    const activitiesQuery = DatabaseMonitoringService.query(
      activityCollection,
      DatabaseMonitoringService.orderBy('timestamp', 'desc'),
      DatabaseMonitoringService.limit(20)
    );

    return DatabaseMonitoringService.onSnapshot(activitiesQuery, (snapshot) => {
      const activities = (snapshot.docs || []).map((doc: any) => {
        const d = doc.data() as any;
        return {
          id: doc.id,
          ...d
        };
      });
      callback(activities);
    });
  }

  /**
   * Get activity message for display
   */
  static getActivityMessage(activity: any): string {
    const { userName, action, itemName, details } = activity;

    switch (action) {
      case 'added_item':
        return `${userName} added ${itemName || 'an item'} to inventory`;
      case 'removed_item':
        return `${userName} removed ${itemName || 'an item'} from inventory`;
      case 'added_to_shopping':
        return `${userName} added ${itemName || 'an item'} to shopping list`;
      case 'completed_shopping':
        return `${userName} completed shopping for ${itemName || 'items'}`;
      case 'created_meal_plan':
        return `${userName} created a meal plan`;
      case 'added_recipe':
        return `${userName} saved ${itemName || 'a recipe'}`;
      case 'completed_meal':
        return `${userName} completed ${itemName || 'a meal'}`;
      case 'joined_household':
        return `${userName} joined the household`;
      case 'left_household':
        return `${userName} left the household`;
      default:
        return details || `${userName} performed an action`;
    }
  }

  /**
   * Get relative time string for activity
   */
  static getRelativeTime(timestamp: any): string {
    if (!timestamp) return '';

    const now = new Date();
    const activityTime = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffMs = now.getTime() - activityTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return activityTime.toLocaleDateString();
  }
}
