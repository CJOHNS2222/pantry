// hooks/useDataListener.ts
import { useEffect, useRef } from 'react';
import DatabaseMonitoringService from '../services/databaseMonitoringService';
import { log } from '../services/logService';

/**
 * Generic hook for creating Firestore collection listeners
 * Eliminates duplicate listener logic in useDataManagement
 *
 * `onData`/`validator`/`errorHandler` are read via mutable refs updated every
 * render rather than being effect dependencies. This avoids two problems with
 * naively depending on them: (a) callers passing inline arrow functions would
 * cause the Firestore listener to unsubscribe/resubscribe on every render
 * (wasted reads, resets `hasPendingWrites` state), and (b) the alternative of
 * omitting them from deps without a ref would let the effect's closure go
 * stale and keep calling the callback identity from the first render.
 */
export function useDataListener<T>(
  collectionPath: string,
  onData: (data: T[]) => void,
  validator?: (data: any) => T,
  errorHandler?: (error: Error) => void
) {
  const onDataRef = useRef(onData);
  onDataRef.current = onData;
  const validatorRef = useRef(validator);
  validatorRef.current = validator;
  const errorHandlerRef = useRef(errorHandler);
  errorHandlerRef.current = errorHandler;

  useEffect(() => {
    if (!collectionPath) return;

    const unsubscribe = DatabaseMonitoringService.onSnapshot(
      DatabaseMonitoringService.collection(collectionPath),
      (snapshot) => {
        const data = snapshot.docs.map((doc: any) => {
          const docData = { id: doc.id, ...doc.data() };
          return validatorRef.current ? validatorRef.current(docData) : (docData as T);
        });
        onDataRef.current(data);
      },
      (error) => {
        log.error(`Listener failed for ${collectionPath}:`, { error: (error as Error)?.message }, 'useDataListener');
        errorHandlerRef.current?.(error);
      }
    );

    return unsubscribe;
    // Only re-subscribe when the collection path itself changes - callback
    // identity changes are handled via the refs above.
  }, [collectionPath]);
}

/**
 * Hook for listening to user-scoped collections
 */
export function useUserDataListener<T>(
  userId: string | undefined,
  collectionName: string,
  onData: (data: T[]) => void,
  validator?: (data: any) => T,
  errorHandler?: (error: Error) => void
) {
  const collectionPath = userId ? `users/${userId}/${collectionName}` : '';
  useDataListener(collectionPath, onData, validator, errorHandler);
}

/**
 * Hook for listening to household-scoped collections
 */
export function useHouseholdDataListener<T>(
  householdId: string | undefined,
  collectionName: string,
  onData: (data: T[]) => void,
  validator?: (data: any) => T,
  errorHandler?: (error: Error) => void
) {
  const collectionPath = householdId ? `households/${householdId}/${collectionName}` : '';
  useDataListener(collectionPath, onData, validator, errorHandler);
}

/**
 * Hook that automatically chooses between user and household collections
 * based on household membership status
 */
export function useScopedDataListener<T>(
  userId: string | undefined,
  householdId: string | undefined,
  inHousehold: boolean,
  collectionName: string,
  onData: (data: T[]) => void,
  validator?: (data: any) => T,
  errorHandler?: (error: Error) => void
) {
  const collectionPath = inHousehold && householdId
    ? `households/${householdId}/${collectionName}`
    : userId
    ? `users/${userId}/${collectionName}`
    : '';

  useDataListener(collectionPath, onData, validator, errorHandler);
}
