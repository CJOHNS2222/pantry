
import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import admin from 'firebase-admin';
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import { getAuth } from 'firebase-admin/auth';
import { sendEmail } from './helpers/sendEmail.js';

// Ensure the Admin SDK is initialized
if (!admin.apps?.length) {
  admin.initializeApp();
}

// Core invite logic as a function so it can be used by both callable and HTTP handlers
async function inviteMemberCore(inviterUid: string, email: string, householdId: string) {
  console.log('inviteMemberCore called with:', { inviterUid, email, householdId });
  const db = getFirestore();

  const householdRef = db.collection("households").doc(householdId);
  const householdDoc = await householdRef.get();
  if (!householdDoc.exists) {
    throw new HttpsError("not-found", "The specified household does not exist.");
  }
  const householdData = householdDoc.data();
  const members = householdData?.members || [];
  if (!members.some((member: { id: string; }) => member.id === inviterUid)) {
    throw new HttpsError("permission-denied", "You are not a member of this household.");
  }

  // Get inviter info
  const inviter = members.find((member: { id: string; }) => member.id === inviterUid);
  const inviterName = inviter?.name || 'Someone';
  const householdName = householdData?.name || 'a household';

  let memberIdToStore = email;
  try {
    const auth = getAuth();
    const userRecord = await auth.getUserByEmail(email).catch(() => null);
    if (userRecord && userRecord.uid) memberIdToStore = userRecord.uid;
  } catch (err) {
    console.warn('Unable to resolve invited email to UID:', err);
  }

  const newMember = { id: memberIdToStore, name: email.split('@')[0], email, role: 'member', status: 'Active' };
  const updatePayload: any = { members: FieldValue.arrayUnion(newMember) };
  if (memberIdToStore && memberIdToStore !== email) updatePayload.memberIds = FieldValue.arrayUnion(memberIdToStore);
  await householdRef.update(updatePayload);

  // Set custom claim for the invited user if they have a UID
  if (memberIdToStore && memberIdToStore !== email) {
    try {
      await admin.auth().setCustomUserClaims(memberIdToStore, { householdId });
      console.log(`Custom claim 'householdId' set for user ${memberIdToStore} to ${householdId}`);
    } catch (error) {
      console.error('Error setting custom claims:', error);
      // Don't fail the invite if claim setting fails
    }
  }

  const notificationsRef = db.collection('notifications');
  await notificationsRef.add({ 
    email, 
    type: 'household_invite', 
    householdId, 
    householdName,
    inviterName,
    message: `${inviterName} has invited you to join the "${householdName}" household on Smart Pantry!`, 
    timestamp: FieldValue.serverTimestamp(), 
    read: false 
  });

  // Send email invitation
  try {
    const subject = `You're invited to join ${householdName} on Smart Pantry!`;
    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #a51401;">Household Invitation</h2>
        <p>Hi there!</p>
        <p><strong>${inviterName}</strong> has invited you to join their household <strong>"${householdName}"</strong> on Smart Pantry!</p>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>What you can do:</h3>
          <ul>
            <li>Share pantry inventory with family members</li>
            <li>Collaborate on meal planning</li>
            <li>View and rate community recipes</li>
            <li>Keep shopping lists in sync</li>
          </ul>
        </div>

        <p style="margin-top: 30px;">
          <a href="https://smartpantry.app" style="background-color: #a51401; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Open Smart Pantry
          </a>
        </p>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          If you don't have an account yet, you can sign up for free at <a href="https://smartpantry.app">smartpantry.app</a>
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          This invitation was sent by ${inviterName}. If you believe this was sent in error, you can safely ignore this email.
        </p>
      </div>
    `;

    await sendEmail(email, subject, body);
    console.log('Email invitation sent successfully to:', email);
  } catch (emailError) {
    console.error('Failed to send email invitation:', emailError);
    // Don't fail the whole invite process if email fails
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

// HTTP wrapper with CORS for environments where callable fails (dev fallback)
export const inviteMemberHttp = onRequest(async (req, res) => {
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
    const inviterUid = decoded.uid;
    const { email, householdId } = (req.body && Object.keys(req.body).length) ? req.body : req.query;
    if (!email || !householdId) { res.status(400).json({ error: 'email and householdId required' }); return; }
    await inviteMemberCore(inviterUid, email as string, householdId as string);
    res.json({ success: true });
    return;
  } catch (err: any) {
    console.error('inviteMemberHttp error:', err);
    res.status(500).json({ error: err?.message || 'internal' });
    return;
  }
});

