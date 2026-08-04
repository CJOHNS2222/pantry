import { useState, useRef, useEffect } from 'react';
import { User, PantryItem, StructuredRecipe, SavedRecipe, Household, DayPlan } from '../types';
import { AppNotification } from '../services/notificationService';
import { useAndroidBack } from './useAndroidBack';
import { getUnlockedBadges } from '../utils/achievementUtils';
import { useCelebrationFireworks } from './useCelebrationFireworks';
import { getExpiredLaunchEnabled } from '../components/pantry/ExpiredItemsLaunchSheet';

interface UseAppModalsProps {
  user: User | null;
  inventory: PantryItem[];
  savedRecipes: SavedRecipe[];
  mealPlan: DayPlan[];
  household: Household | null;
  isLoadingInventory: boolean;
  isLoadingSavedRecipes: boolean;
  isLoadingMealPlan: boolean;
  isLoadingHousehold: boolean;
}

export function useAppModals({
  user,
  inventory,
  savedRecipes,
  mealPlan,
  household,
  isLoadingInventory,
  isLoadingSavedRecipes,
  isLoadingMealPlan,
  isLoadingHousehold,
}: UseAppModalsProps) {
  // Modal Visibility & Item States
  const [showHousehold, setShowHousehold] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showHouseholdInviteModal, setShowHouseholdInviteModal] = useState(false);
  const [showExpiredItemsModal, setShowExpiredItemsModal] = useState(false);
  const [expiredItemsModalSpecificItems, setExpiredItemsModalSpecificItems] = useState<PantryItem[] | undefined>(undefined);
  const [showExpiredLaunchSheet, setShowExpiredLaunchSheet] = useState(false);
  const [expiredLaunchItems, setExpiredLaunchItems] = useState<PantryItem[]>([]);
  const hasShownExpiredLaunchRef = useRef(false);
  const retryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [notificationViewItem, setNotificationViewItem] = useState<{ item: PantryItem; index: number } | null>(null);
  const [showAddToPlanDialog, setShowAddToPlanDialog] = useState(false);
  const [pendingRecipeForPlan, setPendingRecipeForPlan] = useState<StructuredRecipe | null>(null);
  const [selectedDayForPlan, setSelectedDayForPlan] = useState<number | null>(null);
  const [selectedMealForPlan, setSelectedMealForPlan] = useState<'breakfast' | 'lunch' | 'dinner' | null>(null);
  const [householdInvites, setHouseholdInvites] = useState<AppNotification[]>([]);

  // Achievements & Fireworks
  const [newlyUnlockedBadge, setNewlyUnlockedBadge] = useState<{ id: string; title: string; icon: string; description: string; color: string } | null>(null);
  const { canvasRef: fireworksCanvasRef, triggerCelebration } = useCelebrationFireworks();

  // Global Recipe Modal states
  const [globalModalRecipe, setGlobalModalRecipe] = useState<StructuredRecipe | null>(null);
  const [showGlobalRecipeModal, setShowGlobalRecipeModal] = useState(false);
  const [globalModalIsSavedView, setGlobalModalIsSavedView] = useState(false);

  // Register all App-level modals on the shared LIFO back-button stack
  useAndroidBack(showOnboarding, () => setShowOnboarding(false));
  useAndroidBack(showAddToPlanDialog, () => setShowAddToPlanDialog(false));
  useAndroidBack(notificationViewItem !== null, () => setNotificationViewItem(null));
  useAndroidBack(showNotificationsModal, () => setShowNotificationsModal(false));
  useAndroidBack(showHouseholdInviteModal, () => setShowHouseholdInviteModal(false));
  useAndroidBack(showExpiredItemsModal, () => setShowExpiredItemsModal(false));
  useAndroidBack(showExpiredLaunchSheet, () => setShowExpiredLaunchSheet(false));
  useAndroidBack(showHousehold, () => setShowHousehold(false));
  useAndroidBack(newlyUnlockedBadge !== null, () => setNewlyUnlockedBadge(null));
  useAndroidBack(showGlobalRecipeModal, () => setShowGlobalRecipeModal(false));

  // Effect to monitor and trigger new achievements instantly
  useEffect(() => {
    if (!user || isLoadingInventory || isLoadingSavedRecipes || isLoadingMealPlan || isLoadingHousehold || showOnboarding) return;

    const unlocked = getUnlockedBadges(inventory, savedRecipes, mealPlan, household);
    const unlockedIds = unlocked.map(b => b.id);

    const savedUnlockedRaw = localStorage.getItem('pantry_unlocked_achievements');
    let savedUnlockedIds: string[] = [];
    if (savedUnlockedRaw) {
      try {
        savedUnlockedIds = JSON.parse(savedUnlockedRaw);
      } catch {
        savedUnlockedIds = [];
      }
    } else {
      localStorage.setItem('pantry_unlocked_achievements', JSON.stringify(unlockedIds));
      return;
    }

    const newlyUnlocked = unlocked.find(b => !savedUnlockedIds.includes(b.id));

    if (newlyUnlocked) {
      setNewlyUnlockedBadge(newlyUnlocked);
      localStorage.setItem('pantry_unlocked_achievements', JSON.stringify([...savedUnlockedIds, newlyUnlocked.id]));
      setTimeout(() => {
        triggerCelebration();
      }, 300);
    }
  }, [inventory, savedRecipes, mealPlan, household, user, isLoadingInventory, isLoadingSavedRecipes, isLoadingMealPlan, isLoadingHousehold, showOnboarding, triggerCelebration]);

  // Global handler to open recipe modal from anywhere without switching tabs
  useEffect(() => {
    const handleOpenRecipeModal = (event: CustomEvent) => {
      const { recipe, isSavedView, isFromMealPlanner } = event.detail;
      if (isFromMealPlanner) return;
      setGlobalModalRecipe(recipe);
      setGlobalModalIsSavedView(Boolean(isSavedView));
      setShowGlobalRecipeModal(true);
    };
    window.addEventListener('openRecipeModal', handleOpenRecipeModal as EventListener);
    return () => window.removeEventListener('openRecipeModal', handleOpenRecipeModal as EventListener);
  }, []);

  // Show expired items launch sheet once per session when user has opted in
  useEffect(() => {
    if (hasShownExpiredLaunchRef.current) return;
    if (!user || inventory.length === 0) return;
    if (!getExpiredLaunchEnabled()) return;

    const tryShow = (): boolean => {
      if (hasShownExpiredLaunchRef.current) return true;
      const today = new Date().toISOString().slice(0, 10);
      const expired = inventory.filter(item => {
        if (!item.expirationDate || item.is_immortal) return false;
        if (item.is_frozen || item.storageLocation === 'freezer') {
          const ref = item.freezerExpiry || item.expirationDate;
          return ref <= today;
        }
        return item.expirationDate <= today;
      });
      if (expired.length === 0) return true;
      if (document.body.classList.contains('modal-open')) return false;
      hasShownExpiredLaunchRef.current = true;
      setExpiredLaunchItems(expired);
      setShowExpiredLaunchSheet(true);
      return true;
    };

    const timer = setTimeout(() => {
      if (tryShow()) return;
      const retryInterval = setInterval(() => {
        if (tryShow()) clearInterval(retryInterval);
      }, 2000);
      retryIntervalRef.current = retryInterval;
    }, 1500);

    return () => {
      clearTimeout(timer);
      if (retryIntervalRef.current) clearInterval(retryIntervalRef.current);
    };
  }, [user, inventory]);

  return {
    showHousehold,
    setShowHousehold,
    showOnboarding,
    setShowOnboarding,
    showNotificationsModal,
    setShowNotificationsModal,
    showHouseholdInviteModal,
    setShowHouseholdInviteModal,
    showExpiredItemsModal,
    setShowExpiredItemsModal,
    expiredItemsModalSpecificItems,
    setExpiredItemsModalSpecificItems,
    showExpiredLaunchSheet,
    setShowExpiredLaunchSheet,
    expiredLaunchItems,
    setExpiredLaunchItems,
    notificationViewItem,
    setNotificationViewItem,
    showAddToPlanDialog,
    setShowAddToPlanDialog,
    pendingRecipeForPlan,
    setPendingRecipeForPlan,
    selectedDayForPlan,
    setSelectedDayForPlan,
    selectedMealForPlan,
    setSelectedMealForPlan,
    householdInvites,
    setHouseholdInvites,
    newlyUnlockedBadge,
    setNewlyUnlockedBadge,
    fireworksCanvasRef,
    globalModalRecipe,
    setGlobalModalRecipe,
    showGlobalRecipeModal,
    setShowGlobalRecipeModal,
    globalModalIsSavedView,
    setGlobalModalIsSavedView,
  };
}
