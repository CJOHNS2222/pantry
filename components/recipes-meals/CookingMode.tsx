import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, UtensilsCrossed, List, BookOpen, Clock } from 'lucide-react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { StructuredRecipe } from '../../types';
import { log } from '../../services/logService';
import HapticService from '../../services/hapticService';

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

/** Parse step text to extract a timer duration in seconds. */
function parseTimerSeconds(stepText: string): number | null {
  const text = stepText.toLowerCase();
  
  // 1. Check for combined hour + minute: "1 hour and 15 minutes" or "2 hrs 30 mins"
  const combinedRegex = /(\d+)\s*(?:hour|hr)s?(?:\s+(?:and\s+)?(\d+)\s*(?:minute|min)s?)?/i;
  const combinedMatch = combinedRegex.exec(text);
  if (combinedMatch) {
    const hours = parseInt(combinedMatch[1], 10);
    const minutes = combinedMatch[2] ? parseInt(combinedMatch[2], 10) : 0;
    return (hours * 3600) + (minutes * 60);
  }
  
  // 2. Check for minutes only: "25 minutes" or "10 mins"
  const minuteRegex = /(\d+)\s*(?:minute|min)s?/i;
  const minuteMatch = minuteRegex.exec(text);
  if (minuteMatch) {
    return parseInt(minuteMatch[1], 10) * 60;
  }
  
  // 3. Check for seconds only: "30 seconds" or "10 secs"
  const secondRegex = /(\d+)\s*(?:second|sec)s?/i;
  const secondMatch = secondRegex.exec(text);
  if (secondMatch) {
    return parseInt(secondMatch[1], 10);
  }
  
  return null;
}

/** Format seconds into a user-friendly duration string (e.g., "1h 15m" or "25m"). */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
  }
  if (minutes > 0) {
    return `${minutes}m${secs > 0 ? ` ${secs}s` : ''}`;
  }
  return `${secs}s`;
}

/** Format seconds left into a MM:SS or HH:MM:SS countdown string. */
function formatTimeLeft(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (num: number) => String(num).padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  }
  return `${pad(minutes)}:${pad(secs)}`;
}

