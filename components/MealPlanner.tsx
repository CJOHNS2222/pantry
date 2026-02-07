import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CalendarClock, Plus, Move, AlertCircle, ShoppingBasket, Trash2, HelpCircle } from 'lucide-react';
import { DayPlan, MealPlanItem, PantryItem, StructuredRecipe, User, SavedRecipe, ShoppingItem } from '../types';
import RecipeModal from './RecipeModal';
import { MealPrepPlanner } from './MealPrepPlanner';
import { PremiumFeature } from './PremiumFeature';
import { GroceryCostEstimator } from './GroceryCostEstimator';
import { Tab } from '../types/app';
import { searchRecipes as searchRecipesGemini } from '../services/geminiService';
import { getSavedRecipes } from '../services/recipeService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { parseIngredientForShoppingList } from '../utils/appUtils';
import AnalyticsService from '../services/analyticsService';
import { searchRecipes } from '../utils/searchUtils';
import { debounce } from '../utils/debounceUtils';
import { CompactRecipeCardSkeleton, MealPlanSkeleton } from './SkeletonLoader';
import { getMealPrepSuggestions, RecipeIngredientMatch } from '../utils/searchUtils';
// import CalendarService from '../services/calendarService'; // Temporarily disabled

interface MealPlannerProps {
  mealPlan: DayPlan[];
  setMealPlan: React.Dispatch<React.SetStateAction<DayPlan[]>>;
  inventory: PantryItem[];
  shoppingList: ShoppingItem[];
  addToShoppingList: (items: string[]) => void;
  onAddToPlan?: (recipe: StructuredRecipe) => void;
  onSaveRecipe?: (recipe: StructuredRecipe) => void;
  onMarkAsMade?: (recipe: StructuredRecipe) => void;
  onRate?: (rating: any) => void;
  user: User;
  setActiveTab: (tab: Tab) => void;
  recipeSaveLimitExceeded?: boolean;
  mealPlanLimitExceeded?: boolean;
  isLoadingMealPlan?: boolean;
  isLoadingSavedRecipes?: boolean;
  savedRecipes?: SavedRecipe[];
  settings?: {
    notifications: {
      enabled: boolean;
      time: string;
      types: {
        shoppingList: boolean;
        mealPlan: boolean;
        cookingReminders?: boolean;
      };
      cookingReminderTime?: number;
    };
  };
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
  onClose,
  inventory,
  user,
  savedRecipes: propSavedRecipes
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StructuredRecipe[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>(propSavedRecipes);
  const [recipesLoaded, setRecipesLoaded] = useState(true); // Already loaded from props

  // Update saved recipes when prop changes
  useEffect(() => {
    setSavedRecipes(propSavedRecipes);
  }, [propSavedRecipes]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const pantryIngredients = inventory.map(item => item.item.toLowerCase()).join(', ');
      const result = await searchRecipesGemini({
        query: searchQuery,
        ingredients: pantryIngredients,
        restrictions: '',
        maxCookTime: 60,
        maxIngredients: 15,
        measurementSystem: 'Standard',
        strictMode: false,
        userId: user?.id
      }, user);
      setSearchResults(result.recipes || []);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search function for input changes
  const debouncedSearch = useMemo(
    () => debounce(() => {
      if (searchQuery.trim()) {
        handleSearch();
      }
    }, 500), // 500ms delay
    [searchQuery]
  );

  // Effect to trigger debounced search when query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      debouncedSearch();
    }
  }, [searchQuery, debouncedSearch]);

  const filteredSavedRecipes = useMemo(() => 
    searchRecipes(savedRecipes, searchQuery)
      .filter((recipe, index, self) =>
        index === self.findIndex(r => r.title === recipe.title)
      ),
    [savedRecipes, searchQuery]
  );

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="flex gap-2">
        <input
          id="searchQuery"
          name="searchQuery"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search for ${mealType} recipes...`}
          className="flex-1 px-4 py-2 bg-theme-secondary border border-theme rounded-lg text-theme-primary placeholder-theme-primary/50 focus:border-[var(--accent-color)] focus:outline-none"
        />
        <button
          onClick={handleSearch}
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
            <h4 className="text-sm font-semibold text-theme-secondary mb-2">Search Results</h4>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <CompactRecipeCardSkeleton key={`search-skeleton-${index}`} />
              ))}
            </div>
          </div>
        )}
        {searchResults.length > 0 && !isSearching && (
          <div>
            <h4 className="text-sm font-semibold text-theme-secondary mb-2">Search Results</h4>
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
                      <img
                        src={recipe.image}
                        alt={recipe.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = `
                              <div class="w-full h-full flex items-center justify-center bg-theme-primary/10">
                                <svg class="w-6 h-6 text-theme-secondary opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                                </svg>
                              </div>
                            `;
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-theme-primary/10">
                        <svg className="w-6 h-6 text-theme-secondary opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                        </svg>
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

        {!recipesLoaded && (
          <div>
            <h4 className="text-sm font-semibold text-theme-secondary mb-2">Saved Recipes</h4>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <CompactRecipeCardSkeleton key={`saved-skeleton-${index}`} />
              ))}
            </div>
          </div>
        )}
        {filteredSavedRecipes.length > 0 && recipesLoaded && (
          <div>
            <h4 className="text-sm font-semibold text-theme-secondary mb-2">Saved Recipes</h4>
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
                      <img
                        src={recipe.image}
                        alt={recipe.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = `
                              <div class="w-full h-full flex items-center justify-center bg-theme-primary/10">
                                <svg class="w-6 h-6 text-theme-secondary opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                                </svg>
                              </div>
                            `;
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-theme-primary/10">
                        <svg className="w-6 h-6 text-theme-secondary opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                        </svg>
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

        {!isSearching && searchQuery && searchResults.length === 0 && filteredSavedRecipes.length === 0 && (
          <div className="text-center py-8 text-theme-primary opacity-50">
            No recipes found. Try a different search term.
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

export const MealPlanner: React.FC<MealPlannerProps> = ({ mealPlan, setMealPlan, inventory, shoppingList, addToShoppingList, onAddToPlan, onSaveRecipe, onMarkAsMade, onRate, user, setActiveTab, recipeSaveLimitExceeded = false, mealPlanLimitExceeded = false, isLoadingMealPlan = false, isLoadingSavedRecipes = false, savedRecipes: propSavedRecipes = [], settings, onOpenRecipeSearch }) => {
    // List of staple items to ignore (unless user wants them included)
    const STAPLES = ['salt', 'pepper', 'oil', 'water', 'flour', 'sugar', 'butter', 'vinegar', 'baking powder', 'baking soda', 'spices', 'seasoning', 'soy sauce', 'cornstarch', 'yeast'];
    const includeStaples = settings?.shopping?.includeStaples || false;
  const [draggedMeal, setDraggedMeal] = useState<{ dayIndex: number, mealType: string, mealIndex: number } | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [dragOverMealType, setDragOverMealType] = useState<{ dayIndex: number, mealType: string } | null>(null);
  const [missingItemsCount, setMissingItemsCount] = useState(0);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [modalRecipe, setModalRecipe] = useState<StructuredRecipe | null>(null);
  const [modalContext, setModalContext] = useState<'search' | 'scheduled'>('search');
  const [showHelpTooltip, setShowHelpTooltip] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  // Use prop savedRecipes or local state as fallback
  const [localSavedRecipes, setLocalSavedRecipes] = useState<SavedRecipe[]>([]);
  const savedRecipes = propSavedRecipes.length > 0 ? propSavedRecipes : localSavedRecipes;

  const [isDragging, setIsDragging] = useState(false);
  const [dragOverTrash, setDragOverTrash] = useState(false);
  const [showRecipeSearch, setShowRecipeSearch] = useState(false);
  const [searchMealType, setSearchMealType] = useState<'breakfast' | 'lunch' | 'dinner' | null>(null);
  const [showMealPrepPlanner, setShowMealPrepPlanner] = useState(false);
  const [showAddMealDialog, setShowAddMealDialog] = useState(false);
  const [pendingRecipe, setPendingRecipe] = useState<StructuredRecipe | null>(null);

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

  // Memoized missing ingredients computation
  const missingIngredients = useMemo(() => {
    const missingWithRecipes = mealPlan.flatMap(day => 
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
        acc[key] = {
          ingredient: parsed.itemName,
          quantity: 0, // Will be calculated
          unit: parsed.quantity.includes(' ') ? parsed.quantity.split(' ')[1] : 'count',
          recipes: []
        };
      }
      
      // Add quantity (parse numeric value)
      const qtyValue = parseFloat(parsed.quantity.split(' ')[0]) || 1;
      acc[key].quantity += qtyValue;
      
      // Track recipes
      if (!acc[key].recipes.some(r => r.id === item.recipeId)) {
        acc[key].recipes.push({ name: item.recipeName, id: item.recipeId });
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
  }, [mealPlan, inventory, shoppingList, includeStaples]);

  // Legacy function for backward compatibility
  const getMissingIngredients = () => missingIngredients;

  useEffect(() => {
    setMissingItemsCount(missingIngredients.length);
  }, [missingIngredients]);

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
      const { recipe, isSavedView } = event.detail;
      setModalRecipe(recipe);
      setModalContext('search');
      setShowRecipeModal(true);
    };

    window.addEventListener('openRecipeModal', handleOpenRecipeModal as EventListener);

    return () => {
      window.removeEventListener('openRecipeModal', handleOpenRecipeModal as EventListener);
    };
  }, []);

  const handleDragStart = (e: React.DragEvent, dayIndex: number, mealType: string, mealIndex: number) => {
    setDraggedMeal({ dayIndex, mealType, mealIndex });
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";
    // Add some visual feedback
    e.dataTransfer.setData('text/plain', `${dayIndex}-${mealType}-${mealIndex}`);
  };

  const handleDragEnd = () => {
    setDraggedMeal(null);
    setDragOverDay(null);
    setDragOverMealType(null);
    setDragOverTrash(false);
    setIsDragging(false);
  };

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
      
      setMealPlan(newPlan);
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

    setMealPlan(newPlan);
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
      
      // Add each item with its specific recipe source
      itemsToAdd.forEach(item => {
        addToShoppingList([item.ingredient], item.source);
      });
      
      alert(`Added ${missing.length} items to your shopping list.`);
    }
  };

  const handleCalendarExport = async () => {
    try {
      const successCount = 0;
      const totalEvents = 0;

      // Temporarily disabled calendar integration due to plugin compatibility issues
      /*
      for (const day of mealPlan) {
        if (day.meals.some(meal => meal.recipe)) {
          const date = new Date(day.date);
          const success = await CalendarService.createMealPlanEvent(day, date);
          if (success) {
            successCount++;
          }
          totalEvents++;
        }
      }
      */

      if (successCount > 0) {
        alert(`Successfully added ${successCount} meal plan${successCount > 1 ? 's' : ''} to your calendar!`);
        AnalyticsService.trackEvent('calendar_export_success', { events_added: successCount });
      } else if (totalEvents === 0) {
        alert('No meal plans with recipes found to export. Add some recipes to your meal plan first!');
      } else {
        alert('Calendar export failed. Please check calendar permissions and try again.');
        AnalyticsService.trackEvent('calendar_export_failed', { reason: 'permissions_or_plugin' });
      }
    } catch (error) {
      console.error('Calendar export error:', error);
      alert('Failed to export to calendar. Please try again.');
      AnalyticsService.trackEvent('calendar_export_error', { error: error.message });
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
      setMealPlan(newPlan);
  };

  // Helper function to check if a day is today
  const isToday = (dateString: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateString === today;
  };

  // Get today's meals for highlighting
  const todaysMeals = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayPlan = mealPlan.find(day => day.date === today);
    if (!todayPlan) return [];
    
    return [
      ...(todayPlan.breakfast || []),
      ...(todayPlan.lunch || []),
      ...(todayPlan.dinner || [])
    ];
  }, [mealPlan]);

  return (
    <div className="space-y-6 pb-24 animate-fade-in">
      <div className="text-center mb-2 relative">
        <div className="flex items-center justify-center gap-2 mb-2">
          <h2 className="text-3xl font-serif font-bold text-theme-secondary">Meal Schedule</h2>
        </div>
        <p className="text-theme-secondary opacity-60 text-sm mt-1">Plan your week ahead</p>
        
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

      {/* Help Button - positioned absolutely on the right */}
      <button
        onClick={() => setShowHelpTooltip(!showHelpTooltip)}
        className="absolute top-4 right-4 p-2 rounded-full hover:bg-theme-secondary/10 transition-colors z-10"
        title="Help"
      >
        <HelpCircle className="w-5 h-5 text-theme-secondary opacity-60 hover:opacity-100" />
      </button>

      {/* Meal Prep Planner Button */}
      <button
        onClick={() => setShowMealPrepPlanner(true)}
        className="absolute top-4 right-16 p-2 rounded-full hover:bg-theme-secondary/10 transition-colors z-10"
        title="Smart Meal Prep Planner"
      >
        <CalendarClock className="w-5 h-5 text-theme-secondary opacity-60 hover:opacity-100" />
      </button>

      {/* Calendar Export Button */}
      <button
        onClick={handleCalendarExport}
        className="absolute top-4 right-28 p-2 rounded-full hover:bg-theme-secondary/10 transition-colors z-10"
        title="Export to Calendar"
      >
        📅
      </button>

      <PremiumFeature
        feature="mealPlanning"
        user={user}
        limit={10}
        currentCount={mealPlan.reduce((total, day) => total + (day.breakfast?.length || 0) + (day.lunch?.length || 0) + (day.dinner?.length || 0), 0)}
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

        <GroceryCostEstimator mealPlan={mealPlan} inventory={inventory} />

        {/* Today's Meals Highlight */}
        {todaysMeals.length > 0 && (
          <div className="bg-gradient-to-r from-[var(--accent-color)]/10 to-[var(--accent-color)]/5 border border-[var(--accent-color)]/20 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock className="w-5 h-5 text-[var(--accent-color)]" />
              <h3 className="font-semibold text-theme-primary">Today's Meals</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {todaysMeals.map((meal, index) => (
                <div
                  key={meal.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalRecipe(meal.recipe);
                    setModalContext('scheduled');
                    setShowRecipeModal(true);
                  }}
                  className="bg-theme-secondary/80 backdrop-blur-sm border border-[var(--accent-color)]/30 rounded-lg p-3 cursor-pointer hover:bg-theme-secondary transition-all hover:shadow-md"
                >
                  <div className="text-xs font-semibold text-[var(--accent-color)] mb-1 uppercase">
                    {index < todaysMeals.length / 3 ? 'Breakfast' : index < (todaysMeals.length * 2) / 3 ? 'Lunch' : 'Dinner'}
                  </div>
                  <div className="text-sm font-medium text-theme-primary truncate">
                    {meal.recipe.title}
                  </div>
                  <div className="text-xs text-theme-secondary opacity-60 mt-1">
                    Click to view recipe
                  </div>
                </div>
              ))}
            </div>
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
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 7 }).map((_, index) => (
                <MealPlanSkeleton key={`loading-${index}`} />
              ))}
            </div>
          </div>
        ) : (
          /* Calendar Grid */
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {mealPlan.map((day, dayIndex) => (
              <div
                key={dayIndex}
                onClick={() => setSelectedDayIndex(dayIndex)}
                className={`bg-theme-secondary rounded-lg p-3 min-h-[250px] border-2 transition-all cursor-pointer flex flex-col hover:shadow-lg hover:scale-[1.02] ${
                  isToday(day.date)
                    ? 'border-[var(--accent-color)] bg-gradient-to-br from-[var(--accent-color)]/5 to-transparent shadow-md ring-1 ring-[var(--accent-color)]/20'
                    : 'border-theme'
                }`}
              >
                <div className="mb-2">
                  <h3 className={`text-sm font-bold ${isToday(day.date) ? 'text-[var(--accent-color)]' : 'text-theme-primary'}`}>
                    {day.dayName}
                    {isToday(day.date) && <span className="ml-1 text-xs">📅</span>}
                  </h3>
                  <p className={`text-xs font-mono ${isToday(day.date) ? 'text-[var(--accent-color)] font-semibold' : 'opacity-50'}`}>
                    {day.date}
                  </p>
                </div>

                <div className="space-y-1 flex-1 overflow-y-auto text-xs">
                  {['Breakfast', 'Lunch', 'Dinner'].map((mealType) => {
                    const mealTypeKey = mealType.toLowerCase() as 'breakfast' | 'lunch' | 'dinner';
                    const mealsForType = day[mealTypeKey] || [];

                    return (
                      <div 
                        key={mealType} 
                        className={`space-y-1 p-1 rounded transition-colors ${
                          dragOverMealType?.dayIndex === dayIndex && dragOverMealType?.mealType === mealTypeKey
                            ? 'bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/30'
                            : 'hover:bg-theme-primary/20'
                        }`}
                        onDragOver={(e) => handleDragOver(e, dayIndex, mealTypeKey)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, dayIndex, mealTypeKey)}
                      >
                        <div className="text-[10px] font-semibold text-theme-primary opacity-60 uppercase">
                          {mealType.slice(0, 1)}
                        </div>
                        <div className="space-y-1">
                          {mealsForType.length === 0 ? (
                            <div className="h-6 flex items-center text-[9px] opacity-30">
                              Drop here
                            </div>
                          ) : (
                            mealsForType.map((meal, mealIndex) => {
                              return (
                                <div
                                  key={meal.id}
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', `${mealTypeKey}-${mealIndex}`);
                                    handleDragStart(e, dayIndex, mealTypeKey, mealIndex);
                                  }}
                                  onDragEnd={handleDragEnd}
                                  className={`bg-theme-primary/60 border border-theme/30 rounded-md p-1.5 text-[9px] cursor-pointer group shadow-sm active:cursor-grabbing transition-all truncate hover:opacity-80 hover:bg-theme-primary/80 hover:border-[var(--accent-color)]/40 hover:shadow-md flex items-center justify-between gap-1 ${
                                    draggedMeal?.dayIndex === dayIndex && draggedMeal?.mealType === mealTypeKey && draggedMeal?.mealIndex === mealIndex
                                      ? 'opacity-50 scale-95'
                                      : ''
                                  }`}
                                  onClick={(e) => { 
                                    e.stopPropagation();
                                    setModalRecipe(meal.recipe);
                                    setModalContext('scheduled');
                                    setShowRecipeModal(true); 
                                  }}
                                  title={meal.recipe.title}
                                >
                                  <span className="text-[var(--accent-color)] font-semibold truncate flex-1">
                                    {meal.recipe.title}
                                  </span>
                                  <span className="text-[8px] opacity-60 group-hover:opacity-80">👁️</span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
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
      
      {/* Day Detail Modal */}
      {selectedDayIndex !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-theme-primary rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-theme">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSelectedDayIndex(Math.max(0, selectedDayIndex - 1))}
                  disabled={selectedDayIndex === 0}
                  className="text-theme-secondary opacity-60 hover:opacity-100 p-2 disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Previous day"
                >
                  ‹
                </button>
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-theme-secondary">
                    {mealPlan[selectedDayIndex].dayName}
                  </h2>
                  <p className="text-theme-secondary opacity-60">{mealPlan[selectedDayIndex].date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedDayIndex(Math.min(mealPlan.length - 1, selectedDayIndex + 1))}
                    disabled={selectedDayIndex === mealPlan.length - 1}
                    className="text-theme-secondary opacity-60 hover:opacity-100 p-2 disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Next day"
                  >
                    ›
                  </button>
                  <button
                    onClick={() => setSelectedDayIndex(null)}
                    className="text-theme-secondary opacity-60 hover:opacity-100 p-2"
                    aria-label="Close day details"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
              <div className="space-y-6">
                {['Breakfast', 'Lunch', 'Dinner'].map((mealType) => {
                  const mealTypeKey = mealType.toLowerCase() as 'breakfast' | 'lunch' | 'dinner';
                  const mealsForType = mealPlan[selectedDayIndex][mealTypeKey] || [];

                  return (
                    <div key={mealType} className="space-y-3">
                      <h3 className="text-lg font-semibold text-theme-secondary">{mealType}</h3>
                      
                      {mealsForType.length === 0 ? (
                        <button
                          onClick={() => {
                            setSearchMealType(mealTypeKey);
                            setShowRecipeSearch(true);
                          }}
                          data-tutorial="add-recipe-button"
                          className="w-full border-2 border-dashed border-theme/50 rounded-lg p-4 text-center hover:border-[var(--accent-color)] hover:bg-[var(--accent-color)]/5 transition-all"
                        >
                          <Plus className="w-8 h-8 mx-auto mb-2 text-theme-secondary opacity-50" />
                          <span className="text-theme-secondary opacity-70">Add Recipe</span>
                        </button>
                      ) : (
                        <div className="space-y-3">
                          {mealsForType.map((meal, mealIndex) => (
                            <div
                              key={meal.id}
                              className="bg-theme-secondary rounded-lg p-4 flex justify-between items-center"
                            >
                              <div className="flex-1">
                                <span className="text-[var(--accent-color)] font-semibold">
                                  {meal.recipe.title}
                                </span>
                                <span className="text-sm opacity-60 ml-2">
                                  • {meal.recipe.cookTime}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setModalRecipe(meal.recipe);
                                    setModalContext('scheduled');
                                    setShowRecipeModal(true);
                                  }}
                                  className="text-theme-secondary opacity-60 hover:opacity-100 p-2"
                                  aria-label={`View recipe: ${meal.recipe.title}`}
                                >
                                  👁
                                </button>
                                <button
                                  onClick={() => removeMeal(selectedDayIndex, mealTypeKey, mealIndex)}
                                  className="text-red-400 opacity-60 hover:opacity-100 p-2"
                                  aria-label={`Remove ${meal.recipe.title} from ${mealTypeKey}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              setSearchMealType(mealTypeKey);
                              setShowRecipeSearch(true);
                            }}
                            data-tutorial="add-recipe-button"
                            className="w-full border border-theme/50 rounded-lg p-3 text-center hover:border-[var(--accent-color)] hover:bg-[var(--accent-color)]/5 transition-all"
                          >
                            <Plus className="w-5 h-5 mx-auto mb-1 text-theme-secondary opacity-50" />
                            <span className="text-sm text-theme-secondary opacity-70">Add Another Recipe</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Search Modal */}
      {showRecipeSearch && searchMealType && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-theme-primary rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-theme">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-theme-secondary">
                    Add {searchMealType.charAt(0).toUpperCase() + searchMealType.slice(1)} Recipe
                  </h2>
                  <p className="text-theme-secondary opacity-60">
                    {mealPlan[selectedDayIndex!].dayName} - {mealPlan[selectedDayIndex!].date}
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
                dayIndex={selectedDayIndex!}
                onAddRecipe={(recipe, dayIndex) => {
                  const newPlan = [...mealPlan];
                  if (!newPlan[dayIndex][searchMealType]) {
                    newPlan[dayIndex][searchMealType] = [];
                  }
                  newPlan[dayIndex][searchMealType].push({
                    id: Date.now().toString(),
                    recipe,
                    mealType: searchMealType
                  });
                  setMealPlan(newPlan);
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
          onAddToPlan={onAddToPlan!}
          onClose={() => setShowMealPrepPlanner(false)}
        />
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
                  onChange={(e) => setSelectedDayIndex(parseInt(e.target.value))}
                  defaultValue=""
                >
                  <option value="" disabled>Select a day...</option>
                  {mealPlan.map((day, index) => (
                    <option key={day.date} value={index}>
                      {day.dayName} - {day.date}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-theme-text mb-2">Select Meal:</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['breakfast', 'lunch', 'dinner'] as const).map((mealType) => (
                    <button
                      key={mealType}
                      onClick={() => selectedDayIndex !== null && confirmAddToPlan(selectedDayIndex, mealType)}
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
                  setSelectedDayIndex(null);
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
