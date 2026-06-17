import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, UtensilsCrossed, List, BookOpen } from 'lucide-react';
import { StructuredRecipe } from '../../types';

interface CookingModeProps {
  recipe: StructuredRecipe;
  onExit: () => void;
}

/** Parse instructions the same way RecipeModal does. */
function processSteps(instructions: string[]): string[] {
  const steps: string[] = [];
  instructions.forEach(instruction => {
    const raw = instruction.split(/(?=step \d+|STEP \d+|\d+\.)/i).filter(s => s.trim());
    steps.push(...raw);
  });
  return steps
    .map(step =>
      step
        .replace(/^step\s+\d+\s*[-.]?\s*/i, '')
        .replace(/^STEP\s+\d+\s*[-.]?\s*/i, '')
        .replace(/^\d+\.\s*/, '')
        .trim()
    )
    .filter(Boolean);
}

export const CookingMode: React.FC<CookingModeProps> = ({ recipe, onExit }) => {
  const steps = processSteps(recipe.instructions || []);
  const [currentStep, setCurrentStep] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const wakeLockRef = useRef<any>(null);

  // Acquire screen wake lock so the display stays on while cooking
  useEffect(() => {
    let released = false;

    const requestWakeLock = async () => {
      if (released) return;
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        } catch (_) {
          // Wake lock unavailable (older WebView / denied) — silent fail
        }
      }
    };

    requestWakeLock();

    // Re-acquire after the page comes back into view (wake lock is auto-released on hide)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      released = true;
      wakeLockRef.current?.release().catch(() => {});
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const goTo = (i: number) => setCurrentStep(Math.max(0, Math.min(steps.length - 1, i)));
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  if (steps.length === 0) {
    return (
      <div className="fixed inset-0 z-[60] bg-[#121212] flex flex-col items-center justify-center text-white p-8">
        <UtensilsCrossed className="w-12 h-12 text-gray-500 mb-4" />
        <p className="text-center text-lg text-gray-400 mb-8">No step-by-step instructions available for this recipe.</p>
        <button
          onClick={onExit}
          className="px-8 py-4 bg-[var(--accent-color)] text-white rounded-2xl font-bold text-base"
        >
          Exit Cooking Mode
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-[#121212] flex flex-col text-white select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-medium mb-0.5">Cooking Mode</p>
          <h2 className="text-sm font-semibold truncate text-gray-200">{recipe.title}</h2>
        </div>
        <div className="flex items-center gap-2 ml-3">
          <button
            onClick={() => setShowIngredients(v => !v)}
            className={`p-2.5 rounded-full transition-colors ${
              showIngredients
                ? 'bg-[var(--accent-color)] text-white'
                : 'bg-white/10 text-gray-400 hover:bg-white/20'
            }`}
            aria-label={showIngredients ? 'Back to steps' : 'Show ingredients'}
          >
            {showIngredients ? <BookOpen className="w-4 h-4" /> : <List className="w-4 h-4" />}
          </button>
          <button
            onClick={onExit}
            className="p-2.5 bg-white/10 rounded-full text-gray-400 hover:bg-white/20 transition-colors"
            aria-label="Exit cooking mode"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/10 flex-shrink-0">
        <div
          className="h-full bg-[var(--accent-color)] transition-all duration-300"
          style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
        />
      </div>

      {showIngredients ? (
        /* ── Ingredients panel ── */
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <h3 className="text-base font-bold mb-5 text-[var(--accent-color)] uppercase tracking-wide">
            Ingredients
          </h3>
          <ul className="space-y-4">
            {(recipe.ingredients || []).map((ing, i) => (
              <li key={i} className="flex items-start gap-3 text-base text-gray-200 leading-snug">
                <span className="mt-1.5 w-2 h-2 rounded-full bg-[var(--accent-color)] flex-shrink-0" />
                {ing}
              </li>
            ))}
          </ul>
          <button
            onClick={() => setShowIngredients(false)}
            className="mt-8 w-full py-4 bg-[var(--accent-color)] text-white rounded-2xl font-bold text-base"
          >
            Back to Steps
          </button>
        </div>
      ) : (
        /* ── Step view ── */
        <>
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 overflow-hidden">
            {/* Step counter */}
            <p className="text-sm text-gray-500 mb-5 font-medium tracking-wide">
              Step {currentStep + 1}{' '}
              <span className="text-gray-700">/ {steps.length}</span>
            </p>

            {/* Step dot nav */}
            <div className="flex gap-1.5 mb-8 flex-wrap justify-center max-w-xs">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Go to step ${i + 1}`}
                  className={`rounded-full transition-all duration-200 ${
                    i === currentStep
                      ? 'w-5 h-2 bg-[var(--accent-color)]'
                      : i < currentStep
                      ? 'w-2 h-2 bg-[var(--accent-color)]/40'
                      : 'w-2 h-2 bg-white/20'
                  }`}
                />
              ))}
            </div>

            {/* Step text — big and readable */}
            <p className="text-xl sm:text-2xl text-center leading-relaxed font-medium text-white max-w-md">
              {steps[currentStep]}
            </p>
          </div>

          {/* Navigation */}
          <div className="flex-shrink-0 flex items-center gap-3 px-5 pb-8">
            <button
              onClick={() => goTo(currentStep - 1)}
              disabled={isFirst}
              className={`flex-1 py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-1.5 transition-all ${
                isFirst
                  ? 'bg-white/5 text-white/20 cursor-not-allowed'
                  : 'bg-white/10 text-white active:bg-white/20'
              }`}
            >
              <ChevronLeft className="w-5 h-5" /> Prev
            </button>

            {isLast ? (
              <button
                onClick={onExit}
                className="flex-1 py-4 rounded-2xl font-bold text-base bg-[var(--accent-color)] text-white flex items-center justify-center gap-1.5 active:opacity-80"
              >
                <UtensilsCrossed className="w-5 h-5" /> Done!
              </button>
            ) : (
              <button
                onClick={() => goTo(currentStep + 1)}
                className="flex-1 py-4 rounded-2xl font-bold text-base bg-[var(--accent-color)] text-white flex items-center justify-center gap-1.5 active:opacity-80"
              >
                Next <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
