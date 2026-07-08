import React from 'react';
import { ModernOnboarding } from './ModernOnboarding';
import { StructuredRecipe } from '../../types';

interface ModernOnboardingFlowProps {
  user: unknown;
  onComplete: () => void;
  onSkip: () => void;
  onOpenHousehold?: () => void;
  onPersonaSelected?: (persona: 'relaxed' | 'normal' | 'strict') => void;
  // Recipe bootstrapping callbacks (wired through from App.tsx)
  onSaveRecipes?: (recipes: StructuredRecipe[]) => Promise<void>;
  onAddIngredientsToList?: (items: string[]) => Promise<void>;
  onScheduleRecipes?: (recipes: StructuredRecipe[], startFromTomorrow: boolean) => Promise<void>;
}

export const ModernOnboardingFlow: React.FC<ModernOnboardingFlowProps> = ({
  user: _user,
  onComplete,
  onSkip,
  onOpenHousehold,
  onPersonaSelected,
  onSaveRecipes,
  onAddIngredientsToList,
  onScheduleRecipes,
}) => {
  return (
    <ModernOnboarding
      user={_user}
      onComplete={() => onComplete()}
      onSkip={onSkip}
      onOpenHousehold={onOpenHousehold}
      onPersonaSelected={onPersonaSelected}
      onSaveRecipes={onSaveRecipes}
      onAddIngredientsToList={onAddIngredientsToList}
      onScheduleRecipes={onScheduleRecipes}
    />
  );
};