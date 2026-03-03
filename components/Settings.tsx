import React, { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import DatabaseMonitoringService from '../services/databaseMonitoringService';
import { SubscriptionManager } from './SubscriptionManager';
import { CategoryManager } from './CategoryManager';
import { log } from '../services/logService';
import AnalyticsService from '../services/analyticsService';
import { LanguageSelector } from '../src/components/LanguageSelector';
import { useNotifications } from '../hooks/useNotifications';
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
  onShowTutorial?: () => void;
  household?: Household | null;
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
  onShowTutorial,
  household
}) => {
  const [feedback, setFeedback] = useState('');
  const [sending, setSending] = useState(false);
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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['Profile', 'Household', 'Notifications']));

  // Member preferences state
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberPreferences, setMemberPreferences] = useState<Partial<MemberPreferences>>({});
  const [savingMemberPrefs, setSavingMemberPrefs] = useState(false);
  const [showMemberPreferencesModal, setShowMemberPreferencesModal] = useState(false);

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

  // Update userProfile when user data loads
  useEffect(() => {
    if (user?.profile) {
      setUserProfile(user.profile);
    }
  }, [user?.profile]);

  // Use the notifications hook
  useNotifications(settings.notifications, user?.email, mealPlan);

  const handleChange = (field: string, value: any) => {
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

  const _handleNotifChange = (key: string, value: any) => {
    setPendingNotifications(prev => ({
      ...prev,
      [key]: typeof value === 'object' ? { ...(prev as any)[key], ...value } : value,
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

  const handleProfileChange = (field: string, value: any) => {
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
      alert('Profile updated successfully!');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      log.error('Failed saving profile', { message: msg, stack }, 'Settings');
      alert('Failed to update profile. Please try again.');
    } finally {
      setSavingProfile(false);
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
      alert('Avatar updated successfully!');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      log.error('Failed updating avatar', { message: msg, stack }, 'Settings');
      alert('Failed to update avatar. Please try again.');
    } finally {
      setUpdatingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    if (confirm('Remove your avatar?')) {
      setUpdatingAvatar(true);
      try {
        const userRef = DatabaseMonitoringService.doc('users', user.id);
        await DatabaseMonitoringService.updateDoc(userRef, {
          avatar: null
        });
        alert('Avatar removed successfully!');
      } catch (_error) {
        alert('Failed to remove avatar');
      } finally {
        setUpdatingAvatar(false);
      }
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
      alert('Thank you for your feedback!');
      setFeedback('');
    } catch (_err) {
      alert('Failed to send feedback. Please try again later.');
    }
    setSending(false);
  };

  return (
    <>

      <div className="p-6 pb-24 max-w-md mx-auto space-y-6">

      {/* Profile Section */}
      {user && onLogout && (
        <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
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
              <h3 className="font-semibold text-theme-primary">Profile</h3>
            </div>
          </div>

          {expandedSections.has('Profile') && (
            <div className="border-t border-theme p-4">
          {/* Measurement System Preference */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-theme-primary">Measurement System</label>
            <div className="flex bg-theme-secondary rounded-lg p-1 border border-theme h-10">
              <button
                type="button"
                onClick={() => handleProfileChange('measurementSystem', 'Standard')}
                className={`flex-1 text-sm font-bold rounded transition-all ${userProfile?.measurementSystem === 'Standard' || (!userProfile?.measurementSystem && 'Standard' === 'Standard') ? 'bg-[var(--accent-color)] text-white shadow-sm' : 'text-theme-secondary opacity-50'}`}
              >
                Standard (Imperial)
              </button>
              <button
                type="button"
                onClick={() => handleProfileChange('measurementSystem', 'Metric')}
                className={`flex-1 text-sm font-bold rounded transition-all ${userProfile?.measurementSystem === 'Metric' ? 'bg-[var(--accent-color)] text-white shadow-sm' : 'text-theme-secondary opacity-50'}`}
              >
                Metric
              </button>
            </div>
          </div>

          {/* AI Opt-in and Shopping Preferences - Side by side */}
          <div className="mb-4">
            <div className="flex items-center justify-between gap-4">
              {/* AI Opt-in */}
              <div className="flex-1 min-w-0">
                <label htmlFor="geminiOptIn" className="flex items-center gap-2 cursor-pointer">
                  <input
                    id="geminiOptIn"
                    name="geminiOptIn"
                    type="checkbox"
                    checked={geminiOptedIn}
                    onChange={e => handleGeminiOptIn(e.target.checked)}
                    className="flex-shrink-0"
                  />
                  <span className="text-sm text-theme-primary break-words">Enable AI Features</span>
                </label>
              </div>

              {/* Shopping Preferences */}
              <div className="flex-1 min-w-0">
                <label htmlFor="includeStaples" className="flex items-center gap-2 cursor-pointer">
                  <input
                    id="includeStaples"
                    name="includeStaples"
                    type="checkbox"
                    checked={settings.shopping?.includeStaples || false}
                    onChange={e => setSettings(prev => ({
                      ...prev,
                      shopping: {
                        ...prev.shopping,
                        includeStaples: e.target.checked
                      }
                    }))}
                    className="flex-shrink-0"
                  />
                  <span className="text-sm text-theme-primary break-words">Include Staples in Shopping Lists</span>
                </label>
              </div>
            </div>
          </div>

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
                <p className="font-medium text-theme-primary">{user.name}</p>
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
                <h4 className="text-sm font-medium mb-2 text-theme-primary">Choose an avatar:</h4>
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
          </div>
              {/* Privacy & Legal Section */}
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
                    <h3 className="font-semibold text-theme-primary">Privacy & Legal</h3>
                  </div>
                </div>

                {expandedSections.has('Privacy & Legal') && (
                  <div className="border-t border-theme p-4">
                    <p className="text-sm text-theme-secondary">
                      We use the device camera to scan barcodes and take pantry item photos. Review our privacy policy for details about data collection and storage.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => {
                          const privacyUrl = (window as any).PRIVACY_POLICY_URL || 'https://smartpantrymobile.page.gd/privacy.html';
                          window.open(privacyUrl, '_blank');
                        }}
                        className="bg-[var(--accent-color)] text-white px-4 py-2 rounded font-medium text-sm hover:bg-opacity-90 transition-colors"
                      >
                        View Privacy Policy
                      </button>
                      <button
                        onClick={() => {
                          const privacyUrl = (window as any).PRIVACY_POLICY_URL || 'https://smartpantrymobile.page.gd/privacy.html';
                          if (navigator.clipboard) navigator.clipboard.writeText(privacyUrl);
                          alert('Privacy policy URL copied to clipboard');
                        }}
                        className="bg-theme-primary text-theme-secondary px-3 py-2 rounded text-sm hover:bg-theme-secondary transition-colors"
                      >
                        Copy URL
                      </button>
                      <button
                        onClick={() => {
                          const delUrl = (window as any).DELETE_ACCOUNT_URL || 'https://smartpantrymobile.page.gd/delete-account.html';
                          window.open(delUrl, '_blank');
                        }}
                        className="bg-red-500 text-white px-4 py-2 rounded font-medium text-sm hover:bg-red-600 transition-colors"
                      >
                        Request Account Deletion
                      </button>
                      <button
                        onClick={() => {
                          const delUrl = (window as any).DELETE_ACCOUNT_URL || 'https://smartpantrymobile.page.gd/delete-account.html';
                          if (navigator.clipboard) navigator.clipboard.writeText(delUrl);
                          alert('Account deletion URL copied to clipboard');
                        }}
                        className="bg-theme-primary text-theme-secondary px-3 py-2 rounded text-sm hover:bg-theme-secondary transition-colors"
                      >
                        Copy Deletion URL
                      </button>
                    </div>
                  </div>
                )}
              </div>

          {/* User Profile Information */}
          <div className="space-y-4 mb-4">
            <h4 className="text-sm font-medium mb-3 text-theme-primary">Personal Information</h4>
            
            {/* Height and Weight - keep in 2 columns */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-theme-secondary mb-1">Height</label>
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
                <label htmlFor="weight" className="block text-xs text-theme-secondary mb-1">Weight (lbs)</label>
                <input
                  id="weight"
                  name="weight"
                  type="number"
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
                  value={userProfile?.age || ''}
                  onChange={(e) => handleProfileChange('age', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="30"
                  className="w-full p-1 text-xs border rounded text-black bg-white"
                  size={2}
                />
              </div>
              <div>
                <label htmlFor="gender" className="block text-xs text-theme-secondary mb-1">Gender</label>
                <select
                  id="gender"
                  name="gender"
                  value={userProfile?.gender || ''}
                  onChange={(e) => handleProfileChange('gender', e.target.value || undefined)}
                  className="w-full p-1 text-xs border rounded text-black bg-white"
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
              </div>
              <div>
                <label htmlFor="householdSize" className="block text-xs text-theme-secondary mb-1">Household</label>
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
                <label htmlFor="dietGoal" className="block text-xs text-theme-secondary mb-1">Diet Goal</label>
                <select
                  id="dietGoal"
                  name="dietGoal"
                  value={userProfile?.dietGoal || ''}
                  onChange={(e) => handleProfileChange('dietGoal', e.target.value || undefined)}
                  className="w-full p-2 border rounded text-sm text-black bg-white"
                >
                  <option value="">Select diet goal</option>
                  <option value="lose-weight">Lose Weight</option>
                  <option value="maintain-weight">Maintain Weight</option>
                  <option value="gain-weight">Gain Weight</option>
                  <option value="build-muscle">Build Muscle</option>
                  <option value="improve-health">Improve Health</option>
                </select>
              </div>
              <div>
                <label htmlFor="activityLevel" className="block text-xs text-theme-secondary mb-1">Activity Level</label>
                <select
                  id="activityLevel"
                  name="activityLevel"
                  value={userProfile?.activityLevel || ''}
                  onChange={(e) => handleProfileChange('activityLevel', e.target.value || undefined)}
                  className="w-full p-2 border rounded text-sm text-black bg-white"
                >
                  <option value="">Select activity level</option>
                  <option value="sedentary">Sedentary</option>
                  <option value="lightly-active">Lightly Active</option>
                  <option value="moderately-active">Moderately Active</option>
                  <option value="very-active">Very Active</option>
                  <option value="extremely-active">Extremely Active</option>
                </select>
              </div>
            </div>

            {/* Dietary Restrictions - full width but more compact */}
            <div>
              <label htmlFor="dietaryRestrictions" className="block text-xs text-theme-secondary mb-1">Dietary Restrictions</label>
              <input
                id="dietaryRestrictions"
                name="dietaryRestrictions"
                type="text"
                value={userProfile?.dietaryRestrictions?.join(', ') || ''}
                onChange={(e) => handleProfileChange('dietaryRestrictions', e.target.value ? e.target.value.split(',').map(s => s.trim()) : undefined)}
                placeholder="vegetarian, gluten-free"
                className="w-full p-1 text-xs border rounded text-black bg-white"
              />
            </div>

            {/* Allergies - full width but more compact */}
            <div>
              <label htmlFor="allergies" className="block text-xs text-theme-secondary mb-1">Allergies</label>
              <input
                id="allergies"
                name="allergies"
                type="text"
                value={userProfile?.allergies?.join(', ') || ''}
                onChange={(e) => handleProfileChange('allergies', e.target.value ? e.target.value.split(',').map(s => s.trim()) : undefined)}
                placeholder="nuts, shellfish, dairy"
                className="w-full p-1 text-xs border rounded text-black bg-white"
              />
            </div>

            {/* Leftover Persona Questionnaire */}
            <LeftoverPersonaQuestionnaire
              user={user}
              userProfile={userProfile}
              onChange={(persona) => handleProfileChange('leftoverPersona', persona)}
            />

            {profileChanged && (
              <button
                onClick={saveProfile}
                disabled={savingProfile}
                className="w-full bg-green-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
                {savingProfile ? 'Saving...' : 'Save Profile'}
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
              <h3 className="font-semibold text-theme-primary">Household</h3>
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
                  </div>

                  {/* Member List */}
                  <div className="space-y-3 mb-4">
                    {household.members && Array.isArray(household.members) && household.members.map((member) => (
                      <div key={member.id} className="bg-theme-secondary/50 rounded-lg p-3 border border-theme">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-theme-primary rounded-full flex items-center justify-center text-sm font-medium text-theme-secondary">
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-theme-primary">{member.name}</p>
                              <p className="text-xs text-theme-secondary">{member.email}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => openMemberPreferences(member)}
                            className="flex items-center gap-2 px-3 py-1 bg-theme-primary hover:bg-theme-secondary text-theme-secondary hover:text-theme-primary rounded-lg text-sm transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                            Preferences
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Member Preferences Form - Now handled in modal */}


                  <p className="text-sm text-theme-secondary">
                    Customize preferences for each household member to get personalized recipe recommendations and shopping suggestions.
                  </p>
                </>
              ) : (
                <p className="text-sm text-theme-secondary">
                  Create a household to share your pantry with family members. Click your avatar above to get started.
                </p>
              )}
            </div>
          )}
        </div>
      )}



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
              <h3 className="font-semibold text-theme-primary">Categories</h3>
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
            <h3 className="font-semibold text-theme-primary">Theme Settings</h3>
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
            <span className="text-sm text-theme-primary">Theme</span>
            <select
              id="themeMode"
              name="themeMode"
              value={settings.theme.mode}
              onChange={(e) => handleChange('theme', { mode: e.target.value })}
              className="border rounded px-2 py-1 text-black bg-white text-sm"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
            <span className="text-sm text-theme-primary ml-4">Accent</span>
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
            <span className="text-sm text-theme-primary">Background</span>
            <input
              id="backgroundColor"
              name="backgroundColor"
              type="color"
              value={settings.theme.backgroundColor || '#ffffff'}
              onChange={(e) => handleChange('theme', { backgroundColor: e.target.value })}
              className="border rounded w-8 h-8"
            />
            <span className="text-sm text-theme-primary ml-4">Text</span>
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
            <span className="text-sm text-theme-primary">Language</span>
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
            <h3 className="font-semibold text-theme-primary">Notifications</h3>
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

            {/* Pending Notifications Section */}
            {user && (
              <PendingNotifications user={user} />
            )}
          </div>
        )}
      </div>

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
            <h3 className="font-semibold text-theme-primary">Feedback</h3>
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
              <h3 className="font-semibold text-theme-primary">Subscription</h3>
            </div>
          </div>

          {expandedSections.has('Subscription') && (
            <div className="border-t border-theme p-4">
              <SubscriptionManager user={user} />
            </div>
          )}
        </div>
      )}

      {/* Database Monitoring Section - Developer/Admin Only */}
      {user && process.env.NODE_ENV === 'development' && (
        <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
          <div
            onClick={() => toggleSection('Database Monitoring')}
            className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors"
          >
            <div className="flex items-center gap-3">
              {expandedSections.has('Database Monitoring') ? (
                <ChevronDown className="w-5 h-5 text-theme-primary" />
              ) : (
                <ChevronRight className="w-5 h-5 text-theme-primary" />
              )}
              <h3 className="font-semibold text-theme-primary">Database Monitoring</h3>
            </div>
          </div>

          {expandedSections.has('Database Monitoring') && (
            <div className="border-t border-theme p-4">
              <MonitoringDashboard user={user} />
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
              <h3 className="font-semibold text-theme-primary">Leftover Analytics</h3>
            </div>
          </div>

          {expandedSections.has('Leftover Analytics') && (
            <div className="border-t border-theme p-4">
              <LeftoverAnalytics householdId={household?.id} userId={user.id} />
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
              <h3 className="font-semibold text-theme-primary">Pantry Images</h3>
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
                if (!confirm('This will scan all your pantry items and attempt to update images for items with placeholders. This may take a few minutes. Continue?')) {
                  return;
                }

                setUpdatingBulkImages(true);
                try {
                  const { BulkImageUpdateService } = await import('../services/bulkImageUpdateService');
                  const result = await BulkImageUpdateService.updateAllPantryItemImages(user, (completed, total) => {
                    log.info(`Updated ${completed}/${total} items`, { completed, total }, 'Settings');
                  });

                  alert(`Image update complete!\n\n${result.updatedItems} items updated\n${result.failedItems} items failed\n\nCheck the console for details.`);
                } catch (error) {
                  const msg = error instanceof Error ? error.message : String(error);
                  const stack = error instanceof Error ? error.stack : undefined;
                  log.error('Failed bulk image update', { message: msg, stack }, 'Settings');
                  alert('Failed to update images. Check the console for details.');
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
            <h3 className="font-semibold text-theme-primary">Help & Support</h3>
          </div>
        </div>

        {expandedSections.has('Help & Support') && (
          <div className="border-t border-theme p-4">
        <div className="space-y-3">
          <p className="text-sm text-theme-secondary">
            Need help getting started or want to see the app features again?
          </p>
          <button
            onClick={onShowTutorial}
            className="bg-[var(--accent-color)] text-white px-4 py-2 rounded font-medium text-sm hover:bg-opacity-90 transition-colors"
          >
            Watch Tutorial
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
            <h3 className="font-semibold text-theme-primary">App Updates</h3>
          </div>
        </div>

        {expandedSections.has('App Updates') && (
          <div className="border-t border-theme p-4">
            <VersionUpdate autoCheck={true} />
          </div>
        )}
      </div>

      {/* Category Manager Modal */}
      {user && (
        <CategoryManager
          customCategories={customCategories}
          onAddCategory={onAddCustomCategory || (() => {})}
          onUpdateCategory={onUpdateCustomCategory || (() => {})}
          onDeleteCategory={onDeleteCustomCategory || (() => {})}
          isOpen={showCategoryManager}
          onClose={() => setShowCategoryManager(false)}
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
                    onChange={(e) => setMemberPreferences(prev => ({ ...prev, dietGoal: e.target.value as any || undefined }))}
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
    </div>
    </>
  );
};
