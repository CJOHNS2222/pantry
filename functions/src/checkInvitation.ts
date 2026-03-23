import {onCall, HttpsError} from "firebase-functions/v2/https";
import admin from 'firebase-admin';

// Ensure the Admin SDK is initialized
if (!admin.apps?.length) {
  admin.initializeApp();
}

export const checkInvitation = onCall(
  { 
    region: "us-central1",
    enforceAppCheck: false,
    cors: true
  },
  async (request) => {
    // Check if user is authenticated
    if (!request.auth) {
      // Allow unauthenticated requests for email-based invite checks
    }

    const { householdId, userEmail } = request.data;
    
    if (!householdId || typeof householdId !== 'string') {
      throw new HttpsError("invalid-argument", "Unable to join 2: Household ID is required and must be a string.");
    }

    // Use provided email or fall back to auth token email (or allow unauthenticated for debugging)
    const email = userEmail || (request.auth ? request.auth.token.email : null);

    if (!email) {
      throw new HttpsError("invalid-argument", "Unable to join 3: User email is required to check invitations.");
    }

    const db = admin.firestore();

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
        console.error('Error processing members:', membersError);
        throw new HttpsError("internal", "Unable to join 4: Failed to process household members data.");
      }

      // Check if user is invited
      let isInvited = false;
      try {
        isInvited = members.some(
          (m: any) => m.email?.toLowerCase() === email?.toLowerCase() && m.status === 'pending'
        ) || false;
      } catch (checkError) {
        console.error('Error checking invitation status:', checkError);
        throw new HttpsError("internal", "Unable to join 4: Failed to check invitation status.");
      }
      
      return { isInvited, household: isInvited ? household : null };
    } catch (err: any) {
      console.error('Error checking invitation:', err);
      throw new HttpsError("internal", "Unable to join 4: Failed to check invitation.");
    }
  }
);
