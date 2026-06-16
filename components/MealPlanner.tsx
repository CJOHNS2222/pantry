import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DayPlan, MealPlanItem, PantryItem, StructuredRecipe, User, SavedRecipe, ShoppingItem } from '../types';
import RecipeModal from './RecipeModal';
import { MealPrepPlanner } from './MealPrepPlanner';
import { PremiumFeature } from './PremiumFeature';
import { Tab } from '../types/app';
// Firestore access is instrumented via DatabaseMonitoringService when needed
import { parseIngredientForShoppingList } from '../utils/appUtils';
import AnalyticsService from '../services/analyticsService';
import HapticService from '../services/hapticService';
import { MealPlannerHeader } from './meal-planner/MealPlannerHeader';
import { MealPlannerPremiumContent } from './meal-planner/MealPlannerPremiumContent';
import { LeftoverModals } from './meal-planner/LeftoverModals';
import { AddMealDialog } from './meal-planner/AddMealDialog';
import { RecipeSearchOverlay } from './meal-planner/RecipeSearchOverlay';
import { MealPlanAutoFillModal, AutoFillPreferences } from './meal-planner/MealPlanAutoFillModal';
import { useMealPlannerModalStack } from './meal-planner/useMealPlannerModalStack';
import { useIntl } from 'react-intl';
import { useApp } from '../contexts/AppContext';
import { useAppActions } from '../contexts/AppActionsContext';
import { useSubscription } from '../hooks/useSubscription';
import { UsageService } from '../services/usageService';
import type { UsageLimits } from '../services/usageService';
import { useModalOpen } from '../utils/useModalOpen';
import { useAndroidBack } from '../hooks/useAndroidBack';
import { getMealPrepSuggestions } from '../utils/searchUtils';
import CalendarService from '../services/calendarService';
import type { Settings } from '../types';
import { getCachedPopularRecipes } from '../services/recipeService';
import { rankCachedRecipesByPreferences, isRecipeSafeFromAllergies } from '../utils/preferenceUtils';
import { log } from '../services/logService';

// Utility function to generate attractive recipe placeholder images
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const generateRecipePlaceholderImage = (title: string): string => {
  // Create a simple hash from the title for consistent colors
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash) + title.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Generate colors based on hash
  const hue = Math.abs(hash) % 360;
  const saturation = 65 + (Math.abs(hash) % 20); // 65-85%
  const lightness = 45 + (Math.abs(hash) % 15); // 45-60%
  
  // Create SVG with recipe icon
  const svg = `
    <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:hsl(${hue}, ${saturation}%, ${lightness}%);stop-opacity:1" />
          <stop offset="100%" style="stop-color:hsl(${(hue + 30) % 360}, ${saturation}%, ${lightness + 10}%);stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" fill="url(#bg)" rx="8"/>
      <g transform="translate(30, 30)">
        <!-- Recipe icon -->
        <circle cx="30" cy="25" r="8" fill="white" opacity="0.9"/>
        <rect x="22" y="35" width="16" height="8" fill="white" opacity="0.9" rx="2"/>
        <rect x="18" y="45" width="24" height="3" fill="white" opacity="0.7" rx="1"/>
        <rect x="18" y="50" width="20" height="3" fill="white" opacity="0.7" rx="1"/>
        <rect x="18" y="55" width="16" height="3" fill="white" opacity="0.7" rx="1"/>
      </g>
    </svg>
  `;
  
  // Convert to data URL
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

interface MealPlannerProps {
  mealPlan: DayPlan[];
  updateMealPlan: (newPlan: DayPlan[]) => void;
  inventory: PantryItem[];
  shoppingList: ShoppingItem[];
  addToShoppingList: (items: (string | { item: string; source: string; notes?: string })[], source?: string) => void;
  onAddToPlan?: (recipe: StructuredRecipe, dayIndex?: number, mealType?: 'breakfast' | 'lunch' | 'dinner') => void;
  onSaveRecipe?: (recipe: StructuredRecipe) => void;
  onMarkAsMade?: (recipe: StructuredRecipe) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onRate?: (rating: any) => void;
  user: User;
  setActiveTab: (tab: Tab) => void;
  recipeSaveLimitExceeded?: boolean;
  mealPlanLimitExceeded?: boolean;
  isLoadingMealPlan?: boolean;
  isLoadingSavedRecipes?: boolean;
  savedRecipes?: SavedRecipe[];
  settings?: Settings;
  onOpenRecipeSearch?: () => void;
}

