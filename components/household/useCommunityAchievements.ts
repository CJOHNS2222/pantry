import { useMemo } from 'react';
import { Household, PantryItem, SavedRecipe } from '../../types';
import { calculatePantryScore, getCookingStreak, AchievementBadge } from '../../utils/achievementUtils';

interface UseCommunityAchievementsArgs {
  inventory: PantryItem[];
  savedRecipes: SavedRecipe[];
  household: Household | null;
  hasMealsPlanned: boolean;
}

/**
 * Derives the gamified achievement badges (unlock state, progress, tips) from live
 * pantry/recipe/household stats. Extracted from Community.tsx (F37).
 */
export function useCommunityAchievements({ inventory, savedRecipes, household, hasMealsPlanned }: UseCommunityAchievementsArgs) {
  const userScore = useMemo(() => calculatePantryScore(inventory), [inventory]);
  const userStreak = useMemo(() => getCookingStreak(), []);

  const expiredCount = useMemo(() => {
    return inventory.filter(i => {
      if (!i.expirationDate) return false;
      return new Date(i.expirationDate).getTime() < Date.now();
    }).length;
  }, [inventory]);

  const uniqueCategoriesCount = useMemo(() => {
    return new Set(inventory.map(i => i.category || 'other')).size;
  }, [inventory]);

  const achievementsList = useMemo((): AchievementBadge[] => {
    const list: Omit<AchievementBadge, 'isUnlocked'>[] = [
      {
        id: 'waste_warrior',
        title: 'Waste Warrior',
        description: 'Have zero expired items in your pantry with at least 5 items tracked.',
        icon: '🥬',
        color: 'from-green-400 to-emerald-600',
        targetValue: 5,
        currentValue: expiredCount === 0 ? Math.min(5, inventory.length) : 0,
        unit: 'items',
        tip: expiredCount > 0 ? `Remove the ${expiredCount} expired items to unlock this badge!` : 'Keep your pantry clean of expired goods.'
      },
      {
        id: 'master_chef',
        title: 'Master Chef',
        description: 'Save at least 5 delicious recipes to your personal recipe box.',
        icon: '🍳',
        color: 'from-orange-400 to-red-600',
        targetValue: 5,
        currentValue: savedRecipes.length,
        unit: 'recipes',
        tip: 'Find recipes you love under the Chef tab and tap Save Recipe.'
      },
      {
        id: 'pantry_architect',
        title: 'Pantry Architect',
        description: 'Diversify your inventory by stocking items across 4 distinct categories.',
        icon: '🌈',
        color: 'from-purple-400 to-indigo-600',
        targetValue: 4,
        currentValue: uniqueCategoriesCount,
        unit: 'categories',
        tip: 'Try adding items in different categories like Produce, Grains, Dairy, and Spices.'
      },
      {
        id: 'scan_master',
        title: 'Scan Master',
        description: 'Add at least 10 items to your pantry to build a healthy stock.',
        icon: '📦',
        color: 'from-blue-400 to-cyan-600',
        targetValue: 10,
        currentValue: inventory.length,
        unit: 'items',
        tip: 'Quick Add or scan barcodes to log your staples and ingredients.'
      },
      {
        id: 'streak_builder',
        title: 'Streak Builder',
        description: 'Reach a consecutive 2-day cooking streak by preparing planned meals.',
        icon: '🔥',
        color: 'from-amber-400 to-orange-500',
        targetValue: 2,
        currentValue: userStreak,
        unit: 'days',
        tip: 'Mark your planned meals as made on consecutive days to maintain your cooking streak.'
      },
      {
        id: 'freshness_guru',
        title: 'Freshness Guru',
        description: 'Maintain an excellent Pantry Health Score of 85 or above.',
        icon: '💎',
        color: 'from-teal-400 to-emerald-500',
        targetValue: 85,
        currentValue: userScore,
        unit: 'points',
        tip: 'Keep your items fresh, track expiration dates, and restock regularly.'
      },
      {
        id: 'meal_planner',
        title: 'Meal Planner',
        description: 'Schedule at least one meal in your calendar to prepare for the week.',
        icon: '📅',
        color: 'from-pink-400 to-rose-500',
        targetValue: 1,
        currentValue: hasMealsPlanned ? 1 : 0,
        unit: 'meals',
        tip: 'Go to the Plan tab and add any recipe to your breakfast, lunch, or dinner slots.'
      },
      {
        id: 'eco_collaborator',
        title: 'Eco Collaborator',
        description: 'Link your pantry with a household member to coordinate shopping and waste.',
        icon: '🤝',
        color: 'from-violet-400 to-fuchsia-600',
        targetValue: 1,
        currentValue: household ? 1 : 0,
        unit: 'collaborators',
        tip: 'Invite a family member or roommate to join your household from Settings!'
      }
    ];

    return list.map(badge => {
      let isUnlocked: boolean;
      if (badge.id === 'waste_warrior') {
        isUnlocked = inventory.length >= 5 && expiredCount === 0;
      } else if (badge.id === 'freshness_guru') {
        isUnlocked = userScore >= 85 && inventory.length > 0;
      } else {
        isUnlocked = badge.currentValue >= badge.targetValue;
      }
      return { ...badge, isUnlocked };
    });
  }, [inventory.length, expiredCount, savedRecipes.length, uniqueCategoriesCount, userStreak, userScore, hasMealsPlanned, household]);

  const unlockedBadgesCount = useMemo(() => {
    return achievementsList.filter(a => a.isUnlocked).length;
  }, [achievementsList]);

  return {
    userScore,
    userStreak,
    expiredCount,
    uniqueCategoriesCount,
    achievementsList,
    unlockedBadgesCount,
  };
}
