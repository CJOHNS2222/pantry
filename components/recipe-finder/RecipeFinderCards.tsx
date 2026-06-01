import React from 'react';
import { Plus, Clock, List, ChefHat, Star, AlertTriangle, ShieldAlert } from 'lucide-react';
import { StructuredRecipe, RecipeRating, User } from '../../types';
import { AppBadge } from '../AppBadge';
import { RecipeRatingUI } from '../RecipeRating';
import { ProgressiveImage } from '../ProgressiveImage';
import { generateBlurDataURL } from '../../utils/appUtils';

interface RatingInfo {
  avg: string;
  count: number;
}

interface RecipeCardWarning {
  warnings: string[];
  isAllergen: boolean;
}

interface DietaryBadge {
  label: string;
  variant: 'success' | 'warning' | 'info' | 'critical' | 'neutral';
}

interface RecipeFinderCardProps {
  recipe: StructuredRecipe;
  isSavedView?: boolean;
  isCompact?: boolean;
  ratingInfo: RatingInfo | null;
  dietaryBadges: DietaryBadge[];
  cardWarning?: RecipeCardWarning;
  filteredIngredients: string[];
  mealPlanLimitExceeded: boolean;
  onOpen: (recipe: StructuredRecipe, isSavedView?: boolean) => void;
  onAddToPlan: (recipe: StructuredRecipe) => void;
  onRate: (rating: RecipeRating) => void;
  user: User;
  noImageLabel: string;
}

interface RecipeFinderTileProps {
  recipe: StructuredRecipe;
  ratingInfo: RatingInfo | null;
  showPreferenceSignals: boolean;
  preferenceSignals: { positive: string[]; warning: string[] };
  onOpen: (recipe: StructuredRecipe) => void;
}

