import React, { useState, useEffect, useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';
import DatabaseMonitoringService from '../../services/databaseMonitoringService';
import { CategoryManager } from '../pantry/CategoryManager';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { log } from '../../services/logService';
import { useIntl } from 'react-intl';
import AnalyticsService from '../../services/analyticsService';
import { useNotifications } from '../../hooks/useNotifications';
import { FAQPage } from './FAQPage';
import { User, UserProfile, CustomCategory, Member } from '../../types';
import type { Settings as AppSettings } from '../../types';

type MemberPreferences = Pick<Member, 'dietaryRestrictions' | 'allergies' | 'dietGoal' | 'favoriteCuisines' | 'specialNeeds' | 'preferredProteins' | 'dislikedIngredients'>;
import { NotificationService, NotificationSettings } from '../../services/notificationService';
import { DayPlan } from '../../types';
import { Loader2, Heart, AlertTriangle, X, Settings as SettingsIcon, User as UserIcon, ChevronLeft, ChevronRight, Sliders, Bell, TrendingDown, MessageSquare, HelpCircle, RefreshCw, Sparkles } from 'lucide-react';
import { userOptedInToGemini, setUserGeminiOptIn, getGeminiUsage } from '../../services/featureFlags';

import { Household } from '../../types';
import { serverTimestamp } from 'firebase/firestore';
import { InventoryCacheService } from '../../services/inventoryCacheService';
import { MealPlanCacheService } from '../../services/MealPlanCacheService';
import { RecipesCacheService } from '../../services/recipesCacheService';
import { useSubscription } from '../../hooks/useSubscription';
import { UsageService } from '../../services/usageService';
import type { UsageLimits } from '../../services/usageService';
import { ShoppingListCacheService } from '../../services/shoppingListCacheService';
import { setDoc } from 'firebase/firestore';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import { SettingsFeedbackSection } from './SettingsFeedbackSection';
import { SettingsAppUpdatesSection } from './SettingsAppUpdatesSection';
import { SettingsAppPreferencesSection } from './SettingsAppPreferencesSection';
import { SettingsCategoriesSection } from './SettingsCategoriesSection';
import { SettingsFoodSafetySection } from './SettingsFoodSafetySection';
import { SettingsGuestBanner } from './SettingsGuestBanner';
import { SettingsHouseholdSection } from './SettingsHouseholdSection';
import { SettingsLeftoverAnalyticsSection } from './SettingsLeftoverAnalyticsSection';
import { SettingsNotificationsSection } from './SettingsNotificationsSection';
import { SettingsPantryImagesSection } from './SettingsPantryImagesSection';
import { SettingsPendingNotificationsSection } from './SettingsPendingNotificationsSection';
import { SettingsPrivacyLegalSection } from './SettingsPrivacyLegalSection';
import { SettingsRemoteConfigDebugSection } from './SettingsRemoteConfigDebugSection';
import { SettingsResetUsageSection } from './SettingsResetUsageSection';

import { SettingsStoreLayoutSection } from './SettingsStoreLayoutSection';
import { SettingsSubscriptionSection } from './SettingsSubscriptionSection';
import { SettingsThemeSection } from './SettingsThemeSection';
import { SettingsUsageLimitsSection } from './SettingsUsageLimitsSection';
import { SettingsTabVisibilitySection } from './SettingsTabVisibilitySection';

const defaultStoreLayout = [
  'Produce',
  'Dairy',
  'Meat & Seafood',
  'Bakery',
  'Frozen',
  'Pantry Staples',
  'Snacks',
  'Beverages',
  'Household',
  'Other'
];

const defaultSettings = {
  notifications: {
    enabled: true,
    time: '09:00',
    types: {
      shoppingList: true,
      mealPlan: true,
      cookingReminders: true,
    },
    cookingReminderTime: 30, // minutes before meal
  },
  theme: {
    mode: 'dark',
    accentColor: '#4CAF50',
    backgroundColor: undefined,
    textColor: undefined,
  },
  shopping: {
    includeStaples: false,
    autoReaddStaples: true,
    storeLayout: defaultStoreLayout,
    storeProfiles: {} as Record<string, string[]>,
    activeStoreProfile: undefined as string | undefined,
    showNutrition: false,
    showPriceData: false,
  },
  navigation: {
    hiddenTabs: [] as string[],
  },
};

interface SettingsProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  user?: User;
  onLogout?: () => void;
  customCategories?: CustomCategory[];
  onAddCustomCategory?: (name: string, icon: string, color?: string) => void;
  onUpdateCustomCategory?: (categoryId: string, updates: Partial<Pick<CustomCategory, 'name' | 'icon' | 'color'>>) => void;
  onDeleteCustomCategory?: (categoryId: string) => void;
  mealPlan?: DayPlan[];
  household?: Household | null;
  onShowHousehold?: () => void;
  addToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning', duration?: number) => void;
  onReplayOnboarding?: () => void;
  activeCategory?: string | null;
  setActiveCategory?: React.Dispatch<React.SetStateAction<string | null>>;
}

