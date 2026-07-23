import DatabaseMonitoringService from './databaseMonitoringService';
import { InventoryCacheService } from './inventoryCacheService';
import { Member, Household } from '../types';
import { checkInventoryAgainstHouseholdAllergies } from '../utils/preferenceUtils';
import { NotificationService } from './notificationService';
import { log } from './logService';

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
      const householdRef = DatabaseMonitoringService.doc('households', householdId);
      const householdSnap = await DatabaseMonitoringService.getDoc(householdRef);

      if (!householdSnap.exists()) {
        log.warn(`Household ${householdId} not found`, {}, 'HouseholdPreferenceService');
        return;
      }

      const household = householdSnap.data() as Household;

      if (!household.members || !Array.isArray(household.members)) {
        return; // No members to check
      }

      // Check if any household member has allergies - if not, skip expensive inventory read
      const hasAnyAllergies = household.members.some(member => (member.allergies?.length || 0) > 0);
      if (!hasAnyAllergies) {
        log.debug('No household members have allergies set, skipping inventory allergy check', {}, 'HouseholdPreferenceService');
        return;
      }

      // Get household inventory from cache
      const inventory = await InventoryCacheService.getCachedInventory(householdId);

      if (inventory.length === 0) {
        return; // No inventory to check
      }

      // Check each inventory item against all household members
      for (const item of inventory) {
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

          log.debug(`Created allergy alert for ${member.name} regarding ${item.item}`, {}, 'HouseholdPreferenceService');
        }
      }
    } catch (err: any) {
      log.error('Error checking household inventory for allergies:', { err }, 'HouseholdPreferenceService');
    }
  }

  /**
   * Get household members with their preferences
   */
  static async getHouseholdMembers(householdId: string): Promise<Member[]> {
    try {
      const householdRef = DatabaseMonitoringService.doc('households', householdId);
      const householdSnap = await DatabaseMonitoringService.getDoc(householdRef);

      if (!householdSnap.exists()) {
        return [];
      }

      const household = householdSnap.data() as Household;
      return household.members || [];
    } catch (err: any) {
      log.error('Error getting household members:', { err }, 'HouseholdPreferenceService');
      return [];
    }
  }

  /**
   * Check if a user should be notified about allergy alerts
   * (Can be extended with user preferences for notification suppression)
   */
  static shouldNotifyAboutAllergies(_userId: string): boolean {
    // For now, always notify about allergies as they're safety-critical
    // In the future, this could check user settings for allergy notification preferences
    return true;
  }
}