export const RecipeFinderCard: React.FC<RecipeFinderCardProps> = ({
  recipe,
  isSavedView = false,
  isCompact = false,
  ratingInfo,
  dietaryBadges,
  cardWarning,
  filteredIngredients,
  mealPlanLimitExceeded,
  onOpen,
  onAddToPlan,
  onRate,
  user,
  noImageLabel,
}) => {
  const stableRecipeKey = `${recipe.id || recipe.title || 'Untitled Recipe'}-${isSavedView ? 'saved' : 'search'}-${isCompact ? 'compact' : 'full'}`;

  if (isCompact) {
    return (
      <div
        key={`compact-${stableRecipeKey}`}
        className="bg-theme-secondary rounded-2xl shadow-lg border border-theme overflow-hidden group hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer"
        onClick={() => onOpen(recipe, isSavedView)}
        role="button"
        tabIndex={0}
        aria-label={`Open recipe ${recipe.title}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen(recipe, isSavedView);
          }
        }}
      >
        <div className="aspect-video bg-theme-primary/20 relative overflow-hidden">
          {recipe.image ? (
            <ProgressiveImage
              src={recipe.image}
              alt={recipe.title}
              className="w-full h-full group-hover:scale-105 transition-transform duration-300"
              blurDataURL={generateBlurDataURL(300, 200)}
              placeholderSrc="/images/placeholder.svg"
              lazy={true}
            />
          ) : (
            <div className="w-full h-full bg-theme-primary/10 flex items-center justify-center">
              <div className="text-theme-secondary/50 text-xs">{noImageLabel}</div>
            </div>
          )}
        </div>

        <div className="p-4 space-y-3">
          <div className="space-y-2">
            <h4 className="font-bold text-sm line-clamp-2 text-theme-primary">{recipe.title}</h4>
            {recipe.description && <p className="text-xs text-theme-secondary line-clamp-2">{recipe.description}</p>}
          </div>
          {cardWarning && (
            <div className={`flex items-start gap-1 text-[10px] rounded px-1.5 py-1 mb-1.5 ${cardWarning.isAllergen ? 'bg-red-100 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
              {cardWarning.isAllergen ? <ShieldAlert className="w-3 h-3 shrink-0 mt-0.5" /> : <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />}
              <span className="leading-tight">{cardWarning.warnings[0]}</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-xs text-theme-secondary">
            <Clock className="w-3 h-3" /> {recipe.cookTime}
            {ratingInfo && (
              <>
                <Star className="w-3 h-3 text-yellow-400" /> {ratingInfo.avg}
              </>
            )}
          </div>
          {dietaryBadges.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {dietaryBadges.map((badge) => (
                <AppBadge key={badge.label} variant={badge.variant} size="xs">
                  {badge.label}
                </AppBadge>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      key={`full-${stableRecipeKey}`}
      className="bg-theme-secondary rounded-2xl shadow-xl border border-theme overflow-hidden group hover:shadow-2xl hover:-translate-y-0.5 transition-all mb-6 cursor-pointer"
      onClick={() => onOpen(recipe, isSavedView)}
      role="button"
      tabIndex={0}
      aria-label={`Open recipe ${recipe.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(recipe, isSavedView);
        }
      }}
    >
      <div className="bg-gradient-to-r from-theme-primary to-theme-primary/80 p-4 border-b border-theme">
        <h4 className="text-lg font-serif font-bold mb-2">{recipe.title}</h4>
        {cardWarning && (
          <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 mb-2 ${cardWarning.isAllergen ? 'bg-red-100 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
            {cardWarning.isAllergen ? <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
            <div>
              {cardWarning.warnings.map((warning, index) => (
                <div key={index}>{warning}</div>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 text-xs font-medium opacity-90">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-[var(--accent-color)]" /> {recipe.cookTime}
          </span>
          {ratingInfo && (
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-400" /> {ratingInfo.avg} ({ratingInfo.count})
            </span>
          )}
        </div>
        {dietaryBadges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {dietaryBadges.map((badge) => (
              <AppBadge key={badge.label} variant={badge.variant} size="xs">
                {badge.label}
              </AppBadge>
            ))}
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="text-theme-secondary opacity-70 text-sm mb-3 leading-relaxed">{recipe.description}</p>
        <div className="grid gap-3 mb-4">
          <div className="bg-theme-primary/50 p-3 rounded-lg">
            <h5 className="text-xs font-bold text-[var(--accent-color)] uppercase mb-2 flex items-center gap-2">
              <List className="w-3 h-3" /> Ingredients
            </h5>
            <ul className="text-sm text-theme-secondary opacity-80 space-y-1 list-disc list-inside">
              {filteredIngredients.map((ingredient, index) => (
                <li key={index}>{ingredient}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToPlan(recipe);
            }}
            data-testid={`recipefinder-add-${recipe.id || recipe.title.replace(/\s+/g, '-')}`}
            disabled={mealPlanLimitExceeded}
            className={`flex-1 border font-bold py-2 rounded-xl transition-all flex items-center justify-center gap-2 ${
              mealPlanLimitExceeded
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-50 border-gray-400'
                : 'bg-theme-primary border-theme hover:border-[var(--accent-color)] text-[var(--accent-color)] hover:bg-[var(--accent-color)] hover:text-white'
            }`}
          >
            <Plus className="w-4 h-4" /> {mealPlanLimitExceeded ? 'Limit Reached' : 'Add to Schedule'}
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-theme" onClick={(e) => e.stopPropagation()}>
          <RecipeRatingUI recipeTitle={recipe.title} recipe={recipe} onRatingSubmitted={onRate} householdId={user?.householdId} />
        </div>
      </div>
    </div>
  );
};

export const RecipeFinderTile: React.FC<RecipeFinderTileProps> = ({ recipe, ratingInfo, showPreferenceSignals, preferenceSignals, onOpen }) => {
  const titleKey = recipe.title || 'Untitled Recipe';

  return (
    <div
      key={`tile-${titleKey}`}
      className="bg-theme-secondary rounded-2xl shadow-lg border border-theme overflow-hidden group hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
      onClick={() => onOpen(recipe)}
      role="button"
      tabIndex={0}
      aria-label={`View recipe: ${recipe.title}, cooking time: ${recipe.cookTime}${ratingInfo ? `, rating: ${ratingInfo.avg} stars` : ''}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(recipe);
        }
      }}
    >
      <div className="aspect-video bg-theme-primary/20 relative overflow-hidden">
        {recipe.image ? (
          <ProgressiveImage
            src={recipe.image}
            alt={recipe.title}
            className="w-full h-full group-hover:scale-110 transition-transform duration-500 filter group-hover:brightness-110"
            blurDataURL={generateBlurDataURL(300, 300)}
            placeholderSrc="/images/placeholder.svg"
            lazy={true}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-theme-primary/10">
            <ChefHat className="w-8 h-8 text-theme-secondary opacity-50" />
          </div>
        )}
      </div>

      <div className="p-4 group-hover:bg-theme-secondary/80 transition-colors duration-300 space-y-3">
        <div className="space-y-2">
          <h4 className="font-bold text-sm line-clamp-2 leading-tight group-hover:text-theme-primary transition-colors duration-300 text-theme-primary">{recipe.title}</h4>
          {recipe.description && <p className="text-xs text-theme-secondary line-clamp-2">{recipe.description}</p>}
        </div>

        {showPreferenceSignals && (
          <div className="flex flex-wrap gap-1.5">
            {preferenceSignals.positive.map((label) => (
              <AppBadge key={label} variant="success" size="xs">
                {label}
              </AppBadge>
            ))}
            {preferenceSignals.warning.map((label) => (
              <AppBadge key={label} variant="warning" size="xs">
                {label}
              </AppBadge>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-theme-secondary opacity-70 group-hover:opacity-90 transition-opacity duration-300">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {recipe.cookTime}
          </div>
          {ratingInfo && (
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-400" />
              {ratingInfo.avg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
