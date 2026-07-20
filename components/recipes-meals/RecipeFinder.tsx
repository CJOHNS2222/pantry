import React, { useState, useEffect, useMemo, useRef } from 'react';
import { searchRecipes } from '../../services/geminiService';
import { setUserGeminiOptIn } from '../../services/featureFlags';
import { getCachedRecipesCache, submitRecipeForReview } from '../../services/recipeService';
import { RecipeSearchResult, LoadingState, RecipeRating, StructuredRecipe, PantryItem, SavedRecipe, User, Household, RecipeSearchParams } from '../../types';
import { PremiumFeature } from '../settings/PremiumFeature';
import { log } from '../../services/logService';
import AnalyticsService from '../../services/analyticsService';
import { UsageService } from '../../services/usageService';
import { saveSearchToHistory, getRecentSearchSuggestions } from '../../utils/searchUtils';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { useAndroidBack } from '../../hooks/useAndroidBack';

import { filterRecipesByHouseholdPreferences, checkRecipeAgainstPreferences, rankCachedRecipesByPreferences, recipeMatchesCacheFilters, CacheMealTypeFilter } from '../../utils/preferenceUtils';
import { getUserMeasurementSystem, convertIngredientString } from '../../utils/measurementUtils';
import { useIntl } from 'react-intl';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { maybeRequestReviewAfterRecipeSave } from '../../services/appReviewService';
import { RecipeFinderSavedView } from '../recipe-finder/RecipeFinderSavedView';
import { RecipeFinderPopularSection } from '../recipe-finder/RecipeFinderPopularSection';
import { RecipeFinderSearchControls } from '../recipe-finder/RecipeFinderSearchControls';
import { RecipeFinderResultStates } from '../recipe-finder/RecipeFinderResultStates';
import { RecipeFinderCard, RecipeFinderTile } from '../recipe-finder/RecipeFinderCards';
import { RecipeFinderTabs } from '../recipe-finder/RecipeFinderTabs';
import { RecipeFinderModalSection } from '../recipe-finder/RecipeFinderModalSection';
import { Tab } from '../../types/app';
import SmartRecommendations from '../pantry/SmartRecommendations';
import { FALLBACK_CSV_RECIPES } from '../../data/fallbackRecipes';

/** Internal search params — partial RecipeSearchParams plus component-local filter fields */
type RecipeFinderSearchParams = Partial<RecipeSearchParams> & {
    type?: string;
    isCacheOnly?: boolean;
    mealTypeFilter?: string;
    cuisineFilter?: string;
};

interface RecipeFinderProps {
    onAddToPlan: (recipe: StructuredRecipe) => void;
    onSaveRecipe: (recipe: StructuredRecipe) => void;
    onDeleteRecipe: (recipe: SavedRecipe) => void;
    onMarkAsMade?: (recipe: StructuredRecipe) => void;
    inventory: PantryItem[];
    ratings: RecipeRating[];
    onRate: (rating: RecipeRating) => void;
    savedRecipes: SavedRecipe[];
    user: User;
    setActiveTab: (tab: Tab) => void;
    persistedResult?: RecipeSearchResult | null;
    setPersistedResult?: (result: RecipeSearchResult | null) => void;
    initialSearchQuery?: string;
    addToast?: (message: string, type?: 'error' | 'info' | 'success', ttl?: number, actionLabel?: string, action?: () => void) => void;
    // Usage limit states
    recipeSaveLimitExceeded?: boolean;
    mealPlanLimitExceeded?: boolean;
    // Loading states
    isLoadingSavedRecipes?: boolean;
    // Household data for preference filtering
    household?: Household | null;
}

// List of staple items to ignore in recipe calculations
const STAPLES = ['salt', 'pepper', 'oil', 'water', 'flour', 'sugar', 'butter', 'vinegar', 'baking powder', 'baking soda', 'spices', 'seasoning', 'soy sauce', 'cornstarch', 'yeast'];

