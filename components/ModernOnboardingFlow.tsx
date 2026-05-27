import React from 'react';
import { ModernOnboarding } from './ModernOnboarding';

interface ModernOnboardingFlowProps {
  user: unknown;
  onComplete: () => void;
  onSkip: () => void;
  onOpenHousehold?: () => void;
  onPersonaSelected?: (persona: 'relaxed' | 'normal' | 'strict') => void;
}

export const ModernOnboardingFlow: React.FC<ModernOnboardingFlowProps> = ({
  user: _user,
  onComplete,
  onSkip,
  onOpenHousehold,
  onPersonaSelected,
}) => {
  return (
    <ModernOnboarding
      user={_user}
      onComplete={() => onComplete()}
      onSkip={onSkip}
      onOpenHousehold={onOpenHousehold}
      onPersonaSelected={onPersonaSelected}
    />
  );
};