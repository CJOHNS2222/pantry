import React, { useState } from 'react';
import { CheckCircle, ArrowRight, Sparkles, Users, ChefHat, Calendar } from 'lucide-react';
import { Tab } from '../types/app';

interface FirstTimeFlowProps {
  onComplete: () => void;
  onSwitchTab: (tab: Tab) => void;
  onOpenHousehold: () => void;
  userName?: string;
}

interface SetupStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  completed: boolean;
  optional?: boolean;
}

export const FirstTimeFlow: React.FC<FirstTimeFlowProps> = ({
  onComplete,
  onSwitchTab,
  onOpenHousehold,
  userName = 'Chef'
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const steps: SetupStep[] = [
    {
      id: 'welcome',
      title: `Welcome, ${userName}!`,
      description: 'Let\'s get Stock & Spoon set up for the best experience. We\'ll guide you through the essentials.',
      icon: <Sparkles className="w-6 h-6 text-yellow-500" />,
      action: () => {},
      completed: true
    },
    {
      id: 'household',
      title: 'Set Up Your Household',
      description: 'Add family members to share recipes, meal plans, and collaborate on your pantry. Start with just yourself for now.',
      icon: <Users className="w-6 h-6 text-blue-500" />,
      action: () => onOpenHousehold(),
      completed: completedSteps.has('household')
    },
    {
      id: 'pantry',
      title: 'Add Your Pantry Items',
      description: 'Start with 5-10 common items you have. This helps us suggest recipes based on what you actually own.',
      icon: <ChefHat className="w-6 h-6 text-green-500" />,
      action: () => onSwitchTab(Tab.PANTRY),
      completed: completedSteps.has('pantry')
    },
    {
      id: 'meal-plan',
      title: 'Plan Your First Meal',
      description: 'Try planning dinner for tonight or tomorrow. We\'ll show you recipes and automatically update your shopping list.',
      icon: <Calendar className="w-6 h-6 text-purple-500" />,
      action: () => onSwitchTab(Tab.MEALS),
      completed: completedSteps.has('meal-plan')
    }
  ];

  const handleStepClick = (step: SetupStep) => {
    step.action();
    setCompletedSteps(prev => new Set([...prev, step.id]));
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const completedCount = steps.filter(step => step.completed).length;
  const progressPercentage = (completedCount / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-start overflow-y-auto p-4">
      <div className="bg-theme-secondary rounded-2xl shadow-2xl max-w-md w-full my-auto">

        {/* Header */}
        <div className="p-6 border-b border-theme">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-serif font-bold text-theme-primary">
                Get Started with Stock & Spoon
              </h2>
            <button
              onClick={handleSkip}
              className="text-theme-secondary/60 hover:text-theme-secondary transition-colors"
            >
              Skip for now
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-theme/20 rounded-full h-2 mb-2">
            <div
              className="bg-[var(--accent-color)] h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-sm text-theme-secondary/70">
            {completedCount} of {steps.length} steps completed
          </p>
        </div>

        {/* Steps */}
        <div className="p-6 space-y-4">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`p-4 rounded-lg border transition-all cursor-pointer ${
                step.completed
                  ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                  : index === currentStep
                  ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)]/30'
                  : 'bg-theme/5 border-theme hover:bg-theme/10'
              }`}
              onClick={() => handleStepClick(step)}
              role="button"
              tabIndex={0}
              aria-label={`Open onboarding step: ${step.title}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleStepClick(step);
                }
              }}
            >
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 ${step.completed ? 'text-green-500' : ''}`}>
                  {step.completed ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : (
                    step.icon
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-theme-primary mb-1">
                    {step.title}
                  </h3>
                  <p className="text-sm text-theme-secondary/80 leading-relaxed">
                    {step.description}
                  </p>
                </div>
                <ArrowRight className={`w-4 h-4 flex-shrink-0 transition-transform ${
                  index === currentStep ? 'text-[var(--accent-color)]' : 'text-theme-secondary/40'
                }`} />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-theme">
          <div className="flex gap-3">
            <button
              onClick={handleNext}
              className="flex-1 bg-[var(--accent-color)] hover:opacity-90 text-white py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
              data-testid="ftf-continue"
            >
              {currentStep === steps.length - 1 ? 'Get Cooking!' : 'Continue'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <p className="text-sm text-theme-secondary/60 text-center mt-3">
            You can always change these settings later in your account preferences.
          </p>
        </div>
      </div>
    </div>
  );
};