import { arrayUnion, arrayRemove } from 'firebase/firestore';
import { DayPlan, MealPlanItem } from '../types';
import DatabaseMonitoringService from './databaseMonitoringService';

export const CACHE_VERSION = '1.0';

// A helper function to recursively remove undefined properties from an object
const sanitizeObject = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)).filter((item): item is any => item !== undefined);
  }

  const newObj: { [key: string]: any } = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = sanitizeObject(obj[key]);
      if (value !== undefined) {
        newObj[key] = value;
      }
    }
  }
  return newObj;
};

const getCacheRef = (householdId?: string, userId?: string) => {
  if (householdId) {
    return DatabaseMonitoringService.doc(`households/${householdId}/cache/mealPlan`);
  } else if (userId) {
    return DatabaseMonitoringService.doc(`users/${userId}/cache/mealPlan`);
  } else {
    throw new Error('A householdId or userId must be provided');
  }
};

const updateCache = async (mealPlan: DayPlan[], householdId?: string, userId?: string) => {
  try {
    const cacheRef = getCacheRef(householdId, userId);
    
    // Only serialize days that contain meals to optimize storage size and support clearing days
    const activeDays: { [key: string]: any } = {};
    for (const day of mealPlan) {
      const hasMeals = (day.breakfast?.length || 0) > 0 || (day.lunch?.length || 0) > 0 || (day.dinner?.length || 0) > 0;
      if (hasMeals) {
        activeDays[day.date] = {
          dayName: day.dayName,
          breakfast: day.breakfast || [],
          lunch: day.lunch || [],
          dinner: day.dinner || [],
        };
      }
    }

    const dataToCache = {
      version: CACHE_VERSION,
      lastUpdated: new Date(),
      days: sanitizeObject(activeDays),
    };

    // Overwrite the entire cache document (do not merge) so that cleared days are actually deleted from Firestore
    await DatabaseMonitoringService.setDoc(cacheRef, dataToCache);
  } catch (err: any) {
    console.error('Failed to update meal plan cache:', err);
    throw err;
  }
};

const addMeal = async (date: string, mealType: 'breakfast' | 'lunch' | 'dinner', meal: MealPlanItem, householdId?: string, userId?: string) => {
  try {
    // Sanitize the meal object to remove any `undefined` values before sending to Firestore.
    const cleanMeal = sanitizeObject(meal);

    const cacheRef = getCacheRef(householdId, userId);
    const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);

    if (!docSnap.exists() || !docSnap.data()?.days?.[date]) {
      // If doc or day object doesn't exist, create it.
      const dayName = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
      
      const newDayData: { dayName: string; breakfast: any[]; lunch: any[]; dinner: any[] } = {
        dayName,
        breakfast: [],
        lunch: [],
        dinner: [],
      };
      newDayData[mealType] = [cleanMeal];

      // Ensure the version is always set, especially on document creation.
      await DatabaseMonitoringService.setDoc(cacheRef, {
        version: CACHE_VERSION,
        days: {
          [date]: newDayData
        }
      }, { merge: true });
    } else {
      // Day object exists, so we can safely use arrayUnion.
      const fieldPath = `days.${date}.${mealType}`;
      await DatabaseMonitoringService.updateDoc(cacheRef, {
        [fieldPath]: arrayUnion(cleanMeal)
      });
    }
  } catch (err: any) {
    console.error(`Failed to add meal for ${date}:`, err);
    throw err; // Rethrow the error to be handled by the calling component
  }
};

const updateMeal = async (date: string, mealType: 'breakfast' | 'lunch' | 'dinner', meal: MealPlanItem, householdId?: string, userId?: string) => {
  try {
    const cacheRef = getCacheRef(householdId, userId);
    const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        const day = data.days[date];
        if (day) {
            const mealIndex = day[mealType].findIndex((m: MealPlanItem) => m.id === meal.id);
            if (mealIndex > -1) {
                const fieldPath = `days.${date}.${mealType}`;
                const updatedMeals = [...day[mealType]];
                updatedMeals[mealIndex] = meal;
                await DatabaseMonitoringService.updateDoc(cacheRef, { [fieldPath]: updatedMeals });
            }
        }
    }
  } catch (err: any) {
    console.error(`Failed to update meal for ${date}:`, err);
  }
};

const removeMeal = async (date: string, mealType: 'breakfast' | 'lunch' | 'dinner', mealId: string, householdId?: string, userId?: string) => {
  try {
    const cacheRef = getCacheRef(householdId, userId);
    const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        const day = data.days[date];
        if (day) {
            const mealToRemove = day[mealType].find((m: MealPlanItem) => m.id === mealId);
            if (mealToRemove) {
                const fieldPath = `days.${date}.${mealType}`;
                await DatabaseMonitoringService.updateDoc(cacheRef, {
                    [fieldPath]: arrayRemove(mealToRemove)
                });
            }
        }
    }
  } catch (err: any) {
    console.error(`Failed to remove meal for ${date}:`, err);
  }
};

const getCachedMealPlan = async (householdId?: string, userId?: string): Promise<DayPlan[]> => {
  try {
    const cacheRef = getCacheRef(householdId, userId);
    const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && data.version === CACHE_VERSION && data.days) {
        return Object.entries(data.days).map(([date, dayData]: [string, any]) => ({
          date,
          dayName: dayData.dayName,
          breakfast: dayData.breakfast || [],
          lunch: dayData.lunch || [],
          dinner: dayData.dinner || [],
        }));
      }
    }
    return [];
  } catch (err: any) {
    console.error('Failed to get cached meal plan:', err);
    return [];
  }
};

const setCache = updateCache;


export const MealPlanCacheService = {
  CACHE_VERSION,
  updateCache,
  addMeal,
  updateMeal,
  removeMeal,
  getCachedMealPlan,
  setCache,
};