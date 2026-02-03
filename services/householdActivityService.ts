/**
 * Household Activity Service
 * Tracks member activity and provides real-time collaboration features
 */

import { doc, updateDoc, serverTimestamp, collection, addDoc, query, where, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { User, Household } from '../types';
import { Tab } from '../types/app';

export class HouseholdActivityService {
  /**
   * Update member's current activity and last seen
   */
  static async updateMemberActivity(userId: string, householdId: string, activity: string) {
    try {
      const householdRef = doc(db, 'households', householdId);
      const memberPath = `members.${userId}`;

      await updateDoc(householdRef, {
        [memberPath + '.lastSeen']: serverTimestamp(),
        [memberPath + '.currentActivity']: activity,
        [memberPath + '.isOnline']: true
      });
    } catch (error) {
      console.error('Error updating member activity:', error);
    }
  }

  /**
   * Mark member as offline
   */
  static async markMemberOffline(userId: string, householdId: string) {
    try {
      const householdRef = doc(db, 'households', householdId);
      const memberPath = `members.${userId}`;

      await updateDoc(householdRef, {
        [memberPath + '.isOnline']: false
      });
    } catch (error) {
      console.error('Error marking member offline:', error);
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

      await addDoc(collection(db, 'households', householdId, 'activity'), activityData);
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }

  /**
   * Get recent household activities
   */
  static async getRecentActivities(householdId: string, limitCount: number = 10) {
    try {
      const activitiesQuery = query(
        collection(db, 'households', householdId, 'activity'),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(activitiesQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting recent activities:', error);
      return [];
    }
  }

  /**
   * Subscribe to household activities (real-time)
   */
  static subscribeToActivities(householdId: string, callback: (activities: any[]) => void) {
    const activitiesQuery = query(
      collection(db, 'households', householdId, 'activity'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    return onSnapshot(activitiesQuery, (snapshot) => {
      const activities = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
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