export const MealPlanner: React.FC<MealPlannerProps> = ({ mealPlan, updateMealPlan, inventory, shoppingList, addToShoppingList, onAddToPlan, onSaveRecipe, onMarkAsMade, onRate, user, setActiveTab, recipeSaveLimitExceeded = false, mealPlanLimitExceeded = false, isLoadingMealPlan = false, savedRecipes: propSavedRecipes = [], settings }) => {
  const { addToast } = useAppActions();
  const intl = useIntl();
  const { household } = useApp();
  const { isPremium, isFamily } = useSubscription(user);
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);
  useEffect(() => {
    if (!user) return;
    UsageService.getUsageLimits(user).then(setUsageLimits).catch(() => {});
  }, [user?.id]);
  const canUseTwoWeekPlanning = usageLimits?.mealPlanning.twoWeekPlanning ?? (isPremium || isFamily);
    // List of staple items to ignore (unless user wants them included)
    const STAPLES = ['salt', 'pepper', 'oil', 'water', 'flour', 'sugar', 'butter', 'vinegar', 'baking powder', 'baking soda', 'spices', 'seasoning', 'soy sauce', 'cornstarch', 'yeast'];
    const includeStaples = settings?.shopping?.includeStaples || false;
  const [draggedMeal, setDraggedMeal] = useState<{ dayIndex: number, mealType: string, mealIndex: number } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [dragOverMealType, setDragOverMealType] = useState<{ dayIndex: number, mealType: string } | null>(null);
  const [missingItemsCount, setMissingItemsCount] = useState(0);
  const [isAddingToShopping, setIsAddingToShopping] = useState(false);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [modalRecipe, setModalRecipe] = useState<StructuredRecipe | null>(null);
  const [modalContext, setModalContext] = useState<'search' | 'scheduled'>('search');
  const [showHelpTooltip, setShowHelpTooltip] = useState(false);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [isEstimatorOpen, setIsEstimatorOpen] = useState(false);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date());

  // Use prop savedRecipes or local state as fallback
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [localSavedRecipes, setLocalSavedRecipes] = useState<SavedRecipe[]>([]);
  const savedRecipes = propSavedRecipes.length > 0 ? propSavedRecipes : localSavedRecipes;

  const [isDragging, setIsDragging] = useState(false);
  const [dragOverTrash, setDragOverTrash] = useState(false);
  const [showRecipeSearch, setShowRecipeSearch] = useState(false);
  const [searchMealType, setSearchMealType] = useState<'breakfast' | 'lunch' | 'dinner' | null>(null);
  const [showMealPrepPlanner, setShowMealPrepPlanner] = useState(false);
  const [showAutoFillModal, setShowAutoFillModal] = useState(false);
  const [showAddMealDialog, setShowAddMealDialog] = useState(false);
  const [selectedDayForDialog, setSelectedDayForDialog] = useState<number | null>(null);
  const [pendingRecipe, setPendingRecipe] = useState<StructuredRecipe | null>(null);
  const [showLeftoverPrompt, setShowLeftoverPrompt] = useState(false);
  const [showLeftoverCapture, setShowLeftoverCapture] = useState(false);
  const [leftoverServings, setLeftoverServings] = useState<number>(1);
  const [leftoverNotes, setLeftoverNotes] = useState<string>('');
  const [showLeftoverSwapModal, setShowLeftoverSwapModal] = useState(false);
  const [swapSource, setSwapSource] = useState<{ dayIndex: number; mealType: 'breakfast' | 'lunch' | 'dinner'; mealIndex: number } | null>(null);

  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['TodaysMeals']));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const closeRecipeModal = useCallback(() => {
    setShowRecipeModal(false);
  }, []);

  const closeMealPrepPlanner = useCallback(() => {
    setShowMealPrepPlanner(false);
  }, []);

  const closeRecipeSearch = useCallback(() => {
    setShowRecipeSearch(false);
    setSearchMealType(null);
  }, []);

  const closeAddMealDialog = useCallback(() => {
    setShowAddMealDialog(false);
    setPendingRecipe(null);
    setSelectedDayForDialog(null);
  }, []);

  const closeLeftoverPrompt = useCallback(() => {
    setShowLeftoverPrompt(false);
  }, []);

  const closeLeftoverCapture = useCallback(() => {
    setShowLeftoverCapture(false);
  }, []);

  const closeLeftoverSwapModal = useCallback(() => {
    setShowLeftoverSwapModal(false);
    setSwapSource(null);
  }, []);

  const { isAnyModalOpen } = useMealPlannerModalStack(
    {
      showRecipeModal,
      showRecipeSearch,
      showMealPrepPlanner,
      showAddMealDialog,
      showLeftoverPrompt,
      showLeftoverCapture,
      showLeftoverSwapModal,
    },
    {
      closeRecipeModal,
      closeRecipeSearch,
      closeMealPrepPlanner,
      closeAddMealDialog,
      closeLeftoverPrompt,
      closeLeftoverCapture,
      closeLeftoverSwapModal,
    }
  );

  useModalOpen(isAnyModalOpen);

  // Android back-button registration for all MealPlanner modals
  useAndroidBack(showRecipeModal, () => setShowRecipeModal(false));
  useAndroidBack(showRecipeSearch, () => setShowRecipeSearch(false));
  useAndroidBack(showMealPrepPlanner, () => setShowMealPrepPlanner(false));
  useAndroidBack(showAddMealDialog, () => setShowAddMealDialog(false));
  useAndroidBack(showLeftoverPrompt, () => setShowLeftoverPrompt(false));
  useAndroidBack(showLeftoverCapture, () => setShowLeftoverCapture(false));
  useAndroidBack(showLeftoverSwapModal, () => setShowLeftoverSwapModal(false));

  // Check if a day has any meals scheduled
  const hasMealsScheduled = useCallback((dayIndex: number) => {
    const day = mealPlan[dayIndex];
    if (!day) return false;
    return (day.breakfast?.length || 0) > 0 || 
           (day.lunch?.length || 0) > 0 || 
           (day.dinner?.length || 0) > 0;
  }, [mealPlan]);

  // Wrapper for onAddToPlan that shows day/meal selection dialog
  const handleAddToPlan = (recipe: StructuredRecipe) => {
    setPendingRecipe(recipe);
    setShowAddMealDialog(true);
  };

  // Actually add the recipe to the plan
  const confirmAddToPlan = (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner') => {
    if (pendingRecipe && onAddToPlan) {
      onAddToPlan(pendingRecipe, dayIndex, mealType);
      setPendingRecipe(null);
      setShowAddMealDialog(false);
    }
  };



  // Load saved recipes when meal prep planner opens
  useEffect(() => {
    // No longer need to load recipes since we use prop savedRecipes
  }, [showMealPrepPlanner, propSavedRecipes.length]);

  // Calculate meal prep suggestions based on current pantry
  const mealPrepSuggestions = useMemo(() => {
    if (savedRecipes.length === 0 || inventory.length === 0) return [];
    return getMealPrepSuggestions(savedRecipes, inventory, 60); // 60% match minimum
  }, [savedRecipes, inventory]);

  // Load saved recipes for meal prep suggestions on component mount (only if no prop recipes)
  useEffect(() => {
    // No longer need to load recipes since we use prop savedRecipes
  }, [propSavedRecipes.length]);

  // Close help tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showHelpTooltip && !(event.target as Element).closest('.help-tooltip-container')) {
        setShowHelpTooltip(false);
      }
    };

    if (showHelpTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showHelpTooltip]);

  // Auto-scroll functionality during drag
  useEffect(() => {
    let scrollInterval: NodeJS.Timeout | null = null;

    const handleDragOver = (e: DragEvent) => {
      if (!isDragging) return;

      const scrollZone = 100; // pixels from top/bottom to trigger scroll
      const scrollSpeed = 8; // pixels per frame

      // Clear existing interval
      if (scrollInterval) {
        clearInterval(scrollInterval);
        scrollInterval = null;
      }

      // Check if near top or bottom of viewport
      const viewportHeight = window.innerHeight;
      const mouseY = e.clientY;

      if (mouseY < scrollZone) {
        // Scroll up
        scrollInterval = setInterval(() => {
          window.scrollBy(0, -scrollSpeed);
        }, 16); // ~60fps
      } else if (mouseY > viewportHeight - scrollZone) {
        // Scroll down
        scrollInterval = setInterval(() => {
          window.scrollBy(0, scrollSpeed);
        }, 16);
      }
    };

    const handleDragEnd = () => {
      if (scrollInterval) {
        clearInterval(scrollInterval);
        scrollInterval = null;
      }
      setIsDragging(false);
      setDragOverDay(null);
      setDragOverMealType(null);
    };

    if (isDragging) {
      document.addEventListener('dragover', handleDragOver);
      document.addEventListener('dragend', handleDragEnd);
      document.addEventListener('drop', handleDragEnd);
    }

    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragend', handleDragEnd);
      document.removeEventListener('drop', handleDragEnd);
      if (scrollInterval) {
        clearInterval(scrollInterval);
      }
    };
  }, [isDragging]);

  // Handle recipe modal opening from search tiles
  useEffect(() => {
    const handleOpenRecipeModal = (event: CustomEvent) => {
      const { recipe } = event.detail;
      setModalRecipe(recipe);
      setModalContext('search');
      setShowRecipeModal(true);
    };

    window.addEventListener('openRecipeModal', handleOpenRecipeModal as EventListener);

    return () => {
      window.removeEventListener('openRecipeModal', handleOpenRecipeModal as EventListener);
    };
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDragStart = (e: React.DragEvent, dayIndex: number, mealType: string, mealIndex: number) => {
    setDraggedMeal({ dayIndex, mealType, mealIndex });
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";
    // Add some visual feedback
    e.dataTransfer.setData('text/plain', `${dayIndex}-${mealType}-${mealIndex}`);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDragEnd = () => {
    setDraggedMeal(null);
    setDragOverDay(null);
    setDragOverMealType(null);
    setDragOverTrash(false);
    setIsDragging(false);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDragOver = (e: React.DragEvent, dayIndex?: number, mealType?: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dayIndex !== undefined) {
      setDragOverDay(dayIndex);
      if (mealType) {
        setDragOverMealType({ dayIndex, mealType });
      } else {
        setDragOverMealType(null);
      }
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear drag over if we're actually leaving the drop zone
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverDay(null);
      setDragOverMealType(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetDayIndex: number, targetMealType?: string, isTrash?: boolean) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedMeal) return;

    if (isTrash) {
      // Remove meal from plan
      const newPlan = [...mealPlan];
      const sourceMealType = draggedMeal.mealType as 'breakfast' | 'lunch' | 'dinner';
      
      if (!newPlan[draggedMeal.dayIndex][sourceMealType]) newPlan[draggedMeal.dayIndex][sourceMealType] = [];
      newPlan[draggedMeal.dayIndex][sourceMealType] = newPlan[draggedMeal.dayIndex][sourceMealType].filter((_, i) => i !== draggedMeal.mealIndex);
      
      updateMealPlan(newPlan);
      setDraggedMeal(null);
      return;
    }

    const sourceDay = mealPlan[draggedMeal.dayIndex];
    const sourceMealType = draggedMeal.mealType as 'breakfast' | 'lunch' | 'dinner';
    
    // Initialize arrays if they don't exist
    if (!sourceDay[sourceMealType]) sourceDay[sourceMealType] = [];
    
    const mealToMove = sourceDay[sourceMealType][draggedMeal.mealIndex];

    if (!mealToMove) return;

    const newPlan = [...mealPlan];

    // Initialize target arrays if they don't exist
    if (!newPlan[targetDayIndex].breakfast) newPlan[targetDayIndex].breakfast = [];
    if (!newPlan[targetDayIndex].lunch) newPlan[targetDayIndex].lunch = [];
    if (!newPlan[targetDayIndex].dinner) newPlan[targetDayIndex].dinner = [];

    // Remove meal from source
    newPlan[draggedMeal.dayIndex][sourceMealType] = newPlan[draggedMeal.dayIndex][sourceMealType].filter((_, i) => i !== draggedMeal.mealIndex);

    // Add meal to target location
    if (targetMealType) {
      const targetArray = targetMealType as 'breakfast' | 'lunch' | 'dinner';
      newPlan[targetDayIndex][targetArray].push(mealToMove);
    } else {
      // If no specific target, add to breakfast as default
      newPlan[targetDayIndex].breakfast.push(mealToMove);
    }

    updateMealPlan(newPlan);
    setDraggedMeal(null);
    setDragOverDay(null);
    setDragOverMealType(null);
    setIsDragging(false);
  };

  const handleAddMissingToShopping = () => {
    const missing = missingIngredients;
    if (missing.length > 0) {
      setIsAddingToShopping(true);
      
      const itemsToAdd = missing.map(item => ({
        item: item.ingredient,
        source: `recipe: ${item.recipeName}`,
        notes: `recipe: need for "${item.recipeName}"`
      }));
      
      const batchSource = `meal plan: missing ingredients for planned meals`;
      
      const doAdd = async () => {
        try {
          await addToShoppingList(itemsToAdd, batchSource);
        } finally {
          setIsAddingToShopping(false);
        }
      };
      doAdd();
      addToast(`Added ${missing.length} item${missing.length > 1 ? 's' : ''} to your shopping list`, 'success');
    }
  };

  const removeMeal = (dayIndex: number, mealType: string, mealIndex: number) => {
      const newPlan = [...mealPlan];
      const mealTypeKey = mealType as 'breakfast' | 'lunch' | 'dinner';
      if (!newPlan[dayIndex][mealTypeKey]) newPlan[dayIndex][mealTypeKey] = [];
      
      // Track analytics before removing
      const mealToRemove = newPlan[dayIndex][mealTypeKey][mealIndex];
      if (mealToRemove) {
        AnalyticsService.trackMealPlanRemove(mealToRemove.recipe.id || mealToRemove.recipe.title, mealToRemove.recipe.title, mealType);
      }
      
      newPlan[dayIndex][mealTypeKey] = newPlan[dayIndex][mealTypeKey].filter((_, i) => i !== mealIndex);
      updateMealPlan(newPlan);
  };

  const handleCookedIt = (meal: MealPlanItem) => {
    HapticService.success();
    if (onMarkAsMade) {
      onMarkAsMade(meal.recipe as StructuredRecipe);
    }
    const suggestedServings = typeof meal.recipe?.servings === 'number' && meal.recipe.servings > 0 ? meal.recipe.servings : 2;
    setLeftoverServings(Math.max(1, Math.min(6, suggestedServings)));
    setLeftoverNotes(meal.recipe?.title || 'Leftover');
    setShowLeftoverPrompt(true);
    AnalyticsService.logEvent('leftover_prompt_opened_from_mealplanner', {
      recipe_title: meal.recipe?.title,
      household_id: household?.id,
    });
  };

  const leftovers = useMemo(() => {
    return (inventory || []).filter(item => item.is_leftover)
  }, [inventory]);

  const handleOpenSwapWithLeftover = (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner', mealIndex: number) => {
    setSwapSource({ dayIndex, mealType, mealIndex });
    setShowLeftoverSwapModal(true);
  };

  const handleSwapWithLeftover = (leftoverItem: PantryItem) => {
    if (!swapSource) return;

    const newPlan = [...mealPlan];
    const { dayIndex, mealType, mealIndex } = swapSource;
    const existingMeal = newPlan[dayIndex][mealType][mealIndex];

    const leftoverRecipe: StructuredRecipe = {
      id: `leftover-${leftoverItem.id}`,
      title: `Leftover: ${leftoverItem.item}`,
      description: 'Scheduled from leftovers',
      ingredients: [leftoverItem.item],
      instructions: [
        'Take from fridge/freezer and heat safely.',
        'Consume before computed best-before date.'
      ],
      cookTime: '10 mins',
      servings: typeof leftoverItem.leftoverMeta?.servings === 'number' ? leftoverItem.leftoverMeta?.servings : undefined,
      tags: ['leftover']
    };

    newPlan[dayIndex][mealType][mealIndex] = {
      id: `swap-${Date.now()}`,
      mealType,
      recipe: leftoverRecipe,
    };

    const pushForward = true; // default: push meal forward to avoid conflicts
    if (pushForward && existingMeal) {
      const targetDayIndex = (dayIndex + 1) % newPlan.length;
      if (!newPlan[targetDayIndex][mealType]) newPlan[targetDayIndex][mealType] = [];
      newPlan[targetDayIndex][mealType].push(existingMeal);
    }

    updateMealPlan(newPlan);
    setShowLeftoverSwapModal(false);
    setSwapSource(null);

    AnalyticsService.logEvent('meal_swapped_with_leftover', {
      leftover_id: leftoverItem.id,
      leftover_name: leftoverItem.item,
      source_day: dayIndex,
      source_meal_type: mealType,
      household_id: household?.id,
    });
  };

  // Helper function to check if a day is today
  const isToday = (dateString: string) => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const todayLocal = `${yyyy}-${mm}-${dd}`;
    return dateString === todayLocal;
  };

  // Get today's meals for highlighting
  const todaysMeals = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const todayLocal = `${yyyy}-${mm}-${dd}`;

    const todayPlan = mealPlan.find(day => day.date === todayLocal);
    if (!todayPlan) return [];

    // Preserve explicit mealType on each MealPlanItem instead of inferring
    const items: MealPlanItem[] = [
      ...(todayPlan.breakfast || []).map((item): MealPlanItem => ({ ...item, mealType: 'breakfast' })),
      ...(todayPlan.lunch || []).map((item): MealPlanItem => ({ ...item, mealType: 'lunch' })),
      ...(todayPlan.dinner || []).map((item): MealPlanItem => ({ ...item, mealType: 'dinner' })),
    ];

    return items;
  }, [mealPlan]);

  // Display plan rotated to start on today's date. When today's date isn't
  // present in the saved `mealPlan`, build a 7-day view starting from today
  // and map display indexes back to the original mealPlan indexes.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { displayPlan, displayToOriginal } = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const todayLocal = `${yyyy}-${mm}-${dd}`;

    // Filter out invalid or corrupted dates (more than 1 year in past/future)
    const validMealPlan = mealPlan.filter(day => {
      if (!day.date || typeof day.date !== 'string') return false;
      try {
        const dayDate = new Date(day.date);
        const diffTime = Math.abs(dayDate.getTime() - d.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 365; // Within 1 year
      } catch {
        return false;
      }
    });

    const idx = validMealPlan.findIndex(day => day.date === todayLocal);
    if (idx >= 0) {
      const rotated = [...validMealPlan.slice(idx), ...validMealPlan.slice(0, idx)];
      const mapping = rotated.map((_, i) => {
        const originalIdx = (i + idx) % validMealPlan.length;
        return validMealPlan[originalIdx] ? mealPlan.indexOf(validMealPlan[originalIdx]) : -1;
      });
      return { displayPlan: rotated, displayToOriginal: mapping };
    }

    // Build a 7-day view starting today
    const view: DayPlan[] = [];
    const mapping: number[] = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date();
      dt.setDate(d.getDate() + i);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const da = String(dt.getDate()).padStart(2, '0');
      const iso = `${y}-${m}-${da}`;
      const dayName = dt.toLocaleDateString(undefined, { weekday: 'short' });
      view.push({ date: iso, dayName, breakfast: [], lunch: [], dinner: [] } as DayPlan);
      mapping.push(-1); // No original mapping for fallback days
    }
    return { displayPlan: view, displayToOriginal: mapping };
  }, [mealPlan]);

  // Ensure all displayPlan days exist in mealPlan
  useEffect(() => {
    if (displayPlan.length > 0) {
      let needsUpdate = false;
      const newPlan = [...mealPlan];
      
      for (const day of displayPlan) {
        const existingIndex = newPlan.findIndex(d => d.date === day.date);
        if (existingIndex === -1) {
          newPlan.push({
            date: day.date,
            dayName: day.dayName,
            breakfast: [],
            lunch: [],
            dinner: []
          });
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        updateMealPlan(newPlan);
      }
    }
  }, [displayPlan, mealPlan, updateMealPlan]);

  const handleAutoFillPlan = useCallback(async (preferences: AutoFillPreferences) => {
    const newPlan = [...mealPlan];
    const d = new Date();
    const todayLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    const weekFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const expiringNames = inventory
      .filter(i => i.expirationDate && new Date(i.expirationDate).getTime() <= weekFromNow)
      .map(i => i.item.toLowerCase());

    // Load popular recipes from the cache as fallback
    let backupRecipes: SavedRecipe[] = [];
    try {
      backupRecipes = await getCachedPopularRecipes();
    } catch (err) {
      log.error('Failed to load backup popular recipes for auto-fill:', err);
    }

    if (savedRecipes.length === 0 && backupRecipes.length === 0 && (!preferences.useLeftovers || leftovers.length === 0)) {
      addToast('No saved recipes or database cache recipes available to auto-fill.', 'info');
      return;
    }

    const sortedRecipes = [...savedRecipes]
      .filter(r => isRecipeSafeFromAllergies(r, household?.members || [], user?.profile))
      .sort((a, b) => {
        // Prioritize by expiring items if selected
        if (preferences.prioritizeExpiring) {
          const aExpiring = (a.ingredients || []).some(ing => expiringNames.some(exp => ing.toLowerCase().includes(exp.split(' ')[0])));
          const bExpiring = (b.ingredients || []).some(ing => expiringNames.some(exp => ing.toLowerCase().includes(exp.split(' ')[0])));
          if (aExpiring && !bExpiring) return -1;
          if (!aExpiring && bExpiring) return 1;
        }
        return 0; // fallback to stable sort
      });

    // Rank the backup recipes by household/user preferences, strictly excluding allergy violations
    const rankedBackupRecipes = rankCachedRecipesByPreferences(
      backupRecipes.filter(r => isRecipeSafeFromAllergies(r, household?.members || [], user?.profile)),
      household?.members || [],
      user?.profile
    );

    // Keep track of recipe titles already assigned to avoid repeats
    const assignedTitles = new Set<string>();

    // Seed the assignedTitles with recipes already in the meal plan for the target days to avoid repeating what's already planned
    newPlan.forEach(day => {
      ['breakfast', 'lunch', 'dinner'].forEach(mealType => {
        const meals = day[mealType as 'breakfast' | 'lunch' | 'dinner'] || [];
        meals.forEach(m => {
          if (m.recipe?.title) {
            assignedTitles.add(m.recipe.title.toLowerCase());
          }
        });
      });
    });

    let leftoversUsed = 0;
    let daysChecked = 0;

    // Helper to select a recipe
    const selectRecipe = (): SavedRecipe | null => {
      // 1. Try to find an unused saved recipe
      const unusedSaved = sortedRecipes.filter(r => !assignedTitles.has(r.title.toLowerCase()));
      if (unusedSaved.length > 0) {
        const selected = unusedSaved[Math.floor(Math.random() * unusedSaved.length)];
        assignedTitles.add(selected.title.toLowerCase());
        return selected;
      }

      // 2. Fall back to unused ranked backup recipes
      const unusedBackup = rankedBackupRecipes.filter(r => !assignedTitles.has(r.title.toLowerCase()));
      if (unusedBackup.length > 0) {
        const candidates = unusedBackup.slice(0, 5);
        const selected = candidates[Math.floor(Math.random() * candidates.length)];
        assignedTitles.add(selected.title.toLowerCase());
        return selected;
      }

      // 3. Complete fallback: allow repeats from saved recipes first
      if (sortedRecipes.length > 0) {
        const selected = sortedRecipes[Math.floor(Math.random() * sortedRecipes.length)];
        return selected;
      }

      // 4. Ultimate fallback: repeat from backup recipes
      if (rankedBackupRecipes.length > 0) {
        const selected = rankedBackupRecipes[Math.floor(Math.random() * Math.min(10, rankedBackupRecipes.length))];
        return selected;
      }

      return null;
    };

    displayPlan.forEach((day) => {
      if (day.date < todayLocal) return;
      if (daysChecked >= preferences.daysToFill) return;
      daysChecked++;
      
      const dayIndexInMealPlan = newPlan.findIndex(d => d.date === day.date);
      if (dayIndexInMealPlan === -1) return;
      
      const targetDay = newPlan[dayIndexInMealPlan];
      
      const mealsToFill: ('breakfast' | 'lunch' | 'dinner')[] = [];
      if (preferences.mealTypes.breakfast && (!targetDay.breakfast || targetDay.breakfast.length === 0)) mealsToFill.push('breakfast');
      if (preferences.mealTypes.lunch && (!targetDay.lunch || targetDay.lunch.length === 0)) mealsToFill.push('lunch');
      if (preferences.mealTypes.dinner && (!targetDay.dinner || targetDay.dinner.length === 0)) mealsToFill.push('dinner');
      
      mealsToFill.forEach(mealType => {
          // Try to use leftover for lunch/dinner
          if (preferences.useLeftovers && leftovers.length > leftoversUsed && (mealType === 'lunch' || mealType === 'dinner')) {
             const leftoverItem = leftovers[leftoversUsed];
             leftoversUsed++;
             
             const leftoverRecipe: StructuredRecipe = {
              id: `leftover-${leftoverItem.id}`,
              title: `Leftover: ${leftoverItem.item}`,
              description: 'Auto-filled leftover',
              ingredients: [leftoverItem.item],
              instructions: ['Consume before best-before date.'],
              cookTime: '10 mins',
              servings: typeof leftoverItem.leftoverMeta?.servings === 'number' ? leftoverItem.leftoverMeta?.servings : undefined,
              tags: ['leftover']
            };
            
            if (!targetDay[mealType]) targetDay[mealType] = [];
            targetDay[mealType].push({
              id: `autofill-leftover-${Date.now()}-${Math.random()}`,
              mealType,
              recipe: leftoverRecipe,
            });
            return;
          }

          const recipe = selectRecipe();
          if (!recipe) return;
          
          if (!targetDay[mealType]) targetDay[mealType] = [];
          targetDay[mealType].push({
            id: `autofill-${Date.now()}-${Math.random()}`,
            mealType,
            recipe,
          });
      });
    });
    
    updateMealPlan(newPlan);
    addToast('Meal plan auto-filled successfully!', 'success');
    setShowAutoFillModal(false);
  }, [mealPlan, displayPlan, savedRecipes, updateMealPlan, addToast, inventory, leftovers, household, user]);

  const handleClearWeek = useCallback(() => {
    const weekStart = Math.floor(currentDayIndex / 7) * 7;
    const weekDates = new Set(
      displayPlan.slice(weekStart, weekStart + 7).map(d => d.date)
    );
    const cleared = mealPlan.map(day =>
      weekDates.has(day.date)
        ? { ...day, breakfast: [], lunch: [], dinner: [] }
        : day
    );
    updateMealPlan(cleared);
  }, [currentDayIndex, displayPlan, mealPlan, updateMealPlan]);

  const handleCopyWeek = useCallback(() => {
    const weekStart = Math.floor(currentDayIndex / 7) * 7;
    const sourceDays = displayPlan.slice(weekStart, weekStart + 7);
    const updated = mealPlan.map(day => {
      const srcDay = sourceDays.find(s => {
        const srcDate = new Date(s.date);
        srcDate.setDate(srcDate.getDate() + 7);
        return srcDate.toISOString().slice(0, 10) === day.date;
      });
      if (!srcDay) return day;
      return {
        ...day,
        breakfast: [...srcDay.breakfast],
        lunch: [...srcDay.lunch],
        dinner: [...srcDay.dinner],
      };
    });
    updateMealPlan(updated);
  }, [currentDayIndex, displayPlan, mealPlan, updateMealPlan]);

  const handleExportCalendar = useCallback(async () => {
    const weekStart = Math.floor(currentDayIndex / 7) * 7;
    const weekDays = displayPlan.slice(weekStart, weekStart + 7);
    const daysWithMeals = weekDays.filter(
      d => (d.breakfast?.length || 0) + (d.lunch?.length || 0) + (d.dinner?.length || 0) > 0
    );
    if (daysWithMeals.length === 0) {
      addToast('No meals planned this week to export.', 'info');
      return;
    }
    try {
      await CalendarService.exportWeekAsICS(daysWithMeals);
      addToast('Meal plan exported to calendar!', 'success');
    } catch {
      addToast('Failed to export calendar. Please try again.', 'error');
    }
  }, [currentDayIndex, displayPlan, addToast]);

  // Memoized missing ingredients computation
  const missingIngredients = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayLocal = `${yyyy}-${mm}-${dd}`;

    const missingWithRecipes = displayPlan
      .filter(day => day.date >= todayLocal)
      .flatMap(day => 
        [...(day.breakfast || []), ...(day.lunch || []), ...(day.dinner || [])].flatMap(meal => 
          meal.recipe.ingredients.map(ingredient => ({
            ingredient,
            recipeName: meal.recipe.title,
            recipeId: meal.recipe.id
          }))
        )
      );
    
    // Filter out staple items and duplicates (unless user wants staples included)
    const missing = missingWithRecipes.filter(item => {
      const parsed = parseIngredientForShoppingList(item.ingredient);
      const itemNameLower = parsed.itemName.toLowerCase();

      if (!includeStaples && STAPLES.some(staple => itemNameLower.includes(staple))) return false;
      
      // Check if ingredient is already in inventory
      const inInventory = inventory.some(pantryItem => 
        itemNameLower === pantryItem.item.toLowerCase() || 
        pantryItem.item.toLowerCase().includes(itemNameLower) ||
        itemNameLower.includes(pantryItem.item.toLowerCase())
      );
      
      // Check if ingredient is already in shopping list for this specific recipe
      const inShoppingList = shoppingList.some(shoppingItem => 
        shoppingItem.item.toLowerCase() === itemNameLower && 
        shoppingItem.source?.includes(item.recipeName)
      );
      
      return !inInventory && !inShoppingList;
    });

    return missing;
  }, [displayPlan, inventory, shoppingList, includeStaples]);

  // Initialize current day to today when displayPlan is available
  useEffect(() => {
    if (displayPlan.length > 0) {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const today = `${yyyy}-${mm}-${dd}`;
      
      // Always ensure we're showing today by default
      if (!isCalendarExpanded) {
        // In compact week view, today should be at index 0
        if (currentDayIndex !== 0) {
          setCurrentDayIndex(0);
        }
      } else {
        // In expanded month view, find today's position
        const todayIndex = displayPlan.findIndex(day => day.date === today);
        if (todayIndex >= 0 && todayIndex !== currentDayIndex) {
          setCurrentDayIndex(todayIndex);
        } else if (currentDayIndex >= displayPlan.length) {
          setCurrentDayIndex(0);
        }
      }
    }
  }, [displayPlan, isCalendarExpanded]); // Removed currentDayIndex from deps to prevent loops

  useEffect(() => {
    setMissingItemsCount(missingIngredients.length);
  }, [missingIngredients]);

  // Ensure a DayPlan exists in the canonical mealPlan for a given date.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const ensureDayExists = useCallback((dateIso: string, dayName?: string) => {
    const idx = mealPlan.findIndex(d => d.date === dateIso);
    if (idx >= 0) return idx;
    const newDay: DayPlan = { date: dateIso, dayName: dayName || dateIso, breakfast: [], lunch: [], dinner: [] };
    const newPlan = [...mealPlan, newDay];
    updateMealPlan(newPlan);
    return newPlan.length - 1;
  }, [mealPlan, updateMealPlan]);

  return (
    <div className="space-y-6 pb-24 animate-fade-in">
      <MealPlannerHeader
        title={intl.formatMessage({ id: 'mealPlanner.mealSchedule' })}
        showHelpTooltip={showHelpTooltip}
        onOpenMealPrepPlanner={() => setShowMealPrepPlanner(true)}
        onOpenAutoFill={() => setShowAutoFillModal(true)}
        onToggleHelpTooltip={() => setShowHelpTooltip(prev => !prev)}
      />

      <PremiumFeature
        feature="mealPlanning"
        user={user}
        limit={10}
        currentCount={(() => {
          const now = new Date();
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          weekStart.setHours(0, 0, 0, 0);
          // Only count entries in the current week or future weeks — past entries
          // should never count against the user's quota.
          return mealPlan
            .filter(day => new Date(day.date) >= weekStart)
            .reduce((total, day) => total + (day.breakfast?.length || 0) + (day.lunch?.length || 0) + (day.dinner?.length || 0), 0);
        })()}
        fallbackMessage="Upgrade to Premium to plan more than 10 meals per week"
        onUpgrade={() => setActiveTab(Tab.SETTINGS)}
      >
        <MealPlannerPremiumContent
          missingItemsCount={missingItemsCount}
          isAddingToShopping={isAddingToShopping}
          onAddMissingToShopping={handleAddMissingToShopping}
          isEstimatorOpen={isEstimatorOpen}
          showPriceData={settings?.shopping?.showPriceData ?? false}
          mealPlan={mealPlan}
          inventory={inventory}
          freeItemLimit={isPremium || isFamily ? undefined : 5}
          onEstimatorToggle={setIsEstimatorOpen}
          todaysMeals={todaysMeals}
          todaysMealsExpanded={expandedSections.has('TodaysMeals')}
          onToggleTodaysMeals={() => toggleSection('TodaysMeals')}
          onOpenScheduledMeal={(meal) => {
            setModalRecipe(meal.recipe);
            setModalContext('scheduled');
            setShowRecipeModal(true);
          }}
          mealPrepSuggestions={mealPrepSuggestions}
          onViewSuggestionRecipe={(suggestion) => {
            setModalRecipe(suggestion.recipe);
            setModalContext('search');
            setShowRecipeModal(true);
            AnalyticsService.trackEvent('meal_prep_view_recipe', {
              recipe_title: suggestion.recipe.title,
              match_percentage: suggestion.matchPercentage,
              available_ingredients: suggestion.availableIngredients,
              total_ingredients: suggestion.totalIngredients,
              can_make: suggestion.canMake
            });
          }}
          onAddSuggestionMissingIngredients={(suggestion) => {
            const missingItems = suggestion.missingIngredients
              .filter(match => !match.available)
              .map(match => match.ingredient);
            if (missingItems.length > 0) {
              addToShoppingList(missingItems);
              AnalyticsService.trackEvent('meal_prep_add_missing_ingredients', {
                recipe_title: suggestion.recipe.title,
                missing_count: missingItems.length,
                total_ingredients: suggestion.totalIngredients
              });
            }
          }}
          onViewAllSuggestions={() => setShowMealPrepPlanner(true)}
          isLoadingMealPlan={isLoadingMealPlan}
          displayPlan={displayPlan}
          currentDayIndex={currentDayIndex}
          isCalendarExpanded={isCalendarExpanded}
          currentCalendarMonth={currentCalendarMonth}
          canUseTwoWeekPlanning={canUseTwoWeekPlanning}
          hasMealsScheduled={hasMealsScheduled}
          isToday={isToday}
          hasMealsLabel={intl.formatMessage({ id: 'mealPlanner.hasMeals' })}
          onSetCalendarExpanded={setIsCalendarExpanded}
          onUpgradeMonthView={() => {
            addToast('Monthly planning is a premium feature.', 'info', 5000, 'Upgrade', () => setActiveTab(Tab.SETTINGS));
          }}
          onPrevMonth={() => {
            const newMonth = new Date(currentCalendarMonth);
            newMonth.setMonth(newMonth.getMonth() - 1);
            setCurrentCalendarMonth(newMonth);
          }}
          onNextMonth={() => {
            const newMonth = new Date(currentCalendarMonth);
            newMonth.setMonth(newMonth.getMonth() + 1);
            setCurrentCalendarMonth(newMonth);
          }}
          onGoToToday={() => {
            setCurrentCalendarMonth(new Date());
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            const todayStr = `${yyyy}-${mm}-${dd}`;
            const todayIndex = displayPlan.findIndex(day => day.date === todayStr);
            if (todayIndex >= 0) {
              setCurrentDayIndex(todayIndex);
            } else {
              setCurrentDayIndex(0);
            }
          }}
          onSelectDate={(dateString) => {
            const planIndex = displayPlan.findIndex(day => day.date === dateString);
            if (planIndex >= 0) {
              setCurrentDayIndex(planIndex);
            }
          }}
          onSelectCompactDay={setCurrentDayIndex}
          onClearWeek={handleClearWeek}
          onCopyWeek={handleCopyWeek}
          onExportCalendar={handleExportCalendar}
          onPrevDay={() => setCurrentDayIndex(Math.max(0, currentDayIndex - 1))}
          onNextDay={() => {
            if (!canUseTwoWeekPlanning && currentDayIndex >= 6) {
              addToast('Planning beyond 7 days requires Premium.', 'info', 5000, 'Upgrade', () => setActiveTab(Tab.SETTINGS));
              return;
            }
            setCurrentDayIndex(Math.min(displayPlan.length - 1, currentDayIndex + 1));
          }}
          nextDayDisabled={currentDayIndex === displayPlan.length - 1 || (!canUseTwoWeekPlanning && currentDayIndex >= 6)}
          nextDayTitle={!canUseTwoWeekPlanning && currentDayIndex >= 6 ? 'Upgrade to Premium to plan beyond 7 days' : undefined}
          onOpenMealSearch={(mealType) => {
            setSearchMealType(mealType);
            setShowRecipeSearch(true);
          }}
          onOpenRecipe={(recipe) => {
            setModalRecipe(recipe);
            setModalContext('scheduled');
            setShowRecipeModal(true);
          }}
          onCooked={handleCookedIt}
          onSwap={handleOpenSwapWithLeftover}
          onRemove={removeMeal}
          isDragging={isDragging}
          dragOverTrash={dragOverTrash}
          onDragOverTrash={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOverTrash(true);
          }}
          onDragLeaveTrash={(e) => {
            e.preventDefault();
            setDragOverTrash(false);
          }}
          onDropTrash={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDrop(e, 0, undefined, true);
            setDragOverTrash(false);
          }}
        />
      </PremiumFeature>
      
      <RecipeSearchOverlay
        show={showRecipeSearch}
        searchMealType={searchMealType}
        mealPlan={mealPlan}
        displayPlan={displayPlan}
        currentDayIndex={currentDayIndex}
        onClose={closeRecipeSearch}
        onAddRecipe={(recipe, dayIndex) => {
          if (!searchMealType) return;
          const newPlan = [...mealPlan];
          const effectiveIndex = mealPlan.findIndex(d => d.date === displayPlan[dayIndex].date);

          if (!newPlan[effectiveIndex][searchMealType]) {
            newPlan[effectiveIndex][searchMealType] = [];
          }
          newPlan[effectiveIndex][searchMealType].push({
            id: Date.now().toString(),
            recipe,
            mealType: searchMealType
          });
          updateMealPlan(newPlan);
          closeRecipeSearch();
        }}
        inventory={inventory}
        user={user}
        savedRecipes={propSavedRecipes}
        household={household}
      />

      {/* Modal for full recipe details */}
      {showRecipeModal && modalRecipe && (
        <RecipeModal
          recipe={modalRecipe}
          isOpen={showRecipeModal}
          onClose={() => setShowRecipeModal(false)}
          onAddToPlan={modalContext === 'search' ? handleAddToPlan : undefined}
          onSaveRecipe={onSaveRecipe}
          onRate={onRate}
          onMarkAsMade={modalContext === 'scheduled' ? onMarkAsMade : undefined}
          showSaveButton={true}
          showMarkAsMade={modalContext === 'scheduled'}
          isFromMealPlan={modalContext === 'scheduled'}
          showAddToPlan={modalContext === 'search'}
          recipeSaveLimitExceeded={recipeSaveLimitExceeded}
          mealPlanLimitExceeded={mealPlanLimitExceeded}
          user={user}
        />
      )}

      {/* Meal Prep Planner Modal */}
      {showMealPrepPlanner && (
        <MealPrepPlanner
          savedRecipes={savedRecipes}
          inventory={inventory}
          onAddToPlan={handleAddToPlan}
          onClose={closeMealPrepPlanner}
        />
      )}

      <LeftoverModals
        showLeftoverPrompt={showLeftoverPrompt}
        showLeftoverCapture={showLeftoverCapture}
        showLeftoverSwapModal={showLeftoverSwapModal}
        userId={user?.id}
        leftoverServings={leftoverServings}
        leftoverNotes={leftoverNotes}
        leftovers={leftovers}
        onSetLeftoverServings={setLeftoverServings}
        onCloseLeftoverPrompt={closeLeftoverPrompt}
        onOpenLeftoverCapture={() => setShowLeftoverCapture(true)}
        onCloseLeftoverCapture={closeLeftoverCapture}
        onSavedLeftoverCapture={() => {
          closeLeftoverCapture();
          AnalyticsService.logEvent('leftover_captured_from_mealplanner', { household_id: household?.id });
        }}
        onSwapWithLeftover={handleSwapWithLeftover}
        onCloseLeftoverSwap={closeLeftoverSwapModal}
      />

      <AddMealDialog
        show={showAddMealDialog}
        pendingRecipe={pendingRecipe}
        displayPlan={displayPlan}
        mealPlan={mealPlan}
        selectedDayForDialog={selectedDayForDialog}
        onSelectDay={setSelectedDayForDialog}
        onConfirm={confirmAddToPlan}
        onClose={closeAddMealDialog}
      />

      {showAutoFillModal && (
        <MealPlanAutoFillModal
          onClose={() => setShowAutoFillModal(false)}
          onAutoFill={handleAutoFillPlan}
          canUseTwoWeekPlanning={canUseTwoWeekPlanning}
        />
      )}
    </div>
  );
};
