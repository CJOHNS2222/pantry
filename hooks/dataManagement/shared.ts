import { User, PantryItem, Household } from '../../types';

// Guest user local-storage keys and limits (no Firestore for guests)
export const GUEST_INVENTORY_KEY = 'guest_inventory';
export const GUEST_SHOPPING_KEY = 'guest_shopping';
export const GUEST_MEAL_PLAN_KEY = 'guest_meal_plan';
export const GUEST_ITEM_CAP = 20;
export const GUEST_SHOPPING_CAP = 30;

// Helper to normalize quantity from PantryItem
export const getQuantityValue = (item: PantryItem): number => {
  if (typeof item.quantity === 'number') return item.quantity;
  if (item.quantity && typeof item.quantity === 'object') return (

    (item.quantity as { amount: number }).amount || 0
  );
  // Fallback to legacy estimate string
  const est = parseFloat(item.quantity_estimate || '0');
  return isNaN(est) ? 0 : est;
};

// Shared household-id resolution logic. `inHousehold` must be computed by the
// caller since different call sites use different truthiness checks (some
// gate on `isHouseholdMember(household, user)`, others on `!!user.householdId`
// alone) — preserve each call site's original semantics by passing the
// correctly-computed boolean in.
export function resolveHouseholdId(
  user: User,
  household: Household | null,
  inHousehold?: boolean
): string | undefined {
  return inHousehold ? (household?.id || user.householdId) : undefined;
}
