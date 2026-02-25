
import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import { defineJsonSecret } from "firebase-functions/params";
import admin from 'firebase-admin';
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import { getAuth } from 'firebase-admin/auth';
import { sendEmail } from './helpers/sendEmail.js';

// Define the secret for Gmail configuration
const gmailConfigSecret = defineJsonSecret("EMAILSECRET");

// Ensure the Admin SDK is initialized
if (!admin.apps?.length) {
  admin.initializeApp();
}

// Core invite logic as a function so it can be used by both callable and HTTP handlers
async function inviteMemberCore(inviterUid: string, email: string, householdId: string) {
  console.log('inviteMemberCore called with:', { inviterUid, email, householdId });
  const db = getFirestore();

  const householdRef = db.collection("households").doc(householdId);
  console.log('Household ref path:', householdRef.path);
  const householdDoc = await householdRef.get();
  console.log('Household doc exists:', householdDoc.exists);
  if (!householdDoc.exists) {
    throw new HttpsError("not-found", "The specified household does not exist.");
  }
  const householdData = householdDoc.data();
  if (!householdData) {
    throw new HttpsError("not-found", "The household data is corrupted.");
  }

  // Add a small delay to see if it's a race condition
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('Full household data:', JSON.stringify(householdData, null, 2));
  console.log('Household data members type:', typeof householdData.members);
  console.log('Household data members:', householdData.members);
  console.log('Household data memberIds type:', typeof householdData.memberIds);
  console.log('Household data memberIds:', householdData.memberIds);
  console.log('Inviter UID:', inviterUid);

  // Check both members array and memberIds array for backward compatibility
  const members = Array.isArray(householdData.members) ? householdData.members : [];
  const memberIds = Array.isArray(householdData.memberIds) ? householdData.memberIds : [];

  console.log('Members array after check:', members);
  console.log('Member IDs array:', memberIds);

  // Check if inviter is in either members or memberIds
  const isMemberByMembers = members.some((member: { id: string; }) => member.id === inviterUid);
  const isMemberByIds = memberIds.includes(inviterUid);

  console.log('Is member by members array:', isMemberByMembers);
  console.log('Is member by memberIds array:', isMemberByIds);

  if (!isMemberByMembers && !isMemberByIds) {
    console.log('User not found in members or memberIds');
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
    console.warn('Unable to resolve invited email to UID:', err);
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
      await admin.auth().setCustomUserClaims(memberIdToStore, { householdId });
      console.log(`Custom claim 'householdId' set for user ${memberIdToStore} to ${householdId}`);
    } catch (err: any) {
      console.error('Error setting custom claims:', err);
      // Don't fail the invite if claim setting fails
    }
  }

  const notificationsRef = db.collection('notifications');
  await notificationsRef.add({ 
    userId: memberIdToStore, 
    type: 'household_invite',
    title: 'Household Invitation',
    message: `${inviterName} has invited you to join the "${householdName}" household on Smart Pantry!`, 
    priority: 'medium',
    actionType: 'join_household',
    actionLabel: 'Accept',
    actionData: { householdId },
    read: false,
    createdAt: FieldValue.serverTimestamp()
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

export const inviteMember = onCall(
  { secrets: [gmailConfigSecret] },
  async (request) => {
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

// Leave household function (admin privileges to bypass security rules)
export const leaveHousehold = onCall(
  { secrets: [gmailConfigSecret] },
  async (request) => {
    const { householdId } = request.data;
    const userId = request.auth?.uid;

    if (!userId) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    if (!householdId) {
      throw new HttpsError("invalid-argument", "householdId is required");
    }

    const db = getFirestore();
    const householdRef = db.collection("households").doc(householdId);
    const householdDoc = await householdRef.get();

    if (!householdDoc.exists) {
      throw new HttpsError("not-found", "Household not found");
    }

    const householdData = householdDoc.data();
    if (!householdData) {
      throw new HttpsError("not-found", "Household data is corrupted");
    }

    const members = Array.isArray(householdData.members) ? householdData.members : [];
    const memberIds = Array.isArray(householdData.memberIds) ? householdData.memberIds : [];

    // Check if user is a member
    if (!memberIds.includes(userId)) {
      throw new HttpsError("permission-denied", "You are not a member of this household");
    }

    // Remove user from members and memberIds
    const updatedMembers = members.filter((m: any) => m.id !== userId);
    const updatedMemberIds = memberIds.filter((id: string) => id !== userId);

    const updatePayload: any = {
      members: updatedMembers,
      memberIds: updatedMemberIds,
      updatedAt: FieldValue.serverTimestamp()
    };

    await householdRef.update(updatePayload);

    // If there are fewer than 2 members remaining, copy all data and delete the household
    if (updatedMembers.length < 2) {
      try {
        // Copy household inventory to user's personal collection
        const householdInventoryRef = householdRef.collection('inventory');
        const inventorySnapshot = await householdInventoryRef.get();
        
        if (!inventorySnapshot.empty) {
          const batch = db.batch();
          const userInventoryRef = db.collection('users').doc(userId).collection('inventory');
          
          inventorySnapshot.docs.forEach((docItem) => {
            const itemData = docItem.data();
            const newItemRef = userInventoryRef.doc(docItem.id);
            batch.set(newItemRef, itemData);
          });
          
          await batch.commit();
          console.log(`Copied ${inventorySnapshot.size} inventory items to user ${userId}`);
        }

        // Copy household meal plan
        const householdMealPlanRef = householdRef.collection('mealPlan');
        const mealPlanSnapshot = await householdMealPlanRef.get();
        
        if (!mealPlanSnapshot.empty) {
          const batch = db.batch();
          const userMealPlanRef = db.collection('users').doc(userId).collection('mealPlan');
          
          mealPlanSnapshot.docs.forEach((docItem) => {
            const planData = docItem.data();
            const newPlanRef = userMealPlanRef.doc(docItem.id);
            batch.set(newPlanRef, planData);
          });
          
          await batch.commit();
          console.log(`Copied ${mealPlanSnapshot.size} meal plan items to user ${userId}`);
        }

        // Copy household shopping list
        const householdShoppingListRef = householdRef.collection('shoppingList');
        const shoppingListSnapshot = await householdShoppingListRef.get();
        
        if (!shoppingListSnapshot.empty) {
          const batch = db.batch();
          const userShoppingListRef = db.collection('users').doc(userId).collection('shoppingList');
          
          shoppingListSnapshot.docs.forEach((docItem) => {
            const listData = docItem.data();
            const newListRef = userShoppingListRef.doc(docItem.id);
            batch.set(newListRef, listData);
          });
          
          await batch.commit();
          console.log(`Copied ${shoppingListSnapshot.size} shopping list items to user ${userId}`);
        }

        // Copy household saved recipes
        const householdSavedRecipesRef = householdRef.collection('savedRecipes');
        const savedRecipesSnapshot = await householdSavedRecipesRef.get();
        
        if (!savedRecipesSnapshot.empty) {
          const batch = db.batch();
          const userSavedRecipesRef = db.collection('users').doc(userId).collection('savedRecipes');
          
          savedRecipesSnapshot.docs.forEach((docItem) => {
            const recipeData = docItem.data();
            const newRecipeRef = userSavedRecipesRef.doc(docItem.id);
            batch.set(newRecipeRef, recipeData);
          });
          
          await batch.commit();
          console.log(`Copied ${savedRecipesSnapshot.size} saved recipes to user ${userId}`);
        }

      } catch (copyError) {
        console.error('Error copying household data to user:', copyError);
        // Continue with household deletion even if copying fails
      }

      // Delete the household
      await householdRef.delete();
      console.log(`Deleted household ${householdId} as it had fewer than 2 remaining members`);
    }

    return { success: true };
  }
);

// HTTP handler for leaving household
export const leaveHouseholdHttp = onRequest(
  { secrets: [gmailConfigSecret] },
  async (req, res) => {
    try {
      if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) { res.status(401).json({ error: 'auth required' }); return; }

      const idToken = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(idToken);
      if (!decoded) { res.status(401).json({ error: 'Invalid auth token' }); return; }

      const userId = decoded.uid;
      const { householdId } = req.body;
      if (!householdId) { res.status(400).json({ error: 'householdId required' }); return; }

      const db = getFirestore();
      const householdRef = db.collection("households").doc(householdId);
      const householdDoc = await householdRef.get();

      if (!householdDoc.exists) { res.status(404).json({ error: 'Household not found' }); return; }

      const householdData = householdDoc.data()!;
      const members = Array.isArray(householdData.members) ? householdData.members : [];
      const memberIds = Array.isArray(householdData.memberIds) ? householdData.memberIds : [];

      if (!memberIds.includes(userId)) { res.status(403).json({ error: 'not a member' }); return; }

      const updatedMembers = members.filter((m: any) => m.id !== userId);
      const updatedMemberIds = memberIds.filter((id: string) => id !== userId);

      await householdRef.update({
        members: updatedMembers,
        memberIds: updatedMemberIds,
        updatedAt: FieldValue.serverTimestamp()
      });

      if (updatedMembers.length < 2) {
        try {
          // Copy household inventory to user's personal collection
          const householdInventoryRef = householdRef.collection('inventory');
          const inventorySnapshot = await householdInventoryRef.get();
          
          if (!inventorySnapshot.empty) {
            const batch = db.batch();
            const userInventoryRef = db.collection('users').doc(userId).collection('inventory');
            
            inventorySnapshot.docs.forEach((docItem) => {
              const itemData = docItem.data();
              const newItemRef = userInventoryRef.doc(docItem.id);
              batch.set(newItemRef, itemData);
            });
            
            await batch.commit();
            console.log(`Copied ${inventorySnapshot.size} inventory items to user ${userId}`);
          }

          // Copy household meal plan
          const householdMealPlanRef = householdRef.collection('mealPlan');
          const mealPlanSnapshot = await householdMealPlanRef.get();
          
          if (!mealPlanSnapshot.empty) {
            const batch = db.batch();
            const userMealPlanRef = db.collection('users').doc(userId).collection('mealPlan');
            
            mealPlanSnapshot.docs.forEach((docItem) => {
              const planData = docItem.data();
              const newPlanRef = userMealPlanRef.doc(docItem.id);
              batch.set(newPlanRef, planData);
            });
            
            await batch.commit();
            console.log(`Copied ${mealPlanSnapshot.size} meal plan items to user ${userId}`);
          }

          // Copy household shopping list
          const householdShoppingListRef = householdRef.collection('shoppingList');
          const shoppingListSnapshot = await householdShoppingListRef.get();
          
          if (!shoppingListSnapshot.empty) {
            const batch = db.batch();
            const userShoppingListRef = db.collection('users').doc(userId).collection('shoppingList');
            
            shoppingListSnapshot.docs.forEach((docItem) => {
              const listData = docItem.data();
              const newListRef = userShoppingListRef.doc(docItem.id);
              batch.set(newListRef, listData);
            });
            
            await batch.commit();
            console.log(`Copied ${shoppingListSnapshot.size} shopping list items to user ${userId}`);
          }

          // Copy household saved recipes
          const householdSavedRecipesRef = householdRef.collection('savedRecipes');
          const savedRecipesSnapshot = await householdSavedRecipesRef.get();
          
          if (!savedRecipesSnapshot.empty) {
            const batch = db.batch();
            const userSavedRecipesRef = db.collection('users').doc(userId).collection('savedRecipes');
            
            savedRecipesSnapshot.docs.forEach((docItem) => {
              const recipeData = docItem.data();
              const newRecipeRef = userSavedRecipesRef.doc(docItem.id);
              batch.set(newRecipeRef, recipeData);
            });
            
            await batch.commit();
            console.log(`Copied ${savedRecipesSnapshot.size} saved recipes to user ${userId}`);
          }

        } catch (copyError) {
          console.error('Error copying household data to user:', copyError);
          // Continue with household deletion even if copying fails
        }

        // Delete the household
        await householdRef.delete();
        console.log(`Deleted household ${householdId} as it had fewer than 2 remaining members`);
      }

      res.json({ success: true });
      return;
    } catch (err: any) {
      console.error('leaveHouseholdHttp error:', err);
      res.status(500).json({ error: err?.message || 'internal' });
      return;
    }
  }
);

