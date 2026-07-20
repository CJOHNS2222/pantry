import { useState, useEffect, useRef } from 'react';
import DatabaseMonitoringService from '../../services/databaseMonitoringService';
import AnalyticsService from '../../services/analyticsService';
import { UsageService } from '../../services/usageService';
import { User, Household, DayPlan, SavedRecipe, MealPlanItem, StructuredRecipe } from '../../types';
import { hasMealPlansChanged } from '../../utils/comparisonUtils';
import { setRemoteMealPlanUpdate } from '../../services/syncStateService';
import { log } from '../../services/logService';
import { ERROR_MESSAGES } from '../../constants/errorMessages';
import { MealPlanCacheService } from '../../services/MealPlanCacheService';

type AddToast = (message: string, type: 'success' | 'error' | 'info' | 'warning', duration?: number, actionLabel?: string, action?: () => void) => void;

type LoggingOptions = {
  updateActivityStatus?: (activity: string) => void;
};

type MealPlanOptions = {
  onShowAddToPlanDialog?: (recipe: StructuredRecipe) => void;
};

// Module-level cache for the rolling-window skeleton to avoid rebuilding on every Firestore snapshot.
// Only regenerated when the calendar date crosses midnight (todayKey changes).
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
let _mealPlanTemplateCacheKey = '';
let _mealPlanTemplate: Array<{ date: string; dayName: string }> = [];

function getMealPlanTemplate(todayISO: string): Array<{ date: string; dayName: string }> {
  if (_mealPlanTemplateCacheKey === todayISO) return _mealPlanTemplate;
  const today = new Date(todayISO + 'T12:00:00');
  _mealPlanTemplate = [];
  for (let i = -60; i < 60; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    _mealPlanTemplate.push({ date: iso, dayName: DAYS_OF_WEEK[d.getDay()] });
  }
  _mealPlanTemplateCacheKey = todayISO;
  return _mealPlanTemplate;
}

function createMealPlanListener(
  user: User,
  household: Household | null,
  inHousehold: boolean,
  setMealPlan: (plans: DayPlan[]) => void,
  setIsLoadingMealPlan: (loading: boolean) => void,
  prevMealPlanRef: React.MutableRefObject<DayPlan[]>
) {
  // Use user.householdId as fallback — household state may not be loaded yet when this runs
  const effectiveHouseholdId = inHousehold ? (household?.id || user.householdId) : undefined;
  const cachePath = effectiveHouseholdId
    ? `households/${effectiveHouseholdId}/cache/mealPlan`
    : `users/${user.id}/cache/mealPlan`;

  return DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.doc(cachePath), snap => {
    // 1. Build the base plan using the module-level cached template (rebuilt only when date changes).
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const template = getMealPlanTemplate(todayISO);

    const basePlan = new Map<string, DayPlan>();
    for (const { date, dayName } of template) {
      basePlan.set(date, { date, dayName, breakfast: [], lunch: [], dinner: [] });
    }

    // 2. If data exists in Firestore, merge it into the base plan.
    if (snap.exists()) {
      const data = snap.data();
      if (data && data.version === MealPlanCacheService.CACHE_VERSION) {
        const firestoreDays = data.days || {};

        for (const date in firestoreDays) {
          if (Object.prototype.hasOwnProperty.call(firestoreDays, date)) {
            const dayData = firestoreDays[date];
            basePlan.set(date, {
              date,
              dayName: DAYS_OF_WEEK[new Date(date + 'T12:00:00').getDay()],
              breakfast: Array.isArray(dayData.breakfast) ? dayData.breakfast : [],
              lunch: Array.isArray(dayData.lunch) ? dayData.lunch : [],
              dinner: Array.isArray(dayData.dinner) ? dayData.dinner : []
            });
          }
        }
      } else if (data) {
        log.warn('Meal plan cache version mismatch, ignoring remote data.', {}, 'useDataManagement');
      }
    }

    const finalPlan = Array.from(basePlan.values()).sort((a, b) => a.date.localeCompare(b.date));

    if (!hasMealPlansChanged(finalPlan, prevMealPlanRef.current)) {
      setIsLoadingMealPlan(false);
      return;
    }

    setRemoteMealPlanUpdate(true);
    setMealPlan(finalPlan);
    prevMealPlanRef.current = finalPlan.map(day => ({
      ...day,
      breakfast: [...(day.breakfast || [])],
      lunch: [...(day.lunch || [])],
      dinner: [...(day.dinner || [])]
    }));

    setIsLoadingMealPlan(false);
  }, err => {
    if (err.code !== 'permission-denied') {
      log.error('Meal plan cache listener failed:', { code: err?.code, message: err?.message }, 'useDataManagement');
    }
    setIsLoadingMealPlan(false);
  });
}

