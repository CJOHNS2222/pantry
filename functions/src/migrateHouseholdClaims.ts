import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import admin from 'firebase-admin';
import {getFirestore} from "firebase-admin/firestore";

// Ensure the Admin SDK is initialized
if (!admin.apps?.length) {
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
        await admin.auth().setCustomUserClaims(userId, { householdId });
        usersUpdated.push(userId);
        totalUsersUpdated++;
        console.log(`Set householdId claim for user ${userId} to ${householdId}`);
      } catch (error) {
        console.error(`Error setting claim for user ${userId}:`, error);
        errors.push(`${userId}: ${(error as Error).message}`);
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

  // Only allow admin users to run this migration (you might want to check for admin claims)
  // For now, allowing any authenticated user - you should restrict this in production

  try {
    return await migrateHouseholdClaimsCore();
  } catch (error) {
    console.error('Migration error:', error);
    throw new HttpsError('internal', 'Migration failed: ' + (error as Error).message);
  }
});

// HTTP version for direct calling (useful for migration scripts)
export const migrateHouseholdClaimsHttp = onRequest(
  { cors: true, region: "us-central1" },
  async (req, res) => {
    // Only allow POST requests
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    try {
      // For security, you might want to add authentication checks here
      // For now, allowing any request - you should restrict this in production

      const result = await migrateHouseholdClaimsCore();
      res.status(200).json(result);
    } catch (error) {
      console.error('HTTP Migration error:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }
);