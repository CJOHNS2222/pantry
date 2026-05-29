import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { CalendarClock, Plus, ShoppingBasket, Trash2, HelpCircle, Copy, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { DayPlan, MealPlanItem, PantryItem, StructuredRecipe, User, SavedRecipe, ShoppingItem } from '../types';
import RecipeModal from './RecipeModal';
import LeftoverQuickCapture from './LeftoverQuickCapture';
import { MealPrepPlanner } from './MealPrepPlanner';
import { PremiumFeature } from './PremiumFeature';
import { GroceryCostEstimator } from './GroceryCostEstimator';
import { Tab } from '../types/app';
import { searchRecipes as searchRecipesGemini } from '../services/geminiService';
import { getCachedPopularRecipes, getCachedRecipesCache } from '../services/recipeService';
// Firestore access is instrumented via DatabaseMonitoringService when needed
import { parseIngredientForShoppingList } from '../utils/appUtils';
import AnalyticsService from '../services/analyticsService';
import { useIntl } from 'react-intl';
import { useApp } from '../contexts/AppContext';
import { useAppActions } from '../contexts/AppActionsContext';
import { useSubscription } from '../hooks/useSubscription';
import { UsageService } from '../services/usageService';
import type { UsageLimits } from '../services/usageService';
import { searchRecipes } from '../utils/searchUtils';
import { debounce } from '../utils/debounceUtils';
import { log } from '../services/logService';
import { useModalOpen } from '../utils/useModalOpen';
import { useAndroidBack } from '../hooks/useAndroidBack';
import { CompactRecipeCardSkeleton, MealPlanSkeleton } from './SkeletonLoader';
import { ProgressiveImage } from './ProgressiveImage';
import { getMealPrepSuggestions } from '../utils/searchUtils';
import { getUserMeasurementSystem } from '../utils/measurementUtils';
import CalendarService from '../services/calendarService';

// Utility function to generate attractive recipe placeholder images
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const generateRecipePlaceholderImage = (title: string): string => {
  // Create a simple hash from the title for consistent colors
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash) + title.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Generate colors based on hash
  const hue = Math.abs(hash) % 360;
  const saturation = 65 + (Math.abs(hash) % 20); // 65-85%
  const lightness = 45 + (Math.abs(hash) % 15); // 45-60%
  
  // Create SVG with recipe icon
  const svg = `
    <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:hsl(${hue}, ${saturation}%, ${lightness}%);stop-opacity:1" />
          <stop offset="100%" style="stop-color:hsl(${(hue + 30) % 360}, ${saturation}%, ${lightness + 10}%);stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" fill="url(#bg)" rx="8"/>
      <g transform="translate(30, 30)">
        <!-- Recipe icon -->
        <circle cx="30" cy="25" r="8" fill="white" opacity="0.9"/>
        <rect x="22" y="35" width="16" height="8" fill="white" opacity="0.9" rx="2"/>
        <rect x="18" y="45" width="24" height="3" fill="white" opacity="0.7" rx="1"/>
        <rect x="18" y="50" width="20" height="3" fill="white" opacity="0.7" rx="1"/>
        <rect x="18" y="55" width="16" height="3" fill="white" opacity="0.7" rx="1"/>
      </g>
    </svg>
  `;
  
  // Convert to data URL
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

interface MealPlannerProps {
  mealPlan: DayPlan[];
  updateMealPlan: (newPlan: DayPlan[]) => void;
  inventory: PantryItem[];
  shoppingList: ShoppingItem[];
  addToShoppingList: (items: string[], source?: string) => void;
  onAddToPlan?: (recipe: StructuredRecipe, dayIndex?: number, mealType?: 'breakfast' | 'lunch' | 'dinner') => void;
  onSaveRecipe?: (recipe: StructuredRecipe) => void;
  onMarkAsMade?: (recipe: StructuredRecipe) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onRate?: (rating: any) => void;
  user: User;
  setActiveTab: (tab: Tab) => void;
  recipeSaveLimitExceeded?: boolean;
  mealPlanLimitExceeded?: boolean;
  isLoadingMealPlan?: boolean;
  isLoadingSavedRecipes?: boolean;
  savedRecipes?: SavedRecipe[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings?: any;
  onOpenRecipeSearch?: () => void;
}

interface RecipeSearchModalProps {
  mealType: 'breakfast' | 'lunch' | 'dinner';
  dayIndex: number;
  onAddRecipe: (recipe: StructuredRecipe, dayIndex: number) => void;
  onClose: () => void;
  inventory: PantryItem[];
  user: User;
  savedRecipes: SavedRecipe[];
}

const RecipeSearchModal: React.FC<RecipeSearchModalProps> = ({
  mealType,
  dayIndex,
  onAddRecipe,
  inventory,
  user,
  savedRecipes: propSavedRecipes
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
      const cachedResults = searchRecipes(cachedRecipes, searchQuery)
        .filter((recipe, index, self) =>
          index === self.findIndex(r => r.title === recipe.title)
        )
        .filter(recipe => !savedResults.some(saved => saved.title === recipe.title)); // Avoid duplicates

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
      const { userOptedInToGemini } = await import('../services/featureFlags');
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
  }, [searchQuery]);

  const filteredSavedRecipes = useMemo(() => 
    searchRecipes(savedRecipes, searchQuery)
      .filter((recipe, index, self) =>
        index === self.findIndex(r => r.title === recipe.title)
      )
      .filter(recipe => !searchResults.some(searchResult => searchResult.title === recipe.title)),
    [savedRecipes, searchQuery, searchResults]
  );

  const filteredCachedRecipes = useMemo(() => 
    searchRecipes(cachedRecipes, searchQuery)
      .filter((recipe, index, self) =>
        index === self.findIndex(r => r.title === recipe.title)
      )
      .filter(recipe => !filteredSavedRecipes.some(saved => saved.title === recipe.title)) // Avoid duplicates with saved recipes
      .filter(recipe => !searchResults.some(searchResult => searchResult.title === recipe.title)), // Avoid duplicates with search results
    [cachedRecipes, searchQuery, searchResults, filteredSavedRecipes]
  );

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

      {/* Results */}
      <div className="max-h-96 overflow-y-auto">
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
                      detail: { recipe, isSavedView: false }
                    });
                    window.dispatchEvent(event);
                  }}
                >
                  {/* Recipe Image */}
                  <div className="aspect-square bg-theme-primary/20 relative overflow-hidden">
                    {recipe.image ? (
                      <ProgressiveImage src={recipe.image} alt={recipe.title} className="w-full h-full" lazy />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-theme-primary/10" />
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
                      detail: { recipe, isSavedView: false }
                    });
                    window.dispatchEvent(event);
                  }}
                >
                  {/* Recipe Image */}
                  <div className="aspect-square bg-theme-primary/20 relative overflow-hidden">
                    {recipe.image ? (
                      <ProgressiveImage src={recipe.image} alt={recipe.title} className="w-full h-full" lazy />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-theme-primary/10" />
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

        {filteredCachedRecipes.length > 0 && cachedRecipesLoaded && (
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
                      detail: { recipe, isSavedView: false }
                    });
                    window.dispatchEvent(event);
                  }}
                >
                  {/* Recipe Image */}
                  <div className="aspect-square bg-theme-primary/20 relative overflow-hidden">
                    {recipe.image ? (
                      <ProgressiveImage src={recipe.image} alt={recipe.title} className="w-full h-full" lazy />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-theme-primary/10" />
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
        {!searchQuery && cachedRecipesLoaded && cachedRecipes.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-theme-secondary mb-2">{intl.formatMessage({ id: 'mealPlanner.popularRecipes' })}</h4>
            <div className="grid grid-cols-3 gap-2">
              {cachedRecipes.slice(0, 12).map((recipe) => (
                <div
                  key={recipe.id}
                  className="bg-theme-secondary rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    // Open recipe modal for preview
                    const event = new CustomEvent('openRecipeModal', {
                      detail: { recipe, isSavedView: false }
                    });
                    window.dispatchEvent(event);
                  }}
                >
                  {/* Recipe Image */}
                  <div className="aspect-square bg-theme-primary/20 relative overflow-hidden">
                    {recipe.image ? (
                      <ProgressiveImage src={recipe.image} alt={recipe.title} className="w-full h-full" lazy />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-theme-primary/10" />
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

        {!searchQuery && cachedRecipesLoaded && cachedRecipes.length === 0 && (
          <div className="text-center py-8 text-theme-primary opacity-50">
            No popular recipes available
          </div>
        )}

        {!searchQuery && (
          <div className="text-center py-8 text-theme-primary opacity-50">
            Enter a search term to find recipes
          </div>
        )}
      </div>
    </div>
  );
};

export const MealPlanner: React.FC<MealPlannerProps> = ({ mealPlan, updateMealPlan, inventory, shoppingList, addToShoppingList, onAddToPlan, onSaveRecipe, onMarkAsMade, onRate, user, setActiveTab, recipeSaveLimitExceeded = false, mealPlanLimitExceeded = false, isLoadingMealPlan = false, savedRecipes: propSavedRecipes = [], settings }) => {
  const { addToast } = useAppActions();
  const intl = useIntl();
  const { household } = useApp();
  const { isPremium, isFamily } = useSubscription(user);
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);
  useEffect(() => {
    if (!user) return;
    UsageService.getUsageLimits(user).then(setUsageLimits).catch(() => {});
  }, [user?.id]);
  const canUseTwoWeekPlanning = usageLimits?.mealPlanning.twoWeekPlanning ?? (isPremium || isFamily);
    // List of staple items to ignore (unless user wants them included)
    const STAPLES = ['salt', 'pepper', 'oil', 'water', 'flour', 'sugar', 'butter', 'vinegar', 'baking powder', 'baking soda', 'spices', 'seasoning', 'soy sauce', 'cornstarch', 'yeast'];
    const includeStaples = settings?.shopping?.includeStaples || false;
  const [draggedMeal, setDraggedMeal] = useState<{ dayIndex: number, mealType: string, mealIndex: number } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [dragOverMealType, setDragOverMealType] = useState<{ dayIndex: number, mealType: string } | null>(null);
  const [missingItemsCount, setMissingItemsCount] = useState(0);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [modalRecipe, setModalRecipe] = useState<StructuredRecipe | null>(null);
  const [modalContext, setModalContext] = useState<'search' | 'scheduled'>('search');
  const [showHelpTooltip, setShowHelpTooltip] = useState(false);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [isEstimatorOpen, setIsEstimatorOpen] = useState(false);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date());

  // Use prop savedRecipes or local state as fallback
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [localSavedRecipes, setLocalSavedRecipes] = useState<SavedRecipe[]>([]);
  const savedRecipes = propSavedRecipes.length > 0 ? propSavedRecipes : localSavedRecipes;

  const [isDragging, setIsDragging] = useState(false);
  const [dragOverTrash, setDragOverTrash] = useState(false);
  const [showRecipeSearch, setShowRecipeSearch] = useState(false);
  const [searchMealType, setSearchMealType] = useState<'breakfast' | 'lunch' | 'dinner' | null>(null);
  const [showMealPrepPlanner, setShowMealPrepPlanner] = useState(false);
  const [showAddMealDialog, setShowAddMealDialog] = useState(false);
  const [selectedDayForDialog, setSelectedDayForDialog] = useState<number | null>(null);
  const [pendingRecipe, setPendingRecipe] = useState<StructuredRecipe | null>(null);
  const [showLeftoverPrompt, setShowLeftoverPrompt] = useState(false);
  const [showLeftoverCapture, setShowLeftoverCapture] = useState(false);
  const [leftoverServings, setLeftoverServings] = useState<number>(1);
  const [leftoverNotes, setLeftoverNotes] = useState<string>('');
  const [showLeftoverSwapModal, setShowLeftoverSwapModal] = useState(false);
  const [swapSource, setSwapSource] = useState<{ dayIndex: number; mealType: 'breakfast' | 'lunch' | 'dinner'; mealIndex: number } | null>(null);

  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['TodaysMeals']));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  useModalOpen(showRecipeSearch || showAddMealDialog || showLeftoverPrompt || showLeftoverCapture || showLeftoverSwapModal);

  // Android back-button registration for all MealPlanner modals
  useAndroidBack(showRecipeModal, () => setShowRecipeModal(false));
  useAndroidBack(showRecipeSearch, () => setShowRecipeSearch(false));
  useAndroidBack(showMealPrepPlanner, () => setShowMealPrepPlanner(false));
  useAndroidBack(showAddMealDialog, () => setShowAddMealDialog(false));
  useAndroidBack(showLeftoverPrompt, () => setShowLeftoverPrompt(false));
  useAndroidBack(showLeftoverCapture, () => setShowLeftoverCapture(false));
  useAndroidBack(showLeftoverSwapModal, () => setShowLeftoverSwapModal(false));

  // Check if a day has any meals scheduled
  const hasMealsScheduled = useCallback((dayIndex: number) => {
    const day = mealPlan[dayIndex];
    if (!day) return false;
    return (day.breakfast?.length || 0) > 0 || 
           (day.lunch?.length || 0) > 0 || 
           (day.dinner?.length || 0) > 0;
  }, [mealPlan]);

  // Wrapper for onAddToPlan that shows day/meal selection dialog
  const handleAddToPlan = (recipe: StructuredRecipe) => {
    setPendingRecipe(recipe);
    setShowAddMealDialog(true);
  };

  // Actually add the recipe to the plan
  const confirmAddToPlan = (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner') => {
    if (pendingRecipe && onAddToPlan) {
      onAddToPlan(pendingRecipe, dayIndex, mealType);
      setPendingRecipe(null);
      setShowAddMealDialog(false);
    }
  };

  // Load saved recipes when meal prep planner opens
  useEffect(() => {
    // No longer need to load recipes since we use prop savedRecipes
  }, [showMealPrepPlanner, propSavedRecipes.length]);

  // Calculate meal prep suggestions based on current pantry
  const mealPrepSuggestions = useMemo(() => {
    if (savedRecipes.length === 0 || inventory.length === 0) return [];
    return getMealPrepSuggestions(savedRecipes, inventory, 60); // 60% match minimum
  }, [savedRecipes, inventory]);

  // Load saved recipes for meal prep suggestions on component mount (only if no prop recipes)
  useEffect(() => {
    // No longer need to load recipes since we use prop savedRecipes
  }, [propSavedRecipes.length]);

  // Close help tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showHelpTooltip && !(event.target as Element).closest('.help-tooltip-container')) {
        setShowHelpTooltip(false);
      }
    };

    if (showHelpTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showHelpTooltip]);

  // Auto-scroll functionality during drag
  useEffect(() => {
    let scrollInterval: NodeJS.Timeout | null = null;

    const handleDragOver = (e: DragEvent) => {
      if (!isDragging) return;

      const scrollZone = 100; // pixels from top/bottom to trigger scroll
      const scrollSpeed = 8; // pixels per frame

      // Clear existing interval
      if (scrollInterval) {
        clearInterval(scrollInterval);
        scrollInterval = null;
      }

      // Check if near top or bottom of viewport
      const viewportHeight = window.innerHeight;
      const mouseY = e.clientY;

      if (mouseY < scrollZone) {
        // Scroll up
        scrollInterval = setInterval(() => {
          window.scrollBy(0, -scrollSpeed);
        }, 16); // ~60fps
      } else if (mouseY > viewportHeight - scrollZone) {
        // Scroll down
        scrollInterval = setInterval(() => {
          window.scrollBy(0, scrollSpeed);
        }, 16);
      }
    };

    const handleDragEnd = () => {
      if (scrollInterval) {
        clearInterval(scrollInterval);
        scrollInterval = null;
      }
      setIsDragging(false);
      setDragOverDay(null);
      setDragOverMealType(null);
    };

    if (isDragging) {
      document.addEventListener('dragover', handleDragOver);
      document.addEventListener('dragend', handleDragEnd);
      document.addEventListener('drop', handleDragEnd);
    }

    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragend', handleDragEnd);
      document.removeEventListener('drop', handleDragEnd);
      if (scrollInterval) {
        clearInterval(scrollInterval);
      }
    };
  }, [isDragging]);

  // Handle recipe modal opening from search tiles
  useEffect(() => {
    const handleOpenRecipeModal = (event: CustomEvent) => {
      const { recipe } = event.detail;
      setModalRecipe(recipe);
      setModalContext('search');
      setShowRecipeModal(true);
    };

    window.addEventListener('openRecipeModal', handleOpenRecipeModal as EventListener);

    return () => {
      window.removeEventListener('openRecipeModal', handleOpenRecipeModal as EventListener);
    };
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDragStart = (e: React.DragEvent, dayIndex: number, mealType: string, mealIndex: number) => {
    setDraggedMeal({ dayIndex, mealType, mealIndex });
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";
    // Add some visual feedback
    e.dataTransfer.setData('text/plain', `${dayIndex}-${mealType}-${mealIndex}`);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDragEnd = () => {
    setDraggedMeal(null);
    setDragOverDay(null);
    setDragOverMealType(null);
    setDragOverTrash(false);
    setIsDragging(false);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDragOver = (e: React.DragEvent, dayIndex?: number, mealType?: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dayIndex !== undefined) {
      setDragOverDay(dayIndex);
      if (mealType) {
        setDragOverMealType({ dayIndex, mealType });
      } else {
        setDragOverMealType(null);
      }
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear drag over if we're actually leaving the drop zone
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverDay(null);
      setDragOverMealType(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetDayIndex: number, targetMealType?: string, isTrash?: boolean) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedMeal) return;

    if (isTrash) {
      // Remove meal from plan
      const newPlan = [...mealPlan];
      const sourceMealType = draggedMeal.mealType as 'breakfast' | 'lunch' | 'dinner';
      
      if (!newPlan[draggedMeal.dayIndex][sourceMealType]) newPlan[draggedMeal.dayIndex][sourceMealType] = [];
      newPlan[draggedMeal.dayIndex][sourceMealType] = newPlan[draggedMeal.dayIndex][sourceMealType].filter((_, i) => i !== draggedMeal.mealIndex);
      
      updateMealPlan(newPlan);
      setDraggedMeal(null);
      return;
    }

    const sourceDay = mealPlan[draggedMeal.dayIndex];
    const sourceMealType = draggedMeal.mealType as 'breakfast' | 'lunch' | 'dinner';
    
    // Initialize arrays if they don't exist
    if (!sourceDay[sourceMealType]) sourceDay[sourceMealType] = [];
    
    const mealToMove = sourceDay[sourceMealType][draggedMeal.mealIndex];

    if (!mealToMove) return;

    const newPlan = [...mealPlan];

    // Initialize target arrays if they don't exist
    if (!newPlan[targetDayIndex].breakfast) newPlan[targetDayIndex].breakfast = [];
    if (!newPlan[targetDayIndex].lunch) newPlan[targetDayIndex].lunch = [];
    if (!newPlan[targetDayIndex].dinner) newPlan[targetDayIndex].dinner = [];

    // Remove meal from source
    newPlan[draggedMeal.dayIndex][sourceMealType] = newPlan[draggedMeal.dayIndex][sourceMealType].filter((_, i) => i !== draggedMeal.mealIndex);

    // Add meal to target location
    if (targetMealType) {
      const targetArray = targetMealType as 'breakfast' | 'lunch' | 'dinner';
      newPlan[targetDayIndex][targetArray].push(mealToMove);
    } else {
      // If no specific target, add to breakfast as default
      newPlan[targetDayIndex].breakfast.push(mealToMove);
    }

    updateMealPlan(newPlan);
    setDraggedMeal(null);
    setDragOverDay(null);
    setDragOverMealType(null);
    setIsDragging(false);
  };

  const handleAddMissingToShopping = () => {
    const missing = missingIngredients;
    if (missing.length > 0) {
      const itemsToAdd = missing.flatMap((item: { ingredient: string; quantity: number; unit: string; recipes: { name: string; id: string }[] }) => 
        item.recipes.map(recipe => ({
          ingredient: item.unit === 'count' 
            ? `${item.quantity} ${item.ingredient}` 
            : `${item.quantity} ${item.unit} ${item.ingredient}`,
          source: `recipe: need ${item.quantity} ${item.unit} for "${recipe.name}"`
        }))
      );
      
      // Batch add all items at once
      const allIngredients = itemsToAdd.map(item => item.ingredient);
      const batchSource = `meal plan: ${missing.length} missing ingredients for planned meals`;
      addToShoppingList(allIngredients, batchSource);
      addToast(`Added ${missing.length} item${missing.length > 1 ? 's' : ''} to your shopping list`, 'success');
    }
  };

  const removeMeal = (dayIndex: number, mealType: string, mealIndex: number) => {
      const newPlan = [...mealPlan];
      const mealTypeKey = mealType as 'breakfast' | 'lunch' | 'dinner';
      if (!newPlan[dayIndex][mealTypeKey]) newPlan[dayIndex][mealTypeKey] = [];
      
      // Track analytics before removing
      const mealToRemove = newPlan[dayIndex][mealTypeKey][mealIndex];
      if (mealToRemove) {
        AnalyticsService.trackMealPlanRemove(mealToRemove.recipe.id || mealToRemove.recipe.title, mealToRemove.recipe.title, mealType);
      }
      
      newPlan[dayIndex][mealTypeKey] = newPlan[dayIndex][mealTypeKey].filter((_, i) => i !== mealIndex);
      updateMealPlan(newPlan);
  };

  const handleCookedIt = (meal: MealPlanItem) => {
    if (onMarkAsMade) {
      onMarkAsMade(meal.recipe as StructuredRecipe);
    }
    const suggestedServings = typeof meal.recipe?.servings === 'number' && meal.recipe.servings > 0 ? meal.recipe.servings : 2;
    setLeftoverServings(Math.max(1, Math.min(6, suggestedServings)));
    setLeftoverNotes(meal.recipe?.title || 'Leftover');
    setShowLeftoverPrompt(true);
    AnalyticsService.logEvent('leftover_prompt_opened_from_mealplanner', {
      recipe_title: meal.recipe?.title,
      household_id: household?.id,
    });
  };

  const leftovers = useMemo(() => {
    return (inventory || []).filter(item => item.is_leftover)
  }, [inventory]);

  const handleOpenSwapWithLeftover = (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner', mealIndex: number) => {
    setSwapSource({ dayIndex, mealType, mealIndex });
    setShowLeftoverSwapModal(true);
  };

  const handleSwapWithLeftover = (leftoverItem: PantryItem) => {
    if (!swapSource) return;

    const newPlan = [...mealPlan];
    const { dayIndex, mealType, mealIndex } = swapSource;
    const existingMeal = newPlan[dayIndex][mealType][mealIndex];

    const leftoverRecipe: StructuredRecipe = {
      id: `leftover-${leftoverItem.id}`,
      title: `Leftover: ${leftoverItem.item}`,
      description: 'Scheduled from leftovers',
      ingredients: [leftoverItem.item],
      instructions: [
        'Take from fridge/freezer and heat safely.',
        'Consume before computed best-before date.'
      ],
      cookTime: '10 mins',
      servings: typeof leftoverItem.leftoverMeta?.servings === 'number' ? leftoverItem.leftoverMeta?.servings : undefined,
      tags: ['leftover']
    };

    newPlan[dayIndex][mealType][mealIndex] = {
      id: `swap-${Date.now()}`,
      mealType,
      recipe: leftoverRecipe,
    };

    const pushForward = true; // default: push meal forward to avoid conflicts
    if (pushForward && existingMeal) {
      const targetDayIndex = (dayIndex + 1) % newPlan.length;
      if (!newPlan[targetDayIndex][mealType]) newPlan[targetDayIndex][mealType] = [];
      newPlan[targetDayIndex][mealType].push(existingMeal);
    }

    updateMealPlan(newPlan);
    setShowLeftoverSwapModal(false);
    setSwapSource(null);

    AnalyticsService.logEvent('meal_swapped_with_leftover', {
      leftover_id: leftoverItem.id,
      leftover_name: leftoverItem.item,
      source_day: dayIndex,
      source_meal_type: mealType,
      household_id: household?.id,
    });
  };

  // Helper function to check if a day is today
  const isToday = (dateString: string) => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const todayLocal = `${yyyy}-${mm}-${dd}`;
    return dateString === todayLocal;
  };

  // Get today's meals for highlighting
  const todaysMeals = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const todayLocal = `${yyyy}-${mm}-${dd}`;

    const todayPlan = mealPlan.find(day => day.date === todayLocal);
    if (!todayPlan) return [];

    // Preserve explicit mealType on each MealPlanItem instead of inferring
    const items = [
      ...(todayPlan.breakfast || []).map(item => ({ ...item, mealType: 'breakfast' })),
      ...(todayPlan.lunch || []).map(item => ({ ...item, mealType: 'lunch' })),
      ...(todayPlan.dinner || []).map(item => ({ ...item, mealType: 'dinner' })),
    ];

    return items;
  }, [mealPlan]);

  // Display plan rotated to start on today's date. When today's date isn't
  // present in the saved `mealPlan`, build a 7-day view starting from today
  // and map display indexes back to the original mealPlan indexes.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { displayPlan, displayToOriginal } = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const todayLocal = `${yyyy}-${mm}-${dd}`;

    // Filter out invalid or corrupted dates (more than 1 year in past/future)
    const validMealPlan = mealPlan.filter(day => {
      if (!day.date || typeof day.date !== 'string') return false;
      try {
        const dayDate = new Date(day.date);
        const diffTime = Math.abs(dayDate.getTime() - d.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 365; // Within 1 year
      } catch {
        return false;
      }
    });

    const idx = validMealPlan.findIndex(day => day.date === todayLocal);
    if (idx >= 0) {
      const rotated = [...validMealPlan.slice(idx), ...validMealPlan.slice(0, idx)];
      const mapping = rotated.map((_, i) => {
        const originalIdx = (i + idx) % validMealPlan.length;
        return validMealPlan[originalIdx] ? mealPlan.indexOf(validMealPlan[originalIdx]) : -1;
      });
      return { displayPlan: rotated, displayToOriginal: mapping };
    }

    // Build a 7-day view starting today
    const view: DayPlan[] = [];
    const mapping: number[] = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date();
      dt.setDate(d.getDate() + i);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const da = String(dt.getDate()).padStart(2, '0');
      const iso = `${y}-${m}-${da}`;
      const dayName = dt.toLocaleDateString(undefined, { weekday: 'short' });
      view.push({ date: iso, dayName, breakfast: [], lunch: [], dinner: [] } as DayPlan);
      mapping.push(-1); // No original mapping for fallback days
    }
    return { displayPlan: view, displayToOriginal: mapping };
  }, [mealPlan]);

  // Ensure all displayPlan days exist in mealPlan
  useEffect(() => {
    if (displayPlan.length > 0) {
      let needsUpdate = false;
      const newPlan = [...mealPlan];
      
      for (const day of displayPlan) {
        const existingIndex = newPlan.findIndex(d => d.date === day.date);
        if (existingIndex === -1) {
          newPlan.push({
            date: day.date,
            dayName: day.dayName,
            breakfast: [],
            lunch: [],
            dinner: []
          });
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        updateMealPlan(newPlan);
      }
    }
  }, [displayPlan, mealPlan, updateMealPlan]);

  const handleClearWeek = useCallback(() => {
    const weekStart = Math.floor(currentDayIndex / 7) * 7;
    const weekDates = new Set(
      displayPlan.slice(weekStart, weekStart + 7).map(d => d.date)
    );
    const cleared = mealPlan.map(day =>
      weekDates.has(day.date)
        ? { ...day, breakfast: [], lunch: [], dinner: [] }
        : day
    );
    updateMealPlan(cleared);
  }, [currentDayIndex, displayPlan, mealPlan, updateMealPlan]);

  const handleCopyWeek = useCallback(() => {
    const weekStart = Math.floor(currentDayIndex / 7) * 7;
    const sourceDays = displayPlan.slice(weekStart, weekStart + 7);
    const updated = mealPlan.map(day => {
      const srcDay = sourceDays.find(s => {
        const srcDate = new Date(s.date);
        srcDate.setDate(srcDate.getDate() + 7);
        return srcDate.toISOString().slice(0, 10) === day.date;
      });
      if (!srcDay) return day;
      return {
        ...day,
        breakfast: [...srcDay.breakfast],
        lunch: [...srcDay.lunch],
        dinner: [...srcDay.dinner],
      };
    });
    updateMealPlan(updated);
  }, [currentDayIndex, displayPlan, mealPlan, updateMealPlan]);

  const handleExportCalendar = useCallback(async () => {
    const weekStart = Math.floor(currentDayIndex / 7) * 7;
    const weekDays = displayPlan.slice(weekStart, weekStart + 7);
    const daysWithMeals = weekDays.filter(
      d => (d.breakfast?.length || 0) + (d.lunch?.length || 0) + (d.dinner?.length || 0) > 0
    );
    if (daysWithMeals.length === 0) {
      addToast('No meals planned this week to export.', 'info');
      return;
    }
    try {
      await CalendarService.exportWeekAsICS(daysWithMeals);
      addToast('Meal plan exported to calendar!', 'success');
    } catch {
      addToast('Failed to export calendar. Please try again.', 'error');
    }
  }, [currentDayIndex, displayPlan, addToast]);

  // Memoized missing ingredients computation
  const missingIngredients = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayLocal = `${yyyy}-${mm}-${dd}`;

    const missingWithRecipes = displayPlan
      .filter(day => day.date >= todayLocal)
      .flatMap(day => 
        [...(day.breakfast || []), ...(day.lunch || []), ...(day.dinner || [])].flatMap(meal => 
          meal.recipe.ingredients.map(ingredient => ({
            ingredient,
            recipeName: meal.recipe.title,
            recipeId: meal.recipe.id
          }))
        )
      );
    
    // Filter out staple items and duplicates (unless user wants staples included)
    const missing = missingWithRecipes.filter(item => {
      const neededLower = item.ingredient.toLowerCase();
      if (!includeStaples && STAPLES.some(staple => neededLower.includes(staple))) return false;
      
      // Check if ingredient is already in inventory
      const inInventory = inventory.some(pantryItem => 
        neededLower.includes(pantryItem.item.toLowerCase()) || 
        pantryItem.item.toLowerCase().includes(neededLower)
      );
      
      // Check if ingredient is already in shopping list
      const inShoppingList = shoppingList.some(shoppingItem => 
        neededLower.includes(shoppingItem.item.toLowerCase()) || 
        shoppingItem.item.toLowerCase().includes(neededLower)
      );
      
      return !inInventory && !inShoppingList;
    });

    // Group by ingredient and aggregate quantities
    const grouped = missing.reduce((acc, item) => {
      const parsed = parseIngredientForShoppingList(item.ingredient);
      const key = parsed.itemName;
      
      if (!acc[key]) {
        // Extract unit from quantity string more intelligently
        let unit = 'count';
        const qtyParts = parsed.quantity.split(' ');
        
        if (qtyParts.length > 1) {
          // Check if the second part looks like a unit
          const potentialUnit = qtyParts[1].toLowerCase();
          const commonUnits = ['tbs', 'tbsp', 'tsp', 'cup', 'cups', 'oz', 'ounce', 'lb', 'pound', 'g', 'gram', 'kg', 'liter', 'l', 'ml', 'clove', 'cloves', 'bunch', 'bunches', 'sprig', 'sprigs', 'head', 'heads', 'stalk', 'stalks', 'slice', 'slices', 'piece', 'pieces'];
          
          if (commonUnits.includes(potentialUnit) || potentialUnit.endsWith('s')) {
            unit = potentialUnit;
          } else if (parsed.quantity.match(/\d+\s*(g|kg|ml|l|oz|lb)$/i)) {
            // Handle cases like "200g" where unit is attached to number
            const unitMatch = parsed.quantity.match(/\d+\s*(g|kg|ml|l|oz|lb)$/i);
            if (unitMatch) {
              unit = unitMatch[1].toLowerCase();
            }
          }
        } else if (parsed.quantity.match(/\d+(g|kg|ml|l|oz|lb)$/i)) {
          // Handle cases like "200g" without space
          const unitMatch = parsed.quantity.match(/\d+(g|kg|ml|l|oz|lb)$/i);
          if (unitMatch) {
            unit = unitMatch[1].toLowerCase();
          }
        }
        
        acc[key] = {
          ingredient: parsed.itemName,
          quantity: 0, // Will be calculated
          unit: unit,
          recipes: []
        };
      }
      
      // Add quantity (parse numeric value, handling fractions)
      let qtyValue = 1;
      const qtyStr = parsed.quantity.split(' ')[0];
      
      if (qtyStr.includes('/')) {
        // Handle fractions like "1/2"
        const [numerator, denominator] = qtyStr.split('/').map(Number);
        qtyValue = numerator / denominator;
      } else {
        qtyValue = parseFloat(qtyStr) || 1;
      }
      
      acc[key].quantity += qtyValue;
      
      // Track recipes
      if (!acc[key].recipes.some(r => r.id === item.recipeId)) {
        acc[key].recipes.push({ name: item.recipeName, id: item.recipeId ?? '' });
      }
      return acc;
    }, {} as Record<string, { ingredient: string; quantity: number; unit: string; recipes: { name: string; id: string }[] }>);

    // Format quantities back to strings
    Object.values(grouped).forEach(item => {
      if (item.unit === 'count' && item.quantity % 1 === 0) {
        // Keep as number for count items
      }
      // For other units, keep as number for now, will format when displaying
    });

    return Object.values(grouped);
  }, [displayPlan, inventory, shoppingList, includeStaples]);

  // Initialize current day to today when displayPlan is available
  useEffect(() => {
    if (displayPlan.length > 0) {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const today = `${yyyy}-${mm}-${dd}`;
      
      // Always ensure we're showing today by default
      if (!isCalendarExpanded) {
        // In compact week view, today should be at index 0
        if (currentDayIndex !== 0) {
          setCurrentDayIndex(0);
        }
      } else {
        // In expanded month view, find today's position
        const todayIndex = displayPlan.findIndex(day => day.date === today);
        if (todayIndex >= 0 && todayIndex !== currentDayIndex) {
          setCurrentDayIndex(todayIndex);
        } else if (currentDayIndex >= displayPlan.length) {
          setCurrentDayIndex(0);
        }
      }
    }
  }, [displayPlan, isCalendarExpanded]); // Removed currentDayIndex from deps to prevent loops

  useEffect(() => {
    setMissingItemsCount(missingIngredients.length);
  }, [missingIngredients]);

  // Ensure a DayPlan exists in the canonical mealPlan for a given date.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const ensureDayExists = useCallback((dateIso: string, dayName?: string) => {
    const idx = mealPlan.findIndex(d => d.date === dateIso);
    if (idx >= 0) return idx;
    const newDay: DayPlan = { date: dateIso, dayName: dayName || dateIso, breakfast: [], lunch: [], dinner: [] };
    const newPlan = [...mealPlan, newDay];
    updateMealPlan(newPlan);
    return newPlan.length - 1;
  }, [mealPlan, updateMealPlan]);

  return (
    <div className="space-y-6 pb-24 animate-fade-in">
      <div className="mb-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1" />
          <h2 className="text-3xl font-serif font-bold text-theme-secondary">{intl.formatMessage({ id: 'mealPlanner.mealSchedule' })}</h2>
          <div className="flex-1 flex items-center justify-end gap-1">
            <button
              onClick={() => setShowMealPrepPlanner(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 active:bg-[var(--accent-color)]/80 text-white text-sm font-medium transition-colors shadow-sm"
              title="Smart Meal Prep Planner"
              aria-label="Open meal prep planner"
            >
              <CalendarClock className="w-4 h-4" />
              <span>Meal Prep</span>
            </button>
            <button
              onClick={() => setShowHelpTooltip(!showHelpTooltip)}
              className="p-2 rounded-full hover:bg-theme-secondary/10 transition-colors"
              title="Help"
              aria-label="Show meal planning help"
            >
              <HelpCircle className="w-5 h-5 text-theme-secondary opacity-60 hover:opacity-100" />
            </button>
          </div>
        </div>

        {/* Help Tooltip */}
        {showHelpTooltip && (
          <div className="help-tooltip-container mt-4 p-4 bg-theme-secondary/5 border border-theme-secondary/20 rounded-lg text-left max-w-md mx-auto">
            <h3 className="font-semibold text-theme-secondary mb-2">How to use Meal Planner:</h3>
            <ul className="text-sm text-theme-secondary space-y-1">
              <li>• <strong>Click any day</strong> to search for recipes to add</li>
              <li>• <strong>Drag & drop</strong> meals between days to reschedule</li>
              <li>• <strong>Drag to trash</strong> (bottom right) to remove meals</li>
              <li>• <strong>Click meals</strong> to view recipe details</li>
            </ul>
          </div>
        )}
      </div>

      <PremiumFeature
        feature="mealPlanning"
        user={user}
        limit={10}
        currentCount={(() => {
          const now = new Date();
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          weekStart.setHours(0, 0, 0, 0);
          // Only count entries in the current week or future weeks — past entries
          // should never count against the user's quota.
          return mealPlan
            .filter(day => new Date(day.date) >= weekStart)
            .reduce((total, day) => total + (day.breakfast?.length || 0) + (day.lunch?.length || 0) + (day.dinner?.length || 0), 0);
        })()}
        fallbackMessage="Upgrade to Premium to plan more than 10 meals per week"
        onUpgrade={() => setActiveTab(Tab.SETTINGS)}
      >
        <button 
          onClick={handleAddMissingToShopping}
          disabled={missingItemsCount === 0}
          className={`w-full border font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 mb-6 ${
              missingItemsCount > 0 
              ? 'bg-theme-secondary border-[var(--accent-color)] text-[var(--accent-color)] shadow-lg' 
              : 'opacity-50 cursor-not-allowed border-theme'
          }`}
        >
          <ShoppingBasket className="w-5 h-5" />
          {missingItemsCount > 0 ? `Add ${missingItemsCount} Missing Items to List` : "Pantry is Stocked"}
        </button>

        <div className={`flex gap-4 ${isEstimatorOpen ? 'flex-col' : ''}`}>
          {(settings?.shopping?.showPriceData ?? false) && (
            <div className={isEstimatorOpen ? 'w-full' : 'flex-1'}>
              <GroceryCostEstimator 
                mealPlan={mealPlan} 
                inventory={inventory} 
                onEstimatorToggle={setIsEstimatorOpen}
                freeItemLimit={isPremium || isFamily ? undefined : 5}
              />
            </div>
          )}

        </div>

        {/* Today's Meals Highlight */}
        {todaysMeals.length > 0 && (
          <div className="bg-gradient-to-r from-[var(--accent-color)]/10 to-[var(--accent-color)]/5 border border-[var(--accent-color)]/20 rounded-xl p-4 mb-4">
            <div
              onClick={() => todaysMeals.length > 1 && toggleSection('TodaysMeals')}
              className={`flex items-center gap-2 mb-3 ${todaysMeals.length > 1 ? 'cursor-pointer' : ''}`}
            >
              <CalendarClock className="w-5 h-5 text-[var(--accent-color)]" />
              <h3 className="font-semibold text-theme-primary">Today's Meals</h3>
              {todaysMeals.length > 1 && (
                <span className="text-xs bg-[var(--accent-color)]/20 text-[var(--accent-color)] px-2 py-1 rounded-full ml-auto">
                  {todaysMeals.length} meals
                </span>
              )}
              {todaysMeals.length > 1 && (
                expandedSections.has('TodaysMeals') ? (
                  <ChevronDown className="w-4 h-4 text-theme-secondary ml-2" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-theme-secondary ml-2" />
                )
              )}
            </div>
            {expandedSections.has('TodaysMeals') && (
              <div className="space-y-2">
                {todaysMeals.map((meal) => (
                  <div
                    key={meal.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setModalRecipe(meal.recipe);
                      setModalContext('scheduled');
                      setShowRecipeModal(true);
                    }}
                    className="bg-theme-secondary/80 backdrop-blur-sm border border-[var(--accent-color)]/30 rounded-lg p-4 cursor-pointer hover:bg-theme-secondary transition-all hover:shadow-md w-full"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-[var(--accent-color)] mb-1 uppercase">
                          {meal.mealType ? (meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1)) : 'Meal'}
                        </div>
                        <div className="text-sm font-medium text-theme-primary">
                          {meal.recipe.title}
                        </div>
                      </div>
                      <div className="text-xs text-theme-secondary opacity-60 ml-4 flex-shrink-0">
                        Click to view recipe
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Meal Prep Suggestions */}
        {mealPrepSuggestions.length > 0 && (
          <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingBasket className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-theme-primary">Meal Prep Suggestions</h3>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                {mealPrepSuggestions.length} recipes
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {mealPrepSuggestions.slice(0, 6).map((suggestion, index) => (
                <div
                  key={index}
                  className="bg-theme-secondary/80 backdrop-blur-sm border border-green-500/30 rounded-lg p-3 cursor-pointer hover:bg-theme-secondary transition-all hover:shadow-md"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-semibold text-theme-primary truncate flex-1">
                      {suggestion.recipe.title}
                    </h4>
                    {suggestion.canMake && (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full ml-2 flex-shrink-0">
                        Ready!
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-theme-secondary mb-2">
                    {suggestion.availableIngredients}/{suggestion.totalIngredients} ingredients available
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalRecipe(suggestion.recipe);
                        setModalContext('search');
                        setShowRecipeModal(true);
                        AnalyticsService.trackEvent('meal_prep_view_recipe', {
                          recipe_title: suggestion.recipe.title,
                          match_percentage: suggestion.matchPercentage,
                          available_ingredients: suggestion.availableIngredients,
                          total_ingredients: suggestion.totalIngredients,
                          can_make: suggestion.canMake
                        });
                      }}
                      className="flex-1 text-xs bg-[var(--accent-color)] text-white px-2 py-1 rounded hover:bg-[var(--accent-color)]/90 transition-colors"
                    >
                      View Recipe
                    </button>
                    {suggestion.missingIngredients.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const missingItems = suggestion.missingIngredients
                            .filter(match => !match.available)
                            .map(match => match.ingredient);
                          if (missingItems.length > 0) {
                            addToShoppingList(missingItems);
                            AnalyticsService.trackEvent('meal_prep_add_missing_ingredients', {
                              recipe_title: suggestion.recipe.title,
                              missing_count: missingItems.length,
                              total_ingredients: suggestion.totalIngredients
                            });
                          }
                        }}
                        className="text-xs bg-theme-secondary border border-theme px-2 py-1 rounded hover:bg-theme-primary transition-colors"
                        title={`Add ${suggestion.missingIngredients.length} missing ingredients to shopping list`}
                      >
                        +{suggestion.missingIngredients.length}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {mealPrepSuggestions.length > 6 && (
              <div className="text-center mt-3">
                <button
                  onClick={() => setShowMealPrepPlanner(true)}
                  className="text-sm text-[var(--accent-color)] hover:underline"
                >
                  View all {mealPrepSuggestions.length} suggestions →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Loading state */}
        {isLoadingMealPlan ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 7 }).map((_, index) => (
                <MealPlanSkeleton key={`loading-${index}`} />
              ))}
            </div>
          </div>
        ) : (
          /* Single Day View with Navigation */
          <div className="space-y-4">
        {/* Calendar View - Compact or Expanded */}
        <div className="bg-theme-secondary rounded-xl p-3 border border-theme">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCalendarExpanded(false)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  !isCalendarExpanded
                    ? 'bg-[var(--accent-color)] text-white'
                    : 'text-theme-secondary hover:bg-theme-primary/20'
                }`}
              >
                This Week
              </button>
              {canUseTwoWeekPlanning ? (
              <button
                onClick={() => setIsCalendarExpanded(true)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  isCalendarExpanded
                    ? 'bg-[var(--accent-color)] text-white'
                    : 'text-theme-secondary hover:bg-theme-primary/20'
                }`}
              >
                This Month
              </button>
              ) : (
              <button
                onClick={() => {
                  addToast('Monthly planning is a premium feature.', 'info', 5000, 'Upgrade', () => setActiveTab(Tab.SETTINGS));
                }}
                className="px-3 py-1 text-xs font-medium rounded-lg text-theme-secondary hover:bg-theme-primary/20 transition-colors flex items-center gap-1"
              >
                This Month 🔒
              </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-theme-primary/50 rounded"></span>
                <span className="text-theme-secondary opacity-70">{intl.formatMessage({ id: 'mealPlanner.hasMeals' })}</span>
              </span>
              <span className="text-theme-secondary opacity-40">•</span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-[var(--accent-color)] rounded"></span>
                <span className="text-theme-secondary opacity-70">Today</span>
              </span>
            </div>
          </div>
          
          {isCalendarExpanded ? (
            /* Full Month Calendar View */
            <div className="space-y-2">
              {/* Month Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    const newMonth = new Date(currentCalendarMonth);
                    newMonth.setMonth(newMonth.getMonth() - 1);
                    setCurrentCalendarMonth(newMonth);
                  }}
                  className="p-1 rounded hover:bg-theme-primary/20 text-theme-secondary"
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <div className="flex items-center gap-2">
                  <h5 className="text-sm font-medium text-theme-primary">
                    {currentCalendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h5>
                  <button
                    onClick={() => {
                      setCurrentCalendarMonth(new Date());
                      // Also reset to today's index in displayPlan
                      const today = new Date();
                      const yyyy = today.getFullYear();
                      const mm = String(today.getMonth() + 1).padStart(2, '0');
                      const dd = String(today.getDate()).padStart(2, '0');
                      const todayStr = `${yyyy}-${mm}-${dd}`;
                      const todayIndex = displayPlan.findIndex(day => day.date === todayStr);
                      if (todayIndex >= 0) {
                        setCurrentDayIndex(todayIndex);
                      } else {
                        setCurrentDayIndex(0); // Fallback to first day
                      }
                    }}
                    className="text-xs px-2 py-1 rounded bg-theme-primary/20 hover:bg-theme-primary/30 text-theme-secondary"
                    title="Go to today"
                  >
                    Today
                  </button>
                </div>
                <button
                  onClick={() => {
                    const newMonth = new Date(currentCalendarMonth);
                    newMonth.setMonth(newMonth.getMonth() + 1);
                    setCurrentCalendarMonth(newMonth);
                  }}
                  className="p-1 rounded hover:bg-theme-primary/20 text-theme-secondary"
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>
              
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-xs text-theme-secondary opacity-60 py-1">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Generate calendar days for current calendar month */}
                {(() => {
                  const today = new Date();
                  const firstDay = new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth(), 1);
                  const startDate = new Date(firstDay);
                  startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday
                  
                  const days = [];
                  const currentDate = new Date(startDate);
                  
                  // Generate 6 weeks to ensure full coverage
                  for (let week = 0; week < 6; week++) {
                    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
                      const dateStr = currentDate.toISOString().split('T')[0];
                      const isCurrentMonth = currentDate.getMonth() === currentCalendarMonth.getMonth() && currentDate.getFullYear() === currentCalendarMonth.getFullYear();
                      const isToday = currentDate.toDateString() === today.toDateString();
                      
                      // Find if this date has meals scheduled
                      const dayIndex = displayPlan.findIndex(day => day.date === dateStr);
                      const mealPlanIndex = mealPlan.findIndex(d => d.date === dateStr);
                      const hasMeals = mealPlanIndex >= 0 && hasMealsScheduled(mealPlanIndex);
                      const isSelected = dayIndex === currentDayIndex;
                      
                      days.push(
                        <button
                          key={dateStr}
                          onClick={() => {
                            const planIndex = displayPlan.findIndex(day => day.date === dateStr);
                            if (planIndex >= 0) {
                              setCurrentDayIndex(planIndex);
                            }
                          }}
                          className={`aspect-square text-xs rounded-lg transition-all relative ${
                            !isCurrentMonth
                              ? 'text-theme-secondary opacity-30'
                              : isSelected
                              ? 'bg-green-600 text-white font-bold ring-2 ring-green-600/50'
                              : isToday
                              ? 'bg-[var(--accent-color)]/20 text-[var(--accent-color)] border border-[var(--accent-color)]/30'
                              : hasMeals
                              ? 'bg-theme-primary/50 text-white hover:bg-theme-primary/70 border border-theme-primary/30'
                              : 'text-theme-secondary opacity-50 hover:bg-theme-primary/20'
                          }`}
                          title={`${currentDate.toLocaleDateString()}${hasMeals ? ' - Has meals scheduled' : ' - No meals'}`}
                        >
                          {hasMeals ? (
                            <div className="flex flex-col items-center leading-tight h-full justify-center">
                              <span className="font-bold">✓</span>
                              <span className="text-[10px]">{currentDate.getDate()}</span>
                            </div>
                          ) : (
                            <span className="flex items-center justify-center h-full">
                              {currentDate.getDate()}
                            </span>
                          )}
                          {hasMeals && (
                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full border border-theme-primary"></div>
                          )}
                        </button>
                      );
                      
                      currentDate.setDate(currentDate.getDate() + 1);
                    }
                  }
                  
                  return days;
                })()}
              </div>
            </div>
          ) : (
            /* Compact Week View */
            <div className="grid grid-cols-7 gap-1 text-center">
              {displayPlan.slice(0, 7).map((day, index) => {
                const mealPlanIndex = mealPlan.findIndex(d => d.date === day.date);
                const hasMeals = mealPlanIndex >= 0 && hasMealsScheduled(mealPlanIndex);
                const isCurrentDay = index === currentDayIndex;
                const isTodayDate = isToday(day.date);

                return (
                  <div key={day.date} className="flex flex-col items-center">
                    <div className="text-xs text-theme-secondary opacity-60 mb-1">
                      {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(day.date + 'T12:00:00').getDay()]}
                    </div>
                    <button
                      onClick={() => setCurrentDayIndex(index)}
                      className={`w-full py-1 text-xs rounded-lg transition-all relative ${
                        isCurrentDay
                          ? 'bg-green-600 text-white font-bold ring-2 ring-green-600/50'
                          : isTodayDate
                          ? 'bg-[var(--accent-color)]/20 text-[var(--accent-color)] border border-[var(--accent-color)]/30'
                          : hasMeals
                          ? 'bg-theme-primary/50 text-white hover:bg-theme-primary/70 border border-theme-primary/30'
                          : 'text-theme-secondary opacity-50 hover:bg-theme-primary/20'
                      }`}
                      title={`${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(day.date + 'T12:00:00').getDay()]} ${day.date}${hasMeals ? ' - Has meals scheduled' : ' - No meals'}`}
                    >
                      {hasMeals ? (
                        <div className="flex flex-col items-center leading-tight">
                          <span className="font-bold">✓</span>
                          <span className="text-[10px]">{new Date(day.date + 'T12:00:00').getDate()}</span>
                        </div>
                      ) : (
                        new Date(day.date + 'T12:00:00').getDate()
                      )}
                      {hasMeals && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full border border-theme-primary"></div>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

            {/* Navigation Header */}
            <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
              <button
                onClick={handleClearWeek}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-theme-secondary border border-theme text-theme-secondary hover:bg-red-500/10 hover:text-red-400 hover:border-red-400/30 transition-colors"
                aria-label="Clear week meals"
                title="Clear all meals for this week"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear week
              </button>
              <button
                onClick={handleCopyWeek}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-theme-secondary border border-theme text-theme-secondary hover:bg-[var(--accent-color)]/10 hover:text-[var(--accent-color)] hover:border-[var(--accent-color)]/30 transition-colors"
                aria-label="Copy week meals to next week"
                title="Copy this week's meals to next week"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy to next week
              </button>
              <button
                onClick={handleExportCalendar}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-theme-secondary border border-theme text-theme-secondary hover:bg-[var(--accent-color)]/10 hover:text-[var(--accent-color)] hover:border-[var(--accent-color)]/30 transition-colors"
                aria-label="Export week to calendar"
                title="Download this week as a calendar file (.ics)"
              >
                <Download className="w-3.5 h-3.5" />
                Export .ics
              </button>
              </div>
            </div>
            <div className="flex items-center justify-between bg-theme-secondary rounded-xl p-4 border border-theme">
              <button
                onClick={() => setCurrentDayIndex(Math.max(0, currentDayIndex - 1))}
                disabled={currentDayIndex === 0}
                className="p-2 rounded-lg hover:bg-theme-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous day"
              >
                <svg className="w-6 h-6 text-theme-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="text-center">
                <h2 className={`text-xl font-bold ${isToday(displayPlan[currentDayIndex]?.date) ? 'text-[var(--accent-color)]' : 'text-theme-primary'}`}>
                  {displayPlan[currentDayIndex]?.dayName}
                  {isToday(displayPlan[currentDayIndex]?.date) && <span className="ml-2 text-sm">📅</span>}
                </h2>
                <p className={`text-sm font-mono ${isToday(displayPlan[currentDayIndex]?.date) ? 'text-[var(--accent-color)] font-semibold' : 'text-theme-secondary opacity-70'}`}>
                  {displayPlan[currentDayIndex]?.date}
                </p>
              </div>

              <button
                onClick={() => {
                  if (!canUseTwoWeekPlanning && currentDayIndex >= 6) {
                    addToast('Planning beyond 7 days requires Premium.', 'info', 5000, 'Upgrade', () => setActiveTab(Tab.SETTINGS));
                    return;
                  }
                  setCurrentDayIndex(Math.min(displayPlan.length - 1, currentDayIndex + 1));
                }}
                disabled={currentDayIndex === displayPlan.length - 1 || (!canUseTwoWeekPlanning && currentDayIndex >= 6)}
                className="p-2 rounded-lg hover:bg-theme-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Next day"
                title={!canUseTwoWeekPlanning && currentDayIndex >= 6 ? 'Upgrade to Premium to plan beyond 7 days' : undefined}
              >
                <svg className="w-6 h-6 text-theme-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            </div>

            {/* Current Day Meals */}
            <div className="bg-theme-secondary rounded-xl p-6 border border-theme min-h-[400px]">
              <div className="space-y-6">
                {['Breakfast', 'Lunch', 'Dinner'].map((mealType) => {
                  const mealTypeKey = mealType.toLowerCase() as 'breakfast' | 'lunch' | 'dinner';
                  const effectiveIndex = mealPlan.findIndex(d => d.date === displayPlan[currentDayIndex].date);
                  const mealsForType = mealPlan[effectiveIndex]?.[mealTypeKey] || [];

                  return (
                    <div key={mealType} className="space-y-3">
                      <h3 className="text-lg font-semibold text-theme-primary flex items-center gap-2">
                        {intl.formatMessage({ id: `mealPlanner.${mealTypeKey}` })}
                        <span className="text-sm opacity-60">({mealsForType.length})</span>
                      </h3>

                      {mealsForType.length === 0 ? (
                        <button
                          onClick={() => {
                            setSearchMealType(mealTypeKey);
                            setShowRecipeSearch(true);
                          }}
                          data-tutorial="add-recipe-button"
                          className="w-full border-2 border-dashed border-theme/50 rounded-lg p-6 text-center hover:border-[var(--accent-color)] hover:bg-[var(--accent-color)]/5 transition-all"
                        >
                          <Plus className="w-8 h-8 mx-auto mb-2 text-theme-secondary opacity-50" />
                          <span className="text-theme-secondary opacity-70">{intl.formatMessage({ id: 'mealPlanner.addRecipe' })}</span>
                        </button>
                      ) : (
                        <div className="space-y-3">
                          {mealsForType.map((meal, mealIndex) => (
                            <div
                              key={meal.id}
                              className="bg-theme-primary/60 border border-theme/30 rounded-lg p-4 hover:bg-theme-primary/80 transition-all"
                            >
                              <div className="mb-3">
                                <span 
                                  className="text-[var(--accent-color)] font-semibold text-lg cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => {
                                    setModalRecipe(meal.recipe);
                                    setModalContext('scheduled');
                                    setShowRecipeModal(true);
                                  }}
                                >
                                  {meal.recipe.title}
                                </span>
                                <span className="text-sm opacity-60 ml-2">
                                  • {meal.recipe.cookTime}
                                </span>
                                {meal.recipe.servings && (
                                  <span className="text-sm opacity-60 ml-2">
                                    • Serves {meal.recipe.servings}
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-1.5 flex-wrap">
                                <button
                                  onClick={() => {
                                    setModalRecipe(meal.recipe);
                                    setModalContext('scheduled');
                                    setShowRecipeModal(true);
                                  }}
                                  className="px-1 py-2 bg-theme-secondary border border-theme rounded-lg hover:bg-theme-primary transition-colors text-sm"
                                  title="View recipe"
                                >
                                  👁️ View
                                </button>
                                <button
                                  onClick={() => handleCookedIt(meal)}
                                  className="px-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                                  title="Mark as cooked"
                                >
                                  ✓ Cooked
                                </button>
                                <button
                                  onClick={() => handleOpenSwapWithLeftover(effectiveIndex, mealTypeKey, mealIndex)}
                                  className="px-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                  title="Swap with leftover"
                                >
                                  🍱 Swap
                                </button>
                                <button
                                  onClick={() => removeMeal(effectiveIndex, mealTypeKey, mealIndex)}
                                  className="px-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                                  title="Remove meal"
                                >
                                  🗑️ Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Trash can for removing meals */}
        {isDragging && (
          <div 
            className={`fixed bottom-24 right-4 z-50 w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center transition-all duration-200 ${
              dragOverTrash
                ? 'border-red-500 bg-red-500/10 shadow-lg scale-110'
                : 'border-red-400 bg-red-400/5'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOverTrash(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragOverTrash(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDrop(e, 0, undefined, true);
              setDragOverTrash(false);
            }}
          >
            <Trash2 className={`w-8 h-8 transition-colors ${
              dragOverTrash ? 'text-red-500' : 'text-red-400'
            }`} />
          </div>
        )}
      </PremiumFeature>
      
      {/* Recipe Search Modal */}
      {showRecipeSearch && searchMealType && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 pt-[var(--safe-area-inset-top,0px)] pb-[var(--safe-area-inset-bottom,0px)]">
          <div className="bg-theme-primary rounded-xl max-w-4xl w-full h-full flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-theme">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-theme-secondary">
                    Add {searchMealType.charAt(0).toUpperCase() + searchMealType.slice(1)} Recipe
                  </h2>
                  <p className="text-theme-secondary opacity-60">
                    {mealPlan[currentDayIndex].dayName} - {mealPlan[currentDayIndex].date}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowRecipeSearch(false);
                    setSearchMealType(null);
                  }}
                  className="text-theme-secondary opacity-60 hover:opacity-100 p-2"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <RecipeSearchModal
                mealType={searchMealType}
                dayIndex={currentDayIndex}
                onAddRecipe={(recipe, dayIndex) => {
                  const newPlan = [...mealPlan];
                  // Map displayPlan index to mealPlan index
                  const effectiveIndex = mealPlan.findIndex(d => d.date === displayPlan[dayIndex].date);
                  
                  if (!newPlan[effectiveIndex][searchMealType]) {
                    newPlan[effectiveIndex][searchMealType] = [];
                  }
                  newPlan[effectiveIndex][searchMealType].push({
                    id: Date.now().toString(),
                    recipe,
                    mealType: searchMealType
                  });
                  updateMealPlan(newPlan);
                  setShowRecipeSearch(false);
                  setSearchMealType(null);
                }}
                onClose={() => {
                  setShowRecipeSearch(false);
                  setSearchMealType(null);
                }}
                inventory={inventory}
                user={user}
                savedRecipes={propSavedRecipes}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal for full recipe details */}
      {showRecipeModal && modalRecipe && (
        <RecipeModal
          recipe={modalRecipe}
          isOpen={showRecipeModal}
          onClose={() => setShowRecipeModal(false)}
          onAddToPlan={modalContext === 'search' ? handleAddToPlan : undefined}
          onSaveRecipe={onSaveRecipe}
          onRate={onRate}
          onMarkAsMade={modalContext === 'scheduled' ? onMarkAsMade : undefined}
          showSaveButton={true}
          showMarkAsMade={modalContext === 'scheduled'}
          isFromMealPlan={modalContext === 'scheduled'}
          showAddToPlan={modalContext === 'search'}
          recipeSaveLimitExceeded={recipeSaveLimitExceeded}
          mealPlanLimitExceeded={mealPlanLimitExceeded}
          user={user}
        />
      )}

      {/* Meal Prep Planner Modal */}
      {showMealPrepPlanner && (
        <MealPrepPlanner
          savedRecipes={savedRecipes}
          inventory={inventory}
          onAddToPlan={handleAddToPlan}
          onClose={() => setShowMealPrepPlanner(false)}
        />
      )}

      {showLeftoverPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-theme-primary border border-theme rounded-xl p-4 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-theme-primary mb-2">Making a lunchbox? 🍱</h3>
            <p className="text-sm text-theme-secondary mb-3">Save leftovers now for quick reminders and expiry tracking.</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button className="px-3 py-2 rounded border border-theme bg-theme-secondary hover:bg-theme-primary" onClick={() => { setLeftoverServings(1); setShowLeftoverPrompt(false); setShowLeftoverCapture(true); }}>1 Serving</button>
              <button className="px-3 py-2 rounded border border-theme bg-theme-secondary hover:bg-theme-primary" onClick={() => { setLeftoverServings(2); setShowLeftoverPrompt(false); setShowLeftoverCapture(true); }}>2 Servings</button>
              <button className="px-3 py-2 rounded border border-theme bg-theme-secondary hover:bg-theme-primary" onClick={() => { setShowLeftoverPrompt(false); setShowLeftoverCapture(true); }}>The Rest</button>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-2 rounded border border-theme" onClick={() => setShowLeftoverPrompt(false)}>Skip</button>
              <button className="px-3 py-2 rounded bg-[var(--accent-color)] text-white" onClick={() => { setShowLeftoverPrompt(false); setShowLeftoverCapture(true); }}>Capture</button>
            </div>
          </div>
        </div>
      )}

      {showLeftoverCapture && user?.id && (
        <div onClick={(e) => e.stopPropagation()} style={{ zIndex: 99999 }} className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
          <div onClick={(e) => e.stopPropagation()} className="bg-theme-primary rounded-xl max-w-xl w-full">
            <LeftoverQuickCapture
              createdBy={user.id}
              initialServings={leftoverServings}
              initialNotes={leftoverNotes}
              onSaved={() => {
                setShowLeftoverCapture(false);
                AnalyticsService.logEvent('leftover_captured_from_mealplanner', { household_id: household?.id });
              }}
              onClose={() => setShowLeftoverCapture(false)}
            />
          </div>
        </div>
      )}

      {showLeftoverSwapModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-theme-primary border border-theme rounded-xl p-4 max-w-md w-full">
            <h3 className="text-lg font-semibold text-theme-primary mb-2">Swap for Leftovers</h3>
            <p className="text-sm text-theme-secondary mb-3">Choose a leftover to replace this planned meal.</p>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {leftovers.length === 0 ? (
                <div className="text-sm text-theme-secondary">No leftovers available right now.</div>
              ) : leftovers.map(item => {
                const bestBefore = item.leftoverMeta?.computedBestBefore;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSwapWithLeftover(item)}
                    className="w-full text-left p-3 rounded border border-theme bg-theme-secondary hover:bg-theme-primary transition-colors"
                  >
                    <div className="font-medium text-theme-primary">{item.item}</div>
                    <div className="text-xs text-theme-secondary">
                      {typeof item.leftoverMeta?.servings === 'number' ? `${item.leftoverMeta?.servings} servings` : 'Leftover'}
                      {bestBefore ? ` • best before ${new Date(bestBefore).toLocaleDateString()}` : ''}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="flex justify-end gap-2 mt-3">
              <button className="px-3 py-2 rounded border border-theme" onClick={() => { setShowLeftoverSwapModal(false); setSwapSource(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Meal Dialog */}
      {showAddMealDialog && pendingRecipe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-theme-primary rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-theme-text mb-4 text-center">
              Add "{pendingRecipe.title}" to Meal Plan
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-theme-text mb-2">Select Day:</label>
                <select
                  className="w-full p-3 bg-theme-secondary border border-theme rounded-lg text-theme-text"
                  onChange={(e) => setSelectedDayForDialog(parseInt(e.target.value))}
                  defaultValue=""
                >
                  <option value="" disabled>Select a day...</option>
                  {displayPlan.map((day) => {
                      const valueIndex = mealPlan.findIndex(d => d.date === day.date);
                      return (
                        <option key={day.date} value={valueIndex}>
                          {day.dayName} - {day.date}
                        </option>
                      );
                    })}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-theme-text mb-2">Select Meal:</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['breakfast', 'lunch', 'dinner'] as const).map((mealType) => (
                    <button
                      key={mealType}
                      onClick={() => selectedDayForDialog !== null && confirmAddToPlan(selectedDayForDialog, mealType)}
                      className="p-3 bg-theme-secondary hover:bg-[var(--accent-color)] hover:text-white border border-theme rounded-lg text-theme-text capitalize transition-colors"
                    >
                      {mealType}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddMealDialog(false);
                  setPendingRecipe(null);
                  setSelectedDayForDialog(null);
                }}
                className="flex-1 py-3 font-medium bg-theme-secondary text-theme-text rounded-lg hover:bg-theme-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
