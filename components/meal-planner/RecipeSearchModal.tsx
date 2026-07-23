import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useIntl } from 'react-intl';
import { ChefHat } from 'lucide-react';
import { PantryItem, StructuredRecipe, User, SavedRecipe, Household } from '../../types';
import { searchRecipes as searchRecipesGemini } from '../../services/geminiService';
import { getCachedPopularRecipes, getCachedRecipesCache } from '../../services/recipeService';
import { searchRecipes } from '../../utils/searchUtils';
import { debounce } from '../../utils/debounceUtils';
import { log } from '../../services/logService';
import { CompactRecipeCardSkeleton } from '../ui/SkeletonLoader';
import { ProgressiveImage } from '../ui/ProgressiveImage';
import { getUserMeasurementSystem } from '../../utils/measurementUtils';
import { rankCachedRecipesByPreferences, recipeMatchesCacheFilters, isRecipeSafeFromAllergies } from '../../utils/preferenceUtils';

interface RecipeSearchModalProps {
  mealType: 'breakfast' | 'lunch' | 'dinner';
  dayIndex: number;
  onAddRecipe: (recipe: StructuredRecipe, dayIndex: number) => void;
  onClose: () => void;
  inventory: PantryItem[];
  user: User;
  savedRecipes: SavedRecipe[];
  household?: Household | null;
}

