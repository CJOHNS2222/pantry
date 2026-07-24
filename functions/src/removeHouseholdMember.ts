/**
 * removeHouseholdMember.ts — Firebase Cloud Function
 *
 * Admin-removes-another-member flow. Previously done client-side in
 * `services/householdService.ts`'s `removeMemberFromHousehold`, which could only
 * update the household doc itself (the admin's own write permissions) — it could
 * never clear the REMOVED member's `users/{memberId}.householdId` field or copy
 * their cache, because Firestore rules correctly block one user from writing to
 * another user's `users/{uid}/...` subtree. Those writes silently failed
 * (permission-denied, swallowed by a fire-and-forget `.catch()`), leaving the
 * removed member's own client still holding a stale `householdId` and endlessly
 * retrying household presence/activity/cache writes it no longer has access to.
 *
 * Runs with Admin SDK privileges so it can legitimately touch both docs.
 */

import {onCall, HttpsError} from 'firebase-functions/v2/https';
import {logger} from 'firebase-functions/v2';
import admin from 'firebase-admin';
import {getFirestore, FieldValue} from 'firebase-admin/firestore';

if (!admin.apps?.length) {
  admin.initializeApp();
}

async function copyHouseholdCacheToUser(db: FirebaseFirestore.Firestore, householdId: string, userId: string) {
  const cacheDocs = ['inventory', 'shoppingList', 'mealPlan', 'savedRecipes'];
  for (const cacheDocName of cacheDocs) {
    const hhCacheRef = db.collection('households').doc(householdId).collection('cache').doc(cacheDocName);
    const userCacheRef = db.collection('users').doc(userId).collection('cache').doc(cacheDocName);
    const hhCacheDoc = await hhCacheRef.get();
    if (hhCacheDoc.exists) {
      const cacheData = hhCacheDoc.data();
      if (cacheData) {
        await userCacheRef.set(cacheData);
      }
    }
  }
}

async function clearHouseholdIdFromUser(db: FirebaseFirestore.Firestore, userId: string) {
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  if (userDoc.exists && userDoc.data()?.householdId) {
    await userRef.update({householdId: FieldValue.delete()});
  }
  try {
    await admin.auth().setCustomUserClaims(userId, {householdId: null});
  } catch (err: any) {
    logger.error('Error removing custom claims', {userId, message: err.message});
  }
}

export const removeHouseholdMember = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be logged in.');
  }

  const {householdId, memberId} = (request.data ?? {}) as {householdId?: string; memberId?: string};
  const callerId = request.auth.uid;

  if (!householdId || !memberId) {
    throw new HttpsError('invalid-argument', 'householdId and memberId are required.');
  }
  if (memberId === callerId) {
    throw new HttpsError('invalid-argument', 'Use leaveHousehold to remove yourself.');
  }

  const db = getFirestore();
  const householdRef = db.collection('households').doc(householdId);

  try {
    const householdDoc = await householdRef.get();
    if (!householdDoc.exists) {
      throw new HttpsError('not-found', 'Household not found.');
    }

    const data = householdDoc.data() || {};
    const members: Array<{id: string; role: string}> = Array.isArray(data.members) ? data.members : [];
    const memberIds: string[] = Array.isArray(data.memberIds) ? data.memberIds : [];

    const caller = members.find((m) => m.id === callerId);
    if (!caller || caller.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Only the household admin can remove other members.');
    }

    const memberToRemove = members.find((m) => m.id === memberId);
    if (!memberToRemove && !memberIds.includes(memberId)) {
      throw new HttpsError('not-found', 'Member not found in this household.');
    }

    const updatedMembers = members.filter((m) => m.id !== memberId);
    const updatePayload: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
      members: updatedMembers,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (memberIds.includes(memberId)) {
      updatePayload.memberIds = FieldValue.arrayRemove(memberId);
    }
    await householdRef.update(updatePayload);

    // Preserve the departing member's pantry/shopping/meal-plan/recipes in their
    // own personal cache before cutting off their household access.
    await copyHouseholdCacheToUser(db, householdId, memberId).catch((err: any) =>
      logger.error('Cache copy failed for removed member', {memberId, message: err.message})
    );
    await clearHouseholdIdFromUser(db, memberId);

    // If only the admin remains, disband the household (matches existing
    // leaveHousehold behavior for the symmetric case).
    if (updatedMembers.length === 1) {
      const remainingAdminId = updatedMembers[0].id;
      await copyHouseholdCacheToUser(db, householdId, remainingAdminId).catch((err: any) =>
        logger.error('Cache copy failed for remaining admin', {remainingAdminId, message: err.message})
      );
      // .delete() only removes the household doc itself — its subcollections
      // (cache/*, presence/*, activity/*) are NOT cascade-deleted by Firestore and
      // would otherwise be orphaned forever (and keep answering any still-attached
      // listener). recursiveDelete removes the whole subtree.
      await db.recursiveDelete(householdRef);
      await clearHouseholdIdFromUser(db, remainingAdminId);
    }

    logger.info('Household member removed', {householdId, memberId, removedBy: callerId});
    return {success: true};
  } catch (err: any) {
    if (err instanceof HttpsError) throw err;
    logger.error('Error removing household member', {message: err.message});
    throw new HttpsError('internal', err.message || 'Failed to remove member.');
  }
});
