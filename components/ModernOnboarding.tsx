import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  SkipForward,
  Sparkles,
  ChefHat,
  Users,
  ShoppingCart,
  Calendar,
  ArrowRight,
  CheckCircle,
  X,
  Zap,
  Camera,
  Heart,
} from 'lucide-react';
interface OnboardingData {
  completed: boolean;
  selectedSetup?: string | null;
  permissions?: string[];
  leftoverPersona?: 'relaxed' | 'normal' | 'strict';
}

interface ModernOnboardingProps {
  user: unknown;
  onComplete: (data: OnboardingData) => void;
  onSkip: () => void;
  onScanPantry?: () => void;
  onQuickAddItems?: () => void;
  onOpenHousehold?: () => void;
  onPersonaSelected?: (persona: 'relaxed' | 'normal' | 'strict') => void;
}

type OnboardingStep = 'welcome' | 'quick-setup' | 'value-demo' | 'food-safety' | 'complete';

interface QuickSetupOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  estimatedTime: string;
  popular?: boolean;
}

export const ModernOnboarding: React.FC<ModernOnboardingProps> = ({
  user: _user,
  onComplete,
  onSkip: _onSkip,
  onScanPantry,
  onQuickAddItems,
  onOpenHousehold,
  onPersonaSelected,
}) => {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [selectedSetupOption, setSelectedSetupOption] = useState<string | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<'relaxed' | 'normal' | 'strict'>('normal');
  const [isAnimating, setIsAnimating] = useState(false);
  const onCompleteCalledRef = useRef(false);

  const quickSetupOptions: QuickSetupOption[] = [
    {
      id: 'scan',
      title: 'Scan Your Pantry',
      description: 'Take photos of your pantry items for instant setup',
      icon: <Camera className="w-6 h-6" />,
      action: () => onScanPantry?.(),
      estimatedTime: '2-3 min',
      popular: true
    },
    {
      id: 'quick-add',
      title: 'Quick Add Common Items',
      description: 'Start with 10 essential pantry staples',
      icon: <Plus className="w-6 h-6" />,
      action: () => onQuickAddItems?.(),
      estimatedTime: '1 min'
    },
    {
      id: 'household',
      title: 'Set Up Household',
      description: 'Add family members to share recipes and collaborate',
      icon: <Users className="w-6 h-6" />,
      action: () => onOpenHousehold?.(),
      estimatedTime: '30 sec'
    }
  ];

  const handleStepTransition = (nextStep: OnboardingStep) => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(nextStep);
      setIsAnimating(false);
    }, 300);
  };

  const handleSetupOptionSelect = (optionId: string) => {
    setSelectedSetupOption(optionId);
    const option = quickSetupOptions.find(opt => opt.id === optionId);
    if (option) {
      // Execute the action and move to next step
      setTimeout(() => {
        option.action();
        handleStepTransition('value-demo');
      }, 500);
    }
  };

  const handleSkip = () => {
    handleStepTransition('food-safety');
  };

  // Auto-advance from the complete step — covers all paths (normal flow + skip)
  useEffect(() => {
    if (currentStep === 'complete' && !onCompleteCalledRef.current) {
      onCompleteCalledRef.current = true;
      const timer = setTimeout(() => {
        onComplete({ completed: true, selectedSetup: selectedSetupOption, permissions: [], leftoverPersona: selectedPersona });
      }, 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [currentStep, selectedSetupOption, selectedPersona, onComplete]);

  const renderWelcomeStep = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      {/* Hero Section */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[var(--accent-color)] to-[var(--accent-color)]/80 rounded-2xl mb-6 shadow-lg">
          <ChefHat className="w-10 h-10 text-white" />
        </div>

          <h1 className="text-3xl font-bold text-theme-primary mb-3 font-serif">
            Welcome to Stock & Spoon!
        </h1>

        <p className="text-lg text-theme-secondary mb-6 leading-relaxed">
          Your AI-powered kitchen assistant that makes cooking smarter, faster, and more fun.
          Let's get you set up in minutes.
        </p>

        {/* Feature highlights */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm font-medium text-theme-primary">AI-Powered</span>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-sm font-medium text-theme-primary">Family Share</span>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Heart className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-sm font-medium text-theme-primary">Smart Recipes</span>
          </div>
        </div>
      </div>

      {/* CTA Buttons */}
      <div className="space-y-3">
        <button
          onClick={() => handleStepTransition('quick-setup')}
          className="w-full bg-gradient-to-r from-[var(--accent-color)] to-[var(--accent-color)]/90 hover:from-[var(--accent-color)]/90 hover:to-[var(--accent-color)]/80 text-white py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
          data-testid="onboard-get-started"
        >
          <Sparkles className="w-5 h-5" />
          Get Started
          <ArrowRight className="w-5 h-5" />
        </button>

        <button
          onClick={handleSkip}
          className="w-full bg-theme/10 hover:bg-theme/20 text-theme-secondary py-3 px-6 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2"
          data-testid="onboard-skip"
        >
          <SkipForward className="w-4 h-4" />
          Skip for now
        </button>
      </div>
    </div>
  );

  const renderQuickSetupStep = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-theme-primary mb-3">
          Let's Get You Cooking! 🍳
        </h2>
        <p className="text-theme-secondary">
          Choose how you'd like to start. We'll show you the value immediately!
        </p>
      </div>

      <div className="space-y-4 mb-8">
        {quickSetupOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => handleSetupOptionSelect(option.id)}
            disabled={selectedSetupOption !== null}
            className={`w-full p-5 rounded-xl border-2 transition-all duration-200 text-left relative overflow-hidden ${
              selectedSetupOption === option.id
                ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/10 shadow-lg transform scale-[1.02]'
                : selectedSetupOption === null
                ? 'border-theme hover:border-[var(--accent-color)]/50 hover:bg-theme/5 hover:shadow-md'
                : 'border-theme/50 opacity-50'
            }`}
            data-testid={`onboard-option-${option.id}`}
          >
            {option.popular && (
              <div className="absolute top-3 right-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                Popular
              </div>
            )}

            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                selectedSetupOption === option.id
                  ? 'bg-[var(--accent-color)] text-white'
                  : 'bg-theme text-theme-primary'
              }`}>
                {option.icon}
              </div>

              <div className="flex-1">
                <h3 className="font-semibold text-theme-primary mb-1">
                  {option.title}
                </h3>
                <p className="text-sm text-theme-secondary mb-2">
                  {option.description}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-theme/20 text-theme-secondary px-2 py-1 rounded">
                    {option.estimatedTime}
                  </span>
                </div>
              </div>

              {selectedSetupOption === option.id && (
                <div className="flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-[var(--accent-color)]" />
                </div>
              )}
            </div>

            {selectedSetupOption === option.id && (
              <div className="mt-4 pt-4 border-t border-[var(--accent-color)]/20">
                <div className="flex items-center gap-2 text-sm text-[var(--accent-color)]">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--accent-color)] border-t-transparent"></div>
                  Setting up...
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="text-center">
        <button
          onClick={handleSkip}
          className="text-theme-secondary hover:text-theme-primary transition-colors text-sm"
          data-testid="onboard-skip-setup"
        >
          Skip setup for now →
        </button>
      </div>
    </div>
  );

  const renderValueDemoStep = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl mb-4">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-theme-primary mb-3">
          You're All Set! 🎉
        </h2>
        <p className="text-theme-secondary mb-6">
          Here's what Stock & Spoon can do for you right now
        </p>
      </div>

      {/* Value demonstration */}
      <div className="space-y-4 mb-8">
        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="font-medium text-blue-900 dark:text-blue-100">Smart Shopping</span>
          </div>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Your shopping list updates automatically when you plan meals
          </p>
        </div>

        <div className="p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-3 mb-2">
            <ChefHat className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="font-medium text-green-900 dark:text-green-100">AI Recipe Finder</span>
          </div>
          <p className="text-sm text-green-700 dark:text-green-300">
            Find recipes using ingredients you already have
          </p>
        </div>

        <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span className="font-medium text-purple-900 dark:text-purple-100">Meal Planning</span>
          </div>
          <p className="text-sm text-purple-700 dark:text-purple-300">
            Plan your week and get cooking reminders
          </p>
        </div>
      </div>

      <button
        onClick={() => handleStepTransition('food-safety')}
        className="w-full bg-gradient-to-r from-[var(--accent-color)] to-[var(--accent-color)]/90 hover:from-[var(--accent-color)]/90 hover:to-[var(--accent-color)]/80 text-white py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
        data-testid="onboard-start-cooking"
      >
        <Sparkles className="w-5 h-5" />
        Start Cooking!
      </button>
    </div>
  );

  const renderFoodSafetyStep = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl mb-4">
          <span className="text-3xl" role="img" aria-label="food safety">🛡️</span>
        </div>
        <h2 className="text-2xl font-bold text-theme-primary mb-2">Food Safety Preference</h2>
        <p className="text-theme-secondary text-sm">
          This controls how the app estimates leftover expiry and surfaces safety warnings.
          You can always change this later in Settings.
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {(['strict', 'normal', 'relaxed'] as const).map((persona) => {
          const labels = {
            strict: { title: 'Strict (safety-first)', desc: 'Shorter recommended windows; great for households with children, pregnant members, or immunocompromised individuals.' },
            normal: { title: 'Normal', desc: 'Balanced guidance used by most households.' },
            relaxed: { title: 'Relaxed', desc: 'Slightly more forgiving windows — not recommended for high-risk households.' },
          };
          return (
            <button
              key={persona}
              onClick={() => {
                setSelectedPersona(persona);
                onPersonaSelected?.(persona);
              }}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                selectedPersona === persona
                  ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/10'
                  : 'border-theme hover:border-[var(--accent-color)]/50 hover:bg-theme-primary/5'
              }`}
            >
              <div className="font-semibold text-theme-primary">{labels[persona].title}</div>
              <div className="text-xs text-theme-secondary mt-0.5">{labels[persona].desc}</div>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => handleStepTransition('complete')}
        className="w-full bg-gradient-to-r from-[var(--accent-color)] to-[var(--accent-color)]/90 hover:from-[var(--accent-color)]/90 hover:to-[var(--accent-color)]/80 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2"
        data-testid="onboard-food-safety-continue"
      >
        <ArrowRight className="w-5 h-5" />
        Continue
      </button>
    </div>
  );

  const renderCompleteStep = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'}`}>
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mb-6 shadow-lg">
          <CheckCircle className="w-10 h-10 text-white" />
        </div>

        <h2 className="text-3xl font-bold text-theme-primary mb-3 font-serif">
          Welcome aboard! 🚀
        </h2>

        <p className="text-lg text-theme-secondary mb-8">
          You're ready to transform your cooking experience.
          Let's make something amazing together.
        </p>

        <div className="animate-pulse">
          <p className="text-sm text-theme-secondary/70">
            Taking you to your smart pantry...
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-theme-secondary rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden relative">

        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-theme/10 hover:bg-theme/20 text-theme-secondary/60 hover:text-theme-secondary transition-colors"
          data-testid="onboard-close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="p-8">
          {currentStep === 'welcome' && renderWelcomeStep()}
          {currentStep === 'quick-setup' && renderQuickSetupStep()}
          {currentStep === 'value-demo' && renderValueDemoStep()}
          {currentStep === 'food-safety' && renderFoodSafetyStep()}
          {currentStep === 'complete' && renderCompleteStep()}
        </div>

        {/* Progress indicator */}
        <div className="px-8 pb-6">
          <div className="flex justify-center gap-2">
            {(['welcome', 'quick-setup', 'value-demo', 'food-safety', 'complete'] as OnboardingStep[]).map((step, index) => (
              <div
                key={step}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index <= (['welcome', 'quick-setup', 'value-demo', 'food-safety', 'complete'] as OnboardingStep[]).indexOf(currentStep)
                    ? 'bg-[var(--accent-color)]'
                    : 'bg-theme/30'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};