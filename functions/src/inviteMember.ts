
import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import admin from 'firebase-admin';
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import { getAuth } from 'firebase-admin/auth';

// (email secret removed — email sending disabled temporarily)

// Ensure the Admin SDK is initialized
if (!admin.apps?.length) {
  admin.initializeApp();
}

// Core invite logic as a function so it can be used by both callable and HTTP handlers
async function inviteMemberCore(inviterUid: string, email: string, householdId: string) {
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
      await admin.auth().setCustomUserClaims(memberIdToStore, { householdId });
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
    logger.error('inviteMemberHttp error:', err);
    res.status(500).json({ error: err?.message || 'internal' });
    return;
  }
});

// Leave household function (admin privileges to bypass security rules)
export const leaveHousehold = onCall(async (request) => {
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
          logger.log(`Copied ${inventorySnapshot.size} inventory items to user ${userId}`);
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
          logger.log(`Copied ${mealPlanSnapshot.size} meal plan items to user ${userId}`);
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
          logger.log(`Copied ${shoppingListSnapshot.size} shopping list items to user ${userId}`);
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
          logger.log(`Copied ${savedRecipesSnapshot.size} saved recipes to user ${userId}`);
        }

      } catch (copyError) {
        logger.error('Error copying household data to user:', copyError);
        // Continue with household deletion even if copying fails
      }

      // Delete the household
      await householdRef.delete();
      logger.log(`Deleted household ${householdId} as it had fewer than 2 remaining members`);
    }

    return { success: true };
  }
);

// HTTP handler for leaving household
export const leaveHouseholdHttp = onRequest(
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
            logger.log(`Copied ${inventorySnapshot.size} inventory items to user ${userId}`);
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
            logger.log(`Copied ${mealPlanSnapshot.size} meal plan items to user ${userId}`);
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
            logger.log(`Copied ${shoppingListSnapshot.size} shopping list items to user ${userId}`);
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
            logger.log(`Copied ${savedRecipesSnapshot.size} saved recipes to user ${userId}`);
          }

        } catch (copyError) {
          logger.error('Error copying household data to user:', copyError);
          // Continue with household deletion even if copying fails
        }

        // Delete the household
        await householdRef.delete();
        logger.log(`Deleted household ${householdId} as it had fewer than 2 remaining members`);
      }

      res.json({ success: true });
      return;
    } catch (err: any) {
      logger.error('leaveHouseholdHttp error:', err);
      res.status(500).json({ error: err?.message || 'internal' });
      return;
    }
  }
);

