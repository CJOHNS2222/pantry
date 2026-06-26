import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { log } from './logService';

export interface DisposalRecord {
  id: string;
  itemId: string;
  itemName: string;
  category?: string;
  disposalReason: 'thrown_away' | 'cooked' | 'remove';
  daysExpired: number;
  disposalDate: Date;
  userId: string;
  userName?: string;
  estimatedValue?: number; // estimated value of the item
}

export interface FoodWasteAnalytics {
  totalItemsDisposed: number;
  itemsByReason: {
    thrown_away: number;
    cooked: number;
    remove: number;
  };
  averageDaysExpired: number;
  totalEstimatedValue: number;
  disposalHistory: DisposalRecord[];
  lastUpdated: Date;
}

class FoodWasteAnalyticsService {
  private static readonly HOUSEHOLD_COLLECTION = 'households';
  private static readonly USER_COLLECTION = 'users';
  private static readonly ANALYTICS_DOC = 'foodWasteAnalytics';

  /**
   * Record a disposal event
   */
  static async recordDisposal(
    disposal: Omit<DisposalRecord, 'id' | 'disposalDate'>,
    householdId?: string
  ): Promise<void> {
    try {
      const disposalRecord: DisposalRecord = {
        ...disposal,
        id: crypto.randomUUID(),
        disposalDate: new Date()
      };

      const collectionPath = householdId ? this.HOUSEHOLD_COLLECTION : this.USER_COLLECTION;
      const docId = householdId || disposal.userId;
      const analyticsRef = doc(db, collectionPath, docId, 'analytics', this.ANALYTICS_DOC);

      // Get current analytics or create new
      const analyticsSnap = await getDoc(analyticsRef);
      let analytics: FoodWasteAnalytics;

      if (analyticsSnap.exists()) {
        analytics = analyticsSnap.data() as FoodWasteAnalytics;
      } else {
        analytics = {
          totalItemsDisposed: 0,
          itemsByReason: {
            thrown_away: 0,
            cooked: 0,
            remove: 0
          },
          averageDaysExpired: 0,
          totalEstimatedValue: 0,
          disposalHistory: [],
          lastUpdated: new Date()
        };
      }

      // Update analytics
      analytics.totalItemsDisposed += 1;
      analytics.itemsByReason[disposalRecord.disposalReason] += 1;
      analytics.totalEstimatedValue += disposalRecord.estimatedValue || 0;
      analytics.lastUpdated = new Date();

      // Recalculate average days expired
      const allDaysExpired = [...analytics.disposalHistory.map(d => d.daysExpired), disposalRecord.daysExpired];
      analytics.averageDaysExpired = allDaysExpired.reduce((sum, days) => sum + days, 0) / allDaysExpired.length;

      // Add to history (keep last 1000 records)
      analytics.disposalHistory.push(disposalRecord);
      if (analytics.disposalHistory.length > 1000) {
        analytics.disposalHistory = analytics.disposalHistory.slice(-1000);
      }

      // Save to Firestore
      await setDoc(analyticsRef, {
        ...analytics,
        disposalHistory: analytics.disposalHistory.map(record => ({
          ...record,
          disposalDate: Timestamp.fromDate(record.disposalDate)
        })),
        lastUpdated: Timestamp.fromDate(analytics.lastUpdated)
      });

    } catch (error) {
      log.error('Failed to record disposal analytics:', { error }, 'FoodWasteAnalyticsService');
      throw error;
    }
  }

  /**
   * Get food waste analytics for household or user
   */
  static async getAnalytics(householdId?: string, userId?: string): Promise<FoodWasteAnalytics | null> {
    try {
      if (!householdId && !userId) return null;

      const collectionPath = householdId ? this.HOUSEHOLD_COLLECTION : this.USER_COLLECTION;
      const docId = householdId || userId!;
      const analyticsRef = doc(db, collectionPath, docId, 'analytics', this.ANALYTICS_DOC);

      const analyticsSnap = await getDoc(analyticsRef);
      if (!analyticsSnap.exists()) return null;

      const data = analyticsSnap.data();

      // Convert Timestamps back to Dates
      return {
        ...data,
        disposalHistory: data.disposalHistory?.map((record: any) => ({
          ...record,
          disposalDate: record.disposalDate?.toDate() || new Date()
        })) || [],
        lastUpdated: data.lastUpdated?.toDate() || new Date()
      } as FoodWasteAnalytics;

    } catch (error) {
      log.error('Failed to get food waste analytics:', { error }, 'FoodWasteAnalyticsService');
      return null;
    }
  }

  /**
   * Get disposal records within a date range
   */
  static async getDisposalsInRange(
    startDate: Date,
    endDate: Date,
    householdId?: string,
    userId?: string
  ): Promise<DisposalRecord[]> {
    try {
      const analytics = await this.getAnalytics(householdId, userId);
      if (!analytics) return [];

      return analytics.disposalHistory.filter(record =>
        record.disposalDate >= startDate && record.disposalDate <= endDate
      );
    } catch (error) {
      log.error('Failed to get disposals in range:', { error }, 'FoodWasteAnalyticsService');
      return [];
    }
  }
}

export default FoodWasteAnalyticsService;