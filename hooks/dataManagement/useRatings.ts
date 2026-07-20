import { useState, useCallback } from 'react';
import DatabaseMonitoringService from '../../services/databaseMonitoringService';
import { User, RecipeRating } from '../../types';
import { log } from '../../services/logService';

// Module-level TTL cache for recipe ratings (5 min TTL)
const recipeRatingsCache = new Map<string, { data: RecipeRating[]; timestamp: number }>();
const RATINGS_CACHE_TTL = 5 * 60 * 1000;

/**
 * Ratings domain: community recipe ratings. No continuous Firestore listener
 * is attached — ratings are refreshed on demand when the Community tab is
 * activated (see `refreshCommunityRatings`/`setLoadingRatingsComplete`).
 */
export function useRatings(user?: User | null) {
  const [ratings, setRatings] = useState<RecipeRating[]>([]);
  const [isLoadingRatings, setIsLoadingRatings] = useState(true);

  const getRatingsForRecipe = async (recipeTitle: string): Promise<RecipeRating[]> => {
    const cached = recipeRatingsCache.get(recipeTitle);
    if (cached && Date.now() - cached.timestamp < RATINGS_CACHE_TTL) {
      return cached.data;
    }

    try {
      const q = DatabaseMonitoringService.query(
        DatabaseMonitoringService.collection('recipeRatings'),
        DatabaseMonitoringService.where('recipeTitle', '==', recipeTitle),
        DatabaseMonitoringService.orderBy('date', 'desc'),
        DatabaseMonitoringService.limit(50)
      );
      const snap = await DatabaseMonitoringService.getDocs(q);
      if (snap.empty) {
        recipeRatingsCache.set(recipeTitle, { data: [], timestamp: Date.now() });
        return [];
      }
      const results: RecipeRating[] = snap.docs.map((d: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = d as { id: string; data: () => Record<string, any> };
        const data = doc.data();
        const dateField = data.date;
        let dateStr: string | null = null;
        if (dateField) {
          if (typeof dateField.toDate === 'function') {
            try { dateStr = dateField.toDate().toISOString(); } catch { dateStr = null; }
          } else if (typeof dateField.seconds === 'number') {
            dateStr = new Date(dateField.seconds * 1000).toISOString();
          } else if (typeof dateField._seconds === 'number') {
            dateStr = new Date(dateField._seconds * 1000).toISOString();
          } else if (typeof dateField === 'string') {
            dateStr = dateField;
          }
        }
        return { ...data, id: doc.id, date: dateStr } as RecipeRating;
      });

      recipeRatingsCache.set(recipeTitle, { data: results, timestamp: Date.now() });
      return results;
    } catch (err) {
      log.error('Failed to get ratings for recipe', { err, recipeTitle }, 'DataManagement');
      return cached ? cached.data : [];
    }
  };

  const getCommunityRatings = async (): Promise<RecipeRating[]> => {
    try {
      // Return currently cached ratings (listener keeps this fresh)
      return ratings;
    } catch (err) {
      log.error('Failed to get community ratings', { err }, 'DataManagement');
      return [];
    }
  };

   
  const refreshCommunityRatings = useCallback(async (): Promise<void> => {
    if (!user?.id) return;
    setIsLoadingRatings(true);
    try {
      const q = DatabaseMonitoringService.query(
        DatabaseMonitoringService.collection('recipeRatings'),
        DatabaseMonitoringService.orderBy('date', 'desc'),
        DatabaseMonitoringService.limit(50)
      );
      const snap = await DatabaseMonitoringService.getDocs(q);
      if (snap.empty) {
        setRatings([]);
        setIsLoadingRatings(false);
        return;
      }

      const mapped: RecipeRating[] = snap.docs.map((d: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = d as { id: string; data: () => Record<string, any> };
        const data = doc.data();
        const dateField = data.date;
        let dateStr: string | null = null;
        if (dateField) {
          if (typeof dateField.toDate === 'function') {
            try { dateStr = dateField.toDate().toISOString(); } catch { dateStr = null; }
          } else if (typeof dateField.seconds === 'number') {
            dateStr = new Date(dateField.seconds * 1000).toISOString();
          } else if (typeof dateField._seconds === 'number') {
            dateStr = new Date(dateField._seconds * 1000).toISOString();
          } else if (typeof dateField === 'string') {
            dateStr = dateField;
          }
        }
        return { ...data, id: doc.id, date: dateStr } as RecipeRating;
      });

      setRatings(mapped);
    } catch (err) {
      log.error('Failed to refresh community ratings', { err }, 'DataManagement');
    }
    setIsLoadingRatings(false);
  }, [user?.id]);

  const submitRating = async () => {
    if (!user?.id) return;
    // Omitted for brevity
  };

  const setLoadingRatingsComplete = useCallback(() => {
    setIsLoadingRatings(false);
  }, []);

  return {
    ratings,
    isLoadingRatings,
    getRatingsForRecipe,
    getCommunityRatings,
    refreshCommunityRatings,
    submitRating,
    setLoadingRatingsComplete,
  };
}
