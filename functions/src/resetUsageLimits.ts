import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

const db = getFirestore();
const USER_PAGE_SIZE = 500;

// Free-tier weekly reset defaults. Mirrors the free-tier entries of
// `IN_APP_DEFAULTS` in services/remoteConfigService.ts (limit_free_searches_weekly,
// limit_free_recipes_max, limit_free_mealplanning_weekly, limit_free_gemini_weekly).
// functions/ is a separate TS project from the app and can't import that
// client-SDK-based module directly, so these are kept in sync manually — update
// both places together if the free-tier caps ever change.
const FREE_TIER_DEFAULTS = {
  searchesWeekly: 5,
  recipesMax: 2,
  mealPlanningWeeklyRecipes: 1,
  geminiWeekly: 5,
};

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // Adjust to Sunday (start of week)
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function performUsageReset(): Promise<void> {
  logger.info('Starting weekly usage limits reset');

  try {
    // Paginate over the users collection instead of pulling it all into memory at once.
    const usersRef = db.collection('users');

    let resetCount = 0;
    const errors: string[] = [];
    let lastDocId: string | undefined;

    for (;;) {
      let pageQuery = usersRef.orderBy('__name__').limit(USER_PAGE_SIZE);
      if (lastDocId) {
        pageQuery = pageQuery.startAfter(lastDocId);
      }
      const pageSnapshot = await pageQuery.get();
      if (pageSnapshot.empty) break;

      for (const userDoc of pageSnapshot.docs) {
        try {
          const userId = userDoc.id;
          const usageRef = db.collection('users').doc(userId).collection('usage').doc('limits');

          // Always reset, creating the doc if it doesn't exist. A single merge
          // write (no pre-read) handles both cases: existing docs keep their
          // other fields (e.g. `recipes.used`, `resolvedTier`), and the
          // weekly/max fields below are recomputed from remoteConfig for the
          // user's actual tier on their next getUsageLimits() read anyway
          // (see services/usageService.ts), so seeding free-tier defaults here
          // is only a safe fallback for brand-new docs, not a hard cap.
          const now = new Date();
          const weekStart = getWeekStart(now);

          await usageRef.set({
            searches: {
              weekly: FREE_TIER_DEFAULTS.searchesWeekly,
              used: 0,
              resetDate: weekStart
            },
            recipes: {
              max: FREE_TIER_DEFAULTS.recipesMax,
              used: 0
            },
            mealPlanning: {
              weeklyRecipes: FREE_TIER_DEFAULTS.mealPlanningWeeklyRecipes,
              weeklyUsed: 0,
              twoWeekPlanning: false,
              resetDate: weekStart
            },
            gemini: {
              weekly: FREE_TIER_DEFAULTS.geminiWeekly,
              used: 0,
              resetDate: weekStart
            },
            lastUpdated: now
          }, { merge: true });

          resetCount++;
        } catch (err: any) {
          const errorMsg = `Failed to reset usage for user ${userDoc.id}: ${err}`;
          logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      lastDocId = pageSnapshot.docs[pageSnapshot.docs.length - 1].id;
      if (pageSnapshot.docs.length < USER_PAGE_SIZE) break;
    }

    logger.info(`Weekly usage reset completed. Reset ${resetCount} users. Errors: ${errors.length}`);

    if (errors.length > 0) {
      logger.warn('Errors during reset:', errors);
    }

  } catch (err: any) {
    logger.error('Critical error during weekly usage reset:', err);
    throw err;
  }
}

export const resetWeeklyUsageLimits = onSchedule(
  {
    schedule: '0 0 * * 0', // Every Sunday at midnight (0 0 * * 0)
    timeZone: 'UTC',
    retryCount: 3,
    maxRetrySeconds: 60,
  },
  performUsageReset
);
