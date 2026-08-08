import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Timestamp } from 'firebase/firestore';
import DatabaseMonitoringService from '../../services/databaseMonitoringService';
import { CategoryManager } from '../pantry/CategoryManager';
import { getCallableFunction } from '../../firebaseConfig';
import { log } from '../../services/logService';
import { useIntl } from 'react-intl';
import AnalyticsService from '../../services/analyticsService';
import { useNotifications } from '../../hooks/useNotifications';
import { User, UserProfile, Member } from '../../types';
import { useNavigation } from '../../contexts/NavigationContext';
import { useUserContext } from '../../contexts/UserContext';
import { useMealPlanContext } from '../../contexts/MealPlanContext';
import { useSettingsDataContext } from '../../contexts/SettingsDataContext';
import { useAppActions } from '../../contexts/AppActionsContext';

type MemberPreferences = Pick<Member, 'dietaryRestrictions' | 'allergies' | 'dietGoal' | 'favoriteCuisines' | 'specialNeeds' | 'preferredProteins' | 'dislikedIngredients'>;
import { NotificationService, NotificationSettings } from '../../services/notificationBuilderService';
import { ChevronLeft } from 'lucide-react';
import { userOptedInToGemini, setUserGeminiOptIn, getGeminiUsage } from '../../services/featureFlags';

import { serverTimestamp } from 'firebase/firestore';
import { InventoryCacheService } from '../../services/inventoryCacheService';
import { MealPlanCacheService } from '../../services/MealPlanCacheService';
import { RecipesCacheService } from '../../services/recipesCacheService';
import { useSubscription } from '../../hooks/useSubscription';
import { UsageService } from '../../services/usageService';
import type { UsageLimits } from '../../services/usageService';
import { setActiveCurrency } from '../../services/currencyService';
import { ShoppingListCacheService } from '../../services/shoppingListCacheService';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { useConfirm } from '../ui/ConfirmDialog';
import { HOUSEHOLD_LEFT_AT_KEY } from '../../hooks/useAuth';
import { useAndroidBack } from '../../hooks/useAndroidBack';

const SettingsCategoryList = lazy(() => import('./SettingsCategoryList').then(m => ({ default: m.SettingsCategoryList })));
const SettingsAccountInfoPage = lazy(() => import('./SettingsAccountInfoPage').then(m => ({ default: m.SettingsAccountInfoPage })));
const SettingsSubscriptionPage = lazy(() => import('./SettingsSubscriptionPage').then(m => ({ default: m.SettingsSubscriptionPage })));
const SettingsPreferencesPage = lazy(() => import('./SettingsPreferencesPage').then(m => ({ default: m.SettingsPreferencesPage })));
const SettingsNotificationsPage = lazy(() => import('./SettingsNotificationsPage').then(m => ({ default: m.SettingsNotificationsPage })));
const SettingsFoodWastePage = lazy(() => import('./SettingsFoodWastePage').then(m => ({ default: m.SettingsFoodWastePage })));
const SettingsHelpAndSupportPage = lazy(() => import('./SettingsHelpAndSupportPage').then(m => ({ default: m.SettingsHelpAndSupportPage })));
const SettingsUpdatePage = lazy(() => import('./SettingsUpdatePage').then(m => ({ default: m.SettingsUpdatePage })));
const SettingsAdminPage = lazy(() => import('./SettingsAdminPage').then(m => ({ default: m.SettingsAdminPage })));
const SettingsMemberPreferencesModal = lazy(() => import('./SettingsMemberPreferencesModal').then(m => ({ default: m.SettingsMemberPreferencesModal })));
const SettingsFAQModal = lazy(() => import('./SettingsFAQModal').then(m => ({ default: m.SettingsFAQModal })));
const SettingsDeleteAccountModal = lazy(() => import('./SettingsDeleteAccountModal').then(m => ({ default: m.SettingsDeleteAccountModal })));

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

