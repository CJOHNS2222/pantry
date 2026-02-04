import React, { useState, useEffect } from 'react';
import { ModernOnboarding } from './ModernOnboarding';
import { ContextualPermissions } from './ContextualPermissions';
import { ValueDemo } from './ValueDemo';
import { FeatureDiscovery } from './FeatureDiscovery';
import { ContextualTutorial } from './ContextualTutorial';

interface ModernOnboardingFlowProps {
  user: any; // User object from auth context
  onComplete: () => void;
  onSkip: () => void;
}

export const ModernOnboardingFlow: React.FC<ModernOnboardingFlowProps> = ({
  user,
  onComplete,
  onSkip
}) => {
  const [currentPhase, setCurrentPhase] = useState<'onboarding' | 'permissions' | 'value-demo' | 'feature-discovery' | 'tutorial' | 'complete'>('onboarding');
  const [collectedData, setCollectedData] = useState({
    householdName: '',
    preferences: [] as string[],
    permissions: {} as Record<string, boolean>,
    userItems: [] as string[]
  });

  // Phase transition handlers
  const handleOnboardingComplete = (data: any) => {
    setCollectedData(prev => ({ ...prev, ...data }));
    setCurrentPhase('permissions');
  };

  const handleValueDemoComplete = (items: string[]) => {
    setCollectedData(prev => ({ ...prev, userItems: items }));
    setCurrentPhase('feature-discovery');
  };

  const handleFeatureDiscoveryComplete = () => {
    setCurrentPhase('tutorial');
  };

  const handleTutorialComplete = () => {
    setCurrentPhase('complete');
  };

  // Final completion
  useEffect(() => {
    if (currentPhase === 'complete') {
      // Save onboarding data to user preferences
      localStorage.setItem('onboarding-completed', 'true');
      localStorage.setItem('onboarding-data', JSON.stringify(collectedData));

      // Mark as completed in analytics
      if (window.gtag) {
        window.gtag('event', 'onboarding_complete', {
          household_name: collectedData.householdName,
          preferences_count: collectedData.preferences.length,
          permissions_granted: Object.values(collectedData.permissions).filter(Boolean).length,
          items_added: collectedData.userItems.length
        });
      }

      onComplete();
    }
  }, [currentPhase, collectedData, onComplete]);

  // Permission requests for the permissions phase
  const permissionRequests = [
    {
      permission: 'camera' as const,
      title: 'Camera Access',
      description: 'Allow camera access to quickly scan pantry items and upload recipe photos.',
      triggerElement: '.camera-trigger',
      isRequired: false
    },
    {
      permission: 'notifications' as const,
      title: 'Smart Notifications',
      description: 'Get reminders for meal prep and alerts when ingredients are about to expire.',
      triggerElement: '.notification-trigger',
      isRequired: false
    },
    {
      permission: 'location' as const,
      title: 'Location Services',
      description: 'Find nearby stores and get seasonal recipe recommendations based on your area.',
      triggerElement: '.location-trigger',
      isRequired: false
    }
  ];

  // Render current phase
  switch (currentPhase) {
    case 'onboarding':
      return (
        <ModernOnboarding
          user={user}
          onComplete={handleOnboardingComplete}
          onSkip={onSkip}
        />
      );

    case 'permissions':
      return (
        <ContextualPermissions
          permissions={permissionRequests}
          onPermissionResult={(permission, granted) => {
            setCollectedData(prev => ({
              ...prev,
              permissions: { ...prev.permissions, [permission]: granted }
            }));
          }}
        />
      );

    case 'value-demo':
      return (
        <ValueDemo
          userItems={collectedData.userItems}
          onRecipeSelect={(recipe) => {
            // Handle recipe selection - could navigate to recipe view
            console.log('Selected recipe:', recipe);
            handleValueDemoComplete(collectedData.userItems);
          }}
          onSkip={() => handleValueDemoComplete([])}
          onExploreMore={() => {
            // Navigate to recipe finder
            handleValueDemoComplete(collectedData.userItems);
          }}
        />
      );

    case 'feature-discovery':
      return (
        <FeatureDiscovery
          features={[
            {
              id: 'pantry-scanner',
              title: 'Pantry Scanner',
              description: 'Quickly add items by scanning barcodes or taking photos',
              element: '.pantry-scanner-button',
              icon: 'camera'
            },
            {
              id: 'meal-planner',
              title: 'Smart Meal Planner',
              description: 'Plan meals and automatically update your shopping list',
              element: '.meal-planner-nav',
              icon: 'calendar'
            },
            {
              id: 'recipe-finder',
              title: 'Recipe Finder',
              description: 'Discover recipes based on what you have in your pantry',
              element: '.recipe-finder-nav',
              icon: 'chef-hat'
            }
          ]}
          onComplete={handleFeatureDiscoveryComplete}
          onSkip={handleFeatureDiscoveryComplete}
        />
      );

    case 'tutorial':
      return (
        <ContextualTutorial
          tutorials={[
            {
              id: 'add-first-item',
              title: 'Add Your First Item',
              content: 'Start by adding items to your pantry. You can type them manually or use the scanner.',
              targetElement: '.add-item-button',
              position: 'bottom'
            },
            {
              id: 'explore-recipes',
              title: 'Find Recipes',
              content: 'Click here to discover recipes you can make with your current ingredients.',
              targetElement: '.recipe-finder-nav',
              position: 'right'
            },
            {
              id: 'plan-meals',
              title: 'Plan Your Meals',
              content: 'Use the meal planner to organize your cooking and automatically generate shopping lists.',
              targetElement: '.meal-planner-nav',
              position: 'left'
            }
          ]}
          onComplete={handleTutorialComplete}
          onSkip={handleTutorialComplete}
        />
      );

    case 'complete':
    default:
      return null;
  }
};

