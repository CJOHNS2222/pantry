import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import admin from 'firebase-admin';
import {getApps} from 'firebase-admin/app';
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import { getAuth } from 'firebase-admin/auth';

// Ensure the Admin SDK is initialized
if (!getApps().length) {
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
      await getAuth().setCustomUserClaims(userId, { householdId: null });
      logger.info('Custom claim householdId removed for user', { userId });
    } catch (err: any) {
      logger.error('Error removing custom claims', err);
      // Don't fail the leave process if claim removal fails
    }

    // If only one member remains, disband the household and clear their householdId
    const remainingMembers = members.filter((m: { id: string; }) => m.id !== userId);
    const remainingMemberIds = memberIds.filter((id: string) => id !== userId);
    const remainingCount = Math.max(remainingMembers.length, remainingMemberIds.length);

    if (remainingCount === 1) {
      const lastMemberId = remainingMembers.length === 1 ? remainingMembers[0].id : remainingMemberIds[0];
      
      // Copy household caches to the remaining user's cache before deleting household doc
      try {
        const cacheDocs = ['inventory', 'shoppingList', 'mealPlan'];
        for (const cacheDocName of cacheDocs) {
          const hhCacheRef = db.collection("households").doc(householdId).collection("cache").doc(cacheDocName);
          const userCacheRef = db.collection("users").doc(lastMemberId).collection("cache").doc(cacheDocName);
          const hhCacheDoc = await hhCacheRef.get();
          if (hhCacheDoc.exists) {
            const cacheData = hhCacheDoc.data();
            if (cacheData) {
              await userCacheRef.set(cacheData);
            }
          }
        }
      } catch (err: any) {
        logger.error('Error copying household cache to remaining admin', err);
      }

      // .delete() only removes the household doc itself — its subcollections
      // (cache/*, presence/*, activity/*) are NOT cascade-deleted by Firestore and
      // would otherwise be orphaned forever. recursiveDelete removes the whole subtree.
      await db.recursiveDelete(householdRef);

      // Update user document
      const lastUserRef = db.collection("users").doc(lastMemberId);
      const lastUserDoc = await lastUserRef.get();
      if (lastUserDoc.exists) {
        await lastUserRef.update({
          householdId: FieldValue.delete()
        });
      }

      // Remove custom claims
      try {
        await getAuth().setCustomUserClaims(lastMemberId, { householdId: null });
        logger.info('Custom claim householdId removed for last remaining admin', { userId: lastMemberId });
      } catch (err: any) {
        logger.error('Error removing custom claims for last remaining admin', err);
      }
    } else if (remainingCount === 0) {
      await db.recursiveDelete(householdRef);
    }

    return { success: true, message: 'Successfully left household' };

  } catch (err: any) {
    logger.error('Error leaving household', err);
    throw err;
  }
});

// Explicit allowlist of known app origins (web hosting, marketing site, local dev, Capacitor WebView).
const ALLOWED_ORIGINS = new Set([
  'https://ornate-compass-478504-e1.web.app',
  'https://ornate-compass-478504-e1.firebaseapp.com',
  'https://stock-spoon-website.web.app',
  'http://localhost:3000',
  'https://localhost', // Capacitor default androidScheme/iosScheme WebView origin
]);

// HTTP wrapper for environments where callable fails
export const leaveHouseholdHttp = onRequest(async (req, res) => {
  // Basic CORS handling - explicit allowlist only, no credentials (auth is Bearer-token based)
  const origin = req.get('origin');
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).send();
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    const idToken = (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) ? authHeader.split('Bearer ')[1] : undefined;
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
      await getAuth().setCustomUserClaims(userId, { householdId: null });
      logger.info('Custom claim householdId removed for user', { userId });
    } catch (err: any) {
      logger.error('Error removing custom claims', err);
      // Don't fail the leave process if claim removal fails
    }

    // If only one member remains, disband the household and clear their householdId
    const remainingMembers = members.filter((m: { id: string; }) => m.id !== userId);
    const remainingMemberIds = memberIds.filter((id: string) => id !== userId);
    const remainingCount = Math.max(remainingMembers.length, remainingMemberIds.length);

    if (remainingCount === 1) {
      const lastMemberId = remainingMembers.length === 1 ? remainingMembers[0].id : remainingMemberIds[0];
      
      // Copy household caches to the remaining user's cache before deleting household doc
      try {
        const cacheDocs = ['inventory', 'shoppingList', 'mealPlan'];
        for (const cacheDocName of cacheDocs) {
          const hhCacheRef = db.collection("households").doc(householdId).collection("cache").doc(cacheDocName);
          const userCacheRef = db.collection("users").doc(lastMemberId).collection("cache").doc(cacheDocName);
          const hhCacheDoc = await hhCacheRef.get();
          if (hhCacheDoc.exists) {
            const cacheData = hhCacheDoc.data();
            if (cacheData) {
              await userCacheRef.set(cacheData);
            }
          }
        }
      } catch (err: any) {
        logger.error('Error copying household cache to remaining admin', err);
      }

      // .delete() only removes the household doc itself — its subcollections
      // (cache/*, presence/*, activity/*) are NOT cascade-deleted by Firestore and
      // would otherwise be orphaned forever. recursiveDelete removes the whole subtree.
      await db.recursiveDelete(householdRef);

      // Update user document
      const lastUserRef = db.collection("users").doc(lastMemberId);
      const lastUserDoc = await lastUserRef.get();
      if (lastUserDoc.exists) {
        await lastUserRef.update({
          householdId: FieldValue.delete()
        });
      }

      // Remove custom claims
      try {
        await getAuth().setCustomUserClaims(lastMemberId, { householdId: null });
        logger.info('Custom claim householdId removed for last remaining admin', { userId: lastMemberId });
      } catch (err: any) {
        logger.error('Error removing custom claims for last remaining admin', err);
      }
    } else if (remainingCount === 0) {
      await db.recursiveDelete(householdRef);
    }

    res.json({ success: true, message: 'Successfully left household' });

  } catch (error: any) {
    logger.error('leaveHouseholdHttp error', error);
    res.status(500).json({ error: error?.message || 'Failed to leave household' });
  }
});
