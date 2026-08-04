import { useEffect, useMemo, useRef } from 'react';
import { User, PantryItem, ShoppingItem, DayPlan, SavedRecipe, Household } from '../types';
import { Tab } from '../types/app';
import { recordMilestone } from '../services/onboardingMilestoneService';
import { useContextualTips } from '../components/auth-onboarding/ContextualTutorial';

interface UseFeatureMilestonesProps {
  user: User | null;
  activeTab: Tab;
  inventory: PantryItem[];
  shoppingList: ShoppingItem[];
  mealPlan: DayPlan[];
  savedRecipes: SavedRecipe[];
  household: Household | null;
  setActiveTab: (tab: Tab) => void;
  setShowHousehold: (show: boolean) => void;
}

export function useFeatureMilestones({
  user,
  activeTab,
  inventory,
  shoppingList,
  mealPlan,
  savedRecipes,
  household,
  setActiveTab,
  setShowHousehold,
}: UseFeatureMilestonesProps) {
  const visitedTabsRef = useRef<Set<Tab>>(new Set<Tab>());
  const { tips: contextualTips, addTip: addContextualTip, dismissTip: dismissContextualTip } = useContextualTips(user);

  // Milestone records
  useEffect(() => {
    if (inventory.length > 0) recordMilestone('first-pantry-item');
    if (inventory.length >= 3) recordMilestone('pantry-health-visible');
  }, [inventory.length]);

  useEffect(() => {
    if (shoppingList.length > 0) recordMilestone('first-shopping-item');
  }, [shoppingList.length]);

  useEffect(() => {
    if (mealPlan && mealPlan.some(day => day.breakfast.length > 0 || day.lunch.length > 0 || day.dinner.length > 0)) {
      recordMilestone('first-meal-planned');
    }
  }, [mealPlan]);

  useEffect(() => {
    if (inventory.some(item => item.is_leftover)) {
      recordMilestone('first-leftover-logged');
    }
  }, [inventory]);

  useEffect(() => {
    if (savedRecipes.length > 0) {
      recordMilestone('first-recipe-saved');
    }
  }, [savedRecipes.length]);

  useEffect(() => {
    if (household?.id) {
      recordMilestone('household-setup');
    }
  }, [household?.id]);

  // Contextual tutorial tips
  useEffect(() => {
    if (!user) return;
    if (visitedTabsRef.current.has(activeTab)) return;
    visitedTabsRef.current.add(activeTab);

    const tipsByTab: Partial<Record<Tab, Parameters<typeof addContextualTip>[0]>> = {
      [Tab.PANTRY]: {
        id: 'tip-pantry-scan',
        title: 'Scan Your Pantry',
        description: 'Tap the "+" button at the bottom right and select Photo to AI-scan multiple items at once — no barcode needed.',
        position: 'bottom',
        autoHideDelay: 10000,
      },
      [Tab.SHOPPING]: {
        id: 'tip-shopping-recipe',
        title: 'Add from Recipes',
        description: 'Open any recipe and tap "Add to Shopping List" to automatically add missing ingredients.',
        position: 'bottom',
        autoHideDelay: 10000,
      },
      [Tab.RECIPES]: {
        id: 'tip-recipes-pantry',
        title: 'Recipes from Your Pantry',
        description: 'Look for the "Can Make" badge — these recipes use ingredients you already have at home.',
        position: 'bottom',
        autoHideDelay: 10000,
      },
      [Tab.MEALS]: {
        id: 'tip-meals-plan',
        title: 'Build Your Meal Plan',
        description: 'Save recipes you like, then tap any day on the calendar to assign them to your meal plan.',
        position: 'bottom',
        autoHideDelay: 10000,
      },
      [Tab.COMMUNITY]: {
        id: 'tip-community-browse',
        title: 'Community Recipes',
        description: 'Browse top-rated recipes submitted by other home chefs. Rate and review recipes to share your culinary feedback!',
        position: 'bottom',
        autoHideDelay: 10000,
      },
      [Tab.SETTINGS]: {
        id: 'tip-settings-setup',
        title: 'Preferences & Sharing',
        description: 'Set up household sharing, adjust diet restrictions under Food Safety, or hide unused bottom tabs.',
        position: 'bottom',
        autoHideDelay: 10000,
      },
    };

    const tip = tipsByTab[activeTab];
    if (tip) addContextualTip(tip);
  }, [activeTab, user, addContextualTip]);

  // Feature discovery cards
  const featureDiscoveries = useMemo(() => [
    {
      featureId: 'ai-scan',
      title: 'AI-Powered Pantry Scan',
      description: 'Tap the "+" button on the Pantry tab and select Photo to instantly identify and add multiple items to your pantry — quantities and expiry dates included.',
      position: 'bottom-right' as const,
      actionLabel: 'Open Pantry',
      onAction: () => setActiveTab(Tab.PANTRY),
      autoHideDelay: 10000,
      requiredMilestone: 'onboarding-completed' as const,
    },
    {
      featureId: 'smart-recipe-search',
      title: 'Smart Recipe Search',
      description: 'Search by ingredient or cuisine — or let AI suggest meals based on what\'s already in your pantry.',
      position: 'bottom-right' as const,
      actionLabel: 'Find Recipes',
      onAction: () => setActiveTab(Tab.RECIPES),
      autoHideDelay: 10000,
      requiredMilestone: 'first-pantry-item' as const,
    },
    {
      featureId: 'leftover-tracker',
      title: 'Track Your Leftovers',
      description: 'Log leftovers with a tap and get reminders before they expire — cut food waste without any effort.',
      position: 'bottom-right' as const,
      actionLabel: 'Add a Leftover',
      onAction: () => setActiveTab(Tab.PANTRY),
      autoHideDelay: 10000,
      requiredMilestone: 'first-pantry-item' as const,
    },
    {
      featureId: 'meal-planner',
      title: 'Weekly Meal Planner',
      description: 'Plan meals for the whole week and auto-generate a shopping list for any missing ingredients.',
      position: 'bottom-right' as const,
      actionLabel: 'Plan Meals',
      onAction: () => setActiveTab(Tab.MEALS),
      autoHideDelay: 10000,
      requiredMilestone: 'first-shopping-item' as const,
    },
    {
      featureId: 'leftover-persona-tip',
      title: 'Leftover Safety Personas',
      description: 'You logged a leftover! Stock & Spoon tracks expiration based on your safety persona. Check Settings → Food Safety to customize it.',
      position: 'bottom-right' as const,
      actionLabel: 'Customize Persona',
      onAction: () => setActiveTab(Tab.SETTINGS),
      autoHideDelay: 10000,
      requiredMilestone: 'first-leftover-logged' as const,
    },
    {
      featureId: 'recipe-badging-tip',
      title: 'Smart Recipe Badging',
      description: 'Great choice! The Chef tab displays badge icons on recipes to show if you already have the required ingredients in your pantry.',
      position: 'bottom-right' as const,
      actionLabel: 'Browse Recipes',
      onAction: () => setActiveTab(Tab.RECIPES),
      autoHideDelay: 10000,
      requiredMilestone: 'first-recipe-saved' as const,
    },
    {
      featureId: 'household-collab-tip',
      title: 'Real-time Collaboration',
      description: 'You are now collaborating! Pantry items, shopping lists, and meal plans are synchronized in real-time across all household members.',
      position: 'bottom-right' as const,
      actionLabel: 'View Household',
      onAction: () => setShowHousehold(true),
      autoHideDelay: 10000,
      requiredMilestone: 'household-setup' as const,
    },
    {
      featureId: 'first-recipe-saved-tip',
      title: 'Ready to Cook? 🍳',
      description: 'Great pick! Tap any saved recipe → "Start Cooking" to open our distraction-free, screen-on Cooking Mode with inline timers and step-by-step guidance.',
      position: 'bottom-right' as const,
      actionLabel: 'View Saved Recipes',
      onAction: () => setActiveTab(Tab.RECIPES),
      autoHideDelay: 10000,
      requiredMilestone: 'first-recipe-saved' as const,
    },
    {
      featureId: 'first-meal-planned-tip',
      title: 'Pro Tip: Repeat Weekly Plans',
      description: 'You planned your first meal! Tap the copy icon in the Meal Planner to easily duplicate this week\'s plan for next week and save meal-prep time.',
      position: 'bottom-right' as const,
      actionLabel: 'View Meal Planner',
      onAction: () => setActiveTab(Tab.MEALS),
      autoHideDelay: 10000,
      requiredMilestone: 'first-meal-planned' as const,
    },
    {
      featureId: 'pantry-health-score-tip',
      title: 'Check Your Pantry Health 📊',
      description: 'Your Pantry Health Score grades your food freshness, variety, and waste reduction. Tap the score circle on the Pantry tab to see a detailed breakdown!',
      position: 'bottom-right' as const,
      actionLabel: 'View Pantry',
      onAction: () => setActiveTab(Tab.PANTRY),
      autoHideDelay: 10000,
      requiredMilestone: 'pantry-health-visible' as const,
    },
  ], [setActiveTab, setShowHousehold]);

  return {
    contextualTips,
    addContextualTip,
    dismissContextualTip,
    featureDiscoveries,
  };
}
