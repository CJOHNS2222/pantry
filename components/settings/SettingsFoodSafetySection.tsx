import React from 'react';
import { AlertTriangle, Heart, ShieldCheck } from 'lucide-react';
import { User, UserProfile } from '../../types';
import LeftoverPersonaQuestionnaire from '../LeftoverPersonaQuestionnaire';

interface SettingsFoodSafetySectionProps {
  title: string;
  user: User | null | undefined;
  userProfile: UserProfile | null | undefined;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | undefined>>;
  debouncedSaveProfile: (profile: UserProfile) => void;
  saveProfileData: (profile: UserProfile, immediate?: boolean) => void;
}

const DIETARY_RESTRICTIONS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Paleo', 'Low-Carb', 'Halal', 'Kosher'];
const FAVORITE_CUISINES = ['Italian', 'Mexican', 'Chinese', 'Japanese', 'Indian', 'Thai', 'French', 'Mediterranean', 'American', 'Korean'];
const PREFERRED_PROTEINS = ['Chicken', 'Beef', 'Pork', 'Fish', 'Tofu', 'Beans', 'Eggs', 'Turkey', 'Lamb', 'Shrimp'];

export const SettingsFoodSafetySection: React.FC<SettingsFoodSafetySectionProps> = ({
  title, user, userProfile, setUserProfile, debouncedSaveProfile, saveProfileData, }) => {
  const updateProfile = (updates: Partial<UserProfile>) => {
    const nextProfile = { ...userProfile, ...updates } as UserProfile;
    setUserProfile(nextProfile);
    debouncedSaveProfile(nextProfile);
  };

  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
      <div className="w-full flex items-center justify-between p-4 border-b border-theme bg-theme-primary/20">
        <div className="flex items-center gap-3">
          
          <ShieldCheck className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">{title}</h3>
        </div>
      </div>

      <div className="p-4 space-y-5">
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Dietary Restrictions
            </label>
            <p className="text-xs text-theme-secondary mb-3">Select all that apply — these will affect recipe recommendations and meal planning</p>
            <div className="grid grid-cols-2 gap-3">
              {DIETARY_RESTRICTIONS.map((restriction) => (
                <label key={restriction} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userProfile?.dietaryRestrictions?.includes(restriction) || false}
                    onChange={(event) => {
                      const current = userProfile?.dietaryRestrictions || [];
                      const dietaryRestrictions = event.target.checked
                        ? [...current, restriction]
                        : current.filter((currentRestriction) => currentRestriction !== restriction);
                      updateProfile({ dietaryRestrictions });
                    }}
                    className="rounded border-theme text-theme-primary focus:border-theme-primary"
                  />
                  <span className="text-theme-primary">{restriction}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-primary mb-3 flex items-center gap-2">
              <Heart className="w-4 h-4" />
              Favorite Cuisines
            </label>
            <p className="text-xs text-theme-secondary mb-3">Select cuisines you enjoy — these will influence recipe suggestions</p>
            <div className="grid grid-cols-2 gap-3">
              {FAVORITE_CUISINES.map((cuisine) => (
                <label key={cuisine} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userProfile?.favoriteCuisines?.includes(cuisine) || false}
                    onChange={(event) => {
                      const current = userProfile?.favoriteCuisines || [];
                      const favoriteCuisines = event.target.checked
                        ? [...current, cuisine]
                        : current.filter((currentCuisine) => currentCuisine !== cuisine);
                      updateProfile({ favoriteCuisines });
                    }}
                    className="rounded border-theme text-theme-primary focus:border-theme-primary"
                  />
                  <span className="text-theme-primary">{cuisine}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-primary mb-3">Preferred Proteins</label>
            <p className="text-xs text-theme-secondary mb-3">Select proteins you prefer — these will be prioritized in meal suggestions</p>
            <div className="grid grid-cols-2 gap-3">
              {PREFERRED_PROTEINS.map((protein) => (
                <label key={protein} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userProfile?.preferredProteins?.includes(protein) || false}
                    onChange={(event) => {
                      const current = userProfile?.preferredProteins || [];
                      const preferredProteins = event.target.checked
                        ? [...current, protein]
                        : current.filter((currentProtein) => currentProtein !== protein);
                      updateProfile({ preferredProteins });
                    }}
                    className="rounded border-theme text-theme-primary focus:border-theme-primary"
                  />
                  <span className="text-theme-primary">{protein}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-primary mb-3">Disliked Ingredients</label>
            <p className="text-xs text-theme-secondary mb-2">Ingredients you don't like — these will be avoided in suggestions</p>
            <input
              type="text"
              value={userProfile?.dislikedIngredients?.join(', ') || ''}
              onChange={(event) => {
                const dislikedIngredients = event.target.value
                  ? event.target.value.split(',').map((item) => item.trim()).filter((item) => item.length > 0)
                  : undefined;
                updateProfile({ dislikedIngredients });
              }}
              placeholder="e.g., mushrooms, olives, cilantro"
              className="w-full px-3 py-2 text-sm border border-theme rounded-lg bg-white text-black focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-primary mb-3">Special Dietary Needs</label>
            <p className="text-xs text-theme-secondary mb-2">Any additional dietary requirements or preferences</p>
            <textarea
              value={userProfile?.specialNeeds || ''}
              onChange={(event) => updateProfile({ specialNeeds: event.target.value || undefined })}
              placeholder="e.g., low sodium, diabetic friendly, etc."
              className="w-full px-3 py-2 text-sm border border-theme rounded-lg bg-white text-black focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] resize-none"
              rows={2}
            />
          </div>

          <LeftoverPersonaQuestionnaire
            user={user}
            userProfile={userProfile}
            onChange={(persona) => {
              const nextProfile = { ...userProfile, leftoverPersona: persona } as UserProfile;
              setUserProfile(nextProfile);
              saveProfileData(nextProfile, true);
            }}
          />
        </div>
    </div>
  );
};
