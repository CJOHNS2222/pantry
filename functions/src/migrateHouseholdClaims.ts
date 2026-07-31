import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import admin from 'firebase-admin';
import {getApps} from 'firebase-admin/app';
import {getFirestore} from "firebase-admin/firestore";
import {getAuth} from 'firebase-admin/auth';

// Ensure the Admin SDK is initialized
if (!getApps().length) {
  admin.initializeApp();
}

// Core migration logic as a function so it can be used by both callable and HTTP handlers
async function migrateHouseholdClaimsCore() {
  const db = getFirestore();
  const householdsRef = db.collection('households');
  const householdsSnapshot = await householdsRef.get();

  let totalUsersUpdated = 0;
  const results: { householdId: string; usersUpdated: string[]; errors: string[] }[] = [];

  for (const householdDoc of householdsSnapshot.docs) {
    const householdId = householdDoc.id;
    const householdData = householdDoc.data();
    const memberIds = householdData?.memberIds || [];

    const usersUpdated: string[] = [];
    const errors: string[] = [];

    for (const userId of memberIds) {
      try {
        // Set the custom claim for this user
        await getAuth().setCustomUserClaims(userId, { householdId });
        usersUpdated.push(userId);
        totalUsersUpdated++;
        logger.info('Set householdId claim for user', { userId, householdId });
      } catch (err: any) {
        logger.error('Error setting claim for user', { userId, err });
        errors.push(`${userId}: ${(err as Error).message}`);
      }
    }

    results.push({
      householdId,
      usersUpdated,
      errors
    });
  }

  return {
    success: true,
    totalUsersUpdated,
    results,
    message: `Migration completed. Updated ${totalUsersUpdated} users across ${householdsSnapshot.size} households.`
  };
}

export const migrateHouseholdClaims = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be logged in to run migrations.');
  }

  // Admin-only: caller must carry the "admin" custom claim.
  if (request.auth.token?.admin !== true) {
    throw new HttpsError('permission-denied', 'Only admins may run this migration.');
  }

  try {
    return await migrateHouseholdClaimsCore();
  } catch (err: any) {
    logger.error('Migration error', err);
    throw new HttpsError('internal', 'Migration failed: ' + (err as Error).message);
  }
});
