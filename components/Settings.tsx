import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, addDoc, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { SubscriptionManager } from './SubscriptionManager';
import { CategoryManager } from './CategoryManager';
import { PantryAnalytics } from './PantryAnalytics';
import { MonitoringDashboard } from './MonitoringDashboard';
import { LanguageSelector } from '../src/components/LanguageSelector';
import { useNotifications } from '../hooks/useNotifications';
import { UserProfile, CustomCategory, PantryItem } from '../types';
import { VersionUpdate } from './VersionUpdate';
import { DayPlan } from '../types';
import { BarChart3 } from 'lucide-react';
import AnalyticsService from '../services/analyticsService';

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
};

interface SettingsProps {
  settings: typeof defaultSettings;
  setSettings: React.Dispatch<React.SetStateAction<typeof defaultSettings>>;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  onLogout?: () => void;
  customCategories?: CustomCategory[];
  onAddCustomCategory?: (name: string, icon: string, color?: string) => void;
  onUpdateCustomCategory?: (categoryId: string, updates: Partial<Pick<CustomCategory, 'name' | 'icon' | 'color'>>) => void;
  onDeleteCustomCategory?: (categoryId: string) => void;
  mealPlan?: DayPlan[];
  inventory?: PantryItem[];
  onShowTutorial?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
  settings, 
  setSettings, 
  user, 
  onLogout,
  customCategories = [],
  onAddCustomCategory,
  onUpdateCustomCategory,
  onDeleteCustomCategory,
  mealPlan,
  inventory = [],
  onShowTutorial
}) => {
  const [feedback, setFeedback] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingNotifications, setPendingNotifications] = useState(settings.notifications);
  const [notifChanged, setNotifChanged] = useState(false);
  const [showAvatarSelection, setShowAvatarSelection] = useState(false);
  const [householdMembers, setHouseholdMembers] = useState(user?.householdMembers || []);
  const [showHouseholdManager, setShowHouseholdManager] = useState(false);
  const [profileChanged, setProfileChanged] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | undefined>(user?.profile);

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
        ...prev[field],
        ...value,
      },
    }));
    setNotifChanged(true);
  };

    const handleThemeChange = (key: string, value: any) => {
      setSettings(prev => ({
        ...prev,
        theme: {
          ...prev.theme,
          [key]: value
        }
      }));
    };
  const handleNotifChange = (key: string, value: any) => {
    setPendingNotifications(prev => ({
      ...prev,
      [key]: typeof value === 'object' ? { ...prev[key], ...value } : value,
    }));
    setNotifChanged(false);
  };

  const confirmNotifChanges = () => {
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
    try {
      await updateDoc(doc(db, 'users', user.id), {
        profile: userProfile
      });
      setProfileChanged(false);
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    }
  };

  const avatarOptions = Array.from({ length: 35 }, (_, i) => `/avatars/memo_${i + 1}.png`);

  const handleAvatarSelect = async (avatarPath: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.id), {
        avatar: avatarPath
      });
      setShowAvatarSelection(false);
      alert('Avatar updated successfully!');
    } catch (error) {
      console.error('Error updating avatar:', error);
      alert('Failed to update avatar. Please try again.');
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    if (confirm('Remove your avatar?')) {
      try {
        await updateDoc(doc(db, 'users', user.id), {
          avatar: null
        });
        alert('Avatar removed successfully!');
      } catch (error) {
        alert('Failed to remove avatar');
      }
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'feedback'), {
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
    } catch (err) {
      alert('Failed to send feedback. Please try again later.');
    }
    setSending(false);
  };

  return (
    <>
      {/* Analytics Modal */}
      {showAnalytics && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={() => setShowAnalytics(false)}>
          <div className="bg-theme-primary rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto my-8" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 z-10 bg-[var(--accent-color)] p-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-6 h-6" /> Pantry Analytics
              </h2>
              <button
                onClick={() => setShowAnalytics(false)}
                className="text-white opacity-70 hover:opacity-100 text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="p-6">
              <PantryAnalytics inventory={inventory} />
            </div>
          </div>
        </div>
      )}

      <div className="p-6 pb-24 max-w-md mx-auto space-y-6">

      {/* Analytics Button */}
      <button
        onClick={() => setShowAnalytics(true)}
        className="w-full bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 text-white rounded-xl p-4 font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg"
      >
        <BarChart3 className="w-5 h-5" /> View Pantry Analytics
      </button>

      {/* Profile Section */}
      {user && onLogout && (
        <div className="bg-theme-secondary rounded-xl border border-theme p-4">
          <h3 className="font-semibold mb-4 text-theme-primary">Profile</h3>
          
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
                  className="bg-red-500 text-white px-3 py-2 rounded text-sm font-medium hover:bg-red-600"
                >
                  Remove
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
                      className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-300 hover:border-blue-500 transition-colors"
                    >
                      <img
                        src={avatarPath}
                        alt={`Avatar ${avatarPath.split('/').pop()?.split('.')[0]}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Information */}
          <div className="space-y-4 mb-4">
            <h4 className="text-sm font-medium mb-3 text-theme-primary">Personal Information</h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-theme-secondary mb-1">Height</label>
                <div className="flex gap-2">
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
                      className="w-full p-2 border rounded text-sm text-black bg-white"
                      min="0"
                      max="8"
                    />
                    <span className="text-xs text-theme-secondary block mt-1">ft</span>
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
                      className="w-full p-2 border rounded text-sm text-black bg-white"
                      min="0"
                      max="11"
                    />
                    <span className="text-xs text-theme-secondary block mt-1">in</span>
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
                  className="w-full p-2 border rounded text-sm text-black bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="age" className="block text-xs text-theme-secondary mb-1">Age</label>
                <input
                  id="age"
                  name="age"
                  type="number"
                  value={userProfile?.age || ''}
                  onChange={(e) => handleProfileChange('age', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="30"
                  className="w-full p-2 border rounded text-sm text-black bg-white"
                />
              </div>
              <div>
                <label htmlFor="gender" className="block text-xs text-theme-secondary mb-1">Gender</label>
                <select
                  id="gender"
                  name="gender"
                  value={userProfile?.gender || ''}
                  onChange={(e) => handleProfileChange('gender', e.target.value || undefined)}
                  className="w-full p-2 border rounded text-sm text-black bg-white"
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
              </div>
            </div>

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
                <option value="sedentary">Sedentary (little/no exercise)</option>
                <option value="lightly-active">Lightly Active (light exercise 1-3 days/week)</option>
                <option value="moderately-active">Moderately Active (moderate exercise 3-5 days/week)</option>
                <option value="very-active">Very Active (hard exercise 6-7 days/week)</option>
                <option value="extremely-active">Extremely Active (very hard exercise & physical job)</option>
              </select>
            </div>

            <div>
              <label htmlFor="dietaryRestrictions" className="block text-xs text-theme-secondary mb-1">Dietary Restrictions (comma-separated)</label>
              <input
                id="dietaryRestrictions"
                name="dietaryRestrictions"
                type="text"
                value={userProfile?.dietaryRestrictions?.join(', ') || ''}
                onChange={(e) => handleProfileChange('dietaryRestrictions', e.target.value ? e.target.value.split(',').map(s => s.trim()) : undefined)}
                placeholder="vegetarian, gluten-free, dairy-free"
                className="w-full p-2 border rounded text-sm text-black bg-white"
              />
            </div>

            <div>
              <label htmlFor="allergies" className="block text-xs text-theme-secondary mb-1">Allergies (comma-separated)</label>
              <input
                id="allergies"
                name="allergies"
                type="text"
                value={userProfile?.allergies?.join(', ') || ''}
                onChange={(e) => handleProfileChange('allergies', e.target.value ? e.target.value.split(',').map(s => s.trim()) : undefined)}
                placeholder="nuts, shellfish, dairy"
                className="w-full p-2 border rounded text-sm text-black bg-white"
              />
            </div>

            {profileChanged && (
              <button
                onClick={saveProfile}
                className="w-full bg-green-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-600"
              >
                Save Profile
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

      {/* Household Members Section */}
      {user && (
        <div className="bg-theme-secondary rounded-xl border border-theme p-4">
          <h3 className="font-semibold mb-3 text-theme-primary">Household Members</h3>
          <div className="space-y-3">
            <p className="text-sm text-theme-secondary">
              Manage dietary preferences and restrictions for each household member to get personalized recipe suggestions.
            </p>
            <button
              onClick={() => setShowHouseholdManager(true)}
              className="bg-[var(--accent-color)] text-white px-4 py-2 rounded font-medium text-sm hover:bg-opacity-90 transition-colors"
            >
              Manage Household
            </button>
            <div className="text-xs text-theme-secondary">
              {householdMembers.length} household member{householdMembers.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      )}

      {/* Household Members Modal */}
      {showHouseholdManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-theme-primary rounded-xl border border-theme p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-theme-primary">Household Members</h3>
              <button
                onClick={() => setShowHouseholdManager(false)}
                className="text-theme-secondary hover:text-theme-primary"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {householdMembers.map((member, index) => (
                <div key={index} className="border border-theme-secondary/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-theme-primary">{member.name}</h4>
                    <button
                      onClick={() => {
                        const updated = householdMembers.filter((_, i) => i !== index);
                        setHouseholdMembers(updated);
                      }}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <label className="block text-xs text-theme-secondary mb-1">Dietary Restrictions</label>
                      <input
                        type="text"
                        value={member.dietaryRestrictions?.join(', ') || ''}
                        onChange={(e) => {
                          const updated = [...householdMembers];
                          updated[index].dietaryRestrictions = e.target.value ? e.target.value.split(',').map(s => s.trim()) : [];
                          setHouseholdMembers(updated);
                        }}
                        placeholder="vegetarian, gluten-free"
                        className="w-full p-2 border rounded text-sm text-black bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-theme-secondary mb-1">Allergies</label>
                      <input
                        type="text"
                        value={member.allergies?.join(', ') || ''}
                        onChange={(e) => {
                          const updated = [...householdMembers];
                          updated[index].allergies = e.target.value ? e.target.value.split(',').map(s => s.trim()) : [];
                          setHouseholdMembers(updated);
                        }}
                        placeholder="nuts, dairy"
                        className="w-full p-2 border rounded text-sm text-black bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-theme-secondary mb-1">Diet Goal</label>
                      <select
                        value={member.dietGoal || ''}
                        onChange={(e) => {
                          const updated = [...householdMembers];
                          updated[index].dietGoal = e.target.value as any;
                          setHouseholdMembers(updated);
                        }}
                        className="w-full p-2 border rounded text-sm text-black bg-white"
                      >
                        <option value="">No specific goal</option>
                        <option value="lose-weight">Lose Weight</option>
                        <option value="maintain-weight">Maintain Weight</option>
                        <option value="gain-weight">Gain Weight</option>
                        <option value="build-muscle">Build Muscle</option>
                        <option value="improve-health">Improve Health</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-theme-secondary mb-1">Favorite Cuisines</label>
                      <input
                        type="text"
                        value={member.favoriteCuisines?.join(', ') || ''}
                        onChange={(e) => {
                          const updated = [...householdMembers];
                          updated[index].favoriteCuisines = e.target.value ? e.target.value.split(',').map(s => s.trim()) : [];
                          setHouseholdMembers(updated);
                        }}
                        placeholder="italian, mexican, thai"
                        className="w-full p-2 border rounded text-sm text-black bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={() => {
                  setHouseholdMembers([...householdMembers, {
                    name: `Member ${householdMembers.length + 1}`,
                    dietaryRestrictions: [],
                    allergies: [],
                    dietGoal: undefined,
                    favoriteCuisines: []
                  }]);
                }}
                className="w-full bg-theme-secondary/20 hover:bg-theme-secondary/30 border border-[var(--accent-color)]/20 rounded-lg py-2 text-sm font-medium text-theme-primary"
              >
                + Add Household Member
              </button>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={async () => {
                    if (!user) return;
                    try {
                      await updateDoc(doc(db, 'users', user.id), {
                        householdMembers: householdMembers
                      });
                      setShowHouseholdManager(false);
                      alert('Household members updated successfully!');
                    } catch (error) {
                      console.error('Error updating household:', error);
                      alert('Failed to update household members. Please try again.');
                    }
                  }}
                  className="flex-1 bg-green-500 text-white px-4 py-2 rounded font-medium hover:bg-green-600"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setShowHouseholdManager(false)}
                  className="flex-1 bg-theme-secondary text-theme-primary px-4 py-2 rounded font-medium hover:bg-theme-secondary/80"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Categories Section */}
      {user && (
        <div className="bg-theme-secondary rounded-xl border border-theme p-4">
          <h3 className="font-semibold mb-3 text-theme-primary">Categories</h3>
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

      {/* Theme Settings Section */}
      <div className="bg-theme-secondary rounded-xl border border-theme p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-theme-primary">Theme Settings</h3>
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
              onChange={(e) => handleThemeChange('mode', e.target.value)}
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
              onChange={(e) => handleThemeChange('accentColor', e.target.value)}
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
              onChange={(e) => handleThemeChange('backgroundColor', e.target.value)}
              className="border rounded w-8 h-8"
            />
            <span className="text-sm text-theme-primary ml-4">Text</span>
            <input
              id="textColor"
              name="textColor"
              type="color"
              value={settings.theme.textColor || '#000000'}
              onChange={(e) => handleThemeChange('textColor', e.target.value)}
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

      {/* Notifications Section */}
      <div className="bg-theme-secondary rounded-xl border border-theme p-4">
        <h3 className="font-semibold mb-3 text-theme-primary">Notifications</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="enableNotifications" className="flex items-center gap-2">
              <span className="text-sm text-theme-primary">Enable Notifications</span>
              <input
                id="enableNotifications"
                name="enableNotifications"
                type="checkbox"
                checked={pendingNotifications.enabled}
                onChange={e => handleNotifChange('enabled', e.target.checked)}
                className="ml-2"
              />
            </label>
            {pendingNotifications.enabled && (
              <input
                id="notificationTime"
                name="notificationTime"
                type="time"
                value={pendingNotifications.time}
                onChange={e => handleNotifChange('time', e.target.value)}
                className="border rounded px-1 py-1 text-black bg-white text-xs w-20"
              />
            )}
          </div>

          {pendingNotifications.enabled && (
            <div className="flex items-center justify-between">
              <label htmlFor="shoppingListNotif" className="flex items-center gap-2">
                <span className="text-sm text-theme-primary">Shopping List</span>
                <input
                  id="shoppingListNotif"
                  name="shoppingListNotif"
                  type="checkbox"
                  checked={pendingNotifications.types.shoppingList}
                  onChange={e => handleNotifChange('types', { shoppingList: e.target.checked })}
                />
              </label>
              <label htmlFor="mealPlanNotif" className="flex items-center gap-2">
                <span className="text-sm text-theme-primary">Meal Reminders</span>
                <input
                  id="mealPlanNotif"
                  name="mealPlanNotif"
                  type="checkbox"
                  checked={pendingNotifications.types.mealPlan}
                  onChange={e => handleNotifChange('types', { mealPlan: e.target.checked })}
                />
              </label>
            </div>
          )}

          {pendingNotifications.enabled && pendingNotifications.types.cookingReminders !== undefined && (
            <div className="space-y-2 border-t border-theme pt-3 mt-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <span className="text-sm text-theme-primary">Cooking Reminders</span>
                  <input
                    type="checkbox"
                    checked={pendingNotifications.types.cookingReminders}
                    onChange={e => handleNotifChange('types', { cookingReminders: e.target.checked })}
                  />
                </label>
              </div>
              {pendingNotifications.types.cookingReminders && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-theme-secondary">Remind me</span>
                  <select
                    value={pendingNotifications.cookingReminderTime || 30}
                    onChange={e => handleNotifChange('cookingReminderTime', parseInt(e.target.value))}
                    className="border rounded px-2 py-1 text-black bg-white text-xs"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={120}>2 hours</option>
                  </select>
                  <span className="text-xs text-theme-secondary">before cooking</span>
                </div>
              )}
            </div>
          )}

          {notifChanged && (
            <button
              onClick={confirmNotifChanges}
              className="w-full bg-blue-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-600"
            >
              Save Notification Settings
            </button>
          )}
        </div>
      </div>

      {/* Shopping Preferences Section */}
      <div className="bg-theme-secondary rounded-xl border border-theme p-4">
        <h3 className="font-semibold mb-3 text-theme-primary">Shopping Preferences</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="includeStaples" className="flex items-center gap-2">
              <span className="text-sm text-theme-primary">Include Staples in Shopping Lists</span>
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
              />
            </label>
          </div>
          <p className="text-xs text-theme-secondary">
            When enabled, common pantry staples (salt, pepper, oil, flour, etc.) will be included in shopping lists generated from meal plans.
          </p>
        </div>
      </div>

      {/* Feedback Section */}
      <div className="bg-theme-secondary rounded-xl border border-theme p-4">
        <h3 className="font-semibold mb-3 text-theme-primary">Feedback</h3>
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

      {/* Subscription Section */}
      {user && (
        <div className="bg-theme-secondary rounded-xl border border-theme p-4">
          <h3 className="font-semibold mb-3 text-theme-primary">Subscription</h3>
          <SubscriptionManager />
        </div>
      )}

      {/* Database Monitoring Section - Developer/Admin Only */}
      {user && process.env.NODE_ENV === 'development' && (
        <div className="bg-theme-secondary rounded-xl border border-theme p-4">
          <h3 className="font-semibold mb-3 text-theme-primary">Database Monitoring</h3>
          <MonitoringDashboard user={user} />
        </div>
      )}

      {/* Help & Support Section */}
      <div className="bg-theme-secondary rounded-xl border border-theme p-4">
        <h3 className="font-semibold mb-3 text-theme-primary">Help & Support</h3>
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

      {/* App Updates Section */}
      <div className="bg-theme-secondary rounded-xl border border-theme p-4">
        <h3 className="font-semibold mb-3 text-theme-primary">App Updates</h3>
        <VersionUpdate autoCheck={true} />
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
    </div>
    </>
  );
};
