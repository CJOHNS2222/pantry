import React, { useState, useRef } from 'react';
import { Check, Trash2, Calculator, MessageSquare, UserCheck, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { ShoppingItem, StructuredRecipe, SavedRecipe, DayPlan } from '../../types';
import { Tab } from '../../types/app';
import { useApp } from '../../contexts/AppContext';
import { useAppActions } from '../../contexts/AppActionsContext';
import { comparePriceOptions, formatPricePerUnit, getPriceComparisonSummary } from '../../utils/priceCalculator';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import HapticService from '../../services/hapticService';
import { getItemImageLocalPath, parseQuantityAndUnit } from '../../utils/appUtils';
import { getSmartUnits } from '../pantry/QuantityUnitPicker';

const getRecipeTitleFromSource = (source: string | undefined): string => {
  if (!source || !source.startsWith('recipe:')) return '';
  
  if (source.startsWith('recipe: need ')) {
    const match = source.match(/recipe: need .+? for "(.+?)"/);
    if (match) return match[1];
  }
  
  const content = source.substring(7).trim();
  const parenMatch = content.match(/^(.+?)\s*\([^)]+\)$/);
  if (parenMatch) {
    return parenMatch[1].trim();
  }
  
  return content;
};

const findRecipeByTitle = (title: string, savedRecipes: SavedRecipe[], mealPlan: DayPlan[]): StructuredRecipe | SavedRecipe | null => {
  const cleanTitle = title.trim().toLowerCase();
  
  const savedMatch = savedRecipes.find(r => r.title.trim().toLowerCase() === cleanTitle);
  if (savedMatch) return savedMatch;
  
  if (mealPlan && Array.isArray(mealPlan)) {
    for (const day of mealPlan) {
      const meals = [...(day.breakfast || []), ...(day.lunch || []), ...(day.dinner || []), ...(day.meals || [])];
      for (const meal of meals) {
        if (meal.recipe && meal.recipe.title.trim().toLowerCase() === cleanTitle) {
          return meal.recipe;
        }
      }
    }
  }
  
  return {
    title: title,
    description: `Ingredients from this recipe are in your shopping list.`,
    ingredients: [],
    instructions: [],
    cookTime: '',
    type: 'Dinner',
  };
};

interface HouseholdMember {
  id: string;
  name: string;
  avatar?: string;
}

interface ShoppingListItemProps {
  item: ShoppingItem;
  onToggleCheck: (id: string) => void;
  onRemove: (id: string) => void;
  onQuantityChange?: (id: string, quantity: string) => void;
  onLongPress?: (id: string) => void;
  onUpdateItem?: (id: string, updates: Partial<ShoppingItem>) => void;
  householdMembers?: HouseholdMember[];
  isSelected?: boolean;
  isOffline?: boolean;
  lastSynced?: Date;
  showPriceData?: boolean;
}

