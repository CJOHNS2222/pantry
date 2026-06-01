import React from 'react';
import { ChevronDown, ChevronRight, Edit2, Loader2, Users, X } from 'lucide-react';
import { Household, Member, User } from '../../types';

interface SettingsHouseholdSectionProps {
  user: User | null | undefined;
  household: Household | null | undefined;
  expanded: boolean;
  onToggle: () => void;
  title: string;
  onShowHousehold?: () => void;
  openMemberPreferences: (member: Member) => void;
  removeMemberFromHousehold: (member: Member) => void;
  householdName: string;
  setHouseholdName: React.Dispatch<React.SetStateAction<string>>;
  isCreatingHousehold: boolean;
  createHousehold: () => void;
  manageHouseholdLabel: string;
}

export const SettingsHouseholdSection: React.FC<SettingsHouseholdSectionProps> = ({
  user,
  household,
  expanded,
  onToggle,
  title,
  onShowHousehold,
  openMemberPreferences,
  removeMemberFromHousehold,
  householdName,
  setHouseholdName,
  isCreatingHousehold,
  createHousehold,
  manageHouseholdLabel,
}) => {
  if (!user) {
    return null;
  }

  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden" data-section="household">
      <div onClick={onToggle} className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors">
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-5 h-5 text-theme-primary" /> : <ChevronRight className="w-5 h-5 text-theme-primary" />}
          <Users className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">{title}</h3>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-theme p-4">
          {household ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-theme-primary">{household.name}</p>
                  <p className="text-xs text-theme-secondary">
                    {household.members && Array.isArray(household.members) ? household.members.length : 0} member
                    {household.members && Array.isArray(household.members) && household.members.length === 1 ? '' : 's'}
                  </p>
                </div>
                <button
                  onClick={() => onShowHousehold?.()}
                  className="px-3 py-2 bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-color)]/80 transition-colors text-sm font-medium"
                >
                  {manageHouseholdLabel}
                </button>
              </div>

              <div className="space-y-3 mb-4">
                {household.members &&
                  Array.isArray(household.members) &&
                  household.members.map((member) => {
                    const isCurrentUser = member.id === user.id;
                    const isAdmin = member.role === 'admin';
                    const currentUserIsAdmin = household.members.find((currentMember) => currentMember.id === user.id)?.role === 'admin';

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
                                {isAdmin && <span className="px-2 py-0.5 bg-[var(--accent-color)] text-white text-xs rounded-full">Admin</span>}
                                {isCurrentUser && <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">You</span>}
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

              <p className="text-sm text-theme-secondary">
                Customize preferences for each household member to get personalized recipe recommendations and shopping suggestions.
              </p>
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-theme-secondary">Create a household to share your pantry with family members.</p>

              <div className="space-y-3">
                <div>
                  <label htmlFor="householdName" className="block text-sm font-medium text-theme-primary mb-1">
                    Household Name
                  </label>
                  <input
                    id="householdName"
                    type="text"
                    value={householdName}
                    onChange={(event) => setHouseholdName(event.target.value)}
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
  );
};
