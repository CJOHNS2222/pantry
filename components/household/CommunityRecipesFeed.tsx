import React, { useState } from 'react';
import { Star, Plus, UtensilsCrossed } from 'lucide-react';
import { Tab } from '../../types/app';
import { RecipeRating, RecipeRatingInput, StructuredRecipe } from '../../types';
import { RecipeStats } from './useCommunityRatings';

export interface CommunityRecipesFeedProps {
  isLoadingRatings: boolean;
  localLoading: boolean;
  sortedRecipes: RecipeStats[];
  onOpenRecipeDetail: (stat: RecipeStats) => void;
  onAddToPlan: (recipe: StructuredRecipe) => void;
  onSaveRecipe?: (recipe: StructuredRecipe) => void;
  onRateRecipe: (rating: RecipeRatingInput) => void;
  user?: { id: string; name: string; email: string; avatar?: string };
  setActiveTab: (tab: Tab) => void;
}

export const findRecipeForStat = (stat: { comments: RecipeRating[] }) => {
  const ratingWithRecipe = stat.comments.find(c => c.recipe);
  return ratingWithRecipe ? ratingWithRecipe.recipe : null;
};

const sanitizeRecipeForSave = (r: StructuredRecipe): StructuredRecipe => {
  const placeholderPattern = /Full recipe not available in this rating/i;
  const sanitized: StructuredRecipe = {
    title: r.title || '',
    description: r.description || '',
    ingredients: Array.isArray(r.ingredients) ? [...r.ingredients] : [],
    instructions: Array.isArray(r.instructions) ? [...r.instructions] : [],
    cookTime: r.cookTime || '',
    image: r.image
  };

  if (sanitized.ingredients.length === 1 && placeholderPattern.test(String(sanitized.ingredients[0]))) {
    sanitized.ingredients = [];
  }
  if (sanitized.instructions.length === 1 && placeholderPattern.test(String(sanitized.instructions[0]))) {
    sanitized.instructions = [];
  }

  return sanitized;
};

/**
 * "Community Favorites" recipes feed sub-tab: loading/empty states, the rated-recipe
 * cards (image, average rating, latest comment, quick inline rating, add/save actions),
 * and the show-more toggle. Extracted from Community.tsx (F37).
 */
