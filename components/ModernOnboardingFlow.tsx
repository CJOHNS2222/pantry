import React from 'react';
import { ModernOnboarding } from './ModernOnboarding';

interface ModernOnboardingFlowProps {
  user: any;
  onComplete: () => void;
  onSkip: () => void;
  onOpenHousehold?: () => void;
}

export const ModernOnboardingFlow: React.FC<ModernOnboardingFlowProps> = ({
  user,
  onComplete,
  onSkip,
  onOpenHousehold
}) => {
  return (
    <ModernOnboarding
      user={user}
      onComplete={() => onComplete()}
      onSkip={onSkip}
      onOpenHousehold={onOpenHousehold}
    />
  );
};