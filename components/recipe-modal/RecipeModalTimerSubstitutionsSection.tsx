import React from 'react';
import { AlertCircle, Pause, Play, RotateCcw } from 'lucide-react';
import { SavedRecipe, StructuredRecipe } from '../../types';

interface IngredientSubstitution {
  ingredient: string;
  substitutes: { name: string; ratio: string; notes: string }[];
}

interface RecipeModalTimerSubstitutionsSectionProps {
  recipe: StructuredRecipe | SavedRecipe;
  timerLabel: string;
  timerActive: boolean;
  timeRemaining: number;
  totalTime: number;
  customTime: number;
  showCustomTimer: boolean;
  setCustomTime: React.Dispatch<React.SetStateAction<number>>;
  setShowCustomTimer: React.Dispatch<React.SetStateAction<boolean>>;
  setTimerActive: React.Dispatch<React.SetStateAction<boolean>>;
  setTimeRemaining: React.Dispatch<React.SetStateAction<number>>;
  setTotalTime: React.Dispatch<React.SetStateAction<number>>;
  startTimer: (useCustomTime?: boolean) => void;
  startQuickTimer: (minutes: number) => void;
  formatTime: (seconds: number) => string;
  findSubstitutions: () => void;
  showSubstitutions: boolean;
  setShowSubstitutions: React.Dispatch<React.SetStateAction<boolean>>;
  ingredientSubstitutions: IngredientSubstitution[];
}

export const RecipeModalTimerSubstitutionsSection: React.FC<RecipeModalTimerSubstitutionsSectionProps> = ({
  recipe,
  timerLabel,
  timerActive,
  timeRemaining,
  totalTime,
  customTime,
  showCustomTimer,
  setCustomTime,
  setShowCustomTimer,
  setTimerActive,
  setTimeRemaining,
  setTotalTime,
  startTimer,
  startQuickTimer,
  formatTime,
  findSubstitutions,
  showSubstitutions,
  setShowSubstitutions,
  ingredientSubstitutions,
}) => {
  return (
    <>
      {(recipe as StructuredRecipe).cookTime && (
        <div className="mb-6 p-4 bg-theme-secondary/10 rounded-lg border border-[var(--accent-color)]/20">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-[var(--accent-color)] uppercase">{timerLabel}</h4>
            <span className="text-xs text-theme-secondary opacity-70">
              {timerActive ? formatTime(timeRemaining) : (recipe as StructuredRecipe).cookTime}
            </span>
          </div>

          {showCustomTimer ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={customTime}
                  onChange={(e) => setCustomTime(parseInt(e.target.value) || 0)}
                  placeholder="Minutes"
                  className="flex-1 px-3 py-2 bg-theme-secondary/20 border border-[var(--accent-color)]/20 rounded-lg text-theme-primary text-sm"
                />
                <button
                  onClick={() => startTimer(true)}
                  disabled={customTime <= 0}
                  className="px-4 py-2 bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 disabled:bg-theme-secondary/50 text-white rounded-lg text-sm font-medium"
                >
                  Start
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startQuickTimer(5)} className="flex-1 py-1 px-2 bg-theme-secondary/20 hover:bg-theme-secondary/30 rounded text-xs">5 min</button>
                <button onClick={() => startQuickTimer(10)} className="flex-1 py-1 px-2 bg-theme-secondary/20 hover:bg-theme-secondary/30 rounded text-xs">10 min</button>
                <button onClick={() => startQuickTimer(15)} className="flex-1 py-1 px-2 bg-theme-secondary/20 hover:bg-theme-secondary/30 rounded text-xs">15 min</button>
                <button onClick={() => startQuickTimer(30)} className="flex-1 py-1 px-2 bg-theme-secondary/20 hover:bg-theme-secondary/30 rounded text-xs">30 min</button>
              </div>
              <button
                onClick={() => setShowCustomTimer(false)}
                className="w-full py-1 px-2 bg-theme-secondary/10 hover:bg-theme-secondary/20 rounded text-xs text-theme-secondary"
              >
                Cancel
              </button>
            </div>
          ) : timerActive ? (
            <div className="text-center">
              <div className="text-5xl font-bold font-mono text-[var(--accent-color)] mb-3 tracking-wider">{formatTime(timeRemaining)}</div>
              <div className="w-full bg-theme-secondary/20 rounded-full h-2 mb-4 overflow-hidden">
                <div
                  className="h-full bg-[var(--accent-color)] transition-all duration-300"
                  style={{ width: totalTime > 0 ? `${(timeRemaining / totalTime) * 100}%` : '0%' }}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setTimerActive(!timerActive)}
                  className="flex-1 py-2 px-3 bg-theme-secondary hover:bg-theme-secondary/80 text-theme-primary rounded-lg flex items-center justify-center gap-2 text-sm font-medium"
                >
                  {timerActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {timerActive ? 'Pause' : 'Resume'}
                </button>
                <button
                  onClick={() => {
                    setTimerActive(false);
                    setTimeRemaining(0);
                    setTotalTime(0);
                  }}
                  className="flex-1 py-2 px-3 bg-theme-secondary hover:bg-theme-secondary/80 text-theme-primary rounded-lg flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <RotateCcw className="w-4 h-4" /> Reset
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => startTimer(false)}
                className="w-full py-2 px-4 bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 text-white rounded-lg flex items-center justify-center gap-2 font-medium"
              >
                <Play className="w-4 h-4" /> Start Recipe Timer
              </button>
              <button
                onClick={() => setShowCustomTimer(true)}
                className="w-full py-2 px-4 bg-theme-secondary/20 hover:bg-theme-secondary/30 border border-[var(--accent-color)]/20 rounded-lg flex items-center justify-center gap-2 text-sm font-medium text-theme-primary"
              >
                ⏱️ Custom Timer
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mb-4">
        <button
          onClick={findSubstitutions}
          className="w-full py-2 px-4 bg-theme-secondary/20 hover:bg-theme-secondary/30 border border-[var(--accent-color)]/20 rounded-lg flex items-center justify-center gap-2 text-sm font-medium text-theme-primary transition-colors"
        >
          <AlertCircle className="w-4 h-4" /> Ingredient Substitutions
        </button>
      </div>

      {showSubstitutions && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setShowSubstitutions(false)}>
          <div className="bg-theme-primary rounded-xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--accent-color)]">Ingredient Substitutions</h3>
              <button onClick={() => setShowSubstitutions(false)} className="text-theme-secondary opacity-50 hover:opacity-100">
                &times;
              </button>
            </div>

            {ingredientSubstitutions.length === 0 ? (
              <p className="text-sm text-theme-secondary opacity-70 text-center py-6">No substitutions found for these ingredients.</p>
            ) : (
              <div className="space-y-4">
                {ingredientSubstitutions.map((item, index) => (
                  <div key={index} className="border-l-4 border-[var(--accent-color)]/50 pl-3">
                    <p className="text-sm font-semibold text-theme-primary mb-2">{item.ingredient}</p>
                    <div className="space-y-2">
                      {item.substitutes.map((substitute, subIndex) => (
                        <div key={subIndex} className="bg-theme-secondary/10 rounded-lg px-3 py-2">
                          <p className="text-sm font-medium text-[var(--accent-color)]">{substitute.name}</p>
                          <p className="text-xs text-theme-secondary opacity-80">{substitute.ratio}</p>
                          {substitute.notes && <p className="text-xs text-theme-secondary opacity-60 mt-0.5 italic">{substitute.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowSubstitutions(false)}
              className="w-full mt-6 py-2 px-4 bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 text-white rounded-lg font-medium"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
