import { increment } from 'firebase/firestore';
import DatabaseMonitoringService from './databaseMonitoringService';
import { log } from './logService';

/**
 * Simplified food waste analytics — summary counters only, no per-item history.
 * Counters are embedded in the inventory cache document under a `_foodWaste` field,
 * so they are updated atomically with item removal (zero extra reads per disposal).
 */

export interface FoodWasteSummary {
  totalItemsDisposed: number;
  itemsByReason: {
    thrown_away: number;
    cooked: number;
    remove: number;
  };
  totalEstimatedValue: number;
  totalDaysExpired: number;
  totalCookedValue: number;
}

// Keep FoodWasteAnalytics as the interface the UI expects so no UI changes are needed
export interface FoodWasteAnalytics extends FoodWasteSummary {
  averageDaysExpired: number;
  // disposalHistory removed — no longer stored
  disposalHistory: never[];
  lastUpdated?: Date;
}

// Legacy alias so existing imports don't break
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
  estimatedValue?: number;
}

class FoodWasteAnalyticsService {
  private static readonly HOUSEHOLD_COLLECTION = 'households';
  private static readonly USER_COLLECTION = 'users';
  static readonly FOOD_WASTE_FIELD = '_foodWaste';

  static getCachePath(householdId?: string, userId?: string): string {
    if (householdId) return `${this.HOUSEHOLD_COLLECTION}/${householdId}/cache/inventory`;
    if (userId) return `${this.USER_COLLECTION}/${userId}/cache/inventory`;
    throw new Error('Either householdId or userId must be provided');
  }

  /**
   * Record a disposal event.
   * Writes atomically to the inventory cache document using server-side increment() —
   * zero extra reads, no Timestamp deserialization issues.
   */
  static async recordDisposal(
    disposal: Omit<DisposalRecord, 'id' | 'disposalDate'>,
    householdId?: string
  ): Promise<void> {
    try {
      if (disposal.userId === 'guest') {
        this.recordGuestDisposal(disposal);
        return;
      }

      const cachePath = this.getCachePath(householdId, disposal.userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);
      const fw = this.FOOD_WASTE_FIELD;
      const estimatedValue = disposal.estimatedValue ?? 2.50;
      const daysExpired = disposal.daysExpired ?? 0;
      const isCooked = disposal.disposalReason === 'cooked';

      const updateData: Record<string, any> = {
        [`${fw}.totalItemsDisposed`]: increment(1),
        [`${fw}.itemsByReason.${disposal.disposalReason}`]: increment(1),
        [`${fw}.totalEstimatedValue`]: increment(estimatedValue),
        [`${fw}.totalDaysExpired`]: increment(daysExpired),
      };

      if (isCooked) {
        updateData[`${fw}.totalCookedValue`] = increment(estimatedValue);
      }

      await DatabaseMonitoringService.updateDoc(cacheRef, updateData);
    } catch (error) {
      log.error('Failed to record disposal analytics:', { error }, 'FoodWasteAnalyticsService');
      // Don't re-throw — analytics failure should never block inventory operations
    }
  }

  /**
   * Record disposal events for multiple items in a single atomic write.
   * Used by the bulk-delete path to avoid N separate writes.
   */
  static async recordBulkDisposals(
    disposals: Array<Omit<DisposalRecord, 'id' | 'disposalDate'>>,
    householdId?: string
  ): Promise<void> {
    if (!disposals.length) return;
    const firstDisposal = disposals[0];

    try {
      if (firstDisposal.userId === 'guest') {
        for (const d of disposals) this.recordGuestDisposal(d);
        return;
      }

      const cachePath = this.getCachePath(householdId, firstDisposal.userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);
      const fw = this.FOOD_WASTE_FIELD;

      const totalValue = disposals.reduce((s, d) => s + (d.estimatedValue ?? 2.50), 0);
      const totalDays = disposals.reduce((s, d) => s + (d.daysExpired ?? 0), 0);
      const totalCookedValue = disposals
        .filter(d => d.disposalReason === 'cooked')
        .reduce((s, d) => s + (d.estimatedValue ?? 2.50), 0);

      const reasonCounts: Record<string, number> = { thrown_away: 0, cooked: 0, remove: 0 };
      for (const d of disposals) reasonCounts[d.disposalReason] = (reasonCounts[d.disposalReason] ?? 0) + 1;

      const updateData: Record<string, any> = {
        [`${fw}.totalItemsDisposed`]: increment(disposals.length),
        [`${fw}.totalEstimatedValue`]: increment(totalValue),
        [`${fw}.totalDaysExpired`]: increment(totalDays),
      };

      if (totalCookedValue > 0) {
        updateData[`${fw}.totalCookedValue`] = increment(totalCookedValue);
      }

      for (const [reason, count] of Object.entries(reasonCounts)) {
        if (count > 0) updateData[`${fw}.itemsByReason.${reason}`] = increment(count);
      }

      await DatabaseMonitoringService.updateDoc(cacheRef, updateData);
    } catch (error) {
      log.error('Failed to record bulk disposal analytics:', { error }, 'FoodWasteAnalyticsService');
    }
  }

