import React, { useState, useEffect, useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';
import DatabaseMonitoringService from '../services/databaseMonitoringService';
import { SubscriptionManager } from './SubscriptionManager';
import { CategoryManager } from './CategoryManager';
import { StoreLayoutEditor } from './StoreLayoutEditor';
import { log } from '../services/logService';
import { useIntl } from 'react-intl';
import AnalyticsService from '../services/analyticsService';
import { LanguageSelector } from '../src/components/LanguageSelector';
import { useNotifications } from '../hooks/useNotifications';
import { FAQPage } from './FAQPage';
import { User, UserProfile, CustomCategory, Member } from '../types';
import type { Settings as AppSettings } from '../types';

type MemberPreferences = Pick<Member, 'dietaryRestrictions' | 'allergies' | 'dietGoal' | 'favoriteCuisines' | 'specialNeeds' | 'preferredProteins' | 'dislikedIngredients'>;
import { NotificationSettingsComponent } from './NotificationSettings';
import { PendingNotifications } from './PendingNotifications';
import { NotificationService, NotificationSettings } from '../services/notificationService';
import { DayPlan } from '../types';
import { Loader2, ChevronDown, ChevronRight, Heart, AlertTriangle, Edit2, X, Settings as SettingsIcon } from 'lucide-react';
import { userOptedInToGemini, setUserGeminiOptIn, getGeminiUsage } from '../services/featureFlags';
import { VersionUpdate } from './VersionUpdate';
import { MonitoringDashboard } from './MonitoringDashboard';
import { Household } from '../types';
import LeftoverPersonaQuestionnaire from './LeftoverPersonaQuestionnaire';
import { LeftoverAnalytics } from './LeftoverAnalytics';
import { serverTimestamp } from 'firebase/firestore';
import { InventoryCacheService } from '../services/inventoryCacheService';
import { MealPlanCacheService } from '../services/MealPlanCacheService';
import { RecipesCacheService } from '../services/recipesCacheService';
import { useSubscription } from '../hooks/useSubscription';
import { UsageService } from '../services/usageService';
import type { UsageLimits } from '../services/usageService';
import { ShoppingListCacheService } from '../services/shoppingListCacheService';
import { setDoc } from 'firebase/firestore';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { RemoteConfigDebugPanel } from './RemoteConfigDebugPanel';

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
    showNutrition: false,
    showPriceData: false,
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
}

