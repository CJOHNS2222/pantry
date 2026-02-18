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
    console.log('checkInvitation called with data:', request.data);
    console.log('Auth context:', request.auth ? 'authenticated' : 'not authenticated');
    
    // Check if user is authenticated (temporarily allow unauthenticated for debugging)
    if (!request.auth) {
      console.log('No authentication provided, proceeding for debugging');
      // For debugging, allow unauthenticated requests
    }

    const { householdId, userEmail } = request.data;
    console.log('Parsed data:', { householdId, userEmail });
    
    if (!householdId || typeof householdId !== 'string') {
      throw new HttpsError("invalid-argument", "Unable to join 2: Household ID is required and must be a string.");
    }

    // Use provided email or fall back to auth token email (or allow unauthenticated for debugging)
    const email = userEmail || (request.auth ? request.auth.token.email : null);
    console.log('Using email:', email);

    if (!email) {
      throw new HttpsError("invalid-argument", "Unable to join 3: User email is required to check invitations.");
    }

    const db = admin.firestore();

    try {
      console.log('Fetching household document:', householdId);
      const householdRef = db.collection("households").doc(householdId);
      const householdDoc = await householdRef.get();
      console.log('Household document exists:', householdDoc.exists);

      if (!householdDoc.exists) {
        console.log('Household not found');
        return { isInvited: false };
      }

      const household = householdDoc.data();
      console.log('Household data keys:', household ? Object.keys(household) : 'null');
      console.log('Household members type:', household?.members ? typeof household.members : 'undefined');

      if (!household) {
        console.log('Household data is null');
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
          console.log('Converted members from map to array:', members);
        } else {
          members = [];
        }
        console.log('Processed members:', members.length, 'members found');
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
      
      console.log('Invitation check result:', { 
        email: email?.toLowerCase(), 
        isInvited, 
        membersCount: members.length, 
        members: members.map(m => ({ 
          id: m.id, 
          email: m.email?.toLowerCase(), 
          status: m.status 
        })) 
      });

      return { isInvited, household: isInvited ? household : null };
    } catch (err: any) {
      console.error('Error checking invitation:', error);
      throw new HttpsError("internal", "Unable to join 4: Failed to check invitation.");
    }
  }
);
