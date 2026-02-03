import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

const db = getFirestore();

export const resetWeeklyUsageLimits = onSchedule(
  {
    schedule: '0 0 * * 0', // Every Sunday at midnight (0 0 * * 0)
    timeZone: 'UTC',
    retryCount: 3,
    maxRetrySeconds: 60,
  },
  async () => {
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

          if (usageDoc.exists) {
            // Reset weekly counters
            await usageRef.update({
              'searches.used': 0,
              'mealPlanning.weeklyUsed': 0,
              'gemini.used': 0,
              'searches.resetDate': new Date(),
              'mealPlanning.resetDate': new Date(),
              'gemini.resetDate': new Date(),
              lastUpdated: new Date()
            });

            resetCount++;
          }
        } catch (error) {
          const errorMsg = `Failed to reset usage for user ${userDoc.id}: ${error}`;
          logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      logger.info(`Weekly usage reset completed. Reset ${resetCount} users. Errors: ${errors.length}`);

      if (errors.length > 0) {
        logger.warn('Errors during reset:', errors);
      }

    } catch (error) {
      logger.error('Critical error during weekly usage reset:', error);
      throw error;
    }
  }
);