export const Settings: React.FC<SettingsProps> = ({ 
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
  addToast
}) => {
  const intl = useIntl();
  const [feedback, setFeedback] = useState('');
  const [sending, setSending] = useState(false);
  const { isPremium, isFamily } = useSubscription(user || null);
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);
  const { isAdmin } = useIsAdmin(user?.id);

  useEffect(() => {
    if (!user) return;
    UsageService.getUsageLimits(user).then(limits => setUsageLimits(limits)).catch(() => {});
  }, [user?.id]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [updatingAvatar, setUpdatingAvatar] = useState(false);
  const [pendingNotifications, setPendingNotifications] = useState(settings?.notifications || defaultSettings.notifications);
  const [_notifChanged, setNotifChanged] = useState(false);
  const [showAvatarSelection, setShowAvatarSelection] = useState(false);
  const [_householdMembers, _setHouseholdMembers] = useState(user?.householdMembers || []);
  const [_showHouseholdManager, _setShowHouseholdManager] = useState(false);
  const [profileChanged, setProfileChanged] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | undefined>(user?.profile);
  const [geminiOptedIn, setGeminiOptedIn] = useState(() => userOptedInToGemini(user?.id));
  const [_geminiUsage, setGeminiUsage] = useState(() => getGeminiUsage(user?.id));
  const [updatingBulkImages, setUpdatingBulkImages] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(
    NotificationService.getDefaultSettings()
  );
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['Profile', 'Household']));
  const [activeSettingsTab, setActiveSettingsTab] = useState<'account' | 'preferences' | 'organization' | 'more'>('account');

  // Member preferences state
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberPreferences, setMemberPreferences] = useState<Partial<MemberPreferences>>({});
  const [savingMemberPrefs, setSavingMemberPrefs] = useState(false);
  const [showMemberPreferencesModal, setShowMemberPreferencesModal] = useState(false);

  // FAQ modal state
  const [showFAQModal, setShowFAQModal] = useState(false);

  // Household creation state
  const [householdName, setHouseholdName] = useState('');
  const [isCreatingHousehold, setIsCreatingHousehold] = useState(false);

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

  // Use the notifications hook
  useNotifications(settings.notifications, user?.email, mealPlan);

  const handleChange = (field: string, value: Record<string, unknown>) => {
    setSettings((prev) => ({
      ...prev,
      [field]: {
        ...(prev as any)[field],
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
      [key]: typeof value === 'object' && value !== null ? { ...(prev as any)[key], ...value } : value,
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
          status: 'active'
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

      // Refresh the page to show the new household
      window.location.reload();

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
      } catch (_error) {
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
      await DatabaseMonitoringService.addDoc(DatabaseMonitoringService.collection('feedback'), {
        text: feedback,
        createdAt: Timestamp.now(),
        user: user ? {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar || null
        } : null
      });
      addToast?.('Thank you for your feedback!', 'success');
      setFeedback('');
    } catch (_err) {
      addToast?.('Failed to send feedback. Please try again later.', 'error');
    }
    setSending(false);
  };

  return (
    <>

      <div className="pb-24 max-w-md mx-auto">

      {/* Settings Tab Pills */}
      <div className="sticky top-0 z-10 bg-theme-primary border-b border-theme px-4 py-3">
        <div className="flex gap-1 bg-theme-secondary rounded-xl p-1">
          {(['account', 'preferences', 'organization', 'more'] as const).map((tab) => {
            const labels: Record<string, string> = { account: 'Account', preferences: 'Prefs', organization: 'Organize', more: 'More' };
            return (
              <button
                key={tab}
                data-settings-tab={tab}
                onClick={() => setActiveSettingsTab(tab)}
                className={`flex-1 py-2 px-1 rounded-lg text-sm font-medium text-center transition-colors ${
                  activeSettingsTab === tab
                    ? 'bg-[var(--accent-color)] text-white shadow-sm'
                    : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-2 pb-6 px-6 space-y-6">

      {activeSettingsTab === 'account' && <>

      {/* Profile Section */}
      {user && onLogout && (
        <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden" data-section="profile">
          <div
            onClick={() => toggleSection('Profile')}
            className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors"
          >
            <div className="flex items-center gap-3">
              {expandedSections.has('Profile') ? (
                <ChevronDown className="w-5 h-5 text-theme-primary" />
              ) : (
                <ChevronRight className="w-5 h-5 text-theme-primary" />
              )}
              <h3 className="font-semibold text-theme-primary">{intl.formatMessage({ id: 'settings.profile' })}</h3>
            </div>
          </div>

          {expandedSections.has('Profile') && (
            <div className="border-t border-theme p-4">
          {/* Avatar Section */}
          <div className="mb-4">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
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
                value={userProfile?.name || user.name || ''}
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
            
            {/* Height and Weight - keep in 2 columns */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-theme-secondary mb-1">{intl.formatMessage({ id: 'settings.height' })}</label>
                <div className="flex gap-1">
                  <div className="flex-1">
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
                      className="w-full p-1 text-xs border rounded text-black bg-white"
                      min="0"
                      max="8"
                      size={3}
                    />
                    <span className="text-xs text-theme-secondary block mt-0.5">ft</span>
                  </div>
                  <div className="flex-1">
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
                      className="w-full p-1 text-xs border rounded text-black bg-white"
                      min="0"
                      max="11"
                      size={3}
                    />
                    <span className="text-xs text-theme-secondary block mt-0.5">in</span>
                  </div>
                </div>
              </div>
              <div>
                <label htmlFor="weight" className="block text-xs text-theme-secondary mb-1">{intl.formatMessage({ id: 'settings.weight' })}</label>
                <input
                  id="weight"
                  name="weight"
                  type="number"
                  min="0"
                  value={userProfile?.weight || ''}
                  onChange={(e) => handleProfileChange('weight', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="154"
                  className="w-full p-1 text-xs border rounded text-black bg-white"
                  size={3}
                />
              </div>
            </div>

            {/* Age, Gender, and Household Size - 3 columns */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label htmlFor="age" className="block text-xs text-theme-secondary mb-1">Age</label>
                <input
                  id="age"
                  name="age"
                  type="number"
                  min="0"
                  value={userProfile?.age || ''}
                  onChange={(e) => handleProfileChange('age', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="30"
                  className="w-full p-1 text-xs border rounded text-black bg-white"
                  size={2}
                />
              </div>
              <div>
                <label htmlFor="gender" className="block text-xs text-theme-secondary mb-1">{intl.formatMessage({ id: 'settings.gender' })}</label>
                <select
                  id="gender"
                  name="gender"
                  value={userProfile?.gender || ''}
                  onChange={(e) => handleProfileChange('gender', e.target.value || undefined)}
                  className="w-full p-1 text-xs border rounded text-black bg-white"
                >
                  <option value="">{intl.formatMessage({ id: 'settings.selectGender' })}</option>
                  <option value="male">{intl.formatMessage({ id: 'settings.genders.male' })}</option>
                  <option value="female">{intl.formatMessage({ id: 'settings.genders.female' })}</option>
                  <option value="other">{intl.formatMessage({ id: 'settings.genders.other' })}</option>
                  <option value="prefer-not-to-say">{intl.formatMessage({ id: 'settings.genders.preferNotToSay' })}</option>
                </select>
              </div>
              <div>
                <label htmlFor="householdSize" className="block text-xs text-theme-secondary mb-1">{intl.formatMessage({ id: 'settings.household' })}</label>
                <input
                  id="householdSize"
                  name="householdSize"
                  type="number"
                  value={userProfile?.householdSize || ''}
                  onChange={(e) => handleProfileChange('householdSize', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="4"
                  className="w-full p-1 text-xs border rounded text-black bg-white"
                  min="1"
                  max="20"
                  size={3}
                />
                <span className="text-xs text-theme-secondary block mt-0.5">people</span>
              </div>
            </div>

            {/* Diet Goal and Activity Level - combine into 2 columns */}
            <div className="grid grid-cols-2 gap-3">
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

            {profileChanged && (
              <button
                onClick={saveProfile}
                disabled={savingProfile}
                className="w-full bg-green-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
                {savingProfile ? 'Saving...' : intl.formatMessage({ id: 'settings.saveProfile' })}
              </button>
            )}
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="w-full bg-red-500 text-white px-4 py-2 rounded font-medium hover:bg-red-600"
          >
            Logout
          </button>
            </div>
          )}
        </div>
      )}

      {/* Pending Notifications Section */}
      {user && (
        <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden" data-section="pending-notifications">
          <div
            onClick={() => toggleSection('PendingNotifications')}
            className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors"
          >
            <div className="flex items-center gap-3">
              {expandedSections.has('PendingNotifications') ? (
                <ChevronDown className="w-5 h-5 text-theme-primary" />
              ) : (
                <ChevronRight className="w-5 h-5 text-theme-primary" />
              )}
              <h3 className="font-semibold text-theme-primary">{intl.formatMessage({ id: 'settings.pendingNotifications' })}</h3>
            </div>
          </div>
          {expandedSections.has('PendingNotifications') && (
            <div className="border-t border-theme p-4">
              <PendingNotifications user={user} />
            </div>
          )}
        </div>
      )}

      {/* Usage & Limits Section */}
      {user && (
        <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden" data-section="usage-limits">
          <div
            onClick={() => toggleSection('UsageLimits')}
            className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors"
          >
            <div className="flex items-center gap-3">
              {expandedSections.has('UsageLimits') ? (
                <ChevronDown className="w-5 h-5 text-theme-primary" />
              ) : (
                <ChevronRight className="w-5 h-5 text-theme-primary" />
              )}
              <h3 className="font-semibold text-theme-primary">{intl.formatMessage({ id: 'settings.usageLimits' })}</h3>
            </div>
            {!isPremium && !isFamily && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Free Plan</span>
            )}
          </div>
          {expandedSections.has('UsageLimits') && (
            <div className="border-t border-theme p-4 space-y-4">
              {usageLimits ? (
                <>
                  <div className="space-y-3">
                    {/* AI Scans */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-theme-secondary">AI Scans (weekly)</span>
                        <span className={`text-sm font-semibold ${
                          usageLimits.gemini.weekly !== -1 && usageLimits.gemini.used >= usageLimits.gemini.weekly
                            ? 'text-red-500' : 'text-theme-primary'
                        }`}>
                          {usageLimits.gemini.used} / {usageLimits.gemini.weekly === -1 ? '∞' : usageLimits.gemini.weekly}
                        </span>
                      </div>
                      {usageLimits.gemini.weekly !== -1 && (
                        <div className="w-full bg-theme-primary/20 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              usageLimits.gemini.used >= usageLimits.gemini.weekly ? 'bg-red-500' : 'bg-[var(--accent-color)]'
                            }`}
                            style={{ width: `${Math.min(100, (usageLimits.gemini.used / usageLimits.gemini.weekly) * 100)}%` }}
                          />
                        </div>
                      )}
                      {usageLimits.gemini.weekly !== -1 && usageLimits.gemini.used >= usageLimits.gemini.weekly && (
                        <p className="text-xs text-red-500 mt-1">⚠️ Weekly limit reached — upgrade to continue scanning</p>
                      )}
                    </div>

                    {/* Saved Recipes */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-theme-secondary">Saved Recipes</span>
                        <span className={`text-sm font-semibold ${
                          usageLimits.recipes.max !== -1 && usageLimits.recipes.used >= usageLimits.recipes.max
                            ? 'text-red-500' : 'text-theme-primary'
                        }`}>
                          {usageLimits.recipes.used} / {usageLimits.recipes.max === -1 ? '∞' : usageLimits.recipes.max}
                        </span>
                      </div>
                      {usageLimits.recipes.max !== -1 && (
                        <div className="w-full bg-theme-primary/20 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              usageLimits.recipes.used >= usageLimits.recipes.max ? 'bg-red-500' : 'bg-[var(--accent-color)]'
                            }`}
                            style={{ width: `${Math.min(100, (usageLimits.recipes.used / usageLimits.recipes.max) * 100)}%` }}
                          />
                        </div>
                      )}
                      {usageLimits.recipes.max !== -1 && usageLimits.recipes.used >= usageLimits.recipes.max && (
                        <p className="text-xs text-red-500 mt-1">⚠️ Recipe limit reached — upgrade to save more</p>
                      )}
                    </div>

                    {/* Meal Plan Additions */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-theme-secondary">Meal Plan Additions (weekly)</span>
                        <span className={`text-sm font-semibold ${
                          usageLimits.mealPlanning.weeklyRecipes !== -1 && usageLimits.mealPlanning.weeklyUsed >= usageLimits.mealPlanning.weeklyRecipes
                            ? 'text-red-500' : 'text-theme-primary'
                        }`}>
                          {usageLimits.mealPlanning.weeklyUsed} / {usageLimits.mealPlanning.weeklyRecipes === -1 ? '∞' : usageLimits.mealPlanning.weeklyRecipes}
                        </span>
                      </div>
                      {usageLimits.mealPlanning.weeklyRecipes !== -1 && (
                        <div className="w-full bg-theme-primary/20 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              usageLimits.mealPlanning.weeklyUsed >= usageLimits.mealPlanning.weeklyRecipes ? 'bg-red-500' : 'bg-[var(--accent-color)]'
                            }`}
                            style={{ width: `${Math.min(100, (usageLimits.mealPlanning.weeklyUsed / usageLimits.mealPlanning.weeklyRecipes) * 100)}%` }}
                          />
                        </div>
                      )}
                      {usageLimits.mealPlanning.weeklyRecipes !== -1 && usageLimits.mealPlanning.weeklyUsed >= usageLimits.mealPlanning.weeklyRecipes && (
                        <p className="text-xs text-red-500 mt-1">⚠️ Weekly meal plan limit reached — upgrade to add more</p>
                      )}
                    </div>

                    {/* Custom Categories */}
                    {!isPremium && !isFamily && (
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-theme-secondary">Custom Categories</span>
                        <span className="text-sm font-semibold text-theme-primary">
                          Free: 1 category max
                        </span>
                      </div>
                    )}

                    {/* Grocery Estimator */}
                    {!isPremium && !isFamily && (
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-theme-secondary">Grocery Cost Estimator</span>
                        <span className="text-sm font-semibold text-theme-primary">
                          Free: 5 ingredients shown
                        </span>
                      </div>
                    )}

                    {/* Meal Plan View */}
                    {!isPremium && !isFamily && (
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-theme-secondary">Meal Plan View</span>
                        <span className="text-sm font-semibold text-theme-primary">
                          Free: current week only
                        </span>
                      </div>
                    )}
                  </div>

                  {!isPremium && !isFamily && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                      <p className="text-amber-800 font-medium mb-1">🔓 Unlock more with Premium or Family</p>
                      <ul className="text-amber-700 text-xs space-y-0.5">
                        <li>• Unlimited AI scans, recipe saves &amp; meal plan entries</li>
                        <li>• Unlimited custom categories</li>
                        <li>• Full grocery cost estimates</li>
                        <li>• Monthly meal plan view</li>
                      </ul>
                      <p className="text-amber-600 text-xs mt-2">Upgrade via Settings → More → Subscription</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-theme-secondary opacity-60">Loading usage data…</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Household Members Section */}
      {user && (
        <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden" data-section="household">
          <div
            onClick={() => toggleSection('Household')}
            className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors"
          >
            <div className="flex items-center gap-3">
              {expandedSections.has('Household') ? (
                <ChevronDown className="w-5 h-5 text-theme-primary" />
              ) : (
                <ChevronRight className="w-5 h-5 text-theme-primary" />
              )}
              <h3 className="font-semibold text-theme-primary">{intl.formatMessage({ id: 'settings.household' })}</h3>
            </div>
          </div>

          {expandedSections.has('Household') && (
            <div className="border-t border-theme p-4">
              {household ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-theme-primary">{household.name}</p>
                      <p className="text-xs text-theme-secondary">
                        {household.members && Array.isArray(household.members) ? household.members.length : 0} member{household.members && Array.isArray(household.members) && household.members.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <button
                      onClick={() => onShowHousehold?.()}
                      className="px-3 py-2 bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-color)]/80 transition-colors text-sm font-medium"
                    >
                      {intl.formatMessage({ id: 'settings.manageHousehold' })}
                    </button>
                  </div>

                  {/* Member List */}
                  <div className="space-y-3 mb-4">
                    {household.members && Array.isArray(household.members) && household.members.map((member) => {
                      const isCurrentUser = member.id === user.id;
                      const isAdmin = member.role === 'admin';
                      const currentUserIsAdmin = household.members.find(m => m.id === user.id)?.role === 'admin';
                      
                      return (
                        <div key={member.id} className="bg-theme-secondary/50 rounded-lg p-3 border border-theme">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-theme-primary rounded-full flex items-center justify-center text-sm font-medium text-theme-secondary">
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-theme-primary">{member.name}</p>
                                  {isAdmin && (
                                    <span className="px-2 py-0.5 bg-[var(--accent-color)] text-white text-xs rounded-full">
                                      Admin
                                    </span>
                                  )}
                                  {isCurrentUser && (
                                    <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                                      You
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-theme-secondary">{member.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {(currentUserIsAdmin || isCurrentUser) && (
                              <button
                                onClick={() => openMemberPreferences(member)}
                                className="flex items-center gap-2 px-3 py-1 bg-theme-primary hover:bg-theme-secondary text-theme-secondary hover:text-theme-primary rounded-lg text-sm transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                                {currentUserIsAdmin && !isCurrentUser ? 'Edit' : 'My Prefs'}
                              </button>
                              )}
                              {currentUserIsAdmin && !isCurrentUser && (
                                <button
                                  onClick={() => removeMemberFromHousehold(member)}
                                  className="flex items-center gap-2 px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Member Preferences Form - Now handled in modal */}


                  <p className="text-sm text-theme-secondary">
                    Customize preferences for each household member to get personalized recipe recommendations and shopping suggestions.
                  </p>
                </>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-theme-secondary">
                    Create a household to share your pantry with family members.
                  </p>
                  
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="householdName" className="block text-sm font-medium text-theme-primary mb-1">
                        Household Name
                      </label>
                      <input
                        id="householdName"
                        type="text"
                        value={householdName}
                        onChange={(e) => setHouseholdName(e.target.value)}
                        placeholder="e.g., Smith Family"
                        className="w-full px-3 py-2 border border-theme rounded-lg bg-theme-primary text-theme-secondary placeholder-theme-secondary/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent"
                        disabled={isCreatingHousehold}
                      />
                    </div>
                    
                    <button
                      onClick={createHousehold}
                      disabled={!householdName.trim() || isCreatingHousehold}
                      className="w-full bg-[var(--accent-color)] text-white px-4 py-2 rounded-lg font-medium hover:bg-[var(--accent-color)]/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                    >
                      {isCreatingHousehold && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isCreatingHousehold ? 'Creating...' : 'Create Household'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      </>}

      {activeSettingsTab === 'preferences' && <>

      {/* App Preferences Section */}
      <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
        <div
          onClick={() => toggleSection('AppPreferences')}
          className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors"
        >
          <div className="flex items-center gap-3">
            {expandedSections.has('AppPreferences') ? (
              <ChevronDown className="w-5 h-5 text-theme-primary" />
            ) : (
              <ChevronRight className="w-5 h-5 text-theme-primary" />
            )}
            <h3 className="font-semibold text-theme-primary">{intl.formatMessage({ id: 'settings.appPreferences' })}</h3>
          </div>
        </div>

        {expandedSections.has('AppPreferences') && (
          <div className="border-t border-theme px-4 divide-y divide-theme">

            {/* Enable Notifications */}
            <div className="flex items-center justify-between py-3">
              <div className="flex-1 pr-4">
                <p className="text-sm font-medium text-theme-primary">{intl.formatMessage({ id: 'settings.enableNotifications' })}</p>
                <p className="text-xs text-theme-secondary mt-0.5">Receive alerts for expiring items, meal plans, and shopping reminders</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.notifications.enabled}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, enabled: e.target.checked }
                  }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-400 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-color)]"></div>
              </label>
            </div>

            {/* Measurement System */}
            <div className="flex items-center justify-between py-3">
              <div className="flex-1 pr-4">
                <p className="text-sm font-medium text-theme-primary">{intl.formatMessage({ id: 'settings.measurementSystem' })}</p>
                <p className="text-xs text-theme-secondary mt-0.5">Choose between imperial and metric units throughout the app</p>
              </div>
              <div className="flex bg-theme-primary rounded-lg p-0.5 border border-theme flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleProfileChange('measurementSystem', 'Standard')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                    userProfile?.measurementSystem !== 'Metric'
                      ? 'bg-[var(--accent-color)] text-white shadow-sm'
                      : 'text-theme-secondary'
                  }`}
                >
                  Imperial
                </button>
                <button
                  type="button"
                  onClick={() => handleProfileChange('measurementSystem', 'Metric')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                    userProfile?.measurementSystem === 'Metric'
                      ? 'bg-[var(--accent-color)] text-white shadow-sm'
                      : 'text-theme-secondary'
                  }`}
                >
                  Metric
                </button>
              </div>
            </div>

            {/* Enable AI Features */}
            <div className="flex items-center justify-between py-3">
              <div className="flex-1 pr-4">
                <p className="text-sm font-medium text-theme-primary">{intl.formatMessage({ id: 'settings.enableAiFeatures' })}</p>
                <p className="text-xs text-theme-secondary mt-0.5">Use AI for recipe suggestions, smart shopping tips, and meal planning assistance</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={geminiOptedIn}
                  onChange={e => handleGeminiOptIn(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-400 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-color)]"></div>
              </label>
            </div>

            {/* Include Staples in Shopping List */}
            <div className="flex items-center justify-between py-3">
              <div className="flex-1 pr-4">
                <p className="text-sm font-medium text-theme-primary">{intl.formatMessage({ id: 'settings.includeStaples' })}</p>
                <p className="text-xs text-theme-secondary mt-0.5">Automatically suggest common pantry staples when building a shopping list</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.shopping?.includeStaples || false}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    shopping: { ...prev.shopping, includeStaples: e.target.checked }
                  }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-400 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-color)]"></div>
              </label>
            </div>

            {/* Auto-restock Staples */}
            <div className="flex items-center justify-between py-3">
              <div className="flex-1 pr-4">
                <p className="text-sm font-medium text-theme-primary">{intl.formatMessage({ id: 'settings.autoRestockStaples' })}</p>
                <p className="text-xs text-theme-secondary mt-0.5">Automatically add staple items back to your shopping list when they run low or run out</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.shopping?.autoReaddStaples ?? true}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    shopping: { ...prev.shopping, autoReaddStaples: e.target.checked }
                  }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-400 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-color)]"></div>
              </label>
            </div>

            {/* Show Nutrition Information */}
            <div className="flex items-center justify-between py-3">
              <div className="flex-1 pr-4">
                <p className="text-sm font-medium text-theme-primary">{intl.formatMessage({ id: 'settings.showNutrition' })}</p>
                <p className="text-xs text-theme-secondary mt-0.5">Display calories, protein, and macros on recipes and pantry items</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.shopping?.showNutrition ?? true}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    shopping: { ...prev.shopping, showNutrition: e.target.checked }
                  }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-400 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-color)]"></div>
              </label>
            </div>

            {/* Show Price Data */}
            <div className="flex items-center justify-between py-3">
              <div className="flex-1 pr-4">
                <p className="text-sm font-medium text-theme-primary">{intl.formatMessage({ id: 'settings.showPriceData' })}</p>
                <p className="text-xs text-theme-secondary mt-0.5">Display estimated grocery prices on shopping list items and pantry ingredients</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.shopping?.showPriceData ?? false}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    shopping: { ...prev.shopping, showPriceData: e.target.checked }
                  }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-400 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-color)]"></div>
              </label>
            </div>

          </div>
        )}
      </div>

      {/* Food Safety Section */}
      <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
        <div
          onClick={() => toggleSection('FoodSafety')}
          className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors"
        >
          <div className="flex items-center gap-3">
            {expandedSections.has('FoodSafety') ? (
              <ChevronDown className="w-5 h-5 text-theme-primary" />
            ) : (
              <ChevronRight className="w-5 h-5 text-theme-primary" />
            )}
            <h3 className="font-semibold text-theme-primary">{intl.formatMessage({ id: 'settings.foodSafety' })}</h3>
          </div>
        </div>

        {expandedSections.has('FoodSafety') && (
          <div className="border-t border-theme p-4 space-y-5">

            {/* Dietary Restrictions */}
            <div>
              <label className="block text-sm font-medium text-theme-primary mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Dietary Restrictions
              </label>
              <p className="text-xs text-theme-secondary mb-3">Select all that apply — these will affect recipe recommendations and meal planning</p>
              <div className="grid grid-cols-2 gap-3">
                {['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Paleo', 'Low-Carb', 'Halal', 'Kosher'].map((restriction) => (
                  <label key={restriction} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userProfile?.dietaryRestrictions?.includes(restriction) || false}
                      onChange={(e) => {
                        const current = userProfile?.dietaryRestrictions || [];
                        const newRestrictions = e.target.checked
                          ? [...current, restriction]
                          : current.filter(r => r !== restriction);
                        const newProfile = { ...userProfile, dietaryRestrictions: newRestrictions };
                        setUserProfile(newProfile);
                        debouncedSaveProfile(newProfile);
                      }}
                      className="rounded border-theme text-theme-primary focus:border-theme-primary"
                    />
                    <span className="text-theme-primary">{restriction}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Favorite Cuisines */}
            <div>
              <label className="block text-sm font-medium text-theme-primary mb-3 flex items-center gap-2">
                <Heart className="w-4 h-4" />
                Favorite Cuisines
              </label>
              <p className="text-xs text-theme-secondary mb-3">Select cuisines you enjoy — these will influence recipe suggestions</p>
              <div className="grid grid-cols-2 gap-3">
                {['Italian', 'Mexican', 'Chinese', 'Japanese', 'Indian', 'Thai', 'French', 'Mediterranean', 'American', 'Korean'].map((cuisine) => (
                  <label key={cuisine} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userProfile?.favoriteCuisines?.includes(cuisine) || false}
                      onChange={(e) => {
                        const current = userProfile?.favoriteCuisines || [];
                        const newCuisines = e.target.checked
                          ? [...current, cuisine]
                          : current.filter(c => c !== cuisine);
                        const newProfile = { ...userProfile, favoriteCuisines: newCuisines };
                        setUserProfile(newProfile);
                        debouncedSaveProfile(newProfile);
                      }}
                      className="rounded border-theme text-theme-primary focus:border-theme-primary"
                    />
                    <span className="text-theme-primary">{cuisine}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Preferred Proteins */}
            <div>
              <label className="block text-sm font-medium text-theme-primary mb-3">Preferred Proteins</label>
              <p className="text-xs text-theme-secondary mb-3">Select proteins you prefer — these will be prioritized in meal suggestions</p>
              <div className="grid grid-cols-2 gap-3">
                {['Chicken', 'Beef', 'Pork', 'Fish', 'Tofu', 'Beans', 'Eggs', 'Turkey', 'Lamb', 'Shrimp'].map((protein) => (
                  <label key={protein} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userProfile?.preferredProteins?.includes(protein) || false}
                      onChange={(e) => {
                        const current = userProfile?.preferredProteins || [];
                        const newProteins = e.target.checked
                          ? [...current, protein]
                          : current.filter(p => p !== protein);
                        const newProfile = { ...userProfile, preferredProteins: newProteins };
                        setUserProfile(newProfile);
                        debouncedSaveProfile(newProfile);
                      }}
                      className="rounded border-theme text-theme-primary focus:border-theme-primary"
                    />
                    <span className="text-theme-primary">{protein}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Disliked Ingredients */}
            <div>
              <label className="block text-sm font-medium text-theme-primary mb-3">Disliked Ingredients</label>
              <p className="text-xs text-theme-secondary mb-2">Ingredients you don't like — these will be avoided in suggestions</p>
              <input
                type="text"
                value={userProfile?.dislikedIngredients?.join(', ') || ''}
                onChange={(e) => {
                  const newIngredients = e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0) : undefined;
                  const newProfile = { ...userProfile, dislikedIngredients: newIngredients };
                  setUserProfile(newProfile);
                  debouncedSaveProfile(newProfile);
                }}
                placeholder="e.g., mushrooms, olives, cilantro"
                className="w-full px-3 py-2 text-sm border border-theme rounded-lg bg-white text-black focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
              />
            </div>

            {/* Special Dietary Needs */}
            <div>
              <label className="block text-sm font-medium text-theme-primary mb-3">Special Dietary Needs</label>
              <p className="text-xs text-theme-secondary mb-2">Any additional dietary requirements or preferences</p>
              <textarea
                value={userProfile?.specialNeeds || ''}
                onChange={(e) => {
                  const newProfile = { ...userProfile, specialNeeds: e.target.value || undefined };
                  setUserProfile(newProfile);
                  debouncedSaveProfile(newProfile);
                }}
                placeholder="e.g., low sodium, diabetic friendly, etc."
                className="w-full px-3 py-2 text-sm border border-theme rounded-lg bg-white text-black focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] resize-none"
                rows={2}
              />
            </div>

            {/* Leftover Persona */}
            <LeftoverPersonaQuestionnaire
              user={user}
              userProfile={userProfile}
              onChange={(persona) => {
                const newProfile = { ...userProfile, leftoverPersona: persona };
                setUserProfile(newProfile);
                saveProfileData(newProfile, true);
              }}
            />

          </div>
        )}
      </div>

      {/* Theme Settings Section */}
      <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
        <div
          onClick={() => toggleSection('Theme')}
          className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors"
        >
          <div className="flex items-center gap-3">
            {expandedSections.has('Theme') ? (
              <ChevronDown className="w-5 h-5 text-theme-primary" />
            ) : (
              <ChevronRight className="w-5 h-5 text-theme-primary" />
            )}
            <h3 className="font-semibold text-theme-primary">{intl.formatMessage({ id: 'settings.themeSettings' })}</h3>
          </div>
        </div>

        {expandedSections.has('Theme') && (
          <div className="border-t border-theme p-4">
          <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => {
              setSettings(prev => ({
                ...prev,
                theme: {
                  mode: 'dark',
                  accentColor: '#4CAF50',
                  backgroundColor: undefined,
                  textColor: undefined,
                }
              }));
            }}
            className="text-xs px-3 py-1 bg-theme-primary border border-theme rounded hover:bg-theme-secondary transition-colors text-theme-primary"
          >
            Reset to Default
          </button>
          </div>
          <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-theme-primary">{intl.formatMessage({ id: 'settings.theme' })}</span>
            <select
              id="themeMode"
              name="themeMode"
              value={settings.theme.mode}
              onChange={(e) => handleChange('theme', { mode: e.target.value })}
              className="border rounded px-2 py-1 text-black bg-white text-sm"
            >
              <option value="dark">{intl.formatMessage({ id: 'settings.themes.dark' })}</option>
              <option value="light">{intl.formatMessage({ id: 'settings.themes.light' })}</option>
            </select>
            <span className="text-sm text-theme-primary ml-4">{intl.formatMessage({ id: 'settings.accent' })}</span>
            <input
              id="accentColor"
              name="accentColor"
              type="color"
              value={settings.theme.accentColor}
              onChange={(e) => handleChange('theme', { accentColor: e.target.value })}
              className="border rounded w-8 h-8 ml-2"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-theme-primary">{intl.formatMessage({ id: 'settings.background' })}</span>
            <input
              id="backgroundColor"
              name="backgroundColor"
              type="color"
              value={settings.theme.backgroundColor || '#ffffff'}
              onChange={(e) => handleChange('theme', { backgroundColor: e.target.value })}
              className="border rounded w-8 h-8"
            />
            <span className="text-sm text-theme-primary ml-4">{intl.formatMessage({ id: 'settings.textColor' })}</span>
            <input
              id="textColor"
              name="textColor"
              type="color"
              value={settings.theme.textColor || '#000000'}
              onChange={(e) => handleChange('theme', { textColor: e.target.value })}
              className="border rounded w-8 h-8 ml-2"
            />
          </div>
        </div>

        {/* Language Selector */}
        <div className="mt-4 pt-3 border-t border-theme">
          <div className="flex items-center justify-between">
            <span className="text-sm text-theme-primary">{intl.formatMessage({ id: 'settings.language' })}</span>
            <LanguageSelector />
          </div>
        </div>
          </div>
        )}
      </div>

      {/* Notifications Section */}
      <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden" data-section="notifications">
        <div
          onClick={() => toggleSection('Notifications')}
          className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors"
        >
          <div className="flex items-center gap-3">
            {expandedSections.has('Notifications') ? (
              <ChevronDown className="w-5 h-5 text-theme-primary" />
            ) : (
              <ChevronRight className="w-5 h-5 text-theme-primary" />
            )}
            <h3 className="font-semibold text-theme-primary">{intl.formatMessage({ id: 'settings.notifications' })}</h3>
          </div>
        </div>

        {expandedSections.has('Notifications') && (
          <div className="border-t border-theme p-4">
            {user && (
              <NotificationSettingsComponent
                user={user}
                currentSettings={notificationSettings}
                onSettingsChange={setNotificationSettings}
              />
            )}
          </div>
        )}
      </div>

      </>}

      {activeSettingsTab === 'organization' && <>

      {/* Categories Section */}
      {user && (
        <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
          <div
            onClick={() => toggleSection('Categories')}
            className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors"
          >
            <div className="flex items-center gap-3">
              {expandedSections.has('Categories') ? (
                <ChevronDown className="w-5 h-5 text-theme-primary" />
              ) : (
                <ChevronRight className="w-5 h-5 text-theme-primary" />
              )}
              <h3 className="font-semibold text-theme-primary">{intl.formatMessage({ id: 'settings.categories' })}</h3>
            </div>
          </div>

          {expandedSections.has('Categories') && (
            <div className="border-t border-theme p-4">
              <div className="space-y-3">
                <p className="text-sm text-theme-secondary">
                  Create custom categories to better organize your pantry items.
                </p>
                <button
                  onClick={() => setShowCategoryManager(true)}
                  className="bg-[var(--accent-color)] text-white px-4 py-2 rounded font-medium text-sm hover:bg-opacity-90 transition-colors"
                >
                  Manage Categories
                </button>
                <div className="text-xs text-theme-secondary">
                  {customCategories.length} custom categor{customCategories.length === 1 ? 'y' : 'ies'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Store Layout Section */}
      {user && (
        <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
          <div
            onClick={() => toggleSection('Store Layout')}
            className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors"
          >
            <div className="flex items-center gap-3">
              {expandedSections.has('Store Layout') ? (
                <ChevronDown className="w-5 h-5 text-theme-primary" />
              ) : (
                <ChevronRight className="w-5 h-5 text-theme-primary" />
              )}
              <h3 className="font-semibold text-theme-primary">{intl.formatMessage({ id: 'settings.storeLayout' })}</h3>
            </div>
          </div>

          {expandedSections.has('Store Layout') && (
            <div className="border-t border-theme p-4">
              <StoreLayoutEditor
                storeLayout={settings.shopping?.storeLayout || defaultStoreLayout}
                onStoreLayoutChange={(newLayout: string[]) => setSettings(prev => ({
                  ...prev,
                  shopping: {
                    ...prev.shopping,
                    storeLayout: newLayout
                  }
                }))}
              />
            </div>
          )}
        </div>
      )}

      {/* Leftover Analytics Section */}
      {user && (
        <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
          <div
            onClick={() => toggleSection('Leftover Analytics')}
            className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors"
          >
            <div className="flex items-center gap-3">
              {expandedSections.has('Leftover Analytics') ? (
                <ChevronDown className="w-5 h-5 text-theme-primary" />
              ) : (
                <ChevronRight className="w-5 h-5 text-theme-primary" />
              )}
              <h3 className="font-semibold text-theme-primary">{intl.formatMessage({ id: 'settings.leftoverAnalytics' })}</h3>
            </div>
          </div>

          {expandedSections.has('Leftover Analytics') && (
            <div className="border-t border-theme p-4">
              <LeftoverAnalytics householdId={household?.id} userId={user.id} />
            </div>
          )}
        </div>
      )}

      </>}

      {activeSettingsTab === 'more' && <>

      {/* Feedback Section */}
      <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
        <div
          onClick={() => toggleSection('Feedback')}
          className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors"
        >
          <div className="flex items-center gap-3">
            {expandedSections.has('Feedback') ? (
              <ChevronDown className="w-5 h-5 text-theme-primary" />
            ) : (
              <ChevronRight className="w-5 h-5 text-theme-primary" />
            )}
            <h3 className="font-semibold text-theme-primary">{intl.formatMessage({ id: 'settings.feedback' })}</h3>
          </div>
        </div>

        {expandedSections.has('Feedback') && (
          <div className="border-t border-theme p-4">
        <form onSubmit={handleFeedbackSubmit} className="space-y-3">
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="Let us know your thoughts..."
            className="w-full p-3 border rounded resize-none text-black bg-white text-sm"
            rows={3}
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !feedback.trim()}
            className="bg-[var(--accent-color)] text-white px-4 py-2 rounded font-medium text-sm w-full hover:bg-opacity-90 transition-colors"
          >
            {sending ? 'Sending...' : 'Send Feedback'}
          </button>
        </form>
          </div>
        )}
      </div>

      {/* Subscription Section */}
      {user && (
        <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
          <div
            onClick={() => toggleSection('Subscription')}
            className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors"
          >
            <div className="flex items-center gap-3">
              {expandedSections.has('Subscription') ? (
                <ChevronDown className="w-5 h-5 text-theme-primary" />
              ) : (
                <ChevronRight className="w-5 h-5 text-theme-primary" />
              )}
              <h3 className="font-semibold text-theme-primary">{intl.formatMessage({ id: 'settings.subscription' })}</h3>
            </div>
          </div>

          {expandedSections.has('Subscription') && (
            <div className="border-t border-theme p-4">
              <SubscriptionManager user={user} />
            </div>
          )}
        </div>
      )}



      {/* Bulk Image Update Section */}
      {user && (
        <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
          <div
            onClick={() => toggleSection('Pantry Images')}
            className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors"
          >
            <div className="flex items-center gap-3">
              {expandedSections.has('Pantry Images') ? (
                <ChevronDown className="w-5 h-5 text-theme-primary" />
              ) : (
                <ChevronRight className="w-5 h-5 text-theme-primary" />
              )}
              <h3 className="font-semibold text-theme-primary">{intl.formatMessage({ id: 'settings.pantryImages' })}</h3>
            </div>
          </div>

          {expandedSections.has('Pantry Images') && (
            <div className="border-t border-theme p-4">
          <div className="space-y-3">
            <p className="text-sm text-theme-secondary">
              Automatically fetch better images for pantry items that currently have placeholder images.
              This will scan your inventory and update items with images from food databases and stock photos.
              Images are cached locally for faster loading and offline access.
            </p>
            <button
              onClick={async () => {
                setUpdatingBulkImages(true);
                try {
                  const { BulkImageUpdateService } = await import('../services/bulkImageUpdateService');
                  const result = await BulkImageUpdateService.updateAllPantryItemImages(user, (completed, total) => {
                    log.info(`Updated ${completed}/${total} items`, { completed, total }, 'Settings');
                  });

                  addToast?.(`Updated ${result.updatedItems} items${result.failedItems > 0 ? ` (${result.failedItems} failed)` : ''}`, result.failedItems > 0 ? 'warning' : 'success');
                } catch (error) {
                  const msg = error instanceof Error ? error.message : String(error);
                  const stack = error instanceof Error ? error.stack : undefined;
                  log.error('Failed bulk image update', { message: msg, stack }, 'Settings');
                  addToast?.('Failed to update images. Please try again.', 'error');
                } finally {
                  setUpdatingBulkImages(false);
                }
              }}
              disabled={updatingBulkImages}
              className="bg-blue-500 text-white px-4 py-2 rounded font-medium text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {updatingBulkImages && <Loader2 className="w-4 h-4 animate-spin" />}
              {updatingBulkImages ? 'Updating Images...' : 'Update Pantry Images'}
            </button>
            <div className="text-xs text-theme-secondary">
              This feature uses external APIs and may take time for large inventories.
            </div>
          </div>
            </div>
          )}
        </div>
      )}

      {/* Help & Support Section */}
      <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
        <div
          onClick={() => toggleSection('Help & Support')}
          className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors"
        >
          <div className="flex items-center gap-3">
            {expandedSections.has('Help & Support') ? (
              <ChevronDown className="w-5 h-5 text-theme-primary" />
            ) : (
              <ChevronRight className="w-5 h-5 text-theme-primary" />
            )}
            <h3 className="font-semibold text-theme-primary">{intl.formatMessage({ id: 'settings.help' })}</h3>
          </div>
        </div>

        {expandedSections.has('Help & Support') && (
          <div className="border-t border-theme p-4">
        <div className="space-y-3">
          <p className="text-sm text-theme-secondary">
            Need help? Check out our FAQ or contact our support team for assistance.
          </p>
          <button
            onClick={() => setShowFAQModal(true)}
            className="bg-[var(--accent-color)] text-white px-4 py-2 rounded font-medium text-sm hover:bg-opacity-90 transition-colors"
          >
            View FAQ & Help
          </button>
        </div>
          </div>
        )}
      </div>

      {/* App Updates Section */}
      <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
        <div
          onClick={() => toggleSection('App Updates')}
          className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors"
        >
          <div className="flex items-center gap-3">
            {expandedSections.has('App Updates') ? (
              <ChevronDown className="w-5 h-5 text-theme-primary" />
            ) : (
              <ChevronRight className="w-5 h-5 text-theme-primary" />
            )}
            <h3 className="font-semibold text-theme-primary">{intl.formatMessage({ id: 'settings.appUpdates' })}</h3>
          </div>
        </div>

        {expandedSections.has('App Updates') && (
          <div className="border-t border-theme p-4">
            <VersionUpdate autoCheck={true} />
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
          <div
            onClick={() => toggleSection('Remote Config Debug')}
            className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors"
          >
            <div className="flex items-center gap-3">
              {expandedSections.has('Remote Config Debug') ? (
                <ChevronDown className="w-5 h-5 text-theme-primary" />
              ) : (
                <ChevronRight className="w-5 h-5 text-theme-primary" />
              )}
              <h3 className="font-semibold text-theme-primary">Remote Config Debug</h3>
            </div>
          </div>

          {expandedSections.has('Remote Config Debug') && (
            <div className="border-t border-theme p-4">
              <RemoteConfigDebugPanel addToast={addToast} />
            </div>
          )}
        </div>
      )}

      </>}

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

      {activeSettingsTab === 'more' && <>

      {/* Privacy & Legal Section - MOVED FROM ACCOUNT TAB */}
      <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
        <div
          onClick={() => toggleSection('Privacy & Legal')}
          className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors"
        >
          <div className="flex items-center gap-3">
            {expandedSections.has('Privacy & Legal') ? (
              <ChevronDown className="w-5 h-5 text-theme-primary" />
            ) : (
              <ChevronRight className="w-5 h-5 text-theme-primary" />
            )}
            <h3 className="font-semibold text-theme-primary">{intl.formatMessage({ id: 'settings.privacy' })}</h3>
          </div>
        </div>

        {expandedSections.has('Privacy & Legal') && (
          <div className="border-t border-theme p-4">
            <p className="text-sm text-theme-secondary">
              We use the device camera to scan barcodes and take pantry item photos. Review our privacy policy for details about data collection and storage.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={() => {
                  const privacyUrl = (window as Window & { PRIVACY_POLICY_URL?: string }).PRIVACY_POLICY_URL || 'https://smartpantrymobile.page.gd/privacy.html';
                  window.open(privacyUrl, '_blank');
                }}
                className="bg-[var(--accent-color)] text-white px-3 py-1 rounded-lg font-medium text-sm hover:bg-opacity-90 transition-colors"
              >
                View Privacy Policy
              </button>
              <button
                onClick={() => {
                  const privacyUrl = (window as Window & { PRIVACY_POLICY_URL?: string }).PRIVACY_POLICY_URL || 'https://smartpantrymobile.page.gd/privacy.html';
                  if (navigator.clipboard) navigator.clipboard.writeText(privacyUrl);
                  addToast?.('Privacy policy URL copied to clipboard', 'success');
                }}
                className="bg-theme-primary text-theme-secondary px-3 py-1 rounded-lg text-sm hover:bg-theme-secondary transition-colors"
              >
                Copy URL
              </button>
              <button
                onClick={() => {
                  const delUrl = (window as Window & { DELETE_ACCOUNT_URL?: string }).DELETE_ACCOUNT_URL || 'https://smartpantrymobile.page.gd/delete-account.html';
                  window.open(delUrl, '_blank');
                }}
                className="bg-red-500 text-white px-3 py-1 rounded-lg font-medium text-sm hover:bg-red-600 transition-colors"
              >
                Delete Account
              </button>
              <button
                onClick={() => {
                  const delUrl = (window as Window & { DELETE_ACCOUNT_URL?: string }).DELETE_ACCOUNT_URL || 'https://smartpantrymobile.page.gd/delete-account.html';
                  if (navigator.clipboard) navigator.clipboard.writeText(delUrl);
                  addToast?.('Account deletion URL copied to clipboard', 'success');
                }}
                className="bg-theme-primary text-theme-secondary px-3 py-1 rounded-lg text-sm hover:bg-theme-secondary transition-colors"
              >
                Copy Link
              </button>
            </div>
          </div>
        )}
      </div>

      </>}

    </div>

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
            <FAQPage onBack={() => setShowFAQModal(false)} />
          </div>
        </div>
      </div>
    )}

    </>
  );
};