export const RecipeSearchModal: React.FC<RecipeSearchModalProps> = ({
  mealType,
  dayIndex,
  onAddRecipe,
  inventory,
  user,
  savedRecipes: propSavedRecipes,
  household
}) => {
  const intl = useIntl();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StructuredRecipe[]>([]);
  const [searchResultsSource, setSearchResultsSource] = useState<'saved' | 'gemini' | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>(propSavedRecipes);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [recipesLoaded, setRecipesLoaded] = useState(true); // Already loaded from props
  const [cachedRecipes, setCachedRecipes] = useState<SavedRecipe[]>([]);
  const [cachedRecipesLoaded, setCachedRecipesLoaded] = useState(false);

  // Load cached recipes when component mounts
  useEffect(() => {
    const loadCachedRecipes = async () => {
      try {
        // For the meal planner we prefer the large pre-built cache document to avoid
        // reading hundreds of recipe docs. Admin script writes `recipe_caches/recipes_cache_1`.
        const recipes = await getCachedRecipesCache('recipe_caches/recipes_cache_1');
        setCachedRecipes(recipes);
        setCachedRecipesLoaded(true);
      } catch (error) {
        log.error('Failed to load cached recipes for meal planner, falling back', { error });
        try {
          const fallback = await getCachedPopularRecipes();
          setCachedRecipes(fallback);
        } catch (e) {
          log.error('Fallback also failed', { e });
        }
        setCachedRecipesLoaded(true);
      }
    };

    loadCachedRecipes();
  }, []);

  // Clear search results when query is empty
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchResultsSource(null);
    }
  }, [searchQuery]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      // First, search through saved recipes
      const savedResults = searchRecipes(savedRecipes, searchQuery)
        .filter((recipe, index, self) =>
          index === self.findIndex(r => r.title === recipe.title)
        );

      // Also search through cached recipes
      const cachedResults = rankCachedRecipesByPreferences(
        searchRecipes(cachedRecipes, searchQuery)
        .filter((recipe, index, self) =>
          index === self.findIndex(r => r.title === recipe.title)
        )
        .filter(recipe => !savedResults.some(saved => saved.title === recipe.title))
        .filter(recipe => recipeMatchesCacheFilters(recipe, { mealType }))
        .filter(recipe => isRecipeSafeFromAllergies(recipe, household?.members || [], user?.profile)),
        household?.members || [],
        user?.profile
      ); // Avoid duplicates and rank by preferences

      // Combine saved and cached results
      const allResults = [...savedResults, ...cachedResults];

      // If we found recipes, show them
      if (allResults.length > 0) {
        setSearchResults(allResults.map(recipe => ({
          title: recipe.title,
          description: recipe.description || '',
          cookTime: recipe.cookTime || '30 mins',
          servings: recipe.servings || 4,
          ingredients: recipe.ingredients || [],
          instructions: recipe.instructions || [],
          image: recipe.image,
          nutrition: recipe.nutrition,
          tags: recipe.tags || []
        })));
        setSearchResultsSource('saved');
        setIsSearching(false);
        return;
      }

      // If no saved/cached recipes found, try Gemini as fallback (only if user opted in)
      const { userOptedInToGemini } = await import('../../services/featureFlags');
      if (userOptedInToGemini(user?.id)) {
        const pantryIngredients = inventory.map(item => item.item.toLowerCase()).join(', ');
        const result = await searchRecipesGemini({
          query: searchQuery,
          ingredients: pantryIngredients,
          restrictions: '',
          maxCookTime: 60,
          maxIngredients: 15,
          measurementSystem: getUserMeasurementSystem(user?.profile),
          strictMode: false,
          userId: user?.id
        }, user);
        setSearchResults(result.recipes || []);
        setSearchResultsSource('gemini');
      } else {
        // No recipes found and user hasn't opted into Gemini
        setSearchResults([]);
        setSearchResultsSource(null);
      }
    } catch (error) {
      log.error('Search error', { error });
      setSearchResults([]);
      setSearchResultsSource(null);
    } finally {
      setIsSearching(false);
    }
  };

  // Stable ref so the debounce always calls the latest handleSearch without being recreated
  // on every keystroke (the old useMemo([searchQuery]) pattern fired one Gemini call per character)
  const handleSearchRef = useRef<() => Promise<void>>(async () => {});
  handleSearchRef.current = handleSearch;

  // Debounced search - created once, never recreated
  const debouncedSearch = useRef(
    debounce(() => {
      void handleSearchRef.current();
    }, 800) // 800ms delay
  ).current;

  // Effect to trigger debounced search when query changes
  useEffect(() => {
    if (searchQuery.trim() && searchQuery.trim().length >= 2) {
      debouncedSearch();
    }
  }, [searchQuery, debouncedSearch]);

  const filteredSavedRecipes = useMemo(() => 
    searchRecipes(savedRecipes, searchQuery)
      .filter((recipe, index, self) =>
        index === self.findIndex(r => r.title === recipe.title)
      )
      .filter(recipe => !searchResults.some(searchResult => searchResult.title === recipe.title)),
    [savedRecipes, searchQuery, searchResults]
  );

  const filteredCachedRecipes = useMemo(() => 
    rankCachedRecipesByPreferences(
      searchRecipes(cachedRecipes, searchQuery)
        .filter((recipe, index, self) =>
          index === self.findIndex(r => r.title === recipe.title)
        )
        .filter(recipe => recipeMatchesCacheFilters(recipe, { mealType }))
        .filter(recipe => !filteredSavedRecipes.some(saved => saved.title === recipe.title)) // Avoid duplicates with saved recipes
        .filter(recipe => !searchResults.some(searchResult => searchResult.title === recipe.title))
        .filter(recipe => isRecipeSafeFromAllergies(recipe, household?.members || [], user?.profile)),
      household?.members || [],
      user?.profile
    ), // Avoid duplicates with search results and rank by preferences
    [cachedRecipes, searchQuery, searchResults, filteredSavedRecipes, mealType, household?.members, user?.profile]
  );

  const defaultPopularRecipes = useMemo(() => {
    if (!cachedRecipesLoaded) return [];
    return rankCachedRecipesByPreferences(
      cachedRecipes
        .filter((recipe, index, self) =>
          index === self.findIndex(r => r.title === recipe.title)
        )
        .filter(recipe => !savedRecipes.some(saved => saved.title === recipe.title))
        .filter(recipe => isRecipeSafeFromAllergies(recipe, household?.members || [], user?.profile)),
      household?.members || [],
      user?.profile
    ).slice(0, 12);
  }, [cachedRecipes, cachedRecipesLoaded, savedRecipes, household?.members, user?.profile]);

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="flex gap-2">
        <input
          id="searchQuery"
          name="searchQuery"
          type="text"
          data-testid="mealplanner-search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search for ${mealType} recipes...`}
          className="flex-1 px-4 py-2 bg-theme-secondary border border-theme rounded-lg text-theme-primary placeholder-theme-primary/50 focus:border-[var(--accent-color)] focus:outline-none"
        />
        <button
          onClick={handleSearch}
          data-testid="mealplanner-search-button"
          disabled={isSearching || !searchQuery.trim()}
          className="px-6 py-2 bg-[var(--accent-color)] text-white rounded-lg font-medium hover:bg-[var(--accent-color)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Results — scrolling handled by the overlay's flex-1 container so this area
          fills all remaining vertical space instead of stopping at a fixed height. */}
      <div>
        {isSearching && (
          <div>
            <h4 className="text-sm font-semibold text-theme-secondary mb-2">{intl.formatMessage({ id: 'mealPlanner.searchResults' })}</h4>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <CompactRecipeCardSkeleton key={`search-skeleton-${index}`} />
              ))}
            </div>
          </div>
        )}
        {searchResults.length > 0 && !isSearching && (
          <div>
            <h4 className="text-sm font-semibold text-theme-secondary mb-2">
              {searchResultsSource === 'saved' ? 'Saved Recipes' : 'Recipe Suggestions'}
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {searchResults.map((recipe, index) => (
                <div
                  key={index}
                  className="bg-theme-secondary rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    // Open recipe modal for preview
                    const event = new CustomEvent('openRecipeModal', {
                      detail: { recipe, isSavedView: false, isFromMealPlanner: true }
                    });
                    window.dispatchEvent(event);
                  }}
                >
                  {/* Recipe Image */}
                  <div className="aspect-square bg-theme-primary/20 relative overflow-hidden">
                    {recipe.image ? (
                      <ProgressiveImage src={recipe.image} alt={recipe.title} className="w-full h-full" lazy />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500/10 via-theme-primary to-orange-500/5 dark:from-amber-500/5 dark:to-orange-500/5">
                        <div className="w-8 h-8 rounded-full bg-white/50 dark:bg-black/20 shadow-sm flex items-center justify-center backdrop-blur-sm border border-white/20 dark:border-white/5">
                          <ChefHat className="w-4 h-4 text-amber-600/60 dark:text-amber-400/50" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recipe Info */}
                  <div className="p-2">
                    <h5 className="font-semibold text-xs text-theme-primary line-clamp-2 leading-tight mb-1">{recipe.title}</h5>
                    <div className="flex items-center justify-between text-xs text-theme-secondary opacity-70">
                      <span>{recipe.cookTime}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddRecipe(recipe, dayIndex);
                        }}
                        data-testid={`mealplanner-add-${recipe.id || index}`}
                        className="px-2 py-1 bg-[var(--accent-color)] text-white rounded text-xs hover:bg-[var(--accent-color)]/90"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredSavedRecipes.length > 0 && recipesLoaded && (
          <div>
            <h4 className="text-sm font-semibold text-theme-secondary mb-2">{intl.formatMessage({ id: 'mealPlanner.savedRecipes' })}</h4>
            <div className="grid grid-cols-3 gap-2">
              {filteredSavedRecipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="bg-theme-secondary rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    // Open recipe modal for preview
                    const event = new CustomEvent('openRecipeModal', {
                      detail: { recipe, isSavedView: false, isFromMealPlanner: true }
                    });
                    window.dispatchEvent(event);
                  }}
                >
                  {/* Recipe Image */}
                  <div className="aspect-square bg-theme-primary/20 relative overflow-hidden">
                    {recipe.image ? (
                      <ProgressiveImage src={recipe.image} alt={recipe.title} className="w-full h-full" lazy />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500/10 via-theme-primary to-orange-500/5 dark:from-amber-500/5 dark:to-orange-500/5">
                        <div className="w-8 h-8 rounded-full bg-white/50 dark:bg-black/20 shadow-sm flex items-center justify-center backdrop-blur-sm border border-white/20 dark:border-white/5">
                          <ChefHat className="w-4 h-4 text-amber-600/60 dark:text-amber-400/50" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recipe Info */}
                  <div className="p-2">
                    <h5 className="font-semibold text-xs text-theme-primary line-clamp-2 leading-tight mb-1">{recipe.title}</h5>
                    <div className="flex items-center justify-between text-xs text-theme-secondary opacity-70">
                      <span>{recipe.cookTime}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddRecipe(recipe, dayIndex);
                        }}
                        data-testid={`mealplanner-add-${recipe.id}`}
                        className="px-2 py-1 bg-[var(--accent-color)] text-white rounded text-xs hover:bg-[var(--accent-color)]/90"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!!searchQuery && filteredCachedRecipes.length > 0 && cachedRecipesLoaded && (
          <div>
            <h4 className="text-sm font-semibold text-theme-secondary mb-2">{intl.formatMessage({ id: 'mealPlanner.popularRecipes' })}</h4>
            <div className="grid grid-cols-3 gap-2">
              {filteredCachedRecipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="bg-theme-secondary rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    // Open recipe modal for preview
                    const event = new CustomEvent('openRecipeModal', {
                      detail: { recipe, isSavedView: false, isFromMealPlanner: true }
                    });
                    window.dispatchEvent(event);
                  }}
                >
                  {/* Recipe Image */}
                  <div className="aspect-square bg-theme-primary/20 relative overflow-hidden">
                    {recipe.image ? (
                      <ProgressiveImage src={recipe.image} alt={recipe.title} className="w-full h-full" lazy />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500/10 via-theme-primary to-orange-500/5 dark:from-amber-500/5 dark:to-orange-500/5">
                        <div className="w-8 h-8 rounded-full bg-white/50 dark:bg-black/20 shadow-sm flex items-center justify-center backdrop-blur-sm border border-white/20 dark:border-white/5">
                          <ChefHat className="w-4 h-4 text-amber-600/60 dark:text-amber-400/50" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recipe Info */}
                  <div className="p-2">
                    <h5 className="font-semibold text-xs text-theme-primary line-clamp-2 leading-tight mb-1">{recipe.title}</h5>
                    <div className="flex items-center justify-between text-xs text-theme-secondary opacity-70">
                      <span>{recipe.cookTime}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddRecipe(recipe, dayIndex);
                        }}
                        data-testid={`mealplanner-add-${recipe.id}`}
                        className="px-2 py-1 bg-[var(--accent-color)] text-white rounded text-xs hover:bg-[var(--accent-color)]/90"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isSearching && searchQuery && searchResults.length === 0 && filteredSavedRecipes.length === 0 && filteredCachedRecipes.length === 0 && (
          <div className="text-center py-8 text-theme-primary opacity-50">
            {intl.formatMessage({ id: 'recipes.noResults' })}
          </div>
        )}

        {/* Cached Recipes Section - Show when no search query */}
        {!searchQuery && cachedRecipesLoaded && defaultPopularRecipes.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-theme-secondary mb-2">{intl.formatMessage({ id: 'mealPlanner.popularRecipes' })}</h4>
            <div className="grid grid-cols-3 gap-2">
              {defaultPopularRecipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="bg-theme-secondary rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    // Open recipe modal for preview
                    const event = new CustomEvent('openRecipeModal', {
                      detail: { recipe, isSavedView: false, isFromMealPlanner: true }
                    });
                    window.dispatchEvent(event);
                  }}
                >
                  {/* Recipe Image */}
                  <div className="aspect-square bg-theme-primary/20 relative overflow-hidden">
                    {recipe.image ? (
                      <ProgressiveImage src={recipe.image} alt={recipe.title} className="w-full h-full" lazy />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500/10 via-theme-primary to-orange-500/5 dark:from-amber-500/5 dark:to-orange-500/5">
                        <div className="w-8 h-8 rounded-full bg-white/50 dark:bg-black/20 shadow-sm flex items-center justify-center backdrop-blur-sm border border-white/20 dark:border-white/5">
                          <ChefHat className="w-4 h-4 text-amber-600/60 dark:text-amber-400/50" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recipe Info */}
                  <div className="p-2">
                    <h5 className="font-semibold text-xs text-theme-primary line-clamp-2 leading-tight mb-1">{recipe.title}</h5>
                    <div className="flex items-center justify-between text-xs text-theme-secondary opacity-70">
                      <span>{recipe.cookTime}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddRecipe(recipe, dayIndex);
                        }}
                        data-testid={`mealplanner-add-${recipe.id}`}
                        className="px-2 py-1 bg-[var(--accent-color)] text-white rounded text-xs hover:bg-[var(--accent-color)]/90"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!searchQuery && !cachedRecipesLoaded && (
          <div>
            <h4 className="text-sm font-semibold text-theme-secondary mb-2">{intl.formatMessage({ id: 'mealPlanner.popularRecipes' })}</h4>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <CompactRecipeCardSkeleton key={`cached-skeleton-${index}`} />
              ))}
            </div>
          </div>
        )}

        {!searchQuery && cachedRecipesLoaded && filteredSavedRecipes.length === 0 && defaultPopularRecipes.length === 0 && (
          <div className="text-center py-8 text-theme-primary opacity-50">
            No recipes available — try searching
          </div>
        )}
      </div>
    </div>
  );
};
