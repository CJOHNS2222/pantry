import React, { useState, useEffect } from 'react';
import { CalendarClock, Plus, Move, AlertCircle, ShoppingBasket, Trash2 } from 'lucide-react';
import { DayPlan, MealPlanItem, PantryItem, StructuredRecipe, User, SavedRecipe } from '../types';
import RecipeModal from './RecipeModal';
import { PremiumFeature } from './PremiumFeature';
import { GroceryCostEstimator } from './GroceryCostEstimator';
import { Tab } from '../types/app';
import { searchRecipes } from '../services/geminiService';
import { getSavedRecipes } from '../services/recipeService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { parseIngredientForShoppingList } from '../utils/appUtils';

interface MealPlannerProps {
  mealPlan: DayPlan[];
  setMealPlan: React.Dispatch<React.SetStateAction<DayPlan[]>>;
  inventory: PantryItem[];
  addToShoppingList: (items: string[]) => void;
  onAddToPlan?: (recipe: StructuredRecipe) => void;
  onSaveRecipe?: (recipe: StructuredRecipe) => void;
  onMarkAsMade?: (recipe: StructuredRecipe) => void;
  user: User;
  setActiveTab: (tab: Tab) => void;
}

interface RecipeSearchModalProps {
  mealType: 'breakfast' | 'lunch' | 'dinner';
  dayIndex: number;
  onAddRecipe: (recipe: StructuredRecipe) => void;
  onClose: () => void;
  inventory: PantryItem[];
  user: User;
}

