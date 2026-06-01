import React from 'react';
import { useIntl } from 'react-intl';
import { Bookmark, Plus } from 'lucide-react';
import { SavedRecipe, StructuredRecipe } from '../../types';
import { Tab } from '../../types/app';
import ImportModal from '../ImportModal';
import { RecipeCardSkeleton } from '../SkeletonLoader';

interface RecipeFinderSavedViewProps {
  showImportModal: boolean;
  setShowImportModal: React.Dispatch<React.SetStateAction<boolean>>;
  recipeSaveLimitExceeded: boolean;
  savedRecipes: SavedRecipe[];
  setActiveTab: (tab: Tab) => void;
  isLoadingSavedRecipes: boolean;
  savedSort: 'recent' | 'top-rated';
  setSavedSort: React.Dispatch<React.SetStateAction<'recent' | 'top-rated'>>;
  sortedSavedRecipes: SavedRecipe[];
  renderRecipeCard: (recipe: StructuredRecipe, isSavedView?: boolean, isCompact?: boolean) => React.ReactNode;
  onExportRecipes: () => void;
  onAddManualRecipe: () => void;
}

export const RecipeFinderSavedView: React.FC<RecipeFinderSavedViewProps> = ({
  showImportModal,
  setShowImportModal,
  recipeSaveLimitExceeded,
  savedRecipes,
  setActiveTab,
  isLoadingSavedRecipes,
  savedSort,
  setSavedSort,
  sortedSavedRecipes,
  renderRecipeCard,
  onExportRecipes,
  onAddManualRecipe,
}) => {
  const intl = useIntl();

  return (
    <div className="space-y-4">
      {showImportModal && <ImportModal open={showImportModal} onClose={() => setShowImportModal(false)} defaultTab="recipes" />}

      {recipeSaveLimitExceeded && (
        <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-2">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            Save limit reached ({savedRecipes.length} saved) - upgrade to save more
          </p>
          <button
            onClick={() => setActiveTab(Tab.SETTINGS)}
            className="text-xs font-bold text-[var(--accent-color)] shrink-0 hover:opacity-80 transition-opacity"
          >
            Upgrade
          </button>
        </div>
      )}

      {isLoadingSavedRecipes ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <RecipeCardSkeleton key={index} />
          ))}
        </div>
      ) : savedRecipes.length === 0 ? (
        <div className="text-center py-12 opacity-30">
          <Bookmark className="w-12 h-12 mx-auto mb-2" />
          <p>{intl.formatMessage({ id: 'recipes.noSaved' })}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1">
              <button
                onClick={() => setSavedSort('recent')}
                aria-label="Sort by most recent"
                aria-pressed={savedSort === 'recent'}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  savedSort === 'recent'
                    ? 'bg-[var(--accent-color)] text-white'
                    : 'bg-theme-secondary text-theme-secondary opacity-60 hover:opacity-90'
                }`}
              >
                Recent
              </button>
              <button
                onClick={() => setSavedSort('top-rated')}
                aria-label="Sort by top rated"
                aria-pressed={savedSort === 'top-rated'}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  savedSort === 'top-rated'
                    ? 'bg-[var(--accent-color)] text-white'
                    : 'bg-theme-secondary text-theme-secondary opacity-60 hover:opacity-90'
                }`}
              >
                Top Rated
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">{sortedSavedRecipes.map(r => renderRecipeCard(r, true, true))}</div>

          <div className="flex justify-end mt-6">
            <div className="flex gap-2">
              <button
                data-testid="recipefinder-import-button"
                aria-label="Import recipes from file"
                className="px-4 py-2 bg-theme-secondary text-theme-primary rounded-lg font-bold shadow hover:bg-theme-secondary/90 transition-colors"
                onClick={() => setShowImportModal(true)}
              >
                Import
              </button>
              <button
                className="px-4 py-2 bg-[var(--accent-color)] text-white rounded-lg font-bold shadow hover:bg-[var(--accent-color)]/90 transition-colors"
                onClick={onExportRecipes}
                data-tutorial="export-recipes"
              >
                Export Recipes
              </button>
              <button
                aria-label="Add a new recipe manually"
                className="px-4 py-2 bg-theme-secondary text-theme-primary rounded-lg font-bold shadow hover:bg-theme-secondary/80 transition-colors"
                onClick={onAddManualRecipe}
              >
                <Plus className="w-4 h-4 mr-2" /> Add Recipe
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
