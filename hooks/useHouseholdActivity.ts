import { useState, useEffect, useCallback } from 'react';
import { User, Household, HouseholdActivity } from '../types';
import { Tab } from '../types/app';
import { HouseholdActivityService } from '../services/householdActivityService';
import { debounce } from '../utils/debounceUtils';

export function useHouseholdActivity(user: User | null, household: Household | null, currentTab: Tab) {
  const [recentActivities, setRecentActivities] = useState<HouseholdActivity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);

  // Debounced activity update to prevent excessive Firestore writes
  const debouncedUpdateActivity = useCallback(
    debounce((userId: string, householdId: string, activity: string) => {
      HouseholdActivityService.updateMemberActivity(userId, householdId, activity);
    }, 1000), // 1 second debounce
    []
  );

  // Update member activity when tab changes
  useEffect(() => {
    if (!user?.id || !household?.id) return;

    const activityMap = {
      [Tab.PANTRY]: 'viewing pantry',
      [Tab.PANTRY_CACHE_TEST]: 'testing cached pantry',
      [Tab.SHOPPING]: 'viewing shopping list',
      [Tab.MEAL_PLAN]: 'viewing meal plan',
      [Tab.RECIPES]: 'viewing recipes',
      [Tab.SETTINGS]: 'viewing settings',
      [Tab.COMMUNITY]: 'viewing community',
      [Tab.ANALYTICS]: 'viewing analytics'
    };

    const currentActivity = activityMap[currentTab] || 'using app';
    // Temporarily disabled to test if this causes excessive reads
    // debouncedUpdateActivity(user.id, household.id, currentActivity);
  }, [currentTab, user?.id, household?.id, debouncedUpdateActivity]);

  // Mark user as offline when component unmounts or page visibility changes
  useEffect(() => {
    if (!user?.id || !household?.id) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        HouseholdActivityService.markMemberOffline(user.id, household.id);
      } else {
        const activityMap = {
          [Tab.PANTRY]: 'viewing pantry',
          [Tab.PANTRY_CACHE_TEST]: 'testing cached pantry',
          [Tab.SHOPPING]: 'viewing shopping list',
          [Tab.MEAL_PLAN]: 'viewing meal plan',
          [Tab.RECIPES]: 'viewing recipes',
          [Tab.SETTINGS]: 'viewing settings',
          [Tab.COMMUNITY]: 'viewing community',
          [Tab.ANALYTICS]: 'viewing analytics'
        };
        const currentActivity = activityMap[currentTab] || 'using app';
        // Temporarily disabled
        // debouncedUpdateActivity(user.id, household.id, currentActivity);
      }
    };

    const handleBeforeUnload = () => {
      HouseholdActivityService.markMemberOffline(user.id, household.id);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      HouseholdActivityService.markMemberOffline(user.id, household.id);
    };
  }, [user?.id, household?.id, currentTab]);

  // Subscribe to household activities
  useEffect(() => {
    if (!household?.id) {
      setRecentActivities([]);
      return;
    }

    setIsLoadingActivities(true);
    const unsubscribe = HouseholdActivityService.subscribeToActivities(household.id, (activities) => {
      setRecentActivities(activities);
      setIsLoadingActivities(false);
    });

    return unsubscribe;
  }, [household?.id]);

  // Helper functions for logging activities
  const logActivity = useCallback(async (
    action: string,
    details?: string,
    itemId?: string,
    itemName?: string
  ) => {
    if (!user?.id || !household?.id) return;

    await HouseholdActivityService.logActivity(
      household.id,
      user.id,
      user.name,
      action,
      details,
      itemId,
      itemName
    );
  }, [user, household]);

  const logItemAdded = useCallback((itemName: string, itemId?: string) => {
    logActivity('added_item', undefined, itemId, itemName);
  }, [logActivity]);

  const logItemRemoved = useCallback((itemName: string, itemId?: string) => {
    logActivity('removed_item', undefined, itemId, itemName);
  }, [logActivity]);

  const logShoppingAdded = useCallback((itemName: string, itemId?: string) => {
    logActivity('added_to_shopping', undefined, itemId, itemName);
  }, [logActivity]);

  const logRecipeSaved = useCallback((recipeName: string, recipeId?: string) => {
    logActivity('added_recipe', undefined, recipeId, recipeName);
  }, [logActivity]);

  const logMealCompleted = useCallback((mealName: string) => {
    logActivity('completed_meal', undefined, undefined, mealName);
  }, [logActivity]);

  return {
    recentActivities,
    isLoadingActivities,
    logActivity,
    logItemAdded,
    logItemRemoved,
    logShoppingAdded,
    logRecipeSaved,
    logMealCompleted
  };
}
