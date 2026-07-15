import React from 'react';
import { useIntl } from 'react-intl';
import { CalendarClock, HelpCircle, Wand2 } from 'lucide-react';

interface MealPlannerHeaderProps {
  title: string;
  showHelpTooltip: boolean;
  onOpenMealPrepPlanner: () => void;
  onOpenAutoFill: () => void;
  onToggleHelpTooltip: () => void;
}

export const MealPlannerHeader: React.FC<MealPlannerHeaderProps> = ({
  title,
  showHelpTooltip,
  onOpenMealPrepPlanner,
  onOpenAutoFill,
  onToggleHelpTooltip,
}) => {
  const intl = useIntl();
  return (
    <div className="mb-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h2 className="text-2xl md:text-3xl font-serif font-bold text-theme-secondary text-center md:text-left">{title}</h2>
        <div className="flex items-center justify-center md:justify-end gap-1.5 flex-wrap">
          <button
            onClick={onOpenAutoFill}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-color)]/10 hover:bg-[var(--accent-color)]/20 text-[var(--accent-color)] text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
            title={intl.formatMessage({ id: 'mealPlanner.autoFillPlan' })}
            aria-label="Open auto fill modal"
          >
            <Wand2 className="w-4 h-4" />
            <span>{intl.formatMessage({ id: 'mealPlanner.autoFillPlan' })}</span>
          </button>
          <button
            onClick={onOpenMealPrepPlanner}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 active:bg-[var(--accent-color)]/80 text-white text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
            title="Smart Meal Prep Planner"
            aria-label="Open meal prep planner"
          >
            <CalendarClock className="w-4 h-4" />
            <span>{intl.formatMessage({ id: 'mealPlanner.mealPrep' })}</span>
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
