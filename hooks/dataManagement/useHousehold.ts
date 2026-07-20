import { useState, useEffect, useRef } from 'react';
import DatabaseMonitoringService from '../../services/databaseMonitoringService';
import { User, Household, CustomCategory } from '../../types';
import { log } from '../../services/logService';
import { LeftoverNotificationService } from '../../services/leftoverNotificationService';
import RiskProfileService from '../../services/riskProfileService';
import { ERROR_MESSAGES } from '../../constants/errorMessages';

/**
 * Household domain: household doc + presence listeners, custom categories
 * (derived from the user doc), and the risk questionnaire.
 *
 * Note: `lastAllergyCheckRef` and `questionnaireShownRef`/`setShowRiskQuestionnaire`
 * are exposed beyond this hook's own use because the effects that drive them
 * (household-inventory allergy scan, "show questionnaire once user has an item")
 * are genuinely cross-domain — they need `inventory`, which is owned by
 * useInventory.ts. Those effects are implemented in the composer
 * (hooks/useDataManagement.ts), reusing these refs/setters rather than
 * duplicating household-permission/loading logic a second time.
 */
export function useHousehold(
  user?: User | null,
  addToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning', duration?: number, actionLabel?: string, action?: () => void) => void,
) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [isLoadingHousehold, setIsLoadingHousehold] = useState(true);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [showRiskQuestionnaire, setShowRiskQuestionnaire] = useState(false);
  const questionnaireShownRef = useRef(false);
  const lastAllergyCheckRef = useRef<number>(0);

  const householdClearedDueToPermissionsRef = useRef(false);
  const leftoverNotificationCleanupRef = useRef<(() => void) | null>(null);
  const prevHouseholdRef = useRef<Household | null>(null);

  // Sync customCategories state from user doc (delivered via useAuth onSnapshot — no separate listener needed)
  useEffect(() => {
    setCustomCategories(user?.customCategories || []);
  }, [user?.customCategories]);

  // Firestore synchronization: household doc + presence
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    // Guest users: no household in Firestore
    if (user.isGuest) {
      setIsLoadingHousehold(false);
      return;
    }

    const unsubs: (() => void)[] = [];

    if (user?.householdId) {
      let householdData: Household | null = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let presenceData: any = null;

      const updateHouseholdState = () => {
        if (!householdData) return;
        const merged: Household = {
          ...householdData,
          memberActivity: presenceData || {}
        };
        const prev = prevHouseholdRef.current;
        const prevPresenceKeys = prev?.memberActivity ? Object.keys(prev.memberActivity).join(',') : '';
        const currPresenceKeys = merged.memberActivity ? Object.keys(merged.memberActivity).join(',') : '';
        const hasChanged = !prev ||
          prev.id !== merged.id ||
          prev.name !== merged.name ||
          prev.ownerSubscriptionTier !== merged.ownerSubscriptionTier ||
          prevPresenceKeys !== currPresenceKeys ||
          (prev.members || []).length !== (merged.members || []).length;

        if (hasChanged) {
          const householdIdChanged = !prev || prev.id !== merged.id;
          prevHouseholdRef.current = merged;
          setHousehold(merged);

          // Start leftover notification checks ONLY when the household ID actually changes (PERF-020)
          if (householdIdChanged) {
            if (leftoverNotificationCleanupRef.current) {
              leftoverNotificationCleanupRef.current();
              leftoverNotificationCleanupRef.current = null;
            }
            leftoverNotificationCleanupRef.current = LeftoverNotificationService.startPeriodicChecks(merged.id, user.id);
          }
        }
      };

      unsubs.push(DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.doc('households', user.householdId), snap => {
        if (snap.exists()) {
          householdData = { id: snap.id, ...snap.data() } as Household;
          updateHouseholdState();
        }
        setIsLoadingHousehold(false);
        householdClearedDueToPermissionsRef.current = false; // Reset on success
      }, err => {
        if (err.code === 'permission-denied' && !householdClearedDueToPermissionsRef.current) {
          log.warn('Permission denied on household listener, clearing household state.', {userId: user.id}, 'DataManagement');
          householdClearedDueToPermissionsRef.current = true; // Prevent loop
          setHousehold(null);
          // Clean up leftover notification checks when household is cleared
          if (leftoverNotificationCleanupRef.current) {
            leftoverNotificationCleanupRef.current();
            leftoverNotificationCleanupRef.current = null;
          }
        }
        setIsLoadingHousehold(false);
      }));

      unsubs.push(DatabaseMonitoringService.onSnapshot(DatabaseMonitoringService.doc(`households/${user.householdId}/presence/members`), snap => {
        if (snap.exists()) {
          presenceData = snap.data();
          updateHouseholdState();
        }
      }, err => {
        if (err.code !== 'permission-denied') {
          log.warn('Failed to listen to household presence:', err, 'DataManagement');
        }
      }));
    } else {
      setHousehold(null);
      setIsLoadingHousehold(false);
      // Clean up leftover notification checks when no household
      if (leftoverNotificationCleanupRef.current) {
        leftoverNotificationCleanupRef.current();
        leftoverNotificationCleanupRef.current = null;
      }
    }

    return () => {
      unsubs.forEach(unsub => unsub());
      // Clean up leftover notification checks
      if (leftoverNotificationCleanupRef.current) {
        leftoverNotificationCleanupRef.current();
        leftoverNotificationCleanupRef.current = null;
      }
    };
  }, [user?.id, user?.householdId]);

  // Handler called when user completes the risk questionnaire
  const handleRiskQuestionnaireComplete = async (level: number, sensitive?: boolean) => {
    if (!user?.id) return;
    try {
      if (!user.isGuest) {
        await RiskProfileService.setUserRiskLevel(user.id, level, sensitive);
      } else {
        // For guests, we can't save to Firestore. Save locally to bypass permission error.
        try {
          const profile = JSON.parse(localStorage.getItem('guestProfile') || '{}');
          profile.riskLevel = level;
          profile.sensitiveGroups = !!sensitive;
          localStorage.setItem('guestProfile', JSON.stringify(profile));
        } catch (_e) {
          log.warn('Could not save guest risk profile to local storage', {}, 'DataManagement');
        }
      }
      setShowRiskQuestionnaire(false);
      addToast?.('Saved safety preferences.', 'success');
    } catch (err) {
      log.error('Failed to save risk profile:', err, 'DataManagement');
      addToast?.(ERROR_MESSAGES.SAVE_FAILED, 'error');
    }
  };

  const addCustomCategory = async (name: string, icon: string, color?: string) => {
    if (!user?.id) return;
    try {
      const { createCustomCategory, validateCustomCategory } = await import('../../utils/appUtils');

      const validation = validateCustomCategory(name, icon, customCategories);
      if (!validation.valid) {
        addToast?.(validation.error!, 'error');
        return;
      }

      const newCategory = createCustomCategory(name, icon, color, user.id);
      const updatedCategories = [...customCategories, newCategory];

      await DatabaseMonitoringService.updateDoc(DatabaseMonitoringService.doc(`users/${user.id}`), { customCategories: updatedCategories });

      addToast?.(`Created category "${name}"!`, 'success');
    } catch (err) {
      log.error('Error adding custom category:', err, 'DataManagement');
      addToast?.('Failed to create category. Please try again.', 'error');
    }
  };

  const updateCustomCategory = async () => {
    if (!user?.id) return;
    // Omitted for brevity
  };

  const deleteCustomCategory = async () => {
    if (!user?.id) return;
    // Omitted for brevity
  };

  return {
    household,
    setHousehold,
    isLoadingHousehold,
    customCategories,
    addCustomCategory,
    updateCustomCategory,
    deleteCustomCategory,
    showRiskQuestionnaire,
    setShowRiskQuestionnaire,
    questionnaireShownRef,
    handleRiskQuestionnaireComplete,
    lastAllergyCheckRef,
  };
}
