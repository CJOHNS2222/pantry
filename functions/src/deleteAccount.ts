import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {logger} from "firebase-functions/v2";
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  initializeApp();
}

// Checkpoint collection for the "data cleaned up but auth record not yet deleted"
// window, mirroring the client-side `pending_migration_{userId}` localStorage
// checkpoint pattern used by householdMigrationService — except this one lives
// server-side in Firestore so `retryPendingAccountDeletions` (below) can pick it
// up even if the original callable's process died before it could retry itself.
const ACCOUNT_DELETIONS_COLLECTION = 'accountDeletions';

/**
 * Permanently deletes the calling user's account data from Firestore and removes
 * them from any household, then deletes the Firebase Auth account.
 *
 * The client should call onLogout() immediately after receiving a successful response.
 */
export const deleteAccount = onCall({ enforceAppCheck: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to delete your account.');
  }

  const uid = request.auth.uid;
  const db = getFirestore();
  const auth = getAuth();

  // 1. Remove user from their household (or delete household if they are the sole member)
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();

    if (userData?.householdId) {
      const householdId: string = userData.householdId;
      const householdRef = db.collection('households').doc(householdId);
      const householdDoc = await householdRef.get();

      if (householdDoc.exists) {
        const householdData = householdDoc.data()!;
        const isOwner: boolean = householdData.ownerId === uid;
        const memberIds: string[] = (householdData.memberIds || []).filter((id: string) => id !== uid);
        const members: any[] = (householdData.members || []).filter((m: any) => m.id !== uid);

        if (memberIds.length === 0) {
          // No remaining members — delete the household document
          await householdRef.delete();
        } else if (isOwner) {
          // Transfer ownership to the first remaining member
          await householdRef.update({ ownerId: memberIds[0], memberIds, members });
        } else {
          await householdRef.update({ memberIds, members });
        }
      }
    }
  } catch (err: any) {
    // Non-fatal: continue with deletion even if household cleanup fails
    logger.error('deleteAccount household cleanup error', { uid: uid.substring(0, 8), err });
  }

  // 2. Delete user subcollections via recursiveDelete.
  // Reconciled against the actual paths written by services/*CacheService.ts (via
  // getHouseholdOrUserCachePath()) and functions/src usage: every per-user cache
  // document — inventory, mealPlan, shoppingList, savedRecipes, notifications —
  // lives under the single `cache` subcollection (`users/{uid}/cache/{docId}`),
  // and usage limits live under `usage/limits`. The previous list included
  // `pantryCache`/`shoppingCache`/`mealPlanCache` (no service ever writes those
  // subcollection names) and a standalone `savedRecipes` subcollection (it's
  // actually a doc inside `cache`, already swept up by deleting `cache` itself).
  //
  // recursiveDelete (rather than a manual limit(500) batch) matches the pattern
  // already used in leaveHousehold.ts / removeHouseholdMember.ts: a plain batch
  // silently leaves data behind past 500 docs and doesn't cascade into any nested
  // subcollections, whereas recursiveDelete removes the whole subtree regardless
  // of size.
  const userRef = db.collection('users').doc(uid);
  const subcollections = ['cache', 'usage'];

  for (const subcollection of subcollections) {
    try {
      await db.recursiveDelete(userRef.collection(subcollection));
    } catch {
      // Non-fatal: continue
    }
  }

  // 3. Delete the user document itself
  await userRef.delete().catch(() => { /* Non-fatal: ignore deletion errors */ });

  // 3b. Checkpoint: Firestore data is gone at this point, but the Auth record
  // isn't yet. Record that fact so a failure right after this line doesn't
  // leave an orphaned Auth account with no data and no way to detect/retry it.
  const deletionMarkerRef = db.collection(ACCOUNT_DELETIONS_COLLECTION).doc(uid);
  await deletionMarkerRef.set({
    uid,
    dataCleanupCompletedAt: FieldValue.serverTimestamp(),
    authDeletePending: true,
    lastAttemptError: null,
  }, { merge: true }).catch((err: any) => {
    // Non-fatal to the checkpoint write itself, but log loudly — without this
    // doc a failed deleteUser below becomes silently unrecoverable.
    logger.error('deleteAccount: failed to write cleanup checkpoint', { uid: uid.substring(0, 8), err });
  });

  // 4. Delete the Firebase Auth account (admin SDK — no reauthentication required)
  try {
    await auth.deleteUser(uid);
  } catch (err: any) {
    logger.error('deleteAccount: auth.deleteUser failed after data cleanup — orphaned auth record left for retry', {
      uid: uid.substring(0, 8),
      err,
    });
    await deletionMarkerRef.set({ lastAttemptError: err?.message ?? String(err) }, { merge: true }).catch(() => {});
    throw new HttpsError(
      'internal',
      'Your account data was deleted but the sign-in record could not be removed. ' +
      'This will be retried automatically; you can also try again shortly.'
    );
  }

  // Cleanup fully succeeded — clear the checkpoint.
  await deletionMarkerRef.delete().catch(() => { /* Non-fatal: retry job will just see authDeletePending: false is absent too */ });

  return { success: true };
});

/**
 * Scheduled retry for accounts whose Firestore data was deleted but whose
 * Firebase Auth record deletion failed (see checkpoint written above). Runs
 * every 6 hours; picks up any `accountDeletions/{uid}` doc still marked
 * `authDeletePending: true` and retries `auth.deleteUser`, clearing the
 * checkpoint on success.
 */
export const retryPendingAccountDeletions = onSchedule('every 6 hours', async () => {
  const db = getFirestore();
  const auth = getAuth();

  const snapshot = await db.collection(ACCOUNT_DELETIONS_COLLECTION)
    .where('authDeletePending', '==', true)
    .limit(200)
    .get();

  if (snapshot.empty) return;

  logger.info(`retryPendingAccountDeletions: ${snapshot.size} pending auth deletion(s) to retry`);

  for (const doc of snapshot.docs) {
    const uid = doc.id;
    try {
      await auth.deleteUser(uid);
      await doc.ref.delete();
      logger.info('retryPendingAccountDeletions: recovered orphaned auth record', { uid: uid.substring(0, 8) });
    } catch (err: any) {
      // "user-not-found" means it was already deleted (e.g. by a concurrent retry) — clean up the marker.
      if (err?.code === 'auth/user-not-found') {
        await doc.ref.delete().catch(() => {});
        continue;
      }
      logger.error('retryPendingAccountDeletions: retry failed, will try again next run', {
        uid: uid.substring(0, 8),
        err,
      });
      await doc.ref.set({ lastAttemptError: err?.message ?? String(err), lastAttemptAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
    }
  }
});
