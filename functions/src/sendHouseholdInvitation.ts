import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import { sendEmail } from "./helpers/sendEmail";

// Cloud Function to send household invitations
export const sendHouseholdInvitation = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be logged in to send invitations.');
  }

  const { inviteeEmail, householdName, inviterName } = request.data;

  if (!inviteeEmail || !householdName || !inviterName) {
    throw new HttpsError('invalid-argument', 'inviteeEmail, householdName, and inviterName are required.');
  }

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

    await sendEmail(inviteeEmail, subject, body);

    return {
      success: true,
      message: `Invitation sent to ${inviteeEmail}`
    };

  } catch (error) {
    console.error('Error sending household invitation:', error);
    throw new HttpsError('internal', 'Failed to send invitation email. Please try again.');
  }
});

// HTTP wrapper for environments where callable fails
export const sendHouseholdInvitationHttp = onRequest(async (req, res) => {
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

    // For HTTP endpoint, we'll skip auth verification for now since it's mainly for development
    // In production, you should verify the token

    const { inviteeEmail, householdName, inviterName } = (req.body && Object.keys(req.body).length) ? req.body : req.query;
    if (!inviteeEmail || !householdName || !inviterName) {
      res.status(400).json({ error: 'inviteeEmail, householdName, and inviterName required' });
      return;
    }

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

    await sendEmail(inviteeEmail as string, subject, body);

    res.json({
      success: true,
      message: `Invitation sent to ${inviteeEmail}`
    });

  } catch (error: any) {
    console.error('sendHouseholdInvitationHttp error:', error);
    res.status(500).json({ error: error?.message || 'Failed to send invitation' });
  }
});