const SettingsComponent: React.FC<SettingsProps> = ({
  settings = defaultSettings, 
  setSettings, 
  user, 
  onLogout,
  customCategories = [],
  onAddCustomCategory,
  onUpdateCustomCategory,
  onDeleteCustomCategory,
  mealPlan,
  household,
  onShowHousehold,
  addToast,
  onReplayOnboarding,
  activeCategory: propActiveCategory,
  setActiveCategory: propSetActiveCategory,
}) => {
  const intl = useIntl();
  const [feedback, setFeedback] = useState('');
  const [sending, setSending] = useState(false);
  const { isPremium, isFamily } = useSubscription(user || null);
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);
  const { isAdmin } = useIsAdmin(user?.id);

  // Backwards-compatible fallback to local state if parent did not pass category states
  const [localActiveCategory, localSetActiveCategory] = useState<string | null>(null);
  const activeCategory = propActiveCategory !== undefined ? propActiveCategory : localActiveCategory;
  const setActiveCategory = propSetActiveCategory || localSetActiveCategory;

  useEffect(() => {
    if (!user) return;
    UsageService.getUsageLimits(user).then(limits => setUsageLimits(limits)).catch(() => {});
  }, [user?.id]);

  // Load pantry item count for stat card
  const [pantryItemCount, setPantryItemCount] = useState<number>(0);
  useEffect(() => {
    if (!user?.id) return;
    InventoryCacheService.getCachedInventory(undefined, user.id)
      .then(items => setPantryItemCount(items?.length ?? 0))
      .catch(() => {});
  }, [user?.id]);

  const [savingProfile, setSavingProfile] = useState(false);
  const [updatingAvatar, setUpdatingAvatar] = useState(false);
  const [pendingNotifications, setPendingNotifications] = useState(settings?.notifications || defaultSettings.notifications);
  const [, setNotifChanged] = useState(false);
  const [showAvatarSelection, setShowAvatarSelection] = useState(false);

  const [profileChanged, setProfileChanged] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | undefined>(user?.profile);
  const [geminiOptedIn, setGeminiOptedIn] = useState(() => userOptedInToGemini(user?.id));
  const [, setGeminiUsage] = useState(() => getGeminiUsage(user?.id));
  const [updatingBulkImages, setUpdatingBulkImages] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(
    NotificationService.getDefaultSettings()
  );


  const [scrollToPendingNotifications, setScrollToPendingNotifications] = useState(false);

  // Redirect to requested settings category if set in sessionStorage
  useEffect(() => {
    const redirectTab = sessionStorage.getItem('settings_redirect_tab');
    if (redirectTab === 'account' || redirectTab === 'more') {
      setActiveCategory('account_info');
      sessionStorage.removeItem('settings_redirect_tab');
    } else if (redirectTab === 'preferences') {
      setActiveCategory('preferences');
      sessionStorage.removeItem('settings_redirect_tab');
    } else if (redirectTab === 'organization') {
      setActiveCategory('food_waste');
      sessionStorage.removeItem('settings_redirect_tab');
    } else if (redirectTab === 'notifications') {
      setActiveCategory('notifications');
      setScrollToPendingNotifications(true);
      sessionStorage.removeItem('settings_redirect_tab');
    }
  }, []);

  // Once the notifications category has rendered, scroll the pending-notifications card into view
  useEffect(() => {
    if (scrollToPendingNotifications && activeCategory === 'notifications') {
      document.querySelector('[data-section="pending-notifications"]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setScrollToPendingNotifications(false);
    }
  }, [scrollToPendingNotifications, activeCategory]);

  // Member preferences state
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberPreferences, setMemberPreferences] = useState<Partial<MemberPreferences>>({});
  const [savingMemberPrefs, setSavingMemberPrefs] = useState(false);
  const [showMemberPreferencesModal, setShowMemberPreferencesModal] = useState(false);

  // FAQ modal state
  const [showFAQModal, setShowFAQModal] = useState(false);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useAndroidBack(showAvatarSelection, () => setShowAvatarSelection(false));
  useAndroidBack(showCategoryManager, () => setShowCategoryManager(false));
  useAndroidBack(showMemberPreferencesModal, () => setShowMemberPreferencesModal(false));
  useAndroidBack(showFAQModal, () => setShowFAQModal(false));
  useAndroidBack(activeCategory !== null, () => setActiveCategory(null));

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeletingAccount(true);
    try {
      const fns = getFunctions();
      const deleteAccountFn = httpsCallable(fns, 'deleteAccount');
      await deleteAccountFn();
      // Auth user was deleted server-side; sign out locally
      onLogout?.();
    } catch (err: unknown) {
      log.error('Account deletion failed', err instanceof Error ? err : new Error(String(err)));
      addToast?.('Failed to delete account. Please try again or contact support.', 'error');
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteConfirm(false);
    }
  };

  // Household creation state
  const [householdName, setHouseholdName] = useState('');
  const [isCreatingHousehold, setIsCreatingHousehold] = useState(false);



  // Member preferences functions
  const openMemberPreferences = (member: Member) => {
    setSelectedMember(member);
    setMemberPreferences({
      dietaryRestrictions: member.dietaryRestrictions || [],
      allergies: member.allergies || [],
      dietGoal: member.dietGoal,
      favoriteCuisines: member.favoriteCuisines || [],
      specialNeeds: member.specialNeeds || '',
      preferredProteins: member.preferredProteins || [],
      dislikedIngredients: member.dislikedIngredients || []
    } as Partial<MemberPreferences>);
    setShowMemberPreferencesModal(true);
  };

  const closeMemberPreferences = () => {
    setSelectedMember(null);
    setMemberPreferences({});
    setShowMemberPreferencesModal(false);
  };

  const saveMemberPreferences = async () => {
    if (!selectedMember || !household) return;

    setSavingMemberPrefs(true);
    try {
      const memberIndex = household.members.findIndex(m => m.id === selectedMember.id);
      if (memberIndex === -1) return;

      const updatedMembers = [...household.members];
      updatedMembers[memberIndex] = { ...updatedMembers[memberIndex], ...memberPreferences } as Member;

      const householdRef = DatabaseMonitoringService.doc('households', household.id);
      await DatabaseMonitoringService.updateDoc(householdRef, {
        members: updatedMembers,
        updatedAt: Timestamp.now()
      });

      log.info('Member preferences updated', { memberId: selectedMember.id }, 'Settings');
      closeMemberPreferences();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      log.error('Failed saving member preferences', { message: msg, stack }, 'Settings');
    } finally {
      setSavingMemberPrefs(false);
    }
  };

  const removeMemberFromHousehold = async (member: Member) => {
    if (!household || !user) return;
    
    try {
      // Copy household data to user's personal collections
      await copyHouseholdDataToUser(member.id);
      
      // Remove member from household
      const updatedMembers = household.members.filter(m => m.id !== member.id);
      const updatedMemberIds = household.memberIds.filter(id => id !== member.id);

      const householdRef = DatabaseMonitoringService.doc('households', household.id);
      await DatabaseMonitoringService.updateDoc(householdRef, {
        members: updatedMembers,
        memberIds: updatedMemberIds,
        updatedAt: Timestamp.now()
      });

      // Update user's householdId to null
      const userRef = DatabaseMonitoringService.doc('users', member.id);
      await DatabaseMonitoringService.updateDoc(userRef, {
        householdId: null
      });

      log.info('Member removed from household', { memberId: member.id, householdId: household.id }, 'Settings');
      addToast?.(`${member.name} has been removed from the household`, 'info');
      
      // Refresh household data
      // This would need to be implemented to refresh the household state
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      log.error('Failed removing member from household', { message: msg, stack }, 'Settings');
      addToast?.('Failed to remove member from household', 'error');
    }
  };

  const copyHouseholdDataToUser = async (userId: string) => {
    try {
      // Copy inventory data
      const inventoryQuery = DatabaseMonitoringService.query(
        DatabaseMonitoringService.collection(`households/${household!.id}/inventory`)
      );
      const inventorySnapshot = await DatabaseMonitoringService.getDocs(inventoryQuery);
      
      for (const doc of inventorySnapshot.docs) {
        const itemData = doc.data();
        await setDoc(
          DatabaseMonitoringService.doc(`users/${userId}/inventory`, doc.id),
          itemData
        );
      }

      // Copy shopping list data
      const shoppingQuery = DatabaseMonitoringService.query(
        DatabaseMonitoringService.collection(`households/${household!.id}/shoppingList`)
      );
      const shoppingSnapshot = await DatabaseMonitoringService.getDocs(shoppingQuery);
      
      for (const doc of shoppingSnapshot.docs) {
        const itemData = doc.data();
        await setDoc(
          DatabaseMonitoringService.doc(`users/${userId}/shoppingList`, doc.id),
          itemData
        );
      }

      // Copy meal plan data
      const mealPlanQuery = DatabaseMonitoringService.query(
        DatabaseMonitoringService.collection(`households/${household!.id}/mealPlan`)
      );
      const mealPlanSnapshot = await DatabaseMonitoringService.getDocs(mealPlanQuery);
      
      for (const doc of mealPlanSnapshot.docs) {
        const itemData = doc.data();
        await setDoc(
          DatabaseMonitoringService.doc(`users/${userId}/mealPlan`, doc.id),
          itemData
        );
      }

      // Copy recipes data
      const recipesQuery = DatabaseMonitoringService.query(
        DatabaseMonitoringService.collection(`households/${household!.id}/recipes`)
      );
      const recipesSnapshot = await DatabaseMonitoringService.getDocs(recipesQuery);
      
      for (const doc of recipesSnapshot.docs) {
        const itemData = doc.data();
        await setDoc(
          DatabaseMonitoringService.doc(`users/${userId}/recipes`, doc.id),
          itemData
        );
      }

      log.info('Household data copied to user', { userId, householdId: household!.id }, 'Settings');
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      log.error('Failed copying household data to user', { message: msg, stack }, 'Settings');
      throw error;
    }
  };

  // Update userProfile when user data loads
  useEffect(() => {
    if (user?.profile) {
      setUserProfile(user.profile);
    }
  }, [user?.profile]);

  // Update notificationSettings when user data loads
  useEffect(() => {
    const ns = (user as User & { profile?: UserProfile & { notificationSettings?: NotificationSettings } })?.profile?.notificationSettings;
    if (ns) {
      setNotificationSettings(ns);
    }
  }, [user]);

  const handleNotificationSettingsChange = async (newSettings: NotificationSettings) => {
    setNotificationSettings(newSettings);
    if (user) {
      try {
        const userRef = DatabaseMonitoringService.doc('users', user.id);
        await DatabaseMonitoringService.updateDoc(userRef, {
          'profile.notificationSettings': newSettings
        });
        log.info('Notification settings saved to Firestore', { userId: user.id }, 'Settings');
      } catch (error) {
        log.error('Failed to save notification settings', { error }, 'Settings');
        addToast?.('Failed to save notification settings', 'error');
      }
    }
  };

  // Use the notifications hook
  useNotifications(settings.notifications, user?.email, mealPlan);

  const handleChange = (field: string, value: Record<string, unknown>) => {
    setSettings((prev) => ({
      ...prev,
      [field]: {
        ...(prev as unknown as Record<string, unknown>)[field] as object,
        ...value,
      },
    }));
    setNotifChanged(true);
  };

  const handleGeminiOptIn = (optedIn: boolean) => {
    if (user?.id) {
      setUserGeminiOptIn(user.id, optedIn);
      setGeminiOptedIn(optedIn);
      setGeminiUsage(getGeminiUsage(user.id));
    }
  };

   
  const _handleNotifChange = (key: string, value: unknown) => {
    setPendingNotifications(prev => ({
      ...prev,
      [key]: typeof value === 'object' && value !== null ? { ...(prev as Record<string, unknown>)[key] as object, ...value } : value,
    }));
    setNotifChanged(false);
  };

   
  const _confirmNotifChanges = () => {
    setSettings(prev => ({
      ...prev,
      notifications: pendingNotifications
    }));
    setNotifChanged(true);
    
    // Track notification settings update
    AnalyticsService.trackNotificationSettingsUpdate(pendingNotifications);
  };

  const handleProfileChange = (field: string, value: unknown) => {
    setUserProfile(prev => ({
      ...prev,
      [field]: value
    }));
    setProfileChanged(true);
  };

  const saveProfile = async () => {
    if (!user || !userProfile) return;
    setSavingProfile(true);
    try {
      const userRef = DatabaseMonitoringService.doc('users', user.id);
      await DatabaseMonitoringService.updateDoc(userRef, {
        profile: userProfile
      });
      setProfileChanged(false);
      addToast?.('Profile updated successfully!', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      log.error('Failed saving profile', { message: msg, stack }, 'Settings');
      addToast?.('Failed to update profile. Please try again.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveProfileData = async (data: typeof userProfile, silent = false) => {
    if (!user || !data) return;
    setSavingProfile(true);
    try {
      const userRef = DatabaseMonitoringService.doc('users', user.id);
      await DatabaseMonitoringService.updateDoc(userRef, { profile: data });
      setProfileChanged(false);
      if (!silent) addToast?.('Profile updated successfully!', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      log.error('Failed saving profile', { message: msg, stack }, 'Settings');
      if (!silent) addToast?.('Failed to update profile. Please try again.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  // Debounced save for profile changes
  const [pendingProfileSave, setPendingProfileSave] = useState<NodeJS.Timeout | null>(null);
  const debouncedSaveProfile = useCallback((data: typeof userProfile) => {
    if (pendingProfileSave) {
      clearTimeout(pendingProfileSave);
    }
    const timeout = setTimeout(() => {
      saveProfileData(data, true);
      setPendingProfileSave(null);
    }, 1000); // Save after 1 second of no changes
    setPendingProfileSave(timeout);
  }, [user, saveProfileData]);

  const createHousehold = async () => {
    if (!householdName.trim() || isCreatingHousehold || !user) return;

    setIsCreatingHousehold(true);
    try {
      const householdsColl = DatabaseMonitoringService.collection('households');
      const newHousehold = {
        name: householdName.trim(),
        memberIds: [user.id],
        members: [{
          id: user.id,
          name: user.name,
          email: user.email,
          role: 'admin',
          status: 'active',
          joinedAt: new Date().toISOString()
        }]
      };

      const createdRef = await DatabaseMonitoringService.addDoc(householdsColl, newHousehold);

      const userRef = DatabaseMonitoringService.doc('users', user.id);
      await DatabaseMonitoringService.updateDoc(userRef, {
        householdId: createdRef.id,
        updatedAt: serverTimestamp()
      });

      // Migrate user data to household using cache services
      const userId = user.id;
      const householdId = createdRef.id;

      const inventory = await InventoryCacheService.getCachedInventory(undefined, userId);
      await InventoryCacheService.updateCache(inventory, householdId, undefined);
      await InventoryCacheService.updateCache([], undefined, userId); // Clear user's cache

      const mealPlan = await MealPlanCacheService.getCachedMealPlan(undefined, userId);
      await MealPlanCacheService.updateCache(mealPlan, householdId, undefined);
      await MealPlanCacheService.updateCache([], undefined, userId); // Clear user's cache

      const shoppingList = await ShoppingListCacheService.getCachedShoppingList(undefined, userId);
      await ShoppingListCacheService.setCache(shoppingList, householdId, undefined);
      await ShoppingListCacheService.setCache([], undefined, userId); // Clear user's cache

      const savedRecipes = await RecipesCacheService.getCachedRecipes(undefined, userId);
      await RecipesCacheService.updateCache(savedRecipes, householdId, undefined);
      await RecipesCacheService.updateCache([], undefined, userId); // Clear user's cache

      setHouseholdName('');
      addToast?.('Household created successfully!', 'success');

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      log.error('Failed creating household', { message: msg, stack }, 'Settings');
      addToast?.('Failed to create household. Please try again.', 'error');
    } finally {
      setIsCreatingHousehold(false);
    }
  };

  const avatarOptions = Array.from({ length: 35 }, (_, i) => `/avatars/memo_${i + 1}.png`);

  const handleAvatarSelect = async (avatarPath: string) => {
    if (!user) return;
    setUpdatingAvatar(true);
    try {
      const userRef = DatabaseMonitoringService.doc('users', user.id);
      await DatabaseMonitoringService.updateDoc(userRef, {
        avatar: avatarPath
      });
      setShowAvatarSelection(false);
      addToast?.('Avatar updated successfully!', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      log.error('Failed updating avatar', { message: msg, stack }, 'Settings');
      addToast?.('Failed to update avatar. Please try again.', 'error');
    } finally {
      setUpdatingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    setUpdatingAvatar(true);
    try {
        const userRef = DatabaseMonitoringService.doc('users', user.id);
        await DatabaseMonitoringService.updateDoc(userRef, {
          avatar: null
        });
        addToast?.('Avatar removed successfully!', 'success');
      } catch {
        addToast?.('Failed to remove avatar', 'error');
      } finally {
        setUpdatingAvatar(false);
      }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    setSending(true);
    try {
      // 1. Submit to Firestore feedback collection for tracking
      await DatabaseMonitoringService.addDoc(DatabaseMonitoringService.collection('feedback'), {
        message: feedback,
        createdAt: Timestamp.now(),
        user: user ? {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar || null
        } : null
      });

      // 2. Submit email via EmailJS (same as the website!)
      await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: 'service_ekbmsjj',
          template_id: 'template_ek5lu2r',
          user_id: 'u_wtW48BWFmZnstig',
          template_params: {
            from_name: user?.name || 'User',
            from_email: user?.email || 'no-email@stockandspoon.com',
            message: feedback,
            to_email: 'chrisj221986@gmail.com, cjohns22@duck.com'
          }
        }),
      });

      addToast?.('Thank you! Your feedback has been sent successfully.', 'success');
      setFeedback('');
    } catch (err: unknown) {
      log.error('Failed to send feedback email', { error: err instanceof Error ? err.message : String(err) }, 'Settings');
      addToast?.('Failed to send feedback. Please try again later.', 'error');
    }
    setSending(false);
  };

  const handleBulkImageUpdate = async () => {
    if (!user) return;
    setUpdatingBulkImages(true);
    try {
      const { BulkImageUpdateService } = await import('../../services/bulkImageUpdateService');
      const result = await BulkImageUpdateService.updateAllPantryItemImages(user, (completed, total) => {
        log.info(`Updated ${completed}/${total} items`, { completed, total }, 'Settings');
      });

      addToast?.(
        `Updated ${result.updatedItems} items${result.failedItems > 0 ? ` (${result.failedItems} failed)` : ''}`,
        result.failedItems > 0 ? 'warning' : 'success'
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      log.error('Failed bulk image update', { message: msg, stack }, 'Settings');
      addToast?.('Failed to update images. Please try again.', 'error');
    } finally {
      setUpdatingBulkImages(false);
    }
  };

  const handleResetUsageCounters = async () => {
    if (!user) return;
    try {
      await UsageService.resetUsage(user);
      UsageService.getUsageLimits(user).then(limits => setUsageLimits(limits)).catch(() => {});
      addToast?.('Usage counters reset successfully.', 'success');
    } catch {
      addToast?.('Failed to reset usage counters.', 'error');
    }
  };

  return (
    <>

      <div className="pb-24 max-w-md mx-auto">
      
      {activeCategory === null ? (
        <div className="pt-4 px-6 space-y-6">
          <div className="text-center pb-4">
            <h2 className="text-3xl font-serif font-bold text-theme-primary">Settings</h2>
            <p className="text-xs text-theme-secondary mt-1">Configure your app and manage your kitchen data</p>
          </div>

          <div className="bg-theme-secondary border border-theme rounded-2xl overflow-hidden divide-y divide-theme shadow-sm">
            {/* Account Info */}
            <button
              onClick={() => setActiveCategory('account_info')}
              className="w-full flex items-center justify-between p-4 hover:bg-theme-primary/5 transition-colors text-left focus:outline-none"
              data-category="account-info"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)]">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-semibold text-theme-primary block text-sm">Account Info</span>
                  <span className="text-[11px] text-theme-secondary opacity-70">Profile, subscription details, household sharing</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-theme-secondary" />
            </button>

            {/* Preferences */}
            <button
              onClick={() => setActiveCategory('preferences')}
              className="w-full flex items-center justify-between p-4 hover:bg-theme-primary/5 transition-colors text-left focus:outline-none"
              data-category="preferences"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)]">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-semibold text-theme-primary block text-sm">Preferences</span>
                  <span className="text-[11px] text-theme-secondary opacity-70">Theme, unit system, categories, store layout</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-theme-secondary" />
            </button>

            {/* Notifications */}
            <button
              onClick={() => setActiveCategory('notifications')}
              className="w-full flex items-center justify-between p-4 hover:bg-theme-primary/5 transition-colors text-left focus:outline-none"
              data-category="notifications"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)]">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-semibold text-theme-primary block text-sm">Notifications</span>
                  <span className="text-[11px] text-theme-secondary opacity-70">Snoozed notifications, quiet hours, alert settings</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-theme-secondary" />
            </button>

            {/* Food Waste Savings */}
            <button
              onClick={() => setActiveCategory('food_waste')}
              className="w-full flex items-center justify-between p-4 hover:bg-theme-primary/5 transition-colors text-left focus:outline-none"
              data-category="food-waste"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)]">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-semibold text-theme-primary block text-sm">Food Waste Savings</span>
                  <span className="text-[11px] text-theme-secondary opacity-70">Leftover statistics and waste analytics</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-theme-secondary" />
            </button>

            {/* Contact Us */}
            <button
              onClick={() => setActiveCategory('contact_us')}
              className="w-full flex items-center justify-between p-4 hover:bg-theme-primary/5 transition-colors text-left focus:outline-none"
              data-category="contact-us"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)]">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-semibold text-theme-primary block text-sm">Contact Us</span>
                  <span className="text-[11px] text-theme-secondary opacity-70">Send feedback, privacy policy, terms of service</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-theme-secondary" />
            </button>

            {/* Help */}
            <button
              onClick={() => setActiveCategory('help')}
              className="w-full flex items-center justify-between p-4 hover:bg-theme-primary/5 transition-colors text-left focus:outline-none"
              data-category="help"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)]">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-semibold text-theme-primary block text-sm">Help</span>
                  <span className="text-[11px] text-theme-secondary opacity-70">App documentation, guides, and FAQs</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-theme-secondary" />
            </button>

            {/* Update */}
            <button
              onClick={() => setActiveCategory('update')}
              className="w-full flex items-center justify-between p-4 hover:bg-theme-primary/5 transition-colors text-left focus:outline-none"
              data-category="update"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)]">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-semibold text-theme-primary block text-sm">Update</span>
                  <span className="text-[11px] text-theme-secondary opacity-70">App updates and version details</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-theme-secondary" />
            </button>

            {/* Replay Onboarding */}
            {onReplayOnboarding && (
              <button
                onClick={onReplayOnboarding}
                className="w-full flex items-center justify-between p-4 hover:bg-theme-primary/5 transition-colors text-left focus:outline-none"
                data-category="replay-onboarding"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)]">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-semibold text-theme-primary block text-sm">Replay Onboarding</span>
                    <span className="text-[11px] text-theme-secondary opacity-70">Restart the onboarding tutorial flow</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-theme-secondary" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="pt-4 pb-6 px-6 space-y-6">
          <button
            onClick={() => setActiveCategory(null)}
            className="flex items-center gap-2 text-theme-secondary hover:text-theme-primary transition-colors mb-4 text-sm font-semibold focus:outline-none"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Settings
          </button>

          {activeCategory === 'account_info' && <>
            <SettingsGuestBanner
              isGuest={!!user?.isGuest}
              onLogout={onLogout}
            />

            {/* ── Account Hero Card ── */}
            {user && !user.isGuest && (() => {
              const tierLabel = isFamily ? 'Family' : isPremium ? 'Premium' : 'Free';
              const tierColor = isFamily ? 'text-purple-500' : isPremium ? 'text-[var(--accent-color)]' : 'text-theme-secondary';
              const householdCount = household?.members?.length ?? 0;

              // Contextual CTA
              const ctaContent = !isPremium && !isFamily
                ? { icon: '⭐', text: 'Upgrade to Premium for AI recipes, unlimited saves & more', accent: true }
                : !household
                ? { icon: '👥', text: 'Invite family or roommates to share your pantry & shopping list', accent: false }
                : null;

              return (
                <div className="rounded-2xl border overflow-hidden bg-theme-secondary border-theme shadow-sm">
                  {/* Stat strip */}
                  <div className="grid grid-cols-3 divide-x divide-theme">
                    {[
                      { value: pantryItemCount, label: 'Pantry Items', icon: '🥫' },
                      { value: tierLabel,       label: 'Plan',         icon: '🏅', valueClass: tierColor },
                      { value: householdCount || '—', label: 'Household', icon: '👥' },
                    ].map(stat => (
                      <div key={stat.label} className="flex flex-col items-center py-4 px-2 gap-0.5">
                        <span className="text-lg">{stat.icon}</span>
                        <span className={`text-xl font-black text-theme-primary ${stat.valueClass ?? ''}`}>{stat.value}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-theme-secondary opacity-60">{stat.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Contextual CTA */}
                  {ctaContent && (
                    <div className={`flex items-center gap-3 px-4 py-3 border-t ${
                      ctaContent.accent
                        ? 'border-[var(--accent-color)]/20 bg-[var(--accent-color)]/5'
                        : 'border-theme bg-theme-primary'
                    }`}>
                      <span className="text-base shrink-0">{ctaContent.icon}</span>
                      <p className="flex-1 text-xs text-theme-secondary leading-snug">{ctaContent.text}</p>
                      <button
                        onClick={ctaContent.accent ? () => setActiveCategory('account_info') : onShowHousehold}
                        className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                          ctaContent.accent
                            ? 'bg-[var(--accent-color)] text-white hover:bg-[var(--accent-color)]/80'
                            : 'bg-theme-secondary text-theme-primary border border-theme hover:bg-theme-primary'
                        }`}
                      >
                        {ctaContent.accent ? 'Upgrade' : 'Invite'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Profile Section */}
            {user && onLogout && !user.isGuest && (
              <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden shadow-sm" data-section="profile">
                <div className="w-full flex items-center justify-between p-4 border-b border-theme bg-theme-primary/20">
                  <div className="flex items-center gap-3">
                    <UserIcon className="w-5 h-5 text-[var(--accent-color)]" />
                    <h3 className="font-semibold text-theme-primary">{intl.formatMessage({ id: 'settings.profile' })}</h3>
                  </div>
                </div>

                <div className="p-4">
                  {/* Avatar Section */}
                  <div className="mb-4">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center border border-theme">
                        {user.avatar ? (
                          <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-2xl text-gray-500">{user.name.charAt(0).toUpperCase()}</div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-theme-primary">{userProfile?.name || user.name}</p>
                        <p className="text-sm text-theme-secondary">{user.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => setShowAvatarSelection(!showAvatarSelection)}
                        className="bg-blue-500 text-white px-3 py-2 rounded text-sm font-medium hover:bg-blue-600 flex-1 text-center"
                      >
                        {showAvatarSelection ? 'Cancel' : 'Change Avatar'}
                      </button>
                      {user.avatar && (
                        <button
                          onClick={handleRemoveAvatar}
                          disabled={updatingAvatar}
                          className="bg-red-500 text-white px-3 py-2 rounded text-sm font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {updatingAvatar && <Loader2 className="w-4 h-4 animate-spin" />}
                          {updatingAvatar ? 'Removing...' : 'Remove'}
                        </button>
                      )}
                    </div>

                    {showAvatarSelection && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium mb-2 text-theme-primary">{intl.formatMessage({ id: 'settings.chooseAvatar' })}</h4>
                        <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto">
                          {avatarOptions.map((avatarPath) => (
                            <button
                              key={avatarPath}
                              onClick={() => handleAvatarSelect(avatarPath)}
                              disabled={updatingAvatar}
                              className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-300 hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative"
                            >
                              <img
                                src={avatarPath}
                                alt={`Avatar ${avatarPath.split('/').pop()?.split('.')[0]}`}
                                className="w-full h-full object-cover"
                              />
                              {updatingAvatar && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Name Field */}
                    <div className="mb-4">
                      <label htmlFor="userName" className="block text-sm font-medium text-theme-primary mb-2">{intl.formatMessage({ id: 'settings.displayName' })}</label>
                      <input
                        id="userName"
                        name="userName"
                        type="text"
                        value={userProfile?.name ?? user.name ?? ''}
                        onChange={(e) => handleProfileChange('name', e.target.value)}
                        placeholder="Enter your display name"
                        className="w-full px-3 py-2 border border-theme rounded-lg bg-theme-primary text-theme-secondary placeholder-theme-secondary/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent"
                      />
                      <p className="text-xs text-theme-secondary mt-1">This name will be used throughout the app to personalize your experience.</p>
                    </div>
                  </div>
                  
                  {/* User Profile Information */}
                  <div className="space-y-4 mb-4">
                    <h4 className="text-sm font-medium mb-3 text-theme-primary">{intl.formatMessage({ id: 'settings.personalInfo' })}</h4>
                    
                    <div className="grid grid-cols-3 gap-3">
                      {/* Row 1: Height, Weight, Age */}
                      <div className="flex flex-col items-center">
                        {userProfile?.measurementSystem === 'Metric' ? (
                          <div className="flex items-center border border-theme rounded-lg bg-white px-2 py-1 w-full focus-within:ring-2 focus-within:ring-[var(--accent-color)] focus-within:border-transparent">
                            <input
                              id="heightCm"
                              name="heightCm"
                              type="number"
                              value={userProfile?.height ? Math.round(userProfile.height * 2.54) : ''}
                              onChange={(e) => {
                                const cm = parseFloat(e.target.value) || 0;
                                handleProfileChange('height', Math.round(cm / 2.54));
                              }}
                              placeholder="175"
                              className="w-full text-center text-sm font-semibold text-black bg-transparent outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              min="0"
                              max="300"
                            />
                            <span className="text-xs text-gray-500 font-medium ml-1">cm</span>
                          </div>
                        ) : (
                          <div className="flex gap-1.5 w-full justify-center">
                            <div className="flex items-center border border-theme rounded-lg bg-white px-2 py-1 w-1/2 focus-within:ring-2 focus-within:ring-[var(--accent-color)] focus-within:border-transparent">
                              <input
                                id="heightFeet"
                                name="heightFeet"
                                type="number"
                                value={userProfile?.height ? Math.floor(userProfile.height / 12) : ''}
                                onChange={(e) => {
                                  const feet = parseInt(e.target.value) || 0;
                                  const inches = userProfile?.height ? userProfile.height % 12 : 0;
                                  handleProfileChange('height', feet * 12 + inches);
                                }}
                                placeholder="5"
                                className="w-full text-center text-sm font-semibold text-black bg-transparent outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                min="0"
                                max="8"
                              />
                              <span className="text-xs text-gray-500 font-medium ml-1">ft</span>
                            </div>
                            <div className="flex items-center border border-theme rounded-lg bg-white px-2 py-1 w-1/2 focus-within:ring-2 focus-within:ring-[var(--accent-color)] focus-within:border-transparent">
                              <input
                                id="heightInches"
                                name="heightInches"
                                type="number"
                                value={userProfile?.height ? userProfile.height % 12 : ''}
                                onChange={(e) => {
                                  const feet = userProfile?.height ? Math.floor(userProfile.height / 12) : 0;
                                  const inches = parseInt(e.target.value) || 0;
                                  handleProfileChange('height', feet * 12 + inches);
                                }}
                                placeholder="8"
                                className="w-full text-center text-sm font-semibold text-black bg-transparent outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                min="0"
                                max="11"
                              />
                              <span className="text-xs text-gray-500 font-medium ml-1">in</span>
                            </div>
                          </div>
                        )}
                        <label className="text-[10px] text-theme-secondary font-bold uppercase tracking-wider mt-1.5 text-center">
                          {intl.formatMessage({ id: 'settings.height' })}
                        </label>
                      </div>

                      {/* Weight — lbs or kg */}
                      <div className="flex flex-col items-center">
                        <div className="flex items-center border border-theme rounded-lg bg-white px-2 py-1 w-full focus-within:ring-2 focus-within:ring-[var(--accent-color)] focus-within:border-transparent">
                          <input
                            id="weight"
                            name="weight"
                            type="number"
                            min="0"
                            value={
                              userProfile?.measurementSystem === 'Metric'
                                ? userProfile?.weight ? Math.round(userProfile.weight * 0.453592) : ''
                                : userProfile?.weight || ''
                            }
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (isNaN(val)) { handleProfileChange('weight', undefined); return; }
                              const lbs = userProfile?.measurementSystem === 'Metric' ? Math.round(val / 0.453592) : val;
                              handleProfileChange('weight', lbs);
                            }}
                            placeholder={userProfile?.measurementSystem === 'Metric' ? '70' : '154'}
                            className="w-full text-center text-sm font-semibold text-black bg-transparent outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="text-xs text-gray-500 font-medium ml-1">
                            {userProfile?.measurementSystem === 'Metric' ? 'kg' : 'lbs'}
                          </span>
                        </div>
                        <label htmlFor="weight" className="text-[10px] text-theme-secondary font-bold uppercase tracking-wider mt-1.5 text-center">
                          {intl.formatMessage({ id: 'settings.weight' })}
                        </label>
                      </div>

                      <div className="flex flex-col items-center">
                        <div className="flex items-center border border-theme rounded-lg bg-white px-2 py-1 w-full focus-within:ring-2 focus-within:ring-[var(--accent-color)] focus-within:border-transparent">
                          <input
                            id="age"
                            name="age"
                            type="number"
                            min="0"
                            value={userProfile?.age || ''}
                            onChange={(e) => handleProfileChange('age', e.target.value ? parseInt(e.target.value) : undefined)}
                            placeholder="30"
                            className="w-full text-center text-sm font-semibold text-black bg-transparent outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="text-xs text-gray-500 font-medium ml-1">yrs</span>
                        </div>
                        <label htmlFor="age" className="text-[10px] text-theme-secondary font-bold uppercase tracking-wider mt-1.5 text-center">
                          Age
                        </label>
                      </div>

                      {/* Row 2: Gender and Household Size */}
                      <div className="col-span-2 flex flex-col items-center">
                        <div className="w-full border border-theme rounded-lg bg-white px-2 py-1 focus-within:ring-2 focus-within:ring-[var(--accent-color)] focus-within:border-transparent">
                          <select
                            id="gender"
                            name="gender"
                            value={userProfile?.gender || ''}
                            onChange={(e) => handleProfileChange('gender', e.target.value || undefined)}
                            className="w-full text-center text-sm font-semibold text-black bg-transparent outline-none border-none cursor-pointer"
                          >
                            <option value="">{intl.formatMessage({ id: 'settings.selectGender' })}</option>
                            <option value="male">{intl.formatMessage({ id: 'settings.genders.male' })}</option>
                            <option value="female">{intl.formatMessage({ id: 'settings.genders.female' })}</option>
                            <option value="other">{intl.formatMessage({ id: 'settings.genders.other' })}</option>
                            <option value="prefer-not-to-say">{intl.formatMessage({ id: 'settings.genders.preferNotToSay' })}</option>
                          </select>
                        </div>
                        <label htmlFor="gender" className="text-[10px] text-theme-secondary font-bold uppercase tracking-wider mt-1.5 text-center">
                          {intl.formatMessage({ id: 'settings.gender' })}
                        </label>
                      </div>

                      <div className="flex flex-col items-center">
                        <div className="flex items-center border border-theme rounded-lg bg-white px-2 py-1 w-full focus-within:ring-2 focus-within:ring-[var(--accent-color)] focus-within:border-transparent">
                          <input
                            id="householdSize"
                            name="householdSize"
                            type="number"
                            value={userProfile?.householdSize || ''}
                            onChange={(e) => handleProfileChange('householdSize', e.target.value ? parseInt(e.target.value) : undefined)}
                            placeholder="4"
                            className="w-full text-center text-sm font-semibold text-black bg-transparent outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min="1"
                            max="20"
                          />
                          <span className="text-xs text-gray-500 font-medium ml-1">people</span>
                        </div>
                        <label htmlFor="householdSize" className="text-[10px] text-theme-secondary font-bold uppercase tracking-wider mt-1.5 text-center">
                          {intl.formatMessage({ id: 'settings.household' })}
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div>
                        <label htmlFor="dietGoal" className="block text-xs text-theme-secondary mb-1">{intl.formatMessage({ id: 'settings.dietGoal' })}</label>
                        <select
                          id="dietGoal"
                          name="dietGoal"
                          value={userProfile?.dietGoal || ''}
                          onChange={(e) => handleProfileChange('dietGoal', e.target.value || undefined)}
                          className="w-full p-2 border rounded text-sm text-black bg-white"
                        >
                          <option value="">{intl.formatMessage({ id: 'settings.selectDietGoal' })}</option>
                          <option value="lose-weight">{intl.formatMessage({ id: 'settings.dietGoals.loseWeight' })}</option>
                          <option value="maintain-weight">{intl.formatMessage({ id: 'settings.dietGoals.maintainWeight' })}</option>
                          <option value="gain-weight">{intl.formatMessage({ id: 'settings.dietGoals.gainWeight' })}</option>
                          <option value="build-muscle">{intl.formatMessage({ id: 'settings.dietGoals.buildMuscle' })}</option>
                          <option value="improve-health">{intl.formatMessage({ id: 'settings.dietGoals.improveHealth' })}</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="activityLevel" className="block text-xs text-theme-secondary mb-1">{intl.formatMessage({ id: 'settings.activityLevel' })}</label>
                        <select
                          id="activityLevel"
                          name="activityLevel"
                          value={userProfile?.activityLevel || ''}
                          onChange={(e) => handleProfileChange('activityLevel', e.target.value || undefined)}
                          className="w-full p-2 border rounded text-sm text-black bg-white"
                        >
                          <option value="">{intl.formatMessage({ id: 'settings.selectActivityLevel' })}</option>
                          <option value="sedentary">{intl.formatMessage({ id: 'settings.activityLevels.sedentary' })}</option>
                          <option value="lightly-active">{intl.formatMessage({ id: 'settings.activityLevels.lightlyActive' })}</option>
                          <option value="moderately-active">{intl.formatMessage({ id: 'settings.activityLevels.moderatelyActive' })}</option>
                          <option value="very-active">{intl.formatMessage({ id: 'settings.activityLevels.veryActive' })}</option>
                          <option value="extremely-active">{intl.formatMessage({ id: 'settings.activityLevels.extremelyActive' })}</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {profileChanged && (
                    <button
                      onClick={saveProfile}
                      disabled={savingProfile}
                      className="w-full bg-green-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                    >
                      {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
                      {savingProfile ? 'Saving...' : intl.formatMessage({ id: 'settings.saveProfile' })}
                    </button>
                  )}
                </div>

                {/* Logout Button */}
                <div className="px-4 pb-4">
                  <button
                    onClick={onLogout}
                    className="w-full bg-red-500 text-white px-4 py-2 rounded font-medium hover:bg-red-600 mt-4"
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}

            <SettingsUsageLimitsSection
              userExists={!!user}
              title={intl.formatMessage({ id: 'settings.usageLimits' })}
              isPremium={isPremium}
              isFamily={isFamily}
              usageLimits={usageLimits}
              onOpenUpgrade={() => setActiveCategory('account_info')}
            />

            <SettingsSubscriptionSection
              user={user}
              title={intl.formatMessage({ id: 'settings.subscription' })}
            />

            <SettingsHouseholdSection
              user={user}
              household={household}
              title={intl.formatMessage({ id: 'settings.household' })}
              onShowHousehold={onShowHousehold}
              openMemberPreferences={openMemberPreferences}
              removeMemberFromHousehold={removeMemberFromHousehold}
              householdName={householdName}
              setHouseholdName={setHouseholdName}
              isCreatingHousehold={isCreatingHousehold}
              createHousehold={createHousehold}
              manageHouseholdLabel={intl.formatMessage({ id: 'settings.manageHousehold' })}
            />
          </>}

          {activeCategory === 'preferences' && <>
            <SettingsThemeSection
              title={intl.formatMessage({ id: 'settings.themeSettings' })}
              settings={settings}
              onResetTheme={() => {
                setSettings((previous) => ({
                  ...previous,
                  theme: {
                    mode: 'dark',
                    accentColor: '#4CAF50',
                    backgroundColor: undefined,
                    textColor: undefined,
                  },
                }));
              }}
              onThemeModeChange={(mode) => handleChange('theme', { mode })}
              onAccentColorChange={(accentColor) => handleChange('theme', { accentColor })}
              onBackgroundColorChange={(backgroundColor) => handleChange('theme', { backgroundColor })}
              onTextColorChange={(textColor) => handleChange('theme', { textColor })}
              labels={{
                theme: intl.formatMessage({ id: 'settings.theme' }),
                accent: intl.formatMessage({ id: 'settings.accent' }),
                background: intl.formatMessage({ id: 'settings.background' }),
                textColor: intl.formatMessage({ id: 'settings.textColor' }),
                language: intl.formatMessage({ id: 'settings.language' }),
                dark: intl.formatMessage({ id: 'settings.themes.dark' }),
                light: intl.formatMessage({ id: 'settings.themes.light' }),
              }}
            />

            <SettingsAppPreferencesSection
              title={intl.formatMessage({ id: 'settings.appPreferences' })}
              settings={settings}
              setSettings={setSettings}
              userProfile={userProfile}
              onMeasurementSystemChange={(value) => handleProfileChange('measurementSystem', value)}
              geminiOptedIn={geminiOptedIn}
              onGeminiOptInChange={handleGeminiOptIn}
              labels={{
                enableNotifications: intl.formatMessage({ id: 'settings.enableNotifications' }),
                measurementSystem: intl.formatMessage({ id: 'settings.measurementSystem' }),
                enableAiFeatures: intl.formatMessage({ id: 'settings.enableAiFeatures' }),
                includeStaples: intl.formatMessage({ id: 'settings.includeStaples' }),
                autoRestockStaples: intl.formatMessage({ id: 'settings.autoRestockStaples' }),
                showNutrition: intl.formatMessage({ id: 'settings.showNutrition' }),
                showPriceData: intl.formatMessage({ id: 'settings.showPriceData' }),
              }}
            />

            <SettingsTabVisibilitySection
              hiddenTabs={settings.navigation?.hiddenTabs}
              onTabVisibilityChange={(tab, isVisible) => {
                const hidden = settings.navigation?.hiddenTabs ?? [];
                const newHidden = isVisible ? hidden.filter((currentTab: string) => currentTab !== tab) : [...hidden, tab];
                setSettings((previous) => ({
                  ...previous,
                  navigation: { ...previous.navigation, hiddenTabs: newHidden },
                }));
              }}
            />

            <SettingsFoodSafetySection
              title={intl.formatMessage({ id: 'settings.foodSafety' })}
              user={user}
              userProfile={userProfile}
              setUserProfile={setUserProfile}
              debouncedSaveProfile={debouncedSaveProfile}
              saveProfileData={saveProfileData}
            />

            <SettingsCategoriesSection
              userExists={!!user}
              title={intl.formatMessage({ id: 'settings.categories' })}
              customCategoryCount={customCategories.length}
              onManageCategories={() => setShowCategoryManager(true)}
            />

            <SettingsStoreLayoutSection
              userExists={!!user}
              title={intl.formatMessage({ id: 'settings.storeLayout' })}
              storeLayout={settings.shopping?.storeLayout || defaultStoreLayout}
              onStoreLayoutChange={(newLayout) => setSettings((previous) => ({
                ...previous,
                shopping: {
                  ...previous.shopping,
                  storeLayout: newLayout,
                },
              }))}
              storeProfiles={settings.shopping?.storeProfiles ?? {}}
              activeStoreProfile={settings.shopping?.activeStoreProfile}
              onStoreProfilesChange={(profiles, active) => setSettings((previous) => ({
                ...previous,
                shopping: {
                  ...previous.shopping,
                  storeProfiles: profiles,
                  activeStoreProfile: active,
                },
              }))}
            />

            <SettingsPantryImagesSection
              user={user}
              title={intl.formatMessage({ id: 'settings.pantryImages' })}
              updatingBulkImages={updatingBulkImages}
              onBulkUpdate={handleBulkImageUpdate}
            />

            <SettingsResetUsageSection
              isAdmin={isAdmin}
              onReset={handleResetUsageCounters}
            />

            <SettingsRemoteConfigDebugSection
              isAdmin={isAdmin}
              addToast={addToast}
            />
          </>}

          {activeCategory === 'notifications' && <>
            <SettingsNotificationsSection
              title={intl.formatMessage({ id: 'settings.notifications' })}
              user={user}
              notificationSettings={notificationSettings}
              setNotificationSettings={handleNotificationSettingsChange}
            />

            <SettingsPendingNotificationsSection
              user={user}
              title={intl.formatMessage({ id: 'settings.pendingNotifications' })}
            />
          </>}

          {activeCategory === 'food_waste' && <>
            <SettingsLeftoverAnalyticsSection
              userId={user?.id}
              householdId={household?.id}
              title={intl.formatMessage({ id: 'settings.leftoverAnalytics' })}
            />
          </>}

          {activeCategory === 'contact_us' && <>
            <SettingsFeedbackSection
              title={intl.formatMessage({ id: 'settings.feedback' })}
              feedback={feedback}
              setFeedback={setFeedback}
              sending={sending}
              onSubmit={handleFeedbackSubmit}
            />

            <SettingsPrivacyLegalSection
              title={intl.formatMessage({ id: 'settings.privacy' })}
              onViewPrivacyPolicy={() => {
                const privacyUrl = (window as Window & { PRIVACY_POLICY_URL?: string }).PRIVACY_POLICY_URL || 'https://smartpantrymobile.page.gd/privacy.html';
                window.open(privacyUrl, '_blank');
              }}
              onViewTermsOfService={() => {
                const termsUrl = (window as Window & { TERMS_OF_SERVICE_URL?: string }).TERMS_OF_SERVICE_URL || 'https://ornate-compass-478504-e1.web.app/terms.html';
                window.open(termsUrl, '_blank');
              }}
              onCopyPrivacyUrl={() => {
                const privacyUrl = (window as Window & { PRIVACY_POLICY_URL?: string }).PRIVACY_POLICY_URL || 'https://smartpantrymobile.page.gd/privacy.html';
                if (navigator.clipboard) navigator.clipboard.writeText(privacyUrl);
                addToast?.('Privacy policy URL copied to clipboard', 'success');
              }}
              canDeleteAccount={!!user && !user.isGuest}
              onDeleteAccount={() => setShowDeleteConfirm(true)}
            />
          </>}

          {activeCategory === 'help' && (
            <div className="bg-theme-secondary border border-theme rounded-2xl p-4 overflow-hidden shadow-sm">
              <FAQPage 
                onBack={() => setActiveCategory(null)} 
                onNavigateToFeedback={() => setActiveCategory('contact_us')}
              />
            </div>
          )}

          {activeCategory === 'update' && <>
            <SettingsAppUpdatesSection
              title={intl.formatMessage({ id: 'settings.appUpdates' })}
            />
          </>}
        </div>
      )}

      </div> {/* end tab content */}

      {/* Category Manager Modal */}
      {user && (
        <CategoryManager
          customCategories={customCategories}
          onAddCategory={onAddCustomCategory || (() => {})}
          onUpdateCategory={onUpdateCustomCategory || (() => {})}
          onDeleteCategory={onDeleteCustomCategory || (() => {})}
          isOpen={showCategoryManager}
          onClose={() => setShowCategoryManager(false)}
          maxCategories={isPremium || isFamily ? undefined : 1}
        />
      )}

      {/* Member Preferences Modal */}
      {showMemberPreferencesModal && selectedMember && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setShowMemberPreferencesModal(false)}>
          <div className="bg-theme-primary rounded-2xl shadow-2xl max-w-lg w-full h-[80vh] max-h-[600px] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex-shrink-0 p-4 border-b border-theme bg-theme-secondary">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <SettingsIcon className="w-5 h-5 text-theme-primary flex-shrink-0" />
                  <h2 className="font-serif font-bold text-theme-primary text-lg truncate">{selectedMember.name}'s Preferences</h2>
                </div>
                <button onClick={() => setShowMemberPreferencesModal(false)} className="text-theme-secondary hover:text-theme-primary flex-shrink-0 ml-2">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto min-h-0">
              <div className="space-y-6">
                {/* Dietary Restrictions */} 
                <div>
                  <label className="block text-sm font-medium text-theme-primary mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Dietary Restrictions
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Paleo', 'Low-Carb', 'Halal', 'Kosher'].map((restriction) => (
                      <label key={restriction} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={memberPreferences.dietaryRestrictions?.includes(restriction) || false}
                          onChange={(e) => {
                            const current = memberPreferences.dietaryRestrictions || [];
                            if (e.target.checked) {
                              setMemberPreferences(prev => ({
                                ...prev,
                                dietaryRestrictions: [...current, restriction]
                              }));
                            } else {
                              setMemberPreferences(prev => ({
                                ...prev,
                                dietaryRestrictions: current.filter(r => r !== restriction)
                              }));
                            }
                          }}
                          className="rounded border-theme text-theme-primary focus:border-theme-primary"
                        />
                        {restriction}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Allergies */}
                <div>
                  <label className="block text-sm font-medium text-theme-primary mb-3">Allergies</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['Peanuts', 'Tree Nuts', 'Dairy', 'Eggs', 'Soy', 'Wheat', 'Fish', 'Shellfish', 'Sesame', 'Mustard'].map((allergy) => (
                      <label key={allergy} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={memberPreferences.allergies?.includes(allergy) || false}
                          onChange={(e) => {
                            const current = memberPreferences.allergies || [];
                            if (e.target.checked) {
                              setMemberPreferences(prev => ({
                                ...prev,
                                allergies: [...current, allergy]
                              }));
                            } else {
                              setMemberPreferences(prev => ({
                                ...prev,
                                allergies: current.filter(a => a !== allergy)
                              }));
                            }
                          }}
                          className="rounded border-theme text-theme-primary focus:border-theme-primary"
                        />
                        {allergy}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Diet Goal */}
                <div>
                  <label className="block text-sm font-medium text-theme-primary mb-3">Diet Goal</label>
                  <select
                    value={memberPreferences.dietGoal || ''}
                    onChange={(e) => setMemberPreferences(prev => ({ ...prev, dietGoal: e.target.value as UserProfile['dietGoal'] || undefined }))}
                    className="w-full bg-theme-secondary border border-theme rounded-lg px-3 py-2 text-sm text-theme-primary focus:border-theme-primary outline-none"
                  >
                    <option value="">No specific goal</option>
                    <option value="lose-weight">Lose Weight</option>
                    <option value="maintain-weight">Maintain Weight</option>
                    <option value="gain-weight">Gain Weight</option>
                    <option value="build-muscle">Build Muscle</option>
                    <option value="improve-health">Improve Health</option>
                  </select>
                </div>

                {/* Favorite Cuisines */}
                <div>
                  <label className="block text-sm font-medium text-theme-primary mb-3 flex items-center gap-2">
                    <Heart className="w-4 h-4" />
                    Favorite Cuisines
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {['Italian', 'Mexican', 'Chinese', 'Japanese', 'Indian', 'Thai', 'French', 'Mediterranean', 'American', 'Korean'].map((cuisine) => (
                      <label key={cuisine} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={memberPreferences.favoriteCuisines?.includes(cuisine) || false}
                          onChange={(e) => {
                            const current = memberPreferences.favoriteCuisines || [];
                            if (e.target.checked) {
                              setMemberPreferences(prev => ({
                                ...prev,
                                favoriteCuisines: [...current, cuisine]
                              }));
                            } else {
                              setMemberPreferences(prev => ({
                                ...prev,
                                favoriteCuisines: current.filter(c => c !== cuisine)
                              }));
                            }
                          }}
                          className="rounded border-theme text-theme-primary focus:border-theme-primary"
                        />
                        {cuisine}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Special Needs */}
                <div>
                  <label className="block text-sm font-medium text-theme-primary mb-3">Special Dietary Needs</label>
                  <textarea
                    value={memberPreferences.specialNeeds || ''}
                    onChange={(e) => setMemberPreferences(prev => ({ ...prev, specialNeeds: e.target.value }))}
                    placeholder="e.g., low sodium, diabetic friendly, etc."
                    className="w-full bg-theme-secondary border border-theme rounded-lg px-3 py-2 text-sm text-theme-primary focus:border-theme-primary outline-none resize-none"
                    rows={2}
                  />
                </div>

                {/* Preferred Proteins */}
                <div>
                  <label className="block text-sm font-medium text-theme-primary mb-3">Preferred Proteins</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['Chicken', 'Beef', 'Pork', 'Fish', 'Tofu', 'Beans', 'Eggs', 'Turkey', 'Lamb', 'Shrimp'].map((protein) => (
                      <label key={protein} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={memberPreferences.preferredProteins?.includes(protein) || false}
                          onChange={(e) => {
                            const current = memberPreferences.preferredProteins || [];
                            if (e.target.checked) {
                              setMemberPreferences(prev => ({
                                ...prev,
                                preferredProteins: [...current, protein]
                              }));
                            } else {
                              setMemberPreferences(prev => ({
                                ...prev,
                                preferredProteins: current.filter(p => p !== protein)
                              }));
                            }
                          }}
                          className="rounded border-theme text-theme-primary focus:border-theme-primary"
                        />
                        {protein}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Disliked Ingredients */}
                <div>
                  <label className="block text-sm font-medium text-theme-primary mb-3">Disliked Ingredients</label>
                  <input
                    type="text"
                    value={memberPreferences.dislikedIngredients?.join(', ') || ''}
                    onChange={(e) => setMemberPreferences(prev => ({
                      ...prev,
                      dislikedIngredients: e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0)
                    }))}
                    placeholder="e.g., mushrooms, olives, cilantro"
                    className="w-full bg-theme-secondary border border-theme rounded-lg px-3 py-2 text-sm text-theme-primary focus:border-theme-primary outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-theme bg-theme-secondary">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowMemberPreferencesModal(false)}
                  className="flex-1 bg-theme-primary hover:bg-theme-secondary text-theme-secondary hover:text-theme-primary py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveMemberPreferences}
                  disabled={savingMemberPrefs}
                  className="flex-1 bg-theme-secondary hover:bg-theme-primary text-theme-primary hover:text-theme-secondary py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {savingMemberPrefs ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



    {/* FAQ Modal */}
    {showFAQModal && (
      <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
        <div className="bg-theme-primary rounded-2xl shadow-2xl max-w-4xl w-full h-[90vh] max-h-[800px] flex flex-col">
          <div className="flex-shrink-0 p-4 border-b border-theme bg-theme-secondary">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <SettingsIcon className="w-5 h-5 text-theme-primary flex-shrink-0" />
                <h2 className="font-serif font-bold text-theme-primary text-lg truncate">Help & FAQ</h2>
              </div>
              <button onClick={() => setShowFAQModal(false)} className="text-theme-secondary hover:text-theme-primary flex-shrink-0 ml-2">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto min-h-0">
            <FAQPage 
              onBack={() => setShowFAQModal(false)} 
              onNavigateToFeedback={() => {
                setShowFAQModal(false);
                setActiveCategory('contact_us');
              }}
            />
          </div>
        </div>
      </div>
    )}

    {/* Delete Account Confirmation Modal */}
    {showDeleteConfirm && (
      <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4">
        <div className="bg-theme-primary rounded-2xl shadow-2xl max-w-sm w-full p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <h2 className="font-serif font-bold text-theme-primary text-lg">Delete Account</h2>
          </div>
          <p className="text-sm text-theme-secondary leading-relaxed">
            This will <strong>permanently delete</strong> your account, all pantry data, meal plans, saved recipes, and remove you from any households. This action cannot be undone.
          </p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeletingAccount}
              className="flex-1 bg-theme-secondary text-theme-primary py-2 px-4 rounded-lg font-medium text-sm transition-colors hover:bg-theme-primary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount}
              className="flex-1 bg-red-500 text-white py-2 px-4 rounded-lg font-medium text-sm transition-colors hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDeletingAccount ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</> : 'Delete My Account'}
            </button>
          </div>
        </div>
      </div>
    )}

    </>
  );
};

export const Settings = React.memo(SettingsComponent);
