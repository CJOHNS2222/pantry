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
    const members = householdData?.members || [];

    // Check if user is a member
    const memberIndex = members.findIndex((member: { id: string; }) => member.id === userId);
    if (memberIndex === -1) {
      throw new HttpsError("permission-denied", "You are not a member of this household.");
    }

    const member = members[memberIndex];

    // Don't allow admin/owner to leave if there are other members
    if (member.role === 'Admin' && members.length > 1) {
      throw new HttpsError("permission-denied", "As the household admin, you cannot leave while there are other members. Transfer admin rights first or delete the household.");
    }

    // Remove member from household
    const updatePayload: any = {
      members: FieldValue.arrayRemove(member)
    };

    if (householdData?.memberIds?.includes(userId)) {
      updatePayload.memberIds = FieldValue.arrayRemove(userId);
    }

    await householdRef.update(updatePayload);

    // Remove custom claim for the leaving user
    try {
      await admin.auth().setCustomUserClaims(userId, { householdId: null });
      console.log(`Custom claim 'householdId' removed for user ${userId}`);
    } catch (error) {
      console.error('Error removing custom claims:', error);
      // Don't fail the leave process if claim removal fails
    }

    // If this was the last member, delete the household
    if (members.length === 1) {
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
    const members = householdData?.members || [];

    // Check if user is a member
    const memberIndex = members.findIndex((member: { id: string; }) => member.id === userId);
    if (memberIndex === -1) {
      res.status(403).json({ error: 'Not a member of this household' });
      return;
    }

    const member = members[memberIndex];

    // Don't allow admin/owner to leave if there are other members
    if (member.role === 'Admin' && members.length > 1) {
      res.status(403).json({ error: 'As the household admin, you cannot leave while there are other members' });
      return;
    }

    // Remove member from household
    const updatePayload: any = {
      members: FieldValue.arrayRemove(member)
    };

    if (householdData?.memberIds?.includes(userId)) {
      updatePayload.memberIds = FieldValue.arrayRemove(userId);
    }

    await householdRef.update(updatePayload);

    // Remove custom claim for the leaving user
    try {
      await admin.auth().setCustomUserClaims(userId, { householdId: null });
      console.log(`Custom claim 'householdId' removed for user ${userId}`);
    } catch (error) {
      console.error('Error removing custom claims:', error);
      // Don't fail the leave process if claim removal fails
    }

    // If this was the last member, delete the household
    if (members.length === 1) {
      await householdRef.delete();
    }

    res.json({ success: true, message: 'Successfully left household' });

  } catch (error: any) {
    console.error('leaveHouseholdHttp error:', error);
    res.status(500).json({ error: error?.message || 'Failed to leave household' });
  }
});