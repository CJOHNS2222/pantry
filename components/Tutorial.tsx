import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles, ShoppingBasket, CalendarDays, UtensilsCrossed, Users, Grid3X3, User, ChefHat, Settings, BarChart3, Mic, CheckCircle, Play, Pause, RotateCcw } from 'lucide-react';
import { Tab } from '../types/app';
import AnalyticsService from '../services/analyticsService';

interface TutorialProps {
  onClose: () => void;
  onSwitchTab: (tab: Tab) => void;
  onOpenHousehold: () => void;
  onCloseHousehold?: () => void;
  onToggleTheme: () => void;
  onOpenRecipeSearch?: () => void;
  onOpenAnalytics?: () => void;
  currentTab: Tab;
  userProgress?: {
    hasAddedItems: boolean;
    hasPlannedMeals: boolean;
    hasSearchedRecipes: boolean;
    hasUsedVoiceSearch: boolean;
  };
}

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: () => void;
  highlight?: string;
  autoAdvance?: boolean;
  interactive?: boolean;
  completionCheck?: () => boolean;
  helpText?: string;
  skipIf?: (progress: any) => boolean;
}

export const Tutorial: React.FC<TutorialProps> = ({
  onClose,
  onSwitchTab,
  onOpenHousehold,
  onCloseHousehold,
  onToggleTheme,
  onOpenRecipeSearch,
  onOpenAnalytics,
  currentTab,
  userProgress = {
    hasAddedItems: false,
    hasPlannedMeals: false,
    hasSearchedRecipes: false,
    hasUsedVoiceSearch: false
  }
}) => {
  const [step, setStep] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isPlaying, setIsPlaying] = useState(true);
  const [userInteractions, setUserInteractions] = useState<Set<string>>(new Set());
  const currentHighlightRef = useRef<string | null>(null);
  const currentStepRef = useRef<number>(0);

  const steps: TutorialStep[] = [
    {
      id: 'welcome',
      title: "Welcome to Smart Pantry Chef!",
      description: "Your AI-powered kitchen assistant. Let's take an interactive tour and get you cooking smarter!",
      icon: <Sparkles className="w-6 h-6 text-[var(--accent-color)]" />,
      interactive: false,
      helpText: "Click Next to start your personalized tour"
    },
    {
      id: 'household',
      title: "Your Household - Let's Get Started",
      description: "First, let's set up your household. This is where family members can share recipes and collaborate.",
      icon: <Users className="w-6 h-6 text-[var(--accent-color)]" />,
      action: () => onOpenHousehold(),
      highlight: 'household-button',
      interactive: true,
      helpText: "Click the household button in the top-left to open the household modal"
    },
    {
      id: 'theme',
      title: "Personalize Your Experience",
      description: "Try switching between light and dark themes. Your preference will be saved automatically.",
      icon: <Settings className="w-6 h-6 text-[var(--accent-color)]" />,
      highlight: 'theme-toggle',
      interactive: true,
      helpText: "Click the theme toggle in the top-right to switch themes"
    },
    {
      id: 'pantry-intro',
      title: "Your Smart Pantry",
      description: "This is your pantry - organized by categories. Let's add your first item to see how it works.",
      icon: <Grid3X3 className="w-6 h-6 text-[var(--accent-color)]" />,
      action: () => onSwitchTab(Tab.PANTRY),
      highlight: 'nav-pantry',
      interactive: true,
      helpText: "Click the Pantry tab to switch to your pantry view",
      skipIf: (progress) => progress.hasAddedItems
    },
    {
      id: 'add-first-item',
      title: "Add Your First Item",
      description: "Try adding an item to your pantry. Click the + button or any empty category to get started.",
      icon: <ChefHat className="w-6 h-6 text-[var(--accent-color)]" />,
      highlight: 'add-item-button',
      interactive: true,
      completionCheck: () => userProgress.hasAddedItems || userInteractions.has('item-added'),
      helpText: "Click the + button or an empty category to add your first pantry item",
      skipIf: (progress) => progress.hasAddedItems
    },
    {
      id: 'shopping-list',
      title: "Smart Shopping List",
      description: "Your shopping list automatically updates when you plan meals or run low on items.",
      icon: <ShoppingBasket className="w-6 h-6 text-[var(--accent-color)]" />,
      action: () => onSwitchTab(Tab.SHOPPING),
      highlight: 'nav-shopping',
      interactive: true,
      completionCheck: () => currentTab === Tab.SHOPPING,
      helpText: "Click the Shopping tab to see your smart shopping list"
    },
    {
      id: 'meal-planning',
      title: "Meal Planning Made Easy",
      description: "Plan your meals for the week. Get cooking reminders and never wonder 'what's for dinner?' again.",
      icon: <CalendarDays className="w-6 h-6 text-[var(--accent-color)]" />,
      action: () => onSwitchTab(Tab.MEALS),
      highlight: 'nav-meals',
      interactive: true,
      completionCheck: () => currentTab === Tab.MEALS,
      helpText: "Click the Meals tab to explore meal planning",
      skipIf: (progress) => progress.hasPlannedMeals
    },
    {
      id: 'add-recipe',
      title: "Add Your First Recipe",
      description: "Click on any day in the meal planner, then click 'Add Recipe' to search our recipe database.",
      icon: <UtensilsCrossed className="w-6 h-6 text-[var(--accent-color)]" />,
      highlight: 'add-recipe-button',
      interactive: true,
      completionCheck: () => userProgress.hasPlannedMeals || userInteractions.has('recipe-added'),
      helpText: "Click on a day in the meal planner, then click 'Add Recipe'",
      skipIf: (progress) => progress.hasPlannedMeals
    },
    {
      id: 'recipe-finder',
      title: "AI Recipe Finder",
      description: "Use AI to find recipes! Try 'Use Inventory Only' to create recipes from what you actually have.",
      icon: <UtensilsCrossed className="w-6 h-6 text-[var(--accent-color)]" />,
      action: () => onSwitchTab(Tab.RECIPES),
      highlight: 'nav-recipes',
      interactive: true,
      completionCheck: () => currentTab === Tab.RECIPES,
      helpText: "Click the Chef tab to explore AI recipe finding",
      skipIf: (progress) => progress.hasSearchedRecipes
    },
    {
      id: 'voice-search',
      title: "Voice Search - Hands-Free Cooking",
      description: "Try voice search! Click the microphone and say 'Find chicken recipes' or 'Make pasta dish'.",
      icon: <Mic className="w-6 h-6 text-[var(--accent-color)]" />,
      highlight: 'voice-search',
      interactive: true,
      completionCheck: () => userProgress.hasUsedVoiceSearch || userInteractions.has('voice-used'),
      helpText: "Click the microphone icon to try voice search",
      skipIf: (progress) => progress.hasUsedVoiceSearch
    },
    {
      id: 'community',
      title: "Community Recipes & Inspiration",
      description: "Discover recipes from other cooks, save favorites, and get inspired by community ratings.",
      icon: <Users className="w-6 h-6 text-[var(--accent-color)]" />,
      action: () => onSwitchTab(Tab.COMMUNITY),
      highlight: 'nav-community',
      interactive: true,
      completionCheck: () => currentTab === Tab.COMMUNITY,
      helpText: "Click the Community tab to explore shared recipes"
    },
    {
      id: 'analytics',
      title: "Your Cooking Analytics",
      description: "See insights about your pantry usage, expiration trends, and cooking habits. This helps us learn your preferences!",
      icon: <BarChart3 className="w-6 h-6 text-[var(--accent-color)]" />,
      action: () => onSwitchTab(Tab.SETTINGS),
      highlight: 'nav-settings',
      interactive: true,
      completionCheck: () => currentTab === Tab.SETTINGS,
      helpText: "Click the Settings tab to see your analytics and customize preferences"
    },
    {
      id: 'completion',
      title: "You're All Set! 🎉",
      description: "You've completed the interactive tour! Smart Pantry Chef will continue learning from your usage to provide better recommendations. Start exploring and happy cooking!",
      icon: <CheckCircle className="w-6 h-6 text-green-500" />,
      interactive: false,
      helpText: "Click 'Get Started' to begin using Smart Pantry Chef"
    }
  ];

  // Filter steps based on user progress (memoized for performance)
  const activeSteps = useMemo(() => 
    steps.filter(step => !step.skipIf || !step.skipIf(userProgress)),
    [userProgress]
  );

  const currentStepData = activeSteps[step];
  const isCompleted = completedSteps.has(step);

  const handleNext = useCallback(() => {
    if (!isPlaying) return;

    // Close household modal if it's open and we're moving past the household step
    if (step >= 1 && onCloseHousehold) {
      onCloseHousehold();
    }

    // After theme toggle step, switch back to dark theme
    if (step === 2) {
      setTimeout(() => onToggleTheme(), 500);
    }

    if (step < activeSteps.length - 1) {
      setStep(step + 1);
      setCompletedSteps(prev => new Set([...prev, step]));
    } else {
      // Track tutorial completion
      AnalyticsService.trackTutorialComplete();
      onClose();
    }
  }, [step, activeSteps.length, onClose, onCloseHousehold, onToggleTheme, isPlaying]);

  const handlePrev = useCallback(() => {
    if (step > 0) {
      const newStep = step - 1;
      setStep(newStep);

      // Re-open household modal if going back to step 1
      if (newStep === 1) {
        setTimeout(() => onOpenHousehold(), 300);
      }
    }
  }, [step, onOpenHousehold]);

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
  };

  const restartTutorial = () => {
    setStep(0);
    setCompletedSteps(new Set());
    setUserInteractions(new Set());
    setIsPlaying(true);
  };

  // Handle step actions and highlighting
  useEffect(() => {
    if (!currentStepData) return;

    setHighlightedElement(currentStepData.highlight);

    // Track tutorial step
    AnalyticsService.trackTutorialStep(step, currentStepData.title);

    // Add glow effect to highlighted elements
    if (currentStepData.highlight) {
      // Remove previous glow effects
      document.querySelectorAll('.tutorial-glow').forEach(el => {
        el.classList.remove('tutorial-glow');
      });

      // Add glow effect to current highlighted element
      const element = document.querySelector(`[data-tutorial="${currentStepData.highlight}"]`);
      if (element) {
        element.classList.add('tutorial-glow');
      }
    } else {
      // Remove all glow effects if no highlight
      document.querySelectorAll('.tutorial-glow').forEach(el => {
        el.classList.remove('tutorial-glow');
      });
    }

    if (currentStepData.action && isPlaying && !currentStepData.interactive) {
      // Only call actions automatically for non-interactive steps
      const delay = step === 1 ? 2000 : 300;
      setTimeout(() => {
        currentStepData.action();
      }, delay);
    }
  }, [step, currentStepData, isPlaying]);

  // Detect user interactions with highlighted elements
  useEffect(() => {
    if (currentStepData?.interactive && currentStepData.highlight && isPlaying) {
      currentHighlightRef.current = currentStepData.highlight;
      currentStepRef.current = step;
      
      const handleElementClick = (event: Event) => {
        const target = event.target as HTMLElement;
        let element: HTMLElement | null = target;
        
        // Check if the target or any parent has the data-tutorial attribute
        while (element && element !== document.body) {
          if (element.hasAttribute('data-tutorial') && element.getAttribute('data-tutorial') === currentHighlightRef.current) {
            // Mark this step as completed
            setCompletedSteps(prev => new Set([...prev, currentStepRef.current]));
            // Call the action after user interaction
            if (currentStepData.action) {
              setTimeout(() => {
                currentStepData.action();
              }, 500);
            }
            break;
          }
          element = element.parentElement;
        }
      };

      // Add click listener to the document
      document.addEventListener('click', handleElementClick);

      return () => {
        document.removeEventListener('click', handleElementClick);
      };
    } else {
      currentHighlightRef.current = null;
    }
  }, [currentStepData?.interactive, currentStepData?.highlight, isPlaying]);

  // Auto-advance for completed interactive steps
  useEffect(() => {
    if (currentStepData?.interactive && isPlaying && completedSteps.has(step)) {
      // Auto-advance after a short delay when step is completed
      const timer = setTimeout(() => {
        if (step < activeSteps.length - 1) {
          handleNext();
        }
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [currentStepData, step, activeSteps.length, handleNext, isPlaying, completedSteps]);

  // Track tutorial start
  useEffect(() => {
    AnalyticsService.trackTutorialStart();
  }, []);

  if (!currentStepData) return null;

  return (
    <>
      {/* Highlight Overlay */}
      {highlightedElement && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" />
        </div>
      )}

      {/* Tutorial Modal */}
      <div className={`fixed z-50 animate-fade-in right-4`} style={
        highlightedElement?.startsWith('nav-') ? { bottom: '185px' } :
        highlightedElement === 'add-item-button' || highlightedElement === 'add-recipe-button' ? { top: '20px', right: '20px' } :
        { bottom: '66px' }
      }>
        <div className="bg-theme-secondary border border-theme w-80 rounded-2xl shadow-2xl relative overflow-hidden">

          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--accent-color)] to-transparent"></div>

          {/* Control Buttons */}
          <div className="absolute top-2 left-2 flex gap-1 z-10">
            <button
              onClick={togglePlayback}
              className="p-1 opacity-60 hover:opacity-100 transition-colors bg-theme-secondary/80 rounded"
              title={isPlaying ? "Pause tutorial" : "Resume tutorial"}
            >
              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>
            <button
              onClick={restartTutorial}
              className="p-1 opacity-60 hover:opacity-100 transition-colors bg-theme-secondary/80 rounded"
              title="Restart tutorial"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          <button
            onClick={onClose}
            className="absolute right-4 top-4 opacity-50 hover:opacity-100 transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="p-6 pb-3 flex flex-col items-center text-center">

            <div className="flex items-center gap-2 mb-2">
              {currentStepData.icon}
              {currentStepData.interactive && (
                <div className={`w-2 h-2 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
              )}
            </div>

            <h3 className="text-xl font-serif font-bold text-theme-primary mb-2">
              {currentStepData.title}
            </h3>

            <p className="text-theme-secondary opacity-70 text-sm leading-relaxed mb-4 min-h-[60px]">
              {currentStepData.description}
            </p>

            {currentStepData.interactive && (
              <div className="w-full mb-4">
                <div className="flex items-center justify-center gap-2 text-xs text-theme-secondary/60 mb-2">
                  {isCompleted ? (
                    <>
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      <span>Completed!</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                      <span>{currentStepData.helpText}</span>
                    </>
                  )}
                </div>
                {!isCompleted && (
                  <div className="w-full bg-theme/20 rounded-full h-1">
                    <div className="bg-yellow-500 h-1 rounded-full animate-pulse w-1/3" />
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between w-full mt-auto">
              <div className="flex gap-1">
                {activeSteps.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                      idx === step
                        ? 'bg-[var(--accent-color)] w-3'
                        : completedSteps.has(idx)
                        ? 'bg-green-500'
                        : 'bg-theme opacity-30'
                    }`}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                {step > 0 && (
                  <button
                    onClick={handlePrev}
                    className="p-1 opacity-60 hover:opacity-100 transition-colors"
                    disabled={!isPlaying}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-all flex items-center gap-1 shadow-lg ${
                    currentStepData.interactive && !isCompleted
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-white cursor-not-allowed'
                      : 'bg-[var(--accent-color)] hover:opacity-90 text-white'
                  }`}
                  disabled={currentStepData.interactive && !isCompleted && isPlaying}
                >
                  {step === activeSteps.length - 1 ? "Get Started" : "Next"}
                  {step < activeSteps.length - 1 && <ChevronRight className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};