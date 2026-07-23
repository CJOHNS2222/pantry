import { PantryItem, SavedRecipe, Household, DayPlan } from '../types';
import { getCookingStreak as getCookingStreakSynced } from '../services/cookingStreakService';

export interface AchievementBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  isUnlocked: boolean;
  tip: string;
}

// Pantry Score Calculation Helper (Mirrors PantryHealthScore.tsx)
export const calculatePantryScore = (items: PantryItem[]) => {
  if (!items.length) return 0;
  const total = items.length;

  // Factor 1: Freshness (no expired items)
  const expiredCount = items.filter(i => {
    if (!i.expirationDate) return false;
    return new Date(i.expirationDate).getTime() < Date.now();
  }).length;
  const expiringSoonCount = items.filter(i => {
    if (!i.expirationDate) return false;
    const diff = Math.ceil((new Date(i.expirationDate).getTime() - Date.now()) / 86400000);
    return diff >= 0 && diff <= 3;
  }).length;
  const freshnessPoints = Math.max(0, 30 - expiredCount * 10 - expiringSoonCount * 3);

  // Factor 2: Variety (different categories)
  const categories = new Set(items.map(i => i.category || 'other'));
  const varietyPoints = Math.min(25, categories.size * 3);

  // Factor 3: Stock level
  const inStockCount = items.filter(i => {
    const q = i.quantity;
    if (q == null) return true;
    if (typeof q === 'number') return q > 0;
    return q.amount > 0;
  }).length;
  const stockPoints = Math.round((inStockCount / total) * 20);

  // Factor 4: Expiry tracking
  const trackedCount = items.filter(i => !!i.expirationDate).length;
  const trackingPoints = Math.round((trackedCount / total) * 15);

  // Factor 5: Recency
  const thirtyDaysAgo = Date.now() - 30 * 86400000;
  const recentCount = items.filter(i => {
    const t = i.lastRestocked ? new Date(i.lastRestocked).getTime()
            : i.dateAdded   ? new Date(i.dateAdded).getTime()
            : 0;
    return t > thirtyDaysAgo;
  }).length;
  const recencyPoints = Math.round((recentCount / total) * 10);

  const rawScore = freshnessPoints + varietyPoints + stockPoints + trackingPoints + recencyPoints;
  return Math.min(100, Math.max(0, rawScore));
};

// Cooking Streak — re-exported from cookingStreakService, which backs it with a
// Firestore-synced cache (see services/cookingStreakService.ts) instead of raw
// per-device localStorage.
export const getCookingStreak = getCookingStreakSynced;

export const getUnlockedBadges = (
  inventory: PantryItem[],
  savedRecipes: SavedRecipe[],
  mealPlan: DayPlan[],
  household: Household | null
): Array<{ id: string; title: string; icon: string; description: string; color: string }> => {
  const expiredCount = inventory.filter(i => {
    if (!i.expirationDate) return false;
    return new Date(i.expirationDate).getTime() < Date.now();
  }).length;

  const userScore = calculatePantryScore(inventory);
  const userStreak = getCookingStreak();
  const uniqueCategoriesCount = new Set(inventory.map(i => i.category || 'other')).size;
  const hasMealsPlanned = mealPlan.some(day => (day.breakfast?.length || 0) + (day.lunch?.length || 0) + (day.dinner?.length || 0) > 0);

  const badges = [
    {
      id: 'waste_warrior',
      title: 'Waste Warrior',
      description: 'Have zero expired items in your pantry with at least 5 items tracked.',
      icon: '🥬',
      color: 'from-green-400 to-emerald-600',
      isUnlocked: inventory.length >= 5 && expiredCount === 0
    },
    {
      id: 'master_chef',
      title: 'Master Chef',
      description: 'Save at least 5 delicious recipes to your personal recipe box.',
      icon: '🍳',
      color: 'from-orange-400 to-red-600',
      isUnlocked: savedRecipes.length >= 5
    },
    {
      id: 'pantry_architect',
      title: 'Pantry Architect',
      description: 'Diversify your inventory by stocking items across 4 distinct categories.',
      icon: '🌈',
      color: 'from-purple-400 to-indigo-600',
      isUnlocked: uniqueCategoriesCount >= 4
    },
    {
      id: 'scan_master',
      title: 'Scan Master',
      description: 'Add at least 10 items to your pantry to build a healthy stock.',
      icon: '📦',
      color: 'from-blue-400 to-cyan-600',
      isUnlocked: inventory.length >= 10
    },
    {
      id: 'streak_builder',
      title: 'Streak Builder',
      description: 'Reach a consecutive 2-day cooking streak by preparing planned meals.',
      icon: '🔥',
      color: 'from-amber-400 to-orange-500',
      isUnlocked: userStreak >= 2
    },
    {
      id: 'freshness_guru',
      title: 'Freshness Guru',
      description: 'Maintain an excellent Pantry Health Score of 85 or above.',
      icon: '💎',
      color: 'from-teal-400 to-emerald-500',
      isUnlocked: userScore >= 85 && inventory.length > 0
    },
    {
      id: 'meal_planner',
      title: 'Meal Planner',
      description: 'Schedule at least one meal in your calendar to prepare for the week.',
      icon: '📅',
      color: 'from-pink-400 to-rose-500',
      isUnlocked: hasMealsPlanned
    },
    {
      id: 'eco_collaborator',
      title: 'Eco Collaborator',
      description: 'Link your pantry with a household member to coordinate shopping and waste.',
      icon: '🤝',
      color: 'from-violet-400 to-fuchsia-600',
      isUnlocked: household !== null
    }
  ];

  return badges.filter(b => b.isUnlocked);
};
