import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

const db = getFirestore();

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
    // Get all users with usage limits
    const usersRef = db.collection('users');
    const usersSnapshot = await usersRef.get();

    let resetCount = 0;
    const errors: string[] = [];

    for (const userDoc of usersSnapshot.docs) {
      try {
        const userId = userDoc.id;
        const usageRef = db.collection('users').doc(userId).collection('usage').doc('limits');
        const usageDoc = await usageRef.get();

        // Always reset, creating the doc if it doesn't exist
        const now = new Date();
        const weekStart = getWeekStart(now);

        if (usageDoc.exists) {
          // Update existing doc
          await usageRef.set({
            searches: {
              used: 0,
              resetDate: weekStart
            },
            mealPlanning: {
              weeklyUsed: 0,
              resetDate: weekStart
            },
            gemini: {
              used: 0,
              resetDate: weekStart
            },
            lastUpdated: now
          }, { merge: true });
        } else {
          // Create new doc with initial structure
          const initialData = {
            searches: {
              weekly: 10, // default free plan
              used: 0,
              resetDate: weekStart
            },
            recipes: {
              max: 50, // default free plan
              used: 0
            },
            mealPlanning: {
              weeklyRecipes: 5, // default free plan
              weeklyUsed: 0,
              twoWeekPlanning: false,
              resetDate: weekStart
            },
            gemini: {
              weekly: 5, // default free plan
              used: 0,
              resetDate: weekStart
            },
            lastUpdated: now
          };
          await usageRef.set(initialData);
        }

        resetCount++;
      } catch (err: any) {
        const errorMsg = `Failed to reset usage for user ${userDoc.id}: ${err}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }
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

export const resetUsageLimitsNow = onRequest(
  {
    cors: true,
    timeoutSeconds: 540, // 9 minutes
    memory: '1GiB',
  },
  async (req, res) => {
    // Manual trigger disabled for safety. Use scheduled `resetWeeklyUsageLimits`.
    res.status(403).send('Manual reset disabled. Use scheduled resetWeeklyUsageLimits.');
  }
);
