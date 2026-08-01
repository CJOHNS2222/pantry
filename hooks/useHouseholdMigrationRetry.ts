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

// Module-level in-flight guard so clicking "Retry now" (or the effect firing
// again while a retry is still pending) can't kick off a second concurrent
// migration for the same user - bug-audit L6. The underlying
// migrateUserDataToHousehold call is itself de-duped (see the inFlightMigrations
// map in householdMigrationService.ts); this additionally stops the retry
// toast's own callback from being entered twice while one run is in progress.
const retryInFlightFor = new Set<string>();

/**
 * Retries any pending household data migration that was interrupted
 * (app crash / network failure) by surfacing a persistent toast with a retry action.
 */
export function useHouseholdMigrationRetry(user: User | null | undefined, addToast: AddToast) {
  useEffect(() => {
    if (!user?.id) return;
    const CHECKPOINT_KEY = getMigrationCheckpointKey(user.id);
    const raw = localStorage.getItem(CHECKPOINT_KEY);
    if (!raw) return;

    // User no longer belongs to any household (left it) - the checkpoint's
    // target household is gone, so it can never be retried. Clear it rather
    // than letting it linger forever (bug-audit L4).
    if (!user.householdId) {
      localStorage.removeItem(CHECKPOINT_KEY);
      retryInFlightFor.delete(user.id);
      return;
    }

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
          if (retryInFlightFor.has(user.id)) return;
          retryInFlightFor.add(user.id);
          try {
            const ok = await migrateUserDataToHousehold(householdId, user.id);
            addToast(
              ok ? 'Data migration completed successfully!' : 'Migration still has errors. Please check your connection and try again.',
              ok ? 'success' : 'error'
            );
          } finally {
            retryInFlightFor.delete(user.id);
          }
        }
      );
    } catch {
      localStorage.removeItem(CHECKPOINT_KEY);
    }
  }, [user?.id, user?.householdId]);
}