const RecipeFinderComponent: React.FC<RecipeFinderProps> = ({ onAddToPlan, onSaveRecipe, onDeleteRecipe, onMarkAsMade, inventory, ratings = [], onRate, savedRecipes, user, setActiveTab, persistedResult, setPersistedResult, initialSearchQuery, addToast, recipeSaveLimitExceeded = false, mealPlanLimitExceeded = false, isLoadingSavedRecipes = false, household }) => {
    const intl = useIntl();
    // Pre-computed inventory lookup data for fast feasibility calculations
    const inventoryLookup = useMemo(() => {
        if (!inventory.length) return { fullNamesSet: new Set<string>(), tokensSet: new Set<string>(), itemsList: [] as string[] };
        
        const itemsList: string[] = [];
        const fullNamesSet = new Set<string>();
        const tokensSet = new Set<string>();

        inventory.forEach(item => {
            const name = item.item.toLowerCase().trim();
            if (!name || STAPLES.some(staple => name.includes(staple))) return;
            itemsList.push(name);
            fullNamesSet.add(name);
            name.split(/\s+/).forEach(token => {
                if (token.length > 2) tokensSet.add(token);
            });
        });

        return { fullNamesSet, tokensSet, itemsList };
    }, [inventory]);

    // Recipe suggestion logic optimized with Set lookups
    const calculateRecipeFeasibility = (recipe: SavedRecipe) => {
        const recipeIngredients = recipe.ingredients.map(ing => ing.toLowerCase().trim());
        const { fullNamesSet, tokensSet, itemsList } = inventoryLookup;
        
        if (itemsList.length === 0 || recipeIngredients.length === 0) {
            return {
                matchPercentage: 0,
                matchedIngredients: 0,
                totalIngredients: recipeIngredients.length,
                missingIngredients: recipeIngredients,
                canMake: false
            };
        }

        let matchedIngredients = 0;
        const missingIngredients: string[] = [];

        for (const ing of recipeIngredients) {
            let isMatched = fullNamesSet.has(ing);
            if (!isMatched) {
                const ingTokens = ing.split(/\s+/);
                isMatched = ingTokens.some(t => t.length > 2 && tokensSet.has(t));
            }
            if (!isMatched) {
                isMatched = itemsList.some(item => ing.includes(item) || item.includes(ing));
            }

            if (isMatched) {
                matchedIngredients++;
            } else {
                missingIngredients.push(ing);
            }
        }

        const matchPercentage = (matchedIngredients / recipeIngredients.length) * 100;
        const canMake = matchPercentage >= 70;

        return {
            matchPercentage,
            matchedIngredients,
            totalIngredients: recipeIngredients.length,
            missingIngredients,
            canMake
        };
    };

    // Import modal state
    const [showImportModal, setShowImportModal] = useState(false);
    
    // Get recipe suggestions based on inventory
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const getRecipeSuggestions = useMemo(() => {
        if (!savedRecipes.length || !inventory.length) return { canMake: [], needMore: [] };
        
        const suggestions = savedRecipes
            .map(recipe => ({
                recipe,
                feasibility: calculateRecipeFeasibility(recipe)
            }))
            .filter(item => item.feasibility.matchPercentage > 30) // Only show recipes with >30% match
            .sort((a, b) => b.feasibility.matchPercentage - a.feasibility.matchPercentage);
        
        return {
            canMake: suggestions.filter(item => item.feasibility.canMake).slice(0, 8),
            needMore: suggestions.filter(item => !item.feasibility.canMake).slice(0, 8)
        };
    }, [savedRecipes, inventory, inventoryLookup]);

    const [savedSort, setSavedSort] = useState<'recent' | 'top-rated'>('recent');

    const sortedSavedRecipes = useMemo(() => {
        if (savedSort === 'recent') {
            return [...savedRecipes].sort((a, b) =>
                (b.dateSaved ?? '').localeCompare(a.dateSaved ?? '')
            );
        }
        // top-rated: match by title against ratings array, average per recipe
        const avgRating = (recipe: SavedRecipe) => {
            const recipeRatings = ratings.filter(r => r.recipeTitle === recipe.title);
            if (!recipeRatings.length) return 0;
            return recipeRatings.reduce((sum, r) => sum + r.rating, 0) / recipeRatings.length;
        };
        return [...savedRecipes].sort((a, b) => avgRating(b) - avgRating(a));
    }, [savedRecipes, savedSort, ratings]);

    // Smart default: prefer 'saved' when user has saves but no pantry data yet
    const [activeView, setActiveView] = useState<'search' | 'saved'>(
        savedRecipes.length > 0 && inventory.length === 0 ? 'saved' : 'search'
    );
    const [cacheMealTypeFilter, setCacheMealTypeFilter] = useState<CacheMealTypeFilter>('');
    const [cacheCuisineFilter, setCacheCuisineFilter] = useState<string>('');
    const [cacheMeatFilter, setCacheMeatFilter] = useState<string>('');
    
    // Search parameters
    const [specificQuery, setSpecificQuery] = useState('');
    const [maxCookTime, setMaxCookTime] = useState<string>('60');
    const [maxIngredients, setMaxIngredients] = useState<string>('10');
    const [recipeType, setRecipeType] = useState<'Snack' | 'Dinner' | 'Dessert' | ''>('');
    // Use user's measurement preference instead of local state
    const measurement = getUserMeasurementSystem(user?.profile);
    const [strictMode, setStrictMode] = useState(false);
    
    // New smart filters — pre-populate from user profile
    const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>(
        user?.profile?.dietaryRestrictions ?? []
    );
    const [maxPrepTime, setMaxPrepTime] = useState<string>('30');
    const [servings, setServings] = useState<string>(user?.profile?.householdSize?.toString() || '4');
    
    // Recent searches state
    const [recentRecipeSearches, setRecentRecipeSearches] = useState<string[]>([]);
    const [showRecipeAutocomplete, setShowRecipeAutocomplete] = useState(false);
    
    // Search state
    const [result, setResult] = useState<RecipeSearchResult | null>(persistedResult || null);
    // Map of recipe title -> warning strings for post-fetch preference checking
    const [recipeWarnings, setRecipeWarnings] = useState<Map<string, { warnings: string[], isAllergen: boolean }>>(new Map());
    const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [isResultFromCache, setIsResultFromCache] = useState(false);

    // Firebase recipes state
    const [firebaseRecipes, setFirebaseRecipes] = useState<SavedRecipe[]>([]);
    const [firebaseRecipesLoading, setFirebaseRecipesLoading] = useState(false);
    // Visible count for incremental rendering from cached doc
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [visibleFirebaseCount, setVisibleFirebaseCount] = useState<number>(25);

    const availableCuisineFilters = useMemo(() => {
        const cuisines = Array.from(new Set(firebaseRecipes
            .map(recipe => ((recipe as SavedRecipe & { cuisine?: string }).cuisine || 'other').trim().toLowerCase())
            .filter(Boolean)
        )).sort();
        return cuisines;
    }, [firebaseRecipes]);

    // Memoized filtered recipes for popular cache section (PERF-025)
    const householdMemberCount = household?.members?.length ?? 0;
    const userDietaryStr = (user?.profile?.dietaryRestrictions || []).join(',');

    const filteredFirebaseRecipes = useMemo(() => {
        let filtered = firebaseRecipes.filter(recipe =>
            recipeMatchesCacheFilters(recipe, {
                mealType: cacheMealTypeFilter,
                cuisine: cacheCuisineFilter
            })
        );
        if (cacheMeatFilter) {
            const meat = cacheMeatFilter.toLowerCase();
            filtered = filtered.filter(recipe => {
                const titleMatch = recipe.title.toLowerCase().includes(meat);
                const ingredientMatch = (recipe.ingredients || []).some(ing =>
                    ing.toLowerCase().includes(meat)
                );
                return titleMatch || ingredientMatch;
            });
        }
        return rankCachedRecipesByPreferences(filtered, household?.members || [], user?.profile);
    }, [firebaseRecipes, cacheMealTypeFilter, cacheCuisineFilter, cacheMeatFilter, householdMemberCount, userDietaryStr]);
    
    // Recipe cache to avoid duplicate API calls without triggering re-renders (PERF-031)
    const recipeCacheRef = useRef<Map<string, RecipeSearchResult>>(new Map());
    
    // Debounce state to prevent rapid successive searches
    const [lastSearchTime, setLastSearchTime] = useState<number>(0);

    // Voice search state
    const [isListening, setIsListening] = useState(false);
    const [voiceSearchSupported, setVoiceSearchSupported] = useState(false);


    // Check for speech recognition support (native on Capacitor, Web Speech API on web)
    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            SpeechRecognition.available().then(({ available }) => {
                setVoiceSearchSupported(available);
            }).catch(() => setVoiceSearchSupported(false));
        } else if ((window as Window & typeof globalThis & { webkitSpeechRecognition?: unknown; SpeechRecognition?: unknown }).webkitSpeechRecognition || (window as Window & typeof globalThis & { SpeechRecognition?: unknown }).SpeechRecognition) {
            setVoiceSearchSupported(true);
        }
    }, []);

    // Load recent recipe searches on mount
    useEffect(() => {
        const recent = getRecentSearchSuggestions('recipe', 5);
        setRecentRecipeSearches(recent);
    }, []);

    // Voice search function — uses native Capacitor plugin on iOS/Android, Web Speech API on web
    const startVoiceSearch = async () => {
        if (!voiceSearchSupported) return;

        if (Capacitor.isNativePlatform()) {
            try {
                await SpeechRecognition.requestPermissions();
                setIsListening(true);
                await SpeechRecognition.start({
                    language: 'en-US',
                    maxResults: 1,
                    popup: false,
                });
                const { matches } = await new Promise<{ matches: string[] }>((resolve, reject) => {
                    const listener = SpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
                        listener.then(h => h.remove());
                        resolve(data);
                    });
                    // Timeout safety
                    setTimeout(() => reject(new Error('timeout')), 10000);
                });
                const transcript = matches?.[0] ?? '';
                if (transcript) {
                    setSpecificQuery(transcript);
                    AnalyticsService.trackVoiceSearch(true);
                    setTimeout(() => performSearch({ query: transcript, ingredients: '' }), 300);
                }
            } catch (err) {
                AnalyticsService.trackVoiceSearch(false, String(err));
            } finally {
                setIsListening(false);
                await SpeechRecognition.stop().catch(() => {});
            }
        } else {
            // Web Speech API fallback
            type WebSpeechCtor = new() => { continuous: boolean; interimResults: boolean; lang: string; onstart: (() => void) | null; onresult: ((e: Event) => void) | null; onerror: ((e: Event) => void) | null; onend: (() => void) | null; start(): void; };
            const SpeechRecognitionClass = ((window as unknown as Record<string, unknown>).SpeechRecognition
                ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as WebSpeechCtor | undefined;
            if (!SpeechRecognitionClass) return;

            const recognition = new SpeechRecognitionClass();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onstart = () => setIsListening(true);
            recognition.onresult = (event: Event) => {
                const se = event as Event & { results: { [key: number]: { [key: number]: { transcript: string } } } };
                const transcript = se.results[0][0].transcript;
                setSpecificQuery(transcript);
                setIsListening(false);
                AnalyticsService.trackVoiceSearch(true);
                setTimeout(() => performSearch({ query: transcript, ingredients: '' }), 500);
            };
            recognition.onerror = (event: Event) => {
                const se = event as Event & { error?: string };
                setIsListening(false);
                AnalyticsService.trackVoiceSearch(false, se?.error);
            };
            recognition.onend = () => setIsListening(false);
            recognition.start();
        }
    };

    // Generate cache key for search parameters
    const getCacheKey = (params: RecipeFinderSearchParams): string => {
        return JSON.stringify({
            query: params.query || '',
            ingredients: params.ingredients || '',
            restrictions: params.restrictions || '',
            maxCookTime: params.maxCookTime || 60,
            maxIngredients: params.maxIngredients || 10,
            measurementSystem: params.measurementSystem || 'Standard',
            type: params.type || '',
            strictMode: params.strictMode || false,
            cacheMealTypeFilter: params.mealTypeFilter || cacheMealTypeFilter,
            cacheCuisineFilter: params.cuisineFilter || cacheCuisineFilter,
            isCacheOnly: params.isCacheOnly || false
        });
    };
    
    // Modal state
    const [showRecipeModal, setShowRecipeModal] = useState(false);
    const [modalRecipe, setModalRecipe] = useState<StructuredRecipe | null>(null);
    const [modalIsSavedView, setModalIsSavedView] = useState(false);


    useAndroidBack(showRecipeModal, () => setShowRecipeModal(false));
    useAndroidBack(showRecipeAutocomplete, () => setShowRecipeAutocomplete(false));

    // Stable ref so window event handler can call the latest openRecipeModal closure
    const openRecipeModalRef = useRef<((recipe: StructuredRecipe | SavedRecipe, isSavedView?: boolean) => void) | null>(null);

    // Keyboard navigation support
    useKeyboardNavigation({
      onEscape: () => {
        if (showRecipeModal) {
          setShowRecipeModal(false);
          setModalRecipe(null);
        }
      },
      enabled: showRecipeModal
    });

    // Set initial search query if provided
    useEffect(() => {
        if (initialSearchQuery && !specificQuery) {
            setSpecificQuery(initialSearchQuery);
        }
    }, [initialSearchQuery]);



    // Surprise me feature
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleSurpriseMe = async () => {
        const allRecipes = filteredFirebaseRecipes;
        if (allRecipes.length === 0) return;

        const randomRecipe = allRecipes[Math.floor(Math.random() * allRecipes.length)];
        openRecipeModal(randomRecipe, false);

        // Track surprise me usage
        AnalyticsService.trackSurpriseMeUsed(cacheMealTypeFilter || 'all');
        AnalyticsService.trackRecipeSearch('surprise_me', 1);

        // Record search usage for limit tracking
        if (user) {
            try {
                await UsageService.recordSearch(user);
            } catch (error) {
                log.error('Error recording surprise me search usage', { error }, 'RecipeFinder');
            }
        }
    };

    // Load Firebase recipes on mount (for Popular Recipes section) - now cached for performance
    useEffect(() => {
        const loadFirebaseRecipes = async () => {
            if (firebaseRecipes.length > 0 || !user) return; // Already loaded or user not authenticated

            try {
                setFirebaseRecipesLoading(true);
                const recipes = await getCachedRecipesCache('recipe_caches/recipes_cache_1'); // Uses cached recipes (1 read vs 50+ reads)
                
                // Shuffle the recipes array to randomize their order
                const shuffled = [...recipes];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                
                setFirebaseRecipes(shuffled);
                // reset visible count when new recipes arrive
                setVisibleFirebaseCount(25);
            } catch (error) {
                log.error('Error loading cached Firebase recipes', { error }, 'RecipeFinder');
            } finally {
                setFirebaseRecipesLoading(false);
            }
        };
        loadFirebaseRecipes();
    }, [user]); // Depend on user authentication

    // Curated fallback recipes — shown in Popular section until Firebase cache loads (PERF-004)
    const csvRecipes: StructuredRecipe[] = FALLBACK_CSV_RECIPES;

    const filteredFallbackRecipes = useMemo(() => {
        let filtered = csvRecipes.filter(recipe =>
            recipeMatchesCacheFilters(recipe, {
                mealType: cacheMealTypeFilter,
                cuisine: cacheCuisineFilter
            })
        );
        if (cacheMeatFilter) {
            const meat = cacheMeatFilter.toLowerCase();
            filtered = filtered.filter(recipe => {
                const titleMatch = recipe.title.toLowerCase().includes(meat);
                const ingredientMatch = (recipe.ingredients || []).some(ing =>
                    ing.toLowerCase().includes(meat)
                );
                return titleMatch || ingredientMatch;
            });
        }
        return rankCachedRecipesByPreferences(filtered, household?.members || [], user?.profile);
    }, [csvRecipes, cacheMealTypeFilter, cacheCuisineFilter, cacheMeatFilter, household?.members, user?.profile]);

  // Limit inventory items to reduce API token cost (top 25 most relevant items)
  const inventoryString = inventory
    .filter(item => !STAPLES.some(staple => item.item.toLowerCase().includes(staple)))
    .slice(0, 25)
    .map(i => i.item)
    .join(', ');

    const handleSpecificSearch = async (e?: React.FormEvent) => {
        e?.preventDefault();
    if (!specificQuery.trim()) {
      addToast?.('Please enter a recipe name or ingredients to search for.', 'info');
      return;
    }
    if (specificQuery.trim().length < 2) {
      addToast?.('Please enter at least 2 characters for your search.', 'info');
      return;
    }
    saveSearchToHistory(specificQuery, 'recipe');

    const params = { query: specificQuery, ingredients: '' };
    await performSearch(params);
  };

  const performSearchRef = useRef<(params: RecipeFinderSearchParams) => Promise<void>>(async () => {});
  // performSearchRef.current is set after performSearch is defined below

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inventory.length === 0) {
        addToast?.("Please add items to your pantry list first!", 'info');
        return;
    }
    if (inventory.length < 2) {
        addToast?.("Please add at least 2 items to your pantry for better recipe suggestions.", 'info');
        return;
    }
    
    // Check if API key is configured
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
        setSearchError('Recipe search service is not available. Please try again later.');
        setLoadingState(LoadingState.ERROR);
        return;
    }
    
    const params = { 
        ingredients: inventoryString,
        strictMode: strictMode
    };
    await performSearch(params);
  };

  const handleSearchEntireDatabase = async (mealType: string, cuisine: string) => {
      let query = '';
      if (cuisine) {
          query += `${cuisine.charAt(0).toUpperCase() + cuisine.slice(1)} `;
      }
      if (mealType) {
          query += `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} `;
      }
      query += 'Recipes';
      query = query.trim();

      setSpecificQuery(query);
      saveSearchToHistory(query, 'recipe');

      const params = {
          query,
          ingredients: '',
          isCacheOnly: true,
          mealTypeFilter: mealType,
          cuisineFilter: cuisine
      };
      await performSearch(params);

      // Scroll to the search input / results section
      const element = document.getElementById('specificQuery');
      if (element && typeof element.scrollIntoView === 'function') {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
      }
  };

    const performSearch = async (params: RecipeFinderSearchParams) => {
        // Debounce: prevent searches within 2 seconds of each other
        const now = Date.now();
        if (now - lastSearchTime < 2000) {
            log.debug('Search debounced - too soon after previous search');
            return;
        }
        setLastSearchTime(now);

        // Check search limits for free users
        if (user) {
            try {
                const limits = await UsageService.getUsageLimits(user);
                // Inline check using already-fetched limits (avoids a second getDoc via canPerformSearch)
                const canSearch = limits.searches.weekly === -1 || limits.searches.used < limits.searches.weekly;

                if (!canSearch) {
                    if (addToast) {
                        addToast(
                            'Search limit reached! Upgrade to Premium for 15 searches/week or Family for unlimited.',
                            'error',
                            6000,
                            'Upgrade Now',
                            () => setActiveTab(Tab.SETTINGS)
                        );
                    }
                    return;
                }

                // Show warning when approaching limit (80% used)
                const searchLimit = limits.searches.weekly;
                if (searchLimit !== -1 && limits.searches.used >= searchLimit * 0.8 && addToast) {
                    addToast(
                        `You've used ${limits.searches.used}/${searchLimit} searches this week. Consider upgrading for more!`,
                        'info',
                        4000
                    );
                }
            } catch (error) {
                log.error('Error checking search limits', { error }, 'RecipeFinder');
                // Continue with search if limit check fails
            }
        }

        // Check cache first to avoid duplicate API calls
        const cacheKey = getCacheKey(params);
        const cachedResult = recipeCacheRef.current.get(cacheKey);
        if (cachedResult) {
            log.debug('Using cached recipe result');
            setResult(cachedResult);
            setIsResultFromCache(true);
            if (setPersistedResult) setPersistedResult(cachedResult);
            setLoadingState(LoadingState.SUCCESS);
            // Track cached search (no API cost)
            AnalyticsService.trackRecipeSearch(
                params.query || 'generate_from_pantry_cached',
                cachedResult.recipes?.length || 0
            );
            return;
        }

        setLoadingState(LoadingState.LOADING);
        setResult(null);
        setRecipeWarnings(new Map());
        setIsResultFromCache(false);
        setSearchError(null);
        if (setPersistedResult) setPersistedResult(null);
        let wasFromCache = false;
        try {
            log.debug('Recipe search params:', params);
            // First, if there's a text query, try the cached popular recipes document
            let data: RecipeSearchResult | null = null;
            
            if (params.isCacheOnly) {
                try {
                    const cachedList = await getCachedRecipesCache('recipe_caches/recipes_cache_1');
                    const filteredMatches = cachedList.filter((r: SavedRecipe) =>
                        recipeMatchesCacheFilters(r, {
                            mealType: params.mealTypeFilter as CacheMealTypeFilter,
                            cuisine: params.cuisineFilter
                        })
                    );

                    const rankedMatches = rankCachedRecipesByPreferences(filteredMatches, household?.members || [], user?.profile);

                    data = { recipes: rankedMatches };
                    wasFromCache = true;
                    AnalyticsService.trackRecipeSearch(params.query || 'cache_only', rankedMatches.length);
                } catch (e) {
                    log.error('Cached-only recipe search failed', { error: e });
                    data = { recipes: [] };
                    wasFromCache = true;
                }
            } else if (params.query && String(params.query).trim()) {
                try {
                    const cachedList = await getCachedRecipesCache('recipe_caches/recipes_cache_1');
                    const q = String(params.query).toLowerCase();
                    const matches = cachedList.filter((r: SavedRecipe) => {
                        const title = (r.title || '').toLowerCase();
                        const desc = (r.description || '')?.toLowerCase() || '';
                        const ingredients = (Array.isArray(r.ingredients) ? r.ingredients.join(' ') : (r.ingredients || '')).toLowerCase();
                        const keywords = (Array.isArray((r as SavedRecipe & { keywords?: string[] }).keywords) ? (r as SavedRecipe & { keywords?: string[] }).keywords!.join(' ') : '').toLowerCase();
                        return title.includes(q) || desc.includes(q) || ingredients.includes(q) || keywords.includes(q);
                    });

                    const filteredMatches = matches.filter((r: SavedRecipe) =>
                        recipeMatchesCacheFilters(r, {
                            mealType: cacheMealTypeFilter,
                            cuisine: cacheCuisineFilter
                        })
                    );

                    const rankedMatches = rankCachedRecipesByPreferences(filteredMatches, household?.members || [], user?.profile);

                    if (rankedMatches.length > 0) {
                        data = { recipes: rankedMatches };
                        wasFromCache = true;
                        AnalyticsService.trackRecipeSearch(params.query, rankedMatches.length);
                    }
                } catch (e) {
                    // If cache read or filtering fails, fall back to external search below
                    log.warn('Cached recipe search failed, falling back to external search', { error: e });
                }
            }

            if (!data) {
                data = await searchRecipes({
                    ...params,
                    maxCookTime: parseInt(maxCookTime),
                    maxIngredients: parseInt(maxIngredients),
                    measurementSystem: measurement,
                    type: recipeType,
                    dietaryRestrictions,
                    maxPrepTime: parseInt(maxPrepTime),
                    servings: parseInt(servings),
                    userId: user?.id,
                    userProfile: user?.profile
                } as RecipeSearchParams, user);
                wasFromCache = false;
            }
            // Filter results by type (quick meal, dinner, dessert)
            let filteredRecipes = data.recipes;
            if (recipeType) {
                filteredRecipes = filteredRecipes.filter((r: StructuredRecipe) => {
                    if (!r.type) return true;
                    return r.type.toLowerCase() === recipeType.toLowerCase();
                });
            }

            // Build per-recipe warnings from household members and the user's own profile
            const warningsMap = new Map<string, { warnings: string[], isAllergen: boolean }>();

            // Check household member preferences
            if (household?.members && Array.isArray(household.members) && household.members.length > 0) {
                const { safeRecipes, riskyRecipes } = filterRecipesByHouseholdPreferences(
                    filteredRecipes,
                    household.members,
                    false
                );
                filteredRecipes = [...safeRecipes, ...riskyRecipes.map(r => r.recipe)];

                // Attach per-card warnings for risky recipes
                for (const { recipe: rr, violations } of riskyRecipes) {
                    const allWarnings = violations.flatMap(v => v.result.warnings.map(w => `${v.member.name}: ${w}`));
                    const hasAllergen = violations.some(v => v.result.violations.allergies.length > 0);
                    warningsMap.set(rr.title, { warnings: allWarnings, isAllergen: hasAllergen });
                }
            }

            // Check the individual user's own allergens / dislikes
            if (user?.profile) {
                const userAsMember = {
                    id: user.id ?? '',
                    name: user.name ?? 'You',
                    email: '',
                    role: 'member' as const,
                    status: 'active' as const,
                    joinedAt: '',
                    allergies: user.profile.allergies,
                    dietaryRestrictions: user.profile.dietaryRestrictions,
                    dislikedIngredients: user.profile.dislikedIngredients,
                };

                for (const recipe of filteredRecipes) {
                    if (warningsMap.has(recipe.title)) continue; // already has household warnings
                    const check = checkRecipeAgainstPreferences(recipe, userAsMember);
                    if (check.warnings.length > 0) {
                        warningsMap.set(recipe.title, {
                            warnings: check.warnings,
                            isAllergen: check.violations.allergies.length > 0,
                        });
                    }
                }
            }

            setRecipeWarnings(warningsMap);

            setResult({ ...data, recipes: filteredRecipes });
            setIsResultFromCache(wasFromCache);
            if (setPersistedResult) setPersistedResult({ ...data, recipes: filteredRecipes });
            
            // Save search to history
            if (params.query && params.query.trim()) {
              saveSearchToHistory(params.query.trim(), 'recipe');
            }
            
            // Cache the result to avoid duplicate API calls (limit cache to 20 entries) (PERF-031)
            recipeCacheRef.current.set(cacheKey, { ...data, recipes: filteredRecipes });
            if (recipeCacheRef.current.size > 20) {
                const oldestKey = recipeCacheRef.current.keys().next().value as string | undefined;
                if (oldestKey) recipeCacheRef.current.delete(oldestKey);
            }
            
            setLoadingState(LoadingState.SUCCESS);
            // Track recipe search
            AnalyticsService.trackRecipeSearch(
                params.query || 'generate_from_pantry',
                filteredRecipes?.length || 0
            );

            // Record search usage for limit tracking
            if (user) {
                try {
                    await UsageService.recordSearch(user);
                } catch (error) {
                    log.error('Error recording search usage', { error }, 'RecipeFinder');
                    // Don't fail the search if recording fails
                }
            }
        } catch (error: unknown) {
            log.error('performSearch error', { error }, 'RecipeFinder');
            let errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            
            // Provide user-friendly error messages
            if (errorMessage.includes('API key not configured')) {
                errorMessage = 'Recipe search is not configured. Please contact support.';
            } else if (errorMessage.includes('API configuration error')) {
                errorMessage = 'Service configuration error. Please try again later.';
            } else if (errorMessage.includes('quota exceeded')) {
                errorMessage = 'Service is temporarily unavailable. Please try again in a few minutes.';
            } else if (errorMessage.includes('Network error') || errorMessage.includes('fetch')) {
                errorMessage = 'Connection error. Please check your internet and try again.';
            } else if (errorMessage.includes('timeout')) {
                errorMessage = 'Request timed out. Please try again.';
            }
            
            setSearchError(errorMessage);
            setLoadingState(LoadingState.ERROR);
        }
    };

  // Wire up the stable ref now that performSearch is defined
  performSearchRef.current = performSearch;

  const getRatingInfo = (title: string) => {
      const related = ratings.filter(r => !!r?.recipeTitle && r.recipeTitle.toLowerCase() === title.toLowerCase());
      if (related.length === 0) return null;
      
      const total = related.reduce((a, b) => a + (b?.rating || 0), 0);
      return {
          avg: (total / related.length).toFixed(1),
          count: related.length,
          snippet: related[0].comment
      };
  };

        const openRecipeModal = (recipe: StructuredRecipe | SavedRecipe, isSavedView = false) => {
            // Track recipe view
            AnalyticsService.trackRecipeView(
                recipe.title || 'Untitled Recipe',
                recipe.title || 'Untitled Recipe',
                isSavedView ? 'saved' : 'search'
            );

            // Normalize recipe shape so modal can safely render instructions/ingredients
            type NormalizedRecipe = Omit<StructuredRecipe, 'instructions' | 'ingredients'> & {
              instructions: string | string[];
              ingredients: string | string[];
            };
            const normalized = { ...(recipe as StructuredRecipe) } as NormalizedRecipe;
            normalized.title = normalized.title || 'Untitled Recipe';
            if (!Array.isArray(normalized.instructions)) {
                if (typeof normalized.instructions === 'string') {
                    // Split on newlines or numbered steps
                    normalized.instructions = normalized.instructions.split(/\r?\n+/).map((s: string) => s.trim()).filter(Boolean);
                } else if (normalized.instructions && typeof normalized.instructions === 'object') {
                    // If stored as object with numeric keys, convert to array
                    normalized.instructions = Object.values(normalized.instructions).map(String).filter(Boolean);
                } else {
                    normalized.instructions = [];
                }
            }
            if (!Array.isArray(normalized.ingredients)) {
                if (typeof normalized.ingredients === 'string') {
                    normalized.ingredients = normalized.ingredients.split(/\r?\n+/).map((s: string) => s.trim()).filter(Boolean);
                } else if (normalized.ingredients && typeof normalized.ingredients === 'object') {
                    normalized.ingredients = Object.values(normalized.ingredients).map(String).filter(Boolean);
                } else {
                    normalized.ingredients = [];
                }
            }
            setModalRecipe(normalized as StructuredRecipe);
            setModalIsSavedView(Boolean(isSavedView));
            setShowRecipeModal(true);
        };
        openRecipeModalRef.current = openRecipeModal;

        const handleModalSaveRecipe = async (r: StructuredRecipe & { __imageFile?: File; __submitForInclusion?: boolean }) => {
            try {
                // Track save event
                AnalyticsService.trackRecipeSave(r.title || 'Untitled Recipe', r.title || 'Untitled Recipe');

                // Build minimal recipe object for saving
                const rIngredients = r.ingredients as string | string[];
                const rInstructions = r.instructions as string | string[];
                const recipeToSave: StructuredRecipe = {
                    title: r.title || '',
                    description: r.description || '',
                    ingredients: Array.isArray(rIngredients) ? rIngredients : (typeof rIngredients === 'string' ? rIngredients.split('\n').map((s:string)=>s.trim()).filter(Boolean) : []),
                    instructions: Array.isArray(rInstructions) ? rInstructions : (typeof rInstructions === 'string' ? rInstructions.split('\n').map((s:string)=>s.trim()).filter(Boolean) : []),
                    cookTime: r.cookTime || '',
                    type: r.type || 'Dinner',
                    image: r.image || ''
                };

                // Call the proper save handler that will update the cache correctly
                if (onSaveRecipe) {
                    await onSaveRecipe(recipeToSave);
                    // Prompt for app store review at meaningful milestones
                    await maybeRequestReviewAfterRecipeSave(savedRecipes.length + 1);
                }

                // If an image File was attached, we need to handle it separately
                // For now, skip image upload for popular recipes to avoid complexity
                if (r.__imageFile) {
                    log.warn('Image upload not supported for popular recipes yet', {}, 'RecipeFinder');
                }

                // If user requested submission for inclusion, handle it
                if (r.__submitForInclusion) {
                    try {
                        // Generate a temporary ID for submission
                        const tempId = `temp_${Date.now()}`;
                        await submitRecipeForReview({ ...recipeToSave, id: tempId }, user?.id);
                    } catch (subErr: unknown) {
                        log.error('Failed to submit recipe for review', { error: subErr }, 'RecipeFinder');
                    }
                }

                // Notify user
                if (addToast) addToast('Recipe saved successfully!', 'success');

            } catch (err) {
                log.error('Error saving recipe', { error: err }, 'RecipeFinder');
                if (addToast) addToast('Failed to save recipe. Please try again.', 'error');
            }
        };

        const DIETARY_BADGE_MAP: { keyword: string; label: string; variant: 'success' | 'warning' | 'info' }[] = [
            { keyword: 'vegan', label: 'Vegan', variant: 'success' },
            { keyword: 'vegetarian', label: 'Veggie', variant: 'success' },
            { keyword: 'gluten-free', label: 'GF', variant: 'warning' },
            { keyword: 'gluten free', label: 'GF', variant: 'warning' },
            { keyword: 'dairy-free', label: 'DF', variant: 'info' },
            { keyword: 'dairy free', label: 'DF', variant: 'info' },
            { keyword: 'keto', label: 'Keto', variant: 'info' },
            { keyword: 'paleo', label: 'Paleo', variant: 'warning' },
            { keyword: 'low-carb', label: 'Low-Carb', variant: 'warning' },
        ];

        const getDietaryBadges = (recipe: StructuredRecipe) => {
            const haystack = [
                (recipe.type || '').toLowerCase(),
                (recipe.description || '').toLowerCase(),
                ...(recipe.tags || []).map(t => t.toLowerCase()),
            ].join(' ');
            const badges: { label: string; variant: 'success' | 'warning' | 'info' }[] = [];
            const seen = new Set<string>();
            for (const { keyword, label, variant } of DIETARY_BADGE_MAP) {
                if (!seen.has(label) && haystack.includes(keyword)) {
                    badges.push({ label, variant });
                    seen.add(label);
                }
                if (badges.length >= 3) break;
            }
            return badges;
        };

        const getPreferenceSignals = (recipe: StructuredRecipe): { positive: string[]; warning: string[] } => {
            if (!user?.profile) return { positive: [], warning: [] };

            const searchableText = [
                recipe.title || '',
                recipe.description || '',
                recipe.type || '',
                (recipe as StructuredRecipe & { cuisine?: string }).cuisine || '',
                Array.isArray(recipe.ingredients) ? recipe.ingredients.join(' ') : ''
            ].join(' ').toLowerCase();

            const positive: string[] = [];
            const warning: string[] = [];

            for (const cuisine of user.profile.favoriteCuisines || []) {
                if (searchableText.includes(cuisine.toLowerCase().trim())) {
                    positive.push(`Matches favorite cuisine: ${cuisine}`);
                }
            }

            for (const protein of user.profile.preferredProteins || []) {
                if (searchableText.includes(protein.toLowerCase().trim())) {
                    positive.push(`Includes preferred protein: ${protein}`);
                }
            }

            for (const disliked of user.profile.dislikedIngredients || []) {
                if (searchableText.includes(disliked.toLowerCase().trim())) {
                    warning.push(`Contains disliked ingredient: ${disliked}`);
                }
            }

            return {
                positive: [...new Set(positive)].slice(0, 2),
                warning: [...new Set(warning)].slice(0, 1)
            };
        };

        const renderRecipeCard = (recipe: StructuredRecipe, isSavedView = false, isCompact = false) => {
            const ratingInfo = getRatingInfo(recipe.title);
            const dietaryBadges = getDietaryBadges(recipe);
            const cardWarning = recipeWarnings.get(recipe.title);
            
            // Filter out staple items from ingredient list and convert units
            const measurementSystem = getUserMeasurementSystem(user?.profile);
            const filteredIngredients = recipe.ingredients
                .map(ing => convertIngredientString(ing, measurementSystem))
                .filter(ing => {
                    const ingLower = ing.toLowerCase();
                    return !STAPLES.some(staple => ingLower.includes(staple));
                });
            return (
                <RecipeFinderCard
                    recipe={recipe}
                    isSavedView={isSavedView}
                    isCompact={isCompact}
                    ratingInfo={ratingInfo}
                    dietaryBadges={dietaryBadges}
                    cardWarning={cardWarning}
                    filteredIngredients={filteredIngredients}
                    mealPlanLimitExceeded={mealPlanLimitExceeded}
                    onOpen={openRecipeModal}
                    onAddToPlan={onAddToPlan}
                    onRate={onRate}
                    user={user}
                    noImageLabel={intl.formatMessage({ id: 'recipes.noImage' })}
                />
            );
        };

        const renderRecipeTile = (recipe: StructuredRecipe) => {
            const ratingInfo = getRatingInfo(recipe.title);
            const preferenceSignals = getPreferenceSignals(recipe);
            const showPreferenceSignals = isResultFromCache && (preferenceSignals.positive.length > 0 || preferenceSignals.warning.length > 0);

            return (
                <RecipeFinderTile
                    recipe={recipe}
                    ratingInfo={ratingInfo}
                    showPreferenceSignals={showPreferenceSignals}
                    preferenceSignals={preferenceSignals}
                    onOpen={(selectedRecipe) => openRecipeModal(selectedRecipe, false)}
                    onAddToPlan={onAddToPlan}
                />
            );
        };

  return (
    <div className="space-y-6 pb-24 max-w-2xl mx-auto animate-fade-in" role="main" aria-label="Recipe finder">
      <div className="sticky top-0 z-40 bg-theme-primary py-3 -mx-4 px-4 border-b border-theme/40 shadow-sm md:-mx-8 md:px-8">
        <RecipeFinderTabs activeView={activeView} setActiveView={setActiveView} savedCount={savedRecipes.length} />
      </div>

      {activeView === 'saved' ? (
          <PremiumFeature
            feature="savedRecipes"
            user={user}
            limit={10}
            currentCount={savedRecipes.length}
            fallbackMessage="Upgrade to Premium to save more than 10 recipes"
            onUpgrade={() => setActiveTab(Tab.SETTINGS)}
          >
            <RecipeFinderSavedView
              showImportModal={showImportModal}
              setShowImportModal={setShowImportModal}
              recipeSaveLimitExceeded={recipeSaveLimitExceeded}
              savedRecipes={savedRecipes}
              setActiveTab={setActiveTab}
              isLoadingSavedRecipes={isLoadingSavedRecipes}
              savedSort={savedSort}
              setSavedSort={setSavedSort}
              sortedSavedRecipes={sortedSavedRecipes}
              renderRecipeCard={renderRecipeCard}
              onExportRecipes={() => {
                try {
                  const dataStr = JSON.stringify(savedRecipes, null, 2);
                  const blob = new Blob([dataStr], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'saved_recipes.json';
                  document.body.appendChild(a);
                  a.click();
                  setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }, 100);
                  AnalyticsService.trackFeatureUsage('recipe_export', { success: true, count: savedRecipes.length });
                } catch (error: unknown) {
                  const errMsg = error instanceof Error ? error.message : String(error);
                  AnalyticsService.trackFeatureUsage('recipe_export', { success: false, error: errMsg });
                  AnalyticsService.trackError('recipe_export_error', errMsg, 'RecipeFinder');
                  if (addToast) addToast('Failed to export recipes', 'error');
                }
              }}
              onAddManualRecipe={() => {
                const empty: StructuredRecipe & { __editing: boolean } = {
                  title: '',
                  description: '',
                  ingredients: [],
                  instructions: [],
                  cookTime: '',
                  type: 'Dinner',
                  image: '',
                  __editing: true,
                };
                setModalRecipe(empty as StructuredRecipe);
                setModalIsSavedView(false);
                setShowRecipeModal(true);
              }}
            />
          </PremiumFeature>
      ) : (
        <>
          <SmartRecommendations
            inventory={inventory}
            savedRecipes={savedRecipes}
            user={user}
            setActiveTab={setActiveTab}
          />

            <RecipeFinderSearchControls
              specificQuery={specificQuery}
              onSpecificQueryChange={setSpecificQuery}
              onSpecificQueryFocus={() => setShowRecipeAutocomplete(specificQuery.length === 0 && recentRecipeSearches.length > 0)}
              onSpecificQueryBlur={() => setTimeout(() => setShowRecipeAutocomplete(false), 200)}
              onSpecificSearch={handleSpecificSearch}
              loadingState={loadingState}
              voiceSearchSupported={voiceSearchSupported}
              isListening={isListening}
              onStartVoiceSearch={startVoiceSearch}
              showRecipeAutocomplete={showRecipeAutocomplete}
              recentRecipeSearches={recentRecipeSearches}
              onSelectRecentSearch={(recentQuery) => {
                setSpecificQuery(recentQuery);
                saveSearchToHistory(recentQuery, 'recipe');
                setShowRecipeAutocomplete(false);
              }}
              strictMode={strictMode}
              onSetStrictMode={setStrictMode}
              recipeType={recipeType}
              onSetRecipeType={setRecipeType}
              dietaryRestriction={dietaryRestrictions[0] || ''}
              onSetDietaryRestriction={(value) => setDietaryRestrictions(value ? [value] : [])}
              maxPrepTime={maxPrepTime}
              onSetMaxPrepTime={setMaxPrepTime}
              servings={servings}
              onSetServings={setServings}
              maxCookTime={maxCookTime}
              onSetMaxCookTime={setMaxCookTime}
              maxIngredients={maxIngredients}
              onSetMaxIngredients={setMaxIngredients}
              onGenerate={handleGenerate}
            />

            <RecipeFinderResultStates
              loadingState={loadingState}
              searchError={searchError}
              result={result}
              isResultFromCache={isResultFromCache}
              renderRecipeTile={renderRecipeTile}
              onEnableAiSearch={() => {
                setUserGeminiOptIn(user.id, true);
                setSearchError(null);
                setLoadingState(LoadingState.IDLE);
                const params = { ingredients: inventoryString, strictMode: strictMode };
                performSearchRef.current(params);
              }}
              onRetry={() => {
                setSearchError(null);
                setLoadingState(LoadingState.IDLE);
                handleGenerate(new Event('submit') as unknown as React.FormEvent);
              }}
              onSuggestionClick={setSpecificQuery}
            />

            <RecipeFinderPopularSection
              title={intl.formatMessage({ id: 'recipes.popular' })}
              cacheMealTypeFilter={cacheMealTypeFilter}
              setCacheMealTypeFilter={setCacheMealTypeFilter}
              cacheCuisineFilter={cacheCuisineFilter}
              setCacheCuisineFilter={setCacheCuisineFilter}
              cacheMeatFilter={cacheMeatFilter}
              setCacheMeatFilter={setCacheMeatFilter}
              availableCuisineFilters={availableCuisineFilters}
              openRecipeModal={openRecipeModal}
              onAddToPlan={onAddToPlan}
              user={user}
              household={household}
              filteredFirebaseRecipes={
                firebaseRecipes.length > 0 || !firebaseRecipesLoading
                  ? filteredFirebaseRecipes
                  : filteredFallbackRecipes
              }
              onSearchEntireDatabase={handleSearchEntireDatabase}
            />

        </>
      )}

            <RecipeFinderModalSection
                showRecipeModal={showRecipeModal}
                modalRecipe={modalRecipe}
                setShowRecipeModal={setShowRecipeModal}
                onAddToPlan={onAddToPlan}
                handleModalSaveRecipe={handleModalSaveRecipe}
                onDeleteRecipe={onDeleteRecipe}
                onRate={onRate}
                onMarkAsMade={onMarkAsMade}
                modalIsSavedView={modalIsSavedView}
                recipeSaveLimitExceeded={recipeSaveLimitExceeded}
                mealPlanLimitExceeded={mealPlanLimitExceeded}
                savedRecipesCount={savedRecipes.length}
                user={user}
                inventory={inventory}
            />
    </div>
  );
};

export const RecipeFinder = React.memo(RecipeFinderComponent);