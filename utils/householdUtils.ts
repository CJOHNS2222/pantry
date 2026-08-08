import { Household, User, Member } from '../types';

/**
 * Checks if a user is a member of a household
 * @param h The household object
 * @param u The user object
 * @returns True if the user is a member of the household
 */
export function isHouseholdMember(h: Household | null | undefined, u: User | null | undefined) {
  if (!h || !u) return false;
  // Prefer the members array — it carries status, so we can exclude pending invites.
  // Treat a missing status as 'active' for backward-compat with legacy data.
  if (Array.isArray(h.members) && h.members.length > 0) {
    return h.members.some(
      (m: Member) =>
        ((m.id && m.id === u.id) || (m.email && m.email === u.email)) &&
        (m.status === 'active' || !m.status)
    );
  }
  // Fallback: legacy households that only have memberIds (no members array).
  return Array.isArray(h.memberIds) && h.memberIds.includes(u.id);
}
