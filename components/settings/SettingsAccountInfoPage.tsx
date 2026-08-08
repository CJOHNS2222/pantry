import React from 'react';
import { SettingsGuestBanner } from './SettingsGuestBanner';
import { SettingsProfileSection } from './SettingsProfileSection';
import { SettingsFoodSafetySection } from './SettingsFoodSafetySection';
import { SettingsHouseholdSection } from './SettingsHouseholdSection';
import { Household, Member, User, UserProfile } from '../../types';

interface SettingsAccountInfoPageProps {
  user: User | null | undefined;
  onLogout?: () => void;

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

  foodSafetyTitle: string;
  debouncedSaveProfile: (profile: UserProfile) => void;
  saveProfileData: (profile: UserProfile, immediate?: boolean) => void;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | undefined>>;

  household: Household | null | undefined;
  householdTitle: string;
  onShowHousehold?: () => void;
  openMemberPreferences: (member: Member) => void;
  removeMemberFromHousehold: (member: Member) => void;
  householdName: string;
  setHouseholdName: React.Dispatch<React.SetStateAction<string>>;
  isCreatingHousehold: boolean;
  createHousehold: () => void;
  manageHouseholdLabel: string;
}

export const SettingsAccountInfoPage: React.FC<SettingsAccountInfoPageProps> = ({
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
  foodSafetyTitle,
  debouncedSaveProfile,
  saveProfileData,
  setUserProfile,
  household,
  householdTitle,
  onShowHousehold,
  openMemberPreferences,
  removeMemberFromHousehold,
  householdName,
  setHouseholdName,
  isCreatingHousehold,
  createHousehold,
  manageHouseholdLabel,
}) => {
  return (
    <>
      <SettingsGuestBanner isGuest={!!user?.isGuest} onLogout={onLogout} />

      {user && onLogout && !user.isGuest && (
        <SettingsProfileSection
          user={user}
          onLogout={onLogout}
          userProfile={userProfile}
          onProfileChange={onProfileChange}
          showAvatarSelection={showAvatarSelection}
          setShowAvatarSelection={setShowAvatarSelection}
          updatingAvatar={updatingAvatar}
          onAvatarSelect={onAvatarSelect}
          onRemoveAvatar={onRemoveAvatar}
          profileChanged={profileChanged}
          savingProfile={savingProfile}
          onSaveProfile={onSaveProfile}
        />
      )}

      <SettingsFoodSafetySection
        title={foodSafetyTitle}
        user={user}
        userProfile={userProfile}
        setUserProfile={setUserProfile}
        debouncedSaveProfile={debouncedSaveProfile}
        saveProfileData={saveProfileData}
      />

      <SettingsHouseholdSection
        user={user}
        household={household}
        title={householdTitle}
        onShowHousehold={onShowHousehold}
        openMemberPreferences={openMemberPreferences}
        removeMemberFromHousehold={removeMemberFromHousehold}
        householdName={householdName}
        setHouseholdName={setHouseholdName}
        isCreatingHousehold={isCreatingHousehold}
        createHousehold={createHousehold}
        manageHouseholdLabel={manageHouseholdLabel}
      />
    </>
  );
};
