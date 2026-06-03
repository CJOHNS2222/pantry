import React from 'react';
import { Household, StructuredRecipe, User } from '../../types';
import type { CacheMealTypeFilter } from '../../utils/preferenceUtils';
import PopularRecipes from '../PopularRecipes';

interface RecipeFinderPopularSectionProps {
  title: string;
  cacheMealTypeFilter: CacheMealTypeFilter;
  setCacheMealTypeFilter: React.Dispatch<React.SetStateAction<CacheMealTypeFilter>>;
  cacheCuisineFilter: string;
  setCacheCuisineFilter: React.Dispatch<React.SetStateAction<string>>;
  availableCuisineFilters: string[];
  openRecipeModal: (recipe: StructuredRecipe, isSavedView?: boolean) => void;
  onAddToPlan: (recipe: StructuredRecipe) => void;
  user: User;
  household?: Household | null;
  filteredFirebaseRecipes: StructuredRecipe[];
}

export const RecipeFinderPopularSection: React.FC<RecipeFinderPopularSectionProps> = ({
  title,
  cacheMealTypeFilter,
  setCacheMealTypeFilter,
  cacheCuisineFilter,
  setCacheCuisineFilter,
  availableCuisineFilters,
  openRecipeModal,
  onAddToPlan,
  user,
  household,
  filteredFirebaseRecipes,
}) => {
  return (
    <div className="mt-12">
      <h2 className="text-xl font-bold text-theme-primary mb-6">{title}</h2>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setCacheMealTypeFilter('')}
          className={`px-3 py-1 rounded-full border text-xs transition-colors ${cacheMealTypeFilter === '' ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)]' : 'bg-theme-secondary/40 text-theme-secondary border-theme hover:bg-theme-secondary/70'}`}
        >
          All Meals
        </button>
        {(['breakfast', 'lunch', 'dinner'] as CacheMealTypeFilter[]).map((meal) => (
          <button
            key={meal}
            onClick={() => setCacheMealTypeFilter(meal)}
            className={`px-3 py-1 rounded-full border text-xs capitalize transition-colors ${cacheMealTypeFilter === meal ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)]' : 'bg-theme-secondary/40 text-theme-secondary border-theme hover:bg-theme-secondary/70'}`}
          >
            {meal}
          </button>
        ))}

        <select
          value={cacheCuisineFilter}
          onChange={(e) => setCacheCuisineFilter(e.target.value)}
          className="ml-1 px-3 py-1 rounded-full border border-theme bg-theme-secondary/40 text-theme-secondary text-xs"
        >
          <option value="">All Cuisines</option>
          {availableCuisineFilters.map((cuisine) => (
            <option key={cuisine} value={cuisine}>
              {cuisine.charAt(0).toUpperCase() + cuisine.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <PopularRecipes openRecipeModal={openRecipeModal} onAddToPlan={onAddToPlan} user={user} household={household} recipes={filteredFirebaseRecipes} />
    </div>
  );
};
