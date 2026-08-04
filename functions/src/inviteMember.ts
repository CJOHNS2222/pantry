
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {getApps, initializeApp} from 'firebase-admin/app';
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import { getAuth } from 'firebase-admin/auth';

// (email secret removed — email sending disabled temporarily)

// Ensure the Admin SDK is initialized
if (!getApps().length) {
  initializeApp();
}

// Same shape as PATTERNS.email in src/utils/validation.ts (client-side); duplicated
// here because functions/ is a separate TS project with no shared import path.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && email.length <= 254 && EMAIL_PATTERN.test(email);
}

// Minimum time between repeat invites to the same email/household pair, to stop
// a client bug or malicious caller from hammering getUserByEmail/notification
// writes for one address.
const INVITE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// Per-caller global rate limit — independent of the per-email/household cooldown
// above, this stops a single (verified-member) caller from hammering
// getUserByEmail / notification writes across many different email addresses.
const CALLER_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const CALLER_RATE_LIMIT_MAX = 20; // max invites per caller per window

/** Firestore-safe doc id derived from an email — doc ids can't contain "/". */
function emailToDocId(email: string): string {
  return email.trim().toLowerCase().replace(/[/]/g, "_");
}

async function assertNotInCooldown(householdId: string, email: string): Promise<void> {
  const db = getFirestore();
  const cooldownRef = db
    .collection("households")
    .doc(householdId)
    .collection("inviteCooldowns")
    .doc(emailToDocId(email));

  const snap = await cooldownRef.get();
  const lastInvitedAt: FirebaseFirestore.Timestamp | undefined = snap.data()?.lastInvitedAt;
  if (lastInvitedAt && Date.now() - lastInvitedAt.toMillis() < INVITE_COOLDOWN_MS) {
    throw new HttpsError(
      "resource-exhausted",
      "This person was already invited recently. Please wait a few minutes before re-inviting."
    );
  }

  await cooldownRef.set({ lastInvitedAt: FieldValue.serverTimestamp() }, { merge: true });
}

/** Per-caller global rate limit, checked/incremented in a transaction to avoid races. */
async function assertCallerNotRateLimited(inviterUid: string): Promise<void> {
  const db = getFirestore();
  const limitRef = db.collection("users").doc(inviterUid).collection("rateLimits").doc("inviteMember");

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(limitRef);
    const data = snap.data();
    const now = Date.now();
    const windowStart: number = data?.windowStart ?? 0;
    const count: number = data?.count ?? 0;

    if (now - windowStart > CALLER_RATE_LIMIT_WINDOW_MS) {
      // New window
      tx.set(limitRef, { windowStart: now, count: 1 });
      return;
    }

    if (count >= CALLER_RATE_LIMIT_MAX) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many invitations sent recently. Please try again later."
      );
    }

    tx.set(limitRef, { windowStart, count: count + 1 });
  });
}

