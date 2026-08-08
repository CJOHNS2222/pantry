import React from 'react';
import { AlertTriangle, Heart, Settings as SettingsIcon, X } from 'lucide-react';
import { Member, UserProfile } from '../../types';

type MemberPreferences = Pick<Member, 'dietaryRestrictions' | 'allergies' | 'dietGoal' | 'favoriteCuisines' | 'specialNeeds' | 'preferredProteins' | 'dislikedIngredients'>;

const DIETARY_RESTRICTIONS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Paleo', 'Low-Carb', 'Halal', 'Kosher'];
const ALLERGIES = ['Peanuts', 'Tree Nuts', 'Dairy', 'Eggs', 'Soy', 'Wheat', 'Fish', 'Shellfish', 'Sesame', 'Mustard'];
const CUISINES = ['Italian', 'Mexican', 'Chinese', 'Japanese', 'Indian', 'Thai', 'French', 'Mediterranean', 'American', 'Korean'];
const PROTEINS = ['Chicken', 'Beef', 'Pork', 'Fish', 'Tofu', 'Beans', 'Eggs', 'Turkey', 'Lamb', 'Shrimp'];

interface SettingsMemberPreferencesModalProps {
  selectedMember: Member;
  memberPreferences: Partial<MemberPreferences>;
  setMemberPreferences: React.Dispatch<React.SetStateAction<Partial<MemberPreferences>>>;
  savingMemberPrefs: boolean;
  onClose: () => void;
  onSave: () => void;
}

export const SettingsMemberPreferencesModal: React.FC<SettingsMemberPreferencesModalProps> = ({
  selectedMember,
  memberPreferences,
  setMemberPreferences,
  savingMemberPrefs,
  onClose,
  onSave,
}) => {
  const toggleListValue = (key: keyof MemberPreferences, value: string, checked: boolean) => {
    setMemberPreferences(prev => {
      const current = (prev[key] as string[] | undefined) || [];
      return {
        ...prev,
        [key]: checked ? [...current, value] : current.filter(v => v !== value),
      };
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-theme-primary rounded-2xl shadow-2xl max-w-lg w-full h-[80vh] max-h-[600px] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex-shrink-0 p-4 border-b border-theme bg-theme-secondary">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <SettingsIcon className="w-5 h-5 text-theme-primary flex-shrink-0" />
              <h2 className="font-serif font-bold text-theme-primary text-lg truncate">{selectedMember.name}'s Preferences</h2>
            </div>
            <button onClick={onClose} className="text-theme-secondary hover:text-theme-primary flex-shrink-0 ml-2">
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
                {DIETARY_RESTRICTIONS.map((restriction) => (
                  <label key={restriction} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={memberPreferences.dietaryRestrictions?.includes(restriction) || false}
                      onChange={(e) => toggleListValue('dietaryRestrictions', restriction, e.target.checked)}
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
                {ALLERGIES.map((allergy) => (
                  <label key={allergy} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={memberPreferences.allergies?.includes(allergy) || false}
                      onChange={(e) => toggleListValue('allergies', allergy, e.target.checked)}
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
                {CUISINES.map((cuisine) => (
                  <label key={cuisine} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={memberPreferences.favoriteCuisines?.includes(cuisine) || false}
                      onChange={(e) => toggleListValue('favoriteCuisines', cuisine, e.target.checked)}
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
                {PROTEINS.map((protein) => (
                  <label key={protein} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={memberPreferences.preferredProteins?.includes(protein) || false}
                      onChange={(e) => toggleListValue('preferredProteins', protein, e.target.checked)}
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
              onClick={onClose}
              className="flex-1 bg-theme-primary hover:bg-theme-secondary text-theme-secondary hover:text-theme-primary py-2 px-4 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={savingMemberPrefs}
              className="flex-1 bg-theme-secondary hover:bg-theme-primary text-theme-primary hover:text-theme-secondary py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {savingMemberPrefs ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
