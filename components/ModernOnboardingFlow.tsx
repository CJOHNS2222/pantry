import React from 'react';
import { ModernOnboarding } from './ModernOnboarding';

interface ModernOnboardingFlowProps {
  user: any;
  onComplete: () => void;
  onSkip: () => void;
}

export const ModernOnboardingFlow: React.FC<ModernOnboardingFlowProps> = ({
  user,
  onComplete,
  onSkip
}) => {
  return (
    <ModernOnboarding
      user={user}
      onComplete={() => onComplete()}
      onSkip={onSkip}
    />
  );
};