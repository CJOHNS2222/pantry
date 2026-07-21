/**
 * Shared path resolution for the household/user-scoped Firestore cache documents
 * (inventory, meal plan, shopping list, saved recipes, food-waste analytics). Each
 * lives at `households/{householdId}/cache/{subcollection}` or
 * `users/{userId}/cache/{subcollection}`, preferring household scope when both are given.
 */
export function getHouseholdOrUserCachePath(subcollection: string, householdId?: string, userId?: string): string {
  if (householdId) {
    return `households/${householdId}/cache/${subcollection}`;
  }
  if (userId) {
    return `users/${userId}/cache/${subcollection}`;
  }
  throw new Error('Either householdId or userId must be provided');
}
