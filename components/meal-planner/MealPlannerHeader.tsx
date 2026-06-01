import React from 'react';
import { CalendarClock, HelpCircle } from 'lucide-react';

interface MealPlannerHeaderProps {
  title: string;
  showHelpTooltip: boolean;
  onOpenMealPrepPlanner: () => void;
  onToggleHelpTooltip: () => void;
}

export const MealPlannerHeader: React.FC<MealPlannerHeaderProps> = ({
  title,
  showHelpTooltip,
  onOpenMealPrepPlanner,
  onToggleHelpTooltip,
}) => {
  return (
    <div className="mb-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1" />
        <h2 className="text-3xl font-serif font-bold text-theme-secondary">{title}</h2>
        <div className="flex-1 flex items-center justify-end gap-1">
          <button
            onClick={onOpenMealPrepPlanner}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 active:bg-[var(--accent-color)]/80 text-white text-sm font-medium transition-colors shadow-sm"
            title="Smart Meal Prep Planner"
            aria-label="Open meal prep planner"
          >
            <CalendarClock className="w-4 h-4" />
            <span>Meal Prep</span>
          </button>
          <button
            onClick={onToggleHelpTooltip}
            className="p-2 rounded-full hover:bg-theme-secondary/10 transition-colors"
            title="Help"
            aria-label="Show meal planning help"
          >
            <HelpCircle className="w-5 h-5 text-theme-secondary opacity-60 hover:opacity-100" />
          </button>
        </div>
      </div>

      {showHelpTooltip && (
        <div className="help-tooltip-container mt-4 p-4 bg-theme-secondary/5 border border-theme-secondary/20 rounded-lg text-left max-w-md mx-auto">
          <h3 className="font-semibold text-theme-secondary mb-2">How to use Meal Planner:</h3>
          <ul className="text-sm text-theme-secondary space-y-1">
            <li>- <strong>Click any day</strong> to search for recipes to add</li>
            <li>- <strong>Drag & drop</strong> meals between days to reschedule</li>
            <li>- <strong>Drag to trash</strong> (bottom right) to remove meals</li>
            <li>- <strong>Click meals</strong> to view recipe details</li>
          </ul>
        </div>
      )}
    </div>
  );
};
