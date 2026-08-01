import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import admin from 'firebase-admin';
import {getApps} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';

// Ensure the Admin SDK is initialized
if (!getApps().length) {
  admin.initializeApp();
}

export const checkInvitation = onCall(
  {
    region: "us-central1",
    enforceAppCheck: true,
    cors: true
  },
  async (request) => {
    // Require authentication - never trust a client-supplied email.
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in to check invitations.");
    }

    const { householdId } = request.data;

    if (!householdId || typeof householdId !== 'string') {
      throw new HttpsError("invalid-argument", "Unable to join 2: Household ID is required and must be a string.");
    }

    // Only ever use the authenticated caller's own token email.
    const email = request.auth.token.email;

    if (!email) {
      throw new HttpsError("invalid-argument", "Unable to join 3: User email is required to check invitations.");
    }

    const db = getFirestore();

    try {
      const householdRef = db.collection("households").doc(householdId);
      const householdDoc = await householdRef.get();

      if (!householdDoc.exists) {
        return { isInvited: false };
      }

      const household = householdDoc.data();

      if (!household) {
        return { isInvited: false };
      }

      // Handle both array and map formats for members
      let members = [];
      try {
        if (household && Array.isArray(household.members)) {
          members = household.members;
        } else if (household?.members && typeof household.members === 'object') {
          // Convert map to array (handle legacy data where members might be stored as a map)
          const mapMembers = household.members as Record<string, any>;
          members = Object.keys(mapMembers).map(id => ({ id, ...mapMembers[id] }));
        } else {
          members = [];
        }
      } catch (membersError) {
        logger.error('Error processing members', membersError);
        throw new HttpsError("internal", "Unable to join 4: Failed to process household members data.");
      }

      // Check if user is invited
      let isInvited = false;
      try {
        isInvited = members.some(
          (m: any) => m.email?.toLowerCase() === email?.toLowerCase() && m.status === 'pending'
        ) || false;
      } catch (checkError) {
        logger.error('Error checking invitation status', checkError);
        throw new HttpsError("internal", "Unable to join 4: Failed to check invitation status.");
      }
      
      return {
        isInvited,
        householdName: isInvited && typeof household.name === 'string' ? household.name : undefined,
      };
    } catch (err: any) {
      logger.error('Error checking invitation', err);
      throw new HttpsError("internal", "Unable to join 4: Failed to check invitation.");
    }
  }
);
