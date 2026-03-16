import React, { useState, useEffect } from 'react';
import { ModernOnboarding } from './ModernOnboarding';
import { ContextualPermissionManager as ContextualPermissions } from './ContextualPermissions';
import { ValueDemo } from './ValueDemo';
import { FeatureDiscoveryManager } from './FeatureDiscovery';
import { ContextualTutorial } from './ContextualTutorial';
import { RiskExplanationModal } from './RiskExplanationModal';
import RiskAssessmentQuestionnaire from './RiskAssessmentQuestionnaire';
import { log } from '../services/logService';

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
  const [currentPhase, setCurrentPhase] = useState<'onboarding' | 'permissions' | 'value-demo' | 'feature-discovery' | 'risk-explanation' | 'risk-assessment' | 'tutorial' | 'complete'>('onboarding');
  const [collectedData, setCollectedData] = useState({
    householdName: '',
    preferences: [] as string[],
    permissions: {} as Record<string, boolean>,
    userItems: [] as string[],
    riskLevel: 3 as number // Default moderate risk level
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
    setCurrentPhase('risk-explanation');
  };

  const handleRiskExplanationContinue = () => {
    setCurrentPhase('risk-assessment');
  };

  const handleRiskExplanationSkip = () => {
    // Skip directly to tutorial, using default risk level
    setCurrentPhase('tutorial');
  };

  const handleRiskAssessmentComplete = (riskLevel: number) => {
    setCollectedData(prev => ({ ...prev, riskLevel }));
    setCurrentPhase('tutorial');
  };

  const handleTutorialComplete = () => {
    setCurrentPhase('complete');
  };

  // Monitor permission completion and transition to next phase
  useEffect(() => {
    if (currentPhase === 'permissions') {
      const totalPermissions = 3; // camera, notifications, location
      const collectedPermissions = Object.keys(collectedData.permissions).length;
      
      if (collectedPermissions >= totalPermissions) {
        // All permissions have been handled, transition to value demo
        setTimeout(() => {
          setCurrentPhase('value-demo');
        }, 500); // Small delay to allow last permission UI to disappear
      }
    }
  }, [currentPhase, collectedData.permissions]);

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
          permissions={permissionRequests as any}
          onPermissionResult={(permission: string, granted: boolean) => {
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
            log.debug('Selected recipe:', recipe);
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
        <FeatureDiscoveryManager
          discoveries={[
            {
              featureId: 'pantry-scanner',
              title: 'Pantry Scanner',
              description: 'Quickly add items by scanning barcodes or taking photos',
              targetElement: '.pantry-scanner-button',
              position: 'bottom-right',
              icon: 'camera'
            },
            {
              featureId: 'meal-planner',
              title: 'Smart Meal Planner',
              description: 'Plan meals and automatically update your shopping list',
              targetElement: '.meal-planner-nav',
              position: 'bottom-right',
              icon: 'calendar'
            },
            {
              featureId: 'recipe-finder',
              title: 'Recipe Finder',
              description: 'Discover recipes based on what you have in your pantry',
              targetElement: '.recipe-finder-nav',
              position: 'bottom-right',
              icon: 'chef-hat'
            }
          ]}
          onDiscoveryDismiss={handleFeatureDiscoveryComplete}
        />
      );

    case 'risk-explanation':
      return (
        <RiskExplanationModal
          onContinue={handleRiskExplanationContinue}
          onSkip={handleRiskExplanationSkip}
        />
      );

    case 'risk-assessment':
      return (
        <RiskAssessmentQuestionnaire
          userId={user?.id || ''}
          onComplete={handleRiskAssessmentComplete}
        />
      );

    case 'tutorial':
      return (
        <ContextualTutorial
          tips={[
            {
              id: 'add-first-item',
              title: 'Add Your First Item',
              description: 'Start by adding items to your pantry. You can type them manually or use the scanner.',
              targetElement: '.add-item-button',
              position: 'bottom',
              onDismiss: () => {}
            },
            {
              id: 'explore-recipes',
              title: 'Find Recipes',
              description: 'Click here to discover recipes you can make with your current ingredients.',
              targetElement: '.recipe-finder-nav',
              position: 'right',
              onDismiss: () => {}
            },
            {
              id: 'plan-meals',
              title: 'Plan Your Meals',
              description: 'Use the meal planner to organize your cooking and automatically generate shopping lists.',
              targetElement: '.meal-planner-nav',
              position: 'left',
              onDismiss: () => {}
            }
          ]}
          onTipDismiss={(tipId) => { handleTutorialComplete(); }}
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
        log.error('Failed to parse onboarding data:', error);
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