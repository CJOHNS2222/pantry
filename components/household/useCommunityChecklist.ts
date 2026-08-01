import { useMemo, useState } from 'react';
import { Tab } from '../../types/app';
import { log } from '../../services/logService';
import { hasMilestone } from '../../services/onboardingMilestoneService';

export interface ChecklistStep {
  id: string;
  label: string;
  description: string;
  isCompleted: boolean;
  action: () => void;
  actionLabel: string;
}

/**
 * Onboarding checklist ("Setup Checklist") state and step definitions, relocated
 * to the Social/Community tab. Extracted from Community.tsx (F37).
 */
export function useCommunityChecklist(inventoryLength: number, setActiveTab: (tab: Tab) => void) {
  const [isChecklistCollapsed, setIsChecklistCollapsed] = useState(true);
  const [isChecklistDismissed, setIsChecklistDismissed] = useState(() => {
    try {
      return localStorage.getItem('onboarding-checklist-dismissed') === 'true';
    } catch {
      return false;
    }
  });

  const checklistSteps = useMemo((): ChecklistStep[] => {
    const pSaved = hasMilestone('first-recipe-saved');
    const mPlanned = hasMilestone('first-meal-planned');
    const hSetup = hasMilestone('household-setup');
    const lLogged = hasMilestone('first-leftover-logged');
    const pItemsCount = inventoryLength;

    return [
      {
        id: 'add-items',
        label: 'Add 5 Pantry Items',
        description: `Add ingredients to unlock smart recommendations. (${pItemsCount}/5)`,
        isCompleted: pItemsCount >= 5,
        action: () => {
          try {
            sessionStorage.setItem('open-pantry-add-modal', 'true');
          } catch (e) {
            log.error('Failed to write open-pantry-add-modal to sessionStorage', { error: e }, 'Community');
            return;
          }
          if (setActiveTab) setActiveTab(Tab.PANTRY);
        },
        actionLabel: 'Add Items'
      },
      {
        id: 'save-recipe',
        label: 'Save a Recipe',
        description: 'Explore recipes in the Chef tab and heart one to save it.',
        isCompleted: pSaved,
        action: () => { if (setActiveTab) setActiveTab(Tab.RECIPES); },
        actionLabel: 'Browse Recipes'
      },
      {
        id: 'plan-meal',
        label: 'Plan a Meal',
        description: 'Add a planned meal or saved recipe to your weekly calendar.',
        isCompleted: mPlanned,
        action: () => { if (setActiveTab) setActiveTab(Tab.MEALS); },
        actionLabel: 'Open Planner'
      },
      {
        id: 'household-share',
        label: 'Set up Household Sharing',
        description: 'Invite family members or roommates to sync in real-time.',
        isCompleted: hSetup,
        action: () => { if (setActiveTab) setActiveTab(Tab.SETTINGS); },
        actionLabel: 'Set up Sharing'
      },
      {
        id: 'log-leftover',
        label: 'Record a Leftover',
        description: 'Log leftovers with a tap to track food safety and waste.',
        isCompleted: lLogged,
        action: () => {
          try {
            sessionStorage.setItem('open-pantry-add-modal', 'true');
          } catch (e) {
            log.error('Failed to write open-pantry-add-modal to sessionStorage', { error: e }, 'Community');
            return;
          }
          if (setActiveTab) setActiveTab(Tab.PANTRY);
        },
        actionLabel: 'Log Leftover'
      }
    ];
  }, [inventoryLength, setActiveTab]);

  const completedChecklistCount = useMemo(() => {
    return checklistSteps.filter(s => s.isCompleted).length;
  }, [checklistSteps]);

  const dismissChecklist = () => {
    setIsChecklistDismissed(true);
    try {
      localStorage.setItem('onboarding-checklist-dismissed', 'true');
    } catch (e) {
      log.error('Failed to save onboarding-checklist-dismissed to localStorage', { error: e }, 'Community');
      return;
    }
  };

  return {
    checklistSteps,
    completedChecklistCount,
    isChecklistCollapsed,
    setIsChecklistCollapsed,
    isChecklistDismissed,
    dismissChecklist,
  };
}