/**
 * Meal-plan domain: rolling meal plan, weekly usage limit, and Firestore/guest sync.
 */
export function useMealPlan(
  user?: User | null,
  household?: Household | null,
  addToast?: AddToast,
  loggingOptions?: LoggingOptions,
  options?: MealPlanOptions,
) {
  const [mealPlanState, setMealPlanState] = useState<DayPlan[]>([]);
  const [mealPlanLimitExceeded, setMealPlanLimitExceeded] = useState(false);
  const [isLoadingMealPlan, setIsLoadingMealPlan] = useState(true);
  const mealPlanSyncInProgressRef = useRef(false);
  const prevMealPlanRef = useRef<DayPlan[]>([]);

  const setMealPlan = (newPlan: DayPlan[] | ((prev: DayPlan[]) => DayPlan[])) => {
    setMealPlanState(newPlan);
  };

  const mealPlan = mealPlanState;

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    // Guest users: no Firestore-backed meal plan
    if (user.isGuest) {
      setIsLoadingMealPlan(false);
      return;
    }

    const inHousehold = !!user?.householdId;
    const unsub = createMealPlanListener(user, household ?? null, inHousehold, setMealPlan, setIsLoadingMealPlan, prevMealPlanRef);

    return () => {
      unsub();
    };
  }, [user?.id, user?.householdId]);

  // Keep mealPlanning.weeklyUsed Firestore counter in sync with actual current/future entries.
  // Past entries are excluded so they never count against the user's quota.
  useEffect(() => {
    if (!user || isLoadingMealPlan) return;
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const currentFutureCount = mealPlan
      .filter(day => new Date(day.date) >= weekStart)
      .reduce((count, day) => count + (day.breakfast?.length || 0) + (day.lunch?.length || 0) + (day.dinner?.length || 0), 0);
    UsageService.syncMealPlanCount(user, currentFutureCount).catch(err => {
      log.warn('Failed to sync meal plan count', { error: err }, 'DataManagement');
    });
  }, [mealPlan, user?.id, isLoadingMealPlan]);

  const checkMealPlanLimit = async () => {
    if (!user) return false;
    try {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const weeklyRecipeCount = mealPlan
        .filter(day => new Date(day.date) >= weekStart)
        .reduce((count, day) => count + (day.breakfast?.length || 0) + (day.lunch?.length || 0) + (day.dinner?.length || 0), 0);

      const canAdd = await UsageService.canAddMealPlanRecipe(user, weeklyRecipeCount);
      setMealPlanLimitExceeded(!canAdd);
      return canAdd;
    } catch (err) {
      log.error('Error checking meal plan limit:', err, 'DataManagement');
      return false;
    }
  };

  const addMealToPlan = async (date: string, mealType: 'breakfast' | 'lunch' | 'dinner', meal: MealPlanItem) => {
    if (!user?.id) return;
    try {
      await MealPlanCacheService.addMeal(date, mealType, meal, user?.householdId, user?.id);
      if (loggingOptions?.updateActivityStatus) {
        loggingOptions.updateActivityStatus('planning meals');
      }
      addToast?.(`Added ${meal.recipe.title} to your meal plan!`, 'success');
    } catch (err) {
      log.error('Error adding meal to plan:', err, 'DataManagement');
      addToast?.(ERROR_MESSAGES.SAVE_FAILED, 'error');
    }
  };

  const updateMealOnPlan = async (date: string, mealType: 'breakfast' | 'lunch' | 'dinner', meal: MealPlanItem) => {
    if (!user?.id) return;
    try {
      await MealPlanCacheService.updateMeal(date, mealType, meal, user?.householdId, user?.id);
      if (loggingOptions?.updateActivityStatus) {
        loggingOptions.updateActivityStatus('planning meals');
      }
      addToast?.(`Updated ${meal.recipe.title} on your meal plan!`, 'success');
    } catch (err) {
      log.error('Error updating meal on plan:', err, 'DataManagement');
      addToast?.(ERROR_MESSAGES.UPDATE_FAILED, 'error');
    }
  };

  const removeMealFromPlan = async (date: string, mealType: 'breakfast' | 'lunch' | 'dinner', mealId: string) => {
    if (!user?.id) return;
    try {
      await MealPlanCacheService.removeMeal(date, mealType, mealId, user?.householdId, user?.id);
      if (loggingOptions?.updateActivityStatus) {
        loggingOptions.updateActivityStatus('planning meals');
      }
      addToast?.('Removed meal from your plan!', 'success');
    } catch (err) {
      log.error('Error removing meal from plan:', err, 'DataManagement');
      addToast?.(ERROR_MESSAGES.DELETE_FAILED, 'error');
    }
  };

  const updateMealPlan = async (newPlan: DayPlan[]) => {
    if (!user?.id) return;
    if (mealPlanSyncInProgressRef.current) return; // Prevent concurrent updates
    mealPlanSyncInProgressRef.current = true;
    try {
      // Set the meal plan locally for immediate UI update
      setMealPlan(newPlan);
      // Save the entire new meal plan to the cache
      await MealPlanCacheService.setCache(newPlan, user?.householdId, user?.id);
      addToast?.('Meal plan updated successfully!', 'success');
    } catch (err) {
      log.error('Error updating meal plan:', err, 'DataManagement');
      addToast?.(ERROR_MESSAGES.UPDATE_FAILED, 'error');
    } finally {
      mealPlanSyncInProgressRef.current = false;
    }
  };

  const handleAddToPlan = async (recipe: StructuredRecipe | SavedRecipe, targetDayIndex?: number, targetMealType?: 'breakfast' | 'lunch' | 'dinner') => {
    if (!mealPlan) return;

    // If no target specified, show dialog
    if (targetDayIndex === undefined && targetMealType === undefined) {
      options?.onShowAddToPlanDialog?.(recipe);
      return;
    }

    const canAdd = await checkMealPlanLimit();
    if (!canAdd) {
      addToast?.(ERROR_MESSAGES.PLANNING_LIMIT_REACHED, 'error');
      return;
    }

    // Pre-calculate current+future count (before the add) for sync purposes.
    // The mealPlan sync effect will also re-sync once state settles, but we
    // call syncMealPlanCount here immediately so the counter is never stale.
    const _syncNow = (addedDateStr: string) => {
      if (!user) return;
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const isCurrentOrFuture = new Date(addedDateStr) >= weekStart;
      const currentFutureCount = mealPlan
        .filter(day => new Date(day.date) >= weekStart)
        .reduce((count, day) => count + (day.breakfast?.length || 0) + (day.lunch?.length || 0) + (day.dinner?.length || 0), 0);
      // +1 because mealPlan state hasn't updated yet (Firestore listener fires async)
      const syncCount = isCurrentOrFuture ? currentFutureCount + 1 : currentFutureCount;
      UsageService.syncMealPlanCount(user, syncCount).catch(err => {
        log.warn('Failed to sync meal plan count after add', { error: err }, 'DataManagement');
      });
    };

    let dayIndex = targetDayIndex;
    const mealType = targetMealType || 'breakfast';

    if (dayIndex === undefined) {
      const today = new Date().toISOString().slice(0, 10);
      dayIndex = mealPlan.findIndex(day => day.date === today);
      if (dayIndex === -1 && mealPlan.length > 0) {
        dayIndex = 0;
      }
    }

    if (dayIndex === undefined || dayIndex < 0 || dayIndex >= mealPlan.length) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().slice(0, 10);
        const mealTypeToUse = targetMealType || 'breakfast';
        const newMeal = {
          id: `meal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          recipe: recipe,
          mealType: mealTypeToUse
        };
        await addMealToPlan(dateStr, mealTypeToUse, newMeal);
        AnalyticsService.trackMealPlanAdd(recipe.id || recipe.title, recipe.title, mealTypeToUse, 0);
        _syncNow(dateStr);
        return;
    }

    const targetDate = mealPlan[dayIndex].date;
    const newMeal = {
      id: `meal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      recipe: recipe,
      mealType: mealType
    };

    await addMealToPlan(targetDate, mealType, newMeal);

    AnalyticsService.trackMealPlanAdd(recipe.id || recipe.title, recipe.title, mealType, dayIndex);
    _syncNow(targetDate);
  };

  return {
    mealPlan,
    setMealPlan,
    updateMealPlan,
    addMealToPlan,
    updateMealOnPlan,
    removeMealFromPlan,
    handleAddToPlan,
    mealPlanLimitExceeded,
    checkMealPlanLimit,
    isLoadingMealPlan,
    setIsLoadingMealPlan,
  };
}
