import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { useAppActions } from '../contexts/AppActionsContext';
import { Tab } from '../types/app';
import { Star, Clock, ChefHat, Plus, X, UtensilsCrossed } from 'lucide-react';
import { RecipeRating, StructuredRecipe } from '../types';
import RecipeModal from './RecipeModal';
import { getCachedCommunityRatedRecipes } from '../services/recipeService';
import { log } from '../services/logService';

// Staple items to ignore in ingredient display
const STAPLES = ['salt', 'pepper', 'oil', 'water', 'flour', 'sugar', 'butter', 'vinegar', 'baking powder', 'baking soda', 'spices', 'seasoning', 'soy sauce', 'cornstarch', 'yeast'];

interface CommunityProps {
  onAddToPlan: (recipe: StructuredRecipe) => void;
  onSaveRecipe?: (recipe: StructuredRecipe) => void;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    profile?: {
      householdSize?: number;
    };
  };
}

interface RecipeStats {
  title: string;
  totalRating: number;
  count: number;
  comments: RecipeRating[];
}

export const Community: React.FC<CommunityProps> = ({ onAddToPlan, onSaveRecipe, user }) => {
  const app = useApp();
  const { isLoadingRatings, setLoadingRatingsComplete } = app;
  const { setActiveTab } = useAppActions();
  const [localLoading, setLocalLoading] = useState(false);
  const [ratingsState, setRatingsState] = useState<RecipeRating[]>([]);
  // Load community-rated cache once when the tab/component mounts (don't refresh on focus)
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLocalLoading(true);
        const cached = await getCachedCommunityRatedRecipes();
        if (!mounted) return;

        if (Array.isArray(cached) && cached.length > 0) {
          // If cached items look like RecipeRating (have recipeTitle), use directly
          const first = cached[0] as any;
          if (first && (first.recipeTitle || first.comment || first.userName)) {
            setRatingsState(cached as unknown as RecipeRating[]);
          } else {
            // Convert SavedRecipe[] into synthetic RecipeRating[] so existing UI logic works
            const synthetic: RecipeRating[] = (cached as any[]).map((r: any, i: number) => ({
              id: r.id || `community_${i}`,
              recipeTitle: r.title || 'Untitled',
              rating: (typeof r.averageRating === 'number' ? Math.round(r.averageRating * 10) / 10 : 0),
              comment: r.description || '',
              userName: 'Community',
              date: r.lastUpdated || r.dateSaved || new Date().toISOString(),
              recipe: r as any
            }));
            setRatingsState(synthetic);
          }
        }
      } catch (e) {
        log.error('Failed to load cached community recipes', { error: e }, 'Community');
      } finally {
        if (mounted) {
          setLocalLoading(false);
          // Mark global ratings loading as complete
          setLoadingRatingsComplete();
        }
      }
    };
    load();
    return () => { mounted = false; };
  }, []);
  const [showModal, setShowModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<{ title: string, comments: RecipeRating[] } | null>(null);
  
  // Group ratings by recipe title and calculate average
  const recipeStats = ratingsState.reduce((acc, curr) => {
    const key = curr.recipeTitle || 'Untitled';
    // Skip ratings with no meaningful title or recipe data
    if (!key || key === 'Untitled' || !curr.recipeTitle) {
      return acc;
    }
    if (!acc[key]) {
      acc[key] = {
        title: key,
        totalRating: 0,
        count: 0,
        comments: []
      };
    }
    acc[key].totalRating += (typeof curr.rating === 'number' ? curr.rating : 0);
    acc[key].count += 1;
    // Keep the full rating objects (comments array holds ratings) so embedded recipe data
    // is preserved even when the rating has no textual comment.
    acc[key].comments.push(curr);
    return acc;
  }, {} as Record<string, RecipeStats>);

  const sortedRecipes = Object.values(recipeStats)
    .filter((stat): stat is RecipeStats => {
      const s = stat as RecipeStats;
      return !!(s && typeof s === 'object' && 'count' in s && 'title' in s &&
             s.count > 0 && s.title && s.title !== 'Untitled');
    }) // Only show recipes with ratings and valid titles
    .sort((a, b) => (b.totalRating / Math.max(1, b.count)) - (a.totalRating / Math.max(1, a.count)));
  const [showAll, setShowAll] = useState(false);
  const findRecipeForStat = (stat: { comments: RecipeRating[] }) => {
    // Return the first available embedded recipe from comments, even if partial.
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
      image: (r as any).image
    };

    if (sanitized.ingredients.length === 1 && placeholderPattern.test(String(sanitized.ingredients[0]))) {
      sanitized.ingredients = [];
    }
    if (sanitized.instructions.length === 1 && placeholderPattern.test(String(sanitized.instructions[0]))) {
      sanitized.instructions = [];
    }

    return sanitized;
  };

  return (
    <div className="space-y-6 pb-24 animate-fade-in">
      {(isLoadingRatings || localLoading) && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-color)] mx-auto mb-4"></div>
          <p className="text-theme-secondary opacity-70">Loading community ratings…</p>
        </div>
      )}
      <div className="text-center mb-6">
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
            <button
              onClick={() => setActiveTab(Tab.RECIPES)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-color)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <UtensilsCrossed className="w-4 h-4" />
              Find &amp; Rate Recipes
            </button>
          </div>
        ) : (
          <>
            {(showAll ? sortedRecipes : sortedRecipes.slice(0,5)).map((stat, idx) => {
           const avg = (stat.totalRating / stat.count).toFixed(1);
           const latestComment = stat.comments && stat.comments[0] ? stat.comments[0] : null;
           const fullRecipe = findRecipeForStat(stat);
           
           return (
             <div 
               key={idx} 
               className="bg-theme-secondary rounded-xl border border-theme shadow-lg overflow-hidden group hover:shadow-xl transition-all cursor-pointer"
               onClick={() => { setSelectedRecipe(stat); setShowModal(true); }}
             >
                {/* Recipe Image Header */}
                <div className="h-32 bg-gray-200 relative overflow-hidden">
                    {fullRecipe?.image ? (
                        <img
                            src={fullRecipe.image}
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
                    <div className={`absolute inset-0 flex items-center justify-center text-theme-secondary opacity-10 font-serif text-4xl font-bold bg-theme-primary ${fullRecipe?.image ? 'hidden fallback-text' : ''}`}>
                        {(stat.title && String(stat.title).charAt ? String(stat.title).charAt(0) : '?')}
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
                             <span className="text-[10px] opacity-70">({stat.count})</span>
                        </div>
                    </div>

                    {latestComment && (
                        <div className="bg-theme-primary p-3 rounded-lg mb-4 border border-theme">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-4 h-4 rounded-full bg-[var(--accent-color)] text-[8px] text-white flex items-center justify-center">
                                  {(latestComment && latestComment.userName) ? String(latestComment.userName).charAt(0) : '?'}
                                </div>
                                <span className="text-xs font-bold text-theme-secondary opacity-80">{latestComment.userName}</span>
                            </div>
                            <p className="text-xs text-theme-secondary italic line-clamp-2">"{latestComment.comment}"</p>
                        </div>
                    )}
                    
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
                        className="flex-1 py-2 bg-[var(--accent-color)]/10 text-[var(--accent-color)] font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-[var(--accent-color)] hover:text-white transition-all flex items-center justify-center gap-2"
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
                          Save Recipe
                        </button>
                      )}
                    </div>
                </div>
             </div>
           );
        })}
          {sortedRecipes.length > 5 && (
            <div className="flex justify-center mt-4">
              <button onClick={() => setShowAll(prev => !prev)} className="px-4 py-2 rounded bg-[var(--accent-color)] text-white">
                {showAll ? 'Show Less' : `Show More (${sortedRecipes.length - 5})`}
              </button>
            </div>
          )}
        </>
        )}
      </div>

      {showModal && selectedRecipe && (() => {
        const recipeFromComment = findRecipeForStat(selectedRecipe);
        const structured: StructuredRecipe = recipeFromComment
          ? recipeFromComment
          : {
              title: selectedRecipe.title,
              description: 'Community favorite',
              ingredients: ['Full recipe not available in this rating. Please save it first.'],
              instructions: ['Full recipe not available in this rating. Please save it first.'],
              cookTime: 'N/A'
            };
        return (
            <RecipeModal
            recipe={structured}
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            onAddToPlan={(r) => { onAddToPlan(r); }}
              onSaveRecipe={(r) => onSaveRecipe?.(r)}
            showSaveButton={true}
            showMarkAsMade={false}
            showAddToPlan={true}
            user={user}
          />
        );
      })()}
    </div>
  );
};