const SettingsComponent: React.FC = () => {
  const { activeSettingsCategory: activeCategory } = useNavigation();
  const { user, household } = useUserContext();
  const { mealPlan } = useMealPlanContext();
  const { settings = defaultSettings, customCategories = [] } = useSettingsDataContext();
  const {
    setSettings,
    onLogout,
    onAddCustomCategory,
    onUpdateCustomCategory,
    onDeleteCustomCategory,
    onShowHousehold,
    addToast,
    onReplayOnboarding,
    setActiveSettingsCategory: setActiveCategory,
  } = useAppActions();
  const intl = useIntl();
  const confirm = useConfirm();
  const [feedback, setFeedback] = useState('');
  const [sending, setSending] = useState(false);
  const { isPremium, isFamily } = useSubscription(user || null);
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);
  const { isAdmin } = useIsAdmin(user?.id);

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
  const [scrollToHousehold, setScrollToHousehold] = useState(false);

  // Redirect to requested settings category if set in sessionStorage
  useEffect(() => {
    const redirectTab = sessionStorage.getItem('settings_redirect_tab');
    if (redirectTab === 'household') {
      setActiveCategory('account_info');
      setScrollToHousehold(true);
      sessionStorage.removeItem('settings_redirect_tab');
    } else if (redirectTab === 'account' || redirectTab === 'more') {
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

  // Once the account_info category has rendered, scroll the household section into view
  useEffect(() => {
    if (scrollToHousehold && activeCategory === 'account_info') {
      document.querySelector('[data-section="household"]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setScrollToHousehold(false);
    }
  }, [scrollToHousehold, activeCategory]);

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
      const deleteAccountFn = await getCallableFunction('deleteAccount');
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

    const ok = await confirm({
      title: `Remove ${member.name}?`,
      description: 'They will lose access to this household\'s shared inventory, meal plan, and shopping list immediately. This cannot be undone.',
      confirmLabel: 'Remove',
      variant: 'danger'
    });
    if (!ok) return;

    try {
      // Removing the last other member disbands the household and clears the
      // ADMIN's own householdId too — guard useAuth's auto-heal fallback from
      // immediately resurrecting it (see HOUSEHOLD_LEFT_AT_KEY in useAuth.ts).
      sessionStorage.setItem(HOUSEHOLD_LEFT_AT_KEY, String(Date.now()));

      // Runs server-side with Admin SDK privileges so it can legitimately clear the
      // REMOVED member's own users/{memberId}.householdId and copy their cache —
      // a client write to another user's doc is (correctly) blocked by Firestore rules.
      const removeHouseholdMemberFn = await getCallableFunction('removeHouseholdMember');
      await removeHouseholdMemberFn({ householdId: household.id, memberId: member.id });

      log.info('Member removed from household', { memberId: member.id, householdId: household.id }, 'Settings');
      addToast?.(`${member.name} has been removed from the household`, 'info');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      log.error('Failed removing member from household', { message: msg, stack }, 'Settings');
      addToast?.('Failed to remove member from household', 'error');
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
      await DatabaseMonitoringService.setDoc(userRef, {
        profile: userProfile
      }, { merge: true });
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
      await DatabaseMonitoringService.setDoc(userRef, { profile: data }, { merge: true });
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
            from_email: user?.email || 'no-email@stock-spoon-website.web.app',
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
      const onProgress = (completed: number, total: number) => {
        log.info(`Updated ${completed}/${total} items`, { completed, total }, 'Settings');
      };
      const result = household
        ? await BulkImageUpdateService.updateHouseholdPantryItemImages(household.id, onProgress)
        : await BulkImageUpdateService.updateAllPantryItemImages(user, onProgress);

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
        <Suspense fallback={null}>
          <SettingsCategoryList
            isGuest={!!user?.isGuest}
            onLogout={onLogout}
            isAdmin={isAdmin}
            setActiveCategory={setActiveCategory}
          />
        </Suspense>
      ) : (
        <div className="pt-4 pb-6 px-6 space-y-6">
          <button
            onClick={() => setActiveCategory(null)}
            className="flex items-center gap-2 text-theme-secondary hover:text-theme-primary transition-colors mb-4 text-sm font-semibold focus:outline-none"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Settings
          </button>

          {activeCategory === 'account_info' && (
            <Suspense fallback={null}>
              <SettingsAccountInfoPage
                user={user}
                onLogout={onLogout}
                userProfile={userProfile}
                onProfileChange={handleProfileChange}
                showAvatarSelection={showAvatarSelection}
                setShowAvatarSelection={setShowAvatarSelection}
                updatingAvatar={updatingAvatar}
                onAvatarSelect={handleAvatarSelect}
                onRemoveAvatar={handleRemoveAvatar}
                profileChanged={profileChanged}
                savingProfile={savingProfile}
                onSaveProfile={saveProfile}
                foodSafetyTitle={intl.formatMessage({ id: 'settings.foodSafety' })}
                debouncedSaveProfile={debouncedSaveProfile}
                saveProfileData={saveProfileData}
                setUserProfile={setUserProfile}
                household={household}
                householdTitle={intl.formatMessage({ id: 'settings.household' })}
                onShowHousehold={onShowHousehold}
                openMemberPreferences={openMemberPreferences}
                removeMemberFromHousehold={removeMemberFromHousehold}
                householdName={householdName}
                setHouseholdName={setHouseholdName}
                isCreatingHousehold={isCreatingHousehold}
                createHousehold={createHousehold}
                manageHouseholdLabel={intl.formatMessage({ id: 'settings.manageHousehold' })}
              />
            </Suspense>
          )}

          {activeCategory === 'subscription' && (
            <Suspense fallback={null}>
              <SettingsSubscriptionPage
                user={user}
                pantryItemCount={pantryItemCount}
                isPremium={isPremium}
                isFamily={isFamily}
                household={household}
                onUpgrade={() => {}}
                onShowHousehold={onShowHousehold}
                usageLimitsTitle={intl.formatMessage({ id: 'settings.usageLimits' })}
                usageLimits={usageLimits}
                subscriptionTitle={intl.formatMessage({ id: 'settings.subscription' })}
              />
            </Suspense>
          )}

          {activeCategory === 'preferences' && (
            <Suspense fallback={null}>
              <SettingsPreferencesPage
                user={user}
                userProfile={userProfile}
                settings={settings}
                setSettings={setSettings}
                themeSectionTitle={intl.formatMessage({ id: 'settings.themeSettings' })}
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
                themeLabels={{
                  theme: intl.formatMessage({ id: 'settings.theme' }),
                  accent: intl.formatMessage({ id: 'settings.accent' }),
                  background: intl.formatMessage({ id: 'settings.background' }),
                  textColor: intl.formatMessage({ id: 'settings.textColor' }),
                  language: intl.formatMessage({ id: 'settings.language' }),
                  dark: intl.formatMessage({ id: 'settings.themes.dark' }),
                  light: intl.formatMessage({ id: 'settings.themes.light' }),
                }}
                onMeasurementSystemChange={(value) => handleProfileChange('measurementSystem', value)}
                onCurrencyChange={(value) => { handleProfileChange('currency', value); setActiveCurrency(value); }}
                geminiOptedIn={geminiOptedIn}
                onGeminiOptInChange={handleGeminiOptIn}
                appPreferencesSectionTitle={intl.formatMessage({ id: 'settings.appPreferences' })}
                appPreferencesLabels={{
                  enableNotifications: intl.formatMessage({ id: 'settings.enableNotifications' }),
                  measurementSystem: intl.formatMessage({ id: 'settings.measurementSystem' }),
                  currency: 'Currency',
                  enableAiFeatures: intl.formatMessage({ id: 'settings.enableAiFeatures' }),
                  includeStaples: intl.formatMessage({ id: 'settings.includeStaples' }),
                  autoRestockStaples: intl.formatMessage({ id: 'settings.autoRestockStaples' }),
                  showNutrition: intl.formatMessage({ id: 'settings.showNutrition' }),
                  showPriceData: intl.formatMessage({ id: 'settings.showPriceData' }),
                }}
                onTabVisibilityChange={(tab, isVisible) => {
                  const hidden = settings.navigation?.hiddenTabs ?? [];
                  const newHidden = isVisible ? hidden.filter((currentTab: string) => currentTab !== tab) : [...hidden, tab];
                  setSettings((previous) => ({
                    ...previous,
                    navigation: { ...previous.navigation, hiddenTabs: newHidden },
                  }));
                }}
                storeLayoutTitle={intl.formatMessage({ id: 'settings.storeLayout' })}
                defaultStoreLayout={defaultStoreLayout}
                onStoreLayoutChange={(newLayout) => setSettings((previous) => ({
                  ...previous,
                  shopping: {
                    ...previous.shopping,
                    storeLayout: newLayout,
                  },
                }))}
                onStoreProfilesChange={(profiles, active) => setSettings((previous) => ({
                  ...previous,
                  shopping: {
                    ...previous.shopping,
                    storeProfiles: profiles,
                    activeStoreProfile: active,
                  },
                }))}
                categoriesTitle={intl.formatMessage({ id: 'settings.categories' })}
                customCategoryCount={customCategories.length}
                onManageCategories={() => setShowCategoryManager(true)}
                pantryImagesTitle={intl.formatMessage({ id: 'settings.pantryImages' })}
                updatingBulkImages={updatingBulkImages}
                onBulkUpdate={handleBulkImageUpdate}
              />
            </Suspense>
          )}

          {activeCategory === 'notifications' && (
            <Suspense fallback={null}>
              <SettingsNotificationsPage
                title={intl.formatMessage({ id: 'settings.notifications' })}
                pendingTitle={intl.formatMessage({ id: 'settings.pendingNotifications' })}
                user={user}
                notificationSettings={notificationSettings}
                setNotificationSettings={handleNotificationSettingsChange}
              />
            </Suspense>
          )}

          {activeCategory === 'food_waste' && (
            <Suspense fallback={null}>
              <SettingsFoodWastePage
                userId={user?.id}
                householdId={household?.id}
                title={intl.formatMessage({ id: 'settings.leftoverAnalytics' })}
              />
            </Suspense>
          )}

          {activeCategory === 'help_and_support' && (
            <Suspense fallback={null}>
              <SettingsHelpAndSupportPage
                helpTitle="Help"
                helpDescription="App documentation, guides, and FAQs"
                onOpenFAQ={() => setShowFAQModal(true)}
                feedbackTitle={intl.formatMessage({ id: 'settings.feedback' })}
                feedback={feedback}
                setFeedback={setFeedback}
                sending={sending}
                onSubmitFeedback={handleFeedbackSubmit}
                privacyTitle={intl.formatMessage({ id: 'settings.privacy' })}
                onViewPrivacyPolicy={() => {
                  const privacyUrl = (window as Window & { PRIVACY_POLICY_URL?: string }).PRIVACY_POLICY_URL || 'https://stock-spoon-website.firebaseapp.com/privacy.html';
                  window.open(privacyUrl, '_blank');
                }}
                onViewTermsOfService={() => {
                  const termsUrl = (window as Window & { TERMS_OF_SERVICE_URL?: string }).TERMS_OF_SERVICE_URL || 'https://stock-spoon-website.firebaseapp.com/terms.html';
                  window.open(termsUrl, '_blank');
                }}
                onCopyPrivacyUrl={() => {
                  const privacyUrl = (window as Window & { PRIVACY_POLICY_URL?: string }).PRIVACY_POLICY_URL || 'https://stock-spoon-website.firebaseapp.com/privacy.html';
                  if (navigator.clipboard) navigator.clipboard.writeText(privacyUrl);
                  addToast?.('Privacy policy URL copied to clipboard', 'success');
                }}
                canDeleteAccount={!!user && !user.isGuest}
                onDeleteAccount={() => setShowDeleteConfirm(true)}
                onReplayOnboarding={onReplayOnboarding}
              />
            </Suspense>
          )}

          {activeCategory === 'admin_analytics' && isAdmin && (
            <Suspense fallback={null}>
              <SettingsAdminPage
                user={user}
                onResetUsage={handleResetUsageCounters}
                addToast={addToast}
              />
            </Suspense>
          )}

          {activeCategory === 'update' && (
            <Suspense fallback={null}>
              <SettingsUpdatePage
                title={intl.formatMessage({ id: 'settings.appUpdates' })}
              />
            </Suspense>
          )}
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
        <Suspense fallback={null}>
          <SettingsMemberPreferencesModal
            selectedMember={selectedMember}
            memberPreferences={memberPreferences}
            setMemberPreferences={setMemberPreferences}
            savingMemberPrefs={savingMemberPrefs}
            onClose={() => setShowMemberPreferencesModal(false)}
            onSave={saveMemberPreferences}
          />
        </Suspense>
      )}



    {/* FAQ Modal */}
    {showFAQModal && (
      <Suspense fallback={null}>
        <SettingsFAQModal
          onClose={() => setShowFAQModal(false)}
          onNavigateToFeedback={() => {
            setShowFAQModal(false);
            setActiveCategory('help_and_support');
          }}
        />
      </Suspense>
    )}

    {/* Delete Account Confirmation Modal */}
    {showDeleteConfirm && (
      <Suspense fallback={null}>
        <SettingsDeleteAccountModal
          isDeletingAccount={isDeletingAccount}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteAccount}
        />
      </Suspense>
    )}

    </>
  );
};

export const Settings = React.memo(SettingsComponent);
