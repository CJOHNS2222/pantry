import React, { useState } from 'react';
import { Wand2, AlertTriangle, Package, CheckSquare, Square, X, Lock } from 'lucide-react';
import { useAppActions } from '../../contexts/AppActionsContext';
import { Tab } from '../../types/app';

export interface AutoFillPreferences {
  mealTypes: {
    breakfast: boolean;
    lunch: boolean;
    dinner: boolean;
  };
  prioritizeExpiring: boolean;
  useLeftovers: boolean;
  daysToFill: number;
}

interface MealPlanAutoFillModalProps {
  onClose: () => void;
  onAutoFill: (preferences: AutoFillPreferences) => void;
  canUseTwoWeekPlanning: boolean;
}

export const MealPlanAutoFillModal: React.FC<MealPlanAutoFillModalProps> = ({
  onClose,
  onAutoFill,
  canUseTwoWeekPlanning,
}) => {
  const { addToast, setActiveTab } = useAppActions();
  const [preferences, setPreferences] = useState<AutoFillPreferences>({
    mealTypes: {
      breakfast: false,
      lunch: false,
      dinner: true,
    },
    prioritizeExpiring: true,
    useLeftovers: true,
    daysToFill: 3,
  });

  const handleToggleMealType = (type: 'breakfast' | 'lunch' | 'dinner') => {
    setPreferences(prev => ({
      ...prev,
      mealTypes: {
        ...prev.mealTypes,
        [type]: !prev.mealTypes[type]
      }
    }));
  };

  const handleAutoFill = () => {
    onAutoFill(preferences);
    onClose();
  };

  const isAnyMealTypeSelected = Object.values(preferences.mealTypes).some(Boolean);

  return (
    <div className="bg-theme-primary rounded-xl w-full max-w-md mx-auto shadow-sm border border-theme animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-theme">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[var(--accent-color)]/10 flex items-center justify-center">
              <Wand2 className="w-4 h-4 text-[var(--accent-color)]" />
            </div>
            <h3 className="text-lg font-bold text-theme-primary">Auto-Fill Plan</h3>
          </div>
          <button
            onClick={onClose}
            className="text-theme-secondary hover:text-theme-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          <p className="text-sm text-theme-secondary">
            Automatically fill empty meal slots in your current view using your saved recipes and available pantry ingredients.
          </p>

          {/* Meal Types Selector */}
          <div>
            <h4 className="text-sm font-semibold text-theme-primary mb-3">Which meals to fill?</h4>
            <div className="flex gap-3">
              {(['breakfast', 'lunch', 'dinner'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => handleToggleMealType(type)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                    preferences.mealTypes[type]
                      ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5 text-[var(--accent-color)]'
                      : 'border-theme hover:border-[var(--accent-color)]/50 text-theme-secondary'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    {preferences.mealTypes[type] ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    <span className="capitalize">{type}</span>
                  </div>
                </button>
              ))}
            </div>
            {!isAnyMealTypeSelected && (
              <p className="text-xs text-red-500 mt-2">Please select at least one meal type.</p>
            )}
          </div>

          {/* Days to Fill Selector */}
          <div>
            <h4 className="text-sm font-semibold text-theme-primary mb-3">How many days to fill?</h4>
            <div className="flex gap-2">
              {([1, 3, 5, 7, 14] as const).map(days => {
                const isPremiumOption = days > 7;
                const isDisabled = isPremiumOption && !canUseTwoWeekPlanning;
                
                return (
                  <button
                    key={days}
                    type="button"
                    onClick={() => {
                      if (isDisabled) {
                        addToast('Planning beyond 7 days requires Premium.', 'info', 5000, 'Upgrade', () => {
                          onClose();
                          setActiveTab(Tab.SETTINGS);
                        });
                        return;
                      }
                      setPreferences(prev => ({
                        ...prev,
                        daysToFill: days
                      }));
                    }}
                    className={`flex-1 py-2 px-1 rounded-lg border text-sm font-medium transition-all flex flex-col items-center justify-center gap-1 ${
                      preferences.daysToFill === days
                        ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5 text-[var(--accent-color)] font-bold'
                        : isDisabled
                          ? 'border-theme opacity-65 text-theme-secondary hover:border-orange-200/50 cursor-pointer'
                          : 'border-theme hover:border-[var(--accent-color)]/50 text-theme-secondary'
                    }`}
                  >
                    <span className="text-xs text-center leading-none">
                      {days} {days === 1 ? 'Day' : 'Days'}
                    </span>
                    {isDisabled && (
                      <Lock className="w-3.5 h-3.5 text-orange-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Smart Priorities */}
          <div>
            <h4 className="text-sm font-semibold text-theme-primary mb-3">Smart Priorities</h4>
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                  preferences.prioritizeExpiring 
                    ? 'bg-[var(--accent-color)] border-[var(--accent-color)]' 
                    : 'border-theme group-hover:border-[var(--accent-color)]'
                }`}>
                  {preferences.prioritizeExpiring && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium text-theme-primary">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    Use expiring items first
                  </div>
                  <p className="text-xs text-theme-secondary">Prioritize recipes that use ingredients expiring within 7 days.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                  preferences.useLeftovers 
                    ? 'bg-[var(--accent-color)] border-[var(--accent-color)]' 
                    : 'border-theme group-hover:border-[var(--accent-color)]'
                }`}>
                  {preferences.useLeftovers && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium text-theme-primary">
                    <Package className="w-4 h-4 text-theme-secondary" />
                    Schedule leftovers
                  </div>
                  <p className="text-xs text-theme-secondary">Automatically slot available leftovers into lunch or dinner slots.</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-theme flex gap-3 justify-end bg-theme-secondary/5 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-theme-secondary hover:text-theme-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAutoFill}
            disabled={!isAnyMealTypeSelected}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[var(--accent-color)] text-white text-sm font-medium hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Wand2 className="w-4 h-4" />
            Generate Plan
          </button>
        </div>
    </div>
  );
};
