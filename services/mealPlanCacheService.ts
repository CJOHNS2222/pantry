import { arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { DayPlan, MealPlanItem } from '../types';
import DatabaseMonitoringService from './databaseMonitoringService';

const CACHE_VERSION = '1.0';

const getCacheRef = (householdId?: string, userId?: string) => {
  if (householdId) {
    return DatabaseMonitoringService.doc(db, `households/${householdId}/cache/mealPlan`);
  } else if (userId) {
    return DatabaseMonitoringService.doc(db, `users/${userId}/cache/mealPlan`);
  } else {
    throw new Error('A householdId or userId must be provided');
  }
};

const setCache = async (mealPlan: DayPlan[], householdId?: string, userId?: string) => {
  try {
    const cacheRef = getCacheRef(householdId, userId);
    const dataToCache = {
      version: CACHE_VERSION,
      lastUpdated: new Date(),
      days: mealPlan.reduce((acc, day) => {
        acc[day.date] = {
          dayName: day.dayName,
          breakfast: day.breakfast || [],
          lunch: day.lunch || [],
          dinner: day.dinner || [],
        };
        return acc;
      }, {} as { [key: string]: any }),
    };
    await DatabaseMonitoringService.setDoc(cacheRef, dataToCache, { merge: true });
  } catch (err: any) {
    console.error('Failed to update meal plan cache:', err);
  }
};

const addMeal = async (date: string, mealType: 'breakfast' | 'lunch' | 'dinner', meal: MealPlanItem, householdId?: string, userId?: string) => {
  try {
    const cacheRef = getCacheRef(householdId, userId);
    const fieldPath = `days.${date}.${mealType}`;

    await DatabaseMonitoringService.updateDoc(cacheRef, {
        [fieldPath]: arrayUnion(meal)
    });
  } catch (err: any) {
    console.error(`Failed to add meal for ${date}:`, err);
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


export const MealPlanCacheService = {
  CACHE_VERSION,
  setCache,
  addMeal,
  updateMeal,
  removeMeal,
};