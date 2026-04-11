import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { log } from '../services/logService';

export function useIsAdmin(userId?: string) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(Boolean(userId));

  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      setIsAdmin(false);
      setIsLoadingAdmin(false);
      return;
    }

    setIsLoadingAdmin(true);

    getDoc(doc(db, 'admins', userId))
      .then((snapshot) => {
        if (!cancelled) {
          setIsAdmin(snapshot.exists());
        }
      })
      .catch((error: unknown) => {
        log.warn('Failed to load admin marker', {
          userId,
          message: error instanceof Error ? error.message : String(error),
        }, 'Admin');
        if (!cancelled) {
          setIsAdmin(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingAdmin(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { isAdmin, isLoadingAdmin };
}