const RecipeSearchModal: React.FC<RecipeSearchModalProps> = ({
  mealType,
  dayIndex,
  onAddRecipe,
  onClose,
  inventory,
  user
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StructuredRecipe[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);

  // Load saved recipes on mount
  useEffect(() => {
    const loadSavedRecipes = async () => {
      try {
        // Load user-specific saved recipes
        const userSaved = await getDocs(collection(db, 'users', user.id, 'savedRecipes'));
        const userRecipes = userSaved.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavedRecipe));

        // Load global recipe database
        const globalRecipes = await getSavedRecipes();

        // Combine and deduplicate recipes (user recipes take precedence)
        const allRecipes = [...globalRecipes];
        userRecipes.forEach(userRecipe => {
          const existingIndex = allRecipes.findIndex(r => r.title === userRecipe.title);
          if (existingIndex >= 0) {
            allRecipes[existingIndex] = userRecipe; // Replace with user version
          } else {
            allRecipes.push(userRecipe);
          }
        });

        setSavedRecipes(allRecipes);
      } catch (error) {
        console.error('Error loading saved recipes:', error);
      }
    };
    loadSavedRecipes();
  }, [user.id]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const pantryIngredients = inventory.map(item => item.item.toLowerCase()).join(', ');
      const result = await searchRecipes({
        query: searchQuery,
        ingredients: pantryIngredients,
        restrictions: '',
        maxCookTime: 60,
        maxIngredients: 15,
        measurementSystem: 'Standard',
        strictMode: false
      });
      setSearchResults(result.recipes || []);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const filteredSavedRecipes = savedRecipes.filter(recipe =>
    recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    recipe.ingredients.some(ing => ing.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
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
        {searchResults.length > 0 && (
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
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = `
                              <div class="w-full h-full flex items-center justify-center bg-theme-primary/10">
                                <svg class="w-6 h-6 text-theme-secondary opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                                </svg>
                              </div>
                            `;
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-theme-primary/10">
                        <svg className="w-6 h-6 text-theme-secondary opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
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
                          onAddRecipe(recipe);
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

        {filteredSavedRecipes.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-theme-secondary mb-2">Saved Recipes</h4>
            {filteredSavedRecipes.map((recipe) => (
              <div key={recipe.id} className="bg-theme-secondary rounded-lg p-3 mb-2">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h5 className="font-semibold text-theme-primary">{recipe.title}</h5>
                    <p className="text-sm text-theme-primary opacity-70">{recipe.cookTime}</p>
                    <p className="text-xs text-theme-primary opacity-50 mt-1">
                      {recipe.ingredients.length} ingredients
                    </p>
                  </div>
                  <button
                    onClick={() => onAddRecipe(recipe)}
                    className="px-3 py-1 bg-[var(--accent-color)] text-white rounded text-sm hover:bg-[var(--accent-color)]/90"
                  >
                    Add
                  </button>
                </div>
              </div>
            ))}
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

export const MealPlanner: React.FC<MealPlannerProps> = ({ mealPlan, setMealPlan, inventory, addToShoppingList, onAddToPlan, onSaveRecipe, onMarkAsMade, user, setActiveTab }) => {
    // List of staple items to ignore
    const STAPLES = ['salt', 'pepper', 'oil', 'water', 'flour', 'sugar', 'butter', 'vinegar', 'baking powder', 'baking soda', 'spices', 'seasoning', 'soy sauce', 'cornstarch', 'yeast'];
  const [draggedMeal, setDraggedMeal] = useState<{ dayIndex: number, mealType: string, mealIndex: number } | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [dragOverMealType, setDragOverMealType] = useState<{ dayIndex: number, mealType: string } | null>(null);
  const [missingItemsCount, setMissingItemsCount] = useState(0);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [modalRecipe, setModalRecipe] = useState<StructuredRecipe | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverTrash, setDragOverTrash] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [showRecipeSearch, setShowRecipeSearch] = useState(false);
  const [searchMealType, setSearchMealType] = useState<'breakfast' | 'lunch' | 'dinner' | null>(null);
  const [modalContext, setModalContext] = useState<'search' | 'scheduled' | null>(null);

  // Function to clean ingredient names by removing descriptive words
  const getMissingIngredients = () => {
    const allNeededIngredients = mealPlan.flatMap(day => 
      [...(day.breakfast || []), ...(day.lunch || []), ...(day.dinner || [])].flatMap(meal => meal.recipe.ingredients)
    );
    // Filter out staple items
    const missing = allNeededIngredients.filter(needed => {
      const neededLower = needed.toLowerCase();
      if (STAPLES.some(staple => neededLower.includes(staple))) return false;
      return !inventory.some(pantryItem => 
        neededLower.includes(pantryItem.item.toLowerCase()) || 
        pantryItem.item.toLowerCase().includes(neededLower)
      );
    });

    // Clean ingredient names before returning
    return [...new Set(missing.map(ingredient => parseIngredientForShoppingList(ingredient).itemName))];
  };

  useEffect(() => {
    setMissingItemsCount(getMissingIngredients().length);
  }, [mealPlan, inventory]);

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
    const missing = getMissingIngredients();
    if (missing.length > 0) {
        addToShoppingList(missing);
        alert(`Added ${missing.length} items to your shopping list.`);
    }
  };

  const removeMeal = (dayIndex: number, mealType: string, mealIndex: number) => {
      const newPlan = [...mealPlan];
      const mealTypeKey = mealType as 'breakfast' | 'lunch' | 'dinner';
      if (!newPlan[dayIndex][mealTypeKey]) newPlan[dayIndex][mealTypeKey] = [];
      newPlan[dayIndex][mealTypeKey] = newPlan[dayIndex][mealTypeKey].filter((_, i) => i !== mealIndex);
      setMealPlan(newPlan);
  };

  return (
    <div className="space-y-6 pb-24 animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-serif font-bold text-theme-secondary">Meal Schedule</h2>
        <p className="text-theme-secondary opacity-60 text-sm mt-1">Plan your week ahead</p>
      </div>

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

        {/* Calendar Grid */}
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {mealPlan.map((day, dayIndex) => (
              <div
                key={dayIndex}
                onClick={() => setSelectedDayIndex(dayIndex)}
                onDragOver={(e) => handleDragOver(e, dayIndex)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, dayIndex)}
                className={`bg-theme-secondary rounded-lg p-3 min-h-[250px] border-2 transition-all cursor-pointer flex flex-col hover:shadow-lg hover:scale-[1.02] ${
                  dragOverDay === dayIndex
                    ? 'border-[var(--accent-color)] shadow-lg'
                    : 'border-theme'
                }`}
              >
                <div className="mb-2">
                  <h3 className="text-sm font-bold text-theme-primary">{day.dayName}</h3>
                  <p className="text-xs opacity-50 font-mono">{day.date}</p>
                </div>

                <div className="space-y-1 flex-1 overflow-y-auto text-xs">
                  {['Breakfast', 'Lunch', 'Dinner'].map((mealType) => {
                    const mealTypeKey = mealType.toLowerCase() as 'breakfast' | 'lunch' | 'dinner';
                    const mealsForType = day[mealTypeKey] || [];

                    return (
                      <div key={mealType} className="space-y-1">
                        <div className="text-[10px] font-semibold text-theme-primary opacity-60 uppercase">
                          {mealType.slice(0, 1)}
                        </div>
                        <div className="space-y-1">
                          {mealsForType.length === 0 ? (
                            <div className="h-6 flex items-center text-[9px] opacity-30">
                              —
                            </div>
                          ) : (
                            mealsForType.map((meal, mealIndex) => (
                              <div
                                key={meal.id}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', `${mealTypeKey}-${mealIndex}`);
                                  handleDragStart(e, dayIndex, mealTypeKey, mealIndex);
                                }}
                                onDragEnd={handleDragEnd}
                                className={`bg-theme-primary border rounded p-1 text-[9px] cursor-move group shadow-sm active:cursor-grabbing transition-all truncate hover:opacity-50 ${
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
                                <span className="text-[var(--accent-color)] font-semibold truncate block">
                                  {meal.recipe.title}
                                </span>
                              </div>
                            ))
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
                  >
                    ›
                  </button>
                  <button
                    onClick={() => setSelectedDayIndex(null)}
                    className="text-theme-secondary opacity-60 hover:opacity-100 p-2"
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
                                >
                                  👁
                                </button>
                                <button
                                  onClick={() => removeMeal(selectedDayIndex, mealTypeKey, mealIndex)}
                                  className="text-red-400 opacity-60 hover:opacity-100 p-2"
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
                onAddRecipe={(recipe) => {
                  const newPlan = [...mealPlan];
                  if (!newPlan[selectedDayIndex!][searchMealType]) {
                    newPlan[selectedDayIndex!][searchMealType] = [];
                  }
                  newPlan[selectedDayIndex!][searchMealType].push({
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
          onAddToPlan={modalContext === 'search' ? onAddToPlan : undefined}
          onSaveRecipe={onSaveRecipe}
          onMarkAsMade={modalContext === 'scheduled' ? onMarkAsMade : undefined}
          showSaveButton={true}
          showMarkAsMade={modalContext === 'scheduled'}
          showAddToPlan={modalContext === 'search'}
          user={user}
        />
      )}
    </div>
  );
};