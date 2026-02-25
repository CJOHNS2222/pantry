// hooks/useDataListener.ts
import { useEffect } from 'react';
import DatabaseMonitoringService from '../services/databaseMonitoringService';

/**
 * Generic hook for creating Firestore collection listeners
 * Eliminates duplicate listener logic in useDataManagement
 */
export function useDataListener<T>(
  collectionPath: string,
  onData: (data: T[]) => void,
  validator?: (data: any) => T,
  errorHandler?: (error: Error) => void
) {
  useEffect(() => {
    if (!collectionPath) return;

    const unsubscribe = DatabaseMonitoringService.onSnapshot(
      DatabaseMonitoringService.collection(collectionPath),
      (snapshot) => {
        const data = snapshot.docs.map((doc: any) => {
          const docData = { id: doc.id, ...doc.data() };
          return validator ? validator(docData) : (docData as T);
        });
        onData(data);
      },
      (error) => {
        console.error(`Listener failed for ${collectionPath}:`, error);
        errorHandler?.(error);
      }
    );

    return unsubscribe;
  }, [collectionPath, onData, validator, errorHandler]);
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
