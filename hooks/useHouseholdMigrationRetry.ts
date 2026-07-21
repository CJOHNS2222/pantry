import { useEffect } from 'react';
import { User } from '../types';
import { migrateUserDataToHousehold, getMigrationCheckpointKey } from '../services/householdMigrationService';

type AddToast = (
  message: string,
  type?: 'success' | 'error' | 'info' | 'warning',
  ttl?: number,
  actionLabel?: string,
  action?: () => void,
) => void;

/**
 * Retries any pending household data migration that was interrupted
 * (app crash / network failure) by surfacing a persistent toast with a retry action.
 */
export function useHouseholdMigrationRetry(user: User | null | undefined, addToast: AddToast) {
  useEffect(() => {
    if (!user?.id || !user?.householdId) return;
    const CHECKPOINT_KEY = getMigrationCheckpointKey(user.id);
    const raw = localStorage.getItem(CHECKPOINT_KEY);
    if (!raw) return;

    try {
      const { householdId } = JSON.parse(raw) as { householdId: string; timestamp: number };
      // Only retry if the checkpoint is for the household the user is currently in
      if (householdId !== user.householdId) {
        localStorage.removeItem(CHECKPOINT_KEY);
        return;
      }

      addToast(
        'A previous data migration was incomplete.',
        'warning',
        0, // persistent
        'Retry now',
        async () => {
          const ok = await migrateUserDataToHousehold(householdId, user.id);
          addToast(
            ok ? 'Data migration completed successfully!' : 'Migration still has errors. Please check your connection and try again.',
            ok ? 'success' : 'error'
          );
        }
      );
    } catch {
      localStorage.removeItem(CHECKPOINT_KEY);
    }
  }, [user?.id, user?.householdId]);
}