export const CookingMode: React.FC<CookingModeProps> = ({ recipe, onExit }) => {
  const steps = processSteps(recipe.instructions || []);
  const [currentStep, setCurrentStep] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
   
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  // Timer states (active globally within CookingMode so it persists across step navigation)
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [isTimerActive, setIsTimerActive] = useState<boolean>(false);
  const [notificationId, setNotificationId] = useState<number | null>(null);

  // Acquire screen wake lock so the display stays on while cooking
  useEffect(() => {
    let released = false;

    const requestWakeLock = async () => {
      if (released) return;
      if ('wakeLock' in navigator) {
        try {
          const navWithWakeLock = navigator as typeof navigator & {
            wakeLock?: {
              request: (type: 'screen') => Promise<{ release: () => Promise<void> }>;
            };
          };
          if (navWithWakeLock.wakeLock) {
            wakeLockRef.current = await navWithWakeLock.wakeLock.request('screen');
          }
        } catch (error) {
          log.info('Wake lock request failed or unsupported', { error });
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
      wakeLockRef.current?.release().catch((err: unknown) => log.info('Wake lock release skipped or failed', { error: err }));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Timer Countdown Effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isTimerActive && timerSeconds !== null && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev === null || prev <= 1) {
            handleTimerFinished();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerActive, timerSeconds]);

  // Clean up notifications on unmount
  useEffect(() => {
    return () => {
      if (notificationId) {
        LocalNotifications.cancel({ notifications: [{ id: notificationId }] }).catch((err: unknown) => log.info('Notification cancellation skipped or failed', { error: err }));
      }
    };
  }, [notificationId]);

  const handleTimerFinished = () => {
    setIsTimerActive(false);
    setNotificationId(null);
    HapticFeedback();
  };

  const HapticFeedback = () => {
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 400]);
    }
  };

  const startTimer = async (seconds: number) => {
    try {
      // Cancel any existing timer/notification first
      if (notificationId) {
        await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
      }

      // Request local notification permissions
      if (Capacitor.isNativePlatform()) {
        const perm = await LocalNotifications.requestPermissions();
        if (perm.display !== 'granted') {
          log.warn('Notification permission not granted for Cooking Mode timers', 'CookingMode');
        }
      }

      const notifId = Math.floor(Math.random() * 1000000);
      
      // Schedule local notification to fire in background
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title: `Cooking Timer Finished! 🍳`,
            body: `Your timer for "${recipe.title}" is complete.`,
            schedule: { at: new Date(Date.now() + seconds * 1000) },
            sound: 'beep.wav'
          }
        ]
      });

      setNotificationId(notifId);
      setTimerSeconds(seconds);
      setIsTimerActive(true);
    } catch (error) {
      log.error('Failed to schedule cooking timer notification', { error }, 'CookingMode');
      // Fallback: start local timer without notification
      setTimerSeconds(seconds);
      setIsTimerActive(true);
    }
  };

  const togglePauseResume = async () => {
    if (timerSeconds === null) return;

    if (isTimerActive) {
      // Pause: Cancel background notification
      if (notificationId) {
        await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
        setNotificationId(null);
      }
      setIsTimerActive(false);
    } else {
      // Resume: Schedule new notification for remaining seconds
      await startTimer(timerSeconds);
    }
  };

  const cancelTimer = async () => {
    if (notificationId) {
      await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
      setNotificationId(null);
    }
    setTimerSeconds(null);
    setIsTimerActive(false);
  };

  const goTo = (i: number) => setCurrentStep(Math.max(0, Math.min(steps.length - 1, i)));
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  const currentStepText = steps[currentStep];
  const parsedSeconds = parseTimerSeconds(currentStepText);

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
              <li key={`ing_${i}_${ing.slice(0, 10)}`} className="flex items-start gap-3 text-base text-gray-200 leading-snug">
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
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 overflow-y-auto">
            {/* Step counter */}
            <p className="text-sm text-gray-500 mb-4 font-medium tracking-wide flex-shrink-0">
              Step {currentStep + 1}{' '}
              <span className="text-gray-700">/ {steps.length}</span>
            </p>

            {/* Step dot nav */}
            <div className="flex gap-1.5 mb-6 flex-wrap justify-center max-w-xs flex-shrink-0">
              {steps.map((_, i) => (
                <button
                  key={`step_${i}`}
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
            <p className="text-xl sm:text-2xl text-center leading-relaxed font-medium text-white max-w-md mb-6">
              {currentStepText}
            </p>

            {/* Inline parsed timer CTA */}
            {parsedSeconds !== null && timerSeconds === null && (
              <button
                onClick={() => startTimer(parsedSeconds)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-sm font-semibold rounded-xl text-[var(--accent-color)] border border-white/10 transition-all shadow-md flex-shrink-0"
              >
                <Clock className="w-4 h-4 text-[var(--accent-color)]" />
                <span>Start {formatDuration(parsedSeconds)} Timer</span>
              </button>
            )}
          </div>

          {/* Docked Active/Paused Timer Bar */}
          {timerSeconds !== null && (
            <div className="mx-5 mb-4 p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 flex items-center justify-between shadow-lg flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${isTimerActive ? 'bg-[var(--accent-color)] text-white animate-pulse' : 'bg-white/10 text-gray-400'}`}>
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                    {isTimerActive ? 'Active Timer' : 'Timer Paused'}
                  </p>
                  <p className="text-lg font-mono font-bold leading-tight mt-0.5">
                    {formatTimeLeft(timerSeconds)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePauseResume}
                  className="px-3 py-2 bg-white/10 hover:bg-white/15 active:scale-95 text-xs font-semibold rounded-lg transition-all"
                >
                  {isTimerActive ? 'Pause' : 'Resume'}
                </button>
                <button
                  onClick={cancelTimer}
                  className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 active:scale-95 text-xs font-semibold text-red-300 rounded-lg transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex-shrink-0 flex items-center gap-3 px-5 pb-8">
            <button
              onClick={() => {
                if (!isFirst) {
                  HapticService.light();
                  goTo(currentStep - 1);
                }
              }}
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
                onClick={() => {
                  HapticService.success();
                  onExit();
                }}
                className="flex-1 py-4 rounded-2xl font-bold text-base bg-[var(--accent-color)] text-white flex items-center justify-center gap-1.5 active:opacity-80"
              >
                <UtensilsCrossed className="w-5 h-5" /> Done!
              </button>
            ) : (
              <button
                onClick={() => {
                  if (!isLast) {
                    HapticService.light();
                    goTo(currentStep + 1);
                  }
                }}
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
