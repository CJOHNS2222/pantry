import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import admin from 'firebase-admin';
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import { getAuth } from 'firebase-admin/auth';

// Ensure the Admin SDK is initialized
if (!admin.apps?.length) {
  admin.initializeApp();
}

export const leaveHousehold = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be logged in to leave a household.');
  }

  const { householdId } = request.data;
  const userId = request.auth.uid;

  if (!householdId) {
    throw new HttpsError('invalid-argument', 'householdId is required.');
  }

  try {
    const db = getFirestore();
    const householdRef = db.collection("households").doc(householdId);
    const householdDoc = await householdRef.get();

    if (!householdDoc.exists) {
      throw new HttpsError("not-found", "The specified household does not exist.");
    }

    const householdData = householdDoc.data();
    const members = householdData && Array.isArray(householdData.members) ? householdData.members : [];
    const memberIds = householdData && Array.isArray(householdData.memberIds) ? householdData.memberIds : [];

    // Check if user is a member (check both arrays for backward compatibility)
    const memberIndex = members.findIndex((member: { id: string; }) => member.id === userId);
    const isMemberByIds = memberIds.includes(userId);

    if (memberIndex === -1 && !isMemberByIds) {
      throw new HttpsError("permission-denied", "You are not a member of this household.");
    }

    // Get member data for removal
    let memberToRemove = null;
    if (memberIndex !== -1) {
      memberToRemove = members[memberIndex];
    } else {
      // Create a basic member object for removal if only in memberIds
      memberToRemove = { id: userId };
    }

    // Don't allow admin/owner to leave if there are other members
    if (memberToRemove.role === 'admin' && (members.length > 1 || memberIds.length > 1)) {
      throw new HttpsError("permission-denied", "As the household admin, you cannot leave while there are other members. Transfer admin rights first or delete the household.");
    }

    // Prepare update payload
    const updatePayload: any = {};

    // Remove from members array if it exists and user is in it
    if (memberIndex !== -1) {
      updatePayload.members = FieldValue.arrayRemove(memberToRemove);
    }

    // Remove from memberIds array if it exists
    if (isMemberByIds) {
      updatePayload.memberIds = FieldValue.arrayRemove(userId);
    }

    // Only update if we have something to update
    if (Object.keys(updatePayload).length > 0) {
      await householdRef.update(updatePayload);
    }

    // Update user's document to remove householdId (only if it exists)
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    if (userDoc.exists && userDoc.data()?.householdId) {
      await userRef.update({
        householdId: FieldValue.delete()
      });
    }

    // Remove custom claim for the leaving user
    try {
      await admin.auth().setCustomUserClaims(userId, { householdId: null });
      console.log(`Custom claim 'householdId' removed for user ${userId}`);
    } catch (error) {
      console.error('Error removing custom claims:', error);
      // Don't fail the leave process if claim removal fails
    }

    // If this was the last member, delete the household
    const totalMembers = Math.max(members.length, memberIds.length);
    if (totalMembers === 1) {
      await householdRef.delete();
    }

    return { success: true, message: 'Successfully left household' };

  } catch (error) {
    console.error('Error leaving household:', error);
    throw error;
  }
});

// HTTP wrapper for environments where callable fails
export const leaveHouseholdHttp = onRequest(async (req, res) => {
  // Basic CORS handling
  res.set('Access-Control-Allow-Origin', req.get('origin') || '*');
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).send();
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    const idToken = (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) ? authHeader.split('Bearer ')[1] : (typeof req.query?.idToken === 'string' ? req.query.idToken : undefined);
    if (!idToken) { res.status(401).json({ error: 'Missing auth token' }); return; }

    const auth = getAuth();
    const decoded = await auth.verifyIdToken(idToken).catch(() => null);
    if (!decoded) { res.status(401).json({ error: 'Invalid auth token' }); return; }
    const userId = decoded.uid;

    const { householdId } = (req.body && Object.keys(req.body).length) ? req.body : req.query;
    if (!householdId) { res.status(400).json({ error: 'householdId required' }); return; }

    const db = getFirestore();
    const householdRef = db.collection("households").doc(householdId);
    const householdDoc = await householdRef.get();

    if (!householdDoc.exists) {
      res.status(404).json({ error: 'Household not found' });
      return;
    }

    const householdData = householdDoc.data();
    const members = householdData && Array.isArray(householdData.members) ? householdData.members : [];
    const memberIds = householdData && Array.isArray(householdData.memberIds) ? householdData.memberIds : [];

    // Check if user is a member (check both arrays for backward compatibility)
    const memberIndex = members.findIndex((member: { id: string; }) => member.id === userId);
    const isMemberByIds = memberIds.includes(userId);

    if (memberIndex === -1 && !isMemberByIds) {
      res.status(403).json({ error: 'Not a member of this household' });
      return;
    }

    // Get member data for removal
    let memberToRemove = null;
    if (memberIndex !== -1) {
      memberToRemove = members[memberIndex];
    } else {
      // Create a basic member object for removal if only in memberIds
      memberToRemove = { id: userId };
    }

    // Don't allow admin/owner to leave if there are other members
    if (memberToRemove.role === 'Admin' && (members.length > 1 || memberIds.length > 1)) {
      res.status(403).json({ error: 'As the household admin, you cannot leave while there are other members' });
      return;
    }

    // Prepare update payload
    const updatePayload: any = {};

    // Remove from members array if it exists and user is in it
    if (memberIndex !== -1) {
      updatePayload.members = FieldValue.arrayRemove(memberToRemove);
    }

    // Remove from memberIds array if it exists
    if (isMemberByIds) {
      updatePayload.memberIds = FieldValue.arrayRemove(userId);
    }

    // Only update if we have something to update
    if (Object.keys(updatePayload).length > 0) {
      await householdRef.update(updatePayload);
    }

    // Update user's document to remove householdId (only if it exists)
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    if (userDoc.exists && userDoc.data()?.householdId) {
      await userRef.update({
        householdId: FieldValue.delete()
      });
    }

    // Remove custom claim for the leaving user
    try {
      await admin.auth().setCustomUserClaims(userId, { householdId: null });
      console.log(`Custom claim 'householdId' removed for user ${userId}`);
    } catch (error) {
      console.error('Error removing custom claims:', error);
      // Don't fail the leave process if claim removal fails
    }

    // If this was the last member, delete the household
    const totalMembers = Math.max(members.length, memberIds.length);
    if (totalMembers === 1) {
      await householdRef.delete();
    }

    res.json({ success: true, message: 'Successfully left household' });

  } catch (error: any) {
    console.error('leaveHouseholdHttp error:', error);
    res.status(500).json({ error: error?.message || 'Failed to leave household' });
  }
});