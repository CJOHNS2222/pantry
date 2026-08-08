import React from 'react';
import { useIntl } from 'react-intl';
import { Loader2, User as UserIcon } from 'lucide-react';
import { User, UserProfile } from '../../types';

interface SettingsProfileSectionProps {
  user: User;
  onLogout: () => void;
  userProfile: UserProfile | undefined;
  onProfileChange: (field: string, value: unknown) => void;
  showAvatarSelection: boolean;
  setShowAvatarSelection: React.Dispatch<React.SetStateAction<boolean>>;
  updatingAvatar: boolean;
  onAvatarSelect: (avatarPath: string) => void;
  onRemoveAvatar: () => void;
  profileChanged: boolean;
  savingProfile: boolean;
  onSaveProfile: () => void;
}

const avatarOptions = Array.from({ length: 35 }, (_, i) => `/avatars/memo_${i + 1}.png`);

export const SettingsProfileSection: React.FC<SettingsProfileSectionProps> = ({
  user,
  onLogout,
  userProfile,
  onProfileChange,
  showAvatarSelection,
  setShowAvatarSelection,
  updatingAvatar,
  onAvatarSelect,
  onRemoveAvatar,
  profileChanged,
  savingProfile,
  onSaveProfile,
}) => {
  const intl = useIntl();

  return (
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
                onClick={onRemoveAvatar}
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
                    onClick={() => onAvatarSelect(avatarPath)}
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
              onChange={(e) => onProfileChange('name', e.target.value)}
              placeholder="Enter your display name"
              className="w-full px-3 py-2 border border-theme rounded-lg bg-theme-primary text-theme-secondary placeholder-theme-secondary/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent"
            />
            <p className="text-xs text-theme-secondary mt-1">This name will be used throughout the app to personalize your experience.</p>
          </div>
        </div>

        {/* Logout Button */}
        <div className="mb-4">
          <button
            onClick={onLogout}
            className="w-full bg-red-500 text-white px-4 py-2 rounded font-medium hover:bg-red-600"
          >
            Logout
          </button>
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
                      onProfileChange('height', Math.round(cm / 2.54));
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
                        onProfileChange('height', feet * 12 + inches);
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
                        onProfileChange('height', feet * 12 + inches);
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
                    if (isNaN(val)) { onProfileChange('weight', undefined); return; }
                    const lbs = userProfile?.measurementSystem === 'Metric' ? Math.round(val / 0.453592) : val;
                    onProfileChange('weight', lbs);
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
                  onChange={(e) => onProfileChange('age', e.target.value ? parseInt(e.target.value) : undefined)}
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
                  onChange={(e) => onProfileChange('gender', e.target.value || undefined)}
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
                  onChange={(e) => onProfileChange('householdSize', e.target.value ? parseInt(e.target.value) : undefined)}
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
                onChange={(e) => onProfileChange('dietGoal', e.target.value || undefined)}
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
                onChange={(e) => onProfileChange('activityLevel', e.target.value || undefined)}
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
            onClick={onSaveProfile}
            disabled={savingProfile}
            className="w-full bg-green-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
          >
            {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
            {savingProfile ? 'Saving...' : intl.formatMessage({ id: 'settings.saveProfile' })}
          </button>
        )}
      </div>
    </div>
  );
};
