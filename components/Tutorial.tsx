import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles, ShoppingBasket, CalendarDays, UtensilsCrossed, Users, Grid3X3, User, ChefHat, Settings, BarChart3, Mic, Bell } from 'lucide-react';
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
}

export const Tutorial: React.FC<TutorialProps> = ({
  onClose,
  onSwitchTab,
  onOpenHousehold,
  onCloseHousehold,
  onToggleTheme,
  onOpenRecipeSearch,
  onOpenAnalytics,
  currentTab
}) => {
  const [step, setStep] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState<string | null>(null);

  const steps = [
    {
      title: "Welcome to Smart Pantry Chef!",
      description: "Your AI-powered kitchen assistant. Let's take an interactive tour of your new kitchen companion.",
      icon: <Sparkles className="w-6 h-6 text-[var(--accent-color)]" />,
      action: null,
      highlight: null,
      autoAdvance: false
    },
    {
      title: "Your Household - Top Left",
      description: "Click here to manage your household. Add family members to share recipes, meal plans, and collaborate on your shared pantry inventory.",
      icon: <Users className="w-6 h-6 text-[var(--accent-color)]" />,
      action: () => onOpenHousehold(),
      highlight: 'household-button',
      autoAdvance: false
    },
    {
      title: "Theme Toggle - Top Right",
      description: "Switch between light and dark themes to match your preference. Your choice is automatically saved.",
      icon: <Settings className="w-6 h-6 text-[var(--accent-color)]" />,
      action: () => onToggleTheme(),
      highlight: 'theme-toggle',
      autoAdvance: false
    },
    {
      title: "Navigation Tabs",
      description: "Your app is organized into 6 main sections. Let's explore each one. We'll start with your Pantry - where you track what you have.",
      icon: <ChefHat className="w-6 h-6 text-[var(--accent-color)]" />,
      action: () => onSwitchTab(Tab.PANTRY),
      highlight: 'nav-pantry',
      autoAdvance: false
    },
    {
      title: "Pantry Management",
      description: "This is your pantry - organized by categories. Add items manually or scan receipts with AI. Notice the category/location toggles at the top.",
      icon: <Grid3X3 className="w-6 h-6 text-[var(--accent-color)]" />,
      action: null,
      highlight: 'category-toggle',
      autoAdvance: false
    },
    {
      title: "Shopping List",
      description: "Switching to your shopping list - this shows what you need. Items are automatically added when you plan meals or scan receipts.",
      icon: <ShoppingBasket className="w-6 h-6 text-[var(--accent-color)]" />,
      action: () => onSwitchTab(Tab.SHOPPING),
      highlight: 'nav-shopping',
      autoAdvance: false
    },
    {
      title: "Meal Planning",
      description: "Now let's look at meal planning. Here you can schedule meals for the week and get cooking reminders.",
      icon: <CalendarDays className="w-6 h-6 text-[var(--accent-color)]" />,
      action: () => onSwitchTab(Tab.MEALS),
      highlight: 'nav-meals',
      autoAdvance: false
    },
    {
      title: "Adding Recipes to Meals",
      description: "Click on any day in the meal planner to open the schedule, then click 'Add Recipe' to search our recipe database and add meals to your plan.",
      icon: <UtensilsCrossed className="w-6 h-6 text-[var(--accent-color)]" />,
      action: () => onSwitchTab(Tab.MEALS),
      highlight: 'nav-meals',
      autoAdvance: false
    },
    {
      title: "Cooking Reminders",
      description: "See the bell icons next to meals? Click them to set cooking reminders. You can customize reminder times in Settings.",
      icon: <Bell className="w-6 h-6 text-[var(--accent-color)]" />,
      action: null,
      highlight: 'cooking-reminder',
      autoAdvance: false
    },
    {
      title: "AI Recipe Finder (Chef Tab)",
      description: "Switching to the Chef tab. This uses AI to find recipes. Try 'Use Inventory Only' to get recipes based on what you actually have! You can also browse preloaded recipes at the bottom of the page.",
      icon: <UtensilsCrossed className="w-6 h-6 text-[var(--accent-color)]" />,
      action: () => onSwitchTab(Tab.RECIPES),
      highlight: 'nav-recipes',
      autoAdvance: false
    },
    {
      title: "Voice Search",
      description: "Try voice search! Click the microphone to speak your recipe request. Say 'Find chicken recipes' or 'Make something with pasta'.",
      icon: <Mic className="w-6 h-6 text-[var(--accent-color)]" />,
      action: null,
      highlight: 'voice-search',
      autoAdvance: false
    },
    {
      title: "Community Recipes",
      description: "Check out community recipes and ratings. Save your favorites and see what others are cooking.",
      icon: <Users className="w-6 h-6 text-[var(--accent-color)]" />,
      action: () => onSwitchTab(Tab.COMMUNITY),
      highlight: 'nav-community',
      autoAdvance: false
    },
    {
      title: "Analytics Dashboard",
      description: "Your personal analytics show insights about your pantry usage, expiration trends, and cooking habits. This data helps Smart Pantry Chef learn your preferences.",
      icon: <BarChart3 className="w-6 h-6 text-[var(--accent-color)]" />,
      action: () => onSwitchTab(Tab.SETTINGS),
      highlight: 'nav-settings',
      autoAdvance: false
    },
    {
      title: "Settings & Customization",
      description: "Customize notifications, cooking reminder times, themes, and manage your account. Everything is saved automatically.",
      icon: <Settings className="w-6 h-6 text-[var(--accent-color)]" />,
      action: null,
      highlight: 'settings-panel',
      autoAdvance: false
    },
    {
      title: "You're All Set!",
      description: "You've completed the tour! Remember, Smart Pantry Chef learns from your usage to provide better recommendations. Start by adding some items to your pantry.",
      icon: <Sparkles className="w-6 h-6 text-[var(--accent-color)]" />,
      action: null,
      highlight: null,
      autoAdvance: false
    }
  ];

  const handleNext = () => {
    // Close household modal if it's open and we're moving past the household step
    if (step >= 1 && onCloseHousehold) {
      onCloseHousehold();
    }

    // After theme toggle step, switch back to dark theme
    if (step === 2) {
      setTimeout(() => onToggleTheme(), 500);
    }

    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      // Track tutorial completion
      AnalyticsService.trackTutorialComplete();
      onClose();
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      const newStep = step - 1;
      setStep(newStep);
      
      // Re-open household modal if going back to step 1
      if (newStep === 1) {
        setTimeout(() => onOpenHousehold(), 300);
      }
    }
  };

  // Handle step actions and highlighting
  useEffect(() => {
    const currentStep = steps[step];
    setHighlightedElement(currentStep.highlight);

    // Track tutorial step
    AnalyticsService.trackTutorialStep(step, currentStep.title);

    // Add glow effect to highlighted elements
    if (currentStep.highlight) {
      // Remove previous glow effects
      document.querySelectorAll('.tutorial-glow').forEach(el => {
        el.classList.remove('tutorial-glow');
      });

      // Add glow effect to current highlighted element
      const element = document.querySelector(`[data-tutorial="${currentStep.highlight}"]`);
      if (element) {
        element.classList.add('tutorial-glow');
      }
    } else {
      // Remove all glow effects if no highlight
      document.querySelectorAll('.tutorial-glow').forEach(el => {
        el.classList.remove('tutorial-glow');
      });
    }

    if (currentStep.action) {
      // Longer delay for household button so users can see it glow first
      const delay = step === 1 ? 2000 : 300;
      setTimeout(() => {
        currentStep.action();
      }, delay);
    }
  }, [step]);

  // Track tutorial start
  useEffect(() => {
    AnalyticsService.trackTutorialStart();
  }, []);

  return (
    <>
      {/* Highlight Overlay */}
      {highlightedElement && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" />
        </div>
      )}

      {/* Tutorial Modal */}
      <div className={`fixed z-50 animate-fade-in right-4`} style={highlightedElement?.startsWith('nav-') ? { bottom: '105px' } : { bottom: '16px' }}>
        <div className="bg-theme-secondary border border-theme w-80 rounded-2xl shadow-2xl relative overflow-hidden">

          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--accent-color)] to-transparent"></div>

          <button
            onClick={onClose}
            className="absolute right-4 top-4 opacity-50 hover:opacity-100 transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="p-6 pb-3 flex flex-col items-center text-center">

            <h3 className="text-xl font-serif font-bold text-theme-primary mb-2">
              {steps[step].title}
            </h3>

            <p className="text-theme-secondary opacity-70 text-sm leading-relaxed mb-6 min-h-[60px]">
              {steps[step].description}
            </p>

            <div className="flex items-center justify-between w-full mt-auto">
              <div className="flex gap-1">
                {steps.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === step ? 'bg-[var(--accent-color)] w-3' : 'bg-theme opacity-30'}`}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                {step > 0 && (
                  <button
                    onClick={handlePrev}
                    className="p-1 opacity-60 hover:opacity-100 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className="bg-[var(--accent-color)] hover:opacity-90 text-white px-3 py-1 rounded-lg font-bold text-xs transition-all flex items-center gap-1 shadow-lg"
                >
                  {step === steps.length - 1 ? "Get Started" : "Next"}
                  {step < steps.length - 1 && <ChevronRight className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};