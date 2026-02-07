import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Member, PantryItem, Household } from '../types';
import { checkInventoryAgainstHouseholdAllergies } from '../utils/preferenceUtils';
import { NotificationService } from './notificationService';

/**
 * Service for checking household member preferences against inventory and recipes
 */
export class HouseholdPreferenceService {
  /**
   * Check all household inventory items against member allergies and create notifications
   */
  static async checkHouseholdInventoryForAllergies(householdId: string): Promise<void> {
    try {
      // Get household data
      const householdRef = doc(db, 'households', householdId);
      const householdSnap = await getDoc(householdRef);

      if (!householdSnap.exists()) {
        console.warn(`Household ${householdId} not found`);
        return;
      }

      const household = householdSnap.data() as Household;

      if (!household.members || !Array.isArray(household.members)) {
        return; // No members to check
      }

      // Get household inventory
      const inventoryRef = collection(db, 'households', householdId, 'inventory');
      const inventorySnap = await getDocs(inventoryRef);

      if (inventorySnap.empty) {
        return; // No inventory to check
      }

      const inventoryItems = inventorySnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PantryItem[];

      // Check each inventory item against all household members
      for (const item of inventoryItems) {
        const { memberViolations } = checkInventoryAgainstHouseholdAllergies(item, household.members);

        // Create notifications for each member with violations
        for (const { member, violations } of memberViolations) {
          // Check if this member has allergy notifications enabled (if we add that setting later)
          // For now, always notify about allergies as they're safety-critical

          await NotificationService.createAllergyAlert(
            member.id,
            item.item,
            member.name,
            violations,
            item.id
          );

          console.log(`Created allergy alert for ${member.name} regarding ${item.item}`);
        }
      }
    } catch (error) {
      console.error('Error checking household inventory for allergies:', error);
    }
  }

  /**
   * Get household members with their preferences
   */
  static async getHouseholdMembers(householdId: string): Promise<Member[]> {
    try {
      const householdRef = doc(db, 'households', householdId);
      const householdSnap = await getDoc(householdRef);

      if (!householdSnap.exists()) {
        return [];
      }

      const household = householdSnap.data() as Household;
      return household.members || [];
    } catch (error) {
      console.error('Error getting household members:', error);
      return [];
    }
  }

  /**
   * Check if a user should be notified about allergy alerts
   * (Can be extended with user preferences for notification suppression)
   */
  static shouldNotifyAboutAllergies(userId: string): boolean {
    // For now, always notify about allergies as they're safety-critical
    // In the future, this could check user settings for allergy notification preferences
    return true;
  }
}