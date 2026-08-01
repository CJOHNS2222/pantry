import { useEffect, useMemo, useState } from 'react';
import { RecipeRating, StructuredRecipe } from '../../types';
import { getCachedCommunityRatedRecipes } from '../../services/recipeService';
import { log } from '../../services/logService';

export interface RecipeStats {
  title: string;
  totalRating: number;
  count: number;
  comments: RecipeRating[];
}

/**
 * Loads the cached community-rated recipes once, then derives per-recipe rating
 * stats (average, comment list) sorted by average rating. Extracted from
 * Community.tsx (F37).
 */
export function useCommunityRatings(onLoaded: () => void) {
  const [localLoading, setLocalLoading] = useState(false);
  const [ratingsState, setRatingsState] = useState<RecipeRating[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLocalLoading(true);
        const cached = await getCachedCommunityRatedRecipes();
        if (!mounted) return;

        if (Array.isArray(cached) && cached.length > 0) {
          const first = cached[0] as unknown as Record<string, unknown>;
          if (first && (first.recipeTitle || first.comment || first.userName)) {
            const ratings: RecipeRating[] = cached.map((r) => {
              const item = r as unknown as Record<string, unknown>;
              return {
                id: String(item.id || ''),
                recipeTitle: String(item.recipeTitle || ''),
                rating: Number(item.rating || 0),
                comment: String(item.comment || ''),
                userName: String(item.userName || ''),
                date: String(item.date || ''),
                recipe: item.recipe as StructuredRecipe | undefined
              };
            });
            setRatingsState(ratings);
          } else {
            const synthetic: RecipeRating[] = cached.map((r, i: number) => {
              const item = r as unknown as Record<string, unknown>;
              const averageRating = item.averageRating;
              const lastUpdated = item.lastUpdated;
              return {
                id: r.id || `community_${i}`,
                recipeTitle: r.title || 'Untitled',
                rating: (typeof averageRating === 'number' ? Math.round(averageRating * 10) / 10 : 0),
                comment: r.description || '',
                userName: 'Community',
                date: String(lastUpdated || r.dateSaved || new Date().toISOString()),
                recipe: r
              };
            });
            setRatingsState(synthetic);
          }
        }
      } catch (e) {
        log.error('Failed to load cached community recipes', { error: e }, 'Community');
        return;
      } finally {
        if (mounted) {
          setLocalLoading(false);
          onLoaded();
        }
      }
    };
    load();
    return () => { mounted = false; };
    // onLoaded intentionally omitted from deps: only run once on mount, matching prior behavior.
  }, []);

  // Group ratings by recipe title and calculate average
  const sortedRecipes = useMemo(() => {
    const recipeStats = ratingsState.reduce((acc, curr) => {
      const key = curr.recipeTitle || 'Untitled';
      if (!key || key === 'Untitled' || !curr.recipeTitle) {
        return acc;
      }
      if (!acc[key]) {
        acc[key] = {
          title: key,
          totalRating: 0,
          count: 0,
          comments: []
        };
      }
      acc[key].totalRating += (typeof curr.rating === 'number' ? curr.rating : 0);
      acc[key].count += 1;
      acc[key].comments.push(curr);
      return acc;
    }, {} as Record<string, RecipeStats>);

    return Object.values(recipeStats)
      .filter((stat): stat is RecipeStats => {
        const s = stat as RecipeStats;
        return !!(s && typeof s === 'object' && 'count' in s && 'title' in s &&
               s.count > 0 && s.title && s.title !== 'Untitled');
      })
      .sort((a, b) => (b.totalRating / Math.max(1, b.count)) - (a.totalRating / Math.max(1, a.count)));
  }, [ratingsState]);

  return { localLoading, sortedRecipes };
}
