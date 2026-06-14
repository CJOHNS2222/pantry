/**
 * Household Service for Firebase operations
 * Manages household creation, member management, and household lookup
 */

import DatabaseMonitoringService from './databaseMonitoringService';
import {
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';
import { Household, Member, User } from '../types';
import { getPerformance, trace } from "firebase/performance";
import { log } from './logService';
import {
  migrateUserCacheToHousehold,
  copyHouseholdCacheToUser,
} from './householdDataMigrationService';

const performance = getPerformance();

/**
 * Get or create a household for a user
 * If user has been invited to a household, fetch that
 * If user is creating their own, create a new one
 */
export const getOrCreateHousehold = async (user: User): Promise<Household | null> => {
  const perfTrace = trace(performance, 'get_or_create_household');
  perfTrace.start();

  try {
    // First, check if user belongs to any existing household by memberIds
    const householdQuery = DatabaseMonitoringService.query(
      DatabaseMonitoringService.collection('households'),
      DatabaseMonitoringService.where('memberIds', 'array-contains', user.id)
    );

    // Option 1: Use direct Firestore (current)
    // const querySnapshot = await getDocs(householdQuery);

    // Option 2: Use DatabaseMonitoringService for tracking (recommended for analytics)
    const querySnapshot = await DatabaseMonitoringService.getDocs(householdQuery);

    if (!querySnapshot.empty) {
      // User is already in a household
      const doc = querySnapshot.docs[0];
      perfTrace.putAttribute('action', 'existing_household_found');
      const d = doc.data() as any;
      return {
        id: doc.id,
        ...d,
      } as Household;
    }

    // User is not in any household, create a new one
    perfTrace.putAttribute('action', 'creating_new_household');
    const newHousehold = await createHousehold(
      `${user.name}'s Family`,
      user
    );

    return newHousehold;
  } catch (err: any) {
    log.error('Error getting/creating household:', { err }, 'HouseholdService');
    return null;
  } finally {
    perfTrace.stop();
  }
};

/**
 * Create a new household
 */
export const createHousehold = async (
  householdName: string,
  user: User
): Promise<Household> => {
  const perfTrace = trace(performance, 'create_household');
  perfTrace.start();

  try {
    const householdId = `household_${Date.now()}`;

    const newHousehold: Household = {
      id: householdId,
      name: householdName,
      members: [
        {
          id: user.id,
          name: user.name || user.email?.split('@')[0] || 'Unknown',
          email: user.email,
          role: 'admin',
          status: 'active',
          joinedAt: new Date().toISOString(),
        },
      ],
      memberIds: [user.id],
    };

    // Add custom metrics
    perfTrace.putMetric('household_name_length', householdName.length);

    await DatabaseMonitoringService.setDoc(DatabaseMonitoringService.doc('households/' + householdId), {
      ...newHousehold,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return newHousehold;
  } finally {
    perfTrace.stop();
  }
};

/**
 * Add a member to a household (when invited user joins)
 */
export const addMemberToHousehold = async (
  householdId: string,
  member: Member
): Promise<void> => {
  const perfTrace = trace(performance, 'add_member_household');
  perfTrace.start();

  try {
    // Add custom metrics
    perfTrace.putAttribute('member_role', member.role);
    perfTrace.putAttribute('member_status', member.status);

    await DatabaseMonitoringService.updateDoc(DatabaseMonitoringService.doc('households/' + householdId), {
      members: arrayUnion(member),
      memberIds: arrayUnion(member.id),
      updatedAt: serverTimestamp(),
    });
  } finally {
    perfTrace.stop();
  }
};

/**
 * Update member status when they accept invitation
 */
export const updateMemberStatus = async (
  householdId: string,
  memberEmail: string,
  newStatus: 'active' | 'pending' | 'inactive'
): Promise<void> => {
  try {
    const householdRef = DatabaseMonitoringService.doc('households/' + householdId);
    const householdSnap = await DatabaseMonitoringService.getDoc(householdRef);

    if (!householdSnap.exists()) {
      throw new Error('Unable to join 10: Household not found');
    }

    const householdData = householdSnap.data();
    const members = householdData.members || [];
    const currentMemberIds = householdData.memberIds || [];

    const updatedMembers = members.map((m: Member) =>
      m.email?.toLowerCase() === memberEmail?.toLowerCase() ? { ...m, status: newStatus } : m
    );

    // Find the updated member to get their ID
    const updatedMember = updatedMembers.find((m: Member) =>
      m.email?.toLowerCase() === memberEmail?.toLowerCase()
    );

    const updatePayload: any = {
      members: updatedMembers,
      updatedAt: serverTimestamp(),
    };

    // If activating a member, ensure their ID is in memberIds
    if (newStatus === 'active' && updatedMember && updatedMember.id) {
      const updatedMemberIds = Array.from(new Set([...currentMemberIds, updatedMember.id]));
      if (updatedMemberIds.length !== currentMemberIds.length) {
        updatePayload.memberIds = updatedMemberIds;
      }
    }

    await DatabaseMonitoringService.updateDoc(householdRef, updatePayload);
  } catch (err: any) {
    log.error('Unable to join 10: Error updating member status:', { err }, 'HouseholdService');
    throw err;
  }
};

/**
 * Remove a member from household (admin action)
 */
export const removeMemberFromHousehold = async (
  householdId: string,
  memberId: string,
  currentUserId: string
): Promise<void> => {
  try {
    const householdRef = DatabaseMonitoringService.doc('households/' + householdId);
    const householdSnap = await DatabaseMonitoringService.getDoc(householdRef);

    if (!householdSnap.exists()) {
      throw new Error('Household not found');
    }

    const householdData = householdSnap.data();
    const members = householdData.members || [];

    // Check if current user is admin or is removing themselves
    const currentUserMember = members.find((m: Member) => m.id === currentUserId);
    const isSelfRemoval = memberId === currentUserId;
    
    if (!currentUserMember) {
      throw new Error('User not found in household');
    }
    
    if (!isSelfRemoval && currentUserMember.role !== 'admin') {
      throw new Error('Only admins can remove other members');
    }

    // Find member to remove
    const memberToRemove = members.find((m: Member) => m.id === memberId);
    if (!memberToRemove) {
      throw new Error('Member not found');
    }

    // Remove member from members and memberIds
    const updatedMembers = members.filter((m: Member) => m.id !== memberId);
    const updatePayload: any = {
      members: updatedMembers,
      updatedAt: serverTimestamp(),
    };

    if (householdData.memberIds?.includes(memberId)) {
      updatePayload.memberIds = arrayRemove(memberId);
    }

    await DatabaseMonitoringService.updateDoc(householdRef, updatePayload);

    // Copy the household caches to the departing member's personal cache
    // so they don't lose their pantry/shopping/meal-plan/recipe data.
    // Use the member's User shape from what we have available.
    const departingUser: User = { id: memberId } as User;
    copyHouseholdCacheToUser(departingUser, householdId).catch(err =>
      log.error('Cache copy failed after removing member', { err }, 'HouseholdService')
    );

    // If this was the last member besides the admin, delete the household
    if (updatedMembers.length === 1) {
      const remainingAdminId = updatedMembers[0].id;
      
      // Copy household caches to the remaining admin's personal cache so they don't lose data
      const remainingUser: User = { id: remainingAdminId } as User;
      await copyHouseholdCacheToUser(remainingUser, householdId).catch(err =>
        log.error('Cache copy failed for remaining admin', { err }, 'HouseholdService')
      );

      await DatabaseMonitoringService.deleteDoc(householdRef);
      
      // Clear householdId from the remaining admin's user document
      const adminUserRef = DatabaseMonitoringService.doc('users/' + remainingAdminId);
      await DatabaseMonitoringService.updateDoc(adminUserRef, {
        householdId: null,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err: any) {
    log.error('Error removing member from household:', { err }, 'HouseholdService');
    throw err;
  }
};

/**
 * Find a household by invitation (user email and household ID from invite link)
 */
export const findHouseholdByInvite = async (
  householdId: string,
  inviteeEmail: string,
  inviteeUserId?: string
): Promise<Household | null> => {
  try {
    // Direct Firestore lookup instead of Cloud Function
    const householdRef = DatabaseMonitoringService.doc('households/' + householdId);
    const householdSnap = await DatabaseMonitoringService.getDoc(householdRef);

    if (!householdSnap.exists()) {
      return null;
    }

    const householdData = householdSnap.data();

    // Handle both array and map formats for members
    let members = [];
    if (Array.isArray(householdData.members)) {
      members = householdData.members;
    } else if (householdData.members && typeof householdData.members === 'object') {
      // Convert map to array
      const mapMembers = householdData.members as Record<string, any>;
      members = Object.keys(mapMembers).map(id => ({ id, ...mapMembers[id] }));
    }

    // Check if user is invited
    const invitedMember = members.find((m: any) =>
      m.email?.toLowerCase() === inviteeEmail?.toLowerCase() && m.status === 'pending'
    );

    // If no pending member found, check if user is already in memberIds (they might have been invited but data got corrupted)
    if (!invitedMember && inviteeUserId && householdData.memberIds?.includes(inviteeUserId)) {
      // Create a mock member object for the return
      return {
        id: householdId,
        name: householdData.name,
        members: members,
        memberIds: householdData.memberIds || []
      } as Household;
    }

    if (!invitedMember) {
      return null;
    }

    return {
      id: householdId,
      name: householdData.name,
      members: members,
      memberIds: householdData.memberIds || []
    } as Household;
  } catch (err: any) {
    log.error('Unable to join 5: Error finding household by invite:', { err }, 'HouseholdService');
    return null;
  }
};

/**
 * Join a household (convert Invited status to Active)
 */
export const joinHousehold = async (
  householdId: string,
  user: User
): Promise<Household | null> => {
  const perfTrace = trace(performance, 'join_household');
  perfTrace.start();

  try {
    // Check if user is invited
    const household = await findHouseholdByInvite(householdId, user.email, user.id);

    if (!household) {
      perfTrace.putAttribute('result', 'not_invited');
      throw new Error('Unable to join 6: You are not invited to this household');
    }

    perfTrace.putAttribute('result', 'joining');

    // Update status to active
    await updateMemberStatus(householdId, user.email, 'active');

    // Update user's ID in household if different
    const householdRef = DatabaseMonitoringService.doc('households/' + householdId);
    const householdSnap = await DatabaseMonitoringService.getDoc(householdRef);

    if (householdSnap.exists()) {
      const members = householdSnap.data().members || [];
      const currentMemberIds = householdSnap.data().memberIds || [];
      
      const updatedMembers = members.map((m: Member) => {
        if (m.email?.toLowerCase() === user.email?.toLowerCase()) {
          return {
            ...m,
            id: user.id,
            name: user.name || user.email?.split('@')[0] || 'Unknown',
            status: 'active',
          };
        }
        return m;
      });

      // Ensure memberIds are unique
      const updatedMemberIds = Array.from(new Set([...currentMemberIds, user.id]));

      await DatabaseMonitoringService.updateDoc(householdRef, {
        members: updatedMembers,
        memberIds: updatedMemberIds,
        updatedAt: serverTimestamp(),
      });
    }

    // Update the user document with householdId
    await DatabaseMonitoringService.updateDoc(DatabaseMonitoringService.doc('users/' + user.id), {
      householdId: householdId,
      updatedAt: serverTimestamp(),
    });

    // Merge the user's personal caches into the household caches (deduplicating).
    // Fire-and-forget: non-fatal if it fails, user is already joined.
    migrateUserCacheToHousehold(user, householdId).catch(err =>
      log.error('Cache migration failed after joining household', { err }, 'HouseholdService')
    );

    // Return updated household
    return {
      ...household,
      members: household.members.map((m: Member) =>
        m.email === user.email ? { ...m, status: 'active', id: user.id } : m
      ),
    };
  } catch (err: any) {
    log.error('Unable to join 7: Error joining household:', { err }, 'HouseholdService');
    throw err;
  } finally {
    perfTrace.stop();
  }
};

/**
 * Get all households a user belongs to (admin of or is a member of)
 */
export const getUserHouseholds = async (userEmail: string): Promise<Household[]> => {
  try {
    const householdQuery = DatabaseMonitoringService.query(
      DatabaseMonitoringService.collection('households'),
      DatabaseMonitoringService.where('members', 'array-contains', { email: userEmail })
    );

    const querySnapshot = await DatabaseMonitoringService.getDocs(householdQuery);

    return querySnapshot.docs.map((doc: any) => {
      const d = doc.data() as any;
      return {
        id: doc.id,
        ...d,
      } as Household;
    });
  } catch (err: any) {
    log.error('Error getting user households:', { err }, 'HouseholdService');
    return [];
  }
};
