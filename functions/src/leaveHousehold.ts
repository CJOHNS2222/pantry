import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {getApps, initializeApp} from 'firebase-admin/app';
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import { getAuth } from 'firebase-admin/auth';

// Ensure the Admin SDK is initialized
if (!getApps().length) {
  initializeApp();
}

export const leaveHousehold = onCall({ enforceAppCheck: false }, async (request) => {
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
    // Re-throw HttpsErrors as-is (already carry a safe, generic message);
    // wrap anything else so raw internal error details never reach the client.
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', 'Failed to leave household.');
  }
});

// NOTE: the `leaveHouseholdHttp` GET/POST HTTP fallback wrapper that used to live
// here was removed (2026-08) — it was unused by any client code path (the app only
// ever calls the `leaveHousehold` callable above) and had drifted out of sync with
// it: a role-case bug (`'Admin'` vs the canonical lowercase `'admin'`) meant its
// admin-can't-leave guard never fired, it accepted the household-mutating request
// over GET (via `req.query`) with no CSRF protection, and it echoed raw
// `error.message` back to callers. If an HTTP fallback is needed again, reintroduce
// it as POST-only, call the same core logic as the callable (no duplicated logic to
// drift out of sync), map errors through HttpsError -> HTTP status, and never
// forward raw internal error messages.