// Hook for managing the overall onboarding flow
export const useModernOnboarding = () => {
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);
  const [onboardingData, setOnboardingData] = useState<any>(null);

  useEffect(() => {
    // Check if onboarding has been completed
    const completed = localStorage.getItem('onboarding-completed') === 'true';
    const data = localStorage.getItem('onboarding-data');

    if (!completed) {
      setIsOnboardingActive(true);
    }

    if (data) {
      try {
        setOnboardingData(JSON.parse(data));
      } catch (error) {
        console.error('Failed to parse onboarding data:', error);
      }
    }
  }, []);

  const completeOnboarding = (data?: any) => {
    setIsOnboardingActive(false);
    if (data) {
      setOnboardingData(data);
    }
  };

  const resetOnboarding = () => {
    localStorage.removeItem('onboarding-completed');
    localStorage.removeItem('onboarding-data');
    setIsOnboardingActive(true);
    setOnboardingData(null);
  };

  const skipOnboarding = () => {
    localStorage.setItem('onboarding-completed', 'true');
    setIsOnboardingActive(false);
  };

  return {
    isOnboardingActive,
    onboardingData,
    completeOnboarding,
    resetOnboarding,
    skipOnboarding
  };
};

// Progress indicator component
interface OnboardingProgressProps {
  currentPhase: number;
  totalPhases: number;
  phaseLabels: string[];
}

export const OnboardingProgress: React.FC<OnboardingProgressProps> = ({
  currentPhase,
  totalPhases,
  phaseLabels
}) => {
  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-theme-secondary/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border border-theme/20">
        <div className="flex items-center gap-2">
          {Array.from({ length: totalPhases }, (_, i) => (
            <div key={i} className="flex items-center">
              <div
                className={`w-2 h-2 rounded-full transition-colors ${
                  i <= currentPhase ? 'bg-[var(--accent-color)]' : 'bg-theme/30'
                }`}
              />
              {i < totalPhases - 1 && (
                <div
                  className={`w-4 h-0.5 mx-1 transition-colors ${
                    i < currentPhase ? 'bg-[var(--accent-color)]' : 'bg-theme/30'
                  }`}
                />
              )}
            </div>
          ))}
          <span className="text-xs text-theme-secondary ml-2">
            {phaseLabels[currentPhase]}
          </span>
        </div>
      </div>
    </div>
  );
};