  /**
   * Get food waste analytics — reads from the inventory cache doc.
   * Prefer getAnalyticsFromData() if you already have the cache snapshot in memory.
   */
  static async getAnalytics(householdId?: string, userId?: string): Promise<FoodWasteAnalytics | null> {
    try {
      if (userId === 'guest') {
        return this.getGuestAnalytics();
      }

      if (!householdId && !userId) return null;

      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);
      const snap = await DatabaseMonitoringService.getDoc(cacheRef);

      if (!snap.exists()) return null;

      const raw = snap.data()?.[this.FOOD_WASTE_FIELD];
      return this.summaryToAnalytics(raw);
    } catch (error) {
      log.error('Failed to get food waste analytics:', { error }, 'FoodWasteAnalyticsService');
      return null;
    }
  }

  /**
   * Build a FoodWasteAnalytics object directly from inventory cache snapshot data.
   * Use this to avoid an extra getDoc when the cache data is already in memory.
   */
  static getAnalyticsFromData(cacheDocData: Record<string, any>): FoodWasteAnalytics | null {
    const raw = cacheDocData[this.FOOD_WASTE_FIELD];
    return this.summaryToAnalytics(raw);
  }

  private static summaryToAnalytics(raw: any): FoodWasteAnalytics | null {
    if (!raw) return null;

    const totalItemsDisposed: number = Number(raw.totalItemsDisposed ?? 0);
    const totalDaysExpired: number = Number(raw.totalDaysExpired ?? 0);
    const averageDaysExpired = totalItemsDisposed > 0 ? totalDaysExpired / totalItemsDisposed : 0;

    return {
      totalItemsDisposed,
      itemsByReason: {
        thrown_away: Number(raw.itemsByReason?.thrown_away ?? 0),
        cooked: Number(raw.itemsByReason?.cooked ?? 0),
        remove: Number(raw.itemsByReason?.remove ?? 0),
      },
      totalEstimatedValue: Number(raw.totalEstimatedValue ?? 0),
      totalCookedValue: Number(raw.totalCookedValue ?? 0),
      totalDaysExpired,
      averageDaysExpired,
      disposalHistory: [],
    };
  }

  // ── Guest (localStorage) path ──────────────────────────────────────────────

  private static recordGuestDisposal(disposal: Omit<DisposalRecord, 'id' | 'disposalDate'>): void {
    const raw = this.readGuestSummary();
    raw.totalItemsDisposed += 1;
    raw.itemsByReason[disposal.disposalReason] = (raw.itemsByReason[disposal.disposalReason] ?? 0) + 1;
    raw.totalEstimatedValue += disposal.estimatedValue ?? 2.50;
    raw.totalDaysExpired += disposal.daysExpired ?? 0;
    if (disposal.disposalReason === 'cooked') {
      raw.totalCookedValue += disposal.estimatedValue ?? 2.50;
    }
    localStorage.setItem('guest_food_waste_summary', JSON.stringify(raw));
  }

  private static readGuestSummary(): FoodWasteSummary {
    try {
      const raw = localStorage.getItem('guest_food_waste_summary');
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          totalItemsDisposed: parsed.totalItemsDisposed ?? 0,
          itemsByReason: {
            thrown_away: parsed.itemsByReason?.thrown_away ?? 0,
            cooked: parsed.itemsByReason?.cooked ?? 0,
            remove: parsed.itemsByReason?.remove ?? 0,
          },
          totalEstimatedValue: parsed.totalEstimatedValue ?? 0,
          totalCookedValue: parsed.totalCookedValue ?? 0,
          totalDaysExpired: parsed.totalDaysExpired ?? 0,
        };
      }
    } catch { /* corrupt localStorage */ }
    return { totalItemsDisposed: 0, itemsByReason: { thrown_away: 0, cooked: 0, remove: 0 }, totalEstimatedValue: 0, totalCookedValue: 0, totalDaysExpired: 0 };
  }

  private static getGuestAnalytics(): FoodWasteAnalytics {
    const summary = this.readGuestSummary();
    const averageDaysExpired = summary.totalItemsDisposed > 0 ? summary.totalDaysExpired / summary.totalItemsDisposed : 0;
    return { ...summary, averageDaysExpired, disposalHistory: [] };
  }

  // Legacy method — kept for compatibility; no history is stored
  static async getDisposalsInRange(_start: Date, _end: Date, _householdId?: string, _userId?: string): Promise<never[]> {
    return [];
  }
}

export default FoodWasteAnalyticsService;