export const EnhancedShoppingListItem: React.FC<ShoppingListItemProps> = ({
  item,
  onToggleCheck,
  onRemove,
  onQuantityChange,
  onLongPress,
  onUpdateItem,
  householdMembers,
  isSelected = false,
  isOffline = false,
  lastSynced,
  showPriceData = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState(item.notes ?? '');
  const itemRef = useRef<HTMLDivElement>(null);

  const { savedRecipes, mealPlan } = useApp();
  const { setActiveTab } = useAppActions();

  const handleRecipeClick = (e: React.MouseEvent, recipeTitle: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    const foundRecipe = findRecipeByTitle(recipeTitle, savedRecipes || [], mealPlan || []);
    if (!foundRecipe) return;
    
    const isSaved = savedRecipes?.some(r => r.title.trim().toLowerCase() === recipeTitle.trim().toLowerCase()) ?? false;
    
    window.dispatchEvent(new CustomEvent('openRecipeModal', {
      detail: {
        recipe: foundRecipe,
        isSavedView: isSaved
      }
    }));
  };

  // Register Android system back button hooks for overlays
  useAndroidBack(showAssignPicker, () => setShowAssignPicker(false));
  useAndroidBack(showNotes, () => setShowNotes(false));

  React.useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = () => {
      setIsOpen(false);
    };

    const timer = setTimeout(() => {
      window.addEventListener('click', handleOutsideClick);
    }, 0);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleOutsideClick);
    };
  }, [isOpen]);

  React.useEffect(() => {
    const handleOtherOpened = (e: Event) => {
      const customEvent = e as CustomEvent<{ itemId: string }>;
      if (customEvent.detail && customEvent.detail.itemId !== item.id) {
        setIsOpen(false);
      }
    };

    window.addEventListener('shopping-item-actions-opened', handleOtherOpened);
    return () => {
      window.removeEventListener('shopping-item-actions-opened', handleOtherOpened);
    };
  }, [item.id]);

  const hasNoteButton = !!onUpdateItem;


  const [showPriceComparison, setShowPriceComparison] = useState(false);

  const priceComparisons = item.priceOptions && item.priceOptions.length > 1
    ? comparePriceOptions(item.priceOptions)
    : [];

  const priceComparisonSummary = item.priceOptions && item.priceOptions.length > 1
    ? getPriceComparisonSummary(item.priceOptions)
    : '';

  const pointerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressing = useRef(false);

  const handlePointerDown = (_e: React.PointerEvent) => {
    isLongPressing.current = false;
    pointerTimer.current = setTimeout(() => {
      isLongPressing.current = true;
      HapticService.medium();
      if (onLongPress) {
        onLongPress(item.id);
      }
    }, 600);
  };

  const handlePointerUpOrLeave = () => {
    if (pointerTimer.current) {
      clearTimeout(pointerTimer.current);
      pointerTimer.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPressing.current) {
      e.stopPropagation();
      e.preventDefault();
      isLongPressing.current = false;
      return;
    }
    if (isOpen) {
      e.stopPropagation();
      setIsOpen(false);
      return;
    }
    HapticService.light();
    onToggleCheck(item.id);
  };

  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-xl">
      {/* Main Item */}
      <div
        ref={itemRef}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUpOrLeave}
        onPointerLeave={handlePointerUpOrLeave}
        onPointerCancel={handlePointerUpOrLeave}
        className={`flex items-start justify-between gap-3 p-4 border rounded-xl transition-all cursor-pointer group relative z-10 ${
          isSelected
            ? 'bg-[var(--accent-color)]/15 border-[var(--accent-color)]/60 opacity-80'
            : 'bg-theme-secondary border-theme hover:border-[var(--accent-color)]/50'
        }`}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {(() => {
            const imageUrl = getItemImageLocalPath(item.item);
            return imageUrl ? (
              <img
                src={imageUrl}
                alt={item.item}
                className={`w-10 h-10 rounded-full object-cover border border-theme bg-white flex-shrink-0 ${
                  isSelected ? 'opacity-65 grayscale' : ''
                }`}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className={`w-10 h-10 rounded-full bg-theme-secondary flex items-center justify-center text-lg text-theme-secondary border border-theme flex-shrink-0 ${
                isSelected ? 'opacity-65' : ''
              }`}>
                📦
              </div>
            );
          })()}

          <div className="flex-1 min-w-0 space-y-1">
            <span className={`block text-base font-semibold text-theme-primary leading-snug truncate ${
              isSelected ? 'line-through text-theme-secondary/70 opacity-60' : ''
            }`} title={item.item}>
              {item.item}
            </span>
            {item.source && !item.source.startsWith('recipe:') && item.source !== 'suggested' && (
              <div className="inline-flex items-center gap-1 rounded-full border border-theme bg-theme-primary/50 px-2 py-0.5 text-[10px] font-medium text-theme-secondary whitespace-nowrap shrink-0">
                {item.source === 'manual' && (
                  <>
                    <span className="text-xs">✏️</span>
                    <span>Manual</span>
                  </>
                )}
                {item.source === 'meal planner' && (
                  <>
                    <span className="text-xs">📅</span>
                    <span>Meal planner</span>
                  </>
                )}
                {item.source === 'pantry scanner' && (
                  <>
                    <span className="text-xs">📷</span>
                    <span>Scanner</span>
                  </>
                )}
                {item.source === 'scanner suggestion' && (
                  <>
                    <span className="text-xs">🤖</span>
                    <span>Suggestions</span>
                  </>
                )}
              </div>
            )}

            {item.purchasedBatch && (
              <div className="text-xs text-green-600 opacity-90">Purchased: {item.purchasedBatch.amount} {item.purchasedBatch.unit || ''} {item.purchasedBatch.expires ? `— expires ${item.purchasedBatch.expires}` : ''}</div>
            )}
            {item.assignedTo && (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[10px] bg-[var(--accent-color)]/15 text-[var(--accent-color)] px-2 py-0.5 rounded-full font-medium">
                  👤 {item.assignedTo}
                </span>
              </div>
            )}
            {item.notes && !showNotes && (
              <div className="text-xs text-theme-secondary opacity-70 italic truncate max-w-[130px]" title={item.notes}>
                📝 {item.notes.length > 30 ? `${item.notes.substring(0, 30)}...` : item.notes}
              </div>
            )}
            {isOffline && lastSynced && (
              <div className="text-xs text-orange-600 opacity-80">
                ⚠️ Offline - Last synced: {lastSynced.toLocaleTimeString()}
              </div>
            )}
            {/* Clickable recipe name is at the bottom */}
            {item.source && item.source.startsWith('recipe:') && (
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={(e) => {
                    const title = getRecipeTitleFromSource(item.source);
                    if (title) handleRecipeClick(e, title);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/5 hover:bg-[var(--accent-color)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-color)] max-w-[130px] truncate transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)] text-left"
                  title={`View recipe: ${getRecipeTitleFromSource(item.source)}`}
                >
                  <span className="text-[10px]">🍳</span>
                  <span className="truncate text-[10px]">{item.source.substring(8).replace(/^need\s+/, '')}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Assign Button */}
          {onUpdateItem && householdMembers && householdMembers.length > 0 && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAssignPicker(!showAssignPicker);
                  setShowNotes(false);
                }}
                className={`p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-opacity ${
                  item.assignedTo
                    ? 'text-[var(--accent-color)] opacity-90 hover:opacity-100'
                    : 'text-theme-secondary opacity-40 hover:opacity-80'
                }`}
                title={item.assignedTo ? `Assigned to ${item.assignedTo}` : 'Assign to member'}
                aria-label="Assign item"
              >
                <UserCheck className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Price Comparison */}
          {showPriceData && item.priceOptions && item.priceOptions.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPriceComparison(!showPriceComparison);
              }}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-theme-secondary opacity-60 hover:opacity-100 hover:text-[var(--accent-color)] transition-opacity"
              title="Compare prices"
              aria-label="Compare prices"
            >
              <Calculator className="w-4 h-4" />
            </button>
          )}

          {onQuantityChange && (() => {
            const { amount, unit } = parseQuantityAndUnit(item.quantity, item.item);
            const smartUnits = getSmartUnits(item.item);
            const commonUnits = ['pcs', 'dozen', 'lbs', 'kg', 'oz', 'g', 'cups', 'tbsp', 'tsp', 'ml', 'l', 'cans', 'bottles', 'packages', 'boxes', 'bags'];
            const allUnits = Array.from(new Set([...smartUnits, ...commonUnits]));
            
            return (
              <div className="flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    value={amount}
                    onChange={(e) => {
                      const newAmount = parseFloat(e.target.value) || 0;
                      const newQuantityStr = unit === 'pcs' || unit === 'pieces' || unit === 'count' || unit === 'each'
                        ? newAmount.toString()
                        : `${newAmount} ${unit}`;
                      onQuantityChange(item.id, newQuantityStr);
                      onUpdateItem?.(item.id, { quantity: newQuantityStr, unit });
                    }}
                    className="w-12 h-[30px] px-1 py-1 text-sm border border-theme rounded bg-theme-primary text-theme-primary focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)] text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="qty"
                  />
                  <select
                    value={unit}
                    onChange={(e) => {
                      const newUnit = e.target.value;
                      const newQuantityStr = newUnit === 'pcs' || newUnit === 'pieces' || newUnit === 'count' || newUnit === 'each'
                        ? amount.toString()
                        : `${amount} ${newUnit}`;
                      onQuantityChange(item.id, newQuantityStr);
                      onUpdateItem?.(item.id, { quantity: newQuantityStr, unit: newUnit });
                    }}
                    className="w-18 h-[30px] px-1 text-xs border border-theme rounded bg-theme-primary text-theme-primary focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                  >
                    {allUnits.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                {item.quantity && item.quantity !== '1' && (
                  <div className="text-[10px] text-theme-secondary opacity-80 pr-1 text-right">
                    Needed: {item.quantity}
                  </div>
                )}
              </div>
            );
          })()}

          {showPriceData && (
            item.estimatedPrice && item.estimatedPrice > 0 ? (
              <div className="w-16 h-[30px] flex items-center justify-center text-xs font-medium text-green-600 dark:text-green-400 bg-green-500/10 dark:bg-green-500/20 px-1 rounded border border-green-500/20 text-center truncate" title={`~$${item.estimatedPrice.toFixed(2)}`}>
                ~${item.estimatedPrice.toFixed(2)}
              </div>
            ) : (
              <div className="w-16 h-[30px] rounded border border-dashed border-theme/40 bg-theme-primary/20 flex items-center justify-center text-[10px] text-theme-secondary opacity-40">
                —
              </div>
            )
          )}

          {/* Chevron / Stacked Action Buttons */}
          {isSelected || isOpen ? (
            <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
              {hasNoteButton && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowNotes(prev => !prev);
                    setShowAssignPicker(false);
                    if (!showNotes) setNoteText(item.notes ?? '');
                    setIsOpen(false);
                  }}
                  className="p-1 w-9 h-[22px] flex items-center justify-center bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors cursor-pointer"
                  title={item.notes ? 'Edit note' : 'Add note'}
                  aria-label="Edit note"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.id);
                  setIsOpen(false);
                }}
                className="p-1 w-9 h-[22px] flex items-center justify-center bg-red-600 text-white rounded hover:bg-red-700 transition-colors cursor-pointer"
                aria-label={`Remove ${item.item}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(true);
                window.dispatchEvent(new CustomEvent('shopping-item-actions-opened', { detail: { itemId: item.id } }));
              }}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-theme-secondary opacity-60 hover:opacity-100 hover:text-[var(--accent-color)] transition-opacity"
              title="More actions"
              aria-label="More actions"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      </div>

      {/* Assignment Picker */}
      {showAssignPicker && onUpdateItem && householdMembers && householdMembers.length > 0 && (
        <div className="mt-1 p-2 bg-theme-secondary border border-theme rounded-lg">
          <div className="text-xs font-medium text-theme-secondary mb-2">Assign to:</div>
          <div className="flex flex-wrap gap-2">
            {householdMembers.map((member) => (
              <button
                key={member.id}
                onClick={() => {
                  onUpdateItem(item.id, { assignedTo: item.assignedTo === member.name ? undefined : member.name });
                  setShowAssignPicker(false);
                }}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  item.assignedTo === member.name
                    ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)]'
                    : 'bg-theme text-theme-primary border-theme hover:border-[var(--accent-color)]'
                }`}
              >
                {member.name}
              </button>
            ))}
            {item.assignedTo && (
              <button
                onClick={() => {
                  onUpdateItem(item.id, { assignedTo: undefined });
                  setShowAssignPicker(false);
                }}
                className="text-xs px-3 py-1.5 rounded-full border border-theme text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Unassign
              </button>
            )}
          </div>
        </div>
      )}

      {/* Notes Editor */}
      {showNotes && onUpdateItem && (
        <div className="mt-1 p-2 bg-theme-secondary border border-theme rounded-lg" onClick={(e) => e.stopPropagation()}>
          <div className="text-xs font-medium text-theme-secondary mb-1.5">Note:</div>
          <div className="flex items-stretch gap-2">
            <textarea
              autoFocus
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={2}
              placeholder="Add a note (e.g. low fat, organic brand)…"
              className="flex-1 text-xs px-2 py-1.5 bg-theme border border-theme rounded focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)] text-theme-primary resize-none"
            />
            <div className="flex flex-col gap-1.5 justify-between flex-shrink-0">
              <button
                onClick={() => {
                  onUpdateItem(item.id, { notes: noteText.trim() || undefined });
                  setShowNotes(false);
                }}
                className="text-xs px-3 py-1.5 bg-[var(--accent-color)] text-white font-bold rounded-lg hover:bg-[var(--accent-color)]/90 transition-colors shadow-sm cursor-pointer flex-1 flex items-center justify-center"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setNoteText(item.notes ?? '');
                  setShowNotes(false);
                }}
                className="text-xs px-3 py-1.5 bg-theme-primary border border-theme text-theme-secondary font-medium rounded-lg hover:bg-theme-secondary transition-colors cursor-pointer flex-1 flex items-center justify-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Price Comparison Details */}
      {showPriceData && showPriceComparison && item.priceOptions && item.priceOptions.length > 1 && (
        <div className="mt-2 p-3 bg-theme-secondary/50 border border-theme rounded-lg">
          <div className="text-xs font-medium text-theme-primary mb-2">
            Price Comparison {priceComparisonSummary && `• ${priceComparisonSummary}`}
          </div>
          <div className="space-y-2">
            {item.priceOptions.map((option, index) => {
              const comparison = priceComparisons[index];
              return (
                <div
                  key={index}
                  className={`flex items-center justify-between p-2 rounded border ${
                    comparison?.isBestValue
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : 'bg-theme border-theme'
                  }`}
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {option.amount}{option.unit} for ${option.price.toFixed(2)}
                      {option.store && <span className="text-xs opacity-70 ml-1">at {option.store}</span>}
                    </div>
                    <div className="text-xs opacity-70">
                      {formatPricePerUnit(comparison?.pricePerUnit || 0, comparison?.unit || option.unit)}
                      {comparison?.isBestValue && (
                        <span className="ml-2 text-green-600 font-medium">✨ Best value</span>
                      )}
                    </div>
                  </div>
                  {comparison?.savings && comparison.savings > 0 && (
                    <div className="text-xs text-red-600 font-medium">
                      Save ${comparison.savings.toFixed(2)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedShoppingListItem;