import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, UtensilsCrossed, List, BookOpen, Clock, Check } from 'lucide-react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { StructuredRecipe } from '../../types';
import { log } from '../../services/logService';
import HapticService from '../../services/hapticService';

interface DocumentWithPrefixes extends Document {
  webkitExitFullscreen?: () => void;
  mozCancelFullScreen?: () => void;
  msExitFullscreen?: () => void;
  webkitFullscreenElement?: Element;
  mozFullScreenElement?: Element;
  msFullscreenElement?: Element;
}

interface HTMLElementWithPrefixes extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
  mozRequestFullScreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
}

interface CookingModeProps {
  recipes: StructuredRecipe[];
  initialIndex?: number;
  onExit: (completedRecipe?: StructuredRecipe) => void;
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

export const CookingMode: React.FC<CookingModeProps> = ({ recipes = [], initialIndex = 0, onExit }) => {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  
  // Per-recipe cooking state maps
  const [recipeStepsMap, setRecipeStepsMap] = useState<Record<number, number>>({});
  const [checkedIngredientsMap, setCheckedIngredientsMap] = useState<Record<number, Record<number, boolean>>>({});

  // Active recipe references
  const recipe = recipes[activeIndex] || recipes[0];
  const steps = useMemo(() => processSteps(recipe?.instructions || []), [recipe]);
  const currentStep = recipeStepsMap[activeIndex] || 0;
  const checkedIngredients = checkedIngredientsMap[activeIndex] || {};

  const [showIngredientsMobile, setShowIngredientsMobile] = useState(false);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  interface ActiveTimer {
    seconds: number;
    isActive: boolean;
    notificationId: number | null;
    label: string;
  }

  // Dictionary of timers index by recipe index
  const [recipeTimers, setRecipeTimers] = useState<Record<number, ActiveTimer>>({});
  const timersRef = useRef<Record<number, ActiveTimer>>({});

  useEffect(() => {
    timersRef.current = recipeTimers;
  }, [recipeTimers]);

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

  // Manage fullscreen immersive mode and orientation lock for Cooking Mode
  useEffect(() => {
    let active = true;

    const requestImmersiveLandscape = async () => {
      // 1. Request landscape orientation lock
      if (screen.orientation && typeof screen.orientation.lock === 'function') {
        try {
          await screen.orientation.lock('landscape');
        } catch (error) {
          log.info('Orientation lock rejected or unsupported', { error });
        }
      }

      // 2. Request immersive fullscreen mode (hides system nav and notification bars)
      if (active) {
        try {
          const docEl = document.documentElement as HTMLElementWithPrefixes;
          if (docEl.requestFullscreen) {
            await docEl.requestFullscreen();
          } else if (docEl.webkitRequestFullscreen) {
            await docEl.webkitRequestFullscreen();
          } else if (docEl.mozRequestFullScreen) {
            await docEl.mozRequestFullScreen();
          } else if (docEl.msRequestFullscreen) {
            await docEl.msRequestFullscreen();
          }
        } catch (error) {
          log.info('Fullscreen request rejected or unsupported', { error });
        }
      }
    };

    requestImmersiveLandscape();

    return () => {
      active = false;
      
      // 1. Restore/unlock screen orientation
      if (screen.orientation && typeof screen.orientation.unlock === 'function') {
        try {
          screen.orientation.unlock();
        } catch (error) {
          log.info('Orientation unlock failed or unsupported', { error });
        }
      }

      // 2. Exit immersive fullscreen mode
      try {
        const doc = document as DocumentWithPrefixes;
        if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement) {
          if (doc.exitFullscreen) {
            doc.exitFullscreen().catch((err: unknown) => log.info('Exit fullscreen error', { error: err }));
          } else if (doc.webkitExitFullscreen) {
            doc.webkitExitFullscreen();
          } else if (doc.mozCancelFullScreen) {
            doc.mozCancelFullScreen();
          } else if (doc.msExitFullscreen) {
            doc.msExitFullscreen();
          }
        }
      } catch (error) {
        log.info('Exit fullscreen failed or unsupported', { error });
      }
    };
  }, []);

  // Timer Countdown Effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    
    // Check if there are any active timers running
    const hasActiveTimers = Object.values(recipeTimers).some(t => t.isActive && t.seconds > 0);
    
    if (hasActiveTimers) {
      interval = setInterval(() => {
        setRecipeTimers(prev => {
          const updated = { ...prev };
          let changed = false;
          
          for (const key in updated) {
            const timer = updated[key];
            if (timer && timer.isActive && timer.seconds > 0) {
              if (timer.seconds === 1) {
                // Timer finished!
                HapticFeedback();
                updated[key] = {
                  ...timer,
                  seconds: 0,
                  isActive: false,
                  notificationId: null
                };
              } else {
                updated[key] = {
                  ...timer,
                  seconds: timer.seconds - 1
                };
              }
              changed = true;
            }
          }
          
          return changed ? updated : prev;
        });
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recipeTimers]);

  useEffect(() => {
    return () => {
      // Cancel all running notifications on unmount
      Object.values(timersRef.current).forEach(timer => {
        if (timer.notificationId) {
          LocalNotifications.cancel({ notifications: [{ id: timer.notificationId }] }).catch(() => {});
        }
      });
    };
  }, []);

  const HapticFeedback = () => {
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 400]);
    }
  };

  const startTimer = async (recipeIdx: number, seconds: number, stepLabel: string) => {
    try {
      const currentTimer = recipeTimers[recipeIdx];
      if (currentTimer?.notificationId) {
        await LocalNotifications.cancel({ notifications: [{ id: currentTimer.notificationId }] });
      }

      if (Capacitor.isNativePlatform()) {
        const perm = await LocalNotifications.requestPermissions();
        if (perm.display !== 'granted') {
          log.warn('Notification permission not granted for Cooking Mode timers', 'CookingMode');
        }
      }

      const notifId = Math.floor(Math.random() * 1000000);
      const recipeTitle = recipes[recipeIdx]?.title || 'Recipe';

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title: `Cooking Timer Finished! 🍳`,
            body: `Your timer for "${recipeTitle}" (${stepLabel}) is complete.`,
            schedule: { at: new Date(Date.now() + seconds * 1000) },
            sound: 'beep.wav'
          }
        ]
      });

      setRecipeTimers(prev => ({
        ...prev,
        [recipeIdx]: {
          seconds,
          isActive: true,
          notificationId: notifId,
          label: stepLabel
        }
      }));
    } catch (error) {
      log.error('Failed to schedule cooking timer notification', { error }, 'CookingMode');
      setRecipeTimers(prev => ({
        ...prev,
        [recipeIdx]: {
          seconds,
          isActive: true,
          notificationId: null,
          label: stepLabel
        }
      }));
    }
  };

  const togglePauseResume = async (recipeIdx: number) => {
    const timer = recipeTimers[recipeIdx];
    if (!timer) return;

    if (timer.isActive) {
      if (timer.notificationId) {
        await LocalNotifications.cancel({ notifications: [{ id: timer.notificationId }] });
      }
      setRecipeTimers(prev => ({
        ...prev,
        [recipeIdx]: {
          ...timer,
          isActive: false,
          notificationId: null
        }
      }));
    } else {
      await startTimer(recipeIdx, timer.seconds, timer.label);
    }
  };

  const cancelTimer = async (recipeIdx: number) => {
    const timer = recipeTimers[recipeIdx];
    if (timer?.notificationId) {
      await LocalNotifications.cancel({ notifications: [{ id: timer.notificationId }] });
    }
    setRecipeTimers(prev => {
      const updated = { ...prev };
      delete updated[recipeIdx];
      return updated;
    });
  };

  const goTo = (i: number) => {
    setRecipeStepsMap(prev => ({
      ...prev,
      [activeIndex]: Math.max(0, Math.min(steps.length - 1, i))
    }));
  };

  const toggleIngredientCheck = (ingIdx: number) => {
    setCheckedIngredientsMap(prev => {
      const recipeChecked = { ...prev[activeIndex] };
      recipeChecked[ingIdx] = !recipeChecked[ingIdx];
      return {
        ...prev,
        [activeIndex]: recipeChecked
      };
    });
    HapticService.light();
  };

  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  // const currentStepText = steps[currentStep] || '';
  // const parsedSeconds = parseTimerSeconds(currentStepText);

  if (!recipe || steps.length === 0) {
    return (
      <div className="fixed inset-0 z-[60] bg-[#121212] flex flex-col items-center justify-center text-white p-8">
        <UtensilsCrossed className="w-12 h-12 text-gray-500 mb-4" />
        <p className="text-center text-lg text-gray-400 mb-8">No step-by-step instructions available for this recipe.</p>
        <button
          onClick={() => onExit()}
          className="px-8 py-4 bg-[var(--accent-color)] text-white rounded-2xl font-bold text-base"
        >
          Exit Cooking Mode
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-[#121212] flex flex-col text-white select-none overflow-hidden animate-fade-in">
      {/* Header with Recipe Switching */}
      <div className="flex flex-col border-b border-white/10 flex-shrink-0 bg-black/35 shadow-md">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-[9px] text-[var(--accent-color)] uppercase tracking-widest font-bold">Cooking Mode</p>
            <h2 className="text-base font-bold truncate text-white mt-0.5 font-serif">{recipe.title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowIngredientsMobile(v => !v)}
              className={`p-2 rounded-full transition-colors md:hidden ${
                showIngredientsMobile
                  ? 'bg-[var(--accent-color)] text-white'
                  : 'bg-white/10 text-gray-400 hover:bg-white/20'
              }`}
              aria-label={showIngredientsMobile ? 'Show steps' : 'Show ingredients'}
            >
              {showIngredientsMobile ? <BookOpen className="w-4 h-4" /> : <List className="w-4 h-4" />}
            </button>
            <button
              onClick={() => onExit()}
              className="p-2 bg-white/10 rounded-full text-gray-400 hover:bg-white/20 transition-colors"
              aria-label="Exit cooking mode"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Multi-recipe Segmented Control Switcher */}
        {recipes.length > 1 && (
          <div className="px-5 pb-3">
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 gap-1 overflow-x-auto scrollbar-none">
              {recipes.map((r, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setActiveIndex(idx);
                    setShowIngredientsMobile(false);
                    HapticService.light();
                  }}
                  className={`flex-1 min-w-[120px] py-1.5 px-3 rounded-lg text-xs font-bold transition-all truncate ${
                    idx === activeIndex
                      ? 'bg-[var(--accent-color)] text-white shadow-sm font-extrabold'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }`}
                >
                  {r.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main split screen layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Side: Ingredients Checklist (visible on large screen, or on small screen if mobile toggle is checked) */}
        <div className={`overflow-y-auto px-6 py-6 border-r border-white/10 bg-black/20 ${
          showIngredientsMobile ? 'flex flex-col w-full' : 'hidden md:flex md:flex-col md:w-1/3'
        }`}>
          {/* Visual End-Result Image */}
          {recipe.image && (
            <div className="mb-4 rounded-xl overflow-hidden border border-white/10 flex-shrink-0 shadow-md">
              <img
                src={recipe.image}
                alt={recipe.title}
                className="w-full h-36 object-cover"
              />
            </div>
          )}

          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <h3 className="text-sm font-bold text-[var(--accent-color)] uppercase tracking-wider">
              Ingredients
            </h3>
            <span className="text-xs text-gray-500">
              {Object.values(checkedIngredients).filter(Boolean).length} / {(recipe.ingredients || []).length} checked
            </span>
          </div>
          <ul className="space-y-3.5 overflow-y-auto flex-1 pr-1">
            {(recipe.ingredients || []).map((ing, i) => {
              const isChecked = checkedIngredients[i] || false;
              return (
                <li
                  key={`ing_${i}`}
                  onClick={() => toggleIngredientCheck(i)}
                  className="flex items-start gap-3 py-1 cursor-pointer select-none group"
                >
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors mt-0.5 flex-shrink-0 ${
                    isChecked
                      ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white'
                      : 'border-white/20 group-hover:border-white/40 text-transparent'
                  }`}>
                    <Check className="w-3.5 h-3.5 stroke-[3px]" />
                  </div>
                  <span className={`text-sm leading-snug transition-all ${
                    isChecked ? 'text-gray-500 line-through' : 'text-gray-200'
                  }`}>
                    {ing}
                  </span>
                </li>
              );
            })}
          </ul>
          {showIngredientsMobile && (
            <button
              onClick={() => setShowIngredientsMobile(false)}
              className="mt-6 w-full py-4 bg-[var(--accent-color)] text-white rounded-xl font-bold text-sm flex-shrink-0"
            >
              Show Instructions Steps
            </button>
          )}
        </div>

        {/* Right Side: Highlightable Steps List */}
        <div className={`flex-1 flex flex-col overflow-hidden min-w-0 ${showIngredientsMobile ? 'hidden' : 'flex'}`}>
          {/* Scrolling Steps List */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            <h3 className="text-sm font-bold text-[var(--accent-color)] uppercase tracking-wider mb-2 flex-shrink-0">
              Instructions
            </h3>
            <div className="space-y-4">
              {steps.map((step, idx) => {
                const isActive = idx === currentStep;
                const isPassed = idx < currentStep;
                const stepSeconds = parseTimerSeconds(step);

                return (
                  <div
                    key={idx}
                    onClick={() => goTo(idx)}
                    className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer select-none relative ${
                      isActive
                        ? 'bg-white/5 border-[var(--accent-color)] shadow-[0_0_15px_rgba(var(--accent-color-rgb),0.1)] scale-[1.01]'
                        : isPassed
                        ? 'bg-black/10 border-white/5 opacity-40 hover:opacity-60'
                        : 'bg-black/5 border-white/5 opacity-60 hover:opacity-85'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isActive
                          ? 'bg-[var(--accent-color)] text-white shadow-sm'
                          : isPassed
                          ? 'bg-white/20 text-gray-400'
                          : 'bg-white/5 text-gray-500'
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm sm:text-base leading-relaxed ${
                          isActive ? 'text-white font-medium' : 'text-gray-300'
                        }`}>
                          {step}
                        </p>

                        {/* Inline Timer Button for active step */}
                        {isActive && stepSeconds !== null && !(recipeTimers[activeIndex] && recipeTimers[activeIndex].seconds > 0) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startTimer(activeIndex, stepSeconds, `Step ${idx + 1}`);
                            }}
                            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 active:scale-95 text-xs font-bold rounded-lg text-[var(--accent-color)] transition-all shadow-sm"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Start {formatDuration(stepSeconds)} Timer</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Global Timers List */}
          {Object.entries(recipeTimers).map(([idxStr, timer]) => {
            const idx = parseInt(idxStr, 10);
            const timerRecipe = recipes[idx];
            if (!timerRecipe || timer.seconds <= 0) return null;

            return (
              <div key={idx} className="mx-6 mb-3 p-4 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 flex items-center justify-between shadow-md flex-shrink-0 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${timer.isActive ? 'bg-[var(--accent-color)] text-white animate-pulse' : 'bg-white/10 text-gray-400'}`}>
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider truncate">
                      {timer.isActive ? 'Active Timer' : 'Timer Paused'} • {timerRecipe.title}
                    </p>
                    <p className="text-base font-mono font-bold leading-tight mt-0.5">
                      {formatTimeLeft(timer.seconds)} <span className="text-xs font-normal text-gray-400 font-sans ml-1">({timer.label})</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <button
                    onClick={() => togglePauseResume(idx)}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/15 active:scale-95 text-xs font-bold rounded-lg transition-all"
                  >
                    {timer.isActive ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={() => cancelTimer(idx)}
                    className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 active:scale-95 text-xs font-bold text-red-300 rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          })}

          {/* Navigation Controls */}
          <div className="flex-shrink-0 flex items-center gap-3 px-6 pb-6 pt-2 border-t border-white/5 bg-black/20">
            <button
              onClick={() => {
                if (!isFirst) {
                  HapticService.light();
                  goTo(currentStep - 1);
                }
              }}
              disabled={isFirst}
              className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1 transition-all ${
                isFirst
                  ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
                  : 'bg-white/10 text-white active:bg-white/20 border border-white/10'
              }`}
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>

            {isLast ? (
              <button
                onClick={() => {
                  HapticService.success();
                  onExit(recipe);
                }}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-[var(--accent-color)] text-white flex items-center justify-center gap-1 active:opacity-85 shadow-sm"
              >
                <UtensilsCrossed className="w-4 h-4" /> Complete Cooking
              </button>
            ) : (
              <button
                onClick={() => {
                  if (!isLast) {
                    HapticService.light();
                    goTo(currentStep + 1);
                  }
                }}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-[var(--accent-color)] text-white flex items-center justify-center gap-1 active:opacity-85 shadow-sm"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
