
import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import admin from 'firebase-admin';
import {getApps} from 'firebase-admin/app';
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import { getAuth } from 'firebase-admin/auth';

// (email secret removed — email sending disabled temporarily)

// Ensure the Admin SDK is initialized
if (!getApps().length) {
  admin.initializeApp();
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

// Core invite logic as a function so it can be used by both callable and HTTP handlers
async function inviteMemberCore(inviterUid: string, email: string, householdId: string) {
  if (!isValidEmail(email)) {
    throw new HttpsError("invalid-argument", "A valid email address is required.");
  }

  await assertNotInCooldown(householdId, email);

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
  let currentMembers = [];
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
  
  const updatePayload: any = { members: updatedMembers };
  if (memberIdToStore && memberIdToStore !== email) {
    const currentMemberIds = Array.isArray(householdData.memberIds) ? householdData.memberIds : [];
    const memberIdExists = currentMemberIds.includes(memberIdToStore);
    if (!memberIdExists) {
      updatePayload.memberIds = [...currentMemberIds, memberIdToStore];
    }
  }
  await householdRef.update(updatePayload);

  // Set custom claim for the invited user if they have a UID
  if (memberIdToStore && memberIdToStore !== email) {
    try {
      await getAuth().setCustomUserClaims(memberIdToStore, { householdId });
      // Custom claim set successfully
    } catch (err: any) {
      logger.error('Error setting custom claims:', err);
      // Don't fail the invite if claim setting fails
    }
  }

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

  return { success: true, newMember };
}

export const inviteMember = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'You must be logged in to invite members.');
  const inviterUid = request.auth.uid;
  const { email, householdId } = request.data;
  if (!email || !householdId) throw new HttpsError('invalid-argument', 'Email and householdId are required.');
  return await inviteMemberCore(inviterUid, email, householdId);
});

// Explicit allowlist of known app origins (web hosting, marketing site, local dev, Capacitor WebView).
const ALLOWED_ORIGINS = new Set([
  'https://ornate-compass-478504-e1.web.app',
  'https://ornate-compass-478504-e1.firebaseapp.com',
  'https://stock-spoon-website.web.app',
  'http://localhost:3000',
  'https://localhost', // Capacitor default androidScheme/iosScheme WebView origin
]);

// HTTP wrapper with CORS for environments where callable fails (dev fallback)
export const inviteMemberHttp = onRequest(async (req, res) => {
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
    const inviterUid = decoded.uid;
    const { email, householdId } = (req.body && Object.keys(req.body).length) ? req.body : req.query;
    if (!email || !householdId) { res.status(400).json({ error: 'email and householdId required' }); return; }
    await inviteMemberCore(inviterUid, email as string, householdId as string);
    res.json({ success: true });
    return;
  } catch (err: any) {
    logger.error('inviteMemberHttp error:', err);
    res.status(500).json({ error: err?.message || 'internal' });
    return;
  }
});

