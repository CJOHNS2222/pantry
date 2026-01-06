import React, { useState, useEffect } from 'react';
import { CalendarClock, Plus, Move, AlertCircle, ShoppingBasket, Trash2, Grid3X3, List } from 'lucide-react';
import { DayPlan, MealPlanItem, PantryItem, StructuredRecipe, User } from '../types';
import RecipeModal from './RecipeModal';
import { PremiumFeature } from './PremiumFeature';
import { GroceryCostEstimator } from './GroceryCostEstimator';
import { Tab } from '../types/app';

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
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

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
    return [...new Set(missing)];
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

        <div className="flex gap-1 bg-theme-secondary rounded-xl p-1 mb-6">
          <button
            onClick={() => setViewMode('list')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm ${
              viewMode === 'list'
                ? 'bg-[var(--accent-color)] text-white shadow-md'
                : 'text-theme-primary opacity-70 hover:opacity-100'
            }`}
          >
            <List className="w-4 h-4" /> List
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm ${
              viewMode === 'calendar'
                ? 'bg-[var(--accent-color)] text-white shadow-md'
                : 'text-theme-primary opacity-70 hover:opacity-100'
            }`}
          >
            <Grid3X3 className="w-4 h-4" /> Calendar
          </button>
        </div>

        {/* Calendar View */}
        {viewMode === 'calendar' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {mealPlan.map((day, dayIndex) => (
                <div
                  key={dayIndex}
                  onDragOver={(e) => handleDragOver(e, dayIndex)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, dayIndex)}
                  className={`bg-theme-secondary rounded-lg p-3 min-h-[250px] border-2 transition-all cursor-move flex flex-col ${
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
                                  onClick={() => { setModalRecipe(meal.recipe); setShowRecipeModal(true); }}
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
        )}

        {/* List View */}
        {viewMode === 'list' && (
        <div className="space-y-3">
          {mealPlan.map((day, dayIndex) => (
            <div 
              key={dayIndex}
              onDragOver={(e) => handleDragOver(e, dayIndex)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, dayIndex)}
              className={`bg-theme-secondary p-4 rounded-xl border-2 shadow-sm min-h-[120px] transition-all duration-200 ${
                dragOverDay === dayIndex
                  ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5 shadow-lg scale-[1.02]'
                  : 'border-theme'
              }`}
            >
              <div className="flex justify-between items-start mb-3 pointer-events-none">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-theme-primary">{day.dayName}</h3>
                  <p className="text-xs opacity-50 font-mono">{day.date}</p>
                </div>
                {dragOverDay === dayIndex && (
                  <div className="text-[var(--accent-color)] font-semibold text-sm animate-pulse">
                    Drop here
                  </div>
                )}
              </div>

              {/* Meal sections */}
              <div className="space-y-4">
                {['Breakfast', 'Lunch', 'Dinner'].map((mealType) => {
                  const mealTypeKey = mealType.toLowerCase() as 'breakfast' | 'lunch' | 'dinner';
                  const mealsForType = day[mealTypeKey] || [];

                  return (
                    <div key={mealType} className="space-y-2">
                      <div className="text-xs font-semibold text-theme-primary opacity-70 uppercase tracking-wider">
                        {mealType}
                      </div>
                      <div 
                        className={`min-h-[60px] border-2 border-dashed rounded-lg p-3 space-y-2 transition-all duration-200 ${
                          dragOverMealType?.dayIndex === dayIndex && dragOverMealType?.mealType === mealTypeKey
                            ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/10 shadow-lg'
                            : dragOverDay === dayIndex
                            ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5'
                            : 'border-theme/30'
                        }`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDragOver(e, dayIndex, mealTypeKey);
                        }}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDrop(e, dayIndex, mealTypeKey);
                        }}
                      >
                        {mealsForType.length === 0 ? (
                          <div className={`h-8 flex items-center justify-center text-xs transition-opacity ${
                            dragOverMealType?.dayIndex === dayIndex && dragOverMealType?.mealType === mealTypeKey
                              ? 'opacity-100 text-[var(--accent-color)] font-semibold'
                              : dragOverDay === dayIndex
                              ? 'opacity-70 text-[var(--accent-color)]'
                              : 'opacity-40'
                          }`}>
                            {dragOverMealType?.dayIndex === dayIndex && dragOverMealType?.mealType === mealTypeKey
                              ? `Drop ${mealType.toLowerCase()} here`
                              : dragOverDay === dayIndex
                              ? 'Drop meal here'
                              : 'Drop meal here'
                            }
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
                              className={`bg-theme-primary border rounded-md p-3 flex justify-between items-center cursor-move hover:border-[var(--accent-color)]/50 group shadow-sm active:cursor-grabbing transition-all duration-200 ${
                                draggedMeal?.dayIndex === dayIndex && draggedMeal?.mealType === mealTypeKey && draggedMeal?.mealIndex === mealIndex
                                  ? 'opacity-50 scale-95'
                                  : ''
                              }`}
                              onClick={() => { setModalRecipe(meal.recipe); setShowRecipeModal(true); }}
                            >
                              <div className="flex-1 min-w-0">
                                <span className="text-[var(--accent-color)] font-semibold text-sm">
                                  {meal.recipe.title}
                                </span>
                                <span className="text-xs opacity-60 ml-2">
                                  • {meal.recipe.cookTime}
                                </span>
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeMeal(dayIndex, mealTypeKey, mealIndex);
                                }}
                                className="text-theme-secondary opacity-30 hover:opacity-100 p-1 ml-1 transition-opacity"
                              >
                                 <Trash2 className="w-3 h-3" />
                              </button>
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
      {/* Modal for full recipe details */}
      {showRecipeModal && modalRecipe && (
        <RecipeModal
          recipe={modalRecipe}
          isOpen={showRecipeModal}
          onClose={() => setShowRecipeModal(false)}
          onAddToPlan={onAddToPlan}
          onSaveRecipe={onSaveRecipe}
          onMarkAsMade={onMarkAsMade}
          showSaveButton={true}
          showMarkAsMade={true}
          showAddToPlan={true}
        />
      )}
    </div>
  );
};