import React from 'react';
import { Copy, Download, Trash2 } from 'lucide-react';
import { DayPlan } from '../../types';

interface MealPlannerCalendarSectionProps {
  displayPlan: DayPlan[];
  mealPlan: DayPlan[];
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
}

export const MealPlannerCalendarSection: React.FC<MealPlannerCalendarSectionProps> = ({
  displayPlan,
  mealPlan,
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
  nextDayTitle
}) => {
  const currentDisplayDay = displayPlan[currentDayIndex];

  return (
    <>
      {/* Calendar View - Compact or Expanded */}
      <div className="bg-theme-secondary rounded-xl p-3 border border-theme">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSetCalendarExpanded(false)}
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
                onClick={() => onSetCalendarExpanded(true)}
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
                onClick={onUpgradeMonthView}
                className="px-3 py-1 text-xs font-medium rounded-lg text-theme-secondary hover:bg-theme-primary/20 transition-colors flex items-center gap-1"
              >
                This Month 🔒
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-theme-primary/50 rounded" />
              <span className="text-theme-secondary opacity-70">{hasMealsLabel}</span>
            </span>
            <span className="text-theme-secondary opacity-40">•</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-[var(--accent-color)] rounded" />
              <span className="text-theme-secondary opacity-70">Today</span>
            </span>
          </div>
        </div>

        {isCalendarExpanded ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <button
                onClick={onPrevMonth}
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
                  onClick={onGoToToday}
                  className="text-xs px-2 py-1 rounded bg-theme-primary/20 hover:bg-theme-primary/30 text-theme-secondary"
                  title="Go to today"
                >
                  Today
                </button>
              </div>
              <button
                onClick={onNextMonth}
                className="p-1 rounded hover:bg-theme-primary/20 text-theme-secondary"
                aria-label="Next month"
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-xs text-theme-secondary opacity-60 py-1">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {(() => {
                const today = new Date();
                const firstDay = new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth(), 1);
                const startDate = new Date(firstDay);
                startDate.setDate(startDate.getDate() - firstDay.getDay());

                const days = [];
                const currentDate = new Date(startDate);

                for (let week = 0; week < 6; week++) {
                  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
                    const dateStr = currentDate.toISOString().split('T')[0];
                    const isCurrentMonth = currentDate.getMonth() === currentCalendarMonth.getMonth() && currentDate.getFullYear() === currentCalendarMonth.getFullYear();
                    const isTodayDate = currentDate.toDateString() === today.toDateString();

                    const mealPlanIndex = mealPlan.findIndex(d => d.date === dateStr);
                    const hasMeals = mealPlanIndex >= 0 && hasMealsScheduled(mealPlanIndex);
                    const selectedIndex = displayPlan.findIndex(day => day.date === dateStr);
                    const isSelected = selectedIndex === currentDayIndex;

                    days.push(
                      <button
                        key={dateStr}
                        onClick={() => onSelectDate(dateStr)}
                        className={`aspect-square text-xs rounded-lg transition-all relative ${
                          !isCurrentMonth
                            ? 'text-theme-secondary opacity-30'
                            : isSelected
                            ? 'bg-green-600 text-white font-bold ring-2 ring-green-600/50'
                            : isTodayDate
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
                          <span className="flex items-center justify-center h-full">{currentDate.getDate()}</span>
                        )}
                        {hasMeals && (
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full border border-theme-primary" />
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
          <div className="grid grid-cols-7 gap-1 text-center">
            {displayPlan.slice(0, 7).map((day, index) => {
              const mealPlanIndex = mealPlan.findIndex(d => d.date === day.date);
              const hasMeals = mealPlanIndex >= 0 && hasMealsScheduled(mealPlanIndex);
              const isCurrentDay = index === currentDayIndex;
              const isTodayDate = isToday(day.date);

              return (
                <div key={day.date} className="flex flex-col items-center">
                  <div className="text-xs text-theme-secondary opacity-60 mb-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(day.date + 'T12:00:00').getDay()]}
                  </div>
                  <button
                    onClick={() => onSelectCompactDay(index)}
                    className={`w-full py-1 text-xs rounded-lg transition-all relative ${
                      isCurrentDay
                        ? 'bg-green-600 text-white font-bold ring-2 ring-green-600/50'
                        : isTodayDate
                        ? 'bg-[var(--accent-color)]/20 text-[var(--accent-color)] border border-[var(--accent-color)]/30'
                        : hasMeals
                        ? 'bg-theme-primary/50 text-white hover:bg-theme-primary/70 border border-theme-primary/30'
                        : 'text-theme-secondary opacity-50 hover:bg-theme-primary/20'
                    }`}
                    title={`${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(day.date + 'T12:00:00').getDay()]} ${day.date}${hasMeals ? ' - Has meals scheduled' : ' - No meals'}`}
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
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full border border-theme-primary" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={onClearWeek}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-theme-secondary border border-theme text-theme-secondary hover:bg-red-500/10 hover:text-red-400 hover:border-red-400/30 transition-colors"
              aria-label="Clear week meals"
              title="Clear all meals for this week"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear week
            </button>
            <button
              onClick={onCopyWeek}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-theme-secondary border border-theme text-theme-secondary hover:bg-[var(--accent-color)]/10 hover:text-[var(--accent-color)] hover:border-[var(--accent-color)]/30 transition-colors"
              aria-label="Copy week meals to next week"
              title="Copy this week's meals to next week"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy to next week
            </button>
            <button
              onClick={onExportCalendar}
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
            onClick={onPrevDay}
            disabled={currentDayIndex === 0}
            className="p-2 rounded-lg hover:bg-theme-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous day"
          >
            <svg className="w-6 h-6 text-theme-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <h2 className={`text-xl font-bold ${isToday(currentDisplayDay?.date) ? 'text-[var(--accent-color)]' : 'text-theme-primary'}`}>
              {currentDisplayDay?.dayName}
              {isToday(currentDisplayDay?.date) && <span className="ml-2 text-sm">📅</span>}
            </h2>
            <p className={`text-sm font-mono ${isToday(currentDisplayDay?.date) ? 'text-[var(--accent-color)] font-semibold' : 'text-theme-secondary opacity-70'}`}>
              {currentDisplayDay?.date}
            </p>
          </div>

          <button
            onClick={onNextDay}
            disabled={nextDayDisabled}
            className="p-2 rounded-lg hover:bg-theme-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Next day"
            title={nextDayTitle}
          >
            <svg className="w-6 h-6 text-theme-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
};