// Core invite logic as a function so it can be used by both callable and HTTP handlers
async function inviteMemberCore(inviterUid: string, email: string, householdId: string) {
  if (!isValidEmail(email)) {
    throw new HttpsError("invalid-argument", "A valid email address is required.");
  }

  const db = getFirestore();

  const householdRef = db.collection("households").doc(householdId);
  const householdDoc = await householdRef.get();
  if (!householdDoc.exists) {
    throw new HttpsError("not-found", "The specified household does not exist.");
  }
  const householdData = householdDoc.data();
  if (!householdData) {
    throw new HttpsError("not-found", "The household data is corrupted.");
  }

  // Check both members array and memberIds array for backward compatibility
  const members = Array.isArray(householdData.members) ? householdData.members : [];
  const memberIds = Array.isArray(householdData.memberIds) ? householdData.memberIds : [];

  // Check if inviter is in either members or memberIds
  const isMemberByMembers = members.some((member: { id: string; }) => member.id === inviterUid);
  const isMemberByIds = memberIds.includes(inviterUid);

  if (!isMemberByMembers && !isMemberByIds) {
    throw new HttpsError("permission-denied", "You are not a member of this household.");
  }

  // Cooldown + rate-limit checks happen only AFTER membership is verified —
  // otherwise any authenticated (non-member) caller could hammer
  // getUserByEmail / write cooldown docs for arbitrary household/email pairs
  // with zero authorization (DoS + a household-existence/email-enumeration
  // oracle), and could exhaust a member's re-invite cooldown for them.
  await assertCallerNotRateLimited(inviterUid);
  await assertNotInCooldown(householdId, email);

  // Get inviter info - try from members array first, then fallback to basic info
  let inviterName = 'Someone';
  if (members.length > 0) {
    const inviter = members.find((member: { id: string; }) => member.id === inviterUid);
    inviterName = inviter?.name || 'Someone';
  }
  const householdName = householdData.name || 'a household';

  let memberIdToStore = email;
  let invitedUserName = email.split('@')[0]; // Default fallback
  let invitedUserEmail = email;
  const invitedUserAvatar = undefined;
  try {
    const auth = getAuth();
    const userRecord = await auth.getUserByEmail(email).catch(() => null);
    if (userRecord && userRecord.uid) {
      memberIdToStore = userRecord.uid;
      // Use the user's display name if available, otherwise fallback to email prefix
      invitedUserName = userRecord.displayName || email.split('@')[0];
      invitedUserEmail = userRecord.email || email;
      // Note: photoURL is not available in Firebase Functions for security reasons
    }
  } catch (err) {
    logger.warn('Unable to resolve invited email to UID:', err);
  }

  const newMember: any = { 
    id: memberIdToStore, 
    name: invitedUserName, 
    email: invitedUserEmail,
    role: 'member', 
    status: 'pending',
    joinedAt: new Date().toISOString()
  };
  
  // Add avatar only if it exists
  if (invitedUserAvatar) {
    newMember.avatar = invitedUserAvatar;
  }
  
  // Ensure members is an array and add the new member (only if not already present)
  let currentMembers: any[];
  if (Array.isArray(householdData.members)) {
    currentMembers = householdData.members;
  } else if (householdData.members && typeof householdData.members === 'object') {
    // Convert map to array (handle legacy data where members might be stored as a map)
    const mapMembers = householdData.members as Record<string, any>;
    currentMembers = Object.keys(mapMembers).map(id => ({ id, ...mapMembers[id] }));
  } else {
    currentMembers = [];
  }
  const memberExists = currentMembers.some((m: any) => m.id === memberIdToStore);
  const updatedMembers = memberExists ? currentMembers : [...currentMembers, newMember];
  
  // NOTE: we intentionally do NOT add memberIdToStore to householdData.memberIds
  // here, and do NOT call setCustomUserClaims here. Doing so at invite time would
  // grant household access (Firestore rules gate reads/writes on memberIds) and
  // clobber the invitee's custom claims before they've consented — any existing
  // member could force an arbitrary registered user into their household and hijack
  // a claim they may already hold for a different household. The invitee is only
  // added to memberIds / granted the householdId claim once they explicitly accept
  // via the acceptInvitation callable (functions/src/acceptInvitation.ts), which
  // re-validates the invite server-side against the caller's own auth token email.
  const updatePayload: any = { members: updatedMembers };
  await householdRef.update(updatePayload);

  // Send notification to invited user.
  // Registered users (have a UID) → write to their per-user cache so the bell badge picks it up.
  // Unregistered users (email-only) → fall back to the top-level collection as a best-effort.
  const notificationId = db.collection('_').doc().id; // generate a random ID
  const notificationPayload: Record<string, any> = {
    id: notificationId,
    userId: memberIdToStore,
    type: 'household_invite',
    title: 'Household Invitation',
    message: `${inviterName} has invited you to join the "${householdName}" household on Smart Pantry!`,
    priority: 'medium',
    actionType: 'join_household',
    actionLabel: 'Accept',
    actionData: { householdId },
    read: false,
  };

  const inviteeHasUid = memberIdToStore && memberIdToStore !== email;
  try {
    if (inviteeHasUid) {
      // Write into the per-user notifications cache array (same path the client uses)
      notificationPayload.createdAt = new Date().toISOString();
      const cacheRef = db.collection('users').doc(memberIdToStore).collection('cache').doc('notifications');
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(cacheRef);
        const existing: any[] = snap.exists ? ((snap.data()?.items as any[]) ?? []) : [];
        const updated = [...existing, notificationPayload].slice(-200); // cap at 200 items
        if (snap.exists) {
          tx.update(cacheRef, { items: updated });
        } else {
          tx.set(cacheRef, { items: updated });
        }
      });
    } else {
      // Invitee not yet registered — fall back to top-level collection
      notificationPayload.createdAt = FieldValue.serverTimestamp();
      await db.collection('notifications').add(notificationPayload);
    }
  } catch (err) {
    logger.error('Failed to create household invite notification:', err);
    throw new HttpsError("internal", "Failed to send invitation notification.");
  }

  // Return only a success flag — never the resolved uid/displayName. Echoing
  // whether `memberIdToStore` differs from the submitted email lets a caller
  // probe arbitrary addresses for a registered Firebase account
  // (email -> uid enumeration).
  return { success: true };
}

export const inviteMember = onCall({ enforceAppCheck: false }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'You must be logged in to invite members.');
  const inviterUid = request.auth.uid;
  const { email, householdId } = request.data;
  if (!email || !householdId) throw new HttpsError('invalid-argument', 'Email and householdId are required.');
  return await inviteMemberCore(inviterUid, email, householdId);
});

// NOTE: the `inviteMemberHttp` GET/POST HTTP fallback wrapper that used to live
// here was removed (2026-08) — it was unused by any client code path (the app only
// ever calls the `inviteMember` callable above), accepted this mutating request
// over GET (via `req.query`) with no CSRF protection, and echoed raw
// `error.message` back to callers. If an HTTP fallback is needed again,
// reintroduce it as POST-only, call `inviteMemberCore` directly (no duplicated
// logic to drift out of sync), map errors through HttpsError -> HTTP status, and
// never forward raw internal error messages.

