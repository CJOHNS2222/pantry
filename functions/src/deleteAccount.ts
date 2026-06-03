import { onCall, HttpsError } from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import admin from 'firebase-admin';
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from 'firebase-admin/auth';

if (!admin.apps?.length) {
  admin.initializeApp();
}

/**
 * Permanently deletes the calling user's account data from Firestore and removes
 * them from any household, then deletes the Firebase Auth account.
 *
 * The client should call onLogout() immediately after receiving a successful response.
 */
export const deleteAccount = onCall(async (request) => {
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

  // 2. Delete user subcollections in batches
  const userRef = db.collection('users').doc(uid);
  const subcollections = ['cache', 'usage', 'pantryCache', 'shoppingCache', 'mealPlanCache', 'savedRecipes'];

  for (const subcollection of subcollections) {
    try {
      const snapshot = await userRef.collection(subcollection).limit(500).get();
      if (!snapshot.empty) {
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
    } catch {
      // Non-fatal: continue
    }
  }

  // 3. Delete the user document itself
  await userRef.delete().catch(() => {});

  // 4. Delete the Firebase Auth account (admin SDK — no reauthentication required)
  await auth.deleteUser(uid);

  return { success: true };
});