export const CommunityRecipesFeed: React.FC<CommunityRecipesFeedProps> = ({
  isLoadingRatings,
  localLoading,
  sortedRecipes,
  onOpenRecipeDetail,
  onAddToPlan,
  onSaveRecipe,
  onRateRecipe,
  user,
  setActiveTab,
}) => {
  const [showAll, setShowAll] = useState(false);

  return (
    <>
      {(isLoadingRatings || localLoading) && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-color)] mx-auto mb-4"></div>
          <p className="text-theme-secondary opacity-70">Loading community ratings…</p>
        </div>
      )}
      <div className="text-center mb-2">
        <h2 className="text-3xl font-serif font-bold text-theme-secondary">Community Favorites</h2>
        <p className="text-theme-secondary opacity-60 text-sm mt-1">Top rated recipes by our users</p>
      </div>

      <div className="space-y-4">
        {sortedRecipes.length === 0 ? (
          <div className="text-center py-12">
            <Star className="w-16 h-16 text-amber-500/30 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-theme-secondary mb-2">No Community Ratings Yet</h3>
            <p className="text-theme-secondary opacity-60 text-sm mb-4">
              Be the first to rate a recipe! Save and rate recipes to see them here.
            </p>
            <p className="text-sm text-theme-secondary opacity-70 mb-4">
              Start by opening Chef and rating one of your saved recipes.
            </p>
            <button
              onClick={() => setActiveTab(Tab.RECIPES)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-color)] text-[var(--accent-text,white)] text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <UtensilsCrossed className="w-4 h-4" />
              Find &amp; Rate Recipes
            </button>
          </div>
        ) : (
          <>
            {(showAll ? sortedRecipes : sortedRecipes.slice(0, 5)).map((stat) => {
              const avg = (stat.totalRating / stat.count).toFixed(1);
              const latestComment = stat.comments && stat.comments[0] ? stat.comments[0] : null;
              const fullRecipe = findRecipeForStat(stat);

              return (
                <div
                  key={stat.title}
                  className="bg-theme-secondary rounded-xl border border-theme shadow-lg overflow-hidden group hover:shadow-xl transition-all cursor-pointer"
                  onClick={() => onOpenRecipeDetail(stat)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open community ratings for ${stat.title}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenRecipeDetail(stat);
                    }
                  }}
                >
                  {/* Recipe Image Header */}
                  <div className="h-32 bg-gray-200 relative overflow-hidden">
                    {fullRecipe?.image ? (
                      <img
                        src={fullRecipe?.image}
                        alt={stat.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (target) {
                            target.style.display = 'none';
                            const fallback = target.parentElement?.querySelector('.fallback-text') as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    <div className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-amber-500/10 via-theme-primary to-orange-500/5 dark:from-amber-500/5 dark:to-orange-500/5 ${fullRecipe?.image ? 'hidden fallback-text' : ''}`}>
                      <div className="w-12 h-12 rounded-full bg-white/50 dark:bg-black/20 shadow-sm flex items-center justify-center mb-2 backdrop-blur-sm border border-white/20 dark:border-white/5">
                        <UtensilsCrossed className="w-6 h-6 text-amber-600/60 dark:text-amber-400/50" />
                      </div>
                      <span className="font-serif text-amber-700/60 dark:text-amber-300/50 font-medium tracking-wide text-xs px-4 text-center line-clamp-1">{stat.title || 'Recipe'}</span>
                    </div>
                    <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-4">
                      <h3 className="text-white font-bold font-serif text-lg leading-tight">{stat.title}</h3>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded text-amber-600 dark:text-amber-400">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="font-bold text-sm">{avg}</span>
                        <span className="text-xs opacity-70">({stat.count})</span>
                      </div>
                    </div>

                    {latestComment && (
                      <div className="bg-theme-primary p-3 rounded-lg mb-4 border border-theme">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-4 h-4 rounded-full bg-[var(--accent-color)] text-[8px] text-[var(--accent-text,white)] flex items-center justify-center">
                            {(latestComment && latestComment.userName) ? String(latestComment.userName).charAt(0) : '?'}
                          </div>
                          <span className="text-sm font-bold text-theme-secondary opacity-80">{latestComment.userName}</span>
                        </div>
                        <p className="text-sm text-theme-secondary italic line-clamp-2">"{latestComment.comment}"</p>
                      </div>
                    )}

                    {/* Quick inline star rating */}
                    <div className="flex items-center gap-1 mb-3" onClick={(e) => e.stopPropagation()}>
                      <span className="text-sm text-theme-secondary opacity-60 mr-1">Rate:</span>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRateRecipe({
                              id: Date.now().toString(),
                              recipeTitle: stat.title,
                              rating: star,
                              comment: '',
                              userName: user?.name || 'User',
                              userAvatar: user?.avatar,
                              recipe: fullRecipe ?? undefined
                            });
                          }}
                          className="text-amber-400 hover:text-amber-500 transition-colors"
                        >
                          <Star className="w-4 h-4 fill-current" />
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (fullRecipe) {
                            onAddToPlan(fullRecipe);
                          } else {
                            const mockRecipe: StructuredRecipe = {
                              title: stat.title,
                              description: 'Community favorite',
                              ingredients: ['Full recipe not available in this rating. Please save it first.'],
                              instructions: ['Full recipe not available in this rating. Please save it first.'],
                              cookTime: 'N/A'
                            };
                            onAddToPlan(mockRecipe);
                          }
                        }}
                        className="flex-1 py-2 bg-[var(--accent-color)]/10 text-[var(--accent-color)] font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-[var(--accent-color)] hover:text-[var(--accent-text,white)] transition-all flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> Add to Schedule
                      </button>

                      {onSaveRecipe && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (fullRecipe) {
                              onSaveRecipe(sanitizeRecipeForSave(fullRecipe));
                            } else {
                              const mockRecipe: StructuredRecipe = {
                                title: stat.title,
                                description: 'Community favorite',
                                ingredients: ['Full recipe not available in this rating. Please save it first.'],
                                instructions: ['Full recipe not available in this rating. Please save it first.'],
                                cookTime: 'N/A'
                              };
                              onSaveRecipe(sanitizeRecipeForSave(mockRecipe));
                            }
                          }}
                          className="py-2 px-3 bg-theme-primary border border-theme rounded-lg text-sm font-semibold hover:bg-theme-secondary transition-colors"
                        >
                          Save
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {sortedRecipes.length > 5 && (
              <div className="flex justify-center mt-4">
                <button onClick={() => setShowAll(prev => !prev)} className="px-4 py-2 rounded bg-[var(--accent-color)] text-[var(--accent-text,white)] text-sm font-bold shadow hover:opacity-90 transition-opacity">
                  {showAll ? 'Show Less' : `Show More (${sortedRecipes.length - 5})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};
