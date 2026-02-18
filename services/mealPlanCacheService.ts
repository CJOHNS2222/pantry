import DatabaseMonitoringService from './databaseMonitoringService';
import { DayPlan, MealPlanItem } from '../types';

export interface CachedMealPlanData {
  // Date -> [dayName, breakfastItems, lunchItems, dinnerItems]
  [date: string]: [string, MealPlanItem[], MealPlanItem[], MealPlanItem[]];
}

// Metadata stored separately in the cache document
export interface MealPlanCacheMetadata {
  lastUpdated: Date;
  version: number;
  totalDays: number;
}

/**
 * Service for caching meal plan data in single documents for efficient bulk reads
 * Each day is stored as: date -> [dayName, breakfast[], lunch[], dinner[]]
 */
export class MealPlanCacheService {
  private static readonly CACHE_VERSION = 1;

  /**
   * Convert a DayPlan to a cached array format
   */
  private static dayPlanToArray(dayPlan: DayPlan): [string, MealPlanItem[], MealPlanItem[], MealPlanItem[]] {
    return [
      dayPlan.dayName,
      dayPlan.breakfast || [],
      dayPlan.lunch || [],
      dayPlan.dinner || []
    ];
  }

  /**
   * Convert cached array back to DayPlan
   */
  private static arrayToDayPlan(date: string, dayArray: [string, MealPlanItem[], MealPlanItem[], MealPlanItem[]]): DayPlan {
    return {
      date,
      dayName: dayArray[0],
      breakfast: dayArray[1],
      lunch: dayArray[2],
      dinner: dayArray[3]
    };
  }

  /**
   * Get the cache document path for a household or user
   */
  private static getCachePath(householdId?: string, userId?: string): string {
    if (householdId) {
      return `households/${householdId}/cache/mealPlan`;
    } else if (userId) {
      return `users/${userId}/cache/mealPlan`;
    }
    throw new Error('Either householdId or userId must be provided');
  }

  /**
   * Get cached meal plan data (1 read instead of N reads)
   */
  static async getCachedMealPlan(householdId?: string, userId?: string): Promise<DayPlan[]> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);
      const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as CachedMealPlanData & MealPlanCacheMetadata;

        if (data.version === this.CACHE_VERSION) {
          const mealPlans: DayPlan[] = [];
          for (const [date, dayArray] of Object.entries(data)) {
            if (date !== 'lastUpdated' && date !== 'version' && date !== 'totalDays') {
              mealPlans.push(this.arrayToDayPlan(date, dayArray));
            }
          }

          console.log(`✅ Loaded ${mealPlans.length} cached meal plan days (1 database read)`);
          return mealPlans.sort((a, b) => a.date.localeCompare(b.date));
        }
      }

      console.log('📭 No valid meal plan cache found, will load from individual documents');
      return [];
    } catch (err: any) {
      console.warn('Failed to load meal plan cache:', error);
      return [];
    }
  }

  /**
   * Update the entire meal plan cache
   */
  static async updateCache(mealPlans: DayPlan[], householdId?: string, userId?: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);

      const cachedData: CachedMealPlanData & MealPlanCacheMetadata = {
        lastUpdated: new Date(),
        version: this.CACHE_VERSION,
        totalDays: mealPlans.length
      };

      // Convert each day plan to cached format
      mealPlans.forEach(dayPlan => {
        cachedData[dayPlan.date] = this.dayPlanToArray(dayPlan);
      });

      await DatabaseMonitoringService.setDoc(cacheRef, cachedData);
      console.log(`💾 Updated meal plan cache with ${mealPlans.length} days`);
    } catch (err: any) {
      console.error('Failed to update meal plan cache:', error);
    }
  }

  /**
   * Update a specific day in the meal plan cache
   */
  static async updateDayInCache(date: string, dayPlan: DayPlan, householdId?: string, userId?: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);

      const updateData: Partial<CachedMealPlanData & MealPlanCacheMetadata> = {
        lastUpdated: new Date(),
        [date]: this.dayPlanToArray(dayPlan)
      };

      await DatabaseMonitoringService.updateDoc(cacheRef, updateData);
      console.log(`🔄 Updated meal plan cache for date: ${date}`);
    } catch (err: any) {
      console.error('Failed to update day in meal plan cache:', error);
    }
  }

  /**
   * Remove a specific day from the meal plan cache
   */
  static async removeDayFromCache(date: string, householdId?: string, userId?: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);

      const updateData = {
        lastUpdated: new Date(),
        [date]: DatabaseMonitoringService.deleteField()
      };

      await DatabaseMonitoringService.updateDoc(cacheRef, updateData);
      console.log(`🗑️ Removed day from meal plan cache: ${date}`);
    } catch (err: any) {
      console.error('Failed to remove day from meal plan cache:', error);
    }
  }

  /**
   * Clear the entire meal plan cache
   */
  static async clearCache(householdId?: string, userId?: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(householdId, userId);
      const cacheRef = DatabaseMonitoringService.doc(cachePath);
      await DatabaseMonitoringService.deleteDoc(cacheRef);
      console.log('🧹 Cleared meal plan cache');
    } catch (err: any) {
      console.error('Failed to clear meal plan cache:', error);
    }
  }
}
