import React from 'react';
import { ShoppingBasket } from 'lucide-react';
import { DayPlan, MealPlanItem, PantryItem } from '../../types';
import { GroceryCostEstimator } from '../shopping-list/GroceryCostEstimator';
import { MealPlannerHighlightsSection } from './MealPlannerHighlightsSection';
import { MealPlannerCalendarSection } from './MealPlannerCalendarSection';
import { CurrentDayMealsSection } from './CurrentDayMealsSection';
import { MealPlanSkeleton } from '../ui/SkeletonLoader';
import { MealPlannerDragTrash } from './MealPlannerDragTrash';

interface MealPlannerPremiumContentProps {
  missingItemsCount: number;
  isAddingToShopping: boolean;
  onAddMissingToShopping: () => void;
  isEstimatorOpen: boolean;
  showPriceData: boolean;
  mealPlan: DayPlan[];
  inventory: PantryItem[];
  freeItemLimit?: number;
  onEstimatorToggle: (isOpen: boolean) => void;
  todaysMeals: MealPlanItem[];
  todaysMealsExpanded: boolean;
  onToggleTodaysMeals: () => void;
  onOpenScheduledMeal: (meal: MealPlanItem) => void;
  mealPrepSuggestions: React.ComponentProps<typeof MealPlannerHighlightsSection>['mealPrepSuggestions'];
  onViewSuggestionRecipe: React.ComponentProps<typeof MealPlannerHighlightsSection>['onViewSuggestionRecipe'];
  onAddSuggestionMissingIngredients: React.ComponentProps<typeof MealPlannerHighlightsSection>['onAddSuggestionMissingIngredients'];
  onViewAllSuggestions: () => void;
  isLoadingMealPlan: boolean;
  displayPlan: DayPlan[];
  currentDayIndex: number;
  isCalendarExpanded: boolean;
  currentCalendarMonth: Date;
  canUseTwoWeekPlanning: boolean;
  hasMealsScheduled: (dayIndex: number) => boolean;
  isToday: (dateString: string) => boolean;
  hasMealsLabel: string;
  onSetCalendarExpanded: (expanded: boolean) => void;
  onUpgradeMonthView: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onGoToToday: () => void;
  onSelectDate: (dateString: string) => void;
  onSelectCompactDay: (index: number) => void;
  onClearWeek: () => void;
  onCopyWeek: () => void;
  onExportCalendar: () => void;
  onPrevDay: () => void;
  onNextDay: () => void;
  nextDayDisabled: boolean;
  nextDayTitle?: string;
  showHelpTooltip: boolean;
  onToggleHelpTooltip: () => void;
  onOpenMealSearch: (mealType: 'breakfast' | 'lunch' | 'dinner') => void;
  onOpenRecipe: (recipe: MealPlanItem['recipe']) => void;
  onCooked: (meal: MealPlanItem) => void;
  onSwap: (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner', mealIndex: number) => void;
  onRemove: (dayIndex: number, mealType: string, mealIndex: number) => void;
  isDragging: boolean;
  dragOverTrash: boolean;
  onDragOverTrash: (event: React.DragEvent) => void;
  onDragLeaveTrash: (event: React.DragEvent) => void;
  onDropTrash: (event: React.DragEvent) => void;
}

export const MealPlannerPremiumContent: React.FC<MealPlannerPremiumContentProps> = ({
  missingItemsCount,
  isAddingToShopping,
  onAddMissingToShopping,
  isEstimatorOpen,
  showPriceData,
  mealPlan,
  inventory,
  freeItemLimit,
  onEstimatorToggle,
  todaysMeals,
  todaysMealsExpanded,
  onToggleTodaysMeals,
  onOpenScheduledMeal,
  mealPrepSuggestions,
  onViewSuggestionRecipe,
  onAddSuggestionMissingIngredients,
  onViewAllSuggestions,
  isLoadingMealPlan,
  displayPlan,
  currentDayIndex,
  isCalendarExpanded,
  currentCalendarMonth,
  canUseTwoWeekPlanning,
  hasMealsScheduled,
  isToday,
  hasMealsLabel,
  onSetCalendarExpanded,
  onUpgradeMonthView,
  onPrevMonth,
  onNextMonth,
  onGoToToday,
  onSelectDate,
  onSelectCompactDay,
  onClearWeek,
  onCopyWeek,
  onExportCalendar,
  onPrevDay,
  onNextDay,
  nextDayDisabled,
  nextDayTitle,
  showHelpTooltip,
  onToggleHelpTooltip,
  onOpenMealSearch,
  onOpenRecipe,
  onCooked,
  onSwap,
  onRemove,
  isDragging,
  dragOverTrash,
  onDragOverTrash,
  onDragLeaveTrash,
  onDropTrash,
}) => {
  return (
    <>
      <button
        onClick={onAddMissingToShopping}
        disabled={missingItemsCount === 0 || isAddingToShopping}
        className={`w-full border font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 mb-6 ${
          missingItemsCount > 0 && !isAddingToShopping
            ? 'bg-theme-secondary border-[var(--accent-color)] text-[var(--accent-color)] shadow-lg'
            : 'opacity-50 cursor-not-allowed border-theme'
        }`}
      >
        <ShoppingBasket className="w-5 h-5" />
        {isAddingToShopping ? 'Added!' : missingItemsCount > 0 ? `Add ${missingItemsCount} Missing Items to List` : 'Pantry is Stocked'}
      </button>

      <div className={`flex gap-4 ${isEstimatorOpen ? 'flex-col' : ''}`}>
        {showPriceData && (
          <div className={isEstimatorOpen ? 'w-full' : 'flex-1'}>
            <GroceryCostEstimator
              mealPlan={mealPlan}
              inventory={inventory}
              onEstimatorToggle={onEstimatorToggle}
              freeItemLimit={freeItemLimit}
            />
          </div>
        )}
      </div>

      <MealPlannerHighlightsSection
        todaysMeals={todaysMeals}
        todaysMealsExpanded={todaysMealsExpanded}
        onToggleTodaysMeals={onToggleTodaysMeals}
        onOpenScheduledMeal={onOpenScheduledMeal}
        mealPrepSuggestions={mealPrepSuggestions}
        onViewSuggestionRecipe={onViewSuggestionRecipe}
        onAddSuggestionMissingIngredients={onAddSuggestionMissingIngredients}
        onViewAllSuggestions={onViewAllSuggestions}
      />

      {isLoadingMealPlan ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 7 }).map((_, index) => (
              <MealPlanSkeleton key={`loading-${index}`} />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <MealPlannerCalendarSection
            displayPlan={displayPlan}
            mealPlan={mealPlan}
            currentDayIndex={currentDayIndex}
            isCalendarExpanded={isCalendarExpanded}
            currentCalendarMonth={currentCalendarMonth}
            canUseTwoWeekPlanning={canUseTwoWeekPlanning}
            hasMealsScheduled={hasMealsScheduled}
            isToday={isToday}
            hasMealsLabel={hasMealsLabel}
            onSetCalendarExpanded={onSetCalendarExpanded}
            onUpgradeMonthView={onUpgradeMonthView}
            onPrevMonth={onPrevMonth}
            onNextMonth={onNextMonth}
            onGoToToday={onGoToToday}
            onSelectDate={onSelectDate}
            onSelectCompactDay={onSelectCompactDay}
            onClearWeek={onClearWeek}
            onCopyWeek={onCopyWeek}
            onExportCalendar={onExportCalendar}
            onPrevDay={onPrevDay}
            onNextDay={onNextDay}
            nextDayDisabled={nextDayDisabled}
            nextDayTitle={nextDayTitle}
            showHelpTooltip={showHelpTooltip}
            onToggleHelpTooltip={onToggleHelpTooltip}
          />

          <CurrentDayMealsSection
            mealPlan={mealPlan}
            displayPlan={displayPlan}
            currentDayIndex={currentDayIndex}
            onOpenMealSearch={onOpenMealSearch}
            onOpenRecipe={onOpenRecipe}
            onCooked={onCooked}
            onSwap={onSwap}
            onRemove={onRemove}
          />
        </div>
      )}

      <MealPlannerDragTrash
        isDragging={isDragging}
        dragOverTrash={dragOverTrash}
        onDragOverTrash={onDragOverTrash}
        onDragLeaveTrash={onDragLeaveTrash}
        onDropTrash={onDropTrash}
      />
    </>
  );
};
