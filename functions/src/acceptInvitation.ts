import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {getApps, initializeApp} from 'firebase-admin/app';
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {getAuth} from 'firebase-admin/auth';

// Ensure the Admin SDK is initialized
if (!getApps().length) {
  initializeApp();
}

/**
 * Accept a pending household invitation.
 *
 * This is the ONLY place a user is added to a household's memberIds / granted the
 * householdId custom claim as a result of an invite. inviteMember.ts merely records
 * a `status: 'pending'` entry in households/{householdId}.members — it never grants
 * access. That separation matters: Firestore rules gate household reads/writes on
 * membership in `memberIds`, and custom claims drive server-side authorization
 * elsewhere, so granting either at invite time (before the invitee has done
 * anything) would let any existing member force an arbitrary registered user into
 * their household, and would silently clobber a claim the victim already held for a
 * different household.
 *
 * Server-side re-validation, never trusting client input beyond the household id:
 *  - caller must be authenticated (request.auth)
 *  - the household must exist
 *  - there must be a `members` entry whose email matches the CALLER'S OWN verified
 *    auth token email (request.auth.token.email) — never a client-supplied email
 *  - that entry's status must still be 'pending' (guards against replay: once
 *    accepted, status flips to 'active' and a second call is a no-op rejection)
 */
export const acceptInvitation = onCall(
  {
    region: "us-central1",
    enforceAppCheck: true,
    cors: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in to accept an invitation.");
    }

    const { householdId } = request.data ?? {};
    if (!householdId || typeof householdId !== "string") {
      throw new HttpsError("invalid-argument", "householdId is required and must be a string.");
    }

    // Only ever use the authenticated caller's own token email — never a
    // client-supplied one — so a caller can't accept an invite meant for someone else.
    const email = request.auth.token.email;
    if (!email) {
      throw new HttpsError("invalid-argument", "Your account has no verified email to match against the invitation.");
    }

    const uid = request.auth.uid;
    const db = getFirestore();
    const householdRef = db.collection("households").doc(householdId);

    const result = await db.runTransaction(async (tx) => {
      const householdDoc = await tx.get(householdRef);
      if (!householdDoc.exists) {
        throw new HttpsError("not-found", "This household no longer exists.");
      }
      const householdData = householdDoc.data();
      if (!householdData) {
        throw new HttpsError("not-found", "The household data is corrupted.");
      }

      // Handle both array and legacy map formats for members, same as checkInvitation/inviteMember.
      let members: any[] = [];
      if (Array.isArray(householdData.members)) {
        members = householdData.members;
      } else if (householdData.members && typeof householdData.members === "object") {
        const mapMembers = householdData.members as Record<string, any>;
        members = Object.keys(mapMembers).map((id) => ({ id, ...mapMembers[id] }));
      }

      const memberIndex = members.findIndex(
        (m: any) => m.email?.toLowerCase() === email.toLowerCase() && m.status === "pending"
      );
      if (memberIndex === -1) {
        throw new HttpsError(
          "failed-precondition",
          "No pending invitation was found for your account in this household."
        );
      }

      const updatedMembers = members.map((m: any, idx: number) =>
        idx === memberIndex
          ? { ...m, id: uid, status: "active", acceptedAt: new Date().toISOString() }
          : m
      );

      const currentMemberIds: string[] = Array.isArray(householdData.memberIds) ? householdData.memberIds : [];
      const updatedMemberIds = currentMemberIds.includes(uid) ? currentMemberIds : [...currentMemberIds, uid];

      tx.update(householdRef, {
        members: updatedMembers,
        memberIds: updatedMemberIds,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Mirror the previous client-side joinHousehold() behavior of stamping the
      // user's own document with their new householdId.
      tx.set(
        db.collection("users").doc(uid),
        { householdId, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );

      return {
        id: householdId,
        name: householdData.name,
        members: updatedMembers,
        memberIds: updatedMemberIds,
      };
    });

    // Merge (never replace) custom claims so unrelated claim keys survive, and so we
    // don't clobber a householdId the user already has some other legitimate reason
    // to hold — this accept is the one flow explicitly authorized to overwrite it.
    try {
      const userRecord = await getAuth().getUser(uid);
      const existingClaims = userRecord.customClaims || {};
      await getAuth().setCustomUserClaims(uid, { ...existingClaims, householdId });
    } catch (err) {
      logger.error("Error merging custom claims after accepting invitation:", err);
      // Don't fail the accept over claims — membership/document state above already
      // committed and is the source of truth; claims are a perf/shortcut layer.
    }

    return { success: true, household: result };
  }
);
