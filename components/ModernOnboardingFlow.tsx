import React from 'react';
import { ModernOnboarding } from './ModernOnboarding';

interface ModernOnboardingFlowProps {
  user: unknown;
  onComplete: () => void;
  onSkip: () => void;
  onOpenHousehold?: () => void;
}

export const ModernOnboardingFlow: React.FC<ModernOnboardingFlowProps> = ({
  user: _user,
  onComplete,
  onSkip,
  onOpenHousehold
}) => {
  return (
    <ModernOnboarding
      user={_user}
      onComplete={() => onComplete()}
      onSkip={onSkip}
      onOpenHousehold={onOpenHousehold}
    />
  );
};